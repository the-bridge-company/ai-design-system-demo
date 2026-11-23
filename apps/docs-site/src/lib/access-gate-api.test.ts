// Bridge on invitation, the server side: the gate on new accounts in /api/account (BRIDGE_ACCESS_GATE), access links,
// and the founder's queue in /api/access (list, invite, not yet, links), with an in-memory Redis, a fake email and a
// mocked GitHub. Off, nothing changes; on, a new email is turned down only once its code is right (no account, no
// cookie), and let in when approved, with a live link (one use taken), a team invite or membership, a team open to its
// work domain, or an admin address. GitHub follows the same rule. The queue refuses anyone but the founders.
import { describe, expect, it } from 'vitest';
import { getAccount } from '../../api/_lib/account';
import { memoryRedis } from '../../api/_lib/redis';
import { memberStore } from '../../api/_lib/members';
import { putDiscovery } from '../../api/_lib/teams';
import { sha256 } from '../../api/_lib/http';
import type { EmailMessage } from '../../api/_lib/email';
import { ACCESS_LINKS_KEY, ACCESS_QUEUE_KEY, accessLinkKey, accessRequestKey, consumeAccessLink, parseAccessLink } from '../../api/_lib/access';
import { EXPORT_PATTERNS, handleAccount, type AccountDeps } from '../../api/account/index';
import { handleAccess, type AccessDeps } from '../../api/access/index';
import { inviteStoreOn, INVITE_TTL_MS } from '../../api/invites/index';
import { ACCESS_APPROVAL_MS, invitedThisWeek, isoWeekStart, linkStateOf, sortQueue } from './access-request';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const T0 = Date.parse('2026-11-25T10:00:00Z'); // a Wednesday
const SECRET = 's'.repeat(40);
const OFF = { LIBRARY_SESSION_SECRET: SECRET, BRIDGE_ADMIN_EMAILS: 'founder@bridge.test' };
const ON = { ...OFF, BRIDGE_ACCESS_GATE: 'on', PUBLIC_SITE_URL: 'https://bridge.test' };
const GH_TOKEN = 'ghu_' + 'x'.repeat(36);
const H = { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-account': '1', 'sec-fetch-site': 'same-origin' };
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(gh: { emails?: { email: string; verified: boolean; primary: boolean }[] } = {}) {
  let now = T0;
  const redis = memoryRedis(() => now);
  const sent: EmailMessage[] = [];
  let n = 0;
  const email = { send: async (m: EmailMessage) => void sent.push(m) };
  const fetch: AccountDeps['fetch'] = async (url) => {
    const u = new URL(url);
    if (u.pathname === '/user') return res(200, { id: 77, login: 'mia-gh', name: 'Mia Chen' });
    if (u.pathname === '/user/emails') return res(200, gh.emails ?? [{ email: 'mia@acme.example', verified: true, primary: true }]);
    return res(404, {});
  };
  const accountDeps: AccountDeps = { fetch, now: () => now, code: () => String(111111 + n++).slice(0, 6), redis, members: memberStore(redis), email, warn: () => {} };
  const accessDeps: AccessDeps = { fetch, now: () => now, redis, email, warn: () => {}, random: (k) => new Uint8Array(k).fill(7 + n++) };
  return { redis, sent, accountDeps, accessDeps, tick: (ms: number) => (now += ms), now: () => now };
}

const acct = (body: unknown, extra: Record<string, string> = {}) => new Request(`${ORIGIN}/api/account`, { method: 'POST', headers: { ...H, ...extra }, body: JSON.stringify(body) });
const access = (body: unknown, extra: Record<string, string> = {}) => new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: { ...H, ...extra }, body: JSON.stringify(body) });
const codeIn = (m: EmailMessage) => /\b(\d{6})\b/.exec(m.text)![1]!;
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]!;

/** Code then verify for `email`; the verify answer. */
async function signUp(s: ReturnType<typeof setup>, env: Record<string, string>, email: string, extra: Record<string, unknown> = {}) {
  expect((await handleAccount(acct({ action: 'code', email }), env, s.accountDeps)).status).toBe(200);
  return handleAccount(acct({ action: 'verify', email, code: codeIn(s.sent.at(-1)!), ...extra }), env, s.accountDeps);
}

