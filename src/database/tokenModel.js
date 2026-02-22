const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ALLOWED_RECURRENCE = new Set(['none', 'daily']);
const ALLOWED_SCHEDULE_STATUS = new Set(['pending', 'sent', 'disabled', 'failed']);
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
const DEFAULT_GROUP_PERMISSIONS_JSON = JSON.stringify(DEFAULT_GROUP_PERMISSIONS);
const LOCK_KEYS = ['antispam', 'antilink', 'antiflood', 'captcha', 'antiraid'];

const DEFAULT_COMMAND_ITEMS = [
  {
    category: 'Basico',
    name: '/start',
    command_key: 'core.start',
    description: 'Inicia o bot',
    aliases: 'start'
  },
  {
    category: 'Basico',
    name: '/help',
    command_key: 'core.help',
    description: 'Lista comandos disponiveis',
    aliases: 'help'
  },
  {
    category: 'Basico',
    name: '/menu',
    command_key: 'core.menu',
    description: 'Mostra menu principal',
    aliases: 'menu'
  },
  {
    category: 'Basico',
    name: '/settings',
    command_key: 'core.settings',
    description: 'Mostra configuracoes do grupo',
    aliases: 'settings'
  },
  {
    category: 'Basico',
    name: '/ping',
    command_key: 'core.ping',
    description: 'Teste de disponibilidade do bot',
    aliases: 'ping'
  },
  {
    category: 'Basico',
    name: '/info',
    command_key: 'core.info',
    description: 'Informacoes do usuario/grupo',
    aliases: 'info'
  },
  {
    category: 'Alertas',
    name: '/alerts',
    command_key: 'alerts.alerts',
    description: 'Resumo de alertas recentes',
    aliases: 'alerts'
  },
  {
    category: 'Alertas',
    name: '/tokens',
    command_key: 'alerts.tokens',
    description: 'Lista tokens monitorados',
    aliases: 'tokens'
  },
  {
    category: 'Alertas',
    name: '/minusd',
    command_key: 'alerts.minusd',
    description: 'Define filtro minimo em USD',
    aliases: 'minusd'
  },
  {
    category: 'Moderacao',
    name: '/ban',
    command_key: 'mod.ban',
    description: 'Banir usuario',
    aliases: 'ban'
  },
  {
    category: 'Moderacao',
    name: '/unban',
    command_key: 'mod.unban',
    description: 'Desbanir usuario',
    aliases: 'unban'
  },
  {
    category: 'Moderacao',
    name: '/kick',
    command_key: 'mod.kick',
    description: 'Expulsar usuario',
    aliases: 'kick'
  },
  {
    category: 'Moderacao',
    name: '/mute',
    command_key: 'mod.mute',
    description: 'Silenciar usuario',
    aliases: 'mute'
  },
  {
    category: 'Moderacao',
    name: '/unmute',
    command_key: 'mod.unmute',
    description: 'Remover mute do usuario',
    aliases: 'unmute'
  },
  {
    category: 'Moderacao',
    name: '/warn',
    command_key: 'mod.warn',
    description: 'Aplicar advertencia',
    aliases: 'warn'
  },
  {
    category: 'Moderacao',
    name: '/unwarn',
    command_key: 'mod.unwarn',
    description: 'Remover advertencia',
    aliases: 'unwarn'
  },
  {
    category: 'Moderacao',
    name: '/warns',
    command_key: 'mod.warns',
    description: 'Ver advertencias de um usuario',
    aliases: 'warns'
  },
  {
    category: 'Moderacao',
    name: '/del',
    command_key: 'mod.del',
    description: 'Apagar mensagem respondida',
    aliases: 'del'
  },
  {
    category: 'Moderacao',
    name: '/purge',
    command_key: 'mod.purge',
    description: 'Apaga varias mensagens recentes',
    aliases: 'purge'
  },
  {
    category: 'Seguranca',
    name: '/antispam',
    command_key: 'security.antispam',
    description: 'Liga/desliga anti-spam',
    aliases: 'antispam'
  },
  {
    category: 'Seguranca',
    name: '/antilink',
    command_key: 'security.antilink',
    description: 'Liga/desliga anti-link',
    aliases: 'antilink'
  },
  {
    category: 'Seguranca',
    name: '/antiflood',
    command_key: 'security.antiflood',
    description: 'Liga/desliga anti-flood',
    aliases: 'antiflood'
  },
  {
    category: 'Seguranca',
    name: '/captcha',
    command_key: 'security.captcha',
    description: 'Liga/desliga modo captcha',
    aliases: 'captcha'
  },
  {
    category: 'Seguranca',
    name: '/antiraid',
    command_key: 'security.antiraid',
    description: 'Liga/desliga anti-raid',
    aliases: 'antiraid'
  },
  {
    category: 'Seguranca',
    name: '/lock',
    command_key: 'security.lock',
    description: 'Bloqueia modulo de seguranca',
    aliases: 'lock'
  },
  {
    category: 'Seguranca',
    name: '/unlock',
    command_key: 'security.unlock',
    description: 'Desbloqueia modulo de seguranca',
    aliases: 'unlock'
  },
  {
    category: 'Seguranca',
    name: '/locks',
    command_key: 'security.locks',
    description: 'Mostra status dos locks',
    aliases: 'locks'
  },
  {
    category: 'Boas-vindas',
    name: '/welcome',
    command_key: 'welcome.welcome',
    description: 'Mostra mensagem de boas-vindas',
    aliases: 'welcome'
  },
  {
    category: 'Boas-vindas',
    name: '/setwelcome',
    command_key: 'welcome.setwelcome',
    description: 'Define mensagem de boas-vindas',
    aliases: 'setwelcome'
  },
  {
    category: 'Boas-vindas',
    name: '/goodbye',
    command_key: 'welcome.goodbye',
    description: 'Mostra mensagem de despedida',
    aliases: 'goodbye'
  },
  {
    category: 'Boas-vindas',
    name: '/setgoodbye',
    command_key: 'welcome.setgoodbye',
    description: 'Define mensagem de despedida',
    aliases: 'setgoodbye'
  },
  {
    category: 'Boas-vindas',
    name: '/rules',
    command_key: 'welcome.rules',
    description: 'Mostra regras do grupo',
    aliases: 'rules'
  },
  {
    category: 'Boas-vindas',
    name: '/setrules',
    command_key: 'welcome.setrules',
    description: 'Define regras do grupo',
    aliases: 'setrules'
  },
  {
    category: 'Diversao',
    name: '/dice',
    command_key: 'fun.dice',
    description: 'Envia dado animado',
    aliases: 'dice'
  },
  {
    category: 'Diversao',
    name: '/roll',
    command_key: 'fun.roll',
    description: 'Sorteio numerico',
    aliases: 'roll'
  },
  {
    category: 'Diversao',
    name: '/meme',
    command_key: 'fun.meme',
    description: 'Meme aleatorio',
    aliases: 'meme'
  },
  {
    category: 'Diversao',
    name: '/joke',
    command_key: 'fun.joke',
    description: 'Piada aleatoria',
    aliases: 'joke'
  },
  {
    category: 'Diversao',
    name: '/ship',
    command_key: 'fun.ship',
    description: 'Compatibilidade entre membros',
    aliases: 'ship'
  },
  {
    category: 'Diversao',
    name: '/8ball',
    command_key: 'fun.8ball',
    description: 'Resposta estilo bola 8',
    aliases: '8ball'
  },
  {
    category: 'Diversao',
    name: '/coinflip',
    command_key: 'fun.coinflip',
    description: 'Cara ou coroa',
    aliases: 'coinflip'
  },
  {
    category: 'Economia',
    name: '/balance',
    command_key: 'eco.balance',
    description: 'Saldo do usuario',
    aliases: 'balance'
  },
  {
    category: 'Economia',
    name: '/daily',
    command_key: 'eco.daily',
    description: 'Recompensa diaria',
    aliases: 'daily'
  },
  {
    category: 'Economia',
    name: '/work',
    command_key: 'eco.work',
    description: 'Trabalho com cooldown',
    aliases: 'work'
  },
  {
    category: 'Economia',
    name: '/transfer',
    command_key: 'eco.transfer',
    description: 'Transferencia entre usuarios',
    aliases: 'transfer'
  },
  {
    category: 'Economia',
    name: '/leaderboard',
    command_key: 'eco.leaderboard',
    description: 'Ranking economico',
    aliases: 'leaderboard'
  },
  {
    category: 'Avancado',
    name: '/addfilter',
    command_key: 'adv.addfilter',
    description: 'Adiciona filtro de resposta',
    aliases: 'addfilter'
  },
  {
    category: 'Avancado',
    name: '/filters',
    command_key: 'adv.filters',
    description: 'Lista filtros configurados',
    aliases: 'filters'
  },
  {
    category: 'Avancado',
    name: '/delfilter',
    command_key: 'adv.delfilter',
    description: 'Remove filtro',
    aliases: 'delfilter'
  },
  {
    category: 'Avancado',
    name: '/setlang',
    command_key: 'adv.setlang',
    description: 'Define idioma principal',
    aliases: 'setlang'
  },
  {
    category: 'Avancado',
    name: '/setlog',
    command_key: 'adv.setlog',
    description: 'Define canal de logs',
    aliases: 'setlog'
  },
  {
    category: 'Avancado',
    name: '/export',
    command_key: 'adv.export',
    description: 'Exporta configuracao do grupo',
    aliases: 'export'
  },
  {
    category: 'Avancado',
    name: '/import',
    command_key: 'adv.import',
    description: 'Importa configuracao do grupo',
    aliases: 'import'
  },
  {
    category: 'Avancado',
    name: '/backup',
    command_key: 'adv.backup',
    description: 'Backup rapido da configuracao',
    aliases: 'backup'
  }
];

