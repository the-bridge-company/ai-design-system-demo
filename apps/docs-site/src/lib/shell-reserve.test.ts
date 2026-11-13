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
    expect(rule(site, ':root[data-sample-team] .demo-strip[hidden]:not([data-settled])')).toMatch(/min-height: calc\(var\(--control-height-md\) \+ var\(--space-4\)\)/);
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

  it('A11: Invite collaborators reads like every other item of the team menu', () => {
    expect(team).not.toMatch(/\.tc-invite\s*\{/);
  });

  it('A12: the Library rail offers the account row to someone signed in', () => {
    const foot = layout.slice(layout.indexOf('<div class="rail-foot">'), layout.indexOf('</nav>', layout.indexOf('<div class="rail-foot">')));
    expect(foot.match(/<AccountMenu client:only="react" \/>/g)).toHaveLength(2);
  });
});
