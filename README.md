# Pinterest Telegram Bot

A Telegram bot that automatically extracts and sends media (photos and videos) from Pinterest links shared in chats.

## Features

- Detects Pinterest links in messages and captions
- Supports multiple URL formats: short `pin.it` links, full `pinterest.com/pin/` URLs, regional domains (`.ru`, `.co.uk`, `.de`, etc.)
- Sends extracted photos and videos directly in the chat
- Handles multiple links per message as a media group (up to 10 items)
- Per-chat rate limiting to prevent abuse
- Bot commands: `/start`, `/help`, `/ping`
- Graceful shutdown on SIGINT/SIGTERM

## Requirements

- Node.js 20+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## Setup

1. **Clone and install dependencies:**

```bash
git clone https://github.com/victor-ivinco/pinterest_downloader_bot.git
cd pinterest
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env`:

```env
BOT_TOKEN=your_bot_token_here
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_MAX_PER_MINUTE=30
```

3. **Run in development mode:**

```bash
npm run dev
```

4. **Build and run in production:**

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | — | Telegram bot token from BotFather |
| `NODE_ENV` | No | `development` | Environment: `development` or `production` |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `RATE_LIMIT_MAX_PER_MINUTE` | No | `30` | Max requests per chat per minute |

## Project Structure

```
src/
├── index.ts                  # Entry point
├── bot.ts                    # Bot initialization and middleware
├── config.ts                 # Environment configuration
├── types.ts                  # Shared TypeScript types
├── handlers/
│   ├── commandHandler.ts     # /start, /help, /ping commands
│   └── pinterestHandler.ts   # Pinterest link processing
├── services/
│   └── pinterestService.ts   # Media extraction via btch-downloader
├── middleware/
│   └── rateLimiter.ts        # Per-chat rate limiting
└── utils/
    ├── logger.ts             # Pino logger setup
    └── regex.ts              # Pinterest URL patterns
```

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Bot framework:** [grammY](https://grammy.dev)
- **Pinterest extractor:** [btch-downloader](https://github.com/nicklvsa/btch-downloader)
- **Logging:** [Pino](https://getpino.io)

## Deployment

### PM2

```bash
npm run build
pm2 start dist/index.js --name pinterest-bot
pm2 save
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
npm run build
docker build -t pinterest-bot .
docker run -d --env-file .env pinterest-bot
```

### Cloud (Railway / Render / Fly.io)

Set `BOT_TOKEN` as an environment variable in the platform dashboard, then deploy the repository. The build command is `npm run build` and the start command is `npm start`.

## Debugging

To test Pinterest media extraction directly without running the bot:

```bash
npx tsx scripts/debug-pin.ts https://pin.it/example
```

## Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Usage instructions |
| `/ping` | Liveness check |

## License

MIT — see [LICENSE](LICENSE).