async function founderCookie(s: ReturnType<typeof setup>): Promise<string> {
  const r = await signUp(s, ON, 'founder@bridge.test', { name: 'Florian' });
  expect(r.status).toBe(200);
  return cookieOf(r);
}

async function request(s: ReturnType<typeof setup>, email: string, over: Record<string, string> = {}) {
  const r = await handleAccess(access({ action: 'request', email, company: 'Acme', where: '', fix: 'Tokens drift', ...over }, { 'x-real-ip': email }), ON, s.accessDeps);
  expect(r.status).toBe(200);
}

async function makeLink(s: ReturnType<typeof setup>, cookie: string, body: Record<string, unknown> = {}) {
  const r = await handleAccess(access({ action: 'create-link', label: 'Ana at Acme', ...body }, { cookie }), ON, s.accessDeps);
  expect(r.status).toBe(200);
  const out = (await r.json()) as { url: string; link: { id: string } };
  return { ...out, token: new URL(out.url).searchParams.get('access')! };
}

describe('the gate, off (the default)', () => {
  it('makes any new account as before, whatever the env says otherwise', async () => {
    for (const env of [OFF, { ...OFF, BRIDGE_ACCESS_GATE: 'off' }, { ...OFF, BRIDGE_ACCESS_GATE: '' }]) {
      const s = setup();
      const r = await signUp(s, env, 'new@acme.example');
      expect(r.status).toBe(200);
      expect((await r.json()).created).toBe(true);
    }
  });
});

