import { pinterest } from 'btch-downloader';
import type { PinterestMedia } from '../types';
import { logger } from '../utils/logger';

// Pick the best available image quality from the sizes dictionary
function pickBestImage(
  images: Record<string, { url?: string; width?: number; height?: number }> | undefined,
  fallback: string | undefined,
): string | null {
  if (!images) return fallback ?? null;

  // Preferred keys in descending quality order
  // Actual API keys: 'orig', '736x', '564x', '474x', '236x', '170x', '136x136', '60x60'
  const preferredKeys = ['orig', '736x', '564x', '474x', '236x', '170x'];
  for (const key of preferredKeys) {
    if (images[key]?.url) return images[key].url!;
  }

  // Fall back to the entry with the largest width
  const byWidth = Object.values(images)
    .filter((v) => v.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (byWidth.length > 0) return byWidth[0].url!;

  return fallback ?? null;
}

// Pick the video with the highest resolution
function pickBestVideo(
  videos: Record<string, { url: string; width?: number }> | undefined,
  fallback: string | null | undefined,
): string | null {
  if (!videos) return fallback ?? null;

  const byWidth = Object.values(videos)
    .filter((v) => v.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (byWidth.length > 0) return byWidth[0].url;

  return fallback ?? null;
}

export async function getPinterestMedia(pinUrl: string): Promise<PinterestMedia | null> {
  try {
    const response = await pinterest(pinUrl);

    // The library double-wraps the response:
    // pinterest() → { developer, status, result: <HTTP response> }
    // HTTP response → { success, developer, result: <pin data> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (response?.result as any)?.result as typeof response.result | undefined;

    if (!data) {
      logger.warn({ pinUrl }, 'Pinterest: empty result');
      return null;
    }

    logger.debug(
      { pinUrl, is_video: data.is_video, has_videos: !!data.videos, video_url: data.video_url },
      'Pinterest: raw media fields',
    );

    if (data.is_video) {
      const videoUrl = pickBestVideo(data.videos, data.video_url);
      if (!videoUrl) {
        logger.warn({ pinUrl }, 'Pinterest: video pin but no video URL');
        return null;
      }
      return { url: videoUrl, type: 'video' };
    }

    const imageUrl = pickBestImage(data.images, data.image);
    if (!imageUrl) {
      logger.warn({ pinUrl }, 'Pinterest: no image URL');
      return null;
    }
    return { url: imageUrl, type: 'photo' };
  } catch (err) {
    logger.error({ err, pinUrl }, 'Pinterest: failed to fetch media');
    return null;
  }
}
