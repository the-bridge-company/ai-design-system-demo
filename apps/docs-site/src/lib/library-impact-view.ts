// "What this changes in the library" on the exploration page and in Review all (boards LI1 to LI5, LI8, EB1 to EB4):
// the rows, tags and sentences people read, from what Bridge recorded on the exploration (core library-impact.ts).
// Pure: the record, the block and the conflicts in, the view out. Painted by components/ds/studio/LibraryImpact.tsx;
// read and written by scripts/library-impact.ts. Tested in library-impact-view.test.ts.
import {
  agoInSentence,
  componentWords,
  impactItemOf,
  impactItems,
  impactStatus,
  impactSummary,
  openConflicts,
  parseExplorationBody,
  parsePiecesRecord,
  waitingForLibrary,
  waitingLine,
  type ImpactItem,
  type ImpactSource,
  type ImpactStatus,
  type LibraryChoice,
  type LibraryConflict,
  type LibraryNeed,
  type MissingPiece,
  type PieceVerdict,
} from '@bridge-ds/core';

/** One side of a row's before and after: what it reads ("16", "Timeline") and what it is ("Today"). */
export interface ImpactSide {
  label: string;
  caption: string;
  /** Nothing there yet: a dashed plate. */
  empty?: boolean;
}

export interface ImpactRowView {
  id: string;
  /** What the row is, above its name: "New component", "Change to Stat card", "Token change", "New pattern". */
  kind: string;
  title: string;
  summary: string;
  before: ImpactSide | null;
  after: ImpactSide | null;
  status: ImpactStatus;
  /** The lead's own words on it, under the summary: "Dana: lighter dots, please." */
  note: string | null;
  /** Under Details only: the token path, for who needs it. */
  details: { label: string; value: string }[];
  /** The ⋯ menu, for the lead while the screen waits on them. */
  menu: PieceAction[];
  /**
   * "Reply to Dana" (board LR11): the designer disagrees with the lead's "Use an existing piece instead"; the piece goes
   * back to Library review with the reason. The lead's name, or null when the viewer cannot reply.
   */
  reply: string | null;
}

/** What the ⋯ menu of a piece offers (LI3). */
export type PieceAction = 'approve' | 'changes' | 'local' | 'existing';

export const PIECE_ACTION_LABEL: Record<PieceAction, string> = {
  approve: 'Approve only this one',
  changes: 'Ask for changes on this one',
  local: 'Keep it in this screen only',
  existing: 'Use an existing piece instead',
};

/** The line under an action of the menu, when it needs one. */
export const PIECE_ACTION_HINT: Partial<Record<PieceAction, string>> = {
  local: 'The library stays as it is',
};

/** The verdict each action records. */
export const VERDICT_OF: Record<PieceAction, PieceVerdict> = { approve: 'approved', changes: 'changes', local: 'local', existing: 'existing' };

/** How a way looks, for the small card on its plate: what Bridge recorded of the screen's change. */
export interface WayLook {
  /** Room inside, in pixels, when the change sets it. */
  padding: number | null;
  /** Space between the card's lines, in pixels: the change's own value, else half the room inside (a tighter way is tighter throughout). */
  gap: number | null;
  /** Corner radius, in pixels, when the change sets it. */
  radius: number | null;
  borderless: boolean;
  filled: boolean;
  shadowless: boolean;
}

/** One way of a component part, as one plate (board EB1): whose screen, what it does in words, how it looks. */
export interface WayView {
  /** The exploration's key ("owner/repo#12"): the value the choice records. */
  key: string;
  designer: string;
  /** This page's exploration. */
  mine: boolean;
  /** "Leo's way", or "Leo's way (yours)" for the designer reading their own exploration. */
  label: string;
  /** The screen and its product: "Contact page summary", "Acme CRM". */
  screen: string;
  product: string;
  /** The way in a few words, its name once kept as a size: "Tighter", "Roomier", "Filled, no border". */
  size: string;
  /** Under the name: "Tighter than today · this screen". */
  hint: string;
  look: WayLook;
}

