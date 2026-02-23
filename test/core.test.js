const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const TokenModel = require('../src/database/tokenModel');
const { parseEvmSwap, parseSolanaSwap } = require('../src/chains/parser');

const noopLogger = {
  info() {},
  warn() {},
  error() {}
};

const createTempModel = () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buy-alert-tests-'));
  const dbPath = path.join(tmpDir, 'bot.db');
  const model = new TokenModel({
    dbPath,
    logger: noopLogger
  });
  model.init();
  return {
    model,
    cleanup: () => {
      model.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
};

test('parseEvmSwap includes logIndex and stable eventUid', () => {
  const event = parseEvmSwap({
    parsedLog: {
      args: {
        amount0In: 0n,
        amount1In: 3000000000000000000n,
        amount0Out: 1200000000000000000000n,
        amount1Out: 0n,
        to: '0x1111111111111111111111111111111111111111'
      }
    },
    log: {
      address: '0x2222222222222222222222222222222222222222',
      transactionHash: '0xabcdef1234',
      logIndex: 7
    },
    pairMeta: {
      trackedToken: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      token0: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      token1: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      quoteTokens: {
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': {
          symbol: 'ETH',
          decimals: 18
        }
      },
      decimals: 18,
      symbol: 'NIX',
      name: 'Nix'
    },
    network: 'ethereum'
  });

  assert.ok(event);
  assert.equal(event.logIndex, 7);
  assert.equal(event.eventUid, 'ethereum:0xabcdef1234:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:7');
  assert.equal(event.baseSymbol, 'ETH');
});

test('parseSolanaSwap emits deterministic eventUid by event index', () => {
  const trackedTokensByMint = new Map([
    [
      'TokenMint1111111111111111111111111111111111',
      {
        name: 'Snap',
        symbol: 'SNAP',
        address: 'TokenMint1111111111111111111111111111111111',
        pair_address: 'RaydiumPair111111111111111111111111111111'
      }
    ]
  ]);

  const events = parseSolanaSwap({
    parsedTx: {
      blockTime: 1_700_000_000,
      transaction: {
        message: {
          accountKeys: ['OwnerWallet1111111111111111111111111111111111']
        }
      },
      meta: {
        preBalances: [2_000_000_000],
        postBalances: [1_500_000_000],
        preTokenBalances: [
          {
            owner: 'OwnerWallet1111111111111111111111111111111111',
            mint: 'TokenMint1111111111111111111111111111111111',
            uiTokenAmount: { uiAmountString: '100' }
          }
        ],
        postTokenBalances: [
          {
            owner: 'OwnerWallet1111111111111111111111111111111111',
            mint: 'TokenMint1111111111111111111111111111111111',
            uiTokenAmount: { uiAmountString: '150' }
          }
        ]
      }
    },
    trackedTokensByMint,
    signature: '5M8xSignature1111111111111111111111111111111',
    network: 'solana',
    stableMints: {}
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].logIndex, 0);
  assert.equal(
    events[0].eventUid,
    'solana:5m8xsignature1111111111111111111111111111111:tokenmint1111111111111111111111111111111111:0'
  );
});

test('TokenModel deduplicates transaction by event_uid', () => {
  const { model, cleanup } = createTempModel();
  try {
    const first = model.saveTransaction({
      token: 'ethereum:0xaaa',
      network: 'ethereum',
      hash: '0xtx1',
      log_index: 2,
      event_uid: 'ethereum:0xtx1:0xaaa:2',
      buyer: '0xbuyer',
      amount: 100,
      usd_value: 250,
      timestamp: new Date().toISOString()
    });
    assert.equal(first, true);

    const second = model.saveTransaction({
      token: 'ethereum:0xaaa',
      network: 'ethereum',
      hash: '0xtx1',
      log_index: 2,
      event_uid: 'ethereum:0xtx1:0xaaa:2',
      buyer: '0xbuyer',
      amount: 100,
      usd_value: 250,
      timestamp: new Date().toISOString()
    });
    assert.equal(second, false);
    assert.equal(model.countTransactions(), 1);
  } finally {
    cleanup();
  }
});

test('TokenModel hashes and verifies admin password', () => {
  const { model, cleanup } = createTempModel();
  try {
    const hash = model.hashAdminPassword('SenhaForte#123');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(model.verifyAdminPassword('SenhaForte#123', hash), true);
    assert.equal(model.verifyAdminPassword('senha_errada', hash), false);
  } finally {
    cleanup();
  }
});

test('TokenModel migrates legacy transactions table without event_uid before creating index', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buy-alert-legacy-'));
  const dbPath = path.join(tmpDir, 'legacy.db');
  const legacyDb = new Database(dbPath);
  try {
    legacyDb.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        network TEXT NOT NULL,
        hash TEXT NOT NULL,
        buyer TEXT NOT NULL,
        amount REAL NOT NULL,
        usd_value REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } finally {
    legacyDb.close();
  }

  const model = new TokenModel({
    dbPath,
    logger: noopLogger
  });

  try {
    model.init();
    const columns = model.db.prepare('PRAGMA table_info(transactions)').all();
    const names = columns.map((item) => item.name);
    assert.ok(names.includes('event_uid'));
    assert.ok(names.includes('log_index'));

    const indexes = model.db.prepare('PRAGMA index_list(transactions)').all();
    const hasEventUidIndex = indexes.some((item) => String(item.name || '') === 'idx_transactions_event_uid');
    assert.equal(hasEventUidIndex, true);
  } finally {
    model.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
