// The rules behind Invite collaborators and Settings > Members (lib/invites.ts): role words, the GitHub mapping read
// back, who may change what, the email field and the sample team.
import { describe, expect, it } from 'vitest';
import {
  closeLabel,
  membersPending,
  adminCount,
  choiceOf,
  GITHUB_PERMISSION,
  inviteePeople,
  inviteOptions,
  isEmail,
  memberActions,
  MEMBERS_WORDS,
  memberLine,
  ROLE_WORDS,
  withManages,
  membersContext,
  normalizeChoice,
  ownerGroupOf,
  parseEmails,
  pendingLine,
  roleChoices,
  roleLabel,
  roleOf,
  roleText,
  sameChoice,
  sendLabel,
  sentSummary,
  sortMembers,
  type Member,
} from './invites';
import type { KnownPerson, PendingInvite } from './invites';

const owners = { design: ['ann', '@acme/design'], tech: ['Malik'] };

/** A team with five members, one invite not joined yet, and two people of the organization not in it yet. */
const acmeTeam = (): { members: Member[]; pending: PendingInvite[]; people: KnownPerson[] } => ({
  members: [
    { login: '~dana', name: 'Dana', role: 'admin', reviews: ['design'], you: true, email: 'dana@acme.example' },
    { login: '~ann-leroy', name: 'Ann', role: 'reviewer', reviews: ['design'], email: 'ann@acme.example' },
    { login: '~leo-martin', name: 'Leo', role: 'edit', reviews: [], email: 'leo@acme.example' },
    { login: '~malik-haddad', name: 'Malik', role: 'reviewer', reviews: ['tech'], email: 'malik@acme.example' },
    { login: '~sofia-reyes', name: 'Sofia', role: 'edit', reviews: [], email: 'sofia@acme.example' },
  ],
  pending: [{ id: 'p-priya', email: 'priya@acme.example', role: 'edit', sentAt: new Date(Date.UTC(2026, 9, 20, 9)).toISOString(), face: '~priya-natarajan' }],
  people: [
    { name: 'Ann', email: 'ann@acme.example', login: '~ann-leroy' },
    { name: 'Leo', email: 'leo@acme.example', login: '~leo-martin' },
    { name: 'Malik', email: 'malik@acme.example', login: '~malik-haddad' },
    { name: 'Sofia', email: 'sofia@acme.example', login: '~sofia-reyes' },
    { name: 'Mal Reyes', email: 'mal.reyes@acme.example' },
    { name: 'Jonas Berg', email: 'jonas.berg@acme.example' },
  ],
});

describe('roles', () => {
  it('maps each role to one GitHub permission, and Reviewer to an owner list', () => {
    expect(GITHUB_PERMISSION).toEqual({ view: 'pull', edit: 'push', reviewer: 'push', admin: 'admin' });
    expect(ownerGroupOf({ role: 'reviewer', reviewAs: 'tech' })).toBe('tech');
    expect(ownerGroupOf({ role: 'reviewer' })).toBe('design');
    expect(ownerGroupOf({ role: 'edit' })).toBeNull();
  });

  it('names the trigger like the board: "Reviewer: design"', () => {
    expect(roleLabel({ role: 'edit' })).toBe('Can edit');
    expect(roleLabel({ role: 'view' })).toBe('Can view');
    expect(roleLabel({ role: 'reviewer', reviewAs: 'design' })).toBe('Reviewer: design');
    expect(roleLabel({ role: 'reviewer', reviewAs: 'tech' })).toBe('Reviewer: code');
    expect(roleLabel({ role: 'admin' })).toBe('Admin');
  });

  it('a Reviewer always says what they review; other roles never do', () => {
    expect(normalizeChoice({ role: 'reviewer' })).toEqual({ role: 'reviewer', reviewAs: 'design' });
    expect(normalizeChoice({ role: 'edit', reviewAs: 'tech' })).toEqual({ role: 'edit' });
    expect(sameChoice({ role: 'reviewer' }, { role: 'reviewer', reviewAs: 'design' })).toBe(true);
    expect(sameChoice({ role: 'reviewer', reviewAs: 'tech' }, { role: 'reviewer' })).toBe(false);
  });

  it('offers the four roles, Can view first (board I2)', () => {
    expect(roleChoices(false).map((c) => c.role)).toEqual(['view', 'edit', 'reviewer', 'admin']);
    expect(roleLabel({ role: 'view' })).toBe('Can view');
  });

  it('on a personal account, Admin cannot be given', () => {
    expect(roleChoices(true).filter((c) => !c.disabled).map((c) => c.role)).toEqual(['view', 'edit', 'reviewer']);
    expect(roleChoices(false).every((c) => !c.disabled)).toBe(true);
  });
});

