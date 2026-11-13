// The Map view of Library review (board lr-map, phase 3): one picture of where each piece comes from and who gets it,
// in three columns linked by curves:
//   where it comes from   the explorations that asked (one box each), and a lead's own changes as one dashed box per
//                         kind, saying who and where from once ("Leo, in Figma", "Leo, docs drafts");
//   what changes          the pieces (past 3, a lead's changes of one kind fold into one box: "4 docs drafts");
//   who gets it           the products (lib/library-reach).
// A conflict is two links into one piece, drawn amber. Clicking a box narrows the list under the map ("Showing what
// <exploration> asks for · 3 of 14 · Show all"). The list under the map is the List itself (owner, 2026-11-13): the
// same rows, checkboxes and decisions; the map only picks which pieces it shows.
// Pure: no DOM, no fetch. Drawn by components/ds/studio/LibraryReview.tsx (MapView). Tested in library-map.test.ts.
import { reachOf, type ReachProductInput } from './library-reach';
import type { ReviewPiece, Viewer } from './library-review';
import { askersOf } from './library-askers';
import { SEP } from './sep';

export interface MapSource {
  id: string;
  label: string;
  /** Under the label: "Sofia · Acme CRM", "Dana · 8 changes". */
  sub: string;
  /** A lead's own changes: drawn dashed. */
  lead: boolean;
}

export interface MapPiece {
  id: string;
  label: string;
  /** The pieces behind the box: one, or a lead's own changes folded. */
  keys: string[];
  /** Two explorations change it differently. */
  conflict: boolean;
  folded: boolean;
}

export interface MapProduct {
  id: string;
  label: string;
}

export interface MapLink {
  from: string;
  to: string;
  /** One of the two links into a conflict. */
  conflict: boolean;
}

export interface MapGraph {
  sources: MapSource[];
  pieces: MapPiece[];
  products: MapProduct[];
  links: MapLink[];
}

/**
 * One box per exploration, whatever key the piece carries (a library change names it by product, a recorded piece by
 * repository): its name and product.
 */
const sourceId = (name: string, product: string | null) => `s:${name.toLowerCase()}|${(product ?? '').toLowerCase()}`;

/** Where a lead's own change comes from, in words: "in Figma", "docs drafts". */
const KIND_WORDS: Record<string, { from: string; many: string }> = {
  figma: { from: 'in Figma', many: 'Figma changes' },
  docs: { from: 'docs drafts', many: 'docs drafts' },
  a11y: { from: 'accessibility fixes', many: 'accessibility fixes' },
  brand: { from: 'a new brand', many: 'brand changes' },
  rule: { from: 'library rules', many: 'library rules' },
};
const kindWords = (reason: string | null | undefined) => KIND_WORDS[reason ?? ''] ?? { from: 'library changes', many: 'library changes' };

/** One box per lead and kind ("Leo, in Figma"): who made it and where it comes from, said once. */
const leadId = (p: ReviewPiece) => `s:lead:${p.mine ? 'you' : (p.by ?? 'lead').toLowerCase()}:${p.leadReason ?? 'other'}`;

/** A lead's own changes past this many fold into one box named by their kind ("4 docs drafts"). */
export const LEAD_PIECES_SHOWN = 3;

/** The graph of the pieces on screen (the filters already applied), in the order the list groups them. */
export function buildMap(pieces: readonly ReviewPiece[], products: readonly ReachProductInput[], v: Pick<Viewer, 'name'>): MapGraph {
  const sources = new Map<string, MapSource>();
  const askedPieces = new Map<string, ReviewPiece[]>();
  const nodes: MapPiece[] = [];
  const links: MapLink[] = [];
  const addLink = (l: MapLink) => {
    if (!links.some((x) => x.from === l.from && x.to === l.to)) links.push(l);
  };
  for (const p of pieces) {
    if (p.conflict) {
      const id = `n:${p.key}`;
      nodes.push({ id, label: p.title, keys: [p.key], conflict: true, folded: false });
      for (const w of p.conflict.ways) {
        const sid = sourceId(w.exploration, w.product);
        if (!sources.has(sid)) sources.set(sid, { id: sid, label: w.exploration, sub: `${w.designer}${SEP}${w.product}`, lead: false });
        addLink({ from: sid, to: id, conflict: true });
      }
      continue;
    }
    if (!p.asked) {
      const sid = leadId(p);
      askedPieces.set(sid, [...(askedPieces.get(sid) ?? []), p]);
      continue;
    }
    const id = `n:${p.key}`;
    nodes.push({ id, label: p.title, keys: [p.key], conflict: false, folded: false });
    for (const x of askersOf(p)) {
      const sid = sourceId(x.name, x.product);
      if (!sources.has(sid)) sources.set(sid, { id: sid, label: x.name, sub: [x.designer, x.product].filter(Boolean).join(SEP), lead: false });
      addLink({ from: sid, to: id, conflict: false });
    }
  }
  // Each lead's own changes: one dashed box per person and kind ("Leo, in Figma"). The pieces themselves sit in the
  // middle; past LEAD_PIECES_SHOWN they fold into one box named by their kind, never by the person again.
  for (const [sid, list] of askedPieces) {
    const first = list[0]!;
    const who = first.mine ? 'You' : (first.by ?? 'A lead');
    const words = kindWords(first.leadReason);
    sources.set(sid, { id: sid, label: `${who}, ${words.from}`, sub: `${list.length} ${list.length === 1 ? 'change' : 'changes'}`, lead: true });
    if (list.length <= LEAD_PIECES_SHOWN) {
      for (const p of list) {
        const id = `n:${p.key}`;
        nodes.push({ id, label: p.title, keys: [p.key], conflict: false, folded: false });
        addLink({ from: sid, to: id, conflict: false });
      }
    } else {
      const id = `n:${sid.slice(2)}`;
      nodes.push({ id, label: `${list.length} ${words.many}`, keys: list.map((p) => p.key), conflict: false, folded: true });
      addLink({ from: sid, to: id, conflict: false });
    }
  }

  // Who gets each piece box: the union of its pieces' products.
  const byKey = new Map(pieces.map((p) => [p.key, p]));
  const productIds = new Set<string>();
  for (const n of nodes) {
    for (const k of n.keys) {
      const p = byKey.get(k);
      if (!p) continue;
      for (const pr of reachOf(p, products).products) {
        productIds.add(pr.key);
        addLink({ from: n.id, to: `d:${pr.key}`, conflict: false });
      }
    }
  }
  const out: MapProduct[] = products.filter((x) => productIds.has(x.key)).map((x) => ({ id: `d:${x.key}`, label: x.name }));
  return { sources: [...sources.values()], pieces: nodes, products: out, links };
}

