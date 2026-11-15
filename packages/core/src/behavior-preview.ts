// Claude's preview of a behavior request (phase 2, PR 3): a workflow in the team's repository runs Claude Code on the
// request, with the team's own ANTHROPIC_API_KEY secret, on the branch agent/preview-<n>: the component's code, its
// docs.json `behaviors` entry and a test that presses the keys. It opens (or updates) a draft pull request "Preview for
// #n" (never "Closes": a developer builds from it, or keeps it) and keeps one comment on the request up to date, in a
// hidden block Studio reads (parsePreviewState): preparing, ready (branch, pull request, head, round), failed (why), or
// no-key (the secret is missing: said once, nothing else runs). The team's per-branch Storybook (bridge.config.json
// previews.apps.storybook, previews.ts) deploys the branch; Studio plays the same keys on today's story and on it.
//
// One generator for every place that writes the workflow, as the measure does (measure-workflow.ts): Studio Settings
// ("Turn on Claude's previews", a pull request), templates/bridge-behavior-preview.yml and the CLI. Pure, browser safe.

import { BEHAVIOR_REQUEST_LABEL } from './requests';

/** Where the workflow lives in the team's repository. */
export const BEHAVIOR_PREVIEW_WORKFLOW_FILE = '.github/workflows/bridge-behavior-preview.yml';
/** The branch Claude's preview of request #n lives on. */
export const previewBranch = (n: number) => `agent/preview-${n}`;
/** The hidden block of the request's preview comment. */
export const PREVIEW_MARK = 'bridge-preview';
/** Claude Code, pinned: the workflow runs this version. */
export const PREVIEW_CLAUDE_CODE = '@anthropic-ai/claude-code@2.1.315';
/** The words of the setup action, in Studio and in the comment that asks for the secret. */
export const PREVIEW_SETUP_ACTION = "Turn on Claude's previews";

export type BehaviorPreviewKind = 'preparing' | 'ready' | 'failed' | 'no-key';

export interface BehaviorPreviewState {
  state: BehaviorPreviewKind;
  /** agent/preview-<n>, once Claude pushed. */
  branch?: string | undefined;
  /** The draft pull request "Preview for #n". */
  pr?: number | undefined;
  /** The head Claude pushed. */
  sha?: string | undefined;
  /** 1 for the first preview, 2 and more after the requester changed her words. */
  round?: number | undefined;
  /** failed: why, in one sentence. */
  reason?: string | undefined;
  at?: string | undefined;
}

const KINDS: readonly BehaviorPreviewKind[] = ['preparing', 'ready', 'failed', 'no-key'];

/** Who writes the preview blocks: the workflow, as GitHub Actions. A block anyone else posts is never read. */
export const PREVIEW_AUTHOR = 'github-actions[bot]';

