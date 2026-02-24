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
const DEFAULT_NEW_GROUP_PERMISSIONS = [];

const FEATURE_PERMISSION = {
  core: 'core_commands',
  alerts: 'buy_alerts',
  mod: 'moderation',
  security: 'security',
  welcome: 'welcome',
  fun: 'fun',
  eco: 'economy',
  adv: 'advanced'
};

const LOCK_KEYS = ['antispam', 'antilink', 'antiflood', 'captcha', 'antiraid'];

const COMMANDS = [
  { key: 'core.start', cmd: 'start', feature: FEATURE_PERMISSION.core },
  { key: 'core.help', cmd: 'help', feature: FEATURE_PERMISSION.core },
  { key: 'core.menu', cmd: 'menu', feature: FEATURE_PERMISSION.core },
  { key: 'core.settings', cmd: 'settings', feature: FEATURE_PERMISSION.core },
  { key: 'core.ping', cmd: 'ping', feature: FEATURE_PERMISSION.core },
  { key: 'core.info', cmd: 'info', feature: FEATURE_PERMISSION.core },
  { key: 'alerts.alerts', cmd: 'alerts', feature: FEATURE_PERMISSION.alerts },
  { key: 'alerts.tokens', cmd: 'tokens', feature: FEATURE_PERMISSION.alerts },
  { key: 'alerts.minusd', cmd: 'minusd', feature: FEATURE_PERMISSION.alerts, adminOnly: true },
  { key: 'mod.ban', cmd: 'ban', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.unban', cmd: 'unban', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.kick', cmd: 'kick', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.mute', cmd: 'mute', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.unmute', cmd: 'unmute', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.warn', cmd: 'warn', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.unwarn', cmd: 'unwarn', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.warns', cmd: 'warns', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.del', cmd: 'del', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'mod.purge', cmd: 'purge', feature: FEATURE_PERMISSION.mod, adminOnly: true, groupOnly: true },
  { key: 'security.antispam', cmd: 'antispam', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.antilink', cmd: 'antilink', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.antiflood', cmd: 'antiflood', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.captcha', cmd: 'captcha', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.antiraid', cmd: 'antiraid', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.lock', cmd: 'lock', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.unlock', cmd: 'unlock', feature: FEATURE_PERMISSION.security, adminOnly: true, groupOnly: true },
  { key: 'security.locks', cmd: 'locks', feature: FEATURE_PERMISSION.security, groupOnly: true },
  { key: 'welcome.welcome', cmd: 'welcome', feature: FEATURE_PERMISSION.welcome, groupOnly: true },
  { key: 'welcome.setwelcome', cmd: 'setwelcome', feature: FEATURE_PERMISSION.welcome, adminOnly: true, groupOnly: true },
  { key: 'welcome.goodbye', cmd: 'goodbye', feature: FEATURE_PERMISSION.welcome, groupOnly: true },
  { key: 'welcome.setgoodbye', cmd: 'setgoodbye', feature: FEATURE_PERMISSION.welcome, adminOnly: true, groupOnly: true },
  { key: 'welcome.rules', cmd: 'rules', feature: FEATURE_PERMISSION.welcome, groupOnly: true },
  { key: 'welcome.setrules', cmd: 'setrules', feature: FEATURE_PERMISSION.welcome, adminOnly: true, groupOnly: true },
  { key: 'fun.dice', cmd: 'dice', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.roll', cmd: 'roll', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.meme', cmd: 'meme', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.joke', cmd: 'joke', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.ship', cmd: 'ship', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.8ball', cmd: '8ball', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.coinflip', cmd: 'coinflip', feature: FEATURE_PERMISSION.fun },
  { key: 'fun.raffle', cmd: 'sorteio', aliases: ['raffle', 'draw'], feature: FEATURE_PERMISSION.fun, groupOnly: true },
  { key: 'eco.balance', cmd: 'balance', feature: FEATURE_PERMISSION.eco },
  { key: 'eco.daily', cmd: 'daily', feature: FEATURE_PERMISSION.eco },
  { key: 'eco.work', cmd: 'work', feature: FEATURE_PERMISSION.eco },
  { key: 'eco.transfer', cmd: 'transfer', feature: FEATURE_PERMISSION.eco },
  { key: 'eco.leaderboard', cmd: 'leaderboard', feature: FEATURE_PERMISSION.eco },
  { key: 'adv.addfilter', cmd: 'addfilter', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.filters', cmd: 'filters', feature: FEATURE_PERMISSION.adv, groupOnly: true },
  { key: 'adv.delfilter', cmd: 'delfilter', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.setlang', cmd: 'setlang', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.setlog', cmd: 'setlog', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.export', cmd: 'export', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.backup', cmd: 'backup', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true },
  { key: 'adv.import', cmd: 'import', feature: FEATURE_PERMISSION.adv, adminOnly: true, groupOnly: true }
];

const SHORT_JOKES = [
  'Programador nao dorme, compila sonhos.',
  'Deploy na sexta exige fe e rollback.',
  'Bug que some sozinho era feature timida.'
];

const MEME_LINKS = [
  'https://i.imgflip.com/30b1gx.jpg',
  'https://i.imgflip.com/26am.jpg',
  'https://i.imgflip.com/1bij.jpg'
];

const BALL_8 = ['Com certeza.', 'Sem duvidas.', 'Sinais dizem que sim.', 'Melhor nao.', 'Pergunte mais tarde.', 'Nao.'];
const COIN = ['cara', 'coroa'];
const MENU_BUTTON_LIMIT = 10;
const MENU_FALLBACK_TEXT = 'Menu rapido: /start /help /addgroup /developer';
const MENU_SHORTCUT_ROWS = [
  [
    { label: 'Ajuda', command: '/help' },
    { label: 'Adicionar meu grupo', command: '/addgroup' }
  ],
  [{ label: 'Falar com desenvolvedor', command: '/developer' }]
];
const MENU_SHORTCUT_COMMANDS = new Map(
  MENU_SHORTCUT_ROWS.flatMap((row) =>
    row.map((item) => [String(item.label || '').trim().toLowerCase(), String(item.command || '').trim()])
  )
);
const TELEGRAM_SLASH_MENU_FALLBACK = [
  { command: 'start', description: 'Inicia o bot' },
  { command: 'menu', description: 'Abre o menu principal' },
  { command: 'help', description: 'Ajuda e instrucoes' },
  { command: 'addgroup', description: 'Como adicionar meu grupo' },
  { command: 'developer', description: 'Falar com desenvolvedor' }
];
const PRIVATE_ALLOWED_COMMANDS = new Set(['start', 'menu', 'help', 'addgroup', 'developer', 'dev']);


const text = (value) => String(value || '').trim();
const isoNow = () => new Date().toISOString();
const shortId = (value) => {
  const raw = String(value || '');
  if (raw.length <= 12) {
    return raw;
  }
  if (raw.startsWith('0x')) {
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  }
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
};

const parseOnOff = (value) => {
  const normalized = text(value).toLowerCase();
  if (['on', 'true', '1', 'ativar', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['off', 'false', '0', 'desativar', 'disabled'].includes(normalized)) {
    return false;
  }
  return null;
};

const normalizeCommandDescription = (value) => {
  const raw = text(value).replace(/\s+/g, ' ');
  if (!raw) {
    return 'Comando do bot';
  }
  return raw.length > 72 ? `${raw.slice(0, 69)}...` : raw;
};

const isValidSlashCommandName = (value) => /^[a-z0-9_]{1,32}$/.test(String(value || '').trim().toLowerCase());

class CommandRouter {
  constructor({ telegramClient, tokenModel, queueService, enabledNetworks = [], logger }) {
    this.telegramClient = telegramClient;
    this.tokenModel = tokenModel;
    this.queueService = queueService;
    this.enabledNetworks = Array.isArray(enabledNetworks) ? enabledNetworks : [];
    this.logger = logger;

    this.commandByName = new Map();
    for (const item of COMMANDS) {
      this.commandByName.set(item.cmd, item);
      for (const alias of item.aliases || []) {
        this.commandByName.set(alias, item);
      }
    }

    this.enabledCache = {
      expiresAt: 0,
      keys: new Set(),
      rows: []
    };

    this.adminCache = new Map();
    this.floodCache = new Map();
    this.spamCache = new Map();
    this.automationCache = new Map();
  }

  async start() {
    if (!this.telegramClient?.bot) {
      return;
    }

    this.telegramClient.onMessage((message) => this.handleMessage(message));
    await this.syncSlashCommands(true);
    this.logger.info('telegram command router started');
  }

  stop() {
    this.adminCache.clear();
    this.floodCache.clear();
    this.spamCache.clear();
    this.automationCache.clear();
  }

  isGroup(chat) {
    const type = String(chat?.type || '').toLowerCase();
    return type === 'group' || type === 'supergroup';
  }

  isPrivateChat(chat) {
    return String(chat?.type || '').toLowerCase() === 'private';
  }

  resolveShortcutToCommand(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return MENU_SHORTCUT_COMMANDS.get(normalized) || '';
  }

  async ensureGroup(chat) {
    if (!this.isGroup(chat)) {
      return null;
    }

    const chatId = String(chat.id);
    let row = this.tokenModel.getGroupByChatId(chatId);
    if (!row) {
      this.tokenModel.upsertGroup({
        chat_id: chatId,
        label: text(chat.title || `Grupo ${chatId}`),
        permissions: DEFAULT_NEW_GROUP_PERMISSIONS,
        enabled: 1
      });
      row = this.tokenModel.getGroupByChatId(chatId);
      this.logger.info({ chatId, label: row?.label || '' }, 'group auto-discovered from telegram');
    }
    return row;
  }

  hasPermission(group, permission) {
    if (!group || !permission) {
      return true;
    }
    const permissions = Array.isArray(group.permissions) ? group.permissions : [];
    return permissions.includes(String(permission).toLowerCase());
  }

  async refreshEnabledCommands(force = false) {
    const now = Date.now();
    if (!force && now < this.enabledCache.expiresAt) {
      return this.enabledCache;
    }

    const rows = this.tokenModel.listCommands();
    this.enabledCache = {
      expiresAt: now + 10000,
      keys: new Set(rows.filter((item) => item.enabled === 1).map((item) => item.command_key)),
      rows
    };
    return this.enabledCache;
  }

  async isEnabled(commandKey) {
    const cache = await this.refreshEnabledCommands();
    return cache.keys.has(commandKey);
  }

  async syncSlashCommands(force = false) {
    try {
      await this.refreshEnabledCommands(force);
      await this.telegramClient.setMyCommands(TELEGRAM_SLASH_MENU_FALLBACK);
      await this.telegramClient.setMyCommands(TELEGRAM_SLASH_MENU_FALLBACK, {
        scope: { type: 'all_private_chats' }
      });
      await this.telegramClient.deleteMyCommands({ scope: { type: 'all_group_chats' } });
      await this.telegramClient.deleteMyCommands({ scope: { type: 'all_chat_administrators' } });
    } catch (error) {
      this.logger.warn({ err: error.message }, 'failed to sync slash commands');
    }
  }

  async isChatAdmin(chatId, userId) {
    const key = `${chatId}:${userId}`;
    const now = Date.now();
    const cached = this.adminCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    let value = false;
    try {
      const member = await this.telegramClient.getChatMember(chatId, Number(userId));
      const status = String(member?.status || '').toLowerCase();
      value = status === 'creator' || status === 'administrator';
    } catch (_error) {
      value = false;
    }

    this.adminCache.set(key, {
      value,
      expiresAt: now + 15000
    });

    return value;
  }

  async send(chatId, message, options = {}) {
    return this.telegramClient.sendMessage(chatId, message, options);
  }

  async reply(ctx, message, options = {}) {
    return this.telegramClient.sendMessage(ctx.chatId, message, {
      reply_to_message_id: ctx.message?.message_id,
      ...options
    });
  }

  resolveTarget(ctx) {
    const replyUser = ctx.message?.reply_to_message?.from;
    if (replyUser?.id) {
      return {
        id: String(replyUser.id),
        label: text(replyUser.username ? `@${replyUser.username}` : replyUser.first_name || replyUser.id)
      };
    }

    const firstArg = text(ctx.args[0] || '');
    if (/^\d+$/.test(firstArg)) {
      return {
        id: firstArg,
        label: firstArg
      };
    }

    return null;
  }

  resolveLock(raw) {
    const map = {
      spam: 'antispam',
      antispam: 'antispam',
      link: 'antilink',
      links: 'antilink',
      antilink: 'antilink',
      flood: 'antiflood',
      antiflood: 'antiflood',
      captcha: 'captcha',
      raid: 'antiraid',
      antiraid: 'antiraid'
    };
    return map[text(raw).toLowerCase()] || null;
  }

  getTemplate(chatId, key, fallback) {
    const stored = this.tokenModel.getChatSetting(chatId, key);
    return text(stored || fallback);
  }

  fillTemplate(template, payload) {
    return String(template || '')
      .replaceAll('{name}', text(payload.name || 'membro'))
      .replaceAll('{group}', text(payload.group || 'grupo'))
      .replaceAll('{user}', text(payload.user || payload.name || 'membro'))
      .replaceAll('{reason}', text(payload.reason || 'sem motivo'))
      .replaceAll('{strikes}', String(payload.strikes || '0'))
      .replaceAll('{step}', String(payload.step || '0'))
      .replaceAll('{duration}', String(payload.duration || '0'));
  }

  getAutomationSnapshot(chatId, { force = false } = {}) {
    const safeChatId = String(chatId || '');
    const now = Date.now();
    const cached = this.automationCache.get(safeChatId);
    if (!force && cached && cached.expiresAt > now) {
      return cached.value;
    }

    const modules = this.tokenModel.getGroupAutomationModules(safeChatId);
    const triggers = this.tokenModel.getGroupStrikeTriggers(safeChatId);
    const ladder = this.tokenModel.getGroupStrikeLadder(safeChatId);

    const moduleMap = new Map(modules.map((item) => [String(item.key || ''), item]));
    const triggerMap = new Map(triggers.map((item) => [String(item.key || ''), item]));
    const ladderSorted = [...ladder].sort((a, b) => Number(a.step || 0) - Number(b.step || 0));

    const value = {
      modules,
      triggers,
      ladder: ladderSorted,
      moduleMap,
      triggerMap
    };

    this.automationCache.set(safeChatId, {
      value,
      expiresAt: now + 5000
    });

    return value;
  }

  isAutomationModuleEnabled(chatId, moduleKey, fallback = false) {
    const snapshot = this.getAutomationSnapshot(chatId);
    const row = snapshot.moduleMap.get(String(moduleKey || '').trim().toLowerCase());
    if (!row) {
      return fallback;
    }
    return row.enabled === true;
  }

  normalizeArrayConfig(value) {
    if (Array.isArray(value)) {
      return value.map((item) => text(item).toLowerCase()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => text(item).toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  extractDomainsFromBody(body) {
    const textBody = String(body || '').toLowerCase();
    const matches = textBody.match(/(?:https?:\/\/|www\.|t\.me\/)[^\s]+/g) || [];
    return matches;
  }

  async logModerationEvent(chatId, payload = {}) {
    try {
      this.tokenModel.addModerationLog({
        chat_id: String(chatId),
        user_id: String(payload.user_id || ''),
        actor_id: String(payload.actor_id || ''),
        event_type: String(payload.event_type || 'unknown'),
        status: String(payload.status || 'received'),
        reason: String(payload.reason || ''),
        details: payload.details && typeof payload.details === 'object' ? payload.details : {}
      });
    } catch (error) {
      this.logger.warn({ err: error.message }, 'failed to persist moderation log');
    }
  }

  async applyStrike(chatId, group, user, triggerInfo = {}) {
    const safeChatId = String(chatId || '');
    const userId = String(user?.id || '');
    if (!safeChatId || !userId) {
      return;
    }

    const reason = text(triggerInfo.reason || 'violacao de regra');
    const strikePoints = Math.max(1, Number(triggerInfo.strikePoints) || 1);
    for (let i = 0; i < strikePoints; i += 1) {
      this.tokenModel.addWarning({
        chatId: safeChatId,
        userId,
        reason,
        moderatorId: 'auto'
      });
    }

    const total = this.tokenModel.getWarningCount(safeChatId, userId);
    const snapshot = this.getAutomationSnapshot(safeChatId);
    const enabledLadder = snapshot.ladder.filter((item) => item.enabled);
    const stepConfig = enabledLadder
      .filter((item) => Number(item.step) <= total)
      .sort((a, b) => Number(a.step) - Number(b.step))
      .pop();

    const username = text(user?.username ? `@${user.username}` : '');
    const firstName = text(user?.first_name || user?.id || 'membro');
    const chatLabel = text(group?.label || safeChatId);

    await this.logModerationEvent(safeChatId, {
      user_id: userId,
      actor_id: 'auto',
      event_type: `trigger.${text(triggerInfo.key || 'unknown').toLowerCase()}`,
      status: 'strike',
      reason,
      details: {
        strike_points: strikePoints,
        total_strikes: total
      }
    });

    if (!stepConfig) {
      return;
    }

    const template =
      text(stepConfig.message_template) || '@{name}, strike aplicado ({reason}). Total: {strikes}.';
    const message = this.fillTemplate(template, {
      name: username || firstName,
      user: username || firstName,
      group: chatLabel,
      reason,
      strikes: total,
      step: stepConfig.step,
      duration: stepConfig.duration_minutes
    });

    const action = text(stepConfig.action || 'warn').toLowerCase();
    if (action === 'none') {
      return;
    }

    if (action === 'warn') {
      await this.send(safeChatId, message);
      await this.logModerationEvent(safeChatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'punishment.warn',
        status: 'resolved',
        reason,
        details: {
          strikes: total,
          step: stepConfig.step
        }
      });
      return;
    }

    if (action === 'mute') {
      const minutes = Math.max(1, Number(stepConfig.duration_minutes) || 30);
      let actionError = null;
      try {
        await this.telegramClient.muteUser(safeChatId, Number(userId), minutes);
      } catch (error) {
        actionError = error;
        this.logger.warn({ chatId: safeChatId, userId, err: error.message }, 'mute action failed');
      }
      await this.send(safeChatId, message);
      await this.logModerationEvent(safeChatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'punishment.mute',
        status: actionError ? 'received' : 'resolved',
        reason,
        details: {
          strikes: total,
          step: stepConfig.step,
          duration_minutes: minutes,
          error: actionError ? actionError.message : ''
        }
      });
      return;
    }

    if (action === 'kick') {
      let actionError = null;
      try {
        await this.telegramClient.kickUser(safeChatId, Number(userId));
      } catch (error) {
        actionError = error;
        this.logger.warn({ chatId: safeChatId, userId, err: error.message }, 'kick action failed');
      }
      await this.send(safeChatId, message);
      await this.logModerationEvent(safeChatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'punishment.kick',
        status: actionError ? 'received' : 'resolved',
        reason,
        details: {
          strikes: total,
          step: stepConfig.step,
          error: actionError ? actionError.message : ''
        }
      });
      return;
    }

    if (action === 'ban') {
      let actionError = null;
      try {
        await this.telegramClient.banUser(safeChatId, Number(userId), { revoke_messages: true });
      } catch (error) {
        actionError = error;
        this.logger.warn({ chatId: safeChatId, userId, err: error.message }, 'ban action failed');
      }
      await this.send(safeChatId, message);
      await this.logModerationEvent(safeChatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'punishment.ban',
        status: actionError ? 'received' : 'resolved',
        reason,
        details: {
          strikes: total,
          step: stepConfig.step,
          error: actionError ? actionError.message : ''
        }
      });
    }
  }

  detectTriggerMatch(trigger, bodyText) {
    const normalizedBody = String(bodyText || '').toLowerCase();
    const config = trigger?.config && typeof trigger.config === 'object' ? trigger.config : {};
    const key = String(trigger?.key || '').toLowerCase();

    if (key === 'bad_words') {
      const words = this.normalizeArrayConfig(config.words);
      const hit = words.find((word) => word && normalizedBody.includes(word));
      return hit ? `palavra proibida: ${hit}` : '';
    }

    if (key === 'blocked_links') {
      const domains = this.normalizeArrayConfig(config.domains);
      const links = this.extractDomainsFromBody(normalizedBody);
      const hit = domains.find((domain) => links.some((url) => url.includes(domain)));
      return hit ? `link proibido: ${hit}` : '';
    }

    if (key === 'group_invites') {
      const patterns = this.normalizeArrayConfig(config.patterns);
      const defaultPatterns = ['t.me/joinchat', 'chat.whatsapp.com', 'discord.gg'];
      const merged = patterns.length ? patterns : defaultPatterns;
      const hit = merged.find((pattern) => normalizedBody.includes(pattern));
      return hit ? `convite detectado: ${hit}` : '';
    }

    if (key === 'scam_pattern') {
      const patterns = this.normalizeArrayConfig(config.patterns);
      const defaultPatterns = ['garantia de lucro', 'dobrar dinheiro', 'retorno garantido'];
      const merged = patterns.length ? patterns : defaultPatterns;
      const hit = merged.find((pattern) => normalizedBody.includes(pattern));
      return hit ? `padrao suspeito: ${hit}` : '';
    }

    return '';
  }

  recordMemberActivity(message, group) {
    if (!this.isGroup(message?.chat) || !group || !message?.from) {
      return;
    }

    try {
      this.tokenModel.trackMemberActivity({
        chat_id: String(message.chat.id),
        user_id: String(message.from.id),
        username: text(message.from.username || ''),
        first_name: text(message.from.first_name || ''),
        last_name: text(message.from.last_name || ''),
        seen_at: isoNow()
      });
    } catch (error) {
      this.logger.warn({ err: error.message }, 'failed to track member activity');
    }
  }

  normalizeMenuConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
      .map((button) => ({
        emoji: text(button?.emoji).slice(0, 4),
        label: text(button?.label).slice(0, 64),
        command: text(button?.command).slice(0, 120)
      }))
      .filter((button) => button.label && button.command)
      .slice(0, MENU_BUTTON_LIMIT);

    return {
      greeting: text(raw.greeting),
      siteUrl: text(raw.siteUrl),
      description: text(raw.description),
      buttons
    };
  }

  loadMenuConfig() {
    const serialized = this.tokenModel.getSetting('menu_config');
    if (!serialized) {
      return null;
    }

    try {
      return this.normalizeMenuConfig(JSON.parse(serialized));
    } catch (error) {
      this.logger.warn({ err: error.message }, 'invalid menu_config json');
      return null;
    }
  }

  resolveMenuText(rawValue, ctx) {
    const value = text(rawValue);
    if (!value) {
      return '';
    }

    const firstName = text(ctx?.message?.from?.first_name || ctx?.message?.from?.username || 'Usuario');
    const username = ctx?.message?.from?.username ? `@${ctx.message.from.username}` : firstName;
    const groupName = text(ctx?.message?.chat?.title || 'grupo');

    return value
      .replaceAll('@(pushName)', firstName)
      .replaceAll('@pushName', firstName)
      .replaceAll('{name}', firstName)
      .replaceAll('{user}', username)
      .replaceAll('{group}', groupName)
      .trim();
  }

  buildMenuMessage(ctx, config) {
    if (this.isPrivateChat(ctx?.message?.chat)) {
      const firstName = text(ctx?.message?.from?.first_name || ctx?.message?.from?.username || 'Usuario');
      return [
        `Ola, ${firstName}!`,
        'Use o menu abaixo para configurar seu bot rapidamente.',
        '',
        '- /help: ver instrucoes',
        '- /addgroup: adicionar seu grupo',
        '- /developer: falar com o desenvolvedor'
      ].join('\n');
    }

    if (!config) {
      return MENU_FALLBACK_TEXT;
    }

    const lines = [];
    const greeting = this.resolveMenuText(config.greeting, ctx);
    const description = this.resolveMenuText(config.description, ctx);
    const siteUrl = text(config.siteUrl);

    if (greeting) {
      lines.push(greeting);
    }

    if (description) {
      if (lines.length) {
        lines.push('');
      }
      lines.push(description);
    }

    if (siteUrl) {
      if (lines.length) {
        lines.push('');
      }
      lines.push(`Saiba mais: ${siteUrl}`);
    }

    return lines.join('\n').trim() || MENU_FALLBACK_TEXT;
  }

  buildMenuKeyboard() {
    return {
      reply_markup: {
        keyboard: MENU_SHORTCUT_ROWS.map((row) => row.map((item) => ({ text: item.label }))),
        resize_keyboard: true,
        is_persistent: true,
        input_field_placeholder: 'Escolha uma opcao...'
      }
    };
  }

  async handleMenu(ctx) {
    const config = this.loadMenuConfig();
    const message = this.buildMenuMessage(ctx, config);
    const options = this.isPrivateChat(ctx?.message?.chat) ? this.buildMenuKeyboard() : {};
    await this.send(ctx.chatId, message, {
      ...options
    });
  }

  async handleAddGroup(ctx) {
    const me = await this.telegramClient.getMe().catch(() => null);
    const username = text(me?.username);
    const addLink = username ? `https://t.me/${username}?startgroup=true` : '';

    const lines = [
      'Como adicionar seu grupo:',
      '1. Toque em "Adicionar membro" no seu grupo.',
      '2. Procure por este bot e adicione.',
      '3. De permissao de administrador (recomendado).',
      '4. No grupo, envie /start para ativar.'
    ];

    if (addLink) {
      lines.push('');
      lines.push(`Link direto: ${addLink}`);
    }

    await this.send(ctx.chatId, lines.join('\n'));
  }

  async handleDeveloper(ctx) {
    await this.send(ctx.chatId, 'Fale com o desenvolvedor: @FLAVIOJHONATAN');
  }

  async handlePrivateHelp(ctx) {
    await this.send(
      ctx.chatId,
      [
        'Ajuda rapida',
        '- /start ou /menu: abre o menu inicial',
        '- /addgroup: guia para adicionar seu grupo',
        '- /developer: contato do desenvolvedor'
      ].join('\n')
    );
  }

  updateFlood(chatId, userId) {
    const key = `${chatId}:${userId}`;
    const now = Date.now();
    const windowMs = Math.max(3000, Number(process.env.MOD_FLOOD_WINDOW_MS || 10000));
    const maxMessages = Math.max(3, Number(process.env.MOD_FLOOD_MAX_MESSAGES || 6));
    const series = this.floodCache.get(key) || [];
    const filtered = series.filter((entry) => now - entry <= windowMs);
    filtered.push(now);
    this.floodCache.set(key, filtered);
    return filtered.length >= maxMessages;
  }

  updateSpam(chatId, userId, body) {
    const key = `${chatId}:${userId}`;
    const now = Date.now();
    const windowMs = Math.max(5000, Number(process.env.MOD_SPAM_WINDOW_MS || 20000));
    const maxRepeat = Math.max(2, Number(process.env.MOD_SPAM_MAX_REPEATS || 3));
    const previous = this.spamCache.get(key);

    if (!previous) {
      this.spamCache.set(key, { body, count: 1, at: now });
      return false;
    }

    if (now - previous.at > windowMs || previous.body !== body) {
      this.spamCache.set(key, { body, count: 1, at: now });
      return false;
    }

    this.spamCache.set(key, { body, count: previous.count + 1, at: now });
    return previous.count + 1 >= maxRepeat;
  }

  async handleMessage(message) {
    if (!message?.chat || !message?.from || message.from.is_bot) {
      return;
    }

    const group = await this.ensureGroup(message.chat);
    this.recordMemberActivity(message, group);
    await this.handleMembershipEvents(message, group);

    let body = text(message.text);
    if (!body) {
      return;
    }

    const shortcutCommand = this.resolveShortcutToCommand(body);
    if (shortcutCommand) {
      body = shortcutCommand;
    }

    const commandMatch = body.match(/^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]+))?$/);
    if (!commandMatch) {
      await this.applyRealtimeGuards(message, group, body);
      await this.applyFilters(message, group, body);
      return;
    }

    const commandName = text(commandMatch[1]).toLowerCase();
    const mentionedBot = text(commandMatch[2]).toLowerCase();
    const argsRaw = text(commandMatch[3]);
    const args = argsRaw ? argsRaw.split(/\s+/).filter(Boolean) : [];

    if (mentionedBot) {
      const me = await this.telegramClient.getMe();
      const myName = text(me?.username).toLowerCase();
      if (myName && myName !== mentionedBot) {
        return;
      }
    }

    const chatId = String(message.chat.id);
    const userId = String(message.from.id);

    if (this.isPrivateChat(message.chat)) {
      const privateCtx = { chatId, userId, message, argsRaw, args, group };

      if (commandName === 'start' || commandName === 'menu') {
        await this.handleMenu(privateCtx);
        return;
      }

      if (commandName === 'help') {
        await this.handlePrivateHelp(privateCtx);
        return;
      }

      if (commandName === 'addgroup') {
        await this.handleAddGroup(privateCtx);
        return;
      }

      if (commandName === 'developer' || commandName === 'dev') {
        await this.handleDeveloper(privateCtx);
        return;
      }

      if (!PRIVATE_ALLOWED_COMMANDS.has(commandName)) {
        await this.send(chatId, 'No privado, use: /help, /addgroup ou /developer.');
        return;
      }
    }

    const command = this.commandByName.get(commandName);
    if (!command) {
      return;
    }

    if (!(await this.isEnabled(command.key))) {
      return;
    }

    const ctx = { chatId, userId, message, command, argsRaw, args, group };

    if (command.groupOnly && !this.isGroup(message.chat)) {
      await this.reply(ctx, 'Este comando so funciona em grupos.');
      return;
    }

    if (this.isGroup(message.chat) && command.feature && !this.hasPermission(group, command.feature)) {
      await this.reply(ctx, `Permissao \`${command.feature}\` desativada para este grupo no dashboard.`);
      return;
    }

    if (command.adminOnly && this.isGroup(message.chat) && !(await this.isChatAdmin(chatId, userId))) {
      await this.reply(ctx, 'Apenas administradores podem usar este comando.');
      return;
    }

    await this.runCommand(ctx);
  }

  async handleMembershipEvents(message, group) {
    if (!this.isGroup(message.chat) || !group) {
      return;
    }

    if (!this.hasPermission(group, FEATURE_PERMISSION.welcome)) {
      return;
    }

    const chatId = String(message.chat.id);
    if (!this.isAutomationModuleEnabled(chatId, 'welcome_message', true)) {
      return;
    }
    const chatLabel = text(message.chat.title || group.label || chatId);

    if (Array.isArray(message.new_chat_members) && message.new_chat_members.length) {
      const template = this.getTemplate(chatId, 'welcome_message', '?? Bem-vindo, {name}, ao grupo {group}!');
      for (const member of message.new_chat_members) {
        const name = text(member.first_name || member.username || member.id);
        const msg = this.fillTemplate(template, {
          name,
          user: member.username ? `@${member.username}` : name,
          group: chatLabel
        });
        await this.send(chatId, msg);
      }
    }

    if (message.left_chat_member) {
      const template = this.getTemplate(chatId, 'goodbye_message', '?? Ate logo, {name}.');
      const name = text(
        message.left_chat_member.first_name || message.left_chat_member.username || message.left_chat_member.id
      );
      await this.send(
        chatId,
        this.fillTemplate(template, {
          name,
          user: message.left_chat_member.username ? `@${message.left_chat_member.username}` : name,
          group: chatLabel
        })
      );
    }
  }

  async applyRealtimeGuards(message, group, body) {
    if (!this.isGroup(message.chat) || !group) {
      return;
    }

    const canUseSecurity = this.hasPermission(group, FEATURE_PERMISSION.security);
    const chatId = String(message.chat.id);
    const userId = String(message.from.id);
    const locks = this.tokenModel.getGroupLocks(chatId);
    const isAdmin = await this.isChatAdmin(chatId, userId);
    const snapshot = this.getAutomationSnapshot(chatId);
    const antiSpamEnabled = this.isAutomationModuleEnabled(chatId, 'anti_spam', true);
    const linkModerationEnabled = this.isAutomationModuleEnabled(chatId, 'link_moderation', true);

    if (
      canUseSecurity &&
      !isAdmin &&
      linkModerationEnabled &&
      locks.antilink &&
      /(https?:\/\/|www\.|t\.me\/)/i.test(body)
    ) {
      try {
        await this.telegramClient.deleteMessage(chatId, message.message_id);
      } catch (_error) {
        // ignore
      }
      await this.send(chatId, `${text(message.from.first_name)}: links bloqueados neste grupo.`);
      await this.logModerationEvent(chatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'guard.antilink',
        status: 'resolved',
        reason: 'link bloqueado',
        details: {
          message_id: message.message_id
        }
      });
      return;
    }

    if (canUseSecurity && !isAdmin && antiSpamEnabled && locks.antiflood && this.updateFlood(chatId, userId)) {
      try {
        await this.telegramClient.deleteMessage(chatId, message.message_id);
      } catch (_error) {
        // ignore
      }
      try {
        await this.telegramClient.muteUser(chatId, Number(userId), 5);
      } catch (_error) {
        // ignore
      }
      await this.send(chatId, `${text(message.from.first_name)} silenciado por flood (5 minutos).`);
      await this.logModerationEvent(chatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'guard.antiflood',
        status: 'resolved',
        reason: 'flood detectado',
        details: {
          message_id: message.message_id,
          duration_minutes: 5
        }
      });
      return;
    }

    if (canUseSecurity && !isAdmin && antiSpamEnabled && locks.antispam && this.updateSpam(chatId, userId, body.toLowerCase())) {
      try {
        await this.telegramClient.deleteMessage(chatId, message.message_id);
      } catch (_error) {
        // ignore
      }
      await this.logModerationEvent(chatId, {
        user_id: userId,
        actor_id: 'auto',
        event_type: 'guard.antispam',
        status: 'resolved',
        reason: 'spam repetido',
        details: {
          message_id: message.message_id
        }
      });
    }

    if (isAdmin || !this.hasPermission(group, FEATURE_PERMISSION.mod)) {
      return;
    }

    const username = text(message.from.username || '').toLowerCase();
    if (this.tokenModel.isUserInStrikeWhitelist(chatId, userId, username)) {
      return;
    }

    const enabledTriggers = snapshot.triggers.filter((item) => item.enabled);
    if (!enabledTriggers.length) {
      return;
    }

    let deletedForStrike = false;
    for (const trigger of enabledTriggers) {
      const reason = this.detectTriggerMatch(trigger, body);
      if (!reason) {
        continue;
      }

      if (!deletedForStrike) {
        try {
          await this.telegramClient.deleteMessage(chatId, message.message_id);
          deletedForStrike = true;
        } catch (_error) {
          // ignore
        }
      }

      await this.applyStrike(chatId, group, message.from, {
        key: trigger.key,
        reason,
        strikePoints: trigger.strike_points
      });
    }
  }

  async applyFilters(message, group, body) {
    if (!this.isGroup(message.chat) || !group || !this.hasPermission(group, FEATURE_PERMISSION.adv)) {
      return;
    }

    if (!this.isAutomationModuleEnabled(String(message.chat.id), 'auto_reply', true)) {
      return;
    }

    const filters = this.tokenModel.listChatFilters(String(message.chat.id), { enabledOnly: true });
    if (!filters.length) {
      return;
    }

    const found = filters.find((item) => body.toLowerCase().includes(String(item.keyword || '').toLowerCase()));
    if (!found) {
      return;
    }

    await this.send(String(message.chat.id), String(found.response || ''));
  }

  async runCommand(ctx) {
    switch (ctx.command.key) {
      case 'core.start':
        await this.handleMenu(ctx);
        return;
      case 'core.help':
        await this.handleHelp(ctx);
        return;
      case 'core.menu':
        await this.handleMenu(ctx);
        return;
      case 'core.settings':
        await this.handleSettings(ctx);
        return;
      case 'core.ping':
        await this.reply(ctx, `?? Pong | uptime ${Math.floor(process.uptime())}s`);
        return;
      case 'core.info':
        await this.reply(
          ctx,
          `?? Chat: ${ctx.message.chat.title || ctx.chatId} (${ctx.message.chat.type})\nUsuario: ${ctx.message.from.first_name || ''} (${ctx.userId})`
        );
        return;
      case 'alerts.alerts':
        await this.handleAlerts(ctx);
        return;
      case 'alerts.tokens':
        await this.handleTokens(ctx);
        return;
      case 'alerts.minusd':
        await this.handleMinUsd(ctx);
        return;
      case 'mod.ban':
      case 'mod.unban':
      case 'mod.kick':
      case 'mod.mute':
      case 'mod.unmute':
      case 'mod.warn':
      case 'mod.unwarn':
      case 'mod.warns':
      case 'mod.del':
      case 'mod.purge':
        await this.handleModeration(ctx);
        return;
      case 'security.antispam':
      case 'security.antilink':
      case 'security.antiflood':
      case 'security.captcha':
      case 'security.antiraid':
      case 'security.lock':
      case 'security.unlock':
      case 'security.locks':
        await this.handleSecurity(ctx);
        return;
      case 'welcome.welcome':
      case 'welcome.setwelcome':
      case 'welcome.goodbye':
      case 'welcome.setgoodbye':
      case 'welcome.rules':
      case 'welcome.setrules':
        await this.handleWelcome(ctx);
        return;
      case 'fun.dice':
      case 'fun.roll':
      case 'fun.meme':
      case 'fun.joke':
      case 'fun.ship':
      case 'fun.8ball':
      case 'fun.coinflip':
      case 'fun.raffle':
        await this.handleFun(ctx);
        return;
      case 'eco.balance':
      case 'eco.daily':
      case 'eco.work':
      case 'eco.transfer':
      case 'eco.leaderboard':
        await this.handleEconomy(ctx);
        return;
      case 'adv.addfilter':
      case 'adv.filters':
      case 'adv.delfilter':
      case 'adv.setlang':
      case 'adv.setlog':
      case 'adv.export':
      case 'adv.backup':
      case 'adv.import':
        await this.handleAdvanced(ctx);
        return;
      default:
        return;
    }
  }

  async handleHelp(ctx) {
    const cache = await this.refreshEnabledCommands();
    const enabled = cache.rows.filter((item) => item.enabled === 1 && String(item.name || '').startsWith('/'));
    const byName = new Map();
    for (const item of enabled) {
      byName.set(String(item.name || '').toLowerCase(), item);
    }

    const basic = ['/start', '/menu', '/alerts', '/tokens', '/settings', '/ping', '/sorteio']
      .map((name) => byName.get(name))
      .filter(Boolean);
    const admin = ['/warns', '/del', '/purge', '/antispam', '/antilink', '/antiflood']
      .map((name) => byName.get(name))
      .filter(Boolean);

    const lines = ['Guia rapido', ''];

    if (basic.length) {
      lines.push('Basico');
      for (const item of basic) {
        lines.push(`- ${item.name}: ${normalizeCommandDescription(item.description)}`);
      }
      lines.push('');
    }

    if (admin.length) {
      lines.push('Administracao');
      for (const item of admin) {
        lines.push(`- ${item.name}: ${normalizeCommandDescription(item.description)}`);
      }
      lines.push('');
    }

    lines.push('Dica: use /menu para abrir os atalhos principais.');
    await this.reply(ctx, lines.join('\n'));
  }

  async handleSettings(ctx) {
    const locks = this.tokenModel.getGroupLocks(ctx.chatId);
    const permissions = Array.isArray(ctx.group?.permissions) ? ctx.group.permissions.join(', ') : 'nenhuma';
    const securityCommands = this.tokenModel
      .listCommands()
      .filter((item) =>
        ['security.antispam', 'security.antilink', 'security.antiflood', 'security.captcha', 'security.antiraid'].includes(
          item.command_key
        )
      )
      .map((item) => `${String(item.command_key || '').split('.').pop()}=${item.enabled === 1 ? 'on' : 'off'}`)
      .join(', ');

    await this.reply(
      ctx,
      [
        'Configuracoes',
        `* Min USD alerta: ${this.queueService.getMinUsdAlert()}`,
        `* Permissoes: ${permissions}`,
        `* Comandos seguranca: ${securityCommands || 'n/d'}`,
        `* Locks: antispam=${locks.antispam ? 'on' : 'off'}, antilink=${locks.antilink ? 'on' : 'off'}, antiflood=${locks.antiflood ? 'on' : 'off'}, captcha=${locks.captcha ? 'on' : 'off'}, antiraid=${locks.antiraid ? 'on' : 'off'}`,
        `* Redes ativas: ${this.enabledNetworks.join(', ')}`
      ].join('\n')
    );
  }

  async handleAlerts(ctx) {
    const rows = this.tokenModel.getRecentTransactions(6);
    if (!rows.length) {
      await this.reply(ctx, 'Sem alertas registrados ainda.');
      return;
    }

    const total = rows.reduce((sum, row) => sum + Number(row.usd_value || 0), 0);
    const lines = rows.map((row) => `� ${row.network.toUpperCase()} ${shortId(row.buyer)} $${Number(row.usd_value).toFixed(2)}`);
    await this.reply(ctx, `?? Alertas recentes\nTotal: $${total.toFixed(2)}\n${lines.join('\n')}`);
  }

  async handleTokens(ctx) {
    const rows = this.tokenModel.getAllEnabledTokens();
    if (!rows.length) {
      await this.reply(ctx, 'Nenhum token ativo.');
      return;
    }

    const lines = rows.slice(0, 40).map((row) => `� [${row.network}] ${row.symbol} ${shortId(row.address)}`);
    await this.reply(ctx, `?? Tokens monitorados (${rows.length})\n${lines.join('\n')}`);
  }

  async handleMinUsd(ctx) {
    if (!ctx.args.length) {
      await this.reply(ctx, `Min USD atual: ${this.queueService.getMinUsdAlert()}`);
      return;
    }

    const value = Number(ctx.args[0]);
    if (!Number.isFinite(value) || value < 0) {
      await this.reply(ctx, 'Uso: /minusd <valor>');
      return;
    }

    this.queueService.setMinUsdAlert(value);
    this.tokenModel.setSetting('min_usd_alert', String(value));
    await this.reply(ctx, `? Min USD atualizado para ${value}.`);
  }

  async handleModeration(ctx) {
    const key = ctx.command.key;
    const target = this.resolveTarget(ctx);

    if (key !== 'mod.del' && key !== 'mod.purge' && key !== 'mod.warns' && !target) {
      await this.reply(ctx, 'Responda a mensagem do usuario alvo ou envie o ID numerico.');
      return;
    }

    if (key === 'mod.ban') {
      await this.telegramClient.banUser(ctx.chatId, Number(target.id), { revoke_messages: true });
      await this.reply(ctx, `?? Usuario banido: ${target.label}`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.ban',
        status: 'resolved',
        reason: text(ctx.args.slice(1).join(' ')) || 'ban manual'
      });
      return;
    }

    if (key === 'mod.unban') {
      await this.telegramClient.unbanUser(ctx.chatId, Number(target.id), { only_if_banned: true });
      await this.reply(ctx, `? Usuario desbanido: ${target.label}`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.unban',
        status: 'resolved',
        reason: 'desbanimento manual'
      });
      return;
    }

    if (key === 'mod.kick') {
      await this.telegramClient.kickUser(ctx.chatId, Number(target.id));
      await this.reply(ctx, `?? Usuario removido: ${target.label}`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.kick',
        status: 'resolved',
        reason: 'kick manual'
      });
      return;
    }

    if (key === 'mod.mute') {
      const minutes = Math.max(1, Math.min(Number(ctx.args[1] || ctx.args[0]) || 10, 10080));
      await this.telegramClient.muteUser(ctx.chatId, Number(target.id), minutes);
      await this.reply(ctx, `?? Usuario silenciado por ${minutes} minuto(s).`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.mute',
        status: 'resolved',
        reason: `mute manual (${minutes} min)`,
        details: {
          duration_minutes: minutes
        }
      });
      return;
    }

    if (key === 'mod.unmute') {
      await this.telegramClient.unmuteUser(ctx.chatId, Number(target.id));
      await this.reply(ctx, '?? Mute removido.');
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.unmute',
        status: 'resolved',
        reason: 'unmute manual'
      });
      return;
    }

    if (key === 'mod.warn') {
      const reasonOffset = ctx.message.reply_to_message ? 0 : 1;
      const reason = text(ctx.args.slice(reasonOffset).join(' ')) || 'Sem motivo';
      const total = this.tokenModel.addWarning({
        chatId: ctx.chatId,
        userId: target.id,
        reason,
        moderatorId: ctx.userId
      });
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.warn',
        status: 'strike',
        reason,
        details: {
          total
        }
      });
      const limit = Math.max(2, Number(process.env.WARN_AUTOMUTE_AT || 3));
      if (total >= limit) {
        try {
          await this.telegramClient.muteUser(ctx.chatId, Number(target.id), 60);
        } catch (_error) {
          // ignore
        }
        await this.reply(ctx, `?? Warn ${total}/${limit}. Usuario silenciado por 60 minutos.`);
        await this.logModerationEvent(ctx.chatId, {
          user_id: target.id,
          actor_id: ctx.userId,
          event_type: 'punishment.mute',
          status: 'resolved',
          reason: 'automute por warns',
          details: {
            total,
            duration_minutes: 60
          }
        });
      } else {
        await this.reply(ctx, `?? Warn aplicado. Total: ${total}`);
      }
      return;
    }

    if (key === 'mod.unwarn') {
      const ok = this.tokenModel.removeLatestWarning(ctx.chatId, target.id);
      if (!ok) {
        await this.reply(ctx, 'Nenhum warn para remover.');
        return;
      }
      await this.reply(ctx, `? Warn removido. Restante: ${this.tokenModel.getWarningCount(ctx.chatId, target.id)}`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: target.id,
        actor_id: ctx.userId,
        event_type: 'command.unwarn',
        status: 'resolved',
        reason: 'warn removido manualmente'
      });
      return;
    }

    if (key === 'mod.warns') {
      const warnTarget = target || {
        id: ctx.userId,
        label: text(ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name)
      };
      const count = this.tokenModel.getWarningCount(ctx.chatId, warnTarget.id);
      const details = this.tokenModel
        .listWarnings(ctx.chatId, warnTarget.id, 5)
        .map((item, index) => `${index + 1}. ${item.reason} (${item.created_at})`);
      await this.reply(ctx, `?? Warns: ${count}\n${details.join('\n') || 'sem detalhes'}`);
      await this.logModerationEvent(ctx.chatId, {
        user_id: warnTarget.id,
        actor_id: ctx.userId,
        event_type: 'command.warns',
        status: 'resolved',
        reason: 'consulta de warns'
      });
      return;
    }

    if (key === 'mod.del') {
      const targetMsg = ctx.message.reply_to_message;
      if (!targetMsg?.message_id) {
        await this.reply(ctx, 'Responda a mensagem que deseja apagar.');
        return;
      }
      try {
        await this.telegramClient.deleteMessage(ctx.chatId, targetMsg.message_id);
      } catch (_error) {
        // ignore
      }
      try {
        await this.telegramClient.deleteMessage(ctx.chatId, ctx.message.message_id);
      } catch (_error) {
        // ignore
      }
      return;
    }

    if (key === 'mod.purge') {
      const count = Math.max(1, Math.min(Number(ctx.args[0]) || 10, 100));
      const startId = Number(ctx.message.message_id);
      let deleted = 0;
      for (let id = startId; id > startId - count; id -= 1) {
        try {
          await this.telegramClient.deleteMessage(ctx.chatId, id);
          deleted += 1;
        } catch (_error) {
          // ignore
        }
      }
      await this.send(ctx.chatId, `?? Purge concluido: ${deleted}/${count} mensagens.`);
    }
  }

  async handleSecurity(ctx) {
    const key = ctx.command.key;
    const lockState = this.tokenModel.getGroupLocks(ctx.chatId);

    if (key === 'security.locks') {
      await this.reply(
        ctx,
        `?? Locks\nantispam=${lockState.antispam ? 'on' : 'off'}\nantilink=${lockState.antilink ? 'on' : 'off'}\nantiflood=${lockState.antiflood ? 'on' : 'off'}\ncaptcha=${lockState.captcha ? 'on' : 'off'}\nantiraid=${lockState.antiraid ? 'on' : 'off'}`
      );
      return;
    }

    if (key.startsWith('security.ant')) {
      const lockKey = key.split('.').pop();
      const desired = parseOnOff(ctx.args[0]);
      if (desired === null) {
        await this.reply(ctx, `Uso: /${lockKey} on|off`);
        return;
      }
      this.tokenModel.setGroupLock(ctx.chatId, lockKey, desired);
      await this.reply(ctx, `?? ${lockKey} ${desired ? 'ativado' : 'desativado'}.`);
      return;
    }

    if (key === 'security.captcha') {
      const desired = parseOnOff(ctx.args[0]);
      if (desired === null) {
        await this.reply(ctx, 'Uso: /captcha on|off');
        return;
      }
      this.tokenModel.setGroupLock(ctx.chatId, 'captcha', desired);
      await this.reply(ctx, `?? captcha ${desired ? 'ativado' : 'desativado'}.`);
      return;
    }

    if (key === 'security.lock' || key === 'security.unlock') {
      const enable = key === 'security.lock';
      const target = text(ctx.args[0]).toLowerCase();
      if (!target) {
        await this.reply(ctx, `Uso: /${enable ? 'lock' : 'unlock'} links|flood|spam|captcha|raid|all`);
        return;
      }
      if (target === 'all') {
        const patch = {};
        LOCK_KEYS.forEach((item) => {
          patch[item] = enable;
        });
        this.tokenModel.setGroupLocksBulk(ctx.chatId, patch);
        await this.reply(ctx, `?? Todos os locks ${enable ? 'ativados' : 'desativados'}.`);
        return;
      }
      const lockKey = this.resolveLock(target);
      if (!lockKey) {
        await this.reply(ctx, 'Lock invalido.');
        return;
      }
      this.tokenModel.setGroupLock(ctx.chatId, lockKey, enable);
      await this.reply(ctx, `?? ${lockKey} ${enable ? 'ativado' : 'desativado'}.`);
    }
  }

  async handleWelcome(ctx) {
    const key = ctx.command.key;
    if (key === 'welcome.welcome') {
      await this.reply(ctx, this.getTemplate(ctx.chatId, 'welcome_message', '?? Bem-vindo, {name}!'));
      return;
    }
    if (key === 'welcome.goodbye') {
      await this.reply(ctx, this.getTemplate(ctx.chatId, 'goodbye_message', '?? Ate logo, {name}.'));
      return;
    }
    if (key === 'welcome.rules') {
      await this.reply(ctx, this.getTemplate(ctx.chatId, 'rules_text', 'Sem regras configuradas.'));
      return;
    }
    if (key === 'welcome.setwelcome' || key === 'welcome.setgoodbye' || key === 'welcome.setrules') {
      const settingKey =
        key === 'welcome.setwelcome' ? 'welcome_message' : key === 'welcome.setgoodbye' ? 'goodbye_message' : 'rules_text';
      const content = text(ctx.argsRaw || ctx.message.reply_to_message?.text);
      if (!content) {
        await this.reply(ctx, `Uso: /${ctx.command.cmd} <texto>`);
        return;
      }
      this.tokenModel.setChatSetting(ctx.chatId, settingKey, content);
      await this.reply(ctx, '? Configuracao salva.');
    }
  }

  async handleFun(ctx) {
    const key = ctx.command.key;
    if (key === 'fun.dice') {
      await this.telegramClient.sendDice(ctx.chatId, '??');
      return;
    }
    if (key === 'fun.roll') {
      const max = Math.max(2, Math.min(Number(ctx.args[0]) || 100, 1000000));
      const value = Math.floor(Math.random() * max) + 1;
      await this.reply(ctx, `?? Rolagem: ${value} (1-${max})`);
      return;
    }
    if (key === 'fun.meme') {
      await this.reply(ctx, MEME_LINKS[Math.floor(Math.random() * MEME_LINKS.length)]);
      return;
    }
    if (key === 'fun.joke') {
      await this.reply(ctx, SHORT_JOKES[Math.floor(Math.random() * SHORT_JOKES.length)]);
      return;
    }
    if (key === 'fun.ship') {
      const replyName = text(ctx.message.reply_to_message?.from?.first_name);
      const other = text(ctx.argsRaw || replyName);
      if (!other) {
        await this.reply(ctx, 'Uso: /ship <nome> (ou responda a mensagem).');
        return;
      }
      const score = Math.floor(Math.random() * 101);
      await this.reply(ctx, `?? ${text(ctx.message.from.first_name || 'Voce')} x ${other} = ${score}%`);
      return;
    }
    if (key === 'fun.8ball') {
      await this.reply(ctx, `?? ${BALL_8[Math.floor(Math.random() * BALL_8.length)]}`);
      return;
    }
    if (key === 'fun.coinflip') {
      await this.reply(ctx, `?? ${COIN[Math.floor(Math.random() * COIN.length)]}`);
      return;
    }
    if (key === 'fun.raffle') {
      const winnerCount = Number.isFinite(Number(ctx.args[0])) ? Math.floor(Number(ctx.args[0])) : 1;
      const days = Number.isFinite(Number(ctx.args[1])) ? Math.floor(Number(ctx.args[1])) : 30;

      if (winnerCount < 1 || winnerCount > 10 || days < 1 || days > 90) {
        await this.reply(ctx, 'Uso: /sorteio [vencedores 1-10] [dias 1-90]');
        return;
      }

      const pool = this.tokenModel.getChatActiveMembers(ctx.chatId, {
        days,
        limit: 1000
      });

      if (!pool.length) {
        await this.reply(ctx, 'Nao ha participantes elegiveis ainda. Peca para o grupo enviar mensagens e tente novamente.');
        return;
      }

      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const amount = Math.min(winnerCount, shuffled.length);
      const winners = shuffled.slice(0, amount);
      const labels = winners.map((member, index) => {
        const username = text(member.username);
        const fullName = text([member.first_name, member.last_name].filter(Boolean).join(' '));
        const label = username ? `@${username}` : fullName || `id:${member.user_id}`;
        return `${index + 1}. ${label}`;
      });

      await this.reply(
        ctx,
        [
          `Sorteio concluido (${amount} vencedor${amount > 1 ? 'es' : ''})`,
          `Participantes elegiveis: ${pool.length} (ultimos ${days} dia${days > 1 ? 's' : ''})`,
          '',
          ...labels
        ].join('\n')
      );
    }
  }

  async handleEconomy(ctx) {
    const key = ctx.command.key;

    if (key === 'eco.balance') {
      const target = this.resolveTarget(ctx) || {
        id: ctx.userId,
        label: text(ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name)
      };
      const account = this.tokenModel.getEconomyAccount(ctx.chatId, target.id);
      await this.reply(ctx, `?? Saldo ${target.label}: ${Number(account.balance || 0).toFixed(2)} coins`);
      return;
    }

    if (key === 'eco.daily') {
      const account = this.tokenModel.getEconomyAccount(ctx.chatId, ctx.userId);
      const last = account.last_daily_at ? new Date(account.last_daily_at).getTime() : 0;
      const next = last + 24 * 60 * 60 * 1000;
      if (last && Date.now() < next) {
        const sec = Math.ceil((next - Date.now()) / 1000);
        await this.reply(ctx, `? Daily em cooldown (${Math.floor(sec / 3600)}h ${(Math.floor(sec / 60) % 60)}m).`);
        return;
      }
      const reward = 50 + Math.floor(Math.random() * 101);
      const updated = this.tokenModel.addEconomyBalance(ctx.chatId, ctx.userId, reward);
      this.tokenModel.upsertEconomyAccount({
        chat_id: ctx.chatId,
        user_id: ctx.userId,
        balance: updated.balance,
        last_daily_at: isoNow(),
        last_work_at: updated.last_work_at
      });
      await this.reply(ctx, `?? Daily: +${reward} coins. Saldo: ${Number(updated.balance).toFixed(2)}.`);
      return;
    }

    if (key === 'eco.work') {
      const account = this.tokenModel.getEconomyAccount(ctx.chatId, ctx.userId);
      const last = account.last_work_at ? new Date(account.last_work_at).getTime() : 0;
      const next = last + 60 * 60 * 1000;
      if (last && Date.now() < next) {
        const sec = Math.ceil((next - Date.now()) / 1000);
        await this.reply(ctx, `? Work em cooldown (${Math.floor(sec / 60)}m).`);
        return;
      }
      const reward = 10 + Math.floor(Math.random() * 31);
      const updated = this.tokenModel.addEconomyBalance(ctx.chatId, ctx.userId, reward);
      this.tokenModel.upsertEconomyAccount({
        chat_id: ctx.chatId,
        user_id: ctx.userId,
        balance: updated.balance,
        last_daily_at: updated.last_daily_at,
        last_work_at: isoNow()
      });
      await this.reply(ctx, `?? Work: +${reward} coins. Saldo: ${Number(updated.balance).toFixed(2)}.`);
      return;
    }

    if (key === 'eco.transfer') {
      const target = ctx.message.reply_to_message?.from
        ? {
            id: String(ctx.message.reply_to_message.from.id),
            label: text(ctx.message.reply_to_message.from.first_name || ctx.message.reply_to_message.from.id)
          }
        : null;
      if (!target) {
        await this.reply(ctx, 'Responda a mensagem do usuario para transferir.');
        return;
      }
      const amount = Number(ctx.args[0]);
      if (!Number.isFinite(amount) || amount <= 0) {
        await this.reply(ctx, 'Uso: /transfer <valor> (respondendo ao usuario).');
        return;
      }
      if (target.id === ctx.userId) {
        await this.reply(ctx, 'Nao e possivel transferir para si mesmo.');
        return;
      }
      const sender = this.tokenModel.getEconomyAccount(ctx.chatId, ctx.userId);
      if (Number(sender.balance || 0) < amount) {
        await this.reply(ctx, 'Saldo insuficiente.');
        return;
      }
      this.tokenModel.addEconomyBalance(ctx.chatId, ctx.userId, -amount);
      const receiver = this.tokenModel.addEconomyBalance(ctx.chatId, target.id, amount);
      await this.reply(ctx, `? Transferido ${amount.toFixed(2)} para ${target.label}. Saldo dele: ${Number(receiver.balance).toFixed(2)}.`);
      return;
    }

    if (key === 'eco.leaderboard') {
      const rows = this.tokenModel.listEconomyLeaderboard(ctx.chatId, 10);
      if (!rows.length) {
        await this.reply(ctx, 'Sem dados de economia.');
        return;
      }
      const lines = rows.map((item, i) => `${i + 1}. ${shortId(item.user_id)} - ${Number(item.balance).toFixed(2)}`);
      await this.reply(ctx, `?? Leaderboard\n${lines.join('\n')}`);
    }
  }

  exportPayload(ctx) {
    return {
      version: 1,
      exported_at: isoNow(),
      group: {
        chat_id: ctx.chatId,
        label: ctx.group?.label || '',
        permissions: Array.isArray(ctx.group?.permissions) ? ctx.group.permissions : DEFAULT_GROUP_PERMISSIONS
      },
      locks: this.tokenModel.getGroupLocks(ctx.chatId),
      settings: {
        welcome_message: this.tokenModel.getChatSetting(ctx.chatId, 'welcome_message'),
        goodbye_message: this.tokenModel.getChatSetting(ctx.chatId, 'goodbye_message'),
        rules_text: this.tokenModel.getChatSetting(ctx.chatId, 'rules_text'),
        lang: this.tokenModel.getChatSetting(ctx.chatId, 'lang'),
        log_channel: this.tokenModel.getChatSetting(ctx.chatId, 'log_channel')
      },
      filters: this.tokenModel.listChatFilters(ctx.chatId, { enabledOnly: false })
    };
  }

  async handleAdvanced(ctx) {
    const key = ctx.command.key;
    if (key === 'adv.addfilter') {
      const raw = text(ctx.argsRaw);
      const split = raw.indexOf('=>');
      if (split < 1) {
        await this.reply(ctx, 'Uso: /addfilter palavra => resposta');
        return;
      }
      const keyword = raw.slice(0, split).trim();
      const response = raw.slice(split + 2).trim();
      this.tokenModel.upsertChatFilter({ chatId: ctx.chatId, keyword, response, enabled: true });
      await this.reply(ctx, `? Filtro salvo para "${keyword}".`);
      return;
    }
    if (key === 'adv.filters') {
      const filters = this.tokenModel.listChatFilters(ctx.chatId, { enabledOnly: false });
      if (!filters.length) {
        await this.reply(ctx, 'Nenhum filtro cadastrado.');
        return;
      }
      const lines = filters.map((item) => `� ${item.keyword} => ${item.response}`);
      await this.reply(ctx, `?? Filtros (${filters.length})\n${lines.join('\n')}`);
      return;
    }
    if (key === 'adv.delfilter') {
      const keyword = text(ctx.argsRaw);
      if (!keyword) {
        await this.reply(ctx, 'Uso: /delfilter palavra');
        return;
      }
      const removed = this.tokenModel.deleteChatFilter(ctx.chatId, keyword);
      await this.reply(ctx, removed ? '??? Filtro removido.' : 'Filtro nao encontrado.');
      return;
    }
    if (key === 'adv.setlang') {
      const lang = text(ctx.args[0]).toLowerCase();
      if (!['pt', 'en'].includes(lang)) {
        await this.reply(ctx, 'Uso: /setlang pt|en');
        return;
      }
      this.tokenModel.setChatSetting(ctx.chatId, 'lang', lang);
      await this.reply(ctx, `?? Idioma atualizado para ${lang}.`);
      return;
    }
    if (key === 'adv.setlog') {
      const value = text(ctx.argsRaw);
      if (!value) {
        await this.reply(ctx, 'Uso: /setlog <chat_id ou descricao>');
        return;
      }
      this.tokenModel.setChatSetting(ctx.chatId, 'log_channel', value);
      await this.reply(ctx, '?? Configuracao de log salva.');
      return;
    }
    if (key === 'adv.export' || key === 'adv.backup') {
      const payload = JSON.stringify(this.exportPayload(ctx), null, 2).slice(0, 3600);
      await this.reply(ctx, `\`\`\`\n${payload}\n\`\`\``, { parse_mode: 'Markdown' });
      return;
    }
    if (key === 'adv.import') {
      const raw = text(ctx.argsRaw || ctx.message.reply_to_message?.text);
      if (!raw) {
        await this.reply(ctx, 'Uso: /import <json> (ou responda mensagem JSON).');
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_error) {
        await this.reply(ctx, 'JSON invalido.');
        return;
      }
      if (parsed.group && Array.isArray(parsed.group.permissions) && ctx.group) {
        this.tokenModel.updateGroupById(ctx.group.id, {
          ...ctx.group,
          permissions: parsed.group.permissions
        });
      }
      if (parsed.locks && typeof parsed.locks === 'object') {
        this.tokenModel.setGroupLocksBulk(ctx.chatId, parsed.locks);
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        Object.entries(parsed.settings).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') {
            this.tokenModel.setChatSetting(ctx.chatId, k, String(v));
          }
        });
      }
      if (Array.isArray(parsed.filters)) {
        parsed.filters.forEach((item) => {
          if (item?.keyword && item?.response) {
            this.tokenModel.upsertChatFilter({
              chatId: ctx.chatId,
              keyword: item.keyword,
              response: item.response,
              enabled: item.enabled !== false
            });
          }
        });
      }
      await this.reply(ctx, '? Importacao concluida.');
    }
  }
}

module.exports = CommandRouter;
