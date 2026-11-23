// The /api/access Vercel function (api/access/index.ts) with an in-memory Redis and a fake email: the request is
// checked and stored with its first time kept, capped per network, email and site, the requester and the founders
// get their emails (escaped), CSRF and configuration refusals, and the backup takes the requests.
import { describe, expect, it } from 'vitest';
import { memoryRedis } from '../../api/_lib/redis';
import type { EmailMessage, EmailSender } from '../../api/_lib/email';
import { ACCESS_QUEUE_KEY, accessRequestKey, adminEmails } from '../../api/_lib/access';
import { ACCESS_LIMITS_DAY, handleAccess, type AccessDeps } from '../../api/access/index';
import { EXPORT_PATTERNS } from '../../api/account/index';
import { CONTACT_EMAIL } from './pricing';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const T0 = Date.parse('2026-11-23T10:00:00Z');
const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40), PUBLIC_SITE_URL: 'https://bridgedesignsystem.com' };
const H = { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-account': '1', 'sec-fetch-site': 'same-origin', 'x-real-ip': '203.0.113.7' };
const GOOD = { action: 'request', email: 'Ana@Acme.com', company: 'Acme', where: 'https://github.com/acme/ds', fix: 'Our tokens drift from Figma' };

function setup(opts: { failEmail?: boolean } = {}) {
  let now = T0;
  const redis = memoryRedis(() => now);
  const sent: EmailMessage[] = [];
  const warnings: string[] = [];
  const email: EmailSender = {
    send: async (m) => {
      if (opts.failEmail) throw new Error('email provider answered 500');
      sent.push(m);
    },
  };
  const deps: AccessDeps = { fetch: async () => new Response(null, { status: 599 }), now: () => now, redis, email, warn: (m) => void warnings.push(m) };
  return { redis, sent, warnings, deps, tick: (ms: number) => (now += ms) };
}

const post = (body: unknown, extra: Record<string, string> = {}) => new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: { ...H, ...extra }, body: JSON.stringify(body) });

