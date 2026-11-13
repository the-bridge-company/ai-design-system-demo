// The product level of Studio, like a project folder in Figma: one page per product the team configures
// (bridge.config.json "products": a product app with its own repository, and the library itself, which is an
// exploration target too). No folder of one's own, no sub-folder: the product is the only grouping, since it maps to
// a real repository or app.
//   - The product page (pages/studio/products/[key].astro, team shell pages/team-shell/products/item.astro, island
//     components/ds/studio/ProductPage.tsx): its explorations grouped by where they stand.
//   - The side nav's Products group (components/ds/studio/ProductsNav.tsx).
//   - The Home's product folders under Recent explorations (components/ds/studio/ExplorationCards.tsx).
// Pure: no DOM, no fetch. Unit tested in product-page.test.ts.
import { defaultProduct, type ProductConfig } from '@bridge-ds/core';
import { STUDIO_ROOT, studioHref } from './team-path';
import type { LifecycleStage } from './review-state';
import { STEP_LABEL, stepCount } from './status-ladder';
import type { ExplorationCard } from './home-explorations';
import type { ThumbSpec } from './branch-thumb';
import type { StageTab } from './branches-page';
import { SEP } from './sep';

/** A product key as bridge.config.json writes it, and as a product page address carries it. */
export const PRODUCT_KEY_PATTERN = '[A-Za-z0-9][A-Za-z0-9-]*';
const KEY = new RegExp(`^${PRODUCT_KEY_PATTERN}$`);

/** The Studio address of a product page: /studio/products/<key>/ (the team's own on a team shell). */
export const productHref = (key: string): string => studioHref(`products/${encodeURIComponent(key.toLowerCase())}/`);

/**
 * A product page's title: the product's name, and for the library (the default product) "Library explorations", the
 * page the side nav names Explorations under Design system (lib/nav-products.ts).
 */
export const productPageTitle = (p: Pick<ProductConfig, 'name' | 'default'>): string => (p.default ? `${p.name} explorations` : p.name);

