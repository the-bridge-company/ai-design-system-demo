// Studio's header search beyond components and tokens (lib/studio-search.ts): explorations in the Explorations list's
// words, the Library review pieces a viewer acts on, Being built's requests, products and Studio's pages; and the
// grouped ranking (lib/palette-search rankGrouped).
import { describe, expect, it } from 'vitest';
import type { BuildRequestView, ProductConfig } from '@bridge-ds/core';
import { explorationItems, explorationStatusWord, explorationPersonName, SETTINGS_SEARCH_BANDS, GROUP_LABEL, pieceItems, pieceStateWords, productItems, requestItems, STUDIO_KIND_ORDER, STUDIO_SEARCH_PAGES, studioPageItems } from './studio-search';
import { rankGrouped, GROUP_FIRST } from './palette-search';
import { studioNav } from './nav';
import { readFileSync } from 'node:fs';
import { explorationState } from './exploration-state';
import { STATE_LABEL, statusOf } from './explorations-page';
import { needsReviewRead } from './review-state';
import type { ExplorationPullLike } from './explorations-view';
import type { ReviewPiece, Viewer } from './library-review';
import type { SearchItem } from './search';
import { SEP_SPLIT } from './sep';

const parts = (meta: string | undefined) => (meta ?? '').split(SEP_SPLIT);

const studio = (path: string) => `/studio/acme-design-demo/bridge-demo-ds/${path}`;
const products: ProductConfig[] = [
  { key: 'library', name: 'Library', default: true },
  { key: 'account', name: 'Account', path: 'apps/account' },
];
const block = (name: string, extra: Record<string, unknown> = {}) => `<!-- bridge-exploration ${JSON.stringify({ name, purpose: 'Try it', slug: 'x', ...extra })} -->`;

const pull = (n: number, extra: Partial<ExplorationPullLike> = {}): ExplorationPullLike => ({
  number: n,
  title: `Exploration: thing ${n}`,
  state: 'open',
  draft: true,
  labels: [{ name: 'exploration' }],
  head: { ref: `explore/thing-${n}`, sha: `sha${n}` },
  user: { login: 'claude[bot]' },
  updated_at: `2026-11-1${n % 10}T10:00:00Z`,
  html_url: `https://github.com/acme/ds/pull/${n}`,
  ...extra,
});

