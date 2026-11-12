// Library review (boards LR2 to LR14, decided 2026-11-09): the DS lead's one queue for library pieces, a page of its
// own next to Changes. Every piece that would enter the library sits here, whoever asked for it:
//   - a library change (a pull request in the design system repository), most often asked by an exploration (its
//     "Needed by" block, lib/library-origin), else made by a lead;
//   - a piece an exploration recorded (core library-impact: its library check) that has no library change yet and waits
//     on the lead (Done exploring said), or that two explorations change in different ways (a conflict to pick).
// The lead decides per piece: Add to the library, Keep in <designer>'s screen, or Use <existing piece> when the check
// found a match. Comment is always there. The decision is the exploration's own (core PieceDecision, written on the
// exploration by decidePieceOnGitHub): the exploration page and this page show the same state.
// Rules this file holds (owner, 2026-11-09):
//   - visible to everyone; the decision buttons only for whoever holds the review right, never on their own piece;
//   - a lead's own Tier 1 change (docs, descriptions) publishes without review (governance.leadsPublishTier1);
//   - adding, renaming or removing a token (Tier 3) needs the design and the tech approval;
//   - filters are checkbox lists (Status, Asked by, Product); a designer opens on her own pieces (Asked by: You);
//   - designer words only: never branch, pull request or merge.
// Pure: no DOM, no fetch. Read by components/ds/studio/LibraryReview.tsx, fed by scripts/library-review-data.ts.
// Tested in library-review.test.ts.
import {
  componentOf,
  inferLeadReason,
  libraryOrigin,
  type ExplorationOrigin,
  type LibraryOrigin,
} from './library-origin';

// ---------------------------------------------------------------------------------------------------------------
// The piece

/** Where a piece lives: a library change (its number in the design system repository) or an exploration's piece. */
export type PieceSource = { kind: 'change'; repo: string; number: number } | { kind: 'piece'; repo: string; number: number; piece: string };

/** Where a piece stands, for the Status filter. */
export type PieceState = 'waiting' | 'decided';

/** What was decided, in the words of the tag. */
export type DecidedKey = 'added' | 'building' | 'kept' | 'existing' | 'shipped' | 'published';

export const DECIDED_LABEL: Record<DecidedKey, string> = {
  added: 'Added',
  building: 'With developers',
  kept: 'Kept in its screen',
  existing: 'Uses an existing piece',
  shipped: 'Shipped',
  published: 'Published',
};

/** Who the piece waits on, from the viewer's side. */
export type WaitsOn = 'you' | 'lead' | 'tech' | 'nobody';

/** The exploration that asked for a piece. */
export interface AskedBy {
  /** "owner/repo#12": one exploration across every product's repository. */
  key: string;
  name: string;
  product: string | null;
  productKey: string | null;
  href: string | null;
  /** Who explores it, by name ("Leo"), when known. */
  designer: string | null;
  /** When the exploration last moved (ISO), for "the most recent first" when several ask for one piece. */
  at?: string | null;
}

/** One way of a conflict: an exploration's value for the same part of the same component. */
export interface ConflictWay {
  key: string;
  designer: string;
  exploration: string;
  product: string;
  value: string;
  /** The piece id on that exploration, when known: "Keep both in their screens" answers each. */
  piece: string | null;
  /** The way in one sentence, compared to today: "Room inside 24 instead of 16 today." */
  line: string;
}

const PART_WORDS: Record<string, string> = { padding: 'room inside', 'border-radius': 'corners', gap: 'space between items', 'box-shadow': 'shadow', 'background-color': 'fill', 'font-size': 'text size' };

/**
 * One way of a conflict in words: compared to today when the check knows today's value, else to the other way.
 */
export function wayLine(property: string, value: string, today: string | null, other?: { designer: string; value: string }): string {
  const a = Number(value);
  const b = today === null ? NaN : Number(today);
  const c = other ? Number(other.value) : NaN;
  const ref = Number.isFinite(b) && a !== b ? { n: b, words: 'today' } : other && Number.isFinite(c) && a !== c ? { n: c, words: `${other.designer}'s way` } : null;
  const prop = property.toLowerCase();
  if (ref && Number.isFinite(a)) {
    const more = a > ref.n;
    if (prop.startsWith('padding') || prop === 'gap') return `${more ? 'More room inside' : 'Tighter'} than ${ref.words}.`;
    if (prop === 'border-radius') return `${more ? 'Rounder corners' : 'Squarer corners'} than ${ref.words}.`;
    if (prop === 'font-size') return `${more ? 'Bigger text' : 'Smaller text'} than ${ref.words}.`;
  }
  const part = PART_WORDS[prop] ?? prop;
  return `A different ${part} than ${today !== null ? 'today' : (other ? `${other.designer}'s way` : 'today')}.`;
}

