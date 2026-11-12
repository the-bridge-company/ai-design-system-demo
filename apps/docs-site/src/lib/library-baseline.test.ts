import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { baselineOf, knownLibraryOptions, libraryToday } from './library-baseline';

const tokens = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../packages/tokens/src/${rel}`, import.meta.url)), 'utf8'));
const space = tokens('primitives/space.tokens.json').space as Record<string, { $value: { value: number } }>;
const spaceOf = (alias: string) => space[/^\{space\.(\w+)\}$/.exec(alias)![1]!]!.$value.value;
const cardCss = readFileSync(fileURLToPath(new URL('../../../../packages/react/src/components/Card/Card.module.css', import.meta.url)), 'utf8');

describe('library baseline', () => {
  it("Card padding's default is the library's layout inset at the default density, not a guess", () => {
    expect(cardCss).toMatch(/--_inset:\s*var\(--layout-inset\)/);
    const inset = tokens('density/comfortable.tokens.json').layout.inset.$value as string;
    expect(libraryToday('Card', 'padding')).toBe(spaceOf(inset));
    expect(libraryToday('Card', 'padding')).toBe(20);
  });

  it("Card's compact padding is space-3 and none is 0, as its CSS says", () => {
    const compact = /\.padding-compact\s*\{\s*--_inset:\s*var\(--space-(\d+)\)/.exec(cardCss)![1]!;
    const opts = knownLibraryOptions('card', 'Padding')!;
    expect(opts.find((o) => o.name === 'Compact')!.px).toBe(space[compact]!.$value.value);
    expect(opts.find((o) => o.name === 'None')!.px).toBe(0);
    expect(opts.filter((o) => o.isDefault)).toHaveLength(1);
  });

  it('one baseline: the library value first, then what the check recorded, then what the page measured', () => {
    expect(baselineOf('Card', 'padding', 16, 24)).toBe(20);
    expect(baselineOf('Stat card', 'gap', 8, 12)).toBe(8);
    expect(baselineOf('Stat card', 'gap', null, 12)).toBe(12);
    expect(baselineOf('Stat card', 'gap')).toBeNull();
    expect(libraryToday('Stat card', 'gap')).toBeNull();
  });
});
