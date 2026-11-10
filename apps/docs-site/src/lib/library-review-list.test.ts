// The List as chapters: families in order, the most recent group first, columns only when filled, the tally, the
// product marks and what a chapter reaches.
import { describe, expect, it } from 'vitest';
import { chapterReach, chaptersOf, familiesOf, familyOf, productMarks, railLabel, recencyOf, shownColumns, tallyOf } from './library-review-list';
import type { PieceGroup, ReviewPiece } from './library-review';
import { reachOf, type Measured } from './library-reach';
import { change, conflict, LEAD, leadChange, newComponent, PRODUCTS } from './library-fixtures.test-helpers';

const measured = (status: Measured['status'], products: { key: string; name: string; screens: number }[] = []): Pick<Measured, 'status' | 'products'> => ({
  status,
  products: products.map((p) => ({ key: p.key, name: p.name, measured: p.screens, screens: Array.from({ length: p.screens }, (_, i) => ({ key: `${p.key}${i}`, title: 's', before: null, after: null, words: null, href: null, designer: null })) })),
});

describe('the List as chapters', () => {
  it('makes one chapter per family with its icon and line, and one per lead section without a rail', () => {
    const groups = [g('Colors', [change()]), g('Card', [conflict()]), g('Docs', [change()])];
    expect(chaptersOf(groups).map((c) => [c.label, c.icon, c.rail, c.note])).toEqual([
      ['Foundations', 'grid', true, 'Colors, spacing and type every screen uses'],
      ['Components', 'diamonds', true, 'Building blocks teams put on their screens'],
      ['Docs', 'doc', true, 'Guidance on how and when to use a piece'],
    ]);
    const sections = chaptersOf([{ key: 'decide', label: 'For you to decide', section: 'decide', note: null, pieces: [change()] }, { key: 'yours', label: 'Yours, waiting on someone else', section: 'yours', note: 'You never approve your own change', pieces: [] }]);
    expect(sections.map((c) => [c.label, c.icon, c.rail])).toEqual([
      ['For you to decide', null, false],
      ['Yours, waiting on someone else', null, false],
    ]);
  });

  it('says a group once: the Docs group of Docs leaves the rail empty', () => {
    expect(railLabel({ label: 'Docs' }, { label: 'Docs' })).toBeNull();
    expect(railLabel({ label: 'Colors' }, { label: 'Foundations' })).toBe('Colors');
  });

  it('tallies what waits for the lead, split by family; a designer’s count; nothing waits', () => {
    const shown = [change(), conflict(), newComponent()];
    const t = tallyOf([...shown, leadChange(30, 'Lighter border')], shown, LEAD, { status: ['waiting'] });
    expect([t.n, t.words]).toEqual([3, 'wait for you']);
    expect(t.families.map((f) => [f.label, f.n])).toEqual([
      ['Foundations', 1],
      ['Components', 2],
    ]);
    expect(t.note).toBe('1 of yours waits on others');
    expect(tallyOf(shown, shown, { ...LEAD, reviews: false }, { status: ['waiting'] })).toMatchObject({ n: 3, words: 'pieces', note: null });
    expect(tallyOf([], [], LEAD, { status: ['waiting'] })).toMatchObject({ n: null, words: 'Nothing waits for you' });
    expect(tallyOf(shown, shown, LEAD, { status: ['decided'] })).toMatchObject({ n: 3, words: 'decided' });
  });

  it('gives each product a mark, two letters when initials collide', () => {
    const m = productMarks(['Acme Prints', 'Acme CRM', 'Acme Pay', 'Acme Prints']);
    expect([m.get('Acme Prints'), m.get('Acme CRM'), m.get('Acme Pay')]).toEqual(['Pr', 'C', 'Pa']);
  });

  it('names what a chapter reaches once: measured screens first, the rule while measuring, none otherwise', () => {
    const r = reachOf(change(), PRODUCTS);
    expect(chapterReach([{ reach: r, measured: measured('measuring') }]).names).toBe('Acme Prints, Acme CRM');
    expect(chapterReach([{ reach: r, measured: measured('measured', [{ key: 'crm', name: 'Acme CRM', screens: 3 }, { key: 'prints', name: 'Acme Prints', screens: 0 }]) }]).names).toBe('Acme CRM');
    expect(chapterReach([{ reach: r, measured: measured('stays') }])).toMatchObject({ names: null, shown: [] });
    const eight = Array.from({ length: 8 }, (_, i) => ({ key: `p${i}`, name: `Acme ${i}`, screens: 1 }));
    const big = chapterReach([{ reach: r, measured: measured('measured', eight) }]);
    expect([big.shown.length, big.more, big.names]).toEqual([5, 3, '8 products']);
  });
});

const g = (label: string, pieces: ReviewPiece[], section: PieceGroup['section'] = 'decide'): PieceGroup => ({ key: `g:${label.toLowerCase()}`, label, section, note: null, pieces });
const at = (p: ReviewPiece, iso: string): ReviewPiece => ({ ...p, at: iso });

describe('the List in blocks', () => {
  it('puts each group in its family', () => {
    expect(familyOf(g('Colors', []))).toBe('foundations');
    expect(familyOf(g('Brands', []))).toBe('foundations');
    expect(familyOf(g('Avatar', []))).toBe('components');
    expect(familyOf(g('Docs', []))).toBe('docs');
    expect(familyOf({ key: 'yours', label: 'Yours, waiting on someone else', section: 'yours' })).toBe('sections');
  });

  it('orders Foundations, Components, Docs, the most recent block first inside', () => {
    const fam = familiesOf([g('Docs', [change()]), g('Avatar', [at(newComponent(), '2026-11-01T00:00:00Z')]), g('Card', [at(newComponent(), '2026-11-08T00:00:00Z')]), g('Spacing', [change()]), g('Colors', [at(change(), '2026-11-09T00:00:00Z')])]);
    expect(fam.map((f) => [f.label, f.groups.map((x) => x.label)])).toEqual([
      ['Foundations', ['Colors', 'Spacing']],
      ['Components', ['Card', 'Avatar']],
      ['Docs', ['Docs']],
    ]);
  });

  it('reads a piece’s recency from itself or its askers', () => {
    expect(recencyOf(at(change(), '2026-11-02T00:00:00Z'))).toBe(Date.parse('2026-11-02T00:00:00Z'));
    expect(Number.isNaN(recencyOf(change()))).toBe(true);
  });

  it('hides a column no row fills', () => {
    expect(shownColumns({ state: false, next: false, action: true })).toEqual(['action']);
  });
});
