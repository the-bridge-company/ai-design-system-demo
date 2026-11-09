// Screenshots of private products' explorations (api/_lib/private-shots.ts): only Bridge's own workflow (its GitHub
// OIDC token) asks what to capture and sends captures; only readers of the team (members, demo visitors) read them.
import { generateKeyPairSync, createSign } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRedis } from '../../api/_lib/redis';
import { watchWrites } from '../../api/_lib/notify';
import { clearJwks, clearShotMemory, fileHints, memoryShotStore, migrateShots, putShot, shotImage, shotKeyOf, shotMeta, shotPathOf, shotsTodo, workflowClaims, AUDIENCE, ISSUER, KEEP_S, SHOTS_PREFIX, SHOTS_REPOSITORY, type ShotsCtx } from '../../api/_lib/private-shots';
import { handleContribute, type ContribDeps } from '../../api/contribute/index';
import { clearReadMemory } from '../../api/_lib/team-read';

const T0 = Date.parse('2026-11-07T10:00:00Z');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'k1', kty: 'RSA' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(claims: Record<string, unknown>, kid = 'k1') {
  const head = b64({ alg: 'RS256', kid });
  const body = b64({ iss: ISSUER, aud: AUDIENCE, repository: SHOTS_REPOSITORY, ref: 'refs/heads/main', exp: Math.floor(T0 / 1000) + 300, ...claims });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `Bearer ${head}.${body}.${sig}`;
}
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(40)]).toString('base64');
const TEAM = 'acme-design-demo/bridge-demo-ds';
const COPY = 'acme-design-demo/acme-account-design';
const CODE = 'acme-design-demo/acme-account';
const CONFIG = JSON.stringify({ products: [{ key: 'account', name: 'Account', repo: CODE, preview: 'https://{branch}.acme-account.pages.dev', design: { repo: COPY, preview: 'https://{branch}.acme-account-design.pages.dev' } }] });
const SHA = 'a'.repeat(40);

function world() {
  const redis = memoryRedis(() => T0);
  const f: ContribDeps['fetch'] = async (url) => {
    const u = new URL(url);
    if (u.href === `${ISSUER}/.well-known/jwks`) return Response.json({ keys: [jwk] });
    if (u.pathname === `/repos/${TEAM}/contents/bridge.config.json`) return new Response(CONFIG, { status: 200 });
    if (u.pathname === `/repos/${COPY}/pulls`) return Response.json([{ number: 1, head: { sha: SHA, ref: 'explore/team' } }, { number: 2, head: { sha: 'b'.repeat(40), ref: 'explore/profile' } }]);
    if (u.pathname === `/repos/${CODE}/pulls`) return Response.json([{ number: 3, head: { sha: 'c'.repeat(40), ref: 'build/invoice' } }, { number: 4, draft: true, head: { sha: 'd'.repeat(40), ref: 'build/wip' } }]);
    if (u.pathname === `/repos/${TEAM}`) return Response.json({ private: false });
    return Response.json({ message: 'Not Found' }, { status: 404 });
  };
  const store = memoryShotStore();
  const ctx: ShotsCtx = { f, now: () => T0, redis, store, token: async () => 'ghs_x' };
  return { redis, f, ctx, store };
}

beforeEach(() => {
  clearJwks();
  clearReadMemory();
  clearShotMemory();
});

describe('private shots: who sends them', () => {
  it("accepts only Bridge's own workflow on its default branch, with GitHub's key and the shots audience", async () => {
    const { ctx } = world();
    expect(await workflowClaims(ctx, jwt({}))).toMatchObject({ repository: SHOTS_REPOSITORY });
    expect(await workflowClaims(ctx, jwt({ repository: 'someone/fork' }))).toBeNull();
    expect(await workflowClaims(ctx, jwt({ ref: 'refs/heads/feature' }))).toBeNull();
    expect(await workflowClaims(ctx, jwt({ aud: 'other' }))).toBeNull();
    expect(await workflowClaims(ctx, jwt({ exp: Math.floor(T0 / 1000) - 1 }))).toBeNull();
    expect(await workflowClaims(ctx, jwt({}, 'unknown'))).toBeNull();
    const forged = jwt({}).replace(/\.[\w-]+$/, '.AAAA');
    expect(await workflowClaims(ctx, forged)).toBeNull();
    expect(await workflowClaims(ctx, null)).toBeNull();
  });
});

