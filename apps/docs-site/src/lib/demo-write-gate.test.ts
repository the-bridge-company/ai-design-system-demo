// The demo's one write gate (api/contribute demoWriteRefusal): a visitor reads a demo team like a member who views it,
// and any write by someone not on it is refused once, in the demo dialog's words, with the `demo` code.
import { describe, expect, it } from 'vitest';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { type ContribDeps, contributorOf, cookieName, DEMO_REFUSAL, handleContribute, signSession } from '../../api/contribute/index';
import { DEMO_MEMBERS, DEMO_VISITOR_EMAIL, seedDemoTeam } from '../../api/_lib/demo-members';
import { ACCOUNT_COOKIE, putAccount, signAccountSession } from '../../api/_lib/account';
import { DEMO_WORDS } from './demo';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const DEMO = 'acme-design-demo/bridge-demo-ds';
const TEAM = 'acme/design';
const T0 = Date.parse('2026-11-07T10:00:00Z');

function setup() {
  const redis = memoryRedis(() => T0);
  const writes: string[] = [];
  const deps: ContribDeps = {
    fetch: async (url, init) => {
      const u = new URL(url);
      if (init.method !== 'GET') writes.push(`${init.method} ${u.pathname}`);
      if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return Response.json({ private: false, default_branch: 'main' });
      return Response.json({ ok: true }, { status: init.method === 'POST' ? 201 : 200 });
    },
    now: () => T0,
    redis,
    app: { installationToken: async () => 'ghs_x' },
  };
  const member = async (repo: string) => {
    await memberStore(redis).put(repo, { email: 'mia@acme.example', name: 'Mia', role: 'edit', version: 1, addedBy: 'dana', at: new Date(T0).toISOString() });
    return `${cookieName(repo)}=${signSession({ repo, email: 'mia@acme.example', name: 'Mia', v: 1, exp: T0 + 1e9 }, SECRET)}`;
  };
  const post = (query: string, body: unknown, cookie = '') =>
    handleContribute(
      new Request(`${ORIGIN}/api/contribute${query}`, {
        method: 'POST',
        headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', 'x-real-ip': '203.0.113.9', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      }),
      ENV,
      deps,
    );
  return { post, member, writes };
}

describe('the demo write gate', () => {
  it('refuses a visitor writing to the sample team, in the demo dialog words, and sends nothing to GitHub', async () => {
    const s = setup();
    const r = await s.post(`?repo=${encodeURIComponent(DEMO)}&gh=${encodeURIComponent(`/repos/${DEMO}/issues`)}`, { title: 'x' });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: DEMO_REFUSAL, message: DEMO_WORDS.dialogLead });
    const a = await s.post('', { action: 'set-pm', repo: DEMO, product: 'account', pm: null });
    expect(a.status).toBe(403);
    expect((await a.json()).error).toBe(DEMO_REFUSAL);
    expect(s.writes).toEqual([]);
  });

  it('lets anyone sign in or read the build state on the demo, and lets a member of the demo write', async () => {
    const s = setup();
    const signIn = await s.post('', { action: 'sign-in', repo: DEMO, email: 'someone@example.com' });
    expect((await signIn.json()).error).not.toBe(DEMO_REFUSAL);
    const cookie = await s.member(DEMO);
    const r = await s.post(`?repo=${encodeURIComponent(DEMO)}&gh=${encodeURIComponent(`/repos/${DEMO}/issues`)}`, { title: 'x' }, cookie);
    expect((await r.clone().json().catch(() => ({}))).error).not.toBe(DEMO_REFUSAL);
  });

  it('never gates a team that is not a demo', async () => {
    const s = setup();
    const r = await s.post(`?repo=${encodeURIComponent(TEAM)}&gh=${encodeURIComponent(`/repos/${TEAM}/issues`)}`, { title: 'x' });
    expect((await r.json()).error).not.toBe(DEMO_REFUSAL);
  });
});