describe('the gate, on: email codes', () => {
  it('turns an unknown email down only after the code: no account, no cookie, the request page with the email', async () => {
    const s = setup();
    // The code goes out as for anyone: nothing about access before the email is proven.
    const code = await handleAccount(acct({ action: 'code', email: 'New+x@Acme.example' }), ON, s.accountDeps);
    expect(await code.json()).toEqual({ ok: true });
    const wrong = await handleAccount(acct({ action: 'verify', email: 'New+x@Acme.example', code: '000000' }), ON, s.accountDeps);
    expect(wrong.status).toBe(400);
    const r = await handleAccount(acct({ action: 'verify', email: 'New+x@Acme.example', code: codeIn(s.sent.at(-1)!) }), ON, s.accountDeps);
    expect(r.status).toBe(403);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.json()).toEqual({
      error: 'access_required',
      message: 'Bridge opens in small groups. Request access with this email and we reply within 2 working days.',
      request: '/request/?email=new%2Bx%40acme.example',
    });
    expect(await getAccount(s.redis, 'new+x@acme.example')).toBeNull();
  });

  it('lets an existing account in, always', async () => {
    const s = setup();
    expect((await signUp(s, OFF, 'old@acme.example')).status).toBe(200);
    const r = await signUp(s, ON, 'old@acme.example');
    expect(r.status).toBe(200);
    expect((await r.json()).created).toBe(false);
  });

  it('lets in an email the founder invited, for 30 days', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'ana@acme.example');
    expect((await handleAccess(access({ action: 'invite', email: 'ana@acme.example' }, { cookie }), ON, s.accessDeps)).status).toBe(200);
    s.tick(ACCESS_APPROVAL_MS - 60_000);
    const r = await signUp(s, ON, 'Ana@Acme.example');
    expect(r.status).toBe(200);
    expect((await r.json()).created).toBe(true);
  });

  it('turns down an approval that ran out, and a request still waiting or declined', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'late@acme.example');
    await request(s, 'wait@acme.example');
    await request(s, 'no@acme.example');
    await handleAccess(access({ action: 'invite', email: 'late@acme.example' }, { cookie }), ON, s.accessDeps);
    await handleAccess(access({ action: 'not-yet', email: 'no@acme.example' }, { cookie }), ON, s.accessDeps);
    s.tick(ACCESS_APPROVAL_MS + 1000);
    for (const e of ['late@acme.example', 'wait@acme.example', 'no@acme.example']) expect((await signUp(s, ON, e)).status).toBe(403);
  });

  it('lets in with a live access link, takes its use, marks the email approved; a second use is turned down', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'ana@acme.example');
    const { token, link } = await makeLink(s, cookie);
    const r = await signUp(s, ON, 'ana@acme.example', { access: token });
    expect(r.status).toBe(200);
    const stored = parseAccessLink(await s.redis.cmd('GET', accessLinkKey(sha256(token))))!;
    expect(stored).toMatchObject({ uses: 1, maxUses: 1, usedBy: ['ana@acme.example'], createdBy: 'Florian' });
    expect(link.id).toBe(sha256(token));
    expect(JSON.parse((await s.redis.cmd('GET', accessRequestKey('ana@acme.example'))) as string)).toMatchObject({ status: 'invited', approvedVia: 'link' });
    // Used up: the next person with the same link is turned down, and the link says so.
    expect((await signUp(s, ON, 'bob@acme.example', { access: token })).status).toBe(403);
    expect(await (await handleAccess(new Request(`${ORIGIN}/api/access?link=${token}`), ON, s.accessDeps)).json()).toEqual({ valid: false, reason: 'used' });
  });

  it('a link with several uses lets several people in, then stops; an expired or revoked link lets nobody in', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    const two = await makeLink(s, cookie, { maxUses: 2, days: 1 });
    expect((await signUp(s, ON, 'a@acme.example', { access: two.token })).status).toBe(200);
    expect((await signUp(s, ON, 'b@acme.example', { access: two.token })).status).toBe(200);
    expect((await signUp(s, ON, 'c@acme.example', { access: two.token })).status).toBe(403);
    const late = await makeLink(s, cookie, { days: 1 });
    const revoked = await makeLink(s, cookie);
    expect((await handleAccess(access({ action: 'revoke-link', id: revoked.link.id }, { cookie }), ON, s.accessDeps)).status).toBe(200);
    s.tick(2 * 24 * 3600e3);
    expect((await signUp(s, ON, 'd@acme.example', { access: late.token })).status).toBe(403);
    expect((await signUp(s, ON, 'e@acme.example', { access: revoked.token })).status).toBe(403);
    expect((await signUp(s, ON, 'f@acme.example', { access: 'nope' })).status).toBe(403);
    // An email let in otherwise keeps the link's use for someone else.
    const spare = await makeLink(s, cookie);
    expect((await signUp(s, { ...ON, BRIDGE_ADMIN_EMAILS: 'founder@bridge.test, founder2@bridge.test' }, 'founder2@bridge.test', { access: spare.token })).status).toBe(200);
    expect(parseAccessLink(await s.redis.cmd('GET', accessLinkKey(sha256(spare.token))))!.uses).toBe(0);
  });

  it('a link can never be used past its uses, even when two sign-ups race', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    const { token } = await makeLink(s, cookie);
    const both = await Promise.all([consumeAccessLink(s.redis, token, 'x@acme.example', s.now()), consumeAccessLink(s.redis, token, 'y@acme.example', s.now())]);
    expect(both.filter(Boolean)).toHaveLength(1);
  });

  it('keeps team invites working: an invited email, a member already, or a team open to the work domain', async () => {
    const s = setup();
    const token = 'T'.repeat(43);
    await inviteStoreOn(s.redis, s.now).put({ id: 'a'.repeat(16), repo: 'acme/ds', email: 'inv@acme.example', role: 'edit', invitedBy: 'sam', createdAt: '', sentAt: '', expiresAt: new Date(T0 + INVITE_TTL_MS).toISOString(), tokenHash: sha256(token) }, INVITE_TTL_MS / 1000);
    // Through the invite link (the code goes to the invited address)...
    expect((await handleAccount(acct({ action: 'code', invite: token }), ON, s.accountDeps)).status).toBe(200);
    expect((await handleAccount(acct({ action: 'verify', invite: token, code: codeIn(s.sent.at(-1)!) }), ON, s.accountDeps)).status).toBe(200);
    // ...or typing the invited email.
    await inviteStoreOn(s.redis, s.now).put({ id: 'b'.repeat(16), repo: 'acme/ds', email: 'typed@acme.example', role: 'view', invitedBy: 'sam', createdAt: '', sentAt: '', expiresAt: new Date(T0 + INVITE_TTL_MS).toISOString(), tokenHash: sha256('U'.repeat(43)) }, INVITE_TTL_MS / 1000);
    expect((await signUp(s, ON, 'typed@acme.example')).status).toBe(200);
    await memberStore(s.redis).put('acme/ds', { email: 'member@acme.example', name: 'Mo', role: 'edit', version: 1, addedBy: 'dana', at: '2026-11-01T00:00:00Z' });
    expect((await signUp(s, ON, 'member@acme.example')).status).toBe(200);
    await putDiscovery(s.redis, 'acme/ds', { domain: 'open.example', enabled: true, byGithubId: 1, byLogin: 'dana', at: '2026-11-01T00:00:00Z' });
    expect((await signUp(s, ON, 'colleague@open.example')).status).toBe(200);
    expect((await signUp(s, ON, 'stranger@closed.example')).status).toBe(403);
  });

  it('lets an address of BRIDGE_ADMIN_EMAILS in', async () => {
    const s = setup();
    expect((await signUp(s, ON, 'Founder@Bridge.test')).status).toBe(200);
  });
});

