import { describe, expect, it } from 'vitest';
import { LEGACY_REVIEW_FIELDS as CORE_LEGACY, migrateReviews } from '@bridge-ds/core';
import {
  ANY_PRODUCT,
  OWNERS_ANY,
  asksAnyReview,
  asksDesignReview,
  asksLibrary,
  decidesOnExplorations,
  designReviewKey,
  designReviewsOf,
  isLibraryOwner,
  migratedMap,
  needsReview,
  newLibraryPieces,
  parseDesignReviewMap,
  reviewsNoteKey,
  reviewsNoteOf,
  setDesignReview,
  settingOf,
} from '../../api/_lib/review-settings';
import { explorationBlockOf, LEGACY_REVIEW_FIELDS, memberRef } from '../../api/_lib/exploration-member';
import { reviewModeKey } from '../../api/_lib/review-mode';
import type { EmailMember } from '../../api/_lib/members';

/** A Redis double: GET, SET, DEL and pipelines of them. */
function fakeRedis(seed: Record<string, string> = {}) {
  const kv = new Map(Object.entries(seed));
  const run = (c: unknown[]) => {
    const [cmd, k, v] = c as [string, string, string];
    if (cmd === 'GET') return kv.get(k) ?? null;
    if (cmd === 'SET') return kv.set(k, v) && 'OK';
    if (cmd === 'DEL') return kv.delete(k) ? 1 : 0;
    return null;
  };
  return { kv, cmd: async (...c: unknown[]) => run(c), pipe: async (cs: unknown[][]) => cs.map(run) };
}

const member = (name: string, role: EmailMember['role'], extra: Partial<EmailMember> = {}): EmailMember => ({ email: `${name.toLowerCase()}@acme.example`, name, role, version: 1, addedBy: 'x', at: '2026-11-01', ...extra });
const dana = member('Dana', 'admin', { lead: true });
const sofia = member('Sofia', 'edit');
const viewer = member('Vic', 'view');

describe('the server copy of the old field names', () => {
  it('matches core', () => {
    expect(LEGACY_REVIEW_FIELDS).toEqual(CORE_LEGACY);
  });

  it('reads an old block with the new names', () => {
    const block = explorationBlockOf(`<!-- bridge-exploration ${JSON.stringify({ name: 'x', leadAskedAt: 't', leadOkBy: 'dana', designAskedTo: ['sam'], leadAskedTo: ['old'] })} -->`)!;
    expect(block.designAskedAt).toBe('t');
    expect(block.designOkBy).toBe('dana');
    // A new name already there wins.
    expect(block.designAskedTo).toEqual(['sam']);
    expect('leadAskedAt' in block).toBe(false);
  });
});

describe('migration: nothing silently skips review', () => {
  it('matches core migrateReviews for every mode', () => {
    for (const mode of ['one', 'shared', 'shared-none'] as const) {
      const core = migrateReviews({ mode, leads: ['member:a'], designOwners: [], designers: ['member:b'], people: ['member:a', 'member:b'], products: [{ key: ANY_PRODUCT }, { key: 'library' }] });
      expect(migratedMap({ mode, leads: ['member:a'] })).toEqual(core.designReview);
    }
  });

  it('one person: the leads review every product, the Library off', async () => {
    const redis = fakeRedis({ [reviewModeKey('acme/ds')]: 'one' });
    const map = await designReviewsOf(redis, 'Acme/DS', async () => [dana, sofia]);
    expect(map).toEqual({ [ANY_PRODUCT]: { on: true, reviewers: [memberRef(dana.email)] }, library: { on: false } });
    expect(redis.kv.get(reviewsNoteKey('acme/ds'))).toBe('1');
    expect(await reviewsNoteOf(redis, 'acme/ds')).toBe(true);
  });

  it('one person with no lead: the GitHub design owners (an empty list)', async () => {
    const map = await designReviewsOf(fakeRedis(), 'acme/ds', async () => [sofia]);
    expect(map[ANY_PRODUCT]).toEqual({ on: true, reviewers: [] });
  });

  it('shared: any designer, and every designer owns the library when nobody leads', async () => {
    const map = await designReviewsOf(fakeRedis({ [reviewModeKey('acme/ds')]: 'shared' }), 'acme/ds', async () => [sofia]);
    expect(map[ANY_PRODUCT]).toEqual({ on: true, reviewers: 'any-designer' });
    expect(asksLibrary(sofia, map)).toBe(true);
  });

  it('shared, no review: design review off, library decisions still asked', async () => {
    const map = await designReviewsOf(fakeRedis({ [reviewModeKey('acme/ds')]: 'shared-none' }), 'acme/ds', async () => [dana, sofia]);
    expect(map[ANY_PRODUCT]).toEqual({ on: false });
    expect(asksLibrary(dana, map)).toBe(true);
    expect(asksDesignReview(dana, 'crm', map)).toBe(false);
  });

  it('is idempotent: a kept map is read as it is, never migrated again', async () => {
    const redis = fakeRedis({ [designReviewKey('acme/ds')]: JSON.stringify({ crm: { on: false } }), [reviewModeKey('acme/ds')]: 'shared' });
    expect(await designReviewsOf(redis, 'acme/ds', async () => [sofia])).toEqual({ crm: { on: false } });
    expect(redis.kv.has(reviewsNoteKey('acme/ds'))).toBe(false);
  });
});

