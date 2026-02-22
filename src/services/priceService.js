class PriceService {
  constructor({ dexService, logger, cacheTtlMs = 10_000 }) {
    this.dexService = dexService;
    this.logger = logger;
    this.cacheTtlMs = cacheTtlMs;
    this.basePriceCache = new Map();
  }

  getCacheKey(symbol) {
    return String(symbol || '').toUpperCase();
  }

  getCachedBasePrice(symbol) {
    const key = this.getCacheKey(symbol);
    const entry = this.basePriceCache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.value;
  }

  setBasePrice(symbol, value) {
    const key = this.getCacheKey(symbol);
    this.basePriceCache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    });
  }

  coinGeckoIdBySymbol(symbol) {
    const map = {
      ETH: 'ethereum',
      WETH: 'ethereum',
      BNB: 'binancecoin',
      WBNB: 'binancecoin',
      MATIC: 'matic-network',
      WMATIC: 'matic-network',
      SOL: 'solana'
    };

    return map[String(symbol || '').toUpperCase()] || null;
  }

  async getBasePriceUsd(symbol) {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized) {
      return null;
    }

    if (['USDC', 'USDT', 'BUSD', 'DAI'].includes(normalized)) {
      return 1;
    }

    const cached = this.getCachedBasePrice(normalized);
    if (cached !== null) {
      return cached;
    }

    const coinId = this.coinGeckoIdBySymbol(normalized);
    if (!coinId) {
      return null;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const price = Number(data?.[coinId]?.usd);

      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      this.setBasePrice(normalized, price);
      return price;
    } catch (error) {
      this.logger.warn({ symbol: normalized, err: error.message }, 'base price lookup failed');
      return null;
    }
  }

  async enrichSwap(rawEvent) {
    const event = { ...rawEvent };

    let pairSnapshot = null;
    if (event.pairAddress) {
      pairSnapshot = await this.dexService.getPairSnapshot(event.network, event.pairAddress);
    }

    if (!pairSnapshot && event.tokenAddress) {
      pairSnapshot = await this.dexService.getTokenSnapshot(event.network, event.tokenAddress);
    }

    if (pairSnapshot) {
      event.dexUrl = event.dexUrl || pairSnapshot.dexUrl;
      event.marketCapUsd = Number.isFinite(pairSnapshot.marketCapUsd)
        ? pairSnapshot.marketCapUsd
        : pairSnapshot.fdvUsd;
      event.tokenName = event.tokenName || pairSnapshot.baseTokenName;
      event.tokenSymbol = event.tokenSymbol || pairSnapshot.baseTokenSymbol;
      event.tokenPriceUsd = Number.isFinite(pairSnapshot.priceUsd) ? pairSnapshot.priceUsd : null;
      event.pairAddress = event.pairAddress || pairSnapshot.pairAddress;
    }

    if (!Number.isFinite(event.usdValue) || event.usdValue <= 0) {
      if (Number.isFinite(event.baseAmount) && event.baseAmount > 0 && event.baseSymbol) {
        const basePrice = await this.getBasePriceUsd(event.baseSymbol);
        if (Number.isFinite(basePrice)) {
          event.usdValue = event.baseAmount * basePrice;
        }
      }
    }

    if ((!Number.isFinite(event.usdValue) || event.usdValue <= 0) && Number.isFinite(event.tokenAmount) && event.tokenAmount > 0) {
      if (Number.isFinite(event.tokenPriceUsd) && event.tokenPriceUsd > 0) {
        event.usdValue = event.tokenAmount * event.tokenPriceUsd;
      }
    }

    if (!event.dexUrl && event.pairAddress) {
      event.dexUrl = this.dexService.buildDexScreenerUrl(event.network, event.pairAddress);
    }

    return event;
  }
}

module.exports = PriceService;
