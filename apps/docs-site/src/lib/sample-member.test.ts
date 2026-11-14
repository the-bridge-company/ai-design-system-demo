import { describe, expect, it } from 'vitest';
import { explorationPrBody, withLeadAsked, withLibraryAsked, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import type { ContributeMember } from './contribute';
import { memberContact, parseSampleSelf, sampleIdentity, sampleRoleOf, sampleSelfMember, selfOfAccount, selfOfGitHub, sharedSeatIds, withSampleTeam } from './sample-member';
import { viewerHats } from './team-reviews';
import { withSampleReviews } from './review-lines';
import { SAMPLE_REPO } from './demo';

// The visitor's read-only session, as the server sends it for Dana (api/contribute publicMember).
const dana: ContributeMember = { email: 'dana@acme.example', name: 'Dana', role: 'admin', ref: 'a399f73add3dbb2d', lead: true, decides: true, libraryOwner: true, designReviews: ['*'], visitor: true };
const sofia: ContributeMember = { email: 'sofia@acme.example', name: 'Sofia', role: 'edit', ref: '0406ec723c59bb8d', visitor: true };
const florian = selfOfAccount({ name: 'Florian', email: 'florian@example.com', github: { login: 'peterbono' } });

describe('the person signed in, on the sample team', () => {
  it('reads who is signed in from their account or their GitHub sign-in', () => {
    expect(florian).toEqual({ name: 'Florian', email: 'florian@example.com', login: 'peterbono', avatar: null });
    expect(selfOfAccount({ name: null, email: 'ann@example.com', github: null })).toEqual({ name: 'ann', email: 'ann@example.com', login: null, avatar: null });
    expect(selfOfGitHub({ login: 'octo', name: '', avatar_url: 'https://avatars.githubusercontent.com/u/1' })).toEqual({ name: 'octo', email: null, login: 'octo', avatar: 'https://avatars.githubusercontent.com/u/1' });
    expect(parseSampleSelf(null)).toBeNull();
    expect(parseSampleSelf({ name: 'Nobody' })).toBeNull();
  });

  it('is one more member, Admin, as themselves, with the lead seat and none of her work', () => {
    const me = sampleSelfMember(dana, florian)!;
    expect(me).toMatchObject({ email: 'florian@example.com', name: 'Florian', role: 'admin', lead: true, decides: true, libraryOwner: true, designReviews: ['*'], visitor: true, self: { login: 'peterbono', avatar: null } });
    expect(me.ref).toBeUndefined();
    // Whoever the visitor's session was (an older "See it as" pick), the same seat.
    expect(sampleSelfMember(sofia, florian)).toEqual(me);
  });

  it('leaves a signed-out visitor and every real member as they are', () => {
    expect(sampleSelfMember(dana, null)).toBe(dana);
    const real = { ...dana, visitor: undefined };
    expect(sampleSelfMember(real, florian)).toBe(real);
    expect(sampleSelfMember(null, florian)).toBeNull();
  });

  it('names a GitHub sign-in alone by its login, never a no-reply address', () => {
    const me = sampleSelfMember(dana, selfOfGitHub({ login: 'octo', name: 'Octo Cat', avatar_url: '' }))!;
    expect(me.email).toBe('octo@users.noreply.github.com');
    expect(memberContact(me)).toBe('@octo');
    expect(memberContact(sampleSelfMember(dana, florian)!)).toBe('florian@example.com');
    expect(memberContact(dana)).toBe('dana@acme.example');
  });

  it('waits on them for what waits on Dana: they hold her seat in the reviews', () => {
    const me = sampleSelfMember(dana, florian)!;
    expect(sharedSeatIds(me)).toEqual(['member:a399f73add3dbb2d']);
    expect(sharedSeatIds(dana)).toEqual([]);
    expect(sharedSeatIds(null)).toEqual([]);
    const team = withSampleReviews({ designReview: null, members: [{ name: 'Dana', ref: 'a399f73add3dbb2d', role: 'admin' }, { name: 'Sofia', ref: '0406ec723c59bb8d', role: 'edit' }], githubOwners: [], products: [{ key: 'prints', name: 'Acme Prints' }] }, true);
    // Sofia sent her Acme Prints exploration with a new piece: Dana's design review and library decision.
    const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
    const body = withPiecesRecord(explorationPrBody({ name: 'X', purpose: '', slug: 'x', author: 'sofia' }, { owner: 'acme', repo: 'r', packages: [], apps: {} }).replace('"slug":"x"', '"slug":"x","member":"0406ec723c59bb8d"'), { checkedAt: 't', pieces: [timeline], links: [] });
    const sent = withLibraryAsked(withLeadAsked(body, { at: 'a', byName: 'Sofia' }), { at: 'a' });
    const asked = viewerHats(sent, { team, product: 'prints', viewer: sharedSeatIds(me) });
    const signedOutDana = viewerHats(sent, { team, product: 'prints', viewer: ['member:a399f73add3dbb2d'] });
    expect(asked).toEqual(['design-review', 'library']);
    expect(asked).toEqual(signedOutDana);
  });

  it('says Admin on the sample team only, for someone signed in', () => {
    expect(sampleRoleOf(SAMPLE_REPO, true)).toBe('admin');
    expect(sampleRoleOf('Acme-Design-Demo/Bridge-Demo-DS', true)).toBe('admin');
    expect(sampleRoleOf(SAMPLE_REPO, false)).toBeNull();
    expect(sampleRoleOf('the-bridge-company/ai-design-system-demo', true)).toBeNull();
  });
});

describe('the team switcher with the sample team', () => {
  type Row = { key: string; current: boolean; role?: string };
  const row = (team: string, current: boolean): Row => ({ key: team, current, role: 'Admin' });
  const BRIDGE = 'the-bridge-company/ai-design-system-demo';

  it('lists it under your teams, last, the same from both sides apart from the check', () => {
    const fromBridge = withSampleTeam([{ key: BRIDGE, current: true, role: 'Admin' }], { signedIn: true, here: BRIDGE, recent: [SAMPLE_REPO, BRIDGE], row });
    // On the sample team the menu put it first (the team you are on): it moves after the real teams.
    const fromSample = withSampleTeam([row(SAMPLE_REPO, true), { key: BRIDGE, current: false, role: 'Admin' }], { signedIn: true, here: SAMPLE_REPO, recent: [BRIDGE], row });
    expect(fromBridge.map((r) => [r.key, r.role])).toEqual(fromSample.map((r) => [r.key, r.role]));
    expect(fromBridge.map((r) => r.key)).toEqual([BRIDGE, SAMPLE_REPO]);
    expect(fromBridge.map((r) => r.current)).toEqual([true, false]);
    expect(fromSample.map((r) => r.current)).toEqual([false, true]);
  });

  it('only once they opened it, and never for a signed-out visitor', () => {
    expect(withSampleTeam([{ key: BRIDGE, current: true }], { signedIn: true, here: BRIDGE, recent: [BRIDGE], row })).toEqual([{ key: BRIDGE, current: true }]);
    const visitor = [row(SAMPLE_REPO, true)];
    expect(withSampleTeam(visitor, { signedIn: false, here: SAMPLE_REPO, recent: [], row })).toEqual(visitor);
  });
});

describe('who the sample team is for, before it paints anyone', () => {
  const none = { self: false, uncheckedGitHub: false, signingIn: false, accountTrace: false };
  it('paints a signed-out visitor at once (Dana), and the person at once when known', () => {
    expect(sampleIdentity(none)).toBe('out');
    expect(sampleIdentity({ ...none, self: true, uncheckedGitHub: true })).toBe('self');
  });
  it('waits while a sign-in may be there: an account trace, a GitHub sign-in never checked, a sign-in under way', () => {
    expect(sampleIdentity({ ...none, accountTrace: true })).toBe('pending');
    expect(sampleIdentity({ ...none, uncheckedGitHub: true })).toBe('pending');
    expect(sampleIdentity({ ...none, signingIn: true })).toBe('pending');
  });
});
