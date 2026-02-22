const TelegramBot = require('node-telegram-bot-api');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class TelegramClient {
  constructor({ token, groupIds, groupResolver, logger, polling = true, pollingParams = {} }) {
    this.logger = logger;
    this.envGroupIds = this.parseGroupIds(groupIds);
    this.groupResolver = typeof groupResolver === 'function' ? groupResolver : null;
    this.enablePolling = Boolean(polling);
    this.pollingParams = pollingParams && typeof pollingParams === 'object' ? pollingParams : {};
    this.bot = token
      ? new TelegramBot(
          token,
          this.enablePolling
            ? {
                polling: {
                  autoStart: false,
                  params: {
                    timeout: 30,
                    allowed_updates: ['message'],
                    ...this.pollingParams
                  }
                }
              }
            : { polling: false }
        )
      : null;
    this.warnedNoGroup = false;
    this.pollingStarted = false;
    this.me = null;

    if (!this.bot) {
      this.logger.warn('telegram token missing; alerts disabled');
    }

    if (!this.envGroupIds.length && !this.groupResolver) {
      this.logger.warn('no telegram groups configured; alerts disabled');
      this.warnedNoGroup = true;
    }
  }

  async start() {
    if (!this.bot || !this.enablePolling || this.pollingStarted) {
      return;
    }

    await this.bot.startPolling();
    this.pollingStarted = true;
    this.logger.info('telegram polling started');

    this.bot.on('polling_error', (error) => {
      this.logger.error({ err: error.message }, 'telegram polling error');
    });

    try {
      this.me = await this.bot.getMe();
      this.logger.info({ username: this.me?.username || '' }, 'telegram bot identity loaded');
    } catch (error) {
      this.logger.warn({ err: error.message }, 'failed to fetch telegram bot identity');
    }
  }

  onMessage(handler) {
    if (!this.bot || typeof handler !== 'function') {
      return;
    }

    this.bot.on('message', (message) => {
      Promise.resolve(handler(message)).catch((error) => {
        this.logger.error({ err: error.message }, 'telegram message handler failed');
      });
    });
  }

  parseGroupIds(raw) {
    if (!raw) {
      return [];
    }

    return String(raw)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  resolveGroupIds() {
    const set = new Set(this.envGroupIds);

    if (this.groupResolver) {
      try {
        const dynamicIds = this.groupResolver() || [];
        for (const id of dynamicIds) {
          const normalized = String(id || '').trim();
          if (normalized) {
            set.add(normalized);
          }
        }
      } catch (error) {
        this.logger.error({ err: error.message }, 'group resolver failed');
      }
    }

    const resolved = Array.from(set);
    if (!resolved.length && !this.warnedNoGroup) {
      this.logger.warn('no telegram groups configured; alerts disabled');
      this.warnedNoGroup = true;
    }

    if (resolved.length) {
      this.warnedNoGroup = false;
    }

    return resolved;
  }

  async sendMessage(chatId, message, options = {}) {
    if (!this.bot) {
      return;
    }

    const targetChatId = String(chatId || '').trim();
    if (!targetChatId) {
      throw new Error('chat id is required');
    }

    return this.sendWithRetry(
      targetChatId,
      () =>
        this.bot.sendMessage(targetChatId, String(message || ''), {
          disable_web_page_preview: true,
          ...options
        }),
      'sendMessage'
    );
  }

  async sendAlert(message, options = {}) {
    if (!this.bot) {
      return;
    }

    const targetGroups = Array.isArray(options.chatIds)
      ? options.chatIds.map((id) => String(id).trim()).filter(Boolean)
      : this.resolveGroupIds();

    if (!targetGroups.length) {
      return;
    }

    for (const groupId of targetGroups) {
      try {
        await this.sendMessage(groupId, message);
      } catch (error) {
        this.logger.error({ groupId, err: error.message }, 'failed to send alert to group');
      }
    }
  }

  async sendWithRetry(groupId, operation, operationName = 'send') {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const isLast = attempt === maxAttempts;
        this.logger.error(
          {
            groupId,
            attempt,
            operation: operationName,
            err: error.message
          },
          'telegram send failed'
        );

        if (isLast) {
          throw error;
        }

        await sleep(attempt * 750);
      }
    }
  }

  async getMe() {
    if (!this.bot) {
      return null;
    }

    if (this.me) {
      return this.me;
    }

    this.me = await this.bot.getMe();
    return this.me;
  }

  async getChatMember(chatId, userId) {
    if (!this.bot) {
      return null;
    }
    return this.bot.getChatMember(chatId, userId);
  }

  async getChatAdministrators(chatId) {
    if (!this.bot) {
      return [];
    }
    return this.bot.getChatAdministrators(chatId);
  }

  async deleteMessage(chatId, messageId) {
    if (!this.bot) {
      return false;
    }
    return this.bot.deleteMessage(chatId, messageId);
  }

  async banUser(chatId, userId, options = {}) {
    if (!this.bot) {
      return false;
    }
    return this.bot.banChatMember(chatId, userId, options);
  }

  async unbanUser(chatId, userId, options = {}) {
    if (!this.bot) {
      return false;
    }
    return this.bot.unbanChatMember(chatId, userId, options);
  }

  async kickUser(chatId, userId) {
    if (!this.bot) {
      return false;
    }

    await this.bot.banChatMember(chatId, userId, {
      revoke_messages: false
    });
    await this.bot.unbanChatMember(chatId, userId, {
      only_if_banned: true
    });
    return true;
  }

  async muteUser(chatId, userId, minutes = 10) {
    if (!this.bot) {
      return false;
    }

    const safeMinutes = Math.max(1, Math.min(Number(minutes) || 10, 10080));
    const untilDate = Math.floor(Date.now() / 1000) + safeMinutes * 60;

    return this.bot.restrictChatMember(chatId, userId, {
      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false
      },
      until_date: untilDate
    });
  }

  async unmuteUser(chatId, userId) {
    if (!this.bot) {
      return false;
    }

    return this.bot.restrictChatMember(chatId, userId, {
      permissions: {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: false,
        can_manage_topics: false
      }
    });
  }

  async sendDice(chatId, emoji = '🎲') {
    if (!this.bot) {
      return null;
    }

    return this.bot.sendDice(chatId, { emoji });
  }

  async setMyCommands(commands) {
    if (!this.bot) {
      return false;
    }

    return this.bot.setMyCommands(commands);
  }

  async close() {
    if (!this.bot) {
      return;
    }

    if (this.enablePolling && this.pollingStarted) {
      try {
        await this.bot.stopPolling();
      } catch (error) {
        this.logger.warn({ err: error.message }, 'telegram stop polling failed');
      }
      this.pollingStarted = false;
    }

    if (typeof this.bot.close === 'function') {
      try {
        await this.bot.close();
      } catch (error) {
        this.logger.warn({ err: error.message }, 'telegram close failed');
      }
    }
  }
}

module.exports = TelegramClient;
