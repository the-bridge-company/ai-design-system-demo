// One by one, a conflict: the compare stage and its one radio list (direction D2).
import { describe, expect, it } from 'vitest';
import { BOTH, checkedKeepLabel, checkedLooks, checkedOfPick, checkedOutcome, checkedPick, compareKeepLabel, compareView, defaultChecked, pickWords, stageLabels, TODAY } from './library-review-compare';
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

  describe('the checked rows (checkboxes, today included, no Both row)', () => {
    // conflict(): today 16, Sofia 20, Leo 12. The demo: today measured at 20, Sofia's 20 is today's.
    const v = compareView(conflict(), 'Every screen')!;
    const [sofia, leo] = v.ways.map((w) => w.key) as [string, string];
    const p = conflict();
    const demo = compareView({ ...p, conflict: { ...p.conflict!, today: null } }, 'Every screen', 20)!;

    it('starts with today and the way that differs most from it', () => {
      expect(defaultChecked(v)).toEqual([TODAY, sofia]);
      expect(defaultChecked(demo)).toEqual([TODAY, leo]);
      expect(checkedLooks(demo, defaultChecked(demo)).map((l) => l.label)).toEqual(['20 Today, Sofia', '12 Leo']);
    });

    it('nothing checked: nothing to decide', () => {
      expect(checkedPick(v, [])).toBeNull();
      expect(checkedOutcome(v, [])).toBeNull();
      expect(checkedKeepLabel(v, [])).toBe('Decide');
      expect(checkedLooks(v, [])).toEqual([]);
    });

    it('one checked: that way, or today kept as it is', () => {
      expect(checkedPick(v, [leo])).toBe(leo);
      expect(checkedOutcome(v, [leo])).toBe("Keep Leo's way: 12 px everywhere");
      expect(checkedKeepLabel(v, [leo])).toBe("Keep Leo's way");
      expect(checkedPick(v, [TODAY])).toBe(TODAY);
      expect(checkedOutcome(v, [TODAY])).toBe("Keep today's Card: 16 px everywhere");
      expect(checkedKeepLabel(v, [TODAY])).toBe("Keep today's Card");
    });

    it('two or more with different values: kept as sizes, today stays the default, on the existing pick values', () => {
      expect(checkedPick(v, [TODAY, leo])).toBe(`sizes:${leo}`);
      expect(checkedOutcome(v, [TODAY, leo])).toBe("Keep 12 and 16 px as two sizes, today's 16 stays the default");
      expect(checkedKeepLabel(v, [TODAY, leo])).toBe('Keep both as sizes');
      expect(checkedPick(v, [sofia, leo])).toBe(BOTH);
      expect(checkedPick(v, [TODAY, sofia, leo])).toBe(BOTH);
      expect(checkedOutcome(v, [TODAY, sofia, leo])).toBe("Keep 12, 16 and 20 px as three sizes, today's 16 stays the default");
      expect(checkedKeepLabel(v, [TODAY, sofia, leo])).toBe('Keep 3 sizes');
      expect(checkedOfPick(BOTH, v)).toEqual([TODAY, sofia, leo]);
      expect(checkedOfPick(`sizes:${leo}`, v)).toEqual([TODAY, leo]);
      expect(checkedOfPick(leo, v)).toEqual([leo]);
    });

    it('dedupes a way equal to today: it counts as today, one look for both', () => {
      expect(checkedPick(demo, [sofia])).toBe(TODAY);
      expect(checkedPick(demo, [TODAY, sofia])).toBe(TODAY);
      expect(checkedLooks(demo, [TODAY, sofia]).map((l) => l.label)).toEqual(['20 Today, Sofia']);
      expect(checkedPick(demo, [sofia, leo])).toBe(`sizes:${leo}`);
      expect(checkedOutcome(demo, [TODAY, leo])).toBe("Keep 12 and 20 px as two sizes, today's 20 stays the default");
      expect(checkedLooks(demo, [TODAY, sofia, leo]).map((l) => l.label)).toEqual(['20 Today, Sofia', '12 Leo']);
      expect(pickWords(`sizes:${leo}`, demo)).toBe("12 and 20 px as two sizes, today's 20 stays the default");
      expect(pickWords(leo, demo)).toBe("Leo's way (12 px)");
      expect(pickWords(TODAY, demo)).toBe("today's Card");
    });
  });

  it('names the outcome on the one primary', () => {
    const v = compareView(conflict(), 'Every screen')!;
    expect(compareKeepLabel(v.ways[0]!.key, v.ways)).toBe("Keep Sofia's way");
    expect(compareKeepLabel(BOTH, v.ways)).toBe('Keep both as sizes');
  });
});
