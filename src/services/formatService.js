const { NETWORKS } = require('../config/networks');

class FormatService {
  classifyWhale(usdValue) {
    const usd = Number(usdValue) || 0;

    if (usd >= 250_000) {
      return { label: 'Leviathan Buy', emoji: '??' };
    }
    if (usd >= 100_000) {
      return { label: 'Mega Whale Buy', emoji: '??' };
    }
    if (usd >= 25_000) {
      return { label: 'Whale Buy', emoji: '??' };
    }
    if (usd >= 5_000) {
      return { label: 'Smart Money Buy', emoji: '??' };
    }

    return { label: 'Buy', emoji: '??' };
  }

  topEmoji(usdValue) {
    const usd = Number(usdValue) || 0;
    if (usd >= 100_000) {
      return '??';
    }
    return '??';
  }

  shortWallet(wallet) {
    const value = String(wallet || 'unknown');
    if (value.length <= 12) {
      return value;
    }

    if (value.startsWith('0x')) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }

    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  formatAmount(value, maxDigits = 4) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return 'N/A';
    }

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: maxDigits
    }).format(num);
  }

  formatUsd(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return 'N/A';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(num);
  }

  formatMarketCap(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return 'N/A';
    }

    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }

  explorerTxUrl(network, hash) {
    const base = NETWORKS[network]?.explorerTxBase;
    if (!base || !hash) {
      return null;
    }
    return `${base}${hash}`;
  }

  formatBuyAlert(event) {
    const whale = event.whale || this.classifyWhale(event.usdValue);
    const usd = this.formatUsd(event.usdValue);
    const amount = this.formatAmount(event.tokenAmount, 6);
    const marketCap = this.formatMarketCap(event.marketCapUsd);
    const networkLabel = NETWORKS[event.network]?.label || event.network;
    const tokenLabel = event.tokenName
      ? `${event.tokenName} (${event.tokenSymbol || 'TOKEN'})`
      : event.tokenSymbol || 'TOKEN';
    const txUrl = this.explorerTxUrl(event.network, event.hash);

    const lines = [
      `${this.topEmoji(event.usdValue)} NOVA COMPRA`,
      '',
      `?? ${tokenLabel}`,
      `?? ${amount} ${event.tokenSymbol || ''}`.trim(),
      `?? ${usd}`,
      `${whale.emoji} ${whale.label}`,
      `?? ${networkLabel}`,
      `?? ${this.shortWallet(event.buyer)}`,
      `?? MCap: ${marketCap}`,
      '',
      `?? View: ${event.dexUrl || 'N/A'}`,
      `?? Tx: ${txUrl || event.hash || 'N/A'}`,
      `#?? Hash: ${event.hash || 'N/A'}`
    ];

    return lines.join('\n');
  }
}

module.exports = FormatService;
