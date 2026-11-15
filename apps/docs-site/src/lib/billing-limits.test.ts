// The Free limits where people and design systems are added (docs/BILLING.md): a fourth editor waits marked "needs
// Team" (invites, accepting, approving a request, Can view to Can edit), a second design system waits too; nothing is
// charged, nothing deleted. With billing off (as shipped) every path behaves as before. Founding and paying teams are
// never limited. Real functions (api/invites, api/entry), an in-memory Redis, a fake email.
import { describe, expect, it } from 'vitest';
import { type Account, ACCOUNT_COOKIE, putAccount, signAccountSession } from '../../api/_lib/account';
import { billingFromSubscription, markFounding, putBilling, type BillingFlags } from '../../api/_lib/billing';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { putRequest } from '../../api/_lib/teams';
import { handleEntry } from '../../api/entry/index';
import { type EmailMessage, handleInvites, inviteStoreOn } from '../../api/invites/index';
import { BILLING_WORDS } from './billing';
import { sentSummary } from './invites';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const T0 = Date.parse('2027-03-01T10:00:00Z');
const TEAM = 'northwind/ds';
const ON: BillingFlags = { launched: true, launchDate: '2027-02-01', testTeams: [] };
const OFF: BillingFlags = { launched: false, launchDate: null, testTeams: [] };

const res = (status: number) => new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });

function setup(billing: BillingFlags) {
  let now = T0;
  const redis = memoryRedis(() => now);
  const members = memberStore(redis);
  const invites = inviteStoreOn(redis, () => now);
  const sent: EmailMessage[] = [];
  const email = { send: async (m: EmailMessage) => void sent.push(m) };
  let n = 0;
  const random = (k: number) => new Uint8Array(k).map(() => (n++ * 37 + 11) % 256);
  const fetch = async () => res(404);
  const entryDeps = { fetch, now: () => now, random, redis, members, invites, email, billing };
  const invitesDeps = { fetch, now: () => now, random, redis, members, store: invites, email, billing };
  const cookie = async (address: string, name: string) => {
    const a: Account = { id: `id-${address}`, email: address, name, github: null, createdAt: new Date(T0).toISOString(), version: 1 };
    await putAccount(redis, a);
    return `${ACCOUNT_COOKIE}=${signAccountSession({ email: address, v: 1, exp: now + 86_400_000 }, SECRET)}`;
  };
  const headers = (c: string) => ({ host: HOST, origin: ORIGIN, cookie: c, 'content-type': 'application/json', 'x-bridge-account': '1' });
  const act = async (c: string, body: unknown) => {
    const r = await handleEntry(new Request(`${ORIGIN}/api/entry`, { method: 'POST', headers: headers(c), body: JSON.stringify(body) }), ENV, entryDeps);
    return { status: r.status, body: (await r.json()) as any };
  };
  const inv = async (c: string, body: unknown) => {
    const r = await handleInvites(new Request(`${ORIGIN}/api/invites`, { method: 'POST', headers: headers(c), body: JSON.stringify(body) }), ENV, invitesDeps);
    return { status: r.status, body: (await r.json()) as any };
  };
  const listInv = async (c: string) => {
    const r = await handleInvites(new Request(`${ORIGIN}/api/invites?repo=${TEAM}`, { headers: { host: HOST, cookie: c } }), ENV, invitesDeps);
    return (await r.json()) as any;
  };
  const put = (address: string, role: 'view' | 'edit' | 'admin') => members.put(TEAM, { email: address, name: address.split('@')[0]!, role, version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
  /** A team with its admin and two more editors: three, Free's full count. */
  const fullTeam = async () => {
    await put('jo@northwind.io', 'admin');
    await put('sam@northwind.io', 'edit');
    await put('lee@northwind.io', 'edit');
    await put('kim@northwind.io', 'view');
    return cookie('jo@northwind.io', 'Jo');
  };
  return { redis, members, invites, sent, cookie, act, inv, listInv, put, fullTeam, tick: (ms: number) => (now += ms) };
}

describe('billing off (as shipped): nothing changes', () => {
  it('a fourth and fifth editor are invited and join as before; a second design system is made', async () => {
    const s = setup(OFF);
    const jo = await s.fullTeam();
    const r = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }, { email: 'bo@northwind.io' }] });
    expect(r.body.results.map((x: any) => x.status)).toEqual(['sent', 'sent']);
    expect(s.sent).toHaveLength(2);
    const ana = await s.cookie('ana@northwind.io', 'Ana');
    const id = (await s.invites.list(TEAM)).find((i) => i.email === 'ana@northwind.io')!.id;
    expect((await s.act(ana, { action: 'accept-invite', repo: TEAM, id })).status).toBe(200);
    expect((await s.inv(jo, { action: 'set-role', repo: TEAM, email: 'kim@northwind.io', role: 'edit' })).status).toBe(200);
    const created = await s.act(jo, { action: 'create-team', name: 'Second', discover: false });
    expect(created.status).toBe(200);
  });
});

