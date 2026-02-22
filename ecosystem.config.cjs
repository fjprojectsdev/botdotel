module.exports = {
  apps: [
    {
      name: 'buy-alert-bot-all',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'ethereum,bsc,base,polygon,solana',
        ENABLE_DASHBOARD: 'true',
        ADMIN_PORT: '8787',
        ENABLE_TELEGRAM_POLLING: 'true'
      }
    },
    {
      name: 'buy-alert-eth',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'ethereum',
        ENABLE_DASHBOARD: 'false',
        ENABLE_TELEGRAM_POLLING: 'false'
      }
    },
    {
      name: 'buy-alert-bsc',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'bsc',
        ENABLE_DASHBOARD: 'false',
        ENABLE_TELEGRAM_POLLING: 'false'
      }
    },
    {
      name: 'buy-alert-base',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'base',
        ENABLE_DASHBOARD: 'false',
        ENABLE_TELEGRAM_POLLING: 'false'
      }
    },
    {
      name: 'buy-alert-polygon',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'polygon',
        ENABLE_DASHBOARD: 'false',
        ENABLE_TELEGRAM_POLLING: 'false'
      }
    },
    {
      name: 'buy-alert-solana',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        ENABLED_NETWORKS: 'solana',
        ENABLE_DASHBOARD: 'false',
        ENABLE_TELEGRAM_POLLING: 'false'
      }
    }
  ]
};
