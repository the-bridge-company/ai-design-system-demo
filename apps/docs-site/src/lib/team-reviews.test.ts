import { describe, expect, it } from 'vitest';
import { explorationPrBody, withDesignOk, withLeadAsked, withLibraryAsked, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { libraryOwners, productReviewers, reviewGithubOwners, reviewsToAsk, SAMPLE_REVIEWS, viewerHats, viewerIds, waitingLineOf, type TeamReviews } from './team-reviews';

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

describe('the sample team: Dana holds both hats', () => {
  it('names Dana as every product\'s design reviewer and as library owner', () => {
    expect(productReviewers(sample, 'crm')).toEqual([{ id: `member:${DANA}`, name: 'Dana' }]);
    expect(productReviewers(sample, 'prints')).toEqual([{ id: `member:${DANA}`, name: 'Dana' }]);
    expect(productReviewers(sample, 'library')).toBeNull();
    expect(libraryOwners(sample)).toEqual([{ id: `member:${DANA}`, name: 'Dana' }]);
  });

  it("Leo's Deal pipeline cards: Waiting for Dana's design review only", () => {
    const body = start('leo', LEO, []);
    const r = reviewsToAsk(body, { team: sample, product: 'crm', author: [`member:${LEO}`] });
    expect(r.design?.reviewers.map((x) => x.name)).toEqual(['Dana']);
    expect(r.library).toBeNull();
    const asked = withLeadAsked(body, { at: '2026-11-12T10:00:00.000Z', byName: 'Leo' });
    expect(waitingLineOf(asked, { team: sample, product: 'crm' })).toBe("Waiting for Dana's design review");
    expect(waitingLineOf(asked, { team: sample, product: 'crm', viewer: viewerIds(null, DANA) })).toBe('Waiting for your design review');
    expect(viewerHats(asked, { team: sample, product: 'crm', viewer: viewerIds(null, DANA) })).toEqual(['design-review']);
    expect(viewerHats(asked, { team: sample, product: 'crm', viewer: viewerIds(null, LEO) })).toEqual([]);
  });

  it("Sofia's Order fulfilment timeline: both hats on one row for Dana", () => {
    const body = start('sofia', SOFIA, [timeline]);
    const r = reviewsToAsk(body, { team: sample, product: 'prints', author: [`member:${SOFIA}`] });
    expect(r.library?.pieces).toEqual(['component-timeline']);
    const asked = withLibraryAsked(withLeadAsked(body, { at: 'a', byName: 'Sofia' }), { at: 'a' });
    expect(waitingLineOf(asked, { team: sample, product: 'prints', viewer: viewerIds(null, DANA) })).toBe('Waiting for your design review and your library decision on Timeline');
    expect(waitingLineOf(asked, { team: sample, product: 'prints', viewer: viewerIds(null, SOFIA) })).toBe("Waiting for Dana's design review and library decision on Timeline");
    expect(viewerHats(asked, { team: sample, product: 'prints', viewer: viewerIds(null, DANA) })).toEqual(['design-review', 'library']);
    const yes = withDesignOk(asked, { at: 'b' });
    expect(waitingLineOf(yes, { team: sample, product: 'prints' })).toBe("Waiting for Dana's library decision on Timeline");
  });

  it('Dana exploring in Acme Prints: no design review (she is its only reviewer), the library decision still applies', () => {
    const body = start('dana', DANA, [timeline]);
    const r = reviewsToAsk(body, { team: sample, product: 'prints', author: [`member:${DANA}`] });
    expect(r.design).toBeNull();
    expect(r.noDesign).toBe('author-only');
    expect(r.library?.owners.map((o) => o.name)).toEqual(['Dana']);
  });
});

describe('a GitHub team: bridge.config.json decides', () => {
  const team: TeamReviews = { designReview: null, members: [], githubOwners: ['flo', 'acme/design'], products: [{ key: 'shop', name: 'Shop', designReview: { reviewers: ['sam'] } }, { key: 'blog', name: 'Blog', designReview: false }, { key: 'crm', name: 'CRM' }] };
  it('reads each product\'s design review, the design owners by default', () => {
    expect(productReviewers(team, 'shop')).toEqual([{ id: 'sam', name: 'sam' }]);
    expect(productReviewers(team, 'blog')).toBeNull();
    expect(productReviewers(team, 'crm')).toEqual([{ id: 'flo', name: 'flo' }]);
    expect(libraryOwners(team)).toEqual([{ id: 'flo', name: 'flo' }]);
  });
});

describe('the GitHub design owners the reviews may name', () => {
  it('are the config people of a real team, and none on the sample team (its cast only)', () => {
    expect(reviewGithubOwners('acme/ds', ['@Lee', 'lee', '@acme/design'])).toEqual(['lee']);
    expect(reviewGithubOwners('acme-design-demo/bridge-demo-ds', ['peterbono'])).toEqual([]);
    expect(reviewGithubOwners('peterbono/bridge-demo-ds', ['peterbono'])).toEqual([]);
  });
});
