// /pricing/ (pages/pricing.astro): every price, tier, commitment and answer on the page, in one place. Pure data and
// helpers, no DOM. The page ships on announcement day: until then it lives in a draft pull request.
//
// Decided by Florian: Free (0, up to 3 editors, 1 design system), Team (12 EUR per editor per month billed yearly,
// capped at 120 EUR per month per design system), Organization (490 EUR per month, billed yearly only). Prices
// exclude VAT. Everything marked `TO DECIDE (Florian)` is a draft value that must be confirmed before launch.

export type Currency = 'EUR' | 'USD';
export type Billing = 'yearly' | 'monthly';
export type TierId = 'free' | 'team' | 'organization';

export const CURRENCIES: Currency[] = ['EUR', 'USD'];
export const BILLINGS: Billing[] = ['yearly', 'monthly'];
export const DEFAULT_BILLING: Billing = 'yearly';

// ---------------------------------------------------------------------------------------------------------------
// Prices, whole units, excluding VAT.
// ---------------------------------------------------------------------------------------------------------------

/** Team, billed yearly, per editor per month. Decided. */
export const TEAM_YEARLY_PER_EDITOR_EUR = 12;
/** Team, billed yearly, the most a design system costs per month. Decided. */
export const TEAM_YEARLY_CAP_EUR = 120;
/** Organization, per month, billed yearly only. Decided. */
export const ORGANIZATION_PER_MONTH_EUR = 490;

// TO DECIDE (Florian): Team billed monthly, per editor per month. Draft: about +20% on yearly (Slack Pro charges
// 20.7% more monthly than yearly).
export const TEAM_MONTHLY_PER_EDITOR_EUR = 15;
// TO DECIDE (Florian): Team billed monthly, cap per design system per month. Draft: ten editors, like yearly.
export const TEAM_MONTHLY_CAP_EUR = 150;

// TO DECIDE (Florian): every USD amount below is a draft, with no source behind it yet.
export const TEAM_YEARLY_PER_EDITOR_USD = 13;
// TO DECIDE (Florian)
export const TEAM_YEARLY_CAP_USD = 130;
// TO DECIDE (Florian)
export const TEAM_MONTHLY_PER_EDITOR_USD = 16;
// TO DECIDE (Florian)
export const TEAM_MONTHLY_CAP_USD = 160;
// TO DECIDE (Florian)
export const ORGANIZATION_PER_MONTH_USD = 540;

export interface TeamPrice {
  perEditor: number;
  cap: number;
}

export const TEAM_PRICE: Record<Currency, Record<Billing, TeamPrice>> = {
  EUR: {
    yearly: { perEditor: TEAM_YEARLY_PER_EDITOR_EUR, cap: TEAM_YEARLY_CAP_EUR },
    monthly: { perEditor: TEAM_MONTHLY_PER_EDITOR_EUR, cap: TEAM_MONTHLY_CAP_EUR },
  },
  USD: {
    yearly: { perEditor: TEAM_YEARLY_PER_EDITOR_USD, cap: TEAM_YEARLY_CAP_USD },
    monthly: { perEditor: TEAM_MONTHLY_PER_EDITOR_USD, cap: TEAM_MONTHLY_CAP_USD },
  },
};

/** Organization is billed yearly only: the same monthly price whatever the billing switch says. */
export const ORGANIZATION_PRICE: Record<Currency, number> = { EUR: ORGANIZATION_PER_MONTH_EUR, USD: ORGANIZATION_PER_MONTH_USD };

/** Limits, decided. */
export const FREE_EDITORS = 3;
export const FREE_DESIGN_SYSTEMS = 1;
export const TEAM_DESIGN_SYSTEMS = 3;

// ---------------------------------------------------------------------------------------------------------------
// Facts not decided yet. Shown on the page in brackets, so nobody can mistake them for a decision.
// ---------------------------------------------------------------------------------------------------------------

// PLACEHOLDER, TO DECIDE (Florian): the date the pricing is announced. Every team created before it is a founding
// team. Replace the bracketed text with the real date (for example "1 March 2027") on announcement day.
export const LAUNCH_DATE = '[LAUNCH DATE]';

// TO DECIDE (Florian): Organization support hours. "EU business hours" is decided; the exact hours are a draft.
export const ORGANIZATION_SUPPORT_HOURS = 'Monday to Friday, 9:00 to 18:00 Paris time';

