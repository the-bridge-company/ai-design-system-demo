// @vitest-environment jsdom
// Request access (/request/): the form with ?email= prefilled, inline errors in the page words and focus on the first
// one, the keyboard path to Sent, the remembered request shown as Pending on the next visit, Change my request, the
// server's 429 and a network error, and no axe violation in any state.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { ACCESS_STORE_KEY } from '../../../lib/access-request';
import RequestAccess, { accessApi } from './RequestAccess';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let sent: Record<string, string>[] = [];
let reply: () => Promise<Response> | Response;

beforeEach(() => {
  sent = [];
  reply = () => json(200, { ok: true, at: '2026-11-23T10:00:00.000Z' });
  vi.spyOn(accessApi, 'send').mockImplementation(async (body) => {
    sent.push(body);
    return reply();
  });
  localStorage.clear();
  history.replaceState(null, '', '/request/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function fill(email = 'ana@acme.com') {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Work email');
  await user.clear(field);
  if (email) await user.type(field, email);
  await user.type(screen.getByLabelText('Company'), 'Acme');
  await user.type(screen.getByLabelText('What do you want to fix first?'), 'Our tokens drift from Figma');
  return user;
}

describe('Request access', () => {
  it('shows the form with one primary action, Sign in and the demo', async () => {
    const { container } = render(createElement(RequestAccess));
    expect(screen.getByRole('heading', { level: 1, name: 'Request access to Bridge' })).toBeInTheDocument();
    expect(screen.getByText('We read every request and reply within 2 working days.')).toBeInTheDocument();
    expect(screen.getByLabelText('Where your design system lives (optional)')).toBeInTheDocument();
    expect(screen.getByText('Repository, Storybook or docs link. Helps us review faster.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request access' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin/');
    expect(screen.getByRole('link', { name: 'Open the demo' })).toHaveAttribute('href', '/studio/acme-design-demo/bridge-demo-ds/');
    await expectNoAxeViolations(container);
  });

  it('prefills the email from ?email=', () => {
    history.replaceState(null, '', '/request/?email=ana%40acme.com');
    render(createElement(RequestAccess));
    expect(screen.getByLabelText('Work email')).toHaveValue('ana@acme.com');
  });

  it('says how to fix each field inline, focuses the first, and sends nothing', async () => {
    const user = userEvent.setup();
    const { container } = render(createElement(RequestAccess));
    await user.type(screen.getByLabelText('Work email'), 'ana');
    await user.type(screen.getByLabelText('Where your design system lives (optional)'), 'github.com/acme');
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(screen.getByText('Enter a work email, like ana@acme.com.')).toBeInTheDocument();
    expect(screen.getByText('Add your company name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full link, starting with https://')).toBeInTheDocument();
    expect(screen.getByText('Tell us in a few words what you want to fix first.')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveFocus();
    expect(sent).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('sends with the keyboard, then says when and to whom we reply, and remembers it', async () => {
    const { container } = render(createElement(RequestAccess));
    const user = await fill();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Request received.' })).toBeInTheDocument());
    expect(sent).toEqual([{ email: 'ana@acme.com', company: 'Acme', where: '', fix: 'Our tokens drift from Figma' }]);
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.textContent).toContain('Sent on 23 November 2026. We reply to ana@acme.com within 2 working days, with an invite link. Your founding place is saved.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Continue the demo' })).toHaveAttribute('href', '/studio/acme-design-demo/bridge-demo-ds/');
    expect(screen.getByText(/Wrong email\?/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(ACCESS_STORE_KEY)!)).toEqual({ email: 'ana@acme.com', at: '2026-11-23T10:00:00.000Z' });
    await expectNoAxeViolations(container);
    // Change my request: the form again, the email kept.
    await user.click(screen.getByRole('button', { name: 'Change my request' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Request access to Bridge' })).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveValue('ana@acme.com');
  });

  it('shows a remembered request as waiting for review, in three steps', async () => {
    localStorage.setItem(ACCESS_STORE_KEY, JSON.stringify({ email: 'ana@acme.com', at: '2026-11-20T09:00:00.000Z' }));
    const { container } = render(createElement(RequestAccess));
    expect(screen.getByRole('heading', { level: 1, name: 'Your request is waiting for review' })).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Your request' });
    expect(steps.querySelectorAll('li')).toHaveLength(3);
    expect(steps.textContent).toContain('20 November 2026');
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.textContent).toContain('We reply to ana@acme.com within 2 working days. Your founding place is saved.');
    expect(steps.querySelector('[aria-current="step"]')!.textContent).toContain('Reviewed');
    expect(screen.getByRole('link', { name: 'Continue the demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change my request' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('promises no founding place for a request sent after 31 March 2027', () => {
    localStorage.setItem(ACCESS_STORE_KEY, JSON.stringify({ email: 'ana@acme.com', at: '2027-04-02T09:00:00.000Z' }));
    render(createElement(RequestAccess));
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.textContent).not.toMatch(/founding/i);
  });

  it('opens the form when the address asks for another email than the one remembered', () => {
    localStorage.setItem(ACCESS_STORE_KEY, JSON.stringify({ email: 'ana@acme.com', at: '2026-11-20T09:00:00.000Z' }));
    history.replaceState(null, '', '/request/?email=leo%40acme.com');
    render(createElement(RequestAccess));
    expect(screen.getByLabelText('Work email')).toHaveValue('leo@acme.com');
  });

  it('says when to try again after the daily limit', async () => {
    reply = () => json(429, { error: 'limit', message: 'You sent several requests today. Try again tomorrow.' });
    render(createElement(RequestAccess));
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(await screen.findByText('You sent several requests today. Try again tomorrow.')).toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_STORE_KEY)).toBeNull();
  });

  it('says how to retry when the network fails', async () => {
    reply = () => Promise.reject(new TypeError('Failed to fetch'));
    render(createElement(RequestAccess));
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(await screen.findByText('Bridge could not send your request. Check your connection, then select Request access again.')).toBeInTheDocument();
  });

  it("shows the server's field errors in place", async () => {
    reply = () => json(400, { error: 'invalid', message: 'Add your company name.', fields: { company: 'Add your company name.' } });
    render(createElement(RequestAccess));
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(await screen.findByText('Add your company name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toHaveFocus();
  });
});