describe('private shots: what to capture and what is kept', () => {
  it('lists the open explorations of watched copies without a capture at their head, and keeps a webp for a watched copy only', async () => {
    const { redis, ctx } = world();
    await redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'account' } }]));
    expect((await shotsTodo(ctx)).map((j) => [j.repo, j.pr, j.branch, j.template])).toEqual([
      [COPY, 1, 'explore/team', 'https://{branch}.acme-account-design.pages.dev'],
      [COPY, 2, 'explore/profile', 'https://{branch}.acme-account-design.pages.dev'],
    ]);
    expect((await putShot(ctx, { repo: COPY, pr: 1, sha: SHA, image: WEBP, url: 'https://explore-team.acme-account-design.pages.dev/' })).status).toBe(200);
    expect((await shotsTodo(ctx)).map((j) => j.pr)).toEqual([2]);
    expect((await putShot(ctx, { repo: 'someone/else', pr: 1, sha: SHA, image: WEBP })).status).toBe(403);
    expect((await putShot(ctx, { repo: COPY, pr: 1, sha: SHA, image: Buffer.from('<svg/>').toString('base64') })).status).toBe(400);
    expect(JSON.parse(String(await redis.cmd('GET', shotKeyOf(COPY, 1))))).toMatchObject({ sha: SHA });
  });

  it("captures an exploration on the screen it chose, and again when another one is chosen", async () => {
    const { redis, ctx } = world();
    let screen: unknown = '/#/orders/XGZFHY3Z';
    const block = () => `## Exploration: Team\n\n<!-- bridge-exploration ${JSON.stringify({ name: 'Team', purpose: '', screen })} -->`;
    const f: ContribDeps['fetch'] = async (url, init) => {
      if (new URL(url).pathname === `/repos/${COPY}/pulls`) return Response.json([{ number: 1, head: { sha: SHA, ref: 'explore/team' }, body: block() }]);
      return ctx.f(url, init);
    };
    const c = { ...ctx, f };
    await redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'account' } }]));
    expect((await shotsTodo(c)).map((j) => [j.pr, j.screen])).toEqual([[1, '/#/orders/XGZFHY3Z']]);
    // Kept with the screen it opened: the same head and screen ask for nothing more.
    expect((await putShot(c, { repo: COPY, pr: 1, sha: SHA, image: WEBP, route: '/#/orders/XGZFHY3Z', at: '/#/orders/XGZFHY3Z' })).status).toBe(200);
    expect(JSON.parse(String(await redis.cmd('GET', shotKeyOf(COPY, 1))))).toMatchObject({ at: '/#/orders/XGZFHY3Z' });
    expect(await shotsTodo(c)).toEqual([]);
    // Another screen chosen at the same head: captured again there.
    screen = '/?workspace=new#/';
    expect((await shotsTodo(c)).map((j) => [j.pr, j.screen])).toEqual([[1, '/?workspace=new#/']]);
    // Taken away: captured again, the old way.
    screen = undefined;
    expect((await shotsTodo(c)).map((j) => [j.pr, j.screen])).toEqual([[1, null]]);
    // Never another site, from the body nor from the capture.
    screen = '//evil.example/x';
    expect((await shotsTodo(c))[0]!.screen).toBeNull();
    await putShot(c, { repo: COPY, pr: 1, sha: SHA, image: WEBP, at: 'https://evil.example/' });
    expect(JSON.parse(String(await redis.cmd('GET', shotKeyOf(COPY, 1))))).not.toHaveProperty('at');
  });

  it("captures the developers' ready builds on the product's previews, and keeps the page each capture shows", async () => {
    const { redis, ctx } = world();
    await redis.pipe(watchWrites([{ repo: CODE, meta: { team: TEAM, kind: 'code', product: 'account' } }]));
    // A draft is not a build to check yet.
    expect((await shotsTodo(ctx)).map((j) => [j.repo, j.pr, j.template])).toEqual([[CODE, 3, 'https://{branch}.acme-account.pages.dev']]);
    expect((await putShot(ctx, { repo: CODE, pr: 3, sha: 'c'.repeat(40), image: WEBP, route: '/billing', screen: 'Invoice badges' })).status).toBe(200);
    expect(await shotMeta(redis, CODE, 3)).toMatchObject({ route: '/billing', screen: 'Invoice badges' });
    // Only a path on the preview is kept as its page.
    await putShot(ctx, { repo: CODE, pr: 3, sha: 'c'.repeat(40), image: WEBP, route: 'https://evil.example/' });
    expect(await shotMeta(redis, CODE, 3)).toMatchObject({ route: null });
  });
});

