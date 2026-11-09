// Where each library change comes from (boards LI6 and LI7, decided 2026-11-09): the Library group of Changes stays
// for everyone, and every change in it says why it exists. Either an exploration needed it ("Needed by Order
// fulfilment timeline · Acme Prints", linked to the exploration), or the DS lead made it for every product ("From the
// DS lead · accessibility fix"). Sources, most precise first:
//   1. an `origin` field in any Bridge block of the change's body (`<!-- bridge-... {"origin": {...}} -->`, or a
//      `bridge-origin` block holding the origin itself). Contract: {kind: "exploration", repo, number, product, name},
//      or {kind: "lead", reason}. Read tolerantly: unknown fields are ignored, a malformed block counts as none.
//   2. the "Needed by" block (core parseNeededBy) a library branch opened for an exploration carries.
//   3. otherwise the DS lead, with the reason Bridge can tell from what it already knows (a Figma push, a brand, a
//      contrast or accessibility fix, docs, a token rule), else no reason at all.
// The lead's view groups the same changes by component (two explorations asking for Card two different ways is a
// conflict to pick; an exploration asking for what the lead already made is one build) or by exploration.
// Pure: no DOM, no fetch. Unit tested in library-origin.test.ts.
import { parseFigmaOrigin, parseNeededBy, type NeededBy, type ProductConfig } from '@bridge-ds/core';
import { studioHref } from './team-path';

/** Why the DS lead made a change for every product. */
export type LeadReason = 'a11y' | 'brand' | 'figma' | 'docs' | 'rule';

/** The words of each reason, after "From the DS lead · ". */
export const LEAD_REASON_LABEL: Record<LeadReason, string> = {
  a11y: 'accessibility fix',
  brand: 'new brand',
  figma: 'from the Figma UI kit',
  docs: 'docs',
  rule: 'rule for every product',
};

export interface ExplorationOrigin {
  kind: 'exploration';
  /** The exploration's name: "Order fulfilment timeline". */
  name: string;
  /** The product's display name ("Acme Prints"), or null when Bridge does not know it. */
  product: string | null;
  /** The product key, when the exploration lives in the product's own repository. */
  productKey: string | null;
  /** The exploration's number in its repository: never shown, only used to link and to group. */
  number: number | null;
  /** Its page in Studio, or null when the exploration's product is not one of the team's products any more. */
  href: string | null;
  /** The piece the exploration asked for, when the block says it ("Avatar: xl size"). */
  piece: string | null;
  /** The component the piece changes, when the block says it. */
  component: string | null;
  /** The lead kept this piece in the exploration's screen only (not added to the library). */
  kept: boolean;
  /** The block says another exploration asks for the same component differently. */
  conflict: boolean;
}

export interface LeadOrigin {
  kind: 'lead';
  reason: LeadReason | null;
}

export type LibraryOrigin = ExplorationOrigin | LeadOrigin;

const REASON_WORDS: [RegExp, LeadReason][] = [
  [/^(a11y|accessibility|contrast)/i, 'a11y'],
  [/^brand|new brand/i, 'brand'],
  [/figma|ui kit/i, 'figma'],
  [/^(docs?|guidance|documentation)/i, 'docs'],
  [/^(rule|governance|tokens?|every product)/i, 'rule'],
];

const reasonOf = (v: unknown): LeadReason | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  for (const [re, r] of REASON_WORDS) if (re.test(v.trim())) return r;
  return null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Every Bridge block of a body (`<!-- bridge-<name> {json} -->`), parsed; a block that is not JSON is skipped. */
function bridgeBlocks(body: string): { mark: string; data: Record<string, unknown> }[] {
  const out: { mark: string; data: Record<string, unknown> }[] = [];
  const re = /<!--\s*(bridge-[a-z0-9-]+)\s+([\s\S]*?)\s*-->/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    try {
      const data: unknown = JSON.parse(m[2]!);
      if (data && typeof data === 'object' && !Array.isArray(data)) out.push({ mark: m[1]!, data: data as Record<string, unknown> });
    } catch {
      // Not a JSON block: nothing to read.
    }
  }
  return out;
}