// The demo visitor IS a member of the sample team (api/_lib/demo-members.ts): a signed-out visitor gets a read-only
// session as Dana, its lead, and reads by every path an email member reads by; the one gate refuses each write.
describe('the demo visitor reads as Dana', () => {
  let t: { deps: ContribDeps; redis: ReturnType<typeof memoryRedis>; writes: string[] };
  const fresh = async (seed = true) => {
    const redis = memoryRedis(() => T0);
    const writes: string[] = [];
    const deps: ContribDeps = {
      fetch: async (url, init) => {
        const u = new URL(url);
        if (init.method !== 'GET') writes.push(`${init.method} ${u.pathname}`);
        if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return Response.json({ private: false, default_branch: 'main' });
        if (u.pathname.endsWith('/collaborators')) return Response.json([]);
        return Response.json({ ok: true }, { status: init.method === 'POST' ? 201 : 200 });
      },
      now: () => T0,
      redis,
      app: { installationToken: async () => 'ghs_x' },
    };
    t = { deps, redis, writes };
    if (seed) await seedDemoTeam({ members: memberStore(redis), redis }, T0);
  };
  const get = (query: string, headers: Record<string, string> = {}) => handleContribute(new Request(`${ORIGIN}/api/contribute${query}`, { headers: { host: HOST, 'x-real-ip': '203.0.113.9', ...headers } }), ENV, t.deps);
  const post = (query: string, body: unknown, headers: Record<string, string> = {}) =>
    handleContribute(
      new Request(`${ORIGIN}/api/contribute${query}`, { method: 'POST', headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', 'x-real-ip': '203.0.113.9', ...headers }, body: JSON.stringify(body) }),
      ENV,
      t.deps,
    );
  const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]!;
  const q = `?repo=${encodeURIComponent(DEMO)}`;

  it('gives a signed-out visitor of the sample team a session as Dana, the member answer a signed-in member gets', async () => {
    await fresh();
    const r = await get(q);
    expect((await r.json()).member).toMatchObject({ email: DEMO_VISITOR_EMAIL, name: 'Dana', visitor: true, lead: true, decides: true });
    const cookie = cookieOf(r);
    expect(cookie.startsWith(`${cookieName(DEMO)}=`)).toBe(true);
    // With that session: the same member, no new cookie, and the team's people read as a member reads them.
    const again = await get(q, { cookie });
    expect((await again.json()).member).toMatchObject({ name: 'Dana', visitor: true });
    expect(again.headers.get('set-cookie')).toBeNull();
    const people = await (await get(`${q}&members=1`, { cookie })).json();
    expect(people.members.map((m: { name: string }) => m.name)).toEqual(['Ann', 'Dana', 'Leo', 'Sofia']);
    expect(people.members.find((m: { you?: boolean }) => m.you)?.name).toBe('Dana');
    expect(people.pms.prints).toMatchObject({ name: 'Ann' });
  });

  it('refuses every write of the visitor session with the demo code, and sends nothing to GitHub', async () => {
    await fresh();
    const cookie = cookieOf(await get(q));
    const r = await post(`${q}&gh=${encodeURIComponent(`/repos/${DEMO}/issues`)}`, { title: 'x' }, { cookie });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe(DEMO_REFUSAL);
    for (const action of [
      { action: 'set-pm', repo: DEMO, product: 'account', pm: null },
      { action: 'exploration-keeper', repo: DEMO },
      { action: 'library-update', repo: DEMO, product: 'account' },
    ]) {
      const a = await post('', action, { cookie });
      expect(a.status).toBe(403);
      expect((await a.json()).error).toBe(DEMO_REFUSAL);
    }
    expect(t.writes).toEqual([]);
    // The other functions that accept email members (api/ship, api/mcp, team-caller): read as Dana, refuse a write.
    const asGet = new Request(`${ORIGIN}/api/ship?repo=${DEMO}`, { headers: { host: HOST, cookie } });
    expect((await contributorOf(asGet, DEMO, ENV, t.deps))?.name).toBe('Dana');
    const asPost = new Request(`${ORIGIN}/api/ship`, { method: 'POST', headers: { host: HOST, cookie } });
    await expect(contributorOf(asPost, DEMO, ENV, t.deps)).rejects.toMatchObject({ status: 403, code: DEMO_REFUSAL });
  });

  it('never makes a GitHub sign-in Dana: the demo owner keeps their own identity', async () => {
    await fresh();
    const cookie = cookieOf(await get(q));
    const bearer = { authorization: `Bearer ${'g'.repeat(40)}` };
    const r = await get(q, bearer);
    expect((await r.json()).member).toBeNull();
    expect(r.headers.get('set-cookie')).toBeNull();
    // A leftover visitor cookie does not count on a request signed in with GitHub either.
    expect((await (await get(q, { cookie, ...bearer })).json()).member).toBeNull();
  });

  it('lets a real member session win over a visitor one, and write as on any team', async () => {
    await fresh();
    await memberStore(t.redis).put(DEMO, { email: 'mia@acme.example', name: 'Mia', role: 'edit', version: 1, addedBy: 'dana', at: new Date(T0).toISOString() });
    const mia = `${cookieName(DEMO)}=${signSession({ repo: DEMO, email: 'mia@acme.example', name: 'Mia', v: 1, exp: T0 + 1e9 }, SECRET)}`;
    const info = await (await get(q, { cookie: mia })).json();
    expect(info.member).toMatchObject({ name: 'Mia' });
    expect(info.member.visitor).toBeUndefined();
    const r = await post(`${q}&gh=${encodeURIComponent(`/repos/${DEMO}/issues`)}`, { title: 'x' }, { cookie: mia });
    expect((await r.clone().json().catch(() => ({}))).error).not.toBe(DEMO_REFUSAL);
  });

  it("reads the sample team as Dana for a signed-in Bridge account too, never as the account's own team", async () => {
    await fresh();
    const email = 'florian@example.com';
    await putAccount(t.redis, { id: 'florian', email, name: 'Florian', github: null, createdAt: new Date(T0).toISOString(), version: 1 });
    await memberStore(t.redis).put(DEMO, { email, name: 'Florian', role: 'admin', version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
    const account = `${ACCOUNT_COOKIE}=${signAccountSession({ email, v: 1, exp: T0 + 3_600_000 }, SECRET)}`;
    const r = await get(q, { cookie: account });
    expect((await r.json()).member).toMatchObject({ name: 'Dana', visitor: true });
    // On a real team the same account is itself.
    await memberStore(t.redis).put(TEAM, { email, name: 'Florian', role: 'admin', version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
    expect((await (await get(`?repo=${encodeURIComponent(TEAM)}`, { cookie: account })).json()).member).toMatchObject({ name: 'Florian' });
  });

  it('leaves real teams as they were: no visitor session, nobody signed in', async () => {
    await fresh();
    const r = await get(`?repo=${encodeURIComponent(TEAM)}`);
    expect((await r.json()).member).toBeNull();
    expect(r.headers.get('set-cookie')).toBeNull();
    // A visitor session signed for the sample team never opens another team.
    const cookie = cookieOf(await get(q));
    const moved = cookie.replace(`${cookieName(DEMO)}=`, `${cookieName(TEAM)}=`);
    expect((await (await get(`?repo=${encodeURIComponent(TEAM)}`, { cookie: moved })).json()).member).toBeNull();
  });

  it('gives the visitor a session as the person picked in See it as, still read only', async () => {
    await fresh();
    const sofia = await get(`${q}&as=Sofia`);
    expect((await sofia.json()).member).toMatchObject({ email: 'sofia@acme.example', name: 'Sofia', role: 'edit', visitor: true });
    const cookie = cookieOf(sofia);
    // With that session "mine", the team's people and the other functions read as Sofia.
    const people = await (await get(`${q}&members=1`, { cookie })).json();
    expect(people.members.find((m: { you?: boolean }) => m.you)?.name).toBe('Sofia');
    expect((await contributorOf(new Request(`${ORIGIN}/api/ship?repo=${DEMO}`, { headers: { host: HOST, cookie } }), DEMO, ENV, t.deps))?.name).toBe('Sofia');
    // Same pick: no new cookie. Another pick: a new session for them.
    expect((await get(`${q}&as=sofia`, { cookie })).headers.get('set-cookie')).toBeNull();
    const ann = await get(`${q}&as=ann`, { cookie });
    const annMember = (await ann.json()).member;
    // Ann is the product manager: never a reviewer, never deciding.
    expect(annMember).toMatchObject({ name: 'Ann', visitor: true });
    expect(annMember.lead).toBeUndefined();
    expect(annMember.decides).toBeUndefined();
    expect(cookieOf(ann).startsWith(`${cookieName(DEMO)}=`)).toBe(true);
    // Every write is refused, whoever is played.
    const w = await post(`${q}&gh=${encodeURIComponent(`/repos/${DEMO}/issues`)}`, { title: 'x' }, { cookie });
    expect(w.status).toBe(403);
    expect((await w.json()).error).toBe(DEMO_REFUSAL);
    expect(t.writes).toEqual([]);
  });

  it("plays the developer through the lead's session, and names nobody else", async () => {
    await fresh();
    const malik = await get(`${q}&as=malik`);
    expect((await malik.json()).member).toMatchObject({ name: 'Dana', visitor: true });
    // Anyone the sample team does not have reads as its lead.
    expect((await (await get(`${q}&as=mallory`)).json()).member).toMatchObject({ name: 'Dana' });
  });

  it('never plays anyone for a real member, on a real team, or from a forged visitor cookie', async () => {
    await fresh();
    await memberStore(t.redis).put(DEMO, { email: 'mia@acme.example', name: 'Mia', role: 'edit', version: 1, addedBy: 'dana', at: new Date(T0).toISOString() });
    const mia = `${cookieName(DEMO)}=${signSession({ repo: DEMO, email: 'mia@acme.example', name: 'Mia', v: 1, exp: T0 + 1e9 }, SECRET)}`;
    const own = await get(`${q}&as=sofia`, { cookie: mia });
    expect((await own.json()).member).toMatchObject({ name: 'Mia' });
    expect(own.headers.get('set-cookie')).toBeNull();
    // A visitor session for someone the sample team does not list is no session.
    const forged = `${cookieName(DEMO)}=${signSession({ repo: DEMO, email: 'mia@acme.example', name: 'Mia', v: 1, exp: T0 + 1e9, visit: 1 }, SECRET)}`;
    expect((await (await get(`${q}&members=1`, { cookie: forged })).json()).members?.find((m: { you?: boolean }) => m.you)).toBeUndefined();
    const real = await get(`?repo=${encodeURIComponent(TEAM)}&as=sofia`);
    expect((await real.json()).member).toBeNull();
    expect(real.headers.get('set-cookie')).toBeNull();
  });

  it('reads as a guest, as before, while the sample team has no seeded members', async () => {
    await fresh(false);
    const r = await get(q);
    expect((await r.json()).member).toBeNull();
    expect(r.headers.get('set-cookie')).toBeNull();
  });
});

describe('seeding the sample team', () => {
  it('writes its four members and its PM once, then keeps them as they are', async () => {
    const redis = memoryRedis(() => T0);
    const members = memberStore(redis);
    const first = await seedDemoTeam({ members, redis }, T0);
    expect(first.added).toEqual(DEMO_MEMBERS.map((m) => m.email));
    expect(first.pm).toBe('set');
    const again = await seedDemoTeam({ members, redis }, T0 + 1000);
    expect(again).toEqual({ added: [], updated: [], kept: DEMO_MEMBERS.map((m) => m.email), pm: 'kept', migrated: [], forgot: 0, retired: [] });
    expect(await members.get(DEMO, 'dana@acme.example')).toMatchObject({ role: 'admin', lead: true, version: 1 });
    expect(await members.get(DEMO, 'leo@acme.example')).toMatchObject({ role: 'edit', version: 1 });
    // A member changed since is set back with a new version (their sessions end), as an admin's change does.
    await members.put(DEMO, { ...(await members.get(DEMO, 'leo@acme.example'))!, role: 'view' });
    const fixed = await seedDemoTeam({ members, redis }, T0 + 2000);
    expect(fixed.updated).toEqual(['leo@acme.example']);
    expect(await members.get(DEMO, 'leo@acme.example')).toMatchObject({ role: 'edit', version: 2 });
  });

  it('runs only for a GitHub admin of the sample team', async () => {
    const redis = memoryRedis(() => T0);
    const deps = (admin: boolean): ContribDeps => ({
      fetch: async (url) => {
        const u = new URL(url);
        if (u.pathname === '/user') return Response.json({ login: 'peterbono', name: 'Florian', id: 1 });
        if (u.pathname === `/repos/${DEMO}`) return Response.json({ private: true, permissions: { admin, push: admin, pull: true } });
        return Response.json({});
      },
      now: () => T0,
      redis,
      app: { installationToken: async () => 'ghs_x' },
    });
    const seed = (admin: boolean, token: string) =>
      handleContribute(
        new Request(`${ORIGIN}/api/contribute`, { method: 'POST', headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'seed-demo', repo: DEMO }) }),
        ENV,
        deps(admin),
      );
    const no = await seed(false, 'n'.repeat(40));
    expect(no.status).toBe(403);
    expect(await memberStore(redis).list(DEMO)).toEqual([]);
    const ok = await seed(true, 'y'.repeat(40));
    expect(ok.status).toBe(200);
    expect((await ok.json()).added).toHaveLength(4);
    expect((await memberStore(redis).list(DEMO)).map((m) => m.name)).toEqual(['Ann', 'Dana', 'Leo', 'Sofia']);
  });
});
