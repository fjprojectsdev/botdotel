const { NETWORKS } = require('../config/networks');

class DexService {
  constructor({ logger, cacheTtlMs = 10_000 }) {
    this.logger = logger;
    this.cacheTtlMs = cacheTtlMs;
    this.cache = new Map();
  }

  getChainSlug(network) {
    return NETWORKS[network]?.dexChain || network;
  }

  getCached(url) {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      return null;
    }

    return entry.value;
  }

  setCache(url, value) {
    this.cache.set(url, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    });
  }

  async fetchJson(url) {
    const cached = this.getCached(url);
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.setCache(url, data);
      return data;
    } catch (error) {
      this.logger.warn({ url, err: error.message }, 'dex request failed');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  buildDexScreenerUrl(network, pairAddress) {
    if (!pairAddress) {
      return null;
    }

    const slug = this.getChainSlug(network);
    return `https://dexscreener.com/${slug}/${pairAddress}`;
  }

  async getPairSnapshot(network, pairAddress) {
    if (!pairAddress) {
      return null;
    }

    const slug = this.getChainSlug(network);
    const url = `https://api.dexscreener.com/latest/dex/pairs/${slug}/${pairAddress}`;
    const data = await this.fetchJson(url);

    const pair = data?.pair || (Array.isArray(data?.pairs) ? data.pairs[0] : null);
    if (!pair) {
      return null;
    }

    return {
      pairAddress: pair.pairAddress || pairAddress,
      priceUsd: Number(pair.priceUsd),
      marketCapUsd: Number(pair.marketCap),
      fdvUsd: Number(pair.fdv),
      dexUrl: pair.url || this.buildDexScreenerUrl(network, pairAddress),
      baseTokenName: pair.baseToken?.name,
      baseTokenSymbol: pair.baseToken?.symbol
    };
  }

  async getTokenSnapshot(network, tokenAddress) {
    if (!tokenAddress) {
      return null;
    }

    const slug = this.getChainSlug(network);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const data = await this.fetchJson(url);

    if (!Array.isArray(data?.pairs) || !data.pairs.length) {
      return null;
    }

    const pair = data.pairs.find((item) => item.chainId === slug) || data.pairs[0];
    if (!pair) {
      return null;
    }

    return {
      pairAddress: pair.pairAddress,
      priceUsd: Number(pair.priceUsd),
      marketCapUsd: Number(pair.marketCap),
      fdvUsd: Number(pair.fdv),
      dexUrl: pair.url,
      baseTokenName: pair.baseToken?.name,
      baseTokenSymbol: pair.baseToken?.symbol
    };
  }
}

module.exports = DexService;