describe('reading roles back from GitHub', () => {
  it('admin wins, write plus an owner entry is Reviewer, write alone Can edit, read Can view', () => {
    expect(roleOf({ login: 'dana', role_name: 'admin' }, owners)).toEqual({ role: 'admin', reviews: [] });
    expect(roleOf({ login: 'ANN', role_name: 'write' }, owners)).toEqual({ role: 'reviewer', reviews: ['design'] });
    expect(roleOf({ login: 'malik', role_name: 'maintain' }, owners)).toEqual({ role: 'reviewer', reviews: ['tech'] });
    expect(roleOf({ login: 'leo', role_name: 'write' }, owners)).toEqual({ role: 'edit', reviews: [] });
    expect(roleOf({ login: 'priya', role_name: 'read' }, owners)).toEqual({ role: 'view', reviews: [] });
    expect(roleOf({ login: 'tri', role_name: 'triage' }, owners)).toEqual({ role: 'view', reviews: [] });
  });

  it('falls back to the permissions object, and a GitHub team entry never matches a login', () => {
    expect(roleOf({ login: 'x', permissions: { admin: true, push: true, pull: true } }, owners).role).toBe('admin');
    expect(roleOf({ login: 'x', permissions: { push: true, pull: true } }, owners).role).toBe('edit');
    expect(roleOf({ login: 'acme', permissions: { push: true } }, { design: ['@acme/design'], tech: [] }).role).toBe('edit');
    // A reader listed as owner stays Can view: approving needs write access.
    expect(roleOf({ login: 'ann', role_name: 'read' }, owners)).toEqual({ role: 'view', reviews: [] });
  });

  it('keeps the owner lists of an admin for the line under their name', () => {
    const m = roleOf({ login: 'ann', role_name: 'admin' }, { design: ['ann'], tech: ['ann'] });
    expect(m).toEqual({ role: 'admin', reviews: ['design', 'tech'] });
    expect(memberLine(m)).toBe('Reviews design and code');
    expect(roleText(m)).toBe('Admin');
  });

  it('words each member', () => {
    // A Reviewer's role names what they review: the line never says it again in other words.
    expect(memberLine({ role: 'reviewer', reviews: ['design'] })).toBe('Changes the library and approves changes');
    expect(memberLine({ role: 'reviewer', reviews: ['design', 'tech'] })).toBe('Changes the library and approves changes');
    expect(memberLine({ role: 'admin', reviews: ['tech'] })).toBe('Reviews code');
    // Can edit with GitHub builds in the code; by email, a designer explores in Bridge.
    expect(memberLine({ role: 'edit', reviews: [] })).toBe('Builds and changes the code');
    expect(memberLine({ role: 'edit', reviews: [], via: 'email' })).toBe('Explores designs and suggests library changes');
    expect(memberLine({ role: 'reviewer', reviews: [] })).toBe('Changes the library and approves changes');
    expect(memberLine({ role: 'view', reviews: [] })).toBe('Sees everything in Studio and the library');
    expect(choiceOf({ role: 'reviewer', reviews: ['tech'] })).toEqual({ role: 'reviewer', reviewAs: 'tech' });
    expect(roleText({ role: 'reviewer', reviews: ['design', 'tech'] })).toBe('Reviewer: design and code');
  });

  it('says each sample person what they do, and one word for a reviewer by email', () => {
    // Dana runs the team and reviews; Ann manages Acme Prints and reviews; Sofia designs; Malik builds.
    expect(memberLine({ role: 'admin', reviews: [], lead: true, via: 'email' })).toBe('Reviews designs and runs the team');
    expect(memberLine({ role: 'edit', reviews: [], lead: true, via: 'email', manages: ['Acme Prints'] })).toBe('Product manager of Acme Prints, reviews designs');
    expect(memberLine({ role: 'edit', reviews: [], via: 'email' })).toBe('Explores designs and suggests library changes');
    expect(memberLine({ role: 'edit', reviews: [] })).toBe('Builds and changes the code');
    expect(memberLine({ role: 'view', reviews: [], via: 'email', manages: ['Acme CRM'] })).toBe('Product manager of Acme CRM');
    // The invite dialog's word: never "Design lead" in one place and "Reviewer" in another.
    expect(roleText({ role: 'edit', reviews: [], lead: true })).toBe(ROLE_WORDS.reviewer.label);
    expect(roleText({ role: 'admin', reviews: [], lead: true })).toBe('Admin');
  });

  it('finds the products each person manages, by login or member reference', () => {
    const members: { login: string; via?: 'email'; manages?: string[] }[] = [
      { login: 'email-member-0', via: 'email' },
      { login: 'acme-malik' },
      { login: 'email-member-1', via: 'email' },
    ];
    const out = withManages(members, { prints: { name: 'Ann', ref: 'b9cc21753b627efd' }, crm: { name: 'Malik', login: 'Acme-Malik' } }, { refs: { 'email-member-0': 'b9cc21753b627efd', 'email-member-1': '0406ec723c59bb8d' }, names: { prints: 'Acme Prints' } });
    expect(out[0]!.manages).toEqual(['Acme Prints']);
    expect(out[1]!.manages).toEqual(['crm']);
    expect(out[2]!.manages).toBeUndefined();
  });
});

