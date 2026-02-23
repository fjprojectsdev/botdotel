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
      const hasReliableUsd = Number.isFinite(usdValue) && usdValue > 0;
      const normalizedUsdValue = hasReliableUsd ? usdValue : 0;

      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        return;
      }

      const saved = this.tokenModel.saveTransaction({
        token: tokenKey,
        network: enriched.network,
        hash: enriched.hash,
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
        this.logger.warn(
          {
            network: enriched.network,
            token: enriched.tokenSymbol,
            hash: enriched.hash,
            usdValue,
            media: Boolean(mediaUrl),
            attempted,
            reason: String(delivery?.reason || 'not delivered')
          },
          'buy alert persisted but not delivered to telegram'
        );
        return;
      }

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
