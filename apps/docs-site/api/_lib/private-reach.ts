// Who gets it, measured, for teams whose products Bridge cannot publish captures of (private product repositories):
// the main screens of each product and what each waiting library change does to them. The same robot as the public
// preview-shots workflow (scripts/preview-shots.mjs measureReach), run by Bridge's own workflow
// (.github/workflows/private-shots.yml, scripts/private-shots.mjs), with the same identity as the private shots: its
// GitHub OIDC token (api/_lib/private-shots.ts workflowClaims), no stored secret.
//   - GET /api/contribute?reachRun=todo: the teams whose screens are due (never measured, older than MAX_AGE_MS, a
//     product address or a waiting change that moved), each with its products' live addresses and its open library
//     changes that touch token files, with those files before and after (the robot computes the values they set).
//   - POST ?reachRun=image { team, run, name, image }: one screen image (webp), kept in Bridge's private Blob store at
//     REACH_PREFIX<team>/<run>/<name>.webp.
//   - POST ?reachRun=done { team, run, summary }: the measurement. Redis keeps it (bridge:reach:<team>, KEEP_S); the
//     images of earlier runs go.
//   - Studio reads GET ?repo=<team>&reach=summary (only the products the reader may read) and ?reach=image&run=&name=
//     (one image, for a reader of that product): the same readers as the private shots (team-read).
import { json, type FetchLike } from './http.js';
import type { Redis } from './redis.js';
import { watchedCopies, type ShotStore } from './private-shots.js';

export const REACH_PREFIX = 'private-reach/';
export const KEEP_S = 30 * 24 * 3600;
export const MAX_AGE_MS = 24 * 3600 * 1000;
/** Teams measured per run: a run measures each in a few minutes. */
export const TEAMS_MAX = 2;
/** Library changes measured per team. */
export const CHANGES_MAX = 8;
/** A token file larger than this is not sent (a whole generated palette stays far under). */
export const FILE_MAX_CHARS = 400_000;
export const MAX_IMAGE_CHARS = 400_000;
const API = 'https://api.github.com';
const REPO = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,79}$/;
const RUN = /^\d{10,16}$/;

export const reachKeyOf = (team: string) => `bridge:reach:${team.toLowerCase()}`;
const filesKeyOf = (team: string, pr: number, sha: string) => `bridge:reach:files:${team.toLowerCase()}#${pr}@${sha}`;
export const reachImagePath = (team: string, run: string, name: string) => `${REACH_PREFIX}${team.toLowerCase()}/${run}/${name}.webp`;

export interface ReachCtx {
  f: FetchLike;
  now: () => number;
  redis: Redis;
  store: ShotStore | null;
  token: (owner: string, repo: string) => Promise<string | null>;
}

export interface ReachProductJob {
  key: string;
  name: string;
  repo: string;
  /** The live address (products[].production), or null with a preview template the robot fills for the branch. */
  url: string | null;
  template: string | null;
  branch: string;
}

export interface ReachChangeJob {
  repo: string;
  pr: number;
  sha: string;
  title: string;
  files: { path: string; before: string | null; after: string | null }[];
}

export interface ReachJob {
  team: string;
  run: string;
  products: ReachProductJob[];
  changes: ReachChangeJob[];
  modes: unknown;
  cssVar: unknown;
}

/** The measurement as Studio reads it: images by name, under `run`. */
export interface ReachSummary {
  run: string;
  measuredAt: string;
  products: { key: string; name: string; repo: string; url: string; screens: { id: string; route: string; title: string; image: string }[] }[];
  changes: {
    repo: string;
    pr: number;
    sha: string;
    title: string;
    state: 'measured' | 'new' | 'unmeasured';
    theme: string | null;
    values: number;
    screens: { id: string; before: string; after: string; elements: Record<string, number> }[];
  }[];
}

async function gh(ctx: ReachCtx, token: string, path: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
  try {
    return await ctx.f(`${API}${path}`, { method: 'GET', headers: { Accept: accept, Authorization: `Bearer ${token}`, 'User-Agent': 'bridge-reach', 'X-GitHub-Api-Version': '2022-11-28' } });
  } catch {
    return null;
  }
}

