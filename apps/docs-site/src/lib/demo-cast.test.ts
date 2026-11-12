import { describe, expect, it } from 'vitest';
import { DEMO_MEMBERS, DEMO_PM, RETIRED_DEMO_MEMBERS } from '../../api/_lib/demo-members';
import { memberRef } from '../../api/_lib/exploration-member';
import { CAST_PARAM, CAST_WORDS, DEFAULT_CAST, SAMPLE_CAST, castAccess, castFaceLogin, castGitHub, castPerson, castRole, chooseCast, isCastLogin, onlySamplePeople, playedMember } from './demo-cast';
import { emailMemberFace } from './people';
import type { ContributeMember } from './contribute';

// As the server's visitor session sends her (api/contribute publicMember): both hats on the sample team.
const dana: ContributeMember = { email: 'dana@acme.example', name: 'Dana', role: 'admin', ref: 'a399f73add3dbb2d', lead: true, decides: true, libraryOwner: true, designReviews: ['*'], visitor: true };

describe('See it as: the people of the sample team', () => {
  it('lists the five people in plain words, Dana first and by default', () => {
    expect(SAMPLE_CAST.map((p) => p.key)).toEqual(['dana', 'sofia', 'leo', 'malik', 'ann']);
    expect(DEFAULT_CAST).toBe('dana');
    expect(CAST_PARAM).toBe('as');
    for (const p of SAMPLE_CAST) expect(p.job).not.toMatch(/—/);
    for (const w of Object.values(CAST_WORDS)) expect(w).not.toMatch(/—/);
  });

  it('is the team the server seeds: every email member with their role, lead flag and reference', () => {
    const email = SAMPLE_CAST.filter((p) => p.via.kind === 'email');
    expect(email.map((p) => p.name).sort()).toEqual(DEMO_MEMBERS.map((m) => m.name).sort());
    for (const p of email) {
      if (p.via.kind !== 'email') continue;
      const address = p.via.email;
      const m = DEMO_MEMBERS.find((d) => d.email === address);
      expect(m, p.name).toBeTruthy();
      expect({ role: p.via.role, lead: p.via.lead, name: p.name }).toEqual({ role: m!.role, lead: Boolean(m!.lead), name: m!.name });
      expect(p.via.ref).toBe(memberRef(address));
    }
    // The developer joins with GitHub only; Ann is the product manager.
    expect(castPerson('malik')!.via).toEqual({ kind: 'github', login: RETIRED_DEMO_MEMBERS[0]!.github });
    const ann = castPerson('ann')!;
    expect(ann.via.kind === 'email' && ann.via.email).toBe(DEMO_PM.email);
    expect(ann.job).toBe('Product manager');
    // Dana is the only design lead of the sample team.
    expect(SAMPLE_CAST.filter((p) => p.via.kind === 'email' && p.via.lead).map((p) => p.name)).toEqual(['Dana']);
  });

  it('picks from the address first, then this browser, else Dana; anything else names nobody', () => {
    expect(chooseCast({ query: 'Sofia', stored: 'leo' }).key).toBe('sofia');
    expect(chooseCast({ query: null, stored: 'leo' }).key).toBe('leo');
    expect(chooseCast({ query: 'mallory', stored: 'nobody' }).key).toBe('dana');
    expect(chooseCast({}).key).toBe('dana');
    expect(castPerson(' MALIK ')?.name).toBe('Malik');
    expect(castPerson(42)).toBeNull();
  });

  it("reads a visitor's session as the person played, with the server's review rules", () => {
    expect(playedMember(dana, castPerson('sofia')!)).toEqual({ email: 'sofia@acme.example', name: 'Sofia', role: 'edit', ref: '0406ec723c59bb8d', visitor: true });
    // Ann is the product manager: she never reviews or decides, her view is optional.
    expect(playedMember(dana, castPerson('ann')!)).toEqual({ email: 'ann@acme.example', name: 'Ann', role: 'edit', ref: 'b9cc21753b627efd', visitor: true });
    // A store seeded while Ann still reviewed: the page plays her as the cast says, never as a reviewer.
    const staleAnn: ContributeMember = { email: 'ann@acme.example', name: 'Ann', role: 'edit', ref: 'b9cc21753b627efd', lead: true, decides: true, visitor: true };
    expect(playedMember(staleAnn, castPerson('ann')!)).toEqual({ email: 'ann@acme.example', name: 'Ann', role: 'edit', ref: 'b9cc21753b627efd', visitor: true });
    // A team where any designer gives the design review: every designer reviews, the library stays Dana's.
    expect(playedMember(dana, castPerson('leo')!, { '*': { on: true, reviewers: 'any-designer' } })).toMatchObject({ name: 'Leo', lead: true, decides: true, designReviews: ['*'] });
    expect(playedMember(dana, castPerson('leo')!, { '*': { on: true, reviewers: 'any-designer' } })?.libraryOwner).toBeUndefined();
    expect(playedMember(dana, castPerson('dana')!)).toBe(dana);
    // The developer has no email membership: the GitHub side plays him.
    expect(playedMember(dana, castPerson('malik')!)).toBeNull();
    expect(castGitHub(castPerson('malik')!)).toMatchObject({ login: 'acme-malik', name: 'Malik' });
    expect(castGitHub(castPerson('sofia')!)).toBeNull();
  });

  it('gives the hats of the two reviews on the sample team: Dana both, Sofia and Leo none', () => {
    expect(playedMember({ ...dana, email: 'sofia@acme.example' }, castPerson('dana')!)).toMatchObject({ name: 'Dana', lead: true, decides: true, libraryOwner: true, designReviews: ['*'] });
    for (const k of ['sofia', 'leo'] as const) {
      const m = playedMember(dana, castPerson(k)!)!;
      expect([m.lead, m.decides, m.libraryOwner, m.designReviews]).toEqual([undefined, undefined, undefined, undefined]);
    }
    // A session read before the two reviews (lead and decides only): the page adds Dana's two hats.
    const before: ContributeMember = { email: 'dana@acme.example', name: 'Dana', role: 'admin', ref: 'a399f73add3dbb2d', lead: true, decides: true, visitor: true };
    expect(playedMember(before, castPerson('dana')!)).toMatchObject({ libraryOwner: true, designReviews: ['*'] });
  });

  it('never replaces a real member or someone signed out: only a visitor session plays', () => {
    const member: ContributeMember = { email: 'dana@acme.example', name: 'Dana', role: 'admin' };
    expect(playedMember(member, castPerson('sofia')!)).toBe(member);
    expect(playedMember(null, castPerson('sofia')!)).toBeNull();
  });

  it("gives the developer the access the team's collaborators list says, never admin", () => {
    const list = [
      { login: 'peterbono', permissions: { push: true } },
      { login: 'Acme-Malik', permissions: { push: true } },
    ];
    expect(castAccess(list, 'acme-malik')).toEqual({ state: 'writer', write: true, admin: false, reach: true });
    expect(castAccess([{ login: 'acme-malik', permissions: { push: false } }], 'acme-malik').write).toBe(false);
    expect(castAccess([], 'acme-malik').write).toBe(false);
  });

  it('draws each email member with the face Studio gives them everywhere', () => {
    for (const p of SAMPLE_CAST) if (p.via.kind === 'email') expect(castFaceLogin(p)).toBe(emailMemberFace(p.name, p.via.email));
    expect(castFaceLogin(castPerson('malik')!)).toBe('acme-malik');
  });
});

