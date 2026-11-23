// @vitest-environment jsdom
// The founder's queue (/admin/access/) against the /api/access contract with the network mocked: the summary line,
// one row per request with Not yet and Invite in the row, the over-cap warning, Not yet with a note in a dialog, the
// empty state, an invite link created and shown once with Copy, Revoke, and the sign-in and not-a-founder answers.
// Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import AccessAdmin, { adminApi } from './AccessAdmin';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const req = (email: string, over: Record<string, unknown> = {}) => ({ email, company: 'Acme', where: 'https://github.com/acme/ds', fix: 'Our tokens drift from Figma', at: '2026-11-20T10:00:00.000Z', status: 'pending', ...over });
const LINK = { id: 'a'.repeat(64), label: 'Leo at Globex', createdBy: 'Florian', createdAt: '2026-11-22T10:00:00.000Z', expiresAt: '2026-12-06T10:00:00.000Z', maxUses: 1, uses: 0, usedBy: [], state: 'valid' };
let sent: Record<string, unknown>[] = [];
let list: () => Response;
let reply: (b: Record<string, unknown>) => Response;

beforeEach(() => {
  sent = [];
  list = () => json(200, { requests: [req('ana@acme.example'), req('leo@globex.example', { company: 'Globex', where: '' })], links: [LINK], waiting: 2, week: { invited: 1, cap: 5 } });
  reply = () => json(200, { ok: true });
  vi.spyOn(adminApi, 'post').mockImplementation(async (body) => {
    sent.push(body);
    return body.action === 'list' ? list() : reply(body);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('access queue', () => {
  it('says how many wait and how many places are left, one row per request with its two actions, one primary', async () => {
    const { container } = render(createElement(AccessAdmin));
    expect(await screen.findByText('2 requests waiting · 4 of 5 places left this week')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Access requests' })).toBeInTheDocument();
    const rows = container.querySelectorAll('.aa-row');
    expect(rows).toHaveLength(2);
    const first = within(rows[0] as HTMLElement);
    expect(first.getByText('Acme')).toBeInTheDocument();
    expect(first.getByText('ana@acme.example')).toBeInTheDocument();
    expect(first.getByText('Our tokens drift from Figma')).toBeInTheDocument();
    expect(first.getByRole('link', { name: /github\.com\/acme\/ds/ })).toHaveAttribute('href', 'https://github.com/acme/ds');
    expect(first.getByText('Sent 20 November 2026')).toBeInTheDocument();
    expect(first.getByRole('button', { name: 'Invite' }).className).toMatch(/primary/);
    expect(first.getByRole('button', { name: 'Not yet' }).className).toMatch(/secondary/);
    expect(within(rows[1] as HTMLElement).getByText('No design system link')).toBeInTheDocument();
    // One primary action on the page: Invite on the first request waiting only.
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: 'Invite' }).className).toMatch(/secondary/);
    expect(container.querySelectorAll('button[class*="primary"]')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('invites: the row says so, the count moves, a toast confirms', async () => {
    reply = (b) => json(200, { request: req(String(b.email), { status: 'invited', approvedAt: '2026-11-23T10:00:00.000Z', approvedVia: 'queue' }), week: { invited: 2, cap: 5 } });
    const { container } = render(createElement(AccessAdmin));
    const user = userEvent.setup();
    const row = within((await screen.findByText('ana@acme.example')).closest('.aa-row') as HTMLElement);
    await user.click(row.getByRole('button', { name: 'Invite' }));
    expect(sent.at(-1)).toEqual({ action: 'invite', email: 'ana@acme.example' });
    expect(await screen.findByText('Invited 23 November 2026')).toBeInTheDocument();
    expect(screen.getByText('1 request waiting · 3 of 5 places left this week')).toBeInTheDocument();
    expect(await screen.findByText('Invited. ana@acme.example gets the sign-in email now.')).toBeInTheDocument();
    expect(container.querySelectorAll('.aa-row')).toHaveLength(2);
  });

  it('warns over the weekly cap and still lets the founder invite', async () => {
    list = () => json(200, { requests: [req('ana@acme.example')], links: [], waiting: 1, week: { invited: 5, cap: 5 } });
    render(createElement(AccessAdmin));
    expect(await screen.findByRole('alert')).toHaveTextContent("This week's 5 places are taken. You can still invite: it is your call.");
    expect(screen.getByText('1 request waiting · 0 of 5 places left this week')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled();
  });

  it('Not yet asks for an optional note in a dialog, then sends it', async () => {
    reply = (b) => json(200, { request: req(String(b.email), { company: 'Globex', where: '', status: 'declined', declinedAt: '2026-11-23T10:00:00.000Z', note: b.note }) });
    render(createElement(AccessAdmin));
    const user = userEvent.setup();
    const row = within((await screen.findByText('leo@globex.example')).closest('.aa-row') as HTMLElement);
    await user.click(row.getByRole('button', { name: 'Not yet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Not yet for Globex?' });
    await expectNoAxeViolations(dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Note (optional)' }), 'Storybook teams first.');
    await user.click(within(dialog).getByRole('button', { name: 'Send not yet' }));
    await waitFor(() => expect(sent.at(-1)).toEqual({ action: 'not-yet', email: 'leo@globex.example', note: 'Storybook teams first.' }));
    expect(await screen.findByText('Not yet, 23 November 2026')).toBeInTheDocument();
  });

  it('shows an empty state when nobody asked yet, the links still below', async () => {
    list = () => json(200, { requests: [], links: [], waiting: 0, week: { invited: 0, cap: 5 } });
    const { container } = render(createElement(AccessAdmin));
    expect(await screen.findByRole('heading', { name: 'No requests yet' })).toBeInTheDocument();
    expect(screen.getByText('0 requests waiting · 5 of 5 places left this week')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invite links' })).toBeInTheDocument();
    expect(screen.getByText('No invite links yet.')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('creates an invite link, shows it once with Copy, and revokes one', async () => {
    const url = `https://bridge.test/signin/?access=${'B'.repeat(43)}`;
    reply = (b) =>
      b.action === 'create-link' ? json(200, { link: { ...LINK, id: 'b'.repeat(64), label: b.label, maxUses: b.maxUses, expiresAt: '2026-11-30T10:00:00.000Z' }, url }) : json(200, { ok: true });
    const { container } = render(createElement(AccessAdmin));
    const user = userEvent.setup();
    // After userEvent.setup(), which puts its own clipboard in place.
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await screen.findByText('Leo at Globex');
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(screen.getByText('Say who the link is for, in a few words.')).toBeInTheDocument();
    expect(sent.filter((b) => b.action === 'create-link')).toHaveLength(0);
    await user.type(screen.getByRole('textbox', { name: 'Who is it for' }), 'Ana at Acme');
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(sent.at(-1)).toEqual({ action: 'create-link', label: 'Ana at Acme', maxUses: 1, days: 14 });
    expect(await screen.findByText('Link created. Copy it now: Bridge shows it only once.')).toBeInTheDocument();
    expect(screen.getByText(url)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(container.querySelectorAll('.aa-link')).toHaveLength(2);
    await expectNoAxeViolations(container);
    const old = within(screen.getByText('Leo at Globex').closest('.aa-link') as HTMLElement);
    expect(old.getByText('0 of 1 used · expires 6 December 2026')).toBeInTheDocument();
    await user.click(old.getByRole('button', { name: 'Revoke' }));
    expect(sent.at(-1)).toEqual({ action: 'revoke-link', id: 'a'.repeat(64) });
    await waitFor(() => expect(screen.queryByText('Leo at Globex')).toBeNull());
  });

  it('asks to sign in without a session, and tells someone who is not a founder', async () => {
    list = () => json(401, { error: 'signin', message: 'Sign in to see access requests', signIn: '/signin/?next=%2Fadmin%2Faccess%2F' });
    const { unmount } = render(createElement(AccessAdmin));
    expect(await screen.findByRole('heading', { name: 'Sign in to see access requests' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin/?next=%2Fadmin%2Faccess%2F');
    unmount();
    list = () => json(403, { error: 'not_admin', message: 'x' });
    render(createElement(AccessAdmin));
    expect(await screen.findByText('This page is for the people who open Bridge to new teams. Your account is not one of them.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
