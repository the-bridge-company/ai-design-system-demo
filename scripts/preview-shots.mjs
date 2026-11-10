#!/usr/bin/env node
// Preview shots: a real thumbnail of every open exploration's preview, for Bridge Studio (the exploration page, the
// Studio home cards and the Changes rows). Run by .github/workflows/preview-shots.yml; see docs/EXPLORATIONS.md.
//
//   node scripts/preview-shots.mjs run --shots <dir> [--config bridge.config.json] [--force] [--dry-run]
//   node scripts/preview-shots.mjs capture --url <preview url> --out <file.webp> [--marker-crawl]
//
// `run` reads the open explorations of this repository and of each product repository in bridge.config.json
// products[] that has a `repo` and a `preview` (its design copy instead, products[].design with a `preview`), captures the preview of every head commit not captured yet, and writes
// into <dir> (a checkout of the orphan branch bridge-shots):
//   <owner>/<repo>/<pr>.webp   800 px wide, from a 1440 by 900 window (the changed screen when Bridge finds it)
//   <owner>/<repo>/<pr>.json   { repo, pr, sha, url, route, screen, title, branch, capturedAt, image, ... }
//   index.json                 every capture by "owner/repo#pr", the one file Studio reads (raw.githubusercontent.com)
// A capture is overwritten for a new head commit. A pull request closed without merging for more than 30 days loses
// its capture; a merged one keeps it ("how it looked").
// Privacy: a product repository's preview is captured only when that repository is public (GitHub says so); for a
// private one nothing is captured and any capture it had is removed, so Studio keeps its plate.
//
// GitHub: GITHUB_TOKEN of the workflow only (GH_TOKEN), never a person's token. The calls: per repository its
// visibility and its open pull requests; per head commit not captured yet its comments (the Vercel bot comment gives
// the preview URL Vercel built, shortened when long) and its commit statuses (is the preview of that commit ready),
// plus its files for a library exploration (which preview app). A closed pull request is read once, its state kept.
//
// Browser: playwright-core with the Chrome of the runner (BRIDGE_CHROME_CHANNEL=chrome) or Chromium. Dependencies
// come from BRIDGE_DEPS (a folder with node_modules/@bridge-ds/core and playwright-core), else this repository.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SHOTS_BRANCH = 'bridge-shots';
export const VIEWPORT = { width: 1440, height: 900 };
export const SHOT_WIDTH = 800;
/** A pull request closed without merging keeps its capture this long. */
export const PRUNE_AFTER_MS = 30 * 24 * 3600 * 1000;
/** Failed captures of one head commit before Bridge stops trying it (a new commit tries again). */
export const MAX_TRIES = 3;
/** Same-origin pages opened to look for the changed screen when the preview root has no marker. */
export const CRAWL_LIMIT = 8;
export const MARKER_ATTR = 'data-bridge-change';

const EXPLORATION_LABEL = 'exploration';
const ARCHIVED_LABEL = 'archived';
const PRODUCT_LABEL_PREFIX = 'product: ';

const labelNames = (p) => (p.labels ?? []).map((l) => (typeof l === 'string' ? l : (l?.name ?? ''))).filter(Boolean);

