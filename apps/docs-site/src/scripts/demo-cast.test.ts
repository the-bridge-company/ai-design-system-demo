// @vitest-environment jsdom
// See it as on the sample team: the visitor's read-only session (Dana, from the server) plays the person picked, for
// every script that asks who the page is for. The network is mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTRIB_TOKEN } from '../lib/contribute';
import { CAST_STORAGE_KEY } from '../lib/demo-cast';
import { contributeInfo, contributeMine, contributorFor, holdsContributeSession, playedGitHub, playsSomeoneElse, setContributeFetch } from './contribute-session';
import { currentContributor, getToken } from './github-session';
import { castOn } from './demo-cast';

const SAMPLE = 'acme-design-demo/bridge-demo-ds';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DANA = { email: 'dana@acme.example', name: 'Dana', role: 'admin', ref: 'a399f73add3dbb2d', lead: true, decides: true, visitor: true };
const visit = () => localStorage.setItem(`bridge.contribute.member:${SAMPLE}`, JSON.stringify(DANA));
let answer: (url: string) => Response = () => json(200, {});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.setAttribute('data-hosted', '');
  history.replaceState(null, '', `/studio/${SAMPLE}/`);
  const f = vi.fn(async (url: string) => answer(url));
  setContributeFetch(f);
  vi.stubGlobal('fetch', f);
  answer = () => json(200, {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  setContributeFetch(null);
  document.documentElement.removeAttribute('data-hosted');
});

describe('See it as, in the browser', () => {
  it('plays Dana by default: the member the server gave', () => {
    visit();
    expect(contributorFor(SAMPLE)).toEqual(DANA);
    expect(playsSomeoneElse(SAMPLE)).toBe(false);
  });

  it('plays the person of ?as= and keeps the pick for the next pages', () => {
    visit();
    history.replaceState(null, '', `/studio/${SAMPLE}/?as=sofia`);
    expect(contributorFor(SAMPLE)).toMatchObject({ name: 'Sofia', role: 'edit', visitor: true });
    expect(currentContributor()?.name).toBe('Sofia');
    expect(localStorage.getItem(CAST_STORAGE_KEY)).toBe('sofia');
    history.replaceState(null, '', `/studio/${SAMPLE}/explorations/`);
    expect(contributorFor(SAMPLE)?.name).toBe('Sofia');
    // Still read through the visitor's session.
    expect(holdsContributeSession(SAMPLE)).toBe(true);
    expect(playsSomeoneElse(SAMPLE)).toBe(true);
    expect(getToken()).toBe(CONTRIB_TOKEN);
  });

  it("never reads Dana's own work as the person played", async () => {
    visit();
    localStorage.setItem(CAST_STORAGE_KEY, 'leo');
    answer = () => json(200, { branches: ['bridge/dana'], issues: [2] });
    expect(await contributeMine(SAMPLE)).toEqual({ branches: [], issues: [] });
  });

  it('answers contributeInfo as the person played, and keeps the server member as it gave it', async () => {
    localStorage.setItem(CAST_STORAGE_KEY, 'ann');
    answer = () => json(200, { available: true, member: DANA });
    const info = await contributeInfo(SAMPLE);
    // Ann is the product manager: no review right, no say on explorations.
    expect(info.member).toMatchObject({ name: 'Ann', visitor: true });
    expect(info.member?.lead).toBeUndefined();
    expect(info.member?.decides).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(`bridge.contribute.member:${SAMPLE}`)!).name).toBe('Dana');
  });

  it('plays the developer as his GitHub account, reading through the same session', () => {
    visit();
    localStorage.setItem(CAST_STORAGE_KEY, 'malik');
    expect(contributorFor(SAMPLE)).toBeNull();
    expect(currentContributor()).toBeNull();
    expect(playedGitHub(SAMPLE)).toMatchObject({ login: 'acme-malik', name: 'Malik' });
    expect(getToken()).toBe(CONTRIB_TOKEN);
  });

  it('never plays anyone on another team, nor for a real member of the sample team', () => {
    localStorage.setItem(CAST_STORAGE_KEY, 'sofia');
    history.replaceState(null, '', '/studio/acme/ds/?as=sofia');
    localStorage.setItem('bridge.contribute.member:acme/ds', JSON.stringify(DANA));
    expect(castOn('acme/ds')).toBeNull();
    expect(contributorFor('acme/ds')?.name).toBe('Dana');
    history.replaceState(null, '', `/studio/${SAMPLE}/`);
    localStorage.setItem(`bridge.contribute.member:${SAMPLE}`, JSON.stringify({ email: 'dana@acme.example', name: 'Dana', role: 'admin' }));
    expect(contributorFor(SAMPLE)?.name).toBe('Dana');
    expect(playedGitHub(SAMPLE)).toBeNull();
  });
});
