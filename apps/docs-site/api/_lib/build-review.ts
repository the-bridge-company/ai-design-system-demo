// Check the build, region by region (Studio review mode, /studio/<team>/explorations/review/): what differs between the
// approved design and the developers' build, measured by Bridge's own capture workflow, and what each person says about
// each difference, round after round, with comments pinned on the spot. Next to the build check of api/_lib/build-check.ts
// (bridge:build:<code>:<pull>, the overall Looks right / Needs changes that drives the "Design check"): this file keeps
// the parts the review mode adds.
//
//   - Asking for a measure: a read of the check (api/contribute, actions build-state and build-review) queues the build
//     when no measure of its head is kept: bridge:build:review:job:<code>#<pull> (BuildJob, JOB_KEEP_S) in the set
//     bridge:build:review:queue.
//   - The workflow (.github/workflows/private-shots.yml, scripts/private-shots.mjs builds, same OIDC identity as the
//     private shots): GET ?buildRun=todo (the queued builds with both preview templates from the team's
//     bridge.config.json), POST ?buildRun=image { code, pull, run, name, image } into Bridge's private Blob store at
//     BUILD_PREFIX<code>/<pull>/<run>/<name>.webp, POST ?buildRun=done { code, pull, run, head, summary }: the measure,
//     kept at bridge:build:review:<code>#<pull> (KEEP_S); the images of runs older than the last RUNS_KEPT go.
//   - What each person says per difference: bridge:build:items:<code>#<pull> (ItemWord[], the last MAX_ITEM_WORDS), per
//     round (roundOf: one more each time the developer pushes after someone asked for changes). A difference that did not
//     change keeps its signature (scripts/preview-shots.mjs regionSig): an earlier "Fine as built" carries over.
//   - Comments pinned on a difference: bridge:build:notes:<code>#<pull> (NoteThread[]), each posted to the developers'
//     task with its picture: a signed link to the crop (imageSig), the only way GitHub's image proxy can show a private
//     capture, readable by whoever can read that task.
// Readers: the same as the private shots (api/contribute team-read productReadAllowed), on both product repositories.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { json, type FetchLike } from './http.js';
import type { Redis } from './redis.js';
import { watchedCopies, type ShotStore } from './private-shots.js';
import type { BuildRole, BuildWord } from './build-check.js';

export const BUILD_PREFIX = 'private-build/';
export const KEEP_S = 90 * 24 * 3600;
export const JOB_KEEP_S = 3 * 24 * 3600;
/** Runs whose images stay (comments posted on the developers' task link to their crops). */
export const RUNS_KEPT = 4;
export const TODO_MAX = 6;
export const MAX_IMAGE_CHARS = 400_000;
export const MAX_ITEM_WORDS = 400;
export const MAX_THREADS = 120;
export const SIZES = ['laptop', 'small', 'phone'] as const;
export type SizeKey = (typeof SIZES)[number];
export const FACT_KINDS = ['text', 'date', 'added', 'missing', 'icon', 'order', 'size', 'height', 'outline', 'fill', 'color', 'weight', 'font', 'case', 'underline', 'border', 'space', 'radius', 'shadow'] as const;
const MISSING = ['wall', 'empty', 'not-found', 'error', 'too-large'] as const;
const API = 'https://api.github.com';
const REPO = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,79}$/;
const RUN = /^\d{10,16}$/;
const SIG = /^r[0-9a-f]{8}$/;
const ROUTE = /^\/[^\s<>"'\\]*$/;
const TOKEN_NAME = /^[a-z0-9][a-z0-9 ]{0,59}$/;
const BRANCH = /^[\w./-]{1,200}$/;

const pk = (code: string, pull: number) => `${code.toLowerCase()}#${pull}`;
export const QUEUE_KEY = 'bridge:build:review:queue';
export const jobKeyOf = (code: string, pull: number) => `bridge:build:review:job:${pk(code, pull)}`;
export const reviewKeyOf = (code: string, pull: number) => `bridge:build:review:${pk(code, pull)}`;
export const itemsKeyOf = (code: string, pull: number) => `bridge:build:items:${pk(code, pull)}`;
export const notesKeyOf = (code: string, pull: number) => `bridge:build:notes:${pk(code, pull)}`;
export const buildImagePath = (code: string, pull: number, run: string, name: string) => `${BUILD_PREFIX}${code.toLowerCase()}/${pull}/${run}/${name}.webp`;

export interface BuildCtx {
  f: FetchLike;
  now: () => number;
  redis: Redis;
  store: ShotStore | null;
  token: (owner: string, repo: string) => Promise<string | null>;
}

// --- Asking for a measure --------------------------------------------------------------------------------------------

/** A build to measure, as a read of its check queued it. */
export interface BuildJob {
  team: string;
  product: string;
  /** The design team's copy and the exploration's number in it. */
  copy: string;
  number: number;
  /** The developers' repository and their pull request. */
  code: string;
  pull: number;
  head: string;
  /** The screen the exploration chose (core Exploration.screen), else the route its own capture opened, else null. */
  route: string | null;
  approved: { branch: string; sha?: string };
  build: { branch: string };
  at: string;
}

/** What the workflow gets: the job with both preview templates and the run it writes under. */
export interface BuildTodo extends Omit<BuildJob, 'approved' | 'build'> {
  run: string;
  approved: { branch: string; sha?: string; template: string };
  build: { branch: string; template: string };
}

/** Queues a build for the workflow unless its head is measured or already queued. Never throws. */
export async function queueBuild(redis: Redis, job: BuildJob): Promise<boolean> {
  try {
    if (!REPO.test(job.code) || !REPO.test(job.copy) || !SHA.test(job.head) || !BRANCH.test(job.approved.branch) || !BRANCH.test(job.build.branch)) return false;
    const [kept, queued] = (await redis.pipe([
      ['GET', reviewKeyOf(job.code, job.pull)],
      ['GET', jobKeyOf(job.code, job.pull)],
    ])) as [unknown, unknown];
    const measured = parseReview(kept);
    if (measured?.head === job.head) return false;
    const was = parseJson<BuildJob>(queued);
    if (was?.head === job.head) return false;
    await redis.pipe([
      ['SET', jobKeyOf(job.code, job.pull), JSON.stringify(job), 'EX', JOB_KEEP_S],
      ['SADD', QUEUE_KEY, pk(job.code, job.pull)],
    ]);
    return true;
  } catch {
    return false;
  }
}

function parseJson<T>(raw: unknown): T | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? (v as T) : null;
  } catch {
    return null;
  }
}

