import { describe, expect, it } from 'vitest';
import { designLeads, isTeamPerson, rightPeople, teamEntries, teamSoloOwner, type RulePerson } from './review-people';
import { castJob, castPersonOfLogin, SAMPLE_CAST } from './demo-cast';

const SAMPLE = 'acme-design-demo/bridge-demo-ds';
const OTHER = 'acme/acme-product';
const nameOf = (entry: string): RulePerson => ({ key: entry, name: castPersonOfLogin(entry)?.name ?? entry, face: entry });

describe('Review rules name only the team’s own people (no fallback)', () => {
  it('on the sample team, an owner entry is named only when it is a cast account', () => {
    expect(isTeamPerson(SAMPLE, 'acme-malik')).toBe(true);
    expect(isTeamPerson(SAMPLE, '@acme-malik')).toBe(true);
    // The account that hosts the sample repository, or anyone else: never.
    expect(isTeamPerson(SAMPLE, 'peterbono')).toBe(false);
    expect(isTeamPerson(SAMPLE, '@acme-design-demo/design')).toBe(false);
    // The old address of the sample team reads the same.
    expect(isTeamPerson('peterbono/bridge-demo-ds', 'peterbono')).toBe(false);
  });

  it('on any other team, its own config is its people, teams included', () => {
    expect(isTeamPerson(OTHER, 'peterbono')).toBe(true);
    expect(isTeamPerson(OTHER, '@acme/design')).toBe(true);
    expect(isTeamPerson(OTHER, 'not a login!')).toBe(false);
    expect(teamEntries(OTHER, ['sam', '@Sam', 'lee'])).toEqual(['sam', 'lee']);
  });

  it('the sample team’s design leads come from its cast, whoever reads the page', () => {
    expect(designLeads(SAMPLE, null).map((p) => p.name)).toEqual(['Dana']);
    expect(designLeads(SAMPLE, [{ login: 'x@y.z', name: 'Someone', lead: true, via: 'email' }]).map((p) => p.name)).toEqual(['Dana']);
    expect(designLeads(SAMPLE, null)[0]!.face).toBe('~dana');
  });

  it('another team’s design leads are its email members made Design lead', () => {
    const members = [
      { login: 'ana@acme.com', email: 'ana@acme.com', name: 'Ana', lead: true, via: 'email' as const },
      { login: 'bo@acme.com', email: 'bo@acme.com', name: 'Bo', via: 'email' as const },
      { login: 'cy', name: 'Cy', lead: true },
    ];
    expect(designLeads(OTHER, members).map((p) => p.name)).toEqual(['Ana']);
    expect(designLeads(OTHER, null)).toEqual([]);
  });

  it('a right of the design owners names the design leads too; a code right never does', () => {
    const leads = designLeads(SAMPLE, null);
    expect(rightPeople({ repo: SAMPLE, entries: ['peterbono'], groups: ['design'], leads, nameOf }).map((p) => p.name)).toEqual(['Dana']);
    expect(rightPeople({ repo: SAMPLE, entries: ['peterbono'], groups: ['tech'], leads, nameOf })).toEqual([]);
    expect(rightPeople({ repo: SAMPLE, entries: ['acme-malik'], groups: ['tech'], leads, nameOf }).map((p) => p.name)).toEqual(['Malik']);
    expect(rightPeople({ repo: SAMPLE, entries: ['peterbono', 'acme-malik'], groups: ['design', 'tech'], leads, nameOf }).map((p) => p.name)).toEqual(['Malik', 'Dana']);
  });

  it('the only owner is named only when they are one of the team’s people', () => {
    expect(teamSoloOwner(SAMPLE, 'peterbono')).toBeNull();
    expect(teamSoloOwner(SAMPLE, 'acme-malik')).toBe('acme-malik');
    expect(teamSoloOwner(OTHER, 'sam')).toBe('sam');
    expect(teamSoloOwner(OTHER, null)).toBeNull();
  });
});

describe('Job and access: one job per person of the sample team', () => {
  it('reads the cast job by email or GitHub login, only on the sample team', () => {
    expect(castJob(SAMPLE, { email: 'dana@acme.example' })).toBe('Design lead, runs the team');
    expect(castJob(SAMPLE, { login: 'sofia@acme.example' })).toBe('Designer');
    expect(castJob(SAMPLE, { login: 'acme-malik' })).toBe('Developer');
    expect(castJob(SAMPLE, { login: '@ACME-Malik' })).toBe('Developer');
    expect(castJob(SAMPLE, { login: 'peterbono' })).toBeNull();
    expect(castJob(OTHER, { login: 'acme-malik' })).toBeNull();
  });

  it('a job is never an access level nor "Reviewer"', () => {
    for (const p of SAMPLE_CAST) expect(p.job).not.toMatch(/^(Admin|Can edit|Can view|Reviewer)/);
  });
});