describe('billing on: Free covers three editors', () => {
  it('a fourth editor invite waits, marked needs Team, never emailed; Can view still goes out', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    const r = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }] });
    expect(r.body.results).toEqual([{ email: 'ana@northwind.io', status: 'waiting', message: BILLING_WORDS.editorWaits }]);
    expect(s.sent).toHaveLength(0);
    expect((await s.listInv(jo)).invites).toEqual([expect.objectContaining({ email: 'ana@northwind.io', needsTeam: true })]);
    const view = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'view', people: [{ email: 'viv@northwind.io' }] });
    expect(view.body.results[0].status).toBe('sent');
    expect(sentSummary(r.body.results)).toBe('1 waits for Team.');
  });

  it('pending editor invites count: the third goes out, the fourth waits', async () => {
    const s = setup(ON);
    await s.put('jo@northwind.io', 'admin');
    await s.put('sam@northwind.io', 'edit');
    const jo = await s.cookie('jo@northwind.io', 'Jo');
    const r = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }, { email: 'bo@northwind.io' }] });
    expect(r.body.results.map((x: any) => x.status)).toEqual(['sent', 'waiting']);
  });

  it('a waiting invite cannot be accepted; once the team moves to Team, Resend sends it and it joins', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }] });
    const id = (await s.invites.list(TEAM))[0]!.id;
    const ana = await s.cookie('ana@northwind.io', 'Ana');
    expect(await s.act(ana, { action: 'accept-invite', repo: TEAM, id })).toEqual({ status: 409, body: { error: 'needs_team', message: BILLING_WORDS.joinWaits } });
    expect(await s.invites.get(TEAM, id)).not.toBeNull();
    expect((await s.inv(jo, { action: 'resend', repo: TEAM, id })).body.error).toBe('needs_team');
    expect(s.sent).toHaveLength(0);
    await putBilling(s.redis, TEAM, billingFromSubscription(null, { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { bridge_team: TEAM }, items: { data: [{ quantity: 4, price: { lookup_key: 'bridge_team_eur_yearly', currency: 'eur', recurring: { interval: 'year' } } }] } }, T0));
    const resent = await s.inv(jo, { action: 'resend', repo: TEAM, id });
    expect(resent.status).toBe(200);
    expect(resent.body.invite.needsTeam).toBeUndefined();
    expect(s.sent).toHaveLength(1);
    expect((await s.act(ana, { action: 'accept-invite', repo: TEAM, id })).status).toBe(200);
    expect((await s.members.get(TEAM, 'ana@northwind.io'))?.role).toBe('edit');
  });

  it('an invite sent before the team filled up waits at accept; someone already an editor re-joins freely', async () => {
    const s = setup(ON);
    await s.put('jo@northwind.io', 'admin');
    await s.put('sam@northwind.io', 'edit');
    const jo = await s.cookie('jo@northwind.io', 'Jo');
    await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }] });
    const id = (await s.invites.list(TEAM))[0]!.id;
    // A third editor arrives another way meanwhile (Can view made Can edit before the limit applied, an import).
    await s.put('lee@northwind.io', 'edit');
    const ana = await s.cookie('ana@northwind.io', 'Ana');
    expect((await s.act(ana, { action: 'accept-invite', repo: TEAM, id })).body.error).toBe('needs_team');
    // Sam, an editor already, is invited again as Admin: no new editor, so it goes out and joins.
    const again = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'admin', people: [{ email: 'sam@northwind.io' }] });
    expect(again.body.results[0].status).toBe('sent');
    const sam = await s.cookie('sam@northwind.io', 'Sam');
    const samInv = (await s.invites.list(TEAM)).find((i) => i.email === 'sam@northwind.io')!;
    expect((await s.act(sam, { action: 'accept-invite', repo: TEAM, id: samInv.id })).status).toBe(200);
    expect((await s.members.get(TEAM, 'sam@northwind.io'))?.role).toBe('admin');
  });

  it('Can view to Can edit, and approving a request, wait for Team when full; nobody is removed', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    expect(await s.inv(jo, { action: 'set-role', repo: TEAM, email: 'kim@northwind.io', role: 'edit' })).toEqual({ status: 409, body: { error: 'needs_team', message: BILLING_WORDS.editorFull } });
    expect((await s.members.get(TEAM, 'kim@northwind.io'))?.role).toBe('view');
    await putRequest(s.redis, { id: 'aaaaaaaaaaaaaaaa', repo: TEAM, email: 'ana@northwind.io', name: 'Ana', createdAt: new Date(T0).toISOString(), expiresAt: new Date(T0 + 86_400_000).toISOString() }, T0);
    expect((await s.act(jo, { action: 'approve', repo: TEAM, id: 'aaaaaaaaaaaaaaaa' })).body.error).toBe('needs_team');
    expect(await s.members.get(TEAM, 'ana@northwind.io')).toBeNull();
    expect((await s.members.list(TEAM)).length).toBe(4);
    // Down to two editors: the request goes through.
    expect((await s.inv(jo, { action: 'set-role', repo: TEAM, email: 'lee@northwind.io', role: 'view' })).status).toBe(200);
    expect((await s.act(jo, { action: 'approve', repo: TEAM, id: 'aaaaaaaaaaaaaaaa' })).status).toBe(200);
  });

  it('a Can view invite turned into an editor one waits for room', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    await s.inv(jo, { action: 'invite', repo: TEAM, role: 'view', people: [{ email: 'viv@northwind.io' }] });
    const id = (await s.invites.list(TEAM))[0]!.id;
    expect((await s.inv(jo, { action: 'invite-role', repo: TEAM, id, role: 'edit' })).body.error).toBe('needs_team');
  });

  it('a founding team is never limited', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    await markFounding(s.redis, TEAM, T0);
    const r = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }, { email: 'bo@northwind.io' }] });
    expect(r.body.results.map((x: any) => x.status)).toEqual(['sent', 'sent']);
    expect((await s.inv(jo, { action: 'set-role', repo: TEAM, email: 'kim@northwind.io', role: 'edit' })).status).toBe(200);
  });
});