describe('POST /api/access', () => {
  it('stores a request, queues it, and answers when it was sent', async () => {
    const s = setup();
    const r = await handleAccess(post(GOOD), ENV, s.deps);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, at: '2026-11-23T10:00:00.000Z' });
    const stored = JSON.parse((await s.redis.cmd('GET', accessRequestKey('ana@acme.com'))) as string);
    expect(stored).toEqual({ email: 'Ana@Acme.com', company: 'Acme', where: 'https://github.com/acme/ds', fix: 'Our tokens drift from Figma', at: '2026-11-23T10:00:00.000Z', status: 'pending' });
    expect(accessRequestKey(' Ana@Acme.COM ')).toBe('bridge:access:request:ana@acme.com');
    expect(await s.redis.cmd('ZSCORE', ACCESS_QUEUE_KEY, 'ana@acme.com')).toBe(String(T0));
  });

  it('keeps the first time when the same email asks again, updates the rest and says so', async () => {
    const s = setup();
    await handleAccess(post(GOOD), ENV, s.deps);
    s.tick(3 * 3600e3);
    const r = await handleAccess(post({ ...GOOD, email: 'ana@acme.com', company: 'Acme Inc', where: '', fix: 'Docs out of date' }), ENV, s.deps);
    expect(await r.json()).toEqual({ ok: true, already: true, at: '2026-11-23T10:00:00.000Z' });
    const stored = JSON.parse((await s.redis.cmd('GET', accessRequestKey('ana@acme.com'))) as string);
    expect(stored).toMatchObject({ company: 'Acme Inc', where: '', fix: 'Docs out of date', at: '2026-11-23T10:00:00.000Z', status: 'pending' });
    expect(await s.redis.cmd('ZSCORE', ACCESS_QUEUE_KEY, 'ana@acme.com')).toBe(String(T0));
    expect(await s.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(1);
    // The confirmation goes again.
    expect(s.sent.filter((m) => m.subject === 'Your Bridge request is in')).toHaveLength(2);
  });

  it('refuses each field in the page words, and stores nothing', async () => {
    const s = setup();
    const r = await handleAccess(post({ action: 'request', email: 'nope', company: '', where: 'http://acme.com', fix: ' ' }), ENV, s.deps);
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toMatchObject({ error: 'invalid', message: 'Enter a work email, like ana@acme.com.' });
    expect(body.fields).toEqual({
      email: 'Enter a work email, like ana@acme.com.',
      company: 'Add your company name.',
      where: 'Enter a full link, starting with https://',
      fix: 'Tell us in a few words what you want to fix first.',
    });
    expect(await s.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(0);
    expect(s.sent).toHaveLength(0);
    expect((await handleAccess(post({ ...GOOD, action: 'nope' }), ENV, s.deps)).status).toBe(400);
    expect((await handleAccess(post({ ...GOOD, company: 'x'.repeat(121) }), ENV, s.deps)).status).toBe(400);
    expect((await handleAccess(post({ ...GOOD, fix: 'x'.repeat(301) }), ENV, s.deps)).status).toBe(400);
    expect((await handleAccess(post({ ...GOOD, where: `https://acme.com/${'x'.repeat(300)}` }), ENV, s.deps)).status).toBe(400);
    expect((await handleAccess(new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: H, body: 'x'.repeat(5000) }), ENV, s.deps)).status).toBe(413);
  });

  it('needs X-Bridge-Account, JSON and an Origin of this site', async () => {
    const s = setup();
    const { 'x-bridge-account': _x, ...noHeader } = H;
    expect((await handleAccess(new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: noHeader, body: JSON.stringify(GOOD) }), ENV, s.deps)).status).toBe(403);
    const { origin: _o, ...noOrigin } = H;
    expect((await handleAccess(new Request(`${ORIGIN}/api/access`, { method: 'POST', headers: noOrigin, body: JSON.stringify(GOOD) }), ENV, s.deps)).status).toBe(403);
    expect((await handleAccess(post(GOOD, { origin: 'https://evil.example' }), ENV, s.deps)).status).toBe(403);
    expect((await handleAccess(post(GOOD, { 'sec-fetch-site': 'cross-site' }), ENV, s.deps)).status).toBe(403);
    expect((await handleAccess(post(GOOD, { 'content-type': 'text/plain' }), ENV, s.deps)).status).toBe(415);
    expect((await handleAccess(new Request(`${ORIGIN}/api/access`, { headers: { host: HOST } }), ENV, s.deps)).status).toBe(405);
    expect(await s.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(0);
  });

  it('answers 503 with a way out when storage or the secret is missing', async () => {
    const s = setup();
    for (const [env, deps] of [
      [ENV, { fetch: s.deps.fetch }],
      [{ LIBRARY_SESSION_SECRET: 'short' }, s.deps],
    ] as const) {
      const r = await handleAccess(post(GOOD), env, deps);
      expect(r.status).toBe(503);
      expect((await r.json()).message).toContain(CONTACT_EMAIL);
    }
  });

  it('answers 503 when storage fails while saving', async () => {
    const s = setup();
    const broken = { cmd: async () => null, pipe: async (cmds: unknown[][]) => (cmds[0]![0] === 'SET' ? Promise.reject(new Error('down')) : cmds.map(() => 1)) };
    const r = await handleAccess(post(GOOD), ENV, { ...s.deps, redis: broken });
    expect(r.status).toBe(503);
    expect((await r.json()).message).toBe('Bridge could not save your request. Try again in a minute.');
    expect(s.sent).toHaveLength(0);
  });

  it('caps requests per email (3), per network (10) and for the site (200) a day, with Retry-After', async () => {
    const s = setup();
    for (let i = 0; i < ACCESS_LIMITS_DAY.email; i++) expect((await handleAccess(post(GOOD), ENV, s.deps)).status).toBe(200);
    const r = await handleAccess(post(GOOD), ENV, s.deps);
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: 'limit', message: 'You sent several requests today. Try again tomorrow.' });
    expect(Number(r.headers.get('retry-after'))).toBe(14 * 3600);
    // Another email from the same network still goes, up to 10 for the network.
    for (let i = 0; i < ACCESS_LIMITS_DAY.ip - ACCESS_LIMITS_DAY.email; i++) expect((await handleAccess(post({ ...GOOD, email: `p${i}@acme.com` }), ENV, s.deps)).status).toBe(200);
    expect((await handleAccess(post({ ...GOOD, email: 'late@acme.com' }), ENV, s.deps)).status).toBe(429);
    // The next UTC day starts again.
    s.tick(14 * 3600e3);
    expect((await handleAccess(post(GOOD), ENV, s.deps)).status).toBe(200);
    // The site cap, overridable from the env.
    const t = setup();
    const env = { ...ENV, ACCESS_MAX_SITE_DAY: '2' };
    expect((await handleAccess(post({ ...GOOD, email: 'a@acme.com' }, { 'x-real-ip': '1.1.1.1' }), env, t.deps)).status).toBe(200);
    expect((await handleAccess(post({ ...GOOD, email: 'b@acme.com' }, { 'x-real-ip': '2.2.2.2' }), env, t.deps)).status).toBe(200);
    expect((await handleAccess(post({ ...GOOD, email: 'c@acme.com' }, { 'x-real-ip': '3.3.3.3' }), env, t.deps)).status).toBe(429);
    expect(await t.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(2);
  });

  it('never keeps an email or a network in clear in its counters', async () => {
    const s = setup();
    await handleAccess(post(GOOD), ENV, s.deps);
    const keys = ((await s.redis.cmd('SCAN', '0', 'MATCH', 'bridge:access:count:*', 'COUNT', 100)) as [string, string[]])[1];
    expect(keys).toHaveLength(3);
    for (const k of keys) expect(k).not.toMatch(/acme|203\.0\.113/);
  });

  it('sends the requester the confirmation, with the demo link and replies to the contact address', async () => {
    const s = setup();
    await handleAccess(post(GOOD), ENV, s.deps);
    expect(s.sent).toHaveLength(1);
    const [m] = s.sent;
    expect(m!.to).toBe('Ana@Acme.com');
    expect(m!.subject).toBe('Your Bridge request is in');
    expect(m!.replyTo).toBe(CONTACT_EMAIL);
    expect(m!.text).toBe(
      [
        'Thanks. We read every request and reply within 2 working days.',
        '',
        'Until then, the demo is open: https://bridgedesignsystem.com/studio/acme-design-demo/bridge-demo-ds/',
        '',
        'Reply to this email if you have a question.',
      ].join('\n'),
    );
    expect(m!.html).toContain('href="https://bridgedesignsystem.com/studio/acme-design-demo/bridge-demo-ds/"');
    for (const t of [m!.text, m!.html]) expect(t).not.toMatch(/—|founding/i);
  });

  it('tells the founders of BRIDGE_ADMIN_EMAILS, every field escaped, replies going to the requester', async () => {
    const s = setup();
    const env = { ...ENV, BRIDGE_ADMIN_EMAILS: 'florian@bridge.com, ops@bridge.com, nope' };
    await handleAccess(post({ ...GOOD, company: '<b>Acme</b> & "Co"', fix: '<script>alert(1)</script>' }), env, s.deps);
    const notices = s.sent.filter((m) => m.to !== 'Ana@Acme.com');
    expect(notices.map((m) => m.to)).toEqual(['florian@bridge.com', 'ops@bridge.com']);
    const n = notices[0]!;
    expect(n.subject).toBe('Access request: <b>Acme</b> & "Co"');
    expect(n.replyTo).toBe('Ana@Acme.com');
    expect(n.text).toContain('Ana@Acme.com from <b>Acme</b> & "Co" asked for access to Bridge.');
    expect(n.text).toContain('Design system: https://github.com/acme/ds');
    expect(n.text).toContain('First request: 23 November 2026');
    expect(n.html).not.toContain('<script>');
    expect(n.html).not.toContain('<b>Acme</b>');
    expect(n.html).toContain('&lt;b&gt;Acme&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(n.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // One button straight to the request in the queue; never a link that decides on its own.
    expect(n.text).toContain('Review the request: https://bridgedesignsystem.com/admin/access/?request=ana%40acme.com');
    expect(n.html).toContain('href="https://bridgedesignsystem.com/admin/access/?request=ana%40acme.com"');
    expect(n.html).toContain('>Review the request</a>');
    expect(n.html).not.toMatch(/action=|invite\?|approve/i);
    // Asking again: the notice says it is an update.
    await handleAccess(post(GOOD), env, s.deps);
    expect(s.sent.at(-1)!.subject).toBe('Access request updated: Acme');
  });

  it('sends no notice without BRIDGE_ADMIN_EMAILS', async () => {
    const s = setup();
    await handleAccess(post(GOOD), { ...ENV, BRIDGE_ADMIN_EMAILS: '' }, s.deps);
    expect(s.sent.map((m) => m.to)).toEqual(['Ana@Acme.com']);
    expect(adminEmails(undefined)).toEqual([]);
    expect(adminEmails(' A@B.co ,a@b.co,, x ')).toEqual(['a@b.co']);
  });

  it('keeps the request when an email fails, and says so without the address', async () => {
    const s = setup({ failEmail: true });
    const r = await handleAccess(post(GOOD), { ...ENV, BRIDGE_ADMIN_EMAILS: 'florian@bridge.com' }, s.deps);
    expect(r.status).toBe(200);
    expect(await s.redis.cmd('ZCARD', ACCESS_QUEUE_KEY)).toBe(1);
    expect(s.warnings).toHaveLength(2);
    for (const w of s.warnings) expect(w).not.toMatch(/@/);
  });

  it('keeps the request without an email provider', async () => {
    const s = setup();
    const { email: _e, ...noEmail } = s.deps;
    const r = await handleAccess(post(GOOD), ENV, noEmail);
    expect(r.status).toBe(200);
    expect(s.warnings).toEqual(['access: RESEND_API_KEY or INVITE_EMAIL_FROM is not set, no email sent']);
  });

  it('puts the requests and the queue in the daily backup, never the counters', () => {
    expect(EXPORT_PATTERNS).toContain('bridge:access:request:*');
    expect(EXPORT_PATTERNS).toContain(ACCESS_QUEUE_KEY);
    expect(EXPORT_PATTERNS.some((p) => 'bridge:access:count:ip:x:2026-11-23'.startsWith(p.replace('*', '')))).toBe(false);
  });
});
