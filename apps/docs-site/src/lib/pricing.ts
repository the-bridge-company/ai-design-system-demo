// /pricing/ (pages/pricing.astro): every price, tier, commitment and answer on the page, in one place. Pure data and
// helpers, no DOM. Published while Bridge is free for every team: paid plans open in 2027, so prices are planned.
//
// Every price and policy here is decided, as planned prices for when paid plans open. The policies are written in full
// in the terms of service (pages/terms.astro).

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
// Today and the founding cutoff. Bridge is free for every team today; paid plans open in 2027, date not set.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Founding teams (terms version 3, section 10.1): every team whose access request is sent up to this day, included
 * (ISO, Paris calendar day), or that joins through an invite link created by then, plus every team created before
 * version 3 (24 November 2026). The billing code reads the same cutoff as BILLING_LAUNCH_DATE = the next day,
 * exclusive (lib/billing.ts; pricing.test checks both).
 */
export const FOUNDING_CUTOFF = '2027-03-31';
export const FOUNDING_CUTOFF_LABEL = '31 March 2027';
/** Keeps a phrase on one line where it shows: its spaces become no-break spaces (U+00A0). Tests read it back with plain(). */
export const keepTogether = (s: string): string => s.replace(/ /g, '\u00a0');
/** A shown string with its no-break spaces read as plain spaces, for tests and comparisons. */
export const plain = (s: string): string => s.replace(/\u00a0/g, ' ');
/** The founding date as the marketing pages show it, never split across two lines ("31 March 2027"). */
export const FOUNDING_DATE = keepTogether(FOUNDING_CUTOFF_LABEL);
export const PAID_PLANS_OPEN = '2027';
/** Paid plans open on this day at the earliest, after the founding cutoff (lib/billing.ts guards BILLING_LAUNCHED). */
export const PAID_PLANS_EARLIEST = '2027-04-01';
export const PAID_PLANS_EARLIEST_LABEL = '1 April 2027';

// Rule for opening paid plans (not shown on the page): open them on the first Tuesday or Wednesday after all of
// these are true in production:
// - Stripe is live under the entity below (INVOICE_ENTITY);
// - one real payment and one real refund have been done end to end;
// - every existing team has been checked to keep what it had the day before;
// - it is proven that no free account can produce an invoice;
// - every team has been told at least 30 days before, with the final prices (FAQ "When do paid plans open?");
// - Florian is available for the next 48 hours.

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

// Pricing A "Founding first" (Claude Design canvas, page "Site · Pricing & founding", board Wip-site-pricing-A).
export const HERO_TITLE = `Bridge is free today. Request access by ${FOUNDING_DATE} and your team stays free.`;
/** "terms of service" in it links to /terms/. */
export const HERO_LEAD = `Every tier has every feature. Paid plans open in ${PAID_PLANS_OPEN}, at the planned prices below. A team that requests access by ${FOUNDING_DATE} never moves to them: it is written in our terms of service.`;
/** How people sign in today, one wording everywhere (/privacy/, /terms/ 3.1). There is no Google or Microsoft sign-in. */
export const SIGN_IN = 'Sign in with GitHub or a code sent to your email, on every tier. SAML on your own identity provider is Organization.';
export const HERO_NOTE = 'No card needed. Access opens in small groups. We reply within 2 working days.';
export const VAT_NOTE = VAT_MENTION;

export const PLANS_TITLE = `What paid plans will cost from ${PAID_PLANS_OPEN}`;
export const PLANNED_NOTE = 'Planned prices: they may still change before paid plans open. You pay for more people, more design systems and our service, never for features.';
export const OPENS_BADGE = `Opens in ${PAID_PLANS_OPEN}`;

export interface Tier {
  id: TierId;
  name: string;
  /** One line under the price. "{cap}" is the Team cap in the chosen currency and billing. */
  pitch: string;
  /** What comes with it, in order. The first item may say "Everything in ...". */
  includes: string[];
  /** A neutral badge next to the name: paid tiers say when they open. */
  badge?: string;
  /** The card's one button, secondary. No button on Team: it cannot be bought yet. */
  cta?: string;
  /** Text in the card footer instead of a button. */
  footerNote?: string;
  /** What a founding team keeps on this tier, said on the card itself (Free): the limits above stop at the cutoff. */
  founding?: { title: string; text: string };
}