/** One run of a sentence that names people and screens: a face before a name, a screen in bold. */
export interface Said {
  text: string;
  strong?: boolean;
  /** The person whose face goes before this run. */
  face?: string;
}

/** A run of a note; with an href, a link ("Library review"). */
export interface NotePart {
  text: string;
  href?: string;
}

/** A settled conflict (boards EB3, EB4): what the library gets, who chose and when, and the plates kept. */
export interface DecidedView {
  /** "Card gets two new sizes", "Card takes Sofia's way". */
  title: string;
  /** "Dana, just now". */
  by: string;
  /** "Leo and Sofia are told". */
  told: string;
  plates: DecidedPlate[];
}

export interface DecidedPlate {
  key: string;
  /** "Today", "Tighter". */
  label: string;
  /** Under the label: "Stays the default", the screen it comes from. Null when the chip says it. */
  sub: string | null;
  /** "This screen": the way this page's screen takes, ringed. */
  chip: string | null;
  today: boolean;
  look: WayLook | null;
}

/**
 * A component part several explorations change differently (boards EB1 to EB4): one card with every way side by side,
 * the choice for the lead, the same block read only for everyone else, and once settled what the library gets.
 */
export interface ConflictView {
  piece: string;
  component: string;
  property: string;
  /** This exploration's way first, then the others'. */
  ways: WayView[];
  /** The lead decides here: radios (or ticks) and the button. Everyone else reads it. */
  decides: boolean;
  /** Three ways or more: "One way" or "Keep several as sizes". */
  several: boolean;
  /** "Which way does Card take?", "Sofia's screen makes Card roomier". */
  question: string;
  context: Said[];
  /** Beside the actions: "Answers both screens. Leo and Sofia are told." */
  note: string;
  /**
   * The same sentence in runs, one of them a link when the choice is made elsewhere: "Dana picks in [Library review],
   * for both screens." or "[Pick in Library review]: it answers both screens."
   */
  noteParts: NotePart[];
  /** "Comment to both", "Comment to all", "Comment". */
  comment: string;
  /** The row's one tag while open: "Your choice", "Dana picks". */
  tag: string;
  /** Under today's plate: "In the library now", or "Stays the default" when sizes are on the table. */
  todayHint: string;
  /** The way kept ("owner/repo#12"), "both", or "sizes:<key> <key>". Null while open. */
  pick: string | null;
  decided: DecidedView | null;
}

export type LibraryImpactView =
  | { state: 'loading' }
  | { state: 'unchecked'; line: string }
  | { state: 'nothing'; line: string; uses: string[] }
  | {
      state: 'rows';
      summary: string;
      rows: ImpactRowView[];
      /** One per component part, open or settled; each sits in the row of its piece. */
      conflicts: ConflictView[];
      /** "Everything else comes from the library: Card, Badge." Empty when the check did not say. */
      uses: string[];
      /** A token reaches every product on the library (LI3's footer). */
      reach: { line: string } | null;
    };

const KIND_WORD: Record<ImpactItem['kind'], string> = { component: 'New component', pattern: 'New pattern', variant: 'Change to', token: 'Token change' };

/** The row's kind line: "Change to Stat card" for a change to a component, else what it is. */
const kindLine = (i: ImpactItem) => (i.kind === 'variant' && i.of ? `${KIND_WORD.variant} ${i.of}` : KIND_WORD[i.kind]);

/** Before and after in words: a new piece has nothing before it, a token and a change compare two values. */
function sides(i: ImpactItem, designer: string): { before: ImpactSide | null; after: ImpactSide | null } {
  if (i.kind === 'component' || i.kind === 'pattern') return { before: { label: 'Not in the library', caption: 'Today', empty: true }, after: { label: i.title, caption: 'With this exploration' } };
  if (i.property === 'size') return { before: { label: i.before ?? 'Default', caption: 'Today' }, after: { label: i.after ?? '', caption: 'Added' } };
  if (i.kind === 'token') return i.before && i.after ? { before: { label: i.before, caption: 'Before' }, after: { label: i.after, caption: 'After' } } : { before: null, after: i.after ? { label: i.after, caption: 'Written by hand' } : null };
  return { before: i.before ? { label: i.before, caption: 'Today' } : null, after: i.after ? { label: i.after, caption: designer } : null };
}