/** An open exploration Studio shows: the label, an explore/* branch or the Bridge block, not archived. */
export function isOpenExploration(p) {
  if (p.state && p.state !== 'open') return false;
  const names = labelNames(p);
  if (names.includes(ARCHIVED_LABEL)) return false;
  return names.includes(EXPLORATION_LABEL) || (p.head?.ref ?? '').startsWith('explore/') || /<!-- bridge-exploration \{/.test(p.body ?? '') || names.includes('ready-for-devs');
}

/** "the-bridge-company/art-print-shop" and 2: the files of that capture, relative to the shots folder. */
export function shotPaths(repo, pr) {
  const base = `${repo.toLowerCase()}/${pr}`;
  return { image: `${base}.webp`, meta: `${base}.json` };
}

/** The key of a capture in index.json, and in Studio: "owner/repo#pr", lower case. */
export const shotKey = (repo, pr) => `${repo.toLowerCase()}#${pr}`;

/**
 * Which preview app of the design system repository shows a library exploration, from its files (the same order as
 * Studio's lib/exploration-page libraryPreviewApp): the admin demo, the docs, Storybook.
 */
export function libraryApp(files, apps) {
  const f = files ?? [];
  const has = (k) => Boolean(apps?.[k]);
  if (f.some((x) => x.startsWith('apps/admin/')) && has('admin')) return 'admin';
  if (f.some((x) => x.startsWith('apps/docs-site/')) && has('docs')) return 'docs';
  if (f.some((x) => x.startsWith('packages/react/')) && has('storybook')) return 'storybook';
  return has('docs') ? 'docs' : has('storybook') ? 'storybook' : has('admin') ? 'admin' : null;
}

/** The product a "product: <key>" label names, among the configured ones (null for the library or none). */
export function labelledProduct(p, products) {
  for (const l of labelNames(p)) {
    if (!l.toLowerCase().startsWith(PRODUCT_LABEL_PREFIX)) continue;
    const key = l.slice(PRODUCT_LABEL_PREFIX.length).trim().toLowerCase();
    const hit = (products ?? []).find((x) => x.key?.toLowerCase() === key || x.name?.toLowerCase() === key);
    if (hit && !hit.default) return hit;
  }
  return null;
}

const SCREEN_BASE = 'https://preview.bridge.invalid';

/**
 * An exploration's screen as @bridge-ds/core explorationScreenOf reads it, here so the capture runs with any released
 * core: a place on the same preview starting with "/" ("/#/orders/12"), never "//", a scheme or a host, 200 characters
 * at most, no spaces, quotes or backslashes. Else null.
 */
export function screenOf(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 200 || !s.startsWith('/') || s.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s<>"'`\\\u0000-\u001f\u007f]/.test(s)) return null;
  try {
    return new URL(s, SCREEN_BASE).origin === SCREEN_BASE ? s : null;
  } catch {
    return null;
  }
}

/** The screen an exploration's pull request body chose (its `<!-- bridge-exploration {...} -->` block), else null. */
export function bodyScreenOf(body) {
  const m = typeof body === 'string' ? /<!-- bridge-exploration (\{[\s\S]*?\}) -->/.exec(body) : null;
  if (!m) return null;
  try {
    return screenOf(JSON.parse(m[1]).screen);
  } catch {
    return null;
  }
}

/**
 * The preview link opened on a screen (as core previewAtScreen): the screen's path, its query added before its hash
 * route, the link's own parameters kept. A screen that is not a place on the same preview leaves the link as it is.
 */
export function atScreen(link, screen) {
  const s = screenOf(screen);
  if (!link || !s) return link;
  try {
    const u = new URL(link);
    const t = new URL(s, u.origin);
    if (t.origin !== u.origin) return link;
    u.pathname = t.pathname;
    t.searchParams.forEach((v, k) => {
      if (!k.toLowerCase().startsWith('bridge')) u.searchParams.set(k, v);
    });
    u.hash = t.hash;
    return u.href;
  } catch {
    return link;
  }
}

/**
 * What to do with one exploration: skip it (already captured at this head, or tried too often) or capture it.
 * `stored` is its .json when there is one.
 */
export function shotDecision({ sha, stored, force = false, screen = null }) {
  // Another screen chosen since (core Exploration.screen, kept as `at`): captured again on it.
  if (!force && stored?.sha === sha && stored?.image && (stored.at ?? null) === (screen ?? null)) return { action: 'skip', why: 'captured at this head' };
  if (!force && stored?.failed?.sha === sha && (stored.failed.tries ?? 0) >= MAX_TRIES) return { action: 'skip', why: `failed ${stored.failed.tries} times at this head` };
  return { action: 'capture' };
}

/**
 * A stored capture whose pull request is no longer open: keep it, or remove it. `closed` is what GitHub says (read
 * once, kept in the .json): merged keeps it ("how it looked"); closed without merging, removed after 30 days; reopened
 * (open again) keeps it.
 */
export function pruneDecision(meta, now) {
  if (!meta?.closed) return 'keep';
  if (meta.closed.merged) return 'keep';
  const at = Date.parse(meta.closed.at ?? '');
  if (!Number.isFinite(at)) return 'keep';
  return now - at > PRUNE_AFTER_MS ? 'remove' : 'keep';
}

/** index.json from every stored capture with an image: sorted keys, so an unchanged set writes the same bytes. */
export function buildIndex(metas) {
  const shots = {};
  for (const m of [...metas].filter((x) => x && x.image && x.sha).sort((a, b) => shotKey(a.repo, a.pr).localeCompare(shotKey(b.repo, b.pr)))) {
    shots[shotKey(m.repo, m.pr)] = {
      sha: m.sha,
      capturedAt: m.capturedAt,
      image: m.image,
      ...(m.url ? { url: m.url } : {}),
      ...(m.route ? { route: m.route } : {}),
      ...(m.screen ? { screen: m.screen } : {}),
      ...(m.closed ? { closed: m.closed } : {}),
    };
  }
  return { version: 1, branch: SHOTS_BRANCH, shots };
}

/** A same-origin link worth opening while looking for the changed screen: a page, not a file, an anchor or the root. */
export function crawlTargets(hrefs, origin, limit = CRAWL_LIMIT) {
  const seen = new Set(['/']);
  const out = [];
  for (const h of hrefs) {
    let u;
    try {
      u = new URL(h, origin);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|json|xml|txt|css|js)$/i.test(u.pathname)) continue;
    // A hash-routed app (react-admin, #/orders) keeps every page on "/": the route is the hash.
    const route = u.hash.startsWith('#/') ? u.hash.replace(/[?].*$/, '').replace(/\/+$/, '') : '';
    const path = (u.pathname.replace(/\/+$/, '') || '/') + route;
    if (seen.has(path) || route === '#') continue;
    seen.add(path);
    out.push(`${origin}${u.pathname}${u.search}${route ? u.hash : ''}`);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Dependencies, GitHub, files.

function deps() {
  const base = process.env.BRIDGE_DEPS ? resolve(process.env.BRIDGE_DEPS, 'package.json') : fileURLToPath(import.meta.url);
  const require = createRequire(base);
  const load = (name) => import(pathToFileURL(require.resolve(name)).href);
  return { core: () => load('@bridge-ds/core'), playwright: () => load('playwright-core') };
}

function gh(token) {
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  let calls = 0;
  const get = async (path) => {
    calls++;
    const res = await fetch(`${api}${path}`, {
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}), 'user-agent': 'bridge-preview-shots' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
    return res.json();
  };
  return { get, calls: () => calls };
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

/** Every stored capture's .json under the shots folder (owner/repo/pr.json). */
function storedMetas(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const owner of readdirSync(dir)) {
    const od = join(dir, owner);
    if (owner.startsWith('.') || !statSync(od).isDirectory() || owner === 'apps' || owner === 'deploy') continue;
    for (const repo of readdirSync(od)) {
      const rd = join(od, repo);
      if (!statSync(rd).isDirectory()) continue;
      for (const f of readdirSync(rd)) {
        if (!/^\d+\.json$/.test(f)) continue;
        const m = readJson(join(rd, f));
        if (m && m.repo && m.pr) out.push({ ...m, file: relative(dir, join(rd, f)) });
      }
    }
  }
  return out;
}

const log = (...a) => console.log(...a);

// ---------------------------------------------------------------------------------------------------------------
// Capture.

const HIDE_CSS = `[data-bridge-toolbar], vercel-live-feedback, #vercel-live-feedback, [id^="vercel-toolbar"], vercel-toolbar { display: none !important; }
*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }`;

async function settle(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(async (err) => {
    // A page that keeps a connection open never reaches network idle: the load event is enough.
    if (!/timeout/i.test(String(err?.message))) throw err;
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => undefined);
  });
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(600);
}

const markerOf = (page) =>
  page.evaluate((attr) => {
    const el = document.querySelector(`[${attr}]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { label: el.getAttribute(attr) || null, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  }, MARKER_ATTR);

/** Downscales a PNG to `width` px and encodes it as WebP, in the browser: no image library on the runner. */
async function toWebp(context, png, width) {
  const page = await context.newPage();
  try {
    await page.setContent('<!doctype html><title>shot</title>');
    return Buffer.from(
      await page.evaluate(
        async ({ b64, w }) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const h = Math.round((img.height * w) / img.width);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, w, h);
          return c.toDataURL('image/webp', 0.82).split(',')[1];
        },
        { b64: png.toString('base64'), w: width },
      ),
      'base64',
    );
  } finally {
    await page.close();
  }
}

/**
 * One capture: the preview root, or the first page that carries a change marker (data-bridge-change) among the root's
 * same-origin links, scrolled so the marked area is in view. No ?bridge parameter: the Bridge toolbar stays closed.
 */
/**
 * The link to open when no page carries a change marker: the first same-origin page whose address or text names one of
 * `hints` (the changed files' names, such as "billing" for src/pages/Billing.tsx), else null.
 */
export function hintedTarget(links, origin, hints) {
  const h = (hints ?? []).map((x) => String(x).toLowerCase()).filter((x) => x.length >= 3);
  if (!h.length) return null;
  const pages = [];
  for (const { href, text } of links) {
    let u;
    try {
      u = new URL(href, origin);
    } catch {
      continue;
    }
    if (u.origin !== origin || (u.pathname === '/' && !u.hash)) continue;
    pages.push({ href: u.href, words: `${u.pathname} ${u.hash} ${text ?? ''}`.toLowerCase() });
  }
  // The strongest hint first (the whole name of a changed page), whatever order the links come in.
  for (const x of h) {
    const hit = pages.find((p) => p.words.includes(x));
    if (hit) return hit.href;
  }
  return null;
}

export async function captureOne(browser, url, { crawl = true, hints = [] } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const root = new URL(url);
    await settle(page, root.href);
    let marker = await markerOf(page);
    if (!marker && hints.length) {
      // No marker on the root: the page the changed files name, when the root links to it.
      const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href') || '', text: a.textContent || '' })));
      const target = hintedTarget(links, root.origin, hints);
      if (target) {
        await settle(page, target).catch(() => undefined);
        marker = (await markerOf(page).catch(() => null)) ?? { label: null, top: 0, bottom: 0, hinted: true };
      }
    }
    if (!marker && crawl) {
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''));
      for (const target of crawlTargets(hrefs, root.origin)) {
        await settle(page, target).catch(() => undefined);
        marker = await markerOf(page).catch(() => null);
        if (marker) break;
      }
      if (!marker) await settle(page, root.href);
    }
    await page.addStyleTag({ content: HIDE_CSS }).catch(() => undefined);
    if (marker && marker.bottom > VIEWPORT.height) {
      // The marked area, a little below the top of the window, so its heading shows.
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), marker.top - 96);
      await page.waitForTimeout(300);
    }
    const final = new URL(page.url());
    const png = await page.screenshot({ type: 'png' });
    const webp = await toWebp(context, png, SHOT_WIDTH);
    return { webp, route: final.pathname + final.search + final.hash, screen: marker?.label ?? null, width: SHOT_WIDTH, height: Math.round((VIEWPORT.height * SHOT_WIDTH) / VIEWPORT.width) };
  } finally {
    await context.close();
  }
}

export async function launch() {
  const pw = await deps().playwright();
  const chromium = pw.chromium ?? pw.default?.chromium;
  const channel = process.env.BRIDGE_CHROME_CHANNEL || undefined;
  return chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
}

// ---------------------------------------------------------------------------------------------------------------
// Who gets it (Studio, Library review): the main screens of each product, and what each waiting library change does
// to them, measured, never guessed. For each product with a live address (bridge.config.json products[].production,
// else its preview of the default branch), a small crawl of its navigation finds its main screens (same-origin links,
// the first page of each section, then one detail page per section, REACH_SCREENS_MAX at most). Each screen is opened
// once; for each open library change that sets token values, the values it sets are applied to the page (the CSS
// variables the change rewrites, with !important) and the screen is compared with itself: the computed style of every
// visible element, and the pixels. A screen whose elements change gets the change; the counts say which elements
// (buttons, links, fields, text, surfaces). A change that only adds tokens changes no screen ("new"): Studio shows
// the exploration that asked for it instead. The summary (REACH_SUMMARY) names images by plain names; where they live
// is the caller's: the bridge-shots branch (run, public products only) or Bridge's private store (private-shots.mjs).

export const REACH_SCREENS_MAX = 12;
/** Width of the stored screen images: a Who gets it card is at most 640 px wide on a 2x screen. */
export const REACH_WIDTH = 640;
/** The product screens are measured again after this long even when no change moved. */
export const REACH_MAX_AGE_MS = 24 * 3600 * 1000;
/** Folder of the bridge-shots branch: reach/summary.json and reach/<run>/<name>.webp. */
export const REACH_DIR = 'reach';
/** A pixel counts as changed past this difference on any channel (0 to 255): the same browser renders both. */
export const REACH_PIXEL_THRESHOLD = 1;
/** Computed styles compared per element. Positions and sizes are left out: a moved element is not a changed one. */
export const REACH_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'box-shadow',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'row-gap',
  'column-gap',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
];
export const REACH_KINDS = ['buttons', 'links', 'fields', 'text', 'surfaces'];

const singular = (w) => w.replace(/ies$/i, 'y').replace(/(ss)$/i, '$1').replace(/([^s])s$/i, '$1');
const capital = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);
/** "Orders30" and "Orders52+24%vs previous 30 days" read "Orders": a nav label without its badge. */
const navLabel = (t) => (/^[^\d+%]*/.exec(String(t ?? '').replace(/\s+/g, ' ').trim())?.[0] ?? '').trim().slice(0, 40);

/** The route of an address in its app: the hash route of a hash-routed app ("#/orders/12"), else the path. */
export function routeSegments(u) {
  const hash = u.hash.startsWith('#/') ? u.hash.slice(1).replace(/[?].*$/, '') : null;
  return (hash ?? u.pathname).replace(/\/+$/, '').split('/').filter(Boolean);
}

/**
 * The main screens of a product from the links of its first page (`base`, the address it settled on): the first page
 * of each section of its navigation in order, then one detail page per section ("Order detail"), `max` at most with
 * the first page itself. Same origin only; no file, no in-page anchor, no sign-out.
 */
export function screenTargets(links, base, max = REACH_SCREENS_MAX) {
  let root;
  try {
    root = new URL(base);
  } catch {
    return [];
  }
  const sections = new Map();
  const details = new Map();
  for (const { href, text } of links ?? []) {
    let u;
    try {
      u = new URL(href, root);
    } catch {
      continue;
    }
    if (u.origin !== root.origin) continue;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|json|xml|txt|css|js|csv)$/i.test(u.pathname)) continue;
    if (/log-?out|sign-?out/i.test(`${u.pathname}${u.hash} ${text ?? ''}`)) continue;
    // An anchor on the same page ("#main"), not a route.
    if (u.hash && !u.hash.startsWith('#/') && u.pathname === root.pathname) continue;
    const segs = routeSegments(u);
    if (!segs.length) continue;
    const first = segs[0].toLowerCase();
    if (segs.length === 1) {
      const label = navLabel(text);
      if (!sections.has(first)) sections.set(first, { url: u.href, title: label || capital(first.replace(/[-_]+/g, ' ')) });
      else if (!sections.get(first).title && label) sections.get(first).title = label;
    } else if (!details.has(first)) details.set(first, u.href);
  }
  const out = [];
  for (const s of sections.values()) out.push(s);
  for (const [first, url] of details) {
    const section = sections.get(first)?.title ?? capital(first.replace(/[-_]+/g, ' '));
    out.push({ url, title: `${capital(singular(section))} detail` });
  }
  return out.slice(0, Math.max(0, max - 1));
}

const TOKEN_FILE = /\.tokens\.json$/;
const SAFE_CSS = /^[^;{}<>\\]*$/;

/** Every token of a DTCG file: path, value and type (inherited from its groups). */
export function tokenLeaves(json) {
  const out = new Map();
  const walk = (node, path, type) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const t = typeof node.$type === 'string' ? node.$type : type;
    if ('$value' in node) {
      out.set(path.join('.'), { value: node.$value, type: t ?? null });
      return;
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k], t);
  };
  walk(json, [], null);
  return out;
}

const two = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');

/** A token value as CSS, or null when Bridge cannot write it as one value (a typography group). */
export function cssValueOf(value, type, cssVar = {}) {
  const prefix = cssVar.prefix ?? '--';
  const sep = cssVar.separator ?? '-';
  const go = (v, t) => {
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') {
      const alias = /^\{([^{}]+)\}$/.exec(v.trim());
      if (alias) return `var(${prefix}${alias[1].split('.').join(sep)})`;
      return v;
    }
    if (Array.isArray(v)) {
      if (t === 'cubicBezier' && v.length === 4 && v.every((x) => typeof x === 'number')) return `cubic-bezier(${v.join(', ')})`;
      if (t === 'shadow') {
        const parts = v.map((x) => go(x, 'shadow'));
        return parts.every(Boolean) ? parts.join(', ') : null;
      }
      const parts = v.map((x) => (typeof x === 'string' && /\s/.test(x) && !x.startsWith('var(') ? `"${x}"` : go(x, t)));
      return parts.every(Boolean) ? parts.join(', ') : null;
    }
    if (v && typeof v === 'object') {
      if ('colorSpace' in v || 'hex' in v || 'components' in v) {
        const alpha = typeof v.alpha === 'number' ? v.alpha : 1;
        if (typeof v.hex === 'string' && /^#[0-9a-f]{6}$/i.test(v.hex)) return alpha < 1 ? `${v.hex}${two(alpha)}` : v.hex;
        if (v.colorSpace === 'srgb' && Array.isArray(v.components) && v.components.length === 3) {
          const [r, g, b] = v.components.map((c) => Math.round(Number(c) * 255));
          return alpha < 1 ? `rgb(${r} ${g} ${b} / ${alpha})` : `rgb(${r} ${g} ${b})`;
        }
        return null;
      }
      if ('value' in v && 'unit' in v && typeof v.value === 'number' && typeof v.unit === 'string') return `${v.value}${v.unit}`;
      if (t === 'shadow' || ('offsetX' in v && 'color' in v)) {
        const p = ['offsetX', 'offsetY', 'blur', 'spread'].map((k) => (v[k] === undefined ? '0px' : go(v[k], 'dimension')));
        const c = go(v.color, 'color');
        if (!c || p.some((x) => !x)) return null;
        return `${v.inset ? 'inset ' : ''}${p.join(' ')} ${c}`;
      }
      return null;
    }
    return null;
  };
  const css = go(value, type);
  return css && SAFE_CSS.test(css) && css.length <= 300 ? css : null;
}

/**
 * Where a token file's values apply, from its path and the modes of bridge.config.json: "semantic/dark.tokens.json"
 * is { theme: "dark" }, "brands/ocean.tokens.json" { brand: "ocean" }, "primitives/color.tokens.json" everywhere ({}).
 */
export function fileModes(path, modes = {}) {
  const parts = path.replace(TOKEN_FILE, '').toLowerCase().split(/[/.]/);
  const out = {};
  for (const [mode, def] of Object.entries(modes ?? {})) {
    const values = (def?.values ?? []).map((x) => String(x).toLowerCase());
    const hit = parts.find((p) => values.includes(p));
    if (hit && /^[a-z0-9-]+$/.test(hit) && /^[a-z0-9-]+$/.test(mode)) out[mode] = hit;
  }
  return out;
}

const selectorOf = (m) => {
  const attrs = Object.entries(m).map(([k, v]) => `[data-${k}="${v}"]`);
  if (!attrs.length) return ':root';
  if (attrs.length === 1) return attrs[0];
  // The modes on one element, or set on nested elements (a brand on the page, a theme on a zone).
  return `${attrs.join('')}, ${attrs.join(' ')}`;
};

/**
 * The CSS a library change sets, from its token files before and after (`files`: { path, before, after }, the file's
 * text or null): every token whose value changed, as its CSS variable with !important under the modes its file
 * applies to. Tokens only added or only removed set nothing on a screen. `theme` is the theme to measure in: the
 * default one, or the only theme the change touches ("dark" for a change to dark values only).
 */
export function tokenOverrides(files, { modes = {}, cssVar = {} } = {}) {
  const rules = new Map();
  let changed = 0;
  let added = 0;
  let removed = 0;
  let skipped = 0;
  const themes = new Set();
  const prefix = cssVar.prefix ?? '--';
  const sep = cssVar.separator ?? '-';
  for (const f of files ?? []) {
    if (!f || !TOKEN_FILE.test(f.path ?? '')) continue;
    const parse = (s) => {
      try {
        return s ? tokenLeaves(JSON.parse(s)) : new Map();
      } catch {
        return new Map();
      }
    };
    const before = parse(f.before);
    const after = parse(f.after);
    const m = fileModes(f.path, modes);
    for (const [path, t] of after) {
      const was = before.get(path);
      if (!was) {
        added++;
        continue;
      }
      if (JSON.stringify(was.value) === JSON.stringify(t.value)) continue;
      const css = cssValueOf(t.value, t.type ?? was.type, cssVar);
      if (!css) {
        skipped++;
        continue;
      }
      const sel = selectorOf(m);
      if (!rules.has(sel)) rules.set(sel, {});
      rules.get(sel)[`${prefix}${path.split('.').join(sep)}`] = css;
      themes.add(m.theme ?? '*');
      changed++;
    }
    for (const path of before.keys()) if (!after.has(path)) removed++;
  }
  const css = [...rules].map(([sel, vars]) => `${sel} { ${Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join(' ')} }`).join('\n');
  const def = String(modes?.theme?.default ?? 'light').toLowerCase();
  const named = [...themes].filter((x) => x !== '*');
  const theme = themes.has('*') || !named.length || named.includes(def) ? def : named[0];
  return { css, changed, added, removed, skipped, theme };
}

/** What a measured change is: it changes screens ("measured"), only adds ("new"), or Bridge cannot draw it ("unmeasured"). */
export function changeState(o) {
  if (o.changed > 0) return 'measured';
  if (o.skipped > 0) return 'unmeasured';
  return 'new';
}

/** The token files of a library change under the tokens root, at most `max`. */
export function tokenFilesOf(files, root = '', max = 12) {
  const r = String(root ?? '').replace(/\/+$/, '');
  return (files ?? [])
    .filter((f) => TOKEN_FILE.test(f.filename ?? '') && (!r || f.filename.startsWith(`${r}/`)) && f.status !== 'removed' && f.status !== 'added')
    .slice(0, max)
    .map((f) => f.filename);
}

/** "owner/repo#13@<sha>": what a stored summary measured, to know when a change moved. */
const changeId = (c) => `${String(c.repo).toLowerCase()}#${c.pr}@${c.sha}`;

/**
 * Whether a team's screens are measured again: never measured, older than REACH_MAX_AGE_MS, a product address or a
 * waiting change that moved (new, updated or gone), or forced.
 */
export function reachDue(stored, { products = [], changes = [] }, now, force = false) {
  if (force || !stored) return true;
  const at = Date.parse(stored.measuredAt ?? '');
  if (!Number.isFinite(at) || now - at > REACH_MAX_AGE_MS) return true;
  const a = (stored.products ?? []).map((p) => `${p.key}|${p.url}`).sort().join(',');
  const b = products.map((p) => `${p.key}|${p.url}`).sort().join(',');
  if (a !== b) return true;
  const x = (stored.changes ?? []).map(changeId).sort().join(',');
  const y = changes.map(changeId).sort().join(',');
  return x !== y;
}

/** The live address of a product: products[].production, else its preview of the default branch. */
export function productAddress(p, previewUrl, defaultBranch = 'main') {
  if (typeof p?.production === 'string' && /^https:\/\//.test(p.production)) return p.production;
  if (typeof p?.preview === 'string' && /^https:\/\//.test(p.preview) && previewUrl) return previewUrl(p.preview, { branch: defaultBranch }) ?? null;
  return null;
}

// In the page: the styles of every element, then what an override changed. Kept as strings of code the page runs.
const SNAPSHOT = (props) => {
  const els = [...document.querySelectorAll('body *')];
  window.__bridgeReach = { els, base: els.map((e) => { const cs = getComputedStyle(e); return props.map((p) => cs.getPropertyValue(p)); }) };
  return els.length;
};
const DIFFER = ({ props }) => {
  const { els, base } = window.__bridgeReach;
  const CONTROL = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], input, select, textarea';
  const BUTTON = 'button, [role="button"], [role="tab"], [role="menuitem"], input[type="button"], input[type="submit"], input[type="reset"]';
  const FIELD = 'input, select, textarea, [role="textbox"], [role="combobox"]';
  const TEXT = new Set(['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-decoration-color']);
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  // A changed value counts only where it shows: a border with a width, an outline that is drawn, text on the element
  // itself (a container's color shows through its text, counted there), SVG paint on SVG.
  const shows = (el, cs, p) => {
    const side = /^border-(top|right|bottom|left)-color$/.exec(p);
    if (side) return cs.getPropertyValue(`border-${side[1]}-style`) !== 'none' && parseFloat(cs.getPropertyValue(`border-${side[1]}-width`)) > 0;
    if (p === 'outline-color') return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    if (p === 'text-decoration-color') return !/none/.test(cs.textDecorationLine) && hasText(el);
    if (p === 'fill' || p === 'stroke') return el instanceof SVGElement && cs.getPropertyValue(p) !== 'none';
    if (TEXT.has(p)) return hasText(el) || el.matches(CONTROL);
    return true;
  };
  const visible = (el, cs) => {
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
  };
  const units = new Map();
  const seen = {};
  let top = null;
  els.forEach((el, i) => {
    if (!el.isConnected) return;
    const cs = getComputedStyle(el);
    const set = props.filter((p, j) => cs.getPropertyValue(p) !== base[i][j] && shows(el, cs, p));
    if (!set.length || !visible(el, cs)) return;
    for (const p of set) seen[p] = (seen[p] ?? 0) + 1;
    const unit = el.closest(CONTROL) ?? el;
    if (units.has(unit)) return;
    let kind = 'surfaces';
    if (unit.matches(BUTTON)) kind = 'buttons';
    else if (unit.matches('a[href], [role="link"]')) {
      const bg = getComputedStyle(unit).backgroundColor;
      kind = /\b(btn|button)\b/i.test(unit.className?.baseVal ?? unit.className ?? '') || (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ? 'buttons' : 'links';
    } else if (unit.matches(FIELD)) kind = 'fields';
    else if (set.every((p) => TEXT.has(p))) kind = 'text';
    units.set(unit, kind);
    const t = unit.getBoundingClientRect().top + window.scrollY;
    top = top === null ? t : Math.min(top, t);
  });
  const counts = { buttons: 0, links: 0, fields: 0, text: 0, surfaces: 0 };
  for (const k of units.values()) counts[k]++;
  return { counts, top, seen };
};

async function pixelDiff(helper, a, b, threshold = REACH_PIXEL_THRESHOLD) {
  return helper.evaluate(
    async ({ a, b, t }) => {
      const load = async (s) => {
        const i = new Image();
        i.src = `data:image/png;base64,${s}`;
        await i.decode();
        return i;
      };
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const px = (img) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, w, h).data;
      };
      const da = px(ia);
      const db = px(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > t || Math.abs(da[i + 1] - db[i + 1]) > t || Math.abs(da[i + 2] - db[i + 2]) > t) n++;
      return w * h ? n / (w * h) : 0;
    },
    { a: a.toString('base64'), b: b.toString('base64'), t: threshold },
  );
}

const OVERRIDE_ID = 'bridge-reach-override';
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
async function applyOverride(page, css) {
  await page.evaluate(
    ({ id, css }) => {
      document.getElementById(id)?.remove();
      if (!css) return;
      const s = document.createElement('style');
      s.id = id;
      s.textContent = css;
      document.head.appendChild(s);
    },
    { id: OVERRIDE_ID, css },
  );
  await frames(page);
  await page.waitForTimeout(120);
}
const setTheme = (page, theme) =>
  page.evaluate((t) => {
    const el = document.documentElement;
    if (t) el.setAttribute('data-theme', t);
  }, theme);

/** A page's own name for itself: its first visible heading, else null. */
const headingOf = (page) =>
  page
    .evaluate(() => {
      for (const h of document.querySelectorAll('h1, [role="heading"][aria-level="1"], h2')) {
        const r = h.getBoundingClientRect();
        const t = (h.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (r.width > 0 && r.height > 0 && t) return t.slice(0, 40);
      }
      return null;
    })
    .catch(() => null);

/**
 * Measures one team: opens each product's main screens once and, on each, every change's values. `save(name, webp)`
 * keeps an image (a file, or Bridge's store) and resolves when kept. Returns the summary (REACH_SUMMARY), images by
 * name. `team`: { products: [{ key, name, repo, url }], changes: [{ repo, pr, sha, title, files }], modes, cssVar }.
 */
export async function measureReach(browser, team, save, { log: say = log, max = REACH_SCREENS_MAX, now = () => Date.now() } = {}) {
  const changes = (team.changes ?? []).map((c) => ({ ...c, o: tokenOverrides(c.files, { modes: team.modes, cssVar: team.cssVar }) }));
  const measured = changes.filter((c) => changeState(c.o) === 'measured');
  const products = [];
  const results = new Map(changes.map((c) => [`${c.repo}#${c.pr}`, []]));
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const helper = await context.newPage();
  await helper.setContent('<!doctype html><title>reach</title>');
  const webpOf = (png) => toWebp(context, png, REACH_WIDTH);
  try {
    for (const product of team.products ?? []) {
      const page = await context.newPage();
      const screens = [];
      try {
        await settle(page, product.url);
        if (looksLikeAWallUrl(page.url())) {
          say(`${product.key}: ${product.url} asks to sign in, no screen measured.`);
          continue;
        }
        const base = page.url();
        const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href') || '', text: a.textContent || '' })));
        const targets = [{ url: base, title: null }, ...screenTargets(links, base, max)];
        for (const [i, t] of targets.entries()) {
          const id = `${product.key}-${i}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          try {
            if (i > 0) await settle(page, t.url);
            await page.addStyleTag({ content: HIDE_CSS }).catch(() => undefined);
            await page.evaluate(() => window.scrollTo(0, 0));
            const u = new URL(page.url());
            const title = t.title ?? (await headingOf(page)) ?? 'Home';
            const themeOf = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
            // The screen as it is, in the default theme: Today on every card.
            const today = await page.screenshot({ type: 'png' });
            const image = `s-${id}`;
            await save(image, await webpOf(today));
            screens.push({ id, route: u.pathname + u.search + u.hash, title, image });
            for (const c of measured) {
              const themed = c.o.theme && themeOf && c.o.theme !== themeOf;
              if (themed) {
                await setTheme(page, c.o.theme);
                await frames(page);
              }
              const before = themed ? await page.screenshot({ type: 'png' }) : today;
              const control = await page.screenshot({ type: 'png' });
              const noise = await pixelDiff(helper, before, control);
              await page.evaluate(SNAPSHOT, REACH_PROPS);
              await applyOverride(page, c.o.css);
              const diff = await page.evaluate(DIFFER, { props: REACH_PROPS });
              if (process.env.BRIDGE_REACH_DEBUG) say(`  #${c.pr} ${id}: ${JSON.stringify(diff.counts)} ${JSON.stringify(diff.seen)}`);
              let after = await page.screenshot({ type: 'png' });
              const pixels = noise > 0 ? 0 : await pixelDiff(helper, before, after);
              const elements = Object.values(diff.counts).reduce((n, x) => n + x, 0);
              let shownBefore = before;
              if (elements > 0 && diff.top !== null && diff.top > VIEWPORT.height - 80) {
                // Every changed element is below the first screen: both images scrolled to the first one.
                await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), diff.top - 96);
                await page.waitForTimeout(150);
                after = await page.screenshot({ type: 'png' });
                await applyOverride(page, '');
                shownBefore = await page.screenshot({ type: 'png' });
                await page.evaluate(() => window.scrollTo(0, 0));
              } else await applyOverride(page, '');
              if (themed) {
                await setTheme(page, themeOf);
                await frames(page);
              }
              // The elements decide: pixels alone also move with a clock, a chart or an image still loading.
              if (elements > 0) {
                const name = `c${c.pr}-${id}`;
                const b = shownBefore === today ? image : `${name}-b`;
                if (b !== image) await save(b, await webpOf(shownBefore));
                await save(`${name}-a`, await webpOf(after));
                results.get(`${c.repo}#${c.pr}`).push({ id, before: b, after: `${name}-a`, elements: diff.counts, pixels: Math.round(pixels * 1e5) / 1e5 });
              }
            }
          } catch (e) {
            say(`${product.key}: ${t.url} could not be measured (${String(e?.message ?? e).slice(0, 160)}).`);
          }
        }
      } catch (e) {
        say(`${product.key}: ${product.url} could not be opened (${String(e?.message ?? e).slice(0, 160)}).`);
      } finally {
        await page.close().catch(() => undefined);
      }
      products.push({ key: product.key, name: product.name, ...(product.repo ? { repo: product.repo } : {}), url: product.url, screens });
      say(`${product.key}: ${screens.length} screen(s) measured.`);
    }
  } finally {
    await context.close();
  }
  return {
    version: 1,
    measuredAt: new Date(now()).toISOString(),
    products,
    changes: changes.map((c) => ({
      repo: c.repo,
      pr: c.pr,
      sha: c.sha,
      title: c.title ?? '',
      state: changeState(c.o),
      theme: c.o.theme,
      values: c.o.changed,
      screens: results.get(`${c.repo}#${c.pr}`),
    })),
  };
}

function looksLikeAWallUrl(href) {
  try {
    const u = new URL(href);
    return /(^|\.)vercel\.com$/.test(u.hostname) || /\/login|\/sso|cdn-cgi\/access/.test(u.pathname);
  } catch {
    return true;
  }
}

/** A team's waiting library changes that set token values: open pull requests of its design system repository. */
export async function tokenChanges(api, repo, config, { maxChanges = 8 } = {}) {
  const pulls = (await api.get(`/repos/${repo}/pulls?state=open&per_page=50`)) ?? [];
  const root = config.tokens?.root ?? '';
  const out = [];
  for (const p of pulls) {
    if (out.length >= maxChanges) break;
    if (isOpenExploration(p)) continue;
    const files = tokenFilesOf((await api.get(`/repos/${repo}/pulls/${p.number}/files?per_page=100`)) ?? [], root);
    if (!files.length) continue;
    const text = async (path, ref) => {
      const f = await api.get(`/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`).catch(() => null);
      return f?.content ? Buffer.from(f.content, 'base64').toString('utf8') : null;
    };
    const both = await Promise.all(files.map(async (path) => ({ path, before: await text(path, p.base.sha), after: await text(path, p.head.sha) })));
    out.push({ repo, pr: p.number, sha: p.head.sha, title: p.title, files: both });
  }
  return out;
}

/** The products of a config Bridge can measure: a live address, not the library itself. */
export function reachProducts(config, previewUrl) {
  return (config.products ?? [])
    .filter((p) => !p.default && p.key && p.name)
    .map((p) => ({ key: String(p.key), name: String(p.name), ...(p.repo ? { repo: p.repo } : {}), url: productAddress(p, previewUrl, config.repo?.defaultBranch ?? 'main') }))
    .filter((p) => p.url);
}

/**
 * The bridge-shots part of `run`: a public product's screens and the changes of this repository, into reach/ (only
 * when due). Private products are left out (Bridge's own workflow measures them, private-shots.mjs).
 */
export async function reachRun({ dir, config, api, host, force = false, dryRun = false, core, now = Date.now(), privateRepos = new Set() }) {
  const summaryFile = join(dir, REACH_DIR, 'summary.json');
  const stored = readJson(summaryFile);
  const products = [];
  for (const p of reachProducts(config, core?.previewUrl)) {
    const repo = (p.repo ?? '').toLowerCase();
    if (!repo || privateRepos.has(repo)) continue;
    const info = await api.get(`/repos/${p.repo}`).catch(() => null);
    if (!info || info.private || (info.visibility && info.visibility !== 'public')) continue;
    products.push(p);
  }
  const changes = await tokenChanges(api, host, config).catch((e) => (log(`reach: ${e.message}`), []));
  if (!products.length) {
    if (stored && !dryRun) rmSync(join(dir, REACH_DIR), { recursive: true, force: true });
    log('reach: no public product with a live address, nothing measured.');
    return { changed: Boolean(stored) };
  }
  if (!reachDue(stored, { products, changes }, now, force)) {
    log('reach: up to date.');
    return { changed: false };
  }
  if (dryRun) {
    log(`reach: would measure ${products.length} product(s) and ${changes.length} change(s).`);
    return { changed: false };
  }
  const run = String(now);
  const runDir = join(dir, REACH_DIR, run);
  mkdirSync(runDir, { recursive: true });
  const browser = await launch();
  let summary;
  try {
    summary = await measureReach(browser, { products, changes, modes: config.modes, cssVar: config.cssVar }, async (name, webp) => writeFileSync(join(runDir, `${name}.webp`), webp));
  } finally {
    await browser.close();
  }
  const at = (name) => `${REACH_DIR}/${run}/${name}.webp`;
  const out = {
    ...summary,
    products: summary.products.map((p) => ({ ...p, screens: p.screens.map((s) => ({ ...s, image: at(s.image) })) })),
    changes: summary.changes.map((c) => ({ ...c, screens: c.screens.map((s) => ({ ...s, before: at(s.before), after: at(s.after) })) })),
  };
  writeJson(summaryFile, out);
  for (const d of readdirSync(join(dir, REACH_DIR))) if (d !== run && /^\d+$/.test(d)) rmSync(join(dir, REACH_DIR, d), { recursive: true, force: true });
  return { changed: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Check the build (Studio review mode): the approved design (the exploration's preview) and the developers' build (their
// pull request's preview) opened on the same screen, at three sizes, in the same browser. Each page says what it shows
// element by element (BUILD_EXTRACT: text, role, box, computed styles, the data-bridge-change marker around it); the
// pure part below matches the elements of the two pages (markers first, then text, then role and place), compares the
// matched ones, drops the noise (images, charts, live dates, rounding) and groups what differs by region of the page,
// each with one plain sentence and its measured facts. Images: the whole page per size and side, and one crop per
// region and side, named by plain names; where they live is the caller's (Bridge's private store, private-shots.mjs).

/** The three sizes a build is checked at: laptop, small laptop, phone. */
export const BUILD_SIZES = [
  { key: 'laptop', label: 'Laptop', width: 1280, height: 800, scale: 1, maxPage: 2200, imageWidth: 1024 },
  { key: 'small', label: 'Small laptop', width: 1024, height: 768, scale: 1, maxPage: 2200, imageWidth: 1024 },
  { key: 'phone', label: 'Phone', width: 390, height: 844, scale: 2, maxPage: 1700, imageWidth: 780 },
];
/** Widest crop of one region (a review panel shows it at most 400 px wide on a 2x screen). */
export const BUILD_CROP_WIDTH = 640;
/** Computed styles compared per matched element. */
export const BUILD_PROPS = [
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-transform',
  'text-decoration-line',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-top-left-radius',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'box-shadow',
];
/** At most this many differences per page (a page that differs everywhere is said in a few sentences, not 300). */
export const BUILD_MAX_ITEMS = 24;

/** Lower case, letters and digits only: "Football fan" and "football-fan" read the same. */
export const normText = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const DATE_SHAPES = [
  ['relative', new RegExp(`^(about |in |over |almost )?(a|an|\\d+) (second|minute|hour|day|week|month|year)s?( ago)?$|^(just now|now|today|yesterday|tomorrow)$|^(last|next) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)( at .+)?$`, 'i')],
  ['numeric', /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/],
  ['words', new RegExp(`^((mon|tue|wed|thu|fri|sat|sun)[a-z]*,? )?(\\d{1,2} (${MONTHS})\\.?|(${MONTHS})\\.? \\d{1,2})(,? \\d{4})?$`, 'i')],
  ['time', /^\d{1,2}:\d{2}( ?[ap]\.?m\.?)?$/i],
];
/**
 * The shape of a date or time a page writes ("13/12/2026" numeric, "Dec 13, 2026" words, "3 days ago" relative), or
 * null when the text is not one. A date's value moves with the day the page is opened; its shape does not.
 */
export function dateShape(text) {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^(due|due on|added on|last activity on|on|since|at|until)\s+/i, '')
    .trim();
  if (!t || t.length > 40) return null;
  const parts = t.split(/ at /i);
  for (const [shape, re] of DATE_SHAPES) if (re.test(t) || (parts.length === 2 && re.test(parts[0].trim()))) return shape;
  return null;
}

/** "Follow up on the unsigned purchase order" -> "Follow up on the unsigned…": a text short enough for a sentence. */
export const shortText = (t, max = 28) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
};

const px = (v) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const rgba = (v) => {
  const m = /rgba?\(([^)]+)\)/.exec(String(v ?? ''));
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p.length > 3 ? p[3] : 1];
};
/** Two colors differ when a channel moves by more than `t` (0 to 255) or the opacity by more than 0.1. */
export function colorsDiffer(a, b, t = 8) {
  const x = rgba(a);
  const y = rgba(b);
  if (!x || !y) return String(a ?? '') !== String(b ?? '');
  if (x[3] < 0.05 && y[3] < 0.05) return false;
  return Math.abs(x[0] - y[0]) > t || Math.abs(x[1] - y[1]) > t || Math.abs(x[2] - y[2]) > t || Math.abs(x[3] - y[3]) > 0.1;
}
const firstFamily = (v) =>
  String(v ?? '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
const borderSum = (st) => px(st['border-top-width']) + px(st['border-right-width']) + px(st['border-bottom-width']) + px(st['border-left-width']);
const padSum = (st) => px(st['padding-top']) + px(st['padding-right']) + px(st['padding-bottom']) + px(st['padding-left']);
const round = (n) => String(Math.round(n));

/** What one element is, for a fact: "Button", "Link", "Field", "Text". */
const elementWord = (e) => (e.kind === 'field' ? 'Field' : e.kind === 'control' ? (e.tag === 'a' || e.role === 'link' ? 'Link' : 'Button') : 'Text');

/**
 * What differs between two matched elements (a approved, b built), as facts, and how many differences were too small
 * to say (rounding, anti-aliasing). Text properties count only on an element that writes text itself or is a control.
 */
export function compareElements(a, b) {
  const facts = [];
  let tiny = 0;
  const sa = a.st ?? {};
  const sb = b.st ?? {};
  const word = elementWord(b);
  const speaks = Boolean(a.text || b.text || a.kind === 'control' || a.kind === 'field');
  const ta = a.text || a.label || '';
  const tb = b.text || b.label || '';
  if (ta !== tb && (ta || tb)) {
    const da = dateShape(ta);
    const db = dateShape(tb);
    // "12/13/2026" and "13/12/2026": the same numbers in another order is another date format, not another day.
    const nums = (t) => (String(t).match(/\d+/g) ?? []).join('/');
    const sorted = (t) => (String(t).match(/\d+/g) ?? []).sort().join('/');
    if (da && db) {
      if (da !== db || (da === 'numeric' && nums(ta) !== nums(tb) && sorted(ta) === sorted(tb))) facts.push({ k: 'date', label: 'Date', was: ta, now: tb });
      else tiny++;
    } else if (ta.replace(/\s+/g, ' ').trim() !== tb.replace(/\s+/g, ' ').trim()) facts.push({ k: 'text', label: word === 'Text' ? 'Text' : `${word} text`, was: ta, now: tb });
  }
  if (speaks) {
    const fa = px(sa['font-size']);
    const fb = px(sb['font-size']);
    if (Math.abs(fa - fb) > 1) facts.push({ k: 'size', label: 'Text size', was: round(fa), now: round(fb) });
    else if (fa !== fb) tiny++;
    const wa = px(sa['font-weight']);
    const wb = px(sb['font-weight']);
    if (Math.abs(wa - wb) >= 100) facts.push({ k: 'weight', label: 'Weight', was: round(wa), now: round(wb) });
    if (firstFamily(sa['font-family']) !== firstFamily(sb['font-family'])) facts.push({ k: 'font', label: 'Font', was: firstFamily(sa['font-family']), now: firstFamily(sb['font-family']) });
    if (colorsDiffer(sa.color, sb.color)) facts.push({ k: 'color', label: `${word} color`, was: sa.color, now: sb.color });
    else if (sa.color !== sb.color) tiny++;
    if ((sa['text-transform'] ?? 'none') !== (sb['text-transform'] ?? 'none')) facts.push({ k: 'case', label: 'Letter case', was: sa['text-transform'] ?? 'none', now: sb['text-transform'] ?? 'none' });
    if (/underline/.test(sa['text-decoration-line'] ?? '') !== /underline/.test(sb['text-decoration-line'] ?? '')) facts.push({ k: 'underline', label: 'Underline', was: /underline/.test(sa['text-decoration-line'] ?? '') ? 'yes' : 'no', now: /underline/.test(sb['text-decoration-line'] ?? '') ? 'yes' : 'no' });
  }
  if (colorsDiffer(sa['background-color'], sb['background-color'])) facts.push({ k: 'fill', label: 'Background', was: sa['background-color'], now: sb['background-color'] });
  const ba = borderSum(sa);
  const bb = borderSum(sb);
  if ((ba === 0) !== (bb === 0)) facts.push({ k: 'outline', label: 'Outline', was: ba ? 'yes' : 'none', now: bb ? 'yes' : 'none' });
  else if (ba && bb && colorsDiffer(sa['border-top-color'], sb['border-top-color'], 16)) facts.push({ k: 'border', label: 'Outline color', was: sa['border-top-color'], now: sb['border-top-color'] });
  const ra = px(sa['border-top-left-radius']);
  const rb = px(sb['border-top-left-radius']);
  if (Math.abs(ra - rb) > 2 && (ba || bb || sa['background-color'] !== 'rgba(0, 0, 0, 0)')) facts.push({ k: 'radius', label: 'Corners', was: round(ra), now: round(rb) });
  const pa = padSum(sa);
  const pb = padSum(sb);
  if (Math.abs(pa - pb) > 4) facts.push({ k: 'space', label: 'Space inside', was: round(pa), now: round(pb) });
  else if (pa !== pb) tiny++;
  if ((sa['box-shadow'] ?? 'none') === 'none' && (sb['box-shadow'] ?? 'none') !== 'none') facts.push({ k: 'shadow', label: 'Shadow', was: 'none', now: 'yes' });
  else if ((sa['box-shadow'] ?? 'none') !== 'none' && (sb['box-shadow'] ?? 'none') === 'none') facts.push({ k: 'shadow', label: 'Shadow', was: 'yes', now: 'none' });
  if (a.kind === 'control' || a.kind === 'field') {
    const ha = a.box?.[3] ?? 0;
    const hb = b.box?.[3] ?? 0;
    // A link's height follows its words wrapping: only buttons and fields have a height of their own.
    if (word !== 'Link' && Math.abs(ha - hb) > 3) facts.push({ k: 'height', label: `${word} height`, was: round(ha), now: round(hb) });
    else if (ha !== hb) tiny++;
    if ((a.icons ?? 0) !== (b.icons ?? 0)) facts.push({ k: 'icon', label: `${word} icon`, was: a.icons ? 'yes' : 'none', now: b.icons ? 'yes' : 'none' });
  }
  return { facts, tiny };
}

/** A region's name: its marker's words, its heading, a header or the navigation, else the first words in it. */
function regionName(block, ex) {
  if (!block) return 'Page';
  if (block.mk && block.mkRoot) return shortText(block.mk, 40);
  if (block.nav) return 'Navigation';
  if (block.tag === 'header' || block.role === 'banner') return block.box?.[1] < 8 ? 'Top bar' : 'Header';
  if (block.head) return shortText(block.head, 40);
  const inside = (e) => (e.text || e.label) && e.box && block.box && e.box[1] >= block.box[1] && e.box[1] < block.box[1] + block.box[3] && e.box[0] >= block.box[0] && e.box[0] < block.box[0] + block.box[2];
  const first = (ex.els ?? []).find(inside);
  return first ? shortText(first.text || first.label, 32) : 'Section';
}

/**
 * The region of every element (Map i -> { id, name, box }): its marked area (data-bridge-change), else the card-sized
 * block around it, else (in a block with several headings, or none) the section its nearest heading above opens in the
 * same column, else the page. `box` is the block's, null for a heading's section (its members say where it is).
 */
export function regionsOf(ex) {
  const els = (ex.els ?? []).filter((e) => e.box);
  const byI = new Map(els.map((e) => [e.i, e]));
  const up = (e) => (e && e.p >= 0 ? (byI.get(e.p) ?? null) : null);
  const area = (ex.w || 1) * Math.min(ex.h || 1, (ex.vh || 800) * 1.6);
  const fits = (e) => e.blk && e.box[2] * e.box[3] <= area * 0.42 && e.box[2] <= (ex.w || 1) * 0.96;
  const heads = els.filter((e) => e.hd);
  const headCount = new Map();
  for (const h of heads) for (let x = up(h); x; x = up(x)) if (x.blk) headCount.set(x.i, (headCount.get(x.i) ?? 0) + 1);
  const out = new Map();
  for (const e of els) {
    let mk = null;
    let blk = null;
    let guard = 0;
    for (let x = e; x && guard++ < 80; x = up(x)) {
      if (!mk && x.mk && x.mkRoot) mk = x;
      if (!blk && fits(x)) blk = x;
    }
    if (mk) {
      out.set(e.i, { id: `m${mk.i}`, name: regionName(mk, ex), box: mk.box });
      continue;
    }
    if (blk && (blk.nav || (headCount.get(blk.i) ?? 0) <= 1)) {
      out.set(e.i, { id: `b${blk.i}`, name: regionName(blk, ex), box: blk.box });
      continue;
    }
    const within = (h) => !blk || (h.box[1] >= blk.box[1] - 2 && h.box[1] < blk.box[1] + blk.box[3] && h.box[0] >= blk.box[0] - 2 && h.box[0] < blk.box[0] + blk.box[2]);
    let best = null;
    for (const h of heads) {
      if (h.box[1] > e.box[1] + Math.max(2, e.box[3]) || e.box[1] - h.box[1] > 700 || !within(h)) continue;
      // Its column: the heading starts at or left of the element and covers it; or it sits on the element's row.
      const row = Math.abs(h.box[1] + h.box[3] / 2 - (e.box[1] + e.box[3] / 2)) <= 24 && h.box[0] - (e.box[0] + e.box[2]) <= 32 && h.box[0] >= e.box[0];
      const column = h.box[0] <= e.box[0] + 12 && e.box[0] < h.box[0] + Math.max(h.box[2], 240);
      if (!row && !column) continue;
      if (!best || h.box[1] > best.box[1]) best = h;
    }
    if (best) out.set(e.i, { id: `h${best.i}`, name: shortText(best.text || best.label, 40), box: null });
    else out.set(e.i, blk ? { id: `b${blk.i}`, name: regionName(blk, ex), box: blk.box } : { id: 'page', name: 'Page', box: null });
  }
  return out;
}

/** Reading order: rows first (two boxes whose middles sit within half the smaller height share a row), then left to right. */
const readingOrder = (a, b) => {
  const ma = a.box[1] + a.box[3] / 2;
  const mb = b.box[1] + b.box[3] / 2;
  if (Math.abs(ma - mb) <= Math.max(4, Math.min(a.box[3], b.box[3]) / 2)) return a.box[0] - b.box[0];
  return ma - mb;
};
const unionBox = (boxes) => {
  const bs = boxes.filter(Boolean);
  if (!bs.length) return null;
  const x = Math.min(...bs.map((b) => b[0]));
  const y = Math.min(...bs.map((b) => b[1]));
  const r = Math.max(...bs.map((b) => b[0] + b[2]));
  const btm = Math.max(...bs.map((b) => b[1] + b[3]));
  return [x, y, r - x, btm - y];
};

/** The words a fact says in a sentence. */
function factSentence(f) {
  const q = (t) => shortText(t, 28);
  switch (f.k) {
    case 'text':
      return `Shows ${q(f.now)} where the design says ${q(f.was)}`;
    case 'date':
      return `Dates read ${q(f.now)} where the design says ${q(f.was)}`;
    case 'added':
      return `Adds ${q(f.now)}, not in the design`;
    case 'missing':
      return `${q(f.was)} is missing`;
    case 'icon':
      return f.now === 'none' ? `The ${f.label.replace(/ icon$/, '').toLowerCase()} lost its icon` : `The ${f.label.replace(/ icon$/, '').toLowerCase()} gained an icon`;
    case 'order':
      return `${q(f.now)} now comes before ${q(f.was)}`;
    case 'size':
      return `Text is ${Number(f.now) > Number(f.was) ? 'larger' : 'smaller'}, ${f.was} to ${f.now}`;
    case 'height':
      return `The ${f.label.replace(/ height$/, '').toLowerCase()} is ${Number(f.now) > Number(f.was) ? 'taller' : 'shorter'}, ${f.was} to ${f.now}`;
    case 'outline':
      return f.now === 'none' ? 'An outline is gone' : 'An outline was added';
    case 'border':
      return 'An outline changed color';
    case 'color':
      return `${f.label} changed`;
    case 'fill':
      return 'The background changed';
    case 'weight':
      return `Text is ${Number(f.now) > Number(f.was) ? 'bolder' : 'lighter'}`;
    case 'font':
      return `Another font: ${f.now}`;
    case 'case':
      return 'Letter case changed';
    case 'underline':
      return f.now === 'yes' ? 'Text is underlined' : 'Text lost its underline';
    case 'space':
      return `${Number(f.now) > Number(f.was) ? 'More' : 'Less'} space inside, ${f.was} to ${f.now}`;
    case 'radius':
      return `${Number(f.now) > Number(f.was) ? 'Rounder' : 'Squarer'} corners`;
    case 'shadow':
      return f.now === 'none' ? 'The shadow is gone' : 'A shadow was added';
    default:
      return 'Looks different';
  }
}
const FACT_ORDER = ['text', 'date', 'added', 'missing', 'icon', 'order', 'size', 'height', 'outline', 'fill', 'color', 'weight', 'font', 'case', 'underline', 'border', 'space', 'radius', 'shadow'];

/** One plain sentence for a region: its two strongest kinds of difference. */
export function regionLine(facts) {
  const seen = new Set();
  const picked = [];
  for (const k of FACT_ORDER) {
    const f = facts.find((x) => x.k === k);
    if (f && !seen.has(k)) {
      seen.add(k);
      picked.push(f);
    }
    if (picked.length === 2) break;
  }
  if (!picked.length) return 'Looks different';
  const [a, b] = picked.map(factSentence);
  // The second part goes lower case only when it starts with Bridge's own word, never with the page's words.
  const own = /^(Text|The|An|A|More|Less|Rounder|Squarer|Another|Letter|Dates|Shows|Adds)\b/.test(b ?? '');
  const line = b ? `${a}, and ${own ? `${b.charAt(0).toLowerCase()}${b.slice(1)}` : b}` : a;
  return line.length <= 140 ? line : a;
}

/**
 * What differs between the approved page (`a`) and the build (`b`), both as BUILD_EXTRACT says them: regions, each
 * with its name, its sentence, its facts and its box on each side (page coordinates), in the build's reading order;
 * and how many differences were too small or too live to say. Pure (tested).
 */
export function buildDiff(a, b) {
  const pages = { a, b };
  const els = { a: (a.els ?? []).filter((e) => e.box), b: (b.els ?? []).filter((e) => e.box) };
  const reg = { a: regionsOf(a), b: regionsOf(b) };
  const rname = (s, e) => reg[s].get(e.i)?.name ?? 'Page';
  const rkey = (s, e) => normText(rname(s, e)) || 'page';
  // Where each region starts on each side: positions inside a region compare, not positions on the page.
  const origin = { a: new Map(), b: new Map() };
  const members = { a: new Map(), b: new Map() };
  for (const s of ['a', 'b']) {
    for (const e of els[s]) {
      const r = reg[s].get(e.i);
      const k = rkey(s, e);
      if (!members[s].has(k)) members[s].set(k, []);
      members[s].get(k).push(e.box);
      const o = origin[s].get(k);
      const box = r?.box ?? e.box;
      if (!o || box[1] < o[1] || (box[1] === o[1] && box[0] < o[0])) origin[s].set(k, [box[0], box[1]]);
    }
  }
  const rel = (s, e) => {
    const o = origin[s].get(rkey(s, e)) ?? [0, 0];
    return [e.box[0] - o[0], e.box[1] - o[1]];
  };
  const pairs = [];
  const used = { a: new Set(), b: new Set() };
  const speaking = (e) => Boolean(e.text || e.label);
  const words = (e) => e.text || e.label;
  const pairBy = (keyOf, accept = () => true) => {
    const pool = new Map();
    for (const e of els.a) {
      if (used.a.has(e.i)) continue;
      const k = keyOf(e, 'a');
      if (!k) continue;
      if (!pool.has(k)) pool.set(k, []);
      pool.get(k).push(e);
    }
    for (const e of els.b) {
      if (used.b.has(e.i)) continue;
      const k = keyOf(e, 'b');
      const q = k ? pool.get(k) : null;
      if (!q?.length) continue;
      const at = q.findIndex((m) => accept(m, e));
      if (at < 0) continue;
      const [m] = q.splice(at, 1);
      used.a.add(m.i);
      used.b.add(e.i);
      pairs.push([m, e]);
    }
  };
  // 1. Marked areas first (the exploration named what it changed), then the same words in the same region, then the
  // same words anywhere, then the same words read loosely ("Football fan", "football-fan").
  pairBy((e) => (e.mk && speaking(e) ? `${normText(e.mk)}|${e.kind}|${words(e)}` : null));
  pairBy((e, s) => (speaking(e) ? `${rkey(s, e)}|${e.kind}|${words(e)}` : null));
  pairBy((e) => (speaking(e) ? `${e.kind}|${words(e)}` : null));
  pairBy((e, s) => (speaking(e) ? `${rkey(s, e)}|${normText(words(e))}` : null));
  pairBy((e) => (speaking(e) ? normText(words(e)) : null));
  // 2. Dates and times of the same region, in order (their values move with the day the page opens).
  pairBy((e, s) => (dateShape(e.text) ? `date|${rkey(s, e)}` : null));
  // 3. Controls and fields of the same region and kind, in reading order.
  pairBy((e, s) => (e.kind === 'control' || e.kind === 'field' ? `${e.kind}|${e.tag}|${rkey(s, e)}` : null));
  // 4. Words that changed: the same kind of element at the same place in the same region.
  pairBy(
    (e, s) => (e.kind === 'text' && e.text && !dateShape(e.text) ? `t|${e.tag}|${rkey(s, e)}` : null),
    (m, e) => {
      const ra = rel('a', m);
      const rb = rel('b', e);
      return Math.abs(ra[0] - rb[0]) <= 24 && Math.abs(ra[1] - rb[1]) <= 24;
    },
  );

  const regions = new Map();
  let ignored = 0;
  const regionFor = (name) => {
    const k = normText(name) || 'page';
    if (!regions.has(k)) regions.set(k, { key: k, name, facts: [], boxes: { a: [], b: [] }, firstY: Infinity });
    return regions.get(k);
  };
  const addFact = (r, f, ea, eb) => {
    const same = r.facts.find((x) => x.k === f.k && x.was === f.was && x.now === f.now);
    if (same) same.n = (same.n ?? 1) + 1;
    else r.facts.push({ ...f, n: 1, at: eb?.box ?? ea?.box ?? null });
    if (ea?.box) r.boxes.a.push(ea.box);
    if (eb?.box) {
      r.boxes.b.push(eb.box);
      r.firstY = Math.min(r.firstY, eb.box[1]);
    } else if (ea?.box) r.firstY = Math.min(r.firstY, ea.box[1]);
  };
  for (const [ea, eb] of pairs) {
    if (ea.kind === 'media' || eb.kind === 'media') continue;
    const { facts, tiny } = compareElements(ea, eb);
    ignored += tiny;
    if (!facts.length) continue;
    const r = regionFor(rname('b', eb));
    for (const f of facts) addFact(r, f, ea, eb);
  }
  // Unmatched words: added in the build, or missing from it. Pictures and charts alone are noise; live dates too.
  for (const e of els.b) {
    if (used.b.has(e.i) || !speaking(e) || e.kind === 'media') continue;
    if (dateShape(e.text)) {
      ignored++;
      continue;
    }
    addFact(regionFor(rname('b', e)), { k: 'added', label: 'New', was: '', now: words(e) }, null, e);
  }
  for (const e of els.a) {
    if (used.a.has(e.i) || !speaking(e) || e.kind === 'media') continue;
    if (dateShape(e.text)) {
      ignored++;
      continue;
    }
    addFact(regionFor(rname('a', e)), { k: 'missing', label: 'Missing', was: words(e), now: '' }, e, null);
  }
  // The order of neighbours: two matched words close together in both pages that read the other way round.
  const near = (x, y) => Math.abs(x.box[1] - y.box[1]) <= 40 && Math.abs(x.box[0] - y.box[0]) <= 360;
  const orderDone = new Set();
  // Written words only (a control's hidden label has no place to read), in one region on both sides.
  const speakingPairs = pairs.filter(([ea, eb]) => ea.text && eb.text && ea.kind !== 'media' && !dateShape(eb.text) && rkey('a', ea) === rkey('b', eb));
  for (let i = 0; i < speakingPairs.length; i++) {
    for (let j = i + 1; j < speakingPairs.length; j++) {
      const [a1, b1] = speakingPairs[i];
      const [a2, b2] = speakingPairs[j];
      if (rkey('b', b1) !== rkey('b', b2) || !near(a1, a2) || !near(b1, b2)) continue;
      if (Math.min(b1.text.length, b2.text.length) <= 3) continue;
      const before = Math.sign(readingOrder(a1, a2));
      const after = Math.sign(readingOrder(b1, b2));
      if (!before || !after || before === after) continue;
      const k = rkey('b', b1);
      if (orderDone.has(k)) continue;
      orderDone.add(k);
      const [first, second] = after < 0 ? [b1, b2] : [b2, b1];
      addFact(regionFor(rname('b', b1)), { k: 'order', label: 'Order', was: words(second), now: words(first) }, after < 0 ? a1 : a2, first);
    }
  }
  const pad = (box) => (box ? [Math.max(0, box[0] - 12), Math.max(0, box[1] - 12), box[2] + 24, box[3] + 24] : null);
  const blockOf = (s, k) => {
    for (const e of els[s]) if (rkey(s, e) === k && reg[s].get(e.i)?.box) return reg[s].get(e.i).box;
    return null;
  };
  const out = [...regions.values()]
    .filter((r) => r.facts.length)
    .map((r) => {
      const box = (side) => {
        const own = unionBox(r.boxes[side]);
        // The whole region: its block, else the section its heading opens (all its members), when it holds the differences.
        const whole = blockOf(side, r.key) ?? unionBox(members[side].get(r.key) ?? []);
        if (whole && own && whole[3] <= 900 && own[0] >= whole[0] - 2 && own[1] >= whole[1] - 2 && own[0] + own[2] <= whole[0] + whole[2] + 2 && own[1] + own[3] <= whole[1] + whole[3] + 2) return pad(whole);
        return pad(own ?? (whole && whole[3] <= 900 ? whole : null));
      };
      // A control's label that repeats a text change of the same region says nothing more.
      const texts = r.facts.filter((f) => f.k === 'text');
      const facts = r.facts
        .filter((f) => !(f.k === 'text' && texts.some((g) => g !== f && g.was.length < f.was.length && f.was.includes(g.was) && f.now.includes(g.now))))
        .sort((x, y) => FACT_ORDER.indexOf(x.k) - FACT_ORDER.indexOf(y.k))
        .slice(0, 8);
      // The focus: the strongest difference itself, with room around it (the entry's tile shows it legibly).
      const own = facts.find((f) => !isMinor(f) && f.at)?.at ?? unionBox(r.boxes.b) ?? unionBox(r.boxes.a);
      let fb = null;
      if (own) {
        const w = Math.max(own[2] + 40, 150);
        const h = Math.max(own[3] + 40, 120);
        fb = [Math.max(0, Math.round(own[0] + own[2] / 2 - w / 2)), Math.max(0, Math.round(own[1] + own[3] / 2 - h / 2)), Math.round(Math.min(w, 900)), Math.round(Math.min(h, 600))];
      }
      return { key: r.key, name: r.name, line: regionLine(facts), facts: facts.map(({ at: _at, ...f }) => f), a: box('a'), b: box('b'), fb, y: Number.isFinite(r.firstY) ? r.firstY : 0 };
    })
    .sort((x, y) => x.y - y.y)
    .slice(0, BUILD_MAX_ITEMS);
  void pages;
  return { regions: out, ignored };
}

/** A short stable name for what a region says: the same difference on the next build gets the same one. */
export function regionSig(name, facts) {
  const s = `${normText(name)}|${facts
    .map((f) => `${f.k}:${f.was}>${f.now}`)
    .sort()
    .join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `r${h.toString(16).padStart(8, '0')}`;
}

/**
 * The regions of every size as one list of things to look at: a region of the same name at several sizes is one item
 * (its facts from the widest size, the others' added), laptop sizes first in the build's reading order, then what
 * differs only on a phone. `perSize`: [{ key, regions }] widest first.
 */
export function mergeSizes(perSize) {
  // One item per region and size first.
  const all = [];
  for (const { key, regions } of perSize) {
    for (const r of regions ?? []) all.push({ key: r.key, name: r.name, facts: [...r.facts], sizes: [key], strong: r.facts.some((f) => !isMinor(f)) ? [key] : [], boxes: { [key]: { a: r.a, b: r.b, ...(r.fb ? { f: r.fb } : {}) } }, y: { [key]: r.y } });
  }
  const order = perSize.map((s) => s.key);
  // Then one difference across sizes: the same region saying something in common, or the same words added, missing
  // or changed in two regions (a header named by its heading on a phone, the page around it). The region seen first
  // at the widest size keeps it, with every size. A region of the same name saying nothing in common at another size
  // (the page on a phone) stays its own.
  const together = (x, y) => (x.key === y.key && x.facts.some((f) => y.facts.some((g) => sameFact(f, g)))) || x.facts.some((f) => SAY.has(f.k) && y.facts.some((g) => sameFact(f, g)));
  for (let i = 0; i < all.length; i++) {
    const keep = all[i];
    if (!keep) continue;
    for (let j = i + 1; j < all.length; j++) {
      const other = all[j];
      if (!other || !together(keep, other)) continue;
      const [win, lose] = rank(keep, order) <= rank(other, order) ? [keep, other] : [other, keep];
      // The page around a named region gives up only what they both say; the rest of it stays its own.
      if (['page', 'section'].includes(lose.key)) {
        lose.facts = lose.facts.filter((f) => !win.facts.some((g) => sameFact(f, g)));
        if (lose.facts.length) continue;
      }
      for (const s of lose.sizes) {
        if (!win.sizes.includes(s)) win.sizes.push(s);
        if (!win.boxes[s]) {
          win.boxes[s] = lose.boxes[s];
          win.y[s] = lose.y[s];
        }
      }
      for (const f of lose.facts) if (!win.facts.some((x) => sameFact(x, f))) win.facts.push(f);
      for (const s of lose.strong) if (!win.strong.includes(s)) win.strong.push(s);
      all[all.indexOf(lose)] = null;
      if (lose === keep) break;
    }
  }
  const phoneOnly = (it) => it.sizes.every((s) => s === 'phone');
  for (const it of all) if (it && it.key === 'page') it.name = it.strong.every((x) => x === 'phone') ? 'The page on a phone' : 'The page';
  const list = all
    .filter(Boolean)
    .filter((it) => it.facts.some((f) => !isMinor(f)))
    .map((it) => {
      const facts = it.facts.sort((x, y) => Number(isMinor(x)) - Number(isMinor(y)) || FACT_ORDER.indexOf(x.k) - FACT_ORDER.indexOf(y.k)).slice(0, 8);
      // The sizes where it shows something that is not minor: "seen at every size" says only that, and the crop is
      // taken at the first of them.
      const shown = order.filter((s) => it.strong.includes(s));
      return { ...it, facts, line: regionLine(facts.filter((f) => !isMinor(f))), sig: regionSig(it.name, facts), sizes: shown.length ? shown : order.filter((s) => it.sizes.includes(s)) };
    });
  const first = (it) => it.sizes[0];
  list.sort((x, y) => Number(phoneOnly(x)) - Number(phoneOnly(y)) || order.indexOf(first(x)) - order.indexOf(first(y)) || (x.y[first(x)] ?? 0) - (y.y[first(y)] ?? 0));
  return list.slice(0, BUILD_MAX_ITEMS).map((it, i) => ({ n: i + 1, sig: it.sig, name: it.name, line: it.line, facts: it.facts, sizes: it.sizes, boxes: it.boxes }));
}

/** How many regions were only minor style shifts, per size merged as mergeSizes does: what the page leaves out. */
export function minorCount(perSize) {
  const names = new Set();
  for (const { regions } of perSize) for (const r of regions ?? []) if (r.facts.length && r.facts.every(isMinor)) names.add(r.key);
  return names.size;
}

const SAY = new Set(['text', 'date', 'added', 'missing']);
const sameFact = (x, f) => x.k === f.k && x.was === f.was && x.now === f.now;
/** Generic names lose to a named region; then the widest size, then higher on the page. */
const rank = (it, order) => (['page', 'section'].includes(it.key) ? 100 : 0) + order.indexOf(it.sizes[0]) * 10;

const channelGap = (a, b) => {
  const x = /rgba?\(([^)]+)\)/.exec(String(a ?? ''))?.[1]?.split(/[\s,/]+/).map(Number) ?? [];
  const y = /rgba?\(([^)]+)\)/.exec(String(b ?? ''))?.[1]?.split(/[\s,/]+/).map(Number) ?? [];
  if (x.length < 3 || y.length < 3) return 255;
  if ((x[3] ?? 1) < 0.05 || (y[3] ?? 1) < 0.05) return 255;
  return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
};
/**
 * A minor style shift: a component a little taller or roomier, softer corners, a shadow, a background or outline tint,
 * a weight, a near color. Said under a region that also differs in what it shows; a region of only these is left out
 * (counted). What the page shows (words, dates, icons, order) and clear changes (text 2 sizes up, a new hue) never are.
 */
export function isMinor(f) {
  if (['space', 'radius', 'shadow', 'border', 'weight', 'font', 'case', 'underline'].includes(f.k)) return true;
  // A background that appears or goes on the same page color is not seen: transparent counts as minor.
  if (f.k === 'fill') return channelGap(f.was, f.now) <= 48 || /rgba\([^)]*,\s*0\)$/.test(String(f.was)) || /rgba\([^)]*,\s*0\)$/.test(String(f.now));
  if (f.k === 'color') return channelGap(f.was, f.now) <= 48;
  if (f.k === 'size') return Math.abs(Number(f.now) - Number(f.was)) <= 2;
  if (f.k === 'height') return Math.abs(Number(f.now) - Number(f.was)) <= 8;
  if (f.k === 'outline') return true;
  return false;
}

/** The library's name for a color of a page (its CSS custom properties, read on the page), else null. */
export function colorName(rgb, colors) {
  const hits = (colors ?? []).filter(([, v]) => v === rgb).map(([n]) => n);
  if (!hits.length) return null;
  // Semantic names before ramp steps ("--color-text-default" before "--color-ink-900"), then the shortest.
  hits.sort((x, y) => Number(/\d/.test(x)) - Number(/\d/.test(y)) || x.length - y.length);
  return hits[0].replace(/^--(color-)?/, '').replace(/-/g, ' ');
}

/** Each color fact of the regions with its library names, from the colors each page defines. */
export function nameColors(regions, colorsA, colorsB) {
  for (const r of regions) {
    for (const f of r.facts) {
      if (!['color', 'fill', 'border'].includes(f.k)) continue;
      const was = colorName(f.was, colorsA);
      const now = colorName(f.now, colorsB);
      if (was) f.wasName = was;
      if (now) f.nowName = now;
    }
  }
  return regions;
}

/** A page that is not the product: a host's sign-in wall, an error page, or nearly nothing written on it. */
export function missingPage(ex, finalUrl) {
  if (looksLikeAWallUrl(finalUrl)) return 'wall';
  if (!ex || (ex.words ?? 0) < 12) return 'empty';
  if (/^(404|not found|page not found|this page could not be found)/i.test(String(ex.title ?? '').trim())) return 'not-found';
  return null;
}

// In the page: every element that writes, acts, shows a picture or holds a region, with its box and styles.
const BUILD_EXTRACT = ({ props, maxH, marker }) => {
  const sy = window.scrollY;
  const sx = window.scrollX;
  const docW = document.documentElement.scrollWidth;
  const docH = Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), maxH);
  const CONTROL = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], summary';
  const FIELD = 'input, select, textarea, [role="textbox"], [role="combobox"]';
  const BLOCK = 'header, nav, aside, section, form, article, fieldset, dialog, [role="region"], [role="dialog"], [role="navigation"], [role="banner"], [role="complementary"], [role="group"], [role="tabpanel"]';
  const HEAD = 'h1, h2, h3, h4, h5, h6, [role="heading"], legend, caption';
  const kept = new Map();
  const els = [];
  let words = 0;
  const own = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  };
  const clear = (c) => !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
  const bgUnder = (el) => {
    for (let x = el.parentElement; x; x = x.parentElement) {
      const c = getComputedStyle(x).backgroundColor;
      if (!clear(c)) return c;
    }
    return 'rgb(255, 255, 255)';
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (els.length >= 4000) break;
    const tag = el.tagName.toLowerCase();
    if (/^(script|style|noscript|template|link|meta|br|path|g|use|defs|circle|rect|line|polyline|polygon|ellipse|text|tspan|clippath|mask|lineargradient|stop)$/.test(tag)) continue;
    if (el.closest('[data-bridge-toolbar], vercel-live-feedback, #vercel-live-feedback')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const y = r.top + sy;
    if (y > docH || r.left + sx > docW) continue;
    let text = own(el);
    if (/^(input|textarea|select)$/.test(tag)) text = '';
    const media = /^(img|picture|video|canvas|iframe|svg)$/.test(tag) || el.getAttribute('role') === 'img';
    const control = !media && el.matches(CONTROL);
    const field = !media && el.matches(FIELD);
    const sides = ['top', 'right', 'bottom', 'left'].filter((s) => cs.getPropertyValue(`border-${s}-style`) !== 'none' && parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0).length;
    const painted = sides >= 2 || (cs.boxShadow && cs.boxShadow !== 'none') || (!clear(cs.backgroundColor) && cs.backgroundColor !== bgUnder(el));
    const markRoot = el.hasAttribute(marker);
    const blk = !media && !control && !field && (markRoot || el.matches(BLOCK) || (painted && r.width >= 120 && r.height >= 40));
    if (!text && !control && !field && !media && !blk) continue;
    let p = -1;
    for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) {
      if (kept.has(x)) {
        p = kept.get(x);
        break;
      }
    }
    const label = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('placeholder') || (tag === 'input' && /^(button|submit|reset)$/i.test(el.getAttribute('type') || '') ? el.value : '') || '').trim().slice(0, 120);
    let head = null;
    if (blk) {
      const h = el.getAttribute('aria-label') ? null : [...el.querySelectorAll(HEAD)].find((x) => x.getBoundingClientRect().height > 0);
      head = (el.getAttribute('aria-label') || h?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
    }
    const mkEl = el.closest(`[${marker}]`);
    const i = els.length;
    kept.set(el, i);
    if (text) words += text.split(' ').length;
    els.push({
      i,
      p,
      tag,
      role: el.getAttribute('role') || '',
      text: text.slice(0, 160),
      label,
      kind: field ? 'field' : control ? 'control' : media ? 'media' : text ? 'text' : 'block',
      blk,
      head,
      // A heading: its tag or role, or short words set bold (a section label), never a control or initials.
      hd: Boolean(text) && !control && (el.matches(HEAD) || (text.length >= 3 && text.length <= 32 && parseFloat(cs.fontWeight) >= 600 && parseFloat(cs.fontSize) >= 12)),
      nav: blk && (el.matches('nav, [role="navigation"]') || Boolean(el.querySelector('nav, [role="navigation"]'))),
      mk: mkEl ? mkEl.getAttribute(marker) || 'Marked change' : null,
      mkRoot: markRoot,
      icons: control ? el.querySelectorAll('svg, img').length : 0,
      box: [Math.round(r.left + sx), Math.round(y), Math.round(r.width), Math.round(r.height)],
      st: Object.fromEntries(props.map((q) => [q, cs.getPropertyValue(q)])),
    });
  }
  // The library's colors on this page: every --color-* custom property its style sheets set, as computed rgb.
  const names = new Set();
  const walk = (rules) => {
    for (const r of rules ?? []) {
      if (names.size >= 800) return;
      if (r.style) for (let i = 0; i < r.style.length; i++) if (r.style[i].startsWith('--color-')) names.add(r.style[i]);
      if (r.cssRules) walk(r.cssRules);
    }
  };
  for (const sh of document.styleSheets) {
    try {
      walk(sh.cssRules);
    } catch {
      /* another origin's sheet: not readable */
    }
  }
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const colors = [];
  for (const n of names) {
    const v = root.getPropertyValue(n).trim();
    if (!v) continue;
    probe.style.color = '';
    probe.style.color = v;
    if (probe.style.color) colors.push([n, getComputedStyle(probe).color]);
  }
  probe.remove();
  return { w: docW, h: docH, vh: window.innerHeight, words, title: (document.querySelector('h1')?.textContent ?? document.title ?? '').trim().slice(0, 80), els, colors };
};

/** Waits until the words on the page stop changing (an app that fetches its data after load), 8 seconds at most. */
async function settleWords(page, { quiet = 700, max = 8000 } = {}) {
  const start = Date.now();
  let last = -1;
  let since = Date.now();
  while (Date.now() - start < max) {
    const n = await page.evaluate(() => (document.body?.innerText ?? '').length).catch(() => 0);
    if (n !== last) {
      last = n;
      since = Date.now();
    } else if (n > 40 && Date.now() - since >= quiet) return;
    await page.waitForTimeout(150);
  }
}

/**
 * The whole page and the crops of a capture, encoded in the browser: one load of the PNG, then each crop
 * ([x, y, w, h] in page pixels times `scale`) at most `maxW` wide. WebP, quality lowered until each fits `maxBytes`.
 */
async function encodeShots(helper, png, { scale, fullWidth, crops, maxBytes = 290_000 }) {
  return helper.evaluate(
    async ({ b64, scale, fullWidth, crops, maxBytes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const enc = (sx, sy, sw, sh, w) => {
        const h = Math.max(1, Math.round((sh * w) / sw));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        for (const q of [0.82, 0.7, 0.55, 0.4]) {
          const out = c.toDataURL('image/webp', q).split(',')[1];
          if (out.length * 0.75 <= maxBytes) return { b64: out, w, h };
        }
        return null;
      };
      const full = enc(0, 0, img.width, img.height, Math.min(fullWidth, img.width));
      const out = {};
      for (const c of crops) {
        const x = Math.max(0, Math.round(c.box[0] * scale));
        const y = Math.max(0, Math.round(c.box[1] * scale));
        const w = Math.min(img.width - x, Math.round(c.box[2] * scale));
        const h = Math.min(img.height - y, Math.round(c.box[3] * scale));
        if (w < 4 || h < 4) continue;
        out[c.name] = enc(x, y, w, h, Math.min(c.maxW, w));
      }
      return { full, crops: out };
    },
    { b64: png.toString('base64'), scale, fullWidth, crops, maxBytes },
  );
}

/**
 * Measures one build against its approved design: `job` { approved, build, route } (both preview addresses, the route
 * the exploration chose). `save(name, webp)` keeps an image. Returns the summary (BUILD_SUMMARY): per size the two
 * pages (or why one is missing), and the items, each with its sentence, its facts, its boxes and its two crops.
 */
export async function measureBuild(browser, job, save, { log: say = log, sizes = BUILD_SIZES, now = () => Date.now() } = {}) {
  const helperCtx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const helper = await helperCtx.newPage();
  await helper.setContent('<!doctype html><title>build</title>');
  const perSize = [];
  try {
    for (const s of sizes) {
      const context = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: s.key === 'phone', hasTouch: s.key === 'phone', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
      const sides = {};
      try {
        for (const side of ['a', 'b']) {
          const url = atScreen(side === 'a' ? job.approved : job.build, job.route);
          const page = await context.newPage();
          try {
            await settle(page, url);
            await settleWords(page);
            await page.addStyleTag({ content: HIDE_CSS }).catch(() => undefined);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(300);
            const ex = await page.evaluate(BUILD_EXTRACT, { props: BUILD_PROPS, maxH: s.maxPage, marker: MARKER_ATTR });
            if (process.env.BRIDGE_BUILD_DEBUG) writeFileSync(join(process.env.BRIDGE_BUILD_DEBUG, `ex-${s.key}-${side}.json`), JSON.stringify(ex));
            const missing = missingPage(ex, page.url());
            if (missing) {
              sides[side] = { missing };
              continue;
            }
            const png = await page.screenshot({ type: 'png', fullPage: true, clip: { x: 0, y: 0, width: s.width, height: Math.max(s.height, ex.h) } });
            sides[side] = { ex, png };
          } catch (e) {
            sides[side] = { missing: 'error' };
            say(`${s.key} ${side === 'a' ? 'approved' : 'build'}: ${url} could not be opened (${String(e?.message ?? e).slice(0, 160)}).`);
          } finally {
            await page.close().catch(() => undefined);
          }
        }
      } finally {
        await context.close();
      }
      const diff = sides.a?.ex && sides.b?.ex ? buildDiff(sides.a.ex, sides.b.ex) : { regions: [], ignored: 0 };
      if (sides.a?.ex && sides.b?.ex) nameColors(diff.regions, sides.a.ex.colors, sides.b.ex.colors);
      perSize.push({ s, sides, diff });
      say(`${s.key}: ${sides.a?.missing ? `approved ${sides.a.missing}` : 'approved ok'}, ${sides.b?.missing ? `build ${sides.b.missing}` : 'build ok'}, ${diff.regions.length} region(s) differ.`);
    }
    const items = mergeSizes(perSize.map((p) => ({ key: p.s.key, regions: p.diff.regions })));
    const minor = minorCount(perSize.map((p) => ({ key: p.s.key, regions: p.diff.regions })));
    const summary = { version: 1, measuredAt: new Date(now()).toISOString(), route: job.route ?? null, urls: { approved: atScreen(job.approved, job.route), build: atScreen(job.build, job.route) }, sizes: [], items: [], ignored: perSize.reduce((n, p) => n + p.diff.ignored, 0) + minor };
    for (const { s, sides } of perSize) {
      const entry = { key: s.key, width: s.width, height: s.height, missing: {}, regions: perSize.find((p) => p.s === s).diff.regions.length };
      for (const side of ['a', 'b']) {
        const got = sides[side];
        if (!got?.png) {
          entry.missing[side] = got?.missing ?? 'error';
          entry[side] = null;
          continue;
        }
        // The crops of the items first seen at this size.
        const crops = items.filter((it) => it.sizes[0] === s.key && it.boxes[s.key]?.[side]).map((it) => ({ name: `r${it.n}-${side}`, box: it.boxes[s.key][side], maxW: BUILD_CROP_WIDTH }));
        // The focus crop of the build: what the exploration page's tile shows.
        if (side === 'b') for (const it of items) if (it.sizes[0] === s.key && it.boxes[s.key]?.f) crops.push({ name: `r${it.n}-f`, box: it.boxes[s.key].f, maxW: 480 });
        const enc = await encodeShots(helper, got.png, { scale: s.scale, fullWidth: s.imageWidth, crops });
        if (enc.full) {
          const name = `p-${s.key}-${side}`;
          await save(name, Buffer.from(enc.full.b64, 'base64'));
          entry[side] = { image: name, w: enc.full.w, h: enc.full.h, pageW: got.ex.w, pageH: got.ex.h };
        } else {
          entry[side] = null;
          entry.missing[side] = 'too-large';
        }
        for (const [name, c] of Object.entries(enc.crops)) if (c) await save(name, Buffer.from(c.b64, 'base64'));
        for (const it of items) {
          if (it.sizes[0] !== s.key) continue;
          if (enc.crops[`r${it.n}-${side}`]) it.crop = { ...(it.crop ?? { size: s.key }), [side]: `r${it.n}-${side}` };
          if (side === 'b' && enc.crops[`r${it.n}-f`]) it.crop = { ...(it.crop ?? { size: s.key }), f: `r${it.n}-f` };
        }
      }
      summary.sizes.push(entry);
    }
    summary.items = items.map((it) => ({ ...it, crop: it.crop ?? { size: it.sizes[0] } }));
    return summary;
  } finally {
    await helperCtx.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Run.

export function targetsOf(config, hostRepo) {
  const products = config.products ?? [];
  const out = [{ repo: hostRepo, ds: true, products }];
  for (const p of products) {
    if (!p.repo || p.repo.toLowerCase() === hostRepo.toLowerCase()) continue;
    // Explored in the design team's copy (products[].design): its explorations, on the copy's previews.
    const copy = p.design?.repo && p.design.repo.toLowerCase() !== p.repo.toLowerCase() ? p.design : null;
    if (copy) {
      if (copy.preview) out.push({ repo: copy.repo, ds: false, product: { ...p, preview: copy.preview } });
      continue;
    }
    if (!p.preview) continue;
    out.push({ repo: p.repo, ds: false, product: p });
  }
  return out;
}

/**
 * The preview URL Vercel reported for the head commit, with its state, or null. In this repository: the labelled
 * product's app (the admin demo), then the library app its files point at; an app whose build Vercel skipped (nothing
 * of the exploration in it) gives way to the next. In a product repository: the product's preview.
 */
async function previewFor(core, api, t, pull, config) {
  const [comments, status] = await Promise.all([api.get(`/repos/${t.repo}/issues/${pull.number}/comments?per_page=100`), api.get(`/repos/${t.repo}/commits/${pull.head.sha}/status`)]);
  const sources = { comments: comments ?? [], statuses: status?.statuses ?? [] };
  const ctx = { branch: pull.head.ref, pr: pull.number, sha: pull.head.sha };
  let candidates;
  if (t.ds) {
    const apps = config.previews?.apps ?? {};
    const all = core.resolveBranchPreviews(apps, ctx, sources);
    const product = labelledProduct(pull, t.products);
    const files = ((await api.get(`/repos/${t.repo}/pulls/${pull.number}/files?per_page=100`)) ?? []).map((f) => f.filename);
    const order = [product && apps[product.key] ? product.key : null, libraryApp(files, apps), 'docs'].filter(Boolean);
    candidates = [...new Set(order)].map((app) => all.find((x) => x.app === app)).filter(Boolean);
  } else {
    candidates = core.resolveBranchPreviews({ admin: t.product.preview }, ctx, sources);
  }
  const resolved = candidates.find((x) => x.url && !x.skipped);
  if (!resolved) return null;
  // A plain "Vercel" status (one project per repository) says whether this commit's preview is built.
  const plain = t.ds ? null : (status?.statuses ?? []).find((s) => /^vercel$/i.test(s.context.trim()));
  const state = plain ? ({ success: 'ready', pending: 'building', failure: 'failed', error: 'failed' }[plain.state] ?? resolved.state) : resolved.state;
  return { url: resolved.url, state, app: resolved.app };
}

export async function run({ dir, configPath, force = false, dryRun = false, hostRepo, token, now = Date.now() }) {
  const core = await deps().core();
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const host = hostRepo || `${config.repo.owner}/${config.repo.name}`;
  const api = gh(token);
  const stored = new Map(storedMetas(dir).map((m) => [shotKey(m.repo, m.pr), m]));
  const open = new Set();
  const jobs = [];
  const privateRepos = new Set();
  const readRepos = new Set();
  for (const t of targetsOf(config, host)) {
    if (!t.ds) {
      // Privacy: a product repository's preview is captured only when the repository is public.
      const info = await api.get(`/repos/${t.repo}`).catch(() => null);
      if (!info || info.private || (info.visibility && info.visibility !== 'public')) {
        privateRepos.add(t.repo.toLowerCase());
        log(`${t.repo}: not public (or not readable), no capture, Studio keeps the plate.`);
        continue;
      }
    }
    const pulls = await api.get(`/repos/${t.repo}/pulls?state=open&per_page=100`).catch((e) => (log(`${t.repo}: ${e.message}`), null));
    if (!pulls) continue;
    readRepos.add(t.repo.toLowerCase());
    for (const p of pulls.filter(isOpenExploration)) {
      const key = shotKey(t.repo, p.number);
      open.add(key);
      const meta = stored.get(key);
      const screen = bodyScreenOf(p.body);
      const d = shotDecision({ sha: p.head.sha, stored: meta, force, screen });
      if (d.action === 'skip') {
        log(`${key}: skip (${d.why}).`);
        continue;
      }
      const preview = await previewFor(core, api, t, p, config).catch((e) => (log(`${key}: ${e.message}`), null));
      if (!preview) {
        log(`${key}: no preview build of its own yet (or none reported).`);
        continue;
      }
      if (preview.state === 'building' || preview.state === 'failed') {
        log(`${key}: preview ${preview.state}, later.`);
        continue;
      }
      jobs.push({ key, repo: t.repo, pull: p, url: preview.url, meta, screen });
    }
  }

  let changed = false;
  // Captures of private product repositories go; closed pull requests are read once, then kept or pruned.
  for (const [key, m] of stored) {
    if (open.has(key)) {
      if (m.closed) {
        delete m.closed;
        if (!dryRun) writeJson(join(dir, m.file), stripFile(m));
        changed = true;
      }
      continue;
    }
    const repo = m.repo.toLowerCase();
    if (privateRepos.has(repo)) {
      log(`${key}: its repository is not public, capture removed.`);
      if (!dryRun) removeShot(dir, m);
      stored.delete(key);
      changed = true;
      continue;
    }
    if (!readRepos.has(repo)) continue;
    if (!m.closed) {
      const p = await api.get(`/repos/${m.repo}/pulls/${m.pr}`).catch(() => null);
      if (!p || p.state === 'open') continue; // Open but no longer an exploration (archived): kept as it is.
      m.closed = { at: p.closed_at ?? new Date(now).toISOString(), merged: Boolean(p.merged_at) };
      if (!dryRun) writeJson(join(dir, m.file), stripFile(m));
      changed = true;
    }
    if (pruneDecision(m, now) === 'remove') {
      log(`${key}: closed without merging over 30 days ago, capture removed.`);
      if (!dryRun) removeShot(dir, m);
      stored.delete(key);
      changed = true;
    }
  }

  if (jobs.length && !dryRun) {
    const browser = await launch();
    try {
      for (const j of jobs) {
        const paths = shotPaths(j.repo, j.pull.number);
        try {
          // The exploration's own screen when it chose one, captured there and nowhere else.
          const shot = await captureOne(browser, j.screen ? atScreen(j.url, j.screen) : j.url, j.screen ? { crawl: false } : {});
          mkdirSync(dirname(join(dir, paths.image)), { recursive: true });
          writeFileSync(join(dir, paths.image), shot.webp);
          const meta = {
            repo: j.repo,
            pr: j.pull.number,
            sha: j.pull.head.sha,
            branch: j.pull.head.ref,
            title: j.pull.title,
            url: j.url,
            route: shot.route,
            screen: shot.screen,
            ...(j.screen ? { at: j.screen } : {}),
            capturedAt: new Date().toISOString(),
            image: paths.image,
            width: shot.width,
            height: shot.height,
            bytes: shot.webp.length,
          };
          writeJson(join(dir, paths.meta), meta);
          stored.set(j.key, { ...meta, file: paths.meta });
          log(`${j.key}: captured ${j.url}${shot.route !== '/' ? ` (${shot.route})` : ''}, ${Math.round(shot.webp.length / 1024)} KB.`);
        } catch (e) {
          const prev = j.meta?.failed?.sha === j.pull.head.sha ? (j.meta.failed.tries ?? 0) : 0;
          const meta = { ...(j.meta ? stripFile(j.meta) : { repo: j.repo, pr: j.pull.number }), failed: { sha: j.pull.head.sha, at: new Date().toISOString(), tries: prev + 1, error: String(e?.message ?? e).slice(0, 300) } };
          writeJson(join(dir, paths.meta), meta);
          stored.set(j.key, { ...meta, file: paths.meta });
          log(`${j.key}: capture failed (${meta.failed.error}).`);
        }
        changed = true;
      }
    } finally {
      await browser.close();
    }
  } else if (jobs.length) {
    for (const j of jobs) log(`${j.key}: would capture ${j.url}.`);
  }

  const index = buildIndex([...stored.values()]);
  const indexFile = join(dir, 'index.json');
  const before = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
  const after = `${JSON.stringify(index, null, 2)}\n`;
  if (before !== after) {
    if (!dryRun) writeFileSync(indexFile, after);
    changed = true;
  }
  // Who gets it: the public products' screens and what this repository's waiting changes do to them (reach/).
  const reach = await reachRun({ dir, config, api, host, force, dryRun, core, now, privateRepos }).catch((e) => (log(`reach: ${e.message}`), { changed: false }));
  if (reach.changed) changed = true;
  log(`Done: ${jobs.length} to capture, ${Object.keys(index.shots).length} stored, ${api.calls()} GitHub calls.`);
  return { jobs: jobs.length, changed, index };
}

const stripFile = ({ file, ...m }) => m;

function removeShot(dir, m) {
  const p = shotPaths(m.repo, m.pr);
  rmSync(join(dir, p.image), { force: true });
  rmSync(join(dir, p.meta), { force: true });
}

// ---------------------------------------------------------------------------------------------------------------

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else {
        out[k] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === 'run') {
    if (!a.shots) throw new Error('--shots <dir> is required');
    const res = await run({
      dir: a.shots,
      configPath: a.config || 'bridge.config.json',
      force: a.force === true || a.force === 'true',
      dryRun: Boolean(a['dry-run']),
      hostRepo: process.env.GITHUB_REPOSITORY,
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    });
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=${res.changed}\ncaptured=${res.jobs}\n`, { flag: 'a' });
  } else if (cmd === 'capture') {
    if (!a.url || !a.out) throw new Error('--url and --out are required');
    const browser = await launch();
    try {
      const shot = await captureOne(browser, a.url, { crawl: a['no-crawl'] !== true });
      mkdirSync(dirname(a.out), { recursive: true });
      writeFileSync(a.out, shot.webp);
      log(JSON.stringify({ out: a.out, route: shot.route, screen: shot.screen, width: shot.width, height: shot.height, bytes: shot.webp.length }));
    } finally {
      await browser.close();
    }
  } else if (cmd === 'reach') {
    // Local run of Who gets it against a team's live products, into a folder: nothing is published or sent.
    if (!a.repo || !a.out) throw new Error('--repo <owner/name> and --out <dir> are required');
    const api = gh(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
    const file = await api.get(`/repos/${a.repo}/contents/bridge.config.json`);
    if (!file?.content) throw new Error(`${a.repo} has no bridge.config.json Bridge can read`);
    const config = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    const core = await deps().core().catch(() => null);
    const products = reachProducts(config, core?.previewUrl).filter((p) => !a.product || p.key === a.product);
    const changes = (await tokenChanges(api, a.repo, config)).filter((c) => !a.change || String(c.pr) === String(a.change));
    log(`${products.length} product(s), ${changes.length} change(s) that set values: ${changes.map((c) => `#${c.pr}`).join(', ') || 'none'}.`);
    mkdirSync(a.out, { recursive: true });
    const browser = await launch();
    try {
      const summary = await measureReach(browser, { products, changes, modes: config.modes, cssVar: config.cssVar }, async (name, webp) => writeFileSync(join(a.out, `${name}.webp`), webp), { max: Number(a.max) || REACH_SCREENS_MAX });
      writeJson(join(a.out, 'summary.json'), summary);
      for (const c of summary.changes) log(`#${c.pr} ${c.title}: ${c.state}, ${c.screens.length} screen(s) change.`);
    } finally {
      await browser.close();
    }
  } else if (cmd === 'build') {
    // Local run of Check the build: the approved preview and the build on the same screen, into a folder. Nothing sent.
    if (!a.approved || !a.build || !a.out) throw new Error('--approved <url> --build <url> --out <dir> are required (--route /#/screen optional)');
    mkdirSync(a.out, { recursive: true });
    const browser = await launch();
    try {
      const summary = await measureBuild(browser, { approved: a.approved, build: a.build, route: typeof a.route === 'string' ? a.route : null }, async (name, webp) => writeFileSync(join(a.out, `${name}.webp`), webp));
      writeJson(join(a.out, 'summary.json'), summary);
      for (const it of summary.items) log(`${it.n}. ${it.name} (${it.sizes.join(', ')}): ${it.line}`);
    } finally {
      await browser.close();
    }
  } else {
    console.error('Usage: node scripts/preview-shots.mjs run --shots <dir> | capture --url <url> --out <file.webp> | reach --repo <owner/name> --out <dir> | build --approved <url> --build <url> --out <dir>');
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e?.stack ?? e);
    process.exit(1);
  });
}
