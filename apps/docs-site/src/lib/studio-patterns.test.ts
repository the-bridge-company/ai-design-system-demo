import { describe, expect, it } from 'vitest';
import { behaviorRequestOf, composeRequestIssue, type BehaviorAsk } from '@bridge-ds/core';
import { askedNotPatterns, patternRequests, requestsLabel, sharedComponents, studioPatternGroups, studioPatternsLead, type StudioPatternRow } from './studio-patterns';
import { libraryPatterns, patternRoute } from './library/patterns';
import { repoModel } from './model';
import type { BehaviorIssue } from './home-model';

const own = studioPatternGroups(libraryPatterns(repoModel), (id) => `/${patternRoute(id)}`);

/** An issue as Bridge files a behavior request (the real body: core composeRequestIssue). */
function issue(number: number, subject: string, ask: BehaviorAsk, labels = ['component-change', 'request: behavior'], extra: Partial<BehaviorIssue> = {}): BehaviorIssue {
  const r = behaviorRequestOf(subject, ask);
  const { title, body } = composeRequestIssue(r);
  return { number, title, body, labels, user: { login: 'dana' }, created_at: '2026-11-14T10:00:00Z', ...extra };
}

describe('Studio Patterns rows', () => {
  it("are Bridge's own patterns/ files, in the Library's groups and order, each linked to its Library page", () => {
    expect(own.map((g) => g.label)).toEqual(['Interactions', 'Actions']);
    const all = own.flatMap((g) => g.rows);
    const ids = libraryPatterns(repoModel).flatMap((g) => g.items.map((e) => e.pattern.id));
    expect(all.map((r) => r.id)).toEqual(ids);
    const del = all.find((r) => r.id === 'delete')!;
    expect(del).toMatchObject({ name: 'Delete', href: '/patterns/delete/', components: ['Button', 'AlertDialog'] });
    expect(del.purpose).toMatch(/^Removes something for good/);
    // An interaction uses the components that list its behavior id.
    const esc = all.find((r) => r.id === 'close-on-escape')!;
    expect(esc.components.length).toBeGreaterThanOrEqual(2);
  });

  it('say the kinds once in the summary, and what waits only when something does', () => {
    const lead = studioPatternsLead(own);
    expect(lead).toMatch(/^\d+ interactions? and \d+ actions? shared across the product\.$/);
    expect(studioPatternsLead(own, 2)).toMatch(/, 2 changes asked on them wait for your decision\.$/);
    expect(studioPatternsLead(own, 1)).toMatch(/, 1 change asked on them waits for your decision\.$/);
    expect(studioPatternsLead([])).toBe('');
    expect(requestsLabel(1)).toBe('1 change asked');
    for (const s of [lead, studioPatternsLead(own, 3)]) expect(s).not.toContain('—');
  });
});

describe('the components a group shares', () => {
  const row = (id: string, components: string[]): StudioPatternRow => ({ id, name: id, purpose: '', components, href: `/${id}/` });

  it('are said once when every row uses the same ones, in any order', () => {
    expect(sharedComponents({ rows: [row('a', ['Combobox', 'Select']), row('b', ['Select', 'Combobox']), row('c', ['Combobox', 'Select'])] })).toEqual(['Combobox', 'Select']);
  });

  it('stay per row when rows differ, for a lone row, an empty group or no components', () => {
    expect(sharedComponents({ rows: [row('delete', ['Button', 'AlertDialog']), row('send', ['Button'])] })).toBeNull();
    expect(sharedComponents({ rows: [row('delete', ['Button', 'AlertDialog'])] })).toBeNull();
    expect(sharedComponents({ rows: [] })).toBeNull();
    expect(sharedComponents({ rows: [row('a', []), row('b', [])] })).toBeNull();
  });

  it("on Bridge's own patterns: the actions differ, so they keep their own", () => {
    expect(sharedComponents(own.find((g) => g.kind === 'action')!)).toBeNull();
  });
});

describe('the changes asked on each pattern', () => {
  const rule: BehaviorAsk = { of: 'pattern', id: 'delete', rule: 0, today: 'It cannot be undone, so ask first.', wanted: 'Offer Undo for a few seconds instead of asking first.' };
  const escape: BehaviorAsk = { of: 'component', id: 'Select', behavior: 'close-on-escape', today: 'Escape closes the list.', wanted: 'Escape clears the search first.' };

  it('groups the undecided behavior requests by the pattern they ask about, oldest first', () => {
    const map = patternRequests([issue(14, 'Delete pattern', rule), issue(12, 'Delete pattern', { ...rule, wanted: 'Type the name for every delete.' }), issue(13, 'Select', escape)], own);
    expect(map.get('delete')?.map((r) => r.number)).toEqual([12, 14]);
    expect(map.get('close-on-escape')?.map((r) => r.number)).toEqual([13]);
    expect(map.get('delete')![0]!.title).toMatch(/^Delete pattern: /);
  });

  it('leaves out what waits on nobody here: decided, someone on it, pull requests, other subjects', () => {
    const map = patternRequests(
      [
        issue(20, 'Delete pattern', rule, ['request: behavior', 'bridge-build']),
        issue(21, 'Delete pattern', rule, ['request: behavior'], { assignees: [{ login: 'dana' }] }),
        issue(22, 'Delete pattern', rule, ['request: behavior'], { pull_request: {} }),
        issue(23, 'Select', { ...escape, behavior: 'keeps-scroll' }),
        issue(24, 'Rename pattern', { ...rule, id: 'rename' }),
        // A component behavior whose id names an action pattern is not that action.
        issue(25, 'Button', { of: 'component', id: 'Button', behavior: 'delete', today: '', wanted: 'x' }),
        { number: 26, title: 'Plain issue', body: 'No Bridge block', labels: ['request: behavior'], created_at: '2026-11-14T10:00:00Z' },
      ],
      own,
    );
    expect([...map.keys()]).toEqual([]);
  });
});

