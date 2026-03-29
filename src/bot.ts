import { Bot } from 'grammy';
import { config } from './config';
import { registerCommandHandlers } from './handlers/commandHandler';
import { handlePinterestMessage } from './handlers/pinterestHandler';
import { rateLimiterMiddleware } from './middleware/rateLimiter';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.use(rateLimiterMiddleware(config.rateLimitMaxPerMinute));

  registerCommandHandlers(bot);

  // Handle text messages and messages with captions (photos/videos with text)
  bot.on(['message:text', 'message:caption'], handlePinterestMessage);

  return bot;
}
