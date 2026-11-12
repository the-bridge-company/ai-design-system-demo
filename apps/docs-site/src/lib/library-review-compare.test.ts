// One by one, a conflict: the compare stage and its one radio list (direction D2).
import { describe, expect, it } from 'vitest';
import { BOTH, checkedKeepLabel, checkedLooks, checkedOfPick, checkedOutcome, checkedPick, compareKeepLabel, compareView, defaultChecked, pickWords, stageLabels, TODAY } from './library-review-compare';
import { conflict } from './library-fixtures.test-helpers';
import { ledgerOf } from './library-impact-view';
import { libraryToday } from './library-baseline';

/** The same conflict on a part the library baseline does not know: today comes from the check, then the page. */
const unknownPart = () => {
  const p = conflict();
  return { ...p, conflict: { ...p.conflict!, property: 'gap' } };
};

describe('the compare view of a conflict', () => {
  it("reads today from the library's own value, the same baseline as the exploration page", () => {
    // The check recorded 16 (the product screen before), the library's Card padding is 20: the library wins.
    const v = compareView(conflict(), 'Every screen')!;
    expect(v.part).toBe('Room inside');
    expect(v.overlay).toBe(true);
    expect([v.today.valueText, v.today.words, v.today.where]).toEqual(['20 px', 'in the library', { text: 'Every screen' }]);
    expect(v.ways.map((w) => [w.name, w.valueText, w.words, w.hue, w.sameAsToday])).toEqual([
      ["Sofia's way", '20 px', 'same as today', 1, true],
      ["Leo's way", '12 px', "the library's Compact spacing", 2, false],
    ]);
    expect(v.ways[1]!.where).toEqual({ exploration: 'Deal pipeline cards', product: 'Acme CRM', href: null });
    expect([v.both?.name, v.both?.valueText, v.both?.words]).toEqual(['Both, as two sizes', '12 and 20 px', "today's 20 stays the default"]);
    expect(v.told).toBe('Sofia and Leo are told.');
  });

  it("agrees with the exploration page's ledger: one default value for the same part", () => {
    const v = compareView(conflict(), 'Every screen')!;
    const ledger = ledgerOf('Card', 'padding', [], null);
    const def = ledger.have.find((r) => r.isDefault)!;
    expect(def.px).toBe(v.today.value);
    expect(def.px).toBe(libraryToday('Card', 'padding'));
  });

  it('takes today from the check, then from the library as measured, on a part the baseline does not know', () => {
    const p = unknownPart();
    const v = compareView(p, 'Every screen')!;
    expect(v.today.valueText).toBe('16 px');
    expect(v.ways.map((w) => w.words)).toEqual(['roomier', 'tighter']);
    const none = { ...p, conflict: { ...p.conflict, today: null } };
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

  it('a way equal to today: same as today, one shared outline label, and the primary names the way selected', () => {
    const v = compareView(conflict(), 'Every screen')!;
    expect(stageLabels(v).map((l) => l.label)).toEqual(['Today and Sofia: 20 px', 'Leo: 12 px (Compact)']);
    expect(v.ways.map((w) => w.libraryOption)).toEqual([null, 'Compact']);
    expect(stageLabels(v)[0]!.keys).toEqual(['today', v.ways[0]!.key]);
    // The radio selects Sofia's way: the button says Sofia's way too, and that it changes nothing.
    expect(compareKeepLabel(v.ways[0]!.key, v.ways, v.component)).toBe("Keep Sofia's way, same as today");
    expect(compareKeepLabel(v.ways[1]!.key, v.ways, v.component)).toBe("Keep Leo's way, the library's Compact");
    expect(compareKeepLabel('today', v.ways, v.component)).toBe("Keep today's Card");
    // Different values keep one label each.
    expect(stageLabels(compareView(unknownPart(), 'Every screen')!).map((l) => l.label)).toEqual(['Sofia: 20 px', 'Today: 16 px', 'Leo: 12 px']);
  });

  describe('the checked rows (checkboxes, today included, no Both row)', () => {
    // A part the baseline does not know (gap): today 16 from the check, Sofia 20, Leo 12, none of them an option yet.
    const v = compareView(unknownPart(), 'Every screen')!;
    const [sofia, leo] = v.ways.map((w) => w.key) as [string, string];
    // The demo, Card padding: today is the library's 20 px, Sofia's 20 is today's, Leo's 12 is the library's Compact.
    const demo = compareView(conflict(), 'Every screen')!;

    it('starts with today and the way that differs most from it', () => {
      expect(defaultChecked(v)).toEqual([TODAY, sofia]);
      expect(defaultChecked(demo)).toEqual([TODAY, leo]);
      expect(checkedLooks(demo, defaultChecked(demo)).map((l) => l.label)).toEqual(['Today and Sofia: 20 px', 'Leo: 12 px (Compact)']);
    });

    it('nothing checked: nothing to decide', () => {
      expect(checkedPick(v, [])).toBeNull();
      expect(checkedOutcome(v, [])).toBeNull();
      expect(checkedKeepLabel(v, [])).toBe('Decide');
      expect(checkedLooks(v, [])).toEqual([]);
      expect(checkedKeepLabel(demo, [])).toBe('Decide');
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

    // The demo with the honest baseline, 0 to 3 rows checked: every outcome says what the library really gets.
    it('the demo: a way equal to today counts as today, a way equal to Compact says so', () => {
      // 1 checked.
      expect([checkedOutcome(demo, [TODAY]), checkedKeepLabel(demo, [TODAY])]).toEqual(["Keep today's Card: 20 px everywhere", "Keep today's Card"]);
      expect(checkedPick(demo, [sofia])).toBe(TODAY);
      expect([checkedOutcome(demo, [sofia]), checkedKeepLabel(demo, [sofia])]).toEqual(["Keep today's Card: 20 px everywhere", "Keep today's Card"]);
      expect(checkedPick(demo, [leo])).toBe(leo);
      expect([checkedOutcome(demo, [leo]), checkedKeepLabel(demo, [leo])]).toEqual(["Keep Leo's way: the library's Compact, 12 px everywhere", "Keep Leo's way, the library's Compact"]);
      // 2 checked.
      expect(checkedPick(demo, [TODAY, sofia])).toBe(TODAY);
      expect(checkedLooks(demo, [TODAY, sofia]).map((l) => l.label)).toEqual(['Today and Sofia: 20 px']);
      for (const two of [
        [TODAY, leo],
        [sofia, leo],
      ]) {
        expect(checkedPick(demo, two)).toBe(`sizes:${leo}`);
        expect(checkedOutcome(demo, two)).toBe("Nothing new in the library: Leo's screen uses Compact (12 px), today's 20 stays the default");
        expect(checkedKeepLabel(demo, two)).toBe("Keep today's Card, Leo uses Compact");
      }
      // 3 checked: the same, Sofia's way is today's.
      expect(checkedPick(demo, [TODAY, sofia, leo])).toBe(`sizes:${leo}`);
      expect(checkedKeepLabel(demo, [TODAY, sofia, leo])).toBe("Keep today's Card, Leo uses Compact");
      expect(checkedLooks(demo, [TODAY, sofia, leo]).map((l) => l.label)).toEqual(['Today and Sofia: 20 px', 'Leo: 12 px (Compact)']);
      // The note both designers read.
      expect(pickWords(`sizes:${leo}`, demo)).toBe("today's Card, Leo's screen uses Compact (12 px)");
      expect(pickWords(leo, demo)).toBe("Leo's way (12 px, the library's Compact)");
      expect(pickWords(TODAY, demo)).toBe("today's Card");
    });
  });

  it('names the outcome on the one primary', () => {
    const v = compareView(unknownPart(), 'Every screen')!;
    expect(compareKeepLabel(v.ways[0]!.key, v.ways)).toBe("Keep Sofia's way");
    expect(compareKeepLabel(BOTH, v.ways)).toBe('Keep both as sizes');
  });
});
