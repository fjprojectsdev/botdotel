const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SchedulerService {
  constructor({ tokenModel, telegramClient, logger, intervalMs = 15_000 }) {
    this.tokenModel = tokenModel;
    this.telegramClient = telegramClient;
    this.logger = logger;
    this.intervalMs = intervalMs;

    this.running = false;
    this.loopPromise = null;
    this.processingIds = new Set();
  }

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.loopPromise = this.loop();
    this.logger.info({ intervalMs: this.intervalMs }, 'scheduler service started');
  }

  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch (_) {
        // no-op
      }
    }

    this.logger.info('scheduler service stopped');
  }

  parseGroupIds(csv) {
    return String(csv || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  buildScheduleMessage(schedule) {
    const prefix = schedule.kind === 'poll' ? '📊 AGENDAMENTO (Enquete)' : '📅 AGENDAMENTO';
    return `${prefix}\n\n${schedule.content}`;
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

  resolveScheduleMediaUrl(schedule) {
    const scheduleMedia = this.normalizeMediaUrl(schedule?.media_url);
    if (scheduleMedia) {
      return scheduleMedia;
    }

    const fallback = this.tokenModel.getSetting('media_schedule_url');
    return this.normalizeMediaUrl(fallback);
  }

  computeNextDailyIso(sendAtIso) {
    const current = new Date(sendAtIso);
    if (Number.isNaN(current.getTime())) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    const next = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    return next.toISOString();
  }

  async processSchedule(schedule) {
    if (this.processingIds.has(schedule.id)) {
      return;
    }

    this.processingIds.add(schedule.id);

    try {
      const targetGroups = this.parseGroupIds(schedule.group_ids);
      const message = this.buildScheduleMessage(schedule);
      const mediaUrl = this.resolveScheduleMediaUrl(schedule);

      await this.telegramClient.sendAlert(message, {
        chatIds: targetGroups.length ? targetGroups : undefined,
        mediaUrl: mediaUrl || undefined
      });

      if (schedule.recurrence === 'daily') {
        const nextIso = this.computeNextDailyIso(schedule.send_at);
        this.tokenModel.rescheduleDaily(schedule.id, nextIso);

        this.logger.info(
          {
            scheduleId: schedule.id,
            nextSendAt: nextIso
          },
          'daily schedule delivered and rescheduled'
        );
      } else {
        this.tokenModel.markScheduleSent(schedule.id);
        this.logger.info({ scheduleId: schedule.id }, 'schedule delivered');
      }
    } catch (error) {
      this.tokenModel.markScheduleFailed(schedule.id, error.message);
      this.logger.error(
        {
          scheduleId: schedule.id,
          err: error.message
        },
        'failed to deliver scheduled message'
      );
    } finally {
      this.processingIds.delete(schedule.id);
    }
  }

  async loop() {
    while (this.running) {
      try {
        const due = this.tokenModel.getDueSchedules(25);

        for (const schedule of due) {
          await this.processSchedule(schedule);
        }
      } catch (error) {
        this.logger.error({ err: error.message }, 'scheduler loop error');
      }

      await sleep(this.intervalMs);
    }
  }
}

module.exports = SchedulerService;
