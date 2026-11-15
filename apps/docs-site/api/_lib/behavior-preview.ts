// Claude's preview of a behavior request, recorded by Bridge (api/contribute action `behavior-preview`): the person's
// own Claude made it through the Bridge connector (bridge_make_behavior_preview) and reports it
// (bridge_report_behavior_preview); Bridge's server writes the record, one comment on the request kept up to date, with
// Bridge's own GitHub App, so Studio reads only Bridge's blocks. The server copy of core's words (behavior-preview.ts
// previewBranch, previewReportProblems, behaviorPreviewComment): the API does not import core; a test holds them equal.

export const PREVIEW_MARK = 'bridge-preview';
export const previewBranch = (n: number) => `agent/preview-${n}`;
export type PreviewKind = 'preparing' | 'ready' | 'failed';
export const PREVIEW_KINDS: readonly PreviewKind[] = ['preparing', 'ready', 'failed'];

export interface PreviewBlock {
  state: PreviewKind;
  branch?: string;
  pr?: number;
  sha?: string;
  round?: number;
  wanted?: string;
  reason?: string;
  by?: string;
  at?: string;
}

export const PREVIEW_WORDS = {
  notMember: 'Only someone on the team records a preview of its requests.',
  noPull: (n: number) => `Bridge cannot find the open draft pull request "Preview for #${n}" on ${previewBranch(n)}.`,
} as const;

/** core previewReportProblems. */
export function previewProblems(n: number, r: { state: unknown; branch?: unknown; pr?: unknown; sha?: unknown; reason?: unknown }): string[] {
  if (r.state === 'preparing') return [];
  if (r.state === 'failed') return typeof r.reason === 'string' && r.reason.trim() ? [] : ['Say why the preview could not be made, in one sentence.'];
  if (r.state !== 'ready') return ['The state is preparing, ready or failed.'];
  const out: string[] = [];
  if (r.branch !== previewBranch(n)) out.push(`Push the preview to the branch ${previewBranch(n)}.`);
  if (typeof r.pr !== 'number' || !Number.isInteger(r.pr) || r.pr < 1) out.push(`Open the draft pull request "Preview for #${n}" and give its number.`);
  if (r.sha !== undefined && !(typeof r.sha === 'string' && /^[0-9a-f]{7,40}$/.test(r.sha))) out.push('Give the commit you pushed (its sha).');
  return out;
}

/** core behaviorPreviewComment. */
export function previewCommentOf(s: PreviewBlock): string {
  const line = s.state === 'ready' ? `Claude's preview is ready${s.pr ? ` in #${s.pr}` : ''}.` : s.state === 'failed' ? `Claude could not make the preview: ${(s.reason ?? '').replace(/[.]+$/, '')}.` : 'Claude is preparing the preview.';
  return [line, '', `<!-- ${PREVIEW_MARK} ${JSON.stringify(s).replace(/>/g, '\\u003e')} -->`].join('\n');
}

/** A comment Bridge's app wrote (its bot account): core isBridgeAppComment. */
export const isBridgeComment = (c: { user?: { login?: string | null; type?: string | null } | null }) => c.user?.type === 'Bot' && /^bridge[a-z0-9-]*\[bot\]$/.test((c.user?.login ?? '').toLowerCase());

/** The blocks Bridge wrote on a request, oldest first, with their comment ids. */
export function previewBlocksOf(comments: readonly { id?: number; body?: string | null; user?: { login?: string | null; type?: string | null } | null }[]): { id: number; block: PreviewBlock }[] {
  const out: { id: number; block: PreviewBlock }[] = [];
  for (const c of comments) {
    if (!isBridgeComment(c) || typeof c.id !== 'number') continue;
    const m = /<!-- bridge-preview (\{[\s\S]*?\}) -->/.exec(c.body ?? '');
    if (!m) continue;
    try {
      const b = JSON.parse(m[1]!) as PreviewBlock;
      if (PREVIEW_KINDS.includes(b.state)) out.push({ id: c.id, block: b });
    } catch {
      /* not one of ours after all */
    }
  }
  return out;
}

/** The wanted sentence of a behavior request's Bridge block (core behaviorAskOf), or null. */
export function wantedOf(body: unknown): string | null {
  const m = /<!-- bridge-request (\{[\s\S]*?\}) -->/.exec(typeof body === 'string' ? body : '');
  if (!m) return null;
  try {
    const r = JSON.parse(m[1]!) as { kind?: unknown; behavior?: { wanted?: unknown } };
    return r.kind === 'behavior' && typeof r.behavior?.wanted === 'string' && r.behavior.wanted.trim() ? r.behavior.wanted.trim().slice(0, 1000) : null;
  } catch {
    return null;
  }
}
