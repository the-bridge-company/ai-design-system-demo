// @vitest-environment jsdom
// The team home paints at once, whatever the design system read does: the greeting and join requests stay on screen
// while it reads, and when it fails, the failure shows under them.
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ team: null as null | (() => Promise<unknown>), loadHome: vi.fn() }));

vi.mock('./team-data', () => ({ loadTeamData: () => s.team!(), resetTeamData: () => undefined, teamOfPage: () => ({ owner: 'acme', repo: 'product' }), onTeamProgress: () => () => undefined }));
vi.mock('./github-session', () => ({
  currentAccess: () => ({ state: 'admin', write: true, admin: true }),
  currentContributor: () => null,
  currentViewer: () => ({ login: 'sam', avatar_url: '', name: 'Sam Rivera' }),
  getToken: () => 'gho_x',
  prefersSignIn: () => true,
  onAccess: () => undefined,
  initGitHubConnect: (fn: () => void) => fn(),
}));
vi.mock('./home-data', () => ({ loadHome: s.loadHome }));
vi.mock('./shell', () => ({ setReviewCount: () => undefined }));
vi.mock('./needs-you', () => ({ rememberMine: () => undefined }));

import { initTeamHome } from './team-home';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  document.body.innerHTML = '<div data-src></div><div data-home></div><div data-ds></div>';
  const q = (sel: string) => document.querySelector<HTMLElement>(sel)!;
  return { home: q('[data-home]'), ds: q('[data-ds]'), src: q('[data-src]') };
}

beforeEach(() => {
  s.loadHome.mockReset();
  // GitHub has not answered for the branches; the request is Bridge's own.
  s.loadHome.mockImplementation((_stat, onUpdate) => onUpdate({ viewer: 'sam', loading: true, settled: false, failed: null, needs: [], branches: [], explorations: [], decisions: 0, reviewer: true }));
});

describe('initTeamHome', () => {
  it('paints the greeting before the design system is read', async () => {
    s.team = () => new Promise(() => undefined);
    const { home, ds } = mount();
    await act(async () => initTeamHome(home, null, ds));
    expect(home.textContent).toMatch(/Sam/);
    expect(s.loadHome).toHaveBeenCalled();
    // While it reads, the part under the home says so to screen readers only: nothing on screen comes and goes.
    expect(ds.querySelector('[role="status"]')!.textContent).toBe("Reading this team's design system");
    expect(ds.querySelector('.lp, [aria-busy="true"]')).toBeNull();
  });

  it('keeps the home on screen and shows the failure under it when the read fails', async () => {
    s.team = () => Promise.reject(Object.assign(new Error('API rate limit exceeded'), { status: 429 }));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { home, ds } = mount();
      await act(async () => initTeamHome(home, null, ds));
      await act(async () => undefined);
      // Let a rejection nobody took in surface before checking.
      await new Promise((r) => setTimeout(r, 20));
      expect(home.textContent).toMatch(/Sam/);
      expect(ds.textContent).toMatch(/Try again/);
      // The failed state: the design system part says why GitHub could not be read, with its wait.
      expect(ds.textContent).toMatch(/busy/i);
      // The home gets the settings read and its failure to say (the kept settings, else why): never swallowed.
      const settings = s.loadHome.mock.calls.at(-1)?.[3] as Promise<unknown> | undefined;
      expect(settings).toBeInstanceOf(Promise);
      await expect(settings).rejects.toMatchObject({ status: 429 });
      // And nothing escaped unhandled, even though the mocked home never takes the settings read in.
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