// TO DECIDE (Florian): where Team and Organization data is hosted, and where Organization's isolated hosting runs.
// No source yet. Today's account storage is on /privacy/ (Frankfurt, backups in Paris).
export const HOSTING_REGION = '[TO DECIDE: hosting region for Team and Organization]';

// TO DECIDE (Florian): the legal entity that issues invoices.
export const INVOICE_ENTITY = '[TO DECIDE: legal entity on invoices]';

// TO DECIDE (Florian): the ordinary refund policy on monthly billing. No policy exists yet.
export const MONTHLY_REFUND_POLICY = '[TO DECIDE: refund policy for monthly billing]';

// TO DECIDE (Florian): a commitment, so it needs his approval. Draft wording from the research session.
export const PRICING_ROLLBACK_REFUND = 'If we roll back a pricing change, we refund in full what you paid under it.';

// TO DECIDE (Florian): nonprofit, education and open source pricing. Not decided.
export const SPECIAL_PRICING = '[TO DECIDE: nonprofit, education and open source pricing]';

// TO DECIDE (Florian): no contact email exists on the site yet. The existing contact path is GitHub issues; replace
// with a mailto (for example a sales-free hello@ address) when there is one.
// The page builds the link from lib/repo GITHUB_URL (a build-time module, kept out of this file so islands can import it).
export const ORGANIZATION_CONTACT_PATH = '/issues';
export const ORGANIZATION_CONTACT_LABEL = 'Write to us on GitHub';

// ---------------------------------------------------------------------------------------------------------------
// Formatting and defaults.
// ---------------------------------------------------------------------------------------------------------------

/** "€12" or "$13": whole units, English formatting (the site's language). */
export function money(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
}

