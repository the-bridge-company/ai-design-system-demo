// /studio/connect-figma/ is a step of the Figma plugin, not a page of the product (owner feedback 2026-11-22: inside
// the Studio shell it read as a product page). It renders standalone: no top bar, no Studio nav, no search, no space
// switch, no demo banner; the Bridge mark and one card. Read from the sources, as the build renders them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './repo';

const page = readFileSync(join(ROOT, 'apps/docs-site/src/pages/studio/connect-figma.astro'), 'utf8');
const layout = readFileSync(join(ROOT, 'apps/docs-site/src/layouts/Layout.astro'), 'utf8');

describe('Connect Figma page: standalone, without the Studio shell', () => {
  it('uses the standalone layout, with the Bridge mark and one card', () => {
    expect(page).toMatch(/<Layout [^>]*\bstandalone\b/);
    expect(page).toContain('<Logo />');
    expect(page).toContain('<ConnectFigma client:load />');
  });

  it('standalone drops the top bar (search, space switch, account menu) and takes the bare main (no rail, no nav)', () => {
    expect(layout).toMatch(/const bare = bareOnly \|\| standalone;/);
    expect(layout).toMatch(/\{!standalone && \(\s*<header class="topbar">/);
    // The bare branch renders <main> alone: the rail and the Studio nav live in the other branch only.
    const bareBranch = layout.slice(layout.indexOf('{bare ? (\n      <main'), layout.indexOf('<div class="shell">'));
    expect(bareBranch).toContain('class="bare-main"');
    expect(bareBranch).not.toMatch(/rail|SidebarNav|ProductsNav|SpaceSwitch|shell-search/);
  });

  it('has one Harbor zone, the card top with the Field Guide drawing', () => {
    expect(page.match(/class="zone\b/g)).toHaveLength(1);
    expect(page).toMatch(/class="zone cf-art"[^>]*><Illustration name="components"/);
  });
});
