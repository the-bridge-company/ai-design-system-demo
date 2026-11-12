// "What this changes in the library" on the exploration page and in Review all (boards LI1 to LI5, LI8, EB1 to EB4):
// the rows, tags and sentences people read, from what Bridge recorded on the exploration (core library-impact.ts).
// Pure: the record, the block and the conflicts in, the view out. Painted by components/ds/studio/LibraryImpact.tsx;
// read and written by scripts/library-impact.ts. Tested in library-impact-view.test.ts.
import {
  HAT_WORDS,
  libraryImpactTitle,
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
import { SEP } from './sep';
import { notifiedLine } from './people-line';
import { baselineOf, knownLibraryOptions, type LibraryOption } from './library-baseline';
import { asIsLine, asIsOption, decisionConflicts } from './library-as-is';

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
  /**
   * The piece's one tag on its header line (ledger board v3): "New", "New option", "2 new options", "Decided". Null for
   * a piece that uses the library as is (lib/library-as-is): no tag, its quiet line says it.
   */
  tag: PieceTag | null;
  /** Where it comes from, on the right of its header: the designers' faces and their products. */
  origin: { people: string[]; products: string[] };
  /**
   * Settled: the row folds into one sentence ("Timeline is added to the library, for every product. Decided by Dana,
   * just now."). Null while it waits, or when the row says its state another way (its note).
   */
  settled: Said[] | null;
  /**
   * The library decision on this piece (two reviews), for a library owner while it waits: "Library decision. You decide
   * as design system owner, apart from the screen", with the two buttons of Library review. Null for everyone else.
   */
  libraryDecision?: LibraryDecisionView | null;
}

/** The library decision on a piece's row: the hat's words and the two answers (Keep in the screen, Add to the library). */
export interface LibraryDecisionView {
  title: string;
  as: string;
  /** "Keep in Sofia's screen": verdict local. */
  keep: string;
  /** "Add to the library": verdict approved. */
  add: string;
}

/** The one tag of a piece: what it is while it waits, its state once answered. */
export interface PieceTag {
  label: string;
  tone: ImpactStatus['tone'];
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
  /**
   * The ledger's one sentence (board v3): "Card gets a new padding option, **Comfortable 24 px**, for Sofia's screen.
   * **Default 20 px** stays the default. Decided by Dana, just now."
   */
  parts: Said[];
  /** "Dana, just now". */
  by: string;
  /** "Leo and Sofia will be notified." (lib/people-line notifiedLine), drawn with their faces (People.tsx). */
  told: string;
  /** Who is notified, in that order. */
  people: string[];
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
  /** Beside the actions: "Answers both screens. Leo and Sofia will be notified." */
  note: string;
  /**
   * The same sentence in runs, one of them a link when the choice is made elsewhere: "Dana picks in [Library review],
   * for both screens." or "[Pick in Library review]: it answers both screens."
   */
  noteParts: NotePart[];
  /**
   * Who the choice notifies, said after noteParts with their faces (People.tsx), the same line as Library review's
   * footer: "Leo and Sofia will be notified." Null when the reader does not make the choice.
   */
  notified: { text: string; people: string[] } | null;
  /** "Comment to both", "Comment to all", "Comment". */
  comment: string;
  /** The row's one tag while open: "Your choice", "Dana picks". */
  tag: string;
  /** Under today's plate: "In the library now", or "Stays the default" when sizes are on the table. */
  todayHint: string;
  /** The way kept ("owner/repo#12"), "both", or "sizes:<key> <key>". Null while open. */
  pick: string | null;
  decided: DecidedView | null;
  /** The component part's options as rows (board v3): the new ones to add, the ones already in the library. */
  ledger: LedgerView;
}

/**
 * One option of a component part, as the ledger reads it (board v3): "Padding: Comfortable", whose way it is, its value
 * and how far it sits from the default.
 */
