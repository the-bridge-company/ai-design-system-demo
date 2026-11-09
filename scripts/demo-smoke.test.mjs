import { describe, expect, it } from 'vitest';
import { cardProblems, EXPECTED, ownErrors } from './demo-smoke.mjs';

describe('demo smoke test', () => {
  const prints = EXPECTED.find((p) => p.product === 'prints');
  const crm = EXPECTED.find((p) => p.product === 'crm');
  const card = (product, n, text) => ({ href: `/studio/acme-design-demo/bridge-demo-ds/changes/?exploration=${n}&product=${product}`, text });
  const allPrints = [card('prints', 1, 'Order fulfilment timeline Waiting for lead'), card('prints', 2, 'Bulk actions on products Exploring'), card('prints', 3, 'Review moderation drawer Shipped'), card('prints', 4, 'Compact dashboard numbers Exploring')];
  const allCrm = [card('crm', 1, 'Deal pipeline cards Waiting for lead'), card('crm', 2, 'Contact page summary Check the build'), card('crm', 3, 'Activity feed filters Exploring'), card('crm', 4, 'Onboarding empty states Exploring')];

  it('checks the two products of the sample team, Account app no more', () => {
    expect(EXPECTED.map((p) => p.product)).toEqual(['prints', 'crm']);
    expect(prints.explorations).toHaveLength(4);
    expect(crm.explorations).toHaveLength(4);
    expect(crm.explorations.filter((e) => e.check).map((e) => e.n)).toEqual([2]);
    expect(prints.explorations.some((e) => e.check)).toBe(false);
  });

  it('passes when every exploration is listed in its state', () => {
    expect(cardProblems(allPrints, prints)).toEqual([]);
    expect(cardProblems(allCrm, crm)).toEqual([]);
  });

  it('names a missing exploration and a card in the wrong state', () => {
    const problems = cardProblems([allCrm[0], card('crm', 2, 'Contact page summary Exploring'), allCrm[2]], crm);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/#2 .* does not say/);
    expect(problems[1]).toMatch(/#4 \(Onboarding empty states\) is missing/);
  });

  it("never takes another product's card for one of this product's explorations", () => {
    const problems = cardProblems(allCrm, prints);
    expect(problems).toHaveLength(4);
    expect(problems.every((p) => /is missing/.test(p))).toBe(true);
  });

  it("keeps the page's own console errors, never a visitor's expected refusals", () => {
    expect(ownErrors(['Failed to load resource: the server responded with a status of 401 ()', 'Failed to load resource: the server responded with a status of 404 ()', 'TypeError: x is undefined'])).toEqual(['TypeError: x is undefined']);
  });
});
