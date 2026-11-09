// @vitest-environment jsdom
// The sample team (lib/demo.ts SAMPLE_REPO, Acme Design) reads the same for everyone: someone signed in with GitHub
// who is not on it sees exactly what a signed-out visitor sees (Dana, the sample data), from the first paint. Their own
// name, changes, role and remembered counts never mix in. On a real team, the GitHub sign-in counts as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenFingerprint } from '../lib/token-session';
import { setContributeFetch } from './contribute-session';
import { currentContributor, getToken, linkedGitHubRole, onSampleTeam, readAppSession, signedInWithGitHub, studioFetch } from './github-session';
import { rememberedMine, rememberMine } from './needs-you';
import { greeting, homeState } from '../lib/home-model';

const SAMPLE = '/studio/acme-design-demo/bridge-demo-ds/';
const TOKEN = 'ghu_peterbono_token_aaaaaaaa';
const DANA = { email: 'dana@acme.example', name: 'Dana', role: 'admin', visitor: true };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let calls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  calls = [];
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.setAttribute('data-hosted', '');
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return json(200, {});
  });
  setContributeFetch(f);
  vi.stubGlobal('fetch', f);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setContributeFetch(null);
  document.documentElement.removeAttribute('data-hosted');
});

/** The browser of someone signed in with GitHub: their token, its last check (their name), a renewable sign-in. */
function signInWithGitHub() {
  localStorage.setItem('bridge.github.token', TOKEN);
  localStorage.setItem('bridge.github.check', JSON.stringify({ fp: tokenFingerprint(TOKEN), at: Date.now(), ok: true, viewer: { login: 'peterbono', name: 'Florian', avatar_url: '' }, write: true }));
  localStorage.setItem('bridge.github.app', JSON.stringify({ kind: 'app', expiresAt: Date.now() + 3_600_000, refreshToken: 'r', refreshExpiresAt: Date.now() + 86_400_000 }));
}

/** The sample team's visitor session, as the server sets it for a signed-out visitor. */
const visitAsDana = () => localStorage.setItem('bridge.contribute.member:acme-design-demo/bridge-demo-ds', JSON.stringify(DANA));

/** What every Studio page of the team builds on: who reads, with which token, and how the home greets them. */
async function model() {
  const who = currentContributor();
  await studioFetch('https://api.github.com/repos/acme-design-demo/bridge-demo-ds/pulls?state=open');
  const call = calls.at(-1)!;
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  return {
    token: getToken(),
    github: signedInWithGitHub(),
    renewable: readAppSession() !== null,
    who,
    linked: linkedGitHubRole(),
    readsThrough: call.url.split('&gh=')[0],
    carriesGitHubToken: Object.values(headers).some((v) => String(v).includes(TOKEN)),
    greeting: greeting(19, who?.name ?? null),
    home: homeState({ signedIn: Boolean(who), loading: false, needs: 0, branches: 0 }),
  };
}

describe('the sample team, signed in with GitHub or not', () => {
  it('is the same model for a signed-in non-member and a signed-out visitor', async () => {
    history.replaceState(null, '', SAMPLE);
    expect(onSampleTeam()).toBe(true);
    visitAsDana();
    const visitor = await model();
    signInWithGitHub();
    const signedIn = await model();
    expect(signedIn).toEqual(visitor);
    expect(visitor.who).toMatchObject({ name: 'Dana', visitor: true });
    expect(visitor.greeting).toBe('Good evening, Dana.');
    expect(visitor.github).toBe(false);
    expect(visitor.carriesGitHubToken).toBe(false);
  });

  it('keeps the GitHub sign-in on a real team', async () => {
    history.replaceState(null, '', '/studio/acme/ds/');
    expect(onSampleTeam()).toBe(false);
    signInWithGitHub();
    expect(getToken()).toBe(TOKEN);
    expect(signedInWithGitHub()).toBe(true);
    expect(readAppSession()).not.toBeNull();
  });

  it("never shows another team's remembered review count", () => {
    history.replaceState(null, '', '/studio/acme/ds/');
    rememberMine(10);
    expect(rememberedMine()).toBe(10);
    history.replaceState(null, '', SAMPLE);
    expect(rememberedMine()).toBeNull();
    // A count kept before counts named their team belongs to no team.
    localStorage.setItem('bridge.reviews.mine', JSON.stringify({ n: 4, at: new Date().toISOString(), viewer: null }));
    expect(rememberedMine()).toBeNull();
  });
});