export interface OptionRow {
  /** The ways (exploration keys) that ask for this value. Empty for the default nobody asked for. */
  keys: string[];
  /** The option's name: the library's own ("Default", "Compact"), or the one Bridge proposes ("Comfortable"). */
  name: string;
  /** "20 px", or the way in words when it is not a size ("Filled, no border"). */
  value: string;
  /** The value in pixels, when it is a size. */
  px: number | null;
  /** "+4 px" or "−4 px" against the default, when both are sizes. */
  delta: string | null;
  /** The library's default. */
  isDefault: boolean;
  /** Under the name: "Sofia's way · Order fulfilment timeline · Acme Prints". */
  line: string;
  /** The face before that line. */
  face: string | null;
  /** Who asked for it, by first name. */
  designers: string[];
  look: WayLook;
}

export interface LedgerView {
  /** The part in words, before each option's name: "Padding". */
  property: string;
  /** Values the library does not have: each one a tick for the lead. */
  fresh: OptionRow[];
  /** Already in the library: the default first, then the options a screen can use as they are. */
  have: OptionRow[];
}

export type LibraryImpactView =
  | { state: 'loading' }
  | { state: 'unchecked'; line: string }
  | {
      state: 'nothing';
      /** "Nothing new for the library" (core libraryImpactTitle), never a count. */
      title: string;
      /** One line: what the screen uses as it is ("Leo's screen uses Compact (12 px) and Card as they are in the library."). */
      line: string;
      uses: string[];
    }
  | {
      state: 'rows';
      summary: string;
      /** The header's count of new pieces only ("1 new piece") and what it waits for ("1 waits for you", "decided"), said once. */
      count: string;
      tail: string | null;
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

/** The after side's caption of something new: it has no before, only what this screen brings. */
export const NEW_IN_SCREEN = 'New in this screen';

/** Before and after in words: a new piece has nothing before it (the after side only), a token and a change compare two values. */
function sides(i: ImpactItem, designer: string): { before: ImpactSide | null; after: ImpactSide | null } {
  if (i.kind === 'component' || i.kind === 'pattern') return { before: null, after: { label: i.title, caption: NEW_IN_SCREEN } };
  if (i.property === 'size') return { before: { label: i.before ?? 'Default', caption: 'Today' }, after: { label: i.after ?? '', caption: 'Added' } };
  if (i.kind === 'token') return i.before && i.after ? { before: { label: i.before, caption: 'Before' }, after: { label: i.after, caption: 'After' } } : { before: null, after: i.after ? { label: i.after, caption: 'Written by hand' } : null };
  return { before: i.before ? { label: i.before, caption: 'Today' } : null, after: i.after ? { label: i.after, caption: designer } : null };
}

/** The lead's word on a piece, as a short line under its summary. */
function noteOf(d: { verdict: PieceVerdict; text?: string | undefined; use?: string | undefined; byName?: string | undefined; by?: string | undefined } | undefined, names: Record<string, string>): string | null {
  if (!d) return null;
  const who = d.byName ?? (d.by ? (names[d.by] ?? d.by) : 'The library owners');
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
   * Two reviews: the viewer decides what the library keeps (a library owner asked on this exploration). Each new piece
   * that waits shows the library decision on its row (libraryDecision). Left out: the old single review.
   */
  libraryHat?: boolean;
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
  if (!items.length) return nothingView(x.designer, [], uses);
  // Only the parts where a way is new to the library are decisions (lib/library-as-is): every way already in the
  // library (Default, Compact) is no conflict, its row reads one quiet line.
  const conflicts = decisionConflicts(
    (x.conflicts ?? []).filter((c) => items.some((i) => i.id === c.piece)),
    [...(x.others ?? []), ...(x.conflicts ?? []).map((c) => ({ key: c.mine.key, record }))],
  );
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
  // The pieces used as the library has them (Compact, the default padding): folded into one line, never a row.
  const asIsWords: string[] = [];
  const rows: ImpactRowView[] = items.map((i) => {
    const decision = block?.library?.decisions?.find((d) => d.piece === i.id);
    const link = record.links.find((l) => l.piece === i.id);
    const conflict = conflicts.find((c) => c.piece === i.id) ?? null;
    const cv = views.find((v) => v.piece === i.id) ?? null;
    const raw = record.pieces.find((p) => p.id === i.id);
    const asIs = !cv && !decision && !link && raw ? asIsOption(raw) : null;
    if (asIs) {
      asIsWords.push(asIsWord(i, asIs));
      return asIsRow(i, asIs, x.designer, x.product);
    }
    const status = impactStatus({ item: i, decision, conflict, approved: x.approved, link, released: Boolean(link && x.released?.has(link.number)), lead: x.lead, asked: x.asked ?? true });
    const open = !x.approved && x.canDecide && status.key !== 'conflict';
    const settled = settledLine(i, status, decision, x.designer, names, x.now ?? new Date());
    const base: ImpactRowView = {
      id: i.id,
      kind: kindLine(i),
      title: i.title,
      summary: i.summary,
      ...sides(i, x.designer),
      status,
      // A settled piece says it in its one sentence: no second note repeating it.
      note: settled ? null : noteOf(decision, names),
      details: i.token ? [{ label: 'Token', value: i.token }] : [],
      menu: open ? (['approve', 'changes', 'local', 'existing'] as PieceAction[]).filter((a) => !(a === 'approve' && (decision?.verdict === 'approved' || link))) : [],
      reply: decision?.verdict === 'existing' && x.replyTo && !x.approved ? (decision.byName?.split(/\s+/)[0] ?? (decision.by ? (names[decision.by] ?? decision.by) : x.replyTo)) : null,
      tag: tagOf(i, status),
      origin: { people: [x.designer], products: x.product ? [x.product] : [] },
      settled,
      libraryDecision:
        x.libraryHat && open && status.key === 'needs-lead' && !link
          ? { title: HAT_WORDS.libraryTurn, as: HAT_WORDS.libraryAs, keep: `Keep in ${possessive(x.designer)} screen`, add: 'Add to the library' }
          : null,
    };
    return cv ? conflictRow(base, cv, i) : base;
  });
  // Nothing new: the screen uses the library as it is, one line, no count (two reviews: "Nothing new for the library").
  const fresh = rows.filter((r) => r.tag !== null);
  const libraryUses = uses.filter((u) => !items.some((i) => i.of === u || i.title === u));
  if (!fresh.length && !views.length) return nothingView(x.designer, asIsWords, libraryUses);
  const everywhere = items.some((i) => i.everywhere);
  const products = x.products ?? [];
  const waiting = rows.filter((r) => r.status.key === 'needs-lead' || r.status.key === 'conflict').length;
  // A piece that uses the library as is (no tag) was never a decision: it never makes the block read "decided".
  const decisions = rows.filter((r) => r.tag !== null);
  const done = decisions.length > 0 && decisions.every((r) => SETTLED.has(r.status.key));
  const forWhom = /^you$/i.test(x.lead) ? 'you' : x.lead;
  const tail = waiting && (x.canDecide || (x.asked ?? true)) && !x.approved ? `${waiting} ${waiting === 1 ? 'waits' : 'wait'} for ${x.canDecide ? 'you' : forWhom}` : done ? 'decided' : null;
  const freshItems = items.filter((i) => fresh.some((r) => r.id === i.id));
  return {
    state: 'rows',
    // New pieces only ("1 new piece"): a piece used as it is folds into the footer's line.
    count: libraryImpactTitle(fresh.length),
    tail,
    // With ways to choose from, the count only (EB1): the choice says itself once, in its row's tag, and the footer
    // already says what else comes from the library.
    summary: conflicts.length ? libraryImpactTitle(fresh.length) : impactSummary(freshItems, []),
    rows: fresh,
    conflicts: views,
    uses: [...asIsWords, ...libraryUses],
    reach: everywhere ? { line: products.length > 1 ? `Every product on the library gets it, not only this screen: ${products.join(' and ')}. One library owner's approval is enough.` : "Every screen on the library gets it, not only this one. One library owner's approval is enough." } : null,
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
    : { key: 'conflict', label: cv.tag, tone: 'neutral' };
  const n = cv.ledger.fresh.length;
  const tag: PieceTag = settled ? { label: status.key === 'approved' ? 'Decided' : status.label, tone: status.key === 'approved' ? 'success' : status.tone } : { label: n > 1 ? `${n} new options` : 'New option', tone: 'info' };
  const people = [...new Set(cv.ways.map((w) => w.designer))];
  const products = [...new Set(cv.ways.map((w) => w.product).filter(Boolean))];
  return { ...base, kind: 'Change to', title: cv.component, summary, before: null, after: null, status, menu: [], tag, origin: { people, products }, settled: cv.decided?.parts ?? null };
}

/**
 * A piece that uses the library as is (lib/library-as-is): settled from the start, no tag, no menu, one quiet line
 * ("Leo's screen uses Compact, already in the library. Nothing to decide."). It waits for nobody.
 */
function asIsRow(i: ImpactItem, o: LibraryOption, designer: string, product: string | undefined): ImpactRowView {
  return {
    id: i.id,
    kind: kindLine(i),
    title: i.title,
    summary: i.summary,
    before: null,
    after: null,
    status: { key: 'existing', label: `Uses ${o.name}`, tone: 'neutral' },
    note: null,
    details: [],
    menu: [],
    reply: null,
    tag: null,
    origin: { people: [designer], products: product ? [product] : [] },
    settled: [{ text: asIsLine(designer, i.of ?? 'The component', i.property ?? '', o) }],
  };
}

/** A piece used as the library has it, in the footer's words: "Compact (12 px)", "the default Card padding (20 px)". */
function asIsWord(i: ImpactItem, o: LibraryOption): string {
  return o.isDefault ? `the default ${i.of ?? 'component'} ${(i.property ?? '').toLowerCase()} (${o.px} px)`.replace(/\s+\(/, ' (') : `${o.name} (${o.px} px)`;
}

const listWords = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * Nothing new for the library: the title says it (no count) and one line lists what the screen uses as it is. Nobody
 * decides anything, so nobody is named.
 */
export function nothingView(designer: string, asIs: readonly string[], uses: readonly string[]): Extract<LibraryImpactView, { state: 'nothing' }> {
  const all = [...asIs, ...uses];
  const line = all.length ? `${possessive(designer)} screen uses ${listWords(all)}, as ${all.length === 1 ? 'it is' : 'they are'} in the library.` : `${designer} built it with the pieces the library already has. The developers can build it right away.`;
  return { state: 'nothing', title: libraryImpactTitle(0), line, uses: all.length ? [] : [...uses] };
}

/** The states a piece is answered in: its row folds, and the block reads "decided" once every row is. */
const SETTLED = new Set<ImpactStatus['key']>(['approved', 'building', 'released', 'local', 'existing']);

/** The one tag of a piece (board v3): what it is while it waits ("New", "New option"), its state once answered. */
function tagOf(i: ImpactItem, status: ImpactStatus): PieceTag {
  if (status.key === 'approved' || status.key === 'local') return { label: 'Decided', tone: 'success' };
  if (status.key === 'building' || status.key === 'released' || status.key === 'existing' || status.key === 'changes') return { label: status.label, tone: status.tone };
  if (i.kind === 'token') return { label: 'Token change', tone: 'info' };
  return { label: i.kind === 'variant' ? 'New option' : 'New', tone: 'info' };
}

const possessive = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/** "Decided by Dana, just now.", from the lead's recorded answer. Empty when Bridge does not know who. */
function decidedBy(d: { at?: string | undefined; by?: string | undefined; byName?: string | undefined } | null | undefined, names: Record<string, string>, now: Date): string {
  const who = d?.byName?.split(/\s+/)[0] ?? (d?.by ? (names[d.by] ?? d.by) : null);
  if (!who) return '';
  const when = d?.at ? agoInSentence(d.at, now) : '';
  return ` Decided by ${who}${when ? `, ${when}` : ''}.`;
}

/**
 * A piece answered, in one sentence (board v3): "Timeline is added to the library, for every product. Decided by Dana,
 * just now." Null while it waits, or for an answer the row says another way (changes asked, an existing piece).
 */
function settledLine(i: ImpactItem, status: ImpactStatus, d: Parameters<typeof decidedBy>[0], designer: string, names: Record<string, string>, now: Date): Said[] | null {
  const by = decidedBy(d, names, now);
  if (status.key === 'local') return [{ text: `${i.title} stays in ${possessive(designer)} screen only.${by}` }];
  if (!['approved', 'building', 'released'].includes(status.key)) return null;
  const what =
    i.kind === 'component' || i.kind === 'pattern'
      ? `${i.title} is added to the library, for every product.`
      : i.kind === 'token'
        ? `${i.title} changes in the library, for every product.`
        : `${i.of ?? 'The component'} gets ${i.title.charAt(0).toLowerCase()}${i.title.slice(1)}.`;
  return [{ text: `${what}${by}` }];
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
      } else if (today !== null && l.padding === today && !l.filled && !l.borderless && !l.shadowless) words.push('same as today');
      else if (today === null && min !== max && (l.padding === min || l.padding === max)) words.push(l.padding === min ? 'tighter' : 'roomier');
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
  if (pick === KEEP_TODAY) return { mode: 'sizes', keys: [] };
  if (pick.startsWith('sizes:'))
    return {
      mode: 'sizes',
      keys: Object.keys(pickNames(pick)).filter((k) => ways.some((w) => w.key === k)),
    };
  return { mode: 'one', keys: ways.some((w) => w.key === pick) ? [pick] : [] };
}

/** The lead keeps the component as it is today: no new option (board v3, "Keep today's Card"). */
export const KEEP_TODAY = 'today';

/**
 * The names the lead gave the options kept, by way: "sizes:<key>=<name> <key>". A key without a name keeps the name
 * Bridge proposed. Names are URI-encoded so a space stays inside one key.
 */
export function pickNames(pick: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!pick.startsWith('sizes:')) return out;
  for (const t of pick.slice('sizes:'.length).split(/\s+/).filter(Boolean)) {
    const at = t.indexOf('=');
    const key = at < 0 ? t : t.slice(0, at);
    let name = '';
    if (at >= 0) {
      try {
        name = decodeURIComponent(t.slice(at + 1)).trim();
      } catch {
        name = '';
      }
    }
    out[key] = name;
  }
  return out;
}

/**
 * What the lead's ticks record (board v3): every way of each ticked option, with the option's name when the lead
 * renamed it; nothing ticked keeps today's component.
 */
export function ledgerPick(ticked: readonly { keys: readonly string[]; name: string; proposed: string }[]): string {
  const keys = ticked.flatMap((r) => r.keys.map((k, i) => (i === 0 && r.name.trim() && r.name.trim() !== r.proposed ? `${k}=${encodeURIComponent(r.name.trim())}` : k)));
  return keys.length ? `sizes:${keys.join(' ')}` : KEEP_TODAY;
}

/** The primary button says the outcome: "Add Comfortable to Card", "Add 2 options to Card", "Keep today's Card". */
export function ledgerLabel(component: string, names: readonly string[]): string {
  if (!names.length) return `Keep today's ${component}`;
  if (names.length === 1) return `Add ${names[0]} to ${component}`;
  return `Add ${names.length} options to ${component}`;
}

export type { LibraryOption };

/**
 * The options of a library component part, from its code (lib/library-baseline, the one baseline Library review also
 * reads: Card padding is None 0, Compact 12 px and Default 20 px, the layout inset). A part Bridge does not know reads
 * today's value alone, as the default.
 */
export function libraryOptions(component: string, property: string, today: number | null): readonly LibraryOption[] {
  const known = knownLibraryOptions(component, property);
  if (known) return known;
  return today !== null ? [{ name: 'Default', px: today, isDefault: true }] : [];
}

/** The size words an option series continues with, roomier then tighter than the default. */
const ROOMIER = ['Comfortable', 'Spacious', 'Generous', 'Airy'];
const TIGHTER = ['Compact', 'Tight', 'Dense', 'Snug'];

/**
 * The names Bridge proposes for new values, continuing the series the component already has (Compact, Default, then
 * Comfortable, Spacious): roomier values in growing order, tighter ones in shrinking order, never a name taken.
 */
export function proposeNames(values: readonly number[], options: readonly LibraryOption[]): Map<number, string> {
  const out = new Map<number, string>();
  const taken = new Set(options.map((o) => o.name.toLowerCase()));
  const base = options.find((o) => o.isDefault)?.px ?? null;
  const unique = [...new Set(values)].filter((v) => !options.some((o) => o.px === v));
  const up = unique.filter((v) => base === null || v > base).sort((a, b) => a - b);
  const down = unique.filter((v) => base !== null && v < base).sort((a, b) => b - a);
  const name = (list: readonly string[], v: number) => {
    const n = list.find((w) => !taken.has(w.toLowerCase()));
    if (!n) return `${v} px`;
    taken.add(n.toLowerCase());
    return n;
  };
  for (const v of up) out.set(v, name(ROOMIER, v));
  for (const v of down) out.set(v, name(TIGHTER, v));
  return out;
}

const deltaWords = (px: number | null, base: number | null): string | null => {
  if (px === null || base === null || px === base) return null;
  return `${px > base ? '+' : '−'}${Math.abs(px - base)} px`;
};

interface LedgerWay {
  key: string;
  designer: string;
  label: string;
  screen: string;
  product: string;
  size: string;
  px: number | null;
  look: WayLook;
}

/**
 * The ways of a component part as its options (board v3): values the library lacks to add (each a tick), the default
 * and the options a screen can already use as they are.
 */
export function ledgerOf(component: string, property: string, ways: readonly LedgerWay[], today: number | null): LedgerView {
  const options = libraryOptions(component, property, today);
  const def = options.find((o) => o.isDefault) ?? null;
  const base = def?.px ?? null;
  const names = proposeNames(
    ways.flatMap((w) => (w.px === null ? [] : [w.px])),
    options,
  );
  const where = (w: LedgerWay) => [w.screen, w.product].filter(Boolean).join(SEP);
  const fresh: OptionRow[] = [];
  const have: OptionRow[] = [];
  if (def)
    have.push({
      keys: ways.filter((w) => w.px === def.px).map((w) => w.key),
      name: def.name,
      value: `${def.px} px`,
      px: def.px,
      delta: null,
      isDefault: true,
      line: 'Every screen gets it today. It stays the default.',
      face: null,
      designers: [],
      look: lookOf(null, `${def.px}px`),
    });
  for (const w of ways) {
    const existing = w.px === null ? null : (options.find((o) => o.px === w.px) ?? null);
    if (existing?.isDefault) continue;
    if (existing) {
      have.push({ keys: [w.key], name: existing.name, value: `${existing.px} px`, px: existing.px, delta: deltaWords(existing.px, base), isDefault: false, line: `${possessive(w.designer)} screen can use ${existing.name} as it is${SEP}${where(w)}`, face: w.designer, designers: [w.designer], look: w.look });
      continue;
    }
    // Two screens asking for the same value share one option.
    const same = fresh.find((r) => (w.px !== null ? r.px === w.px : r.value === w.size));
    if (same) {
      same.keys.push(w.key);
      same.designers.push(w.designer);
      same.line = `${namesLine(same.designers)}'s way${SEP}${same.designers.length} screens`;
      continue;
    }
    fresh.push({
      keys: [w.key],
      name: w.px !== null ? (names.get(w.px) ?? `${w.px} px`) : w.size,
      value: w.px !== null ? `${w.px} px` : w.size,
      px: w.px,
      delta: deltaWords(w.px, base),
      isDefault: false,
      line: `${w.label}${SEP}${where(w)}`,
      face: w.designer,
      designers: [w.designer],
      look: w.look,
    });
  }
  fresh.sort((a, b) => (a.px ?? 0) - (b.px ?? 0));
  return { property: cap(property.replace(/[-_]+/g, ' ')), fresh, have };
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
  // One baseline (lib/library-baseline): the library's own value first, then what the check recorded as today.
  const today = baselineOf(component, property, pixels(minePiece ? (impactItemOf(minePiece).before ?? undefined) : undefined) ?? null);
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
    hint: `${words[i]!.size}${words[i]!.thanToday ? ' than today' : ''}${SEP}${w.mine ? 'this screen' : w.screen}`,
  }));
  const others = ways.filter((w) => !w.mine);
  const several = ways.length > 2;
  const lead = x.lead;
  // Nobody named: the library owners, the hat that picks (two reviews), never one "lead".
  const owners = !lead.trim() || /^the library owners$/i.test(lead);
  const leadName = /^you$/i.test(lead) ? null : owners ? 'The library owners' : lead;
  const picks = owners || /,| and /.test(lead) ? 'pick' : 'picks';
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
  const told = notifiedLine(ways.map((w) => w.designer));
  const where = x.reviewHref;
  const noteParts: NotePart[] = decides
    ? [{ text: `Answers ${screens}.` }]
    : x.designerHere
      ? [{ text: `Tell ${owners || !leadName ? 'the library owners' : leadName} why yours fits this screen. ${owners || !leadName ? "The library owners'" : `${leadName}'s`} choice answers ${screens}.` }]
      : leadElsewhere
        ? [where ? { text: 'Pick in Library review', href: where } : { text: 'Pick in Library review' }, { text: `: it answers ${screens}.` }]
        : [{ text: `${leadName ?? 'The library owners'} ${picks} in ` }, where ? { text: 'Library review', href: where } : { text: 'Library review' }, { text: `, for ${screens}.` }];
  const notified = decides || leadElsewhere ? { text: told, people: [...new Set(ways.map((w) => w.designer))] } : null;
  const note = [noteParts.map((p) => p.text).join(''), notified?.text].filter(Boolean).join(' ');
  const pick = group.find((c) => c.pick)?.pick ?? null;
  const rawValue = (key: string) => (key === first.mine.key ? first.mine.value : group.find((c) => c.other.key === key)?.other.value);
  const sized = /^padding|gap|radius|width|height|size/i.test(property);
  const ledger = ledgerOf(
    component,
    property,
    ways.map((w) => ({ ...w, px: /^padding/i.test(property) ? w.look.padding : sized ? (pixels(rawValue(w.key)) ?? spacePixels(rawValue(w.key))) : null })),
    today,
  );
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
    notified,
    comment: decides ? (ways.length === 2 ? 'Comment to both' : 'Comment to all') : 'Comment',
    // Who picks, said once: the lead deciding here reads "Your choice", the lead who picks in Library review "Needs you".
    tag: decides ? 'Your choice' : leadElsewhere ? 'Needs you' : `${leadName ?? 'The library owners'} ${picks}`,
    todayHint: several ? 'Stays the default' : 'In the library now',
    pick,
    decided: pick ? decidedView(pick, ways, component, property, x, told, ledger) : null,
    ledger,
  };
}

