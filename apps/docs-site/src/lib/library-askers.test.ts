// Many explorations asking for one piece: one line in the List, grouped in the popover, counted in One by one and
// folded on the Map.
import { describe, expect, it } from 'vitest';
import { ASKED_DIRECTLY, askedCell, askedColumns, askedCountLine, askedFaces, askedSubline, askersOf, firstName, foldColumn, groupAskers, moreTag, peopleWords, waysTag } from './library-askers';
import { manyAskers, withManyAskers } from './library-review-fixtures';
import { change, conflict, newComponent } from './library-fixtures.test-helpers';

describe('who asked, as faces', () => {
  it('is one kind of content: an exploration, a person, people, or three faces and +N', () => {
    expect(askedFaces(newComponent())).toMatchObject({ kind: 'one', asker: { name: 'Contact page summary', designer: 'Sofia' } });
    expect(askedFaces({ ...change(), asked: null, by: 'Leo' })).toEqual({ kind: 'person', person: 'Leo' });
    expect(askedFaces(conflict())).toEqual({ kind: 'people', people: ['Sofia', 'Leo'], words: 'Sofia and Leo' });
    const [a, ...rest] = manyAskers();
    const many = askedFaces({ ...change(), asked: a!, also: rest, conflict: null });
    expect(many).toMatchObject({ kind: 'many', more: 9, words: '+9' });
    if (many.kind === 'many') expect(many.faces).toHaveLength(3);
  });

  it('says more as a compact tag, and in words to a screen reader', () => {
    expect(moreTag(3)).toEqual({ tag: '+3', label: '3 more explorations' });
    expect(moreTag(1, 'products')).toEqual({ tag: '+1', label: '1 more product' });
    expect(peopleWords(['Sofia', 'Leo', 'Ann', 'Maya'])).toBe('Sofia, Leo and 2 others');
  });
});

describe('who asked, as two columns (Asked by, From)', () => {
  it('gives every row the same anatomy: a person, then an exploration or "Asked directly"', () => {
    expect(askedColumns(newComponent())).toMatchObject({ person: 'Sofia', morePeople: 0, from: { kind: 'exploration', first: { name: 'Contact page summary' }, more: 0 } });
    expect(askedColumns({ ...change(), asked: null, also: [], by: 'Leo Martin' })).toEqual({ person: 'Leo', people: ['Leo'], morePeople: 0, from: { kind: 'direct' } });
    expect(askedColumns({ ...change(), asked: null, also: [], mine: true }).person).toBe('You');
    expect(ASKED_DIRECTLY).toBe('Asked directly');
  });

  it('counts the other people and explorations of a conflict as +N, never a second layout', () => {
    const c = askedColumns(conflict());
    expect(c).toMatchObject({ person: 'Sofia', people: ['Sofia', 'Leo'], morePeople: 1, from: { kind: 'exploration', more: 1 } });
  });

  it('says the product once, or how many products when explorations span several', () => {
    const [a, ...rest] = manyAskers();
    const c = askedColumns({ ...change(), asked: a!, also: rest, conflict: null });
    expect(c.from).toMatchObject({ kind: 'exploration', more: 11, product: '2 products' });
    expect(askedColumns(newComponent()).from).toMatchObject({ product: newComponent().asked!.product });
    expect(firstName('Sofia Ramos')).toBe('Sofia');
  });
});

describe('several explorations on one piece', () => {
  it('lists every asker once, the most recent first', () => {
    const [a, b, c] = manyAskers();
    const list = askersOf({ asked: c!, also: [a!, b!, a!] });
    expect(list.map((x) => x.name)).toEqual([a!.name, b!.name, c!.name]);
    expect(askersOf({ asked: null })).toEqual([]);
  });

  it('keeps the List cell on one line: the first as a tag, the rest counted', () => {
    const list = manyAskers();
    expect(askedCell(list)).toMatchObject({ first: list[0], more: 11, label: '+11 more' });
    expect(askedCell(list.slice(0, 1)).label).toBeNull();
    expect(askedCell([]).first).toBeNull();
  });

  it('groups the popover by product, most recent first inside', () => {
    const g = groupAskers(manyAskers());
    expect(g.map((x) => [x.product, x.askers.length])).toEqual([
      ['Acme CRM', 6],
      ['Acme Prints', 6],
    ]);
    expect(g[0]!.askers[0]!.name).toBe('Contact page summary');
  });

  it('says the count in One by one', () => {
    expect(askedSubline(manyAskers())).toBe('Contact page summary and 11 more');
    expect(askedSubline(manyAskers().slice(0, 1))).toBe('Contact page summary');
    expect(askedCountLine(12)).toBe('Asked by 12 explorations');
    expect(waysTag(3)).toBe('3 ways');
  });

  it('folds a Map column past 10 boxes into one +N more box', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => i);
    expect(foldColumn(twelve, false)).toEqual({ shown: twelve.slice(0, 9), more: 3 });
    expect(foldColumn(twelve, true).more).toBe(0);
    expect(foldColumn(twelve.slice(0, 10), false).more).toBe(0);
  });

  it('builds the 12-asker sample piece from the sample team’s first waiting piece', () => {
    const [p] = withManyAskers([change(), newComponent()]);
    expect(askersOf(p!)).toHaveLength(12);
    expect(askersOf(p!)[0]!.name).toBe('Bulk actions on products');
  });
});

describe('one piece asked by several explorations', () => {
  it('merges the same recorded piece of two explorations into one piece with both askers', async () => {
    const { mergePieces, pieceOfExploration } = await import('./library-review');
    const item = { id: 'timeline', kind: 'component' as const, title: 'Timeline' };
    const a = pieceOfExploration({ repo: 'acme/prints-design', number: 1, name: 'Order fulfilment timeline', product: 'Acme Prints', productKey: 'prints', href: null, designer: 'Sofia', item, decision: null, nearest: null, asked: true, mine: false, at: '2026-11-01T00:00:00Z' })!;
    const b = pieceOfExploration({ repo: 'acme/crm-design', number: 3, name: 'Deal history', product: 'Acme CRM', productKey: 'crm', href: null, designer: 'Leo', item, decision: null, nearest: null, asked: true, mine: false, at: '2026-11-05T00:00:00Z' })!;
    const out = mergePieces([], [a, b], [], new Set());
    expect(out).toHaveLength(1);
    expect(askersOf(out[0]!).map((x) => x.name)).toEqual(['Deal history', 'Order fulfilment timeline']);
  });
});
