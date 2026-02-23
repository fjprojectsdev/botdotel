const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const ALLOWED_RECURRENCE = new Set(['none', 'daily']);
const ALLOWED_SCHEDULE_STATUS = new Set(['pending', 'sent', 'disabled', 'failed']);
const ALLOWED_INCIDENT_STATUS = new Set(['open', 'ack', 'resolved', 'ignored']);
const ALLOWED_INCIDENT_SEVERITY = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_ADMIN_ROLE = new Set(['viewer', 'editor', 'admin', 'owner']);
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
const AUTOMATION_MODULE_DEFS = [
  {
    key: 'welcome_message',
    label: 'Mensagem de Boas-vindas',
    description: 'Enviar mensagem quando um novo membro entrar',
    defaultEnabled: 1,
    defaultConfig: {}
  },
  {
    key: 'auto_reply',
    label: 'Resposta Automatica',
    description: 'Responder automaticamente palavras-chave configuradas',
    defaultEnabled: 0,
    defaultConfig: {}
  },
  {
    key: 'anti_spam',
    label: 'Anti-Spam',
    description: 'Remover mensagens de spam em tempo real',
    defaultEnabled: 0,
    defaultConfig: {}
  },
  {
    key: 'link_moderation',
    label: 'Moderacao de Links',
    description: 'Bloquear ou aprovar links enviados no grupo',
    defaultEnabled: 0,
    defaultConfig: {}
  },
  {
    key: 'rss_news',
    label: 'Envio de RSS/Noticias',
    description: 'Enviar atualizacoes automaticas de feeds',
    defaultEnabled: 0,
    defaultConfig: {
      feed_url: '',
      interval_minutes: 30
    }
  }
];

const STRIKE_TRIGGER_DEFS = [
  {
    key: 'bad_words',
    label: 'Palavras Proibidas',
    description: 'Aplica strike para palavras configuradas',
    defaultEnabled: 0,
    defaultStrikePoints: 1,
    defaultConfig: {
      words: []
    }
  },
  {
    key: 'blocked_links',
    label: 'Links Proibidos',
    description: 'Aplica strike para dominios bloqueados',
    defaultEnabled: 0,
    defaultStrikePoints: 1,
    defaultConfig: {
      domains: []
    }
  },
  {
    key: 'group_invites',
    label: 'Convites de Grupo',
    description: 'Aplica strike para links de convite',
    defaultEnabled: 0,
    defaultStrikePoints: 1,
    defaultConfig: {
      patterns: ['t.me/joinchat', 'chat.whatsapp.com', 'discord.gg']
    }
  },
  {
    key: 'scam_pattern',
    label: 'Padrao de Golpe',
    description: 'Detecta padroes comuns de scam',
    defaultEnabled: 0,
    defaultStrikePoints: 1,
    defaultConfig: {
      patterns: ['garantia de lucro', 'dobrar dinheiro', 'pix agora', 'retorno garantido', 'airdrop privado']
    }
  }
];

const STRIKE_LADDER_DEFAULTS = [
  {
    step: 1,
    action: 'warn',
    duration_minutes: 0,
    message_template: '@{name}, voce recebeu seu 1o strike. Comportamento: {reason}',
    enabled: 1
  },
  {
    step: 2,
    action: 'warn',
    duration_minutes: 0,
    message_template: '@{name}, voce recebeu seu 2o strike. Comportamento: {reason}',
    enabled: 1
  },
  {
    step: 3,
    action: 'mute',
    duration_minutes: 60,
    message_template: '@{name}, 3o strike detectado. Usuario silenciado por {duration} minutos. Motivo: {reason}',
    enabled: 1
  },
  {
    step: 4,
    action: 'kick',
    duration_minutes: 0,
    message_template: '@{name}, 4o strike. Usuario removido do grupo. Motivo: {reason}',
    enabled: 1
  }
];

