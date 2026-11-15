// Billing: the tiers a team can be on, what each allows, and the words Studio's Billing card says. Shared by the
// server (api/billing, api/_lib/billing.ts, the Free limits in api/invites and api/entry) and the browser
// (components/ds/studio/BillingCard.tsx). No Stripe here, no secret, nothing the browser should not read.
//
// Off until launch: BILLING_LAUNCHED is the one switch. While it is false, Studio shows no billing at all, the Free
// limits are never checked, and the billing endpoints answer 503 (docs/BILLING.md, launch checklist). Prices here
// are the ones the pricing page publishes (lib/pricing.ts once it ships): per editor per month, before VAT.

/** The one switch. False: production behaves exactly as before billing existed. Flipped on launch day. */
export const BILLING_LAUNCHED = false;

/**
 * The launch date (ISO, YYYY-MM-DD), set on launch day with the pricing page. Every team created before it is a
 * founding team: never limited, never billed. While it is null, every team counts as founding.
 */
export const BILLING_LAUNCH_DATE: string | null = null;

export type Tier = 'free' | 'team' | 'organization';
export type Currency = 'eur' | 'usd';
export type Interval = 'yearly' | 'monthly';

export const TIERS: readonly Tier[] = ['free', 'team', 'organization'];
export const CURRENCIES: readonly Currency[] = ['eur', 'usd'];
export const INTERVALS: readonly Interval[] = ['yearly', 'monthly'];

/** Free: up to three editors and one design system, never invoiced. */
export const FREE_EDITORS = 3;
export const FREE_DESIGN_SYSTEMS = 1;
/** Team: editors past ten on one design system cost nothing; up to three design systems. */
export const TEAM_EDITOR_CAP = 10;
export const TEAM_DESIGN_SYSTEMS = 3;

/** Per editor per month, before VAT, in whole units of the currency. */
export const TEAM_PRICES: Record<Currency, Record<Interval, number>> = {
  eur: { yearly: 12, monthly: 15 },
  usd: { yearly: 14, monthly: 17 },
};

/** The Stripe price of a tier, found by its lookup key (never by id: the ids differ between test and live). */
export const lookupKey = (tier: Exclude<Tier, 'free'>, currency: Currency, interval: Interval): string =>
  `bridge_${tier === 'team' ? 'team' : 'org'}_${currency}_${interval}`;

/** Every lookup key the catalog holds (scripts/stripe-catalog.mjs creates them). Organization is yearly only. */
export const LOOKUP_KEYS: readonly string[] = [
  ...CURRENCIES.flatMap((c) => INTERVALS.map((i) => lookupKey('team', c, i))),
  ...CURRENCIES.map((c) => lookupKey('organization', c, 'yearly')),
];

/** The tier a lookup key bills, or null for a price that is not Bridge's. */
export function tierOfLookupKey(key: unknown): Exclude<Tier, 'free'> | null {
  if (typeof key !== 'string') return null;
  if (/^bridge_team_(eur|usd)_(yearly|monthly)$/.test(key)) return 'team';
  if (/^bridge_org_(eur|usd)_yearly$/.test(key)) return 'organization';
  return null;
}

/**
 * What a team pays for at checkout: its editors, at least one and at most ten per design system (editors past ten
 * are free), times its design systems (one to three). One subscription item with this quantity, not one item per
 * design system: the price is the same per editor whatever the design system, so one line reads simpler on the
 * invoice and in the portal, and a design system added later only changes the quantity.
 */
export function checkoutQuantity(editors: number, designSystems = 1): number {
  const e = Math.min(Math.max(1, Math.floor(editors) || 0), TEAM_EDITOR_CAP);
  const s = Math.min(Math.max(1, Math.floor(designSystems) || 0), TEAM_DESIGN_SYSTEMS);
  return e * s;
}

/** The price shown before paying: per month and per billing period, before VAT. */
export function checkoutPrice(quantity: number, currency: Currency, interval: Interval): { perMonth: number; perPeriod: number } {
  const perMonth = quantity * TEAM_PRICES[currency][interval];
  return { perMonth, perPeriod: interval === 'yearly' ? perMonth * 12 : perMonth };
}

export const money = (amount: number, currency: Currency): string => (currency === 'eur' ? `${amount} €` : `$${amount}`);

/** The Settings answer of GET /api/billing (api/billing): what the Billing card shows. */
export interface BillingStatus {
  tier: Tier;
  founding: boolean;
  /** active, trialing, past_due, canceled... as Stripe says it, or null on Free. */
  status: string | null;
  /** ISO date the paid period ends (renews or stops), or null. */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  currency: Currency | null;
  interval: Interval | null;
  quantity: number | null;
  /** Editors on the team now, and what checkout would bill. */
  editors: number;
  checkoutQuantity: number;
  /** A payment method and invoices to manage: the team has a Stripe customer. */
  canManage: boolean;
}