describe('explorationItems', () => {
  const profile = pull(36, { labels: [{ name: 'exploration' }, { name: 'product: account' }], body: `${block('Profile page')}\nRequested by Sofia Reyes.`, updated_at: '2026-11-12T10:00:00Z' });
  const archived = pull(37, { labels: [{ name: 'exploration' }, { name: 'archived' }], body: block('Old idea') });
  const plain = pull(38, { title: 'feat(tokens): Deeper blue', labels: [], head: { ref: 'bridge/deeper-blue', sha: 's' } });
  const inShop = pull(4, { product: 'account', repo: 'acme/account', body: block('Checkout steps', { author: 'dana' }), updated_at: '2026-11-10T10:00:00Z' });

  it('lists the open explorations in the list words, newest first, archived and plain changes left out', () => {
    const items = explorationItems([profile, archived, plain, inShop, profile], { products, studio, profileName: (l) => (l === 'dana' ? 'Dana Kim' : null) });
    expect(items.map((i) => i.title)).toEqual(['Profile page', 'Checkout steps']);
    expect(items[0]).toMatchObject({ kind: 'exploration', href: studio('explorations/?exploration=36') });
    expect(parts(items[0]!.meta)).toEqual(['Exploring', 'Sofia', 'Account']);
    expect(items[1]!.href).toBe(studio('explorations/?exploration=4&product=account'));
    expect(parts(items[1]!.meta)).toEqual(['Exploring', 'Dana', 'Account']);
  });

  it('names people by first name as the list does, Claude AI for an app account nobody asked through', () => {
    expect(explorationPersonName(profile)).toBe('Sofia');
    expect(explorationPersonName(pull(5, { body: block('Nav') }))).toBe('Claude AI');
    const [y] = explorationItems([profile], { products, studio });
    expect(y!.keys).toContain('Sofia');
    expect(y!.keys).toContain('Account');
  });

  // Handed to the developers, no longer a draft, a reviewer asked: the list reads its reviews before its status.
  const handed = pull(40, {
    draft: false,
    labels: [{ name: 'ready-for-devs' }],
    body: block('Tabs', { doneAt: '2026-11-10T10:00:00Z' }),
    ...({ requested_reviewers: [{ login: 'dana' }] } as object),
  });
  const listWord = (p: ExplorationPullLike, reviews: { state: string; user: { login: string } }[] | null) =>
    STATE_LABEL[statusOf({ lifecycle: 'exploration', stage: explorationState({ pull: p, task: null, approvers: ['dana'], reviews: reviews as never }), body: p.body ?? null, archived: false, waitsForLibrary: false })];

  it("says no status while the reviews the list reads are not in, then the list's own word", () => {
    expect(needsReviewRead(handed)).toBe(true);
    expect(explorationStatusWord(handed, { approvers: ['dana'], tasks: new Map(), reviews: null })).toBeNull();
    const [row] = explorationItems([handed], { products, studio, approvers: ['dana'] });
    expect(parts(row!.meta)).not.toContain(listWord(handed, null));
    for (const reviews of [[], [{ state: 'APPROVED', user: { login: 'dana' } }], [{ state: 'CHANGES_REQUESTED', user: { login: 'dana' } }]]) {
      const read = new Map([['40', reviews as never]]);
      expect(explorationStatusWord(handed, { approvers: ['dana'], tasks: new Map(), reviews: read })).toBe(listWord(handed, reviews));
    }
  });

  it("says no status while an exploration's developers' task is not read", () => {
    const withTask = pull(41, { draft: false, labels: [{ name: 'ready-for-devs' }], body: block('Card', { doneAt: '2026-11-10T10:00:00Z', task: 'https://github.com/acme/app/issues/3' }) });
    expect(explorationStatusWord(withTask, { tasks: null, reviews: new Map() })).toBeNull();
    expect(explorationStatusWord(withTask, { tasks: new Map([['https://github.com/acme/app/issues/3', 'being-built']]), reviews: new Map() })).toBe(STATE_LABEL[statusOf({ lifecycle: 'exploration', stage: 'being-built', body: withTask.body ?? null })]);
  });
});

const piece = (over: Partial<ReviewPiece> = {}): ReviewPiece => ({
  key: 'p:acme/ds#12:avatar-xl',
  title: 'Avatar: xl size',
  kind: 'New size',
  category: 'Avatar',
  source: { kind: 'exploration' } as unknown as ReviewPiece['source'],
  asked: { key: 'acme/ds#12', number: 12, name: 'Profile page', designer: 'Sofia', product: 'Account', productKey: 'account' } as unknown as ReviewPiece['asked'],
  by: null,
  mine: false,
  tier: 2,
  state: 'waiting',
  decided: null,
  decidedLabel: null,
  waitsOn: 'you',
  designApproved: false,
  match: null,
  conflict: null,
  before: null,
  after: null,
  swatch: null,
  why: null,
  exception: null,
  at: '2026-11-09T10:00:00Z',
  ...over,
});
const lead: Viewer = { reviews: true, name: 'Dana', leadsPublishTier1: true };
const sofia: Viewer = { reviews: false, name: 'Sofia', leadsPublishTier1: true };
const now = Date.parse('2026-11-13T10:00:00Z');

describe('pieceItems', () => {
  it('gives a reviewer every waiting piece, opened in One by one, with how long it waits', () => {
    const items = pieceItems([piece(), piece({ key: 'b', state: 'decided', decided: 'added' })], lead, studio, now);
    expect(items).toEqual([expect.objectContaining({ kind: 'piece', title: 'Avatar: xl size', href: studio('library-review/?piece=p%3Aacme%2Fds%2312%3Aavatar-xl') })]);
    expect(parts(items[0]!.meta)).toEqual(['New size', 'Waiting 4 days']);
  });

  it('gives anyone else only the pieces they asked for, opened on their list', () => {
    expect(pieceItems([piece()], sofia, studio, now)).toEqual([expect.objectContaining({ href: studio('library-review/'), meta: 'New size' })]);
    expect(pieceItems([piece()], { ...sofia, name: 'Leo' }, studio, now)).toEqual([]);
  });

  it('says the state words of the list', () => {
    expect(pieceStateWords(piece({ decided: 'building' }), lead, now)).toBe('Being built');
    expect(pieceStateWords(piece({ conflict: { component: 'Card', property: 'radius', ways: [{}, {}] as never, pick: null } }), lead, now)).toBe('2 ways');
    expect(pieceStateWords(piece({ exception: 'Dana asked for changes' }), sofia, now)).toBe('Dana asked for changes');
  });
});

