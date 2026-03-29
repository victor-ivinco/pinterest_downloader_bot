import type { Context, NextFunction } from 'grammy';
import { logger } from '../utils/logger';

// Simple in-memory limiter: no more than N processed requests per minute per chat
const counts = new Map<number, number>(); // chatId -> count

setInterval(() => counts.clear(), 60_000);

export function rateLimiterMiddleware(maxPerMinute: number) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
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
