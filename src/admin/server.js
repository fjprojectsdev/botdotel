const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { NETWORKS } = require('../config/networks');

const asBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const asSafeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric;
};

const toEnabledFlag = (value, fallback = true) => (asBoolean(value, fallback) ? 1 : 0);

const parsePositiveInt = (raw, fallback, max) => {
  const parsed = Number.parseInt(String(raw || ''), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const normalizeTokenAddress = (network, address) => {
  const raw = String(address || '').trim();
  if (!raw) {
    return raw;
  }
  return network === 'solana' ? raw : raw.toLowerCase();
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

const normalizeMediaUrl = (value, fieldName = 'media url') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  let parsed = null;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    throw new Error(`invalid ${fieldName}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed.toString();
};

const sanitizeUploadName = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return normalized || 'image';
};

const parseImageDataUrl = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error('invalid image payload');
  }

  const mimeType = String(match[1] || '').toLowerCase();
  const base64Payload = String(match[2] || '').replace(/\s+/g, '');
  const data = Buffer.from(base64Payload, 'base64');
  if (!data.length) {
    throw new Error('empty image payload');
  }

  return { mimeType, data };
};

const extensionByMimeType = (mimeType) => {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return map[String(mimeType || '').toLowerCase()] || '';
};

const resolvePublicBaseUrl = (req) => {
  const rawForwardedProto = req.headers['x-forwarded-proto'];
  const rawForwardedHost = req.headers['x-forwarded-host'];
  const proto = String(
    (Array.isArray(rawForwardedProto) ? rawForwardedProto[0] : rawForwardedProto) || req.protocol || 'http'
  )
    .split(',')[0]
    .trim();
  const host = String((Array.isArray(rawForwardedHost) ? rawForwardedHost[0] : rawForwardedHost) || req.get('host') || '')
    .split(',')[0]
    .trim();

  if (!host) {
    return '';
  }

  return `${proto}://${host}`;
};

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const parseCorsOrigins = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => normalizeOrigin(item))
        .filter(Boolean)
    )
  );
};

const DEFAULT_GROUP_PERMISSIONS = [
  'buy_alerts',
  'core_commands',
  'moderation',
  'security',
  'welcome',
  'fun',
  'economy',
  'advanced'
];
const GROUP_LOCK_KEYS = ['antispam', 'antilink', 'antiflood', 'captcha', 'antiraid'];
const ADMIN_ROLE_ORDER = ['viewer', 'editor', 'admin', 'owner'];
const ALLOWED_ADMIN_ROLE = new Set(ADMIN_ROLE_ORDER);

const normalizeGroupPermissions = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [...DEFAULT_GROUP_PERMISSIONS];
    }

    if (trimmed.startsWith('[')) {
      try {
        return normalizeGroupPermissions(JSON.parse(trimmed));
      } catch (_error) {
        return normalizeGroupPermissions(trimmed.split(','));
      }
    }

    return normalizeGroupPermissions(trimmed.split(','));
  }

  return [...DEFAULT_GROUP_PERMISSIONS];
};

const parseTelegramGroupReference = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { kind: 'empty', raw };
  }

  if (/^-?\d+$/.test(raw)) {
    return { kind: 'chat_id', chatId: raw, raw };
  }

  const parseUsername = (source) => {
    const username = String(source || '').replace(/^@/, '').trim();
    if (!/^[A-Za-z0-9_]{5,}$/.test(username)) {
      return null;
    }
    return `@${username}`;
  };

  if (raw.startsWith('@')) {
    const username = parseUsername(raw);
    return username ? { kind: 'username', username, raw } : { kind: 'invalid', raw };
  }

  if (/^[A-Za-z0-9_]{5,}$/.test(raw)) {
    return { kind: 'username', username: `@${raw}`, raw };
  }

  if (raw.includes('t.me/') || raw.includes('telegram.me/')) {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    } catch (_error) {
      return { kind: 'invalid', raw };
    }

    const host = String(parsedUrl.hostname || '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
    if (host !== 't.me' && host !== 'telegram.me') {
      return { kind: 'invalid', raw };
    }

    const segments = parsedUrl.pathname
      .split('/')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!segments.length) {
      return { kind: 'invalid', raw };
    }

    const [first, second] = segments;
    if (first === 'joinchat' || first.startsWith('+')) {
      return { kind: 'private_invite', raw };
    }

    if (first === 'c' && /^\d+$/.test(second || '')) {
      const normalized = String(second).startsWith('100') ? `-${second}` : `-100${second}`;
      return { kind: 'chat_id', chatId: normalized, raw };
    }

    const username = parseUsername(first);
    return username ? { kind: 'username', username, raw } : { kind: 'invalid', raw };
  }

  return { kind: 'invalid', raw };
};

const resolveGroupChatId = async (identifier, telegramClient) => {
  const parsed = parseTelegramGroupReference(identifier);

  if (parsed.kind === 'empty') {
    throw new Error('group reference is required');
  }

  if (parsed.kind === 'chat_id') {
    return parsed.chatId;
  }

  if (parsed.kind === 'private_invite') {
    throw new Error('invalid private invite link; use @username, t.me/c/... or numeric chat id');
  }

  if (parsed.kind === 'username') {
    if (!telegramClient || typeof telegramClient.getChat !== 'function') {
      throw new Error('invalid group reference; telegram resolver unavailable');
    }

    try {
      const chat = await telegramClient.getChat(parsed.username);
      const chatId = String(chat?.id || '').trim();
      if (!chatId) {
        throw new Error('invalid group reference; could not resolve chat id');
      }
      return chatId;
    } catch (_error) {
      throw new Error('invalid group reference; check username/link and bot access');
    }
  }

  throw new Error('invalid group reference; use @username, t.me link or numeric id');
};

const shortWallet = (value) => {
  const raw = String(value || '');
  if (raw.length <= 12) {
    return raw;
  }

  if (raw.startsWith('0x')) {
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  }

  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
};

const createAuthMiddleware = ({ username, password, tokenModel, logger }) => {
  const envAuthEnabled = Boolean(username && password);
  const maxAttempts = Math.max(3, Number(process.env.ADMIN_MAX_ATTEMPTS || 5) || 5);
  const lockMinutes = Math.max(1, Number(process.env.ADMIN_LOCK_MINUTES || 15) || 15);

  if (!envAuthEnabled && !tokenModel.hasAdminUsers()) {
    logger.warn('ADMIN_USER/ADMIN_PASSWORD not set and no admin users in DB; dashboard auth disabled');
    return (req, _res, next) => {
      req.admin = {
        id: 0,
        username: 'local',
        role: 'owner',
        authSource: 'disabled'
      };
      next();
    };
  }

  const safeEquals = (left, right) => {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(a, b);
  };

  const parseBasicAuth = (authHeader) => {
    if (!String(authHeader || '').startsWith('Basic ')) {
      return null;
    }

    let decoded = '';
    try {
      decoded = Buffer.from(String(authHeader).slice(6), 'base64').toString('utf8');
    } catch (_error) {
      return null;
    }

    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  };

  return (req, res, next) => {
    const parsed = parseBasicAuth(req.headers.authorization || '');
    if (!parsed) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Buy Alerts Admin"');
      return res.status(401).json({ error: 'authentication required' });
    }

    const incomingUser = String(parsed.username || '').trim().toLowerCase();
    const incomingPass = String(parsed.password || '');
    if (!incomingUser || !incomingPass) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    if (tokenModel.hasAdminUsers()) {
      const dbUser = tokenModel.getAdminUserByUsername(incomingUser);
      if (!dbUser || dbUser.enabled !== 1) {
        return res.status(401).json({ error: 'invalid credentials' });
      }

      const lockedUntilMs = dbUser.locked_until ? new Date(dbUser.locked_until).getTime() : 0;
      if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
        return res.status(423).json({ error: 'admin account temporarily locked' });
      }

      const validPassword = tokenModel.verifyAdminPassword(incomingPass, dbUser.password_hash);
      if (!validPassword) {
        const failedAttempts = Math.max(0, Number(dbUser.failed_attempts) || 0) + 1;
        const shouldLock = failedAttempts >= maxAttempts;
        const lockedUntil = shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000).toISOString() : null;
        tokenModel.setAdminUserSecurity(dbUser.id, {
          failed_attempts: failedAttempts,
          locked_until: lockedUntil,
          last_login_at: dbUser.last_login_at || null
        });

        if (shouldLock) {
          tokenModel.createIncidentIfNotOpen({
            unique_key: `admin-lock:${incomingUser}`,
            incident_type: 'admin_lockout',
            severity: 'high',
            title: `Conta admin bloqueada: ${incomingUser}`,
            message: `Excesso de tentativas falhas de login (${failedAttempts}).`,
            context: {
              username: incomingUser,
              failedAttempts,
              lockMinutes
            }
          });
        }

        return res.status(401).json({ error: 'invalid credentials' });
      }

      tokenModel.setAdminUserSecurity(dbUser.id, {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString()
      });

      req.admin = {
        id: dbUser.id,
        username: dbUser.username,
        role: String(dbUser.role || 'viewer').toLowerCase(),
        authSource: 'database'
      };
      return next();
    }

    if (!envAuthEnabled) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    if (!safeEquals(incomingUser, String(username).toLowerCase()) || !safeEquals(incomingPass, password)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    req.admin = {
      id: 0,
      username: incomingUser,
      role: 'owner',
      authSource: 'env'
    };

    return next();
  };
};

