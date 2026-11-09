// Many explorations asking for one piece: one line in the List, grouped in the popover, counted in One by one and
// folded on the Map.
import { describe, expect, it } from 'vitest';
import { askedCell, askedCountLine, askedSubline, askersOf, foldColumn, groupAskers, waysTag } from './library-askers';
import { manyAskers, withManyAskers } from './library-review-fixtures';
import { change, newComponent } from './library-fixtures.test-helpers';

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
