import { Context } from 'grammy';
import type { InputMediaPhoto, InputMediaVideo } from 'grammy/out/types.node';
import { extractPinterestUrls } from '../utils/regex';
import { getPinterestMedia } from '../services/pinterestService';
import { logger } from '../utils/logger';

function extractUrlsFromMessage(ctx: Context): string[] {
  const message = ctx.message;
  if (!message) return [];

  const text = message.text ?? message.caption ?? '';
  const entities = message.entities ?? message.caption_entities ?? [];

  // Primary source: URLs already parsed by Telegram into entities
  const fromEntities = entities
    .filter((e) => e.type === 'url' || e.type === 'text_link')
    .map((e) =>
      e.type === 'text_link' && 'url' in e ? (e as { url: string }).url : text.slice(e.offset, e.offset + e.length),
    );

  // Secondary source: regex scan (catches URLs not recognised as entities)
  const fromRegex = extractPinterestUrls(text);

  // Merge, deduplicate, and keep only Pinterest URLs
  const allUrls = [...new Set([...fromEntities, ...fromRegex])];
  return allUrls.filter((url) => /pinterest\.|pin\.it/i.test(url));
}

export async function handlePinterestMessage(ctx: Context): Promise<void> {
  const urls = extractUrlsFromMessage(ctx);

  if (urls.length === 0) return;

  const messageId = ctx.message?.message_id;
  if (!messageId) return;

  logger.info({ urls, chatId: ctx.chat?.id }, 'Processing Pinterest URLs');

  await ctx.replyWithChatAction('upload_photo');

  const results = await Promise.allSettled(urls.map((url) => getPinterestMedia(url)));
  const mediaItems = results
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getPinterestMedia>>>> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value);

  if (mediaItems.length === 0) {
    logger.warn({ urls }, 'No media resolved for Pinterest URLs');
    return;
  }

  const replyParams = { reply_to_message_id: messageId };

  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    const caption = '📌 Pinterest';
    try {
      if (item.type === 'video') {
        await ctx.replyWithVideo(item.url, { caption, ...replyParams });
      } else {
        await ctx.replyWithPhoto(item.url, { caption, ...replyParams });
      }
    } catch (err) {
      logger.error({ err, url: item.url }, 'Failed to send media');
    }
    return;
  }

  // Media group — Telegram API limit is 10 items
  const group: (InputMediaPhoto | InputMediaVideo)[] = mediaItems.slice(0, 10).map((item, i) => {
    const caption = i === 0 ? '📌 Pinterest' : undefined;
    if (item.type === 'video') {
      return { type: 'video' as const, media: item.url, caption };
    }
    return { type: 'photo' as const, media: item.url, caption };
  });

  try {
    await ctx.replyWithMediaGroup(group, replyParams);
  } catch (err) {
    logger.error({ err }, 'Failed to send media group');
  }
}
