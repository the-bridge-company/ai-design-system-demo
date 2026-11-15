// A behavior request decided by a design lead signed in by email (api/contribute action `behavior-decision`): Make it
// the default, Not now (with the reason) or a question to the requester. The lead has no GitHub login, so Bridge's app
// writes it and the comments name them. The server copy of core's words (requests.ts behaviorDefaultComment,
// declineComment, askRequesterComment, the labels and the reason's rule): the API does not import core; a test holds
// them equal. Pure.

export const REQUEST_LABEL = 'component-change';
export const BEHAVIOR_REQUEST_LABEL = 'request: behavior';
export const BUILD_REQUEST_LABEL = 'bridge-build';

export type BehaviorDecisionKind = 'default' | 'not-now' | 'ask';
export const BEHAVIOR_DECISIONS: readonly BehaviorDecisionKind[] = ['default', 'not-now', 'ask'];

/** Longest text kept (a reason, a question). */
export const BEHAVIOR_TEXT_MAX = 2000;

export const BEHAVIOR_DECISION_WORDS = {
  notLead: 'Only a design lead or an admin of the team decides on a behavior request.',
  notBehavior: 'This is not a behavior request of this team.',
  closed: 'This request is already closed.',
  decided: 'It is already the default: it waits for a developer in Being built.',
  noNumber: 'Bridge cannot find this request.',
  reasonEmpty: 'Say why, in one or two sentences: the requester reads it.',
  reasonShort: 'Say a bit more, so the requester knows why: at least 10 characters.',
  questionEmpty: 'Write your question first: the requester reads it.',
};

const quoted = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');

/** core behaviorDefaultComment({ name }). */
export const defaultCommentOf = (name: string): string => [`${name.trim()} made it the default in Bridge Studio.`, '', '<sub>It now waits for a developer in Being built (label `bridge-build`).</sub>'].join('\n');

/** core declineComment(reason, { name }). */
export const declineCommentOf = (reason: string, name: string): string =>
  [`Declined by ${name.trim()} in Bridge Studio.`, '', quoted(reason), '', '<sub>Closed as not planned. Reopen the issue if things change.</sub>'].join('\n');

/** core askRequesterComment(text, { name }, requester). */
export function askCommentOf(text: string, name: string, requester?: string | null): string {
  const to = requester && /^[A-Za-z0-9-]+$/.test(requester.replace(/^@/, '')) ? `@${requester.replace(/^@/, '')}` : '';
  return [`${name.trim()} asks${to ? ` ${to}` : ''}, before deciding:`, '', quoted(text)].join('\n');
}

/** core declineReasonProblems and askRequesterProblems, for the text the decision carries. Null when it may be sent. */
export function decisionTextProblem(kind: BehaviorDecisionKind, text: string): string | null {
  const t = text.trim();
  if (kind === 'not-now') return !t ? BEHAVIOR_DECISION_WORDS.reasonEmpty : t.length < 10 ? BEHAVIOR_DECISION_WORDS.reasonShort : null;
  if (kind === 'ask') return t ? null : BEHAVIOR_DECISION_WORDS.questionEmpty;
  return null;
}

const labelNames = (labels: unknown): string[] => (Array.isArray(labels) ? labels.map((l) => String(typeof l === 'string' ? l : (l as { name?: unknown })?.name ?? '').toLowerCase()) : []);

/**
 * What stops the decision on this issue, as GitHub returns it: not a behavior request (a pull request, no request
 * labels), closed, or already the default (for Make it the default). Null when the lead may decide.
 */
export function behaviorIssueProblem(issue: { pull_request?: unknown; state?: unknown; labels?: unknown } | null, kind: BehaviorDecisionKind): keyof typeof BEHAVIOR_DECISION_WORDS | null {
  if (!issue || issue.pull_request) return 'notBehavior';
  const l = labelNames(issue.labels);
  if (!l.includes(REQUEST_LABEL) || !l.includes(BEHAVIOR_REQUEST_LABEL)) return 'notBehavior';
  if (issue.state !== 'open') return 'closed';
  if (kind === 'default' && l.includes(BUILD_REQUEST_LABEL)) return 'decided';
  return null;
}

/** The requester's GitHub login in the request's Bridge block (core parseRequestIssue requestedBy), for the mention. */
export function requesterLoginOf(body: unknown): string | null {
  const m = /<!-- bridge-request (\{[\s\S]*?\}) -->/.exec(typeof body === 'string' ? body : '');
  if (!m) return null;
  try {
    const r = JSON.parse(m[1]!) as { requestedBy?: unknown };
    return typeof r.requestedBy === 'string' && /^[A-Za-z0-9-]{1,39}$/.test(r.requestedBy) ? r.requestedBy : null;
  } catch {
    return null;
  }
}