const isCurrency = (v: unknown): v is Currency => v === 'eur' || v === 'usd';
const isInterval = (v: unknown): v is Interval => v === 'yearly' || v === 'monthly';
export { isCurrency, isInterval };

/** A GET /api/billing answer, checked; anything else is null (the card shows nothing). */
export function parseBillingStatus(v: unknown): BillingStatus | null {
  const r = v as Partial<BillingStatus> | null;
  if (!r || typeof r !== 'object' || !TIERS.includes(r.tier as Tier) || typeof r.founding !== 'boolean') return null;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    tier: r.tier as Tier,
    founding: r.founding,
    status: typeof r.status === 'string' ? r.status : null,
    periodEnd: typeof r.periodEnd === 'string' ? r.periodEnd : null,
    cancelAtPeriodEnd: r.cancelAtPeriodEnd === true,
    currency: isCurrency(r.currency) ? r.currency : null,
    interval: isInterval(r.interval) ? r.interval : null,
    quantity: num(r.quantity),
    editors: num(r.editors) ?? 0,
    checkoutQuantity: num(r.checkoutQuantity) ?? 1,
    canManage: r.canManage === true,
  };
}

/** "12 December 2027". */
export const longDate = (iso: string): string => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The Billing card's words (designer words, no em dash). */
export const BILLING_WORDS = {
  band: 'Billing',
  intro: 'What your team is on, and how it pays.',
  tierName: { free: 'Free', team: 'Team', organization: 'Organization' } satisfies Record<Tier, string>,
  includes: {
    free: `Up to ${FREE_EDITORS} editors and ${FREE_DESIGN_SYSTEMS} design system. Never invoiced.`,
    team: `Unlimited editors, up to ${TEAM_DESIGN_SYSTEMS} design systems. Editors past ${TEAM_EDITOR_CAP} on a design system cost nothing.`,
    organization: 'Unlimited design systems and editors, billed by invoice.',
  } satisfies Record<Tier, string>,
  founding: 'Founding team: your team keeps everything it has, at no cost, with no end date.',
  editorsNow: (n: number) => `${n} ${n === 1 ? 'editor' : 'editors'} on this design system today.`,
  upgrade: 'Move to Team',
  currencyLabel: 'Currency',
  intervalLabel: 'Billing',
  currency: { eur: 'EUR', usd: 'USD' } satisfies Record<Currency, string>,
  interval: { yearly: 'Yearly', monthly: 'Monthly' } satisfies Record<Interval, string>,
  quote: (quantity: number, currency: Currency, interval: Interval) => {
    const { perMonth, perPeriod } = checkoutPrice(quantity, currency, interval);
    const who = `${quantity} ${quantity === 1 ? 'editor' : 'editors'}`;
    return interval === 'yearly'
      ? `${who}: ${money(perMonth, currency)} a month, billed ${money(perPeriod, currency)} a year.`
      : `${who}: ${money(perMonth, currency)} a month, billed monthly.`;
  },
  vat: 'Prices exclude VAT. EU businesses with a VAT number pay none: reverse charge.',
  refund: { yearly: 'Full refund within 30 days.', monthly: 'Stop anytime: you keep Team to the end of the paid month.' } satisfies Record<Interval, string>,
  pay: 'Continue to payment',
  manage: 'Manage billing',
  manageHelp: 'Invoices, payment method, and stopping at the end of the period.',
  renews: (iso: string) => `Renews on ${longDate(iso)}.`,
  ends: (iso: string) => `Stops on ${longDate(iso)}. Your team then goes back to Free: nothing is deleted.`,
  paidFor: (n: number) => `Paid for ${n} ${n === 1 ? 'editor' : 'editors'}.`,
  pastDue: 'The last payment did not go through. Update the payment method to keep Team.',
  thanks: 'Thank you. Your team is moving to Team: this page updates in a moment.',
  failed: 'Something went wrong. Try again in a minute.',
  /** The Free limits, said where they apply (api/invites, api/entry). */
  needsTeam: 'Needs Team',
  editorWaits: `Free covers ${FREE_EDITORS} editors. This invite waits until your team moves to Team: nothing is charged and nobody loses access.`,
  editorFull: `Free covers ${FREE_EDITORS} editors. Move your team to Team in Settings to add another: nothing is charged until you do.`,
  joinWaits: `This team is full on Free (${FREE_EDITORS} editors). Ask an admin to move it to Team, then accept again.`,
  designSystemWaits: `Free covers ${FREE_DESIGN_SYSTEMS} design system. Move your team to Team in Settings to add another: nothing is charged until you do.`,
} as const;
