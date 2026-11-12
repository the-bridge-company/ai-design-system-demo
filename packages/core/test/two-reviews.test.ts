import { describe, expect, it } from 'vitest';
import {
  afterDesignReviewOff,
  designReviewOf,
  designReviewOffLine,
  goesStraightToReady,
  homeRowLine,
  libraryImpactTitle,
  libraryQueueLine,
  migrateReviews,
  noReviewLine,
  piecesWords,
  reviewersOfSetting,
  reviewsFor,
  reviewsSettled,
  waitingFor,
  withoutReviewer,
  type Reviewer,
} from '../src/two-reviews';
import {
  explorationPrBody,
  hatOf,
  isDesignReviewWaiting,
  isInReview,
  isLibraryWaiting,
  isWaitingForLead,
  libraryPendingOf,
  parseExplorationBody,
  withDecision,
  withDesignOk,
  withDoneExploring,
  withExplorationLibrary,
  withLeadAsked,
  withLibraryAsked,
  withoutDoneExploring,
  withoutReviewAsks,
} from '../src/explorations';
import { withPieceDecision } from '../src/library-impact';
import { withPiecesRecord, type MissingPiece, type PiecesRecord } from '../src/prod-branch';
import { productProblems } from '../src/products';

const dana: Reviewer = { id: 'member:dana', name: 'Dana' };
const sam: Reviewer = { id: 'sam', name: 'Sam' };
const sofia: Reviewer = { id: 'member:sofia', name: 'Sofia' };

const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
// A Card at 12 px is Compact: the library as it is (library-impact asIsOption).
const compactCard: MissingPiece = { id: 'card-padding-12', kind: 'variant', title: 'Card: padding', summary: 'Card padding 12.', name: 'padding', component: 'Card', values: [{ category: 'spacing', property: 'padding', value: '12px' }], where: [], change: { before: '16px', after: '12px' } } as MissingPiece;

const record = (pieces: MissingPiece[], links: PiecesRecord['links'] = []): PiecesRecord => ({ checkedAt: '2026-11-12T09:00:00.000Z', pieces, links });
const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-timeline', author: 'sofia' }, { owner: 'acme', repo: 'prints', packages: [], apps: {} });

describe('the reviews Done exploring asks', () => {
  it('asks both when the product has a design review and something is new for the library', () => {
    const r = reviewsFor({ author: ['member:sofia'], designReviewers: [dana], libraryOwners: [dana], newPieces: ['Timeline'] });
    expect(r.design?.reviewers).toEqual([dana]);
    expect(r.library).toEqual({ owners: [dana], pieces: ['Timeline'] });
    expect(goesStraightToReady(r)).toBe(false);
  });

  it('asks only the design review when nothing is new for the library (Leo\'s Deal pipeline cards)', () => {
    const r = reviewsFor({ author: ['member:leo'], designReviewers: [dana], libraryOwners: [dana], newPieces: [] });
    expect(r.design?.reviewers).toEqual([dana]);
    expect(r.library).toBeNull();
  });

  it('asks only the library when the design review is off', () => {
    const r = reviewsFor({ author: ['member:sofia'], designReviewers: null, libraryOwners: [dana], newPieces: ['Timeline'] });
    expect(r.design).toBeNull();
    expect(r.noDesign).toBe('off');
    expect(r.library?.owners).toEqual([dana]);
  });

  it('goes straight to Ready to build when neither applies', () => {
    const r = reviewsFor({ author: ['member:leo'], designReviewers: null, libraryOwners: [dana], newPieces: [] });
    expect(goesStraightToReady(r)).toBe(true);
    expect(noReviewLine({ product: 'Acme CRM', noDesign: r.noDesign, library: false })).toBe('No review needed: nothing new for the library, and Acme CRM has no design review');
  });

  it('never asks the author, and says so when they are the only design reviewer', () => {
    const r = reviewsFor({ author: ['member:dana'], designReviewers: [dana], libraryOwners: [dana, sam], newPieces: ['Timeline'] });
    expect(r.design).toBeNull();
    expect(r.noDesign).toBe('author-only');
    expect(r.library?.owners).toEqual([sam]);
    expect(noReviewLine({ product: 'Acme Prints', noDesign: 'author-only', library: true, authorName: 'Dana' })).toBe("No design review: Dana is Acme Prints' only reviewer");
  });

  it('lets the only library owner decide on their own exploration (it is recorded)', () => {
    const r = reviewsFor({ author: ['member:dana'], designReviewers: [sam], libraryOwners: [dana], newPieces: ['Timeline'] });
    expect(r.library?.owners).toEqual([dana]);
    expect(r.design?.reviewers).toEqual([sam]);
  });

  it('does not ask the design review again when its yes stands', () => {
    const r = reviewsFor({ author: ['member:sofia'], designReviewers: [dana], libraryOwners: [dana], newPieces: ['Timeline'], designDone: true });
    expect(r.design).toBeNull();
    expect(r.library).not.toBeNull();
  });

  it('is Ready to build once the design review said yes and every new piece has an answer', () => {
    expect(reviewsSettled({ designWaiting: false, libraryPending: 0 })).toBe(true);
    expect(reviewsSettled({ designWaiting: true, libraryPending: 0 })).toBe(false);
    expect(reviewsSettled({ designWaiting: false, libraryPending: 1 })).toBe(false);
  });
});