describe('the gate, on: GitHub', () => {
  it('turns a new GitHub account down the same way, with its primary email, and lets it in with a link', async () => {
    const s = setup();
    const r = await handleAccount(acct({ action: 'github', token: GH_TOKEN }), ON, s.accountDeps);
    expect(r.status).toBe(403);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.json()).toMatchObject({ error: 'access_required', request: '/request/?email=mia%40acme.example' });
    expect(await getAccount(s.redis, 'mia@acme.example')).toBeNull();
    const cookie = await founderCookie(s);
    const { token } = await makeLink(s, cookie);
    const ok = await handleAccount(acct({ action: 'github', token: GH_TOKEN, access: token }), ON, s.accountDeps);
    expect(ok.status).toBe(200);
    expect((await ok.json()).account).toMatchObject({ email: 'mia@acme.example', github: { login: 'mia-gh' } });
  });

  it('lets in on any verified email that is approved, and makes the account with that one', async () => {
    const s = setup({ emails: [{ email: 'mia@home.example', verified: true, primary: true }, { email: 'mia@acme.example', verified: true, primary: false }, { email: 'mia@unverified.example', verified: false, primary: false }] });
    const cookie = await founderCookie(s);
    await request(s, 'mia@acme.example');
    await handleAccess(access({ action: 'invite', email: 'mia@acme.example' }, { cookie }), ON, s.accessDeps);
    const r = await handleAccount(acct({ action: 'github', token: GH_TOKEN }), ON, s.accountDeps);
    expect(r.status).toBe(200);
    expect((await r.json()).account.email).toBe('mia@acme.example');
  });
});

describe('access links, public', () => {
  it('says who invited and until when, never an email; an unknown token is unknown', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    const { token } = await makeLink(s, cookie, { days: 14 });
    const r = await handleAccess(new Request(`${ORIGIN}/api/access?link=${token}`), ON, s.accessDeps);
    const text = await r.text();
    expect(JSON.parse(text)).toEqual({ valid: true, label: 'Ana at Acme', inviter: 'Florian', expiresAt: '2026-12-09T10:00:00.000Z' });
    expect(text).not.toContain('@');
    expect(await (await handleAccess(new Request(`${ORIGIN}/api/access?link=${'Z'.repeat(43)}`), ON, s.accessDeps)).json()).toEqual({ valid: false, reason: 'unknown' });
    expect(await (await handleAccess(new Request(`${ORIGIN}/api/access?link=x`), ON, s.accessDeps)).json()).toEqual({ valid: false, reason: 'unknown' });
    s.tick(15 * 24 * 3600e3);
    expect(await (await handleAccess(new Request(`${ORIGIN}/api/access?link=${token}`), ON, s.accessDeps)).json()).toEqual({ valid: false, reason: 'expired' });
    // Only the hash is kept.
    expect(s.redis.keys().join(' ')).not.toContain(token);
    expect(EXPORT_PATTERNS).toEqual(expect.arrayContaining(['bridge:access:link:*', 'bridge:access:links']));
  });
});

