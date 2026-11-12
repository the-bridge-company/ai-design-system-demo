// The library's existing options and the one rule for what reaches the lead, shared by Looks right and the pages.
import { describe, expect, it } from 'vitest';
import { asIsOption, piecesToAdd } from '../src/library-impact';
import { existingOption, knownLibraryOptions, libraryToday, usesLibraryAsIs } from '../src/library-options';
import type { MissingPiece, PiecesRecord } from '../src/prod-branch';

const pad = (value: string, resolved: string) => ({ category: 'spacing', property: 'padding', value, resolved });
const restyle = (id: string, values: MissingPiece['values']): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled from outside the library.', name: 'card', component: 'Card', values, where: [], restyle: { selector: '.x' } });
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const record = (pieces: MissingPiece[]): PiecesRecord => ({ checkedAt: '2026-11-12T08:00:00.000Z', pieces, links: [] });

// The sample team: Leo's Card at 12 px is the library's Compact; Sofia's at 24 px is new; 20 px is the default.
const leo = restyle('card-deal-restyle', [pad('var(--space-3)', '12px')]);
const sofia = restyle('card-timeline-restyle', [pad('var(--space-6)', '24px')]);
const atDefault = restyle('card-default', [pad('var(--space-5)', '20px')]);
const filled = restyle('card-feed', [pad('var(--space-5)', '20px'), { category: 'color', property: 'background-color', value: 'var(--color-bg-subtle)' }]);

describe("the library's options", () => {
  it('knows Card padding: None 0, Compact 12, Default 20', () => {
    expect(knownLibraryOptions('card', 'Padding')?.map((o) => [o.name, o.px])).toEqual([
      ['None', 0],
      ['Compact', 12],
      ['Default', 20],
    ]);
    expect(libraryToday('Card', 'padding')).toBe(20);
    expect(libraryToday('Stat card', 'gap')).toBeNull();
    expect(existingOption('Card', 'padding', '12px')?.name).toBe('Compact');
    expect(existingOption('Card', 'padding', 24)).toBeNull();
  });

  it('a part is as is only when every way is a value the library has; unknown parts and values are decisions', () => {
    expect(usesLibraryAsIs('Card', 'padding', ['20', '12'])).toBe(true);
    expect(usesLibraryAsIs('Card', 'padding', ['24', '12'])).toBe(false);
    expect(usesLibraryAsIs('Stat card', 'gap', ['12'])).toBe(false);
    expect(usesLibraryAsIs('Card', 'padding', ['Space 3'])).toBe(false);
    expect(usesLibraryAsIs('Card', 'padding', [])).toBe(false);
  });

  it('a recorded piece is as is only when it changes one part to a value the library has', () => {
    expect(asIsOption(leo)?.name).toBe('Compact');
    expect(asIsOption(atDefault)).toMatchObject({ name: 'Default', isDefault: true });
    expect(asIsOption(sofia)).toBeNull();
    expect(asIsOption(filled)).toBeNull();
    expect(asIsOption(timeline)).toBeNull();
  });
});

describe('Looks right never files an as-is piece as a library request', () => {
  it('leaves out a way the library already has, keeps the new ones', () => {
    expect(piecesToAdd(record([leo]), undefined)).toEqual([]);
    expect(piecesToAdd(record([sofia, timeline]), undefined)).toEqual(['card-timeline-restyle', 'component-timeline']);
    expect(piecesToAdd(record([atDefault, filled, timeline]), undefined)).toEqual(['card-feed', 'component-timeline']);
  });

  it('a ticked piece the record says is as is stays out; one the record does not list still comes along', () => {
    expect(piecesToAdd(record([leo]), undefined, ['card-deal-restyle', 'ticked'])).toEqual(['ticked']);
  });
});
