// @vitest-environment jsdom
// A team's Library shell: noindex unless the team opts in on a public repository, and the build-time links follow the
// team in the address.
import { afterEach, describe, expect, it } from 'vitest';
import { applyIndexing, fillPatternsNav, markNoindex, paintTeamName, pointLibraryLinks, showPatternsNav } from './library-team';
import type { TeamPatternNavItem } from '../lib/library/patterns';

const robots = () => document.head.querySelectorAll('meta[name="robots"]');

describe('indexing', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('is noindex by default, once', () => {
    markNoindex();
    markNoindex();
    expect(robots()).toHaveLength(1);
    expect(robots()[0]!.getAttribute('content')).toBe('noindex');
  });

  it('opens to search engines only with library.public on a public repository', () => {
    markNoindex();
    applyIndexing({ public: false, private: false });
    expect(robots()).toHaveLength(1);
    applyIndexing({ public: true, private: true });
    expect(robots()).toHaveLength(1);
    applyIndexing({ public: true, private: false });
    expect(robots()).toHaveLength(0);
    // A later read that says otherwise closes it again.
    applyIndexing({ public: false, private: false });
    expect(robots()).toHaveLength(1);
  });
});

describe('pointLibraryLinks', () => {
  it('points the nav, Studio and GitHub links at the team', () => {
    document.body.innerHTML = `
      <a id="home" href="/library-shell/">Home</a>
      <a id="tokens" href="/library-shell/tokens/">Tokens</a>
      <a id="studio" href="/studio/">Open Studio</a>
      <a id="other" href="/studio/explorations/">Changes</a>
      <a id="gh" href="https://github.com/the-bridge-company/ai-design-system-demo" data-team-github>GitHub</a>
      <span data-team-name>owner/repo</span>`;
    const href = (id: string) => document.getElementById(id)!.getAttribute('href');
    pointLibraryLinks({ owner: 'acme', repo: 'ds' }, null);
    expect(href('home')).toBe('/library/acme/ds/');
    expect(href('tokens')).toBe('/library/acme/ds/tokens/');
    // Without the reserved list, the escape form, which always opens the team.
    expect(href('studio')).toBe('/studio/~/acme/ds/');
    expect(href('other')).toBe('/studio/explorations/');
    expect(href('gh')).toBe('https://github.com/acme/ds');
    expect(document.querySelector('[data-team-name]')!.textContent).toBe('acme/ds');
    // With it, the plain address.
    pointLibraryLinks({ owner: 'acme', repo: 'ds' }, { firsts: [], pairs: [] });
    expect(href('studio')).toBe('/studio/acme/ds/');
    expect(href('home')).toBe('/library/acme/ds/');
  });
});

describe('the team name in a Library (never the repository in words)', () => {
  afterEach(() => {
    document.title = '';
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('keeps "Library | Bridge" and the built words until the name is known, for any team', () => {
    document.title = 'Library | Bridge';
    document.body.innerHTML = '<span data-team-display>Bridge</span>';
    paintTeamName({ owner: 'primer', repo: 'primitives' }, null);
    expect(document.title).toBe('Library | Bridge');
    expect(document.body.textContent).toBe('Bridge');
    // Settings read without a name: still nothing built from "primitives".
    paintTeamName({ owner: 'primer', repo: 'primitives' }, {});
    expect(document.title).toBe('Library | Bridge');
    // A name from the settings: that one.
    paintTeamName({ owner: 'primer', repo: 'primitives' }, { name: 'Primer' });
    expect(document.title).toBe('Library | Primer');
  });

  it('names the sample team Acme Design at once, whatever this browser kept', () => {
    localStorage.setItem('bridge.teamNames', JSON.stringify({ 'acme-design-demo/bridge-demo-ds': 'Bridge demo ds' }));
    document.title = 'Library | Bridge';
    paintTeamName({ owner: 'acme-design-demo', repo: 'bridge-demo-ds' }, null);
    expect(document.title).toBe('Library | Acme Design');
  });
});

describe('the Patterns group of a team Library nav', () => {
  // The markup Layout.astro builds for the group: hidden until the team has patterns, Overview its one built page.
  const built = (current: boolean) => `
    <ul class="nav">
      <li class="nav-group" hidden data-nav-until="patterns">
        <button type="button" class="nav-link nav-toggle" data-nav-group="Patterns" aria-controls="g" aria-expanded="true"><span>Patterns</span></button>
        <ul class="nav-sub" id="g" data-nav-sub="patterns">
          <li><a class="link subtle" href="/library/acme/ds/patterns/"${current ? ' aria-current="page"' : ''}><span>Overview</span></a></li>
        </ul>
      </li>
      <li class="nav-group"><ul class="nav-sub" id="u"><li><a href="/library/acme/ds/install/"><span>Install</span></a></li></ul></li>
    </ul>`;
  const items = (current?: string): TeamPatternNavItem[] =>
    [
      { id: 'close-on-escape', label: 'Close on Escape', heading: 'Interactions' },
      { id: 'focus-after-close', label: 'Focus after close' },
    ].map((i) => ({ ...i, href: `/library/acme/ds/patterns/?p=${i.id}`, meta: '', current: i.id === current }));
  const rows = () => [...document.querySelectorAll('[data-nav-sub="patterns"] > li')].map((li) => (li.classList.contains('nav-sub-head') ? `# ${li.textContent}` : `${li.querySelector('a')!.getAttribute('aria-current') ? '> ' : ''}${li.textContent!.trim()} ${li.querySelector('a')!.getAttribute('href')}`));

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds the kind label and one row per pattern under Overview, each a copy of the built row', () => {
    document.body.innerHTML = built(true);
    fillPatternsNav(items());
    expect(rows()).toEqual([
      '> Overview /library/acme/ds/patterns/',
      '# Interactions',
      'Close on Escape /library/acme/ds/patterns/?p=close-on-escape',
      'Focus after close /library/acme/ds/patterns/?p=focus-after-close',
    ]);
    const a = document.querySelector('[data-nav-pattern="close-on-escape"] a')!;
    expect(a.className).toBe('link subtle');
    // Other groups are left alone.
    expect(document.querySelectorAll('#u > li')).toHaveLength(1);
  });

  it('makes the shown pattern the current page, not Overview, and replaces its rows when run again', () => {
    document.body.innerHTML = built(true);
    fillPatternsNav(items());
    fillPatternsNav(items('focus-after-close'));
    expect(rows()).toEqual([
      'Overview /library/acme/ds/patterns/',
      '# Interactions',
      'Close on Escape /library/acme/ds/patterns/?p=close-on-escape',
      '> Focus after close /library/acme/ds/patterns/?p=focus-after-close',
    ]);
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('shows the group only once the team has patterns', () => {
    document.body.innerHTML = built(false);
    const group = document.querySelector<HTMLElement>('[data-nav-until="patterns"]')!;
    expect(group.hidden).toBe(true);
    fillPatternsNav([]);
    showPatternsNav(false);
    expect(group.hidden).toBe(true);
    expect(rows()).toEqual(['Overview /library/acme/ds/patterns/']);
    fillPatternsNav(items());
    showPatternsNav(true);
    expect(group.hidden).toBe(false);
  });
});
