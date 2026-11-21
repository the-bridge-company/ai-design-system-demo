// A batch of reads through Bridge (GET ?repo=<team>&read=...&read=..., api/_lib/team-read.ts onReads): the reads of
// one moment of a page in one request, each one through the same policy, cache and limits as gh=, with one member
// check, one counter round trip and one MGET for the whole batch.
import { describe, expect, it } from 'vitest';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis, type Redis } from '../../api/_lib/redis';
import { clearReadMemory, countKey, memberBudgetId, MAX_READS, READ_LIMITS } from '../../api/_lib/team-read';
import { type ContribDeps, cookieName, type FetchLike, handleContribute, signSession } from '../../api/contribute/index';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const T0 = Date.parse('2026-11-21T10:00:00Z');
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const TEAM = 'acme/design';
const SHOP = 'acme/shop';
const P = `/repos/${TEAM}`;
const S = `/repos/${SHOP}`;

function setup(o: { noApp?: string[]; limited?: boolean } = {}) {
  clearReadMemory();
  let now = T0;
  const calls: string[] = [];
  const github: FetchLike = async (url, init) => {
    const u = new URL(url);
    calls.push(`${init.headers.Accept} ${u.pathname}${u.search}`);
    if (o.limited) return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(T0 / 1000) + 300) } });
    if (u.pathname === `${P}/contents/bridge.config.json`) return new Response(JSON.stringify({ products: [{ key: 'shop', name: 'Shop', repo: SHOP }, { key: 'library', name: 'Library', default: true }] }), { status: 200, headers: { 'Content-Type': 'application/vnd.github.raw' } });
    if (u.pathname.endsWith('/contents/missing.json')) return Response.json({ message: 'Not Found' }, { status: 404 });
    if (init.headers.Accept === 'application/vnd.github.raw') return new Response(`raw ${u.pathname}`, { status: 200, headers: { 'Content-Type': 'application/vnd.github.raw', ETag: '"r"' } });
    if (u.pathname.endsWith('/pulls')) return Response.json([{ number: 1 }], { headers: { ETag: '"p1"', Link: '<x>; rel="next"' } });
    return Response.json({ ok: u.pathname }, { headers: { ETag: '"x"' } });
  };
  const store = memoryRedis(() => now);
  // Redis commands the function sends, as Upstash bills them (each command of a pipeline too).
  let commands = 0;
  const redis: Redis = {
    cmd: (...a) => {
      commands += 1;
      return store.cmd(...a);
    },
    pipe: (c) => {
      commands += c.length;
      return store.pipe(c);
    },
  };
  const deps: ContribDeps = { fetch: github, now: () => now, redis, app: { installationToken: async (owner, repo) => (o.noApp?.includes(`${owner}/${repo}`) ? null : 'ghs_read') } };
  const member = async (email = 'mia@acme.example') => {
    await memberStore(store).put(TEAM, { email, name: 'Mia', role: 'edit', version: 1, addedBy: 'dana', at: new Date(now).toISOString() });
    return `${cookieName(TEAM)}=${signSession({ repo: TEAM, email, name: 'Mia', v: 1, exp: now + 1e9 }, SECRET)}`;
  };
  const headers = (cookie: string, extra: Record<string, string> = {}) => ({ host: HOST, 'x-real-ip': '203.0.113.9', ...(cookie ? { cookie } : {}), ...extra });
  const batch = (reads: string[], cookie = '', extra: Record<string, string> = {}) =>
    handleContribute(new Request(`${ORIGIN}/api/contribute?repo=${encodeURIComponent(TEAM)}&${reads.map((r) => `read=${encodeURIComponent(r)}`).join('&')}`, { headers: headers(cookie, extra) }), ENV, deps);
  const read = (path: string, cookie = '', extra: Record<string, string> = {}) => handleContribute(new Request(`${ORIGIN}/api/contribute?repo=${encodeURIComponent(TEAM)}&gh=${encodeURIComponent(path)}`, { headers: headers(cookie, extra) }), ENV, deps);
  return { calls, store, deps, member, batch, read, commands: () => commands, tick: (ms: number) => (now += ms) };
}

type Answer = { status: number; type?: string; etag?: string; link?: string; cache?: string; body?: string; error?: string; message?: string; later?: true };
const answers = async (r: Response) => ((await r.json()) as { reads: Answer[] }).reads;

