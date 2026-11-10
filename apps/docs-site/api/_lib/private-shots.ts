// Screenshots of private products' explorations, kept by Bridge (the public preview-shots workflow captures only public
// repositories, into a branch anyone can read). The design team's copy of a product is usually private, so its
// explorations had no screenshot on their cards. Here:
//   - Bridge's own workflow (.github/workflows/private-shots.yml in Bridge's repository, scripts/private-shots.mjs)
//     asks GET /api/contribute?shots=todo which explorations of the watched design copies need a capture: their
//     repository, number, head commit, branch and preview template. It captures each preview and sends it back with
//     POST /api/contribute?shots=put. Both calls carry the workflow's GitHub OIDC token (no stored secret): issued by
//     GitHub Actions, for audience AUDIENCE, from Bridge's repository on its default branch (SHOTS_REPOSITORY).
//   - The image of a capture lives in Bridge's private Vercel Blob store (ShotStore, SHOTS_PREFIX<repo>/<pr>/<sha>-<ms>.webp,
//     one pathname per capture so no cache ever serves an older one); Redis keeps only its small index,
//     bridge:shot:<repo>#<pr> { sha, capturedAt, url, route, screen, at, blob (the pathname) }, KEEP_S. `at` is the
//     exploration's own screen (core Exploration.screen) the capture opened, so choosing another one captures it again. Captures kept before
//     2026-11-08 carried the image itself (base64 in `image`): still served, and moved by migrateShots (POST
//     ?shots=migrate from the same workflow), which also deletes the images no index names any more.
//   - Studio reads GET ?repo=<team>&shot=<owner/repo>&pr=<n>&meta=1 (when it was taken, of which commit) and the image
//     without meta=1: only for a reader of the team (a member, or a visitor of a demo team), only for a product
//     repository the team's config lists (team-read productReadAllowed), never kept by a shared cache.
import { createPublicKey, createVerify } from 'node:crypto';
import { HttpError, json, SECURITY_HEADERS, type FetchLike } from './http.js';
import type { Redis } from './redis.js';
import { NOTIFY_TEAMS_KEY, repoMetaKey } from './notify.js';
import { pullScreenOf, screenOf } from './exploration-member.js';

export const AUDIENCE = 'bridge-shots';
export const SHOTS_REPOSITORY = 'the-bridge-company/ai-design-system-demo';
export const ISSUER = 'https://token.actions.githubusercontent.com';
export const KEEP_S = 90 * 24 * 3600;
/** At most this many explorations per todo answer (a run captures them in a few minutes). */
export const TODO_MAX = 20;
/** A capture larger than this (base64 characters) is refused: 800 px wide webp stays far under. */
export const MAX_IMAGE_CHARS = 400_000;
const API = 'https://api.github.com';
const REPO = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;

export const shotKeyOf = (repo: string, pr: number) => `bridge:shot:${repo.toLowerCase()}#${pr}`;
/** Where the images live in the Blob store. */
export const SHOTS_PREFIX = 'private-shots/';
export const shotPathOf = (repo: string, pr: number, sha: string, at: number) => `${SHOTS_PREFIX}${repo.toLowerCase()}/${pr}/${sha}-${at}.webp`;

/** The images of the captures: Bridge's private Vercel Blob store in production, a Map in tests and local mode. */
export interface ShotStore {
  put(pathname: string, bytes: Uint8Array): Promise<void>;
  /** The bytes, or null when the store has no such image. */
  get(pathname: string): Promise<Uint8Array | null>;
  del(pathnames: string[]): Promise<void>;
  list(prefix: string): Promise<{ pathname: string; size: number }[]>;
}

