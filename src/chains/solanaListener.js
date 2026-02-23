const { Connection, PublicKey } = require('@solana/web3.js');
const PQueue = require('p-queue').default;
const { parseSolanaSwap } = require('./parser');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SolanaListener {
  constructor({ networkConfig, tokenModel, queueService, logger, syncIntervalMs = 30_000 }) {
    this.network = networkConfig;
    this.tokenModel = tokenModel;
    this.queueService = queueService;
    this.logger = logger;
    this.syncIntervalMs = syncIntervalMs;

    this.running = false;
    this.reconnecting = false;
    this.connection = null;
    this.subscriptions = [];
    this.trackedTokensByMint = new Map();
    this.seenSignatures = new Map();

    this.signatureQueue = new PQueue({ concurrency: 6 });

    this.syncTimer = null;
    this.healthTimer = null;
    this.pruneTimer = null;
    this.rpcUrls = Array.isArray(this.network.rpcUrls) ? this.network.rpcUrls.filter(Boolean) : [];
    if (!this.rpcUrls.length && this.network.rpcUrl) {
      this.rpcUrls = [this.network.rpcUrl];
    }
    this.rpcIndex = 0;
    this.currentRpcUrl = this.rpcUrls[0] || '';
    this.lastError = '';
    this.lastErrorAt = null;
    this.lastConnectedAt = null;
    this.lastHealthAt = null;
  }

  async start() {
    if (!this.rpcUrls.length) {
      this.logger.warn('solana rpc url missing; listener disabled');
      return;
    }

    this.running = true;

    await this.syncTrackedTokens();
    const connected = await this.connectWithAnyRpc();
    if (!connected) {
      this.running = false;
      this.logger.error({ network: this.network.key }, 'failed to connect any solana rpc endpoint; listener disabled');
      return;
    }

    this.syncTimer = setInterval(() => {
      this.syncTrackedTokens().catch((error) => {
        this.logger.error({ err: error.message }, 'solana token sync failed');
      });
    }, this.syncIntervalMs);

    this.healthTimer = setInterval(() => {
      this.healthcheck().catch((error) => {
        this.logger.error({ err: error.message }, 'solana healthcheck failed');
      });
    }, 20_000);

    this.pruneTimer = setInterval(() => {
      this.pruneSeenSignatures();
    }, 60_000);

    this.logger.info({ network: this.network.key }, 'solana listener started');
  }

  async stop() {
    this.running = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    await this.unsubscribeAll();
    await this.signatureQueue.onIdle();

    this.logger.info({ network: this.network.key }, 'solana listener stopped');
  }

  async connectAndSubscribe() {
    if (!this.currentRpcUrl) {
      throw new Error('solana rpc url missing');
    }

    this.connection = new Connection(this.currentRpcUrl, {
      commitment: 'confirmed'
    });

    await this.connection.getSlot('confirmed');
    this.lastConnectedAt = new Date().toISOString();
    this.lastError = '';
    this.lastErrorAt = null;

    this.subscriptions = [];
    for (const programId of this.network.dexPrograms || []) {
      const subscriptionId = this.connection.onLogs(
        new PublicKey(programId),
        (logInfo) => {
          this.onProgramLog(programId, logInfo);
        },
        'confirmed'
      );

      this.subscriptions.push(subscriptionId);
    }

    this.logger.info(
      {
        programs: (this.network.dexPrograms || []).length,
        rpcUrl: this.currentRpcUrl
      },
      'solana subscriptions active'
    );
  }

  rotateRpc() {
    if (!this.rpcUrls.length) {
      this.rpcIndex = 0;
      this.currentRpcUrl = '';
      return;
    }

    this.rpcIndex = (this.rpcIndex + 1) % this.rpcUrls.length;
    this.currentRpcUrl = this.rpcUrls[this.rpcIndex];
  }

  async connectWithAnyRpc() {
    if (!this.rpcUrls.length) {
      return false;
    }

    const maxAttempts = this.rpcUrls.length;
    let attempts = 0;
    while (attempts < maxAttempts && this.running) {
      try {
        await this.connectAndSubscribe();
        return true;
      } catch (error) {
        attempts += 1;
        this.lastError = String(error?.message || 'solana rpc connect failed');
        this.lastErrorAt = new Date().toISOString();
        this.logger.warn(
          {
            rpcUrl: this.currentRpcUrl,
            attempt: attempts,
            err: error.message
          },
          'solana rpc connect failed, trying fallback'
        );
        this.rotateRpc();
      }
    }

    return false;
  }

  async unsubscribeAll() {
    if (!this.connection || !this.subscriptions.length) {
      this.subscriptions = [];
      return;
    }

    for (const subscriptionId of this.subscriptions) {
      try {
        await this.connection.removeOnLogsListener(subscriptionId);
      } catch (error) {
        this.logger.warn({ err: error.message }, 'failed to remove solana log subscription');
      }
    }

    this.subscriptions = [];
  }

  pruneSeenSignatures() {
    const ttlMs = 10 * 60 * 1000;
    const now = Date.now();

    for (const [signature, seenAt] of this.seenSignatures.entries()) {
      if (now - seenAt > ttlMs) {
        this.seenSignatures.delete(signature);
      }
    }
  }

  async syncTrackedTokens() {
    const tokens = this.tokenModel.getTokensByNetwork('solana');
    const next = new Map();

    for (const token of tokens) {
      next.set(token.address, token);
    }

    this.trackedTokensByMint = next;

    this.logger.info(
      {
        trackedTokens: this.trackedTokensByMint.size
      },
      'solana tokens synchronized'
    );
    this.lastHealthAt = new Date().toISOString();
  }

  onProgramLog(programId, logInfo) {
    if (!this.running || !logInfo?.signature || logInfo.err) {
      return;
    }

    const signature = logInfo.signature;
    if (this.seenSignatures.has(signature)) {
      return;
    }

    this.seenSignatures.set(signature, Date.now());

    this.signatureQueue
      .add(() => this.processSignature(signature, programId))
      .catch((error) => {
        this.logger.error({ signature, err: error.message }, 'failed to process solana signature');
      });
  }

  async processSignature(signature, programId) {
    if (!this.trackedTokensByMint.size) {
      return;
    }

    try {
      const parsedTx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!parsedTx || !parsedTx.meta) {
        return;
      }

      const events = parseSolanaSwap({
        parsedTx,
        trackedTokensByMint: this.trackedTokensByMint,
        signature,
        network: this.network.key,
        stableMints: this.network.stableMints || {}
      });

      for (const event of events) {
        this.queueService.enqueueBuy(event);
      }

      if (events.length) {
        this.logger.info(
          {
            signature,
            programId,
            events: events.length
          },
          'solana buy events parsed'
        );
      }
    } catch (error) {
      this.lastError = String(error?.message || 'solana parse error');
      this.lastErrorAt = new Date().toISOString();
      this.logger.error(
        {
          signature,
          programId,
          err: error.message
        },
        'solana transaction parse error'
      );
    }
  }

  async healthcheck() {
    if (!this.connection || this.reconnecting || !this.running) {
      return;
    }

    try {
      await this.connection.getSlot('processed');
      this.lastHealthAt = new Date().toISOString();
      this.lastError = '';
      this.lastErrorAt = null;
    } catch (error) {
      this.lastError = String(error?.message || 'solana healthcheck failed');
      this.lastErrorAt = new Date().toISOString();
      this.logger.error({ err: error.message }, 'solana rpc unhealthy; reconnecting');
      await this.reconnect();
    }
  }

  async reconnect() {
    if (this.reconnecting || !this.running) {
      return;
    }

    this.reconnecting = true;

    try {
      await this.unsubscribeAll();
      await sleep(2_000);
      if (this.rpcUrls.length > 1) {
        this.rotateRpc();
      }
      const connected = await this.connectWithAnyRpc();
      if (!connected) {
        throw new Error('all solana rpc reconnect attempts failed');
      }
    } finally {
      this.reconnecting = false;
    }
  }

  getStatus() {
    return {
      network: this.network.key,
      type: 'solana',
      running: this.running,
      reconnecting: this.reconnecting,
      rpcUrl: this.currentRpcUrl,
      rpcIndex: this.rpcIndex,
      rpcPoolSize: this.rpcUrls.length,
      subscriptions: this.subscriptions.length,
      trackedTokens: this.trackedTokensByMint.size,
      queuePending: this.signatureQueue.pending,
      queueSize: this.signatureQueue.size,
      lastConnectedAt: this.lastConnectedAt,
      lastHealthAt: this.lastHealthAt,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt
    };
  }
}

module.exports = SolanaListener;