const ALLOWED_STRIKE_ACTIONS = new Set(['none', 'warn', 'mute', 'kick', 'ban']);

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
        buy_media_url TEXT,
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
        log_index INTEGER NOT NULL DEFAULT 0,
        event_uid TEXT NOT NULL DEFAULT '',
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

      CREATE TABLE IF NOT EXISTS automation_modules (
        chat_id TEXT NOT NULL,
        module_key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        config TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(chat_id, module_key)
      );

      CREATE TABLE IF NOT EXISTS strike_triggers (
        chat_id TEXT NOT NULL,
        trigger_key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        strike_points INTEGER NOT NULL DEFAULT 1,
        config TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(chat_id, trigger_key)
      );

      CREATE TABLE IF NOT EXISTS strike_ladder (
        chat_id TEXT NOT NULL,
        step INTEGER NOT NULL,
        action TEXT NOT NULL DEFAULT 'warn',
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        message_template TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(chat_id, step)
      );

      CREATE TABLE IF NOT EXISTS strike_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_value TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(chat_id, target_type, target_value)
      );

      CREATE TABLE IF NOT EXISTS moderation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT '',
        actor_id TEXT NOT NULL DEFAULT '',
        event_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'received',
        reason TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS broadcast_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        media_url TEXT,
        group_ids TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        sent_count INTEGER NOT NULL DEFAULT 0,
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_delivery_health (
        chat_id TEXT PRIMARY KEY,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        total_failures INTEGER NOT NULL DEFAULT 0,
        total_success INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NOT NULL DEFAULT '',
        last_error_code TEXT NOT NULL DEFAULT '',
        last_error_at TEXT,
        last_success_at TEXT,
        auto_disabled_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_key TEXT UNIQUE,
        incident_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        chat_id TEXT NOT NULL DEFAULT '',
        context TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TEXT NOT NULL DEFAULT (datetime('now')),
        locked_at TEXT,
        last_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        enabled INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_username TEXT NOT NULL DEFAULT '',
        actor_role TEXT NOT NULL DEFAULT '',
        method TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL DEFAULT '',
        resource TEXT NOT NULL DEFAULT '',
        status_code INTEGER NOT NULL DEFAULT 0,
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_network ON tokens(network);
      CREATE INDEX IF NOT EXISTS idx_tokens_enabled ON tokens(enabled);
      CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_network_ts ON transactions(network, timestamp);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_event_uid ON transactions(event_uid);
      CREATE INDEX IF NOT EXISTS idx_member_activity_seen ON member_activity(last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_member_activity_chat ON member_activity(chat_id, last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_groups_enabled ON groups(enabled);
      CREATE INDEX IF NOT EXISTS idx_warn_chat_user ON moderation_warnings(chat_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_filters_chat ON chat_filters(chat_id, enabled);
      CREATE INDEX IF NOT EXISTS idx_economy_chat_balance ON economy_accounts(chat_id, balance DESC);
      CREATE INDEX IF NOT EXISTS idx_commands_category ON command_items(category);
      CREATE INDEX IF NOT EXISTS idx_commands_enabled ON command_items(enabled);
      CREATE INDEX IF NOT EXISTS idx_schedules_status_sendat ON schedules(status, send_at);
      CREATE INDEX IF NOT EXISTS idx_automation_modules_chat ON automation_modules(chat_id);
      CREATE INDEX IF NOT EXISTS idx_strike_triggers_chat ON strike_triggers(chat_id);
      CREATE INDEX IF NOT EXISTS idx_strike_ladder_chat ON strike_ladder(chat_id, step);
      CREATE INDEX IF NOT EXISTS idx_strike_whitelist_chat ON strike_whitelist(chat_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_logs_chat ON moderation_logs(chat_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moderation_logs_type ON moderation_logs(event_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_broadcast_status_created ON broadcast_messages(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_group_delivery_health_failures ON group_delivery_health(consecutive_failures DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_status_created ON incidents(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pending_jobs_status_available ON pending_jobs(status, available_at ASC);
      CREATE INDEX IF NOT EXISTS idx_pending_jobs_type_status ON pending_jobs(job_type, status, available_at ASC);
      CREATE INDEX IF NOT EXISTS idx_admin_users_role_enabled ON admin_users(role, enabled);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
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

    const tokenColumns = this.db.prepare('PRAGMA table_info(tokens)').all();
    const hasTokenBuyMediaUrl = tokenColumns.some((column) => column.name === 'buy_media_url');
    if (!hasTokenBuyMediaUrl) {
      this.db.exec(`ALTER TABLE tokens ADD COLUMN buy_media_url TEXT`);
      this.logger.info('database migration applied: tokens.buy_media_url');
    }

    const transactionColumns = this.db.prepare('PRAGMA table_info(transactions)').all();
    const hasLogIndex = transactionColumns.some((column) => column.name === 'log_index');
    const hasEventUid = transactionColumns.some((column) => column.name === 'event_uid');

    if (!hasLogIndex) {
      this.db.exec(`ALTER TABLE transactions ADD COLUMN log_index INTEGER NOT NULL DEFAULT 0`);
      this.logger.info('database migration applied: transactions.log_index');
    }

    if (!hasEventUid) {
      this.db.exec(`ALTER TABLE transactions ADD COLUMN event_uid TEXT NOT NULL DEFAULT ''`);
      this.logger.info('database migration applied: transactions.event_uid');
    }

    this.db.exec(`
      UPDATE transactions
      SET log_index = COALESCE(log_index, 0)
      WHERE log_index IS NULL
    `);

    this.db.exec(`
      UPDATE transactions
      SET event_uid = LOWER(network || ':' || hash || ':' || token || ':' || CAST(COALESCE(log_index, 0) AS TEXT))
      WHERE event_uid IS NULL OR TRIM(event_uid) = ''
    `);

    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_event_uid ON transactions(event_uid)
    `);
  }

  prepareStatements() {
    this.statements.upsertToken = this.db.prepare(`
      INSERT INTO tokens (name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, updated_at)
      VALUES (@name, @symbol, @address, @network, @pair_address, @buy_media_url, @decimals, @enabled, @updated_at)
      ON CONFLICT(address, network)
      DO UPDATE SET
        name = excluded.name,
        symbol = excluded.symbol,
        pair_address = excluded.pair_address,
        buy_media_url = excluded.buy_media_url,
        decimals = excluded.decimals,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.selectTokensByNetworkEnabled = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE network = ? AND enabled = 1
      ORDER BY symbol ASC
    `);

    this.statements.selectTokensByNetworkAll = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE network = ?
      ORDER BY symbol ASC
    `);

    this.statements.selectAllTokensEnabled = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, created_at, updated_at
      FROM tokens
      WHERE enabled = 1
      ORDER BY network ASC, symbol ASC
    `);

    this.statements.selectAllTokens = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, created_at, updated_at
      FROM tokens
      ORDER BY network ASC, symbol ASC
    `);

    this.statements.selectTokenById = this.db.prepare(`
      SELECT id, name, symbol, address, network, pair_address, buy_media_url, decimals, enabled, created_at, updated_at
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
        buy_media_url = @buy_media_url,
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

    this.statements.hasTransactionByEventUid = this.db.prepare(`
      SELECT 1 FROM transactions WHERE event_uid = ? LIMIT 1
    `);

    this.statements.insertTransaction = this.db.prepare(`
      INSERT INTO transactions (token, network, hash, log_index, event_uid, buyer, amount, usd_value, timestamp)
      VALUES (@token, @network, @hash, @log_index, @event_uid, @buyer, @amount, @usd_value, @timestamp)
    `);

    this.statements.selectRecentTransactions = this.db.prepare(`
      SELECT id, token, network, hash, log_index, event_uid, buyer, amount, usd_value, timestamp, created_at
      FROM transactions
      ORDER BY datetime(timestamp) DESC
      LIMIT ?
    `);

    this.statements.countTransactions = this.db.prepare(`
      SELECT COUNT(*) AS total FROM transactions
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

    this.statements.selectGroupMemberCounts = this.db.prepare(`
      SELECT
        chat_id,
        COUNT(DISTINCT user_id) AS member_count
      FROM member_activity
      GROUP BY chat_id
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

    this.statements.upsertAutomationModule = this.db.prepare(`
      INSERT INTO automation_modules (chat_id, module_key, enabled, config, updated_at)
      VALUES (@chat_id, @module_key, @enabled, @config, @updated_at)
      ON CONFLICT(chat_id, module_key)
      DO UPDATE SET
        enabled = excluded.enabled,
        config = excluded.config,
        updated_at = excluded.updated_at
    `);

    this.statements.insertAutomationModuleDefault = this.db.prepare(`
      INSERT INTO automation_modules (chat_id, module_key, enabled, config, updated_at)
      VALUES (@chat_id, @module_key, @enabled, @config, @updated_at)
      ON CONFLICT(chat_id, module_key) DO NOTHING
    `);

    this.statements.selectAutomationModulesByChat = this.db.prepare(`
      SELECT chat_id, module_key, enabled, config, updated_at
      FROM automation_modules
      WHERE chat_id = ?
      ORDER BY module_key ASC
    `);

    this.statements.upsertStrikeTrigger = this.db.prepare(`
      INSERT INTO strike_triggers (chat_id, trigger_key, enabled, strike_points, config, updated_at)
      VALUES (@chat_id, @trigger_key, @enabled, @strike_points, @config, @updated_at)
      ON CONFLICT(chat_id, trigger_key)
      DO UPDATE SET
        enabled = excluded.enabled,
        strike_points = excluded.strike_points,
        config = excluded.config,
        updated_at = excluded.updated_at
    `);

    this.statements.insertStrikeTriggerDefault = this.db.prepare(`
      INSERT INTO strike_triggers (chat_id, trigger_key, enabled, strike_points, config, updated_at)
      VALUES (@chat_id, @trigger_key, @enabled, @strike_points, @config, @updated_at)
      ON CONFLICT(chat_id, trigger_key) DO NOTHING
    `);

    this.statements.selectStrikeTriggersByChat = this.db.prepare(`
      SELECT chat_id, trigger_key, enabled, strike_points, config, updated_at
      FROM strike_triggers
      WHERE chat_id = ?
      ORDER BY trigger_key ASC
    `);

    this.statements.upsertStrikeLadder = this.db.prepare(`
      INSERT INTO strike_ladder (chat_id, step, action, duration_minutes, message_template, enabled, updated_at)
      VALUES (@chat_id, @step, @action, @duration_minutes, @message_template, @enabled, @updated_at)
      ON CONFLICT(chat_id, step)
      DO UPDATE SET
        action = excluded.action,
        duration_minutes = excluded.duration_minutes,
        message_template = excluded.message_template,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.insertStrikeLadderDefault = this.db.prepare(`
      INSERT INTO strike_ladder (chat_id, step, action, duration_minutes, message_template, enabled, updated_at)
      VALUES (@chat_id, @step, @action, @duration_minutes, @message_template, @enabled, @updated_at)
      ON CONFLICT(chat_id, step) DO NOTHING
    `);

    this.statements.selectStrikeLadderByChat = this.db.prepare(`
      SELECT chat_id, step, action, duration_minutes, message_template, enabled, updated_at
      FROM strike_ladder
      WHERE chat_id = ?
      ORDER BY step ASC
    `);

    this.statements.insertStrikeWhitelist = this.db.prepare(`
      INSERT INTO strike_whitelist (chat_id, target_type, target_value, note, updated_at)
      VALUES (@chat_id, @target_type, @target_value, @note, @updated_at)
      ON CONFLICT(chat_id, target_type, target_value)
      DO UPDATE SET
        note = excluded.note,
        updated_at = excluded.updated_at
    `);

    this.statements.selectStrikeWhitelistByChat = this.db.prepare(`
      SELECT id, chat_id, target_type, target_value, note, created_at, updated_at
      FROM strike_whitelist
      WHERE chat_id = ?
      ORDER BY id DESC
    `);

    this.statements.deleteStrikeWhitelistById = this.db.prepare(`
      DELETE FROM strike_whitelist
      WHERE id = ? AND chat_id = ?
    `);

    this.statements.selectStrikeWhitelistMatch = this.db.prepare(`
      SELECT id
      FROM strike_whitelist
      WHERE chat_id = ?
        AND (
          (target_type = 'user_id' AND target_value = ?)
          OR (target_type = 'username' AND target_value = ?)
        )
      LIMIT 1
    `);

    this.statements.insertModerationLog = this.db.prepare(`
      INSERT INTO moderation_logs (chat_id, user_id, actor_id, event_type, status, reason, details, created_at)
      VALUES (@chat_id, @user_id, @actor_id, @event_type, @status, @reason, @details, @created_at)
    `);

    this.statements.selectModerationLogsByChat = this.db.prepare(`
      SELECT id, chat_id, user_id, actor_id, event_type, status, reason, details, created_at
      FROM moderation_logs
      WHERE chat_id = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.selectModerationLogsByChatAndType = this.db.prepare(`
      SELECT id, chat_id, user_id, actor_id, event_type, status, reason, details, created_at
      FROM moderation_logs
      WHERE chat_id = ? AND event_type = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.selectModerationLogsByChatAndStatus = this.db.prepare(`
      SELECT id, chat_id, user_id, actor_id, event_type, status, reason, details, created_at
      FROM moderation_logs
      WHERE chat_id = ? AND status = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.selectModerationLogsByChatTypeStatus = this.db.prepare(`
      SELECT id, chat_id, user_id, actor_id, event_type, status, reason, details, created_at
      FROM moderation_logs
      WHERE chat_id = ? AND event_type = ? AND status = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.selectModerationOverviewByChat = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status IN ('resolved', 'dismissed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN event_type IN ('punishment.ban', 'command.ban') THEN 1 ELSE 0 END) AS bans,
        SUM(CASE WHEN event_type LIKE 'trigger.%' THEN 1 ELSE 0 END) AS strikes
      FROM moderation_logs
      WHERE chat_id = ? AND datetime(created_at) >= datetime(?)
    `);

    this.statements.insertBroadcastMessage = this.db.prepare(`
      INSERT INTO broadcast_messages (
        title,
        content,
        media_url,
        group_ids,
        status,
        sent_count,
        fail_count,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        @title,
        @content,
        @media_url,
        @group_ids,
        @status,
        @sent_count,
        @fail_count,
        @created_by,
        @created_at,
        @updated_at
      )
    `);

    this.statements.selectBroadcastMessageById = this.db.prepare(`
      SELECT id, title, content, media_url, group_ids, status, sent_count, fail_count, created_by, created_at, updated_at
      FROM broadcast_messages
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.selectBroadcastMessages = this.db.prepare(`
      SELECT id, title, content, media_url, group_ids, status, sent_count, fail_count, created_by, created_at, updated_at
      FROM broadcast_messages
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.updateBroadcastMessageStatus = this.db.prepare(`
      UPDATE broadcast_messages
      SET status = @status, sent_count = @sent_count, fail_count = @fail_count, updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.upsertGroupDeliveryHealth = this.db.prepare(`
      INSERT INTO group_delivery_health (
        chat_id,
        consecutive_failures,
        total_failures,
        total_success,
        last_error,
        last_error_code,
        last_error_at,
        last_success_at,
        auto_disabled_at,
        updated_at
      )
      VALUES (
        @chat_id,
        @consecutive_failures,
        @total_failures,
        @total_success,
        @last_error,
        @last_error_code,
        @last_error_at,
        @last_success_at,
        @auto_disabled_at,
        @updated_at
      )
      ON CONFLICT(chat_id)
      DO UPDATE SET
        consecutive_failures = excluded.consecutive_failures,
        total_failures = excluded.total_failures,
        total_success = excluded.total_success,
        last_error = excluded.last_error,
        last_error_code = excluded.last_error_code,
        last_error_at = excluded.last_error_at,
        last_success_at = excluded.last_success_at,
        auto_disabled_at = excluded.auto_disabled_at,
        updated_at = excluded.updated_at
    `);

    this.statements.selectGroupDeliveryHealthByChat = this.db.prepare(`
      SELECT
        chat_id,
        consecutive_failures,
        total_failures,
        total_success,
        last_error,
        last_error_code,
        last_error_at,
        last_success_at,
        auto_disabled_at,
        updated_at
      FROM group_delivery_health
      WHERE chat_id = ?
      LIMIT 1
    `);

    this.statements.selectAllGroupDeliveryHealth = this.db.prepare(`
      SELECT
        chat_id,
        consecutive_failures,
        total_failures,
        total_success,
        last_error,
        last_error_code,
        last_error_at,
        last_success_at,
        auto_disabled_at,
        updated_at
      FROM group_delivery_health
      ORDER BY consecutive_failures DESC, updated_at DESC
    `);

    this.statements.insertIncident = this.db.prepare(`
      INSERT INTO incidents (
        unique_key,
        incident_type,
        severity,
        status,
        title,
        message,
        chat_id,
        context,
        created_at,
        updated_at,
        resolved_at
      )
      VALUES (
        @unique_key,
        @incident_type,
        @severity,
        @status,
        @title,
        @message,
        @chat_id,
        @context,
        @created_at,
        @updated_at,
        @resolved_at
      )
    `);

    this.statements.selectIncidentById = this.db.prepare(`
      SELECT id, unique_key, incident_type, severity, status, title, message, chat_id, context, created_at, updated_at, resolved_at
      FROM incidents
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.selectOpenIncidentByUniqueKey = this.db.prepare(`
      SELECT id, unique_key, incident_type, severity, status, title, message, chat_id, context, created_at, updated_at, resolved_at
      FROM incidents
      WHERE unique_key = ? AND status IN ('open', 'ack')
      ORDER BY id DESC
      LIMIT 1
    `);

    this.statements.selectIncidentsByStatus = this.db.prepare(`
      SELECT id, unique_key, incident_type, severity, status, title, message, chat_id, context, created_at, updated_at, resolved_at
      FROM incidents
      WHERE status = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.selectIncidents = this.db.prepare(`
      SELECT id, unique_key, incident_type, severity, status, title, message, chat_id, context, created_at, updated_at, resolved_at
      FROM incidents
      ORDER BY id DESC
      LIMIT ?
    `);

    this.statements.updateIncidentStatus = this.db.prepare(`
      UPDATE incidents
      SET
        status = @status,
        updated_at = @updated_at,
        resolved_at = @resolved_at
      WHERE id = @id
    `);

    this.statements.countOpenIncidents = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM incidents
      WHERE status IN ('open', 'ack')
    `);

    this.statements.insertPendingJob = this.db.prepare(`
      INSERT INTO pending_jobs (job_type, payload, status, attempts, available_at, locked_at, last_error, created_at, updated_at)
      VALUES (@job_type, @payload, @status, @attempts, @available_at, @locked_at, @last_error, @created_at, @updated_at)
    `);

    this.statements.selectPendingJobsForClaim = this.db.prepare(`
      SELECT id, job_type, payload, status, attempts, available_at, locked_at, last_error, created_at, updated_at
      FROM pending_jobs
      WHERE job_type = ?
        AND status = 'queued'
        AND datetime(available_at) <= datetime(?)
      ORDER BY id ASC
      LIMIT ?
    `);

    this.statements.markPendingJobProcessing = this.db.prepare(`
      UPDATE pending_jobs
      SET status = 'processing', locked_at = ?, updated_at = ?
      WHERE id = ? AND status = 'queued'
    `);

    this.statements.markPendingJobQueued = this.db.prepare(`
      UPDATE pending_jobs
      SET status = 'queued', attempts = ?, available_at = ?, locked_at = NULL, last_error = ?, updated_at = ?
      WHERE id = ?
    `);

    this.statements.deletePendingJobById = this.db.prepare(`
      DELETE FROM pending_jobs WHERE id = ?
    `);

    this.statements.requeueStalePendingJobs = this.db.prepare(`
      UPDATE pending_jobs
      SET status = 'queued', locked_at = NULL, updated_at = ?
      WHERE status = 'processing' AND datetime(locked_at) <= datetime(?)
    `);

    this.statements.selectPendingJobStats = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        COUNT(*) AS total
      FROM pending_jobs
    `);

    this.statements.selectPendingJobById = this.db.prepare(`
      SELECT id, job_type, payload, status, attempts, available_at, locked_at, last_error, created_at, updated_at
      FROM pending_jobs
      WHERE id = ?
      LIMIT 1
    `);

    this.statements.insertAdminUser = this.db.prepare(`
      INSERT INTO admin_users (
        username,
        password_hash,
        role,
        enabled,
        failed_attempts,
        locked_until,
        last_login_at,
        created_at,
        updated_at
      )
      VALUES (
        @username,
        @password_hash,
        @role,
        @enabled,
        @failed_attempts,
        @locked_until,
        @last_login_at,
        @created_at,
        @updated_at
      )
      ON CONFLICT(username)
      DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    this.statements.selectAdminUserByUsername = this.db.prepare(`
      SELECT id, username, password_hash, role, enabled, failed_attempts, locked_until, last_login_at, created_at, updated_at
      FROM admin_users
      WHERE username = ?
      LIMIT 1
    `);

    this.statements.selectAdminUsers = this.db.prepare(`
      SELECT id, username, role, enabled, failed_attempts, locked_until, last_login_at, created_at, updated_at
      FROM admin_users
      ORDER BY
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'editor' THEN 3
          ELSE 4
        END ASC,
        username ASC
    `);

    this.statements.countAdminUsers = this.db.prepare(`
      SELECT COUNT(*) AS total FROM admin_users
    `);

    this.statements.updateAdminUserSecurity = this.db.prepare(`
      UPDATE admin_users
      SET
        failed_attempts = @failed_attempts,
        locked_until = @locked_until,
        last_login_at = @last_login_at,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.updateAdminUser = this.db.prepare(`
      UPDATE admin_users
      SET
        role = @role,
        enabled = @enabled,
        password_hash = @password_hash,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.statements.deleteAdminUserById = this.db.prepare(`
      DELETE FROM admin_users WHERE id = ?
    `);

    this.statements.insertAuditLog = this.db.prepare(`
      INSERT INTO audit_logs (
        actor_username,
        actor_role,
        method,
        path,
        action,
        resource,
        status_code,
        details,
        created_at
      )
      VALUES (
        @actor_username,
        @actor_role,
        @method,
        @path,
        @action,
        @resource,
        @status_code,
        @details,
        @created_at
      )
    `);

    this.statements.selectAuditLogs = this.db.prepare(`
      SELECT id, actor_username, actor_role, method, path, action, resource, status_code, details, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
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
      buy_media_url: this.normalizeMediaUrl(token.buy_media_url || token.buyMediaUrl || null, {
        fieldName: 'token buy_media_url'
      }),
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

  buildEventUid({ network = '', hash = '', token = '', tokenAddress = '', logIndex = 0, eventUid = '' } = {}) {
    const provided = String(eventUid || '').trim().toLowerCase();
    if (provided) {
      return provided;
    }

    const safeNetwork = String(network || '').trim().toLowerCase() || 'unknown';
    const safeHash = String(hash || '').trim().toLowerCase() || 'unknown';
    const safeToken = String(tokenAddress || token || '').trim().toLowerCase() || 'unknown';
    const safeLogIndex = Math.max(0, Number(logIndex) || 0);

    return `${safeNetwork}:${safeHash}:${safeToken}:${safeLogIndex}`;
  }

  hasTransactionByEventUid(eventUid) {
    const safe = String(eventUid || '').trim().toLowerCase();
    if (!safe) {
      return false;
    }
    const row = this.statements.hasTransactionByEventUid.get(safe);
    return Boolean(row);
  }

  saveTransaction(transaction) {
    const eventUid = this.buildEventUid({
      network: transaction.network,
      hash: transaction.hash,
      token: transaction.token,
      tokenAddress: transaction.tokenAddress,
      logIndex: transaction.log_index,
      eventUid: transaction.event_uid
    });

    const payload = {
      token: String(transaction.token),
      network: String(transaction.network),
      hash: String(transaction.hash),
      log_index: Math.max(0, Number(transaction.log_index) || 0),
      event_uid: eventUid,
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

  countTransactions() {
    const row = this.statements.countTransactions.get();
    return Math.max(0, Number(row?.total || 0));
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

  normalizeJsonObject(value, fallback = {}) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return { ...fallback };
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_error) {
        return { ...fallback };
      }
    }

    return { ...fallback };
  }

  upsertGroup(group) {
    const payload = this.normalizeGroupPayload(group);
    this.statements.upsertGroup.run(payload);
    this.ensureAutomationDefaults(payload.chat_id);
    return payload;
  }

  updateGroupById(id, group) {
    const payload = this.normalizeGroupPayload(group);
    const result = this.statements.updateGroupById.run({
      ...payload,
      id: Number(id)
    });

    if (result.changes > 0) {
      this.ensureAutomationDefaults(payload.chat_id);
    }

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

  getGroupMemberCounts() {
    const rows = this.statements.selectGroupMemberCounts.all();
    const counts = {};

    for (const row of rows) {
      const chatId = String(row?.chat_id || '').trim();
      if (!chatId) {
        continue;
      }
      counts[chatId] = Math.max(0, Number(row?.member_count) || 0);
    }

    return counts;
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

  findAutomationModuleDef(moduleKey) {
    const key = String(moduleKey || '').trim().toLowerCase();
    return AUTOMATION_MODULE_DEFS.find((item) => item.key === key) || null;
  }

  findStrikeTriggerDef(triggerKey) {
    const key = String(triggerKey || '').trim().toLowerCase();
    return STRIKE_TRIGGER_DEFS.find((item) => item.key === key) || null;
  }

  ensureAutomationDefaults(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return;
    }

    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      for (const moduleDef of AUTOMATION_MODULE_DEFS) {
        this.statements.insertAutomationModuleDefault.run({
          chat_id: safeChatId,
          module_key: moduleDef.key,
          enabled: moduleDef.defaultEnabled ? 1 : 0,
          config: JSON.stringify(moduleDef.defaultConfig || {}),
          updated_at: now
        });
      }

      for (const triggerDef of STRIKE_TRIGGER_DEFS) {
        this.statements.insertStrikeTriggerDefault.run({
          chat_id: safeChatId,
          trigger_key: triggerDef.key,
          enabled: triggerDef.defaultEnabled ? 1 : 0,
          strike_points: Math.max(1, Number(triggerDef.defaultStrikePoints) || 1),
          config: JSON.stringify(triggerDef.defaultConfig || {}),
          updated_at: now
        });
      }

      for (const stepDef of STRIKE_LADDER_DEFAULTS) {
        this.statements.insertStrikeLadderDefault.run({
          chat_id: safeChatId,
          step: Number(stepDef.step),
          action: String(stepDef.action || 'warn'),
          duration_minutes: Math.max(0, Number(stepDef.duration_minutes) || 0),
          message_template: String(stepDef.message_template || ''),
          enabled: stepDef.enabled ? 1 : 0,
          updated_at: now
        });
      }
    });

    tx();
  }

  normalizeAutomationModuleRow(row) {
    const def = this.findAutomationModuleDef(row?.module_key || '') || {
      key: String(row?.module_key || ''),
      label: String(row?.module_key || ''),
      description: '',
      defaultConfig: {}
    };

    return {
      key: def.key,
      label: def.label,
      description: def.description,
      enabled: row?.enabled === 1,
      config: this.normalizeJsonObject(row?.config, def.defaultConfig || {}),
      updated_at: row?.updated_at || null
    };
  }

  normalizeStrikeTriggerRow(row) {
    const def = this.findStrikeTriggerDef(row?.trigger_key || '') || {
      key: String(row?.trigger_key || ''),
      label: String(row?.trigger_key || ''),
      description: '',
      defaultConfig: {},
      defaultStrikePoints: 1
    };

    return {
      key: def.key,
      label: def.label,
      description: def.description,
      enabled: row?.enabled === 1,
      strike_points: Math.max(1, Number(row?.strike_points) || Number(def.defaultStrikePoints) || 1),
      config: this.normalizeJsonObject(row?.config, def.defaultConfig || {}),
      updated_at: row?.updated_at || null
    };
  }

  normalizeStrikeLadderRow(row) {
    return {
      step: Math.max(1, Number(row?.step) || 1),
      action: String(row?.action || 'warn').toLowerCase(),
      duration_minutes: Math.max(0, Number(row?.duration_minutes) || 0),
      message_template: String(row?.message_template || ''),
      enabled: row?.enabled === 1,
      updated_at: row?.updated_at || null
    };
  }

  getGroupAutomationModules(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    this.ensureAutomationDefaults(safeChatId);
    const rows = this.statements.selectAutomationModulesByChat.all(safeChatId);
    const map = new Map(rows.map((row) => [String(row.module_key || ''), row]));

    return AUTOMATION_MODULE_DEFS.map((def) => {
      const row = map.get(def.key) || {
        module_key: def.key,
        enabled: def.defaultEnabled ? 1 : 0,
        config: JSON.stringify(def.defaultConfig || {}),
        updated_at: null
      };
      return this.normalizeAutomationModuleRow(row);
    });
  }

  setGroupAutomationModule(chatId, moduleKey, changes = {}) {
    const safeChatId = String(chatId || '').trim();
    const def = this.findAutomationModuleDef(moduleKey);
    if (!safeChatId || !def) {
      throw new Error('invalid automation module');
    }

    const current = this.getGroupAutomationModules(safeChatId).find((item) => item.key === def.key) || {
      enabled: Boolean(def.defaultEnabled),
      config: { ...def.defaultConfig }
    };

    const enabled =
      changes.enabled === undefined ? Boolean(current.enabled) : changes.enabled === true || changes.enabled === 1;
    const config =
      changes.config === undefined
        ? this.normalizeJsonObject(current.config, def.defaultConfig || {})
        : this.normalizeJsonObject(changes.config, def.defaultConfig || {});

    this.statements.upsertAutomationModule.run({
      chat_id: safeChatId,
      module_key: def.key,
      enabled: enabled ? 1 : 0,
      config: JSON.stringify(config),
      updated_at: new Date().toISOString()
    });

    return this.getGroupAutomationModules(safeChatId).find((item) => item.key === def.key) || null;
  }

  setGroupAutomationModulesBulk(chatId, modules = []) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    const list = Array.isArray(modules) ? modules : [];
    list.forEach((item) => {
      if (!item || !item.key) {
        return;
      }
      this.setGroupAutomationModule(safeChatId, item.key, {
        enabled: item.enabled,
        config: item.config
      });
    });

    return this.getGroupAutomationModules(safeChatId);
  }

  getGroupStrikeTriggers(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    this.ensureAutomationDefaults(safeChatId);
    const rows = this.statements.selectStrikeTriggersByChat.all(safeChatId);
    const map = new Map(rows.map((row) => [String(row.trigger_key || ''), row]));

    return STRIKE_TRIGGER_DEFS.map((def) => {
      const row = map.get(def.key) || {
        trigger_key: def.key,
        enabled: def.defaultEnabled ? 1 : 0,
        strike_points: Math.max(1, Number(def.defaultStrikePoints) || 1),
        config: JSON.stringify(def.defaultConfig || {}),
        updated_at: null
      };
      return this.normalizeStrikeTriggerRow(row);
    });
  }

  setGroupStrikeTrigger(chatId, triggerKey, changes = {}) {
    const safeChatId = String(chatId || '').trim();
    const def = this.findStrikeTriggerDef(triggerKey);
    if (!safeChatId || !def) {
      throw new Error('invalid strike trigger');
    }

    const current = this.getGroupStrikeTriggers(safeChatId).find((item) => item.key === def.key) || {
      enabled: Boolean(def.defaultEnabled),
      strike_points: Math.max(1, Number(def.defaultStrikePoints) || 1),
      config: { ...def.defaultConfig }
    };

    const enabled =
      changes.enabled === undefined ? Boolean(current.enabled) : changes.enabled === true || changes.enabled === 1;
    const strikePoints = Math.max(
      1,
      Number(changes.strike_points === undefined ? current.strike_points : changes.strike_points) || 1
    );
    const config =
      changes.config === undefined
        ? this.normalizeJsonObject(current.config, def.defaultConfig || {})
        : this.normalizeJsonObject(changes.config, def.defaultConfig || {});

    this.statements.upsertStrikeTrigger.run({
      chat_id: safeChatId,
      trigger_key: def.key,
      enabled: enabled ? 1 : 0,
      strike_points: strikePoints,
      config: JSON.stringify(config),
      updated_at: new Date().toISOString()
    });

    return this.getGroupStrikeTriggers(safeChatId).find((item) => item.key === def.key) || null;
  }

  setGroupStrikeTriggersBulk(chatId, triggers = []) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    const list = Array.isArray(triggers) ? triggers : [];
    list.forEach((item) => {
      if (!item || !item.key) {
        return;
      }
      this.setGroupStrikeTrigger(safeChatId, item.key, {
        enabled: item.enabled,
        strike_points: item.strike_points,
        config: item.config
      });
    });

    return this.getGroupStrikeTriggers(safeChatId);
  }

  getGroupStrikeLadder(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    this.ensureAutomationDefaults(safeChatId);
    const rows = this.statements.selectStrikeLadderByChat.all(safeChatId);
    const map = new Map(rows.map((row) => [Number(row.step), row]));

    return STRIKE_LADDER_DEFAULTS.map((def) => {
      const row = map.get(Number(def.step)) || {
        step: def.step,
        action: def.action,
        duration_minutes: def.duration_minutes,
        message_template: def.message_template,
        enabled: def.enabled ? 1 : 0,
        updated_at: null
      };
      return this.normalizeStrikeLadderRow(row);
    });
  }

  setGroupStrikeLadderItem(chatId, item = {}) {
    const safeChatId = String(chatId || '').trim();
    const step = Math.max(1, Number(item.step) || 0);
    if (!safeChatId || !step) {
      throw new Error('invalid strike ladder item');
    }

    const current = this.getGroupStrikeLadder(safeChatId).find((row) => Number(row.step) === step) || {
      step,
      action: 'warn',
      duration_minutes: 0,
      message_template: '',
      enabled: true
    };

    const action = String(item.action || current.action || 'warn').trim().toLowerCase();
    if (!ALLOWED_STRIKE_ACTIONS.has(action)) {
      throw new Error('invalid strike ladder action');
    }

    const payload = {
      chat_id: safeChatId,
      step,
      action,
      duration_minutes: Math.max(0, Number(item.duration_minutes ?? current.duration_minutes) || 0),
      message_template: String(item.message_template ?? current.message_template ?? '').trim(),
      enabled: item.enabled === undefined ? (current.enabled ? 1 : 0) : item.enabled ? 1 : 0,
      updated_at: new Date().toISOString()
    };

    this.statements.upsertStrikeLadder.run(payload);
    return this.getGroupStrikeLadder(safeChatId).find((row) => Number(row.step) === step) || null;
  }

  setGroupStrikeLadderBulk(chatId, ladderItems = []) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    const list = Array.isArray(ladderItems) ? ladderItems : [];
    list.forEach((item) => {
      if (!item || item.step === undefined) {
        return;
      }
      this.setGroupStrikeLadderItem(safeChatId, item);
    });

    return this.getGroupStrikeLadder(safeChatId);
  }

  normalizeWhitelistTargetType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'user_id' || type === 'userid' || type === 'id') {
      return 'user_id';
    }
    if (type === 'username' || type === 'user' || type === 'tag') {
      return 'username';
    }
    throw new Error('invalid whitelist target_type');
  }

  normalizeWhitelistTargetValue(targetType, value) {
    const raw = String(value || '').trim();
    if (!raw) {
      throw new Error('whitelist target_value is required');
    }

    if (targetType === 'user_id') {
      return raw;
    }

    return raw.replace(/^@/, '').toLowerCase();
  }

  listGroupStrikeWhitelist(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }
    return this.statements.selectStrikeWhitelistByChat.all(safeChatId);
  }

  addGroupStrikeWhitelist(chatId, input = {}) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      throw new Error('invalid chat id');
    }

    const targetType = this.normalizeWhitelistTargetType(input.target_type || input.targetType || '');
    const targetValue = this.normalizeWhitelistTargetValue(targetType, input.target_value || input.targetValue || '');
    const note = String(input.note || '').trim();

    this.statements.insertStrikeWhitelist.run({
      chat_id: safeChatId,
      target_type: targetType,
      target_value: targetValue,
      note,
      updated_at: new Date().toISOString()
    });

    return this.listGroupStrikeWhitelist(safeChatId);
  }

  removeGroupStrikeWhitelist(chatId, id) {
    const safeChatId = String(chatId || '').trim();
    const result = this.statements.deleteStrikeWhitelistById.run(Number(id), safeChatId);
    return result.changes > 0;
  }

  isUserInStrikeWhitelist(chatId, userId, username = '') {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return false;
    }

    const safeUserId = String(userId || '').trim();
    const safeUsername = String(username || '')
      .replace(/^@/, '')
      .trim()
      .toLowerCase();

    const row = this.statements.selectStrikeWhitelistMatch.get(safeChatId, safeUserId, safeUsername);
    return Boolean(row);
  }

  normalizeModerationLogRow(row) {
    if (!row) {
      return null;
    }
    return {
      ...row,
      details: this.normalizeJsonObject(row.details, {})
    };
  }

  addModerationLog(log = {}) {
    const payload = {
      chat_id: String(log.chat_id || '').trim(),
      user_id: String(log.user_id || '').trim(),
      actor_id: String(log.actor_id || '').trim(),
      event_type: String(log.event_type || '').trim().toLowerCase() || 'unknown',
      status: String(log.status || 'received').trim().toLowerCase(),
      reason: String(log.reason || '').trim(),
      details: JSON.stringify(this.normalizeJsonObject(log.details, {})),
      created_at: log.created_at ? new Date(log.created_at).toISOString() : new Date().toISOString()
    };

    if (!payload.chat_id) {
      throw new Error('moderation log chat_id is required');
    }

    this.statements.insertModerationLog.run(payload);
    return payload;
  }

  listModerationLogs(chatId, { limit = 150, eventType = '', status = '' } = {}) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 150, 1000));
    const safeType = String(eventType || '').trim().toLowerCase();
    const safeStatus = String(status || '').trim().toLowerCase();
    let rows = [];

    if (safeType && safeStatus) {
      rows = this.statements.selectModerationLogsByChatTypeStatus.all(safeChatId, safeType, safeStatus, safeLimit);
    } else if (safeType) {
      rows = this.statements.selectModerationLogsByChatAndType.all(safeChatId, safeType, safeLimit);
    } else if (safeStatus) {
      rows = this.statements.selectModerationLogsByChatAndStatus.all(safeChatId, safeStatus, safeLimit);
    } else {
      rows = this.statements.selectModerationLogsByChat.all(safeChatId, safeLimit);
    }

    return rows.map((row) => this.normalizeModerationLogRow(row)).filter(Boolean);
  }

  getModerationOverview(chatId, { days = 30 } = {}) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return {
        pending: 0,
        resolved: 0,
        bans: 0,
        strikes: 0
      };
    }

    const safeDays = Math.max(1, Math.min(Number(days) || 30, 365));
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    const row = this.statements.selectModerationOverviewByChat.get(safeChatId, cutoff);

    return {
      pending: Number(row?.pending || 0),
      resolved: Number(row?.resolved || 0),
      bans: Number(row?.bans || 0),
      strikes: Number(row?.strikes || 0)
    };
  }

  normalizeBroadcastPayload(input = {}) {
    const content = String(input.content || '').trim();
    if (!content) {
      throw new Error('broadcast content is required');
    }

    const groupIds = this.parseGroupIds(input.group_ids || input.groupIds || input.groups || []);
    if (!groupIds.length) {
      throw new Error('broadcast requires at least one group');
    }

    return {
      title: String(input.title || '').trim(),
      content,
      media_url: this.normalizeMediaUrl(input.media_url || input.mediaUrl || '', {
        fieldName: 'broadcast media_url'
      }),
      group_ids: groupIds.join(','),
      status: String(input.status || 'queued').trim().toLowerCase() || 'queued',
      sent_count: Math.max(0, Number(input.sent_count) || 0),
      fail_count: Math.max(0, Number(input.fail_count) || 0),
      created_by: String(input.created_by || input.createdBy || '').trim(),
      created_at: input.created_at ? new Date(input.created_at).toISOString() : new Date().toISOString(),
      updated_at: input.updated_at ? new Date(input.updated_at).toISOString() : new Date().toISOString()
    };
  }

  createBroadcastMessage(input = {}) {
    const payload = this.normalizeBroadcastPayload(input);
    const result = this.statements.insertBroadcastMessage.run(payload);
    return this.getBroadcastMessageById(result.lastInsertRowid);
  }

  getBroadcastMessageById(id) {
    return this.statements.selectBroadcastMessageById.get(Number(id)) || null;
  }

  listBroadcastMessages(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    return this.statements.selectBroadcastMessages.all(safeLimit);
  }

  setBroadcastMessageStatus(id, { status, sent_count, fail_count } = {}) {
    const current = this.getBroadcastMessageById(id);
    if (!current) {
      return null;
    }

    this.statements.updateBroadcastMessageStatus.run({
      id: Number(id),
      status: String(status || current.status || 'queued').trim().toLowerCase(),
      sent_count: Math.max(0, Number(sent_count === undefined ? current.sent_count : sent_count) || 0),
      fail_count: Math.max(0, Number(fail_count === undefined ? current.fail_count : fail_count) || 0),
      updated_at: new Date().toISOString()
    });

    return this.getBroadcastMessageById(id);
  }

  ping() {
    const row = this.db.prepare('SELECT 1 AS ok').get();
    return Number(row?.ok || 0) === 1;
  }

  normalizeDeliveryHealthRow(row) {
    if (!row) {
      return null;
    }

    return {
      chat_id: String(row.chat_id || '').trim(),
      consecutive_failures: Math.max(0, Number(row.consecutive_failures) || 0),
      total_failures: Math.max(0, Number(row.total_failures) || 0),
      total_success: Math.max(0, Number(row.total_success) || 0),
      last_error: String(row.last_error || ''),
      last_error_code: String(row.last_error_code || ''),
      last_error_at: row.last_error_at || null,
      last_success_at: row.last_success_at || null,
      auto_disabled_at: row.auto_disabled_at || null,
      updated_at: row.updated_at || null
    };
  }

  getGroupDeliveryHealth(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return null;
    }

    const row = this.statements.selectGroupDeliveryHealthByChat.get(safeChatId);
    if (row) {
      return this.normalizeDeliveryHealthRow(row);
    }

    const now = new Date().toISOString();
    this.statements.upsertGroupDeliveryHealth.run({
      chat_id: safeChatId,
      consecutive_failures: 0,
      total_failures: 0,
      total_success: 0,
      last_error: '',
      last_error_code: '',
      last_error_at: null,
      last_success_at: null,
      auto_disabled_at: null,
      updated_at: now
    });
    return this.normalizeDeliveryHealthRow(this.statements.selectGroupDeliveryHealthByChat.get(safeChatId));
  }

  listGroupDeliveryHealth() {
    return this.statements.selectAllGroupDeliveryHealth.all().map((row) => this.normalizeDeliveryHealthRow(row));
  }

  registerGroupDeliverySuccess(chatId) {
    const current = this.getGroupDeliveryHealth(chatId);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    this.statements.upsertGroupDeliveryHealth.run({
      ...current,
      consecutive_failures: 0,
      total_success: current.total_success + 1,
      last_success_at: now,
      updated_at: now
    });

    return this.getGroupDeliveryHealth(chatId);
  }

  registerGroupDeliveryFailure(chatId, { error = '', errorCode = '' } = {}) {
    const current = this.getGroupDeliveryHealth(chatId);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    this.statements.upsertGroupDeliveryHealth.run({
      ...current,
      consecutive_failures: current.consecutive_failures + 1,
      total_failures: current.total_failures + 1,
      last_error: String(error || '').slice(0, 500),
      last_error_code: String(errorCode || '').slice(0, 100),
      last_error_at: now,
      updated_at: now
    });

    return this.getGroupDeliveryHealth(chatId);
  }

  markGroupDeliveryAutoDisabled(chatId) {
    const current = this.getGroupDeliveryHealth(chatId);
    if (!current) {
      return null;
    }
    const now = new Date().toISOString();
    this.statements.upsertGroupDeliveryHealth.run({
      ...current,
      auto_disabled_at: now,
      updated_at: now
    });
    return this.getGroupDeliveryHealth(chatId);
  }

  normalizeIncidentPayload(input = {}) {
    const incidentType = String(input.incident_type || input.type || '').trim().toLowerCase();
    const severity = String(input.severity || 'medium').trim().toLowerCase();
    const status = String(input.status || 'open').trim().toLowerCase();
    const title = String(input.title || '').trim();
    const message = String(input.message || '').trim();
    const chatId = String(input.chat_id || input.chatId || '').trim();
    const uniqueKey = String(input.unique_key || input.uniqueKey || '').trim().toLowerCase();

    if (!incidentType) {
      throw new Error('incident_type is required');
    }
    if (!title) {
      throw new Error('incident title is required');
    }
    if (!ALLOWED_INCIDENT_STATUS.has(status)) {
      throw new Error('invalid incident status');
    }
    if (!ALLOWED_INCIDENT_SEVERITY.has(severity)) {
      throw new Error('invalid incident severity');
    }

    return {
      unique_key: uniqueKey || null,
      incident_type: incidentType,
      severity,
      status,
      title,
      message,
      chat_id: chatId,
      context: JSON.stringify(this.normalizeJsonObject(input.context, {})),
      created_at: input.created_at ? new Date(input.created_at).toISOString() : new Date().toISOString(),
      updated_at: input.updated_at ? new Date(input.updated_at).toISOString() : new Date().toISOString(),
      resolved_at: input.resolved_at ? new Date(input.resolved_at).toISOString() : null
    };
  }

  normalizeIncidentRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      unique_key: row.unique_key || '',
      incident_type: String(row.incident_type || ''),
      severity: String(row.severity || 'medium'),
      status: String(row.status || 'open'),
      title: String(row.title || ''),
      message: String(row.message || ''),
      chat_id: String(row.chat_id || ''),
      context: this.normalizeJsonObject(row.context, {}),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      resolved_at: row.resolved_at || null
    };
  }

  createIncident(input = {}) {
    const payload = this.normalizeIncidentPayload(input);
    const result = this.statements.insertIncident.run(payload);
    return this.getIncidentById(result.lastInsertRowid);
  }

  createIncidentIfNotOpen(input = {}) {
    const uniqueKey = String(input.unique_key || input.uniqueKey || '').trim().toLowerCase();
    if (uniqueKey) {
      const existing = this.statements.selectOpenIncidentByUniqueKey.get(uniqueKey);
      if (existing) {
        return this.normalizeIncidentRow(existing);
      }
    }
    return this.createIncident(input);
  }

  getIncidentById(id) {
    return this.normalizeIncidentRow(this.statements.selectIncidentById.get(Number(id)) || null);
  }

  listIncidents({ status = '', limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    const safeStatus = String(status || '').trim().toLowerCase();
    if (safeStatus && ALLOWED_INCIDENT_STATUS.has(safeStatus)) {
      return this.statements.selectIncidentsByStatus.all(safeStatus, safeLimit).map((row) => this.normalizeIncidentRow(row));
    }
    return this.statements.selectIncidents.all(safeLimit).map((row) => this.normalizeIncidentRow(row));
  }

  setIncidentStatus(id, status, { resolvedAt } = {}) {
    const current = this.getIncidentById(id);
    if (!current) {
      return null;
    }

    const normalized = String(status || '').trim().toLowerCase();
    if (!ALLOWED_INCIDENT_STATUS.has(normalized)) {
      throw new Error('invalid incident status');
    }

    const isResolved = normalized === 'resolved' || normalized === 'ignored';
    this.statements.updateIncidentStatus.run({
      id: Number(id),
      status: normalized,
      updated_at: new Date().toISOString(),
      resolved_at: isResolved ? (resolvedAt ? new Date(resolvedAt).toISOString() : new Date().toISOString()) : null
    });

    return this.getIncidentById(id);
  }

  countOpenIncidents() {
    const row = this.statements.countOpenIncidents.get();
    return Math.max(0, Number(row?.total || 0));
  }

  enqueuePendingJob(input = {}) {
    const jobType = String(input.job_type || input.jobType || '').trim().toLowerCase();
    if (!jobType) {
      throw new Error('job_type is required');
    }

    const payload =
      typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload === undefined ? {} : input.payload);
    const now = new Date().toISOString();
    const availableAt = input.available_at
      ? new Date(input.available_at).toISOString()
      : input.availableAt
        ? new Date(input.availableAt).toISOString()
        : now;

    const result = this.statements.insertPendingJob.run({
      job_type: jobType,
      payload,
      status: 'queued',
      attempts: Math.max(0, Number(input.attempts) || 0),
      available_at: availableAt,
      locked_at: null,
      last_error: String(input.last_error || ''),
      created_at: now,
      updated_at: now
    });

    return this.getPendingJobById(result.lastInsertRowid);
  }

  getPendingJobById(id) {
    return this.statements.selectPendingJobById.get(Number(id)) || null;
  }

  claimPendingJobs(jobType, limit = 50) {
    const safeType = String(jobType || '').trim().toLowerCase();
    if (!safeType) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
    const nowIso = new Date().toISOString();

    const tx = this.db.transaction(() => {
      const rows = this.statements.selectPendingJobsForClaim.all(safeType, nowIso, safeLimit);
      const claimed = [];

      for (const row of rows) {
        const updated = this.statements.markPendingJobProcessing.run(nowIso, nowIso, Number(row.id));
        if (updated.changes > 0) {
          claimed.push({
            ...row,
            status: 'processing',
            locked_at: nowIso,
            updated_at: nowIso
          });
        }
      }

      return claimed;
    });

    return tx();
  }

  markPendingJobDone(id) {
    const result = this.statements.deletePendingJobById.run(Number(id));
    return result.changes > 0;
  }

  markPendingJobRetry(id, errorMessage, retryDelayMs = 5000) {
    const current = this.getPendingJobById(id);
    if (!current) {
      return false;
    }

    const attempts = Math.max(0, Number(current.attempts) || 0) + 1;
    const nowMs = Date.now();
    const delayMs = Math.max(0, Number(retryDelayMs) || 0);
    const availableAt = new Date(nowMs + delayMs).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    this.statements.markPendingJobQueued.run(
      attempts,
      availableAt,
      String(errorMessage || '').slice(0, 500),
      nowIso,
      Number(id)
    );
    return true;
  }

  requeueStalePendingJobs({ staleSeconds = 120 } = {}) {
    const seconds = Math.max(15, Math.min(Number(staleSeconds) || 120, 3600));
    const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const result = this.statements.requeueStalePendingJobs.run(nowIso, cutoff);
    return Math.max(0, Number(result?.changes || 0));
  }

  getPendingJobStats() {
    const row = this.statements.selectPendingJobStats.get() || {};
    return {
      queued: Math.max(0, Number(row.queued || 0)),
      processing: Math.max(0, Number(row.processing || 0)),
      failed: Math.max(0, Number(row.failed || 0)),
      total: Math.max(0, Number(row.total || 0))
    };
  }

  hashAdminPassword(password) {
    const safePassword = String(password || '');
    if (!safePassword) {
      throw new Error('admin password is required');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const digest = crypto.scryptSync(safePassword, salt, 64).toString('hex');
    return `scrypt$${salt}$${digest}`;
  }

  verifyAdminPassword(password, passwordHash) {
    const safePassword = String(password || '');
    const rawHash = String(passwordHash || '');
    const parts = rawHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }

    const salt = parts[1];
    const expectedHex = parts[2];
    if (!salt || !expectedHex) {
      return false;
    }

    const actual = crypto.scryptSync(safePassword, salt, 64).toString('hex');
    const a = Buffer.from(actual, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  hasAdminUsers() {
    const row = this.statements.countAdminUsers.get();
    return Math.max(0, Number(row?.total || 0)) > 0;
  }

  upsertAdminUser(input = {}) {
    const username = String(input.username || '').trim().toLowerCase();
    if (!username) {
      throw new Error('admin username is required');
    }

    const role = String(input.role || 'viewer').trim().toLowerCase();
    if (!ALLOWED_ADMIN_ROLE.has(role)) {
      throw new Error('invalid admin role');
    }

    const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
    let passwordHash = String(input.password_hash || input.passwordHash || '').trim();
    const password = String(input.password || '').trim();

    const current = this.getAdminUserByUsername(username);
    if (!passwordHash) {
      if (password) {
        passwordHash = this.hashAdminPassword(password);
      } else if (current?.password_hash) {
        passwordHash = current.password_hash;
      }
    }

    if (!passwordHash) {
      throw new Error('admin password is required');
    }

    const now = new Date().toISOString();
    this.statements.insertAdminUser.run({
      username,
      password_hash: passwordHash,
      role,
      enabled: enabled ? 1 : 0,
      failed_attempts: current ? Math.max(0, Number(current.failed_attempts) || 0) : 0,
      locked_until: current?.locked_until || null,
      last_login_at: current?.last_login_at || null,
      created_at: current?.created_at || now,
      updated_at: now
    });

    return this.getAdminUserByUsername(username);
  }

  getAdminUserByUsername(username) {
    const safe = String(username || '').trim().toLowerCase();
    if (!safe) {
      return null;
    }
    return this.statements.selectAdminUserByUsername.get(safe) || null;
  }

  listAdminUsers() {
    return this.statements.selectAdminUsers.all();
  }

  setAdminUserSecurity(id, { failed_attempts, locked_until, last_login_at } = {}) {
    const user = this.listAdminUsers().find((item) => Number(item.id) === Number(id));
    if (!user) {
      return null;
    }
    const now = new Date().toISOString();
    this.statements.updateAdminUserSecurity.run({
      id: Number(id),
      failed_attempts: Math.max(0, Number(failed_attempts === undefined ? user.failed_attempts : failed_attempts) || 0),
      locked_until: locked_until ? new Date(locked_until).toISOString() : null,
      last_login_at: last_login_at ? new Date(last_login_at).toISOString() : null,
      updated_at: now
    });
    return this.getAdminUserByUsername(user.username);
  }

  setAdminUser(id, changes = {}) {
    const current = this.listAdminUsers().find((item) => Number(item.id) === Number(id));
    if (!current) {
      return null;
    }

    const role = changes.role ? String(changes.role).trim().toLowerCase() : String(current.role || 'viewer').toLowerCase();
    if (!ALLOWED_ADMIN_ROLE.has(role)) {
      throw new Error('invalid admin role');
    }

    let passwordHash = '';
    if (changes.password !== undefined && String(changes.password || '').trim()) {
      passwordHash = this.hashAdminPassword(changes.password);
    } else if (changes.password_hash || changes.passwordHash) {
      passwordHash = String(changes.password_hash || changes.passwordHash || '').trim();
    } else {
      const currentWithHash = this.getAdminUserByUsername(current.username);
      passwordHash = String(currentWithHash?.password_hash || '').trim();
    }

    const enabled = changes.enabled === undefined ? current.enabled === 1 : Boolean(changes.enabled);

    this.statements.updateAdminUser.run({
      id: Number(id),
      role,
      enabled: enabled ? 1 : 0,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    });

    return this.getAdminUserByUsername(current.username);
  }

  deleteAdminUserById(id) {
    const result = this.statements.deleteAdminUserById.run(Number(id));
    return result.changes > 0;
  }

  addAuditLog(input = {}) {
    const payload = {
      actor_username: String(input.actor_username || input.actorUsername || '').trim(),
      actor_role: String(input.actor_role || input.actorRole || '').trim().toLowerCase(),
      method: String(input.method || '').trim().toUpperCase(),
      path: String(input.path || '').trim(),
      action: String(input.action || '').trim(),
      resource: String(input.resource || '').trim(),
      status_code: Math.max(0, Number(input.status_code || input.statusCode || 0) || 0),
      details: JSON.stringify(this.normalizeJsonObject(input.details, {})),
      created_at: input.created_at ? new Date(input.created_at).toISOString() : new Date().toISOString()
    };

    this.statements.insertAuditLog.run(payload);
    return payload;
  }

  listAuditLogs(limit = 200) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 2000));
    return this.statements.selectAuditLogs
      .all(safeLimit)
      .map((row) => ({ ...row, details: this.normalizeJsonObject(row.details, {}) }));
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

  normalizeMediaUrl(value, { allowEmpty = true, fieldName = 'media_url' } = {}) {
    const raw = String(value || '').trim();
    if (!raw) {
      return allowEmpty ? null : '';
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
  }

  normalizeSchedulePayload(input) {
    const kind = String(input.kind || 'message').trim().toLowerCase();
    const content = String(input.content || '').trim();
    const media_url = this.normalizeMediaUrl(input.media_url || input.mediaUrl || null, {
      fieldName: 'schedule media_url'
    });
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
