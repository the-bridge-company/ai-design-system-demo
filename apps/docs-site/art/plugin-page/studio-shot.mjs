// The step 3 screen of /figma-plugin/: the Bridge Studio page of the token change sent from the plugin (PR #468,
// color.bg.zone, added to the library), captured from the live site at 2x, into apps/docs-site/public/plugin-art/:
//   review-in-studio.png        1440 wide page, the title and "What changes" (1032 x 300 CSS px, 2064 x 600)
//   review-in-studio-phone.png  the same page 360 wide, the same parts (330 x 334 CSS px, shown on phones)
// Nothing is staged: the page is loaded as it is. Studio calls api.github.com from the browser; anonymous reads are
// limited to 60 an hour, so with GITHUB_TOKEN set those GET calls get the token on this side (the page never sees it).
// BRIDGE_URL points at another build (a local `npm run preview -w @bridge-ds/docs-site`, say).
// Usage (from the repo root): [GITHUB_TOKEN=...] [BRIDGE_URL=...] node apps/docs-site/art/plugin-page/studio-shot.mjs [out-dir]
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(here, '../../public/plugin-art');
const bridge = (process.env.BRIDGE_URL || 'https://bridgedesignsystem.com').replace(/\/$/, '');
const url = `${bridge}/studio/~/the-bridge-company/ai-design-system-demo/changes/?pr=468`;
const token = process.env.GITHUB_TOKEN;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const shot of [
  { file: 'review-in-studio.png', viewport: { width: 1440, height: 900 }, clip: { x: 332, y: 170, width: 1032, height: 300 } },
  { file: 'review-in-studio-phone.png', viewport: { width: 360, height: 900 }, clip: { x: 9, y: 216, width: 330, height: 334 } },
]) {
  const page = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: 2, colorScheme: 'light' });
  if (token)
    await page.route('https://api.github.com/**', async (r) => {
      if (r.request().method() !== 'GET') return r.abort();
      const res = await r.fetch({ headers: { ...r.request().headers(), authorization: `Bearer ${token}` } });
      return r.fulfill({ response: res });
    });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  // The way back (breadcrumb or back link), the title, who added it and the "What changes" card.
  await page.screenshot({ path: join(out, shot.file), clip: shot.clip });
  await page.close();
  console.log(shot.file);
}
await browser.close();
