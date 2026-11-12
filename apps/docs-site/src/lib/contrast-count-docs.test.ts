// The contrast check count written in the docs is the count Studio Quality shows: one check per pair of
// packages/tokens/src/contrast.checks.json in each brand and theme (lib/team-quality.ts, lib/library/stats.ts). The docs
// cannot compute it, so this test keeps their number from drifting (Quality said 304 while DESIGN-LANGUAGE.md said 296).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8');

const pairs = (JSON.parse(read('packages/tokens/src/contrast.checks.json')) as { pairs: unknown[] }).pairs.length;
// A brand is a brands/<name>.tokens.json file; brands/<name>.<theme>.tokens.json are its per-theme overrides.
const brands = readdirSync(`${ROOT}packages/tokens/src/brands`).filter((f) => /^[^.]+\.tokens\.json$/.test(f)).length;
const themes = readdirSync(`${ROOT}packages/tokens/src/semantic`).filter((f) => f === 'light.tokens.json' || f === 'dark.tokens.json').length;
const checks = pairs * brands * themes;

describe('contrast check count in the docs', () => {
  it('DESIGN-LANGUAGE.md states the pairs and checks the build and Quality count', () => {
    const doc = read('docs/DESIGN-LANGUAGE.md');
    expect(doc).toContain(`${pairs} pairs in ${brands} brands, light and dark: ${checks} checks today`);
  });

  it('ARCHITECTURE.md states the same pairs and checks', () => {
    const doc = read('docs/ARCHITECTURE.md');
    expect(doc).toContain(`lists ${pairs} foreground/background pairs`);
    expect(doc).toContain(`(${checks} checks today)`);
  });
});