/** Vercel Blob, private access: only this server (with the store's token) reads the images. */
export function vercelShotStore(token: string): ShotStore {
  const sdk = () => import('@vercel/blob');
  return {
    async put(pathname, bytes) {
      const blob = await sdk();
      await blob.put(pathname, Buffer.from(bytes), { access: 'private', contentType: 'image/webp', addRandomSuffix: false, allowOverwrite: true, token });
    },
    async get(pathname) {
      const blob = await sdk();
      const r = await blob.get(pathname, { access: 'private', token });
      if (!r || r.statusCode !== 200) return null;
      return new Uint8Array(await new Response(r.stream).arrayBuffer());
    },
    async del(pathnames) {
      if (!pathnames.length) return;
      const blob = await sdk();
      await blob.del(pathnames, { token });
    },
    async list(prefix) {
      const blob = await sdk();
      const out: { pathname: string; size: number }[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 50; i++) {
        const r = await blob.list({ prefix, token, limit: 1000, ...(cursor ? { cursor } : {}) });
        out.push(...r.blobs.map((b) => ({ pathname: b.pathname, size: b.size })));
        if (!r.hasMore || !r.cursor) break;
        cursor = r.cursor;
      }
      return out;
    },
  };
}

/** A ShotStore in memory (tests, `npm run dev:full`). */
export function memoryShotStore(): ShotStore & { items: Map<string, Uint8Array> } {
  const items = new Map<string, Uint8Array>();
  return {
    items,
    async put(p, b) {
      items.set(p, new Uint8Array(b));
    },
    async get(p) {
      return items.get(p) ?? null;
    },
    async del(ps) {
      for (const p of ps) items.delete(p);
    },
    async list(prefix) {
      return [...items].filter(([p]) => p.startsWith(prefix)).map(([pathname, b]) => ({ pathname, size: b.byteLength }));
    },
  };
}

/** The store: an injected one, else Vercel Blob from BLOB_READ_WRITE_TOKEN, else null (no capture is kept then). */
export function shotStoreOf(token: string | undefined, injected?: ShotStore): ShotStore | null {
  if (injected) return injected;
  const t = token?.trim();
  return t ? vercelShotStore(t) : null;
}

export interface ShotsCtx {
  f: FetchLike;
  now: () => number;
  redis: Redis;
  /** Where the images go; null: the store is not configured, a capture is refused. */
  store: ShotStore | null;
  /** An installation token of the Bridge app on that repository, or null. */
  token: (owner: string, repo: string) => Promise<string | null>;
}

// --- The workflow's identity: GitHub's OIDC token --------------------------------------------------------------------

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
}
let jwks: { at: number; keys: Jwk[] } | null = null;

const b64urlJson = (part: string): any => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/**
 * The claims of a GitHub Actions OIDC token when it verifies (RS256 with GitHub's published keys, issuer, audience,
 * not expired) and was issued to Bridge's own repository on its default branch; null otherwise.
 */
export async function workflowClaims(ctx: Pick<ShotsCtx, 'f' | 'now'>, authorization: string | null, repository = SHOTS_REPOSITORY): Promise<Record<string, unknown> | null> {
  const token = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/.exec(authorization ?? '')?.[1];
  if (!token) return null;
  const [h, p, sig] = token.split('.') as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = b64urlJson(h);
    claims = b64urlJson(p);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  if (!jwks || ctx.now() - jwks.at > 3600_000 || !jwks.keys.some((k) => k.kid === header.kid)) {
    try {
      const res = await ctx.f(`${ISSUER}/.well-known/jwks`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.status !== 200) return null;
      jwks = { at: ctx.now(), keys: ((await res.json()) as { keys?: Jwk[] }).keys ?? [] };
    } catch {
      return null;
    }
  }
  const jwk = jwks.keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) return null;
  let ok = false;
  try {
    const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n!, e: jwk.e! }, format: 'jwk' });
    ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(sig, 'base64url'));
  } catch {
    ok = false;
  }
  if (!ok) return null;
  const now = Math.floor(ctx.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER || !aud.includes(AUDIENCE) || typeof claims.exp !== 'number' || claims.exp < now) return null;
  if (String(claims.repository ?? '').toLowerCase() !== repository.toLowerCase()) return null;
  if (claims.ref !== 'refs/heads/main') return null;
  return claims;
}

/** Test seam: forget GitHub's keys. */
export const clearJwks = () => {
  jwks = null;
};

// --- What needs a capture ----------------------------------------------------------------------------------------------

