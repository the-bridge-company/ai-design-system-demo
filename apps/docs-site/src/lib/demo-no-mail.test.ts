// The sample team's people are not real: they live under acme.example (never routed), their old acme.design records
// move there, no provider mails a reserved domain, and nothing about the sample team is ever mailed.
import { describe, expect, it } from 'vitest';
import { brevoSender, neverMailed, resendSender, type EmailMessage, type EmailSender } from '../../api/_lib/email';
import { branchKey, issueKey, mineKey } from '../../api/_lib/former-member';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { DEMO_MEMBERS, DEMO_PM, DEMO_VISITOR_EMAIL, seedDemoTeam } from '../../api/_lib/demo-members';
import { deliverNotices, digestFor, type NotifyDeps, watchWrites, itemWrite } from '../../api/_lib/notify';
import { pmOf } from '../../api/_lib/product-pm';
import type { Notice } from '../../api/_lib/notify-events';

const DEMO = 'acme-design-demo/bridge-demo-ds';
const T0 = Date.parse('2026-11-08T10:00:00Z');
const msg = (to: string): EmailMessage => ({ to, subject: 's', text: 't', html: '<p>t</p>' });

describe('the sample team lives under a reserved domain', () => {
  it('every demo address is @acme.example', () => {
    for (const m of DEMO_MEMBERS) expect(m.email).toMatch(/@acme\.example$/);
    expect(DEMO_VISITOR_EMAIL).toBe('dana@acme.example');
    expect(DEMO_PM.email).toBe('ann@acme.example');
  });
});

describe('no provider mails a reserved domain', () => {
  it('knows the reserved domains', () => {
    for (const to of ['dana@acme.example', 'a@b.test', 'x@contributors.bridge.invalid', 'a@host.localhost', 'a@localhost', 'a@example.com', 'a@mail.example.org', 'a@EXAMPLE.NET', 'nobody', 'a@']) expect(neverMailed(to), to).toBe(true);
    for (const to of ['ann@acme.design', 'florian@gmail.com', 'a@notexample.com', 'a@example.co']) expect(neverMailed(to), to).toBe(false);
  });

  it('Resend and Brevo send nothing there, and still send elsewhere', async () => {
    const calls: string[] = [];
    const f = async (url: string) => {
      calls.push(url);
      return new Response('{}', { status: 200 });
    };
    for (const s of [resendSender('k', 'Bridge <a@bridge.dev>', f), brevoSender('k', 'Bridge <a@bridge.dev>', f)]) {
      await s.send(msg('leo@acme.example'));
      await s.send(msg('someone@example.com'));
    }
    expect(calls).toEqual([]);
    await resendSender('k', 'Bridge <a@bridge.dev>', f).send(msg('real@company.io'));
    expect(calls).toEqual(['https://api.resend.com/emails']);
  });
});

describe('nothing about the sample team is mailed', () => {
  it('a notice on the sample team is skipped, and its kept notices never reach a summary', async () => {
    const redis = memoryRedis(() => T0);
    const sent: EmailMessage[] = [];
    const sender: EmailSender = { send: async (m) => void sent.push(m) };
    const d: NotifyDeps = { redis, sender, secret: 's'.repeat(40), origin: 'https://bridge.example.com', now: () => T0, warn: () => undefined, random: (n) => new Uint8Array(n).fill(1) };
    // A real person on the sample team (an address that would be mailed): still nothing.
    await memberStore(redis).put(DEMO, { email: 'real@company.io', name: 'Real', role: 'edit', version: 1, addedBy: 'x', at: '' });
    await redis.pipe([...watchWrites([{ repo: DEMO, meta: { team: DEMO, kind: 'team' } }]), ['SET', issueKey(DEMO, 12), 'real@company.io'], itemWrite(DEMO, 12, { title: 'Card' })]);
    const n: Notice = { kind: 'question', repo: DEMO, items: [12], title: 'Card', actor: { login: 'ana', id: 42 }, copy: null, scope: 'any' };
    expect(await deliverNotices([n], d, 'e1')).toEqual([{ kind: 'question', status: 'skipped', reason: 'sample-team' }]);
    expect(sent).toEqual([]);
    await redis.cmd('ZADD', 'bridge:notify:digest:real@company.io', T0, JSON.stringify({ id: 'x', kind: 'question', title: 'Card', href: '/', at: T0, team: 'Acme', teamRepo: DEMO, actor: 'ana' }));
    expect((await digestFor(d, 'real@company.io')).items).toEqual([]);
  });
});

