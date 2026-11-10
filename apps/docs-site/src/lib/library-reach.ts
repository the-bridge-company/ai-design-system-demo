// "Who gets it" (board LR5, Library review): which screens of which products a library piece changes, measured, never
// guessed (owner, 2026-11-10). Two layers:
//   - reachOf: who the piece is for (the team's products, the explorations that asked), the words for a piece kept
//     in its screen or answered with an existing piece. Read by the Map too.
//   - measuredReach: what the screens say. The capture robot (scripts/preview-shots.mjs measureReach) opens each
//     product's main screens and applies each waiting library change's values to them; a screen whose elements
//     change gets it. A product shows only when at least one of its screens changes; the others are named once at the
//     end ("No screen of Acme CRM changes."). A piece nobody uses yet (a new component, size or token) changes only the
//     screens that asked for it: their exploration's capture, beside the product's own screen at the same place when
//     the robot captured it. While a change is not measured yet, Bridge says so and shows no count.
// Pure: no DOM, no fetch (scripts/library-reach-data.ts reads the measurement). Read by components/ds/studio/
// LibraryReview.tsx (the reach link and column) and LibraryReach.tsx (the page). Tested in library-reach.test.ts.
import { isRemoval, tokenGroup, type ReviewPiece } from './library-review';
import { askersOf } from './library-askers';
import type { ThumbSpec } from './branch-thumb';

export interface ReachProductInput {
  key: string;
  name: string;
  /** The library's own product (the design system repository): it is where the piece goes, not who gets it. */
  default?: boolean | undefined;
}

/** A screen Bridge knows: an exploration that asked for the piece, with its preview capture when there is one. */
export interface ReachScreen {
  /** The exploration's key as Library review reads it ("prints#2", "owner/repo#12"). */
  key: string;
  name: string;
  designer: string | null;
  href: string | null;
  number: number;
  /** The product key of the exploration's repository, null for one in the design system repository. */
  productKey: string | null;
}

export interface ReachProduct {
  key: string;
  name: string;
  screens: ReachScreen[];
}

