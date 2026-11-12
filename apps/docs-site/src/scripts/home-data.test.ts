// @vitest-environment jsdom
// Studio Home paints what Bridge itself knows (join requests, api/entry) without waiting for GitHub: before the open
// branches are read, and when GitHub cannot be read at all.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({
  pulls: null as null | (() => Promise<unknown>),
  requests: vi.fn(),
  account: { email: 'sam@acme.com' } as null | { email: string },
  site: { name: 'Acme Product' } as Record<string, unknown>,
  known: true,
  productReads: [] as { at: unknown; pulls: unknown[] | null }[],
}));

vi.mock('./github-session', () => ({
  currentAccess: () => ({ state: 'admin', write: true, admin: true, reach: true }),
  currentContributor: () => null,
  currentViewer: () => ({ login: 'sam', avatar_url: '' }),
  getToken: () => 't',
  hasWorkingToken: () => true,
  onSampleTeam: () => false,
  readRepo: () => ({ owner: 'acme', repo: 'product', defaultBranch: 'main' }),
  resolveAccess: async () => null,
  RateLimitError: class extends Error {},
  ghGet: (path: string) => (path.includes('/pulls?') && s.pulls ? s.pulls() : Promise.reject(new Error('not in this test'))),
}));
vi.mock('./entry-session', () => ({ listJoinRequests: s.requests }));
vi.mock('./repo-context', () => ({ siteConfig: () => s.site, siteKnown: () => s.known }));
vi.mock('./contribute-session', () => ({ contributeTeam: async () => ({ pms: {} }), contributeMine: async () => null }));
vi.mock('./product-repos', () => ({ readProductPulls: async () => s.productReads, explorationFiles: async () => null }));
vi.mock('../lib/team-path', async (orig) => ({ ...(await orig<object>()), isHosted: () => true }));
vi.mock('./teams', () => ({ loadTeams: async () => undefined }));
vi.mock('./pr-status', () => ({ loadStatuses: async () => undefined, owners: () => ({ design: [], tech: [] }), shippers: () => [], rowWho: () => null }));
vi.mock('./suggestions', () => ({ loadSuggestionNeeds: async () => [], loadOwnSuggestions: async () => [] }));
vi.mock('./account-session', () => ({ getAccount: async () => ({ available: true, account: s.account }) }));

import { loadHome, type HomeData } from './home-data';

const REQUEST = { id: 'r1', repo: 'acme/product', email: 'taylor@acme.com', name: 'Taylor Kim', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 864e5).toISOString() };
const STAT = { guidance: [], contrastFail: 0 };
const joinRows = (d: HomeData | undefined) => (d?.needs ?? []).filter((r) => r.request);

beforeEach(() => {
  s.site = { name: 'Acme Product' };
  s.known = true;
  s.productReads = [];
  s.account = { email: 'sam@acme.com' };
  s.requests.mockReset();
  s.requests.mockResolvedValue([REQUEST]);
});