describe("the founder's queue", () => {
  it('refuses without a session (with a sign-in link), for anyone not a founder, and without the CSRF header', async () => {
    const s = setup();
    const nobody = await handleAccess(access({ action: 'list' }), ON, s.accessDeps);
    expect(nobody.status).toBe(401);
    expect(await nobody.json()).toMatchObject({ error: 'signin', signIn: '/signin/?next=%2Fadmin%2Faccess%2F' });
    const other = cookieOf(await signUp(s, OFF, 'someone@acme.example'));
    for (const action of ['list', 'invite', 'not-yet', 'create-link', 'revoke-link', 'people']) {
      const r = await handleAccess(access({ action, email: 'x@acme.example', label: 'x', id: 'a'.repeat(64) }, { cookie: other }), ON, s.accessDeps);
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe('not_admin');
    }
    const cookie = await founderCookie(s);
    const { 'x-bridge-account': _x, ...noCsrf } = H;
    expect((await handleAccess(new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: { ...noCsrf, cookie }, body: '{"action":"list"}' }), ON, s.accessDeps)).status).toBe(403);
    expect((await handleAccess(access({ action: 'list' }, { cookie, origin: 'https://evil.example' }), ON, s.accessDeps)).status).toBe(403);
  });

  it('lists waiting first, then those with a link, then the oldest; counts this week against the cap', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'old-nolink@acme.example');
    s.tick(1000);
    await request(s, 'new-link@acme.example', { where: 'https://github.com/acme/ds' });
    s.tick(1000);
    await request(s, 'done@acme.example', { where: 'https://github.com/acme/x' });
    await handleAccess(access({ action: 'invite', email: 'done@acme.example' }, { cookie }), ON, s.accessDeps);
    const { token } = await makeLink(s, cookie, { label: 'Leo at Globex' });
    const r = await handleAccess(access({ action: 'list' }, { cookie }), { ...ON, ACCESS_WEEKLY_CAP: '3' }, s.accessDeps);
    const body = await r.json();
    expect(body.requests.map((x: { email: string }) => x.email)).toEqual(['new-link@acme.example', 'old-nolink@acme.example', 'done@acme.example']);
    expect(body.waiting).toBe(2);
    expect(body.week).toEqual({ invited: 1, cap: 3 });
    expect(body.links).toHaveLength(1);
    expect(body.links[0]).toMatchObject({ label: 'Leo at Globex', uses: 0, maxUses: 1, state: 'valid', createdBy: 'Florian' });
    expect(JSON.stringify(body)).not.toContain(token);
    expect((await (await handleAccess(access({ action: 'list' }, { cookie }), ON, s.accessDeps)).json()).week.cap).toBe(5);
  });

  it('invite: approved now, the sign-in email with this address, escaped; over the cap it still goes', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'ana+x@acme.example', { company: 'Acme <script>' });
    for (let i = 0; i < 5; i++) {
      await request(s, `p${i}@acme.example`);
      await handleAccess(access({ action: 'invite', email: `p${i}@acme.example` }, { cookie }), ON, s.accessDeps);
    }
    const r = await handleAccess(access({ action: 'invite', email: 'ana+x@acme.example' }, { cookie }), ON, s.accessDeps);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.request).toMatchObject({ status: 'invited', approvedAt: new Date(s.now()).toISOString(), approvedVia: 'queue' });
    expect(body.week).toEqual({ invited: 6, cap: 5 });
    const mail = s.sent.at(-1)!;
    expect(mail.to).toBe('ana+x@acme.example');
    expect(mail.subject).toBe('Your Bridge access is open');
    // Asked on 25 November 2026, before the founding cutoff: the 30 days also keep the founding place (terms 10.1).
    expect(mail.text).toContain('Use this email to sign in. Accept within 30 days to keep your founding place.');
    expect(mail.text).toContain('https://bridge.test/signin/?email=ana%2Bx%40acme.example');
    expect(mail.html).toContain('Sign in to Bridge');
    expect(mail.html).toContain('href="https://bridge.test/signin/?email=ana%2Bx%40acme.example"');
    expect(mail.html).not.toContain('<script>');
    expect((await handleAccess(access({ action: 'invite', email: 'ghost@acme.example' }, { cookie }), ON, s.accessDeps)).status).toBe(404);
  });

  it('not yet: declined with the note, an honest email that escapes the note', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    await request(s, 'leo@globex.example');
    const r = await handleAccess(access({ action: 'not-yet', email: 'leo@globex.example', note: 'We open to teams with a <b>Storybook</b> first.' }, { cookie }), ON, s.accessDeps);
    expect(r.status).toBe(200);
    expect((await r.json()).request).toMatchObject({ status: 'declined', note: 'We open to teams with a <b>Storybook</b> first.' });
    const mail = s.sent.at(-1)!;
    expect(mail.to).toBe('leo@globex.example');
    expect(mail.text).toMatch(/^Not yet\./);
    expect(mail.text).toContain('We open to teams with a <b>Storybook</b> first.');
    expect(mail.text).toContain("We'll write again when Bridge opens wider. The demo stays open.");
    expect(mail.html).toContain('&lt;b&gt;Storybook&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Storybook');
    // Without a note: no quote.
    await request(s, 'kim@globex.example');
    await handleAccess(access({ action: 'not-yet', email: 'kim@globex.example' }, { cookie }), ON, s.accessDeps);
    expect(s.sent.at(-1)!.html).not.toContain('blockquote');
  });

  it('create-link checks its fields and answers the URL once; revoke drops it from the list', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    for (const bad of [{ label: ' ' }, { label: 'x', maxUses: 0 }, { label: 'x', maxUses: 51 }, { label: 'x', days: 91 }, { label: 'x', days: 1.5 }]) {
      expect((await handleAccess(access({ action: 'create-link', ...bad }, { cookie }), ON, s.accessDeps)).status).toBe(400);
    }
    const { url, link } = await makeLink(s, cookie);
    expect(url).toMatch(/^https:\/\/bridge\.test\/signin\/\?access=[A-Za-z0-9_-]{43}$/);
    expect(await s.redis.cmd('ZCARD', ACCESS_LINKS_KEY)).toBe(1);
    expect((await handleAccess(access({ action: 'revoke-link', id: link.id }, { cookie }), ON, s.accessDeps)).status).toBe(200);
    expect(await s.redis.cmd('ZCARD', ACCESS_LINKS_KEY)).toBe(0);
    expect((await handleAccess(access({ action: 'revoke-link', id: 'nope' }, { cookie }), ON, s.accessDeps)).status).toBe(400);
    expect(await s.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(0);
  });
});

