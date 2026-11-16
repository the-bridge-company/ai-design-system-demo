// Screenshots of the real DS Bridge UI (dist/ui.html) for the Community gallery.
// Figma is not running here, so this script plays the main thread: it answers the UI's requests
// (init, snapshot) the way src/main/index.ts does, with a snapshot built by snapshot.ts. GitHub calls go
// to the real api.github.com, read-only (GET only, anything else is refused), with GITHUB_TOKEN when it is set, else
// anonymously (public repository, 60 calls an hour). Answers are kept in <out-dir>/github-cache, so the push shot
// reuses what the pull shot read, and a second run reads nothing it already has.
// Usage: [GITHUB_TOKEN=...] node plugin-shots.mjs <snapshot.json> <out-dir> <pull|push>
// pull: a file with no variables yet (first pull plan). push: a pulled file with a designer's edits.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const [snapshotPath, outDir, mode = 'push'] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
if (!snapshotPath || !outDir) throw new Error('usage: [GITHUB_TOKEN=...] node plugin-shots.mjs <snapshot.json> <out-dir> <pull|push>');
const auth = token ? { authorization: `Bearer ${token}` } : {};

const ui = readFileSync(join(here, '../../dist/ui.html'), 'utf8');
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const config = JSON.parse(readFileSync(join(here, '../../../../bridge.config.json'), 'utf8'));
const repo = `${config.repo.owner}/${config.repo.name}`;
const cacheDir = join(outDir, 'github-cache');
mkdirSync(cacheDir, { recursive: true });
const cacheFile = (url) => join(cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
const branchUrl = `https://api.github.com/repos/${repo}/branches/${config.repo.defaultBranch}`;
const headCached = existsSync(cacheFile(branchUrl)) ? JSON.parse(readFileSync(cacheFile(branchUrl), 'utf8')) : undefined;
const head = headCached ? JSON.parse(headCached.body) : await (await fetch(branchUrl, { headers: auth })).json();
if (!head?.commit?.sha) throw new Error(`GitHub did not answer ${branchUrl}: ${head?.message ?? 'no body'}`);
if (!headCached) writeFileSync(cacheFile(branchUrl), JSON.stringify({ status: 200, contentType: 'application/json', body: JSON.stringify(head) }));

const init = {
  settings: { repo, branch: config.repo.defaultBranch, tokensPath: config.tokens.root },
  // The file was pulled from the current main: the snapshot's edits are the only Figma changes.
  sync: snapshot.variables.length ? { baseSha: head.commit.sha, lastPullAt: new Date().toISOString() } : {},
  hasToken: true,
  token: 'held-by-the-harness',
  fileName: snapshot.fileName,
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 480, height: 640 }, deviceScaleFactor: 2 });
await page.route('https://plugin.local/**', (r) => r.fulfill({ contentType: 'text/html', body: ui }));
await page.route('https://api.github.com/**', async (r) => {
  if (r.request().method() !== 'GET') return r.abort();
  // The UI sends the harness's placeholder token: replace it with GITHUB_TOKEN, or drop it for an anonymous read.
  const { authorization: _placeholder, ...headers } = r.request().headers();
  const url = r.request().url();
  if (existsSync(cacheFile(url))) {
    const c = JSON.parse(readFileSync(cacheFile(url), 'utf8'));
    return r.fulfill({ status: c.status, contentType: c.contentType, headers: { 'access-control-allow-origin': '*' }, body: c.body });
  }
  const res = await r.fetch({ headers: { ...headers, ...auth }, timeout: 60000 }).catch(() => undefined);
  if (!res) return r.abort().catch(() => undefined);
  if (res.status() === 200 || res.status() === 404)
    writeFileSync(cacheFile(url), JSON.stringify({ status: res.status(), contentType: res.headers()['content-type'] ?? 'application/json', body: await res.text() }));
  return r.fulfill({ response: res });
});
// A file with no components yet: the component scans find nothing (the shots show variables only).
const answers = { init, snapshot, 'scan-components': { components: [], fileKey: undefined }, 'scan-generated': [], 'list-components': [], 'read-built': {}, thumbnails: {} };
await page.exposeBinding('__answer', (_src, type) => answers[type] ?? null);
await page.addInitScript(() => {
  // parent === window outside Figma: answer the UI's requests like the main thread would.
  window.addEventListener('message', async (e) => {
    const msg = e.data?.pluginMessage;
    if (msg?.kind !== 'request') return;
    const payload = (await window.__answer(msg.type)) ?? { ok: true };
    window.postMessage({ pluginMessage: { kind: 'response', reqId: msg.reqId, ok: true, payload } }, '*');
  });
});

await page.goto('https://plugin.local/ui.html');
// Busy while the panel says so (aria-busy) or a progress bar shows; started first, so wait for it to begin.
const settle = () =>
  page
    .waitForTimeout(300)
    .then(() => page.waitForFunction(() => document.getElementById('panel')?.getAttribute('aria-busy') !== 'true' && !document.querySelector('.progress'), null, { timeout: 120000 }))
    .then(() => page.waitForTimeout(600));

if (mode === 'pull') {
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await settle();
  // Open what is missing in Figma, so the shot shows the promise: tokens to bring in, components the file lacks.
  await page.getByText(/^\d+ components? missing in Figma$/).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'plugin-pull.png') });
} else {
  await page.getByRole('tab', { name: 'Push' }).click();
  await page.getByRole('button', { name: 'Scan for changes' }).click();
  await settle();
  await page.screenshot({ path: join(outDir, 'plugin-push.png') });
}
await page.unrouteAll({ behavior: 'ignoreErrors' });
await browser.close();