describe('private shots: through api/contribute', () => {
  const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
  const deps = (w: ReturnType<typeof world>): ContribDeps => ({ fetch: w.f, now: () => T0, redis: w.redis, shots: w.store, app: { installationToken: async () => 'ghs_x' } });

  it('the workflow needs its OIDC token; a demo visitor reads the capture of a product listed by the team, nothing else', async () => {
    const w = world();
    await w.redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'account' } }]));
    const req = (q: string, init: RequestInit = {}) => new Request(`https://bridge.example.com/api/contribute?${q}`, { ...init, headers: { host: 'bridge.example.com', ...(init.headers ?? {}) } });
    expect((await handleContribute(req('shots=todo'), ENV, deps(w))).status).toBe(401);
    const todo = await handleContribute(req('shots=todo', { headers: { authorization: jwt({}) } }), ENV, deps(w));
    expect((await todo.json()).jobs).toHaveLength(2);
    const put = await handleContribute(req('shots=put', { method: 'POST', headers: { authorization: jwt({}), 'content-type': 'application/json' }, body: JSON.stringify({ repo: COPY, pr: 1, sha: SHA, image: WEBP }) }), ENV, deps(w));
    expect(put.status).toBe(200);
    const meta = await handleContribute(req(`repo=${TEAM}&shot=${COPY}&pr=1&meta=1`), ENV, deps(w));
    expect((await meta.json()).shot).toMatchObject({ sha: SHA });
    const img = await handleContribute(req(`repo=${TEAM}&shot=${COPY}&pr=1`), ENV, deps(w));
    expect(img.headers.get('content-type')).toBe('image/webp');
    expect(img.headers.get('cache-control')).toContain('private');
    // A repository the team does not list, and a team that is not a demo for a visitor.
    expect((await handleContribute(req(`repo=${TEAM}&shot=someone/else&pr=1&meta=1`), ENV, deps(w))).status).toBe(403);
    expect((await handleContribute(req(`repo=acme/design&shot=${COPY}&pr=1&meta=1`), ENV, deps(w))).status).toBe(401);
  });
});