export interface MapFocus {
  /** The piece keys the list keeps. */
  keys: Set<string>;
  /** The boxes and links lit (every other one is quiet). */
  lit: Set<string>;
  /** "Showing what Contact page summary asks for". */
  line: { before: string; strong: string; after: string };
  /** One piece box picked (not a folded one): its row already names it, so the line under the map does not. */
  piece: boolean;
}

const linkId = (l: MapLink) => `${l.from}>${l.to}`;
export const mapLinkId = linkId;

/** What a click on a box narrows the list to, and what lights up on the map. Null when the box is not on the map. */
export function focusOf(g: MapGraph, id: string): MapFocus | null {
  const node = g.pieces.find((n) => n.id === id);
  const source = g.sources.find((s) => s.id === id);
  const product = g.products.find((p) => p.id === id);
  if (!node && !source && !product) return null;
  let boxes: MapPiece[];
  if (node) boxes = [node];
  else if (source) boxes = g.pieces.filter((n) => g.links.some((l) => l.from === source.id && l.to === n.id));
  else boxes = g.pieces.filter((n) => g.links.some((l) => l.from === n.id && l.to === product!.id));
  const lit = new Set<string>([id]);
  const boxIds = new Set(boxes.map((b) => b.id));
  for (const l of g.links) {
    const intoBox = boxIds.has(l.to) && (!source || l.from === source.id);
    const outOfBox = boxIds.has(l.from) && (!product || l.to === product.id);
    if (intoBox || outOfBox) {
      lit.add(linkId(l));
      lit.add(l.from);
      lit.add(l.to);
    }
  }
  const keys = new Set(boxes.flatMap((b) => b.keys));
  const line = node
    ? { before: 'Showing ', strong: node.label, after: '' }
    : source
      ? source.lead
        ? { before: 'Showing ', strong: source.label, after: '' }
        : { before: 'Showing what ', strong: source.label, after: ' asks for' }
      : { before: 'Showing what ', strong: product!.label, after: ' gets' };
  return { keys, lit, line, piece: Boolean(node && !node.folded) };
}

/** The Map is offered only where it can be read: wide enough, and with something to draw. */
export const mapAvailable = (o: { narrow: boolean; pieces: number }): boolean => !o.narrow && o.pieces > 0;

/**
 * The list under the map (owner, 2026-11-13): the List itself. Nothing picked shows every piece, as the List does; a box
 * picked shows the List's rows of what it narrows to, under one line ("Showing what <exploration> asks for · 3 of 14 ·
 * Show all 14"). One piece picked keeps the count and Show all but not its name: its row says it (`named: false`).
 */
export type MapList = { kind: 'all' } | { kind: 'some'; keys: Set<string>; named: boolean };

export function mapListOf(focus: Pick<MapFocus, 'keys' | 'piece'> | null): MapList {
  return focus ? { kind: 'some', keys: focus.keys, named: !focus.piece } : { kind: 'all' };
}

/** The box a map address picks (?focus=<box id>), or null. */
export const readMapFocus = (search: string): string | null => new URLSearchParams(search).get('focus')?.trim() || null;

/** The address with the picked box (?focus=), or without it once "Show all" clears it. */
export function withMapFocus(search: string, id: string | null): string {
  const q = new URLSearchParams(search);
  if (id) q.set('focus', id);
  else q.delete('focus');
  const s = q.toString();
  return s ? `?${s}` : '';
}
