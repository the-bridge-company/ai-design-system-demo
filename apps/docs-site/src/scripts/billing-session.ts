// The browser side of /api/billing (api/billing/index.ts): the Billing card's status, and the two ways out to Stripe
// (Checkout to move to Team, the Customer Portal to manage it). The account session is the httpOnly cookie of
// /api/account; every POST carries X-Bridge-Account (CSRF). Nothing here holds a key: the server makes the sessions.
import { parseBillingStatus, type BillingStatus, type Currency, type Interval } from '../lib/billing';

export const BILLING_API = '/api/billing';

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

const FAILED = 'Something went wrong. Try again in a minute.';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: Fetch = (input, init) => fetch(input, init);

/** Tests swap the network. */
export function setBillingFetch(f: Fetch | null) {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
}

async function call(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetchImpl(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    throw new BillingError(FAILED, 'network', 0);
  }
  const data = /json/i.test(res.headers.get('content-type') ?? '') ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {};
  if (!res.ok) throw new BillingError(typeof data.message === 'string' && data.message ? data.message : FAILED, typeof data.error === 'string' ? data.error : 'failed', res.status);
  return data;
}

/** The team's billing for its admin; null when billing is off or the person is not an admin (the card shows nothing). */
export async function getBillingStatus(team: string): Promise<BillingStatus | null> {
  try {
    return parseBillingStatus(await call(`${BILLING_API}?team=${encodeURIComponent(team)}`, { method: 'GET', headers: { Accept: 'application/json' } }));
  } catch {
    return null;
  }
}

const post = (action: 'checkout' | 'portal', body: Record<string, unknown>) =>
  call(`${BILLING_API}/${action}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Bridge-Account': '1' }, body: JSON.stringify(body) });

/** Only Stripe's own pages: the server answers with one, never anything the browser should follow elsewhere. */
const stripeUrl = (u: unknown): string => {
  if (typeof u === 'string') {
    try {
      const url = new URL(u);
      if (url.protocol === 'https:' && (url.hostname === 'checkout.stripe.com' || url.hostname === 'billing.stripe.com')) return url.href;
    } catch {
      /* not a URL */
    }
  }
  throw new BillingError(FAILED, 'failed', 502);
};

/** Where to pay for Team (Stripe Checkout). */
export async function checkoutUrl(team: string, currency: Currency, interval: Interval): Promise<string> {
  return stripeUrl((await post('checkout', { team, currency, interval })).url);
}

/** Where to manage billing (Stripe Customer Portal). */
export async function portalUrl(team: string): Promise<string> {
  return stripeUrl((await post('portal', { team })).url);
}