export interface ShotJob {
  repo: string;
  pr: number;
  sha: string;
  branch: string;
  /** The copy's preview template (products[].design.preview), filled by the workflow with @bridge-ds/core previewUrl. */
  template: string;
  /** The changed files' names ("billing" for src/pages/Billing.tsx): the page to open when no change marker shows one. */
  hints: string[];
  /**
   * The screen the exploration changed, from its block (core Exploration.screen: "/#/orders/12"): the capture opens
   * there, never the root or a guessed page. Null when none is chosen.
   */
  screen: string | null;
}

/** Names worth looking for among a preview's links: the changed files' base names, never the app shell's. */
export function fileHints(files: readonly string[]): string[] {
  const shell = new Set(['index', 'app', 'main', 'styles', 'style', 'theme', 'tokens', 'readme', 'package', 'vite.config', 'tsconfig']);
  const out: string[] = [];
  // Folders that say nothing about the page (src/resources/orders/OrderList.tsx names "orders", never "resources").
  const plain = new Set(['src', 'app', 'apps', 'lib', 'ui', 'components', 'resources', 'pages', 'views', 'routes', 'screens', 'features', 'modules', 'shared', 'common']);
  // Words of a file name that name no page on their own ("list" in OrderList).
  const generic = new Set(['list', 'page', 'view', 'item', 'items', 'form', 'card', 'table', 'show', 'edit', 'create', 'panel', 'row', 'cell', 'header', 'footer', 'layout']);
  const add = (w: string) => {
    if (w.length >= 3 && !shell.has(w) && !generic.has(w) && !out.includes(w)) out.push(w);
  };
  // Code before styles (a shared stylesheet names no page), whole names before folders and words: the first hint is
  // the strongest, and the capture tries them in this order.
  const style = (f: string) => /\.(css|scss|less)$/i.test(f);
  const named = files.filter((f) => !f.startsWith('.') && !f.includes('/.')).sort((a, b) => Number(style(a)) - Number(style(b)));
  const later: string[] = [];
  for (const f of named) {
    const parts = f.split('/');
    const file = parts.pop()!.replace(/\.(tsx?|jsx?|vue|svelte|css|scss|less|md|json)$/i, '').replace(/\.(module|styles?)$/i, '');
    const base = file.toLowerCase();
    if (base.length < 3 || shell.has(base)) continue;
    if (!out.includes(base)) out.push(base);
    const dir = parts.pop()?.toLowerCase();
    if (dir && !plain.has(dir)) later.push(dir);
    for (const w of file.split(/(?<=[a-z0-9])(?=[A-Z])|[-_.\s]+/)) later.push(w.toLowerCase());
  }
  for (const w of later) add(w);
  return out.slice(0, 8);
}

async function gh(ctx: ShotsCtx, token: string, path: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
  try {
    return await ctx.f(`${API}${path}`, { method: 'GET', headers: { Accept: accept, Authorization: `Bearer ${token}`, 'User-Agent': 'bridge-shots', 'X-GitHub-Api-Version': '2022-11-28' } });
  } catch {
    return null;
  }
}

/**
 * The product repositories Bridge watches (api/_lib/notify.ts), each with its team: the design copies (the explorations)
 * and the developers' repositories (their builds, shown beside the approved version in Check the build).
 */
export async function watchedCopies(redis: Redis): Promise<{ repo: string; team: string; kind: 'copy' | 'code' }[]> {
  const repos = ((await redis.cmd('SMEMBERS', NOTIFY_TEAMS_KEY)) as string[] | null) ?? [];
  const metas = repos.length ? ((await redis.pipe(repos.map((r) => ['GET', repoMetaKey(r)]))) as (string | null)[]) : [];
  const out: { repo: string; team: string; kind: 'copy' | 'code' }[] = [];
  repos.forEach((repo, i) => {
    try {
      const m = metas[i] ? JSON.parse(metas[i]!) : null;
      if ((m?.kind === 'copy' || m?.kind === 'code') && typeof m.team === 'string' && REPO.test(repo)) out.push({ repo: repo.toLowerCase(), team: m.team.toLowerCase(), kind: m.kind });
    } catch {
      /* a broken entry: skipped */
    }
  });
  return out;
}

/**
 * The preview template of a product repository from its team's bridge.config.json: a copy's products[].design.preview,
 * the developers' repository's products[].preview; null when the config names none.
 */
