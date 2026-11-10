// One by one, a conflict: the compare stage and its one radio list (direction D2).
import { describe, expect, it } from 'vitest';
import { BOTH, compareKeepLabel, compareView, stageLabels } from './library-review-compare';
import { conflict } from './library-fixtures.test-helpers';

describe('the compare view of a conflict', () => {
  it('reads today and each way from the piece, with the exploration page’s words', () => {
    const v = compareView(conflict(), 'Every screen')!;
    expect(v.part).toBe('Room inside');
    expect(v.overlay).toBe(true);
    expect([v.today.valueText, v.today.words, v.today.where]).toEqual(['16 px', 'in the library', { text: 'Every screen' }]);
    expect(v.ways.map((w) => [w.name, w.valueText, w.words, w.hue])).toEqual([
      ["Sofia's way", '20 px', 'roomier', 1],
      ["Leo's way", '12 px', 'tighter', 2],
    ]);
    expect(v.ways[1]!.where).toEqual({ exploration: 'Deal pipeline cards', product: 'Acme CRM', href: null });
    expect([v.both?.name, v.both?.valueText, v.both?.words]).toEqual(['Both, as two sizes', '12 and 20 px', "today's 16 stays the default"]);
    expect(v.told).toBe('Sofia and Leo are told.');
  });

  it('takes today from the library as measured when the check recorded none, never a written number', () => {
    const p = conflict();
    const none = { ...p, conflict: { ...p.conflict!, today: null } };
    expect(compareView(none, 'Every screen')!.today.valueText).toBeNull();
    expect(compareView(none, 'Every screen')!.both?.words).toBe('');
    const measured = compareView(none, 'Every screen', 16)!;
    expect(measured.today.valueText).toBe('16 px');
    expect(measured.ways.map((w) => w.words)).toEqual(['roomier', 'tighter']);
  });

  it('draws an overlay only for room inside with every value known', () => {
    const p = conflict();
    expect(compareView({ ...p, conflict: { ...p.conflict!, property: 'border-radius' } }, 'x')!.overlay).toBe(false);
    expect(compareView({ ...p, conflict: { ...p.conflict!, property: 'border-radius' } }, 'x')!.ways.map((w) => w.words)).toEqual(['rounder', 'squarer']);
    expect(compareView({ ...p, conflict: null }, 'x')).toBeNull();
  });

  it('says a way equal to today: same as today, one shared outline label, and the primary keeps today’s component', () => {
    const p = conflict();
    const none = { ...p, conflict: { ...p.conflict!, today: null } };
    // The demo: today measured at 20, Sofia's way is 20.
    const v = compareView(none, 'Every screen', 20)!;
    expect(v.ways.map((w) => [w.valueText, w.words, w.sameAsToday])).toEqual([
      ['20 px', 'same as today', true],
      ['12 px', 'tighter', false],
    ]);
    expect(stageLabels(v).map((l) => l.label)).toEqual(['20 Today, Sofia', '12 Leo']);
    expect(stageLabels(v)[0]!.keys).toEqual(['today', v.ways[0]!.key]);
    expect(compareKeepLabel(v.ways[0]!.key, v.ways, v.component)).toBe("Keep today's Card");
    expect(compareKeepLabel(v.ways[1]!.key, v.ways, v.component)).toBe("Keep Leo's way");
    // Different values keep one label each.
    expect(stageLabels(compareView(p, 'Every screen')!).map((l) => l.label)).toEqual(['20 Sofia', '16 Today', '12 Leo']);
  });

  it('names the outcome on the one primary', () => {
    const v = compareView(conflict(), 'Every screen')!;
    expect(compareKeepLabel(v.ways[0]!.key, v.ways)).toBe("Keep Sofia's way");
    expect(compareKeepLabel(BOTH, v.ways)).toBe('Keep both as sizes');
  });
});
