const { Telegraf } = require('telegraf');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class TelegramClient {
  constructor({ token, groupIds, groupResolver, logger, polling = true, pollingParams = {} }) {
    this.logger = logger;
    this.envGroupIds = this.parseGroupIds(groupIds);
    this.groupResolver = typeof groupResolver === 'function' ? groupResolver : null;
    this.enablePolling = Boolean(polling);
    this.pollingParams = pollingParams && typeof pollingParams === 'object' ? pollingParams : {};
    this.bot = token ? new Telegraf(token, { handlerTimeout: 60_000 }) : null;
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

    await this.bot.launch({
      dropPendingUpdates: false,
      polling: {
        timeout: 30,
        allowedUpdates: ['message'],
        ...this.pollingParams
      }
    });
    this.pollingStarted = true;
    this.logger.info('telegram polling started');

    this.bot.catch((error) => {
      this.logger.error({ err: error.message }, 'telegram polling error');
    });

    try {
      this.me = await this.bot.telegram.getMe();
      this.logger.info({ username: this.me?.username || '' }, 'telegram bot identity loaded');
    } catch (error) {
      this.logger.warn({ err: error.message }, 'failed to fetch telegram bot identity');
    }
  }

  onMessage(handler) {
    if (!this.bot || typeof handler !== 'function') {
      return;
    }

    this.bot.on('message', (ctx) => {
      const message = ctx?.update?.message || ctx?.message;
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
      return {
        sent: false,
        skipped: true,
        reason: 'bot_unavailable',
        operation: 'sendMessage',
        chatId: String(chatId || '').trim()
      };
    }

    const targetChatId = String(chatId || '').trim();
    if (!targetChatId) {
      throw new Error('chat id is required');
    }

    const response = await this.sendWithRetry(
      targetChatId,
      () =>
        this.bot.telegram.sendMessage(targetChatId, String(message || ''), {
          disable_web_page_preview: true,
          ...options
        }),
      'sendMessage'
    );
    return {
      sent: true,
      skipped: false,
      operation: 'sendMessage',
      chatId: targetChatId,
      response
    };
  }

  normalizeMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.toString();
    } catch (_error) {
      return '';
    }
  }

  async sendPhoto(chatId, mediaUrl, caption = '', options = {}) {
    if (!this.bot) {
      return {
        sent: false,
        skipped: true,
        reason: 'bot_unavailable',
        operation: 'sendPhoto',
        chatId: String(chatId || '').trim()
      };
    }

    const targetChatId = String(chatId || '').trim();
    const photo = this.normalizeMediaUrl(mediaUrl);
    if (!targetChatId) {
      throw new Error('chat id is required');
    }
    if (!photo) {
      throw new Error('media url is required');
    }

    const captionText = String(caption || '').trim();

    const response = await this.sendWithRetry(
      targetChatId,
      () =>
        this.bot.telegram.sendPhoto(targetChatId, photo, {
          ...(captionText ? { caption: captionText } : {}),
          ...options
        }),
      'sendPhoto'
    );
    return {
      sent: true,
      skipped: false,
      operation: 'sendPhoto',
      chatId: targetChatId,
      response
    };
  }

  async sendAlert(message, options = {}) {
    if (!this.bot) {
      return {
        ok: false,
        attempted: 0,
        delivered: 0,
        failed: 0,
        fallbackUsed: 0,
        media: false,
        reason: 'bot_unavailable',
        results: []
      };
    }

    const targetGroups = Array.isArray(options.chatIds)
      ? options.chatIds.map((id) => String(id).trim()).filter(Boolean)
      : this.resolveGroupIds();

    if (!targetGroups.length) {
      return {
        ok: false,
        attempted: 0,
        delivered: 0,
        failed: 0,
        fallbackUsed: 0,
        media: false,
        reason: 'no_target_groups',
        results: []
      };
    }

    const mediaUrl = this.normalizeMediaUrl(options.mediaUrl);
    const messageText = String(message || '').trim();
    const results = [];
    let delivered = 0;
    let failed = 0;
    let fallbackUsed = 0;

    for (const groupId of targetGroups) {
      let sent = false;
      let usedFallback = false;
      let failureReason = '';

      try {
        if (mediaUrl) {
          if (messageText.length <= 1024) {
            const mediaResult = await this.sendPhoto(groupId, mediaUrl, messageText);
            sent = Boolean(mediaResult?.sent);
          } else {
            const mediaResult = await this.sendPhoto(groupId, mediaUrl, 'Atualizacao');
            const textResult = await this.sendMessage(groupId, messageText);
            sent = Boolean(mediaResult?.sent) && Boolean(textResult?.sent);
          }
        } else {
          const textResult = await this.sendMessage(groupId, messageText);
          sent = Boolean(textResult?.sent);
        }
      } catch (error) {
        failureReason = String(error?.message || 'send failed');
        if (mediaUrl) {
          try {
            const fallbackResult = await this.sendMessage(groupId, messageText);
            if (fallbackResult?.sent) {
              sent = true;
              usedFallback = true;
              fallbackUsed += 1;
              this.logger.warn(
                { groupId, err: error.message },
                'failed to send media alert; fallback to text message sent'
              );
            }
          } catch (fallbackError) {
            failureReason = `${error.message}; fallback: ${fallbackError.message}`;
          }
        }
        if (!sent) {
          this.logger.error({ groupId, err: error.message }, 'failed to send alert to group');
        }
      }

      if (sent) {
        delivered += 1;
      } else {
        failed += 1;
      }

      results.push({
        groupId,
        sent,
        fallback: usedFallback,
        error: sent ? '' : failureReason || 'not delivered'
      });
    }

    const summary = {
      ok: delivered > 0,
      attempted: targetGroups.length,
      delivered,
      failed,
      fallbackUsed,
      media: Boolean(mediaUrl),
      reason: delivered > 0 ? '' : results[0]?.error || 'not delivered',
      results
    };

    if (options.throwOnFailure && delivered === 0) {
      throw new Error(summary.reason || 'telegram delivery failed');
    }

    return summary;
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

    this.me = await this.bot.telegram.getMe();
    return this.me;
  }

  async getChat(chatIdOrUsername) {
    if (!this.bot) {
      return null;
    }
    return this.bot.telegram.getChat(chatIdOrUsername);
  }

  async getChatMember(chatId, userId) {
    if (!this.bot) {
      return null;
    }
    return this.bot.telegram.getChatMember(chatId, userId);
  }

  async getChatAdministrators(chatId) {
    if (!this.bot) {
      return [];
    }
    return this.bot.telegram.getChatAdministrators(chatId);
  }

  async deleteMessage(chatId, messageId) {
    if (!this.bot) {
      return false;
    }
    return this.bot.telegram.deleteMessage(chatId, messageId);
  }

  async banUser(chatId, userId, options = {}) {
    if (!this.bot) {
      return false;
    }
    return this.bot.telegram.banChatMember(chatId, userId, options);
  }

  async unbanUser(chatId, userId, options = {}) {
    if (!this.bot) {
      return false;
    }
    return this.bot.telegram.unbanChatMember(chatId, userId, options);
  }

  async kickUser(chatId, userId) {
    if (!this.bot) {
      return false;
    }

    await this.bot.telegram.banChatMember(chatId, userId, {
      revoke_messages: false
    });
    await this.bot.telegram.unbanChatMember(chatId, userId, {
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

    return this.bot.telegram.restrictChatMember(chatId, userId, {
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

    return this.bot.telegram.restrictChatMember(chatId, userId, {
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

  async sendDice(chatId, emoji = '\u{1F3B2}') {
    if (!this.bot) {
      return null;
    }

    return this.bot.telegram.sendDice(chatId, { emoji });
  }

  async setMyCommands(commands) {
    if (!this.bot) {
      return false;
    }

    return this.bot.telegram.setMyCommands(commands);
  }

  async close() {
    if (!this.bot) {
      return;
    }

    if (this.enablePolling && this.pollingStarted) {
      try {
        this.bot.stop('manual-stop');
      } catch (error) {
        this.logger.warn({ err: error.message }, 'telegram stop polling failed');
      }
      this.pollingStarted = false;
    }
  }
}

module.exports = TelegramClient;
