// Where each item of Being built comes from (owner rule 2026-11-12): build work only comes from
//   (a) an exploration the design lead sent to developers ("From Order fulfilment timeline"), or
//   (b) a library change the lead approved in Library review ("Library change Dana approved").
// Designers, developers and PMs never create build requests directly, so a card never says "Asked by Leo". Every row
// of Being built carries its origin; a row with no valid origin is not listed, and every count that reads the page's
// rows (the page, the Studio home line, a developer's "build requests wait") follows (scripts/building-data).
//
// Where an origin is read, most precise first:
//   - an exploration handed to developers is its own origin: Explorations decides it is there (lib/exploration-state),
//     so Being built and Explorations always list the same explorations. Who sent it: the lead's Looks right.
//   - a request or library branch states it: an `origin` in a Bridge block (core RequestOrigin: an exploration or a
//     product's adoption report the lead sent; or `{"kind": "lead", "approvedBy": "Dana"}`, the lead's approval in
//     Library review), or a `bridge-origin` block, or the "Needed by" block of the branch opened for an exploration.
//     The issue's own body first, then the body of the pull request that does the work.
//   - a push from Figma (and Claude's fix from Figma): the design is approved in Figma, the lead's library.
// Pure: no DOM, no fetch. Unit tested in build-origin.test.ts.
import { isFigmaPush, type BuildRequestView, type ProductConfig } from '@bridge-ds/core';
import { auditOriginLine, bridgeBlocks, statedOrigin } from './library-origin';

export type BuildOrigin =
  /** The row is the exploration itself, handed to developers; `sentBy`: the lead whose Looks right sent it. */
  | { kind: 'exploration'; self: true; name: string; sentBy: string | null }
  /** A library piece an exploration needs. */
  | { kind: 'exploration'; self: false; name: string; product: string | null; href: string | null }
  /** A library change the lead approved: in Library review (`approvedBy`), or in Figma. */
  | { kind: 'library'; via: 'review' | 'figma'; approvedBy: string | null }
  /** A group of a product's adoption report the lead sent to developers. */
  | { kind: 'audit'; product: string | null; href: string | null };

/** What a row may carry: core's view, plus the marks of an exploration row or a fix row. */
export type OriginRow = Pick<BuildRequestView, 'kind' | 'number' | 'pull'> & {
  exploration?: { sentBy?: string | null } | null;
  fix?: unknown;
};

interface Labelled {
  number: number | string;
  body?: string | null;
  labels?: readonly ({ name?: string } | string)[] | null;
  /** Set on a product repository's pull request: its numbers are not the design system's. */
  product?: string | null;
}

export interface OriginContext {
  /** The issues read (their bodies and labels). */
  issues?: readonly Labelled[];
  /** The design system's pull requests read. */
  pulls?: readonly Labelled[];
  products?: readonly ProductConfig[];
}

const firstName = (n: string | null | undefined) => (n?.trim() ? n.trim().split(/\s+/)[0]! : null);

/** The lead's approval in a body: `{"kind": "lead", "approvedBy": "Dana"}` in a `bridge-origin` block or an `origin`. */
function leadApproval(body: string | null | undefined): { approvedBy: string | null } | null {
  if (!body) return null;
  for (const b of bridgeBlocks(body)) {
    const o = (b.mark === 'bridge-origin' ? b.data : b.data.origin) as Record<string, unknown> | undefined;
    if (!o || typeof o !== 'object') continue;
    const kind = typeof o.kind === 'string' ? o.kind.toLowerCase() : '';
    if (kind === 'lead' || kind === 'ds-lead' || kind === 'library') return { approvedBy: firstName(typeof o.approvedBy === 'string' ? o.approvedBy : null) };
  }
  return null;
}

/** The origin one body states, or null. */
function originInBody(x: Labelled | undefined, products: readonly ProductConfig[]): BuildOrigin | null {
  if (!x) return null;
  const lead = leadApproval(x.body);
  if (lead) return { kind: 'library', via: 'review', approvedBy: lead.approvedBy };
  const o = statedOrigin(x.body, products);
  if (o?.kind === 'exploration') return { kind: 'exploration', self: false, name: o.name, product: o.product, href: o.href };
  if (o?.kind === 'audit') return { kind: 'audit', product: o.product, href: o.href };
  if (o?.kind === 'lead') return { kind: 'library', via: 'review', approvedBy: null };
  if (isFigmaPush({ labels: x.labels ?? [], body: x.body ?? '' })) return { kind: 'library', via: 'figma', approvedBy: null };
  return null;
}

/**
 * Where one row of Being built comes from, or null when nothing says it comes from the lead: such a row is not listed.
 * An exploration row is its own origin; Claude's fix from Figma is approved in Figma; a request (or a library branch
 * from Figma) reads its body, then the body of the pull request that does the work.
 */
export function buildOriginOf(row: OriginRow, ctx: OriginContext = {}): BuildOrigin | null {
  const products = ctx.products ?? [];
  if (row.exploration) return { kind: 'exploration', self: true, name: '', sentBy: firstName(row.exploration.sentBy) };
  if (row.fix) return { kind: 'library', via: 'figma', approvedBy: null };
  const own = (ctx.pulls ?? []).filter((p) => !p.product);
  const self = row.kind === 'issue' ? ctx.issues?.find((i) => Number(i.number) === row.number) : own.find((p) => Number(p.number) === row.number);
  const work = row.pull ? own.find((p) => Number(p.number) === row.pull!.number) : undefined;
  return originInBody(self, products) ?? (work && work !== self ? originInBody(work, products) : null);
}

/**
 * The words of an origin on a card, where "Asked by Leo" used to be: "Exploration Dana sent", "From Order fulfilment
 * timeline", "Library change Dana approved", "Library change approved in Figma", "From the Acme CRM adoption report".
 */
export function buildOriginLine(o: BuildOrigin): string {
  if (o.kind === 'exploration') return o.self ? (o.sentBy ? `Exploration ${o.sentBy} sent` : 'Exploration sent to developers') : `From ${o.name}`;
  if (o.kind === 'audit') return auditOriginLine(o);
  if (o.via === 'figma') return 'Library change approved in Figma';
  return o.approvedBy ? `Library change ${o.approvedBy} approved` : 'Library change the lead approved';
}

/**
 * The short words of an origin, for a card's person line where room is tight (Grid, Board): "Dana approved",
 * "Dana sent it", "Approved in Figma". The list row keeps buildOriginLine.
 */
export function buildOriginShort(o: BuildOrigin): string {
  if (o.kind === 'exploration') return o.self ? (o.sentBy ? `${o.sentBy} sent it` : 'Sent to developers') : `From ${o.name}`;
  if (o.kind === 'audit') return auditOriginLine(o);
  if (o.via === 'figma') return 'Approved in Figma';
  return o.approvedBy ? `${o.approvedBy} approved` : 'The lead approved';
}

/**
 * The rows Being built may list, each with its origin; a row with none is left out (the rule above). Applied once where
 * the rows are read (scripts/building-data), so the page, the home line and every count read the same rows.
 */
export function withBuildOrigins<R extends OriginRow>(rows: readonly R[], ctx: OriginContext = {}): (R & { origin: BuildOrigin })[] {
  return rows.flatMap((r) => {
    const origin = buildOriginOf(r, ctx);
    return origin ? [{ ...r, origin }] : [];
  });
}

/** The origin a row carries (withBuildOrigins), or null. */
export const originOfRow = (v: object): BuildOrigin | null => (v as { origin?: BuildOrigin | null }).origin ?? null;