export interface Reach {
  products: ReachProduct[];
  /** The screens Bridge knows get it (the explorations that asked), never a guess. */
  screens: number;
  /** A change to something that exists: every screen that uses it changes. */
  everywhere: boolean;
  /** Decided: kept in its screen or answered with an existing piece. The library does not change. */
  stays: boolean;
  /** One plain sentence under the title of the Who gets it page. */
  sentence: string;
  /** What the reach link reads in One by one and List: "2 products", "2 products · 1 screen". */
  link: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Acme Prints and Acme CRM", "Acme Prints, Acme CRM and Acme Shop". */
export function listWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const numberOf = (key: string): number => {
  const m = /#(\d+)$/.exec(key);
  return m ? Number(m[1]) : 0;
};

/** The screens that asked for a piece: its exploration, or both explorations of a conflict. */
export function askingScreens(p: ReviewPiece, products: readonly ReachProductInput[]): ReachScreen[] {
  const keyOfName = (name: string | null | undefined) => products.find((x) => x.name.toLowerCase() === (name ?? '').toLowerCase());
  const own = (k: string | null | undefined) => {
    const pr = k ? products.find((x) => x.key.toLowerCase() === k.toLowerCase()) : null;
    return pr && !pr.default ? pr.key : null;
  };
  if (p.conflict)
    return p.conflict.ways.map((w) => {
      const pr = keyOfName(w.product);
      return { key: w.key, name: w.exploration, designer: w.designer, href: w.key === p.asked?.key ? p.asked.href : null, number: numberOf(w.key), productKey: pr && !pr.default ? pr.key : null };
    });
  return askersOf(p).map((a) => ({ key: a.key, name: a.name, designer: a.designer, href: a.href, number: numberOf(a.key), productKey: own(a.productKey) ?? own(keyOfName(a.product)?.key) }));
}

/** Which product a screen belongs to, by key; the library's own product for an exploration of the design system repository. */
const productOfScreen = (s: ReachScreen, products: readonly ReachProductInput[]): ReachProductInput | null =>
  (s.productKey ? products.find((x) => x.key.toLowerCase() === s.productKey!.toLowerCase()) : products.find((x) => x.default)) ?? null;

/** Who gets a piece: the products, the screens Bridge knows in each, and the words for both. */
export function reachOf(p: ReviewPiece, products: readonly ReachProductInput[]): Reach {
  const screens = askingScreens(p, products);
  const stays = p.decided === 'kept' || p.decided === 'existing';
  const everywhere = !stays && (/(change|fix)$/i.test(p.kind) || isRemoval(p));
  const reached = stays ? [] : products.filter((x) => !x.default);
  const out: ReachProduct[] = reached.map((x) => ({ key: x.key, name: x.name, screens: screens.filter((s) => productOfScreen(s, products)?.key === x.key) }));
  // An exploration of the library itself (the design system repository) asked: its product shows too, its screen in it.
  for (const s of screens) {
    const pr = productOfScreen(s, products);
    if (!stays && pr && pr.default && !out.some((x) => x.key === pr.key)) out.push({ key: pr.key, name: pr.name, screens: screens.filter((y) => productOfScreen(y, products)?.key === pr.key) });
  }
  const known = out.reduce((n, x) => n + x.screens.length, 0);
  const names = listWords(out.map((x) => x.name));
  let sentence: string;
  if (stays) {
    const who = p.asked?.designer ? `${p.asked.designer}'s screen` : 'its screen';
    sentence = p.decided === 'kept' ? `Kept in ${who}: the library does not change, no product gets it.` : `Answered with ${p.decidedLabel?.replace(/^Uses\s+/, '') ?? 'an existing piece'}: the library does not change.`;
  } else if (!out.length) sentence = 'This team has no product in Bridge yet: the library is all that gets it.';
  else if (everywhere) sentence = `Every screen of ${names} that uses it changes.`;
  else sentence = `${names} ${out.length === 1 ? 'gets' : 'get'} it in the library. Nothing changes until a screen uses it${known ? `: ${known === 1 ? 'the screen' : `the ${known} screens`} below asked for it first` : ''}.`;
  const productWords = out.length ? plural(out.length, 'product') : 'No product';
  // A screen count only when it is the whole story: a new piece reaches exactly the screens that asked for it.
  const link = !everywhere && known && !stays ? `${productWords} · ${plural(known, 'screen')}` : productWords;
  return { products: out, screens: known, everywhere, stays, sentence, link };
}

/** The origin of a piece as one plain sentence (no chips): "Asked by Leo in Bulk actions on products, Acme Prints." */
export function originSentence(p: ReviewPiece, viewerName: string | null): { before: string; link: { label: string; href: string | null } | null; after: string } {
  const kind = p.kind.charAt(0).toLowerCase() + p.kind.slice(1);
  const article = /^[aeiou]/i.test(kind) ? 'An' : 'A';
  const what = ` ${article} ${kind}.`;
  if (p.conflict) {
    const [a, b] = p.conflict.ways;
    return { before: `Asked two ways: ${a!.designer} in ${a!.exploration}, ${b!.designer} in ${b!.exploration}.`, link: null, after: '' };
  }
  if (!p.asked) {
    const who = p.mine ? 'you' : (p.by ?? 'a lead');
    return { before: `Made by ${who}.${what}`, link: null, after: '' };
  }
  const all = askersOf(p);
  if (all.length > 1) {
    const first = all[0]!;
    return { before: `Asked by ${all.length} explorations, most recently `, link: { label: first.name, href: first.href }, after: `${first.designer ? ` by ${first.designer}` : ''}${first.product ? `, ${first.product}` : ''}.${what}` };
  }
  const who = p.mine ? 'you' : (p.asked.designer ?? 'a designer');
  const self = viewerName && p.asked.designer && viewerName.toLowerCase() === p.asked.designer.toLowerCase();
  return { before: `Asked by ${self ? 'you' : who} in `, link: { label: p.asked.name, href: p.asked.href }, after: `${p.asked.product ? `, ${p.asked.product}` : ''}.${what}` };
}

/** How many screen cards a product shows before "Show all N". */
export const REACH_SHOWN = 4;

/** The cards a product shows, and the "Show all N" it needs. */
export function shownScreens<T>(screens: readonly T[], open: boolean, max = REACH_SHOWN): { shown: T[]; more: string | null } {
  if (open || screens.length <= max) return { shown: [...screens], more: null };
  return { shown: screens.slice(0, max), more: `Show all ${screens.length}` };
}

/**
 * The List's Who gets it column: when every row reaches the same products, the header names them once ("Acme Prints
 * and Acme CRM") and a row says only what differs (its screen count), else nothing until hovered.
 */
export function reachColumn(reaches: readonly Reach[]): { shared: string | null } {
  const sets = reaches.map((r) => r.products.map((p) => p.key).join('|'));
  if (!reaches.length || !sets[0] || sets.some((x) => x !== sets[0])) return { shared: null };
  const names = reaches[0]!.products.map((p) => p.name);
  // Short enough for a column header: "Acme Prints, Acme CRM".
  return { shared: names.length <= 2 ? names.join(', ') : `${names.length} products` };
}

// ---------------------------------------------------------------------------------------------------------------
// Measured: what the robot saw on each product's screens.

export type ElementCounts = { buttons: number; links: number; fields: number; text: number; surfaces: number };

/** One measurement of a team, images as URLs Studio can show (scripts/library-reach-data.ts resolves them). */
export interface ReachData {
  measuredAt: string;
  products: { key: string; name: string; screens: { id: string; route: string; title: string; image: string }[] }[];
  changes: { repo: string; pr: number; state: 'measured' | 'new' | 'unmeasured'; screens: { id: string; before: string; after: string; elements: ElementCounts }[] }[];
}

/** A screen card of Who gets it: the screen today, with the change, and what changes on it. */
export interface MeasuredScreen {
  key: string;
  title: string;
  /** The screen as it is (null: the product has no such screen yet). */
  before: string | null;
  /** The same screen with the change (an image URL), or the exploration's capture. */
  after: ThumbSpec | null;
  /** "2 buttons, links"; null for an exploration's screen (it changes as the exploration shows). */
  words: string | null;
  /** The exploration that asked, for a screen of one. */
  href: string | null;
  designer: string | null;
}

export interface MeasuredProduct {
  key: string;
  name: string;
  /** How many screens the robot measured in it. */
  measured: number;
  screens: MeasuredScreen[];
}

export interface Measured {
  /**
   * measuring: not measured yet. measured: the robot applied the change to every screen. asked: nothing uses it yet,
   * only the screens that asked change. stays: decided, the library does not change. none: the team has no product.
   */
  status: 'measuring' | 'measured' | 'asked' | 'stays' | 'none';
  products: MeasuredProduct[];
  /** The products whose screens do not change, named once at the end. */
  unchanged: string[];
  screens: number;
  /** Under the title: "11 screens in 2 products: buttons and links." */
  headline: string;
  /** One plain line at the end, when there is one ("No screen of Acme CRM changes."). */
  end: string | null;
  /** The reach link and the List's cell: "11 screens", "No screen changes", "Measuring". */
  cell: string;
  measuredAt: string | null;
}

const KINDS: [keyof ElementCounts, string, string][] = [
  ['buttons', 'button', 'buttons'],
  ['links', 'a link', 'links'],
  ['fields', 'a field', 'fields'],
  ['text', 'text', 'text'],
  ['surfaces', 'a surface', 'surfaces'],
];

/** What changes on one screen, in a few words: "2 buttons, links", "1 button", "text". Buttons are counted. */
export function elementWords(c: Partial<ElementCounts> | null | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  for (const [k, one, many] of KINDS) {
    const n = c[k] ?? 0;
    if (!n) continue;
    parts.push(k === 'buttons' ? plural(n, 'button') : n === 1 ? one : many);
  }
  return parts.slice(0, 3).join(', ');
}

/** What changes across screens, for the headline: "buttons and links". */
export function kindsWords(all: readonly Partial<ElementCounts>[]): string {
  const names = KINDS.filter(([k]) => all.some((c) => (c[k] ?? 0) > 0)).map(([, , many]) => many);
  return listWords(names.slice(0, 3));
}

/** Where a screen is in its app, to match an exploration's screen with a product's: "/products" for "/?t=a#/products?v=1". */
export function routeKey(route: string | null | undefined): string {
  if (!route) return '';
  const hash = route.indexOf('#/');
  const path = hash >= 0 ? route.slice(hash + 1) : route.replace(/[?#].*$/, '');
  return path.replace(/[?].*$/, '').replace(/\/+$/, '').toLowerCase();
}

const NEW_KIND = /^New\b/;
const orList = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`);
const nobodyLine = (names: readonly string[]) => (names.length ? `No screen of ${orList(names)} changes.` : null);

/**
 * What a piece does to the team's screens. `data`: the team's measurement (null while read or when none exists yet),
 * `asking`: the capture of each asking exploration by screenKey, with its route when known.
 */
export function measuredReach(p: ReviewPiece, reach: Reach, data: ReachData | null, asking: ReadonlyMap<string, { spec: ThumbSpec; route: string | null }>): Measured {
  const base = { products: [] as MeasuredProduct[], unchanged: [] as string[], screens: 0, end: null as string | null, measuredAt: data?.measuredAt ?? null };
  if (reach.stays) return { ...base, status: 'stays', headline: reach.sentence, cell: 'No screen changes' };
  if (!reach.products.length) return { ...base, status: 'none', headline: reach.sentence, cell: 'No product' };
  const named = new Map(reach.products.map((x) => [x.key.toLowerCase(), x.name]));
  const nameOf = (key: string, fallback: string) => named.get(key.toLowerCase()) ?? fallback;
  const change = p.source.kind === 'change' && data ? (data.changes.find((c) => c.repo.toLowerCase() === p.source.repo.toLowerCase() && c.pr === p.source.number) ?? null) : null;
  const isNew = NEW_KIND.test(p.kind) || p.kind === 'Docs' || change?.state === 'new';
  const valueChange = !isNew && Boolean(tokenGroup(p.title) ?? tokenGroup(p.category)) && change?.state !== 'unmeasured';

  if (change?.state === 'measured') {
    const products: MeasuredProduct[] = [];
    const unchanged: string[] = [];
    for (const product of data!.products) {
      const byId = new Map(product.screens.map((s) => [s.id, s]));
      const screens: MeasuredScreen[] = change.screens
        .filter((s) => byId.has(s.id))
        .map((s) => ({ key: s.id, title: byId.get(s.id)!.title, before: s.before, after: { kind: 'screen', src: s.after, screen: byId.get(s.id)!.title, seed: s.id }, words: elementWords(s.elements), href: null, designer: null }));
      const name = nameOf(product.key, product.name);
      if (screens.length) products.push({ key: product.key, name, measured: product.screens.length, screens });
      else if (product.screens.length) unchanged.push(name);
    }
    const n = products.reduce((k, x) => k + x.screens.length, 0);
    if (!n) return { ...base, status: 'measured', unchanged, headline: nobodyLine(unchanged) ?? 'No screen changes.', cell: 'No screen changes' };
    const where = products.length === 1 ? products[0]!.name : plural(products.length, 'product');
    const what = kindsWords(change.screens.filter((s) => products.some((x) => x.screens.some((y) => y.key === s.id))).map((s) => s.elements));
    return { ...base, status: 'measured', products, unchanged, screens: n, headline: `${plural(n, 'screen')} in ${where}${what ? `: ${what}` : ''}.`, end: nobodyLine(unchanged), cell: plural(n, 'screen') };
  }

  if (valueChange && p.source.kind === 'change' && !change) {
    return { ...base, status: 'measuring', headline: 'Bridge is measuring which screens change.', cell: 'Measuring' };
  }

  // Nothing uses it yet, or it is not in the library yet: the screens that asked for it are the ones that change.
  const productScreen = (key: string | null, route: string | null) => {
    const product = data?.products.find((x) => x.key.toLowerCase() === (key ?? '').toLowerCase());
    if (!product || route === null) return null;
    const k = routeKey(route);
    return product.screens.find((s) => routeKey(s.route) === k)?.image ?? null;
  };
  const products: MeasuredProduct[] = [];
  for (const x of reach.products) {
    if (!x.screens.length) continue;
    const screens: MeasuredScreen[] = x.screens.map((s) => {
      const shot = asking.get(`${(s.productKey ?? '').toLowerCase()}#${s.number}`) ?? null;
      return { key: s.key, title: s.name, before: productScreen(s.productKey, shot?.route ?? null), after: shot?.spec ?? { kind: 'screen', src: null, screen: s.name, seed: s.key }, words: null, href: s.href, designer: s.designer };
    });
    products.push({ key: x.key, name: x.name, measured: 0, screens });
  }
  const n = products.reduce((k, x) => k + x.screens.length, 0);
  const others = reach.products.filter((x) => !products.some((y) => y.key === x.key)).map((x) => x.name);
  const where = products.length === 1 ? products[0]!.name : plural(products.length, 'product');
  const headline = n ? `${plural(n, 'screen')} in ${where}: ${n === 1 ? 'the screen that asked for it' : 'the screens that asked for it'}.` : isNew ? 'No screen changes until a screen uses it.' : 'No screen asked for it yet.';
  const end = isNew ? nobodyLine(others) : 'Bridge measures the other screens once this change is in the library.';
  return { ...base, status: 'asked', products, unchanged: isNew ? others : [], screens: n, headline, end: n || !isNew ? end : null, cell: n ? plural(n, 'screen') : 'No screen changes yet' };
}

/** A row's cell in the Who gets it column and the reach link: the measured words. */
export function reachCell(m: Measured): { label: string; hoverOnly: boolean } {
  return { label: m.cell, hoverOnly: false };
}
