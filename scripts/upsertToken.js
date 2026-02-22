require('dotenv').config();

const path = require('path');
const TokenModel = require('../src/database/tokenModel');
const logger = require('../src/utils/logger');

const parseArgs = (argv) => {
  const out = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      continue;
    }

    const key = part.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      out[key] = 'true';
      continue;
    }

    out[key] = value;
    i += 1;
  }

  return out;
};

const printUsage = () => {
  console.log('Usage:');
  console.log('node scripts/upsertToken.js --name NAME --symbol SYMBOL --address TOKEN --network NETWORK --pair PAIR --decimals 18 [--disabled true]');
};

const run = () => {
  const args = parseArgs(process.argv.slice(2));

  const required = ['name', 'symbol', 'address', 'network', 'pair', 'decimals'];
  const missing = required.filter((field) => !args[field]);
  if (missing.length) {
    console.error(`Missing required args: ${missing.join(', ')}`);
    printUsage();
    process.exit(1);
  }

  const dbPath = process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'data', 'bot.db');

  const tokenModel = new TokenModel({
    dbPath,
    logger: logger.child({ module: 'token-cli' })
  });
  tokenModel.init();

  try {
    const payload = tokenModel.upsertToken({
      name: args.name,
      symbol: args.symbol,
      address: args.address,
      network: args.network,
      pair_address: args.pair,
      decimals: Number(args.decimals),
      enabled: args.disabled === 'true' ? 0 : 1
    });

    console.log('Token upserted:');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    tokenModel.close();
  }
};

run();