describe('designReviewOf: a product\'s design review in bridge.config.json', () => {
  it('reads off, named reviewers, and the team default', () => {
    expect(designReviewOf({ key: 'crm', designReview: false }, ['flo'])).toEqual({ on: false });
    expect(designReviewOf({ key: 'crm', designReview: { reviewers: ['@Dana', 'acme/design'] } }, ['flo'])).toEqual({ on: true, reviewers: ['dana'] });
    expect(designReviewOf({ key: 'crm' }, ['flo', 'acme/design'])).toEqual({ on: true, reviewers: ['flo'] });
    expect(designReviewOf({ key: 'library' }, ['flo'])).toEqual({ on: false });
  });

  it('validates the field', () => {
    expect(productProblems([{ key: 'crm', name: 'CRM', designReview: false }])).toEqual([]);
    expect(productProblems([{ key: 'crm', name: 'CRM', designReview: { reviewers: ['dana'] } }])).toEqual([]);
    expect(productProblems([{ key: 'crm', name: 'CRM', designReview: true }])[0]).toMatch(/designReview/);
    expect(productProblems([{ key: 'crm', name: 'CRM', designReview: { reviewers: 'dana' } }])[0]).toMatch(/designReview/);
  });
});

describe('waitingFor: the second line of In review', () => {
  const design = { reviewers: [dana], product: 'Acme Prints' };
  const library = { owners: [dana, sam], pieces: ['Timeline'] };

  it('names who and why for others', () => {
    expect(waitingFor({ design, library })).toBe("Waiting for Dana's design review and the library decision on Timeline");
    expect(waitingFor({ design, library: null })).toBe("Waiting for Dana's design review");
    expect(waitingFor({ design: null, library })).toBe('Waiting for the library decision on Timeline');
    expect(waitingFor({ design: null, library: null })).toBeNull();
  });

  it('says "your" to the person holding the hat', () => {
    expect(waitingFor({ design, library: { owners: [dana], pieces: ['Timeline'] }, viewer: ['member:dana'] })).toBe('Waiting for your design review and your library decision on Timeline');
    expect(waitingFor({ design, library: null, viewer: ['member:dana'] })).toBe('Waiting for your design review');
    expect(waitingFor({ design: null, library, viewer: ['SAM'] })).toBe('Waiting for your library decision on Timeline');
  });

  it('names one library owner, and folds a person holding both hats into one name', () => {
    expect(waitingFor({ design: null, library: { owners: [dana], pieces: ['Timeline'] } })).toBe("Waiting for Dana's library decision on Timeline");
    expect(waitingFor({ design, library: { owners: [dana], pieces: ['Timeline'] } })).toBe("Waiting for Dana's design review and library decision on Timeline");
  });

  it('with several design reviewers: the one who took it, else the product\'s design review', () => {
    expect(waitingFor({ design: { reviewers: [dana, sam], product: 'Acme CRM' }, library: null })).toBe('Waiting for the Acme CRM design review');
    expect(waitingFor({ design: { reviewers: [dana, sam], takenBy: sam, product: 'Acme CRM' }, library: null })).toBe("Waiting for Sam's design review");
  });

  it('lists pieces in words', () => {
    expect(piecesWords(['Timeline'])).toBe('Timeline');
    expect(piecesWords(['Timeline', 'Stat card'])).toBe('Timeline and Stat card');
    expect(piecesWords(['a', 'b', 'c'])).toBe('3 new pieces');
  });
});

