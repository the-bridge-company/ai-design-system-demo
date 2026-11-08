// @vitest-environment jsdom
// Invite collaborators (board I1), the role picker (I2) and Settings > Members (I3, I4) from the keyboard, with axe:
// every team, the sample team included, sends through the invites server (which refuses the sample team's visitor in
// the demo dialog's words, 403 `demo`), a site without it says so and sends nothing, a reader sees roles as text.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import type { KnownPerson, Member, PendingInvite } from '../../../lib/invites';
import type { MembersData } from '../../../scripts/members';
import InviteDialog from './InviteDialog';
import MembersSection from './MembersSection';

const page = vi.hoisted(() => ({ data: null as unknown as MembersData }));
const demo = vi.hoisted(() => ({ openMakeItYours: vi.fn(async () => {}) }));
const api = vi.hoisted(() => {
  class InvitesUnavailable extends Error {
    constructor() {
      super('Invites are not available yet on this site.');
      this.name = 'InvitesUnavailable';
    }
  }
  return {
    InvitesUnavailable,
    sendInvites: vi.fn(async (_repo: string, _c: unknown, people: { email: string }[]) => people.map((p) => ({ email: p.email, status: 'sent' as const }))),
    listInvites: vi.fn(async () => ({ invites: [], personal: false })),
    setMemberRole: vi.fn(async () => ({ ok: true })),
    removeMember: vi.fn(async () => ({ ok: true })),
    resendInvite: vi.fn(async () => ({})),
    setInviteRole: vi.fn(async () => ({})),
    cancelInvite: vi.fn(async () => ({ ok: true })),
  };
});

vi.mock('../../../scripts/members', () => ({ loadMembers: async () => page.data }));
vi.mock('../../../scripts/demo-gate', () => demo);
vi.mock('../../../scripts/invites-api', () => api);

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

/** The sample team as any team reads it: its people, the visitor (Dana) an admin of it. */
const sample = (): MembersData => {
  const s = acmeTeam();
  return { context: 'real', repo: 'acme-design-demo/bridge-demo-ds', team: 'Acme Design', ...s, canManage: true, personal: false, complete: true, invites: true };
};
/** The invites server's refusal of a write by the sample team's visitor (api/invites demoRefusal). */
const refused = () => Object.assign(new Error('Nothing is sent from Acme Design. Get started to do this with your own team.'), { name: 'InvitesError', status: 403, code: 'demo' });

const real = (over: Partial<MembersData> = {}): MembersData => ({
  context: 'real',
  repo: 'acme/ds',
  team: 'acme/ds',
  members: [
    { login: 'flo', name: 'Florian', role: 'admin', reviews: ['design', 'tech'], you: true },
    { login: 'ann', name: 'Ann', role: 'reviewer', reviews: ['design'] },
    { login: 'leo', name: 'Leo', role: 'edit', reviews: [] },
  ],
  pending: [{ id: 'p1', email: 'priya@acme.example', role: 'view', sentAt: new Date(Date.now() - 2 * 86400_000).toISOString() }],
  people: [{ name: 'Mal Reyes', email: 'mal@acme.example', login: 'mal' }],
  canManage: true,
  personal: false,
  complete: true,
  invites: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  page.data = sample();
});

async function openDialog() {
  const user = userEvent.setup();
  render(createElement(InviteDialog, { open: true, onOpenChange: () => {} }));
  const dialog = await screen.findByRole('dialog', { name: 'Invite collaborators' });
  await within(dialog).findByLabelText('Work email');
  return { user, dialog };
}