const hasRole = (role, minimumRole) => {
  const currentIndex = ADMIN_ROLE_ORDER.indexOf(String(role || '').toLowerCase());
  const requiredIndex = ADMIN_ROLE_ORDER.indexOf(String(minimumRole || '').toLowerCase());
  if (currentIndex < 0 || requiredIndex < 0) {
    return false;
  }
  return currentIndex >= requiredIndex;
};

const requireRole = (minimumRole) => (req, res, next) => {
  const role = String(req.admin?.role || '').toLowerCase();
  if (!hasRole(role, minimumRole)) {
    return res.status(403).json({ error: `insufficient role; requires ${minimumRole}` });
  }
  return next();
};

const normalizeAdminRole = (value, fallback = 'viewer') => {
  const role = String(value || '')
    .trim()
    .toLowerCase();
  if (ALLOWED_ADMIN_ROLE.has(role)) {
    return role;
  }
  return fallback;
};

const sanitizeAdminUserForResponse = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    username: String(row.username || ''),
    role: normalizeAdminRole(row.role, 'viewer'),
    enabled: Number(row.enabled) === 1,
    failed_attempts: Math.max(0, Number(row.failed_attempts) || 0),
    locked_until: row.locked_until || null,
    last_login_at: row.last_login_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
};

const buildRuntimeState = ({
  runtimeStateProvider,
  tokenModel,
  queueService,
  schedulerService,
  telegramClient,
  enabledNetworks
}) => {
  let provided = {};
  if (typeof runtimeStateProvider === 'function') {
    try {
      provided = runtimeStateProvider() || {};
    } catch (_error) {
      provided = {};
    }
  }

  const listeners = Array.isArray(provided.listeners) ? provided.listeners : [];
  return {
    uptimeSec: Math.max(0, Number(provided.uptimeSec || Math.floor(process.uptime())) || 0),
    db: {
      ok: provided.db?.ok === undefined ? tokenModel.ping() : Boolean(provided.db.ok),
      transactions: Math.max(
        0,
        Number(
          provided.db?.transactions === undefined ? tokenModel.countTransactions() : Number(provided.db.transactions)
        ) || 0
      )
    },
    incidents: {
      open: Math.max(
        0,
        Number(provided.incidents?.open === undefined ? tokenModel.countOpenIncidents() : provided.incidents.open) || 0
      )
    },
    queue:
      provided.queue && typeof provided.queue === 'object'
        ? provided.queue
        : typeof queueService.getStatus === 'function'
          ? queueService.getStatus()
          : {},
    scheduler:
      provided.scheduler && typeof provided.scheduler === 'object'
        ? provided.scheduler
        : typeof schedulerService.getStatus === 'function'
          ? schedulerService.getStatus()
          : { running: Boolean(schedulerService?.running) },
    telegram:
      provided.telegram && typeof provided.telegram === 'object'
        ? provided.telegram
        : typeof telegramClient.getStatus === 'function'
          ? telegramClient.getStatus()
          : { botAvailable: Boolean(telegramClient?.bot), ready: false },
    listeners,
    enabledNetworks: Array.isArray(enabledNetworks) ? [...enabledNetworks] : []
  };
};

const buildReadinessReport = (runtimeState) => {
  const checks = [];
  const addCheck = (name, pass, details = {}) => {
    checks.push({
      name,
      pass: Boolean(pass),
      details
    });
  };

  addCheck('db', runtimeState.db?.ok === true, { transactions: runtimeState.db?.transactions || 0 });

  if (runtimeState.telegram?.botAvailable) {
    addCheck('telegram', runtimeState.telegram?.ready === true, {
      pollingEnabled: Boolean(runtimeState.telegram?.pollingEnabled),
      pollingStarted: Boolean(runtimeState.telegram?.pollingStarted),
      lastError: String(runtimeState.telegram?.lastPollingError || '')
    });
  } else {
    addCheck('telegram', false, { reason: 'bot token missing' });
  }

  const listenersByNetwork = new Map();
  for (const item of runtimeState.listeners || []) {
    const key = String(item?.network || '').toLowerCase();
    if (key) {
      listenersByNetwork.set(key, item);
    }
  }

  for (const networkKey of runtimeState.enabledNetworks || []) {
    const listener = listenersByNetwork.get(String(networkKey || '').toLowerCase());
    const running = Boolean(listener?.running);
    addCheck(`listener_${networkKey}`, running, {
      found: Boolean(listener),
      type: listener?.type || '',
      lastError: String(listener?.lastError || '')
    });
  }

  const queuePendingFailed = Math.max(0, Number(runtimeState.queue?.pendingJobs?.failed || 0) || 0);
  addCheck('queue_failed_jobs', queuePendingFailed === 0, {
    failed: queuePendingFailed
  });

  const ready = checks.every((item) => item.pass);
  return {
    ready,
    checks
  };
};

