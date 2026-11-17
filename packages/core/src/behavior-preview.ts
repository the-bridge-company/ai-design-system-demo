// Claude's preview of a behavior request (phase 2): made by the person's own Claude through the Bridge connector, never
// by Bridge itself. Someone who can make it (the requester, the lead, a developer) asks their Claude "Make the Bridge
// preview for request #n": bridge_make_behavior_preview gives their Claude the request, the component's files and the
// rules (behaviorPreviewBrief); their Claude changes the component, its docs.json `behaviors` entry and adds a test
// that presses the keys, pushes the branch agent/preview-<n> and opens a draft pull request "Preview for #n" (never
// "Closes": a developer builds from it, or keeps it); then bridge_report_behavior_preview records it on the request.
// Bridge's server writes that record (one comment with a hidden block) with Bridge's own GitHub App, so Studio trusts
// only Bridge's blocks (parsePreviewState). The team's per-branch Storybook (bridge.config.json previews.apps.storybook)
// deploys the branch; Studio plays the same keys on today's story and on it. Pure, browser safe.

import { behaviorAskOf, type ComponentChangeRequest } from './requests';

/** The branch Claude's preview of request #n lives on. */
export const previewBranch = (n: number) => `agent/preview-${n}`;
/** The hidden block of the request's preview comment. */
export const PREVIEW_MARK = 'bridge-preview';
/** What the person says to their Claude, and what Studio copies for them. */
export const previewPhrase = (n: number, update = false) => `${update ? 'Update' : 'Make'} the Bridge preview for request #${n}`;

export type BehaviorPreviewKind = 'preparing' | 'ready' | 'failed';

export interface BehaviorPreviewState {
  state: BehaviorPreviewKind;
  /** agent/preview-<n>, once their Claude pushed. */
  branch?: string | undefined;
  /** The draft pull request "Preview for #n". */
  pr?: number | undefined;
  /** The head their Claude pushed. */
  sha?: string | undefined;
  /** 1 for the first preview, 2 and more when it was made again. */
  round?: number | undefined;
  /** The wanted sentence the preview was made from: when the requester changed it since, the preview is out of date. */
  wanted?: string | undefined;
  /** failed: why, in one sentence. */
  reason?: string | undefined;
  /** Who made it (a name), and when. */
  by?: string | undefined;
  at?: string | undefined;
}

const KINDS: readonly BehaviorPreviewKind[] = ['preparing', 'ready', 'failed'];

/** A comment as GitHub lists it: its body and its author. */
export interface PreviewComment {
  body?: string | null;
  user?: { login?: string | null; type?: string | null } | null;
}

/**
 * Bridge's own comments: written by Bridge's GitHub App (its bot account, "bridge-…[bot]"). A block anyone else wrote
 * (a person by hand, another app, github-actions[bot]) is never read.
 */
export const isBridgeAppComment = (c: PreviewComment): boolean => {
  const login = (c.user?.login ?? '').toLowerCase();
  return c.user?.type === 'Bot' && /^bridge[a-z0-9-]*\[bot\]$/.test(login);
};