describe('proposals that are not patterns yet', () => {
  const archive: BehaviorAsk = {
    of: 'pattern',
    id: 'archive',
    today: '',
    wanted: 'Takes something out of the lists and keeps it.',
    rules: ['Nothing is deleted.'],
    places: [
      { screen: 'Acme CRM, Deals', label: 'Archive deal' },
      { screen: 'Acme Prints, Orders', label: 'Move to archive' },
    ],
  };
  const jump: BehaviorAsk = { of: 'component', id: 'Menu', behavior: 'type-to-jump', today: '', wanted: 'Typing a letter jumps to the first item.' };

  it('lists a new action and a behavior asked of a component that does not do it, by name, oldest first', () => {
    const names = new Map([['type-to-jump', 'Type to jump']]);
    expect(askedNotPatterns([issue(31, 'Menu', jump), issue(30, 'Archive pattern', archive)], own, names)).toEqual([
      { number: 30, name: 'Archive' },
      { number: 31, name: 'Type to jump on Menu' },
    ]);
    // Without the component's words, the id in words.
    expect(askedNotPatterns([issue(31, 'Menu', jump)], own)).toEqual([{ number: 31, name: 'Type to jump on Menu' }]);
  });

  it('leaves out what is a row (an adoption of an interaction, a change to a pattern) and what does not wait on the lead', () => {
    const escape: BehaviorAsk = { of: 'component', id: 'Menu', behavior: 'close-on-escape', today: '', wanted: 'Escape closes the menu.' };
    const rule: BehaviorAsk = { of: 'pattern', id: 'delete', today: '', wanted: 'Offer Undo.' };
    const own2: BehaviorAsk = { of: 'component', id: 'Select', behavior: 'type-to-jump', today: 'Type to jump', wanted: 'Jumps on two letters.' };
    const out = askedNotPatterns(
      [
        issue(40, 'Menu', escape),
        issue(41, 'Delete pattern', rule),
        issue(42, 'Select', own2),
        issue(43, 'Archive pattern', archive, ['request: behavior', 'bridge-build']),
        issue(44, 'Archive pattern', archive, ['request: behavior'], { assignees: [{ login: 'malik' }] }),
        // A proposal whose name is a pattern already belongs to that row.
        issue(45, 'Delete pattern', { ...archive, id: 'delete' }),
      ],
      own,
    );
    expect(out).toEqual([]);
    // The adoption of an interaction is on that row, for the lead.
    expect(patternRequests([issue(40, 'Menu', escape)], own).get('close-on-escape')?.map((q) => q.number)).toEqual([40]);
  });

  it('never become a row, a Library pattern or an agent pattern while their request is open', () => {
    const before = libraryPatterns(repoModel);
    const issues = [issue(30, 'Archive pattern', archive), issue(31, 'Menu', jump)];
    expect(askedNotPatterns(issues, own)).toHaveLength(2);
    expect(patternRequests(issues, own).size).toBe(0);
    // The Library reads only the pattern files: the open requests change nothing.
    expect(libraryPatterns(repoModel)).toEqual(before);
    const ids = studioPatternGroups(libraryPatterns(repoModel), (id) => id).flatMap((g) => g.rows.map((r) => r.id));
    expect(ids).not.toContain('archive');
    expect(ids).not.toContain('type-to-jump');
  });

  it('are counted in the lead sentence with the changes, once', () => {
    expect(studioPatternsLead(own, 3, 2)).toMatch(/, 3 changes asked on them and 2 new ones wait for your decision\.$/);
    expect(studioPatternsLead(own, 0, 1)).toMatch(/shared across the product, 1 new one waits for your decision\.$/);
    expect(studioPatternsLead(own, null, 0)).toMatch(/shared across the product\.$/);
  });

  it('give the lead who asked and the ask on each row request', () => {
    const map = patternRequests([issue(40, 'Menu', { of: 'component', id: 'Menu', behavior: 'close-on-escape', today: '', wanted: 'Escape closes the menu.' })], own);
    expect(map.get('close-on-escape')![0]).toMatchObject({ number: 40, asker: '@dana', requester: 'dana', ask: { of: 'component', id: 'Menu' } });
  });
});

describe('the rows a drawer reads', () => {
  it('carry an action\'s rules and an interaction\'s components in their words', () => {
    const all = own.flatMap((g) => g.rows);
    expect(all.find((r) => r.id === 'delete')!.rules!.length).toBeGreaterThan(0);
    const esc = all.find((r) => r.id === 'close-on-escape')!;
    expect(esc.uses!.map((u) => u.component)).toEqual(esc.components);
    expect(esc.uses![0]!.text).toBeTruthy();
  });
});