const toPrometheusValue = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const renderMetrics = (runtimeState, readiness) => {
  const queue = runtimeState.queue || {};
  const pendingJobs = queue.pendingJobs || {};
  const metrics = queue.metrics || {};
  const scheduler = runtimeState.scheduler || {};
  const telegram = runtimeState.telegram || {};
  const listeners = Array.isArray(runtimeState.listeners) ? runtimeState.listeners : [];

  const lines = [
    '# HELP buy_alert_ready Application readiness state (1 ready, 0 not ready).',
    '# TYPE buy_alert_ready gauge',
    `buy_alert_ready ${readiness.ready ? 1 : 0}`,
    '# HELP buy_alert_uptime_seconds Process uptime in seconds.',
    '# TYPE buy_alert_uptime_seconds gauge',
    `buy_alert_uptime_seconds ${toPrometheusValue(runtimeState.uptimeSec)}`,
    '# HELP buy_alert_db_ok Database health check (1 ok, 0 fail).',
    '# TYPE buy_alert_db_ok gauge',
    `buy_alert_db_ok ${runtimeState.db?.ok ? 1 : 0}`,
    '# HELP buy_alert_transactions_total Total transactions persisted.',
    '# TYPE buy_alert_transactions_total gauge',
    `buy_alert_transactions_total ${toPrometheusValue(runtimeState.db?.transactions)}`,
    '# HELP buy_alert_incidents_open Open incidents count.',
    '# TYPE buy_alert_incidents_open gauge',
    `buy_alert_incidents_open ${toPrometheusValue(runtimeState.incidents?.open)}`,
    '# HELP buy_alert_queue_processing_pending Queue processing workers currently running.',
    '# TYPE buy_alert_queue_processing_pending gauge',
    `buy_alert_queue_processing_pending ${toPrometheusValue(queue.processPending)}`,
    '# HELP buy_alert_queue_processing_size Queue processing backlog size.',
    '# TYPE buy_alert_queue_processing_size gauge',
    `buy_alert_queue_processing_size ${toPrometheusValue(queue.processSize)}`,
    '# HELP buy_alert_queue_telegram_pending Telegram queue workers currently running.',
    '# TYPE buy_alert_queue_telegram_pending gauge',
    `buy_alert_queue_telegram_pending ${toPrometheusValue(queue.telegramPending)}`,
    '# HELP buy_alert_queue_telegram_size Telegram queue backlog size.',
    '# TYPE buy_alert_queue_telegram_size gauge',
    `buy_alert_queue_telegram_size ${toPrometheusValue(queue.telegramSize)}`,
    '# HELP buy_alert_pending_jobs_queued Pending jobs queued.',
    '# TYPE buy_alert_pending_jobs_queued gauge',
    `buy_alert_pending_jobs_queued ${toPrometheusValue(pendingJobs.queued)}`,
    '# HELP buy_alert_pending_jobs_processing Pending jobs in processing.',
    '# TYPE buy_alert_pending_jobs_processing gauge',
    `buy_alert_pending_jobs_processing ${toPrometheusValue(pendingJobs.processing)}`,
    '# HELP buy_alert_pending_jobs_failed Pending jobs failed.',
    '# TYPE buy_alert_pending_jobs_failed gauge',
    `buy_alert_pending_jobs_failed ${toPrometheusValue(pendingJobs.failed)}`,
    '# HELP buy_alert_job_metrics_claimed_total Claimed job count.',
    '# TYPE buy_alert_job_metrics_claimed_total counter',
    `buy_alert_job_metrics_claimed_total ${toPrometheusValue(metrics.jobsClaimed)}`,
    '# HELP buy_alert_job_metrics_processed_total Processed job count.',
    '# TYPE buy_alert_job_metrics_processed_total counter',
    `buy_alert_job_metrics_processed_total ${toPrometheusValue(metrics.jobsProcessed)}`,
    '# HELP buy_alert_job_metrics_retried_total Retried job count.',
    '# TYPE buy_alert_job_metrics_retried_total counter',
    `buy_alert_job_metrics_retried_total ${toPrometheusValue(metrics.jobsRetried)}`,
    '# HELP buy_alert_job_metrics_discarded_total Discarded job count.',
    '# TYPE buy_alert_job_metrics_discarded_total counter',
    `buy_alert_job_metrics_discarded_total ${toPrometheusValue(metrics.jobsDiscarded)}`,
    '# HELP buy_alert_alerts_delivered_total Delivered alerts.',
    '# TYPE buy_alert_alerts_delivered_total counter',
    `buy_alert_alerts_delivered_total ${toPrometheusValue(metrics.alertsDelivered)}`,
    '# HELP buy_alert_alerts_failed_total Failed alerts.',
    '# TYPE buy_alert_alerts_failed_total counter',
    `buy_alert_alerts_failed_total ${toPrometheusValue(metrics.alertsFailed)}`,
    '# HELP buy_alert_scheduler_running Scheduler running status.',
    '# TYPE buy_alert_scheduler_running gauge',
    `buy_alert_scheduler_running ${scheduler.running ? 1 : 0}`,
    '# HELP buy_alert_scheduler_processing Current processing schedules.',
    '# TYPE buy_alert_scheduler_processing gauge',
    `buy_alert_scheduler_processing ${toPrometheusValue(scheduler.processing)}`,
    '# HELP buy_alert_telegram_ready Telegram client ready status.',
    '# TYPE buy_alert_telegram_ready gauge',
    `buy_alert_telegram_ready ${telegram.ready ? 1 : 0}`,
    '# HELP buy_alert_telegram_polling_started Telegram polling running status.',
    '# TYPE buy_alert_telegram_polling_started gauge',
    `buy_alert_telegram_polling_started ${telegram.pollingStarted ? 1 : 0}`
  ];

  lines.push('# HELP buy_alert_listener_running Listener running state by network.');
  lines.push('# TYPE buy_alert_listener_running gauge');
  for (const listener of listeners) {
    const network = String(listener?.network || 'unknown').replace(/"/g, '\\"');
    const type = String(listener?.type || 'unknown').replace(/"/g, '\\"');
    const running = listener?.running ? 1 : 0;
    lines.push(`buy_alert_listener_running{network="${network}",type="${type}"} ${running}`);
  }

  return `${lines.join('\n')}\n`;
};

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const buildTokenPayload = (body) => {
  const network = String(body.network || '').trim().toLowerCase();

  return {
    name: String(body.name || '').trim(),
    symbol: String(body.symbol || '').trim().toUpperCase(),
    address: normalizeTokenAddress(network, body.address),
    network,
    pair_address: normalizeTokenAddress(network, body.pair_address || body.pairAddress || body.pair),
    buy_media_url: normalizeMediaUrl(body.buy_media_url || body.buyMediaUrl || '', 'token buy image url'),
    decimals: Number(body.decimals),
    enabled: toEnabledFlag(body.enabled, true)
  };
};

const buildGroupPayload = (body) => {
  return {
    chat_id: String(body.chat_id || body.chatId || body.group_ref || body.groupRef || '').trim(),
    label: String(body.label || '').trim() || 'Telegram Group',
    permissions: normalizeGroupPermissions(body.permissions || body.permission || body.permissionsCsv),
    enabled: toEnabledFlag(body.enabled, true)
  };
};

const buildSchedulePayload = (body) => {
  return {
    kind: String(body.kind || 'message').trim().toLowerCase(),
    content: String(body.content || '').trim(),
    media_url: normalizeMediaUrl(body.media_url || body.mediaUrl || '', 'schedule media url'),
    group_ids: normalizeList(body.group_ids || body.groupIds || []),
    send_at: body.send_at || body.sendAt,
    recurrence: String(body.recurrence || 'none').trim().toLowerCase(),
    status: body.status ? String(body.status).trim().toLowerCase() : undefined
  };
};

const buildAutomationModulePayload = (body = {}) => {
  const hasKey = body.key !== undefined;
  if (hasKey) {
    return {
      key: String(body.key || '').trim().toLowerCase(),
      enabled: body.enabled === undefined ? undefined : asBoolean(body.enabled, false),
      config:
        body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? body.config
          : undefined
    };
  }

  const modules = Array.isArray(body.modules) ? body.modules : [];
  return modules.map((item) => ({
    key: String(item?.key || '').trim().toLowerCase(),
    enabled: item?.enabled === undefined ? undefined : asBoolean(item.enabled, false),
    config:
      item?.config && typeof item.config === 'object' && !Array.isArray(item.config)
        ? item.config
        : undefined
  }));
};

const buildStrikeTriggerPayload = (body = {}) => {
  const hasKey = body.key !== undefined;
  if (hasKey) {
    return {
      key: String(body.key || '').trim().toLowerCase(),
      enabled: body.enabled === undefined ? undefined : asBoolean(body.enabled, false),
      strike_points: Math.max(1, Number(body.strike_points || body.strikePoints || 1) || 1),
      config:
        body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? body.config
          : undefined
    };
  }

  const triggers = Array.isArray(body.triggers) ? body.triggers : [];
  return triggers.map((item) => ({
    key: String(item?.key || '').trim().toLowerCase(),
    enabled: item?.enabled === undefined ? undefined : asBoolean(item.enabled, false),
    strike_points: Math.max(1, Number(item?.strike_points || item?.strikePoints || 1) || 1),
    config:
      item?.config && typeof item.config === 'object' && !Array.isArray(item.config)
        ? item.config
        : undefined
  }));
};

const buildStrikeLadderPayload = (body = {}) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length && body.step !== undefined) {
    return [
      {
        step: Math.max(1, Number(body.step) || 1),
        action: String(body.action || '').trim().toLowerCase(),
        duration_minutes: Math.max(0, Number(body.duration_minutes || body.durationMinutes || 0) || 0),
        message_template: body.message_template === undefined ? undefined : String(body.message_template || ''),
        enabled: body.enabled === undefined ? undefined : asBoolean(body.enabled, true)
      }
    ];
  }

  return items.map((item) => ({
    step: Math.max(1, Number(item?.step) || 1),
    action: String(item?.action || '').trim().toLowerCase(),
    duration_minutes: Math.max(0, Number(item?.duration_minutes || item?.durationMinutes || 0) || 0),
    message_template: item?.message_template === undefined ? undefined : String(item.message_template || ''),
    enabled: item?.enabled === undefined ? undefined : asBoolean(item.enabled, true)
  }));
};