/** The preview state the comments of a request say (Bridge's latest block wins), or null without one. */
export function parsePreviewState(comments: readonly PreviewComment[]): BehaviorPreviewState | null {
  for (const c of [...comments].reverse()) {
    if (!isBridgeAppComment(c)) continue;
    const m = new RegExp(`<!-- ${PREVIEW_MARK} (\\{[\\s\\S]*?\\}) -->`).exec(c.body ?? '');
    if (!m) continue;
    try {
      const o = JSON.parse(m[1]!) as Record<string, unknown>;
      if (!KINDS.includes(o.state as BehaviorPreviewKind)) continue;
      const text = (k: string, max = 300) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim().slice(0, max) : undefined);
      const num = (k: string) => (typeof o[k] === 'number' && Number.isInteger(o[k]) && (o[k] as number) > 0 ? (o[k] as number) : undefined);
      const branch = text('branch');
      const sha = text('sha');
      return {
        state: o.state as BehaviorPreviewKind,
        ...(branch && /^agent\/preview-\d+$/.test(branch) ? { branch } : {}),
        ...(num('pr') ? { pr: num('pr') } : {}),
        ...(sha && /^[0-9a-f]{7,40}$/.test(sha) ? { sha } : {}),
        ...(num('round') ? { round: num('round') } : {}),
        ...(text('wanted', 1000) ? { wanted: text('wanted', 1000) } : {}),
        ...(text('reason') ? { reason: text('reason') } : {}),
        ...(text('by', 80) ? { by: text('by', 80) } : {}),
        ...(text('at', 40) ? { at: text('at', 40) } : {}),
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Problems with a preview report, as sentences that say how to fix them. Empty when it can be recorded. */
export function previewReportProblems(n: number, r: { state: string; branch?: string | undefined; pr?: number | undefined; sha?: string | undefined; reason?: string | undefined }): string[] {
  if (r.state === 'preparing') return [];
  if (r.state === 'failed') return r.reason?.trim() ? [] : ['Say why the preview could not be made, in one sentence.'];
  if (r.state !== 'ready') return ['The state is preparing, ready or failed.'];
  const out: string[] = [];
  if (r.branch !== previewBranch(n)) out.push(`Push the preview to the branch ${previewBranch(n)}.`);
  if (!r.pr || !Number.isInteger(r.pr) || r.pr < 1) out.push(`Open the draft pull request "Preview for #${n}" and give its number.`);
  if (r.sha !== undefined && !/^[0-9a-f]{7,40}$/.test(r.sha)) out.push('Give the commit you pushed (its sha).');
  return out;
}

/** The line and the hidden block of the record Bridge's server writes (api/contribute keeps an equal copy). */
export function behaviorPreviewComment(s: BehaviorPreviewState): string {
  const line = s.state === 'ready' ? `Claude's preview is ready${s.pr ? ` in #${s.pr}` : ''}.` : s.state === 'failed' ? `Claude could not make the preview: ${(s.reason ?? '').replace(/[.]+$/, '')}.` : 'Claude is preparing the preview.';
  return [line, '', `<!-- ${PREVIEW_MARK} ${JSON.stringify(s).replace(/>/g, '\\u003e')} -->`].join('\n');
}

export interface BehaviorPreviewFacts {
  /** The component's files, repo-relative, that exist. */
  files?: string[] | undefined;
  /** Its docs.json, repo-relative. */
  docsPath?: string | undefined;
  /** The behavior's keys today, from its docs.json. */
  keys?: string[] | undefined;
  /** The agent rules file (AGENTS.md). */
  agentsFile?: string | undefined;
  /** The default branch the preview starts from. */
  defaultBranch?: string | undefined;
}

/**
 * What the person's Claude is told by bridge_make_behavior_preview: the request, then what to change, the branch, the
 * draft pull request, and how to tell Bridge. Empty when the request carries no readable behavior ask.
 */
export function behaviorPreviewBrief(r: ComponentChangeRequest, n: number, f: BehaviorPreviewFacts = {}): string {
  const ask = behaviorAskOf(r);
  if (!ask) return '';
  const pattern = ask.of === 'pattern';
  const base = f.defaultBranch ?? 'main';
  const branch = previewBranch(n);
  return [
    `Make Claude's preview of Bridge behavior request #${n}, so the design system lead can try it before deciding.`,
    '',
    pattern ? `Pattern: ${ask.id} (patterns/${ask.id}.pattern.json)` : `Component: ${ask.id}`,
    `${pattern ? 'Rule' : 'Behavior'}: ${pattern ? (ask.rule !== undefined ? `Rule ${ask.rule + 1}` : 'a new rule') : (ask.behavior ?? 'a new behavior')}${f.keys?.length ? ` (keys: ${f.keys.join(', ')})` : ''}`,
    `Today: ${ask.today || '(it does not do this yet)'}`,
    `Wanted: ${ask.wanted}`,
    ...(ask.where ? [`Where it gets in the way: ${ask.where}`] : []),
    ...(f.files?.length ? ['', 'Files:', ...f.files.map((x) => `- ${x}`)] : []),
    '',
    'Do:',
    `1. From an up-to-date ${base}, switch to a new branch ${branch} (git fetch origin && git switch -C ${branch} origin/${base}).`,
    pattern
      ? `2. Change the product so the pattern does what "Wanted" says, and update the rule in patterns/${ask.id}.pattern.json.`
      : `2. Change ${ask.id} so it does what "Wanted" says. Keep every other behavior as it is; use what its Base UI primitive offers before writing your own handling; do not add or rename props unless the change cannot be made without one.`,
    pattern
      ? '3. Keep the places the pattern lists in usedIn doing the same.'
      : `3. Update its \`behaviors\` entry${ask.behavior ? ` \`${ask.behavior}\`` : ''} in ${f.docsPath ?? 'its docs.json'}: the text says the new behavior, the keys are the keys that do it. Keep the id when the meaning stays; when the meaning changes, give it a new kebab-case id.`,
    `4. Add a test next to its other tests that ${f.keys?.length ? `presses ${f.keys.join(', ')}` : 'presses the keys that do it'} and checks the new behavior. Run it.`,
    '5. Add a changeset for the package you changed (a patch, one sentence saying the new behavior), as AGENTS.md asks of every change.',
    `6. Commit, push ${branch}, and open a draft pull request titled "Preview for #${n}" (gh pr create --draft --base ${base} --title "Preview for #${n}"). Never write "Closes #${n}": it is a preview, a developer builds from it or keeps it.`,
    `7. Tell Bridge: bridge_report_behavior_preview with number ${n}, state "ready", branch "${branch}", the pull request number and the commit sha. If it cannot be done, report state "failed" with the reason in one sentence, and push nothing.`,
    '',
    'Rules:',
    `- Follow ${f.agentsFile ?? 'AGENTS.md'}. Touch only the component (or the pattern), its docs.json, its tests, its stories and the changeset: never CI, workflows or package files.`,
    `- If something is unclear, ask the person instead of guessing.`,
  ].join('\n');
}
