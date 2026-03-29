import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  rateLimitMaxPerMinute: Number(process.env.RATE_LIMIT_MAX_PER_MINUTE ?? 30),
} as const;
