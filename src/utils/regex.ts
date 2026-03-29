// Matches:
//   - https://pin.it/AbCdEf
//   - https://www.pinterest.com/pin/123456789/
//   - https://pinterest.ru/pin/123456789/
//   - https://pinterest.co.uk/pin/123456789/
//   - https://www.pinterest.de/pin/123456789/
const PINTEREST_URL_PATTERN =
  /https?:\/\/(?:(?:www\.)?pin\.it\/[^\s<>"#]+|(?:[\w-]+\.)?pinterest\.[a-z]{2,6}(?:\.[a-z]{2})?\/pin\/[^\s<>"#]+)/gi;

export function extractPinterestUrls(text: string): string[] {
  const matches = text.matchAll(new RegExp(PINTEREST_URL_PATTERN.source, 'gi'));
  return [...matches].map((m) => m[0]);
}

export function isPinterestUrl(url: string): boolean {
  return new RegExp(PINTEREST_URL_PATTERN.source, 'i').test(url);
}