/** How many editors the cap pays for: past this, editors cost nothing. */
export function editorsCapped(price: TeamPrice): number {
  return Math.round(price.cap / price.perEditor);
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** A team's monthly price on Team for one design system: per editor, never past the cap. */
export function teamMonthlyCost(editors: number, price: TeamPrice): number {
  return Math.min(Math.max(0, editors) * price.perEditor, price.cap);
}

// Regions that read prices in euros. Everything else defaults to dollars. GBP and CHF are not offered: euros are closer.
const EURO_REGIONS = new Set([
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT',
  'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);
// A language with no region, spoken mostly in Europe.
const EURO_LANGUAGES = new Set(['fr', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'da', 'fi', 'nb', 'no', 'cs', 'sk', 'sl', 'hr', 'hu', 'ro', 'bg', 'el', 'et', 'lv', 'lt', 'ga', 'mt', 'is', 'ca', 'eu', 'gl']);

/** The currency a browser language reads first: "fr-FR", "de" and "en-GB" read euros, "en-US" and "ja" read dollars. */
export function defaultCurrency(language: string | undefined): Currency {
  if (!language) return 'EUR';
  const [lang, ...rest] = language.split(/[-_]/);
  const region = rest.find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  if (region) return EURO_REGIONS.has(region) ? 'EUR' : 'USD';
  return EURO_LANGUAGES.has(lang.toLowerCase()) ? 'EUR' : 'USD';
}

export const CURRENCY_LABEL: Record<Currency, string> = { EUR: 'EUR, €', USD: 'USD, $' };
export const BILLING_LABEL: Record<Billing, string> = { yearly: 'Yearly', monthly: 'Monthly' };

// ---------------------------------------------------------------------------------------------------------------
// Words.
// ---------------------------------------------------------------------------------------------------------------

export const TITLE = 'Free for a small team. Then a fair price per editor, capped per design system.';
export const LEAD = 'Every tier has every feature. You pay for more people, more systems, and our commitments.';
export const LICENSE_LINE = 'Components and tokens are MIT. Each Bridge version becomes MIT two years after release. Self-hosting without limit.';
export const VAT_NOTE = 'Prices exclude VAT.';

export interface Tier {
  id: TierId;
  name: string;
  /** One line under the name: who it is for. */
  pitch: string;
  /** What comes with it, in order. The first item may say "Everything in ...". */
  includes: string[];
  /** The one line that says what the tier does not commit to. Free only. */
  without?: string;
  cta: string;
  recommended?: boolean;
}

export const EVERY_FEATURE = 'Every feature: the whole review flow, full decision history, the Figma plugin, the Claude connector (MCP server) and agents';

export const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    pitch: 'For a small team getting started.',
    includes: [
      `Up to ${inWords(FREE_EDITORS)} editors`,
      'Unlimited readers',
      'One design system',
      EVERY_FEATURE,
      'Sign in with Google, GitHub or Microsoft',
      'Self-hosting without any limit',
    ],
    without: 'No uptime commitment and no support commitment',
    cta: 'Start free',
  },
  {
    id: 'team',
    name: 'Team',
    pitch: 'For a team that grows past three editors.',
    includes: ['Everything in Free', 'Unlimited editors', `Up to ${inWords(TEAM_DESIGN_SYSTEMS)} design systems`, 'Written support, answer within two business days'],
    cta: 'Start with Team',
    recommended: true,
  },
  {
    id: 'organization',
    name: 'Organization',
    pitch: 'We run it, back it up and answer.',
    includes: [
      'Everything in Team',
      'Unlimited design systems and editors',
      'SAML on your own identity provider, and SCIM',
      'Decision audit export',
      'Managed for you: hosted by us, your data isolated, backups',
      'Uptime of 99.5% a month, with service credits up to one month',
      `Support answer within one business day, ${ORGANIZATION_SUPPORT_HOURS}`,
    ],
    cta: 'Ask about Organization',
  },
];

export const ORGANIZATION_NOTE =
  'Everything in Bridge can be self-hosted. Organization is for teams who would rather we run it, back it up and answer.';

/** "Our commitments": permanent wording. */
export const COMMITMENTS: { title: string; text: string }[] = [
  { title: 'Components and tokens are MIT', text: 'What goes into your product is MIT, with no non-compete.' },
  {
    title: 'Each version becomes MIT',
    text: 'The rest of Bridge is under the Functional Source License (FSL-1.1-MIT). Each Bridge version becomes MIT two years after its release.',
  },
  { title: 'Self-hosting has no limit', text: 'On every tier, Free included: as many editors and design systems as you like.' },
  { title: 'Sign in your way, on every tier', text: 'Google, GitHub and Microsoft sign-in on every tier. Only SAML on your own identity provider is Organization.' },
  { title: 'A free account never receives an invoice', text: 'No card to start, and no automatic charge when you grow.' },
  { title: 'A limit never deletes', text: 'Past a limit, Bridge pauses, hides or makes read-only. It never deletes your work.' },
];

/** Who counts as an editor: written on the page. */
export const EDITOR_TITLE = 'Who counts as an editor';
export const EDITOR_DEFINITION = 'An editor is anyone who proposes or decides in Studio.';
export const EDITOR_NOT_COUNTED = 'Readers, viewers, and developers who only work in GitHub do not count. Invite them freely, on every tier.';

/** Founding teams. Wording decided by Florian. */
// TO REVIEW: to be reviewed by a lawyer before launch. This text is a commitment that goes into the terms of service.
export const FOUNDING_TITLE = 'Founding teams';
export const FOUNDING_TEXT = [
  `Every team created on Bridge before ${LAUNCH_DATE} keeps, at no cost and with no end date, everything it could do that day: all its editors, all its design systems, every feature, plus anything the Free tier gains later.`,
  'No future price change applies to it. Support and uptime stay those of Free.',
  'If we ever stop the hosted service, we tell you at least six months ahead and give you a full export you can host yourself without limit.',
  'This commitment is part of our terms of service and binds anyone who takes Bridge over.',
];

// ---------------------------------------------------------------------------------------------------------------
// The comparison table: one row per line, one cell per tier (Free, Team, Organization). `true` is a check, `false` a
// dash, a string says it in words. The price row is drawn by the island, from the switches.
// ---------------------------------------------------------------------------------------------------------------

export type TableCell = boolean | string;
export interface TableRow {
  label: string;
  cells: [TableCell, TableCell, TableCell];
}
/** The tier a phone shows first in the comparison, one tier at a time. */
export const NARROW_DEFAULT_TIER: TierId = 'team';

export interface TableGroup {
  name: string;
  rows: TableRow[];
}

export const TABLE_GROUPS: TableGroup[] = [
  {
    name: 'People and design systems',
    rows: [
      { label: 'Editors', cells: [`Up to ${FREE_EDITORS}`, 'Unlimited', 'Unlimited'] },
      { label: 'Readers', cells: ['Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Design systems', cells: [String(FREE_DESIGN_SYSTEMS), `Up to ${TEAM_DESIGN_SYSTEMS}`, 'Unlimited'] },
    ],
  },
  {
    name: 'Features',
    rows: [
      { label: 'The whole review flow', cells: [true, true, true] },
      { label: 'Full decision history', cells: [true, true, true] },
      { label: 'Figma plugin', cells: [true, true, true] },
      { label: 'Claude connector (MCP server)', cells: [true, true, true] },
      { label: 'Agents', cells: [true, true, true] },
      { label: 'Self-hosting without limit', cells: [true, true, true] },
    ],
  },
  {
    name: 'Sign-in and control',
    rows: [
      { label: 'Sign in with Google, GitHub or Microsoft', cells: [true, true, true] },
      { label: 'SAML on your own identity provider', cells: [false, false, true] },
      { label: 'SCIM', cells: [false, false, true] },
      { label: 'Roles', cells: [true, true, true] },
      { label: 'Decision audit export', cells: [false, false, true] },
    ],
  },
  {
    name: 'Service',
    rows: [
      { label: 'Hosted for you, data isolated, backups', cells: [false, false, true] },
      { label: 'Uptime', cells: ['No commitment', 'No commitment', '99.5% a month, service credits up to one month'] },
      { label: 'Support', cells: ['No commitment', 'Written, answer within two business days', `Answer within one business day, ${ORGANIZATION_SUPPORT_HOURS}`] },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// FAQ. A string may hold a placeholder in brackets: those are undecided.
// ---------------------------------------------------------------------------------------------------------------

export interface FaqItem {
  id: string;
  question: string;
  answer: string[];
}

export const FAQ: FaqItem[] = [
  {
    id: 'fourth-editor',
    question: 'What happens when we invite a fourth editor on Free?',
    answer: [
      'The invitation waits, marked "needs Team". Nothing is charged automatically and nothing is deleted: your three editors keep working, and readers can still join.',
      'Move to Team when you are ready, and the invitation goes through.',
    ],
  },
  {
    id: 'stop-paying',
    question: 'What happens if we stop paying?',
    answer: [
      'What goes past the Free tier becomes read-only. Everyone can still read the design system and its decisions. Nothing is deleted.',
      'Editing comes back as soon as you pay again, or when the team fits within Free.',
    ],
  },
  {
    id: 'self-host',
    question: 'Why pay if we can self-host?',
    answer: [
      'You can self-host Bridge without any limit, on every tier. Paying is for when you would rather not run it yourselves.',
      'Team adds editors, design systems and written support. Organization adds SAML, SCIM and the decision audit export, and we run it for you: hosting, isolation, backups, an uptime commitment and a faster answer.',
    ],
  },
  {
    id: 'hosting',
    question: 'Where is our data hosted?',
    answer: [
      'Your design system stays in your own repository. Bridge reads it there and keeps only short-lived copies. Accounts and teams are stored in Frankfurt, Germany, with a daily backup in Paris, France: the privacy page has the details.',
      `Hosting for Team and Organization: ${HOSTING_REGION}.`,
      'Self-hosting has no limit on every tier, Free included, so nobody depends on our hosting.',
    ],
  },
  {
    id: 'vat',
    question: 'How do VAT and invoices work?',
    answer: [
      'Prices exclude VAT. VAT is added where it applies. Every payment comes with an invoice, and a free team never receives one.',
      `Invoices are issued by ${INVOICE_ENTITY}.`,
    ],
  },
  {
    id: 'refunds',
    question: 'What if we get pricing wrong?',
    // TO DECIDE (Florian): PRICING_ROLLBACK_REFUND is a commitment; MONTHLY_REFUND_POLICY is not written yet.
    answer: [`${PRICING_ROLLBACK_REFUND} [TO DECIDE: Florian to approve this commitment]`, `Monthly billing: ${MONTHLY_REFUND_POLICY}.`],
  },
  {
    id: 'discounts',
    question: 'Do you offer discounts?',
    answer: [
      `The volume discount is built into the price and is the same for everyone: past ${inWords(editorsCapped(TEAM_PRICE.EUR.yearly))} editors on a design system, editors cost nothing. There are no negotiated prices.`,
      `Nonprofits, education and open source: ${SPECIAL_PRICING}.`,
    ],
  },
  {
    id: 'saml',
    question: 'What does SAML on Organization do?',
    answer: [
      'Your people sign in to Bridge through your own identity provider, with your rules. With SCIM, people you add or remove there join or leave Bridge by themselves.',
      'Google, GitHub and Microsoft sign-in stay available on every tier.',
    ],
  },
  {
    id: 'shutdown',
    question: 'What if Bridge shuts down?',
    answer: [
      'Your design system already lives in your own repository. You can self-host Bridge today without limit, and each version becomes MIT two years after its release.',
      `Founding teams also have it in writing: at least six months notice and a full export you can host yourself.`,
    ],
  },
];