/** The lead's word on a piece, as a short line under its summary. */
function noteOf(d: { verdict: PieceVerdict; text?: string | undefined; use?: string | undefined; byName?: string | undefined; by?: string | undefined } | undefined, names: Record<string, string>): string | null {
  if (!d) return null;
  const who = d.byName ?? (d.by ? (names[d.by] ?? d.by) : 'The lead');
  if (d.verdict === 'changes' && d.text) return `${who}: ${d.text}`;
  if (d.verdict === 'local') return `${who} kept it in this screen. The developers build it inside the product, and the library may take it later.`;
  if (d.verdict === 'existing' && d.use) return `${who} asked to use ${d.use} instead.`;
  return null;
}

export interface ImpactInput {
  /** The exploration's pull request body: its library check and its block. */
  body: string | null | undefined;
  /** Who explores it, by name ("Sofia"), and the lead it waits on ("Dana", or "you" for the lead themself). */
  designer: string;
  lead: string;
  /** The screen was approved: Looks right said (handed off). */
  approved: boolean;
  /** The lead reads it and may answer each piece (the ⋯ menu) and pick a way where explorations disagree. */
  canDecide: boolean;
  /**
   * Done exploring was said: the pieces wait on the lead ("Needs you", "Needs Dana"). Before that they read Exploring
   * for everyone, the lead included. Left out: asked (Review all lists only explorations that wait on the lead).
   */
  asked?: boolean;
  conflicts?: readonly LibraryConflict[];
  /** The team's other open explorations, as the conflict check read them: how their ways look, who chose. */
  others?: readonly ImpactSource[];
  /** This exploration's screen and product, for its own plate ("Deal pipeline cards", "Acme CRM"). */
  screen?: string;
  product?: string;
  /** The names of the team's products, for a token that reaches all of them. */
  products?: readonly string[];
  /** Requests the library released (their issue numbers), for "In the library". */
  released?: ReadonlySet<number>;
  names?: Record<string, string>;
  /** The viewer is the exploration's designer: they may reply to the lead's answers, named so ("Dana"). */
  replyTo?: string | null;
  /** The viewer is the exploration's designer: their own way reads "(yours)". */
  designerHere?: boolean;
  /**
   * This exploration's pieces in Library review, where a choice is made when this page does not offer it (the
   * exploration is past the lead's answer, or the viewer is not the lead).
   */
  reviewHref?: string | null;
  now?: Date;
}

