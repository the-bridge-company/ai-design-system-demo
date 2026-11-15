// @vitest-environment jsdom
// A behavior request's decision zone: today's sentence struck, an arrow, the wanted one, who asked; for the person who
// decides, Make it the default, Not now and Ask <first name> (a question in a Dialog). Readers see no action. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import BehaviorDecision, { type BehaviorDecisionActions } from './BehaviorDecision';

const base = { today: 'Closes on Escape', wanted: 'Keeps the list open on Escape', asker: 'Dana Kim', askerFirst: 'Dana', where: 'Orders, the filter bar' };

const actions = (over: Partial<BehaviorDecisionActions> = {}): BehaviorDecisionActions => ({
  onDefault: vi.fn(async () => {}),
  onNotNow: vi.fn(),
  onAsk: vi.fn(async () => {}),
  ...over,
});

describe('BehaviorDecision', () => {
  it('says what is asked in one line, who asked, and offers the three actions to who decides', async () => {
    const a = actions();
    const { container } = render(createElement(BehaviorDecision, { ...base, actions: a }));
    expect(screen.getByRole('heading', { name: 'Dana Kim asks to change how it behaves' })).toBeTruthy();
    const line = container.querySelector('.rq-bh-line')!;
    expect(line.querySelector('s')?.textContent).toBe('Closes on Escape');
    expect(line.textContent).toContain('Today: Closes on Escape');
    expect(line.textContent).toContain('Wanted: Keeps the list open on Escape');
    expect(screen.getByText('It gets in the way in Orders, the filter bar.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Make it the default', 'Not now', 'Ask Dana']);
    // Never for one product only: a behavior is the library's.
    expect(container.textContent).not.toMatch(/one product|only for/i);
    expect(container.textContent).not.toMatch(/\u2014/);
    await expectNoAxeViolations(container);
  });

  it('shows no action to a reader', async () => {
    const { container } = render(createElement(BehaviorDecision, { ...base, today: '', where: undefined, actions: null }));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.textContent).toContain('Something it does not do yet: Keeps the list open on Escape');
    await expectNoAxeViolations(container);
  });

  it('makes it the default, and says what went wrong next to the action', async () => {
    const user = userEvent.setup();
    const fail = actions({ onDefault: vi.fn(async () => Promise.reject(new Error('GitHub did not take the decision on #9.'))) });
    render(createElement(BehaviorDecision, { ...base, actions: fail }));
    await user.click(screen.getByRole('button', { name: 'Make it the default' }));
    expect(fail.onDefault).toHaveBeenCalledOnce();
    expect(await screen.findByText('GitHub did not take the decision on #9.')).toBeTruthy();
  });

  it('Not now opens the decline with its reason, from the button', async () => {
    const user = userEvent.setup();
    const a = actions();
    render(createElement(BehaviorDecision, { ...base, actions: a }));
    const btn = screen.getByRole('button', { name: 'Not now' });
    await user.click(btn);
    expect(a.onNotNow).toHaveBeenCalledWith(btn);
  });

  it('asks the requester in a dialog: never empty, then says it was sent', async () => {
    const user = userEvent.setup();
    const a = actions();
    render(createElement(BehaviorDecision, { ...base, actions: a }));
    await user.click(screen.getByRole('button', { name: 'Ask Dana' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ask Dana' });
    await expectNoAxeViolations(dialog);
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(a.onAsk).not.toHaveBeenCalled();
    expect(await screen.findByText('Write your question first: the requester reads it.')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: /Your question/ }), 'Which screen does it block?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(a.onAsk).toHaveBeenCalledWith('Which screen does it block?');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Question sent to Dana. The request waits for you to decide.');
  });
});
