// "What this changes in the library" on the exploration page and in Review all (boards LI1 to LI5, LI8): the rows,
// tags and sentences people read, from what Bridge recorded on the exploration (core library-impact.ts). Pure: the
// record, the block and the conflicts in, the view out. Painted by components/ds/studio/LibraryImpact.tsx; read and
// written by scripts/library-impact.ts. Tested in library-impact-view.test.ts.
import {
  impactItems,
  impactStatus,
  impactSummary,
  openConflicts,
  parseExplorationBody,
  parsePiecesRecord,
  waitingForLibrary,
  waitingLine,
  type ImpactItem,
  type ImpactStatus,
  type LibraryConflict,
  type LibraryNeed,
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

/** A conflict as the lead reads it (LI4): the two ways, and both as two sizes. */
export interface ConflictView {
  piece: string;
  component: string;
  property: string;
  /** "Contact page summary · Acme CRM · Sofia also changes Card, the other way." */
  line: string;
  other: { key: string; name: string; product: string; designer: string };
  options: { value: string; label: string; hint: string }[];
  /** The way kept, once chosen: its option's value. */
  pick: string | null;
  /** "Your choice answers both explorations. Sofia and Leo are told." */
  note: string;
}

export type LibraryImpactView =
  | { state: 'loading' }
  | { state: 'unchecked'; line: string }
  | { state: 'nothing'; line: string; uses: string[] }
  | {
      state: 'rows';
      summary: string;
      rows: ImpactRowView[];
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
  /** The lead reads it and may answer each piece (the ⋯ menu). */
  canDecide: boolean;
  conflicts?: readonly LibraryConflict[];
  /** The names of the team's products, for a token that reaches all of them. */
  products?: readonly string[];
  /** Requests the library released (their issue numbers), for "In the library". */
  released?: ReadonlySet<number>;
  names?: Record<string, string>;
}

/** The section's view from the exploration's body (LI1 to LI4). */
export function libraryImpactView(x: ImpactInput): LibraryImpactView {
  const record = parsePiecesRecord(x.body);
  if (!record) return { state: 'unchecked', line: 'Bridge has not checked this exploration against the library yet.' };
  const block = parseExplorationBody(x.body);
  const items = impactItems(record);
  const uses = record.uses ?? [];
  if (!items.length) return { state: 'nothing', line: `The best kind of exploration: ${x.designer} built it with the pieces the library already has. Nothing to decide here, and the developers can build it right away.`, uses };
  const conflicts = x.conflicts ?? [];
  const names = x.names ?? {};
  const rows: ImpactRowView[] = items.map((i) => {
    const decision = block?.library?.decisions?.find((d) => d.piece === i.id);
    const link = record.links.find((l) => l.piece === i.id);
    const conflict = conflicts.find((c) => c.piece === i.id) ?? null;
    const status = impactStatus({ item: i, decision, conflict, approved: x.approved, link, released: Boolean(link && x.released?.has(link.number)), lead: x.lead });
    const open = !x.approved && x.canDecide && status.key !== 'conflict';
    return {
      id: i.id,
      kind: kindLine(i),
      title: i.title,
      summary: i.summary,
      ...sides(i, x.designer),
      status,
      note: noteOf(decision, names),
      details: i.token ? [{ label: 'Token', value: i.token }] : [],
      menu: open ? (['approve', 'changes', 'local', 'existing'] as PieceAction[]).filter((a) => !(a === 'approve' && (decision?.verdict === 'approved' || link))) : [],
    };
  });
  const everywhere = items.some((i) => i.everywhere);
  const products = x.products ?? [];
  return {
    state: 'rows',
    summary: impactSummary(items, conflicts),
    rows,
    conflicts: conflicts.filter((c) => items.some((i) => i.id === c.piece)).map((c) => conflictView(c)),
    uses: uses.filter((u) => !items.some((i) => i.of === u || i.title === u)),
    reach: everywhere ? { line: products.length > 1 ? `Every product on the library gets it, not only this screen: ${products.join(' and ')}. The lead's approval is enough.` : "Every screen on the library gets it, not only this one. The lead's approval is enough." } : null,
  };
}

/** The two ways and both (LI4), in the lead's words. */
export function conflictView(c: LibraryConflict): ConflictView {
  const part = c.property === 'padding' ? 'room inside' : c.property.toLowerCase();
  const more = (a: string, b: string) => {
    const na = Number(a);
    const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) ? (na < nb ? 'Less' : 'More') : null;
  };
  const mineWord = more(c.mine.value, c.other.value);
  const otherWord = more(c.other.value, c.mine.value);
  return {
    piece: c.piece,
    component: c.component,
    property: c.property,
    line: `${c.other.designer} also changes ${c.component}, the other way.`,
    other: { key: c.other.key, name: c.other.name, product: c.other.product, designer: c.other.designer },
    options: [
      { value: c.mine.key, label: `${c.mine.designer}'s way`, hint: `${mineWord ? `${mineWord} ${part}` : `${c.component} ${part}`}: ${c.mine.value}` },
      { value: c.other.key, label: `${c.other.designer}'s way`, hint: `${otherWord ? `${otherWord} ${part}` : `${c.component} ${part}`}: ${c.other.value}` },
      { value: 'both', label: 'Both, as two sizes', hint: "Compact and roomy, today's stays the default" },
    ],
    pick: c.pick,
    note: `Your choice answers both explorations. ${c.other.designer} and ${c.mine.designer} are told.`,
  };
}

/**
 * The Harbor zone's line while the lead decides (LI2 to LI4): what Looks right also does to the library, or what it
 * waits for. Null when nothing changes in the library (the usual line stays).
 */
export function leadLibraryLine(view: LibraryImpactView, designer: string): string | null {
  if (view.state !== 'rows') return null;
  const open = view.conflicts.filter((c) => !c.pick);
  if (open.length) return `${designer} is done exploring. Pick a way for ${open[0]!.component} below, then answer. Looks right waits for that choice.`;
  const pending = view.rows.filter((r) => r.status.key === 'needs-lead');
  if (!pending.length) return null;
  const what = pending.length === 1 ? `the ${pending[0]!.title.replace(/^New size: /, 'new size ')}` : `the ${pending.length} library changes below`;
  return `${designer} is done exploring. Looks right also accepts ${what} into the library. To answer one on its own, use its menu.`;
}

/** What blocks Looks right (error prevention, LI4): the open conflicts, in one line for the bar. Null when nothing does. */
export function looksRightBlock(conflicts: readonly LibraryConflict[]): string | null {
  const open = openConflicts(conflicts);
  return open.length ? `Pick a way for ${open[0]!.component} first` : null;
}

/** "Waiting for the library: Timeline" for an approved exploration's task, from its block and the released requests. */
export function waitingForLibraryLine(body: string | null | undefined, released: (n: LibraryNeed) => boolean): string | null {
  return waitingLine(waitingForLibrary(parseExplorationBody(body)?.library, released));
}