const isExplorationPull = (p: { labels?: { name?: string }[]; head?: { ref?: string }; body?: string | null }) =>
  (p.labels ?? []).some((l) => l?.name === 'exploration') || String(p.head?.ref ?? '').startsWith('explore/') || /<!-- bridge-exploration \{/.test(p.body ?? '');

/** The products of a team's config Bridge can measure: a product repository and a live address or a preview template. */
export function productJobs(config: { products?: unknown[]; repo?: { defaultBranch?: unknown } }): ReachProductJob[] {
  const branch = typeof config.repo?.defaultBranch === 'string' ? config.repo.defaultBranch : 'main';
  const out: ReachProductJob[] = [];
  for (const raw of config.products ?? []) {
    const p = raw as { key?: unknown; name?: unknown; repo?: unknown; production?: unknown; preview?: unknown; default?: unknown };
    if (p.default || typeof p.key !== 'string' || typeof p.name !== 'string' || typeof p.repo !== 'string' || !REPO.test(p.repo)) continue;
    const url = typeof p.production === 'string' && /^https:\/\//.test(p.production) ? p.production : null;
    const template = !url && typeof p.preview === 'string' && /^https:\/\//.test(p.preview) ? p.preview : null;
    if (!url && !template) continue;
    out.push({ key: p.key, name: p.name, repo: p.repo.toLowerCase(), url, template, branch });
  }
  return out;
}

const changeId = (c: { repo: string; pr: number; sha: string }) => `${c.repo.toLowerCase()}#${c.pr}@${c.sha}`;

/** Due: never measured, too old, a product address or a change that moved. Pure (tested). */
export function reachIsDue(stored: ReachSummary | null, products: ReachProductJob[], changes: { repo: string; pr: number; sha: string }[], now: number, force = false): boolean {
  if (force || !stored) return true;
  const at = Date.parse(stored.measuredAt);
  if (!Number.isFinite(at) || now - at > MAX_AGE_MS) return true;
  const a = stored.products.map((p) => `${p.key}|${p.repo}`).sort().join(',');
  const b = products.map((p) => `${p.key}|${p.repo}`).sort().join(',');
  if (a !== b) return true;
  return stored.changes.map(changeId).sort().join(',') !== changes.map(changeId).sort().join(',');
}

export function parseSummary(raw: unknown): ReachSummary | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && typeof v === 'object' && Array.isArray((v as ReachSummary).products) && Array.isArray((v as ReachSummary).changes) ? (v as ReachSummary) : null;
  } catch {
    return null;
  }
}

export async function readReach(redis: Redis, team: string): Promise<ReachSummary | null> {
  return parseSummary(await redis.cmd('GET', reachKeyOf(team)));
}

/** The token files a change touches (cached by head commit: a new commit reads them again). */
async function tokenFiles(ctx: ReachCtx, token: string, team: string, pr: number, sha: string, root: string): Promise<string[]> {
  const key = filesKeyOf(team, pr, sha);
  const kept = await ctx.redis.cmd('GET', key);
  if (typeof kept === 'string') {
    try {
      return JSON.parse(kept) as string[];
    } catch {
      /* read again */
    }
  }
  const res = await gh(ctx, token, `/repos/${team}/pulls/${pr}/files?per_page=100`);
  if (!res || res.status !== 200) return [];
  const r = root.replace(/\/+$/, '');
  const files = ((await res.json()) as { filename?: string; status?: string }[])
    .filter((f) => /\.tokens\.json$/.test(f.filename ?? '') && (!r || (f.filename ?? '').startsWith(`${r}/`)) && f.status !== 'removed' && f.status !== 'added')
    .map((f) => f.filename!)
    .slice(0, 12);
  await ctx.redis.cmd('SET', key, JSON.stringify(files), 'EX', 7 * 24 * 3600);
  return files;
}

async function fileAt(ctx: ReachCtx, token: string, repo: string, path: string, ref: string): Promise<string | null> {
  const res = await gh(ctx, token, `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`, 'application/vnd.github.raw');
  if (!res || res.status !== 200) return null;
  const text = await res.text();
  return text.length <= FILE_MAX_CHARS ? text : null;
}