describe('words of the surfaces', () => {
  it('Library impact title: nothing new has no count, the count names new pieces only', () => {
    expect(libraryImpactTitle(0)).toBe('Nothing new for the library');
    expect(libraryImpactTitle(1)).toBe('1 new piece');
    expect(libraryImpactTitle(3)).toBe('3 new pieces');
  });

  it('Home rows name the hat, one row for both', () => {
    expect(homeRowLine('Sofia', ['design-review', 'library'])).toBe("Sofia's screen: your design review and a library decision");
    expect(homeRowLine('Leo', ['design-review'])).toBe("Leo's screen: your design review");
    expect(homeRowLine('James', ['library'])).toBe("James' screen: a library decision");
  });

  it('Library review counts library decisions only', () => {
    expect(libraryQueueLine(12)).toBe('12 library decisions wait for you, as design system owner');
    expect(libraryQueueLine(1)).toBe('1 library decision waits for you, as design system owner');
  });
});

describe('migration from the one review mode', () => {
  const products = [{ key: 'prints' }, { key: 'crm' }, { key: 'library' }];
  const people = ['member:dana', 'member:sofia', 'member:leo', 'flo'];

  it('one: leads and design owners own the library, the leads review every product', () => {
    const m = migrateReviews({ mode: 'one', leads: ['member:dana'], designOwners: ['flo'], designers: ['member:sofia', 'member:leo'], people, products });
    expect(m.libraryOwners).toEqual(['member:dana', 'flo']);
    expect(m.designReview).toEqual({ prints: { on: true, reviewers: ['member:dana'] }, crm: { on: true, reviewers: ['member:dana'] }, library: { on: false } });
  });

  it('one without leads: the design owners review', () => {
    const m = migrateReviews({ mode: 'one', leads: [], designOwners: ['flo'], designers: [], people, products });
    expect(m.designReview.crm).toEqual({ on: true, reviewers: ['flo'] });
  });

  it('shared: every designer reviews, owners default to every designer', () => {
    const m = migrateReviews({ mode: 'shared', leads: [], designOwners: [], designers: ['member:sofia', 'member:leo'], people, products });
    expect(m.libraryOwners).toEqual(['member:sofia', 'member:leo']);
    expect(m.designReview.prints).toEqual({ on: true, reviewers: 'any-designer' });
    expect(reviewersOfSetting(m.designReview.prints, ['member:sofia'])).toEqual(['member:sofia']);
  });

  it('shared-none: design review off, library decisions still asked', () => {
    const m = migrateReviews({ mode: 'shared-none', leads: ['member:dana'], designOwners: [], designers: ['member:sofia'], people, products });
    expect(m.libraryOwners).toEqual(['member:dana']);
    expect(Object.values(m.designReview).every((s) => !s.on)).toBe(true);
  });

  it('a team of one: the owner, design review off', () => {
    const m = migrateReviews({ mode: 'one', leads: [], designOwners: ['flo'], designers: [], people: ['flo'], products });
    expect(m.libraryOwners).toEqual(['flo']);
    expect(m.designReview.prints).toEqual({ on: false });
  });

  it('is idempotent', () => {
    const x = { mode: 'one' as const, leads: ['member:dana'], designOwners: ['flo'], designers: [], people, products };
    expect(migrateReviews(x)).toEqual(migrateReviews(x));
  });
});

describe('switching a design review off, removing a reviewer', () => {
  it('sends the ones waiting only on it to Ready to build', () => {
    expect(afterDesignReviewOff({ designWaiting: true, libraryPending: 0 })).toBe('ready-to-build');
    expect(afterDesignReviewOff({ designWaiting: true, libraryPending: 2 })).toBe('library-only');
    expect(afterDesignReviewOff({ designWaiting: false, libraryPending: 0 })).toBe('unchanged');
    expect(designReviewOffLine('Dana')).toBe('Design review turned off by Dana');
  });

  it('gives a removed reviewer\'s asks to the others, and tells the admin with none left', () => {
    expect(withoutReviewer(['dana', 'sam'], 'Dana')).toEqual({ reviewers: ['sam'], orphan: false });
    expect(withoutReviewer(['dana'], 'dana')).toEqual({ reviewers: [], orphan: true });
  });
});