/** The section's view from the exploration's body (LI1 to LI4, EB1 to EB4). */
export function libraryImpactView(x: ImpactInput): LibraryImpactView {
  const record = parsePiecesRecord(x.body);
  if (!record) return { state: 'unchecked', line: 'Bridge has not checked this exploration against the library yet.' };
  const block = parseExplorationBody(x.body);
  const items = impactItems(record);
  // The library's pieces in words ("Segmented control"), the way designers name them.
  const uses = (record.uses ?? []).map(componentWords);
  if (!items.length) return { state: 'nothing', line: `The best kind of exploration: ${x.designer} built it with the pieces the library already has. Nothing to decide here, and the developers can build it right away.`, uses };
  const conflicts = (x.conflicts ?? []).filter((c) => items.some((i) => i.id === c.piece));
  const names = x.names ?? {};
  const views = conflictViews(conflicts, {
    pieces: record.pieces,
    others: x.others ?? [],
    choices: block?.library?.choices ?? [],
    lead: x.lead,
    canDecide: x.canDecide && !x.approved,
    designerHere: Boolean(x.designerHere),
    reviewHref: x.reviewHref ?? null,
    screen: x.screen ?? block?.name ?? 'This screen',
    product: x.product ?? '',
    now: x.now ?? new Date(),
  });
  const rows: ImpactRowView[] = items.map((i) => {
    const decision = block?.library?.decisions?.find((d) => d.piece === i.id);
    const link = record.links.find((l) => l.piece === i.id);
    const conflict = conflicts.find((c) => c.piece === i.id) ?? null;
    const cv = views.find((v) => v.piece === i.id) ?? null;
    const status = impactStatus({ item: i, decision, conflict, approved: x.approved, link, released: Boolean(link && x.released?.has(link.number)), lead: x.lead, asked: x.asked ?? true });
    const open = !x.approved && x.canDecide && status.key !== 'conflict';
    const base: ImpactRowView = {
      id: i.id,
      kind: kindLine(i),
      title: i.title,
      summary: i.summary,
      ...sides(i, x.designer),
      status,
      note: noteOf(decision, names),
      details: i.token ? [{ label: 'Token', value: i.token }] : [],
      menu: open ? (['approve', 'changes', 'local', 'existing'] as PieceAction[]).filter((a) => !(a === 'approve' && (decision?.verdict === 'approved' || link))) : [],
      reply: decision?.verdict === 'existing' && x.replyTo && !x.approved ? (decision.byName?.split(/\s+/)[0] ?? (decision.by ? (names[decision.by] ?? decision.by) : x.replyTo)) : null,
    };
    return cv ? conflictRow(base, cv, i) : base;
  });
  const everywhere = items.some((i) => i.everywhere);
  const products = x.products ?? [];
  return {
    state: 'rows',
    // With ways to choose from, the count only (EB1): the choice says itself once, in its row's tag, and the footer
    // already says what else comes from the library.
    summary: conflicts.length ? `${items.length} ${items.length === 1 ? 'change' : 'changes'}` : impactSummary(items, []),
    rows,
    conflicts: views,
    uses: uses.filter((u) => !items.some((i) => i.of === u || i.title === u)),
    reach: everywhere ? { line: products.length > 1 ? `Every product on the library gets it, not only this screen: ${products.join(' and ')}. The lead's approval is enough.` : "Every screen on the library gets it, not only this one. The lead's approval is enough." } : null,
  };
}

/**
 * The row of a piece caught in a conflict (EB1, EB2): "Change to" over the component's name, the change in plain words,
 * and one tag saying who picks. Its ways are drawn under it, in the same card; no before and after, no menu.
 */