describe('loadHome and join requests', () => {
  it('paints the requests before GitHub answered for the branches', async () => {
    s.pulls = () => new Promise(() => undefined); // GitHub never answers
    const seen: HomeData[] = [];
    void loadHome(STAT, (d) => seen.push(d));
    await vi.waitFor(() => expect(joinRows(seen.at(-1))).toHaveLength(1));
    expect(seen.at(-1)!.loading).toBe(true);
  });

  it('keeps the requests when GitHub cannot be read', async () => {
    s.pulls = () => Promise.reject(new Error('down'));
    let release: (rows: unknown[]) => void = () => undefined;
    s.requests.mockReturnValue(new Promise((r) => (release = r)));
    const seen: HomeData[] = [];
    await loadHome(STAT, (d) => seen.push(d));
    expect(seen.at(-1)!.failed).toBeTruthy();
    release([REQUEST]);
    await vi.waitFor(() => expect(joinRows(seen.at(-1))).toHaveLength(1));
    expect(seen.at(-1)!.failed).toBeTruthy();
  });

  it('takes in repo facts read later through the repaint it hands back, without reading GitHub again', async () => {
    s.pulls = () => new Promise(() => undefined);
    s.requests.mockResolvedValue([]);
    let facts = { guidance: [] as { name: string; href: string; since: string | null }[], contrastFail: 0 };
    let repaint: () => void = () => undefined;
    const seen: HomeData[] = [];
    void loadHome(() => facts, (d) => seen.push(d), (fn) => (repaint = fn));
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    facts = { guidance: [], contrastFail: 2 };
    repaint();
    expect(seen.at(-1)!.needs.length).toBeGreaterThan(0);
  });
  it('never asks for join requests without a Bridge account (a GitHub-only admin: the server would answer 401)', async () => {
    s.account = null;
    s.pulls = () => Promise.reject(new Error('offline'));
    const seen: HomeData[] = [];
    await loadHome(STAT, (d) => seen.push(d));
    await vi.waitFor(() => expect(seen.at(-1)?.settled).toBe(true));
    expect(s.requests).not.toHaveBeenCalled();
    expect(joinRows(seen.at(-1))).toHaveLength(0);
  });

  it("leaves Bridge's own pull requests out of the viewer's library changes (bridge.config.json tooling)", async () => {
    s.requests.mockResolvedValue([]);
    s.site = { name: 'Acme Product', tooling: { paths: ['apps/docs-site/'], scopes: ['studio'] } };
    const pull = (number: number, title: string) => ({ number, title, html_url: '', updated_at: '2026-10-30T10:00:00Z', created_at: '2026-10-30T10:00:00Z', user: { login: 'sam' }, labels: [], body: '', draft: false, state: 'open', base: { ref: 'main', sha: 'b' }, head: { ref: `feat/${number}`, sha: `h${number}` } });
    const open = [pull(1, 'fix(studio): Being built filters as underline Tabs'), pull(2, 'Button: a new size')];
    s.pulls = () => Promise.resolve({ data: open });
    const seen: HomeData[] = [];
    void loadHome(STAT, (d) => seen.push(d));
    await vi.waitFor(() => expect(seen.at(-1)?.branches.length).toBeGreaterThan(0));
    expect(seen.at(-1)!.branches.map((b) => b.number)).toEqual([2]);
  });
});

describe('loadHome never paints the default settings nor an empty home from a failed read', () => {
  const pull = (number: number) => ({ number, title: 'Button: a new size', html_url: '', updated_at: '2026-10-30T10:00:00Z', created_at: '2026-10-30T10:00:00Z', user: { login: 'sam' }, labels: [], body: '', draft: false, state: 'open', base: { ref: 'main', sha: 'b' }, head: { ref: `feat/${number}`, sha: `h${number}` } });

  it("the team's settings failed and were never kept here: says why, never the defaults (another team's name, products, role)", async () => {
    s.requests.mockResolvedValue([]);
    s.known = false;
    s.site = {};
    s.pulls = () => Promise.resolve({ data: [pull(2)] });
    const busy = Object.assign(new Error('Bridge is busy, try again in 5 min.'), { status: 429 });
    const seen: HomeData[] = [];
    await loadHome(STAT, (d) => seen.push(d), undefined, Promise.reject(busy));
    const last = seen.at(-1)!;
    expect(last.failed).toMatch(/busy/i);
    expect(last.loading).toBe(false);
    // Nothing read from the default settings: no explorations sorted into default products, no library changes.
    expect(last.explorations).toEqual([]);
    expect(last.branches).toEqual([]);
  });

  it('the settings read failed but this browser kept them: the home reads on with the kept settings', async () => {
    s.requests.mockResolvedValue([]);
    s.known = true;
    s.pulls = () => Promise.resolve({ data: [pull(2)] });
    const seen: HomeData[] = [];
    void loadHome(STAT, (d) => seen.push(d), undefined, Promise.reject(new Error('down')));
    await vi.waitFor(() => expect(seen.at(-1)?.branches.length).toBeGreaterThan(0));
    expect(seen.at(-1)!.failed).toBeNull();
  });

  it('a product repository that could not be read marks the home partial (never "Nothing in progress" from it)', async () => {
    s.requests.mockResolvedValue([]);
    s.pulls = () => Promise.resolve({ data: [] });
    s.productReads = [{ at: { repo: 'acme/crm', product: { key: 'crm' } }, pulls: null }];
    const seen: HomeData[] = [];
    void loadHome(STAT, (d) => seen.push(d));
    await vi.waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)!.partial).toBe(true);
    // Every read answered: not partial.
    s.productReads = [{ at: { repo: 'acme/crm', product: { key: 'crm' } }, pulls: [] }];
    const again: HomeData[] = [];
    void loadHome(STAT, (d) => again.push(d));
    await vi.waitFor(() => expect(again.at(-1)?.loading).toBe(false));
    expect(again.at(-1)!.partial).toBeFalsy();
  });
});