describe("the founder's People", () => {
  it('refuses without a session and for anyone not a founder', async () => {
    const s = setup();
    const nobody = await handleAccess(access({ action: 'people' }), ON, s.accessDeps);
    expect(nobody.status).toBe(401);
    const other = cookieOf(await signUp(s, OFF, 'someone@acme.example'));
    const r = await handleAccess(access({ action: 'people' }, { cookie: other }), ON, s.accessDeps);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ error: 'not_admin' });
  });

  it('lists every account newest first with its teams and role, every team, no sub-key and no secret', async () => {
    const s = setup();
    const cookie = await founderCookie(s);
    s.tick(10 * 24 * 60 * 60 * 1000);
    await signUp(s, OFF, 'mia@acme.example', { name: 'Mia Chen' });
    s.tick(1000);
    await signUp(s, OFF, 'leo@globex.example', { name: 'Leo Park' });
    // Mia joins acme/ds as an admin email member; a team made in Bridge has a record and a date.
    const store = memberStore(s.redis);
    await store.put('acme/ds', { email: 'mia@acme.example', name: 'Mia Chen', role: 'admin', version: 1, addedBy: 'florian', at: new Date(s.now()).toISOString() });
    await s.redis.cmd('SADD', 'bridge:account:teams:mia@acme.example', 'acme/ds');
    await s.redis.cmd('SET', 'bridge:team:rec:a1b2c3d4e5f60718', JSON.stringify({ id: 'a1b2c3d4e5f60718', name: 'Globex UI', createdBy: 'leo@globex.example', createdAt: new Date(s.now()).toISOString(), repo: null, storybook: null }));
    // Sub-keys that hold an email are never read as accounts.
    await s.redis.cmd('SET', 'bridge:account:gh:77', 'mia@acme.example');
    await s.redis.cmd('SET', 'bridge:account:code:' + 'f'.repeat(64), JSON.stringify({ email: 'x@acme.example', id: 'x', name: 'x', version: 1 }));
    await s.redis.cmd('SET', 'bridge:account:canon:x@acme.example', JSON.stringify({ email: 'x@acme.example', id: 'y', name: 'y', version: 1 }));
    const r = await handleAccess(access({ action: 'people' }, { cookie }), ON, s.accessDeps);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.accounts.map((a: { email: string }) => a.email)).toEqual(['leo@globex.example', 'mia@acme.example', 'founder@bridge.test']);
    expect(body).toMatchObject({ total: 3, truncated: false, joinedWeek: 2 });
    expect(body.accounts[1]).toEqual({ name: 'Mia Chen', email: 'mia@acme.example', github: null, createdAt: expect.any(String), teams: [{ name: expect.any(String), role: 'admin', via: 'email' }] });
    expect(body.teams).toEqual(
      expect.arrayContaining([
        { name: 'Globex UI', repo: null, members: 0, createdAt: new Date(s.now()).toISOString() },
        expect.objectContaining({ repo: 'acme/ds', members: 1, createdAt: null }),
      ]),
    );
    // Dated teams first.
    expect(body.teams[0].name).toBe('Globex UI');
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/"version"|"id"|code|secret|"tz"/);
  });
});