async function copyTemplate(ctx: ShotsCtx, team: string, copy: string, kind: 'copy' | 'code' = 'copy'): Promise<string | null> {
  const [o, r] = team.split('/') as [string, string];
  if (!REPO.test(team)) return null;
  const token = await ctx.token(o, r);
  if (!token) return null;
  const res = await gh(ctx, token, `/repos/${o}/${r}/contents/bridge.config.json`, 'application/vnd.github.raw');
  if (!res || res.status !== 200) return null;
  try {
    const config = JSON.parse(await res.text()) as { products?: { repo?: unknown; preview?: unknown; design?: { repo?: unknown; preview?: unknown } }[] };
    const p = (config.products ?? []).find((x) => (kind === 'code' ? typeof x?.repo === 'string' && x.repo.toLowerCase() === copy : typeof x?.design?.repo === 'string' && x.design.repo.toLowerCase() === copy));
    const t = kind === 'code' ? p?.preview : p?.design?.preview;
    return typeof t === 'string' && /^https:\/\//.test(t) ? t : null;
  } catch {
    return null;
  }
}

/** The open explorations of the watched copies whose head has no capture yet (every one with `force`), at most TODO_MAX. */
export async function shotsTodo(ctx: ShotsCtx, force = false): Promise<ShotJob[]> {
  const jobs: ShotJob[] = [];
  for (const { repo, team, kind } of await watchedCopies(ctx.redis)) {
    if (jobs.length >= TODO_MAX) break;
    const template = await copyTemplate(ctx, team, repo, kind);
    if (!template) continue;
    const [o, r] = repo.split('/') as [string, string];
    const token = await ctx.token(o, r);
    if (!token) continue;
    const res = await gh(ctx, token, `/repos/${o}/${r}/pulls?state=open&per_page=50`);
    if (!res || res.status !== 200) continue;
    const pulls = ((await res.json()) as { number?: unknown; head?: { sha?: unknown; ref?: unknown }; draft?: unknown; body?: unknown }[]) ?? [];
    const kept = pulls.length ? ((await ctx.redis.pipe(pulls.map((p) => ['GET', shotKeyOf(repo, Number(p.number))]))) as (string | null)[]) : [];
    pulls.forEach((p, i) => {
      const sha = typeof p.head?.sha === 'string' ? p.head.sha : '';
      const branch = typeof p.head?.ref === 'string' ? p.head.ref : '';
      if (!Number.isSafeInteger(p.number) || !SHA.test(sha) || !branch || jobs.length >= TODO_MAX) return;
      // A developers' draft is not a build to check yet.
      if (kind === 'code' && p.draft === true) return;
      // The developers' own pull requests carry no exploration block: they open on the root, as before.
      const screen = kind === 'copy' ? pullScreenOf(p.body) : null;
      let have: { sha?: unknown; at?: unknown } | null = null;
      try {
        have = kept[i] ? (JSON.parse(kept[i]!) as { sha?: unknown; at?: unknown }) : null;
      } catch {
        have = null;
      }
      // A new head, or another screen chosen since the last capture: captured again.
      const same = have?.sha === sha && (screenOf(have?.at) ?? null) === screen;
      if (force || !same) jobs.push({ repo, pr: Number(p.number), sha, branch, template, hints: [], screen });
    });
    // The changed files of each exploration to capture: one read each, only for those.
    await Promise.all(
      jobs
        .filter((j) => j.repo === repo)
        .map(async (j) => {
          const files = await gh(ctx, token, `/repos/${o}/${r}/pulls/${j.pr}/files?per_page=100`);
          if (files?.status === 200) j.hints = fileHints(((await files.json()) as { filename?: string }[]).map((x) => x.filename ?? '').filter(Boolean));
        }),
    );
  }
  return jobs;
}