describe('the exploration block: two asks, one In review', () => {
  const withRecord = withPiecesRecord(start, record([timeline, compactCard]));

  it('reads bodies written with the old lead names as the design review', () => {
    const old = start.replace('"slug":"order-timeline"', '"slug":"order-timeline","leadAskedAt":"2026-11-10T10:00:00.000Z","leadAskedBy":"sofia","leadPieces":["component-timeline"],"leadAskedTo":["dana"],"leadOkBy":"dana"');
    const e = parseExplorationBody(old)!;
    expect(e.designAskedAt).toBe('2026-11-10T10:00:00.000Z');
    expect(e.designAskedBy).toBe('sofia');
    expect(e.askedPieces).toEqual(['component-timeline']);
    expect(e.designAskedTo).toEqual(['dana']);
    expect(e.designOkBy).toBe('dana');
    expect(isWaitingForLead(old)).toBe(true);
    // The next write uses the new names.
    const next = withDecision(old, { kind: 'question', at: 't', by: 'dana', text: '?' });
    expect(next).toContain('"designAskedAt"');
    expect(next).not.toContain('"leadAskedAt"');
  });

  it('reads old decisions as the design review', () => {
    expect(hatOf({})).toBe('design');
    expect(hatOf({ hat: 'library' })).toBe('library');
    const d = withDecision(start, { kind: 'changes', hat: 'library', at: 't', text: 'x' });
    expect(parseExplorationBody(d)?.decisions?.[0]?.hat).toBe('library');
  });

  it('waits on the library only for new pieces: "nothing new for the library" never asks', () => {
    const onlyAsIs = withLibraryAsked(withPiecesRecord(start, record([compactCard])), { at: '2026-11-12T10:00:00.000Z', to: ['dana'] });
    expect(isLibraryWaiting(onlyAsIs)).toBe(false);
    const asked = withLibraryAsked(withRecord, { at: '2026-11-12T10:00:00.000Z', to: ['dana'] });
    expect(libraryPendingOf(parseExplorationBody(asked), record([timeline, compactCard]))).toEqual(['component-timeline']);
    expect(isInReview(asked)).toBe(true);
  });

  it('a library answer settles its piece; a changes answer from before the ask is asked again', () => {
    const asked = withLibraryAsked(withRecord, { at: '2026-11-12T10:00:00.000Z', to: ['dana'] });
    const answered = withExplorationLibrary(asked, (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'local', at: '2026-11-12T11:00:00.000Z' }));
    expect(isInReview(answered)).toBe(false);
    const earlier = withExplorationLibrary(withRecord, (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'changes', at: '2026-11-11T11:00:00.000Z', text: 'x' }));
    expect(isLibraryWaiting(withLibraryAsked(earlier, { at: '2026-11-12T10:00:00.000Z' }))).toBe(true);
  });

  it('both reviews: the design yes alone keeps it In review while the library waits', () => {
    const both = withLibraryAsked(withLeadAsked(withRecord, { at: '2026-11-12T10:00:00.000Z', by: 'sofia' }), { at: '2026-11-12T10:00:00.000Z', to: ['dana'] });
    expect(isDesignReviewWaiting(parseExplorationBody(both))).toBe(true);
    const yes = withDesignOk(both, { at: '2026-11-12T12:00:00.000Z', by: 'dana' });
    expect(isDesignReviewWaiting(parseExplorationBody(yes))).toBe(false);
    expect(isInReview(yes)).toBe(true);
  });

  it('back to Exploring keeps the design yes and the library answers; the hand-off clears every ask', () => {
    const both = withLibraryAsked(withLeadAsked(withRecord, { at: 'a', by: 'sofia' }), { at: 'a', to: ['dana'] });
    const yes = withExplorationLibrary(withDesignOk(both, { at: 'b', by: 'dana' }), (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'changes', at: 'c', text: 'Smaller' }));
    const back = parseExplorationBody(withoutReviewAsks(yes))!;
    expect(back.designAskedAt).toBeUndefined();
    expect(back.library?.askedAt).toBeUndefined();
    expect(back.designOkAt).toBe('b');
    expect(back.library?.decisions?.[0]?.verdict).toBe('changes');
    const done = parseExplorationBody(withDoneExploring(yes, { branch: 'explore/order-timeline', doneAt: 'd', designOkBy: 'dana' }))!;
    expect(done.designOkAt).toBeUndefined();
    expect(done.library?.askedAt).toBeUndefined();
    expect(done.library?.askedTo).toBeUndefined();
    const reopened = parseExplorationBody(withoutDoneExploring(withDoneExploring(yes, { branch: 'b', doneAt: 'd', designOkBy: 'dana' }), 'e'))!;
    expect(reopened.designOkBy).toBeUndefined();
  });
});