/** The exploration's page, when its product is known (or it lives in the design system repository). */
function explorationHref(number: number | null, productKey: string | null, products: readonly ProductConfig[]): string | null {
  if (!number) return null;
  if (productKey && !products.some((p) => p.key === productKey)) return null;
  return studioHref(`changes/?exploration=${number}${productKey ? `&product=${encodeURIComponent(productKey)}` : ''}`);
}

const productName = (key: string | null, products: readonly ProductConfig[], fallback: string | null): string | null =>
  (key ? products.find((p) => p.key === key)?.name : null) ?? fallback ?? null;

/** One origin as the contract writes it, or null when it does not hold one. */
export function originOfBlock(o: unknown, products: readonly ProductConfig[] = []): LibraryOrigin | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const kind = str(x.kind)?.toLowerCase();
  if (kind === 'exploration') {
    const name = str(x.name) ?? str(x.title);
    if (!name) return null;
    const number = num(x.number) ?? num(x.pr);
    // A product key travels with the repository it lives in; a plain name is shown as it is.
    const key = str(x.productKey) ?? str(x.product);
    const productKey = key && (str(x.repo) || products.some((p) => p.key === key)) ? key : null;
    return {
      kind: 'exploration',
      name,
      product: productName(productKey, products, str(x.productName) ?? (productKey ? null : key)),
      productKey,
      number,
      href: explorationHref(number, productKey, products),
      piece: str(x.pieceTitle) ?? str(x.piece) ?? str(x.change),
      component: str(x.component),
      kept: /^(local|keep|kept|screen)/i.test(str(x.decision) ?? '') || x.kept === true,
      conflict: x.conflict === true,
    };
  }
  if (kind === 'lead' || kind === 'ds-lead' || kind === 'library') return { kind: 'lead', reason: reasonOf(x.reason) };
  return null;
}

/** The origin a change's body states: an `origin` in a Bridge block, else its "Needed by" block. Null: not stated. */
export function statedOrigin(body: string | null | undefined, products: readonly ProductConfig[] = []): LibraryOrigin | null {
  if (!body) return null;
  for (const b of bridgeBlocks(body)) {
    const found = originOfBlock(b.mark === 'bridge-origin' ? b.data : b.data.origin, products);
    if (found) return found;
  }
  return neededByOrigin(parseNeededBy(body) ?? null, products);
}

/** The exploration a "Needed by" block names. */
export function neededByOrigin(n: NeededBy | null, products: readonly ProductConfig[] = []): ExplorationOrigin | null {
  if (!n?.title?.trim()) return null;
  const productKey = n.repo ? n.product : null;
  return {
    kind: 'exploration',
    name: n.title.trim(),
    product: productName(n.product, products, n.productName || null),
    productKey,
    number: n.pr,
    href: explorationHref(n.pr, productKey, products),
    piece: n.pieceTitle || null,
    component: null,
    kept: false,
    conflict: false,
  };
}

export interface ChangeFacts {
  title: string;
  labels?: readonly (string | { name: string })[] | null;
  headRef?: string | null;
  /** A usage guidance change (docs only). */
  guidance?: boolean;
  /** The changed files, when read. */
  files?: readonly string[] | null;
  /** The change's body, when read: a Figma push says so in it. */
  body?: string | null;
}

const labelNames = (labels: ChangeFacts['labels']) => (labels ?? []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());

/** Why the DS lead made a change, from what Bridge already knows of it; null when nothing says. */
export function inferLeadReason(c: ChangeFacts): LeadReason | null {
  const labels = labelNames(c.labels);
  const ref = (c.headRef ?? '').toLowerCase();
  const title = c.title;
  const files = c.files ?? [];
  if (labels.includes('from-figma') || ref.startsWith('figma/') || Boolean(parseFigmaOrigin(c.body))) return 'figma';
  if (/\bbrand\b/i.test(title) || /(^|\/)brand[-/]/.test(ref) || files.some((f) => /\/brands\/[^/]+\.json$/.test(f) && !/default/.test(f))) return 'brand';
  if (/contrast|accessib|a11y|focus ring|screen reader|announce|keyboard|legib|readable/i.test(title) || /contrast|a11y/.test(ref)) return 'a11y';
  if (c.guidance || labels.includes('docs') || ref.startsWith('docs/') || /usage guidance|when to use|wrong choice|guideline/i.test(title)) return 'docs';
  if (labels.includes('tokens') || /deprecate|rename|token|spacing|space step|surface|colou?r|radius|corner/i.test(title)) return 'rule';
  return null;
}

