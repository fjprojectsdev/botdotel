# Multi-chain Token Buy Alert Bot

Production-ready Node.js Telegram bot for buy alerts across Ethereum, BSC, Base, Polygon and Solana.

## Features

- Multi-token monitoring from database
- EVM swap listener with auto recovery
- Solana DEX log listener (Raydium + Jupiter programs)
- Queue-based async processing to prevent Telegram flood
- Real-time USD estimation and market cap enrichment
- Whale tier auto-classification
- Telegram command engine with slash commands
- Dynamic per-group permissions (dashboard-driven)
- Moderation + anti-spam + welcome/filters + economy modules
- Structured logs with pino
- PM2-ready deployment for 24/7 VPS runtime
- Built-in admin dashboard for groups/tokens/settings

## Required Environment

Copy `.env.example` to `.env` and fill values:

- `TELEGRAM_TOKEN`
- `ETH_RPC`
- `BSC_RPC`
- `BASE_RPC`
- `POLYGON_RPC`
- `SOLANA_RPC`
- `ADMIN_USER` and `ADMIN_PASSWORD`

Optional:

- `GROUP_ID` for legacy bootstrap (auto-imported as initial groups)
- `MIN_USD_ALERT`
- `ENABLED_NETWORKS`
- `ENABLE_TELEGRAM_POLLING` (set `false` on secondary PM2 workers)
- `MOD_FLOOD_WINDOW_MS`, `MOD_FLOOD_MAX_MESSAGES`
- `MOD_SPAM_WINDOW_MS`, `MOD_SPAM_MAX_REPEATS`
- `WARN_AUTOMUTE_AT`
- `CORS_ORIGINS` (origens permitidas para frontend externo, ex: `https://meu-painel.vercel.app`)

## Install and Run

```bash
npm install
npm run start
```

## Dashboard

By default, dashboard is enabled at:

- `http://SERVER_IP:8787`

Use Basic Auth with:

- `ADMIN_USER`
- `ADMIN_PASSWORD`

From dashboard you can:

- Add/remove/enable/disable Telegram groups
- Manage group permissions (example: `buy_alerts`, `core_commands`, `moderation`, `security`)
- Add/remove/enable/disable monitored tokens
- Adjust minimum USD alert threshold
- Send test alert
- View recent transactions and runtime queue stats

## Frontend no Vercel (somente UI)

Para usar apenas o frontend no Vercel e manter bot/API na VPS:

1. Suba este repositório no GitHub.
2. No Vercel, crie um projeto com este repo.
3. Em **Project Settings > Root Directory**, use `src/admin/public`.
4. Deploy.
5. Na VPS, configure `CORS_ORIGINS` com a URL do Vercel:

```bash
CORS_ORIGINS=https://SEU-PROJETO.vercel.app
```

6. Reinicie o serviço na VPS:

```bash
pm2 restart buy-alert-bot-all --update-env
```

7. Abra o frontend no Vercel e faça login no painel informando:
   - URL da API da VPS (`http://IP_DA_VPS:8787` ou domínio com HTTPS)
   - `ADMIN_USER`
   - `ADMIN_PASSWORD`

8. Dentro do painel, o botão **Conectar API** reabre a tela de login para trocar credenciais.

## Frontend no Netlify (somente UI)

1. Crie um novo site no Netlify conectando este repositório.
2. O arquivo `netlify.toml` já define o publish directory em `src/admin/public`.
3. Faça deploy.
4. Abra o site e faça login no painel com:
   - URL da API da VPS (HTTPS)
   - `ADMIN_USER`
   - `ADMIN_PASSWORD`

## PM2

```bash
pm2 start ecosystem.config.cjs --only buy-alert-bot-all
```

Per-network processes are also available in `ecosystem.config.cjs`.

## Add Tokens via CLI (optional)

```bash
npm run token:upsert -- --name Nix --symbol NIX --address 0xToken --network ethereum --pair 0xPair --decimals 18
```

Listeners auto-sync tokens from DB every 30 seconds, so no restart is needed.

## Folder Layout

```text
src/
  admin/server.js
  admin/public/index.html
  admin/public/app.js
  admin/public/styles.css
  bot/telegram.js
  chains/evmListener.js
  chains/solanaListener.js
  chains/parser.js
  services/priceService.js
  services/dexService.js
  services/formatService.js
  services/queueService.js
  database/tokenModel.js
  config/networks.js
  app.js
```