describe('Invite collaborators', () => {
  it('says what happens, lists who has access and counts the invites on its one primary action', async () => {
    const { user, dialog } = await openDialog();
    expect(within(dialog).getByText('They get an email and land in your team with the role you pick. Reviewers also sign in with GitHub.')).toBeInTheDocument();
    // An admin is not told that only admins can invite.
    expect(dialog.textContent).not.toMatch(/Only admins/);
    expect(within(dialog).getByRole('heading', { name: /Who has access 6/ })).toBeInTheDocument();
    expect(within(dialog).getByText('priya@acme.example')).toBeInTheDocument();
    const send = within(dialog).getByRole('button', { name: 'Send invites' });
    expect(send).toBeDisabled();

    // Two addresses typed from the keyboard become two chips.
    const field = within(dialog).getByLabelText('Work email');
    await user.click(field);
    await user.keyboard('new@acme.example{Enter}');
    await user.keyboard('other@acme.example,');
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Role: Can edit' }));
    expect(within(dialog).getByRole('button', { name: 'Send 2 invites' })).toBeEnabled();
    expect(dialog.textContent).not.toMatch(/github\.com|repository|permission|installation|\u2014/i);
    await expectNoAxeViolations(document.body);
  });

  it('takes several pasted addresses at once', async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Work email'));
    await user.paste('a@acme.example, b@acme.example c@acme.example');
    // Tab leaves the field: its list closes and the role picker takes the focus.
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Send 3 invites' })).toBeInTheDocument();
  });

  it('on the sample team, sending goes to the server as on any team; its refusal says nothing more than the demo dialog', async () => {
    api.sendInvites.mockRejectedValueOnce(refused());
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Work email'));
    await user.keyboard('new@acme.example{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Send 1 invite' }));
    await waitFor(() => expect(api.sendInvites).toHaveBeenCalledWith('acme-design-demo/bridge-demo-ds', { role: 'edit' }, [{ email: 'new@acme.example' }]));
    expect(within(dialog).queryByText(/Nothing is sent from Acme Design/)).toBeNull();
  });

  it('on a real team, sends the emails with the role, and the GitHub account of a known person', async () => {
    page.data = real();
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Work email'));
    await user.keyboard('mal@acme.example{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Send 1 invite' }));
    await waitFor(() => expect(api.sendInvites).toHaveBeenCalledWith('acme/ds', { role: 'edit' }, [{ email: 'mal@acme.example', login: 'mal' }]));
    expect(await within(dialog).findByText('1 invite sent.')).toBeInTheDocument();
    expect(demo.openMakeItYours).not.toHaveBeenCalled();
  });

  it("says today's invite limit calmly when the server caps it, and keeps the emails to send later", async () => {
    page.data = real();
    const limit = Object.assign(new Error("You reached today's invite limit. Try again tomorrow."), { name: 'InvitesError', status: 429, code: 'limit' });
    api.sendInvites.mockRejectedValueOnce(limit);
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Work email'));
    await user.keyboard('x@acme.example{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Send 1 invite' }));
    const line = await within(dialog).findByText("You reached today's invite limit. Try again tomorrow.");
    expect(line).toHaveAttribute('data-tone', 'info');
    expect(within(dialog).getByRole('button', { name: 'Send 1 invite' })).toBeInTheDocument();
  });

  it('says when a pending invite was resent too often', async () => {
    page.data = real();
    api.resendInvite.mockRejectedValueOnce(Object.assign(new Error('This invite was just sent. Wait a few minutes, then send it again.'), { name: 'InvitesError', status: 429 }));
    const user = userEvent.setup();
    render(createElement(MembersSection));
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('This invite was just sent. Wait a few minutes, then send it again.')).toBeInTheDocument();
  });

  it('cancels a pending invite from its "More" menu, as in the Settings table', async () => {
    page.data = real();
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'More for priya@acme.example' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel invite' }));
    await waitFor(() => expect(api.cancelInvite).toHaveBeenCalledWith('acme/ds', 'p1'));
    expect(await within(dialog).findByText('The invite to priya@acme.example was cancelled.')).toBeInTheDocument();
    expect(within(dialog).queryByText('priya@acme.example')).toBeNull();
    await expectNoAxeViolations(document.body);
  });

  it('on the sample team, cancelling an invite goes to the server, which refuses it: the invite stays', async () => {
    api.cancelInvite.mockRejectedValueOnce(refused());
    const { user, dialog } = await openDialog();
    const more = within(dialog).getAllByRole('button', { name: /^More for / });
    expect(more.length).toBeGreaterThan(0);
    await user.click(more[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel invite' }));
    await waitFor(() => expect(api.cancelInvite).toHaveBeenCalled());
    expect(within(dialog).getByText('priya@acme.example')).toBeInTheDocument();
  });

  it('says invites are not available on a site without them, and cannot send', async () => {
    page.data = real({ invites: false });
    const { user, dialog } = await openDialog();
    expect(within(dialog).getByText('Invites are not available yet on this site.')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('Work email'));
    await user.keyboard('x@acme.example{Enter}');
    expect(within(dialog).getByRole('button', { name: 'Send 1 invite' })).toBeDisabled();
  });

  it('shows a reader who has access and why they cannot invite, with no form', async () => {
    page.data = real({ canManage: false });
    render(createElement(InviteDialog, { open: true, onOpenChange: () => {} }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite collaborators' });
    expect(await within(dialog).findByText('Only admins can invite people or change roles.')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Work email')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Send/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Resend/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^More for / })).toBeNull();
  });

  it('says to connect a design system first in the workspace', async () => {
    page.data = { ...real(), context: 'none', members: [], pending: [] };
    render(createElement(InviteDialog, { open: true, onOpenChange: () => {} }));
    expect(await screen.findByText('Connect your design system first')).toBeInTheDocument();
  });
});

describe('the role picker', () => {
  it('unfolds "They review as" only for Reviewer, from the keyboard, and names the choice', async () => {
    const { user, dialog } = await openDialog();
    const trigger = within(dialog).getByRole('button', { name: 'Role: Can edit' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const roles = await screen.findByRole('radiogroup', { name: 'Role' });
    expect(within(roles).getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    expect(screen.queryByRole('radiogroup', { name: 'They review as' })).toBeNull();
    expect(screen.getByText('Also approves changes before they ship.')).toBeInTheDocument();

    await user.click(within(roles).getByRole('radio', { name: /Reviewer/ }));
    const reviewAs = await screen.findByRole('radiogroup', { name: 'They review as' });
    expect(within(reviewAs).getByRole('radio', { name: /Designer/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Role: Reviewer: design' })).toBeInTheDocument();

    within(reviewAs).getByRole('radio', { name: /Designer/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(reviewAs).getByRole('radio', { name: /Developer/ })).toHaveAttribute('aria-checked', 'true');
    // The outer list did not move with the inner arrow key.
    expect(within(roles).getByRole('radio', { name: /Reviewer/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Role: Reviewer: code' })).toBeInTheDocument();
    // The stacked cards (board I2): each radio reads its whole line, and the vertical arrows move between them too.
    expect(within(reviewAs).getByRole('radio', { name: 'Developer How it is built' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowUp}');
    expect(within(reviewAs).getByRole('radio', { name: 'Designer How it looks and works' })).toHaveAttribute('aria-checked', 'true');
    expect(within(roles).getByRole('radio', { name: /Reviewer/ })).toHaveAttribute('aria-checked', 'true');
    await expectNoAxeViolations(document.body);
    // Escape closes the menu and gives focus back to the trigger, which names the choice.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Role' })).toBeNull());
    expect(within(dialog).getByRole('button', { name: 'Role: Reviewer: design' })).toHaveFocus();
    expect(dialog).toBeInTheDocument();
  });

  it('offers the four roles, Can view first, with what each one adds (board I2)', async () => {
    page.data = real();
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Role: Can edit' }));
    const roles = await screen.findByRole('radiogroup', { name: 'Role' });
    const radios = within(roles).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    [/Can view/, /Can edit/, /Reviewer/, /Admin/].forEach((name, i) => expect(radios[i]).toBe(within(roles).getByRole('radio', { name })));
    expect(screen.getByText('Sees everything in Studio and the library.')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('disables Admin on a personal account, and says why', async () => {
    page.data = real({ personal: true });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Role: Can edit' }));
    const roles = await screen.findByRole('radiogroup', { name: 'Role' });
    expect(within(roles).getByRole('radio', { name: /Can view/ })).not.toHaveAttribute('aria-disabled');
    expect(within(roles).getByRole('radio', { name: /Admin/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/everyone you add can edit it/)).toBeInTheDocument();
  });
});

describe('Settings > Members', () => {
  it('an admin gets Invite collaborators, a role picker and a More menu per person, and confirms a removal in the row', async () => {
    page.data = real();
    const user = userEvent.setup();
    render(createElement(MembersSection));
    expect(await screen.findByRole('heading', { name: /Members 4/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite collaborators' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Role for Ann: Reviewer: design' })).toBeInTheDocument();
    // The admin's own row: role as text, no menu.
    expect(screen.queryByRole('button', { name: 'More for Florian' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'More for Leo' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from team' }));
    expect(screen.getByText('Remove Leo from acme/ds? They lose access on GitHub too.')).toBeInTheDocument();
    expect(api.removeMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('acme/ds', 'leo'));
    expect(await screen.findByText('Leo was removed from acme/ds.')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('changes a role through the server and makes someone admin from their role', async () => {
    page.data = real();
    const user = userEvent.setup();
    render(createElement(MembersSection));
    await user.click(await screen.findByRole('button', { name: /^Role for Ann/ }));
    await user.click(await screen.findByRole('radio', { name: /^Admin/ }));
    await waitFor(() => expect(api.setMemberRole).toHaveBeenCalledWith('acme/ds', 'ann', { role: 'admin' }));
  });

  it('resends a pending invite on its line', async () => {
    page.data = real();
    const user = userEvent.setup();
    render(createElement(MembersSection));
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(api.resendInvite).toHaveBeenCalledWith('acme/ds', 'p1'));
  });

  it("changes a pending invite's role with the same picker, without sending again", async () => {
    page.data = real();
    const user = userEvent.setup();
    render(createElement(MembersSection));
    // Priya was invited to view: the picker shows Can view chosen, and moves her to another role.
    await user.click(await screen.findByRole('button', { name: 'Role for priya@acme.example: Can view' }));
    expect(screen.getByRole('radio', { name: /Can view/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(await screen.findByRole('radio', { name: /Can edit/ }));
    await waitFor(() => expect(api.setInviteRole).toHaveBeenCalledWith('acme/ds', 'p1', { role: 'edit' }));
    expect(api.resendInvite).not.toHaveBeenCalled();
    expect(await screen.findByText('priya@acme.example will join as Can edit.')).toBeInTheDocument();
  });

  it('a reader sees roles as text, no invite button and no controls (board I4)', async () => {
    page.data = real({ canManage: false });
    render(createElement(MembersSection));
    expect(await screen.findByText('Who is in acme/ds and what each person can do. Only admins can invite people or change roles.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Reviewer: design')).toBeInTheDocument();
    expect(screen.getByText('Can view')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('on the sample team, a role change goes to the server, which refuses it: the role stays', async () => {
    api.setMemberRole.mockRejectedValueOnce(refused());
    const user = userEvent.setup();
    render(createElement(MembersSection));
    await user.click(await screen.findByRole('button', { name: 'Role for Leo: Can edit' }));
    await user.click(await screen.findByRole('radio', { name: /Admin/ }));
    await waitFor(() => expect(api.setMemberRole).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Role for Leo: Can edit' })).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is sent from Acme Design/)).toBeNull();
  });
});