/** Keeps one capture the workflow sent: a watched copy, a webp of a sane size. */
export async function putShot(ctx: ShotsCtx, body: Record<string, unknown>): Promise<Response> {
  const repo = typeof body.repo === 'string' ? body.repo.toLowerCase() : '';
  const pr = Number(body.pr);
  const sha = typeof body.sha === 'string' ? body.sha : '';
  const image = typeof body.image === 'string' ? body.image : '';
  const url = typeof body.url === 'string' && /^https:\/\//.test(body.url) ? body.url.slice(0, 500) : null;
  // The page the capture shows (path, query and hash route), so Open the preview lands there too; its change's label.
  const route = typeof body.route === 'string' && /^\/[^\s<>"'\\]*$/.test(body.route) && body.route.length <= 300 ? body.route : null;
  const screen = typeof body.screen === 'string' && body.screen.trim() ? body.screen.trim().slice(0, 80) : null;
  // The exploration's own screen the capture opened (ShotJob.screen), so another choice is captured again.
  const opened = screenOf(body.at);
  if (!REPO.test(repo) || !Number.isSafeInteger(pr) || pr < 1 || !SHA.test(sha)) return json(400, { error: 'bad_request', message: 'Say which exploration: repo, pr and sha.' });
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || !Buffer.from(image.slice(0, 32), 'base64').subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return json(400, { error: 'bad_image', message: 'Send a webp image, base64, under 300 KB.' });
  }
  if (!ctx.store) return json(503, { error: 'not_configured', message: 'Bridge has no screenshot storage yet.' });
  const [meta, before] = (await ctx.redis.pipe([['GET', repoMetaKey(repo)], ['GET', shotKeyOf(repo, pr)]])) as [unknown, unknown];
  let kind: string | null = null;
  try {
    kind = typeof meta === 'string' ? JSON.parse(meta).kind : null;
  } catch {
    kind = null;
  }
  if (kind !== 'copy' && kind !== 'code') return json(403, { error: 'not-allowed', message: 'Bridge does not watch this repository.' });
  const at = ctx.now();
  const blob = shotPathOf(repo, pr, sha, at);
  await ctx.store.put(blob, Buffer.from(image, 'base64'));
  await ctx.redis.cmd('SET', shotKeyOf(repo, pr), JSON.stringify({ sha, capturedAt: new Date(at).toISOString(), ...(url ? { url } : {}), ...(route ? { route } : {}), ...(screen ? { screen } : {}), ...(opened ? { at: opened } : {}), blob }), 'EX', KEEP_S);
  // The image of the capture it replaces goes (a failure leaves an orphan that migrateShots deletes).
  const old = parseShot(before)?.blob;
  if (old && old !== blob) await ctx.store.del([old]).catch(() => undefined);
  return json(200, { ok: true });
}

interface KeptShot {
  sha?: string;
  capturedAt?: string;
  url?: unknown;
  route?: unknown;
  screen?: unknown;
  /** The exploration's own screen the capture opened. */
  at?: unknown;
  /** The image's pathname in the store. */
  blob?: string;
  /** A capture kept before the move to the Blob store: the image itself, base64. */
  image?: string;
}

function parseShot(raw: unknown): KeptShot | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? (v as KeptShot) : null;
  } catch {
    return null;
  }
}

// --- Studio's reads ----------------------------------------------------------------------------------------------------

/** When one capture was taken and of which commit, or null (none yet). */
export async function shotMeta(redis: Redis, repo: string, pr: number): Promise<{ sha: string; capturedAt: string; route: string | null; screen: string | null } | null> {
  const v = parseShot(await redis.cmd('GET', shotKeyOf(repo, pr)));
  return v?.sha && v?.capturedAt ? { sha: v.sha, capturedAt: v.capturedAt, route: typeof v.route === 'string' ? v.route : null, screen: typeof v.screen === 'string' ? v.screen : null } : null;
}

// Images by pathname, in this function's memory: a pathname names one capture forever, so a kept copy is never stale.
const MEMORY_MAX_BYTES = 8 * 1024 * 1024;
const memory = new Map<string, Uint8Array>();
let memoryBytes = 0;
function remember(pathname: string, bytes: Uint8Array) {
  if (bytes.byteLength > MEMORY_MAX_BYTES / 4 || memory.has(pathname)) return;
  memory.set(pathname, bytes);
  memoryBytes += bytes.byteLength;
  for (const [k, v] of memory) {
    if (memoryBytes <= MEMORY_MAX_BYTES) break;
    memory.delete(k);
    memoryBytes -= v.byteLength;
  }
}
/** Test seam: forget the images kept in memory. */
export const clearShotMemory = () => {
  memory.clear();
  memoryBytes = 0;
};

