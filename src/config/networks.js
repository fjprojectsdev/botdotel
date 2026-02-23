const toLowerKeyMap = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key.toLowerCase()] = value;
  }
  return out;
};

const parseRpcUrls = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((entry) =>
          String(entry || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        )
        .filter(Boolean)
    )
  );

const ETH_RPC_URLS = parseRpcUrls(process.env.ETH_RPC, process.env.ETH_RPC_FALLBACKS);
const BSC_RPC_URLS = parseRpcUrls(process.env.BSC_RPC, process.env.BSC_RPC_FALLBACKS);
const BASE_RPC_URLS = parseRpcUrls(process.env.BASE_RPC, process.env.BASE_RPC_FALLBACKS);
const POLYGON_RPC_URLS = parseRpcUrls(process.env.POLYGON_RPC, process.env.POLYGON_RPC_FALLBACKS);
const SOLANA_RPC_URLS = parseRpcUrls(process.env.SOLANA_RPC, process.env.SOLANA_RPC_FALLBACKS);

const NETWORKS = Object.freeze({
  ethereum: {
    key: 'ethereum',
    label: 'Ethereum',
    type: 'evm',
    rpcUrl: ETH_RPC_URLS[0] || '',
    rpcUrls: ETH_RPC_URLS,
    dexChain: 'ethereum',
    nativeSymbol: 'ETH',
    explorerTxBase: 'https://etherscan.io/tx/',
    blockChunk: 200,
    quoteTokens: toLowerKeyMap({
      '0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2': { symbol: 'ETH', decimals: 18 },
      '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': { symbol: 'USDT', decimals: 6 },
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': { symbol: 'DAI', decimals: 18 }
    })
  },
  bsc: {
    key: 'bsc',
    label: 'BSC',
    type: 'evm',
    rpcUrl: BSC_RPC_URLS[0] || '',
    rpcUrls: BSC_RPC_URLS,
    dexChain: 'bsc',
    nativeSymbol: 'BNB',
    explorerTxBase: 'https://bscscan.com/tx/',
    blockChunk: 400,
    quoteTokens: toLowerKeyMap({
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': { symbol: 'BNB', decimals: 18 },
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { symbol: 'USDC', decimals: 18 },
      '0x55d398326f99059fF775485246999027B3197955': { symbol: 'USDT', decimals: 18 },
      '0xe9e7cea3dedca5984780bafc599bd69add087d56': { symbol: 'BUSD', decimals: 18 }
    })
  },
  base: {
    key: 'base',
    label: 'Base',
    type: 'evm',
    rpcUrl: BASE_RPC_URLS[0] || '',
    rpcUrls: BASE_RPC_URLS,
    dexChain: 'base',
    nativeSymbol: 'ETH',
    explorerTxBase: 'https://basescan.org/tx/',
    blockChunk: 600,
    quoteTokens: toLowerKeyMap({
      '0x4200000000000000000000000000000000000006': { symbol: 'ETH', decimals: 18 },
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': { symbol: 'USDC', decimals: 6 }
    })
  },
  polygon: {
    key: 'polygon',
    label: 'Polygon',
    type: 'evm',
    rpcUrl: POLYGON_RPC_URLS[0] || '',
    rpcUrls: POLYGON_RPC_URLS,
    dexChain: 'polygon',
    nativeSymbol: 'MATIC',
    explorerTxBase: 'https://polygonscan.com/tx/',
    blockChunk: 800,
    quoteTokens: toLowerKeyMap({
      '0x0d500B1d8E8eE31E21C99d1Db9A6444d3ADf1270': { symbol: 'MATIC', decimals: 18 },
      '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { symbol: 'USDC', decimals: 6 },
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': { symbol: 'USDT', decimals: 6 },
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063': { symbol: 'DAI', decimals: 18 }
    })
  },
  solana: {
    key: 'solana',
    label: 'Solana',
    type: 'solana',
    rpcUrl: SOLANA_RPC_URLS[0] || '',
    rpcUrls: SOLANA_RPC_URLS,
    dexChain: 'solana',
    nativeSymbol: 'SOL',
    explorerTxBase: 'https://solscan.io/tx/',
    stableMints: {
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', decimals: 6 },
      Es9vMFrzaCERmJfrF4H2rA6cJSteUms9UpAJZxkdjPzU: { symbol: 'USDT', decimals: 6 }
    },
    dexPrograms: [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      'CAMMCzo5YL8w4VFF8KVHrK22GGUQyE3jg2x7xLw3j2s'
    ]
  }
});

const resolveEnabledNetworks = (raw) => {
  const all = Object.keys(NETWORKS);
  if (!raw || !raw.trim()) {
    return all;
  }

  const requested = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return requested.filter((item) => all.includes(item));
};

module.exports = {
  NETWORKS,
  resolveEnabledNetworks
};