describe('seeding moves the old acme.design records', () => {
  it('rewrites each member under acme.example, keeps role, lead and PM, moves what they own, and forgets the old keys', async () => {
    const redis = memoryRedis(() => T0);
    const members = memberStore(redis);
    for (const m of DEMO_MEMBERS) {
      const old = m.email.replace('@acme.example', '@acme.design');
      await members.put(DEMO, { email: old, name: m.name, role: m.role, version: 3, ...(m.lead ? { lead: true } : {}), addedBy: 'peterbono', at: '2026-11-01T00:00:00.000Z' });
    }
    await redis.pipe([
      ['SET', issueKey(DEMO, 51), 'leo@acme.design'],
      ['SET', branchKey('acme-design-demo/acme-account-design', 'explore/x'), 'leo@acme.design'],
      ['SADD', mineKey(DEMO, 'leo@acme.design'), 'i:51'],
      ['SADD', mineKey('acme-design-demo/acme-account-design', 'leo@acme.design'), 'b:explore/x'],
      ['ZADD', 'bridge:notify:digest:leo@acme.design', T0, '{}'],
      ['ZADD', 'bridge:notify:due', T0, 'leo@acme.design'],
      ['SET', `bridge:notify:soon:leo@acme.design:${DEMO}#51`, '1'],
      ['SET', `bridge:contrib:count:${DEMO}:leo@acme.design:2026-11-08`, '4'],
      ['SET', 'bridge:product-pm-unrelated', 'kept'],
    ]);
    const r = await seedDemoTeam({ members, redis }, T0);
    expect(r.migrated).toEqual(DEMO_MEMBERS.map((m) => m.email));
    expect(r.added).toEqual([]);
    expect(r.pm).toBe('set');
    expect((await members.list(DEMO)).map((m) => m.email).sort()).toEqual(DEMO_MEMBERS.map((m) => m.email).sort());
    expect(await members.get(DEMO, 'dana@acme.example')).toMatchObject({ name: 'Dana', role: 'admin', lead: true, version: 4, addedBy: 'peterbono', at: '2026-11-01T00:00:00.000Z' });
    expect(await members.get(DEMO, 'dana@acme.design')).toBeNull();
    expect((await pmOf(redis, DEMO, 'account'))?.email).toBe('ann@acme.example');
    expect(await redis.cmd('GET', issueKey(DEMO, 51))).toBe('leo@acme.example');
    expect(await redis.cmd('GET', branchKey('acme-design-demo/acme-account-design', 'explore/x'))).toBe('leo@acme.example');
    expect(await redis.cmd('SMEMBERS', mineKey(DEMO, 'leo@acme.example'))).toEqual(['i:51']);
    for (const k of [mineKey(DEMO, 'leo@acme.design'), 'bridge:notify:digest:leo@acme.design', `bridge:notify:soon:leo@acme.design:${DEMO}#51`, `bridge:contrib:count:${DEMO}:leo@acme.design:2026-11-08`, 'bridge:account:teams:leo@acme.design']) {
      expect(await redis.cmd('GET', k), k).toBeNull();
      expect(await redis.cmd('SMEMBERS', k), k).toEqual([]);
    }
    expect(await redis.cmd('ZSCORE', 'bridge:notify:due', 'leo@acme.design')).toBeNull();
    expect(await redis.cmd('GET', 'bridge:product-pm-unrelated')).toBe('kept');
    // Again: nothing left to move.
    const again = await seedDemoTeam({ members, redis }, T0 + 1000);
    expect(again).toMatchObject({ migrated: [], forgot: 0, added: [], updated: [], pm: 'kept' });
  });
});
