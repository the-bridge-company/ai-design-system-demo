// The two counts of what waits on the viewer, one source each (owner rule "one source", 2026-11-09), pure:
//   - explorations: what the Explorations page pins as "Waiting on you" (the lead's turn, a review asked, a question
//     from the developers, the PM's word). Its nav badge is on Explorations.
//   - library: the pieces waiting on the lead (Library review, phase 1). Its nav badge is on Library review.
// Home's Needs you list holds both: its exploration rows are keyed by exploration (explorationNeedKey), the rest is
// the library's. Home, Explorations and the nav read and write the same remembered sets (scripts/waiting-counts.ts),
// so the three never say two numbers. Tested in waiting-counts.test.ts.
import { badgeRows, type NeedRow } from './home-model';

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

/** What one exploration waits on the viewer for, as Home words it ("Leo asked you a question"). */
export interface WaitingExploration {
  key: string;
  line: string;
}

/** Home's Needs you list as the two sources: the explorations that wait (once each), and the library count. */
export function waitingCounts(needs: readonly NeedRow[]): { explorations: WaitingExploration[]; library: number } {
  const explorations: WaitingExploration[] = [];
  const rest: NeedRow[] = [];
  for (const r of needs) {
    const key = explorationOfNeed(r);
    if (!key) rest.push(r);
    else if (!explorations.some((e) => e.key === key)) explorations.push({ key, line: r.line });
  }
  return { explorations, library: badgeRows(rest) };
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
