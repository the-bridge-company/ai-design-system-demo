// Claude's preview of a behavior request, made by the person's own Claude through the Bridge connector: the brief
// bridge_make_behavior_preview gives, the report's rules, and the record Bridge's app writes, read back by Studio
// (only Bridge's own blocks).
import { describe, expect, it } from 'vitest';
import { behaviorPreviewBrief, behaviorRequestOf, isBridgeAppComment, parsePreviewState, previewBranch, behaviorPreviewComment, previewPhrase, previewReportProblems } from '../src/index';

const bridge = { login: 'bridge-design-studio[bot]', type: 'Bot' };
const req = behaviorRequestOf('Select', { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the highlighted option' });

describe('the brief', () => {
  it('says the change, the branch, the draft "Preview for #n" without Closes, and how to tell Bridge', () => {
    const b = behaviorPreviewBrief(req, 75, { files: ['packages/react/src/components/Select/Select.tsx'], docsPath: 'packages/react/src/components/Select/Select.docs.json', keys: ['Tab'], defaultBranch: 'main' });
    expect(b).toContain('Behavior: tab-leaves (keys: Tab)');
    expect(b).toContain('git switch -C agent/preview-75 origin/main');
    expect(b).toContain('Update its `behaviors` entry `tab-leaves` in packages/react/src/components/Select/Select.docs.json');
    expect(b).toContain('presses Tab');
    expect(b).toContain('a click away from the component is written `click-outside`');
    expect(b).toContain('--title "Preview for #75"');
    expect(b).toContain('Never write "Closes #75"');
    expect(b).toContain('bridge_report_behavior_preview with number 75, state "ready"');
    expect(b).not.toMatch(/API key|ANTHROPIC|\u2014/i);
    expect(previewBranch(75)).toBe('agent/preview-75');
    expect(previewPhrase(75)).toBe('Make the Bridge preview for request #75');
    expect(previewPhrase(75, true)).toBe('Update the Bridge preview for request #75');
  });
});

describe('the report', () => {
  it('needs the branch and the pull request when ready, a reason when failed', () => {
    expect(previewReportProblems(75, { state: 'ready', branch: 'agent/preview-75', pr: 80, sha: 'abc1234' })).toEqual([]);
    expect(previewReportProblems(75, { state: 'ready', branch: 'agent/preview-7', pr: 0 })).toHaveLength(2);
    expect(previewReportProblems(75, { state: 'failed' })).toEqual(['Say why the preview could not be made, in one sentence.']);
    expect(previewReportProblems(75, { state: 'preparing' })).toEqual([]);
  });
});

describe('the record', () => {
  it('is read back from Bridge app comments only', () => {
    const body = behaviorPreviewComment({ state: 'ready', branch: 'agent/preview-75', pr: 80, sha: 'abc1234', round: 2, wanted: 'Tab picks the highlighted option', by: 'Malik', at: '2026-11-15T10:00:00Z' });
    expect(body.startsWith("Claude's preview is ready in #80.")).toBe(true);
    expect(parsePreviewState([{ body, user: bridge }])).toEqual({ state: 'ready', branch: 'agent/preview-75', pr: 80, sha: 'abc1234', round: 2, wanted: 'Tab picks the highlighted option', by: 'Malik', at: '2026-11-15T10:00:00Z' });
    // Someone pasting a block by hand, or another app's bot, is never read.
    expect(parsePreviewState([{ body, user: { login: 'sofia', type: 'User' } }])).toBeNull();
    expect(parsePreviewState([{ body, user: { login: 'github-actions[bot]', type: 'Bot' } }])).toBeNull();
    expect(isBridgeAppComment({ user: bridge })).toBe(true);
  });

  it('keeps the latest, nothing it cannot trust', () => {
    const preparing = behaviorPreviewComment({ state: 'preparing', by: 'Malik' });
    const failed = behaviorPreviewComment({ state: 'failed', reason: 'Select has no test file.' });
    expect(parsePreviewState([{ body: preparing, user: bridge }, { body: failed, user: bridge }])).toEqual({ state: 'failed', reason: 'Select has no test file.' });
    expect(parsePreviewState([{ body: '<!-- bridge-preview {"state":"ready","branch":"main","sha":"x\\"><b>"} -->', user: bridge }])).toEqual({ state: 'ready' });
    expect(parsePreviewState([])).toBeNull();
  });
});
