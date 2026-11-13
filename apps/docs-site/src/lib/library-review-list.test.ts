// The List as chapters: families in order, the most recent group first, columns only when filled, the tally, the
// product marks and what a chapter reaches.
import { describe, expect, it } from 'vitest';
import { sideLabel, tallySentence, chapterReach, chaptersOf, familiesOf, familyOf, listGrid, productMarks, railLabel, recencyOf, shownColumns, tallyOf } from './library-review-list';
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
    expect([big.shown.length, big.more, big.names]).toEqual([5, 3, 'Acme 0 and 7 more']);
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

  it('gives Asked by and From a column each, and folds Who gets it, then Today › After', () => {
    const g = listGrid({ box: true, askedMore: false, state: 'none', next: false, action: true });
    const tracks = (t: string) => t.match(/(?:minmax|calc)\([^()]*(?:\([^()]*\)[^()]*)*\)|var\(--[a-z0-9-]+\)/g) ?? [];
    // box, Today › After, Piece, Asked by, From, Who gets it, action
    expect(tracks(g.wide)).toHaveLength(7);
    expect(tracks(g.mid)).toHaveLength(6);
    expect(g.mid).not.toContain('var(--space-2)');
    expect(tracks(g.narrow)).toHaveLength(5);
    expect(g.narrow).not.toMatch(/^var\(--size-6\) var\(--size-40\)/);
    // The title column takes the rest; a row naming several people widens Asked by, a State column only when one is filled.
    expect(g.wide).toContain('minmax(var(--size-40), 1fr)');
    expect(listGrid({ box: false, askedMore: true, state: 'tag', next: false, action: false }).wide).toBe(
      'var(--size-40) minmax(var(--size-40), 1fr) var(--size-40) minmax(var(--size-40), 1fr) calc(var(--size-20) + var(--space-2)) var(--size-20)',
    );
  });
});

describe('tallySentence', () => {
  it('says the count in words, the split by family after it', () => {
    const t = { n: 12, words: 'wait for you', families: [{ family: 'foundations' as const, icon: 'grid' as never, label: 'Foundations', n: 5 }, { family: 'components' as const, icon: 'diamonds' as never, label: 'Components', n: 5 }, { family: 'docs' as const, icon: 'doc' as never, label: 'Docs', n: 2 }], note: null };
    expect(tallySentence(t)).toEqual({ strong: '12 wait for you:', rest: '5 foundations, 5 components and 2 docs.' });
    expect(tallySentence({ ...t, n: 1, words: 'waits for you', families: [{ ...t.families[2]!, n: 1 }] })).toEqual({ strong: '1 waits for you:', rest: '1 doc.' });
    expect(tallySentence({ n: null, words: 'Nothing waits for you', families: [], note: '3 of yours wait on others' })).toEqual({ strong: 'Nothing waits for you.', rest: '3 of yours wait on others.' });
  });
});


describe('sideLabel', () => {
  it('drops a group title its only piece already says', () => {
    expect(sideLabel('Timeline', [{ title: 'Timeline' }])).toBeNull();
    expect(sideLabel('Avatar', [{ title: 'Avatar: xl size' }])).toBeNull();
    expect(sideLabel('Button', [{ title: 'Button loading text says what is happening' }])).toBeNull();
  });
  it('keeps it for several pieces or a different title', () => {
    expect(sideLabel('Colors', [{ title: 'Muted text readable' }])).toBe('Colors');
    expect(sideLabel('Card', [{ title: 'Card' }, { title: 'Card: tone' }])).toBe('Card');
    expect(sideLabel('Tab', [{ title: 'Tabs: when tabs are the wrong choice' }])).toBe('Tab');
    expect(sideLabel(null, [{ title: 'x' }])).toBeNull();
  });
});
