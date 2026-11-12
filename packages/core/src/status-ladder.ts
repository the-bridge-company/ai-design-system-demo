// The one status ladder of an exploration or a library change, in the order work moves through it. Every surface
// (Home cards, Explorations, Being built, product pages, the exploration page, Library review, the MCP server) names a
// piece of work with one of these words and nothing else. Who the work waits on ("Waiting for Sofia's check", "Asked
// by Leo") is a second line under the status, never a status of its own.
//
//   Exploring       a designer is trying it (also after the lead asked for changes)
//   In review       sent for review: the design lead, or Library review, decides what the library keeps
//   Ready to build  decided; nobody has picked it up to build it yet
//   Being built     a developer is building it
//   Checking        the developers' version waits for the designer's check, or passed it and ships next
//   Shipped         merged: in the library or the product
//
// Off the ladder, for work that stopped: Not doing this (closed or declined), Archived (kept for its preview).
// Pure: no DOM, no fetch. Unit tested in test/status-ladder.test.ts.

export type LadderStep = 'exploring' | 'in-review' | 'ready-to-build' | 'being-built' | 'checking' | 'shipped';
export type StoppedStep = 'not-doing' | 'archived';
export type StatusStep = LadderStep | StoppedStep;

/** The ladder, in order. */
export const LADDER: readonly LadderStep[] = ['exploring', 'in-review', 'ready-to-build', 'being-built', 'checking', 'shipped'];
/** Every status a piece of work can show, the ladder first. */
export const STATUS_STEPS: readonly StatusStep[] = [...LADDER, 'not-doing', 'archived'];

/** The tag of each status: the same word on every surface. */
export const STEP_LABEL: Record<StatusStep, string> = {
  exploring: 'Exploring',
  'in-review': 'In review',
  'ready-to-build': 'Ready to build',
  'being-built': 'Being built',
  checking: 'Checking',
  shipped: 'Shipped',
  'not-doing': 'Not doing this',
  archived: 'Archived',
};

/** The words of a count of each status, inside a sentence: "2 exploring, 1 ready to build, 4 being checked". */
export const STEP_COUNT_WORDS: Record<StatusStep, string> = {
  exploring: 'exploring',
  'in-review': 'in review',
  'ready-to-build': 'ready to build',
  'being-built': 'being built',
  checking: 'being checked',
  shipped: 'shipped',
  'not-doing': 'dropped',
  archived: 'archived',
};

/** "3 ready to build". */
export const stepCount = (n: number, step: StatusStep): string => `${n} ${STEP_COUNT_WORDS[step]}`;

/** Where a step sits on the ladder (0 = Exploring); stopped work sorts after Shipped. */
export const stepRank = (s: StatusStep): number => {
  const i = (LADDER as readonly string[]).indexOf(s);
  return i >= 0 ? i : LADDER.length + (s === 'not-doing' ? 0 : 1);
};

/** True for work still moving (not shipped, not stopped). */
export const isOpenStep = (s: StatusStep): boolean => stepRank(s) < LADDER.indexOf('shipped');

/**
 * Late: work that waits on someone for more than this many days (a week). The one threshold behind every warning
 * colour in Studio: a status tag turns amber only once its wait is late, never because it waits at all.
 */
export const LATE_DAYS = 7;

/** True once a wait of `days` (calendar days, exploration-resume calendarDays) is late. Unknown ages are never late. */
export const isLate = (days: number | null | undefined): boolean => typeof days === 'number' && Number.isFinite(days) && days > LATE_DAYS;

/** A build request's status (core BuildRequestView status) on the ladder. */
export function stepOfBuildStatus(status: string): StatusStep {
  switch (status) {
    case 'requested':
      return 'ready-to-build';
    case 'picked-up':
    case 'in-progress':
      return 'being-built';
    case 'in-review':
      return 'checking';
    case 'not-planned':
      return 'not-doing';
    default:
      return 'shipped';
  }
}