class TokenModel {
  constructor({ dbPath, logger }) {
    this.dbPath = dbPath;
    this.logger = logger;
    this.db = null;
    this.statements = {};
  }

  init() {
    const dbDir = path.dirname(this.dbPath);
    fs.mkdirSync(dbDir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        address TEXT NOT NULL,
        network TEXT NOT NULL,
        pair_address TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(address, network)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        network TEXT NOT NULL,
        hash TEXT NOT NULL,
        buyer TEXT NOT NULL,
        amount REAL NOT NULL,
        usd_value REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(token, hash)
      );

      CREATE TABLE IF NOT EXISTS member_activity (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        message_count INTEGER NOT NULL DEFAULT 0,
        reactions_count INTEGER NOT NULL DEFAULT 0,
        volume_usd REAL NOT NULL DEFAULT 0,
        last_seen TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(chat_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT '${DEFAULT_GROUP_PERMISSIONS_JSON}',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_locks (
        chat_id TEXT PRIMARY KEY,
        antispam INTEGER NOT NULL DEFAULT 0,
        antilink INTEGER NOT NULL DEFAULT 0,
        antiflood INTEGER NOT NULL DEFAULT 0,
        captcha INTEGER NOT NULL DEFAULT 0,
        antiraid INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS moderation_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        moderator_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        response TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(chat_id, keyword)
      );

      CREATE TABLE IF NOT EXISTS economy_accounts (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        last_daily_at TEXT,
        last_work_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(chat_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS command_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        command_key TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        aliases TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        group_ids TEXT NOT NULL,
        send_at TEXT NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'none',
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_network ON tokens(network);
      CREATE INDEX IF NOT EXISTS idx_tokens_enabled ON tokens(enabled);
      CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_network_ts ON transactions(network, timestamp);
      CREATE INDEX IF NOT EXISTS idx_member_activity_seen ON member_activity(last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_member_activity_chat ON member_activity(chat_id, last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_groups_enabled ON groups(enabled);
      CREATE INDEX IF NOT EXISTS idx_warn_chat_user ON moderation_warnings(chat_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_filters_chat ON chat_filters(chat_id, enabled);
      CREATE INDEX IF NOT EXISTS idx_economy_chat_balance ON economy_accounts(chat_id, balance DESC);
      CREATE INDEX IF NOT EXISTS idx_commands_category ON command_items(category);
      CREATE INDEX IF NOT EXISTS idx_commands_enabled ON command_items(enabled);
      CREATE INDEX IF NOT EXISTS idx_schedules_status_sendat ON schedules(status, send_at);
    `);

    this.runMigrations();
    this.prepareStatements();
    this.seedDefaultCommands();
    this.logger.info({ dbPath: this.dbPath }, 'database initialized');
  }

  runMigrations() {
    const groupColumns = this.db.prepare('PRAGMA table_info(groups)').all();
    const hasPermissions = groupColumns.some((column) => column.name === 'permissions');

    if (!hasPermissions) {
      this.db.exec(`ALTER TABLE groups ADD COLUMN permissions TEXT NOT NULL DEFAULT '${DEFAULT_GROUP_PERMISSIONS_JSON}'`);
      this.logger.info('database migration applied: groups.permissions');
    }

    this.db.exec(
      `UPDATE groups SET permissions = '${DEFAULT_GROUP_PERMISSIONS_JSON}' WHERE permissions IS NULL OR TRIM(permissions) = ''`
    );

    const rows = this.db.prepare('SELECT id, permissions FROM groups').all();
    const updatePermissions = this.db.prepare('UPDATE groups SET permissions = ? WHERE id = ?');

    const tx = this.db.transaction((items) => {
      items.forEach((row) => {
        const normalized = this.normalizeGroupPermissions(row.permissions);
        updatePermissions.run(JSON.stringify(normalized), Number(row.id));
      });
    });

    tx(rows);

    const scheduleColumns = this.db.prepare('PRAGMA table_info(schedules)').all();
    const hasScheduleMediaUrl = scheduleColumns.some((column) => column.name === 'media_url');
    if (!hasScheduleMediaUrl) {
      this.db.exec(`ALTER TABLE schedules ADD COLUMN media_url TEXT`);
      this.logger.info('database migration applied: schedules.media_url');
    }
  }

  prepareStatements() {
    this.statements.upsertToken = this.db.prepare(`
      INSERT INTO tokens (name, symbol, address, network, pair_address, decimals, enabled, updated_at)
      VALUES (@name, @symbol, @address, @network, @pair_address, @decimals, @enabled, @updated_at)
      ON CONFLICT(address, network)
      DO UPDATE SET
        name = excluded.name,
        symbol = excluded.symbol,
        pair_address = excluded.pair_address,
        decimals = excluded.decimals,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.selectTokensByNetworkEnabled = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE network = ? AND enabled = 1
      ORDER BY symbol ASC
    `);

    this.statements.selectTokensByNetworkAll = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE network = ?
      ORDER BY symbol ASC
    `);

    this.statements.selectAllTokensEnabled = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE enabled = 1
      ORDER BY network ASC, symbol ASC
    `);

    this.statements.selectAllTokens = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, decimals, enabled, created_at, updated_at
      FROM tokens
      ORDER BY network ASC, symbol ASC
    `);

    this.statements.selectTokenById = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.updateTokenById = this.db.prepare(`
      UPDATE tokens
      SET
        name = @name,
        symbol = @symbol,
        address = @address,
        network = @network,
        pair_address = @pair_address,
        decimals = @decimals,
        enabled = @enabled,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.setTokenEnabled = this.db.prepare(`
      UPDATE tokens
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.deleteTokenById = this.db.prepare(`
      DELETE FROM tokens WHERE id = ?
    `);

    this.statements.hasTransaction = this.db.prepare(`
      SELECT 1 FROM transactions WHERE token = ? AND hash = ? LIMIT 1
    `);

    this.statements.insertTransaction = this.db.prepare(`
      INSERT INTO transactions (token, network, hash, buyer, amount, usd_value, timestamp)
      VALUES (@token, @network, @hash, @buyer, @amount, @usd_value, @timestamp)
    `);

    this.statements.selectRecentTransactions = this.db.prepare(`
      SELECT id, token, network, hash, buyer, amount, usd_value, timestamp, created_at
      FROM transactions
      ORDER BY datetime(timestamp) DESC
      LIMIT ?
    `);

    this.statements.selectTopMembersByCutoff = this.db.prepare(`
      SELECT
        buyer,
        COUNT(*) AS message_count,
        SUM(usd_value) AS volume_usd,
        SUM(CASE WHEN usd_value >= 25000 THEN 1 ELSE 0 END) AS reactions_count,
        MAX(timestamp) AS last_seen
      FROM transactions
      WHERE datetime(timestamp) >= datetime(?)
      GROUP BY buyer
      ORDER BY message_count DESC, volume_usd DESC
      LIMIT ?
    `);

    this.statements.upsertMemberActivity = this.db.prepare(`
      INSERT INTO member_activity (
        chat_id,
        user_id,
        username,
        first_name,
        last_name,
        message_count,
        reactions_count,
        volume_usd,
        last_seen,
        updated_at
      )
      VALUES (
        @chat_id,
        @user_id,
        @username,
        @first_name,
        @last_name,
        1,
        @reactions_count,
        @volume_usd,
        @last_seen,
        @updated_at
      )
      ON CONFLICT(chat_id, user_id)
      DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        message_count = member_activity.message_count + 1,
        reactions_count = member_activity.reactions_count + excluded.reactions_count,
        volume_usd = member_activity.volume_usd + excluded.volume_usd,
        last_seen = excluded.last_seen,
        updated_at = excluded.updated_at
    `);

    this.statements.selectTopChatMembersByCutoff = this.db.prepare(`
      SELECT
        ma.chat_id,
        ma.user_id,
        ma.username,
        ma.first_name,
        ma.last_name,
        ma.message_count,
        ma.reactions_count,
        ma.volume_usd,
        ma.last_seen,
        COALESCE(g.label, ma.chat_id) AS group_label
      FROM member_activity ma
      LEFT JOIN groups g
        ON g.chat_id = ma.chat_id
      WHERE datetime(ma.last_seen) >= datetime(?)
        AND (g.id IS NULL OR g.enabled = 1)
      ORDER BY ma.message_count DESC, ma.last_seen DESC
      LIMIT ?
    `);

    this.statements.upsertGroup = this.db.prepare(`
      INSERT INTO groups (chat_id, label, permissions, enabled, updated_at)
      VALUES (@chat_id, @label, @permissions, @enabled, @updated_at)
      ON CONFLICT(chat_id)
      DO UPDATE SET
        label = excluded.label,
        permissions = excluded.permissions,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.selectGroupsEnabled = this.db.prepare(`
      SELECT id, chat_id, label, permissions, enabled, created_at, updated_at
      FROM groups
      WHERE enabled = 1
      ORDER BY id DESC
    `);

    this.statements.selectAllGroups = this.db.prepare(`
      SELECT id, chat_id, label, permissions, enabled, created_at, updated_at
      FROM groups
      ORDER BY id DESC
    `);

    this.statements.selectGroupById = this.db.prepare(`
      SELECT id, chat_id, label, permissions, enabled, created_at, updated_at
      FROM groups
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.selectGroupByChatId = this.db.prepare(`
      SELECT id, chat_id, label, permissions, enabled, created_at, updated_at
      FROM groups
      WHERE chat_id = ?
      LIMIT 1
    `);

    this.statements.updateGroupById = this.db.prepare(`
      UPDATE groups
      SET chat_id = @chat_id, label = @label, permissions = @permissions, enabled = @enabled, updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.setGroupEnabled = this.db.prepare(`
      UPDATE groups
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.deleteGroupById = this.db.prepare(`
      DELETE FROM groups WHERE id = ?
    `);

    this.statements.selectActiveGroupChatIds = this.db.prepare(`
      SELECT chat_id, permissions FROM groups WHERE enabled = 1 ORDER BY id ASC
    `);

    this.statements.countGroups = this.db.prepare(`
      SELECT COUNT(*) as total FROM groups
    `);

    this.statements.ensureGroupLock = this.db.prepare(`
      INSERT INTO group_locks (chat_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(chat_id) DO NOTHING
    `);

    this.statements.selectGroupLockByChatId = this.db.prepare(`
      SELECT chat_id, antispam, antilink, antiflood, captcha, antiraid, updated_at
      FROM group_locks
      WHERE chat_id = ?
      LIMIT 1
    `);

    this.statements.setGroupLockAntispam = this.db.prepare(`
      UPDATE group_locks
      SET antispam = ?, updated_at = ?
      WHERE chat_id = ?
    `);

    this.statements.setGroupLockAntilink = this.db.prepare(`
      UPDATE group_locks
      SET antilink = ?, updated_at = ?
      WHERE chat_id = ?
    `);

    this.statements.setGroupLockAntiflood = this.db.prepare(`
      UPDATE group_locks
      SET antiflood = ?, updated_at = ?
      WHERE chat_id = ?
    `);

    this.statements.setGroupLockCaptcha = this.db.prepare(`
      UPDATE group_locks
      SET captcha = ?, updated_at = ?
      WHERE chat_id = ?
    `);

    this.statements.setGroupLockAntiraid = this.db.prepare(`
      UPDATE group_locks
      SET antiraid = ?, updated_at = ?
      WHERE chat_id = ?
    `);

    this.statements.insertWarning = this.db.prepare(`
      INSERT INTO moderation_warnings (chat_id, user_id, reason, moderator_id, created_at)
      VALUES (@chat_id, @user_id, @reason, @moderator_id, @created_at)
    `);

    this.statements.selectWarningCountByUser = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM moderation_warnings
      WHERE chat_id = ? AND user_id = ?
    `);

    this.statements.selectWarningsByUser = this.db.prepare(`
      SELECT id, chat_id, user_id, reason, moderator_id, created_at
      FROM moderation_warnings
      WHERE chat_id = ? AND user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.deleteLatestWarningByUser = this.db.prepare(`
      DELETE FROM moderation_warnings
      WHERE id = (
        SELECT id
        FROM moderation_warnings
        WHERE chat_id = ? AND user_id = ?
        ORDER BY id DESC
        LIMIT 1
      )
    `);

    this.statements.deleteWarningsByUser = this.db.prepare(`
      DELETE FROM moderation_warnings
      WHERE chat_id = ? AND user_id = ?
    `);

    this.statements.upsertChatFilter = this.db.prepare(`
      INSERT INTO chat_filters (chat_id, keyword, response, enabled, updated_at)
      VALUES (@chat_id, @keyword, @response, @enabled, @updated_at)
      ON CONFLICT(chat_id, keyword)
      DO UPDATE SET
        response = excluded.response,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.selectChatFiltersByChat = this.db.prepare(`
      SELECT id, chat_id, keyword, response, enabled, created_at, updated_at
      FROM chat_filters
      WHERE chat_id = ?
      ORDER BY keyword ASC
    `);

    this.statements.selectEnabledChatFiltersByChat = this.db.prepare(`
      SELECT id, chat_id, keyword, response, enabled, created_at, updated_at
      FROM chat_filters
      WHERE chat_id = ? AND enabled = 1
      ORDER BY keyword ASC
    `);

    this.statements.deleteChatFilter = this.db.prepare(`
      DELETE FROM chat_filters
      WHERE chat_id = ? AND keyword = ?
    `);

    this.statements.selectEconomyAccount = this.db.prepare(`
      SELECT chat_id, user_id, balance, last_daily_at, last_work_at, updated_at
      FROM economy_accounts
      WHERE chat_id = ? AND user_id = ?
      LIMIT 1
    `);

    this.statements.upsertEconomyAccount = this.db.prepare(`
      INSERT INTO economy_accounts (chat_id, user_id, balance, last_daily_at, last_work_at, updated_at)
      VALUES (@chat_id, @user_id, @balance, @last_daily_at, @last_work_at, @updated_at)
      ON CONFLICT(chat_id, user_id)
      DO UPDATE SET
        balance = excluded.balance,
        last_daily_at = excluded.last_daily_at,
        last_work_at = excluded.last_work_at,
        updated_at = excluded.updated_at
    `);

    this.statements.selectEconomyLeaderboard = this.db.prepare(`
      SELECT chat_id, user_id, balance, last_daily_at, last_work_at, updated_at
      FROM economy_accounts
      WHERE chat_id = ?
      ORDER BY balance DESC, updated_at ASC
      LIMIT ?
    `);

    this.statements.upsertSetting = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    this.statements.selectSetting = this.db.prepare(`
      SELECT value FROM settings WHERE key = ? LIMIT 1
    `);

    this.statements.selectAllSettings = this.db.prepare(`
      SELECT key, value, updated_at FROM settings ORDER BY key ASC
    `);

    this.statements.countCommandItems = this.db.prepare(`
      SELECT COUNT(*) AS total FROM command_items
    `);

    this.statements.insertCommandItem = this.db.prepare(`
      INSERT INTO command_items (category, name, command_key, description, aliases, enabled, updated_at)
      VALUES (@category, @name, @command_key, @description, @aliases, @enabled, @updated_at)
    `);

    this.statements.upsertCommandCatalog = this.db.prepare(`
      INSERT INTO command_items (category, name, command_key, description, aliases, enabled, updated_at)
      VALUES (@category, @name, @command_key, @description, @aliases, @enabled, @updated_at)
      ON CONFLICT(command_key)
      DO UPDATE SET
        category = excluded.category,
        name = excluded.name,
        description = excluded.description,
        aliases = excluded.aliases,
        updated_at = excluded.updated_at
    `);

    this.statements.selectCommands = this.db.prepare(`
      SELECT id, category, name, command_key, description, aliases, enabled, created_at, updated_at
      FROM command_items
      ORDER BY category ASC, name ASC
    `);

    this.statements.selectCommandById = this.db.prepare(`
      SELECT id, category, name, command_key, description, aliases, enabled, created_at, updated_at
      FROM command_items
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.selectCommandByKey = this.db.prepare(`
      SELECT id, category, name, command_key, description, aliases, enabled, created_at, updated_at
      FROM command_items
      WHERE command_key = ?
      LIMIT 1
    `);

    this.statements.setCommandEnabled = this.db.prepare(`
      UPDATE command_items
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.setCommandCategoryEnabled = this.db.prepare(`
      UPDATE command_items
      SET enabled = ?, updated_at = ?
      WHERE category = ?
    `);

    this.statements.setAllCommandsEnabled = this.db.prepare(`
      UPDATE command_items
      SET enabled = ?, updated_at = ?
    `);

    this.statements.selectCommandCategorySummary = this.db.prepare(`
      SELECT
        category,
        COUNT(*) AS total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active
      FROM command_items
      GROUP BY category
      ORDER BY category ASC
    `);

    this.statements.insertSchedule = this.db.prepare(`
      INSERT INTO schedules (kind, content, media_url, group_ids, send_at, recurrence, status, last_error, updated_at)
      VALUES (@kind, @content, @media_url, @group_ids, @send_at, @recurrence, @status, @last_error, @updated_at)
    `);

    this.statements.selectSchedules = this.db.prepare(`
      SELECT id, kind, content, media_url, group_ids, send_at, recurrence, status, last_error, created_at, updated_at
      FROM schedules
      ORDER BY datetime(send_at) DESC
      LIMIT ?
    `);

    this.statements.selectScheduleById = this.db.prepare(`
      SELECT id, kind, content, media_url, group_ids, send_at, recurrence, status, last_error, created_at, updated_at
      FROM schedules
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.updateScheduleById = this.db.prepare(`
      UPDATE schedules
      SET
        kind = @kind,
        content = @content,
        media_url = @media_url,
        group_ids = @group_ids,
        send_at = @send_at,
        recurrence = @recurrence,
        status = @status,
        last_error = @last_error,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.setScheduleStatus = this.db.prepare(`
      UPDATE schedules
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.setScheduleFailed = this.db.prepare(`
      UPDATE schedules
      SET status = 'failed', last_error = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.setScheduleSent = this.db.prepare(`
      UPDATE schedules
      SET status = 'sent', last_error = NULL, updated_at = ?
      WHERE id = ?
    `);

    this.statements.setScheduleRecurringNext = this.db.prepare(`
      UPDATE schedules
      SET send_at = ?, status = 'pending', last_error = NULL, updated_at = ?
      WHERE id = ?
    `);

    this.statements.selectDueSchedules = this.db.prepare(`
      SELECT id, kind, content, media_url, group_ids, send_at, recurrence, status, last_error, created_at, updated_at
      FROM schedules
      WHERE status = 'pending' AND datetime(send_at) <= datetime(?)
      ORDER BY datetime(send_at) ASC
      LIMIT ?
    `);

    this.statements.deleteScheduleById = this.db.prepare(`
      DELETE FROM schedules WHERE id = ?
    `);
  }

  seedDefaultCommands() {
    const now = new Date().toISOString();
    const upsertMany = this.db.transaction((items) => {
      items.forEach((item) => {
        this.statements.upsertCommandCatalog.run({
          category: item.category,
          name: item.name,
          command_key: item.command_key,
          description: item.description,
          aliases: item.aliases,
          enabled: 1,
          updated_at: now
        });
      });
    });

    upsertMany(DEFAULT_COMMAND_ITEMS);

    const row = this.statements.countCommandItems.get();
    this.logger.info(
      {
        catalogSize: DEFAULT_COMMAND_ITEMS.length,
        dbTotal: Number(row?.total || 0)
      },
      'command catalog synchronized'
    );
  }

  normalizeAddress(network, address) {
    if (!address) {
      return '';
    }

    const normalized = String(address).trim();
    if (network === 'solana') {
      return normalized;
    }

    return normalized.toLowerCase();
  }

  normalizeTokenPayload(token) {
    const network = String(token.network || '').trim().toLowerCase();

    const payload = {
      name: String(token.name || '').trim(),
      symbol: String(token.symbol || '').trim().toUpperCase(),
      address: this.normalizeAddress(network, token.address),
      network,
      pair_address: this.normalizeAddress(network, token.pair_address),
      decimals: Number(token.decimals),
      enabled: token.enabled === 0 ? 0 : 1,
      updated_at: new Date().toISOString()
    };

    if (!payload.name || !payload.symbol || !payload.address || !payload.network || !payload.pair_address) {
      throw new Error('missing required token fields');
    }

    if (!Number.isInteger(payload.decimals) || payload.decimals < 0) {
      throw new Error('invalid token decimals');
    }

    return payload;
  }

  upsertToken(token) {
    const payload = this.normalizeTokenPayload(token);
    this.statements.upsertToken.run(payload);
    return payload;
  }

  updateTokenById(id, token) {
    const payload = this.normalizeTokenPayload(token);
    const result = this.statements.updateTokenById.run({
      ...payload,
      id: Number(id)
    });

    return result.changes > 0;
  }

  getTokenById(id) {
    return this.statements.selectTokenById.get(Number(id)) || null;
  }

  listTokens({ network, includeDisabled = true } = {}) {
    if (network) {
      if (includeDisabled) {
        return this.statements.selectTokensByNetworkAll.all(String(network).toLowerCase());
      }
      return this.statements.selectTokensByNetworkEnabled.all(String(network).toLowerCase());
    }

    if (includeDisabled) {
      return this.statements.selectAllTokens.all();
    }

    return this.statements.selectAllTokensEnabled.all();
  }

  getTokensByNetwork(network) {
    return this.listTokens({ network, includeDisabled: false });
  }

  getAllEnabledTokens() {
    return this.listTokens({ includeDisabled: false });
  }

  setTokenEnabled(id, enabled) {
    const result = this.statements.setTokenEnabled.run(enabled ? 1 : 0, new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  deleteTokenById(id) {
    const result = this.statements.deleteTokenById.run(Number(id));
    return result.changes > 0;
  }

  hasTransaction(token, hash) {
    const row = this.statements.hasTransaction.get(String(token), String(hash));
    return Boolean(row);
  }

  saveTransaction(transaction) {
    const payload = {
      token: String(transaction.token),
      network: String(transaction.network),
      hash: String(transaction.hash),
      buyer: String(transaction.buyer),
      amount: Number(transaction.amount),
      usd_value: Number(transaction.usd_value),
      timestamp: transaction.timestamp || new Date().toISOString()
    };

    if (!Number.isFinite(payload.amount) || !Number.isFinite(payload.usd_value)) {
      throw new Error('invalid numeric values in transaction');
    }

    try {
      this.statements.insertTransaction.run(payload);
      return true;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return false;
      }
      throw error;
    }
  }

  getRecentTransactions(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    return this.statements.selectRecentTransactions.all(safeLimit);
  }

  getTopMembers({ days = 30, limit = 200 } = {}) {
    const safeDays = Math.max(1, Math.min(Number(days) || 30, 365));
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

    return this.statements.selectTopMembersByCutoff.all(cutoff, safeLimit);
  }

  trackMemberActivity({
    chat_id,
    user_id,
    username = '',
    first_name = '',
    last_name = '',
    reactions_count = 0,
    volume_usd = 0,
    seen_at
  }) {
    const payload = {
      chat_id: String(chat_id || '').trim(),
      user_id: String(user_id || '').trim(),
      username: String(username || '').trim(),
      first_name: String(first_name || '').trim(),
      last_name: String(last_name || '').trim(),
      reactions_count: Math.max(0, Number(reactions_count) || 0),
      volume_usd: Math.max(0, Number(volume_usd) || 0),
      last_seen: seen_at ? new Date(seen_at).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!payload.chat_id || !payload.user_id) {
      return null;
    }

    this.statements.upsertMemberActivity.run(payload);
    return payload;
  }

  getTopActiveMembers({ days = 30, limit = 200 } = {}) {
    const safeDays = Math.max(1, Math.min(Number(days) || 30, 365));
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    return this.statements.selectTopChatMembersByCutoff.all(cutoff, safeLimit);
  }

  normalizeGroupPayload(group) {
    const permissions = this.normalizeGroupPermissions(group.permissions || group.permission || group.permissionsCsv);

    const payload = {
      chat_id: String(group.chat_id || '').trim(),
      label: String(group.label || '').trim() || 'Default Group',
      permissions: JSON.stringify(permissions),
      enabled: group.enabled === 0 ? 0 : 1,
      updated_at: new Date().toISOString()
    };

    if (!payload.chat_id) {
      throw new Error('group chat_id is required');
    }

    return payload;
  }

  normalizeGroupPermissions(value) {
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
          return this.normalizeGroupPermissions(JSON.parse(trimmed));
        } catch (_error) {
          this.logger.warn({ permissions: trimmed }, 'invalid group permissions json; fallback to csv parse');
        }
      }

      const fromCsv = trimmed
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      return this.normalizeGroupPermissions(fromCsv);
    }

    return [...DEFAULT_GROUP_PERMISSIONS];
  }

  normalizeGroupRow(row) {
    if (!row) {
      return null;
    }

    return {
      ...row,
      permissions: this.normalizeGroupPermissions(row.permissions)
    };
  }

  upsertGroup(group) {
    const payload = this.normalizeGroupPayload(group);
    this.statements.upsertGroup.run(payload);
    return payload;
  }

  updateGroupById(id, group) {
    const payload = this.normalizeGroupPayload(group);
    const result = this.statements.updateGroupById.run({
      ...payload,
      id: Number(id)
    });

    return result.changes > 0;
  }

  getGroupById(id) {
    return this.normalizeGroupRow(this.statements.selectGroupById.get(Number(id)) || null);
  }

  getGroupByChatId(chatId) {
    return this.normalizeGroupRow(this.statements.selectGroupByChatId.get(String(chatId)) || null);
  }

  listGroups({ includeDisabled = true } = {}) {
    if (includeDisabled) {
      return this.statements.selectAllGroups.all().map((row) => this.normalizeGroupRow(row));
    }
    return this.statements.selectGroupsEnabled.all().map((row) => this.normalizeGroupRow(row));
  }

  setGroupEnabled(id, enabled) {
    const result = this.statements.setGroupEnabled.run(enabled ? 1 : 0, new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  deleteGroupById(id) {
    const result = this.statements.deleteGroupById.run(Number(id));
    return result.changes > 0;
  }

  getActiveGroupChatIds(permission = 'buy_alerts') {
    const targetPermission = String(permission || '').trim().toLowerCase();
    const rows = this.statements.selectActiveGroupChatIds.all();

    return rows
      .filter((row) => {
        if (!targetPermission) {
          return true;
        }

        const permissions = this.normalizeGroupPermissions(row.permissions);
        return permissions.includes(targetPermission);
      })
      .map((row) => row.chat_id);
  }

  countGroups() {
    const row = this.statements.countGroups.get();
    return Number(row?.total || 0);
  }

  normalizeGroupLocksRow(row, chatId = '') {
    const source = row || {};
    return {
      chat_id: String(source.chat_id || chatId || ''),
      antispam: source.antispam === 1,
      antilink: source.antilink === 1,
      antiflood: source.antiflood === 1,
      captcha: source.captcha === 1,
      antiraid: source.antiraid === 1,
      updated_at: source.updated_at || null
    };
  }

  ensureGroupLocks(chatId) {
    const now = new Date().toISOString();
    this.statements.ensureGroupLock.run(String(chatId), now);
    const row = this.statements.selectGroupLockByChatId.get(String(chatId)) || null;
    return this.normalizeGroupLocksRow(row, chatId);
  }

  getGroupLocks(chatId) {
    const row = this.statements.selectGroupLockByChatId.get(String(chatId)) || null;
    if (!row) {
      return this.ensureGroupLocks(chatId);
    }
    return this.normalizeGroupLocksRow(row, chatId);
  }

  setGroupLock(chatId, lockKey, enabled) {
    const key = String(lockKey || '').trim().toLowerCase();
    if (!LOCK_KEYS.includes(key)) {
      throw new Error('invalid lock key');
    }

    this.ensureGroupLocks(chatId);
    const now = new Date().toISOString();
    const value = enabled ? 1 : 0;

    if (key === 'antispam') {
      this.statements.setGroupLockAntispam.run(value, now, String(chatId));
    } else if (key === 'antilink') {
      this.statements.setGroupLockAntilink.run(value, now, String(chatId));
    } else if (key === 'antiflood') {
      this.statements.setGroupLockAntiflood.run(value, now, String(chatId));
    } else if (key === 'captcha') {
      this.statements.setGroupLockCaptcha.run(value, now, String(chatId));
    } else if (key === 'antiraid') {
      this.statements.setGroupLockAntiraid.run(value, now, String(chatId));
    }

    return this.getGroupLocks(chatId);
  }

  setGroupLocksBulk(chatId, changes = {}) {
    let current = this.getGroupLocks(chatId);
    for (const key of LOCK_KEYS) {
      if (changes[key] === undefined) {
        continue;
      }
      current = this.setGroupLock(chatId, key, Boolean(changes[key]));
    }
    return current;
  }

  addWarning({ chatId, userId, reason = '', moderatorId = '' }) {
    const payload = {
      chat_id: String(chatId),
      user_id: String(userId),
      reason: String(reason || '').trim() || 'Sem motivo',
      moderator_id: moderatorId ? String(moderatorId) : null,
      created_at: new Date().toISOString()
    };

    this.statements.insertWarning.run(payload);
    return this.getWarningCount(payload.chat_id, payload.user_id);
  }

  getWarningCount(chatId, userId) {
    const row = this.statements.selectWarningCountByUser.get(String(chatId), String(userId));
    return Number(row?.total || 0);
  }

  listWarnings(chatId, userId, limit = 5) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 100));
    return this.statements.selectWarningsByUser.all(String(chatId), String(userId), safeLimit);
  }

  removeLatestWarning(chatId, userId) {
    const result = this.statements.deleteLatestWarningByUser.run(String(chatId), String(userId));
    return result.changes > 0;
  }

  clearWarnings(chatId, userId) {
    const result = this.statements.deleteWarningsByUser.run(String(chatId), String(userId));
    return result.changes > 0;
  }

  normalizeFilterKeyword(keyword) {
    return String(keyword || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  upsertChatFilter({ chatId, keyword, response, enabled = true }) {
    const normalizedKeyword = this.normalizeFilterKeyword(keyword);
    const normalizedResponse = String(response || '').trim();

    if (!normalizedKeyword) {
      throw new Error('filter keyword is required');
    }
    if (!normalizedResponse) {
      throw new Error('filter response is required');
    }

    const payload = {
      chat_id: String(chatId),
      keyword: normalizedKeyword,
      response: normalizedResponse,
      enabled: enabled ? 1 : 0,
      updated_at: new Date().toISOString()
    };

    this.statements.upsertChatFilter.run(payload);
    return payload;
  }

  deleteChatFilter(chatId, keyword) {
    const normalizedKeyword = this.normalizeFilterKeyword(keyword);
    const result = this.statements.deleteChatFilter.run(String(chatId), normalizedKeyword);
    return result.changes > 0;
  }

  listChatFilters(chatId, { enabledOnly = false } = {}) {
    const safeChatId = String(chatId);
    const rows = enabledOnly
      ? this.statements.selectEnabledChatFiltersByChat.all(safeChatId)
      : this.statements.selectChatFiltersByChat.all(safeChatId);

    return rows.map((row) => ({
      ...row,
      enabled: row.enabled === 1
    }));
  }

  getEconomyAccount(chatId, userId) {
    const row = this.statements.selectEconomyAccount.get(String(chatId), String(userId));
    if (row) {
      return row;
    }

    return {
      chat_id: String(chatId),
      user_id: String(userId),
      balance: 0,
      last_daily_at: null,
      last_work_at: null,
      updated_at: null
    };
  }

  upsertEconomyAccount({ chat_id, user_id, balance, last_daily_at = null, last_work_at = null }) {
    const payload = {
      chat_id: String(chat_id),
      user_id: String(user_id),
      balance: Number(balance) || 0,
      last_daily_at: last_daily_at ? String(last_daily_at) : null,
      last_work_at: last_work_at ? String(last_work_at) : null,
      updated_at: new Date().toISOString()
    };

    this.statements.upsertEconomyAccount.run(payload);
    return this.getEconomyAccount(payload.chat_id, payload.user_id);
  }

  addEconomyBalance(chatId, userId, delta) {
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta)) {
      throw new Error('invalid economy delta');
    }

    const current = this.getEconomyAccount(chatId, userId);
    const nextBalance = Math.max(0, Number(current.balance || 0) + numericDelta);

    return this.upsertEconomyAccount({
      chat_id: String(chatId),
      user_id: String(userId),
      balance: nextBalance,
      last_daily_at: current.last_daily_at,
      last_work_at: current.last_work_at
    });
  }

  listEconomyLeaderboard(chatId, limit = 10) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
    return this.statements.selectEconomyLeaderboard.all(String(chatId), safeLimit);
  }

  makeChatSettingKey(chatId, key) {
    return `chat:${String(chatId)}:${String(key)}`;
  }

  setChatSetting(chatId, key, value) {
    return this.setSetting(this.makeChatSettingKey(chatId, key), value);
  }

  getChatSetting(chatId, key) {
    return this.getSetting(this.makeChatSettingKey(chatId, key));
  }

  setSetting(key, value) {
    const payload = {
      key: String(key),
      value: String(value),
      updated_at: new Date().toISOString()
    };

    this.statements.upsertSetting.run(payload);
    return payload;
  }

  getSetting(key) {
    const row = this.statements.selectSetting.get(String(key));
    return row ? row.value : null;
  }

  getAllSettings() {
    const rows = this.statements.selectAllSettings.all();
    const out = {};

    for (const row of rows) {
      out[row.key] = row.value;
    }

    return out;
  }

  listCommands() {
    return this.statements.selectCommands.all();
  }

  getCommandById(id) {
    return this.statements.selectCommandById.get(Number(id)) || null;
  }

  getCommandByKey(commandKey) {
    return this.statements.selectCommandByKey.get(String(commandKey)) || null;
  }

  setCommandEnabled(id, enabled) {
    const result = this.statements.setCommandEnabled.run(enabled ? 1 : 0, new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  setCommandCategoryEnabled(category, enabled) {
    const result = this.statements.setCommandCategoryEnabled.run(enabled ? 1 : 0, new Date().toISOString(), String(category));
    return result.changes > 0;
  }

  setAllCommandsEnabled(enabled) {
    const result = this.statements.setAllCommandsEnabled.run(enabled ? 1 : 0, new Date().toISOString());
    return result.changes > 0;
  }

  getCommandCategorySummary() {
    return this.statements.selectCommandCategorySummary.all();
  }

  parseGroupIds(value) {
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
  }

  normalizeMediaUrl(value, { allowEmpty = true } = {}) {
    const raw = String(value || '').trim();
    if (!raw) {
      return allowEmpty ? null : '';
    }

    let parsed = null;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      throw new Error('invalid schedule media_url');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid schedule media_url');
    }

    return parsed.toString();
  }

  normalizeSchedulePayload(input) {
    const kind = String(input.kind || 'message').trim().toLowerCase();
    const content = String(input.content || '').trim();
    const media_url = this.normalizeMediaUrl(input.media_url || input.mediaUrl || null);
    const groupIds = this.parseGroupIds(input.group_ids || input.groupIds);

    const rawSendAt = String(input.send_at || input.sendAt || '').trim();
    const parsedDate = rawSendAt ? new Date(rawSendAt) : new Date(Date.now() + 5 * 60 * 1000);

    if (!['message', 'poll'].includes(kind)) {
      throw new Error('invalid schedule kind');
    }

    if (!content) {
      throw new Error('schedule content is required');
    }

    if (!groupIds.length) {
      throw new Error('at least one target group is required');
    }

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error('invalid schedule send_at');
    }

    const recurrence = String(input.recurrence || 'none').trim().toLowerCase();
    if (!ALLOWED_RECURRENCE.has(recurrence)) {
      throw new Error('invalid schedule recurrence');
    }

    const status = String(input.status || 'pending').trim().toLowerCase();
    if (!ALLOWED_SCHEDULE_STATUS.has(status)) {
      throw new Error('invalid schedule status');
    }

    return {
      kind,
      content,
      media_url,
      group_ids: groupIds.join(','),
      send_at: parsedDate.toISOString(),
      recurrence,
      status,
      last_error: input.last_error ? String(input.last_error) : null,
      updated_at: new Date().toISOString()
    };
  }

  createSchedule(input) {
    const payload = this.normalizeSchedulePayload(input);
    const result = this.statements.insertSchedule.run(payload);
    return this.getScheduleById(result.lastInsertRowid);
  }

  listSchedules(limit = 200) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
    return this.statements.selectSchedules.all(safeLimit);
  }

  getScheduleById(id) {
    return this.statements.selectScheduleById.get(Number(id)) || null;
  }

  updateScheduleById(id, input) {
    const current = this.getScheduleById(id);
    if (!current) {
      return null;
    }

    const payload = this.normalizeSchedulePayload({ ...current, ...input });
    const result = this.statements.updateScheduleById.run({
      ...payload,
      id: Number(id)
    });

    if (!result.changes) {
      return null;
    }

    return this.getScheduleById(id);
  }

  setScheduleStatus(id, status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!ALLOWED_SCHEDULE_STATUS.has(normalized)) {
      throw new Error('invalid schedule status');
    }

    const result = this.statements.setScheduleStatus.run(normalized, new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  deleteScheduleById(id) {
    const result = this.statements.deleteScheduleById.run(Number(id));
    return result.changes > 0;
  }

  getDueSchedules(limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const nowIso = new Date().toISOString();
    return this.statements.selectDueSchedules.all(nowIso, safeLimit);
  }

  markScheduleSent(id) {
    const result = this.statements.setScheduleSent.run(new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  rescheduleDaily(id, nextSendAtIso) {
    const result = this.statements.setScheduleRecurringNext.run(nextSendAtIso, new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  markScheduleFailed(id, error) {
    const result = this.statements.setScheduleFailed.run(String(error || 'unknown error'), new Date().toISOString(), Number(id));
    return result.changes > 0;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = TokenModel;
