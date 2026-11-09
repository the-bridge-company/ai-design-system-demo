// Who gets it (lr-reach): the products a piece reaches, the screens Bridge knows, and never an invented count.
import { describe, expect, it } from 'vitest';
import { askingScreens, listWords, originSentence, reachOf, shownScreens } from './library-reach';
import { change, conflict, leadChange, newComponent, PRODUCTS } from './library-fixtures.test-helpers';

describe('who gets a piece', () => {
  it('reaches every product for a change to something that exists, and counts no screen it cannot list', () => {
    const r = reachOf(change(), PRODUCTS);
    expect(r.products.map((p) => p.key)).toEqual(['prints', 'crm']);
    expect(r.everywhere).toBe(true);
    expect(r.link).toBe('2 products');
    expect(r.sentence).toBe('Every screen of Acme Prints and Acme CRM that uses it changes. Bridge does not list those screens yet.');
    // The asking exploration is the one screen Bridge knows, in its own product.
    expect(r.products.find((p) => p.key === 'prints')?.screens.map((s) => s.name)).toEqual(['Bulk actions on products']);
    expect(r.products.find((p) => p.key === 'crm')?.screens).toEqual([]);
  });

  it('counts the screens of a new piece: the ones that asked for it get it first', () => {
    const r = reachOf(newComponent(), PRODUCTS);
    expect(r.everywhere).toBe(false);
    expect(r.screens).toBe(1);
    expect(r.link).toBe('2 products · 1 screen');
    expect(r.sentence).toBe('Acme Prints and Acme CRM get it in the library. Nothing changes until a screen uses it: the screen below asked for it first.');
    expect(askingScreens(newComponent(), PRODUCTS)[0]).toMatchObject({ number: 7, productKey: 'crm', designer: 'Sofia' });
  });

  it('lists both screens of a conflict, each in its product', () => {
    const r = reachOf(conflict(), PRODUCTS);
    expect(r.products.map((p) => [p.key, p.screens.map((s) => s.designer)])).toEqual([
      ['prints', ['Sofia']],
      ['crm', ['Leo']],
    ]);
  });

  it('reaches no product once kept in its screen', () => {
    const r = reachOf({ ...newComponent(), state: 'decided', decided: 'kept' }, PRODUCTS);
    expect(r.products).toEqual([]);
    expect(r.stays).toBe(true);
    expect(r.sentence).toBe("Kept in Sofia's screen: the library does not change, no product gets it.");
  });

  it('says so plainly when the team has no product yet', () => {
    const r = reachOf(leadChange(30, 'Tabs: when tabs are the wrong choice'), [{ key: 'library', name: 'Library', default: true }]);
    expect(r.products).toEqual([]);
    expect(r.link).toBe('No product');
    expect(r.sentence).toBe('This team has no product in Bridge yet: the library is all that gets it.');
  });

  it('says the origin in one sentence, never as chips', () => {
    expect(originSentence(change(), 'Dana')).toEqual({ before: 'Asked by Leo in ', link: { label: 'Bulk actions on products', href: expect.any(String) }, after: ', Acme Prints. A color change.' });
    expect(originSentence(leadChange(30, 'Deepen the blue'), 'Dana').before).toBe('Made by you. A color change.');
    expect(originSentence(conflict(), 'Dana').before).toBe('Asked two ways: Sofia in Order fulfilment timeline, Leo in Deal pipeline cards.');
  });

  it('shows 4 screens per product, then Show all N', () => {
    expect(shownScreens([1, 2, 3, 4, 5, 6], false)).toEqual({ shown: [1, 2, 3, 4], more: 'Show all 6' });
    expect(shownScreens([1, 2, 3, 4, 5, 6], true).more).toBeNull();
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