/** Where a library change comes from: what its body states, else the DS lead with the reason Bridge can tell. */
export function libraryOrigin(c: ChangeFacts, products: readonly ProductConfig[] = []): LibraryOrigin {
  return (
    statedOrigin(c.body, products) ?? {
      kind: 'lead',
      reason: inferLeadReason(c),
    }
  );
}

/** "Needed by Order fulfilment timeline · Acme Prints", "From the DS lead · new brand", "From the DS lead". */
export function originLine(o: LibraryOrigin): string {
  if (o.kind === 'exploration') return `Needed by ${o.name}${o.product ? ` · ${o.product}` : ''}`;
  return o.reason ? `From the DS lead · ${LEAD_REASON_LABEL[o.reason]}` : 'From the DS lead';
}

// ---------------------------------------------------------------------------------------------------------------
// The filter: All / From explorations / From the DS lead

export type OriginFilter = 'all' | 'explorations' | 'lead';

export const ORIGIN_FILTER_LABEL: Record<OriginFilter, string> = {
  all: 'All',
  explorations: 'From explorations',
  lead: 'From the DS lead',
};

export function originFilterParam(search: string): OriginFilter {
  const v = new URLSearchParams(search).get('origin');
  return v === 'explorations' || v === 'lead' ? v : 'all';
}