describe('onlySamplePeople', () => {
  const people = [
    { login: 'peterbono' },
    { login: 'acme-malik' },
    { login: 'email-member-0', via: 'email' as const },
  ];
  it('keeps the fictional people of the sample team, never a real GitHub account', () => {
    expect(onlySamplePeople('acme-design-demo/bridge-demo-ds', people).map((m) => m.login)).toEqual(['acme-malik', 'email-member-0']);
  });
  it('leaves any other team as it is', () => {
    expect(onlySamplePeople('the-bridge-company/ai-design-system-demo', people)).toHaveLength(3);
  });
  it('knows the developer by his login, any case', () => {
    expect(isCastLogin('@Acme-Malik')).toBe(true);
    expect(isCastLogin('peterbono')).toBe(false);
  });
});

describe('castGitHub', () => {
  it('draws the developer: no GitHub photo', () => {
    expect(castGitHub(castPerson('malik')!)?.avatar_url).toBe('');
  });
});

describe('castRole', () => {
  it('names what each person does in the words of their job', () => {
    expect(SAMPLE_CAST.map((p) => `${p.name} ${castRole(p)}`)).toEqual(['Dana Design lead', 'Sofia Designer', 'Leo Designer', 'Malik Developer', 'Ann Product manager']);
    for (const p of SAMPLE_CAST) expect(p.job.startsWith(castRole(p))).toBe(true);
  });
});