describe('billing on: Free covers one design system', () => {
  it('an admin of a Free team cannot start a second one; a founding or paying team does not count', async () => {
    const s = setup(ON);
    const jo = await s.fullTeam();
    expect(await s.act(jo, { action: 'create-team', name: 'Second', discover: false })).toEqual({ status: 409, body: { error: 'needs_team', message: BILLING_WORDS.designSystemWaits } });
    await markFounding(s.redis, TEAM, T0);
    const r = await s.act(jo, { action: 'create-team', name: 'Second', discover: false });
    expect(r.status).toBe(200);
    // Running it again renames that team: never refused.
    expect((await s.act(jo, { action: 'create-team', name: 'Second, renamed', discover: false })).status).toBe(200);
  });

  it('a first team is always made', async () => {
    const s = setup(ON);
    const ana = await s.cookie('ana@acme.io', 'Ana');
    expect((await s.act(ana, { action: 'create-team', name: 'Acme', discover: false })).status).toBe(200);
  });
});

describe('billing off, one test team (BILLING_TEST_TEAMS): limits there only', () => {
  const TEST: BillingFlags = { launched: false, launchDate: null, testTeams: [TEAM] };

  it('the listed team waits at the 4th editor; another team does not', async () => {
    const s = setup(TEST);
    const jo = await s.fullTeam();
    const r = await s.inv(jo, { action: 'invite', repo: TEAM, role: 'edit', people: [{ email: 'ana@northwind.io' }] });
    expect(r.body.results[0].status).toBe('waiting');
    for (const [e, role] of [['jo@acme.io', 'admin'], ['a@acme.io', 'edit'], ['b@acme.io', 'edit']] as const) await s.members.put('acme/ds', { email: e, name: e, role, version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
    const joAcme = await s.cookie('jo@acme.io', 'Jo');
    const other = await s.inv(joAcme, { action: 'invite', repo: 'acme/ds', role: 'edit', people: [{ email: 'c@acme.io' }] });
    expect(other.body.results[0].status).toBe('sent');
  });

  it('a team made in Bridge listed by its key: its admin cannot start a second team; unlisted, they can', async () => {
    const KEY = '_team/00112233aabbccdd';
    for (const flags of [{ launched: false, launchDate: null, testTeams: [KEY] }, OFF]) {
      const s = setup(flags);
      await s.redis.cmd('SET', 'bridge:team:rec:00112233aabbccdd', JSON.stringify({ id: '00112233aabbccdd', name: 'Test', createdBy: 'lead@acme.io', createdAt: new Date(T0).toISOString(), repo: null, storybook: null }));
      await s.members.put(KEY, { email: 'ana@acme.io', name: 'Ana', role: 'admin', version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
      const ana = await s.cookie('ana@acme.io', 'Ana');
      const r = await s.act(ana, { action: 'create-team', name: 'Second', discover: false });
      expect(r.status).toBe(flags === OFF ? 200 : 409);
    }
  });
});
