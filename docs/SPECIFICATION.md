# Project Specification: Pinterest Image Bot for Telegram

## 1. Project Name
**Pinterest Image Bot** (`pinterest-telegram-bot`)

## 2. Project Goal
Build a Telegram bot that operates in group chats and automatically detects messages containing Pinterest links. The bot must extract the image (or video) from each link and send it back to the chat in a convenient format.

## 3. Core Requirements

### Functional Requirements
- The bot is added to group chats (regular groups and supergroups).
- The bot scans all text messages in the chat, including media captions.
- When one or more Pinterest links are detected, the bot:
  - Extracts the direct URL of the original media (preferably high quality).
  - Sends the media back as a photo (`replyWithPhoto`) or video (`replyWithVideo`).
- Supported link formats:
  - `https://pin.it/...` — short links
  - `https://*.pinterest.com/pin/...` — full links
  - `https://*.pinterest.co.uk/pin/...`, `pinterest.ru`, `pinterest.de`, and other regional domains
- If a message contains multiple Pinterest links — process all of them.
  - One link → single `replyWithPhoto`/`replyWithVideo`
  - Multiple links → media group (`replyWithMediaGroup`) with a caption on the first item
- The reply must be a **reply** to the original message.
- Include a short caption with the sent media (e.g. `📌 Pinterest`).
- While processing links, send `sendChatAction('upload_photo')` as a typing indicator.
- Bot commands:
  - `/start` — welcome message and instructions for adding to a group
  - `/help` — feature overview
  - `/ping` — liveness check

### Non-functional Requirements
- Language: **TypeScript** (strict mode)
- Telegram framework: **grammY**
- Pinterest downloader: **`btch-downloader`**
- Code must be clean, modular, and easy to extend.
- Error handling: invalid link, Pinterest unavailable, timeout, empty result.
- On processing error — log silently (do not send error messages to the chat).
- Structured logging (pino) with levels: `info`, `warn`, `error`.
- Environment configuration via `.env`.
- Graceful shutdown on `SIGINT` / `SIGTERM`.

## 4. Technology Stack

| Component | Package | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Telegram API | grammy | ^1.x |
| Pinterest | btch-downloader | latest |
| Logging | pino + pino-pretty | ^9.x |
| Environment | dotenv | ^16.x |
| Dev runner | tsx | ^4.x |
| Node.js | — | 20+ |

Optional:
- `@types/node` — Node.js type definitions
- ESLint + Prettier — linting and formatting

## 5. Project Architecture

```
pinterest-telegram-bot/
├── src/
│   ├── index.ts                    # Entry point: load config, start bot
│   ├── bot.ts                      # Bot instance, middleware and handler registration
│   ├── config.ts                   # Centralised .env reading with required-variable validation
│   ├── handlers/
│   │   ├── pinterestHandler.ts     # Handler for messages containing Pinterest links
│   │   └── commandHandler.ts       # Handlers for /start, /help, /ping
│   ├── services/
│   │   └── pinterestService.ts     # Service: media extraction via btch-downloader
│   ├── middleware/
│   │   └── rateLimiter.ts          # Middleware: per-chat request rate limiting
│   ├── utils/
│   │   ├── regex.ts                # Pinterest URL regular expressions
│   │   └── logger.ts               # pino setup
│   └── types.ts                    # Shared TypeScript types
├── docs/
│   └── SPECIFICATION.md
├── .env.example
├── .env                            # in .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

## 6. Implementation Details

### 6.1 Configuration (config.ts)

```ts
// src/config.ts
import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  rateLimitMaxPerMinute: Number(process.env.RATE_LIMIT_MAX_PER_MINUTE ?? 30),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
```

### 6.2 Pinterest URL Regular Expression

```ts
// src/utils/regex.ts

