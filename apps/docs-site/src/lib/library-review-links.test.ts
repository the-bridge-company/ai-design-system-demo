// Old addresses on Library review: the review queue's ?pr= and ?item=, the Library group's ?suggestion=, ?origin=,
// ?group= select the right piece or filter instead of the default view.
import { describe, expect, it } from 'vitest';
import { hasLegacy, itemTarget, landing, readLegacy, withoutLegacy } from './library-review-links';
import { reviewParams, withReviewParams } from './library-review';
import { change, leadChange, newComponent } from './library-fixtures.test-helpers';

const LEAD = { reviews: true };
const all = () => [change(), newComponent(), leadChange(30, 'Deepen the blue')];

describe('reading an old address', () => {
  it('reads the queue’s and the Library group’s parameters', () => {
    expect(readLegacy('?pr=13')).toMatchObject({ pr: 13, suggestion: null, item: null });
    expect(readLegacy('?item=change-13').pr).toBe(13);
    expect(readLegacy('?item=suggestion-42').suggestion).toBe(42);
    expect(readLegacy('?item=guidance-Tabs').item).toBe('guidance-Tabs');
    expect(readLegacy('?origin=lead&group=exploration')).toMatchObject({ origin: 'lead', group: 'exploration' });
    expect(readLegacy('?origin=all').origin).toBeNull();
    expect(hasLegacy(readLegacy('?view=list'))).toBe(false);
    expect(withoutLegacy('?pr=3&view=list&item=x')).toBe('?view=list');
  });

  it('sends an exploration’s row to Explorations and the other rows to Home, before any read', () => {
    expect(itemTarget('exploration-review-crm#4')).toBe('explorations/?exploration=4&product=crm');
    expect(itemTarget('exploration-review-4')).toBe('explorations/?exploration=4');
    expect(itemTarget('dev-question-#9')).toBe('explorations/?exploration=9');
    expect(itemTarget('guidance-Tabs')).toBe('');
    expect(itemTarget('health-contrast')).toBe('');
    expect(itemTarget('join-abc')).toBe('');
    expect(itemTarget('something-else')).toBeNull();
  });
});

describe('where it lands once the pieces are read', () => {
  it('opens the library change an old ?pr= or ?suggestion= names, whatever the filters', () => {
    const to = landing(readLegacy('?pr=13'), all(), LEAD);
    expect(to.current).toBe(change().key);
    expect(to.view).toBe('one');
    expect(to.filters).toEqual({ status: ['waiting'], asked: [], product: [] });
    expect(landing(readLegacy('?suggestion=13'), all(), LEAD).current).toBe(change().key);
    // A decided one: Decided joins the Status filter so it shows.
    expect(landing(readLegacy('?pr=13'), [{ ...change(), state: 'decided' as const }], LEAD).filters.status).toEqual(['waiting', 'decided']);
    // A designer reads it in the list.
    expect(landing(readLegacy('?pr=13'), all(), { reviews: false }).view).toBe('list');
  });

  it('sends a ?pr= that is no library change to Explorations, and opens a suggestion in place', () => {
    expect(landing(readLegacy('?pr=99'), all(), LEAD).redirect).toBe('explorations/?pr=99');
    expect(landing(readLegacy('?suggestion=42'), all(), LEAD)).toMatchObject({ suggestion: 42, redirect: null });
  });

  it('turns ?origin= into the Product filter and ?group= into a view', () => {
    expect(landing(readLegacy('?origin=lead'), all(), LEAD).filters).toEqual({ product: ['library'] });
    expect(landing(readLegacy('?origin=explorations'), all(), LEAD).filters).toEqual({ product: ['crm', 'prints'] });
    expect(landing(readLegacy('?group=exploration'), all(), LEAD).view).toBe('map');
    expect(landing(readLegacy('?group=component'), all(), LEAD).view).toBe('list');
  });

  it('keeps the Map in the address like the other views', () => {
    expect(reviewParams('?view=map', LEAD).view).toBe('map');
    expect(withReviewParams('', { status: ['waiting'], asked: [], product: [] }, 'map', LEAD)).toBe('?view=map');
    expect(withReviewParams('?view=map', { status: ['waiting'], asked: [], product: [] }, 'one', LEAD)).toBe('');
  });
});
