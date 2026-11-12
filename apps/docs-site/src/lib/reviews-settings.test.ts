import { describe, expect, it } from 'vitest';
import { memberRef } from '../../api/_lib/exploration-member';
import { ANY_DESIGNER, REVIEWS_WORDS, designReviewLine, leavesNoOwner, libraryOwnersLine, memberRefOf, reviewRows, reviewerValues, settingFromValues, turnedOn } from './reviews-settings';
import { SAMPLE_REVIEWS } from './team-reviews';

const DANA = 'a399f73add3dbb2d';
const LEO = 'af419771c6f4d96f';
const names: Record<string, string> = { [DANA]: 'Dana', [LEO]: 'Leo', flo: 'Flo' };
const nameOf = (id: string) => names[id] ?? id;

describe('Settings > Reviews', () => {
  it('lists every product, then the Library, each with its own setting or the team default', () => {
    const rows = reviewRows(
      [
        { key: 'prints', name: 'Acme Prints' },
        { key: 'crm', name: 'Acme CRM' },
        { key: 'library', name: 'Library' },
      ],
      { ...SAMPLE_REVIEWS, crm: { on: false } },
    );
    expect(rows.map((r) => [r.key, r.name, r.setting.on])).toEqual([
      ['prints', 'Acme Prints', true],
      ['crm', 'Acme CRM', false],
      ['library', 'Library', false],
    ]);
  });

  it('says each setting in one line, summary first', () => {
    expect(designReviewLine({ on: false }, nameOf)).toBe('No design review');
    expect(designReviewLine({ on: true, reviewers: [DANA] }, nameOf)).toBe('Dana reviews');
    expect(designReviewLine({ on: true, reviewers: [DANA, LEO, 'flo'] }, nameOf)).toBe('Dana, Leo or Flo reviews');
    expect(designReviewLine({ on: true, reviewers: ANY_DESIGNER }, nameOf)).toBe('Any designer reviews');
    // An empty named list reads as the GitHub design owners.
    expect(designReviewLine({ on: true, reviewers: [] }, nameOf, ['flo'])).toBe('Flo reviews');
    expect(designReviewLine({ on: true, reviewers: [] }, nameOf)).toBe('Nobody reviews yet');
    expect(libraryOwnersLine(['Dana'])).toBe('Dana decides what the library keeps');
    expect(libraryOwnersLine(['Dana', 'Flo', 'Dana'])).toBe('Dana and Flo decide what the library keeps');
    expect(libraryOwnersLine([])).toBe('Nobody decides what the library keeps yet');
  });

  it('turning a design review on asks the team default, else the library owners, else any designer', () => {
    expect(turnedOn({ on: true, reviewers: [LEO] }, [DANA])).toEqual({ on: true, reviewers: [LEO] });
    expect(turnedOn({ on: false }, [DANA, '@Flo'])).toEqual({ on: true, reviewers: [DANA, 'flo'] });
    expect(turnedOn(null, [])).toEqual({ on: true, reviewers: ANY_DESIGNER });
  });

  it('picks who reviews: Any designer replaces the names, a name replaces Any designer, nobody is refused', () => {
    expect(reviewerValues({ on: true, reviewers: ANY_DESIGNER })).toEqual([ANY_DESIGNER]);
    expect(reviewerValues({ on: false })).toEqual([]);
    expect(settingFromValues([DANA, ANY_DESIGNER], { on: true, reviewers: [DANA] })).toEqual({ on: true, reviewers: ANY_DESIGNER });
    expect(settingFromValues([ANY_DESIGNER, LEO], { on: true, reviewers: ANY_DESIGNER })).toEqual({ on: true, reviewers: [LEO] });
    expect(settingFromValues([DANA, LEO], { on: true, reviewers: [DANA] })).toEqual({ on: true, reviewers: [DANA, LEO] });
    expect(settingFromValues([], { on: true, reviewers: [DANA] })).toBeNull();
  });

  it('keeps someone who decides what the library keeps', () => {
    expect(leavesNoOwner({ ownersAfter: 0, githubOwners: 0 })).toBe(true);
    expect(leavesNoOwner({ ownersAfter: 0, githubOwners: 1 })).toBe(false);
  });

  it('hashes a member reference the way the server does', async () => {
    expect(await memberRefOf(' Dana@Acme.example ')).toBe(memberRef('dana@acme.example'));
    expect(await memberRefOf('dana@acme.example')).toBe(DANA);
  });

  it('uses the core hat words and never an em dash', () => {
    expect(REVIEWS_WORDS.libraryRole).toBe('Decides what the library keeps');
    expect(REVIEWS_WORDS.migrated).toBe("Reviews now have two parts. Check who reviews each product's design.");
    const all = Object.values(REVIEWS_WORDS).map((w) => (typeof w === 'function' ? w('Acme CRM') : w));
    for (const w of all) expect(w).not.toMatch(/\u2014/);
  });
});
