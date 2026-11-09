import { describe, expect, it } from 'vitest';
import { explorationKey, explorationOfNeed, mergeWaiting, waitingCounts } from './waiting-counts';
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
  it("splits Home's list: explorations once each, the library rows counted as before", () => {
    const c = waitingCounts([need('exploration-review-crm#12', 'review', 'Sofia is done exploring'), need('dev-question-crm#12', 'own'), need('change-31'), need('guidance-x', 'guidance'), need('own-2', 'own')]);
    expect(c.explorations).toEqual([{ key: 'crm#12', line: 'Sofia is done exploring' }]);
    expect(c.library).toBe(2);
  });
  it("adds what Home found that the list cannot read, only for listed explorations", () => {
    const merged = mergeWaiting([{ key: 'crm#1', line: 'a' }], [{ key: 'crm#1', line: 'b' }, { key: 'shop#2', line: 'Leo asked you a question' }, { key: 'x#9', line: 'gone' }], new Set(['crm#1', 'shop#2']));
    expect(merged).toEqual([{ key: 'crm#1', line: 'a' }, { key: 'shop#2', line: 'Leo asked you a question' }]);
  });
});
