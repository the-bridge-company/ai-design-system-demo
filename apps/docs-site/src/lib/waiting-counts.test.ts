import { describe, expect, it } from 'vitest';
import { explorationKey, explorationOfNeed, inProgressCount, isInProgress, mergeWaiting, onePerExploration, waitingCounts, waitingToBePickedUp } from './waiting-counts';
import type { NeedRow } from './home-model';

const need = (key: string, kind: NeedRow['kind'] = 'review', line = 'l'): NeedRow => ({ key, kind, title: 't', href: '#', person: null, line, since: null, waitsOnYou: true, pill: null, thumb: { kind: 'icon', icon: 'branch' } });

describe('the two waiting counts, one source each', () => {
  it('reads which exploration a Home row waits on', () => {
    expect(explorationOfNeed(need('exploration-review-crm#12'))).toBe(explorationKey(12, 'crm'));
    expect(explorationOfNeed(need('exploration-review-7'))).toBe('#7');
    expect(explorationOfNeed(need('dev-question-shop#4'))).toBe('shop#4');
    expect(explorationOfNeed(need('dev-question-#4'))).toBe('#4');
    expect(explorationOfNeed(need('change-31'))).toBeNull();
  });
  it('counts design reviews: a row asking only a library decision is Library review\'s', () => {
    const both = { ...need('exploration-review-prints#3'), hats: ['design-review', 'library'] as NeedRow['hats'] };
    const library = { ...need('exploration-review-prints#4'), hats: ['library'] as NeedRow['hats'] };
    expect(waitingCounts([both, library]).explorations.map((e) => e.key)).toEqual([explorationKey(3, 'prints')]);
  });
  it("reads Home's list: the explorations once each, nothing of the library", () => {
    const c = waitingCounts([need('exploration-review-crm#12', 'review', 'Sofia is done exploring'), need('dev-question-crm#12', 'own'), need('change-31'), need('guidance-x', 'guidance'), need('own-2', 'own')]);
    expect(c.explorations).toEqual([{ key: 'crm#12', line: 'Sofia is done exploring' }]);
  });
  it("adds what Home found that the list cannot read, only for listed explorations", () => {
    const merged = mergeWaiting([{ key: 'crm#1', line: 'a' }], [{ key: 'crm#1', line: 'b' }, { key: 'shop#2', line: 'Leo asked you a question' }, { key: 'x#9', line: 'gone' }], new Set(['crm#1', 'shop#2']));
    expect(merged).toEqual([{ key: 'crm#1', line: 'a' }, { key: 'shop#2', line: 'Leo asked you a question' }]);
  });
});

describe('one Home row per exploration', () => {
  it('keeps the first row of an exploration asked twice, and every library row', () => {
    const rows = [need('exploration-review-prints#1', 'review', 'Sofia is done exploring'), need('exploration-review-crm#1'), need('exploration-review-prints#1', 'review', 'Sofia would like your opinion'), need('change-31'), need('guidance-x', 'guidance')];
    const kept = onePerExploration(rows);
    expect(kept.map((r) => r.line)).not.toContain('Sofia would like your opinion');
    expect(kept).toHaveLength(4);
    // What Home lists is what the Explorations badge counts.
    expect(waitingCounts(kept).explorations).toHaveLength(kept.filter((r) => explorationOfNeed(r)).length);
  });
});

describe('the other counts, one definition each', () => {
  it('counts explorations in progress as the Explorations list does by default', () => {
    const cards = ['exploring', 'waiting-for-lead', 'waiting-for-code', 'being-built', 'in-review', 'approved', 'shipped', 'next-release', 'closed', 'not-planned', 'archived'].map((lifecycle) => ({ lifecycle }));
    expect(inProgressCount(cards)).toBe(6);
    expect(isInProgress({ lifecycle: 'archived' })).toBe(false);
  });
  it('counts the build requests nobody picked up yet: what needs a developer', () => {
    expect(waitingToBePickedUp([{ status: 'requested' }, { status: 'requested' }, { status: 'requested' }, { status: 'in-progress' }, { status: 'in-review' }])).toBe(3);
  });
});
