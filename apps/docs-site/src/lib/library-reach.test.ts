// Who gets it (lr-reach): the products a piece reaches, the screens Bridge knows, and never an invented count.
import { describe, expect, it } from 'vitest';
import { askingScreens, elementWords, kindsWords, listWords, measuredReach, originSentence, reachCell, reachOf, routeKey, shownScreens, type ReachData } from './library-reach';
import { change, conflict, leadChange, newComponent, PRODUCTS } from './library-fixtures.test-helpers';

describe('who gets a piece', () => {
  it('reaches every product for a change to something that exists, and counts no screen it cannot list', () => {
    const r = reachOf(change(), PRODUCTS);
    expect(r.products.map((p) => p.key)).toEqual(['prints', 'crm']);
    expect(r.everywhere).toBe(true);
    expect(r.link).toBe('2 products');
    expect(r.sentence).toBe('Every screen of Acme Prints and Acme CRM that uses it changes.');
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
      ['prints', []],
      ['crm', ['Sofia', 'Leo']],
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
    expect(originSentence(conflict(), 'Dana').before).toBe('Asked two ways: Sofia in Contact page summary, Leo in Deal pipeline cards.');
  });

  it('shows 4 screens per product, then Show all N', () => {
    expect(shownScreens([1, 2, 3, 4, 5, 6], false)).toEqual({ shown: [1, 2, 3, 4], more: 'Show all 6' });
    expect(shownScreens([1, 2, 3, 4, 5, 6], true).more).toBeNull();
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('the List column', () => {
  it('names a shared product set once in the header', async () => {
    const { reachColumn } = await import('./library-reach');
    const a = reachOf(change(), PRODUCTS);
    const b = reachOf(newComponent(), PRODUCTS);
    expect(reachColumn([a, b]).shared).toBe('Acme Prints, Acme CRM');
    const kept = reachOf({ ...newComponent(), state: 'decided', decided: 'kept' }, PRODUCTS);
    expect(reachColumn([a, kept]).shared).toBeNull();
  });
});

const zero = { buttons: 0, links: 0, fields: 0, text: 0, surfaces: 0 };
const screen = (id: string, title: string, route: string) => ({ id, title, route, image: `img/s-${id}` });
const DATA: ReachData = {
  measuredAt: '2026-11-10T08:00:00Z',
  products: [
    { key: 'prints', name: 'Acme Prints', screens: [screen('prints-0', 'Dashboard', '/?tenant=acme'), screen('prints-1', 'Products', '/?tenant=acme#/products'), screen('prints-2', 'Order detail', '/?tenant=acme#/orders/103')] },
    { key: 'crm', name: 'Acme CRM', screens: [screen('crm-0', 'Dashboard', '/'), screen('crm-1', 'Deals', '/#/deals')] },
  ],
  changes: [
    {
      repo: 'acme/ds',
      pr: 13,
      state: 'measured',
      screens: [
        { id: 'prints-0', before: 'img/s-prints-0', after: 'img/c13-prints-0-a', elements: { ...zero, buttons: 2, links: 3 } },
        { id: 'prints-1', before: 'img/s-prints-1', after: 'img/c13-prints-1-a', elements: { ...zero, buttons: 1 } },
      ],
    },
    { repo: 'acme/ds', pr: 17, state: 'new', screens: [] },
  ],
};
const ASKING = new Map([['crm#7', { spec: { kind: 'screen' as const, src: 'shot/crm-7.webp', screen: 'Contact page summary' }, route: '/#/deals?view=board' }]]);

describe('who gets it, measured', () => {
  it('counts the screens whose elements change, names their products, and the others once at the end', () => {
    const m = measuredReach(change(), reachOf(change(), PRODUCTS), DATA, ASKING);
    expect(m.status).toBe('measured');
    expect(m.products.map((x) => [x.name, x.screens.map((s) => [s.title, s.words])])).toEqual([
      [
        'Acme Prints',
        [
          ['Dashboard', '2 buttons, links'],
          ['Products', '1 button'],
        ],
      ],
    ]);
    expect(m.products[0]!.screens[0]).toMatchObject({ before: 'img/s-prints-0', after: { kind: 'screen', src: 'img/c13-prints-0-a' } });
    expect(m.headline).toBe('2 screens in Acme Prints: buttons and links.');
    expect(m.end).toBe('No screen of Acme CRM changes.');
    expect(reachCell(m)).toEqual({ label: '2 screens', hoverOnly: false });
  });

  it('never lists a product to say it does not know: a change not measured yet says Bridge is measuring', () => {
    const m = measuredReach(change(), reachOf(change(), PRODUCTS), null, ASKING);
    expect(m).toMatchObject({ status: 'measuring', products: [], screens: 0, headline: 'Bridge is measuring which screens change.', cell: 'Measuring', end: null });
    const other = measuredReach(change({ number: 99 }), reachOf(change({ number: 99 }), PRODUCTS), DATA, ASKING);
    expect(other.status).toBe('measuring');
  });

  it('says plainly when no screen changes', () => {
    const none: ReachData = { ...DATA, changes: [{ repo: 'acme/ds', pr: 13, state: 'measured', screens: [] }] };
    const m = measuredReach(change(), reachOf(change(), PRODUCTS), none, ASKING);
    expect(m).toMatchObject({ status: 'measured', products: [], headline: 'No screen of Acme Prints or Acme CRM changes.', cell: 'No screen changes', end: null });
  });

  it('shows a new piece on the screens that asked for it, beside the product screen at the same place', () => {
    const m = measuredReach(newComponent(), reachOf(newComponent(), PRODUCTS), DATA, ASKING);
    expect(m.status).toBe('asked');
    expect(m.products.map((x) => x.name)).toEqual(['Acme CRM']);
    expect(m.products[0]!.screens[0]).toMatchObject({ title: 'Contact page summary', before: 'img/s-crm-1', after: { src: 'shot/crm-7.webp' }, words: null, designer: 'Sofia' });
    expect(m.headline).toBe('1 screen in Acme CRM: the screen that asked for it.');
    expect(m.end).toBe('No screen of Acme Prints changes.');
    expect(m.cell).toBe('1 screen');
  });

  it('a change that only adds tokens changes no screen yet', () => {
    const p = change({ number: 17, title: 'feat(tokens): Add a highlight surface for new items', body: '' });
    const m = measuredReach(p, reachOf(p, PRODUCTS), DATA, ASKING);
    expect(m).toMatchObject({ status: 'asked', products: [], headline: 'No screen changes until a screen uses it.', cell: 'No screen changes yet' });
  });

  it('keeps the decided words for a piece kept in its screen', () => {
    const kept = { ...newComponent(), state: 'decided' as const, decided: 'kept' as const };
    expect(measuredReach(kept, reachOf(kept, PRODUCTS), DATA, ASKING)).toMatchObject({ status: 'stays', cell: 'No screen changes' });
  });

  it('says what changes on a screen in a few words, buttons counted', () => {
    expect(elementWords({ buttons: 1, links: 4 })).toBe('1 button, links');
    expect(elementWords({ links: 1 })).toBe('a link');
    expect(elementWords({ text: 9, surfaces: 2, fields: 1, buttons: 3 })).toBe('3 buttons, a field, text');
    expect(kindsWords([{ buttons: 1 }, { links: 2, text: 1 }])).toBe('buttons, links and text');
    expect(routeKey('/?tenant=acme#/products?view=list')).toBe('/products');
    expect(routeKey('/orders/12?x=1')).toBe('/orders/12');
    expect(routeKey('/?tenant=acme')).toBe('');
  });
});
