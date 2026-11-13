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

  it("A7: the sample team's banner is in the page as built, shown from first paint on the sample team only", () => {
    expect(layout).toContain("if (sample) document.documentElement.setAttribute('data-sample-team', '')");
    // The real banner (its own height at every width), not a box guessed to match it.
    expect(layout).toMatch(/<div class="demo-strip" data-demo-strip hidden>\s*<DemoBanner repo=\{SAMPLE_REPO\} back=\{null\} \/>\s*<\/div>/);
    const strip = rule(site, ':root[data-sample-team] .demo-strip[hidden]:not([data-settled])');
    expect(strip).toMatch(/display: block;/);
    expect(strip).not.toMatch(/min-height/);
    // Let go only when the live banner never came (the built one stays until it does).
    expect(read('../scripts/shell.ts')).toContain("if (strip.hidden) strip.dataset.settled = '';");
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

  it("Team Home: the design system read says itself to screen readers only, no box under the home that comes and goes", () => {
    const pages = read('../styles/team-pages.css');
    expect(rule(pages, '.sh-team-ds')).not.toMatch(/margin/);
    expect(rule(pages, '.sh-team-ds:has(.tp-error)')).toMatch(/margin-block-start: var\(--space-6\)/);
    expect(read('../pages/team-shell/index.astro')).toMatch(/<div data-team-ds class="sh-team-ds">\s*<p class="sr-only" role="status">Reading this team's design system<\/p>/);
    const home = read('../scripts/team-home.ts');
    expect(home).toContain('paintDs(createElement(TeamLoadStatus');
    expect(home).not.toContain('TeamLoadProgress');
  });

  it("A team Library reads with its header and one screen reader sentence, never a progress card", () => {
    const state = read('../components/ds/library/LibraryState.tsx');
    expect(state).not.toContain('TeamLoadProgress');
    expect(state.match(/<TeamLoadStatus label=\{/g)).toHaveLength(2);
  });

  it('Sample team rail: no Connect GitHub before the played person paints, and its two product rows reserved', () => {
    const quiet = ':root[data-sample-team] .gh-acct:not([data-state="connected"], [data-state="rejected"])';
    expect(rule(studio, `${quiet} .gh-acct-connect`)).toMatch(/display: none/);
    expect(rule(studio, `${quiet} .gh-acct-menu`)).toMatch(/visibility: hidden/);
    expect(rule(studio, ':root[data-sample-team] .rail-products[data-pending] .rail-skel:nth-child(n + 3)')).toMatch(/display: none/);
  });

  it('Team Settings: General and Members are painted by the build in their final shape until their islands mount', () => {
    const page = read('../pages/team-shell/settings/index.astro');
    expect(page).toMatch(/<TeamNameSetting client:only="react">[\s\S]*?<TeamNameSkeleton slot="fallback" \/>/);
    expect(page).toMatch(/<MembersSection client:only="react">[\s\S]*?<MembersSkeleton slot="fallback" rows=\{SAMPLE_MEMBER_ROWS\} fallback \/>/);
    // Any other team keeps MEMBER_ROWS_DEFAULT (3) rows of the build's five.
    expect(read('../styles/invites.css')).toContain(':root:not([data-sample-team]) .mem-skel[data-fallback] .mem-skel-row:nth-child(n + 4)');
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