async function gh(ctx: BuildCtx, token: string, path: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
  try {
    return await ctx.f(`${API}${path}`, { method: 'GET', headers: { Accept: accept, Authorization: `Bearer ${token}`, 'User-Agent': 'bridge-build-review', 'X-GitHub-Api-Version': '2022-11-28' } });
  } catch {
    return null;
  }
}

/** The preview templates of a team's product, from its bridge.config.json: the build's (preview), the design's (design.preview). */
export function templatesOf(config: unknown, code: string): { build: string; approved: string } | null {
  const products = (config as { products?: unknown[] } | null)?.products ?? [];
  for (const raw of Array.isArray(products) ? products : []) {
    const p = raw as { repo?: unknown; preview?: unknown; design?: { preview?: unknown } };
    if (typeof p?.repo !== 'string' || p.repo.toLowerCase() !== code.toLowerCase()) continue;
    const build = typeof p.preview === 'string' && /^https:\/\//.test(p.preview) ? p.preview : null;
    const approved = typeof p.design?.preview === 'string' && /^https:\/\//.test(p.design.preview) ? p.design.preview : null;
    return build && approved ? { build, approved } : null;
  }
  return null;
}

/** The queued builds of watched teams, with their templates, at most TODO_MAX. Jobs of a measured head leave the queue. */
export async function buildTodo(ctx: BuildCtx, force = false): Promise<BuildTodo[]> {
  const keys = ((await ctx.redis.cmd('SMEMBERS', QUEUE_KEY)) as string[] | null) ?? [];
  if (!keys.length) return [];
  const watched = new Set((await watchedCopies(ctx.redis)).filter((w) => w.kind === 'code').map((w) => w.repo));
  const jobs = (await ctx.redis.pipe(keys.map((k) => ['GET', `bridge:build:review:job:${k}`]))) as unknown[];
  const reviews = (await ctx.redis.pipe(keys.map((k) => ['GET', `bridge:build:review:${k}`]))) as unknown[];
  const configs = new Map<string, unknown>();
  const out: BuildTodo[] = [];
  const gone: string[] = [];
  for (const [i, k] of keys.entries()) {
    const job = parseJson<BuildJob>(jobs[i]);
    if (!job || !watched.has(job.code.toLowerCase())) {
      gone.push(k);
      continue;
    }
    if (!force && parseReview(reviews[i])?.head === job.head) {
      gone.push(k);
      continue;
    }
    if (out.length >= TODO_MAX) continue;
    if (!configs.has(job.team)) {
      const [o, r] = job.team.split('/') as [string, string];
      const token = REPO.test(job.team) ? await ctx.token(o, r) : null;
      const res = token ? await gh(ctx, token, `/repos/${o}/${r}/contents/bridge.config.json`, 'application/vnd.github.raw') : null;
      configs.set(job.team, res?.status === 200 ? await res.json().catch(() => null) : null);
    }
    const t = templatesOf(configs.get(job.team), job.code);
    if (!t) continue;
    out.push({ ...job, run: String(ctx.now() + out.length), approved: { ...job.approved, template: t.approved }, build: { ...job.build, template: t.build } });
  }
  if (gone.length) await ctx.redis.cmd('SREM', QUEUE_KEY, ...gone).catch(() => undefined);
  return out;
}

