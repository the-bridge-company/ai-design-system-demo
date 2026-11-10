// Who gets it, measured for private products (api/_lib/private-reach.ts): only Bridge's own workflow asks which teams
// to measure and sends the measurement; only readers of the team read it, and only for products they may read.
import { generateKeyPairSync, createSign } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRedis } from '../../api/_lib/redis';
import { watchWrites } from '../../api/_lib/notify';
import { clearJwks, memoryShotStore, AUDIENCE, ISSUER, SHOTS_REPOSITORY, type ShotsCtx } from '../../api/_lib/private-shots';
import { cleanSummary, productOfImage, putReachImage, putReachSummary, reachImagePath, reachIsDue, reachTodo, readReach, summaryFor, MAX_AGE_MS, type ReachSummary } from '../../api/_lib/private-reach';
import { handleContribute, type ContribDeps } from '../../api/contribute/index';
import { clearReadMemory } from '../../api/_lib/team-read';

const T0 = Date.parse('2026-11-10T10:00:00Z');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'k1', kty: 'RSA' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(claims: Record<string, unknown> = {}) {
  const head = b64({ alg: 'RS256', kid: 'k1' });
  const body = b64({ iss: ISSUER, aud: AUDIENCE, repository: SHOTS_REPOSITORY, ref: 'refs/heads/main', exp: Math.floor(T0 / 1000) + 300, ...claims });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `Bearer ${head}.${body}.${sig}`;
}
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(40)]).toString('base64');
const TEAM = 'acme-design-demo/bridge-demo-ds';
const COPY = 'acme-design-demo/acme-prints-design';
const CODE = 'acme-design-demo/acme-prints';
const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const CONFIG = JSON.stringify({
  tokens: { root: 'packages/tokens/src' },
  modes: { theme: { values: ['light', 'dark'], default: 'light' } },
  products: [
    { key: 'library', name: 'Library', default: true },
    { key: 'prints', name: 'Acme Prints', repo: CODE, production: 'https://acme-prints.pages.dev', design: { repo: COPY, preview: 'https://{branch}.acme-prints-design.pages.dev' } },
  ],
});
const TOKENS = (hex: string) => JSON.stringify({ color: { harbor: { 700: { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], hex } } } } });

function world() {
  const redis = memoryRedis(() => T0);
  let calls = 0;
  const f: ContribDeps['fetch'] = async (url) => {
    const u = new URL(url);
    if (u.hostname === 'api.github.com') calls++;
    if (u.href === `${ISSUER}/.well-known/jwks`) return Response.json({ keys: [jwk] });
    if (u.pathname === `/repos/${TEAM}/contents/bridge.config.json`) return new Response(CONFIG, { status: 200 });
    if (u.pathname === `/repos/${TEAM}/pulls`)
      return Response.json([
        { number: 13, title: 'Deepen the primary blue', head: { sha: SHA, ref: 'bridge/deepen' }, base: { sha: BASE }, labels: [] },
        { number: 2, title: 'Exploration', head: { sha: SHA, ref: 'explore/x' }, base: { sha: BASE }, labels: [{ name: 'exploration' }] },
        { number: 62, title: 'New ProfileHeader', head: { sha: 'c'.repeat(40), ref: 'agent/x' }, base: { sha: BASE }, labels: [] },
      ]);
    if (u.pathname === `/repos/${TEAM}/pulls/13/files`) return Response.json([{ filename: 'packages/tokens/src/primitives/color.tokens.json', status: 'modified' }, { filename: '.changeset/a.md', status: 'added' }]);
    if (u.pathname === `/repos/${TEAM}/pulls/62/files`) return Response.json([{ filename: 'packages/react/src/components/ProfileHeader/ProfileHeader.tsx', status: 'added' }]);
    if (u.pathname === `/repos/${TEAM}/contents/packages/tokens/src/primitives/color.tokens.json`) return new Response(TOKENS(u.searchParams.get('ref') === SHA ? '#0a4380' : '#0b4a8b'), { status: 200 });
    if (u.pathname === `/repos/${TEAM}`) return Response.json({ private: false });
    return Response.json({ message: 'Not Found' }, { status: 404 });
  };
  const store = memoryShotStore();
  const ctx: ShotsCtx = { f, now: () => T0, redis, store, token: async () => 'ghs_x' };
  return { redis, f, ctx, store, calls: () => calls };
}

