// The Map view of Library review (board lr-map, phase 3): one picture of where each piece comes from and who gets it,
// in three columns linked by curves:
//   where it comes from   the explorations that asked (one box each), and each lead's own changes as one dashed box;
//   what changes          the pieces (a lead's own changes fold into one box, "8 from you", when there are several);
//   who gets it           the products (lib/library-reach).
// A conflict is two links into one piece, drawn amber. Clicking a box narrows the list under the map ("Showing what
// <exploration> asks for · 3 of 14 · Show all"). Read only: nobody decides from the map.
// Pure: no DOM, no fetch. Drawn by components/ds/studio/LibraryReview.tsx (MapView). Tested in library-map.test.ts.
import { reachOf, type ReachProductInput } from './library-reach';
import type { ReviewPiece, Viewer } from './library-review';
import { askersOf } from './library-askers';

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

const leadId = (p: ReviewPiece) => `s:lead:${p.mine ? 'you' : (p.by ?? 'lead').toLowerCase()}`;

/** The graph of the pieces on screen (the filters already applied), in the order the list groups them. */
export function buildMap(pieces: readonly ReviewPiece[], products: readonly ReachProductInput[], v: Pick<Viewer, 'name'>): MapGraph {
  const sources = new Map<string, MapSource>();
  const leadPieces = new Map<string, ReviewPiece[]>();
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
        if (!sources.has(sid)) sources.set(sid, { id: sid, label: w.exploration, sub: `${w.designer} · ${w.product}`, lead: false });
        addLink({ from: sid, to: id, conflict: true });
      }
      continue;
    }
    if (!p.asked) {
      const sid = leadId(p);
      leadPieces.set(sid, [...(leadPieces.get(sid) ?? []), p]);
      continue;
    }
    const id = `n:${p.key}`;
    nodes.push({ id, label: p.title, keys: [p.key], conflict: false, folded: false });
    for (const x of askersOf(p)) {
      const sid = sourceId(x.name, x.product);
      if (!sources.has(sid)) sources.set(sid, { id: sid, label: x.name, sub: [x.designer, x.product].filter(Boolean).join(' · '), lead: false });
      addLink({ from: sid, to: id, conflict: false });
    }
  }
  // Each lead's own changes: one dashed box, and one folded piece box when there are several.
  for (const [sid, list] of leadPieces) {
    const first = list[0]!;
    const you = first.mine;
    const who = you ? (v.name ?? 'You') : (first.by ?? 'A lead');
    sources.set(sid, { id: sid, label: you ? 'From you' : `From ${who}`, sub: `${who} · ${list.length} ${list.length === 1 ? 'change' : 'changes'}`, lead: true });
    if (list.length === 1) {
      const id = `n:${first.key}`;
      nodes.push({ id, label: first.title, keys: [first.key], conflict: false, folded: false });
      addLink({ from: sid, to: id, conflict: false });
    } else {
      const id = `n:${sid.slice(2)}`;
      nodes.push({ id, label: `${list.length} from ${you ? 'you' : who}`, keys: list.map((p) => p.key), conflict: false, folded: true });
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
        ? { before: 'Showing what ', strong: source.label === 'From you' ? 'you' : source.label.replace(/^From /, ''), after: ' made' }
        : { before: 'Showing what ', strong: source.label, after: ' asks for' }
      : { before: 'Showing what ', strong: product!.label, after: ' gets' };
  return { keys, lit, line };
}

/** The Map is offered only where it can be read: wide enough, and with something to draw. */
export const mapAvailable = (o: { narrow: boolean; pieces: number }): boolean => !o.narrow && o.pieces > 0;