export const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    pitch: 'For a small team getting started.',
    includes: [`Up to ${inWords(FREE_EDITORS)} editors`, 'Unlimited readers', 'One design system', 'Every feature'],
    founding: {
      title: `Requested by ${FOUNDING_DATE}: no limits`,
      text: 'A founding team keeps unlimited editors and design systems, free with no end date.',
    },
    cta: 'Request access',
  },
  {
    id: 'team',
    name: 'Team',
    pitch: 'At most {cap} a month per design system: editors past ten cost nothing.',
    includes: ['Everything in Free', 'Unlimited editors', `Up to ${inWords(TEAM_DESIGN_SYSTEMS)} design systems`, 'Written support, answer within two business days'],
    badge: OPENS_BADGE,
    footerNote: `Start today on Free. Request access by ${FOUNDING_DATE} and your team never pays this.`,
  },
  {
    id: 'organization',
    name: 'Organization',
    pitch: 'We run it, back it up and answer.',
    includes: [
      'Everything in Team, unlimited editors and design systems',
      'SAML on your own identity provider, and SCIM',
      'Decision audit export',
      'Hosted by us, data isolated, backups',
      '99.5% uptime a month, answer within one business day',
    ],
    badge: OPENS_BADGE,
    cta: 'Ask about Organization',
  },
];

/**
 * Hosting is fair use (terms 8.4, version 2, 2026-11-21): what is free is every feature and every seat, not unbounded
 * hosted use. Bridge pays the hosting (functions, storage, email); the team's own Claude account and GitHub carry the
 * rest. Said on the pricing page, in the founding commitment and in the FAQ, with the same words.
 */
export const FAIR_USE = 'Hosting is fair use: a team whose hosted use runs far above a typical team chooses usage credits, a paid plan or self-hosting, and is only slowed or paused, never deleted, if it chooses nothing.';

/** "On every tier, Free included": permanent wording, a bold lead and the rest of the sentence. */
export const COMMITMENTS_TITLE = 'On every tier, Free included';
export const COMMITMENTS: { lead: string; text: string }[] = [
  { lead: 'Components and tokens are MIT.', text: 'What goes into your product, with no non-compete.' },
  { lead: 'Each version becomes MIT', text: 'two years after its release (FSL-1.1-MIT).' },
  { lead: 'Self-hosting has no limit:', text: 'as many editors and design systems as you like.' },
  { lead: 'A free account never receives an invoice it did not ask for.', text: 'No card, no automatic charge when you grow.' },
  { lead: 'A limit never deletes.', text: 'Bridge pauses, hides or makes read-only. Free means every feature and every seat; hosted use is fair use (terms 8.4).' },
  { lead: 'Sign-in stays free on every tier.', text: SIGN_IN },
];

/** Who counts as an editor: written on the page, next to the differences. */
export const EDITOR_LEAD = 'Who counts as an editor:';
export const EDITOR_TEXT = 'anyone who proposes or decides in Studio. Readers, viewers and developers who only work in GitHub do not count.';

/** Founding teams. Wording decided by Florian. */
// This text is a commitment, written in full in the terms of service, section 10 (pages/terms.astro). The page links
// "terms of service" in the last line to /terms/.
/**
 * Who else is a founding team, and how a place is kept (terms 10.1): said once in FOUNDING_TEXT and once in the band
 * note, with the same words. Wording approved by Florian (Bridge on invitation, PR C).
 */
export const FOUNDING_KEEP = 'Accept your invite within 30 days to keep your founding place.';
export const FOUNDING_ALREADY = 'Teams already on Bridge are founding teams too, and people invited into a founding team are covered by that team.';
export const FOUNDING_WHO = `${FOUNDING_KEEP} ${FOUNDING_ALREADY}`;
export const FOUNDING_TITLE = 'Founding teams';
export const FOUNDING_TEXT = [
  `Every team that requests access to Bridge by ${FOUNDING_DATE} keeps, at no cost and with no end date, everything it can do the day paid plans open: all its editors, all its design systems, every feature, plus anything the Free tier gains later.`,
  FOUNDING_WHO,
  'No future price change applies to it. Support and uptime stay those of Free.',
  FAIR_USE,
  'If we ever stop the hosted service, we tell you at least six months ahead and give you a full export you can host yourself without limit.',
  'This commitment is part of our terms of service and binds anyone who takes Bridge over.',
];

