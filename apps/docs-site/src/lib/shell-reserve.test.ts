// Layout shift is not measurable here (no browser), so batch A makes each reserve provable from markup and CSS:
// these contracts fail if a later change takes a reserve away. A1/A2 are tested in TeamChip.test.ts and
// ProductsNav.test.ts, A5 in load-progress.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const layout = read('../layouts/Layout.astro');
const site = read('../styles/site.css');
const studio = read('../styles/studio-app.css');
const team = read('../styles/team-access.css');
const gate = read('../scripts/demo-gate.ts');
const banner = read('../../../../packages/react/src/components/Banner/Banner.module.css');
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

describe('reserved space (batch A)', () => {
  it("A3: a team Library's content box holds one screen, so the footer starts below the fold", () => {
    expect(layout).toMatch(/library \? \(\s*<div class="page-fill" data-page-fill>/);
    expect(rule(site, '.page-fill')).toMatch(/min-height: calc\(100svh - var\(--layout-header-height\)/);
    // The footer comes after the box, inside main.
    expect(layout.indexOf('data-page-fill')).toBeLessThan(layout.indexOf('<div class="page-end">'));
  });

  it("A7: the sample team's banner strip holds one banner line from first paint", () => {
    expect(layout).toContain("if (sample) document.documentElement.setAttribute('data-sample-team', '')");
    // The banner's height: a md button inside the Banner's block padding (space-2 each side) and its two hairlines.
    expect(rule(site, ':root[data-sample-team] .demo-strip[hidden]:not([data-settled])')).toMatch(/min-height: calc\(var\(--control-height-md\) \+ 2 \* var\(--space-2\) \+ 2 \* var\(--border-width-default\)\)/);
    // The demo banner always has actions: the Banner's block padding with actions is space-2.
    expect(rule(banner, '.hasActions')).toMatch(/padding: var\(--space-2\) var\(--space-2\) var\(--space-2\) var\(--space-4\)/);
  });

  it("A7: the reserve resolves to the banner's computed height at comfortable density (62px)", () => {
    const tokens = read('../../../../packages/tokens/dist/tokens.css');
    // The first definition of each custom property is the default (:root, comfortable density).
    const first = new Map<string, string>();
    for (const m of tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)) if (!first.has(m[1]!)) first.set(m[1]!, m[2]!.trim());
    const px = (v: string): number => {
      const ref = /^var\((--[\w-]+)\)$/.exec(v);
      if (ref) return px(first.get(ref[1]!)!);
      const n = /^(\d+(?:\.\d+)?)px$/.exec(v);
      if (!n) throw new Error(`not a px value: ${v}`);
      return Number(n[1]);
    };
    const reserve = px('var(--control-height-md)') + 2 * px('var(--space-2)') + 2 * px('var(--border-width-default)');
    expect(reserve).toBe(62);
    // The banner's own floor is lower, so its md button sets its height: the reserve is that height.
    expect(px('var(--control-height-md)') + px('var(--space-4)')).toBeLessThan(reserve);
  });

  it('A7: the strip is never shown empty: the banner is rendered (flushSync) before the strip unhides', () => {
    const paint = gate.slice(gate.indexOf('return (on: boolean, visiting?: boolean) => {'));
    expect(paint.indexOf('if (!on) slot.hidden = true;')).toBeGreaterThan(-1);
    expect(paint.indexOf('flushSync(() => root.render(')).toBeGreaterThan(paint.indexOf('if (!on) slot.hidden = true;'));
    expect(paint.indexOf('if (on) slot.hidden = false;')).toBeGreaterThan(paint.indexOf('flushSync(() => root.render('));
    expect(paint).not.toMatch(/slot\.hidden = !on/);
  });

  it('A8: the search palette keeps one top edge while results change', () => {
    expect(layout).toContain('<ScriptDialog id="palette" title="Search" size="lg" closeLabel="Close search" class="palette-dialog">');
    expect(rule(site, '.palette-dialog')).toMatch(/align-self: flex-start/);
  });

  it("A9: a modal's scroll lock never moves the header", () => {
    expect(rule(site, 'html')).toMatch(/scrollbar-gutter: stable/);
  });

  it('A2: a skeleton row of the rail is the box of a rail row', () => {
    expect(rule(studio, '.rail-section .rail-skel')).toMatch(/min-height: var\(--size-9\)/);
    expect(rule(studio, '.rail-section a')).toMatch(/min-height: var\(--size-9\)/);
  });

  it("Team Home: the design system read's progress is out of flow, so the home growing above never moves it", () => {
    const pages = read('../styles/team-pages.css');
    expect(rule(pages, '.sh-team-ds:has(> .lp, > .lp-wait)')).toMatch(/position: fixed;/);
    expect(read('../pages/team-shell/index.astro')).toMatch(/<div data-team-ds class="sh-team-ds">\s*<div class="lp-wait"/);
  });

  it('A11: Invite collaborators reads like every other item of the team menu', () => {
    expect(team).not.toMatch(/\.tc-invite\s*\{/);
  });

  it("A11: every item of the team menu starts its text on one edge: one leading slot, a team mark's width", () => {
    // The DS Menu's leading slot is an icon wide (icon-size-sm); a team's mark is an Avatar xs (size-5). One width for all.
    expect(rule(team, '.tc-menu [role="menuitem"] > :first-child')).toMatch(/width: var\(--size-5\)/);
    expect(rule(team, '.tc-menu .tc-mark')).toMatch(/width: var\(--size-5\);\s*height: var\(--size-5\)/);
    // No item widens its own slot to its content (the 4px step between a team row and the others).
    expect(team).not.toMatch(/\.tc-team > :first-child\s*\{\s*width: auto/);
    expect(read('../../../../packages/react/src/components/Avatar/Avatar.module.css')).toMatch(/\.xs \{\s*--_size: var\(--size-5\)/);
  });

  it('A12: the Library rail offers the account row to someone signed in', () => {
    const foot = layout.slice(layout.indexOf('<div class="rail-foot">'), layout.indexOf('</nav>', layout.indexOf('<div class="rail-foot">')));
    expect(foot.match(/<AccountMenu client:only="react" \/>/g)).toHaveLength(2);
  });
});