export interface ReviewPiece {
  /** Stable key: "c:<repo>#<n>" for a library change, "p:<repo>#<n>:<piece>" for a piece, "x:<component>|<part>" for a conflict. */
  key: string;
  /** The piece in plain words: "Deeper primary blue". */
  title: string;
  /** What it is, under the title: "Color change", "New component", "New size", "Docs". */
  kind: string;
  /** The group it sits in: "Colors", "Spacing", a component's name. */
  category: string;
  source: PieceSource;
  /** The exploration that asked for it (the most recent when several did), or null for a lead's own change. */
  asked: AskedBy | null;
  /** The other explorations that asked for the same piece (lib/library-askers), most recent first. */
  also?: AskedBy[];
  /** Who made it, by name, when it is a lead's change. */
  by: string | null;
  /** Why a lead made it, when no exploration asked (lib/library-origin LeadReason: figma, docs, a11y, brand, rule). */
  leadReason?: string | null;
  /** The viewer made or asked for it: never theirs to decide. */
  mine: boolean;
  /** 1: docs and descriptions; 2: a value or a component; 3: a token added, renamed or removed. */
  tier: 1 | 2 | 3;
  state: PieceState;
  decided: DecidedKey | null;
  /** The decided tag's own words when they say more ("Uses Info surface"). */
  decidedLabel: string | null;
  /** Who it waits on while it waits. */
  waitsOn: WaitsOn;
  /** Design said yes, the tech owner still has to (a Tier 3 token change). */
  designApproved: boolean;
  /** The library already has something almost the same (the check's nearest match). */
  match: { label: string } | null;
  /** Two explorations change the same part of the same component differently: the lead picks one way. */
  conflict: { component: string; property: string; ways: ConflictWay[]; pick: string | null; today?: string | null } | null;
  /** How many screens use the piece today, when Bridge knows it ("Card is in 14 screens today"). */
  screens?: number | null;
  /** Before and after, as people read them. */
  before: string | null;
  after: string | null;
  /** A swatch when the values are colors. */
  swatch: { before: string | null; after: string | null } | null;
  /** The designer's words on why ("The bulk bar buttons looked washed out next to the table."), when recorded. */
  why: string | null;
  /** The exception a designer's row shows ("Dana asked for changes"). */
  exception: string | null;
  /** When it last moved (ISO), when known: the List orders its blocks by the most recent. */
  at?: string | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Words

const TOKEN_WORDS: [RegExp, string, string][] = [
  [/colou?r|blue|red|green|surface|text|contrast|background|\bbg\b|tone|highlight|fill/i, 'Colors', 'color'],
  [/spacing|space step|\bspace\b|gap|padding/i, 'Spacing', 'spacing'],
  [/radius|corner/i, 'Corners', 'corners'],
  [/font|type|typography|line height/i, 'Type', 'type'],
  [/shadow|elevation/i, 'Elevation', 'elevation'],
  [/motion|duration|easing/i, 'Motion', 'motion'],
];

/** The group a token change sits in ("Colors") and its word ("color"), from its title; null when not a token. */
export function tokenGroup(title: string): { category: string; word: string } | null {
  for (const [re, category, word] of TOKEN_WORDS) if (re.test(title)) return { category, word };
  return null;
}

/** A title without its conventional prefix: "feat(tokens): Deepen the blue" reads "Deepen the blue". */
export const cleanTitle = (t: string): string => t.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim();

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A piece title the way the exploration names it, without "New component:" or "Avatar:" in front when it says more. */
export function pieceWords(t: string): string {
  const s = designerWords(cleanTitle(t));
  const created = /^new component:?\s+(.+)$/i.exec(s);
  if (created) return created[1]!.trim();
  return cap(s);
}

/** Token path parts in words: "bg" reads "background", "fg" "text". */
const PART_NAMES: Record<string, string> = { bg: 'background', fg: 'text', sm: 'small', md: 'medium', lg: 'large', xl: 'extra large' };
/** The first part of a token path that names its kind, left out of the words ("color.bg.zone" reads "zone background"). */
const KIND_PARTS = new Set(['color', 'colour', 'space', 'spacing', 'radius', 'font', 'typography', 'size', 'motion', 'elevation', 'shadow']);

/** A token path in designer words: "color.bg.zone" reads "zone background". */
export function tokenPathWords(path: string): string {
  const parts = path.split('.').filter((x, i) => !(i === 0 && KIND_PARTS.has(x.toLowerCase())));
  return parts
    .map((x) => PART_NAMES[x.toLowerCase()] ?? x.replace(/[-_]+/g, ' '))
    .reverse()
    .join(' ');
}

/**
 * A title in designer words (Studio never shows developer words): a token path reads as words, a prop name in
 * camelCase as words, and "Deprecate" or "Remove" a token reads "Retire the old ...".
 * "Deprecate color.bg.zone" reads "Retire the old zone background"; "Button: loadingLabel announces the action while it
 * runs" reads "Button: loading text says what is happening".
 */
export function designerWords(title: string): string {
  let t = title.trim();
  const path = /\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+){1,5}\b/i;
  const retire = /^(deprecate|remove|delete)\s+(the\s+)?/i;
  if (retire.test(t) && path.test(t)) t = t.replace(retire, 'Retire the old ');
  t = t.replace(new RegExp(path.source, 'gi'), (m) => tokenPathWords(m));
  // A prop that announces something: what the person reads, not the prop's name.
  t = t.replace(/\bloadingLabel announces the action while it runs\b/, 'loading text says what is happening');
  t = t.replace(/\b([a-z]+)([A-Z][a-zA-Z]*)\b/g, (_m, a: string, b: string) => `${a} ${b.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`);
  return t.replace(/\s+/g, ' ').trim();
}

/** Removing, renaming or adding a token: Tier 3, design and tech approve it. */
export const isTokenStructure = (title: string): boolean => /\b(deprecate|remove|rename|delete)\b/i.test(title) || (/^(add|new)\b/i.test(cleanTitle(title)) && tokenGroup(title) !== null && !/component/i.test(title));

/** What a change is, under its title. */
export function kindOf(x: { title: string; component: string | null; reason: string | null; tier: 1 | 2 | 3 }): string {
  const t = cleanTitle(x.title);
  if (x.reason === 'docs' || x.tier === 1) return 'Docs';
  if (x.reason === 'brand' || /\bbrand\b/i.test(t)) return 'New brand';
  if (/new component|component$/i.test(t) && x.component) return 'New component';
  if (/\b(xl|xs|sm|md|lg|size)\b/i.test(t) && x.component) return 'New size';
  const g = tokenGroup(t);
  if (/\b(deprecate|remove|delete|retire)\b/i.test(t)) return g ? `${cap(g.word)} removed` : 'Removed';
  if (/\brename\b/i.test(t)) return g ? `${cap(g.word)} renamed` : 'Renamed';
  if (g) return /^(add|new)\b/i.test(t) ? `New ${g.word}` : /\bfix\b/i.test(t) ? `${cap(g.word)} fix` : `${cap(g.word)} change`;
  if (x.component) return `Change to ${x.component}`;
  return 'Library change';
}

