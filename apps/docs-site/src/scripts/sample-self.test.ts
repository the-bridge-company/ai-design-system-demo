// @vitest-environment jsdom
// Who is signed in, for the sample team's first paint (scripts/sample-self.ts): known at once from this browser, a
// signed-out visitor at once, or not known yet, then found out from the account or one check of the GitHub sign-in.
// The network is mocked; the token below is a fake.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenFingerprint } from '../lib/token-session';
import { setAccountFetch } from './account-session';
import { forgetSampleSelf, resolveSampleSelf, sampleIdentityNow, sampleSelf } from './sample-self';
import { castOn } from './demo-cast';

const SAMPLE = 'acme-design-demo/bridge-demo-ds';
const TOKEN = 'ghu_fake_token_for_tests';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let account: unknown = null;
let user: Response = json(200, { login: 'peterbono', name: 'Florian', avatar_url: 'https://avatars.githubusercontent.com/u/1' });
const calls: string[] = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  forgetSampleSelf();
  calls.length = 0;
  account = null;
  user = json(200, { login: 'peterbono', name: 'Florian', avatar_url: 'https://avatars.githubusercontent.com/u/1' });
  setAccountFetch(async (url) => (calls.push(url), json(200, { available: true, account })));
  vi.stubGlobal('fetch', async (url: string) => (calls.push(url), user.clone()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccountFetch(null);
});

describe('the sample team before it paints anyone', () => {
  it('a browser without any sign-in hint is a signed-out visitor at once: Dana, with See it as', () => {
    expect(sampleIdentityNow()).toBe('out');
    expect(castOn(SAMPLE)?.key).toBe('dana');
  });

  it('a GitHub sign-in checked here, or an account kept here: the person at once', () => {
    localStorage.setItem('bridge.github.token', TOKEN);
    localStorage.setItem('bridge.github.check', JSON.stringify({ fp: tokenFingerprint(TOKEN), at: Date.now(), ok: true, viewer: { login: 'peterbono', name: 'Florian', avatar_url: '' } }));
    expect(sampleIdentityNow()).toBe('self');
    expect(sampleSelf()).toMatchObject({ name: 'Florian', login: 'peterbono' });
    expect(castOn(SAMPLE)).toBeNull();
  });

  it('an account never read here: waits (nobody played), then the person once the account answers', async () => {
    localStorage.setItem('bridge.accountTeamNames', JSON.stringify({ 'acme/ds': 'Acme' }));
    expect(sampleIdentityNow()).toBe('pending');
    expect(castOn(SAMPLE)).toBeNull();
    account = { email: 'florian@example.com', name: 'Florian', github: { login: 'peterbono', id: 1 }, teams: [] };
    expect(await resolveSampleSelf()).toMatchObject({ name: 'Florian', email: 'florian@example.com', login: 'peterbono' });
    expect(sampleIdentityNow()).toBe('self');
  });

  it('an account trace but nobody signed in: Dana once the account says so', async () => {
    localStorage.setItem('bridge.accountTeamNames', JSON.stringify({ 'acme/ds': 'Acme' }));
    expect(await resolveSampleSelf()).toBeNull();
    expect(sampleIdentityNow()).toBe('out');
    expect(castOn(SAMPLE)?.key).toBe('dana');
  });

  it('a GitHub sign-in never checked: checks it once, as the real team does, keeps the check, never the token elsewhere', async () => {
    localStorage.setItem('bridge.github.token', TOKEN);
    expect(sampleIdentityNow()).toBe('pending');
    expect(await resolveSampleSelf()).toMatchObject({ name: 'Florian', login: 'peterbono' });
    expect(calls).toContain('https://api.github.com/user');
    const check = JSON.parse(localStorage.getItem('bridge.github.check')!);
    expect(check).toMatchObject({ fp: tokenFingerprint(TOKEN), ok: true, viewer: { login: 'peterbono' } });
    expect(JSON.stringify(check)).not.toContain(TOKEN);
    expect(localStorage.getItem('bridge.account.self')).toBeNull();
  });

  it('a refused pasted token: kept refused, and the visitor plays Dana', async () => {
    localStorage.setItem('bridge.github.token', TOKEN);
    user = json(401, { message: 'Bad credentials' });
    expect(await resolveSampleSelf()).toBeNull();
    expect(JSON.parse(localStorage.getItem('bridge.github.check')!)).toMatchObject({ ok: false });
    expect(castOn(SAMPLE)?.key).toBe('dana');
  });
});
