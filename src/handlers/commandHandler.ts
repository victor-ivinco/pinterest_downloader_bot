import { Bot } from 'grammy';

export function registerCommandHandlers(bot: Bot): void {
  bot.command('start', (ctx) =>
    ctx.reply(
      '👋 Hi! I am Pinterest Bot.\n\n' +
        'Add me to a group and I will automatically expand Pinterest links into photos and videos.\n\n' +
        '⚠️ To work in a group I need access to all messages (disable Group Privacy in BotFather).',
    ),
  );

  bot.command('help', (ctx) =>
    ctx.reply(
      '📌 *Pinterest Bot*\n\n' +
        'Just send a message with a Pinterest link to the group and I will reply with the image or video.\n\n' +
        '*Supported formats:*\n' +
        '• `https://pin.it/...`\n' +
        '• `https://pinterest.com/pin/...`\n' +
        '• `https://pinterest.ru/pin/...`\n\n' +
        '*Commands:*\n' +
        '/help — show this message\n' +
        '/ping — check if the bot is alive',
      { parse_mode: 'Markdown' },
    ),
  );

  bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'));
}
