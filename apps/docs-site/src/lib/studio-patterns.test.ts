import { describe, expect, it } from 'vitest';
import { behaviorRequestOf, composeRequestIssue, type BehaviorAsk } from '@bridge-ds/core';
import { patternRequests, requestsLabel, sharedComponents, studioPatternGroups, studioPatternsLead, type StudioPatternRow } from './studio-patterns';
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