const watch = (redis: ReturnType<typeof memoryRedis>) => redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'prints' } }]));

const SUMMARY = {
  version: 1,
  measuredAt: '2026-11-10T10:00:00Z',
  products: [{ key: 'prints', name: 'Acme Prints', repo: CODE, url: 'https://acme-prints.pages.dev', screens: [{ id: 'prints-0', route: '/?tenant=acme', title: 'Dashboard', image: 's-prints-0' }] }],
  changes: [
    { repo: TEAM, pr: 13, sha: SHA, title: 'Deepen', state: 'measured', theme: 'light', values: 1, screens: [{ id: 'prints-0', before: 's-prints-0', after: 'c13-prints-0-a', elements: { buttons: 2, links: 1 } }] },
    { repo: TEAM, pr: 14, sha: SHA, title: 'Evil', state: 'measured', screens: [{ id: 'nope', before: '../x', after: 'c14-a', elements: {} }] },
  ],
};

beforeEach(() => {
  clearJwks();
  clearReadMemory();
});

describe('who gets it, private: what to measure', () => {
  it('lists a watched team with its products and the changes that touch token files, with those files before and after', async () => {
    const w = world();
    await watch(w.redis);
    const [job, ...rest] = await reachTodo(w.ctx);
    expect(rest).toEqual([]);
    expect(job).toMatchObject({ team: TEAM, run: String(T0), products: [{ key: 'prints', repo: CODE, url: 'https://acme-prints.pages.dev', template: null }] });
    expect(job!.changes.map((c) => c.pr)).toEqual([13]);
    expect(job!.changes[0]!.files).toEqual([{ path: 'packages/tokens/src/primitives/color.tokens.json', before: TOKENS('#0b4a8b'), after: TOKENS('#0a4380') }]);
  });

  it('measures again only when due, and reads the files of a commit once', async () => {
    const w = world();
    await watch(w.redis);
    const [job] = await reachTodo(w.ctx);
    expect((await putReachSummary(w.ctx, { team: TEAM, run: job!.run, summary: { ...SUMMARY, changes: [SUMMARY.changes[0]] } })).status).toBe(200);
    const before = w.calls();
    expect(await reachTodo(w.ctx)).toEqual([]);
    // Config, pull requests: the files of #13 and #62 come from the cache.
    expect(w.calls() - before).toBe(2);
    expect(await reachTodo(w.ctx, true)).toHaveLength(1);
    const stored = (await readReach(w.redis, TEAM))!;
    const products = [{ key: 'prints', name: 'Acme Prints', repo: CODE, url: null, template: null, branch: 'main' }];
    expect(reachIsDue(stored, products, [{ repo: TEAM, pr: 13, sha: SHA }], T0 + MAX_AGE_MS + 1)).toBe(true);
    expect(reachIsDue(stored, products, [{ repo: TEAM, pr: 13, sha: 'd'.repeat(40) }], T0)).toBe(true);
  });
});