function conflictRow(base: ImpactRowView, cv: ConflictView, i: ImpactItem): ImpactRowView {
  const mine = cv.ways.find((w) => w.mine);
  const word = mine?.size.split(',')[0]?.trim() ?? '';
  const padding = /^(Tighter|Roomier)$/.test(word);
  const summary = padding ? `${word} ${plural(cv.component)} on this screen. The library ${cv.component} has no ${word.toLowerCase()} size yet.` : i.summary;
  const settled = Boolean(cv.decided);
  const status: ImpactStatus = settled
    ? ['building', 'released'].includes(base.status.key)
      ? base.status
      : { key: 'approved', label: 'Decided', tone: 'success' }
    : { key: 'conflict', label: cv.tag, tone: 'warning' };
  return { ...base, kind: 'Change to', title: cv.component, summary, before: null, after: null, status, menu: [] };
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const plural = (component: string) => {
  const w = component.toLowerCase();
  return /(s|x|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;
};

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** "Leo", "Leo and Sofia", "Leo, Sofia and Ann", "Leo, Sofia and 8 others": the worst case stays one short line. */
export function namesLine(names: readonly string[], max = 3): string {
  const list = [...new Set(names)];
  if (list.length <= 1) return list[0] ?? '';
  if (list.length <= max) return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${list.slice(0, max - 1).join(', ')} and ${list.length - (max - 1)} others`;
}

const pixels = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(v.trim());
  return m ? Number(m[1]) : null;
};
const NONE = /^(none|0|0px|transparent)$/i;

/** How a recorded piece looks: its room inside, and whether it drops the border, the shadow or adds a fill. */
export function lookOf(piece: Pick<MissingPiece, 'values'> | null | undefined, fallback?: string): WayLook {
  const look: WayLook = { padding: null, gap: null, radius: null, borderless: false, filled: false, shadowless: false };
  const px = (v: { value?: string; resolved?: string }) => pixels(v.resolved) ?? pixels(v.value) ?? spacePixels(v.value);
  for (const v of piece?.values ?? []) {
    const prop = (v.property ?? v.category ?? '').toLowerCase();
    const value = (v.resolved ?? v.value ?? '').trim();
    if (prop.startsWith('padding')) look.padding = px(v) ?? look.padding;
    else if (prop === 'gap' || prop === 'row-gap') look.gap = px(v) ?? look.gap;
    else if (prop.includes('radius')) look.radius = px(v) ?? look.radius;
    else if (prop.startsWith('border') && NONE.test(value)) look.borderless = true;
    else if (prop.startsWith('background') && value && !NONE.test(value)) look.filled = true;
    else if (prop === 'box-shadow' && NONE.test(value)) look.shadowless = true;
  }
  if (look.padding === null && fallback !== undefined) look.padding = pixels(fallback) ?? spacePixels(fallback);
  // The space between lines follows the room inside when the change does not set it: a tighter card is tighter throughout.
  if (look.gap === null && look.padding !== null) look.gap = Math.round(look.padding / 2);
  return look;
}

/** A space token's size when no resolved value was recorded ("var(--space-3)" is 12): the usual 4-pixel scale. */
function spacePixels(v: string | undefined): number | null {
  const m = /^var\(--space-(\d+)(?:-(5))?\)$/.exec((v ?? '').trim());
  return m ? (Number(m[1]) + (m[2] ? 0.5 : 0)) * 4 : null;
}

/** The recorded piece of a source that changes this component part. */
function pieceOf(pieces: readonly MissingPiece[], component: string, property: string): MissingPiece | null {
  return (
    pieces.find((p) => {
      const i = impactItemOf(p);
      return (i.of ?? i.title).toLowerCase() === component.toLowerCase() && (i.property ?? '').toLowerCase() === property.toLowerCase();
    }) ?? null
  );
}

/**
 * Each way in a few words, against today when Bridge knows today's value, else against the other ways: "Tighter",
 * "Roomier", "Filled, no border". A way that only differs by what it adds says that.
 */
export function wayWords(looks: readonly WayLook[], today: number | null): { size: string; thanToday: boolean }[] {
  const pads = looks.map((l) => l.padding).filter((n): n is number => n !== null);
  const min = Math.min(...pads);
  const max = Math.max(...pads);
  return looks.map((l) => {
    const words: string[] = [];
    let thanToday = false;
    if (l.padding !== null) {
      if (today !== null && l.padding !== today) {
        words.push(l.padding < today ? 'tighter' : 'roomier');
        thanToday = true;
      } else if (today === null && min !== max && (l.padding === min || l.padding === max)) words.push(l.padding === min ? 'tighter' : 'roomier');
    }
    if (l.filled) words.push('filled');
    if (l.borderless) words.push('no border');
    if (l.shadowless) words.push('no shadow');
    if (!words.length) words.push(l.padding !== null ? `room inside ${l.padding}` : 'another look');
    return { size: cap(words.join(', ')), thanToday: thanToday && words.length === 1 };
  });
}

/** The keys a pick keeps: one way, every way ("both"), or the ways kept as sizes ("sizes:<key> <key>"). */
export function keptKeys(pick: string, ways: readonly { key: string }[]): { mode: 'one' | 'sizes'; keys: string[] } {
  if (pick === 'both') return { mode: 'sizes', keys: ways.map((w) => w.key) };
  if (pick.startsWith('sizes:'))
    return {
      mode: 'sizes',
      keys: pick
        .slice('sizes:'.length)
        .split(/\s+/)
        .filter((k) => ways.some((w) => w.key === k)),
    };
  return { mode: 'one', keys: ways.some((w) => w.key === pick) ? [pick] : [] };
}

/** What the lead's choice records: one way's key, "both" when every way becomes a size, else "sizes:<key> <key>". */
export function pickOf(mode: 'one' | 'sizes', keys: readonly string[], ways: readonly { key: string }[]): string | null {
  if (!keys.length) return null;
  if (mode === 'one') return keys[0]!;
  if (keys.length === ways.length) return 'both';
  return `sizes:${ways
    .filter((w) => keys.includes(w.key))
    .map((w) => w.key)
    .join(' ')}`;
}

/** The primary button says the outcome: "Keep Leo's way", "Keep both as sizes", "Keep 2 sizes: Tighter and Roomier". */
export function keepLabel(mode: 'one' | 'sizes', keys: readonly string[], ways: readonly WayView[]): string {
  const kept = ways.filter((w) => keys.includes(w.key));
  if (!kept.length) return mode === 'one' ? 'Keep this way' : 'Keep these sizes';
  if (mode === 'one') return `Keep ${kept[0]!.designer}'s way`;
  if (ways.length === 2 && kept.length === 2) return 'Keep both as sizes';
  const sizes = kept.map((w) => w.size);
  return `Keep ${kept.length} ${kept.length === 1 ? 'size' : 'sizes'}: ${sizes.length > 1 ? `${sizes.slice(0, -1).join(', ')} and ${sizes[sizes.length - 1]}` : sizes[0]}`;
}

interface ConflictContext {
  pieces: readonly MissingPiece[];
  others: readonly ImpactSource[];
  choices: readonly LibraryChoice[];
  lead: string;
  canDecide: boolean;
  designerHere: boolean;
  reviewHref: string | null;
  screen: string;
  product: string;
  now: Date;
}

/** The conflicts of one exploration, one view per component part (two, three or more ways side by side). */
export function conflictViews(conflicts: readonly LibraryConflict[], x: ConflictContext): ConflictView[] {
  const groups = new Map<string, LibraryConflict[]>();
  for (const c of conflicts) {
    const k = `${c.component.toLowerCase()}|${c.property.toLowerCase()}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.values()].map((g) => conflictView(g, x));
}

function conflictView(group: readonly LibraryConflict[], x: ConflictContext): ConflictView {
  const first = group[0]!;
  const { component, property } = first;
  const minePiece = x.pieces.find((p) => p.id === first.piece) ?? null;
  const today = pixels(minePiece ? (impactItemOf(minePiece).before ?? undefined) : undefined);
  const raw = [
    { key: first.mine.key, designer: first.mine.designer, mine: true, screen: x.screen, product: x.product, look: lookOf(minePiece, first.mine.value) },
    // The other ways in a steady order (oldest exploration first), whatever order the lists came back in.
    ...[...group].sort((a, b) => a.other.key.localeCompare(b.other.key, 'en', { numeric: true })).map((c) => {
      const source = x.others.find((o) => o.key === c.other.key);
      return { key: c.other.key, designer: c.other.designer, mine: false, screen: c.other.name, product: c.other.product, look: lookOf(source?.record ? pieceOf(source.record.pieces, component, property) : null, c.other.value) };
    }),
  ].filter((w, i, all) => all.findIndex((y) => y.key === w.key) === i);
  const words = wayWords(
    raw.map((w) => w.look),
    today,
  );
  const ways: WayView[] = raw.map((w, i) => ({
    ...w,
    label: `${w.designer}'s way${w.mine && x.designerHere ? ' (yours)' : ''}`,
    size: words[i]!.size,
    hint: `${words[i]!.size}${words[i]!.thanToday ? ' than today' : ''} · ${w.mine ? 'this screen' : w.screen}`,
  }));
  const others = ways.filter((w) => !w.mine);
  const several = ways.length > 2;
  const lead = x.lead;
  const leadName = /^you$/i.test(lead) ? null : lead === 'the DS lead' ? 'The DS lead' : lead;
  const screens = ways.length === 2 ? 'both screens' : `all ${ways.length} screens`;
  const effect = (w: WayView) => w.size.toLowerCase();
  const sameProduct = others.every((w) => w.product === others[0]?.product);
  // Who else changes it, in one sentence; ten askers or more stay one line ("and 8 more").
  const shown = others.slice(0, 2);
  const listed: Said[] = shown.flatMap((w, i) => [
    { text: `${w.designer}'s `, face: w.designer },
    { text: w.screen, strong: true },
    { text: `${sameProduct ? '' : ` (${w.product})`} makes it ${effect(w)}${i < shown.length - 1 ? ', ' : ''}` },
  ]);
  const rest = others.length - shown.length;
  const tail: Said[] = [{ text: `${rest > 0 ? ` and ${rest} more` : ''}.${sameProduct && others[0]?.product ? ` All in ${others[0].product}.` : ''}` }];
  const manyContext: Said[] = [{ text: `${cap(count(others.length))} more ${others.length === 1 ? 'screen changes' : 'screens change'} ${component}: ` }, ...listed, ...tail];
  const other = others[0]!;
  const decides = x.canDecide;
  // The viewer is the lead, but this page does not offer the choice (the exploration is past the lead's answer).
  const leadElsewhere = !decides && !x.designerHere && leadName === null;
  // What this screen does, from the reader's side: "yours" for its designer, else "this screen".
  const mineWay = ways.find((w) => w.mine);
  const mineSaid: Said[] = mineWay ? [{ text: `; ${x.designerHere ? 'yours' : 'this screen'} makes it ${effect(mineWay)}.` }] : [{ text: '.' }];
  let question: string;
  let context: Said[];
  if (decides) {
    question = `Which way does ${component} take?`;
    context = several
      ? manyContext
      : [{ text: `${other.designer}'s `, face: other.designer }, { text: other.screen, strong: true }, { text: `${other.product ? ` (${other.product})` : ''} makes ${component} ${effect(other)}.` }];
  } else {
    // Everyone else reads the same two lines as the lead (EB1): the component and its ways, then who makes it what.
    question = `${component}, ${count(ways.length)} ways`;
    context = several
      ? [...listed, ...tail]
      : [{ text: `${other.designer}'s `, face: other.designer }, { text: other.screen, strong: true }, { text: `${other.product ? ` (${other.product})` : ''} makes it ${effect(other)}` }, ...mineSaid];
  }
  const told = `${namesLine(ways.map((w) => w.designer))} ${ways.length === 1 ? 'is' : 'are'} told`;
  const toldLine = ways.length > 3 ? 'Everyone who asked is told.' : `${told}.`;
  const where = x.reviewHref;
  const noteParts: NotePart[] = decides
    ? [{ text: `Answers ${ways.length === 2 ? 'both screens' : `${ways.length} screens`}. ${toldLine}` }]
    : x.designerHere
      ? [{ text: `Tell ${leadName && leadName !== 'The DS lead' ? leadName : 'the DS lead'} why yours fits this screen. ${leadName ?? 'The DS lead'}'s choice answers ${screens}.` }]
      : leadElsewhere
        ? [where ? { text: 'Pick in Library review', href: where } : { text: 'Pick in Library review' }, { text: `: it answers ${screens}. ${toldLine}` }]
        : [{ text: `${leadName ?? 'The DS lead'} picks in ` }, where ? { text: 'Library review', href: where } : { text: 'Library review' }, { text: `, for ${screens}.` }];
  const note = noteParts.map((p) => p.text).join('');
  const pick = group.find((c) => c.pick)?.pick ?? null;
  return {
    piece: first.piece,
    component,
    property,
    ways,
    decides,
    several,
    question,
    context,
    note,
    noteParts,
    comment: decides ? (ways.length === 2 ? 'Comment to both' : 'Comment to all') : 'Comment',
    // Who picks, said once: the lead deciding here reads "Your choice", the lead who picks in Library review "Needs you".
    tag: decides ? 'Your choice' : leadElsewhere ? 'Needs you' : `${leadName ?? 'The DS lead'} picks`,
    todayHint: several ? 'Stays the default' : 'In the library now',
    pick,
    decided: pick ? decidedView(pick, ways, component, property, x, told) : null,
  };
}