const buildWhitelistPayload = (body = {}) => ({
  target_type: String(body.target_type || body.targetType || '').trim().toLowerCase(),
  target_value: String(body.target_value || body.targetValue || '').trim(),
  note: String(body.note || '').trim()
});

const buildBroadcastPayload = (body = {}) => ({
  title: String(body.title || '').trim(),
  content: String(body.content || body.message || '').trim(),
  media_url: normalizeMediaUrl(body.media_url || body.mediaUrl || '', 'broadcast media url'),
  group_ids: normalizeList(body.group_ids || body.groupIds || body.groups || []),
  created_by: String(body.created_by || body.createdBy || '').trim()
});

const normalizeLocksPatch = (body = {}) => {
  const patch = {};

  if (body.lockKey) {
    const key = String(body.lockKey || '').trim().toLowerCase();
    if (!GROUP_LOCK_KEYS.includes(key)) {
      throw new Error('invalid lockKey');
    }
    patch[key] = asBoolean(body.enabled, true);
    return patch;
  }

  const source =
    body.locks && typeof body.locks === 'object' && !Array.isArray(body.locks)
      ? body.locks
      : body;

  for (const key of GROUP_LOCK_KEYS) {
    if (source[key] !== undefined) {
      patch[key] = asBoolean(source[key], false);
    }
  }

  if (!Object.keys(patch).length) {
    throw new Error('no lock values provided');
  }

  return patch;
};

