// @vitest-environment jsdom
// The Explorations badge on a page opened directly (Settings, Tokens, All products): read once with Home's loader and
// rule, remembered for the next pages, so the badge says one number everywhere.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('./github-session', () => ({
  currentViewer: () => ({ login: 'dana' }),
  currentContributor: () => null,
  readRepo: () => ({ owner: 'acme', repo: 'ds' }),
}));
vi.mock('./home-data', () => ({ loadHome: s.load }));

const row = (key: string, line: string) => ({ key, line });

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  s.load.mockReset();
});

describe('countWaitingExplorations', () => {
  it("counts Home's rows once per exploration when they settle, and remembers them", async () => {
    s.load.mockImplementation(async (_f: unknown, paint: (d: unknown) => void) => {
      paint({ loading: true, settled: false, viewer: 'dana', failed: null, needs: [] });
      paint({ loading: false, settled: true, viewer: 'dana', failed: null, needs: [row('exploration-review-prints#7', 'Sofia is done exploring'), row('exploration-review-prints#7', 'Sofia would like your opinion'), row('exploration-review-crm#3', 'Leo is done exploring'), row('guidance-x', 'Claude drafted guidance')] });
      // The thumbnails Home reads after that are never waited for.
      await new Promise(() => undefined);
    });
    const m = await import('./waiting-counts');
    expect(await m.countWaitingExplorations()).toBe(2);
    expect(m.rememberedWaitingExplorations()?.map((w) => w.key)).toEqual(['prints#7', 'crm#3']);
  });

  it('says nothing when Home could not read', async () => {
    s.load.mockImplementation(async (_f: unknown, paint: (d: unknown) => void) => paint({ loading: false, settled: true, viewer: 'dana', failed: 'GitHub could not be read.', needs: [] }));
    const m = await import('./waiting-counts');
    expect(await m.countWaitingExplorations()).toBeNull();
    expect(m.rememberedWaitingExplorations()).toBeNull();
  });
});