// Covers: pinterest.com, pinterest.ru, pinterest.co.uk, pinterest.de, etc.
// Also covers short links: pin.it
export const PINTEREST_URL_REGEX =
  /https?:\/\/(?:(?:www\.)?pin\.it\/[^\s<>"]+|(?:[\w-]+\.)?pinterest\.[a-z]{2,6}(?:\.[a-z]{2})?\/pin\/[^\s<>"]+)/gi;

export function extractPinterestUrls(text: string): string[] {
  return [...text.matchAll(PINTEREST_URL_REGEX)].map((m) => m[0]);
}
```

> **Note**: in addition to regex, use `message.entities` from Telegram — Telegram itself marks URL entities in the text, which is more reliable for custom link formats.

### 6.3 URL extraction via grammY entities

```ts
// More reliable approach — extract URLs from entities already parsed by Telegram
function extractUrlsFromEntities(ctx: Context): string[] {
  const message = ctx.message;
  if (!message) return [];

  const text = message.text ?? message.caption ?? '';
  const entities = message.entities ?? message.caption_entities ?? [];

  return entities
    .filter((e) => e.type === 'url' || e.type === 'text_link')
    .map((e) => (e.type === 'text_link' ? e.url! : text.slice(e.offset, e.offset + e.length)))
    .filter((url) => PINTEREST_URL_REGEX.test(url));
}
```

### 6.4 Pinterest Service

```ts
// src/services/pinterestService.ts
import { pinterest } from 'btch-downloader';

export interface PinterestMedia {
  url: string;
  type: 'photo' | 'video';
}

export async function getPinterestMedia(pinUrl: string): Promise<PinterestMedia | null> {
  try {
    const response = await pinterest(pinUrl);
    // The library double-wraps the response:
    // pinterest() → { developer, status, result: <HTTP response> }
    // HTTP response → { success, developer, result: <pin data> }
    const data = (response?.result as any)?.result;
    if (!data?.url) return null;

    const isVideo = data.is_video === true;
    return { url: data.url, type: isVideo ? 'video' : 'photo' };
  } catch (err) {
    logger.warn({ err, pinUrl }, 'Failed to fetch Pinterest media');
    return null;
  }
}
```

### 6.5 Main Handler

```ts
// src/handlers/pinterestHandler.ts
export async function handlePinterestMessage(ctx: Context): Promise<void> {
  const urls = extractUrlsFromEntities(ctx);
  if (urls.length === 0) return;

  await ctx.replyWithChatAction('upload_photo');

  const results = await Promise.allSettled(urls.map(getPinterestMedia));
  const mediaItems = results
    .filter((r): r is PromiseFulfilledResult<PinterestMedia> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value!);

  if (mediaItems.length === 0) return;

  const replyParams = { reply_to_message_id: ctx.message!.message_id };

  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    const caption = `📌 Pinterest`;
    if (item.type === 'video') {
      await ctx.replyWithVideo(item.url, { caption, ...replyParams });
    } else {
      await ctx.replyWithPhoto(item.url, { caption, ...replyParams });
    }
    return;
  }

  // Media group — Telegram API limit is 10 items
  const group = mediaItems.slice(0, 10).map((item, i) =>
    item.type === 'video'
      ? { type: 'video' as const, media: item.url, caption: i === 0 ? '📌 Pinterest' : undefined }
      : { type: 'photo' as const, media: item.url, caption: i === 0 ? '📌 Pinterest' : undefined },
  );
  await ctx.replyWithMediaGroup(group, replyParams);
}
```

### 6.6 Rate Limiter Middleware

```ts
// src/middleware/rateLimiter.ts
// Simple in-memory limiter: no more than N processed requests per minute per chat
const counts = new Map<number, number>(); // chatId -> count

export function rateLimiterMiddleware(maxPerMinute: number) {
  setInterval(() => counts.clear(), 60_000);

  return async (ctx: Context, next: NextFunction) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return next();

    const current = counts.get(chatId) ?? 0;
    if (current >= maxPerMinute) {
      logger.warn({ chatId }, 'Rate limit exceeded');
      return;
    }
    counts.set(chatId, current + 1);
    return next();
  };
}
```

### 6.7 Entry Point and Graceful Shutdown

```ts
// src/index.ts
import { createBot } from './bot';
import { config } from './config';
import { logger } from './utils/logger';

