require('dotenv').config();

const path = require('path');
const logger = require('./utils/logger');
const { NETWORKS, resolveEnabledNetworks } = require('./config/networks');
const TokenModel = require('./database/tokenModel');
const TelegramClient = require('./bot/telegram');
const CommandRouter = require('./bot/commandRouter');
const DexService = require('./services/dexService');
const PriceService = require('./services/priceService');
const FormatService = require('./services/formatService');
const QueueService = require('./services/queueService');
const SchedulerService = require('./services/schedulerService');
const EvmListener = require('./chains/evmListener');
const SolanaListener = require('./chains/solanaListener');
const { startAdminServer } = require('./admin/server');

const parseGroupIds = (raw) => {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const toSafeInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const createListeners = ({ enabledNetworks, tokenModel, queueService }) => {
  const listeners = [];

  for (const networkKey of enabledNetworks) {
    const networkConfig = NETWORKS[networkKey];
    if (!networkConfig) {
      continue;
    }

    if (networkConfig.type === 'evm') {
      listeners.push(
        new EvmListener({
          networkConfig,
          tokenModel,
          queueService,
          logger: logger.child({ module: 'evm-listener', network: networkKey })
        })
      );
      continue;
    }

    if (networkConfig.type === 'solana') {
      listeners.push(
        new SolanaListener({
          networkConfig,
          tokenModel,
          queueService,
          logger: logger.child({ module: 'solana-listener', network: networkKey })
        })
      );
    }
  }

  return listeners;
};

const bootstrapDefaultGroups = (tokenModel) => {
  const envGroupIds = parseGroupIds(process.env.GROUP_ID);
  if (!envGroupIds.length) {
    return;
  }

  if (tokenModel.countGroups() > 0) {
    return;
  }

  envGroupIds.forEach((chatId, index) => {
    tokenModel.upsertGroup({
      chat_id: chatId,
      label: `Legacy Group ${index + 1}`,
      enabled: 1
    });
  });

  logger.info({ count: envGroupIds.length }, 'default telegram groups imported from env');
};

const resolveInitialMinUsd = (tokenModel) => {
  const persisted = tokenModel.getSetting('min_usd_alert');
  const persistedNumber = Number(persisted);
  if (Number.isFinite(persistedNumber) && persistedNumber >= 0) {
    return persistedNumber;
  }

  const envValue = Number(process.env.MIN_USD_ALERT || 0);
  const fallback = Number.isFinite(envValue) && envValue >= 0 ? envValue : 0;

  tokenModel.setSetting('min_usd_alert', String(fallback));
  return fallback;
};

const main = async () => {
  const dbPath = process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'data', 'bot.db');

  const tokenModel = new TokenModel({
    dbPath,
    logger: logger.child({ module: 'database' })
  });
  tokenModel.init();

  bootstrapDefaultGroups(tokenModel);

  const groupAutoDisableFailures = Math.max(1, toSafeInt(process.env.GROUP_AUTO_DISABLE_FAILURES, 3));
  const onTelegramDeliveryResult = (payload) => {
    try {
      const results = Array.isArray(payload?.summary?.results) ? payload.summary.results : [];
      if (!results.length) {
        return;
      }

      for (const item of results) {
        const chatId = String(item?.groupId || '').trim();
        if (!chatId) {
          continue;
        }

        if (item?.sent) {
          tokenModel.registerGroupDeliverySuccess(chatId);
          continue;
        }

        const failure = tokenModel.registerGroupDeliveryFailure(chatId, {
          error: String(item?.error || ''),
          errorCode: String(item?.errorCode || '')
        });

        const isPermanent = Boolean(item?.permanentFailure);
        if (!isPermanent || !failure || failure.consecutive_failures < groupAutoDisableFailures) {
          continue;
        }

        const group = tokenModel.getGroupByChatId(chatId);
        if (!group || group.enabled !== 1) {
          continue;
        }

        tokenModel.setGroupEnabled(group.id, false);
        tokenModel.markGroupDeliveryAutoDisabled(chatId);

        tokenModel.createIncidentIfNotOpen({
          unique_key: `group-delivery-disabled:${chatId}`,
          incident_type: 'group_delivery_disabled',
          severity: 'high',
          title: `Grupo desativado automaticamente (${group.label})`,
          message: `Falhas permanentes consecutivas no Telegram: ${failure.consecutive_failures}. Erro: ${failure.last_error}`,
          chat_id: chatId,
          context: {
            groupId: group.id,
            label: group.label,
            consecutiveFailures: failure.consecutive_failures,
            error: failure.last_error,
            code: failure.last_error_code
          }
        });

        logger.warn(
          {
            chatId,
            label: group.label,
            consecutiveFailures: failure.consecutive_failures,
            error: failure.last_error
          },
          'group auto-disabled after permanent telegram delivery failures'
        );
      }
    } catch (error) {
      logger.error({ err: error.message }, 'failed to process telegram delivery health update');
    }
  };

  const telegramClient = new TelegramClient({
    token: process.env.TELEGRAM_TOKEN,
    groupIds: process.env.GROUP_ID,
    groupResolver: () => tokenModel.getActiveGroupChatIds('buy_alerts'),
    polling: toBoolean(process.env.ENABLE_TELEGRAM_POLLING, true),
    logger: logger.child({ module: 'telegram' }),
    onDeliveryResult: onTelegramDeliveryResult
  });

  const dexService = new DexService({
    logger: logger.child({ module: 'dex-service' })
  });

  const priceService = new PriceService({
    dexService,
    logger: logger.child({ module: 'price-service' })
  });

  const formatService = new FormatService();

  const queueService = new QueueService({
    telegramClient,
    tokenModel,
    priceService,
    formatService,
    logger: logger.child({ module: 'queue-service' }),
    minUsdAlert: resolveInitialMinUsd(tokenModel)
  });
  await queueService.start();

  const schedulerService = new SchedulerService({
    tokenModel,
    telegramClient,
    logger: logger.child({ module: 'scheduler-service' }),
    intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS || 15000)
  });

  const enabledNetworks = resolveEnabledNetworks(process.env.ENABLED_NETWORKS);

  const commandRouter = new CommandRouter({
    telegramClient,
    tokenModel,
    queueService,
    enabledNetworks,
    logger: logger.child({ module: 'command-router' })
  });

  const listeners = createListeners({ enabledNetworks, tokenModel, queueService });
  const runtimeStateProvider = () => ({
    uptimeSec: Math.floor(process.uptime()),
    db: {
      ok: tokenModel.ping(),
      transactions: tokenModel.countTransactions()
    },
    incidents: {
      open: tokenModel.countOpenIncidents()
    },
    queue: queueService.getStatus(),
    scheduler: schedulerService.getStatus(),
    telegram: telegramClient.getStatus(),
    listeners: listeners.map((listener) =>
      typeof listener.getStatus === 'function'
        ? listener.getStatus()
        : {
            network: listener?.network?.key || 'unknown',
            running: Boolean(listener?.running)
          }
    )
  });

  await schedulerService.start();
  let adminServer = null;
  const dashboardEnabled = toBoolean(process.env.ENABLE_DASHBOARD, true);

  if (dashboardEnabled) {
    try {
      adminServer = await startAdminServer({
        tokenModel,
        queueService,
        telegramClient,
        schedulerService,
        logger: logger.child({ module: 'admin-server' }),
        enabledNetworks,
        runtimeStateProvider
      });
    } catch (error) {
      logger.error({ err: error.message }, 'admin dashboard failed to start');
    }
  }

  try {
    await telegramClient.start();
  } catch (error) {
    logger.error({ err: error.message }, 'telegram startup failed');
  }

  try {
    await commandRouter.start();
  } catch (error) {
    logger.error({ err: error.message }, 'command router startup failed');
  }

  if (!listeners.length) {
    logger.warn({ enabledNetworks }, 'no listeners enabled; process will stay idle');
  } else {
    logger.info({ enabledNetworks, listeners: listeners.length }, 'starting listeners');
    for (const listener of listeners) {
      await listener.start();
    }
  }

  let shuttingDown = false;
  const shutdown = async (signal, exitCode = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.warn({ signal }, 'shutdown started');

    for (const listener of listeners) {
      try {
        await listener.stop();
      } catch (error) {
        logger.error({ err: error.message }, 'listener stop failed');
      }
    }

    if (adminServer) {
      try {
        await adminServer.close();
      } catch (error) {
        logger.error({ err: error.message }, 'admin server close failed');
      }
    }

    try {
      await schedulerService.stop();
    } catch (error) {
      logger.error({ err: error.message }, 'scheduler shutdown failed');
    }

    try {
      commandRouter.stop();
    } catch (error) {
      logger.error({ err: error.message }, 'command router shutdown failed');
    }

    try {
      await queueService.shutdown();
    } catch (error) {
      logger.error({ err: error.message }, 'queue shutdown failed');
    }

    try {
      await telegramClient.close();
    } catch (error) {
      logger.error({ err: error.message }, 'telegram close failed');
    }

    tokenModel.close();

    logger.info('shutdown complete');
    process.exit(exitCode);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error.message }, 'uncaught exception');
    shutdown('uncaughtException', 1).catch(() => {
      process.exit(1);
    });
  });
};

main().catch((error) => {
  logger.fatal({ err: error.message }, 'application boot failed');
  process.exit(1);
});
