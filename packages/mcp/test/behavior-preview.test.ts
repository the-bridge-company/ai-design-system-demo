// Claude's preview of a behavior request, made by the person's own Claude through Bridge: the brief to make it, and
// the report Bridge records (only through the hosted connector's server, never by the local server).
import { describe, expect, it, vi } from 'vitest';
import { behaviorRequestOf, composeRequestIssue } from '@bridge-ds/core';
import { BridgeContext, behaviorPreview } from '../src/lib.js';
import { fakeGitHub, readTree, REAL_PATHS, REPO } from './helpers.js';

const files = () => readTree(REPO, [...REAL_PATHS, 'packages/react/src/components/Select']);

function seed(gh: ReturnType<typeof fakeGitHub>, opts: { state?: string; kind?: 'behavior' | 'bug' } = {}) {
  const r = opts.kind === 'bug' ? { component: 'Select', kind: 'bug' as const, title: 'x', summary: 'y', changes: [], source: 'studio' as const } : behaviorRequestOf('Select', { of: 'component', id: 'Select', behavior: 'close-on-escape', today: 'Closes on Escape', wanted: 'Keeps the list open on Escape' }, { requestedBy: 'sofia' });
  const issue = composeRequestIssue(r);
  const number = 70 + gh.issues.length;
  gh.issues.push({ number, title: issue.title, body: issue.body, state: opts.state ?? 'open', state_reason: null, labels: issue.labels.map((name) => ({ name })), user: { login: 'sofia' }, html_url: `https://github.com/acme/ds/issues/${number}`, created_at: '2026-11-15T00:00:00Z', updated_at: '2026-11-15T00:00:00Z' });
  return number;
}

describe('bridge_make_behavior_preview', () => {
  it('gives the request, the files, the entry and the brief; tells the request on the connector', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const n = seed(gh);
    const record = vi.fn(async (x: unknown) => x as never);
    const ctx = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch, behaviorPreview: { record } });
    const r = (await behaviorPreview.makeBehaviorPreview(ctx, { number: n })) as any;
    expect(r.branch).toBe(`agent/preview-${n}`);
    expect(r.pullRequestTitle).toBe(`Preview for #${n}`);
    expect(r.ask).toMatchObject({ id: 'Select', behavior: 'close-on-escape', wanted: 'Keeps the list open on Escape' });
    expect(r.component.files).toContain('packages/react/src/components/Select/Select.tsx');
    expect(r.behavior?.id).toBe('close-on-escape');
    expect(r.brief).toContain(`git switch -C agent/preview-${n}`);
    expect(r.brief).toContain(`Never write "Closes #${n}"`);
    expect(r.brief).not.toMatch(/API key|ANTHROPIC/i);
    expect(record).toHaveBeenCalledWith({ number: n, state: 'preparing' });
    expect(r.recorded).toBe('preparing');
  });

  it('refuses what is not an open behavior request', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const bug = seed(gh, { kind: 'bug' });
    const closed = seed(gh, { state: 'closed' });
    const ctx = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch });
    await expect(behaviorPreview.makeBehaviorPreview(ctx, { number: bug })).rejects.toThrow(/not a behavior request/);
    await expect(behaviorPreview.makeBehaviorPreview(ctx, { number: closed })).rejects.toThrow(/closed/);
  });
});

describe('bridge_report_behavior_preview', () => {
  it('records through Bridge, after checking the report', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const n = seed(gh);
    const record = vi.fn(async () => ({ state: 'ready' as const, branch: `agent/preview-${n}`, pr: 80, round: 1 }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch, behaviorPreview: { record } });
    await expect(behaviorPreview.reportBehaviorPreview(ctx, { number: n, state: 'ready', branch: 'main', pr: 80 })).rejects.toThrow(/agent\/preview-/);
    expect(record).not.toHaveBeenCalled();
    const r = await behaviorPreview.reportBehaviorPreview(ctx, { number: n, state: 'ready', branch: `agent/preview-${n}`, pr: 80, sha: 'abc1234' });
    expect(record).toHaveBeenCalledWith({ number: n, state: 'ready', branch: `agent/preview-${n}`, pr: 80, sha: 'abc1234' });
    expect(r).toMatchObject({ status: 'recorded', preview: { state: 'ready', pr: 80 } });
  });

  it('a local server cannot record it: it says to connect Bridge in Claude', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const n = seed(gh);
    const ctx = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch });
    await expect(behaviorPreview.reportBehaviorPreview(ctx, { number: n, state: 'failed', reason: 'No checkout here.' })).rejects.toThrow(/connect Bridge in Claude/);
  });
});
