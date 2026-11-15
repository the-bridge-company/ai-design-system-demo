// @vitest-environment jsdom
// Settings > Billing: nothing where the server says billing is off for the team (as shipped), nothing for a member who
// is not admin; for an
// admin, the tier and what it includes, the founding line, Move to Team with the quantity and price shown before
// paying, Manage billing once there is a customer. Words never carry an em dash.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BILLING_WORDS, type BillingStatus } from '../../../lib/billing';

let people: Record<string, unknown> | null = null;
vi.mock('./members-state', () => ({ useTeamPeople: () => people }));
const getBillingStatus = vi.fn();
const checkoutUrl = vi.fn();
const portalUrl = vi.fn();
vi.mock('../../../scripts/billing-session', () => ({
  getBillingStatus: (...a: unknown[]) => getBillingStatus(...a),
  checkoutUrl: (...a: unknown[]) => checkoutUrl(...a),
  portalUrl: (...a: unknown[]) => portalUrl(...a),
}));

const { default: BillingCard, BillingBand, BillingRows, go } = await import('./BillingCard');

const admin = { context: 'real', repo: 'acme/ds', team: 'Acme DS', canManage: true, members: [] };
const free: BillingStatus = { on: true, tier: 'free', founding: false, status: null, periodEnd: null, cancelAtPeriodEnd: false, currency: null, interval: null, quantity: null, editors: 4, checkoutQuantity: 4, canManage: false };

describe('who sees Billing', () => {
  beforeEach(() => getBillingStatus.mockReset().mockResolvedValue(free));
  afterEach(() => {
    people = null;
  });

  it('a member who is not admin sees nothing, and nothing is asked', () => {
    people = { ...admin, canManage: false };
    const { container } = render(createElement(BillingCard));
    expect(container.innerHTML).toBe('');
    expect(getBillingStatus).not.toHaveBeenCalled();
  });

  it('an admin sees the band where the server says billing is on for the team (launched, or a test team)', async () => {
    people = admin;
    render(createElement(BillingCard));
    expect(await screen.findByRole('heading', { name: 'Billing' })).toBeTruthy();
    expect(getBillingStatus).toHaveBeenCalledWith('acme/ds');
  });

  it('nothing where the server says off for the team (null): billing off and no test team is today', async () => {
    people = admin;
    getBillingStatus.mockResolvedValue(null);
    const { container } = render(createElement(BillingCard));
    await waitFor(() => expect(getBillingStatus).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('a team made in Bridge: the same band in its workspace Settings', async () => {
    render(createElement(BillingBand, { team: '_team/00112233aabbccdd', layout: 'site' }));
    expect(await screen.findByRole('heading', { name: 'Billing' })).toBeTruthy();
    expect(getBillingStatus).toHaveBeenCalledWith('_team/00112233aabbccdd');
  });
});

describe('what an admin reads and does', () => {
  beforeEach(() => {
    go.to = vi.fn();
    checkoutUrl.mockReset().mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_1');
    portalUrl.mockReset().mockResolvedValue('https://billing.stripe.com/p/session/test_1');
  });

  it('Free: the quantity and price before paying, then Stripe with the choice made', async () => {
    render(createElement(BillingRows, { team: 'acme/ds', status: free }));
    expect(screen.getByText(BILLING_WORDS.includes.free)).toBeTruthy();
    // jsdom speaks en-US: USD first, like the pricing page.
    expect(screen.getByText('4 editors: $56 a month, billed $672 a year.')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'EUR' }));
    expect(screen.getByText('4 editors: 48 € a month, billed 576 € a year.')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Monthly' }));
    expect(screen.getByText('4 editors: 60 € a month, billed monthly.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: BILLING_WORDS.pay }));
    await waitFor(() => expect(go.to).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'));
    expect(checkoutUrl).toHaveBeenCalledWith('acme/ds', 'eur', 'monthly');
  });

  it('a founding team: the founding line, nothing to pay', () => {
    render(createElement(BillingRows, { team: 'acme/ds', status: { ...free, founding: true } }));
    expect(screen.getByText(BILLING_WORDS.founding)).toBeTruthy();
    expect(screen.queryByRole('button', { name: BILLING_WORDS.pay })).toBeNull();
  });

  it('Team: what is paid for, when it renews, Manage billing', async () => {
    render(createElement(BillingRows, { team: 'acme/ds', status: { ...free, tier: 'team', status: 'active', periodEnd: '2028-03-01T00:00:00Z', quantity: 6, currency: 'eur', interval: 'yearly', canManage: true } }));
    expect(screen.getByText(BILLING_WORDS.paidFor(6))).toBeTruthy();
    expect(screen.getByText('Renews on 1 March 2028.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: BILLING_WORDS.pay })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: BILLING_WORDS.manage }));
    await waitFor(() => expect(go.to).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_1'));
  });

  it('a refusal is said under the card', async () => {
    checkoutUrl.mockRejectedValue(new Error('The payment service did not answer. Try again in a minute.'));
    render(createElement(BillingRows, { team: 'acme/ds', status: free }));
    await userEvent.click(screen.getByRole('button', { name: BILLING_WORDS.pay }));
    expect(await screen.findByText('The payment service did not answer. Try again in a minute.')).toBeTruthy();
  });
});
