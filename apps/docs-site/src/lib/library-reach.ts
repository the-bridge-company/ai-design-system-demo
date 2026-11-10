// "Who gets it" (board lr-reach, phase 3 of Library review): which products a library piece reaches and which of their
// screens Bridge actually knows. Rules (owner, 2026-11-09):
//   - a piece added to the library reaches every product of the team (they all build on the library); a piece kept in
//     its screen, or answered with an existing piece, changes nothing in the library;
//   - the only screens Bridge knows are the explorations that asked for the piece (their preview captures). Bridge
//     does not measure which other screens use a color or a component yet, so it never counts them: it names the
//     products and says plainly that their screen list is not known yet;
//   - a change to something that exists reaches every screen that uses it; a new piece changes nothing until a screen
//     uses it, so the screens that asked for it are the ones that get it first.
// Pure: no DOM, no fetch. Read by components/ds/studio/LibraryReview.tsx (the reach link, the Who gets it page, the
// Map's product links). Tested in library-reach.test.ts.
import { isRemoval, type ReviewPiece } from './library-review';
import { askersOf } from './library-askers';

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
  else if (everywhere) sentence = `Every screen of ${names} that uses it changes. Bridge does not list those screens yet.`;
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

/** What the piece does to screens, said once on the Who gets it origin line ("Nothing changes until a screen uses it."). */
export function effectLine(r: Reach): string {
  if (r.stays || !r.products.length) return r.sentence;
  return r.everywhere ? 'Every screen that uses it changes.' : 'Nothing changes until a screen uses it.';
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

/** A row's cell in that column: its own words, or, with the products named in the header, only its screens. */
export function reachCell(r: Reach, shared: boolean): { label: string; hoverOnly: boolean } {
  if (!shared) return { label: r.link, hoverOnly: false };
  // Always visible, never a hover-only link: every row says what it does to screens (owner, 2026-11-10).
  if (r.everywhere) return { label: 'Every screen', hoverOnly: false };
  if (r.screens && !r.stays) return { label: `${r.screens} ${r.screens === 1 ? 'screen' : 'screens'}`, hoverOnly: false };
  return { label: 'No screen yet', hoverOnly: false };
}
