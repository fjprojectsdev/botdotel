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
    res.json({ ok: true, service: 'buy-alert-admin' });
  });

  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', etag: true, index: false }));

  app.use((req, res, next) => {
    if (req.path === '/healthz' || req.path.startsWith('/uploads/')) {
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
      const broadcasts = tokenModel.listBroadcastMessages(200);

      const activeTokens = tokens.filter((item) => item.enabled === 1).length;
      const activeGroups = groups.filter((item) => item.enabled === 1).length;
      const pendingSchedules = schedules.filter((item) => item.status === 'pending').length;
      const sentBroadcasts = broadcasts.filter((item) => String(item.status || '').toLowerCase() === 'sent').length;

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
        broadcasts: {
          total: broadcasts.length,
          sent: sentBroadcasts
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
      let mediaUrl = '';

      try {
        mediaUrl = normalizeMediaUrl(
          schedule.media_url || tokenModel.getSetting('media_schedule_url') || '',
          'schedule media url'
        );
      } catch (error) {
        logger.warn({ scheduleId: schedule.id, err: error.message }, 'invalid schedule media url; sending text only');
      }

      await telegramClient.sendAlert(message, {
        chatIds: targets.length ? targets : undefined,
        mediaUrl: mediaUrl || undefined
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
          if (payload.media_url) {
            const content = String(payload.content || '');
            if (content.length <= 1024) {
              await telegramClient.sendPhoto(chatId, payload.media_url, content);
            } else {
              await telegramClient.sendPhoto(chatId, payload.media_url, payload.title || 'Broadcast');
              await telegramClient.sendMessage(chatId, content);
            }
          } else {
            await telegramClient.sendMessage(chatId, payload.content);
          }
          sentCount += 1;
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

      await telegramClient.sendAlert(message, {
        chatIds: chatId ? [chatId] : undefined,
        mediaUrl: mediaUrl || undefined
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