describe('requestItems', () => {
  const view = (over: Partial<BuildRequestView> = {}): BuildRequestView => ({
    id: 'issue-12',
    kind: 'issue',
    number: 12,
    url: 'https://github.com/acme/ds/issues/12',
    component: 'Avatar',
    title: 'Add a xl size',
    requestKind: null,
    status: 'requested',
    label: '',
    sentence: '',
    builders: [],
    requestedBy: null,
    createdAt: '2026-11-11T10:00:00Z',
    ageDays: 2,
    stale: false,
    shippedAt: null,
    pull: null,
    jira: null,
    figmaUrl: null,
    timeline: [],
    ...over,
  });

  it('lists what Being built lists, opening its detail, in its tag and line', () => {
    const items = requestItems([view(), view({ id: 'issue-2', number: 2, status: 'shipped', shippedAt: '2026-01-01T00:00:00Z' })], { studio, now });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'request', href: studio('building/?request=12') });
    expect(items[0]!.title).toMatch(/Avatar/);
    expect(items[0]!.meta).toMatch(/Sent 2 days ago/);
  });
});

describe('products and pages', () => {
  it('lists the products but the library, opening their page', () => {
    expect(productItems(products, (k) => studio(`products/${k}/`))).toEqual([{ kind: 'product', title: 'Account', href: studio('products/account/'), meta: 'Product', keys: 'account' }]);
  });

  it("keeps Studio's pages in step with the rail, and finds them by their former names", () => {
    const rail = studioNav().map((e) => e.label);
    for (const label of rail) expect(STUDIO_SEARCH_PAGES.map((p) => p.label)).toContain(label);
    const items = studioPageItems(studio, { team: true });
    expect(items.find((i) => i.title === 'Members')!.href).toBe(studio('settings/#team'));
    expect(studioPageItems(studio, { team: false }).find((i) => i.title === 'Figma and Claude')!.href).toBe(studio('settings/#tools'));
    expect(rankGrouped('history', items, STUDIO_KIND_ORDER)[0]!.title).toBe('Explorations');
  });

  it("lists a Settings band only at an anchor that Studio's Settings page has", () => {
    const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
    const team = read('../pages/team-shell/settings/index.astro') + read('../components/ds/studio/TeamSettings.tsx');
    const own = read('../pages/studio/settings/index.astro');
    const has = (src: string, id: string) => src.includes(`id="${id}"`);
    for (const b of SETTINGS_SEARCH_BANDS) {
      if (b.anchor.team) expect(has(team, b.anchor.team), `${b.label} in a team's Settings`).toBe(true);
      if (b.anchor.own) expect(has(own, b.anchor.own), `${b.label} in Bridge's own Settings`).toBe(true);
    }
  });

  it('says no em dash', () => {
    expect(JSON.stringify(STUDIO_SEARCH_PAGES)).not.toContain('—');
  });
});

describe('rankGrouped', () => {
  const all: SearchItem[] = [
    { kind: 'token', title: 'color.avatar.bg', href: '/t' },
    { kind: 'page', title: 'Settings', href: '/s' },
    { kind: 'component', title: 'Avatar', href: '/c' },
    { kind: 'exploration', title: 'Avatar sizes', href: '/x' },
    { kind: 'piece', title: 'Avatar: xl size', href: '/p' },
  ];

  it('groups by kind in Studio order, explorations first', () => {
    expect(rankGrouped('avatar', all, STUDIO_KIND_ORDER).map((i) => i.kind)).toEqual(['exploration', 'piece', 'component', 'token']);
  });

  it('shows a few of each kind but tokens with no query', () => {
    const many: SearchItem[] = Array.from({ length: 9 }, (_, i) => ({ kind: 'exploration', title: `X ${i}`, href: `/${i}` }));
    const r = rankGrouped('', [...many, ...all], STUDIO_KIND_ORDER);
    expect(r.filter((i) => i.kind === 'exploration')).toHaveLength(GROUP_FIRST);
    expect(r.map((i) => i.kind)).not.toContain('token');
    expect(Object.keys(GROUP_LABEL)).toHaveLength(STUDIO_KIND_ORDER.length);
  });
});
