import { describe, expect, it } from 'vitest';
import { buildPeopleOn, buildStateOf, buildSummary, designCheckStatus, type BuildNeed, type BuildWord } from '../../api/_lib/build-check';

const need: BuildNeed = { pm: false, lead: false, names: { designer: 'peterbono' } };
const word: BuildWord = { role: 'designer', by: 'peterbono', byName: 'Florian Gouloubi', kind: 'changes', why: 'build', text: 'Spacing is off', sha: 'abc', at: '2026-11-07T10:00:00Z' };

describe('buildPeopleOn: the people of a build check', () => {
  it('on the sample team, names its personas and never the account behind its repositories', () => {
    const shown = buildPeopleOn('acme-design-demo/bridge-demo-ds', [word], need);
    expect(shown.words[0]!.byName).toBe('Dana');
    expect(shown.words[0]!.by).toBeUndefined();
    expect(shown.need.names?.designer).toBe('Dana');
    const s = buildSummary(buildStateOf(shown.words, 'abc', shown.need), shown.need.names);
    expect(JSON.stringify(s)).not.toMatch(/Florian|peterbono/);
    expect(designCheckStatus(buildStateOf([], 'abc', shown.need), shown.need.names).description).toBe('Waiting for Dana');
  });

  it('keeps a persona the exploration recorded by name', () => {
    const shown = buildPeopleOn('acme-design-demo/bridge-demo-ds', [], { pm: false, lead: false, names: { designer: 'Leo' } });
    expect(designCheckStatus(buildStateOf([], 'abc', shown.need), shown.need.names).description).toBe('Waiting for Leo');
  });

  it('on a real team, leaves every word and name as it is', () => {
    const shown = buildPeopleOn('acme/design-system', [word], need);
    expect(shown.words).toEqual([word]);
    expect(shown.need).toBe(need);
    expect(designCheckStatus(buildStateOf([], 'abc', shown.need), shown.need.names).description).toBe('Waiting for peterbono');
  });
});