/** The choice as it was recorded, on this exploration or on another one it answers. */
function choiceFor(component: string, property: string, x: ConflictContext): LibraryChoice | null {
  const same = (c: LibraryChoice) => c.component.toLowerCase() === component.toLowerCase() && c.property.toLowerCase() === property.toLowerCase();
  return x.choices.find(same) ?? x.others.flatMap((o) => o.library?.choices ?? []).find(same) ?? null;
}

/**
 * The ledger's one sentence once decided (board v3): "Card gets a new padding option, **Comfortable 24 px**, for
 * Sofia's screen. **Default 20 px** stays the default. Decided by Dana, just now."
 */
export function decidedParts(pick: string, ways: readonly { key: string; designer: string }[], component: string, ledger: LedgerView, by: string): Said[] {
  const { keys } = keptKeys(pick, ways);
  const named = pickNames(pick);
  const added = ledger.fresh
    .filter((r) => r.keys.some((k) => keys.includes(k)))
    .map((r) => ({ name: r.keys.map((k) => named[k]).find(Boolean) ?? r.name, value: r.px !== null ? `${r.px} px` : null, designers: r.designers }));
  const part = ledger.property.toLowerCase();
  const out: Said[] = [];
  const option = (a: (typeof added)[number]) => ({ text: a.value && a.value !== a.name ? `${a.name} ${a.value}` : a.name, strong: true });
  if (!added.length) out.push({ text: `${component} keeps its ${part} options as they are.` });
  else {
    out.push({ text: `${component} gets ${added.length === 1 ? `a new ${part} option` : `${count(added.length)} new ${part} options`}, ` });
    added.forEach((a, i) => {
      if (i) out.push({ text: i === added.length - 1 ? ' and ' : ', ' });
      out.push(option(a));
    });
    const owners = [...new Set(added.flatMap((a) => a.designers))].map(possessive);
    out.push({ text: `, for ${owners.length === 1 ? `${owners[0]} screen` : `${namesLine(owners, 99)} screens`}.` });
  }
  const def = ledger.have.find((r) => r.isDefault);
  if (def) out.push({ text: ' ' }, { text: `${def.name} ${def.value}`, strong: true }, { text: ' stays the default.' });
  out.push({ text: by });
  return out;
}

