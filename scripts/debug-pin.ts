// Usage: npx tsx scripts/debug-pin.ts <pinterest-url>
import { pinterest } from 'btch-downloader';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npx tsx scripts/debug-pin.ts <pinterest-url>');
    process.exit(1);
  }

  const response = await pinterest(url);
  console.log('=== Full response ===');
  console.log(JSON.stringify(response, null, 2));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (response?.result as any)?.result;
  console.log('\n=== response.result.result (current code path) ===');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