describe('queue rules (lib/access-request.ts)', () => {
  it('weeks start on Monday 00:00 UTC; the link states; the sort', () => {
    expect(new Date(isoWeekStart(T0)).toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(new Date(isoWeekStart(Date.parse('2026-11-29T23:59:00Z'))).toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(new Date(isoWeekStart(Date.parse('2026-11-30T00:00:00Z'))).toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(invitedThisWeek([{ status: 'invited', approvedAt: '2026-11-22T23:00:00Z' }, { status: 'invited', approvedAt: '2026-11-24T08:00:00Z' }, { status: 'invited', approvedAt: '2026-11-24T08:00:00Z', approvedVia: 'link' }], T0)).toBe(1);
    expect(linkStateOf({ expiresAt: '2026-11-25T10:00:01Z', maxUses: 1, uses: 0 }, T0)).toBe('valid');
    expect(linkStateOf({ expiresAt: '2026-11-25T10:00:00Z', maxUses: 1, uses: 0 }, T0)).toBe('expired');
    expect(linkStateOf({ expiresAt: '2026-12-25T10:00:00Z', maxUses: 2, uses: 2 }, T0)).toBe('used');
    const q = sortQueue([
      { status: 'invited', where: 'x', at: '2026-11-01T00:00:00Z' },
      { status: 'pending', where: '', at: '2026-11-02T00:00:00Z' },
      { status: 'pending', where: 'x', at: '2026-11-03T00:00:00Z' },
      { status: 'pending', where: '', at: '2026-11-01T00:00:00Z' },
    ]);
    expect(q.map((r) => `${r.status}:${r.where}:${r.at.slice(8, 10)}`)).toEqual(['pending:x:03', 'pending::01', 'pending::02', 'invited:x:01']);
  });
});
