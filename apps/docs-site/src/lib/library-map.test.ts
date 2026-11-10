// The Map (lr-map): where each piece comes from, what changes, who gets it, and what a click narrows to.
import { describe, expect, it } from 'vitest';
import { buildMap, focusOf, mapAvailable } from './library-map';
import { change, conflict, LEAD, leadChange, newComponent, PRODUCTS } from './library-fixtures.test-helpers';

const pieces = () => [conflict(), change(), newComponent(), leadChange(30, 'Deepen the blue'), leadChange(31, 'Lighter border')];

describe('the map graph', () => {
  it('has one box per exploration, the lead’s own changes as one dashed box, and the products', () => {
    const g = buildMap(pieces(), PRODUCTS, LEAD);
    expect(g.sources.map((s) => [s.label, s.sub, s.lead])).toEqual([
      ['Contact page summary', 'Sofia · Acme CRM', false],
      ['Deal pipeline cards', 'Leo · Acme CRM', false],
      ['Bulk actions on products', 'Leo · Acme Prints', false],
      ['You, library changes', '2 changes', true],
    ]);
    // The lead's own pieces themselves in the middle: who made them is said once, on the left.
    expect(g.pieces.map((n) => n.label)).toEqual(['Card', 'Deeper primary blue', 'ProfileHeader', 'Deepen the blue', 'Lighter border']);
    expect(g.products.map((p) => p.label)).toEqual(['Acme Prints', 'Acme CRM']);
  });

  it('draws a conflict as two amber links into one piece', () => {
    const g = buildMap(pieces(), PRODUCTS, LEAD);
    const into = g.links.filter((l) => l.to === g.pieces[0]!.id);
    expect(into).toHaveLength(2);
    expect(into.every((l) => l.conflict)).toBe(true);
    expect(g.pieces[0]!.conflict).toBe(true);
  });

  it('says where a lead’s change comes from by its kind, and folds many of one kind by that kind', () => {
    const g = buildMap([leadChange(30, 'Deepen the blue')], PRODUCTS, LEAD);
    expect(g.pieces.map((n) => [n.label, n.folded])).toEqual([['Deepen the blue', false]]);
    expect(g.sources[0]!.sub).toBe('1 change');
    const docs = [40, 41, 42, 43].map((n) => ({ ...leadChange(n, `Tabs: when tabs are the wrong choice ${n}`), mine: false, by: 'Leo', leadReason: 'docs' }));
    const d = buildMap(docs, PRODUCTS, LEAD);
    expect(d.sources.map((x) => x.label)).toEqual(['Leo, docs drafts']);
    expect(d.pieces.map((n) => [n.label, n.folded])).toEqual([['4 docs drafts', true]]);
  });

  it('links nothing to a product for a piece kept in its screen', () => {
    const g = buildMap([{ ...newComponent(), state: 'decided', decided: 'kept' }], PRODUCTS, LEAD);
    expect(g.products).toEqual([]);
    expect(g.links.filter((l) => l.to.startsWith('d:'))).toEqual([]);
  });
});

describe('a click on a box', () => {
  it('narrows the list to what an exploration asks for and lights its paths', () => {
    const g = buildMap(pieces(), PRODUCTS, LEAD);
    const src = g.sources.find((s) => s.label === 'Contact page summary')!;
    const f = focusOf(g, src.id)!;
    expect([...f.keys]).toEqual([conflict().key, newComponent().key]);
    expect(f.line).toEqual({ before: 'Showing what ', strong: 'Contact page summary', after: ' asks for' });
    expect(f.lit.has(src.id)).toBe(true);
    expect(f.lit.has('d:crm')).toBe(true);
  });

  it('narrows to what a product gets, and to what the lead made', () => {
    const g = buildMap(pieces(), PRODUCTS, LEAD);
    expect(focusOf(g, 'd:crm')!.keys.size).toBe(5);
    expect(focusOf(g, 'd:crm')!.line.strong).toBe('Acme CRM');
    const mine = focusOf(g, g.sources.find((s) => s.lead)!.id)!;
    expect(mine.keys.size).toBe(2);
    expect(mine.line).toEqual({ before: 'Showing ', strong: 'You, library changes', after: '' });
    expect(focusOf(g, 'nothing')).toBeNull();
  });

  it('is offered only on a wide screen with something to draw', () => {
    expect(mapAvailable({ narrow: false, pieces: 3 })).toBe(true);
    expect(mapAvailable({ narrow: true, pieces: 3 })).toBe(false);
    expect(mapAvailable({ narrow: false, pieces: 0 })).toBe(false);
  });
});