describe('who is asked what', () => {
  const map = { [ANY_PRODUCT]: { on: true as const, reviewers: [memberRef(dana.email)] }, prints: { on: true as const, reviewers: 'any-designer' as const }, library: { on: false as const } };

  it('reads a product, else "*", the Library off by default', () => {
    expect(settingOf(map, 'crm')).toBe(map[ANY_PRODUCT]);
    expect(settingOf({}, 'library')).toEqual({ on: false });
    expect(settingOf({}, 'crm')).toEqual({ on: false });
  });

  it('asks design reviewers per product, any designer where set, never a viewer', () => {
    expect(asksDesignReview(dana, 'crm', map)).toBe(true);
    expect(asksDesignReview(sofia, 'crm', map)).toBe(false);
    expect(asksDesignReview(sofia, 'prints', map)).toBe(true);
    expect(asksDesignReview(viewer, 'prints', map)).toBe(false);
    expect(asksDesignReview(dana, 'library', map)).toBe(false);
  });

  it('reads the older lead as library owner, the new flag first', () => {
    expect(isLibraryOwner(dana)).toBe(true);
    expect(isLibraryOwner({ ...dana, libraryOwner: false })).toBe(false);
    expect(isLibraryOwner(sofia)).toBe(false);
  });

  it('an admin decides but is never asked', () => {
    const admin = member('Ada', 'admin');
    expect(asksAnyReview(admin, {})).toBe(false);
    expect(decidesOnExplorations(admin, {})).toBe(true);
  });

  it('needs a review when someone else can give one', () => {
    expect(needsReview({ map, designOwners: 0, members: [sofia] })).toBe(true);
    expect(needsReview({ map: { [ANY_PRODUCT]: { on: false } }, designOwners: 0, members: [sofia] })).toBe(false);
    expect(needsReview({ map: {}, designOwners: 1, members: [] })).toBe(true);
  });

  it('per exploration: its product\'s design review, or the library when something is new', () => {
    const pieces = (list: unknown[], decisions: unknown[] = []) => `<!-- bridge-exploration ${JSON.stringify({ name: 'x', library: { decisions } })} -->\n<!-- bridge-pieces ${JSON.stringify({ checkedAt: 't', pieces: list, links: [] })} -->`;
    const timeline = { id: 'component-timeline', kind: 'component', values: [] };
    const compact = { id: 'card-padding', kind: 'variant', values: [{ value: '12px' }] };
    const off = { [ANY_PRODUCT]: { on: false as const } };
    expect(newLibraryPieces(pieces([timeline, compact]))).toBe(1);
    expect(newLibraryPieces(pieces([timeline], [{ piece: 'component-timeline', verdict: 'local' }]))).toBe(0);
    expect(needsReview({ map: off, designOwners: 0, members: [dana], product: 'crm', body: pieces([compact]) })).toBe(false);
    expect(needsReview({ map: off, designOwners: 0, members: [dana], product: 'crm', body: pieces([timeline]) })).toBe(true);
    expect(needsReview({ map, designOwners: 0, members: [dana], product: 'crm', body: pieces([]) })).toBe(true);
    expect(needsReview({ map: { [ANY_PRODUCT]: { on: true, reviewers: [] } }, designOwners: 1, members: [], product: 'crm', body: '' })).toBe(true);
  });

  it('keeps only valid settings', () => {
    expect(parseDesignReviewMap('{"crm":{"on":true,"reviewers":"everyone"},"prints":{"on":false},"BAD KEY":{"on":false},"~library-owners":{"on":true,"reviewers":"any-designer"}}')).toEqual({ prints: { on: false }, [OWNERS_ANY]: { on: true, reviewers: 'any-designer' } });
    expect(parseDesignReviewMap('nope')).toBeNull();
  });

  it('an admin sets one product, and the note goes', async () => {
    const redis = fakeRedis({ [reviewsNoteKey('acme/ds')]: '1', [designReviewKey('acme/ds')]: JSON.stringify(map) });
    const next = await setDesignReview(redis, 'acme/ds', 'crm', { on: false });
    expect(next.crm).toEqual({ on: false });
    expect(next.prints).toEqual(map.prints);
    expect(await reviewsNoteOf(redis, 'acme/ds')).toBe(false);
  });
});