describe('who may change what', () => {
  const m = (role: Member['role'], you = false) => ({ role, you });

  it('nobody but an admin, and never on their own row', () => {
    expect(memberActions(m('edit'), { canManage: false, admins: 1 })).toEqual({ changeRole: false, makeAdmin: false, remove: false });
    expect(memberActions(m('admin', true), { canManage: true, admins: 2 })).toEqual({ changeRole: false, makeAdmin: false, remove: false });
    expect(memberActions(m('edit'), { canManage: true, admins: 1 })).toEqual({ changeRole: true, makeAdmin: true, remove: true });
  });

  it('an admin signed in by email manages email members only: a GitHub member reads as text', () => {
    expect(memberActions({ role: 'edit', via: 'email' }, { canManage: true, admins: 2, emailAdmin: true })).toEqual({ changeRole: true, makeAdmin: true, remove: true });
    expect(memberActions({ role: 'edit' }, { canManage: true, admins: 2, emailAdmin: true })).toEqual({ changeRole: false, makeAdmin: false, remove: false });
    expect(memberActions({ role: 'edit' }, { canManage: true, admins: 2 })).toEqual({ changeRole: true, makeAdmin: true, remove: true });
    expect(MEMBERS_WORDS.githubPeople).toMatch(/signed in with GitHub as an admin of the repository/);
    for (const t of [MEMBERS_WORDS.githubPeople]) expect(t).not.toMatch(/\u2014/);
  });

  it('never leaves the team without an admin', () => {
    expect(memberActions(m('admin'), { canManage: true, admins: 1 })).toEqual({ changeRole: false, makeAdmin: false, remove: false });
    expect(memberActions(m('admin'), { canManage: true, admins: 2 })).toEqual({ changeRole: true, makeAdmin: false, remove: true });
    expect(adminCount([{ role: 'admin' }, { role: 'edit' }, { role: 'admin' }])).toBe(2);
  });

  it('lists you first, then by role and name', () => {
    const xs = sortMembers([
      { name: 'Zed', role: 'view' },
      { name: 'Bo', role: 'admin' },
      { name: 'Me', role: 'edit', you: true },
      { name: 'Al', role: 'reviewer' },
    ]);
    expect(xs.map((x) => x.name)).toEqual(['Me', 'Bo', 'Al', 'Zed']);
  });
});

