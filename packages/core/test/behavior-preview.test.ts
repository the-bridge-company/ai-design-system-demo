// Claude's preview of a behavior request: one generator (behaviorPreviewWorkflowYaml) for Studio's "Turn on Claude's
// previews" and templates/bridge-behavior-preview.yml, and the preview comment the workflow keeps, read back by Studio.
// After changing the generator, run
//   BRIDGE_UPDATE_WORKFLOWS=1 npx vitest run --project core packages/core/test/behavior-preview.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { BEHAVIOR_PREVIEW_WORKFLOW_FILE, behaviorPreviewWorkflowYaml, parsePreviewState, PREVIEW_CLAUDE_CODE, previewBranch } from '../src/behavior-preview';

const ROOT = join(__dirname, '../../..');

describe('the template', () => {
  it("is the generator's output", () => {
    const yaml = behaviorPreviewWorkflowYaml();
    if (process.env.BRIDGE_UPDATE_WORKFLOWS) writeFileSync(join(ROOT, 'templates/bridge-behavior-preview.yml'), yaml);
    expect(readFileSync(join(ROOT, 'templates/bridge-behavior-preview.yml'), 'utf8')).toBe(yaml);
  });
});

describe('behaviorPreviewWorkflowYaml', () => {
  const wf = parse(behaviorPreviewWorkflowYaml({ defaultBranch: 'trunk' })) as {
    on: Record<string, { types: string[] }>;
    permissions: Record<string, string>;
    jobs: { preview: { if: string; env: Record<string, string>; steps: { name?: string; uses?: string; run?: string; with?: Record<string, string>; env?: Record<string, string> }[] } };
  };
  const steps = wf.jobs.preview.steps;

  it('runs on a behavior request opened or edited, and on a comment, never once it is the default', () => {
    expect(wf.on.issues!.types).toEqual(['opened', 'edited', 'labeled']);
    expect(wf.on.issue_comment!.types).toEqual(['created']);
    expect(wf.jobs.preview.if).toContain("'request: behavior'");
    expect(wf.jobs.preview.if).toContain("!contains(github.event.issue.labels.*.name, 'bridge-build')");
    expect(wf.permissions).toEqual({ contents: 'write', 'pull-requests': 'write', issues: 'write' });
  });

  it('uses the team key only in the step that runs Claude, never writes it, and works on agent/preview-<n>', () => {
    const yaml = behaviorPreviewWorkflowYaml();
    expect(yaml.match(/secrets\.ANTHROPIC_API_KEY/g)).toHaveLength(2); // HAS_KEY, and Claude's step
    const claude = steps.find((s) => s.name === 'Claude makes the change')!;
    expect(claude.env!.ANTHROPIC_API_KEY).toBe('${{ secrets.ANTHROPIC_API_KEY }}');
    expect(claude.run).toContain(`npx -y ${PREVIEW_CLAUDE_CODE} -p "$PROMPT"`);
    expect(claude.run).toContain('git push --force origin "$BRANCH"');
    expect(claude.run).not.toMatch(/echo .*ANTHROPIC/);
    expect(wf.jobs.preview.env.BRANCH).toBe('agent/preview-${{ github.event.issue.number }}');
    expect(previewBranch(12)).toBe('agent/preview-12');
    expect(steps.find((s) => s.uses === 'actions/checkout@v4')!.with!.ref).toBe('trunk');
  });

  it('opens a draft "Preview for #n" that never closes the request', () => {
    const ready = steps.find((s) => s.name === 'Open the draft pull request, say it is ready')!.with!.script!;
    expect(ready).toContain("title: 'Preview for #' + n");
    expect(ready).toContain('draft: true');
    expect(ready).not.toMatch(/Closes #/);
  });

  it('every script parses', () => {
    for (const s of steps) if (s.with?.script) expect(() => new Function('github', 'context', 'core', 'process', `return (async () => {${s.with!.script}})`)).not.toThrow();
    expect(BEHAVIOR_PREVIEW_WORKFLOW_FILE).toBe('.github/workflows/bridge-behavior-preview.yml');
    expect(behaviorPreviewWorkflowYaml()).not.toMatch(/\u2014/);
  });
});

describe('parsePreviewState', () => {
  const block = (o: unknown) => `Claude's preview is ready.\n\n<!-- bridge-preview ${JSON.stringify(o)} -->`;
  it('reads the latest preview comment', () => {
    expect(parsePreviewState([{ body: block({ state: 'preparing', round: 1 }) }, { body: 'Dana asks' }, { body: block({ state: 'ready', branch: 'agent/preview-75', pr: 80, sha: 'abc1234', round: 2, at: '2026-11-15T10:00:00Z' }) }])).toEqual({
      state: 'ready',
      branch: 'agent/preview-75',
      pr: 80,
      sha: 'abc1234',
      round: 2,
      at: '2026-11-15T10:00:00Z',
    });
    expect(parsePreviewState([{ body: block({ state: 'failed', reason: 'The component has no tests folder.' }) }])).toMatchObject({ state: 'failed', reason: 'The component has no tests folder.' });
  });

  it('keeps nothing it cannot trust', () => {
    expect(parsePreviewState([])).toBeNull();
    expect(parsePreviewState([{ body: block({ state: 'merged' }) }])).toBeNull();
    expect(parsePreviewState([{ body: block({ state: 'ready', branch: 'main', sha: 'x"><script>' }) }])).toEqual({ state: 'ready' });
  });
});
