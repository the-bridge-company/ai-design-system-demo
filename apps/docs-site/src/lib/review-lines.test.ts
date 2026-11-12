import { describe, expect, it } from 'vitest';
import { explorationPrBody, withDecision, withDesignOk, withDoneExploring, withLeadAsked, withLibraryAsked, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { asOneStep, countsOnExplorations, hatRowLine, reviewSecondLine, reviewStepsOf, stillWaitsLine, wentStraight, withSampleReviews } from './review-lines';
import { SAMPLE_REVIEWS, viewerIds, type TeamReviews } from './team-reviews';

const DANA = 'a399f73add3dbb2d';
const SOFIA = '0406ec723c59bb8d';
const LEO = 'af419771c6f4d96f';
const sample: TeamReviews = {
  designReview: SAMPLE_REVIEWS,
  members: [
    { name: 'Dana', ref: DANA, role: 'admin', libraryOwner: true },
    { name: 'Sofia', ref: SOFIA, role: 'edit' },
    { name: 'Leo', ref: LEO, role: 'edit' },
  ],
  githubOwners: [],
  products: [
    { key: 'prints', name: 'Acme Prints' },
    { key: 'crm', name: 'Acme CRM' },
    { key: 'library', name: 'Library', default: true },
  ],
};
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const start = (author: string, member: string, pieces: MissingPiece[]) =>
  withPiecesRecord(explorationPrBody({ name: 'X', purpose: '', slug: 'x', author }, { owner: 'acme', repo: 'r', packages: [], apps: {} }).replace('"slug":"x"', `"slug":"x","member":"${member}"`), { checkedAt: 't', pieces, links: [] });
const sofiaAsked = withLibraryAsked(withLeadAsked(start('sofia', SOFIA, [timeline]), { at: 'a', byName: 'Sofia' }), { at: 'a' });
const leoAsked = withLeadAsked(start('leo', LEO, []), { at: 'a', byName: 'Leo' });

describe('the status second line (the spec table)', () => {
  it('In review: who and why, "your" for the hat holder', () => {
    expect(reviewSecondLine(leoAsked, { team: sample, product: 'crm', viewer: viewerIds(null, LEO) })).toBe("Waiting for Dana's design review");
    expect(reviewSecondLine(leoAsked, { team: sample, product: 'crm', viewer: viewerIds(null, DANA) })).toBe('Waiting for your design review');
    expect(reviewSecondLine(sofiaAsked, { team: sample, product: 'prints', viewer: viewerIds(null, DANA) })).toBe('Waiting for your design review and your library decision on Timeline');
    expect(reviewSecondLine(withDesignOk(sofiaAsked, { at: 'b' }), { team: sample, product: 'prints', viewer: viewerIds(null, SOFIA) })).toBe("Waiting for Dana's library decision on Timeline");
  });

  it('Done exploring went straight to Ready to build: the no review line', () => {
    const off: TeamReviews = { ...sample, designReview: { ...SAMPLE_REVIEWS, crm: { on: false } } };
    const done = withDoneExploring(start('leo', LEO, []), { branch: 'b', doneAt: '2026-11-12T10:00:00.000Z' });
    expect(wentStraight(done)).toBe(true);
    expect(reviewSecondLine(done, { team: off, product: 'crm', productName: 'Acme CRM' })).toBe('No review needed: nothing new for the library, and Acme CRM has no design review');
    // A screen that went through a review keeps that review's words: no "no review" line.
    expect(wentStraight(withDoneExploring(withDecision(leoAsked, { kind: 'looks-right', at: 'b', byName: 'Dana' }), { branch: 'b', doneAt: 'c' }))).toBe(false);
    expect(reviewSecondLine(start('leo', LEO, []), { team: sample, product: 'crm' })).toBeNull();
  });
});

describe("the author's card: both reviews as current steps", () => {
  it('names each hat once, both now', () => {
    expect(reviewStepsOf(sofiaAsked, { team: sample, product: 'prints', viewer: viewerIds(null, SOFIA) })).toEqual([
      { text: 'Dana reviews the design', when: 'now', current: true },
      { text: 'Dana decides on Timeline for the library', when: 'now', current: true },
    ]);
    expect(reviewStepsOf(leoAsked, { team: sample, product: 'crm', viewer: viewerIds(null, DANA) }).map((s) => s.text)).toEqual(['You review the design']);
    expect(reviewStepsOf(start('leo', LEO, []), { team: sample, product: 'crm' })).toEqual([]);
  });

  it('both reviews read as one current step of the Stepper (it marks one current), one review as it is', () => {
    const steps = reviewStepsOf(sofiaAsked, { team: sample, product: 'prints', viewer: viewerIds(null, SOFIA) });
    expect(asOneStep(steps)).toEqual([{ text: 'Dana reviews the design and decides on Timeline for the library', when: 'now', current: true, lines: ['Dana reviews the design', 'Dana decides on Timeline for the library'] }]);
    const mine = reviewStepsOf(sofiaAsked, { team: sample, product: 'prints', viewer: viewerIds(null, DANA) });
    expect(asOneStep(mine)[0]!.text).toBe('You review the design and decide on Timeline for the library');
    expect(asOneStep(mine)[0]!.lines).toEqual(['You review the design', 'You decide on Timeline for the library']);
    expect(asOneStep([{ text: 'Dana reviews the design', when: 'now', current: true }, { text: 'The library owners decide on Timeline', when: 'now', current: true }])[0]!.text).toBe('Dana reviews the design, the library owners decide on Timeline');
    expect(asOneStep(steps.slice(0, 1))).toEqual(steps.slice(0, 1));
    // One review waiting: one line, no lines list.
    expect(asOneStep(steps.slice(0, 1))[0]!.lines).toBeUndefined();
  });

  it('after Looks right, the line says the library decision still waits', () => {
    expect(stillWaitsLine(['Timeline'], [{ name: 'Dana' }])).toBe("Your design review is in. It still waits for Dana's library decision on Timeline.");
    expect(stillWaitsLine(['Timeline', 'Stat card'], [{ name: 'Dana' }, { name: 'Ann' }])).toBe('Your design review is in. It still waits for the library decision on Timeline and Stat card.');
  });
});

describe('Home rows and the Explorations count', () => {
  it('one row names both hats', () => {
    expect(hatRowLine('Sofia', ['design-review', 'library'])).toBe("Sofia's screen: your design review and a library decision");
    expect(hatRowLine('Leo', ['design-review'])).toBe("Leo's screen: your design review");
    expect(hatRowLine('Sofia', ['library'])).toBe("Sofia's screen: a library decision");
    expect(hatRowLine('Sofia', [])).toBeNull();
  });

  it('the Explorations count counts design reviews, never a library decision alone', () => {
    expect(countsOnExplorations(['design-review'])).toBe(true);
    expect(countsOnExplorations(['design-review', 'library'])).toBe(true);
    expect(countsOnExplorations(['library'])).toBe(false);
    // Hats unknown (reviews not read yet) or another turn (a question): the old rule decides.
    expect(countsOnExplorations(null)).toBe(true);
    expect(countsOnExplorations([])).toBe(true);
  });
});

describe('the sample team', () => {
  it("gets Dana's reviews when the server keeps none, and keeps a team's own", () => {
    const bare: TeamReviews = { ...sample, designReview: null, members: sample.members.map(({ libraryOwner: _l, ...m }) => m) };
    const t = withSampleReviews(bare, true);
    expect(t.designReview).toEqual(SAMPLE_REVIEWS);
    expect(t.members.find((m) => m.ref === DANA)?.libraryOwner).toBe(true);
    expect(withSampleReviews(bare, false)).toBe(bare);
    const own = { ...bare, designReview: { '*': { on: false as const } } };
    expect(withSampleReviews(own, true).designReview).toEqual({ '*': { on: false } });
  });
});
