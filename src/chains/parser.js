const { formatUnits } = require('ethers');

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toAmount = (raw, decimals) => {
  try {
    return toNumber(formatUnits(raw, decimals));
  } catch (_) {
    return null;
  }
};

const parseEvmSwap = ({ parsedLog, log, pairMeta, network }) => {
  const amount0In = parsedLog.args.amount0In;
  const amount1In = parsedLog.args.amount1In;
  const amount0Out = parsedLog.args.amount0Out;
  const amount1Out = parsedLog.args.amount1Out;

  const tokenIs0 = pairMeta.trackedToken === pairMeta.token0;
  const tokenIs1 = pairMeta.trackedToken === pairMeta.token1;

  let tokenOutRaw = 0n;
  let quoteInRaw = 0n;
  let quoteToken = null;

  if (tokenIs0 && amount1In > 0n && amount0Out > 0n) {
    tokenOutRaw = amount0Out;
    quoteInRaw = amount1In;
    quoteToken = pairMeta.token1;
  } else if (tokenIs1 && amount0In > 0n && amount1Out > 0n) {
    tokenOutRaw = amount1Out;
    quoteInRaw = amount0In;
    quoteToken = pairMeta.token0;
  } else {
    return null;
  }

  const quote = pairMeta.quoteTokens[quoteToken];
  if (!quote) {
    return null;
  }

  const tokenAmount = toAmount(tokenOutRaw, pairMeta.decimals);
  const baseAmount = toAmount(quoteInRaw, quote.decimals);

  if (!tokenAmount || tokenAmount <= 0 || !baseAmount || baseAmount <= 0) {
    return null;
  }

  const logIndex = Math.max(0, Number(log?.logIndex ?? log?.index ?? 0) || 0);
  const eventUid = `${String(network || '').toLowerCase()}:${String(log.transactionHash || '').toLowerCase()}:${String(
    pairMeta.trackedToken || ''
  ).toLowerCase()}:${logIndex}`;

  return {
    network,
    tokenName: pairMeta.name,
    tokenSymbol: pairMeta.symbol,
    tokenAddress: pairMeta.trackedToken,
    pairAddress: log.address,
    hash: log.transactionHash,
    logIndex,
    eventUid,
    buyer: parsedLog.args.to,
    tokenAmount,
    baseAmount,
    baseSymbol: quote.symbol,
    timestamp: new Date().toISOString()
  };
};

const normalizeAccountKeys = (accountKeys) => {
  return accountKeys.map((key) => {
    if (typeof key === 'string') {
      return key;
    }

    if (key?.pubkey?.toBase58) {
      return key.pubkey.toBase58();
    }

    if (key?.pubkey?.toString) {
      return key.pubkey.toString();
    }

    return String(key?.pubkey || key);
  });
};

const uiAmount = (balance) => {
  const raw = balance?.uiTokenAmount?.uiAmountString;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const buildTokenBalanceMap = (meta) => {
  const map = new Map();

  const write = (entry, side) => {
    const owner = entry?.owner;
    const mint = entry?.mint;
    if (!owner || !mint) {
      return;
    }

    const key = `${owner}:${mint}`;
    const current = map.get(key) || {
      owner,
      mint,
      pre: 0,
      post: 0
    };

    current[side] = uiAmount(entry);
    map.set(key, current);
  };

  for (const entry of meta.preTokenBalances || []) {
    write(entry, 'pre');
  }

  for (const entry of meta.postTokenBalances || []) {
    write(entry, 'post');
  }

  return map;
};

const solSpentByOwner = (owner, parsedTx) => {
  const meta = parsedTx.meta;
  const accountKeys = normalizeAccountKeys(parsedTx.transaction.message.accountKeys || []);
  const idx = accountKeys.findIndex((key) => key === owner);
  if (idx < 0) {
    return 0;
  }

  const pre = meta.preBalances?.[idx] || 0;
  const post = meta.postBalances?.[idx] || 0;
  const spentLamports = pre - post;

  if (spentLamports <= 0) {
    return 0;
  }

  return spentLamports / 1_000_000_000;
};

const stableSpentByOwner = (owner, tokenBalanceMap, stableMints) => {
  let best = null;

  for (const item of tokenBalanceMap.values()) {
    if (item.owner !== owner) {
      continue;
    }

    const stableMeta = stableMints[item.mint];
    if (!stableMeta) {
      continue;
    }

    const delta = item.post - item.pre;
    if (delta >= 0) {
      continue;
    }

    const spent = Math.abs(delta);
    if (!best || spent > best.amount) {
      best = {
        amount: spent,
        symbol: stableMeta.symbol
      };
    }
  }

  return best;
};

const parseSolanaSwap = ({ parsedTx, trackedTokensByMint, signature, network, stableMints }) => {
  if (!parsedTx?.meta || !trackedTokensByMint.size) {
    return [];
  }

  const tokenBalanceMap = buildTokenBalanceMap(parsedTx.meta);
  const events = [];
  let eventIndex = 0;
  const blockTime = parsedTx.blockTime ? new Date(parsedTx.blockTime * 1000).toISOString() : new Date().toISOString();

  for (const [mint, tracked] of trackedTokensByMint.entries()) {
    const ownerTokenAmount = new Map();

    for (const item of tokenBalanceMap.values()) {
      if (item.mint !== mint) {
        continue;
      }

      const delta = item.post - item.pre;
      if (delta <= 0) {
        continue;
      }

      const current = ownerTokenAmount.get(item.owner) || 0;
      ownerTokenAmount.set(item.owner, current + delta);
    }

    for (const [owner, tokenAmount] of ownerTokenAmount.entries()) {
      const stableSpend = stableSpentByOwner(owner, tokenBalanceMap, stableMints);
      const solSpend = stableSpend ? 0 : solSpentByOwner(owner, parsedTx);

      if (!stableSpend && solSpend <= 0) {
        continue;
      }

      const baseSymbol = stableSpend ? stableSpend.symbol : 'SOL';
      const baseAmount = stableSpend ? stableSpend.amount : solSpend;

      events.push({
        network,
        tokenName: tracked.name,
        tokenSymbol: tracked.symbol,
        tokenAddress: tracked.address,
        pairAddress: tracked.pair_address,
        hash: signature,
        logIndex: eventIndex,
        eventIndex,
        eventUid: `${String(network || '').toLowerCase()}:${String(signature || '').toLowerCase()}:${String(
          tracked.address || ''
        ).toLowerCase()}:${eventIndex}`,
        buyer: owner,
        tokenAmount,
        baseAmount,
        baseSymbol,
        usdValue: baseSymbol === 'USDC' || baseSymbol === 'USDT' ? baseAmount : null,
        timestamp: blockTime
      });
      eventIndex += 1;
    }
  }

  return events;
};

module.exports = {
  parseEvmSwap,
  parseSolanaSwap
};