describe('the email field', () => {
  it('takes several emails at once, lower case, valid and new only', () => {
    expect(parseEmails('Ann@Acme.example, leo@acme.example; nope bad@ <priya@acme.example>', ['leo@acme.example'])).toEqual(['ann@acme.example', 'priya@acme.example']);
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.de')).toBe(false);
  });

  it('suggests known people by name or email, marks people already in, and offers a new typed address', () => {
    const s = acmeTeam();
    const f = { people: s.people, members: s.members, pending: s.pending, chosen: [] as string[], team: 'Acme Design' };
    const mal = inviteOptions('mal', f);
    expect(mal.map((o) => o.label)).toEqual(['Malik', 'Mal Reyes']);
    expect(mal[0]).toMatchObject({ disabled: true, description: 'malik@acme.example · Already in Acme Design' });
    expect(mal[1]).toMatchObject({ value: 'mal.reyes@acme.example' });
    expect(mal[1]!.disabled).toBeUndefined();
    expect(inviteOptions('new@acme.example', f)).toContainEqual({ value: 'new@acme.example', label: 'new@acme.example', description: 'Invite by email' });
    // Pending invites count as in the team.
    expect(inviteOptions('priya@acme.example', f).at(-1)).toMatchObject({ disabled: true });
    // A member: listed, disabled, already in.
    expect(inviteOptions('sofia', f)).toEqual([expect.objectContaining({ label: 'Sofia', disabled: true })]);
    // Two people the field suggests who are not in the team yet.
    expect(inviteOptions('', f).filter((o) => !o.disabled).map((o) => o.label)).toEqual(['Mal Reyes', 'Jonas Berg']);
    // Chosen addresses stay listed so their chips keep a label.
    expect(inviteOptions('', { ...f, chosen: ['x@y.co'] }).some((o) => o.value === 'x@y.co')).toBe(true);
  });

  it('sends the GitHub account of a known person along, so an organization member can be added directly', () => {
    expect(inviteePeople(['ann@acme.example', 'new@acme.example'], [{ name: 'Ann', email: 'ann@acme.example', login: 'ann' }])).toEqual([{ email: 'ann@acme.example', login: 'ann' }, { email: 'new@acme.example' }]);
  });

  it('counts the invites on the button and words the outcome', () => {
    expect(sendLabel(0)).toBe('Send invites');
    expect(sendLabel(1)).toBe('Send 1 invite');
    expect(sendLabel(2)).toBe('Send 2 invites');
    expect(sentSummary([{ status: 'sent' }, { status: 'sent' }, { status: 'added' }, { status: 'failed' }])).toBe('2 invites sent, 1 added to the team, 1 not sent.');
    expect(sentSummary([])).toBe('');
  });

  it('says when an invite went out', () => {
    const now = Date.UTC(2026, 9, 22, 9);
    expect(pendingLine(new Date(now - 2 * 86400_000).toISOString(), now)).toBe('Invited 2 days ago, not joined yet');
    expect(pendingLine(new Date(now - 86400_000).toISOString(), now)).toBe('Invited yesterday, not joined yet');
    expect(pendingLine(new Date(now - 60_000).toISOString(), now)).toBe('Invited just now, not joined yet');
  });
});

describe('contexts', () => {
  it('reads the sample team as any team, never mixed with the workspace', () => {
    expect(membersContext('acme-design-demo/bridge-demo-ds', false)).toBe('real');
    expect(membersContext('the-bridge-company/ai-design-system-demo', false)).toBe('real');
    expect(membersContext('acme/ds', false)).toBe('real');
    expect(membersContext('acme/ds', true)).toBe('none');
    expect(membersContext(null, false)).toBe('none');
  });
});

describe('journey fixes: the invite dialog way out and the members list wait', () => {
  it('reads Done once invites went out and nothing is left to send', () => {
    expect(closeLabel(true, false, 0)).toBe('Cancel');
    expect(closeLabel(true, true, 0)).toBe('Done');
    expect(closeLabel(true, true, 2)).toBe('Cancel');
    expect(closeLabel(false, true, 0)).toBe('Close');
  });
  it('waits while a signed-in session is not read yet, never for a signed-out visitor', () => {
    expect(membersPending({ token: true, viewer: false, access: false })).toBe(true);
    expect(membersPending({ token: true, viewer: true, access: false })).toBe(true);
    expect(membersPending({ token: true, viewer: true, access: true })).toBe(false);
    expect(membersPending({ token: false, viewer: false, access: false })).toBe(false);
  });
});
