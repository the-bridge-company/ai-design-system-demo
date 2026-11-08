import { describe, expect, it } from 'vitest';
import * as buildCheck from '../../api/_lib/build-check';
import { buildStateOf, buildSummary, designCheckStatus, type BuildNeed, type BuildWord } from '../../api/_lib/build-check';

const word: BuildWord = { role: 'designer', byName: 'Leo', kind: 'changes', why: 'build', text: 'Spacing is off', sha: 'abc', at: '2026-11-07T10:00:00Z' };

// The "Design check" status Bridge writes on GitHub names the real people of the check, on every team: the sample
// team's people are its email members (api/_lib/demo-members.ts), never personas written over someone else's account.
describe('the people of a build check', () => {
  it('names who said a word and who is waiting as recorded, with no persona layer', () => {
    expect('buildPeopleOn' in buildCheck).toBe(false);
    const need: BuildNeed = { pm: true, lead: false, names: { designer: 'Leo', pm: 'Ann' } };
    const s = buildSummary(buildStateOf([word], 'abc', need), need.names);
    expect(s.changesBy).toBe('Leo');
    expect(designCheckStatus(buildStateOf([], 'abc', need), need.names).description).toMatch(/Leo/);
  });

  it('leaves a GitHub person by the name the exploration recorded', () => {
    const need: BuildNeed = { pm: false, lead: false, names: { designer: 'peterbono' } };
    expect(designCheckStatus(buildStateOf([], 'abc', need), need.names).description).toBe('Waiting for peterbono');
  });
});