const groupCommandsForUi = (items) => {
  const grouped = new Map();

  for (const item of items) {
    const category = item.category;
    if (!grouped.has(category)) {
      grouped.set(category, {
        category,
        total: 0,
        active: 0,
        items: []
      });
    }

    const bucket = grouped.get(category);
    bucket.total += 1;
    bucket.active += item.enabled === 1 ? 1 : 0;

    bucket.items.push({
      id: item.id,
      name: item.name,
      key: item.command_key,
      description: item.description,
      aliases: item.aliases,
      enabled: item.enabled === 1
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.category.localeCompare(b.category))
    .map((entry) => ({
      ...entry,
      percent: entry.total ? Math.round((entry.active / entry.total) * 100) : 0
    }));
};

const normalizeMemberDisplayName = (row) => {
  const username = String(row.username || '').trim();
  if (username) {
    return `@${username}`;
  }

  const first = String(row.first_name || '').trim();
  const last = String(row.last_name || '').trim();
  const fullName = `${first} ${last}`.trim();
  if (fullName) {
    return fullName;
  }

  return shortWallet(row.user_id || row.member_id || row.wallet || row.buyer || '');
};

const normalizeMemberRows = (rows) => {
  return rows.map((row) => {
    const lastSeen = row.last_seen || row.lastSeen || null;
    const lastSeenMs = new Date(lastSeen).getTime();
    const active = Number.isFinite(lastSeenMs) ? Date.now() - lastSeenMs < 3 * 24 * 60 * 60 * 1000 : false;
    const memberId = String(row.user_id || row.member_id || row.wallet || row.buyer || '').trim();

    return {
      member_id: memberId,
      name: normalizeMemberDisplayName(row),
      wallet: memberId,
      group: String(row.group_label || row.group || 'Global'),
      messages: Number(row.message_count || row.messages || 0),
      reactions: Number(row.reactions_count || row.reactions || 0),
      volume_usd: Number(row.volume_usd || 0),
      status: active ? 'Ativo' : 'Inativo',
      last_seen: lastSeen
    };
  });
};

const loadMembersFromGroupAdmins = async ({ groups, telegramClient, limit, logger }) => {
  if (!telegramClient || typeof telegramClient.getChatAdministrators !== 'function') {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const rows = [];
  const seen = new Set();

  for (const group of groups) {
    if (rows.length >= safeLimit) {
      break;
    }

    const chatId = String(group.chat_id || '').trim();
    if (!chatId) {
      continue;
    }

    try {
      const admins = await telegramClient.getChatAdministrators(chatId);
      for (const item of admins || []) {
        const user = item?.user;
        if (!user?.id) {
          continue;
        }

        const memberId = String(user.id);
        const key = `${chatId}:${memberId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        rows.push({
          user_id: memberId,
          username: String(user.username || '').trim(),
          first_name: String(user.first_name || '').trim(),
          last_name: String(user.last_name || '').trim(),
          message_count: 0,
          reactions_count: 0,
          volume_usd: 0,
          last_seen: new Date().toISOString(),
          group_label: String(group.label || chatId)
        });

        if (rows.length >= safeLimit) {
          break;
        }
      }
    } catch (error) {
      logger.warn({ chatId, err: error.message }, 'failed to fetch group administrators for members list');
    }
  }

  return rows;
};

const scheduleMessageText = (schedule) => {
  const prefix = schedule.kind === 'poll' ? '📊 AGENDAMENTO (Enquete)' : '📅 AGENDAMENTO';
  return `${prefix}\n\n${schedule.content}`;
};

const computeNextDailyIso = (sendAtIso) => {
  const base = new Date(sendAtIso);
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const dayMs = 24 * 60 * 60 * 1000;
  let nextMs = base.getTime();
  const nowMs = Date.now();

  if (nextMs <= nowMs) {
    const jumps = Math.floor((nowMs - nextMs) / dayMs) + 1;
    nextMs += jumps * dayMs;
  }

  return new Date(nextMs).toISOString();
};

const startAdminServer = async ({
  tokenModel,
  queueService,
  telegramClient,
  schedulerService,
  logger,
  enabledNetworks,
  runtimeStateProvider = null,
  host = process.env.ADMIN_HOST || '0.0.0.0',
  port = Number(process.env.ADMIN_PORT || 8787)
}) => {
  const app = express();
  const authMiddleware = createAuthMiddleware({
    username: process.env.ADMIN_USER || '',
    password: process.env.ADMIN_PASSWORD || '',
    tokenModel,
    logger
  });
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS || '');
  const corsAllowAll = corsOrigins.includes('*');
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  const maxUploadBytes = Math.max(128 * 1024, Number(process.env.ADMIN_UPLOAD_MAX_BYTES || 6 * 1024 * 1024) || 0);
  fs.mkdirSync(uploadsDir, { recursive: true });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));
  app.use((req, res, next) => {
    const requestOrigin = normalizeOrigin(req.headers.origin || '');
    const hasOrigin = Boolean(requestOrigin);

    if (hasOrigin) {
      const allowed = corsAllowAll || corsOrigins.includes(requestOrigin);
      if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', corsAllowAll ? '*' : requestOrigin);
        if (!corsAllowAll) {
          res.setHeader('Vary', 'Origin');
        }
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }

    return next();
  });

  app.get('/healthz', (_req, res) => {
    const runtimeState = buildRuntimeState({
      runtimeStateProvider,
      tokenModel,
      queueService,
      schedulerService,
      telegramClient,
      enabledNetworks
    });
    res.json({
      ok: true,
      service: 'buy-alert-admin',
      uptimeSec: runtimeState.uptimeSec
    });
  });

  app.get('/readyz', (_req, res) => {
    const runtimeState = buildRuntimeState({
      runtimeStateProvider,
      tokenModel,
      queueService,
      schedulerService,
      telegramClient,
      enabledNetworks
    });
    const readiness = buildReadinessReport(runtimeState);

    if (!readiness.ready) {
      return res.status(503).json({
        ok: false,
        ...readiness,
        runtime: runtimeState
      });
    }

    return res.json({
      ok: true,
      ...readiness,
      runtime: runtimeState
    });
  });

  app.get('/metrics', (_req, res) => {
    const runtimeState = buildRuntimeState({
      runtimeStateProvider,
      tokenModel,
      queueService,
      schedulerService,
      telegramClient,
      enabledNetworks
    });
    const readiness = buildReadinessReport(runtimeState);
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(renderMetrics(runtimeState, readiness));
  });

  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', etag: true, index: false }));

  app.use((req, res, next) => {
    if (req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics' || req.path.startsWith('/uploads/')) {
      return next();
    }
    return authMiddleware(req, res, next);
  });

  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    return requireRole('editor')(req, res, next);
  });

  app.use('/api', (req, res, next) => {
    const startedAtMs = Date.now();
    res.on('finish', () => {
      try {
        tokenModel.addAuditLog({
          actor_username: req.admin?.username || '',
          actor_role: req.admin?.role || '',
          method: req.method,
          path: req.originalUrl || req.path || '',
          action: req.method,
          resource: req.path || '',
          status_code: res.statusCode,
          details: {
            latency_ms: Date.now() - startedAtMs
          }
        });
      } catch (error) {
        logger.warn({ err: error.message }, 'failed to write audit log');
      }
    });
    return next();
  });

  app.get(
    '/api/networks',
    asyncRoute(async (_req, res) => {
      const rows = Object.values(NETWORKS).map((network) => ({
        key: network.key,
        label: network.label,
        type: network.type,
        enabled: enabledNetworks.includes(network.key)
      }));

      res.json({ networks: rows });
    })
  );

  app.get(
    '/api/auth/session',
    asyncRoute(async (req, res) => {
      res.json({
        admin: {
          id: Number(req.admin?.id || 0),
          username: String(req.admin?.username || ''),
          role: normalizeAdminRole(req.admin?.role, 'viewer'),
          source: String(req.admin?.authSource || 'unknown')
        }
      });
    })
  );

  app.get(
    '/api/runtime',
    asyncRoute(async (_req, res) => {
      const runtimeState = buildRuntimeState({
        runtimeStateProvider,
        tokenModel,
        queueService,
        schedulerService,
        telegramClient,
        enabledNetworks
      });
      const readiness = buildReadinessReport(runtimeState);
      res.json({
        readiness,
        runtime: runtimeState
      });
    })
  );

  app.get(
    '/api/stats',
    asyncRoute(async (_req, res) => {
      const runtimeState = buildRuntimeState({
        runtimeStateProvider,
        tokenModel,
        queueService,
        schedulerService,
        telegramClient,
        enabledNetworks
      });
      const tokens = tokenModel.listTokens({ includeDisabled: true });
      const groups = tokenModel.listGroups({ includeDisabled: true });
      const recent = tokenModel.getRecentTransactions(40);
      const schedules = tokenModel.listSchedules(200);
      const broadcasts = tokenModel.listBroadcastMessages(200);

      const activeTokens = tokens.filter((item) => item.enabled === 1).length;
      const activeGroups = groups.filter((item) => item.enabled === 1).length;
      const pendingSchedules = schedules.filter((item) => item.status === 'pending').length;
      const sentBroadcasts = broadcasts.filter((item) => String(item.status || '').toLowerCase() === 'sent').length;

      res.json({
        uptimeSec: runtimeState.uptimeSec,
        minUsdAlert: queueService.getMinUsdAlert(),
        queues: runtimeState.queue,
        tokens: {
          total: tokens.length,
          active: activeTokens
        },
        groups: {
          total: groups.length,
          active: activeGroups
        },
        schedules: {
          total: schedules.length,
          pending: pendingSchedules
        },
        broadcasts: {
          total: broadcasts.length,
          sent: sentBroadcasts
        },
        recentAlerts: recent.length,
        schedulerRunning: Boolean(runtimeState.scheduler?.running),
        incidentsOpen: runtimeState.incidents?.open || 0,
        telegramReady: Boolean(runtimeState.telegram?.ready)
      });
    })
  );

  app.get(
    '/api/tokens',
    asyncRoute(async (req, res) => {
      const includeDisabled = asBoolean(req.query.includeDisabled, true);
      const network = req.query.network ? String(req.query.network).toLowerCase() : undefined;
      const tokens = tokenModel.listTokens({ includeDisabled, network });
      res.json({ tokens });
    })
  );

  app.post(
    '/api/uploads/image',
    asyncRoute(async (req, res) => {
      const scope = sanitizeUploadName(req.body?.scope || 'general');
      const inputName = sanitizeUploadName(req.body?.fileName || req.body?.filename || 'image');
      const { mimeType, data } = parseImageDataUrl(req.body?.dataUrl || req.body?.data_url || '');
      const extension = extensionByMimeType(mimeType);
      if (!extension) {
        return res.status(400).json({ error: 'unsupported image type' });
      }

      if (data.length > maxUploadBytes) {
        return res.status(413).json({ error: `image too large (max ${maxUploadBytes} bytes)` });
      }

      const fileName = `${scope}-${inputName}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      const fullPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(fullPath, data);

      const relativePath = `/uploads/${encodeURIComponent(fileName)}`;
      const baseUrl = resolvePublicBaseUrl(req);
      const url = baseUrl ? `${baseUrl}${relativePath}` : relativePath;

      return res.status(201).json({
        file: {
          url,
          path: relativePath,
          mimeType,
          size: data.length
        }
      });
    })
  );

  app.post(
    '/api/tokens',
    asyncRoute(async (req, res) => {
      const payload = buildTokenPayload(req.body || {});

      if (!NETWORKS[payload.network]) {
        return res.status(400).json({ error: 'invalid network' });
      }

      tokenModel.upsertToken(payload);

      const current = tokenModel
        .listTokens({ includeDisabled: true, network: payload.network })
        .find((item) => item.address === payload.address);

      return res.status(201).json({ token: current || payload });
    })
  );

  app.put(
    '/api/tokens/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getTokenById(id);
      if (!existing) {
        return res.status(404).json({ error: 'token not found' });
      }

      const body = req.body || {};
      const mergedBody = {
        ...existing,
        ...body,
        pair: body.pair || body.pair_address || body.pairAddress || existing.pair_address
      };

      const payload = buildTokenPayload(mergedBody);
      if (!NETWORKS[payload.network]) {
        return res.status(400).json({ error: 'invalid network' });
      }

      tokenModel.updateTokenById(id, payload);
      return res.json({ token: tokenModel.getTokenById(id) });
    })
  );

  app.patch(
    '/api/tokens/:id/enabled',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getTokenById(id);
      if (!existing) {
        return res.status(404).json({ error: 'token not found' });
      }

      const enabled = req.body?.enabled === undefined ? existing.enabled !== 1 : asBoolean(req.body.enabled, true);
      tokenModel.setTokenEnabled(id, enabled);

      return res.json({ token: tokenModel.getTokenById(id) });
    })
  );

  app.delete(
    '/api/tokens/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const deleted = tokenModel.deleteTokenById(id);
      if (!deleted) {
        return res.status(404).json({ error: 'token not found' });
      }
      return res.status(204).send();
    })
  );

  app.get(
    '/api/groups',
    asyncRoute(async (req, res) => {
      const includeDisabled = asBoolean(req.query.includeDisabled, true);
      const groups = tokenModel.listGroups({ includeDisabled });
      const memberCounts = tokenModel.getGroupMemberCounts();
      const deliveryHealthRows = tokenModel.listGroupDeliveryHealth();
      const deliveryByChatId = new Map(
        deliveryHealthRows.map((item) => [String(item.chat_id || '').trim(), item])
      );
      const normalizedGroups = groups.map((group) => ({
        ...group,
        member_count: Math.max(0, Number(memberCounts[String(group.chat_id || '').trim()] || 0)),
        delivery_health:
          deliveryByChatId.get(String(group.chat_id || '').trim()) || tokenModel.getGroupDeliveryHealth(group.chat_id)
      }));
      res.json({ groups: normalizedGroups });
    })
  );

  app.post(
    '/api/groups',
    asyncRoute(async (req, res) => {
      const payload = buildGroupPayload(req.body || {});
      payload.chat_id = await resolveGroupChatId(payload.chat_id, telegramClient);
      tokenModel.upsertGroup(payload);

      const current = tokenModel
        .listGroups({ includeDisabled: true })
        .find((item) => item.chat_id === payload.chat_id);

      return res.status(201).json({ group: current || payload });
    })
  );

  app.put(
    '/api/groups/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getGroupById(id);
      if (!existing) {
        return res.status(404).json({ error: 'group not found' });
      }

      const payload = buildGroupPayload({ ...existing, ...(req.body || {}) });
      payload.chat_id = await resolveGroupChatId(payload.chat_id, telegramClient);
      tokenModel.updateGroupById(id, payload);
      return res.json({ group: tokenModel.getGroupById(id) });
    })
  );

  app.patch(
    '/api/groups/:id/enabled',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getGroupById(id);
      if (!existing) {
        return res.status(404).json({ error: 'group not found' });
      }

      const enabled = req.body?.enabled === undefined ? existing.enabled !== 1 : asBoolean(req.body.enabled, true);
      tokenModel.setGroupEnabled(id, enabled);
      return res.json({ group: tokenModel.getGroupById(id) });
    })
  );

  app.delete(
    '/api/groups/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const deleted = tokenModel.deleteGroupById(id);
      if (!deleted) {
        return res.status(404).json({ error: 'group not found' });
      }

      return res.status(204).send();
    })
  );

  app.get(
    '/api/groups/:id/locks',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const locks = tokenModel.getGroupLocks(group.chat_id);
      return res.json({
        group: {
          id: group.id,
          chat_id: group.chat_id,
          label: group.label
        },
        locks
      });
    })
  );

  app.patch(
    '/api/groups/:id/locks',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      let patch = null;
      try {
        patch = normalizeLocksPatch(req.body || {});
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const locks = tokenModel.setGroupLocksBulk(group.chat_id, patch);
      return res.json({
        group: {
          id: group.id,
          chat_id: group.chat_id,
          label: group.label
        },
        locks
      });
    })
  );

  app.get(
    '/api/groups/:id/automation',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const limit = parsePositiveInt(req.query.limit, 120, 1000);
      const eventType = String(req.query.eventType || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim().toLowerCase();

      const modules = tokenModel.getGroupAutomationModules(group.chat_id);
      const strikeTriggers = tokenModel.getGroupStrikeTriggers(group.chat_id);
      const strikeLadder = tokenModel.getGroupStrikeLadder(group.chat_id);
      const whitelist = tokenModel.listGroupStrikeWhitelist(group.chat_id);
      const logs = tokenModel.listModerationLogs(group.chat_id, {
        limit,
        eventType,
        status
      });
      const overview = tokenModel.getModerationOverview(group.chat_id, {
        days: parsePositiveInt(req.query.days, 30, 365)
      });

      return res.json({
        group: {
          id: group.id,
          chat_id: group.chat_id,
          label: group.label
        },
        modules,
        strikeTriggers,
        strikeLadder,
        whitelist,
        logs,
        overview
      });
    })
  );

  app.put(
    '/api/groups/:id/automation/modules',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const payload = buildAutomationModulePayload(req.body || {});
      if (Array.isArray(payload)) {
        tokenModel.setGroupAutomationModulesBulk(group.chat_id, payload);
      } else {
        if (!payload.key) {
          return res.status(400).json({ error: 'module key is required' });
        }
        tokenModel.setGroupAutomationModule(group.chat_id, payload.key, payload);
      }

      return res.json({
        modules: tokenModel.getGroupAutomationModules(group.chat_id)
      });
    })
  );

  app.put(
    '/api/groups/:id/automation/strike-triggers',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const payload = buildStrikeTriggerPayload(req.body || {});
      if (Array.isArray(payload)) {
        tokenModel.setGroupStrikeTriggersBulk(group.chat_id, payload);
      } else {
        if (!payload.key) {
          return res.status(400).json({ error: 'trigger key is required' });
        }
        tokenModel.setGroupStrikeTrigger(group.chat_id, payload.key, payload);
      }

      return res.json({
        strikeTriggers: tokenModel.getGroupStrikeTriggers(group.chat_id)
      });
    })
  );

  app.put(
    '/api/groups/:id/automation/strike-ladder',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const payload = buildStrikeLadderPayload(req.body || {});
      if (!payload.length) {
        return res.status(400).json({ error: 'ladder payload is required' });
      }

      tokenModel.setGroupStrikeLadderBulk(group.chat_id, payload);
      return res.json({
        strikeLadder: tokenModel.getGroupStrikeLadder(group.chat_id)
      });
    })
  );

  app.get(
    '/api/groups/:id/automation/whitelist',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      return res.json({
        whitelist: tokenModel.listGroupStrikeWhitelist(group.chat_id)
      });
    })
  );

  app.post(
    '/api/groups/:id/automation/whitelist',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const payload = buildWhitelistPayload(req.body || {});
      const whitelist = tokenModel.addGroupStrikeWhitelist(group.chat_id, payload);
      return res.status(201).json({ whitelist });
    })
  );

  app.delete(
    '/api/groups/:id/automation/whitelist/:whitelistId',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const whitelistId = Number(req.params.whitelistId);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const removed = tokenModel.removeGroupStrikeWhitelist(group.chat_id, whitelistId);
      if (!removed) {
        return res.status(404).json({ error: 'whitelist item not found' });
      }

      return res.status(204).send();
    })
  );

  app.get(
    '/api/groups/:id/automation/logs',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const group = tokenModel.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'group not found' });
      }

      const limit = parsePositiveInt(req.query.limit, 150, 1000);
      const eventType = String(req.query.eventType || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim().toLowerCase();
      const logs = tokenModel.listModerationLogs(group.chat_id, { limit, eventType, status });

      return res.json({ logs });
    })
  );

  app.get(
    '/api/members',
    asyncRoute(async (req, res) => {
      const days = parsePositiveInt(req.query.days, 30, 365);
      const limit = parsePositiveInt(req.query.limit, 200, 1000);
      const groups = tokenModel.listGroups({ includeDisabled: false });

      let source = 'activity';
      let rows = tokenModel.getTopActiveMembers({ days, limit });

      if (!rows.length) {
        source = 'transactions';
        const transactionRows = tokenModel.getTopMembers({ days, limit });
        rows = transactionRows.map((item) => ({
          user_id: String(item.buyer || ''),
          username: '',
          first_name: '',
          last_name: '',
          message_count: Number(item.message_count || 0),
          reactions_count: Number(item.reactions_count || 0),
          volume_usd: Number(item.volume_usd || 0),
          last_seen: item.last_seen,
          group_label: 'Global'
        }));
      }

      if (!rows.length) {
        source = 'telegram_admins';
        rows = await loadMembersFromGroupAdmins({
          groups,
          telegramClient,
          limit,
          logger
        });
      }

      const members = normalizeMemberRows(rows);
      res.json({ members, source });
    })
  );

  app.get(
    '/api/commands',
    asyncRoute(async (_req, res) => {
      const commands = tokenModel.listCommands();
      const categories = groupCommandsForUi(commands);
      const summary = tokenModel.getCommandCategorySummary();
      res.json({ categories, summary });
    })
  );

  app.patch(
    '/api/commands/:id/enabled',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getCommandById(id);
      if (!existing) {
        return res.status(404).json({ error: 'command not found' });
      }

      const enabled = req.body?.enabled === undefined ? existing.enabled !== 1 : asBoolean(req.body.enabled, true);
      tokenModel.setCommandEnabled(id, enabled);
      return res.json({ command: tokenModel.getCommandById(id) });
    })
  );

  app.patch(
    '/api/commands/category/:name/enabled',
    asyncRoute(async (req, res) => {
      const category = decodeURIComponent(req.params.name || '').trim();
      if (!category) {
        return res.status(400).json({ error: 'category is required' });
      }

      const enabled = asBoolean(req.body?.enabled, true);
      tokenModel.setCommandCategoryEnabled(category, enabled);

      const commands = tokenModel.listCommands();
      const categories = groupCommandsForUi(commands);
      return res.json({ categories });
    })
  );

  app.patch(
    '/api/commands/bulk/enabled',
    asyncRoute(async (req, res) => {
      const enabled = asBoolean(req.body?.enabled, true);
      tokenModel.setAllCommandsEnabled(enabled);

      const commands = tokenModel.listCommands();
      const categories = groupCommandsForUi(commands);
      return res.json({ categories });
    })
  );

  app.get(
    '/api/schedules',
    asyncRoute(async (req, res) => {
      const limit = parsePositiveInt(req.query.limit, 150, 1000);
      const schedules = tokenModel.listSchedules(limit);
      res.json({ schedules });
    })
  );

  app.post(
    '/api/schedules',
    asyncRoute(async (req, res) => {
      const payload = buildSchedulePayload(req.body || {});
      const schedule = tokenModel.createSchedule(payload);
      res.status(201).json({ schedule });
    })
  );

  app.patch(
    '/api/schedules/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getScheduleById(id);
      if (!existing) {
        return res.status(404).json({ error: 'schedule not found' });
      }

      const payload = buildSchedulePayload({ ...existing, ...(req.body || {}) });
      const updated = tokenModel.updateScheduleById(id, payload);
      return res.json({ schedule: updated });
    })
  );

  app.patch(
    '/api/schedules/:id/status',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const existing = tokenModel.getScheduleById(id);
      if (!existing) {
        return res.status(404).json({ error: 'schedule not found' });
      }

      const status = String(req.body?.status || '').trim().toLowerCase();
      tokenModel.setScheduleStatus(id, status);
      return res.json({ schedule: tokenModel.getScheduleById(id) });
    })
  );

  app.post(
    '/api/schedules/:id/run',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const schedule = tokenModel.getScheduleById(id);
      if (!schedule) {
        return res.status(404).json({ error: 'schedule not found' });
      }

      const targets = normalizeList(schedule.group_ids);
      const message = scheduleMessageText(schedule);
      let mediaUrl = '';

      try {
        mediaUrl = normalizeMediaUrl(
          schedule.media_url || tokenModel.getSetting('media_schedule_url') || '',
          'schedule media url'
        );
      } catch (error) {
        logger.warn({ scheduleId: schedule.id, err: error.message }, 'invalid schedule media url; sending text only');
      }

      const delivery = await telegramClient.sendAlert(message, {
        chatIds: targets.length ? targets : undefined,
        mediaUrl: mediaUrl || undefined
      });
      const delivered = Math.max(0, Number(delivery?.delivered) || 0);

      if (!delivered) {
        const reason = String(delivery?.reason || 'telegram delivery returned zero recipients');
        tokenModel.markScheduleFailed(schedule.id, reason);
        return res.status(502).json({
          error: 'schedule not delivered',
          delivery
        });
      }

      if (schedule.recurrence === 'daily') {
        const next = computeNextDailyIso(schedule.send_at);
        tokenModel.rescheduleDaily(schedule.id, next);
      } else {
        tokenModel.markScheduleSent(schedule.id);
      }

      return res.json({
        ok: true,
        delivery: {
          attempted: Number(delivery?.attempted || 0),
          delivered
        },
        schedule: tokenModel.getScheduleById(id)
      });
    })
  );

  app.delete(
    '/api/schedules/:id',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const deleted = tokenModel.deleteScheduleById(id);
      if (!deleted) {
        return res.status(404).json({ error: 'schedule not found' });
      }
      return res.status(204).send();
    })
  );

  app.get(
    '/api/settings',
    asyncRoute(async (_req, res) => {
      const settings = tokenModel.getAllSettings();
      res.json({
        settings,
        runtime: {
          minUsdAlert: queueService.getMinUsdAlert(),
          enabledNetworks
        }
      });
    })
  );

  app.put(
    '/api/settings',
    asyncRoute(async (req, res) => {
      const body = req.body || {};

      if (body.minUsdAlert !== undefined) {
        const minUsdAlert = asSafeNumber(body.minUsdAlert, 0);
        if (minUsdAlert < 0) {
          return res.status(400).json({ error: 'minUsdAlert must be >= 0' });
        }

        queueService.setMinUsdAlert(minUsdAlert);
        tokenModel.setSetting('min_usd_alert', String(minUsdAlert));
      }

      if (body.menuConfig !== undefined) {
        let menuConfig = body.menuConfig;

        if (typeof menuConfig === 'string') {
          try {
            menuConfig = JSON.parse(menuConfig);
          } catch (_error) {
            return res.status(400).json({ error: 'menuConfig must be valid JSON' });
          }
        }

        if (!menuConfig || typeof menuConfig !== 'object' || Array.isArray(menuConfig)) {
          return res.status(400).json({ error: 'menuConfig must be an object' });
        }

        tokenModel.setSetting('menu_config', JSON.stringify(menuConfig));
      }

      const hasBuyAlertImageSetting = body.buyAlertImageUrl !== undefined || body.media_buy_alert_url !== undefined;
      if (hasBuyAlertImageSetting) {
        const buyAlertImageUrl = normalizeMediaUrl(
          body.buyAlertImageUrl !== undefined ? body.buyAlertImageUrl : body.media_buy_alert_url,
          'buy alert image url'
        );
        tokenModel.setSetting('media_buy_alert_url', buyAlertImageUrl);
      }

      const hasScheduleImageSetting =
        body.scheduleImageUrl !== undefined || body.media_schedule_url !== undefined;
      if (hasScheduleImageSetting) {
        const scheduleImageUrl = normalizeMediaUrl(
          body.scheduleImageUrl !== undefined ? body.scheduleImageUrl : body.media_schedule_url,
          'schedule image url'
        );
        tokenModel.setSetting('media_schedule_url', scheduleImageUrl);
      }

      const settings = tokenModel.getAllSettings();
      return res.json({
        settings,
        runtime: {
          minUsdAlert: queueService.getMinUsdAlert(),
          enabledNetworks
        }
      });
    })
  );

  app.get(
    '/api/incidents',
    asyncRoute(async (req, res) => {
      const limit = parsePositiveInt(req.query.limit, 100, 1000);
      const status = String(req.query.status || '')
        .trim()
        .toLowerCase();
      const incidents = tokenModel.listIncidents({ status, limit });
      return res.json({ incidents });
    })
  );

  app.patch(
    '/api/incidents/:id/status',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const status = String(req.body?.status || '')
        .trim()
        .toLowerCase();
      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }

      const updated = tokenModel.setIncidentStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: 'incident not found' });
      }

      return res.json({ incident: updated });
    })
  );

  app.get(
    '/api/admin-users',
    requireRole('owner'),
    asyncRoute(async (_req, res) => {
      const users = tokenModel.listAdminUsers().map((row) => sanitizeAdminUserForResponse(row));
      return res.json({ users });
    })
  );

  app.post(
    '/api/admin-users',
    requireRole('owner'),
    asyncRoute(async (req, res) => {
      const username = String(req.body?.username || '')
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || '');
      const role = normalizeAdminRole(req.body?.role, 'viewer');
      const enabled = req.body?.enabled === undefined ? true : asBoolean(req.body.enabled, true);

      if (!/^[a-z0-9._-]{3,64}$/i.test(username)) {
        return res.status(400).json({ error: 'invalid username format' });
      }
      if (!password) {
        return res.status(400).json({ error: 'password is required' });
      }

      const user = tokenModel.upsertAdminUser({
        username,
        password,
        role,
        enabled
      });
      return res.status(201).json({ user: sanitizeAdminUserForResponse(user) });
    })
  );

  app.patch(
    '/api/admin-users/:id',
    requireRole('owner'),
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const current = tokenModel.listAdminUsers().find((item) => Number(item.id) === id);
      if (!current) {
        return res.status(404).json({ error: 'admin user not found' });
      }

      const updates = {};
      if (req.body?.role !== undefined) {
        updates.role = normalizeAdminRole(req.body.role, 'viewer');
      }
      if (req.body?.enabled !== undefined) {
        updates.enabled = asBoolean(req.body.enabled, true);
      }
      if (req.body?.password !== undefined) {
        updates.password = String(req.body.password || '');
      }

      if (Number(req.admin?.id || 0) === id && updates.enabled === false) {
        return res.status(400).json({ error: 'cannot disable current authenticated admin' });
      }

      if (updates.role && updates.role !== 'owner') {
        const owners = tokenModel
          .listAdminUsers()
          .filter((item) => normalizeAdminRole(item.role, 'viewer') === 'owner' && Number(item.enabled) === 1);
        const isCurrentOnlyOwner = normalizeAdminRole(current.role, 'viewer') === 'owner' && owners.length <= 1;
        if (isCurrentOnlyOwner) {
          return res.status(400).json({ error: 'at least one enabled owner is required' });
        }
      }

      const updated = tokenModel.setAdminUser(id, updates);
      return res.json({ user: sanitizeAdminUserForResponse(updated) });
    })
  );

  app.delete(
    '/api/admin-users/:id',
    requireRole('owner'),
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const current = tokenModel.listAdminUsers().find((item) => Number(item.id) === id);
      if (!current) {
        return res.status(404).json({ error: 'admin user not found' });
      }

      if (Number(req.admin?.id || 0) === id) {
        return res.status(400).json({ error: 'cannot delete current authenticated admin' });
      }

      const owners = tokenModel
        .listAdminUsers()
        .filter((item) => normalizeAdminRole(item.role, 'viewer') === 'owner' && Number(item.enabled) === 1);
      const deletingLastOwner = normalizeAdminRole(current.role, 'viewer') === 'owner' && owners.length <= 1;
      if (deletingLastOwner) {
        return res.status(400).json({ error: 'cannot delete the last enabled owner' });
      }

      tokenModel.deleteAdminUserById(id);
      return res.status(204).send();
    })
  );

  app.get(
    '/api/audit',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const limit = parsePositiveInt(req.query.limit, 200, 2000);
      const logs = tokenModel.listAuditLogs(limit);
      return res.json({ logs });
    })
  );

  app.get(
    '/api/moderation',
    asyncRoute(async (req, res) => {
      const days = parsePositiveInt(req.query.days, 30, 365);
      const groupId = Number(req.query.groupId || 0);
      const groups = tokenModel.listGroups({ includeDisabled: false });
      const targetGroup =
        (groupId && tokenModel.getGroupById(groupId)) || groups.find((group) => group.enabled === 1) || null;

      if (!targetGroup) {
        return res.json({
          group: null,
          overview: {
            pending: 0,
            resolved: 0,
            bans: 0,
            strikes: 0
          },
          logs: []
        });
      }

      const overview = tokenModel.getModerationOverview(targetGroup.chat_id, { days });
      const logs = tokenModel.listModerationLogs(targetGroup.chat_id, {
        limit: parsePositiveInt(req.query.limit, 120, 1000)
      });

      return res.json({
        group: {
          id: targetGroup.id,
          chat_id: targetGroup.chat_id,
          label: targetGroup.label
        },
        overview,
        logs
      });
    })
  );

  app.get(
    '/api/broadcasts',
    asyncRoute(async (req, res) => {
      const limit = parsePositiveInt(req.query.limit, 80, 500);
      const broadcasts = tokenModel.listBroadcastMessages(limit);
      return res.json({ broadcasts });
    })
  );

  app.post(
    '/api/broadcasts',
    asyncRoute(async (req, res) => {
      const payload = buildBroadcastPayload(req.body || {});

      const groups =
        payload.group_ids.length > 0
          ? payload.group_ids
          : tokenModel.listGroups({ includeDisabled: false }).map((group) => String(group.chat_id || '').trim());

      if (!groups.length) {
        return res.status(400).json({ error: 'no target groups available for broadcast' });
      }

      const broadcast = tokenModel.createBroadcastMessage({
        ...payload,
        group_ids: groups,
        status: 'queued'
      });

      let sentCount = 0;
      let failCount = 0;
      for (const chatId of groups) {
        try {
          let deliveredToGroup = false;

          if (payload.media_url) {
            const content = String(payload.content || '');
            if (content.length <= 1024) {
              const photoResult = await telegramClient.sendPhoto(chatId, payload.media_url, content);
              deliveredToGroup = Boolean(photoResult?.sent);
            } else {
              const photoResult = await telegramClient.sendPhoto(chatId, payload.media_url, payload.title || 'Broadcast');
              const textResult = await telegramClient.sendMessage(chatId, content);
              deliveredToGroup = Boolean(photoResult?.sent) && Boolean(textResult?.sent);
            }
          } else {
            const textResult = await telegramClient.sendMessage(chatId, payload.content);
            deliveredToGroup = Boolean(textResult?.sent);
          }

          if (deliveredToGroup) {
            sentCount += 1;
          } else {
            failCount += 1;
            logger.warn({ chatId }, 'broadcast not delivered for target group');
          }
        } catch (error) {
          failCount += 1;
          logger.warn({ chatId, err: error.message }, 'broadcast send failed for target group');
        }
      }

      const status = failCount > 0 ? (sentCount > 0 ? 'partial' : 'failed') : 'sent';
      const updated = tokenModel.setBroadcastMessageStatus(broadcast.id, {
        status,
        sent_count: sentCount,
        fail_count: failCount
      });

      return res.status(201).json({
        broadcast: updated || broadcast
      });
    })
  );

  app.get(
    '/api/transactions',
    asyncRoute(async (req, res) => {
      const limit = parsePositiveInt(req.query.limit, 80, 500);
      const transactions = tokenModel.getRecentTransactions(limit);
      res.json({ transactions });
    })
  );

  app.post(
    '/api/test-alert',
    asyncRoute(async (req, res) => {
      const message = String(req.body?.message || 'Dashboard test alert').trim();
      const chatId = String(req.body?.chatId || '').trim();
      const mediaUrl = normalizeMediaUrl(req.body?.mediaUrl || '', 'test media url');

      const delivery = await telegramClient.sendAlert(message, {
        chatIds: chatId ? [chatId] : undefined,
        mediaUrl: mediaUrl || undefined
      });

      if (!Number(delivery?.delivered || 0)) {
        return res.status(502).json({
          error: 'test alert not delivered',
          delivery
        });
      }

      res.json({
        ok: true,
        delivery
      });
    })
  );

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'route not found' });
    }

    return res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((error, _req, res, _next) => {
    logger.error({ err: error.message }, 'admin api error');

    const msg = String(error.message || '').toLowerCase();
    const isValidation = msg.includes('invalid') || msg.includes('required') || msg.includes('must');

    if (isValidation) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'internal server error' });
  });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, host, () => resolve(instance));
    instance.on('error', reject);
  });

  logger.info({ host, port }, 'admin dashboard started');

  const close = async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  return {
    app,
    close
  };
};

module.exports = {
  startAdminServer
};