// ---------------------------------------------------------------------------------------------------------------
// A library change (a pull request in the design system repository) as a piece

export interface ChangeInput {
  repo: string;
  number: number;
  title: string;
  body: string | null;
  labels: readonly (string | { name: string })[];
  headRef?: string | null;
  /** core ReviewStatusKind, once read; null while not read. */
  statusKind: string | null;
  /** Shipped (merged), for the decided list. */
  merged?: boolean;
  /** Tier from the change itself (core effectiveTier), when it says one. */
  tier?: 1 | 2 | 3 | null;
  /** The viewer made it, or asked for it. */
  mine: boolean;
  /** Who made it or asked for it, by name. */
  by: string | null;
  /**
   * Who explored each exploration, by name, keyed as explorationAskKey says: the change's "Needed by" exploration is
   * named by who explored it, never by who asked for the change.
   */
  designers?: ReadonlyMap<string, string> | null;
  /** The closest thing the library has today, as the exploration's check named it ("info surface"). */
  nearest?: string | null;
  /** When it last moved (ISO). */
  at?: string | null;
}

/** Review kinds that wait on the design side. */
const DESIGN_KINDS = new Set(['needs-design', 'needs-approval']);
/** Design said yes: the tech side finishes it, or it is ready. */
const APPROVED_KINDS = new Set(['needs-tech', 'ready']);
/** A developer works on it. */
const BUILDING_KINDS = new Set(['draft', 'ci-failing', 'ci-running', 'conflict', 'changes-requested']);

/**
 * The key of the exploration a library change is needed by: its product and number ("crm#2"), or the design system
 * repository's own ("acme/ds#5"); by name when the change gives no number.
 */
export const explorationAskKey = (o: Pick<ExplorationOrigin, 'number' | 'productKey' | 'name'>, repo: string): string =>
  o.number ? `${(o.productKey ?? repo).toLowerCase()}#${o.number}` : `name:${o.name.toLowerCase()}`;

const askedOf = (o: ExplorationOrigin, repo: string, designer: string | null): AskedBy => ({
  key: explorationAskKey(o, repo),
  name: o.name,
  product: o.product,
  productKey: o.productKey,
  href: o.href,
  designer,
});