const bot = createBot(config.botToken);

bot.start({
  onStart: (info) => logger.info({ username: info.username }, 'Bot started'),
});

const shutdown = async () => {
  logger.info('Shutting down...');
  await bot.stop();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
```

## 7. Environment Variables (.env.example)

```dotenv
# Required
BOT_TOKEN=your_bot_token_here

# Optional
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_MAX_PER_MINUTE=30
```

## 8. NPM Scripts (package.json)

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src"
  }
}
```

## 9. Error Handling

| Scenario | Action |
|---|---|
| `btch-downloader` returned `null` / empty `url` | Skip silently, log `warn` |
| Network unavailable / timeout | Log `error`, do not reply in chat |
| Telegram API error when sending photo | Log `error` |
| Invalid token on startup | Throw exception, terminate process |
| Required env variable missing | Throw exception on startup (`config.ts`) |

## 10. Telegram Bot Requirements

- When creating via BotFather:
  - Enable `Allow Groups: true`
  - Enable `Group Privacy: Disabled` (otherwise the bot only sees commands, not all messages)
- Bot permissions in the group:
  - Read messages
  - Send messages and media

## 11. Deployment

### Local Development
```bash
npm run dev
```

### Production (PM2)
```bash
npm run build
pm2 start dist/index.js --name pinterest-bot
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

Build: `npm run build && docker build -t pinterest-bot .`

### Cloud
- **Railway** / **Render** / **Fly.io** — straightforward Git-based deploy
- Cloudflare Workers — requires rewriting to webhook mode (no long polling)

## 12. Detailed Development Plan

### Phase 1 — MVP (core functionality)
1. [x] Project init: install dependencies (`grammy`, `btch-downloader`, `pino`, `dotenv`, `tsx`)
2. [x] Configure `tsconfig.json`, ESLint, Prettier
3. [x] Implement `config.ts` with env validation
4. [x] Implement `logger.ts` (pino)
5. [x] Implement `regex.ts` + test the regex against various link formats
6. [x] Implement `pinterestService.ts` — test media extraction via `btch-downloader`
7. [x] Implement `commandHandler.ts` — `/start`, `/help`, `/ping`
8. [x] Implement `pinterestHandler.ts` — single-link handling (photo)
9. [x] Wire up `bot.ts` + `index.ts`
10. [ ] Test in a real group (single photo pins)

### Phase 2 — Extended Functionality
11. [x] Video pin support (`replyWithVideo`)
12. [x] Media group support for multiple links in a single message
13. [x] URL extraction via `message.entities` (in addition to regex)
14. [x] Rate limiter middleware
15. [x] Handle media captions (`message.caption`)
16. [ ] Test edge cases: unavailable pin, deleted content, private profile

### Phase 3 — Production
17. [ ] Graceful shutdown
18. [ ] Docker image
19. [ ] README with deployment instructions
20. [ ] Deploy to VPS / Railway

## 13. Edge Cases and Known Limitations

- **Private/deleted pins** — `btch-downloader` returns `null`, handled silently.
- **Telegram file size limit** — when sending by URL, Telegram fetches the file itself; files >5 MB may require downloading and sending as `InputFile`. Not implemented for now — monitor via errors.
- **Media group** — maximum 10 items (Telegram API limit).
- **Telegram API rate limiting** — for bulk processing, respect request pacing; the `@grammyjs/transformer-throttler` plugin can be added if needed.
- **btch-downloader** — third-party library that depends on Pinterest's DOM/API; may break when Pinterest changes its structure. Keep the package up to date.
- **Double-wrapped response** — `btch-downloader` wraps the API response twice: `pinterest()` returns `{ developer, status, result: <HTTP response> }` and the HTTP response itself is `{ success, developer, result: <pin data> }`. The real pin data is at `response.result.result`.

---