describe('team reads: a batch of reads', () => {
  it("answers each read in the order asked, with GitHub's status, body, ETag and Link, and keeps them like gh= does", async () => {
    const s = setup();
    const cookie = await s.member();
    const r = await s.batch([`${P}/pulls?state=open&per_page=100`, `${P}/git/ref/heads/main`, `application/vnd.github.raw ${P}/contents/llms.txt`, `${P}/contents/missing.json`], cookie);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    const [pulls, ref, raw, missing] = await answers(r);
    expect(pulls).toMatchObject({ status: 200, etag: '"p1"', link: '<x>; rel="next"', cache: 'miss' });
    expect(JSON.parse(pulls!.body!)).toEqual([{ number: 1 }]);
    expect(ref).toMatchObject({ status: 200, cache: 'miss' });
    expect(raw).toMatchObject({ status: 200, type: 'application/vnd.github.raw', body: `raw ${P}/contents/llms.txt` });
    // The Accept asked for reached GitHub.
    expect(s.calls).toContain(`application/vnd.github.raw ${P}/contents/llms.txt`);
    // GitHub's 404 as GitHub said it: the page reads it as a missing file.
    expect(missing).toMatchObject({ status: 404 });
    // The same answers are kept for the team: a single read of one of them is a hit, no GitHub call.
    const before = s.calls.length;
    const one = await s.read(`${P}/git/ref/heads/main`, cookie);
    expect(one.headers.get('x-bridge-cache')).toBe('hit');
    const again = await answers(await s.batch([`${P}/pulls?state=open&per_page=100`, `${P}/git/ref/heads/main`], cookie));
    expect(again.map((a) => a.cache)).toEqual(['hit', 'hit']);
    expect(s.calls.length).toBe(before);
  });

  it('checks the member once and reads every kept answer in one round trip: far fewer Redis commands than one request per read', async () => {
    const paths = Array.from({ length: 12 }, (_, i) => `${P}/issues/${i + 1}`);
    const single = setup();
    const c1 = await single.member();
    for (const p of paths) await single.read(p, c1);
    single.tick(1000);
    const singleStart = single.commands();
    for (const p of paths) expect((await single.read(p, c1)).headers.get('x-bridge-cache')).toBe('hit');
    const singleHits = single.commands() - singleStart;

    const batched = setup();
    const c2 = await batched.member();
    await batched.batch(paths, c2);
    batched.tick(1000);
    const batchStart = batched.commands();
    expect((await answers(await batched.batch(paths, c2))).every((a) => a.cache === 'hit')).toBe(true);
    const batchHits = batched.commands() - batchStart;
    // One member check (GET) and one pipeline (INCRBY, EXPIRE, MGET) for the twelve reads, against 4 per read alone.
    expect(singleHits).toBe(12 * 4);
    expect(batchHits).toBe(4);
  });

  it("counts every read against the member's request budget, and the GitHub calls of its misses once", async () => {
    const s = setup();
    const cookie = await s.member();
    await s.batch([`${P}/issues/1`, `${P}/issues/2`, `${P}/issues/3`], cookie);
    const who = memberBudgetId('mia@acme.example');
    expect(Number(await s.store.cmd('GET', countKey('member', who, T0)))).toBe(3);
    expect(Number(await s.store.cmd('GET', countKey('up', who, T0)))).toBe(3);
    expect(Number(await s.store.cmd('GET', countKey('team', TEAM, T0)))).toBe(3);
  });

  it('a read Bridge refuses answers its refusal in its place; the others go on', async () => {
    const s = setup({ noApp: [SHOP] });
    const cookie = await s.member();
    const [own, product] = await answers(await s.batch([`${P}/issues/1`, `${S}/pulls`], cookie));
    expect(own).toMatchObject({ status: 200 });
    // The app missing on the product: that product only.
    expect(product).toMatchObject({ status: 409, error: 'product_missing' });
  });

  it('reads a product repository the team lists with its config read once for the whole batch', async () => {
    const s = setup();
    const cookie = await s.member();
    const r = await answers(await s.batch([`${S}/pulls`, `${S}/issues/4`, `${P}/issues/4`], cookie));
    expect(r.map((a) => a.status)).toEqual([200, 200, 200]);
    expect(s.calls.filter((c) => c.endsWith(`${P}/contents/bridge.config.json`))).toHaveLength(1);
  });

  it('GitHub over its limit with nothing kept: that read says busy, with when to try again', async () => {
    const s = setup({ limited: true });
    const cookie = await s.member();
    const [a] = await answers(await s.batch([`${P}/issues/1`, `${P}/issues/2`], cookie));
    expect(a).toMatchObject({ status: 429, error: 'busy' });
    expect((a as { retryAfter?: number }).retryAfter).toBeGreaterThan(0);
  });

  it('refuses the whole batch for a path outside the allow-list, before anyone is looked up', async () => {
    const s = setup();
    const cookie = await s.member();
    const r = await s.batch([`${P}/issues/1`, `${P}/hooks`], cookie);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('not-allowed');
    expect(s.calls).toHaveLength(0);
  });

  it('asks a signed-out reader to sign in, and refuses more than MAX_READS reads or another origin', async () => {
    const s = setup();
    const out = await s.batch([`${P}/issues/1`, `${P}/issues/2`]);
    expect(out.status).toBe(401);
    expect((await out.json()).error).toBe('signin');
    const cookie = await s.member();
    const many = await s.batch(Array.from({ length: MAX_READS + 1 }, (_, i) => `${P}/issues/${i + 1}`), cookie);
    expect(many.status).toBe(400);
    const cross = await s.batch([`${P}/issues/1`, `${P}/issues/2`], cookie, { origin: 'https://elsewhere.example', 'sec-fetch-site': 'cross-site' });
    expect(cross.status).toBe(403);
    expect(s.calls).toHaveLength(0);
  });

  it("past OVER_FACTOR times the member's request budget, the batch answers busy", async () => {
    const s = setup();
    const cookie = await s.member();
    await s.store.cmd('SET', countKey('member', memberBudgetId('mia@acme.example'), T0), String(READ_LIMITS.ip * 4));
    const r = await s.batch([`${P}/issues/1`, `${P}/issues/2`], cookie);
    expect(r.status).toBe(429);
    expect((await r.json()).error).toBe('busy');
  });
});
