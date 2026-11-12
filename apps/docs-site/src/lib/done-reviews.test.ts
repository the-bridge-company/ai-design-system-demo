import { describe, expect, it } from 'vitest';
import { explorationPrBody, withDesignOk, withPiecesRecord, type MissingPiece, type ProductConfig } from '@bridge-ds/core';
import { asksSomeone, doneConfirmationLine, doneDialogLine, githubAsked, pmGateRequired, productNameOf, reviewsAtDone, SAMPLE_REVIEW_MEMBERS, teamReviewsForDone } from './done-reviews';
import { SAMPLE_REVIEWS, type TeamReviews } from './team-reviews';

const DANA = 'a399f73add3dbb2d';
const SOFIA = '0406ec723c59bb8d';
const LEO = 'af419771c6f4d96f';
const products: ProductConfig[] = [
  { key: 'prints', name: 'Acme Prints' },
  { key: 'crm', name: 'Acme CRM' },
];
const sample = teamReviewsForDone({ sample: true, review: null, githubOwners: ['real-owner'], products });
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const bare = (author: string, member: string) => explorationPrBody({ name: 'X', purpose: '', slug: 'x', author }, { owner: 'acme', repo: 'r', packages: [], apps: {} }).replace('"slug":"x"', `"slug":"x","member":"${member}"`);
const checked = (author: string, member: string, pieces: MissingPiece[]) => withPiecesRecord(bare(author, member), { checkedAt: 't', pieces, links: [] });
const titles = (id: string) => (id === 'component-timeline' ? 'Timeline' : id);

describe('the team Done exploring reads', () => {
  it('the sample team: SAMPLE_REVIEWS and its cast, never the GitHub account that hosts it', () => {
    expect(sample.designReview).toBe(SAMPLE_REVIEWS);
    expect(sample.githubOwners).toEqual([]);
    expect(SAMPLE_REVIEW_MEMBERS.map((m) => [m.name, Boolean(m.libraryOwner)])).toEqual([
      ['Dana', true],
      ['Sofia', false],
      ['Leo', false],
      ['Ann', false],
    ]);
  });
  it('an email team: the server map; a GitHub team: null, so bridge.config.json decides', () => {
    const map = { '*': { on: false as const } };
    expect(teamReviewsForDone({ sample: false, review: { designReview: map, members: [] }, githubOwners: ['flo'], products }).designReview).toBe(map);
    const gh = teamReviewsForDone({ sample: false, review: { designReview: null, members: [] }, githubOwners: ['flo'], products });
    expect(gh.designReview).toBeNull();
    expect(gh.githubOwners).toEqual(['flo']);
  });
});

describe('Done exploring asks the two reviews', () => {
  it("Leo's Deal pipeline cards: Dana's design review only, then the line names her", () => {
    const asked = reviewsAtDone(checked('leo', LEO, []), { team: sample, product: 'crm', author: [`member:${LEO}`], ticked: [] });
    expect(asksSomeone(asked)).toBe(true);
    expect(asked.library).toBeNull();
    expect(doneConfirmationLine(asked, { product: 'Acme CRM' })).toBe("Sent. Waiting for Dana's design review.");
    expect(doneDialogLine(asked, 'Acme CRM')).toBe("Dana's design review comes first. Nothing closes, and your developers take it from there.");
    expect(pmGateRequired(asked, false)).toBe(false);
  });

  it("Sofia's timeline: both reviews, in one line", () => {
    const asked = reviewsAtDone(checked('sofia', SOFIA, [timeline]), { team: sample, product: 'prints', author: [`member:${SOFIA}`], ticked: ['component-timeline'] });
    expect(doneConfirmationLine(asked, { product: 'Acme Prints', titles })).toBe("Sent. Waiting for Dana's design review and library decision on Timeline.");
    expect(doneDialogLine(asked, 'Acme Prints')).toBe("Dana's design review and library decision come first. Nothing closes, and your developers take it from there.");
  });

  it('Acme CRM with no design review and nothing new: straight to Ready to build, and the line says why', () => {
    const off: TeamReviews = { ...sample, designReview: { ...SAMPLE_REVIEWS, crm: { on: false } } };
    const asked = reviewsAtDone(checked('leo', LEO, []), { team: off, product: 'crm', author: [`member:${LEO}`], ticked: [] });
    expect(asksSomeone(asked)).toBe(false);
    expect(doneConfirmationLine(asked, { product: 'Acme CRM' })).toBe('Ready to build. No review needed: nothing new for the library, and Acme CRM has no design review.');
    expect(doneConfirmationLine(asked, { product: 'Acme CRM', requests: 2 })).toMatch(/2 pieces went to the library as requests\.$/);
    expect(pmGateRequired(asked, false)).toBe(true);
  });

  it('Dana in Acme Prints: no design review (her own), the library decision still asked, and said', () => {
    const asked = reviewsAtDone(checked('dana', DANA, [timeline]), { team: sample, product: 'prints', author: [`member:${DANA}`], ticked: [] });
    expect(asked.design).toBeNull();
    expect(asked.noDesign).toBe('author-only');
    expect(doneConfirmationLine(asked, { product: 'Acme Prints', authorName: 'Dana', titles })).toBe("Sent. Waiting for Dana's library decision on Timeline. No design review: Dana is Acme Prints' only reviewer.");
  });

  it('never checked: the ticked pieces ask the library owners', () => {
    const asked = reviewsAtDone(bare('leo', LEO), { team: sample, product: 'crm', author: [`member:${LEO}`], ticked: ['button-size-xs'] });
    expect(asked.library).toEqual({ owners: [{ id: `member:${DANA}`, name: 'Dana' }], pieces: ['button-size-xs'] });
    // Nothing ticked: nothing for the library.
    expect(reviewsAtDone(bare('leo', LEO), { team: sample, product: 'crm', author: [`member:${LEO}`], ticked: [] }).library).toBeNull();
  });

  it('a design review already given is not asked again, nor does the PM gate come back', () => {
    const body = withDesignOk(checked('leo', LEO, []), { at: 'b' });
    const asked = reviewsAtDone(body, { team: sample, product: 'crm', author: [`member:${LEO}`], ticked: [] });
    expect(asked.design).toBeNull();
    expect(pmGateRequired(asked, true)).toBe(false);
    expect(doneConfirmationLine(asked, { product: 'Acme CRM' })).toBe('Ready to build. No review needed: the design review already said it looks right, and nothing new for the library.');
  });

  it('names only GitHub logins on GitHub, never a member reference', () => {
    expect(githubAsked([{ id: `member:${DANA}`, name: 'Dana' }, { id: 'flo', name: 'Flo' }])).toEqual(['flo']);
  });

  it('names the product, else "this product"', () => {
    expect(productNameOf(products, 'crm')).toBe('Acme CRM');
    expect(productNameOf(products, null)).toBe('this product');
  });

  it('never writes an em dash', () => {
    const asked = reviewsAtDone(checked('sofia', SOFIA, [timeline]), { team: sample, product: 'prints', author: [`member:${SOFIA}`], ticked: [] });
    for (const t of [doneConfirmationLine(asked, { product: 'Acme Prints', titles }), doneDialogLine(asked, 'Acme Prints') ?? '']) expect(t).not.toMatch(/\u2014/);
  });
});