describe('who gets it, private: what is kept', () => {
  it('keeps webp images of a watched team only, and the summary in the shapes the robot writes', async () => {
    const w = world();
    expect((await putReachImage(w.ctx, { team: TEAM, run: String(T0), name: 's-prints-0', image: WEBP })).status).toBe(403);
    await watch(w.redis);
    expect((await putReachImage(w.ctx, { team: TEAM, run: String(T0), name: 's-prints-0', image: WEBP })).status).toBe(200);
    expect((await putReachImage(w.ctx, { team: TEAM, run: String(T0), name: '../x', image: WEBP })).status).toBe(400);
    expect((await putReachImage(w.ctx, { team: TEAM, run: String(T0), name: 's-x', image: Buffer.from('<svg/>').toString('base64') })).status).toBe(400);
    expect(w.store.items.has(reachImagePath(TEAM, String(T0), 's-prints-0'))).toBe(true);
    const clean = cleanSummary(SUMMARY, String(T0), T0)!;
    // A screen of no product and names outside the robot's shape are dropped.
    expect(clean.changes.map((c) => [c.pr, c.screens.length])).toEqual([
      [13, 1],
      [14, 0],
    ]);
    expect(clean.changes[0]!.screens[0]!.elements).toEqual({ buttons: 2, links: 1, fields: 0, text: 0, surfaces: 0 });
  });

  it('a new run replaces the last one and lets its images go', async () => {
    const w = world();
    await watch(w.redis);
    await putReachImage(w.ctx, { team: TEAM, run: '1700000000000', name: 's-prints-0', image: WEBP });
    await putReachImage(w.ctx, { team: TEAM, run: String(T0), name: 's-prints-0', image: WEBP });
    await putReachSummary(w.ctx, { team: TEAM, run: String(T0), summary: SUMMARY });
    expect([...w.store.items.keys()]).toEqual([reachImagePath(TEAM, String(T0), 's-prints-0')]);
    expect((await readReach(w.redis, TEAM))?.run).toBe(String(T0));
  });

  it('knows which product each image shows, and keeps only the products a reader may read', () => {
    const s = cleanSummary(SUMMARY, String(T0), T0) as ReachSummary;
    expect(productOfImage(s, 'c13-prints-0-a')?.key).toBe('prints');
    expect(productOfImage(s, 's-prints-0')?.key).toBe('prints');
    expect(productOfImage(s, 'c99-x')).toBeNull();
    expect(summaryFor(s, new Set()).changes[0]!.screens).toEqual([]);
  });
});

describe('who gets it, private: through api/contribute', () => {
  const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
  const deps = (w: ReturnType<typeof world>): ContribDeps => ({ fetch: w.f, now: () => T0, redis: w.redis, shots: w.store, app: { installationToken: async () => 'ghs_x' } });
  const req = (q: string, init: RequestInit = {}) => new Request(`https://bridge.example.com/api/contribute?${q}`, { ...init, headers: { host: 'bridge.example.com', ...(init.headers ?? {}) } });

  it('the workflow needs its OIDC token; a demo visitor reads the measurement and its images', async () => {
    const w = world();
    await watch(w.redis);
    expect((await handleContribute(req('reachRun=todo'), ENV, deps(w))).status).toBe(401);
    const todo = await handleContribute(req('reachRun=todo', { headers: { authorization: jwt() } }), ENV, deps(w));
    const { jobs } = (await todo.json()) as { jobs: { run: string }[] };
    expect(jobs).toHaveLength(1);
    const post = (action: string, body: unknown) => handleContribute(req(`reachRun=${action}`, { method: 'POST', headers: { authorization: jwt(), 'content-type': 'application/json' }, body: JSON.stringify(body) }), ENV, deps(w));
    expect((await post('image', { team: TEAM, run: jobs[0]!.run, name: 'c13-prints-0-a', image: WEBP })).status).toBe(200);
    expect((await post('done', { team: TEAM, run: jobs[0]!.run, summary: SUMMARY })).status).toBe(200);
    const read = await handleContribute(req(`repo=${TEAM}&reach=summary`), ENV, deps(w));
    const { reach } = (await read.json()) as { reach: ReachSummary };
    expect(reach.products.map((p) => p.key)).toEqual(['prints']);
    expect(reach.changes[0]!.screens).toHaveLength(1);
    const img = await handleContribute(req(`repo=${TEAM}&reach=image&run=${jobs[0]!.run}&name=c13-prints-0-a`), ENV, deps(w));
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/webp');
    expect(img.headers.get('cache-control')).toContain('private');
    // An image the summary does not name, and a team that is not a demo for a visitor.
    expect((await handleContribute(req(`repo=${TEAM}&reach=image&run=${jobs[0]!.run}&name=c99-x`), ENV, deps(w))).status).toBe(404);
    expect((await handleContribute(req(`repo=acme/design&reach=summary`), ENV, deps(w))).status).toBe(401);
  });
});
