// What an exploration changes in the library (decision 2026-11-09, boards LI1 to LI8): every exploration page says it,
// the lead judges the screen and its library pieces together, and the review queue carries it on one line.
//
// Where it comes from: the library check Bridge records on the exploration (prod-branch.ts PiecesRecord, the
// "Missing from the library" block: new components, variants and sizes of a component, token values written by hand,
// token edits in a design copy). Where it goes: the lead's decision per piece, kept in the exploration's own Bridge
// block (explorations.ts `library`), next to the library requests it needs (`neededBy`). The rules:
// - Looks right approves the screen and every piece, except the ones the lead answered on their own (the ⋯ menu:
//   Approve only this one, Ask for changes on this one, Keep it in this screen only, Use an existing piece instead).
// - Two open explorations that change the same part of the same component differently are a conflict: Looks right
//   waits until the lead picks one way (or both, as two sizes). The choice answers both explorations.
// - A token reaches every product on the library: the lead's approval is enough, the product managers hear about it.
// - "Keep it in this screen only": the developers build it inside the product, a local piece the library may take later.
//
// Pure and browser safe: the record in, the rows, sentences and conflicts out. The GitHub writes are in
// library-impact-github.ts.

import { pieceValueField, type LibraryLink, type MissingPiece, type PiecesRecord } from './prod-branch';
import { existingOption, usesLibraryAsIs, type LibraryOption } from './library-options';

/** What a row of "What this changes in the library" is. */
export type ImpactKind = 'component' | 'variant' | 'token' | 'pattern';

/** The lead's own answer on one piece (the ⋯ menu of its row). */
export type PieceVerdict = 'approved' | 'changes' | 'local' | 'existing';

export interface PieceDecision {
  /** The piece id of the library check (MissingPiece.id). */
  piece: string;
  verdict: PieceVerdict;
  /** ISO date. */
  at: string;
  /** A GitHub login, or the display name of a member without one (never an email). */
  by?: string | undefined;
  byName?: string | undefined;
  /** Ask for changes on this one: what to change. */
  text?: string | undefined;
  /** Use an existing piece instead: which one ("Badge"). */
  use?: string | undefined;
}

/** Where a conflict was settled: the same record on both explorations. */
export interface LibraryChoice {
  /** The component both explorations change ("Card"), and the part they change ("padding"). */
  component: string;
  property: string;
  /** The way kept: one exploration's ("owner/repo#12", explorationKeyOf), or both as two sizes. */
  pick: string;
  at: string;
  by?: string | undefined;
  byName?: string | undefined;
}

/** A library request this exploration needs (filed by "Add to the library"): what Waiting for the library reads. */
export interface LibraryNeed {
  piece: string;
  /** The piece in words: "Timeline". */
  title: string;
  /** "owner/name" of the design system repository, the request's issue number and address. */
  repo: string;
  number: number;
  url?: string | undefined;
}

/** What an exploration's Bridge block keeps about its library pieces. */
export interface ExplorationLibrary {
  decisions?: PieceDecision[] | undefined;
  choices?: LibraryChoice[] | undefined;
  neededBy?: LibraryNeed[] | undefined;
  /**
   * The library decision asked (two-reviews.ts): when Done exploring asked the library owners, who they are (GitHub
   * logins, or member names), and who said Done exploring. Gone once the exploration is handed off or goes back to
   * Exploring; the answers in `decisions` stay.
   */
  askedAt?: string | undefined;
  askedTo?: string[] | undefined;
  askedBy?: string | undefined;
  askedByName?: string | undefined;
}

const VERDICTS: readonly PieceVerdict[] = ['approved', 'changes', 'local', 'existing'];
const TEXT_MAX = 500;
const NAME_MAX = 80;

const cleanName = (s: string | undefined) => {
  const v = s?.trim().slice(0, NAME_MAX);
  return v && !v.includes('@') ? v : undefined;
};
const cleanLogin = (s: string | undefined) => (s && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(s) ? s : undefined);

/**
 * The library part of a block as GitHub content may hold it: known verdicts only, one decision per piece (the last
 * wins), one choice per component part, logins and display names only, words capped. Undefined when empty, so a body
 * without decisions stays exactly as it was.
 */