/** The teams Bridge watches whose screens are due, at most TEAMS_MAX. */
export async function reachTodo(ctx: ReachCtx, force = false): Promise<ReachJob[]> {
  const teams = [...new Set((await watchedCopies(ctx.redis)).map((w) => w.team))];
  const jobs: ReachJob[] = [];
  for (const team of teams) {
    if (jobs.length >= TEAMS_MAX) break;
    const [o, r] = team.split('/') as [string, string];
    if (!REPO.test(team)) continue;
    const token = await ctx.token(o, r);
    if (!token) continue;
    const cfg = await gh(ctx, token, `/repos/${o}/${r}/contents/bridge.config.json`, 'application/vnd.github.raw');
    if (!cfg || cfg.status !== 200) continue;
    let config: { products?: unknown[]; repo?: { defaultBranch?: unknown }; tokens?: { root?: unknown }; modes?: unknown; cssVar?: unknown };
    try {
      config = JSON.parse(await cfg.text());
    } catch {
      continue;
    }
    const products = productJobs(config);
    if (!products.length) continue;
    const pulls = await gh(ctx, token, `/repos/${o}/${r}/pulls?state=open&per_page=50`);
    if (!pulls || pulls.status !== 200) continue;
    const root = typeof config.tokens?.root === 'string' ? config.tokens.root : '';
    const open = ((await pulls.json()) as { number?: unknown; title?: unknown; head?: { sha?: unknown; ref?: string }; base?: { sha?: unknown }; labels?: { name?: string }[]; body?: string | null }[]) ?? [];
    const candidates: { pr: number; sha: string; base: string; title: string; files: string[] }[] = [];
    for (const p of open) {
      if (candidates.length >= CHANGES_MAX) break;
      const sha = typeof p.head?.sha === 'string' ? p.head.sha : '';
      const base = typeof p.base?.sha === 'string' ? p.base.sha : '';
      if (!Number.isSafeInteger(p.number) || !SHA.test(sha) || !SHA.test(base) || isExplorationPull(p)) continue;
      const files = await tokenFiles(ctx, token, team, Number(p.number), sha, root);
      if (files.length) candidates.push({ pr: Number(p.number), sha, base, title: String(p.title ?? '').slice(0, 200), files });
    }
    const changes = candidates.map((c) => ({ repo: team, pr: c.pr, sha: c.sha }));
    if (!reachIsDue(await readReach(ctx.redis, team), products, changes, ctx.now(), force)) continue;
    const withFiles: ReachChangeJob[] = await Promise.all(
      candidates.map(async (c) => ({
        repo: team,
        pr: c.pr,
        sha: c.sha,
        title: c.title,
        files: await Promise.all(c.files.map(async (path) => ({ path, before: await fileAt(ctx, token, team, path, c.base), after: await fileAt(ctx, token, team, path, c.sha) }))),
      })),
    );
    jobs.push({ team, run: String(ctx.now()), products, changes: withFiles, modes: config.modes ?? {}, cssVar: config.cssVar ?? {} });
  }
  return jobs;
}

async function isWatchedTeam(redis: Redis, team: string): Promise<boolean> {
  return (await watchedCopies(redis)).some((w) => w.team === team);
}

const isWebp = (b64: string) => /^[A-Za-z0-9+/]+={0,2}$/.test(b64) && Buffer.from(b64.slice(0, 32), 'base64').subarray(8, 12).equals(Buffer.from('WEBP'));

