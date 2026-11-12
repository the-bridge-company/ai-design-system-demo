// The two counts of what waits on the viewer, one source each (owner rule "one source", 2026-11-09), pure:
//   - explorations: what the Explorations page pins as "Waiting on you" (the lead's turn, a review asked, a question
//     from the developers, the PM's build check; never the PM's optional opinion). Its nav badge is on Explorations.
//   - library: the pieces waiting on the lead, Library review's own count with its own loader and rule
//     (scripts/library-waiting). Its nav badge is on Library review.
// Home's Needs you rows of an exploration are keyed by exploration (explorationOfNeed). Home, Explorations and the nav
// read and write the same remembered sets (scripts/waiting-counts.ts), so the three never say two numbers. Tested in
// waiting-counts.test.ts.
import type { NeedRow } from './home-model';

/** One exploration, wherever it lives: "<product>#<number>", the product empty in the design system's repository. */
export const explorationKey = (number: number, product?: string | null): string => `${(product ?? '').toLowerCase()}#${number}`;

/** The exploration a Home row waits on, or null for a library row (or anything else). */
export function explorationOfNeed(row: Pick<NeedRow, 'key'>): string | null {
  const review = /^exploration-review-(?:([^#]+)#)?(\d+)$/.exec(row.key);
  if (review) return explorationKey(Number(review[2]), review[1] ?? null);
  const question = /^dev-question-([^#]*)#(\d+)$/.exec(row.key);
  if (question) return explorationKey(Number(question[2]), question[1] || null);
  return null;
}

/**
 * One Needs you row per exploration: a viewer asked twice about one exploration (a lead who is also its product
 * manager: "Sofia is done exploring" and "Sofia would like your opinion") gets the first row, which the exploration
 * page answers both from. Library rows stay as they are. So Home lists what the Explorations badge counts.
 */
export function onePerExploration<R extends Pick<NeedRow, 'key'>>(rows: readonly R[]): R[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = explorationOfNeed(r);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** What one exploration waits on the viewer for, as Home words it ("Leo asked you a question"). */
export interface WaitingExploration {
  key: string;
  line: string;
}

/** The explorations of Home's Needs you list that wait on the viewer, once each, with Home's words. */
export function waitingCounts(needs: readonly NeedRow[]): { explorations: WaitingExploration[] } {
  const explorations: WaitingExploration[] = [];
  for (const r of needs) {
    // An optional ask (a product manager's opinion) never waits on them: no badge, not pinned as "Waiting on you".
    if (r.optional) continue;
    const key = explorationOfNeed(r);
    if (key && !explorations.some((e) => e.key === key)) explorations.push({ key, line: r.line });
  }
  return { explorations };
}

/**
 * The explorations that wait on the viewer on the Explorations page: its own rows' turn (the list's rule) and what
 * Home found that the list cannot read (a question on the developers' task, the PM's word), once each.
 */
export function mergeWaiting(own: readonly WaitingExploration[], home: readonly WaitingExploration[] | null, listed: ReadonlySet<string>): WaitingExploration[] {
  const out = [...own];
  for (const h of home ?? []) if (listed.has(h.key) && !out.some((o) => o.key === h.key)) out.push(h);
  return out;
}
