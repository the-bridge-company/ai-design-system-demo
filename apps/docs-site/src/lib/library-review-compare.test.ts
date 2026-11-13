// One by one, a conflict: the compare stage and its one radio list (direction D2).
import { describe, expect, it } from 'vitest';
import { BOTH, checkedKeepLabel, checkedLooks, checkedOfPick, checkedOutcome, checkedPick, compareKeepLabel, compareView, defaultChecked, pickWords, stageLabels, TODAY } from './library-review-compare';
import { conflict } from './library-fixtures.test-helpers';
import { ledgerOf } from './library-impact-view';
import { libraryToday } from './library-baseline';

/** The same conflict on a part the library baseline does not know: today comes from the check, then the page. */
const unknownPart = () => {
  const p = conflict('20');
  return { ...p, conflict: { ...p.conflict!, property: 'gap' } };
};

describe('the compare view of a conflict', () => {
  it("reads today from the library's own value, the same baseline as the exploration page", () => {
    // The check recorded 16 (the product screen before), the library's Card padding is 20: the library wins.
    // The demo is a real three-way choice: today 20, Sofia 24 (roomier, new), Leo 12 (the library's Compact).
    const v = compareView(conflict(), 'Every screen')!;
    expect(v.part).toBe('Padding');
    expect(v.overlay).toBe(true);
    expect([v.today.valueText, v.today.words, v.today.where]).toEqual(['20 px', 'in the library', { text: 'Every screen' }]);
    expect(v.ways.map((w) => [w.name, w.valueText, w.words, w.hue, w.sameAsToday])).toEqual([
      ["Sofia's way", '24 px', 'roomier', 1, false],
      ["Leo's way", '12 px', 'Compact in the library', 2, false],
    ]);
    expect(v.ways[1]!.where).toEqual({ exploration: 'Deal pipeline cards', product: 'Acme CRM', href: null });
    expect([v.both?.name, v.both?.valueText, v.both?.words]).toEqual(['Both, as two sizes', '12 and 24 px', "today's 20 stays the default"]);
    expect(v.told).toBe('Sofia and Leo will be notified.');
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

  it('the demo: three looks, one label each, largest first', () => {
    const v = compareView(conflict(), 'Every screen')!;
    expect(stageLabels(v).map((l) => l.label)).toEqual(['Sofia: 24 px', 'Today: 20 px', 'Leo: 12 px (Compact)']);
    expect(v.ways.map((w) => w.libraryOption)).toEqual([null, 'Compact']);
    expect(compareKeepLabel(v.ways[0]!.key, v.ways, v.component)).toBe("Keep Sofia's way");
    expect(compareKeepLabel(v.ways[1]!.key, v.ways, v.component)).toBe("Keep Leo's way, the library's Compact");
  });

  // Never hit by the demo, kept for real teams: a way whose value is the library's today.
  it('a way equal to today: same as today, one shared outline label, and the primary names the way selected', () => {
    const v = compareView(conflict('20'), 'Every screen')!;
    expect(v.ways.map((w) => [w.valueText, w.words, w.sameAsToday])).toEqual([
      ['20 px', 'same as today', true],
      ['12 px', 'Compact in the library', false],
    ]);
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
    // The demo, Card padding: today is the library's 20 px, Sofia's 24 is new (roomier), Leo's 12 is the library's Compact.
    const demo = compareView(conflict(), 'Every screen')!;
    // A real team's case the demo never hits: Sofia's 20 is today's.
    const same = compareView(conflict('20'), 'Every screen')!;

    it('starts with today and the way new to the library, the one that differs most from today', () => {
      expect(defaultChecked(v)).toEqual([TODAY, sofia]);
      // The demo: Sofia's 24 is new, Leo's 12 is the library's Compact. The new proposal shows first, even though Leo's
      // value is further from today, and the outcome says what would change, never "Nothing new in the library".
      expect(defaultChecked(demo)).toEqual([TODAY, demo.ways[0]!.key]);
      expect(checkedLooks(demo, defaultChecked(demo)).map((l) => l.label)).toEqual(['Today: 20 px', 'Sofia: 24 px']);
      expect(checkedOutcome(demo, defaultChecked(demo))).toBe("Keep two sizes: today's 20 stays the default, Sofia's screen uses 24 px");
      // No new way (Sofia's is today's): the way the library already has, so there is still something to look at.
      expect(defaultChecked(same)).toEqual([TODAY, leo]);
      expect(checkedLooks(same, defaultChecked(same)).map((l) => l.label)).toEqual(['Today and Sofia: 20 px', 'Leo: 12 px (Compact)']);
    });

    it('checks one way per value: two ways with the same new value give one checked row', () => {
      const twins = { ...demo, ways: [demo.ways[0]!, { ...demo.ways[0]!, key: 'twin', who: 'Ann', name: "Ann's way" }, demo.ways[1]!] };
      expect(defaultChecked(twins)).toEqual([TODAY, demo.ways[0]!.key]);
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
      expect(checkedOutcome(v, [TODAY, leo])).toBe("Keep two sizes: today's 16 stays the default, Leo's screen uses 12 px");
      expect(checkedKeepLabel(v, [TODAY, leo])).toBe('Keep both as sizes');
      expect(checkedPick(v, [sofia, leo])).toBe(BOTH);
      expect(checkedOutcome(v, [sofia, leo])).toBe("Keep two sizes: today's 16 stays the default, Sofia's screen uses 20 px and Leo's screen uses 12 px");
      expect(checkedKeepLabel(v, [sofia, leo])).toBe('Keep both as sizes');
      expect(checkedPick(v, [TODAY, sofia, leo])).toBe(BOTH);
      expect(checkedOutcome(v, [TODAY, sofia, leo])).toBe("Keep three sizes: today's 16 stays the default, Sofia's screen uses 20 px and Leo's screen uses 12 px");
      expect(checkedKeepLabel(v, [TODAY, sofia, leo])).toBe('Keep 3 sizes');
      expect(checkedOfPick(BOTH, v)).toEqual([TODAY, sofia, leo]);
      expect(checkedOfPick(`sizes:${leo}`, v)).toEqual([TODAY, leo]);
      expect(checkedOfPick(leo, v)).toEqual([leo]);
    });

    // The demo, 0 to 3 rows checked: every outcome says what the library really gets.
    it("the demo: Sofia's 24 is new, Leo's 12 is the library's Compact", () => {
      // 1 checked.
      expect([checkedOutcome(demo, [TODAY]), checkedKeepLabel(demo, [TODAY])]).toEqual(["Keep today's Card: 20 px everywhere", "Keep today's Card"]);
      expect(checkedPick(demo, [sofia])).toBe(sofia);
      expect([checkedOutcome(demo, [sofia]), checkedKeepLabel(demo, [sofia])]).toEqual(["Keep Sofia's way: 24 px everywhere", "Keep Sofia's way"]);
      expect(checkedPick(demo, [leo])).toBe(leo);
      expect([checkedOutcome(demo, [leo]), checkedKeepLabel(demo, [leo])]).toEqual(["Keep Leo's way: the library's Compact, 12 px everywhere", "Keep Leo's way, the library's Compact"]);
      // 2 checked.
      expect(checkedPick(demo, [TODAY, sofia])).toBe(`sizes:${sofia}`);
      expect([checkedOutcome(demo, [TODAY, sofia]), checkedKeepLabel(demo, [TODAY, sofia])]).toEqual(["Keep two sizes: today's 20 stays the default, Sofia's screen uses 24 px", 'Keep both as sizes']);
      expect(checkedLooks(demo, [TODAY, sofia]).map((l) => l.label)).toEqual(['Today: 20 px', 'Sofia: 24 px']);
      expect(checkedPick(demo, [TODAY, leo])).toBe(`sizes:${leo}`);
      expect(checkedOutcome(demo, [TODAY, leo])).toBe("Nothing new in the library: Leo's screen uses Compact (12 px), today's 20 stays the default");
      expect(checkedKeepLabel(demo, [TODAY, leo])).toBe("Keep today's Card, Leo uses Compact");
      expect(checkedPick(demo, [sofia, leo])).toBe(BOTH);
      expect(checkedOutcome(demo, [sofia, leo])).toBe("Keep two sizes: today's 20 stays the default, Sofia's screen uses 24 px and Leo's screen uses Compact (12 px)");
      expect(checkedKeepLabel(demo, [sofia, leo])).toBe('Keep both as sizes');
      // 3 checked.
      expect(checkedPick(demo, [TODAY, sofia, leo])).toBe(BOTH);
      expect(checkedOutcome(demo, [TODAY, sofia, leo])).toBe("Keep three sizes: today's 20 stays the default, Sofia's screen uses 24 px and Leo's screen uses Compact (12 px)");
      expect(checkedKeepLabel(demo, [TODAY, sofia, leo])).toBe('Keep 3 sizes');
      expect(checkedLooks(demo, [TODAY, sofia, leo]).map((l) => l.label)).toEqual(['Today: 20 px', 'Sofia: 24 px', 'Leo: 12 px (Compact)']);
      // The note both designers read.
      expect(pickWords(sofia, demo)).toBe("Sofia's way (24 px)");
      expect(pickWords(`sizes:${sofia}`, demo)).toBe("two sizes: today's 20 stays the default, Sofia's screen uses 24 px");
      expect(pickWords(BOTH, demo)).toBe("three sizes: today's 20 stays the default, Sofia's screen uses 24 px and Leo's screen uses Compact (12 px)");
      expect(pickWords(`sizes:${leo}`, demo)).toBe("today's Card, Leo's screen uses Compact (12 px)");
    });

    // Kept for real data (the same never hits it): a way equal to today counts as today, a way equal to Compact says so.
    it('a way equal to today counts as today, a way equal to Compact says so', () => {
      // 1 checked.
      expect([checkedOutcome(same, [TODAY]), checkedKeepLabel(same, [TODAY])]).toEqual(["Keep today's Card: 20 px everywhere", "Keep today's Card"]);
      expect(checkedPick(same, [sofia])).toBe(TODAY);
      expect([checkedOutcome(same, [sofia]), checkedKeepLabel(same, [sofia])]).toEqual(["Keep today's Card: 20 px everywhere", "Keep today's Card"]);
      expect(checkedPick(same, [leo])).toBe(leo);
      expect([checkedOutcome(same, [leo]), checkedKeepLabel(same, [leo])]).toEqual(["Keep Leo's way: the library's Compact, 12 px everywhere", "Keep Leo's way, the library's Compact"]);
      // 2 checked.
      expect(checkedPick(same, [TODAY, sofia])).toBe(TODAY);
      expect(checkedLooks(same, [TODAY, sofia]).map((l) => l.label)).toEqual(['Today and Sofia: 20 px']);
      for (const two of [
        [TODAY, leo],
        [sofia, leo],
      ]) {
        expect(checkedPick(same, two)).toBe(`sizes:${leo}`);
        expect(checkedOutcome(same, two)).toBe("Nothing new in the library: Leo's screen uses Compact (12 px), today's 20 stays the default");
        expect(checkedKeepLabel(same, two)).toBe("Keep today's Card, Leo uses Compact");
      }
      // 3 checked: the same, Sofia's way is today's.
      expect(checkedPick(same, [TODAY, sofia, leo])).toBe(`sizes:${leo}`);
      expect(checkedKeepLabel(same, [TODAY, sofia, leo])).toBe("Keep today's Card, Leo uses Compact");
      expect(checkedLooks(same, [TODAY, sofia, leo]).map((l) => l.label)).toEqual(['Today and Sofia: 20 px', 'Leo: 12 px (Compact)']);
      // The note both designers read.
      expect(pickWords(`sizes:${leo}`, same)).toBe("today's Card, Leo's screen uses Compact (12 px)");
      expect(pickWords(leo, same)).toBe("Leo's way (12 px, the library's Compact)");
      expect(pickWords(TODAY, same)).toBe("today's Card");
    });
  });

  it('names the outcome on the one primary', () => {
    const v = compareView(unknownPart(), 'Every screen')!;
    expect(compareKeepLabel(v.ways[0]!.key, v.ways)).toBe("Keep Sofia's way");
    expect(compareKeepLabel(BOTH, v.ways)).toBe('Keep both as sizes');
  });
});