function decidedView(pick: string, ways: readonly WayView[], component: string, property: string, x: ConflictContext, told: string, ledger: LedgerView): DecidedView {
  const { mode, keys } = keptKeys(pick, ways);
  const kept = ways.filter((w) => keys.includes(w.key));
  const choice = choiceFor(component, property, x);
  const who = choice?.byName ?? (choice?.by ? choice.by : 'The library owners');
  const when = choice?.at ? agoInSentence(choice.at, x.now) : '';
  const by = ` Decided by ${choice?.byName?.split(/\s+/)[0] ?? choice?.by ?? 'the library owners'}${when ? `, ${when}` : ''}.`;
  const title =
    mode === 'sizes'
      ? `${component} gets ${kept.length === 1 ? 'a new size' : `${count(kept.length)} new sizes`}`
      : kept[0]
        ? `${component} takes ${kept[0].mine ? "this screen's" : `${kept[0].designer}'s`} way`
        : `${component} is decided`;
  return {
    title,
    parts: decidedParts(pick, ways, component, ledger, by),
    by: when ? `${who}, ${when}` : who,
    told,
    people: [...new Set(ways.map((w) => w.designer))],
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
 * What Send to the developers waits for (error prevention, LI4). The zone's primary becomes that next step itself
 * ("Choose Card padding") and takes the lead to the library section, where the choice is made: never a disabled
 * button with an explanation beside it. Null when nothing waits.
 */
export function looksRightBlock(conflicts: readonly LibraryConflict[]): string | null {
  const open = openConflicts(conflicts);
  if (!open.length) return null;
  if (open.length > 1) return `Choose ${open.length} library pieces`;
  const c = open[0]!;
  return `Choose ${c.component}${c.property ? ` ${c.property}` : ''}`;
}

/** "Waiting for the library: Timeline" for an approved exploration's task, from its block and the released requests. */
export function waitingForLibraryLine(body: string | null | undefined, released: (n: LibraryNeed) => boolean): string | null {
  return waitingLine(waitingForLibrary(parseExplorationBody(body)?.library, released));
}
