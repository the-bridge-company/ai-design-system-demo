// The one rule for a group of people (lib/people-line.ts): 1, 2 and 3 people all named and all drawn; 4 or more,
// two named and drawn, the rest counted.
import { describe, expect, it } from 'vitest';
import { notifiedLine, peopleFacesMax, peopleNames } from './people-line';

describe('peopleNames', () => {
  it('one, two and three people: every name', () => {
    expect(peopleNames(['Sofia'])).toBe('Sofia');
    expect(peopleNames(['Sofia', 'Leo'])).toBe('Sofia and Leo');
    expect(peopleNames(['Sofia', 'Leo', 'Ann'])).toBe('Sofia, Leo and Ann');
  });

  it('four people and more: the first two, then the rest counted', () => {
    expect(peopleNames(['Sofia', 'Leo', 'Ann', 'Dana'])).toBe('Sofia, Leo and 2 others');
    expect(peopleNames(['Sofia', 'Leo', 'Ann', 'Dana', 'Kai'])).toBe('Sofia, Leo and 3 others');
  });

  it('counts a repeated name once, and says nothing for nobody', () => {
    expect(peopleNames(['Sofia', 'Sofia', 'Leo'])).toBe('Sofia and Leo');
    expect(peopleNames([])).toBe('');
  });
});

describe('peopleFacesMax', () => {
  it('draws everyone up to three, then the first two before the "+N"', () => {
    expect([1, 2, 3, 4, 9].map(peopleFacesMax)).toEqual([3, 3, 3, 2, 2]);
  });
});

describe('notifiedLine', () => {
  it('reads as a sentence for 1, 2, 3 and 4+ people', () => {
    expect(notifiedLine(['Sofia'])).toBe('Sofia will be notified.');
    expect(notifiedLine(['Sofia', 'Leo'])).toBe('Sofia and Leo will be notified.');
    expect(notifiedLine(['Sofia', 'Leo', 'Ann'])).toBe('Sofia, Leo and Ann will be notified.');
    expect(notifiedLine(['Sofia', 'Leo', 'Ann', 'Dana'])).toBe('Sofia, Leo and 2 others will be notified.');
    expect(notifiedLine([])).toBe('');
  });
});