export function cleanExplorationLibrary(l: ExplorationLibrary | null | undefined): ExplorationLibrary | undefined {
  if (!l || typeof l !== 'object') return undefined;
  const decisions = new Map<string, PieceDecision>();
  for (const d of Array.isArray(l.decisions) ? l.decisions : []) {
    if (!d || typeof d.piece !== 'string' || !d.piece.trim() || !VERDICTS.includes(d.verdict) || typeof d.at !== 'string') continue;
    const text = d.text?.trim().slice(0, TEXT_MAX);
    const use = cleanName(d.use);
    decisions.set(d.piece, { piece: d.piece.trim().slice(0, 64), verdict: d.verdict, at: d.at, ...(cleanLogin(d.by) ? { by: d.by } : {}), ...(cleanName(d.byName) ? { byName: cleanName(d.byName) } : {}), ...(text ? { text } : {}), ...(use ? { use } : {}) });
  }
  const choices = new Map<string, LibraryChoice>();
  for (const c of Array.isArray(l.choices) ? l.choices : []) {
    if (!c || typeof c.component !== 'string' || typeof c.property !== 'string' || typeof c.pick !== 'string' || typeof c.at !== 'string') continue;
    choices.set(`${c.component.toLowerCase()}|${c.property.toLowerCase()}`, { component: c.component.slice(0, NAME_MAX), property: c.property.slice(0, NAME_MAX), pick: c.pick.slice(0, 200), at: c.at, ...(cleanLogin(c.by) ? { by: c.by } : {}), ...(cleanName(c.byName) ? { byName: cleanName(c.byName) } : {}) });
  }
  const needs = new Map<string, LibraryNeed>();
  for (const n of Array.isArray(l.neededBy) ? l.neededBy : []) {
    if (!n || typeof n.piece !== 'string' || typeof n.repo !== 'string' || typeof n.number !== 'number') continue;
    needs.set(n.piece, { piece: n.piece.slice(0, 64), title: (typeof n.title === 'string' ? n.title : n.piece).slice(0, NAME_MAX), repo: n.repo.slice(0, 200), number: n.number, ...(typeof n.url === 'string' ? { url: n.url.slice(0, 300) } : {}) });
  }
  const out: ExplorationLibrary = {
    ...(decisions.size ? { decisions: [...decisions.values()] } : {}),
    ...(choices.size ? { choices: [...choices.values()] } : {}),
    ...(needs.size ? { neededBy: [...needs.values()] } : {}),
    ...(typeof l.askedAt === 'string' ? { askedAt: l.askedAt } : {}),
    ...(Array.isArray(l.askedTo) ? (() => {
      const to = l.askedTo.filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, NAME_MAX)).filter((t) => t && !t.includes('@'));
      return to.length ? { askedTo: to } : {};
    })() : {}),
    ...(cleanLogin(l.askedBy) ? { askedBy: l.askedBy } : {}),
    ...(cleanName(l.askedByName) ? { askedByName: cleanName(l.askedByName) } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** The library part with one more decision on a piece (replacing its earlier one). */
export function withPieceDecision(l: ExplorationLibrary | undefined, d: PieceDecision): ExplorationLibrary {
  return { ...(l ?? {}), decisions: [...(l?.decisions ?? []).filter((x) => x.piece !== d.piece), d] };
}

/**
 * The library part without the lead's answer on a piece: the designer replied to "Use an existing piece instead", and
 * the piece waits on the lead again (Library review lists it with the reply).
 */
export function withoutPieceDecision(l: ExplorationLibrary | undefined, piece: string): ExplorationLibrary {
  return { ...(l ?? {}), decisions: (l?.decisions ?? []).filter((x) => x.piece !== piece) };
}

/** The library part with a conflict settled (replacing an earlier choice on the same component part). */
export function withLibraryChoice(l: ExplorationLibrary | undefined, c: LibraryChoice): ExplorationLibrary {
  const same = (x: LibraryChoice) => x.component.toLowerCase() === c.component.toLowerCase() && x.property.toLowerCase() === c.property.toLowerCase();
  return { ...(l ?? {}), choices: [...(l?.choices ?? []).filter((x) => !same(x)), c] };
}

/** The library part with the requests it needs (replacing earlier ones of the same pieces). */
export function withLibraryNeeds(l: ExplorationLibrary | undefined, needs: readonly LibraryNeed[]): ExplorationLibrary {
  const ids = new Set(needs.map((n) => n.piece));
  return { ...(l ?? {}), neededBy: [...(l?.neededBy ?? []).filter((n) => !ids.has(n.piece)), ...needs] };
}

// ---------------------------------------------------------------------------------------------------------------
// Rows: one per piece, in plain words

export interface ImpactItem {
  /** The piece id. */
  id: string;
  kind: ImpactKind;
  /** The piece in plain words: "Timeline", "New size: Compact", "Space inside cards", "Room inside". */
  title: string;
  /** The component it changes ("Stat card"), for a variant, a size or a restyle. */
  of?: string | undefined;
  /** One plain sentence: what it is, and what the library has today. */
  summary: string;
  /** Before and after, as people read them ("16", "Default"); unset when the library has nothing yet. */
  before?: string | undefined;
  after?: string | undefined;
  /** The part of the component it changes ("padding"), for conflicts. */
  property?: string | undefined;
  /** A token: its path, shown under Details only. */
  token?: string | undefined;
  /** A token edit reaches every product on the library, not only this screen. */
  everywhere?: boolean | undefined;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "StatCard" and "stat-card" read "Stat card". */
export function componentWords(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .trim()
    .toLowerCase();
  return cap(spaced);
}

/** A CSS value as people read it: "var(--space-3)" reads "Space 3", "12px" reads "12". */
export function valueWords(value: string, resolved?: string | undefined): string {
  const r = resolved?.trim();
  if (r && /^-?\d+(\.\d+)?px$/.test(r)) return r.replace(/px$/, '');
  const v = value.trim();
  if (/^-?\d+(\.\d+)?px$/.test(v)) return v.replace(/px$/, '');
  const ref = /^var\(--([a-z0-9-]+)\)$/i.exec(v)?.[1];
  if (ref) return componentWords(ref.replace(/-(\d)/g, ' $1'));
  return v;
}

/** The part of a component a CSS property changes, in plain words. */
const PROPERTY_WORDS: Record<string, string> = {
  padding: 'Padding',
  'padding-block': 'Padding',
  'padding-inline': 'Padding',
  gap: 'Space between items',
  'border-radius': 'Corners',
  'font-size': 'Text size',
  'background-color': 'Fill',
  background: 'Fill',
  color: 'Text colour',
  'border-color': 'Edge colour',
  'box-shadow': 'Shadow',
};

/** One row of the section, from a recorded piece. */
export function impactItemOf(p: MissingPiece): ImpactItem {
  const value = p.values[0];
  if (p.kind === 'component') {
    const name = componentWords(p.component ?? p.name);
    return { id: p.id, kind: p.pattern ? 'pattern' : 'component', title: name, summary: p.summary };
  }
  if (p.kind === 'token') {
    const title = p.label ? cap(p.label) : p.title;
    return {
      id: p.id,
      kind: 'token',
      title,
      summary: p.summary,
      ...(p.change ? { before: valueWords(p.change.before, p.change.beforeResolved), after: valueWords(p.change.after, p.change.afterResolved), everywhere: true } : value ? { after: valueWords(value.value) } : {}),
      ...(p.token?.path ? { token: p.token.path } : {}),
    };
  }
  const of = componentWords(p.component ?? p.name);
  if (p.aspect === 'size' && p.change) {
    return { id: p.id, kind: 'variant', of, title: `New size: ${cap(p.change.after)}`, summary: `A ${p.change.after.toLowerCase()} size for ${of}. The current size stays the default.`, before: cap(p.change.before), after: cap(p.change.after), property: 'size' };
  }
  const property = value?.property ?? value?.category;
  const words = property ? (PROPERTY_WORDS[property.toLowerCase()] ?? cap(pieceValueField(value!))) : 'Look';
  const after = value ? valueWords(value.value, value.resolved) : null;
  const state = p.restyle?.state ? ` when ${p.restyle.state}` : '';
  // The audit's own summary names CSS: the row says it in words, the values stay in the before and after.
  const summary = after ? `${words} of ${of} set to ${after}${state} in this screen. The library ${of} has no such option yet.` : `${of} looks different${state} in this screen. The library ${of} has no such option yet.`;
  return { id: p.id, kind: 'variant', of, title: words, summary, ...(after ? { after } : {}), ...(property ? { property } : {}) };
}

/** The rows of a record, in reading order: new components, then changes to components, then tokens. */
export function impactItems(record: PiecesRecord | null | undefined): ImpactItem[] {
  const order: Record<ImpactKind, number> = { component: 0, pattern: 1, variant: 2, token: 3 };
  return (record?.pieces ?? []).map(impactItemOf).sort((a, b) => order[a.kind] - order[b.kind]);
}

// ---------------------------------------------------------------------------------------------------------------
// Conflicts: two open explorations change the same part of the same component differently

/** An exploration as the conflict check reads it: its key, names and recorded pieces. */
export interface ImpactSource {
  /** "owner/repo#12" (explorationKeyOf). */
  key: string;
  name: string;
  /** The product's name: "Acme CRM". */
  product: string;
  /** Who explores it, by name: "Sofia". */
  designer: string;
  record: PiecesRecord | null | undefined;
  library?: ExplorationLibrary | null | undefined;
}

export interface LibraryConflict {
  /** The component both change ("Card") and the part ("padding"). */
  component: string;
  property: string;
  /** This exploration's piece and value. */
  piece: string;
  mine: { key: string; designer: string; value: string };
  /** The other exploration. */
  other: { key: string; name: string; product: string; designer: string; value: string };
  /** Settled already: the way kept ("owner/repo#12" or "both"). */
  pick: string | null;
}

/** "owner/repo#12": one exploration across every product's repository. */
export const explorationKeyOf = (repo: string, number: number) => `${repo.toLowerCase()}#${number}`;

const partKey = (component: string, property: string) => `${component.toLowerCase()}|${property.toLowerCase()}`;

/**
 * The conflicts of one exploration with the others: a change to a component part (a restyle or a size) that another
 * open exploration makes with another value, and a token that another one edits to another value. A choice recorded
 * on either side settles it (still listed, with the way kept).
 */
export function libraryConflicts(mine: ImpactSource, others: readonly ImpactSource[]): LibraryConflict[] {
  const out: LibraryConflict[] = [];
  const parts = (s: ImpactSource) =>
    (s.record?.pieces ?? []).flatMap((p) => {
      const item = impactItemOf(p);
      if (item.kind === 'variant' && item.of && item.property && item.after && item.property !== 'size') return [{ piece: p.id, component: item.of, property: item.property, value: item.after }];
      if (item.kind === 'token' && item.token && item.after) return [{ piece: p.id, component: item.title, property: item.token, value: item.after }];
      return [];
    });
  const choiceOf = (s: ImpactSource, component: string, property: string) => s.library?.choices?.find((c) => partKey(c.component, c.property) === partKey(component, property))?.pick ?? null;
  const own = parts(mine);
  for (const o of others) {
    if (o.key === mine.key) continue;
    for (const theirs of parts(o)) {
      const m = own.find((x) => partKey(x.component, x.property) === partKey(theirs.component, theirs.property));
      if (!m || m.value === theirs.value) continue;
      if (out.some((c) => c.other.key === o.key && partKey(c.component, c.property) === partKey(m.component, m.property))) continue;
      out.push({
        component: m.component,
        property: m.property,
        piece: m.piece,
        mine: { key: mine.key, designer: mine.designer, value: m.value },
        other: { key: o.key, name: o.name, product: o.product, designer: o.designer, value: theirs.value },
        pick: choiceOf(mine, m.component, m.property) ?? choiceOf(o, m.component, m.property),
      });
    }
  }
  return out;
}

/** Conflicts nobody settled yet: Looks right waits for them. */
export const openConflicts = (c: readonly LibraryConflict[]) => c.filter((x) => !x.pick);

// ---------------------------------------------------------------------------------------------------------------
// Status per piece

export type ImpactStatusKey = 'exploring' | 'needs-lead' | 'approved' | 'changes' | 'local' | 'existing' | 'building' | 'conflict' | 'released';

export interface ImpactStatus {
  key: ImpactStatusKey;
  /** The tag: "Exploring", "Needs Dana", "Approved", "Being built", "Kept in this screen", "Uses Badge", "Two ways". */
  label: string;
  tone: 'warning' | 'success' | 'info' | 'neutral' | 'danger';
}

/**
 * Where a piece stands. A conflict nobody settled comes first (it blocks Looks right). Then the lead's own answer on
 * the piece. Then, once the screen was approved (Looks right said), the piece is approved, and Being built when its
 * library request is filed; released once the library shipped it. Before that, it waits for the lead once the
 * designer said Done exploring (`asked`), and reads Exploring for everyone while they are still at it: nobody is
 * asked yet, so nothing needs the lead (the same rule as Home's Needs you and Changes > Waiting on me).
 */
export function impactStatus(x: {
  item: Pick<ImpactItem, 'id'>;
  decision?: PieceDecision | null | undefined;
  conflict?: LibraryConflict | null | undefined;
  /** The screen was approved (Looks right said, or handed off). */
  approved: boolean;
  link?: Pick<LibraryLink, 'number'> | null | undefined;
  released?: boolean | undefined;
  /** The lead's name, for "Needs Dana"; "you" for the lead themself. */
  lead: string;
  /** Done exploring was said: the lead is asked. Left out, the lead is asked (Review all lists only those). */
  asked?: boolean | undefined;
}): ImpactStatus {
  if (x.conflict && !x.conflict.pick) return { key: 'conflict', label: 'Two ways', tone: 'neutral' };
  const d = x.decision;
  if (d?.verdict === 'local') return { key: 'local', label: 'Kept in this screen', tone: 'neutral' };
  if (d?.verdict === 'existing') return { key: 'existing', label: d.use ? `Uses ${d.use}` : 'Uses an existing piece', tone: 'neutral' };
  if (d?.verdict === 'changes') return { key: 'changes', label: 'Changes asked', tone: 'neutral' };
  if (x.released) return { key: 'released', label: 'In the library', tone: 'success' };
  if (d?.verdict === 'approved' || x.approved) return x.link ? { key: 'building', label: 'Being built', tone: 'info' } : { key: 'approved', label: 'Approved', tone: 'success' };
  if (x.asked === false) return { key: 'exploring', label: 'Exploring', tone: 'info' };
  return { key: 'needs-lead', label: `Needs ${x.lead}`, tone: 'neutral' };
}

// ---------------------------------------------------------------------------------------------------------------
// Sentences

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The counts of a section in words, in the order people read them: "1 new component", "1 token change", "1 new size". */
function countWords(items: readonly ImpactItem[]): { parts: string[]; total: number } {
  const components = items.filter((i) => i.kind === 'component').length;
  const patterns = items.filter((i) => i.kind === 'pattern').length;
  const sizes = items.filter((i) => i.kind === 'variant' && i.property === 'size').length;
  const restyles = items.filter((i) => i.kind === 'variant' && i.property !== 'size').length;
  const tokens = items.filter((i) => i.kind === 'token').length;
  const parts = [
    components ? plural(components, 'new component', 'new components') : '',
    patterns ? plural(patterns, 'new pattern', 'new patterns') : '',
    tokens ? plural(tokens, 'token change', 'token changes') : '',
    sizes ? plural(sizes, 'new size', 'new sizes') : '',
    restyles ? plural(restyles, 'change to a component', 'changes to components') : '',
  ].filter(Boolean);
  return { parts, total: items.length };
}

const andList = (parts: readonly string[]) => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/**
 * The section's summary line (LI2 to LI4): "1 new component. Nothing else changes.", "1 token change and 1 new size.",
 * "3 changes · 1 needs a choice first, because another exploration changes the same component."
 */
export function impactSummary(items: readonly ImpactItem[], conflicts: readonly LibraryConflict[] = []): string {
  if (!items.length) return 'Nothing. Every piece comes from the library.';
  const open = openConflicts(conflicts).length;
  if (open) return `${plural(items.length, 'change', 'changes')} · ${open} ${open === 1 ? 'needs' : 'need'} a choice first, because another exploration changes the same component.`;
  const { parts } = countWords(items);
  return items.length === 1 ? `${cap(parts[0]!)}. Nothing else changes.` : `${cap(andList(parts))}.`;
}

/**
 * One exploration in Review all (LI5), on one line: "Nothing new for the library", "Screen + 1 new component",
 * "Screen + 1 token change, 1 new size", "Screen + 3 library changes, 1 needs a choice". Null when never checked.
 */
export function impactQueueLine(record: PiecesRecord | null | undefined, conflicts: readonly LibraryConflict[] = []): string | null {
  if (!record) return null;
  const items = impactItems(record);
  if (!items.length) return 'Nothing new for the library';
  const open = openConflicts(conflicts).length;
  if (open) return `Screen + ${plural(items.length, 'library change', 'library changes')}, ${open} ${open === 1 ? 'needs' : 'need'} a choice`;
  return `Screen + ${countWords(items).parts.join(', ')}`;
}

// ---------------------------------------------------------------------------------------------------------------
// What Looks right sends, and what waits for the library

/**
 * The library option a recorded piece already is: a change to one part of a library component ("Card padding 12"),
 * nothing else changed, at a value the library has (library-options usesLibraryAsIs). Null for anything that asks the
 * library for something new (a new component, a token, a size, a second property such as a fill, a value the library
 * lacks or Bridge cannot read).
 */
export function asIsOption(p: MissingPiece): LibraryOption | null {
  if (p.kind !== 'variant' || p.values.length !== 1) return null;
  const i = impactItemOf(p);
  if (!i.of || !i.property || i.property === 'size' || !i.after) return null;
  return usesLibraryAsIs(i.of, i.property, [i.after]) ? existingOption(i.of, i.property, i.after) : null;
}

/**
 * The pieces Looks right adds to the library: every recorded piece, except the ones the lead answered on their own
 * (kept in the screen, an existing piece instead, changes asked), the ones already sent, and the ones that use the
 * library as is (asIsOption: a Card at 12 px is Compact, nothing to build). The pieces the designer ticked come along
 * even when the record no longer lists them (proposePiecesOnGitHub says they are unknown), unless the record says they
 * use the library as is.
 */
export function piecesToAdd(record: PiecesRecord | null | undefined, library: ExplorationLibrary | null | undefined, ticked: readonly string[] = []): string[] {
  const held = new Set((library?.decisions ?? []).filter((d) => d.verdict !== 'approved').map((d) => d.piece));
  const sent = new Set((record?.links ?? []).map((l) => l.piece));
  const asIs = new Set((record?.pieces ?? []).filter((p) => asIsOption(p)).map((p) => p.id));
  const all = [...(record?.pieces ?? []).map((p) => p.id), ...ticked];
  return [...new Set(all)].filter((id) => !held.has(id) && !sent.has(id) && !asIs.has(id));
}

/** The pieces the lead kept in the screen: the developers build them in the product, flagged as library candidates. */
export function localPieces(record: PiecesRecord | null | undefined, library: ExplorationLibrary | null | undefined): MissingPiece[] {
  const local = new Set((library?.decisions ?? []).filter((d) => d.verdict === 'local').map((d) => d.piece));
  return (record?.pieces ?? []).filter((p) => local.has(p.id));
}

/**
 * "Waiting for the library: Timeline": the library requests an approved exploration needs that the library has not
 * released yet (`released` says it for one request, from its issue: closed as completed). Empty: nothing waits.
 */
export function waitingForLibrary(library: ExplorationLibrary | null | undefined, released: (n: LibraryNeed) => boolean): LibraryNeed[] {
  return (library?.neededBy ?? []).filter((n) => !released(n));
}

/** The line Being built and the developers' task show: "Waiting for the library: Timeline, Stat card". Null when nothing waits. */
export function waitingLine(waiting: readonly Pick<LibraryNeed, 'title'>[]): string | null {
  return waiting.length ? `Waiting for the library: ${andList(waiting.map((w) => w.title))}` : null;
}