/** The preview state the comments of a request say (the latest block the workflow wrote wins), or null without one. */
export function parsePreviewState(comments: readonly { body?: string | null; user?: { login?: string | null } | null }[]): BehaviorPreviewState | null {
  for (const c of [...comments].reverse()) {
    if (c.user?.login !== PREVIEW_AUTHOR) continue;
    const m = new RegExp(`<!-- ${PREVIEW_MARK} (\\{[\\s\\S]*?\\}) -->`).exec(c.body ?? '');
    if (!m) continue;
    try {
      const o = JSON.parse(m[1]!) as Record<string, unknown>;
      if (!KINDS.includes(o.state as BehaviorPreviewKind)) continue;
      const text = (k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim() : undefined);
      const num = (k: string) => (typeof o[k] === 'number' && Number.isInteger(o[k]) && (o[k] as number) > 0 ? (o[k] as number) : undefined);
      const branch = text('branch');
      return {
        state: o.state as BehaviorPreviewKind,
        ...(branch && /^agent\/preview-\d+$/.test(branch) ? { branch } : {}),
        ...(num('pr') ? { pr: num('pr') } : {}),
        ...(text('sha') && /^[0-9a-f]{7,40}$/.test(text('sha')!) ? { sha: text('sha') } : {}),
        ...(num('round') ? { round: num('round') } : {}),
        ...(text('reason') ? { reason: text('reason')!.slice(0, 300) } : {}),
        ...(text('at') ? { at: text('at') } : {}),
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** What Claude is told to do, before the request's own lines (the workflow adds them from the issue). */
export const PREVIEW_INSTRUCTIONS = [
  "You make a preview of a behavior request in this design system's repository, for the design system lead to try before deciding.",
  'Do:',
  '1. Change the component (or the pattern) so it does what "Wanted" says. Keep every other behavior as it is. Use what its Base UI primitive offers before writing your own handling. Do not add or rename props unless the change cannot be made without one.',
  "2. Update its docs.json `behaviors` entry: the text says the new behavior, the keys are the keys that do it. Keep the id when the meaning stays; when the meaning changes, give it a new kebab-case id. For a pattern, update the rule in patterns/<id>.pattern.json.",
  "3. Add a test next to the component's other tests that presses the keys and checks the new behavior.",
  'Do not commit, push or open a pull request: the workflow does it. Do not touch CI, workflows, package files or anything outside the component, its docs.json, its tests and its stories.',
  'If the request cannot be done as written, change nothing and explain why in one sentence as your last line, starting with "Cannot:".',
].join('\n');

export interface PreviewWorkflowOptions {
  /** The default branch the preview starts from. Default main. */
  defaultBranch?: string | undefined;
}

/**
 * The workflow file: on a behavior request opened or edited (the requester changed her words) and on a comment of
 * its requester, it runs Claude Code on agent/preview-<n>, pushes, opens or updates the draft pull request, and keeps
 * the request's preview comment. Without the ANTHROPIC_API_KEY secret it says so once on the request, and stops.
 */
export function behaviorPreviewWorkflowYaml(o: PreviewWorkflowOptions = {}): string {
  const base = o.defaultBranch?.trim() || 'main';
  const instructions = PREVIEW_INSTRUCTIONS.split('\n')
    .map((l) => `            ${l}`)
    .join('\n');
  return `# Bridge: Claude's preview of behavior requests. Generated by Bridge (Studio, Settings, Claude, ${PREVIEW_SETUP_ACTION},
# or templates/bridge-behavior-preview.yml): edit it there, not here.
#
# When someone asks to change how a component behaves (an issue labelled "${BEHAVIOR_REQUEST_LABEL}"), Claude Code makes the
# change on the branch ${previewBranch(0).replace('0', '<n>')}: the component, its docs.json behaviors entry and a test that presses the
# keys. It opens a draft pull request "Preview for #<n>" (it never closes the request: a developer builds from it), and
# keeps one comment on the request that Bridge Studio reads. Your per-branch Storybook deploys the branch, and the
# request page plays the same keys on today's component and on the preview.
#
# Runs again when the requester edits her words, or comments on the request.
#
# Secret: ANTHROPIC_API_KEY (your own Anthropic API key), in Settings, Secrets and variables, Actions. Without it, one
# comment on the request says so, and nothing else runs. Token: the run's GITHUB_TOKEN, to push the preview branch,
# open its draft pull request and comment. Your default branch is never written.

name: Bridge behavior preview

on:
  issues:
    types: [opened, edited, labeled]
  issue_comment:
    types: [created]

concurrency:
  group: bridge-behavior-preview-\${{ github.event.issue.number }}
  cancel-in-progress: true

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  preview:
    if: >-
      contains(github.event.issue.labels.*.name, '${BEHAVIOR_REQUEST_LABEL}') &&
      !contains(github.event.issue.labels.*.name, 'bridge-build') &&
      github.event.issue.state == 'open' && !github.event.issue.pull_request
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      HAS_KEY: \${{ secrets.ANTHROPIC_API_KEY != '' }}
      BRANCH: agent/preview-\${{ github.event.issue.number }}
    steps:
      - name: Read the request
        id: req
        uses: actions/github-script@v7
        env:
          INSTRUCTIONS: |-
${instructions}
        with:
          script: |
            const issue = context.payload.issue;
            const n = issue.number;
            // Only the team's own requests spend the team's key: filed by someone with access, or by Bridge's app for a member.
            if (issue.user.type !== 'Bot' && !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.author_association)) return core.setOutput('skip', 'true');
            const MARK = '${PREVIEW_MARK}';
            const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: n, per_page: 100 });
            const mine = comments.filter((c) => c.user && c.user.login === 'github-actions[bot]' && (c.body || '').includes('<!-- ' + MARK + ' '));
            const last = mine.length ? JSON.parse(/<!-- bridge-preview (\\{[\\s\\S]*?\\}) -->/.exec(mine[mine.length - 1].body)[1]) : null;
            // A comment: only the requester's. Someone who joined by email comments through Bridge's app, whose own
            // words (a decision, a question) never count: theirs start with "**<their name>** (via Bridge):".
            let extra = '';
            if (context.eventName === 'issue_comment') {
              const c = context.payload.comment;
              const text = String(c.body || '');
              if (text.includes('<!-- ' + MARK + ' ')) return core.setOutput('skip', 'true');
              if (issue.user.type === 'Bot') {
                const by = /Requested by (.+?)(?: \\([^)]*\\))? through Bridge\\./.exec(issue.body || '');
                const said = /^\\*\\*([^*]+)\\*\\* \\(via Bridge\\):\\s*/.exec(text);
                if (!by || !said || said[1].trim() !== by[1].trim()) return core.setOutput('skip', 'true');
                extra = text.slice(said[0].length).trim();
              } else if (c.user.login !== issue.user.login) return core.setOutput('skip', 'true');
              else extra = text.trim();
            }
            const block = /<!-- bridge-request (\\{[\\s\\S]*?\\}) -->/.exec(issue.body || '');
            const req = block ? JSON.parse(block[1]) : null;
            const ask = req && req.kind === 'behavior' ? req.behavior : null;
            if (!ask || !ask.wanted) return core.setOutput('skip', 'true');
            // Same words as the last preview: nothing to do (an edit that did not change them, a label).
            const key = JSON.stringify([ask.of, ask.id, ask.behavior || null, ask.rule ?? null, ask.today, ask.wanted, ask.where || null, extra]);
            if (last && last.key === key && last.state === 'ready') return core.setOutput('skip', 'true');
            // Round 2 and more: the requester changed her words after a preview was ready.
            const round = !last || !last.round ? 1 : last.state === 'ready' ? last.round + 1 : last.round;
            const write = async (state) => {
              const body = [state.line, '', '<!-- ' + MARK + ' ' + JSON.stringify({ ...state.data, key, at: new Date().toISOString() }) + ' -->'].join('\\n');
              if (mine.length) await github.rest.issues.updateComment({ ...context.repo, comment_id: mine[mine.length - 1].id, body });
              else await github.rest.issues.createComment({ ...context.repo, issue_number: n, body });
            };
            if (process.env.HAS_KEY !== 'true') {
              if (!last || last.state !== 'no-key') await write({ line: "Claude's preview is off: add the ANTHROPIC_API_KEY secret to this repository (Settings, Secrets and variables, Actions).", data: { state: 'no-key' } });
              return core.setOutput('skip', 'true');
            }
            await write({ line: 'Claude is preparing the preview.', data: { state: 'preparing', round } });
            const lines = [
              process.env.INSTRUCTIONS,
              '',
              ask.of === 'pattern' ? 'Pattern: ' + ask.id + ' (patterns/' + ask.id + '.pattern.json)' : 'Component: ' + ask.id,
              ask.of === 'pattern' ? 'Rule: ' + (ask.rule !== undefined ? 'Rule ' + (ask.rule + 1) : 'a new rule') : 'Behavior: ' + (ask.behavior || 'a new behavior'),
              'Today: ' + (ask.today || '(it does not do this yet)'),
              'Wanted: ' + ask.wanted,
              ...(ask.where ? ['Where it gets in the way: ' + ask.where] : []),
              ...(extra ? ['', 'The requester added: ' + extra] : []),
            ];
            core.setOutput('prompt', lines.join('\\n'));
            core.setOutput('round', String(round));
            core.setOutput('key', key);

      - uses: actions/checkout@v4
        if: steps.req.outputs.skip != 'true'
        with:
          ref: ${base}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        if: steps.req.outputs.skip != 'true'
        with:
          node-version: 22

      - name: Claude makes the change
        id: claude
        if: steps.req.outputs.skip != 'true'
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          PROMPT: \${{ steps.req.outputs.prompt }}
        run: |
          git checkout -B "$BRANCH"
          npm ci --ignore-scripts
          npx -y ${PREVIEW_CLAUDE_CODE} -p "$PROMPT" --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Glob,Grep" > claude.txt
          tail -n 1 claude.txt | grep -q '^Cannot:' && { echo "reason=$(tail -n 1 claude.txt | cut -c1-280)" >> "$GITHUB_OUTPUT"; exit 1; } || true
          rm -f claude.txt
          git add -A -- . ':!.github' ':!package.json' ':!package-lock.json'
          git -c user.name="Bridge preview" -c user.email="bridge-preview@users.noreply.github.com" commit -m "Preview for #\${{ github.event.issue.number }}" || { echo "reason=Claude changed nothing." >> "$GITHUB_OUTPUT"; exit 1; }
          git push --force origin "$BRANCH"
          echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

      - name: Open the draft pull request, say it is ready
        if: steps.req.outputs.skip != 'true' && success()
        uses: actions/github-script@v7
        env:
          SHA: \${{ steps.claude.outputs.sha }}
          ROUND: \${{ steps.req.outputs.round }}
          KEY: \${{ steps.req.outputs.key }}
        with:
          script: |
            const n = context.payload.issue.number;
            const branch = process.env.BRANCH;
            const open = await github.rest.pulls.list({ ...context.repo, head: context.repo.owner + ':' + branch, state: 'open' });
            const body = 'Preview for #' + n + ', made by Claude from the request. A developer builds from it or keeps it: it does not close the request.';
            const pr = open.data[0] ?? (await github.rest.pulls.create({ ...context.repo, head: branch, base: '${base}', title: 'Preview for #' + n, body, draft: true })).data;
            const data = { state: 'ready', branch, pr: pr.number, sha: process.env.SHA, round: Number(process.env.ROUND) || 1, key: process.env.KEY, at: new Date().toISOString() };
            const text = ["Claude's preview is ready.", '', '<!-- ${PREVIEW_MARK} ' + JSON.stringify(data) + ' -->'].join('\\n');
            const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: n, per_page: 100 });
            const mine = comments.filter((c) => c.user && c.user.login === 'github-actions[bot]' && (c.body || '').includes('<!-- ${PREVIEW_MARK} '));
            if (mine.length) await github.rest.issues.updateComment({ ...context.repo, comment_id: mine[mine.length - 1].id, body: text });
            else await github.rest.issues.createComment({ ...context.repo, issue_number: n, body: text });

      - name: Say it failed
        if: steps.req.outputs.skip != 'true' && failure()
        uses: actions/github-script@v7
        env:
          REASON: \${{ steps.claude.outputs.reason }}
          ROUND: \${{ steps.req.outputs.round }}
          KEY: \${{ steps.req.outputs.key }}
        with:
          script: |
            const n = context.payload.issue.number;
            const reason = (process.env.REASON || 'The run stopped before the preview was ready.').replace(/^Cannot:\\s*/, '');
            const data = { state: 'failed', reason, round: Number(process.env.ROUND) || 1, key: process.env.KEY, at: new Date().toISOString() };
            const text = ["Claude's preview could not be made: " + reason, '', '<!-- ${PREVIEW_MARK} ' + JSON.stringify(data) + ' -->'].join('\\n');
            const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: n, per_page: 100 });
            const mine = comments.filter((c) => c.user && c.user.login === 'github-actions[bot]' && (c.body || '').includes('<!-- ${PREVIEW_MARK} '));
            if (mine.length) await github.rest.issues.updateComment({ ...context.repo, comment_id: mine[mine.length - 1].id, body: text });
            else await github.rest.issues.createComment({ ...context.repo, issue_number: n, body: text });
`;
}
