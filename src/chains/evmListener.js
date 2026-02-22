const { JsonRpcProvider, Contract, Interface } = require('ethers');
const { parseEvmSwap } = require('./parser');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

const SWAP_EVENT =
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)';

class EvmListener {
  constructor({ networkConfig, tokenModel, queueService, logger, pollIntervalMs = 2500, syncIntervalMs = 30_000 }) {
    this.network = networkConfig;
    this.tokenModel = tokenModel;
    this.queueService = queueService;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs;
    this.syncIntervalMs = syncIntervalMs;

    this.provider = null;
    this.running = false;
    this.lastProcessedBlock = null;
    this.pairMetaByAddress = new Map();
    this.pollPromise = null;
    this.syncTimer = null;

    this.swapInterface = new Interface([SWAP_EVENT]);
    this.swapTopic = this.swapInterface.getEvent('Swap').topicHash;
  }

  normalizeAddress(address) {
    return String(address || '').toLowerCase();
  }

  async start() {
    if (!this.network.rpcUrl) {
      this.logger.warn({ network: this.network.key }, 'rpc url missing; listener disabled');
      return;
    }

    this.running = true;
    await this.connectProvider(true);
    await this.syncTrackedPairs();

    this.pollPromise = this.pollLoop();
    this.syncTimer = setInterval(() => {
      this.syncTrackedPairs().catch((error) => {
        this.logger.error({ network: this.network.key, err: error.message }, 'pair sync failed');
      });
    }, this.syncIntervalMs);

    this.logger.info({ network: this.network.key }, 'evm listener started');
  }

  async stop() {
    this.running = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.pollPromise) {
      try {
        await this.pollPromise;
      } catch (_) {
        // no-op
      }
    }