/** The product key of a product page address (self-hosted or a team's), else null. */
export function productKeyFromPath(pathname: string): string | null {
  const m = /\/products\/([^/]+)\/?(?:index\.html)?$/.exec(pathname);
  if (!m || !pathname.startsWith(STUDIO_ROOT)) return null;
  let key: string;
  try {
    key = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return KEY.test(key) ? key.toLowerCase() : null;
}

/** The product a card belongs to: its key, else the library (the default product). */
export const cardProductKey = (c: Pick<ExplorationCard, 'productKey'>, products: readonly ProductConfig[]): string => (c.productKey ?? defaultProduct(products).key).toLowerCase();

/** Where an exploration stands on a product page, in the order the page lists them. */
export type ProductStateKey = 'running' | 'lead' | 'review' | 'waiting' | 'building' | 'shipped' | 'not-planned';

/**
 * The groups of a product page, on the one status ladder (lib/status-ladder): Exploring, In review (waiting for the
 * lead), Ready to build, Being built, Checking, Shipped, Not doing this. Archived ones are folded apart.
 */
export const PRODUCT_STATES: { key: ProductStateKey; label: string; count: (n: number) => string; open: boolean }[] = [
  { key: 'running', label: STEP_LABEL.exploring, count: (n) => stepCount(n, 'exploring'), open: true },
  { key: 'lead', label: STEP_LABEL['in-review'], count: (n) => stepCount(n, 'in-review'), open: true },
  { key: 'waiting', label: STEP_LABEL['ready-to-build'], count: (n) => stepCount(n, 'ready-to-build'), open: true },
  { key: 'building', label: STEP_LABEL['being-built'], count: (n) => stepCount(n, 'being-built'), open: true },
  { key: 'review', label: STEP_LABEL.checking, count: (n) => stepCount(n, 'checking'), open: true },
  { key: 'shipped', label: STEP_LABEL.shipped, count: (n) => stepCount(n, 'shipped'), open: false },
  { key: 'not-planned', label: STEP_LABEL['not-doing'], count: (n) => stepCount(n, 'not-doing'), open: false },
];

/** The group of each status (lib/exploration-state): the one status decides, never the words on the card. */
const GROUP_OF: Record<LifecycleStage, ProductStateKey | null> = {
  exploring: 'running',
  'waiting-for-lead': 'lead',
  'waiting-for-code': 'waiting',
  'being-built': 'building',
  'in-review': 'review',
  approved: 'review',
  'next-release': 'shipped',
  shipped: 'shipped',
  'not-planned': 'not-planned',
  // Archived cards are folded apart; closed ones are not listed.
  archived: null,
  closed: null,
};

/** The group of a card, from its one status; null for the ones a product page does not group (archived, closed). */
export const stateOfCard = (c: Pick<ExplorationCard, 'lifecycle'>): ProductStateKey | null => GROUP_OF[c.lifecycle];

/** The cards in their state groups, in PRODUCT_STATES order, card order kept inside; empty groups left out. */
export function productGroups<C extends Pick<ExplorationCard, 'lifecycle'>>(cards: readonly C[]): { key: ProductStateKey; label: string; cards: C[] }[] {
  return PRODUCT_STATES.map((s) => ({ key: s.key, label: s.label, cards: cards.filter((c) => stateOfCard(c) === s.key) })).filter((g) => g.cards.length > 0);
}

/** How many cards stand in each state, with `more`: the states of the product's other work (the library's changes). */
export function productCounts(cards: readonly Pick<ExplorationCard, 'lifecycle'>[], more: readonly ProductStateKey[] = []): Record<ProductStateKey, number> {
  const out: Record<ProductStateKey, number> = { running: 0, lead: 0, review: 0, waiting: 0, building: 0, shipped: 0, 'not-planned': 0 };
  for (const c of cards) {
    const k = stateOfCard(c);
    if (k) out[k] += 1;
  }
  for (const k of more) out[k] += 1;
  return out;
}

/** The work in progress of a product, in words: ["2 exploring", "1 ready to build"]. Done work is not in progress. */
function inProgress(cards: readonly Pick<ExplorationCard, 'lifecycle'>[], more: readonly ProductStateKey[] = [], noun: readonly [string, string] | null = null): string[] {
  const n = productCounts(cards, more);
  // With a noun, each count says what it counts: "11 changes in review" (lib/waiting-counts).
  const named = (text: string, k: number) => (noun ? text.replace(/^(\d+) /, `$1 ${noun[k === 1 ? 0 : 1]} `) : text);
  return PRODUCT_STATES.filter((s) => s.open && n[s.key] > 0).map((s) => named(s.count(n[s.key]), n[s.key]));
}

/** At most this many clauses on a folder card's line. */
const FOLDER_PARTS = 2;

/**
 * A folder card's line: "2 exploring · 1 ready to build", "3 shipped", or "Nothing in progress". `more`: the
 * states of the product's work that is not an exploration card, the library's own changes (libraryChangeState), so
 * the Library folder counts what Changes lists under Library.
 */
export function folderLine(cards: readonly Pick<ExplorationCard, 'lifecycle'>[], sep = SEP, more: readonly ProductStateKey[] = [], noun: readonly [string, string] | null = null, unsure = false): string {
  const parts = inProgress(cards, more, noun);
  // One short line on a card: the first step, then the rest as one count ("13 changes in review · 3 more in
  // progress"); the product page lists every step.
  if (parts.length > FOLDER_PARTS) {
    const n = productCounts(cards, more);
    const rest = PRODUCT_STATES.filter((s) => s.open && n[s.key] > 0)
      .slice(FOLDER_PARTS - 1)
      .reduce((a, s) => a + n[s.key], 0);
    return [...parts.slice(0, FOLDER_PARTS - 1), `${rest} more in progress`].join(sep);
  }
  if (parts.length) return parts.join(sep);
  const shipped = productCounts(cards, more).shipped;
  if (shipped) return `${shipped} shipped`;
  // A read failed on the way (`unsure`): no line rather than "Nothing in progress" when there may be some.
  return unsure ? '' : 'Nothing in progress';
}

/**
 * Where a library change stands, as a product group of Changes (lib/branches-page stateOf, the tab Changes files it
 * under): Exploring, Waiting to be picked up, Being built, In review. Null for a row Changes lists under no open tab.
 */
export function libraryChangeState(tab: StageTab | null): ProductStateKey | null {
  return tab ? TAB_STATE[tab] : null;
}

const TAB_STATE: Record<StageTab, ProductStateKey | null> = { exploring: 'running', code: 'waiting', building: 'building', review: 'review' };

/** The product page header's summary: "2 exploring, 1 ready to build.", or why the page is quiet. */
export function productSummary(cards: readonly Pick<ExplorationCard, 'lifecycle'>[]): string {
  const parts = inProgress(cards);
  if (parts.length) return `${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}.`;
  const shipped = productCounts(cards).shipped;
  if (shipped) return `${shipped} shipped, nothing in progress.`;
  return 'Nothing explored here yet.';
}

/** What the Library card counts: changes to the library (its explorations and its own changes). */
export const LIBRARY_NOUN = ['change', 'changes'] as const;

/** How many captures a folder card shows. */
export const FOLDER_SHOTS = 3;

export interface ProductFolder {
  key: string;
  name: string;
  href: string;
  /** The latest explorations' screens, newest first (capture, else its plate), FOLDER_SHOTS at most, with who explores each. */
  shots: { key: string; spec: ThumbSpec; who: ExplorationCard['author'] }[];
  /** "2 exploring · 1 waiting for code". */
  line: string;
  total: number;
  /** The library (the default product): with no screen of its own, its folder shows the library's Field Guide drawing. */
  library: boolean;
}

/** The steps with developers (Ready to build, Being built, Checking): Being built's rows are their one count source. */
export const WITH_DEVELOPERS: readonly ProductStateKey[] = ['waiting', 'building', 'review'];
const isWithDevelopers = (k: ProductStateKey | null | undefined): boolean => Boolean(k) && WITH_DEVELOPERS.includes(k!);

/** A Being built status (lib/building-page BuildState) as a folder counts it; null for what is not in progress there. */
const BUILD_FOLDER_STATE: Record<string, ProductStateKey | null> = { waiting: 'waiting', 'in-progress': 'building', 'in-review': 'review' };

/**
 * The steps with developers of each product, from the rows Being built lists (their state, lib/building-page
 * buildStateOf, and their product, lib/building-view rowProduct): the Home's folders count these, so the Library card,
 * the Home's build line and Being built say the same numbers.
 */
export function buildStatesByProduct(rows: readonly { state: string | null; product: string }[]): Record<string, ProductStateKey[]> {
  const out: Record<string, ProductStateKey[]> = {};
  for (const r of rows) {
    const k = r.state ? BUILD_FOLDER_STATE[r.state] : null;
    if (k) (out[r.product] ??= []).push(k);
  }
  return out;
}

/**
 * The Home's product folders: one per configured product, in the configured order, each with the screens of its
 * latest explorations and what is in progress. A product without any exploration keeps its folder (it is a real app).
 */
export function productFolders(
  products: readonly ProductConfig[],
  cards: readonly ExplorationCard[],
  shots = FOLDER_SHOTS,
  more: Readonly<Record<string, readonly ProductStateKey[]>> = {},
  unsure = false,
  build?: Readonly<Record<string, readonly ProductStateKey[]>> | null,
  /** A product's In review count from its own queue (the Library: Library review's waiting pieces), when read. */
  inReview: Readonly<Record<string, number>> = {},
): ProductFolder[] {
  const library = products.length ? defaultProduct(products).key.toLowerCase() : null;
  // With Being built's rows (`build`, buildStatesByProduct), the steps with developers are counted from them only: the
  // folder says what Being built and the Home's build line say. Until they are read (null), only the explorations' own
  // steps count (each exploration handed to developers is one of those rows); the library's own changes never do.
  const withBuild = Boolean(build);
  // With its queue's count (`inReview`), a product's In review is that count, the number its queue and rail say.
  const queued = (k: string) => typeof inReview[k] === 'number';
  const counted = (cs: readonly ExplorationCard[], k: string) => cs.filter((c) => !(withBuild && isWithDevelopers(stateOfCard(c))) && !(queued(k) && stateOfCard(c) === 'lead'));
  const moreOf = (k: string): ProductStateKey[] => {
    let own: ProductStateKey[] = [...(more[k] ?? [])];
    if (build !== undefined) own = [...own.filter((s) => !isWithDevelopers(s)), ...(build?.[k] ?? [])];
    if (queued(k)) own = [...own.filter((s) => s !== 'lead'), ...Array.from({ length: inReview[k]! }, () => 'lead' as const)];
    return own;
  };
  return products.map((p) => {
    const mine = cards.filter((c) => cardProductKey(c, products) === p.key.toLowerCase());
    const latest = [...mine].sort((a, b) => b.updated.localeCompare(a.updated));
    return {
      key: p.key,
      name: p.name,
      href: productHref(p.key),
      shots: latest.slice(0, shots).map((c) => ({ key: c.key ?? String(c.number), spec: c.preview, who: c.author })),
      // The Library card counts changes to the library, whoever reviews them: it names them, so "11 changes in review"
      // never reads as the Library review badge (pieces waiting for the viewer's decision, lib/waiting-counts).
      line: folderLine(counted(mine, p.key.toLowerCase()), SEP, moreOf(p.key.toLowerCase()), p.key.toLowerCase() === library ? LIBRARY_NOUN : null, unsure),
      total: counted(mine, p.key.toLowerCase()).length + moreOf(p.key.toLowerCase()).length,
      library: p.key.toLowerCase() === library,
    };
  });
}

/** The facts line of a product page: where it is live, where its code lives, and whether Bridge reaches it. */
export interface ProductFacts {
  production: { href: string; label: string } | null;
  repo: { href: string; label: string } | null;
  /** "In the library repository": the product lives next to the design system. */
  inLibrary: string | null;
  /** "Connected", "Not connected yet", or null while unknown. */
  connection: { text: string; ok: boolean } | null;
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * `ownRepo`: the product's own repository ("owner/name"), null when it lives in the library repository. `reached`:
 * whether Studio could read that repository (true, false), null while unknown or for the library repository.
 */
export function productFacts(product: ProductConfig, ownRepo: string | null, reached: boolean | null): ProductFacts {
  const production = product.production ? { href: product.production, label: host(product.production) } : null;
  return {
    production,
    repo: ownRepo ? { href: `https://github.com/${ownRepo}`, label: ownRepo } : null,
    inLibrary: ownRepo ? null : 'In the library repository',
    connection: ownRepo && reached !== null ? (reached ? { text: 'Connected', ok: true } : { text: 'Not connected yet', ok: false }) : null,
  };
}

/**
 * The empty product page: why it is worth starting, in one sentence, under the one action (the header says it is
 * empty). The library is a lead's to change (lib/design-lead): a designer of the team (`lead` false) gets no
 * start action there, so the line is the page's lead instead: what the page is for, and where their asks go.
 */
export function emptyProductLine(product: ProductConfig, library: boolean, lead = true): string {
  if (library && !lead) return 'The library your products use. Leads change it, so ask them for what you need.';
  return library
    ? 'Try a token, a variant or a new component with Claude AI, in a safe copy of the library, before it goes to review.'
    : `Try a screen or a flow for ${product.name} with Claude AI, in a safe copy, before it goes to review.`;
}

/** A visitor on a product Bridge cannot read for them (its repository is private): the one thing they can do. */
export const signedOutProductLine = (name: string): string => `Sign in to see what your team explores in ${name}.`;

/**
 * A designer of the team on the library's page (no start action there): the two ways to ask, each a card to its page
 * with its Field Guide drawing. A component change from Components, a token change from Tokens; both reach a lead.
 */
export const LIBRARY_ASKS = [
  { key: 'component', title: 'Ask for a component change', line: 'Open a component and say what should change. A lead picks it up.', path: 'components/', drawing: 'components' },
  { key: 'token', title: 'Suggest a token change', line: 'Adjust a color, size or spacing. A lead reviews it before it ships.', path: 'tokens/', drawing: 'tokens' },
] as const;

/** The quiet line at the end of a product page: "1 archived.", "2 archived.". */
export const archivedLine = (n: number): string => `${n} archived.`;

/** "See archived": Changes' Archived tab, kept to this product. */
export const archivedHref = (key: string): string => studioHref(`explorations/?status=archived&product=${encodeURIComponent(key.toLowerCase())}`);