describe('private shots: images in the Blob store, only an index in Redis', () => {
  const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, 'base64'));
  const legacy = (image: string) => JSON.stringify({ sha: SHA, capturedAt: new Date(T0 - 1000).toISOString(), url: 'https://x.pages.dev/', image });

  it('keeps the image in the store and a small index in Redis; a new capture replaces the old image', async () => {
    const { redis, ctx, store } = world();
    await redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'account' } }]));
    expect((await putShot(ctx, { repo: COPY, pr: 1, sha: SHA, image: WEBP })).status).toBe(200);
    const first = shotPathOf(COPY, 1, SHA, T0);
    const index = String(await redis.cmd('GET', shotKeyOf(COPY, 1)));
    expect(JSON.parse(index)).toMatchObject({ sha: SHA, blob: first });
    expect(index).not.toContain(WEBP);
    expect(index.length).toBeLessThan(400);
    expect([...store.items.keys()]).toEqual([first]);
    expect(Buffer.from((await (await shotImage(redis, store, COPY, 1)).arrayBuffer())).toString('base64')).toBe(WEBP);
    // The next capture (a later head): its own pathname, the old image is deleted.
    const later = { ...ctx, now: () => T0 + 60_000 };
    expect((await putShot(later, { repo: COPY, pr: 1, sha: 'b'.repeat(40), image: WEBP })).status).toBe(200);
    expect([...store.items.keys()]).toEqual([shotPathOf(COPY, 1, 'b'.repeat(40), T0 + 60_000)]);
  });

  it('refuses a capture when no store is configured, and serves 404 when the image is gone', async () => {
    const { redis, ctx, store } = world();
    await redis.pipe(watchWrites([{ repo: COPY, meta: { team: TEAM, kind: 'copy', product: 'account' } }]));
    expect((await putShot({ ...ctx, store: null }, { repo: COPY, pr: 1, sha: SHA, image: WEBP })).status).toBe(503);
    expect(await redis.cmd('GET', shotKeyOf(COPY, 1))).toBeNull();
    await putShot(ctx, { repo: COPY, pr: 1, sha: SHA, image: WEBP });
    store.items.clear();
    await expect(shotImage(redis, store, COPY, 1)).rejects.toMatchObject({ status: 404 });
  });

  it('still serves a capture kept in Redis before the move', async () => {
    const { redis, store } = world();
    await redis.cmd('SET', shotKeyOf(COPY, 1), legacy(WEBP), 'EX', KEEP_S);
    const res = await shotImage(redis, store, COPY, 1);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(Buffer.from(await res.arrayBuffer()).toString('base64')).toBe(WEBP);
  });

  it('migrates every image out of Redis once, keeps the TTL, deletes orphans, and a second run moves nothing', async () => {
    let t = T0;
    const redis = memoryRedis(() => t);
    const store = memoryShotStore();
    const ctx = { redis, store, now: () => t };
    // A real capture weighs tens of KB.
    const BIG = Buffer.concat([Buffer.from(WEBP, 'base64'), Buffer.alloc(30_000, 7)]).toString('base64');
    await redis.cmd('SET', shotKeyOf(COPY, 1), legacy(BIG), 'EX', 3600);
    await redis.cmd('SET', shotKeyOf(CODE, 3), legacy(WEBP), 'EX', KEEP_S);
    await store.put(`${SHOTS_PREFIX}${COPY}/9/old.webp`, bytes(WEBP));
    const before = store.items.size;
    const dry = await migrateShots(ctx, true);
    expect(dry).toMatchObject({ dryRun: true, keys: 2, moved: 2, inStore: 0, orphansDeleted: 1 });
    expect(dry.redisBytesFreed).toBeGreaterThan(BIG.length - 200);
    expect(store.items.size).toBe(before);
    expect(String(await redis.cmd('GET', shotKeyOf(COPY, 1)))).toContain(BIG);

    const done = await migrateShots(ctx);
    expect(done).toMatchObject({ dryRun: false, keys: 2, moved: 2, orphansDeleted: 1, orphanBytes: bytes(WEBP).byteLength });
    const index = JSON.parse(String(await redis.cmd('GET', shotKeyOf(COPY, 1))));
    expect(index.image).toBeUndefined();
    expect(index).toMatchObject({ sha: SHA, url: 'https://x.pages.dev/', blob: shotPathOf(COPY, 1, SHA, T0 - 1000) });
    expect(store.items.has(index.blob)).toBe(true);
    expect(store.items.has(`${SHOTS_PREFIX}${COPY}/9/old.webp`)).toBe(false);
    expect(Buffer.from((await (await shotImage(redis, store, COPY, 1)).arrayBuffer())).toString('base64')).toBe(BIG);

    expect(await migrateShots(ctx)).toMatchObject({ keys: 2, moved: 0, inStore: 2, redisBytesFreed: 0, orphansDeleted: 0 });
    // KEEPTTL: the moved index still expires when the capture would have.
    t += 3601 * 1000;
    expect(await redis.cmd('GET', shotKeyOf(COPY, 1))).toBeNull();
    expect(await redis.cmd('GET', shotKeyOf(CODE, 3))).not.toBeNull();
  });

  it('runs the migration only for the workflow, through api/contribute', async () => {
    const w = world();
    await w.redis.cmd('SET', shotKeyOf(COPY, 1), legacy(WEBP), 'EX', KEEP_S);
    const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
    const deps: ContribDeps = { fetch: w.f, now: () => T0, redis: w.redis, shots: w.store, app: { installationToken: async () => 'ghs_x' } };
    const req = (q: string, auth?: string) => new Request(`https://bridge.example.com/api/contribute?${q}`, { method: 'POST', headers: { host: 'bridge.example.com', ...(auth ? { authorization: auth } : {}) } });
    expect((await handleContribute(req('shots=migrate'), ENV, deps)).status).toBe(401);
    const dry = await handleContribute(req('shots=migrate&dry=1', jwt({})), ENV, deps);
    expect(await dry.json()).toMatchObject({ dryRun: true, moved: 1 });
    expect(w.store.items.size).toBe(0);
    const run = await handleContribute(req('shots=migrate', jwt({})), ENV, deps);
    expect(await run.json()).toMatchObject({ dryRun: false, moved: 1 });
    expect(w.store.items.size).toBe(1);
  });
});

describe('private shots: the page to open', () => {
  it("names the changed files' pages, never the app shell", () => {
    expect(fileHints(['src/pages/Billing.tsx', 'src/App.tsx', 'src/main.tsx', 'src/components/InvoiceBadge.tsx', '.bridge/explorations/x.md'])).toEqual(['billing', 'invoicebadge', 'invoice', 'badge']);
    // A react-admin resource: the folder names the page, the generic word of the file name does not.
    expect(fileHints(['src/resources/orders/OrderList.tsx'])).toEqual(['orderlist', 'orders', 'order']);
    // A page before a shared stylesheet, whole names before words.
    expect(fileHints(['src/account.module.css', 'src/pages/Billing.tsx'])).toEqual(['billing', 'account']);
  });
});
