import { config } from './config';
import { createBot } from './bot';
import { logger } from './utils/logger';

const bot = createBot(config.botToken);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down...');
  await bot.stop();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

bot.start({
  onStart: (info) => logger.info({ username: info.username }, 'Bot started'),
});
