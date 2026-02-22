const PQueue = require('p-queue').default;

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
    return `${event.network}:${event.tokenAddress || event.tokenSymbol}:${event.hash}`;
  }

  dbTokenKey(event) {
    const token = event.tokenAddress || event.tokenSymbol || 'unknown-token';
    return `${event.network}:${token}`;
  }

  enqueueBuy(rawEvent) {
    this.processingQueue
      .add(() => this.processBuy(rawEvent))
      .catch((error) => {
        this.logger.error({ err: error.message, event: rawEvent }, 'queue job failed');
      });
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
      const tokenKey = this.dbTokenKey(rawEvent);
      if (this.tokenModel.hasTransaction(tokenKey, rawEvent.hash)) {
        return;
      }

      const enriched = await this.priceService.enrichSwap(rawEvent);
      const tokenAmount = Number(enriched.tokenAmount);
      const usdValue = Number(enriched.usdValue);

      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        return;
      }

      if (!Number.isFinite(usdValue) || usdValue <= 0) {
        this.logger.debug(
          {
            network: enriched.network,
            hash: enriched.hash,
            token: enriched.tokenSymbol
          },
          'skipping event without reliable usd value'
        );
        return;
      }

      if (this.minUsdAlert > 0 && usdValue < this.minUsdAlert) {
        return;
      }

      enriched.whale = this.formatService.classifyWhale(usdValue);
      const message = this.formatService.formatBuyAlert(enriched);

      const saved = this.tokenModel.saveTransaction({
        token: tokenKey,
        network: enriched.network,
        hash: enriched.hash,
        buyer: enriched.buyer || 'unknown',
        amount: tokenAmount,
        usd_value: usdValue,
        timestamp: enriched.timestamp || new Date().toISOString()
      });

      if (!saved) {
        return;
      }

      await this.telegramQueue.add(() => this.telegramClient.sendAlert(message));

      this.logger.info(
        {
          network: enriched.network,
          token: enriched.tokenSymbol,
          hash: enriched.hash,
          usdValue
        },
        'buy alert sent'
      );
    } catch (error) {
      this.logger.error({ err: error.message, rawEvent }, 'failed to process buy event');
    } finally {
      this.inFlight.delete(key);
    }
  }

  async shutdown() {
    await this.processingQueue.onIdle();
    await this.telegramQueue.onIdle();
  }
}

module.exports = QueueService;