/** The choice as it was recorded, on this exploration or on another one it answers. */
function choiceFor(component: string, property: string, x: ConflictContext): LibraryChoice | null {
  const same = (c: LibraryChoice) => c.component.toLowerCase() === component.toLowerCase() && c.property.toLowerCase() === property.toLowerCase();
  return x.choices.find(same) ?? x.others.flatMap((o) => o.library?.choices ?? []).find(same) ?? null;
}

function decidedView(pick: string, ways: readonly WayView[], component: string, property: string, x: ConflictContext, told: string): DecidedView {
  const { mode, keys } = keptKeys(pick, ways);
  const kept = ways.filter((w) => keys.includes(w.key));
  const choice = choiceFor(component, property, x);
  const who = choice?.byName ?? (choice?.by ? choice.by : 'The DS lead');
  const when = choice?.at ? agoInSentence(choice.at, x.now) : '';
  const title =
    mode === 'sizes'
      ? `${component} gets ${kept.length === 1 ? 'a new size' : `${count(kept.length)} new sizes`}`
      : kept[0]
        ? `${component} takes ${kept[0].mine ? "this screen's" : `${kept[0].designer}'s`} way`
        : `${component} is decided`;
  return {
    title,
    by: when ? `${who}, ${when}` : who,
    told,
    plates: [
      { key: 'today', label: 'Today', sub: mode === 'sizes' ? 'Stays the default' : 'Before', chip: null, today: true, look: null },
      ...kept.map((w) => ({ key: w.key, label: w.size, sub: w.mine ? null : w.screen, chip: w.mine ? 'This screen' : null, today: false, look: w.look })),
    ],
  };
}