/** The address with the filter ("All" leaves it out). */
export function withOriginFilter(search: string, f: OriginFilter): string {
  const q = new URLSearchParams(search);
  if (f === 'all') q.delete('origin');
  else q.set('origin', f);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const passesOrigin = (o: LibraryOrigin, f: OriginFilter) => f === 'all' || (f === 'explorations' ? o.kind === 'exploration' : o.kind === 'lead');

export function originCounts(origins: readonly LibraryOrigin[]): Record<OriginFilter, number> {
  const explorations = origins.filter((o) => o.kind === 'exploration').length;
  return {
    all: origins.length,
    explorations,
    lead: origins.length - explorations,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Status tags: the same words as the exploration's "What this changes in the library"

export type LibraryTagState = 'needs' | 'approved' | 'building' | 'kept';

export interface LibraryTag {
  state: LibraryTagState;
  label: string;
  tone: 'warning' | 'success' | 'info' | 'neutral';
}

/** Review kinds (core ReviewStatusKind) that wait on the design side: the lead decides. */
const NEEDS_KINDS = new Set(['needs-design', 'needs-approval']);
/** Design said yes, the code side finishes it. */
const APPROVED_KINDS = new Set(['needs-tech', 'ready']);
/** A developer works on it. */
const BUILDING_KINDS = new Set(['draft', 'ci-failing', 'ci-running', 'conflict', 'changes-requested']);

/**
 * The tag of one library change: "Needs Dana" (or "Needs you" for the lead), "Approved", "Being built", "Kept in
 * this screen". Null when the change is in none of these (merged, still being checked): its own status stays.
 */
export function libraryTag(x: { kind?: string | null; draft?: boolean; kept?: boolean }, lead: { you: boolean; name: string | null }): LibraryTag | null {
  if (x.kept) return { state: 'kept', label: 'Kept in this screen', tone: 'neutral' };
  if (x.draft) return { state: 'building', label: 'Being built', tone: 'info' };
  const k = x.kind ?? '';
  if (NEEDS_KINDS.has(k))
    return {
      state: 'needs',
      label: lead.you ? 'Needs you' : lead.name ? `Needs ${lead.name}` : 'Needs the DS lead',
      tone: 'warning',
    };
  if (APPROVED_KINDS.has(k)) return { state: 'approved', label: 'Approved', tone: 'success' };
  if (BUILDING_KINDS.has(k)) return { state: 'building', label: 'Being built', tone: 'info' };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The component a change touches, and the lead's groups

/** The component a change touches, from its origin, its Figma push or its title ("Button: new size" → Button). */
export function componentOf(x: { title: string; origin?: LibraryOrigin | null; figmaComponent?: string | null }): string | null {
  if (x.figmaComponent?.trim()) return x.figmaComponent.trim();
  if (x.origin?.kind === 'exploration' && x.origin.component) return x.origin.component;
  const from = (t: string | null | undefined): string | null => {
    if (!t) return null;
    const s = t.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim();
    const created = /^[Nn]ew component:?\s+([A-Z][A-Za-z0-9]*)\b/.exec(s) ?? /^[Nn]ew\s+([A-Z][A-Za-z0-9]*)\s+component\b/.exec(s);
    if (created) return created[1]!;
    const named = /^([A-Z][A-Za-z0-9]*(?: [A-Z][A-Za-z0-9]*)?):\s+\S/.exec(s);
    return named ? named[1]! : null;
  };
  return from(x.origin?.kind === 'exploration' ? x.origin.piece : null) ?? from(x.title);
}

/** What the change does to its component ("Button: new size Large" → "new size large"), to tell same from different. */
export function changeOf(title: string, component: string | null): string {
  const s = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').trim();
  const rest = component && s.toLowerCase().startsWith(`${component.toLowerCase()}:`) ? s.slice(component.length + 1) : s;
  return rest
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface LibraryItem<R = unknown> {
  /** Stable key of the change. */
  key: string;
  title: string;
  origin: LibraryOrigin;
  component: string | null;
  tag: LibraryTag | null;
  row: R;
}

export interface LibraryGroup<R = unknown> {
  key: string;
  /** The component ("Card"), the exploration's name, or the change itself when it touches no one component. */
  label: string;
  items: LibraryItem<R>[];
  /** "asked by 2 explorations, two different ways". */
  summary: string;
  /** Two explorations ask for the same component in different ways: the lead picks. */
  conflict: boolean;
  /** An exploration asks for what the lead already made: one build for both. */
  buildOnce: LibraryItem<R> | null;
  /** Something in it waits on the lead. */
  needsLead: boolean;
  /** Open by default: a decision across several changes waits on the lead (progressive disclosure). */
  open: boolean;
  /** The exploration a group action opens (Compare and pick, Approve, build once), or the group's exploration. */
  href: string | null;
  /** The one tag the header shows when the group is a single change, or every change shares it. */
  tag: LibraryTag | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const explorationKey = (o: ExplorationOrigin) => (o.number ? `${o.productKey ?? ''}#${o.number}` : `name:${o.name.toLowerCase()}`);

function sharedTag<R>(items: LibraryItem<R>[]): LibraryTag | null {
  const first = items[0]?.tag ?? null;
  return first && items.every((i) => i.tag?.label === first.label) ? first : null;
}

/** Words of the DS lead's own changes: "you" for the lead, else "the DS lead". */
const leadWords = (you: boolean) => (you ? 'you' : 'the DS lead');

/**
 * The lead's view by component (board LI7): one group per component, conflicts first, then what waits on the lead,
 * then the rest; the lead's own changes that wait on nobody fold into one group at the end.
 */
export function groupByComponent<R>(items: readonly LibraryItem<R>[], o: { you: boolean }): LibraryGroup<R>[] {
  const byKey = new Map<string, LibraryItem<R>[]>();
  for (const i of items) {
    const k = i.component ? `c:${i.component.toLowerCase()}` : `x:${i.key}`;
    byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  const groups: LibraryGroup<R>[] = [];
  const quietLead: LibraryItem<R>[] = [];
  for (const [key, list] of byKey) {
    const fromExplorations = list.filter((i): i is LibraryItem<R> & { origin: ExplorationOrigin } => i.origin.kind === 'exploration');
    const fromLead = list.filter((i) => i.origin.kind === 'lead');
    const needsLead = list.some((i) => i.tag?.state === 'needs');
    if (!fromExplorations.length && !needsLead) {
      quietLead.push(...list);
      continue;
    }
    const explorations = new Set(fromExplorations.map((i) => explorationKey(i.origin)));
    // A conflict: explorations still waiting on the lead ask for the same component in different ways (one already
    // approved is the library's way now), or the block says so.
    const pending = fromExplorations.filter((i) => i.tag?.state === 'needs');
    const conflict =
      fromExplorations.some((i) => i.origin.conflict) ||
      (new Set(pending.map((i) => explorationKey(i.origin))).size > 1 && new Set(pending.map((i) => changeOf(i.title, i.component))).size > 1);
    const leadChanges = new Set(fromLead.map((i) => changeOf(i.title, i.component)));
    const buildOnce = conflict ? null : fromExplorations.find((i) => i.tag?.state === 'needs' && leadChanges.has(changeOf(i.title, i.component))) ?? null;
    const parts: string[] = [];
    if (explorations.size > 1) parts.push(`asked by ${plural(explorations.size, 'exploration')}${conflict ? ', two different ways' : ''}`);
    else if (fromExplorations[0]) parts.push(`asked by ${fromExplorations[0].origin.name}`);
    if (fromLead.length) parts.push(`${plural(fromLead.length, 'change')} from ${leadWords(o.you)}`);
    const single = list.length === 1 ? list[0]! : null;
    const summary =
      single && !fromExplorations.length
        ? `from ${leadWords(o.you)}${single.origin.kind === 'lead' && single.origin.reason ? ` · ${LEAD_REASON_LABEL[single.origin.reason]}` : ''}`
        : parts.join(' and ');
    const target = conflict ? fromExplorations[0] : buildOnce ?? fromExplorations[0];
    groups.push({
      key,
      label: list[0]!.component ?? list[0]!.title,
      items: list,
      summary,
      conflict,
      buildOnce,
      needsLead: needsLead || conflict,
      open: conflict || Boolean(buildOnce) || (needsLead && list.length > 1),
      href: target?.origin.href ?? null,
      tag: conflict ? null : sharedTag(list),
    });
  }
  const rank = (g: LibraryGroup<R>) => (g.conflict ? 0 : g.buildOnce ? 1 : g.needsLead ? 2 : 3);
  groups.sort((a, b) => rank(a) - rank(b));
  if (quietLead.length) {
    const reasons = [...new Set(quietLead.flatMap((i) => (i.origin.kind === 'lead' && i.origin.reason ? [LEAD_REASON_LABEL[i.origin.reason]] : [])))];
    groups.push({
      key: 'lead-own',
      label: o.you ? 'Your own changes' : "The DS lead's own changes",
      items: quietLead,
      summary: [plural(quietLead.length, 'change'), reasons.join(', ')].filter(Boolean).join(' · '),
      conflict: false,
      buildOnce: null,
      needsLead: false,
      open: false,
      href: null,
      tag: sharedTag(quietLead),
    });
  }
  return groups;
}

/**
 * The lead's view by exploration: one group per exploration that asked for library changes, then the DS lead's own.
 * A group whose changes wait on the lead comes first.
 */
export function groupByExploration<R>(items: readonly LibraryItem<R>[], o: { you: boolean }): LibraryGroup<R>[] {
  const byKey = new Map<string, LibraryItem<R>[]>();
  const lead: LibraryItem<R>[] = [];
  for (const i of items) {
    if (i.origin.kind !== 'exploration') {
      lead.push(i);
      continue;
    }
    const k = explorationKey(i.origin);
    byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  const groups: LibraryGroup<R>[] = [...byKey].map(([key, list]) => {
    const origin = list[0]!.origin as ExplorationOrigin;
    const needsLead = list.some((i) => i.tag?.state === 'needs');
    return {
      key: `e:${key}`,
      label: origin.name,
      items: list,
      summary: [origin.product, plural(list.length, 'library change')].filter(Boolean).join(' · '),
      conflict: false,
      buildOnce: null,
      needsLead,
      open: needsLead && list.length > 1,
      href: origin.href,
      tag: sharedTag(list),
    };
  });
  groups.sort((a, b) => Number(b.needsLead) - Number(a.needsLead));
  if (lead.length) {
    const needsLead = lead.some((i) => i.tag?.state === 'needs');
    groups.push({
      key: 'lead',
      label: o.you ? 'From you' : 'From the DS lead',
      items: lead,
      summary: plural(lead.length, 'change'),
      conflict: false,
      buildOnce: null,
      needsLead,
      open: false,
      href: null,
      tag: sharedTag(lead),
    });
  }
  return groups;
}

export type LeadGrouping = 'component' | 'exploration';

export function leadGroupingParam(search: string): LeadGrouping {
  return new URLSearchParams(search).get('group') === 'exploration' ? 'exploration' : 'component';
}

export function withLeadGrouping(search: string, g: LeadGrouping): string {
  const q = new URLSearchParams(search);
  if (g === 'component') q.delete('group');
  else q.set('group', g);
  const s = q.toString();
  return s ? `?${s}` : '';
}
