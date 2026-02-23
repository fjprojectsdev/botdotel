const PQueue = require('p-queue').default;

const BUY_JOB_TYPE = 'buy_event';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class QueueService {
  constructor({ telegramClient, tokenModel, priceService, formatService, logger, minUsdAlert = 0 }) {
    this.telegramClient = telegramClient;
    this.tokenModel = tokenModel;
    this.priceService = priceService;
    this.formatService = formatService;
    this.logger = logger;
    this.minUsdAlert = Number(minUsdAlert) || 0;

    this.processingQueue = new PQueue({
      concurrency: Number(process.env.PROCESS_CONCURRENCY || 8)
    });

    this.telegramQueue = new PQueue({
      concurrency: 1,
      interval: 1000,
      intervalCap: Number(process.env.TELEGRAM_RATE_CAP || 12)
    });

    this.inFlight = new Set();
    this.pendingDrain = false;
    this.closed = false;
    this.jobPumpTimer = null;

    this.metrics = {
      jobsClaimed: 0,
      jobsProcessed: 0,
      jobsRetried: 0,
      jobsDiscarded: 0,
      alertsDelivered: 0,
      alertsFailed: 0
    };
  }

  async start() {
    this.closed = false;

    const staleRequeued = this.tokenModel.requeueStalePendingJobs({
      staleSeconds: Number(process.env.PENDING_JOB_STALE_SECONDS || 120)
    });
    if (staleRequeued > 0) {
      this.logger.warn({ staleRequeued }, 'stale pending jobs requeued on startup');
    }

    this.jobPumpTimer = setInterval(() => {
      this.drainPendingJobs().catch((error) => {
        this.logger.error({ err: error.message }, 'pending job drain failed');
      });
    }, Number(process.env.PENDING_JOB_POLL_MS || 1500));

    setImmediate(() => {
      this.drainPendingJobs().catch((error) => {
        this.logger.error({ err: error.message }, 'pending job warmup drain failed');
      });
    });
  }

  setMinUsdAlert(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error('invalid min usd alert value');
    }

    this.minUsdAlert = numeric;
    this.logger.info({ minUsdAlert: this.minUsdAlert }, 'minimum usd alert updated');
  }

  getMinUsdAlert() {
    return this.minUsdAlert;
  }

  eventKey(event) {
    const eventUid = this.tokenModel.buildEventUid({
      network: event.network,
      hash: event.hash,
      tokenAddress: event.tokenAddress || event.token_address,
      token: event.token || event.tokenSymbol,
      logIndex: event.logIndex ?? event.log_index ?? event.eventIndex ?? 0,
      eventUid: event.eventUid || event.event_uid
    });
    return eventUid;
  }

  dbTokenKey(event) {
    const token = event.tokenAddress || event.tokenSymbol || 'unknown-token';
    return `${event.network}:${token}`;
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

  normalizeTokenAddress(network, value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    return String(network || '').toLowerCase() === 'solana' ? raw : raw.toLowerCase();
  }

  findTokenByEvent(event) {
    const network = String(event?.network || '').trim().toLowerCase();
    if (!network) {
      return null;
    }

    const tokens = this.tokenModel.listTokens({ includeDisabled: true, network });
    if (!Array.isArray(tokens) || !tokens.length) {
      return null;
    }

    const normalizedAddress = this.normalizeTokenAddress(network, event?.tokenAddress);
    if (normalizedAddress) {
      const byAddress = tokens.find(
        (item) => this.normalizeTokenAddress(network, item.address) === normalizedAddress
      );
      if (byAddress) {
        return byAddress;
      }
    }

    const symbol = String(event?.tokenSymbol || '').trim().toUpperCase();
    if (symbol) {
      const bySymbol = tokens.find((item) => String(item.symbol || '').trim().toUpperCase() === symbol);
      if (bySymbol) {
        return bySymbol;
      }
    }

    return null;
  }

  getBuyAlertMediaUrl(event = null) {
    const token = event ? this.findTokenByEvent(event) : null;
    const tokenMedia = this.normalizeMediaUrl(token?.buy_media_url || token?.buyMediaUrl || '');
    if (tokenMedia) {
      return tokenMedia;
    }

    const saved = this.tokenModel.getSetting('media_buy_alert_url');
    return this.normalizeMediaUrl(saved);
  }

  enqueueBuy(rawEvent) {
    if (!rawEvent || !rawEvent.network || !rawEvent.hash) {
      return null;
    }

    let job = null;
    try {
      job = this.tokenModel.enqueuePendingJob({
        job_type: BUY_JOB_TYPE,
        payload: rawEvent
      });
    } catch (error) {
      this.logger.error({ err: error.message, rawEvent }, 'failed to persist buy job');
      return null;
    }

    this.drainPendingJobs().catch((error) => {
      this.logger.error({ err: error.message }, 'pending job drain trigger failed');
    });

    return job;
  }

  async drainPendingJobs() {
    if (this.closed || this.pendingDrain) {
      return;
    }

    this.pendingDrain = true;
    try {
      const batchSize = clamp(Number(process.env.PENDING_JOB_BATCH || 80), 1, 500);
      const jobs = this.tokenModel.claimPendingJobs(BUY_JOB_TYPE, batchSize);
      if (!jobs.length) {
        return;
      }

      this.metrics.jobsClaimed += jobs.length;
      for (const job of jobs) {
        this.processingQueue
          .add(() => this.processPendingJob(job))
          .catch((error) => {
            this.logger.error({ err: error.message, jobId: job.id }, 'pending job processor failed');
          });
      }
    } finally {
      this.pendingDrain = false;
    }
  }

  computeRetryDelayMs(attempts) {
    const safeAttempts = clamp(Number(attempts) || 1, 1, 10);
    return Math.min(120_000, 2_000 * 2 ** (safeAttempts - 1));
  }

  async processPendingJob(job) {
    const jobId = Number(job?.id || 0);
    if (!jobId) {
      return;
    }

    let rawEvent = null;
    try {
      rawEvent = JSON.parse(String(job.payload || '{}'));
    } catch (error) {
      this.metrics.jobsDiscarded += 1;
      this.tokenModel.markPendingJobDone(jobId);
      this.logger.warn({ jobId, err: error.message }, 'discarding malformed pending job payload');
      return;
    }

    try {
      await this.processBuy(rawEvent);
      this.metrics.jobsProcessed += 1;
      this.tokenModel.markPendingJobDone(jobId);
    } catch (error) {
      const currentAttempts = Math.max(0, Number(job.attempts || 0)) + 1;
      const maxAttempts = clamp(Number(process.env.PENDING_JOB_MAX_ATTEMPTS || 7), 1, 20);

      if (currentAttempts >= maxAttempts) {
        this.metrics.jobsDiscarded += 1;
        this.tokenModel.markPendingJobDone(jobId);
        this.logger.error(
          { jobId, attempts: currentAttempts, err: error.message },
          'pending job discarded after max retries'
        );
        return;
      }

      const retryDelayMs = this.computeRetryDelayMs(currentAttempts);
      this.metrics.jobsRetried += 1;
      this.tokenModel.markPendingJobRetry(jobId, error.message, retryDelayMs);
      this.logger.warn(
        { jobId, attempts: currentAttempts, retryDelayMs, err: error.message },
        'pending job scheduled for retry'
      );
    }
  }

  async processBuy(rawEvent) {
    if (!rawEvent?.network || !rawEvent?.hash) {
      return;
    }

    const key = this.eventKey(rawEvent);
    if (this.inFlight.has(key)) {
      return;
    }

    this.inFlight.add(key);

    try {
      if (this.tokenModel.hasTransactionByEventUid(key)) {
        return;
      }

      const tokenKey = this.dbTokenKey(rawEvent);
      if (this.tokenModel.hasTransaction(tokenKey, rawEvent.hash)) {
        return;
      }

      const enriched = await this.priceService.enrichSwap(rawEvent);
      const tokenAmount = Number(enriched.tokenAmount);
      const usdValue = Number(enriched.usdValue);
      const hasReliableUsd = Number.isFinite(usdValue) && usdValue > 0;
      const normalizedUsdValue = hasReliableUsd ? usdValue : 0;
      const logIndex = Math.max(0, Number(enriched.logIndex ?? enriched.log_index ?? enriched.eventIndex ?? 0) || 0);

      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        return;
      }

      const saved = this.tokenModel.saveTransaction({
        token: tokenKey,
        network: enriched.network,
        hash: enriched.hash,
        log_index: logIndex,
        event_uid: key,
        tokenAddress: enriched.tokenAddress,
        buyer: enriched.buyer || 'unknown',
        amount: tokenAmount,
        usd_value: normalizedUsdValue,
        timestamp: enriched.timestamp || new Date().toISOString()
      });

      if (!saved) {
        return;
      }

      if (!hasReliableUsd) {
        this.logger.debug(
          {
            network: enriched.network,
            hash: enriched.hash,
            token: enriched.tokenSymbol
          },
          'transaction stored without reliable usd value; alert skipped'
        );
        return;
      }

      if (this.minUsdAlert > 0 && usdValue < this.minUsdAlert) {
        this.logger.debug(
          {
            network: enriched.network,
            hash: enriched.hash,
            token: enriched.tokenSymbol,
            usdValue,
            minUsdAlert: this.minUsdAlert
          },
          'transaction stored below min usd alert; telegram alert skipped'
        );
        return;
      }

      enriched.whale = this.formatService.classifyWhale(usdValue);
      const message = this.formatService.formatBuyAlert(enriched);
      const mediaUrl = this.getBuyAlertMediaUrl(enriched);

      const delivery = await this.telegramQueue.add(() =>
        this.telegramClient.sendAlert(message, {
          mediaUrl: mediaUrl || undefined
        })
      );

      const delivered = Math.max(0, Number(delivery?.delivered) || 0);
      const attempted = Math.max(0, Number(delivery?.attempted) || 0);
      if (!delivered) {
        this.metrics.alertsFailed += attempted || 1;
        const reason = String(delivery?.reason || 'not delivered');
        this.logger.warn(
          {
            network: enriched.network,
            token: enriched.tokenSymbol,
            hash: enriched.hash,
            usdValue,
            media: Boolean(mediaUrl),
            attempted,
            reason
          },
          'buy alert persisted but not delivered to telegram'
        );

        if (/403|forbidden|kicked|chat not found|bot was blocked|deactivated/i.test(reason)) {
          throw new Error(`permanent telegram delivery failure: ${reason}`);
        }
        return;
      }

      this.metrics.alertsDelivered += delivered;
      this.logger.info(
        {
          network: enriched.network,
          token: enriched.tokenSymbol,
          hash: enriched.hash,
          usdValue,
          media: Boolean(mediaUrl),
          attempted,
          delivered
        },
        'buy alert sent'
      );
    } finally {
      this.inFlight.delete(key);
    }
  }

  getStatus() {
    const pendingStats = this.tokenModel.getPendingJobStats();
    return {
      minUsdAlert: this.minUsdAlert,
      processPending: this.processingQueue.pending,
      processSize: this.processingQueue.size,
      telegramPending: this.telegramQueue.pending,
      telegramSize: this.telegramQueue.size,
      inFlight: this.inFlight.size,
      pendingJobs: pendingStats,
      metrics: { ...this.metrics }
    };
  }

  async shutdown() {
    this.closed = true;
    if (this.jobPumpTimer) {
      clearInterval(this.jobPumpTimer);
      this.jobPumpTimer = null;
    }

    await this.processingQueue.onIdle();
    await this.telegramQueue.onIdle();
  }
}

module.exports = QueueService;
