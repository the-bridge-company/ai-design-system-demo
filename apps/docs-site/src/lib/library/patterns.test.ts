// The Patterns pages of a Library over this repository's model: interactions read from the components that share a
// behavior id (each in its words, with what the stage needs), actions as written, grouped by kind, and their links.
import { describe, expect, it } from 'vitest';
import { PATTERN_KIND_LABEL, PATTERN_KINDS, type RepoModel } from '@bridge-ds/core';
import { repoModel } from '../model';
import { interactionIds, libraryPatterns, PATTERN_KIND_EMPTY, PATTERN_KIND_INTRO, PATTERN_KIND_ROUTE, PATTERN_KIND_SUGGEST, patternById, patternComponents, patternKindGroup, patternKindGroups, patternKindLead, patternRoute, patternsLead } from './patterns';
import { patternsNav } from '../nav';
import { LIBRARY_PATTERN_KIND_PAGES, LIBRARY_SHELL_ROUTES, ownLibraryPath } from '../library-shells';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { patternHref } from '../../components/ds/library/library-data';
import { PatternKindView, patternHrefs, patternLinks } from '../../components/ds/library/views/PatternsView';
import { REDIRECTS } from '../redirects';
import { behaviorPatterns } from '../../components/ds/library/views/ComponentView';
import { librarySearchIndex } from './search-index';

const groups = libraryPatterns(repoModel);

describe('libraryPatterns', () => {
  it('groups interactions first, then actions, by name', () => {
    expect(groups.map((g) => g.label)).toEqual(['Interactions', 'Actions']);
    expect(groups[0]!.items.map((e) => e.pattern.id)).toEqual(['close-on-outside-click', 'close-on-escape', 'focus-after-close', 'focus-on-open', 'trap-focus', 'jump-to-ends', 'move-with-arrows', 'open-list', 'open-from-trigger', 'scroll-lock', 'pick-with-enter', 'type-to-jump']);
    expect(groups[1]!.items.map((e) => e.pattern.id)).toEqual(['delete', 'send-for-review']);
    expect(patternsLead(groups)).toBe('12 interactions several components share, and 2 actions people take across the product. Each one works the same wherever it appears.');
  });

  it('gives an interaction its components in their own words, with their page and stage', () => {
    const e = patternById(groups, 'close-on-escape')!;
    expect(e.kind).toBe('interaction');
    if (e.kind !== 'interaction') return;
    expect(e.components.map((c) => [c.component, c.text, c.slug]).sort()).toEqual([
      ['AlertDialog', 'Escape cancels: nothing happens', 'alert-dialog'],
      ['Combobox', 'Escape closes the list', 'combobox'],
      ['Dialog', 'Closes on Escape', 'dialog'],
      ['Drawer', 'Closes on Escape', 'drawer'],
      ['Menu', 'Closes on Escape', 'menu'],
      ['Popover', 'Closes on Escape', 'popover'],
      ['Select', 'Closes on Escape', 'select'],
      ['Tooltip', 'Escape hides it', 'tooltip'],
    ]);
    expect(e.components.every((c) => c.preview && c.try && c.storyId)).toBe(true);
    expect(patternComponents(e).sort()).toEqual(['AlertDialog', 'Combobox', 'Dialog', 'Drawer', 'Menu', 'Popover', 'Select', 'Tooltip']);
  });

  it('shows nothing for a model without patterns', () => {
    expect(libraryPatterns({ ...repoModel, patterns: [] } as RepoModel)).toEqual([]);
    expect(libraryPatterns({ ...repoModel, patterns: undefined } as RepoModel)).toEqual([]);
  });
});

describe('a kind with no pattern yet', () => {
  it('keeps its place, in order, with no pattern', () => {
    const only = groups.filter((g) => g.kind === 'action');
    expect(patternKindGroups(only).map((g) => [g.kind, g.label, g.items.length])).toEqual([
      ['interaction', 'Interactions', 0],
      ['action', 'Actions', 2],
    ]);
    expect(patternKindGroups([]).map((g) => g.label)).toEqual(['Interactions', 'Actions']);
  });

  it('says how one comes to exist, in the Bridge voice', () => {
    for (const text of [...Object.values(PATTERN_KIND_EMPTY), ...Object.values(PATTERN_KIND_INTRO), ...Object.values(PATTERN_KIND_SUGGEST)]) {
      expect(text).not.toMatch(/[\u2014!]/);
    }
    expect(PATTERN_KIND_EMPTY.interaction).toMatch(/^None yet\. .*two components .*closing on Escape\.$/);
    expect(PATTERN_KIND_EMPTY.action).toMatch(/^None yet\. .*at least two places, like Delete\.$/);
  });
});

