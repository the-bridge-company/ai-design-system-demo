// The Patterns pages of a Library over this repository's model: interactions read from the components that share a
// behavior id (each in its words, with what the stage needs), actions as written, grouped by kind, and their links.
import { describe, expect, it } from 'vitest';
import type { RepoModel } from '@bridge-ds/core';
import { repoModel } from '../model';
import { interactionIds, libraryPatterns, patternById, patternComponents, patternsLead } from './patterns';
import { patternHref } from '../../components/ds/library/library-data';
import { patternHrefs, patternLinks } from '../../components/ds/library/views/PatternsView';
import { behaviorPatterns } from '../../components/ds/library/views/ComponentView';
import { librarySearchIndex } from './search-index';

const groups = libraryPatterns(repoModel);

describe('libraryPatterns', () => {
  it('groups interactions first, then actions, by name', () => {
    expect(groups.map((g) => g.label)).toEqual(['Interactions', 'Actions']);
    expect(groups[0]!.items.map((e) => e.pattern.id)).toEqual(['close-on-escape', 'focus-after-close', 'pick-with-enter']);
    expect(groups[1]!.items.map((e) => e.pattern.id)).toEqual(['delete', 'send-for-review']);
    expect(patternsLead(groups)).toBe('3 interactions several components share, and 2 actions people take across the product. Each one works the same wherever it appears.');
  });

  it('gives an interaction its components in their own words, with their page and stage', () => {
    const e = patternById(groups, 'close-on-escape')!;
    expect(e.kind).toBe('interaction');
    if (e.kind !== 'interaction') return;
    expect(e.components.map((c) => [c.component, c.text, c.slug]).sort()).toEqual([
      ['Combobox', 'Escape closes the list', 'combobox'],
      ['Select', 'Closes on Escape', 'select'],
    ]);
    expect(e.components.every((c) => c.preview && c.try && c.storyId)).toBe(true);
    expect(patternComponents(e).sort()).toEqual(['Combobox', 'Select']);
  });

  it('shows nothing for a model without patterns', () => {
    expect(libraryPatterns({ ...repoModel, patterns: [] } as RepoModel)).toEqual([]);
    expect(libraryPatterns({ ...repoModel, patterns: undefined } as RepoModel)).toEqual([]);
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
    expect([...interactionIds(groups)].sort()).toEqual(['close-on-escape', 'focus-after-close', 'pick-with-enter']);
    expect(behaviorPatterns({ ...own, extras: {} })).toEqual({
      'close-on-escape': '/patterns/close-on-escape/',
      'focus-after-close': '/patterns/focus-after-close/',
      'pick-with-enter': '/patterns/pick-with-enter/',
    });
  });

  it('lists the team Patterns page in search only when the team has patterns', () => {
    const titles = (m: RepoModel) => librarySearchIndex(m, 'acme', 'ds').filter((i) => i.kind === 'page').map((i) => i.title);
    expect(titles(repoModel)).toContain('Patterns');
    expect(titles({ ...repoModel, patterns: [] } as RepoModel)).not.toContain('Patterns');
  });
});
