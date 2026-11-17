// Behavior requests (phase 2 of behaviors): a person asks to change how a component behaves, or a rule of an action
// pattern, and the design system lead decides. The kind round-trips through the issue body, waits outside Being built
// until it is made the default, and reads the same everywhere.
import { describe, expect, it, vi } from 'vitest';
import {
  askRequesterComment,
  askRequesterOnGitHub,
  BEHAVIOR_REQUEST_LABEL,
  behaviorAskOf,
  behaviorBrief,
  isNewPatternAsk,
  behaviorDefaultComment,
  behaviorRequestOf,
  BUILD_REQUEST_LABEL,
  composeRequestIssue,
  draftBehaviorText,
  isBuildRequestIssue,
  isUndecidedBehaviorRequest,
  makeBehaviorDefaultOnGitHub,
  parseRequestIssue,
  REQUEST_KINDS,
  REQUEST_LABEL,
  requestBrief,
  type BehaviorAsk,
  type GitHubClient,
} from '../src/index';

const select: BehaviorAsk = { of: 'component', id: 'Select', behavior: 'close-on-escape', today: 'Closes on Escape', wanted: 'Keeps the list open and clears the search on Escape', where: 'Orders, the filter bar' };

describe('behavior request kind', () => {
  it('is a known kind with its label', () => {
    expect(REQUEST_KINDS.find((k) => k.value === 'behavior')?.label).toBe('Behavior change');
  });

  it('round-trips through the issue body with its ask', () => {
    const r = behaviorRequestOf('Select', select, { requestedBy: 'dana' });
    const issue = composeRequestIssue(r);
    expect(issue.labels).toEqual(expect.arrayContaining([REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL, 'source: studio']));
    expect(issue.title).toBe('Select: Keeps the list open and clears the search on Escape');
    expect(issue.body).toContain('| close-on-escape | Closes on Escape | Keeps the list open and clears the search on Escape |');
    expect(issue.body).toContain('**Where it gets in the way:** Orders, the filter bar');
    expect(issue.body).not.toMatch(/\u2014/);
    const back = parseRequestIssue(issue.body)!;
    expect(back.kind).toBe('behavior');
    expect(behaviorAskOf(back)).toEqual(select);
  });

  it('drafts the title and summary from the two sentences only', () => {
    expect(draftBehaviorText('Select', select)).toEqual({ title: 'Keeps the list open and clears the search on Escape', summary: 'Today: Closes on Escape. Wanted: Keeps the list open and clears the search on Escape. It gets in the way in Orders, the filter bar.' });
    expect(draftBehaviorText('Select', { of: 'component', today: '', wanted: 'opens on focus.' })).toEqual({ title: 'Opens on focus', summary: 'Select does not do this yet. Wanted: Opens on focus.' });
    expect(draftBehaviorText('Select', { of: 'component', today: 'x', wanted: 'a '.repeat(80) }).title.length).toBeLessThanOrEqual(104);
  });

  it('titles the issue with the wanted sentence, its key name kept as written', () => {
    const tab = behaviorRequestOf('Select', { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the highlighted option, then moves to the next field' });
    expect(composeRequestIssue(tab).title).toBe('Select: Tab picks the highlighted option, then moves to the next field');
    const rule = behaviorRequestOf('Delete pattern', { of: 'pattern', id: 'delete', rule: 0, today: 'Ask first', wanted: 'Offer Undo instead of asking' });
    expect(composeRequestIssue(rule).title).toBe('Delete pattern: Offer Undo instead of asking');
  });

  it('carries a pattern rule by its place', () => {
    const r = behaviorRequestOf('Delete pattern', { of: 'pattern', id: 'delete', rule: 1, today: 'Ask first when it cannot be undone', wanted: 'Always offer Undo' });
    expect(r.changes).toEqual([{ field: 'Rule 2', before: 'Ask first when it cannot be undone', after: 'Always offer Undo' }]);
    expect(behaviorAskOf(parseRequestIssue(composeRequestIssue(r).body))).toMatchObject({ of: 'pattern', id: 'delete', rule: 1 });
    expect(requestBrief(r, { issue: 4 })).toContain('patterns/delete.pattern.json');
  });

  it('reads no ask from a broken or other block', () => {
    expect(behaviorAskOf({ kind: 'bug', behavior: select })).toBeNull();
    expect(behaviorAskOf({ kind: 'behavior', behavior: { ...select, wanted: ' ' } })).toBeNull();
    expect(behaviorAskOf({ kind: 'behavior', behavior: { ...select, of: 'screen' as 'component' } })).toBeNull();
    expect(behaviorAskOf({ kind: 'behavior', behavior: { ...select, rule: -1 } })).not.toHaveProperty('rule');
  });
});

describe('the lead decides before Being built', () => {
  it('keeps an undecided behavior request out of the build requests, then lets it in once made the default', () => {
    const waiting = [REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL];
    expect(isUndecidedBehaviorRequest(waiting)).toBe(true);
    expect(isBuildRequestIssue(waiting)).toBe(false);
    expect(isBuildRequestIssue([...waiting, BUILD_REQUEST_LABEL])).toBe(true);
    expect(isBuildRequestIssue([REQUEST_LABEL, 'request: bug'])).toBe(true);
  });

  it('makes it the default: the bridge-build label, then who decided', async () => {
    const gh = { addLabels: vi.fn(async () => true), addComment: vi.fn(async () => undefined) };
    await makeBehaviorDefaultOnGitHub(gh as unknown as GitHubClient, 9, 'lee');
    expect(gh.addLabels).toHaveBeenCalledWith(9, [BUILD_REQUEST_LABEL]);
    expect(gh.addComment).toHaveBeenCalledWith(9, behaviorDefaultComment('lee'));
    const refused = { addLabels: vi.fn(async () => false), addComment: vi.fn() };
    await expect(makeBehaviorDefaultOnGitHub(refused as unknown as GitHubClient, 9)).rejects.toThrow(/did not take the decision/);
    expect(refused.addComment).not.toHaveBeenCalled();
  });

  it('asks the requester in one comment, never empty', async () => {
    const gh = { addComment: vi.fn(async () => undefined) };
    await askRequesterOnGitHub(gh as unknown as GitHubClient, 9, 'Which screen?', { by: 'lee', requester: 'dana' });
    expect(gh.addComment).toHaveBeenCalledWith(9, askRequesterComment('Which screen?', 'lee', 'dana'));
    expect(askRequesterComment('Which screen?', 'lee', 'dana')).toBe('@lee asks @dana, before deciding:\n\n> Which screen?');
    // An email lead is named, never a login; an email requester's name is not a login: no mention.
    expect(askRequesterComment('Which screen?', { name: 'Dana' }, 'Mia Ross')).toBe('Dana asks, before deciding:\n\n> Which screen?');
    expect(askRequesterComment('Which screen?', null, null)).toBe('A question, before deciding:\n\n> Which screen?');
    expect(behaviorDefaultComment({ name: 'Dana' })).toMatch(/^Dana made it the default in Bridge Studio\./);
    expect(behaviorDefaultComment('lee')).toMatch(/^@lee made it the default/);
    await expect(askRequesterOnGitHub(gh as unknown as GitHubClient, 9, '  ')).rejects.toThrow(/Write your question/);
  });
});

describe('a new action pattern proposed from Studio', () => {
  const archive: BehaviorAsk = {
    of: 'pattern',
    id: 'archive',
    today: '',
    wanted: 'Takes something people no longer need out of their lists, and keeps it.',
    rules: ['Archived items stay under Archived.', 'A toast offers Undo.'],
    places: [
      { screen: 'Acme CRM, Deals, a deal', label: 'Archive deal', link: 'https://www.figma.com/design/abc' },
      { screen: 'Acme Prints, Orders', label: 'Move to archive' },
    ],
  };

  it('round-trips its places and rules through the issue body, and shows them as rows', () => {
    const r = behaviorRequestOf('Archive pattern', archive, { requestedBy: 'sofia' });
    expect(isNewPatternAsk(behaviorAskOf(r))).toBe(true);
    const issue = composeRequestIssue(r);
    expect(issue.title).toBe('Archive pattern: A new action pattern');
    expect(issue.labels).toContain(BEHAVIOR_REQUEST_LABEL);
    expect(issue.body).toContain('| Place 1 | Acme CRM, Deals, a deal: "Archive deal" (https://www.figma.com/design/abc) |');
    expect(issue.body).toContain('| Rule 2 | A toast offers Undo. |');
    expect(issue.body).not.toMatch(/—/);
    expect(behaviorAskOf(parseRequestIssue(issue.body))).toEqual(archive);
  });

  it('keeps an older ask without places as it was, and drops a bad shape', () => {
    const old = behaviorAskOf({ kind: 'behavior', behavior: { of: 'pattern', id: 'delete', rule: 0, today: 'Ask first', wanted: 'Offer Undo' } });
    expect(old).toEqual({ of: 'pattern', id: 'delete', rule: 0, today: 'Ask first', wanted: 'Offer Undo' });
    expect(isNewPatternAsk(old)).toBe(false);
    const bad = behaviorAskOf({ kind: 'behavior', behavior: { of: 'pattern', id: 'archive', today: '', wanted: 'Keeps it', places: 'everywhere', rules: [3] } as unknown as BehaviorAsk });
    expect(bad).toEqual({ of: 'pattern', id: 'archive', today: '', wanted: 'Keeps it' });
    const some = behaviorAskOf({ kind: 'behavior', behavior: { of: 'pattern', id: 'archive', today: '', wanted: 'Keeps it', places: [{ screen: 'Deals', label: '' }, { screen: 'Orders', label: 'Archive' }, null] } as unknown as BehaviorAsk });
    expect(some?.places).toEqual([{ screen: 'Orders', label: 'Archive' }]);
    // A component ask never carries places.
    expect(behaviorAskOf({ kind: 'behavior', behavior: { ...select, places: archive.places } as BehaviorAsk })).toEqual(select);
  });

  it('briefs the developer to write the pattern file from real code, never guessing a place', () => {
    const brief = behaviorBrief(behaviorRequestOf('Archive pattern', archive), { issue: 51 });
    expect(brief).toContain('Pattern: Archive (patterns/archive.pattern.json, a new file, kind "action")');
    expect(brief).toContain('- Acme Prints, Orders: "Move to archive"');
    expect(brief).toContain('comment on #51 instead of guessing');
    expect(brief).not.toMatch(/—/);
  });
});
