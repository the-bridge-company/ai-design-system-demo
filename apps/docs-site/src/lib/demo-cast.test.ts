import { describe, expect, it } from 'vitest';
import { DEMO_MEMBERS, DEMO_PM, RETIRED_DEMO_MEMBERS } from '../../api/_lib/demo-members';
import { memberRef } from '../../api/_lib/exploration-member';
import { CAST_PARAM, CAST_WORDS, DEFAULT_CAST, SAMPLE_CAST, castAccess, castFaceLogin, castGitHub, castPerson, chooseCast, playedMember } from './demo-cast';
import { emailMemberFace } from './people';
import type { ContributeMember } from './contribute';

const dana: ContributeMember = { email: 'dana@acme.example', name: 'Dana', role: 'admin', ref: 'a399f73add3dbb2d', lead: true, decides: true, visitor: true };

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
    expect(ann.job).toMatch(/Product manager/);
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
    expect(playedMember(dana, castPerson('ann')!)).toMatchObject({ name: 'Ann', role: 'edit', lead: true, decides: true, visitor: true });
    // A team that shares review: every designer reviews.
    expect(playedMember(dana, castPerson('leo')!, 'shared')).toMatchObject({ name: 'Leo', lead: true, decides: true });
    expect(playedMember(dana, castPerson('dana')!)).toBe(dana);
    // The developer has no email membership: the GitHub side plays him.
    expect(playedMember(dana, castPerson('malik')!)).toBeNull();
    expect(castGitHub(castPerson('malik')!)).toMatchObject({ login: 'acme-malik', name: 'Malik' });
    expect(castGitHub(castPerson('sofia')!)).toBeNull();
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