/**
 * The Harbor band of /pricing/ (#founding): three facts, then the rest, sentence by sentence from FOUNDING_TEXT. Only
 * the first sentence changes: its subject ("Every team that requests access to Bridge by 31 March 2027") becomes the first fact and
 * "Your team", and "with no end date" is said once, by the second fact's title. Every other sentence is FOUNDING_TEXT
 * word for word (pricing.test checks it). /terms/ section 10 keeps the full commitment.
 */
export const FOUNDING_BAND_TITLE = 'The founding team commitment';
export const FOUNDING_BAND_LINK = 'Read it in our terms of service';
export const FOUNDING_FACTS: { title: string; text: string }[] = [
  { title: FOUNDING_DATE, text: `The last day to request access for a founding team. ${FOUNDING_KEEP}` },
  {
    title: 'Free, with no end date',
    text: 'Your team keeps, at no cost, everything it can do the day paid plans open: all its editors, all its design systems, every feature, plus anything the Free tier gains later.',
  },
  { title: 'In writing', text: 'This commitment is part of our terms of service and binds anyone who takes Bridge over. No future price change applies to it.' },
];
export const FOUNDING_BAND_NOTE = `${FOUNDING_ALREADY} Support and uptime stay those of Free. ${FAIR_USE} ${'If we ever stop the hosted service, we tell you at least six months ahead and give you a full export you can host yourself without limit.'}`;

/** Home B: the founding section before the last call. The board's "why" sentence waits for Florian's words. */
export const HOME_FOUNDING = {
  eyebrow: 'Founding teams',
  title: `Request access by ${FOUNDING_DATE}. Your team stays free.`,
  /** The title as drawn: "free" in the brand blue (HpFounding). Together they read exactly `title`. */
  titleLead: `Request access by ${FOUNDING_DATE}. Your team stays `,
  titleAccent: 'free',
  titleEnd: '.',
  primary: 'Request access',
  secondary: 'See planned prices',
  facts: [
    { title: 'No end date', text: 'At no cost. No future price change applies to it.' },
    { title: 'Everything your team can do', text: 'All its editors, all its design systems and every feature, as they are the day paid plans open, plus anything Free gains later.' },
    { title: 'Written in our terms', text: 'It binds anyone who takes Bridge over.', link: 'Read it in our terms' },
  ],
};

/** Home C: the strip above the site header on every marketing page. "FREE" is shown in capitals, in a strong. */
export const STRIP = {
  label: 'Founding teams',
  before: `Paid plans open in ${PAID_PLANS_OPEN}. Teams that request access by ${FOUNDING_DATE} stay `,
  strong: 'FREE',
  after: ', with no end date.',
};


// ---------------------------------------------------------------------------------------------------------------
// The comparison: only the rows that differ between tiers, one cell per tier (Free, Team, Organization), in words.
// ---------------------------------------------------------------------------------------------------------------

export const DIFF_TITLE = 'Only what changes between tiers';
export const SAME_EVERYWHERE =
  'Everything else is the same on every tier: the whole review flow, full decision history, the Figma plugin, the Claude connector (MCP server), agents, roles, sign-in with GitHub or a code sent to your email, and self-hosting without limit.';

export interface DiffRow {
  label: string;
  cells: [string, string, string];
}
/** The tier a phone shows first in the comparison, one tier at a time. */
export const NARROW_DEFAULT_TIER: TierId = 'team';

