import { describe, expect, it } from 'vitest';
import { LADDER, LATE_DAYS, STEP_LABEL, stageWord, stepOfStage, stepTag, stepTone } from './status-ladder';
import { LIFECYCLE_LABEL, LIFECYCLE_TONE, type LifecycleStage } from './review-state';
import { explorationTag } from './exploration-page';
import { BUILD_STATE_LABEL, buildStateTag } from './building-page';
import { statusNote, statusOf, STATE_LABEL, IN_PROGRESS, BOARD_COLUMNS } from './explorations-page';
import { PRODUCT_STATES } from './product-page';
import { DECIDED_LABEL } from './library-review';
import { decisionTag } from './lead-decisions';
import { BUILD_WORDS } from './build-check-view';
import { REMINDED_AFTER_DAYS, waitTone } from './status-tag';

const LADDER_WORDS = new Set([...LADDER.map((s) => STEP_LABEL[s]), STEP_LABEL['not-doing'], STEP_LABEL.archived]);

describe('one status ladder on every surface', () => {
  it('maps every lifecycle stage to one step', () => {
    const stages: LifecycleStage[] = ['exploring', 'waiting-for-lead', 'waiting-for-code', 'being-built', 'in-review', 'approved', 'next-release', 'shipped', 'archived', 'closed', 'not-planned'];
    expect(stages.map((s) => stepOfStage(s))).toEqual(['exploring', 'in-review', 'ready-to-build', 'being-built', 'checking', 'checking', 'shipped', 'shipped', 'archived', 'not-doing', 'not-doing']);
    for (const s of stages) expect(LADDER_WORDS.has(LIFECYCLE_LABEL[s])).toBe(true);
  });

  it('reads a promoted exploration in review as In review, a handed-off one as Checking', () => {
    expect(stageWord('in-review', { promoted: true })).toBe('In review');
    expect(stageWord('in-review')).toBe('Checking');
    expect(explorationTag('promoted').label).toBe('In review');
    expect(explorationTag('building', { stage: 'in-review' }).label).toBe('Checking');
  });

  it('the Contact page summary case: one word on Explorations, Being built and its page', () => {
    // Done exploring, the developers' version waits for Sofia's check.
    const list = STATE_LABEL[statusOf({ lifecycle: 'exploration', stage: 'in-review' })];
    const built = buildStateTag('in-review').label;
    const page = explorationTag('building', { stage: 'in-review' }).label;
    const card = LIFECYCLE_LABEL['in-review'];
    expect(new Set([list, built, page, card, BUILD_WORDS.tag])).toEqual(new Set(['Checking']));
  });

  it('uses only ladder words for tags, filters, groups and Board columns', () => {
    for (const w of [...Object.values(STATE_LABEL), ...Object.values(BUILD_STATE_LABEL), ...PRODUCT_STATES.map((s) => s.label), DECIDED_LABEL.building]) expect(LADDER_WORDS.has(w)).toBe(true);
    expect(IN_PROGRESS.map((s) => STATE_LABEL[s])).toEqual(['Exploring', 'In review', 'Ready to build', 'Being built', 'Checking']);
    expect(BOARD_COLUMNS.map((c) => c.label)).toEqual(['Exploring', 'In review', 'Ready to build', 'Being built', 'Checking', 'Shipped (30 days)']);
  });

  it('says who it waits on as a second line, never as the tag', () => {
    expect(decisionTag({ kind: 'question' }, 'Ann')?.label).toBe('In review');
    expect(decisionTag({ kind: 'changes' }, 'Ann')?.label).toBe('Exploring');
    expect(statusOf({ lifecycle: 'exploration', stage: 'waiting-for-code', waitsForLibrary: true })).toBe('in-review');
    expect(statusNote({ lifecycle: 'exploration', stage: 'waiting-for-code', waitsForLibrary: true })).toBe('Waiting for the library');
    expect(statusNote({ lifecycle: 'exploration', stage: 'approved' })).toBe('Looks right, ships next');
  });
});

describe('warning only when late', () => {
  it('a review wait is grey for days 0 to 2 and amber from the reminder (day 3); a build wait past LATE_DAYS', () => {
    expect(LATE_DAYS).toBe(7);
    expect(REMINDED_AFTER_DAYS).toBe(3);
    expect(stepTone('in-review')).toBe('neutral');
    expect(stepTone('in-review', 2)).toBe('neutral');
    expect(stepTone('in-review', 3)).toBe('warning');
    for (const s of ['ready-to-build', 'checking'] as const) {
      expect(stepTone(s)).toBe('neutral');
      expect(stepTone(s, 4)).toBe('neutral');
      expect(stepTone(s, 8)).toBe('warning');
    }
    expect(waitTone(2)).toBe('neutral');
    expect(waitTone(3)).toBe('warning');
    expect(waitTone(22)).toBe('warning');
    expect(waitTone(null)).toBe('neutral');
  });

  it('never colours a stage amber by itself', () => {
    expect(Object.values(LIFECYCLE_TONE)).not.toContain('warning');
    expect(stepTag('exploring').tone).toBe('info');
    expect(stepTag('shipped').tone).toBe('success');
    expect(buildStateTag('waiting', 3).tone).toBe('neutral');
    expect(buildStateTag('waiting', 10).tone).toBe('warning');
  });
});
