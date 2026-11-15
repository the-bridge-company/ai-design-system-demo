// The browser side of /api/billing: the GitHub sign-in of this browser goes along for a repository's team (Bearer, as
// the rest of Studio sends it), never for a team made in Bridge; without one, the account cookie alone.
import { afterEach, describe, expect, it, vi } from 'vitest';

let token: string | null = 'gho_browser_token_0000000000';
vi.mock('./account-session', () => ({ workingGitHubToken: async () => token }));

const { checkoutUrl, getBillingStatus, portalUrl, setBillingFetch } = await import('./billing-session');

function capture() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  setBillingFetch(async (url, init) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const body = url.includes('checkout') ? { url: 'https://checkout.stripe.com/c/pay/x' } : url.includes('portal') ? { url: 'https://billing.stripe.com/p/session/x' } : { on: false };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

describe('billing-session', () => {
  afterEach(() => {
    setBillingFetch(null);
    token = 'gho_browser_token_0000000000';
  });

  it('a repository team: status, checkout and portal carry the GitHub sign-in', async () => {
    const calls = capture();
    await getBillingStatus('acme/ds');
    await checkoutUrl('acme/ds', 'eur', 'yearly');
    await portalUrl('acme/ds');
    expect(calls.map((c) => c.headers.Authorization)).toEqual(Array(3).fill('Bearer gho_browser_token_0000000000'));
    expect(calls[1]!.headers['X-Bridge-Account']).toBe('1');
  });

  it('a team made in Bridge, or no GitHub sign-in: the account cookie alone', async () => {
    const calls = capture();
    await getBillingStatus('_team/00112233aabbccdd');
    token = null;
    await getBillingStatus('acme/ds');
    expect(calls.map((c) => c.headers.Authorization)).toEqual([undefined, undefined]);
  });
});