    this.logger.info({ network: this.network.key }, 'evm listener stopped');
  }

  async connectProvider(resetBlock = false) {
    this.provider = new JsonRpcProvider(this.network.rpcUrl, undefined, {
      staticNetwork: false
    });

    const latest = await this.provider.getBlockNumber();
    if (resetBlock || this.lastProcessedBlock === null) {
      this.lastProcessedBlock = Math.max(0, latest - 1);
    } else if (this.lastProcessedBlock > latest) {
      // Some public RPC clusters can return a lower tip temporarily.
      // Clamp cursor to avoid invalid block-range requests.
      this.lastProcessedBlock = Math.max(0, latest - 1);
    }

    this.logger.info({ network: this.network.key, latestBlock: latest }, 'evm rpc connected');
  }

  async reconnectWithBackoff(delayMs) {
    await sleep(delayMs);
    await this.connectProvider(false);
    await this.syncTrackedPairs();
  }

  async syncTrackedPairs() {
    if (!this.provider) {
      return;
    }

    const tokens = this.tokenModel.getTokensByNetwork(this.network.key);
    const activePairSet = new Set();

    for (const token of tokens) {
      const pairAddress = this.normalizeAddress(token.pair_address);
      const tokenAddress = this.normalizeAddress(token.address);
      if (!pairAddress || !tokenAddress) {
        continue;
      }

      activePairSet.add(pairAddress);

      const existing = this.pairMetaByAddress.get(pairAddress);
      if (existing && existing.trackedToken === tokenAddress) {
        existing.name = token.name;
        existing.symbol = token.symbol;
        existing.decimals = Number(token.decimals);
        continue;
      }

      try {
        const pair = new Contract(pairAddress, PAIR_ABI, this.provider);
        const [token0Raw, token1Raw] = await Promise.all([pair.token0(), pair.token1()]);

        const token0 = this.normalizeAddress(token0Raw);
        const token1 = this.normalizeAddress(token1Raw);

        if (tokenAddress !== token0 && tokenAddress !== token1) {
          this.logger.warn(
            {
              network: this.network.key,
              pairAddress,
              tokenAddress,
              token0,
              token1
            },
            'token does not match pair tokens; skipping'
          );
          continue;
        }

        const quoteTokens = {};
        for (const [address, quoteMeta] of Object.entries(this.network.quoteTokens || {})) {
          if (address === token0 || address === token1) {
            quoteTokens[address] = quoteMeta;
          }
        }

        if (!Object.keys(quoteTokens).length) {
          this.logger.warn(
            {
              network: this.network.key,
              pairAddress,
              tokenSymbol: token.symbol
            },
            'pair has no supported base token; skipping'
          );
          continue;
        }

        this.pairMetaByAddress.set(pairAddress, {
          pairAddress,
          trackedToken: tokenAddress,
          token0,
          token1,
          quoteTokens,
          decimals: Number(token.decimals),
          symbol: token.symbol,
          name: token.name
        });
      } catch (error) {
        this.logger.error(
          {
            network: this.network.key,
            pairAddress,
            tokenAddress,
            err: error.message
          },
          'failed to load pair metadata'
        );
      }
    }

    for (const pairAddress of this.pairMetaByAddress.keys()) {
      if (!activePairSet.has(pairAddress)) {
        this.pairMetaByAddress.delete(pairAddress);
      }
    }

    this.logger.info(
      {
        network: this.network.key,
        trackedPairs: this.pairMetaByAddress.size
      },
      'evm pairs synchronized'
    );
  }

  async pollLoop() {
    let backoff = 2_000;

    while (this.running) {
      try {
        if (!this.pairMetaByAddress.size) {
          await sleep(this.pollIntervalMs);
          continue;
        }

        const latest = await this.provider.getBlockNumber();

        if (this.lastProcessedBlock === null) {
          this.lastProcessedBlock = Math.max(0, latest - 1);
        }

        if (latest <= this.lastProcessedBlock) {
          await sleep(this.pollIntervalMs);
          continue;
        }

        const addresses = Array.from(this.pairMetaByAddress.keys());
        let fromBlock = this.lastProcessedBlock + 1;

        while (fromBlock <= latest && this.running) {
          const toBlock = Math.min(fromBlock + this.network.blockChunk - 1, latest);

          const logs = await this.provider.getLogs({
            address: addresses,
            topics: [this.swapTopic],
            fromBlock,
            toBlock
          });

          for (const log of logs) {
            await this.handleSwapLog(log);
          }

          this.lastProcessedBlock = toBlock;
          fromBlock = toBlock + 1;
        }

        backoff = 2_000;
      } catch (error) {
        const errorMessage = String(error?.message || '');
        const invalidBlockRange = /invalid block range params/i.test(errorMessage);

        this.logger.error(
          {
            network: this.network.key,
            err: errorMessage,
            backoff
          },
          'evm poll error; reconnecting'
        );

        try {
          if (invalidBlockRange) {
            await sleep(backoff);
            await this.connectProvider(true);
            await this.syncTrackedPairs();
          } else {
            await this.reconnectWithBackoff(backoff);
          }
          backoff = Math.min(backoff * 2, 30_000);
        } catch (reconnectError) {
          this.logger.error(
            {
              network: this.network.key,
              err: reconnectError.message
            },
            'evm reconnect failed'
          );
          backoff = Math.min(backoff * 2, 30_000);
        }
      }

      await sleep(this.pollIntervalMs);
    }
  }

  async handleSwapLog(log) {
    const pairAddress = this.normalizeAddress(log.address);
    const pairMeta = this.pairMetaByAddress.get(pairAddress);
    if (!pairMeta) {
      return;
    }

    try {
      const parsedLog = this.swapInterface.parseLog(log);
      if (!parsedLog) {
        return;
      }

      const event = parseEvmSwap({
        parsedLog,
        log,
        pairMeta,
        network: this.network.key
      });

      if (!event) {
        return;
      }

      this.queueService.enqueueBuy(event);
    } catch (error) {
      this.logger.error(
        {
          network: this.network.key,
          hash: log.transactionHash,
          err: error.message
        },
        'failed to parse swap log'
      );
    }
  }
}

module.exports = EvmListener;
