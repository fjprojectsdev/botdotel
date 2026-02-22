const crypto = require('crypto');
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

const normalizeGroupPermissions = (value) => {
  if (Array.isArray(value)) {
    const normalized = Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
    return normalized.length ? normalized : [...DEFAULT_GROUP_PERMISSIONS];
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

const createAuthMiddleware = ({ username, password, logger }) => {
  const authEnabled = Boolean(username && password);

  if (!authEnabled) {
    logger.warn('ADMIN_USER/ADMIN_PASSWORD not set; dashboard auth disabled');
    return (_req, _res, next) => next();
  }

  const safeEquals = (left, right) => {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(a, b);
  };

  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Buy Alerts Admin"');
      return res.status(401).json({ error: 'authentication required' });
    }

    let decoded;
    try {
      decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    } catch (_error) {
      return res.status(401).json({ error: 'invalid auth header' });
    }

    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return res.status(401).json({ error: 'invalid auth format' });
    }

    const incomingUser = decoded.slice(0, separator);
    const incomingPass = decoded.slice(separator + 1);

    if (!safeEquals(incomingUser, username) || !safeEquals(incomingPass, password)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    return next();
  };
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
    group_ids: normalizeList(body.group_ids || body.groupIds || []),
    send_at: body.send_at || body.sendAt,
    recurrence: String(body.recurrence || 'none').trim().toLowerCase(),
    status: body.status ? String(body.status).trim().toLowerCase() : undefined
  };
};

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
  const prefix = schedule.kind === 'poll' ? '?? AGENDAMENTO (Enquete)' : '? AGENDAMENTO';
  return `${prefix}\n\n${schedule.content}`;
};

const startAdminServer = async ({
  tokenModel,
  queueService,
  telegramClient,
  schedulerService,
  logger,
  enabledNetworks,
  host = process.env.ADMIN_HOST || '0.0.0.0',
  port = Number(process.env.ADMIN_PORT || 8787)
}) => {
  const app = express();
  const authMiddleware = createAuthMiddleware({
    username: process.env.ADMIN_USER || '',
    password: process.env.ADMIN_PASSWORD || '',
    logger
  });
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS || '');
  const corsAllowAll = corsOrigins.includes('*');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
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
    res.json({ ok: true, service: 'buy-alert-admin' });
  });

  app.use((req, res, next) => {
    if (req.path === '/healthz') {
      return next();
    }
    return authMiddleware(req, res, next);
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
    '/api/stats',
    asyncRoute(async (_req, res) => {
      const tokens = tokenModel.listTokens({ includeDisabled: true });
      const groups = tokenModel.listGroups({ includeDisabled: true });
      const recent = tokenModel.getRecentTransactions(40);
      const schedules = tokenModel.listSchedules(200);

      const activeTokens = tokens.filter((item) => item.enabled === 1).length;
      const activeGroups = groups.filter((item) => item.enabled === 1).length;
      const pendingSchedules = schedules.filter((item) => item.status === 'pending').length;

      res.json({
        uptimeSec: Math.floor(process.uptime()),
        minUsdAlert: queueService.getMinUsdAlert(),
        queues: {
          processPending: queueService.processingQueue.pending,
          processSize: queueService.processingQueue.size,
          telegramPending: queueService.telegramQueue.pending,
          telegramSize: queueService.telegramQueue.size
        },
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
        recentAlerts: recent.length,
        schedulerRunning: Boolean(schedulerService?.running)
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
      res.json({ groups });
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
          group_label: groups[0]?.label || 'Alertas'
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

      await telegramClient.sendAlert(message, {
        chatIds: targets.length ? targets : undefined
      });

      if (schedule.recurrence === 'daily') {
        const next = new Date(new Date(schedule.send_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
        tokenModel.rescheduleDaily(schedule.id, next);
      } else {
        tokenModel.markScheduleSent(schedule.id);
      }

      return res.json({ ok: true, schedule: tokenModel.getScheduleById(id) });
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

      await telegramClient.sendAlert(message, {
        chatIds: chatId ? [chatId] : undefined
      });

      res.json({ ok: true });
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