/** Keeps one image of a run for a watched team. */
export async function putReachImage(ctx: ReachCtx, body: Record<string, unknown>): Promise<Response> {
  const team = typeof body.team === 'string' ? body.team.toLowerCase() : '';
  const run = typeof body.run === 'string' ? body.run : '';
  const name = typeof body.name === 'string' ? body.name : '';
  const image = typeof body.image === 'string' ? body.image : '';
  if (!REPO.test(team) || !RUN.test(run) || !NAME.test(name)) return json(400, { error: 'bad_request', message: 'Say which team, run and image name.' });
  if (!image || image.length > MAX_IMAGE_CHARS || !isWebp(image)) return json(400, { error: 'bad_image', message: 'Send a webp image, base64, under 300 KB.' });
  if (!ctx.store) return json(503, { error: 'not_configured', message: 'Bridge has no screenshot storage yet.' });
  if (!(await isWatchedTeam(ctx.redis, team))) return json(403, { error: 'not-allowed', message: 'Bridge does not watch this team.' });
  await ctx.store.put(reachImagePath(team, run, name), Buffer.from(image, 'base64'));
  return json(200, { ok: true });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const ROUTE = /^\/[^\s<>"'\\]*$/;

/** The summary as sent, kept only where well formed: names and routes of the shapes the robot writes. */
export function cleanSummary(raw: unknown, run: string, now: number): ReachSummary | null {
  const v = raw as { products?: unknown; changes?: unknown } | null;
  if (!v || !Array.isArray(v.products) || !Array.isArray(v.changes)) return null;
  const products = (v.products as Record<string, unknown>[]).slice(0, 20).flatMap((p) => {
    const repo = str(p.repo).toLowerCase();
    const url = str(p.url, 500);
    if (!str(p.key) || !str(p.name) || !REPO.test(repo) || !/^https:\/\//.test(url)) return [];
    const screens = (Array.isArray(p.screens) ? (p.screens as Record<string, unknown>[]) : []).slice(0, 20).flatMap((s) => {
      const route = str(s.route, 300);
      return NAME.test(str(s.id)) && NAME.test(str(s.image)) && ROUTE.test(route) ? [{ id: str(s.id), route, title: str(s.title, 60) || 'Screen', image: str(s.image) }] : [];
    });
    return [{ key: str(p.key, 60), name: str(p.name, 80), repo, url, screens }];
  });
  const ids = new Set(products.flatMap((p) => p.screens.map((s) => s.id)));
  const changes = (v.changes as Record<string, unknown>[]).slice(0, 20).flatMap((c) => {
    const repo = str(c.repo).toLowerCase();
    const pr = Number(c.pr);
    const sha = str(c.sha);
    const state = c.state === 'measured' || c.state === 'new' || c.state === 'unmeasured' ? (c.state as ReachSummary['changes'][number]['state']) : null;
    if (!REPO.test(repo) || !Number.isSafeInteger(pr) || pr < 1 || !SHA.test(sha) || !state) return [];
    const screens = (Array.isArray(c.screens) ? (c.screens as Record<string, unknown>[]) : []).slice(0, 300).flatMap((s) => {
      if (!ids.has(str(s.id)) || !NAME.test(str(s.before)) || !NAME.test(str(s.after))) return [];
      const e = (s.elements ?? {}) as Record<string, unknown>;
      const elements: Record<string, number> = {};
      for (const k of ['buttons', 'links', 'fields', 'text', 'surfaces']) {
        const n = Number(e[k]);
        elements[k] = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 100_000) : 0;
      }
      return [{ id: str(s.id), before: str(s.before), after: str(s.after), elements }];
    });
    return [{ repo, pr, sha, title: str(c.title), state, theme: typeof c.theme === 'string' && /^[a-z0-9-]{1,30}$/.test(c.theme) ? c.theme : null, values: Math.max(0, Number(c.values) || 0), screens }];
  });
  return { run, measuredAt: new Date(now).toISOString(), products, changes };
}

/** Keeps a run's measurement for a watched team, then lets the images of earlier runs go. */
export async function putReachSummary(ctx: ReachCtx, body: Record<string, unknown>): Promise<Response> {
  const team = typeof body.team === 'string' ? body.team.toLowerCase() : '';
  const run = typeof body.run === 'string' ? body.run : '';
  if (!REPO.test(team) || !RUN.test(run)) return json(400, { error: 'bad_request', message: 'Say which team and run.' });
  if (!(await isWatchedTeam(ctx.redis, team))) return json(403, { error: 'not-allowed', message: 'Bridge does not watch this team.' });
  const summary = cleanSummary(body.summary, run, ctx.now());
  if (!summary) return json(400, { error: 'bad_summary', message: 'Send the summary the robot wrote.' });
  await ctx.redis.cmd('SET', reachKeyOf(team), JSON.stringify(summary), 'EX', KEEP_S);
  if (ctx.store) {
    const keep = `${REACH_PREFIX}${team}/${run}/`;
    const old = (await ctx.store.list(`${REACH_PREFIX}${team}/`).catch(() => [])).filter((b) => !b.pathname.startsWith(keep)).map((b) => b.pathname);
    for (let i = 0; i < old.length; i += 100) await ctx.store.del(old.slice(i, i + 100)).catch(() => undefined);
  }
  return json(200, { ok: true, products: summary.products.length, changes: summary.changes.length });
}

/** The product an image of a summary shows, by its name, or null when the summary names no such image. */
export function productOfImage(summary: ReachSummary, name: string): ReachSummary['products'][number] | null {
  for (const p of summary.products) {
    if (p.screens.some((s) => s.image === name)) return p;
    const ids = new Set(p.screens.map((s) => s.id));
    if (summary.changes.some((c) => c.screens.some((s) => ids.has(s.id) && (s.before === name || s.after === name)))) return p;
  }
  return null;
}

/** A summary with only the products in `allowed` (repositories, lower case) and their screens. */
export function summaryFor(summary: ReachSummary, allowed: ReadonlySet<string>): ReachSummary {
  const products = summary.products.filter((p) => allowed.has(p.repo));
  const ids = new Set(products.flatMap((p) => p.screens.map((s) => s.id)));
  return { ...summary, products, changes: summary.changes.map((c) => ({ ...c, screens: c.screens.filter((s) => ids.has(s.id)) })) };
}

/** One image's bytes, or null. */
export async function reachImageBytes(store: ShotStore | null, team: string, run: string, name: string): Promise<Uint8Array | null> {
  if (!store || !RUN.test(run) || !NAME.test(name)) return null;
  return store.get(reachImagePath(team, run, name)).catch(() => null);
}