/** The image of one capture, for a reader the caller already checked, or 404. Never kept by a shared cache. */
export async function shotImage(redis: Redis, store: ShotStore | null, repo: string, pr: number): Promise<Response> {
  const v = parseShot(await redis.cmd('GET', shotKeyOf(repo, pr)));
  let bytes: Uint8Array | null = null;
  if (v?.blob && store) {
    bytes = memory.get(v.blob) ?? null;
    if (!bytes) {
      bytes = await store.get(v.blob).catch(() => null);
      if (bytes) remember(v.blob, bytes);
    }
  } else if (v?.image) bytes = Buffer.from(v.image, 'base64');
  if (!bytes) throw new HttpError(404, 'not_found', 'No screenshot yet.');
  return new Response(Buffer.from(bytes), { status: 200, headers: { ...SECURITY_HEADERS, 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=300' } });
}

// --- The move out of Redis (once, 2026-11-08) ---------------------------------------------------------------------------

export interface ShotsMigration {
  dryRun: boolean;
  /** Index keys found. */
  keys: number;
  /** Captures whose image moved (or would move) from Redis to the store. */
  moved: number;
  /** Captures already in the store. */
  inStore: number;
  /** Bytes of Redis values freed (or that would be): each moved key's value length before minus after. */
  redisBytesFreed: number;
  /** Images in the store that no index names any more (expired, replaced): deleted (or that would be). */
  orphansDeleted: number;
  orphanBytes: number;
}

/**
 * Moves every image still kept in Redis to the store and leaves only the index (its TTL kept), then deletes the
 * store's images no index names. Idempotent: a second run moves nothing. `dryRun` only counts.
 */
export async function migrateShots(ctx: Pick<ShotsCtx, 'redis' | 'store' | 'now'>, dryRun = false): Promise<ShotsMigration> {
  const out: ShotsMigration = { dryRun, keys: 0, moved: 0, inStore: 0, redisBytesFreed: 0, orphansDeleted: 0, orphanBytes: 0 };
  if (!ctx.store) throw new HttpError(503, 'not_configured', 'Bridge has no screenshot storage yet.');
  const keys = new Set<string>();
  let cursor: string | number = 0;
  for (let i = 0; i < 1000; i++) {
    const r = (await ctx.redis.cmd('SCAN', cursor, 'MATCH', 'bridge:shot:*', 'COUNT', 500)) as [string | number, string[]] | null;
    for (const k of r?.[1] ?? []) keys.add(k);
    cursor = r?.[0] ?? 0;
    if (String(cursor) === '0') break;
  }
  out.keys = keys.size;
  const named = new Set<string>();
  for (const key of keys) {
    const raw = await ctx.redis.cmd('GET', key);
    const v = parseShot(raw);
    const m = /^bridge:shot:(.+)#(\d+)$/.exec(key);
    if (!v || !m) continue;
    if (v.blob) {
      out.inStore++;
      named.add(v.blob);
      continue;
    }
    if (!v.image || !v.sha) continue;
    const at = Date.parse(v.capturedAt ?? '') || ctx.now();
    const blob = shotPathOf(m[1]!, Number(m[2]), v.sha, at);
    const { image, ...rest } = v;
    const next = JSON.stringify({ ...rest, blob });
    out.moved++;
    out.redisBytesFreed += String(raw).length - next.length;
    named.add(blob);
    if (dryRun) continue;
    await ctx.store.put(blob, Buffer.from(image, 'base64'));
    // KEEPTTL: the index expires when the capture would have.
    await ctx.redis.cmd('SET', key, next, 'KEEPTTL');
  }
  const orphans = (await ctx.store.list(SHOTS_PREFIX)).filter((b) => !named.has(b.pathname));
  out.orphansDeleted = orphans.length;
  out.orphanBytes = orphans.reduce((n, b) => n + b.size, 0);
  if (!dryRun) for (let i = 0; i < orphans.length; i += 100) await ctx.store.del(orphans.slice(i, i + 100).map((b) => b.pathname));
  return out;
}