describe('pattern links', () => {
  const own = { team: null, model: repoModel };
  const team = { team: { owner: 'acme', repo: 'ds' }, model: repoModel };

  it('opens a pattern at its own address, or in the team shell by query', () => {
    expect(patternHref(own, 'delete')).toBe('/patterns/delete/');
    expect(patternHref(team, 'delete')).toBe('/library/acme/ds/patterns/?p=delete');
    expect(patternHrefs(own, groups)['send-for-review']).toBe('/patterns/send-for-review/');
  });

  it('links an action to its components and an interaction to their Behaviors', () => {
    expect(patternLinks(own, patternById(groups, 'delete')!)).toEqual({ Button: '/components/button/', AlertDialog: '/components/alert-dialog/' });
    expect(patternLinks(own, patternById(groups, 'close-on-escape')!).Select).toBe('/components/select/#behaviors');
  });

  it('gives a component page a link from each shared behavior row to its interaction', () => {
    expect([...interactionIds(groups)].sort()).toEqual([
      'close-on-escape',
      'close-on-outside-click',
      'focus-after-close',
      'focus-on-open',
      'jump-to-ends',
      'move-with-arrows',
      'open-from-trigger',
      'open-list',
      'pick-with-enter',
      'scroll-lock',
      'trap-focus',
      'type-to-jump',
    ]);
    expect(behaviorPatterns({ ...own, extras: {} })).toEqual({
      'close-on-escape': '/patterns/close-on-escape/',
      'close-on-outside-click': '/patterns/close-on-outside-click/',
      'focus-after-close': '/patterns/focus-after-close/',
      'focus-on-open': '/patterns/focus-on-open/',
      'jump-to-ends': '/patterns/jump-to-ends/',
      'move-with-arrows': '/patterns/move-with-arrows/',
      'open-from-trigger': '/patterns/open-from-trigger/',
      'open-list': '/patterns/open-list/',
      'pick-with-enter': '/patterns/pick-with-enter/',
      'scroll-lock': '/patterns/scroll-lock/',
      'trap-focus': '/patterns/trap-focus/',
      'type-to-jump': '/patterns/type-to-jump/',
    });
  });

  it("lists the team's kind pages in search, with or without patterns (as the nav does)", () => {
    const titles = (m: RepoModel) => librarySearchIndex(m, 'acme', 'ds').filter((i) => i.kind === 'page').map((i) => i.title);
    expect(titles(repoModel)).toEqual(expect.arrayContaining(['Interactions', 'Actions']));
    expect(titles({ ...repoModel, patterns: [] } as RepoModel)).toEqual(expect.arrayContaining(['Interactions', 'Actions']));
  });
});

describe('the Patterns pages, one per kind (founder decision 2026-11-17)', () => {
  it('has one nav row per kind, named as core names the kind, each its own page', () => {
    expect(LIBRARY_PATTERN_KIND_PAGES.map((r) => [r.kind, r.label, r.route])).toEqual(PATTERN_KINDS.map((k) => [k, PATTERN_KIND_LABEL[k], PATTERN_KIND_ROUTE[k]]));
    expect(PATTERN_KIND_ROUTE).toEqual({ interaction: 'patterns/interactions/', action: 'patterns/actions/' });
    // A team has a shell for each kind, and the pattern shell (?p=<id>).
    for (const r of LIBRARY_PATTERN_KIND_PAGES) expect(LIBRARY_SHELL_ROUTES).toContain(r.route);
    expect(LIBRARY_SHELL_ROUTES).toContain('patterns/');
  });

  it('sends the old index to Interactions, on Bridge and for its own team address, a pattern keeping its page', () => {
    expect(REDIRECTS['/patterns']).toBe('/patterns/interactions/');
    expect(ownLibraryPath('patterns/')).toBe('/patterns/interactions/');
    expect(ownLibraryPath('patterns/actions/')).toBe('/patterns/actions/');
    expect(ownLibraryPath('patterns/?p=delete')).toBe('/patterns/delete/');
  });

  it('says how many there are, or what the kind is while there is none', () => {
    expect(patternKindLead({ kind: 'action', items: [] })).toBe(PATTERN_KIND_INTRO.action);
    expect(patternKindLead(patternKindGroup(groups, 'action'))).toMatch(/^\d+ actions? people take across the product\. Each one works the same wherever it appears\.$/);
    expect(patternKindLead(patternKindGroup(groups, 'interaction'))).toMatch(/^\d+ interactions? several components share\./);
  });

  it('draws each kind on its own page, a kind with none yet included', () => {
    const only = groups.filter((g) => g.kind === 'interaction');
    for (const k of PATTERN_KINDS) {
      const html = renderToStaticMarkup(createElement(PatternKindView, { group: patternKindGroup(only, k), hrefs: patternHrefs({ team: null }, only) }));
      expect(html).toContain(`<h1`);
      expect(html.includes('data-pt-empty')).toBe(k === 'action');
    }
  });

  it("lists Bridge's own kinds, each its own page standing for its patterns' pages, no row per pattern", () => {
    expect(patternsNav()).toEqual(
      PATTERN_KINDS.map((k) => ({ href: `/${PATTERN_KIND_ROUTE[k]}`, label: PATTERN_KIND_LABEL[k], meta: expect.any(String), kind: k, also: patternKindGroup(groups, k).items.map((e) => `/${patternRoute(e.pattern.id)}`) })),
    );
    // Bridge's own: its 12 interactions (#1216), its 2 actions.
    expect(patternsNav().map((r) => r.also)).toEqual([
      [
        '/patterns/close-on-outside-click/',
        '/patterns/close-on-escape/',
        '/patterns/focus-after-close/',
        '/patterns/focus-on-open/',
        '/patterns/trap-focus/',
        '/patterns/jump-to-ends/',
        '/patterns/move-with-arrows/',
        '/patterns/open-list/',
        '/patterns/open-from-trigger/',
        '/patterns/scroll-lock/',
        '/patterns/pick-with-enter/',
        '/patterns/type-to-jump/',
      ],
      ['/patterns/delete/', '/patterns/send-for-review/'],
    ]);
  });
});
