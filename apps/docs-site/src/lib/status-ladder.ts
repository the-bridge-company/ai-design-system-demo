// Studio's side of the one status ladder (core status-ladder.ts: Exploring, In review, Ready to build, Being built,
// Checking, Shipped; off the ladder Not doing this, Archived). Every surface maps its own reading of a piece of work
// (the lifecycle stage of lib/review-state, a build request's status, the Explorations page's row) to one step here
// and shows that step's word and tone. Who the work waits on is the second line (waitLine), never the tag.
// Pure: no DOM, no fetch. Unit tested in status-ladder.test.ts.
import { isLate, STEP_LABEL, type StatusStep } from '@bridge-ds/core';
import type { LifecycleStage } from './review-state';

export { LADDER, STATUS_STEPS, STEP_LABEL, STEP_COUNT_WORDS, stepCount, stepRank, isOpenStep, stepOfBuildStatus, LATE_DAYS, isLate, type LadderStep, type StatusStep } from '@bridge-ds/core';

/**
 * A lifecycle stage on the ladder. Stage 'in-review' is the developers' version waiting for the designer's check
 * (Checking), unless the exploration was sent to Library review without a hand-off (`promoted`: In review). Approved,
 * waiting to ship, is still Checking (its second line says it looks right); in the next release is Shipped.
 */
export function stepOfStage(stage: LifecycleStage, opts: { promoted?: boolean } = {}): StatusStep {
  switch (stage) {
    case 'exploring':
      return 'exploring';
    case 'waiting-for-lead':
      return 'in-review';
    case 'waiting-for-code':
      return 'ready-to-build';
    case 'being-built':
      return 'being-built';
    case 'in-review':
      return opts.promoted ? 'in-review' : 'checking';
    case 'approved':
      return 'checking';
    case 'next-release':
    case 'shipped':
      return 'shipped';
    case 'archived':
      return 'archived';
    case 'closed':
    case 'not-planned':
      return 'not-doing';
  }
}

/** The word of a lifecycle stage: its step's. */
export const stageWord = (stage: LifecycleStage, opts: { promoted?: boolean } = {}): string => STEP_LABEL[stepOfStage(stage, opts)];

/** The DS Badge tones a status tag can take. */
export type StepTone = 'neutral' | 'info' | 'warning' | 'success';

/**
 * The tone of a status tag, from its step and how long it has waited (days, when known): Harbor (info) while someone
 * works on it (Exploring, Being built), green once Shipped, grey for a calm wait (In review, Ready to build, Checking)
 * and for stopped work. Amber (warning) only once a wait is late: more than LATE_DAYS days.
 */
export function stepTone(step: StatusStep, waitedDays?: number | null): StepTone {
  switch (step) {
    case 'exploring':
    case 'being-built':
      return 'info';
    case 'shipped':
      return 'success';
    case 'in-review':
    case 'ready-to-build':
    case 'checking':
      return isLate(waitedDays) ? 'warning' : 'neutral';
    default:
      return 'neutral';
  }
}

/** The tag of a step: its word and tone. */
export const stepTag = (step: StatusStep, waitedDays?: number | null): { label: string; tone: StepTone } => ({ label: STEP_LABEL[step], tone: stepTone(step, waitedDays) });