/** One library change as a piece of the queue. */
export function pieceOfChange(c: ChangeInput, products: Parameters<typeof libraryOrigin>[1] = []): ReviewPiece {
  const origin: LibraryOrigin = libraryOrigin({ title: c.title, labels: c.labels, headRef: c.headRef ?? null, body: c.body }, products);
  const reason = origin.kind === 'lead' ? origin.reason : inferLeadReason({ title: c.title, labels: c.labels, headRef: c.headRef ?? null, body: c.body });
  const component = componentOf({ title: c.title, origin });
  const structure = isTokenStructure(c.title) && reason !== 'docs';
  const tier: 1 | 2 | 3 = reason === 'docs' ? 1 : structure ? 3 : (c.tier ?? 2);
  const title = origin.kind === 'exploration' && origin.piece ? pieceWords(origin.piece) : pieceWords(c.title);
  const kind = kindOf({ title: c.title, component, reason, tier });
  const group = tokenGroup(c.title);
  const category = reason === 'docs' ? 'Docs' : reason === 'brand' || /\bbrand\b/i.test(c.title) ? 'Brands' : (component ?? group?.category ?? 'Library');
  const k = c.statusKind ?? '';
  const kept = origin.kind === 'exploration' && origin.kept;
  let state: PieceState = 'waiting';
  let decided: DecidedKey | null = null;
  if (c.merged) {
    state = 'decided';
    decided = tier === 1 && c.mine ? 'published' : 'shipped';
  } else if (kept) {
    state = 'decided';
    decided = 'kept';
  } else if (APPROVED_KINDS.has(k) && !(tier === 3 && k === 'needs-tech')) {
    state = 'decided';
    decided = 'added';
  } else if (BUILDING_KINDS.has(k) && k !== 'changes-requested') {
    state = 'decided';
    decided = 'building';
  }
  const designApproved = tier === 3 && k === 'needs-tech';
  const waitsOn: WaitsOn = state === 'decided' ? 'nobody' : designApproved ? 'tech' : c.mine ? 'lead' : DESIGN_KINDS.has(k) || !k ? 'you' : 'lead';
  return {
    key: `c:${c.repo.toLowerCase()}#${c.number}`,
    title,
    kind,
    category,
    source: { kind: 'change', repo: c.repo, number: c.number },
    asked: origin.kind === 'exploration' ? askedOf(origin, c.repo, c.designers?.get(explorationAskKey(origin, c.repo)) ?? null) : null,
    by: c.by,
    leadReason: origin.kind === 'exploration' ? null : reason,
    mine: c.mine,
    tier,
    state,
    decided,
    decidedLabel: null,
    waitsOn,
    designApproved,
    match: c.nearest?.trim() ? { label: cap(c.nearest.trim()) } : null,
    conflict: null,
    before: null,
    after: null,
    swatch: null,
    why: null,
    exception: k === 'changes-requested' ? 'Changes asked' : null,
    at: c.at ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// An exploration's recorded piece as a piece of the queue

export interface ExplorationPieceInput {
  repo: string;
  number: number;
  /** The exploration's name, product and page. */
  name: string;
  product: string | null;
  productKey: string | null;
  href: string | null;
  designer: string | null;
  /** core impactItemOf: the piece in words. */
  item: { id: string; kind: 'component' | 'variant' | 'token' | 'pattern'; title: string; of?: string | undefined; before?: string | undefined; after?: string | undefined; property?: string | undefined };
  /** The lead's own answer on it (core PieceDecision), when given. */
  decision: { verdict: 'approved' | 'changes' | 'local' | 'existing'; use?: string | undefined; byName?: string | undefined } | null;
  /** The check's nearest library value, when close (exact or high). */
  nearest: { label: string; level: string } | null;
  /** Done exploring was said: the lead is asked. */
  asked: boolean;
  /** The viewer explores it. */
  mine: boolean;
  /** When the exploration last moved (ISO). */
  at?: string | null;
}

/** "Highlight surface" from "New surface: highlight" and the like: the words people use for it. */
const itemKind = (i: ExplorationPieceInput['item']): string => {
  if (i.kind === 'component') return 'New component';
  if (i.kind === 'pattern') return 'New pattern';
  if (i.property === 'size') return 'New size';
  if (i.kind === 'token') {
    const g = tokenGroup(i.title);
    return g ? (i.before ? `${cap(g.word)} change` : `New ${g.word}`) : 'Token change';
  }
  return i.of ? `Change to ${i.of}` : 'Library change';
};

const HEX = /^#[0-9a-f]{3,8}$/i;

/** One recorded piece of an exploration as a piece of the queue; null when it is not the lead's to see yet. */
export function pieceOfExploration(x: ExplorationPieceInput): ReviewPiece | null {
  const d = x.decision;
  let state: PieceState = 'waiting';
  let decided: DecidedKey | null = null;
  let decidedLabel: string | null = null;
  if (d?.verdict === 'local') {
    state = 'decided';
    decided = 'kept';
  } else if (d?.verdict === 'existing') {
    state = 'decided';
    decided = 'existing';
    decidedLabel = d.use ? `Uses ${d.use}` : null;
  } else if (d?.verdict === 'approved') {
    state = 'decided';
    decided = 'added';
  } else if (!x.asked) return null;
  const i = x.item;
  const g = i.kind === 'token' ? tokenGroup(i.title) : null;
  const category = i.of ?? (i.kind === 'component' || i.kind === 'pattern' ? i.title : (g?.category ?? 'Library'));
  const close = x.nearest && (x.nearest.level === 'exact' || x.nearest.level === 'high') ? { label: cap(x.nearest.label) } : null;
  return {
    key: `p:${x.repo.toLowerCase()}#${x.number}:${i.id}`,
    title: designerWords(i.of && i.title.startsWith('New size') ? `${i.of}: ${i.title.charAt(0).toLowerCase()}${i.title.slice(1)}` : i.title),
    kind: itemKind(i),
    category,
    source: { kind: 'piece', repo: x.repo, number: x.number, piece: i.id },
    asked: { key: `${x.repo.toLowerCase()}#${x.number}`, name: x.name, product: x.product, productKey: x.productKey, href: x.href, designer: x.designer, at: x.at ?? null },
    by: null,
    mine: x.mine,
    tier: i.kind === 'token' && !i.before ? 3 : 2,
    state,
    decided,
    decidedLabel,
    waitsOn: state === 'decided' ? 'nobody' : x.mine ? 'lead' : 'you',
    designApproved: false,
    match: close,
    conflict: null,
    before: i.before ?? null,
    after: i.after ?? null,
    swatch: (i.before && HEX.test(i.before)) || (i.after && HEX.test(i.after)) ? { before: i.before && HEX.test(i.before) ? i.before : null, after: i.after && HEX.test(i.after) ? i.after : null } : null,
    why: null,
    exception: d?.verdict === 'changes' ? `${d.byName ?? 'The lead'} asked for changes` : null,
    at: x.at ?? null,
  };
}

/** A conflict (core LibraryConflict) as one piece: the component part, both ways, and the way kept once picked. */
export function pieceOfConflict(
  c: { component: string; property: string; piece: string; mine: { key: string; designer: string; value: string }; other: { key: string; name: string; product: string; designer: string; value: string }; pick: string | null },
  mine: { name: string; product: string; href: string | null; productKey: string | null },
  viewerName: string | null,
  extra: { otherPiece?: string | null; today?: string | null } = {},
): ReviewPiece {
  const today = extra.today ?? null;
  const ways: ConflictWay[] = [
    { key: c.mine.key, designer: c.mine.designer, exploration: mine.name, product: mine.product, value: c.mine.value, piece: c.piece, line: wayLine(c.property, c.mine.value, today, { designer: c.other.designer, value: c.other.value }) },
    { key: c.other.key, designer: c.other.designer, exploration: c.other.name, product: c.other.product, value: c.other.value, piece: extra.otherPiece ?? null, line: wayLine(c.property, c.other.value, today, { designer: c.mine.designer, value: c.mine.value }) },
  ];
  const at = /^(.+)#(\d+)$/.exec(c.mine.key);
  const yours = Boolean(viewerName && ways.some((w) => w.designer.toLowerCase() === viewerName.toLowerCase()));
  return {
    key: `x:${c.component.toLowerCase()}|${c.property.toLowerCase()}`,
    title: c.component,
    // The part that changes, in words ("Room inside change"): the "2 ways" tag says the conflict, once.
    kind: `${cap(PART_WORDS[c.property.toLowerCase()] ?? c.property)} change`,
    category: c.component,
    source: { kind: 'piece', repo: at?.[1] ?? '', number: Number(at?.[2] ?? 0), piece: c.piece },
    asked: { key: c.mine.key, name: mine.name, product: mine.product, productKey: mine.productKey, href: mine.href, designer: c.mine.designer },
    by: null,
    mine: yours,
    tier: 2,
    state: c.pick ? 'decided' : 'waiting',
    decided: c.pick ? 'added' : null,
    // The exploration page's ledger records new options ("sizes:<key>") or today's component kept ("today").
    decidedLabel: c.pick ? (c.pick === 'both' ? 'Both ways, two sizes' : c.pick === 'today' ? "Today's stays" : c.pick.startsWith('sizes:') ? 'New options added' : `${ways.find((w) => w.key === c.pick)?.designer ?? 'One'}'s way`) : null,
    waitsOn: c.pick ? 'nobody' : yours ? 'lead' : 'you',
    designApproved: false,
    match: null,
    conflict: { component: c.component, property: c.property, ways, pick: c.pick, today },
    before: null,
    after: null,
    swatch: null,
    why: null,
    exception: null,
  };
}

/**
 * Every piece once: a recorded piece that already has its library change is that change (the change keeps its own
 * status), and a piece caught in a conflict is the conflict. Conflicts first in each group.
 */
export function mergePieces(changes: readonly ReviewPiece[], pieces: readonly ReviewPiece[], conflicts: readonly ReviewPiece[], linked: ReadonlySet<string>): ReviewPiece[] {
  const inConflict = new Set(conflicts.flatMap((c) => (c.conflict ? c.conflict.ways.map((w) => `${w.key}`) : [])).map((k) => k.toLowerCase()));
  const conflictPieces = new Set(conflicts.map((c) => (c.source.kind === 'piece' ? c.source.piece : '')));
  const seen = new Set<string>();
  const out: ReviewPiece[] = [];
  for (const c of conflicts) if (!seen.has(c.key)) (seen.add(c.key), out.push(c));
  // The component parts in conflict, per exploration: each side's own piece of that part is the conflict.
  const conflictParts = new Set(conflicts.flatMap((c) => (c.conflict ? c.conflict.ways.map((w) => `${w.key.toLowerCase()}|${c.conflict!.component.toLowerCase()}`) : [])));
  // The same piece asked by several explorations (the same thing, the same value) is one piece with several askers.
  const same = new Map<string, number>();
  for (const p of pieces) {
    if (p.source.kind !== 'piece') continue;
    const at = `${p.source.repo.toLowerCase()}#${p.source.number}`;
    if (linked.has(`${at}:${p.source.piece}`)) continue;
    if (inConflict.has(at) && conflictPieces.has(p.source.piece)) continue;
    if (conflictParts.has(`${at}|${p.category.toLowerCase()}`) && p.kind.startsWith('Change to')) continue;
    if (seen.has(p.key)) continue;
    const id = `${p.kind}|${p.category}|${p.title}|${p.after ?? ''}|${p.state}`.toLowerCase();
    const i = same.get(id);
    if (i !== undefined && p.asked) {
      const first = out[i]!;
      out[i] = { ...first, also: [...(first.also ?? []), p.asked, ...(p.also ?? [])], mine: first.mine || p.mine };
      seen.add(p.key);
      continue;
    }
    seen.add(p.key);
    same.set(id, out.length);
    out.push(p);
  }
  for (const c of changes) if (!seen.has(c.key)) (seen.add(c.key), out.push(c));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Who decides

export interface Viewer {
  /** Holds the review right (a design lead, or a reviewer of the team). */
  reviews: boolean;
  /** Their name, for "Asked by: You" and their own pieces. */
  name: string | null;
  /** governance.leadsPublishTier1 (default on). */
  leadsPublishTier1: boolean;
}

/** The viewer may decide this piece here: the review right, not their own, still waiting, and design not given yet. */
export const canDecide = (p: ReviewPiece, v: Viewer): boolean => v.reviews && !p.mine && p.state === 'waiting' && p.waitsOn === 'you';

/** The line under a piece that waits on someone else: why the viewer cannot decide it. */
export function waitLine(p: ReviewPiece, o: { lead: string | null; tech: string | null }): string | null {
  if (p.state !== 'waiting') return null;
  if (p.designApproved) return `Waiting on ${o.tech ? `${o.tech}, tech owner` : 'the tech owner'}: ${/remov|deprecat|delet/i.test(p.kind) ? 'removing' : /renam/i.test(p.kind) ? 'renaming' : 'adding'} a token needs both`;
  if (p.mine) return `Waiting on ${o.lead ? `${o.lead}, second reviewer` : 'a second reviewer'}`;
  return null;
}

/** A lead's own Tier 1 change publishes without review (governance.leadsPublishTier1). */
export const publishesWithoutReview = (p: ReviewPiece, v: Viewer): boolean => p.mine && v.reviews && v.leadsPublishTier1 && p.tier === 1;

// ---------------------------------------------------------------------------------------------------------------
// Filters (checkbox lists) and the address

/** One by one (leads), List, and the read-only Map (phase 3). */
export type ReviewView = 'one' | 'list' | 'map';

const viewOf = (v: string | null): ReviewView => (v === 'list' ? 'list' : v === 'map' ? 'map' : 'one');

export interface ReviewFilters {
  /** Empty: every status. */
  status: PieceState[];
  /** Empty: anyone. "you", or an exploration's key. */
  asked: string[];
  /** Empty: every product. Product keys; "library" for the lead's own changes. */
  product: string[];
}

export const YOU = 'you';
export const LIBRARY_PRODUCT = 'library';

const listParam = (q: URLSearchParams, k: string) =>
  (q.get(k) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** The filters and the view from the address. A designer opens on her own pieces; everyone opens on Waiting. */
export function reviewParams(search: string, o: { reviews: boolean }): { filters: ReviewFilters; view: ReviewView } {
  const q = new URLSearchParams(search);
  const status = q.has('status') ? listParam(q, 'status').filter((s): s is PieceState => s === 'waiting' || s === 'decided') : ['waiting' as const];
  const asked = q.has('asked') ? listParam(q, 'asked').filter((s) => s !== 'anyone') : o.reviews ? [] : [YOU];
  const product = listParam(q, 'product');
  return { filters: { status, asked, product }, view: viewOf(q.get('view')) };
}

/** The address with these filters and view: the defaults are left out, so a plain link opens the plain page. */
export function withReviewParams(search: string, f: ReviewFilters, view: ReviewView, o: { reviews: boolean }): string {
  const q = new URLSearchParams(search);
  const set = (k: string, v: string[], dflt: string[]) => {
    if (v.length === dflt.length && v.every((x) => dflt.includes(x))) q.delete(k);
    else q.set(k, v.length ? v.join(',') : k === 'asked' ? 'anyone' : '');
  };
  set('status', f.status, ['waiting']);
  set('asked', f.asked, o.reviews ? [] : [YOU]);
  if (f.product.length) q.set('product', f.product.join(','));
  else q.delete('product');
  if (view === 'one') q.delete('view');
  else q.set('view', view);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const productKeyOf = (p: ReviewPiece): string => p.asked?.productKey ?? (p.asked?.product ? p.asked.product.toLowerCase() : LIBRARY_PRODUCT);

export function passes(p: ReviewPiece, f: ReviewFilters): boolean {
  if (f.status.length && !f.status.includes(p.state)) return false;
  if (f.asked.length && !f.asked.some((a) => (a === YOU ? p.mine : peopleOf(p).some((n) => personKey(n) === a)))) return false;
  if (f.product.length && !f.product.includes(productKeyOf(p))) return false;
  return true;
}

export interface FilterChoice {
  value: string;
  label: string;
}

/** A person's filter value: "person:leo". */
export const personKey = (name: string): string => `person:${name.trim().toLowerCase()}`;

/** The people who asked for a piece: each asking exploration's designer, both designers of a conflict, the lead who made it. */
export function peopleOf(p: ReviewPiece): string[] {
  const names = p.conflict ? p.conflict.ways.map((w) => w.designer) : [p.asked?.designer, ...(p.also ?? []).map((x) => x.designer), p.by];
  return [...new Set(names.filter((n): n is string => Boolean(n && n.trim())))];
}

/**
 * The checkbox lists. Asked by lists people only (owner, 2026-11-10: explorations already show on each row, and
 * mixing them with people made the menu hard to read): You first, then each other person by name. Product: each
 * product with a piece.
 */
export function filterChoices(pieces: readonly ReviewPiece[], viewerName: string | null = null): { asked: FilterChoice[]; product: FilterChoice[] } {
  const people = new Map<string, string>();
  const product = new Map<string, string>();
  const self = viewerName ? personKey(viewerName) : null;
  for (const p of pieces) {
    for (const n of peopleOf(p)) if (personKey(n) !== self) people.set(personKey(n), n);
    product.set(productKeyOf(p), p.asked?.product ?? 'Library');
  }
  const byLabel = (a: FilterChoice, b: FilterChoice) => a.label.localeCompare(b.label);
  return {
    asked: [{ value: YOU, label: 'You' }, ...[...people].map(([value, label]) => ({ value, label })).sort(byLabel)],
    product: [...product].map(([value, label]) => ({ value, label })).sort((a, b) => (a.value === LIBRARY_PRODUCT ? 1 : b.value === LIBRARY_PRODUCT ? -1 : byLabel(a, b))),
  };
}

/** What a filter button reads after its name: "Waiting", "Anyone", "You", "2 products". */
export function filterValue(kind: 'status' | 'asked' | 'product', picked: readonly string[], choices: readonly FilterChoice[]): string {
  if (!picked.length) return kind === 'status' ? 'Any' : kind === 'asked' ? 'Anyone' : 'All products';
  if (picked.length === 1) return choices.find((c) => c.value === picked[0])?.label ?? picked[0]!;
  return `${picked.length} ${kind === 'status' ? 'statuses' : kind === 'asked' ? 'people' : 'products'}`;
}

export const STATUS_CHOICES: FilterChoice[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'decided', label: 'Decided' },
];

// ---------------------------------------------------------------------------------------------------------------
// Groups and lines

export interface PieceGroup {
  key: string;
  label: string;
  /** "For you to decide", "Yours, waiting on someone else", "Published without review": the lead's sections. */
  section: 'decide' | 'yours' | 'published' | 'other';
  /** One quiet line after the label ("You never approve your own change"). */
  note: string | null;
  pieces: ReviewPiece[];
}

const CATEGORY_ORDER = ['Colors', 'Spacing', 'Corners', 'Type', 'Elevation', 'Motion'];

/**
 * The pieces in groups: by what they change (Colors, then each component, then Spacing...), conflicts first inside a
 * group. The viewer's own pieces that wait on someone else and their Tier 1 pieces published without review get a
 * group each at the end (lr-yours).
 */
/**
 * Inside a group: a conflict first (it blocks two screens), then changes to what exists, then new pieces, then a token
 * removed or renamed (it needs two owners).
 */
const kindRank = (p: ReviewPiece) => (p.conflict ? 0 : /(change|fix)$/i.test(p.kind) ? 1 : /removed|renamed/i.test(p.kind) ? 3 : 2);
const byWeight = (a: ReviewPiece, b: ReviewPiece) => kindRank(a) - kindRank(b);

export function groupPieces(pieces: readonly ReviewPiece[], v: Viewer): PieceGroup[] {
  const yours = pieces.filter((p) => p.mine && p.state === 'waiting' && v.reviews);
  const published = pieces.filter((p) => publishesWithoutReview(p, v) && p.state === 'decided' && p.decided === 'published');
  const rest = pieces.filter((p) => !yours.includes(p) && !published.includes(p));
  // With the viewer's own pieces on the page, the sections say the state once (lr-yours): what is theirs to decide,
  // what of theirs waits on someone else, what they published. Otherwise the groups say what changes (lr-list).
  if ((yours.length || published.length) && rest.length) {
    const sections: PieceGroup[] = [{ key: 'decide', label: 'For you to decide', section: 'decide', note: null, pieces: [...rest].sort(byWeight) }];
    if (yours.length) sections.push({ key: 'yours', label: 'Yours, waiting on someone else', section: 'yours', note: 'You never approve your own change', pieces: yours });
    if (published.length) sections.push({ key: 'published', label: 'Published without review', section: 'published', note: 'Docs and descriptions: you can publish them yourself', pieces: published });
    return sections;
  }
  const by = new Map<string, ReviewPiece[]>();
  for (const p of rest) by.set(p.category, [...(by.get(p.category) ?? []), p]);
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i < 0 ? (c === 'Docs' ? 90 : c === 'Brands' ? 91 : c === 'Library' ? 92 : 50) : i;
  };
  // Components that share an exploration's request read together ("Avatar and ProfileHeader").
  const groups: PieceGroup[] = [...by]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([label, list]) => ({ key: `g:${label.toLowerCase()}`, label, section: 'decide' as const, note: null, pieces: [...list].sort(byWeight) }));
  if (yours.length) groups.push({ key: 'yours', label: 'Yours, waiting on someone else', section: 'yours', note: 'You never approve your own change', pieces: yours });
  if (published.length) groups.push({ key: 'published', label: 'Published without review', section: 'published', note: 'Docs and descriptions: you can publish them yourself', pieces: published });
  return groups;
}

/** Joins small component groups that come from the same exploration into one ("Avatar and ProfileHeader"). */
export function joinSmallGroups(groups: readonly PieceGroup[]): PieceGroup[] {
  const out: PieceGroup[] = [];
  for (const g of groups) {
    const prev = out[out.length - 1];
    const component = (x: PieceGroup) => x.section === 'decide' && !CATEGORY_ORDER.includes(x.label) && !['Docs', 'Brands', 'Library'].includes(x.label) && x.pieces.every((p) => !p.conflict);
    const sameAsk = (a: PieceGroup, b: PieceGroup) => {
      const ka = new Set(a.pieces.map((p) => p.asked?.key ?? ''));
      return b.pieces.every((p) => p.asked && ka.has(p.asked.key));
    };
    if (prev && component(prev) && component(g) && sameAsk(prev, g) && !prev.label.includes(' and ')) {
      out[out.length - 1] = { ...prev, key: `${prev.key}+${g.key}`, label: `${prev.label} and ${g.label}`, pieces: [...prev.pieces, ...g.pieces] };
    } else out.push(g);
  }
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The line after the filters: "6 pieces wait for you · your own 8 wait on others", "4 pieces", "5 decided". */
export function countLine(all: readonly ReviewPiece[], shown: readonly ReviewPiece[], v: Viewer, f: ReviewFilters): string {
  if (!v.reviews) return plural(shown.length, 'piece');
  if (f.status.length === 1 && f.status[0] === 'decided') return `${shown.length} decided`;
  const forYou = waitingForYou(shown, v);
  const own = all.filter((p) => p.mine && p.state === 'waiting').length;
  const first = forYou ? `${forYou} ${forYou === 1 ? 'waits' : 'wait'} for you` : 'Nothing waits for you';
  return own ? `${first} · ${own} of yours ${own === 1 ? 'waits' : 'wait'} on others` : first;
}

/** What waits for the viewer's decision: the page's count and the nav badge's number. */
export const waitingForYou = (pieces: readonly ReviewPiece[], v: Viewer): number => pieces.filter((p) => canDecide(p, v)).length;

/**
 * Who acts next on the viewer's own waiting piece, as the row names them (avatar and first name): the tech owner once
 * design approved a Tier 3 token change ("Malik, tech"), else another lead ("Ana").
 */
export function nextActor(p: ReviewPiece, o: { tech: string | null; secondLead: string | null }): { name: string; label: string } | null {
  if (p.state !== 'waiting' || !p.mine) return null;
  if (p.designApproved) return o.tech ? { name: o.tech, label: `${o.tech}, tech` } : { name: 'Tech owner', label: 'Tech owner' };
  return o.secondLead ? { name: o.secondLead, label: o.secondLead } : { name: 'Another lead', label: 'Another lead' };
}

/** The page's summary sentence under the title. */
export function summaryLine(v: Viewer, lead: string | null): string {
  return v.reviews ? 'What enters the library. You decide here; the whole team can look.' : `What enters the library. ${lead ?? 'The design lead'} decides here.`;
}

/** The designer's banner (lr-designer): who decides, and that there is nothing to do meanwhile. */
export function designerBanner(lead: string | null): { strong: string; rest: string } {
  const who = lead ?? 'The design lead';
  return { strong: `${who} reviews library pieces.`, rest: 'You will see the decision here and on your exploration. Nothing to do meanwhile.' };
}

/** "2 of 6 seen": the One by one progress. */
export const seenLine = (seen: number, total: number): string => `${Math.min(seen, total)} of ${total} seen`;

/**
 * The One by one progress (owner, 2026-11-12): the job is deciding, so the headline and the bar count decided pieces;
 * seen is a quiet note on the end ("10 seen"), gone once every piece is decided. All decided reads as done.
 */
export function reviewProgress(total: number, seen: number, decided: number): { headline: string; value: number; seenNote: string | null; done: boolean } {
  const d = Math.max(0, Math.min(decided, total));
  const s = Math.max(d, Math.min(seen, total));
  const done = total > 0 && d === total;
  return {
    headline: done ? `All ${total} decided` : `${d} of ${total} decided`,
    value: total ? (d / total) * 100 : 0,
    seenNote: done ? null : `${s} seen`,
    done,
  };
}

/** The empty state (lr-empty): the decided week in one sentence. */
export function emptyLine(decided: readonly ReviewPiece[], v: Viewer, lead: string | null): { title: string; sentence: string } {
  if (!v.reviews) return { title: 'Nothing waits on the library', sentence: decided.length ? `${lead ?? 'The design lead'} decided all your pieces.` : 'Your explorations use what the library already has.' };
  if (!decided.length) return { title: 'Nothing waits on the library', sentence: 'When an exploration needs something new, it lands here for you to decide.' };
  const added = decided.filter((p) => p.decided === 'added' || p.decided === 'building' || p.decided === 'shipped' || p.decided === 'published').length;
  const kept = decided.filter((p) => p.decided === 'kept').length;
  const existing = decided.filter((p) => p.decided === 'existing').length;
  const parts = [added ? `${added} added` : '', kept ? `${kept} kept in ${kept === 1 ? 'its screen' : 'their screens'}` : '', existing ? `${existing} used an existing piece` : ''].filter(Boolean);
  return { title: 'Nothing waits on the library', sentence: `You decided all ${plural(decided.length, 'piece')}. ${parts.join(', ')}.` };
}

/**
 * What the selection bar says before acting (lr-list): what is ticked, and what it touches. "3 colors selected",
 * "Deeper primary blue changes every screen that uses it. Look at it first."
 */
export function selectionLine(selected: readonly ReviewPiece[]): { what: string; touches: string } {
  const cats = new Set(selected.map((p) => p.category));
  const one = cats.size === 1 ? [...cats][0]! : null;
  const word = one && tokenGroup(one) ? tokenGroup(one)!.word : 'piece';
  const what = `${plural(selected.length, word === 'color' ? 'color' : word === 'piece' ? 'piece' : `${word} piece`)} selected`;
  const everywhere = selected.filter((p) => /(change|fix)$/i.test(p.kind));
  const removed = selected.filter((p) => /removed|renamed/i.test(p.kind));
  const explorations = new Set(selected.flatMap((p) => (p.asked ? [p.asked.name] : [])));
  const touches = everywhere.length
    ? `${everywhere[0]!.title} changes every screen that uses it. Look at it first.`
    : removed.length
      ? `${removed[0]!.title} ${/renamed/i.test(removed[0]!.kind) ? 'renames' : 'removes'} a token screens may use. Look at it first.`
      : explorations.size
        ? `Asked by ${plural(explorations.size, 'exploration')}. Nothing changes until a screen uses ${selected.length === 1 ? 'it' : 'them'}.`
        : 'Nothing changes until a screen uses them.';
  return { what, touches };
}

/** The pieces a batch may decide: only the ones the viewer may decide, never a conflict (it needs its own pick). */
export const batchable = (p: ReviewPiece, v: Viewer): boolean => canDecide(p, v) && !p.conflict && !isRemoval(p);

/** A token removed or renamed: decided one at a time, never in a batch with additions (its verb is not "Add"). */
export const isRemoval = (p: Pick<ReviewPiece, 'kind'>): boolean => /(removed|renamed)$/i.test(p.kind);

/** How a color piece is drawn in place: as text on its surface, as a filled card, or as the main button. */
export type ColorLook = 'text' | 'surface' | 'action';

export function colorLook(title: string): { look: ColorLook; dark: boolean } {
  const t = title.toLowerCase();
  const dark = /\bdark\b/.test(t);
  if (/\btext\b|\blabel\b|\bink\b/.test(t)) return { look: 'text', dark };
  if (/surface|background|zone|highlight|\bfill\b|\bcard\b|panel/.test(t)) return { look: 'surface', dark };
  return { look: 'action', dark };
}

/** A computed CSS colour ("rgb(26, 32, 44)", "rgba(0, 0, 0, 0.5)") as the 0 to 1 channels core's contrastRatio reads. */
export function cssRgba(css: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(css.trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number.parseFloat(m[4]);
  return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255, a };
}

/** A colour plate's contrast in words, so it never rests on the badge colour: "4.6:1 passes AA", "2.1:1 fails AA". */
export function contrastWords(ratio: number, min = 4.5): { text: string; pass: boolean } {
  const pass = ratio >= min;
  return { text: `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1 ${pass ? 'passes' : 'fails'} AA`, pass };
}

/** Why the selection bar offers no Keep: some selected pieces were not asked for by an exploration. */
export function keepMissing(selected: readonly ReviewPiece[]): string | null {
  const lead = selected.filter((p) => !p.asked).length;
  if (!lead) return null;
  return lead === selected.length ? 'Made by a lead, not asked by a screen: they can only be added.' : `${lead} of these ${lead === 1 ? 'was' : 'were'} made by a lead, not asked by a screen: untick ${lead === 1 ? 'it' : 'them'} to keep the rest in their screens.`;
}

/** "Keep in Leo's screen", "Keep in their screens". */
export function keepLabel(p: ReviewPiece | readonly ReviewPiece[]): string {
  const list = Array.isArray(p) ? (p as readonly ReviewPiece[]) : [p as ReviewPiece];
  const names = new Set(list.map((x) => x.asked?.designer ?? ''));
  if (list.length === 1 || names.size === 1) {
    const n = [...names][0];
    return n ? `Keep in ${n}'s screen${list.length > 1 ? 's' : ''}` : list.length > 1 ? 'Keep in their screens' : 'Keep in its screen';
  }
  return 'Keep in their screens';
}

/** The conflict's opening sentence: today's context, then the choice. */
export function conflictLede(p: Pick<ReviewPiece, 'title' | 'screens'>): string {
  const today = p.screens ? ` ${p.title} is in ${p.screens} ${p.screens === 1 ? 'screen' : 'screens'} today;` : '';
  return `Both screens wait on this.${today}${today ? ' pick' : ' Pick'} one way for the library, the other screen adapts or keeps its own.`;
}

/** One keyboard key of One by one: A adds, K keeps, the down arrow moves on. */
export function keyAction(key: string): 'add' | 'keep' | 'next' | 'prev' | null {
  if (key === 'a' || key === 'A') return 'add';
  if (key === 'k' || key === 'K') return 'keep';
  if (key === 'ArrowDown' || key === 'j') return 'next';
  if (key === 'ArrowUp') return 'prev';
  return null;
}

/** The decided tag of a piece. */
export const decidedTag = (p: ReviewPiece): { label: string; tone: 'success' | 'info' | 'neutral' } | null => {
  if (!p.decided) return null;
  const label = p.decidedLabel ?? DECIDED_LABEL[p.decided];
  return { label, tone: p.decided === 'added' || p.decided === 'shipped' || p.decided === 'published' ? 'success' : 'neutral' };
};
