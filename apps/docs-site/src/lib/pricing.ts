// /pricing/ (pages/pricing.astro): every price, tier, commitment and answer on the page, in one place. Pure data and
// helpers, no DOM. The page ships on announcement day: until then it lives in a draft pull request.
//
// Every price and policy here is decided. One launch blocker stays marked `TO DECIDE (Florian), BLOCKS LAUNCH`: the
// launch date. The policies are written in full in the terms of service (pages/terms.astro).

export type Currency = 'EUR' | 'USD';
export type Billing = 'yearly' | 'monthly';
export type TierId = 'free' | 'team' | 'organization';

export const CURRENCIES: Currency[] = ['EUR', 'USD'];
export const BILLINGS: Billing[] = ['yearly', 'monthly'];
export const DEFAULT_BILLING: Billing = 'yearly';

// ---------------------------------------------------------------------------------------------------------------
// Prices, whole units. VAT is not applicable (VAT franchise, art. 293 B of the French tax code).
// ---------------------------------------------------------------------------------------------------------------

/** Team, billed yearly, per editor per month. Decided. */
export const TEAM_YEARLY_PER_EDITOR_EUR = 12;
/** Team, billed yearly, the most a design system costs per month. Decided. */
export const TEAM_YEARLY_CAP_EUR = 120;
/** Organization, per month, billed yearly only. Decided. */
export const ORGANIZATION_PER_MONTH_EUR = 490;

/** Team, billed monthly, per editor per month. Decided (about +20% on yearly, like Slack Pro). */
export const TEAM_MONTHLY_PER_EDITOR_EUR = 15;
/** Team, billed monthly, the most a design system costs per month (ten editors, like yearly). Decided. */
export const TEAM_MONTHLY_CAP_EUR = 150;

/** USD, decided. */
export const TEAM_YEARLY_PER_EDITOR_USD = 14;
export const TEAM_YEARLY_CAP_USD = 140;
export const TEAM_MONTHLY_PER_EDITOR_USD = 17;
export const TEAM_MONTHLY_CAP_USD = 170;
export const ORGANIZATION_PER_MONTH_USD = 550;

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
// Launch blocker: the launch date. The page cannot ship before it is set.
// ---------------------------------------------------------------------------------------------------------------

// TO DECIDE (Florian), BLOCKS LAUNCH: the date the pricing is announced. Every team created before it is a founding
// team. Replace the bracketed text with the real date (for example "2 March 2027") on announcement day.
//
// Launch rule (not shown on the page): launch on the first Tuesday or Wednesday after all of these are true in
// production:
// - Stripe is live under the entity below (INVOICE_ENTITY);
// - one real payment and one real refund have been done end to end;
// - every existing team has been checked to keep what it had the day before;
// - it is proven that no free account can produce an invoice;
// - the pricing page and the homepage compare-row change ship in one deploy;
// - the launch date below is filled;
// - Florian is available for the next 48 hours.
export const LAUNCH_DATE = '[LAUNCH DATE]';

/** Organization support hours ("EU business hours"). Also in the terms of service, section 9.3. */
export const ORGANIZATION_SUPPORT_HOURS = 'Monday to Friday, 9:00 to 18:00 Paris time, except French public holidays';

/** Who issues invoices. No street address on the page. */
export const INVOICE_ENTITY = 'Florian Gouloubi, sole proprietor (entrepreneur individuel), France, SIREN 947 632 055';

/** The VAT franchise mention, on the page and on every invoice. */
export const VAT_MENTION = 'VAT not applicable (French micro-enterprise, art. 293 B of the French tax code).';

/** Refund policy. Also in the terms of service, section 7. */
export const REFUND_POLICY = [
  'Monthly: you keep access until the end of the paid month, with no prorated refund.',
  'Yearly: full refund within 30 days of the first payment; after that, access runs to the end of the paid year and the plan does not renew if you stop it.',
];

/** A published commitment. Also in the terms of service, section 7.4. */
export const PRICING_ROLLBACK_REFUND =
  'If we roll back a pricing change, we refund in full the difference between what you paid since that change and what you would have paid at the previous price.';

// Bridge's contact address (an OVH redirect to Florian's inbox). Shown as text, so it reads even where mailto: does nothing.
export const CONTACT_EMAIL = 'hello@bridgedesignsystem.com';
export const ORGANIZATION_CONTACT_HREF = `mailto:${CONTACT_EMAIL}`;
export const ORGANIZATION_CONTACT_LABEL = CONTACT_EMAIL;

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
export const VAT_NOTE = VAT_MENTION;

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
// This text is a commitment, written in full in the terms of service, section 10 (pages/terms.astro). The page links
// "terms of service" in the last line to /terms/.
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

/** A link shown at the end of an answer. `privacy` and `contact` are resolved by the page. */
export type FaqLink = { to: 'privacy' | 'contact'; label: string };

export interface FaqItem {
  id: string;
  question: string;
  /** Paragraphs. "{cap}" reads the Team yearly cap in the chosen currency. */
  answer: string[];
  link?: FaqLink;
}

/** An answer's paragraphs in a currency: "{cap}" becomes "€120" or "$140". */
export function faqAnswer(item: FaqItem, currency: Currency): string[] {
  return item.answer.map((a) => a.split('{cap}').join(money(TEAM_PRICE[currency].yearly.cap, currency)));
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
    // Facts from /privacy/ only. Never "hosted in the EU", "never leaves Europe" or a certification.
    id: 'hosting',
    question: 'Where is our data hosted?',
    answer: [
      'Your design system never leaves your repository. What Bridge reads from GitHub is kept briefly: a few minutes for most answers, 7 days at most for file content.',
      'Accounts are stored in an Upstash Redis database in Frankfurt, Germany, with a daily backup in Vercel Blob in Paris, France, kept 30 days.',
      'Self-hosting has no limit on every tier, Free included, so nobody depends on our hosting.',
    ],
    link: { to: 'privacy', label: 'What Bridge keeps, in detail' },
  },
  {
    id: 'vat',
    question: 'How do VAT and invoices work?',
    answer: [
      `Invoices are issued by ${INVOICE_ENTITY}, with the mention: VAT not applicable, art. 293 B of the French tax code. A free team never receives an invoice.`,
      // TO DECIDE (Florian): this promise (30 days notice, same prices before VAT) is not confirmed yet.
      'If Bridge starts charging VAT, we tell you 30 days before and prices stay the same, VAT excluded.',
    ],
  },
  {
    id: 'refunds',
    question: 'Can we get a refund?',
    answer: REFUND_POLICY,
  },
  {
    id: 'pricing-wrong',
    question: 'What if we get pricing wrong?',
    answer: [PRICING_ROLLBACK_REFUND],
  },
  {
    id: 'discounts',
    question: 'Do you offer discounts?',
    answer: [
      "Team is free, with no sales call, for a design system whose repository is public under an OSI-approved open source license, and for teaching in a school or university: write to us with the repository link or the school's address.",
      'We offer no other discount: the cap at {cap} per design system is our discount for large teams.',
    ],
    link: { to: 'contact', label: ORGANIZATION_CONTACT_LABEL },
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