// --- What the workflow sends -----------------------------------------------------------------------------------------

export type Box = [number, number, number, number];

export interface BuildFact {
  k: (typeof FACT_KINDS)[number];
  label: string;
  was: string;
  now: string;
  n: number;
  /** A color's name in the product's library ("text default"), read on the page, when it is one. */
  wasName?: string;
  nowName?: string;
}

export interface BuildItem {
  n: number;
  sig: string;
  name: string;
  line: string;
  facts: BuildFact[];
  sizes: SizeKey[];
  boxes: Partial<Record<SizeKey, { a: Box | null; b: Box | null }>>;
  /** The crops of the item at its first size: each side's region, and the build's focus (the entry's tile). */
  crop: { size: SizeKey; a?: string; b?: string; f?: string };
}

export interface BuildShot {
  image: string;
  w: number;
  h: number;
  pageW: number;
  pageH: number;
}

export interface BuildSize {
  key: SizeKey;
  width: number;
  height: number;
  a: BuildShot | null;
  b: BuildShot | null;
  missing: { a?: (typeof MISSING)[number]; b?: (typeof MISSING)[number] };
}

/** The measure of one build, as Studio reads it. */
export interface BuildReview {
  run: string;
  head: string;
  approvedSha: string | null;
  measuredAt: string;
  route: string | null;
  /** The two pages measured, opened on the route: "Use the real build" and the approved design. */
  urls: { approved: string | null; build: string | null };
  sizes: BuildSize[];
  items: BuildItem[];
  ignored: number;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown, max = 100_000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
const boxOf = (v: unknown): Box | null => (Array.isArray(v) && v.length === 4 && v.every((x) => Number.isFinite(Number(x))) ? (v.map((x) => int(x, 20_000)) as Box) : null);
const httpsOf = (v: unknown): string | null => {
  const s = str(v, 500);
  try {
    return /^https:\/\//.test(s) && new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
};
const sizeOf = (v: unknown): SizeKey | null => (SIZES as readonly string[]).includes(String(v)) ? (v as SizeKey) : null;

function shotOf(v: unknown): BuildShot | null {
  const s = v as Record<string, unknown> | null;
  if (!s || !NAME.test(str(s.image))) return null;
  return { image: str(s.image), w: int(s.w, 4000), h: int(s.h, 8000), pageW: int(s.pageW, 4000), pageH: int(s.pageH, 8000) };
}

/** The summary as sent, kept only where well formed (the shapes scripts/preview-shots.mjs measureBuild writes). Pure. */
export function cleanBuildSummary(raw: unknown, o: { run: string; head: string; approvedSha?: unknown; now: number }): BuildReview | null {
  const v = raw as { sizes?: unknown; items?: unknown; route?: unknown; ignored?: unknown; urls?: { approved?: unknown; build?: unknown } } | null;
  if (!v || !Array.isArray(v.sizes) || !Array.isArray(v.items) || !RUN.test(o.run) || !SHA.test(o.head)) return null;
  const sizes: BuildSize[] = (v.sizes as Record<string, unknown>[]).slice(0, 3).flatMap((s) => {
    const key = sizeOf(s?.key);
    if (!key) return [];
    const m = (s.missing ?? {}) as Record<string, unknown>;
    const missing: BuildSize['missing'] = {};
    for (const side of ['a', 'b'] as const) if ((MISSING as readonly string[]).includes(String(m[side]))) missing[side] = m[side] as (typeof MISSING)[number];
    return [{ key, width: int(s.width, 4000), height: int(s.height, 4000), a: shotOf(s.a), b: shotOf(s.b), missing }];
  });
  const items: BuildItem[] = (v.items as Record<string, unknown>[]).slice(0, 24).flatMap((it, i) => {
    const sig = str(it?.sig);
    if (!SIG.test(sig)) return [];
    const facts = (Array.isArray(it.facts) ? (it.facts as Record<string, unknown>[]) : []).slice(0, 8).flatMap((f) =>
      (FACT_KINDS as readonly string[]).includes(String(f?.k)) ? [{ k: f.k as BuildFact['k'], label: str(f.label, 40), was: str(f.was, 160), now: str(f.now, 160), n: Math.max(1, int(f.n, 999)), ...(TOKEN_NAME.test(str(f.wasName, 60)) ? { wasName: str(f.wasName, 60) } : {}), ...(TOKEN_NAME.test(str(f.nowName, 60)) ? { nowName: str(f.nowName, 60) } : {}) }] : [],
    );
    const itemSizes = (Array.isArray(it.sizes) ? it.sizes : []).map(sizeOf).filter((x): x is SizeKey => Boolean(x));
    if (!itemSizes.length) return [];
    const boxes: BuildItem['boxes'] = {};
    const rb = (it.boxes ?? {}) as Record<string, { a?: unknown; b?: unknown }>;
    for (const s of itemSizes) boxes[s] = { a: boxOf(rb[s]?.a), b: boxOf(rb[s]?.b) };
    const c = (it.crop ?? {}) as Record<string, unknown>;
    const crop: BuildItem['crop'] = { size: sizeOf(c.size) ?? itemSizes[0]! };
    if (NAME.test(str(c.a))) crop.a = str(c.a);
    if (NAME.test(str(c.b))) crop.b = str(c.b);
    if (NAME.test(str(c.f))) crop.f = str(c.f);
    return [{ n: int(it.n, 99) || i + 1, sig, name: str(it.name, 60) || 'Section', line: str(it.line, 200), facts, sizes: itemSizes, boxes, crop }];
  });
  const route = str(v.route, 300);
  return {
    run: o.run,
    head: o.head,
    approvedSha: typeof o.approvedSha === 'string' && SHA.test(o.approvedSha) ? o.approvedSha : null,
    measuredAt: new Date(o.now).toISOString(),
    route: ROUTE.test(route) ? route : null,
    urls: { approved: httpsOf(v.urls?.approved), build: httpsOf(v.urls?.build) },
    sizes,
    items,
    ignored: int(v.ignored, 100_000),
  };
}

export function parseReview(raw: unknown): BuildReview | null {
  const v = parseJson<BuildReview>(raw);
  return v && Array.isArray(v.items) && Array.isArray(v.sizes) && typeof v.head === 'string' ? v : null;
}

export async function readBuildReview(redis: Redis, code: string, pull: number): Promise<BuildReview | null> {
  return parseReview(await redis.cmd('GET', reviewKeyOf(code, pull)));
}

/** The names of the images a measure shows (the pages and the crops). */
export function imagesOf(r: BuildReview): Set<string> {
  const out = new Set<string>();
  for (const s of r.sizes) for (const side of [s.a, s.b]) if (side) out.add(side.image);
  for (const it of r.items) for (const n of [it.crop.a, it.crop.b, it.crop.f]) if (n) out.add(n);
  return out;
}

const isWebp = (b64: string) => /^[A-Za-z0-9+/]+={0,2}$/.test(b64) && Buffer.from(b64.slice(0, 32), 'base64').subarray(8, 12).equals(Buffer.from('WEBP'));

async function queuedJob(redis: Redis, code: string, pull: number): Promise<BuildJob | null> {
  return parseJson<BuildJob>(await redis.cmd('GET', jobKeyOf(code, pull)));
}

/** One image of a run, for a queued build. */
export async function putBuildImage(ctx: BuildCtx, body: Record<string, unknown>): Promise<Response> {
  const code = str(body.code).toLowerCase();
  const pull = Number(body.pull);
  const run = str(body.run);
  const name = str(body.name);
  const image = typeof body.image === 'string' ? body.image : '';
  if (!REPO.test(code) || !Number.isSafeInteger(pull) || pull < 1 || !RUN.test(run) || !NAME.test(name)) return json(400, { error: 'bad_request', message: 'Say which build, run and image name.' });
  if (!image || image.length > MAX_IMAGE_CHARS || !isWebp(image)) return json(400, { error: 'bad_image', message: 'Send a webp image, base64, under 300 KB.' });
  if (!ctx.store) return json(503, { error: 'not_configured', message: 'Bridge has no screenshot storage yet.' });
  if (!(await queuedJob(ctx.redis, code, pull))) return json(403, { error: 'not-allowed', message: 'Bridge did not ask for this build.' });
  await ctx.store.put(buildImagePath(code, pull, run, name), Buffer.from(image, 'base64'));
  return json(200, { ok: true });
}

/** The measure of a run: kept, the job leaves the queue when it measured the head it asked for, old runs' images go. */
export async function putBuildSummary(ctx: BuildCtx, body: Record<string, unknown>): Promise<Response> {
  const code = str(body.code).toLowerCase();
  const pull = Number(body.pull);
  const run = str(body.run);
  const head = str(body.head);
  if (!REPO.test(code) || !Number.isSafeInteger(pull) || pull < 1 || !RUN.test(run) || !SHA.test(head)) return json(400, { error: 'bad_request', message: 'Say which build, run and head.' });
  const job = await queuedJob(ctx.redis, code, pull);
  if (!job) return json(403, { error: 'not-allowed', message: 'Bridge did not ask for this build.' });
  const review = cleanBuildSummary(body.summary, { run, head, approvedSha: body.approvedSha, now: ctx.now() });
  if (!review) return json(400, { error: 'bad_summary', message: 'Send the summary the robot wrote.' });
  await ctx.redis.cmd('SET', reviewKeyOf(code, pull), JSON.stringify(review), 'EX', KEEP_S);
  if (job.head === head) await ctx.redis.pipe([['DEL', jobKeyOf(code, pull)], ['SREM', QUEUE_KEY, pk(code, pull)]]).catch(() => undefined);
  if (ctx.store) {
    const prefix = `${BUILD_PREFIX}${code}/${pull}/`;
    const blobs = await ctx.store.list(prefix).catch(() => []);
    const runs = [...new Set(blobs.map((b) => b.pathname.slice(prefix.length).split('/')[0]!))].filter((r) => RUN.test(r)).sort();
    const drop = new Set(runs.slice(0, Math.max(0, runs.length - RUNS_KEPT)));
    const old = blobs.filter((b) => drop.has(b.pathname.slice(prefix.length).split('/')[0]!)).map((b) => b.pathname);
    for (let i = 0; i < old.length; i += 100) await ctx.store.del(old.slice(i, i + 100)).catch(() => undefined);
  }
  return json(200, { ok: true, items: review.items.length });
}

export async function buildImageBytes(store: ShotStore | null, code: string, pull: number, run: string, name: string): Promise<Uint8Array | null> {
  if (!store || !RUN.test(run) || !NAME.test(name) || !REPO.test(code)) return null;
  return store.get(buildImagePath(code, pull, run, name)).catch(() => null);
}

/** The signature of one image's address (a crop posted on the developers' task): HMAC of where it lives. */
export function imageSig(secret: string, code: string, pull: number, run: string, name: string): string {
  return createHmac('sha256', secret).update(`build-image:${buildImagePath(code, pull, run, name)}`).digest('base64url').slice(0, 32);
}

export function imageSigOk(secret: string, code: string, pull: number, run: string, name: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || sig.length !== 32) return false;
  const want = Buffer.from(imageSig(secret, code, pull, run, name));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** A crop's address anyone holding it can open: what a comment on the developers' task shows. */
export function signedImageUrl(origin: string, secret: string, code: string, pull: number, run: string, name: string): string {
  const q = new URLSearchParams({ buildImage: '1', code, pull: String(pull), run, name, sig: imageSig(secret, code, pull, run, name) });
  return `${origin.replace(/\/$/, '')}/api/contribute?${q}`;
}

// --- Rounds and what each person says per difference ------------------------------------------------------------------

/**
 * The round of a build check: 1, then one more for each earlier head someone asked for changes on (the developer pushed
 * after it). Pure.
 */
export function roundOf(words: readonly BuildWord[], head: string): number {
  return 1 + new Set(words.filter((w) => w.kind === 'changes' && w.sha !== head).map((w) => w.sha)).size;
}

export type ItemVerdict = 'fine' | 'fix';

export interface ItemWord {
  sig: string;
  n: number;
  name: string;
  round: number;
  role: BuildRole;
  by?: string;
  byName: string;
  verdict: ItemVerdict;
  at: string;
}

export async function itemWordsOf(redis: Redis, code: string, pull: number): Promise<ItemWord[]> {
  const v = parseJson<{ words?: unknown }>(await redis.cmd('GET', itemsKeyOf(code, pull)));
  return Array.isArray(v?.words) ? (v.words as ItemWord[]).filter((w) => w && SIG.test(String(w.sig)) && (w.verdict === 'fine' || w.verdict === 'fix')) : [];
}

/** The words with this one: it replaces the same role's word on the same difference in the same round. Pure. */
export function withItemWord(words: readonly ItemWord[], w: ItemWord): ItemWord[] {
  return [...words.filter((x) => !(x.sig === w.sig && x.round === w.round && x.role === w.role)), w].slice(-MAX_ITEM_WORDS);
}

/** The words without one role's word on a difference this round (they took it back). Pure. */
export function withoutItemWord(words: readonly ItemWord[], x: { sig: string; round: number; role: BuildRole }): ItemWord[] {
  return words.filter((w) => !(w.sig === x.sig && w.round === x.round && w.role === x.role));
}

export async function saveItemWords(redis: Redis, code: string, pull: number, words: ItemWord[]): Promise<void> {
  await redis.cmd('SET', itemsKeyOf(code, pull), JSON.stringify({ words }), 'EX', KEEP_S);
}

// --- The handover notes ticked as found in the build ------------------------------------------------------------------
// bridge:build:ticks:<code>#<pull> (HandoverTick[]): one list for the check (whoever answers it ticks for everyone), per
// round like the words per difference: a new round starts with nothing ticked. Written through build-item ({ handover,
// found }), next to the words per difference.

export const MAX_TICKS = 400;
const TICK_KEY = /^h[0-9a-f]{8}$/;
export const ticksKeyOf = (code: string, pull: number) => `bridge:build:ticks:${pk(code, pull)}`;

export interface HandoverTick {
  key: string;
  round: number;
  role: BuildRole;
  by?: string;
  byName: string;
  at: string;
}

export const isTickKey = (k: unknown): k is string => typeof k === 'string' && TICK_KEY.test(k);

export async function ticksOf(redis: Redis, code: string, pull: number): Promise<HandoverTick[]> {
  const v = parseJson<{ ticks?: unknown }>(await redis.cmd('GET', ticksKeyOf(code, pull)));
  return Array.isArray(v?.ticks) ? (v.ticks as HandoverTick[]).filter((t) => t && isTickKey(t.key) && Number.isSafeInteger(t.round)) : [];
}

/** The ticks with one note found (or not any more) this round: one tick per note per round, whoever ticked it. Pure. */
export function withTick(ticks: readonly HandoverTick[], t: HandoverTick, found: boolean): HandoverTick[] {
  const rest = ticks.filter((x) => !(x.key === t.key && x.round === t.round));
  return (found ? [...rest, t] : rest).slice(-MAX_TICKS);
}

/** The ticks of this round, as the page reads them. Pure. */
export function ticksIn(ticks: readonly HandoverTick[], round: number): { key: string; byName: string; role: BuildRole; at: string }[] {
  return ticks.filter((t) => t.round === round).map((t) => ({ key: t.key, byName: t.byName, role: t.role, at: t.at }));
}

export async function saveTicks(redis: Redis, code: string, pull: number, ticks: HandoverTick[]): Promise<void> {
  await redis.cmd('SET', ticksKeyOf(code, pull), JSON.stringify({ ticks }), 'EX', KEEP_S);
}

/** Where one difference stands for one person this round. */
export interface ItemState {
  sig: string;
  /** Their word this round. */
  mine: ItemVerdict | null;
  /** Fine as built in an earlier round, and the difference did not change since: it stays approved. */
  carried: boolean;
  /** Someone asked to fix this very difference in an earlier round: still there. */
  askedBefore: boolean;
  /** Everyone else's word this round. */
  others: { role: BuildRole; byName: string; verdict: ItemVerdict; at: string }[];
}

/**
 * Each difference of the measure, for `role` in `round`: their word, what carries over from earlier rounds, the others'
 * words. And the differences asked to fix in an earlier round that the build no longer shows ("fixed"). Pure (tested).
 */
export function itemStates(items: readonly Pick<BuildItem, 'sig'>[], words: readonly ItemWord[], round: number, role: BuildRole | null): { items: ItemState[]; fixed: { sig: string; name: string }[] } {
  const now = new Set(items.map((i) => i.sig));
  const states = items.map((it) => {
    const here = words.filter((w) => w.sig === it.sig);
    const mine = role ? (here.find((w) => w.round === round && w.role === role)?.verdict ?? null) : null;
    const earlier = here.filter((w) => w.round < round);
    const carried = !mine && Boolean(role) && earlier.some((w) => w.role === role && w.verdict === 'fine') && !earlier.some((w) => w.verdict === 'fix');
    return {
      sig: it.sig,
      mine,
      carried,
      askedBefore: earlier.some((w) => w.verdict === 'fix'),
      others: here.filter((w) => w.round === round && w.role !== role).map((w) => ({ role: w.role, byName: w.byName, verdict: w.verdict, at: w.at })),
    };
  });
  const fixedSigs = new Map<string, string>();
  for (const w of words) if (w.round < round && w.verdict === 'fix' && !now.has(w.sig)) fixedSigs.set(w.sig, w.name);
  return { items: states, fixed: [...fixedSigs].map(([sig, name]) => ({ sig, name })) };
}

// --- Comments pinned on a difference ----------------------------------------------------------------------------------

export interface NoteReply {
  by?: string;
  byName: string;
  role: BuildRole;
  text: string;
  at: string;
}

export interface NoteThread {
  id: string;
  sig: string;
  n: number;
  name: string;
  size: SizeKey;
  /** The picture it is pinned on: the build (b) or the approved design (a). */
  side: 'a' | 'b';
  /** Where on the difference's crop, from its top left, 0 to 1. */
  x: number;
  y: number;
  by?: string;
  byName: string;
  role: BuildRole;
  text: string;
  at: string;
  round: number;
  /** The crop it shows on the developers' task: the run and the image name. */
  run: string;
  image: string | null;
  resolved: { byName: string; at: string } | null;
  replies: NoteReply[];
}

export type NoteOp =
  | { op: 'add'; id: string; sig: string; n: number; name: string; size: SizeKey; side: 'a' | 'b'; x: number; y: number; text: string; round: number; run: string; image: string | null }
  | { op: 'reply'; id: string; text: string }
  | { op: 'resolve'; id: string; resolved: boolean };

/** Reads a note operation from a request body, or a sentence that says what is wrong. Pure. */
export function noteOpOf(body: Record<string, unknown>, review: BuildReview | null, round: number, newId: string): NoteOp | string {
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  const id = str(body.id, 40);
  if (body.op === 'reply' || body.op === 'resolve') {
    if (!/^n[0-9a-z]{6,24}$/.test(id)) return 'Say which comment.';
    if (body.op === 'reply') return text ? { op: 'reply', id, text } : 'Write your answer first.';
    return { op: 'resolve', id, resolved: body.resolved !== false };
  }
  if (body.op !== 'add') return 'Unknown comment action.';
  if (!text) return 'Write your comment first.';
  const it = review?.items.find((i) => i.sig === body.sig);
  if (!review || !it) return 'This difference is not in the last check any more. Reload the page.';
  const size = sizeOf(body.size) ?? it.crop.size;
  const side = body.side === 'a' ? 'a' : 'b';
  const clamp = (v: unknown) => Math.min(1, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0.5));
  return { op: 'add', id: newId, sig: it.sig, n: it.n, name: it.name, size, side, x: clamp(body.x), y: clamp(body.y), text, round, run: review.run, image: (side === 'a' ? it.crop.a : it.crop.b) ?? null };
}

/** The threads after one operation by `who`, or null when the operation names no thread. Pure. */
export function applyNote(threads: readonly NoteThread[], op: NoteOp, who: { by?: string; byName: string; role: BuildRole }, at: string): NoteThread[] | null {
  if (op.op === 'add') {
    const t: NoteThread = { id: op.id, sig: op.sig, n: op.n, name: op.name, size: op.size, side: op.side, x: op.x, y: op.y, ...(who.by ? { by: who.by } : {}), byName: who.byName, role: who.role, text: op.text, at, round: op.round, run: op.run, image: op.image, resolved: null, replies: [] };
    return [...threads, t].slice(-MAX_THREADS);
  }
  const i = threads.findIndex((t) => t.id === op.id);
  if (i < 0) return null;
  const t = threads[i]!;
  const next: NoteThread =
    op.op === 'reply'
      ? { ...t, replies: [...t.replies, { ...(who.by ? { by: who.by } : {}), byName: who.byName, role: who.role, text: op.text, at }].slice(-50) }
      : { ...t, resolved: op.resolved ? { byName: who.byName, at } : null };
  return threads.map((x, j) => (j === i ? next : x));
}

export async function notesOf(redis: Redis, code: string, pull: number): Promise<NoteThread[]> {
  const v = parseJson<{ threads?: unknown }>(await redis.cmd('GET', notesKeyOf(code, pull)));
  return Array.isArray(v?.threads) ? (v.threads as NoteThread[]).filter((t) => t && typeof t.id === 'string' && Array.isArray(t.replies)) : [];
}

export async function saveNotes(redis: Redis, code: string, pull: number, threads: NoteThread[]): Promise<void> {
  await redis.cmd('SET', notesKeyOf(code, pull), JSON.stringify({ threads }), 'EX', KEEP_S);
}

// --- What the developers read on their task ----------------------------------------------------------------------------

const PART: Record<BuildRole, string> = { designer: 'designer', pm: 'product manager', lead: 'design lead' };
const SIZE_WORD: Record<SizeKey, string> = { laptop: 'laptop', small: 'small laptop', phone: 'phone' };
/** Markdown text of a person's words, kept as words: no heading, no link, no picture, no mention of someone. */
export const plainText = (t: string) => t.replace(/[<>]/g, '').replace(/@(?=\w)/g, '@\u200b').replace(/!\[/g, '[').replace(/^#+\s*/gm, '');
const quote = (t: string) =>
  plainText(t)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');

/** A comment pinned on a difference, as posted on the developers' task: the words, the picture, where to answer. */
export function noteComment(t: Pick<NoteThread, 'byName' | 'role' | 'text' | 'n' | 'name' | 'size' | 'side'>, o: { image: string | null; link: string; reply?: boolean }): string {
  const where = `${t.n}. ${plainText(t.name)}, ${SIZE_WORD[t.size]}${t.side === 'a' ? ', on the approved design' : ''}`;
  const head = o.reply ? `${plainText(t.byName)} (${PART[t.role]}) answered on ${where}:` : `${plainText(t.byName)} (${PART[t.role]}) commented on ${where}:`;
  return [head, '', quote(t.text), ...(o.image ? ['', `![${plainText(t.name)}](${o.image})`] : []), '', `[Answer in Bridge](${o.link})`].join('\n');
}

/** "Needs changes": the things to fix, in one comment on the developers' task, each with its picture. */
export function fixesComment(o: { byName: string; role: BuildRole; round: number; fixes: { n: number; name: string; line: string; facts: BuildFact[]; image: string | null }[]; note: string; kept: number; link: string }): string {
  const lines = [`${plainText(o.byName)} (${PART[o.role]}) checked the build, round ${o.round}: ${o.fixes.length === 1 ? '1 thing' : `${o.fixes.length} things`} to fix.`, ''];
  for (const f of o.fixes) {
    lines.push(`**${f.n}. ${plainText(f.name)}**: ${plainText(f.line)}`);
    for (const x of f.facts.slice(0, 4)) {
      const was = x.wasName ? `${x.wasName} (${x.was})` : x.was;
      const now = x.nowName ? `${x.nowName} (${x.now})` : x.now;
      lines.push(`- ${plainText(x.label)}: ${was ? `${plainText(was)} → ` : ''}${plainText(now || 'none')}`);
    }
    if (f.image) lines.push('', `![${plainText(f.name)}](${f.image})`);
    lines.push('');
  }
  if (o.note.trim()) lines.push(quote(o.note.trim()), '');
  if (o.kept > 0) lines.push(`${o.kept === 1 ? 'The other difference stays' : `The other ${o.kept} differences stay`} approved in the next round.`, '');
  lines.push(`[Open the check in Bridge](${o.link})`);
  return lines.join('\n');
}

// --- The handover notes, read only -----------------------------------------------------------------------------------

/** The decisions and edge cases of an exploration's note file (core parseExplorationNotes, the parts the check shows). Pure. */
export function handoverOf(md: string | null): { decisions: string[]; edgeCases: { component: string; state: string; covered: boolean }[] } {
  const out = { decisions: [] as string[], edgeCases: [] as { component: string; state: string; covered: boolean }[] };
  if (!md) return out;
  let section = '';
  let component = 'General';
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      section = h2[1]!.trim().toLowerCase();
      component = 'General';
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      component = h3[1]!.trim().slice(0, 60);
      continue;
    }
    const item = /^\s*[-*]\s+(\[( |x|X)\]\s+)?(.+)$/.exec(line);
    if (!item) continue;
    if (/^decisions?( made)?$/.test(section) && out.decisions.length < 20) out.decisions.push(item[3]!.trim().slice(0, 300));
    else if (/^(edge[ -]cases?|states)$/.test(section) && out.edgeCases.length < 30) out.edgeCases.push({ component, state: item[3]!.trim().slice(0, 300), covered: (item[2] ?? '').toLowerCase() === 'x' });
  }
  return out;
}