export const DIFF_ROWS: DiffRow[] = [
  { label: 'Editors', cells: [`Up to ${FREE_EDITORS}`, 'Unlimited', 'Unlimited'] },
  { label: 'Design systems', cells: [String(FREE_DESIGN_SYSTEMS), `Up to ${TEAM_DESIGN_SYSTEMS}`, 'Unlimited'] },
  { label: 'SAML and SCIM', cells: ['No', 'No', 'Included'] },
  { label: 'Decision audit export', cells: ['No', 'No', 'Included'] },
  { label: 'Hosted for you, isolated, backed up', cells: ['No', 'No', 'Included'] },
  { label: 'Uptime', cells: ['No commitment', 'No commitment', '99.5% a month, service credits'] },
  { label: 'Support', cells: ['No commitment', 'Written, two business days', 'One business day, Paris hours'] },
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

export const FAQ_TITLE = 'Questions teams ask about price';
/** Open when the page loads. */
export const FAQ_OPEN = 'when';

export const FAQ: FaqItem[] = [
  {
    id: 'when',
    question: 'When do paid plans open?',
    answer: [
      `Not before ${PAID_PLANS_EARLIEST_LABEL}. We will write to every team at least 30 days before, with the final prices. Teams that request access by ${FOUNDING_DATE}, and teams already on Bridge, stay free.`,
    ],
  },
  {
    id: 'fourth-editor',
    question: 'What happens when we invite a fourth editor on Free?',
    answer: [
      'Today, nothing: Bridge is free for every team, with no limit on editors. Once paid plans open, the invitation waits, marked "needs Team". Nothing is charged automatically and nothing is deleted: your three editors keep working, and readers can still join.',
      'Move to Team when you are ready, and the invitation goes through.',
    ],
  },
  {
    id: 'stop-paying',
    question: 'What happens if we stop paying?',
    answer: [
      'Once paid plans open, what goes past the Free tier becomes read-only if you stop paying. Everyone can still read the design system and its decisions. Nothing is deleted.',
      'Editing comes back as soon as you pay again, or when the team fits within Free.',
    ],
  },
  {
    id: 'self-host',
    question: 'Why pay if we can self-host?',
    answer: [
      'You can self-host Bridge without any limit, on every tier. Once paid plans open, paying is for when you would rather not run it yourselves.',
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
    id: 'what-free-costs',
    question: 'Who pays for what when Bridge is free?',
    answer: [
      'Your team pays for what runs on its side: Claude runs in your own Claude account (Bridge holds no API key), your code and previews stay on your GitHub and your hosting.',
      'Bridge pays for what it hosts: Studio and the Library pages, the Claude connector, the functions behind them, storage and the emails it sends. That cost grows with use, so the hosted service is fair use on every tier, founding teams included (terms, section 8.4). A typical team never meets it. A team far above it gets a message first, then chooses: prepaid usage credits (once paid plans open, never renewed on their own), a paid plan, or self-hosting. Only a team that chooses nothing is slowed or paused, and nothing is ever deleted.',
      'Signing in with GitHub reads with your own GitHub access and costs Bridge far less than a code sent by email. Self-hosting has no limit at all.',
    ],
  },
  {
    id: 'vat',
    question: 'How do VAT and invoices work?',
    answer: [
      `Bridge sends no invoice today. Once paid plans open, invoices are issued by ${INVOICE_ENTITY}, with the mention: VAT not applicable, art. 293 B of the French tax code. A free team never receives an invoice.`,
      // TO DECIDE (Florian): this promise (30 days notice, same prices before VAT) is not confirmed yet.
      'If Bridge starts charging VAT, we tell you 30 days before and prices stay the same, VAT excluded.',
    ],
  },
  {
    id: 'refunds',
    question: 'Can we get a refund?',
    answer: ['Once paid plans open:', ...REFUND_POLICY],
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
      "Once paid plans open, Team stays free, with no sales call, for a design system whose repository is public under an OSI-approved open source license, and for teaching in a school or university: write to us with the repository link or the school's address.",
      'We offer no other discount: the cap at {cap} per design system is our discount for large teams.',
    ],
    link: { to: 'contact', label: ORGANIZATION_CONTACT_LABEL },
  },
  {
    id: 'saml',
    question: 'What does SAML on Organization do?',
    answer: [
      'Your people sign in to Bridge through your own identity provider, with your rules. With SCIM, people you add or remove there join or leave Bridge by themselves.',
      SIGN_IN,
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