/**
 * The Harbor zone's line while the lead decides (LI2, LI3): what Looks right also does to the library. A choice between
 * ways is offered in one place only, the library section (EB1): the zone says nothing about it. Null when nothing
 * changes in the library (the usual line stays).
 */
export function leadLibraryLine(view: LibraryImpactView, designer: string): string | null {
  if (view.state !== 'rows') return null;
  const pending = view.rows.filter((r) => r.status.key === 'needs-lead');
  if (!pending.length) return null;
  void designer;
  const what = pending.length === 1 ? `the ${pending[0]!.title.replace(/^New size: /, 'new size ')}` : `the ${pending.length} changes below`;
  return `Sending also adds ${what} to the library.`;
}

/**
 * The design lead's line in Check the build when the exploration has library pieces: the build check never asks the
 * lead (the screen was approved), but a piece still open waits on them in Library review. "Card waits on Dana in
 * Library review", "2 library pieces wait on you in Library review"; every piece settled, "Not needed: the library
 * pieces are decided". Null when nothing changes in the library (the build check's own line stays).
 */
export function leadBuildLine(view: LibraryImpactView, lead: string): { waiting: boolean; line: string } | null {
  if (view.state !== 'rows' || !view.rows.length) return null;
  const open = view.rows.filter((r) => r.status.key === 'conflict' || r.status.key === 'needs-lead');
  if (!open.length) return { waiting: false, line: 'Not needed: the library pieces are decided' };
  const who = /^you$/i.test(lead) ? 'you' : lead;
  return { waiting: true, line: open.length === 1 ? `${open[0]!.title} waits on ${who} in Library review` : `${open.length} library pieces wait on ${who} in Library review` };
}

/**
 * What Looks right waits for (error prevention, LI4), beside the disabled button: it points to the library section,
 * where the choice is made, and never asks it a second time. Null when nothing does.
 */
export function looksRightBlock(conflicts: readonly LibraryConflict[]): string | null {
  const open = openConflicts(conflicts);
  return open.length ? `Pick the ${open[0]!.component} way first` : null;
}

/** "Waiting for the library: Timeline" for an approved exploration's task, from its block and the released requests. */
export function waitingForLibraryLine(body: string | null | undefined, released: (n: LibraryNeed) => boolean): string | null {
  return waitingLine(waitingForLibrary(parseExplorationBody(body)?.library, released));
}
