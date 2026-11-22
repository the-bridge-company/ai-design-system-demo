// Renders the two-way picture of /figma-plugin/ from hero.html with Chrome (playwright-core, channel chrome), on a
// transparent ground, into apps/docs-site/public/plugin-art/:
//   sync-both-ways.png              wide, light   1831 x 436 (1x)
//   sync-both-ways-dark.png         wide, dark
//   sync-both-ways-narrow.png       stacked for phones, light   800 x 1124 (400 wide at 2x)
//   sync-both-ways-narrow-dark.png  stacked for phones, dark
// The page shows the one that matches data-theme and the viewport. Commands for every image of the page: README.md.
// Usage (from the repo root): node apps/docs-site/art/plugin-page/render.mjs [out-dir]
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(here, '../../public/plugin-art');
const hero = pathToFileURL(join(here, 'hero.html')).href;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const theme of ['light', 'dark'])
  for (const [layout, scale] of [
    ['wide', 1],
    ['narrow', 2],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1900, height: 900 }, deviceScaleFactor: scale });
    await page.goto(`${hero}?layout=${layout}&theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    const file = `sync-both-ways${layout === 'narrow' ? '-narrow' : ''}${theme === 'dark' ? '-dark' : ''}.png`;
    await page.locator(`#${layout}`).screenshot({ path: join(out, file), omitBackground: true });
    await page.close();
    console.log(file);
  }
await browser.close();
