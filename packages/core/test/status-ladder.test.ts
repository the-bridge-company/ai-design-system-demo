import { describe, expect, it } from 'vitest';
import { EXPLORATION_STATUS_LABEL, isLate, isOpenStep, LADDER, LATE_DAYS, STATUS_STEPS, STEP_LABEL, stepCount, stepOfBuildStatus, stepRank, BUILD_STALE_DAYS } from '../src';

describe('status ladder', () => {
  it('has one ordered set of words, no two the same, no em dash', () => {
    expect(LADDER.map((s) => STEP_LABEL[s])).toEqual(['Exploring', 'In review', 'Ready to build', 'Being built', 'Checking', 'Shipped']);
    const words = STATUS_STEPS.map((s) => STEP_LABEL[s]);
    expect(new Set(words).size).toBe(words.length);
    for (const w of words) expect(w).not.toContain('—');
  });

  it('ranks steps in order, stopped work after Shipped', () => {
    expect(LADDER.map(stepRank)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stepRank('not-doing')).toBeGreaterThan(stepRank('shipped'));
    expect(isOpenStep('checking')).toBe(true);
    expect(isOpenStep('shipped')).toBe(false);
    expect(isOpenStep('archived')).toBe(false);
  });

  it('maps build statuses onto the ladder', () => {
    expect(stepOfBuildStatus('requested')).toBe('ready-to-build');
    expect(stepOfBuildStatus('picked-up')).toBe('being-built');
    expect(stepOfBuildStatus('in-progress')).toBe('being-built');
    expect(stepOfBuildStatus('in-review')).toBe('checking');
    expect(stepOfBuildStatus('shipped')).toBe('shipped');
    expect(stepOfBuildStatus('not-planned')).toBe('not-doing');
  });

  it('says counts in the same words', () => {
    expect(stepCount(3, 'ready-to-build')).toBe('3 ready to build');
    expect(stepCount(4, 'checking')).toBe('4 being checked');
  });

  it("core's exploration statuses speak the ladder", () => {
    expect(EXPLORATION_STATUS_LABEL).toMatchObject({ ready: 'Ready to build', building: 'Being built', shipped: 'Shipped', promoted: 'In review', closed: 'Not doing this' });
  });

  it('late is one threshold: more than a week', () => {
    expect(LATE_DAYS).toBe(7);
    expect(BUILD_STALE_DAYS).toBe(LATE_DAYS);
    expect(isLate(7)).toBe(false);
    expect(isLate(8)).toBe(true);
    expect(isLate(null)).toBe(false);
  });
});
