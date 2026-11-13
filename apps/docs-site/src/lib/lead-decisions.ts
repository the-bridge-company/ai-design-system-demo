// What the exploration page says about the talk between a designer and their design lead (boards L1 to L5): the
// Decisions list, and who the next word is for. Pure: no DOM, no fetch. The record itself is core's (explorations.ts
// decisionsOf, openDecisionOf). Bridge voice: a designer reads it.
import { stepTag } from './status-ladder';
import { isNameAuthor, nameOfAuthor } from './author';
import { waitingLabel } from './home-model';
import { decisionsOf, homeRowLine, isPmKind, isWaitingForLead, leadTurnOf, openDecisionOf, parseExplorationBody, type Decision, type DecisionKind, type HatAsk } from '@bridge-ds/core';

export interface DecisionRowView {
  key: string;
  /** Who said it, as the page names them. */
  name: string;
  /** Their face's login (lib/people), when known. */
  login: string;
  /** "asked for changes". */
  verb: string;
  why: string | null;
  round: number;
  /** ISO date. */
  at: string;
}

const VERB: Record<DecisionKind, string> = {
  'looks-right': 'said it looks right',
  changes: 'asked for changes',
  question: 'asked a question',
  answer: 'answered',
  'not-doing': 'decided not to do this',
  'take-back': 'took it back from the developers',
  'asked-someone': 'asked someone else to review',
  handed: 'handed it over',
  archived: 'archived it',
  'pm-ok': 'said it looks good',
  'pm-changes': 'asked for changes',
  'pm-call': 'agreed in a call',
};

/** The name of who said it: their display name, the page's name for their login, the login last. */
export function sayerName(d: Pick<Decision, 'by' | 'byName'>, names: Record<string, string> = {}): string {
  if (d.byName) return d.byName;
  if (d.by) return isNameAuthor(d.by) ? nameOfAuthor(d.by) : (names[d.by] ?? d.by);
  return 'Someone';
}

/** The list on the page, newest first. */
export function decisionRows(all: readonly Decision[], names: Record<string, string> = {}): DecisionRowView[] {
  return all
    .map((d, i) => {
      const to = d.to?.length ? ` to ${d.to.map((t) => names[t] ?? t).join(', ')}` : '';
      // The designer's word for the PM's call: "Dana said Dino agreed in a call".
      if (d.kind === 'pm-call') return { key: `${i}`, name: sayerName(d, names), login: d.by ?? `name:${d.byName ?? 'Someone'}`, verb: `said ${d.to?.[0] ?? 'the PM'} agreed in a call`, why: null, round: d.round, at: d.at };
      const verb = d.kind === 'asked-someone' ? `asked ${[...(d.to ?? []).map((t) => names[t] ?? t), ...(d.toNames ?? [])].join(', ') || 'someone else'} to review` : `${VERB[d.kind]}${d.kind === 'handed' ? to : ''}`;
      return { key: `${i}`, name: sayerName(d, names), login: d.by ?? `name:${d.byName ?? 'Someone'}`, verb, why: d.text ?? null, round: d.round, at: d.at };
    })
    .reverse();
}

/**
 * The tag of the page while the talk decides what it is, over the lifecycle's own: a step of the one status ladder
 * (lib/status-ladder). A question keeps it In review (who must answer is the talk's line, never the tag); changes
 * asked send it back to Exploring; not doing it stops it. `designer` names who answers, for the talk's own line.
 */
export function decisionTag(open: Pick<Decision, 'kind'> | null, _designer: string): { label: string; tone: 'danger' | 'neutral' | 'warning' | 'info' | 'success' } | null {
  if (!open) return null;
  if (open.kind === 'not-doing') return stepTag('not-doing');
  if (open.kind === 'question') return stepTag('in-review');
  return open.kind === 'changes' || open.kind === 'take-back' ? stepTag('exploring') : null;
}

/** The words of a lead's last open word, for the zone's title. */
export function designerZoneTitle(kind: DecisionKind, who: string): string {
  if (kind === 'question') return `${who} has a question`;
  if (kind === 'take-back') return `${who} took it back`;
  if (kind === 'not-doing') return `${who} decided not to do this`;
  return `${who} asks for changes`;
}

/** The line a lead reads while a question waits on the designer: "You asked" when it is theirs. */
export function leadWaitLine(open: Pick<Decision, 'by' | 'byName'>, viewer: string, designer: string, names: Record<string, string> = {}): string {
  const mine = Boolean(open.by && open.by.toLowerCase() === viewer.toLowerCase());
  return `${mine ? 'You' : sayerName(open, names)} asked ${designer}. Waiting for their answer.`;
}

/** The next name free for a reopened exploration: "Late tag 2", then 3. */
export function nextName(name: string): string {
  const m = /^(.*\S)\s+(\d+)$/.exec(name.trim());
  return m ? `${m[1]} ${Number(m[2]) + 1}` : `${name.trim()} 2`;
}

/** A row of the lead's Home: Needs you, or the quiet Waiting on others. */
export interface LeadHomeRow {
  where: 'needs' | 'waiting';
  line: string;
  since: string | null;
  /** The verb on a Needs you row. */
  action: string;
  /** Who it is about: their login, or their display name when they have none. */
  person: { login: string | null; name: string };
  /** The hats it asks of the viewer, when the team's two reviews are known: one row names both. */
  hats?: HatAsk[];
}

/**
 * Where an exploration goes on someone's Home (board L6). A row in Needs you only when the next word is theirs: the
 * lead asked (by name, once someone else was asked), or the designer with the lead's words on their side. The lead who
 * spoke sees it, quietly, in Waiting on others, until the answer moves it up. Everyone else: nothing.
 */
/** How long "I'll look" keeps an exploration off the other reviewers' Home: the reminder's 2 days (api/_lib/notify.ts). */
/**
 * Since when the current turn of an exploration waits (ISO), the one clock of "Waiting 4 days" on Home and of the
 * Explorations list's "Sofia sent it for review · 4 days ago": the lead's turn counts from the last word of the talk
 * (an answer, an ask to look), else from Done exploring (when it was sent for review); the designer's turn from the
 * lead's open question or changes. Never from when the exploration started or last moved. Null when it waits on
 * nobody or the record does not say.
 */
export function turnSince(body: string | null | undefined): string | null {
  const e = parseExplorationBody(body);
  if (!e) return null;
  const turn = leadTurnOf(body);
  if (turn === 'lead' && isWaitingForLead(body)) {
    // A Looks right never starts a wait: what still waits after the design review's yes (the library decision) waits
    // since it was asked, so a hand-over inside the same item never reads "New today".
    const all = decisionsOf(e).filter((d) => !isPmKind(d.kind) && d.kind !== 'looks-right');
    return all[all.length - 1]?.at ?? e.library?.askedAt ?? e.designAskedAt ?? null;
  }
  if (turn === 'designer') return openDecisionOf(body)?.at ?? null;
  return null;
}

/**
 * The moment a listed exploration's age counts from: on a row that waits on the viewer, since its turn began
 * (turnSince, the same clock as Home's "Waiting 4 days"); otherwise when it last moved.
 */
export function rowAgeFrom(x: { body?: string | null; updated: string; yourTurn: boolean }): string {
  return (x.yourTurn ? turnSince(x.body) : null) ?? x.updated;
}

/**
 * The time on a listed exploration's line. A row that waits on the viewer (its turn on Explorations, or a review it
 * asks of them, a library decision included) says since when, with Home's own tag: "Waiting 5 days" (turnSince, never
 * the last change). Any other row says when it last changed ("yesterday", `ago`).
 */
export function rowTime(x: { body?: string | null; updated: string; waitsOnViewer: boolean; now: number }, ago: (iso: string) => string): string {
  return x.waitsOnViewer ? waitingLabel(rowAgeFrom({ body: x.body, updated: x.updated, yourTurn: true }), x.now) : ago(x.updated);
}

export const TAKEN_FOR_MS = 2 * 24 * 60 * 60 * 1000;

export function leadHomeRow(
  body: string | null | undefined,
  v: {
    viewer: string | null;
    lead: boolean;
    own: boolean;
    names?: Record<string, string>;
    viewerName?: string | null;
    now?: number;
    /**
     * Two reviews (lib/team-reviews viewerHats), once the team's reviews are read: the hats this exploration asks of the
     * viewer. They decide the row instead of `lead`: none, no row; the row names them ("Sofia's screen: your design
     * review and a library decision"). Left out: the old single review.
     */
    hats?: readonly HatAsk[] | null;
  },
): LeadHomeRow | null {
  const e = parseExplorationBody(body);
  if (!e) return null;
  const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  const turn = leadTurnOf(body);
  const all = decisionsOf(e).filter((d) => !isPmKind(d.kind));
  const last = all[all.length - 1];
  const designer = { login: e.designAskedBy ?? e.author ?? null, name: e.designAskedByName ?? e.memberName ?? e.designAskedBy ?? e.author ?? 'The designer' };
  const shown = v.names?.[designer.login ?? ''] ?? designer.name;
  if (turn === 'lead' && isWaitingForLead(body)) {
    if (v.own) return null;
    if (v.hats) {
      // The hats already say who was asked and who took the design review.
      if (!v.hats.length) return null;
      const line = last?.kind === 'answer' || last?.kind === 'asked-someone' ? null : homeRowLine(shown, v.hats);
      if (line) return { where: 'needs', line, since: turnSince(body), action: 'Review', person: designer, hats: [...v.hats] };
    } else if (!v.lead) return null;
    // Who was asked by name are GitHub logins: a lead signed in by email has none, and answers all the same.
    if (!v.hats && v.viewer && e.designAskedTo?.length && !e.designAskedTo.some((l) => same(l, v.viewer))) return null;
    // "I'll look": another reviewer took it, it leaves this one's Home; 2 days later with no decision, it comes back.
    const takenFresh = Boolean(e.designTakenAt && (v.now ?? Date.now()) - Date.parse(e.designTakenAt) < TAKEN_FOR_MS);
    if (!v.hats && takenFresh && !(same(e.designTakenBy, v.viewer) || (!e.designTakenBy && same(e.designTakenByName, v.viewerName)))) return null;
    const answered = last?.kind === 'answer';
    const before = answered ? [...all].reverse().find((d) => d.kind === 'question' || d.kind === 'changes' || d.kind === 'take-back') : null;
    const line = answered ? `${shown} answered your ${before?.kind === 'question' ? 'question' : 'changes'}` : last?.kind === 'asked-someone' ? `${sayerName(last, v.names)} asks you to look` : `${shown} is done exploring`;
    return { where: 'needs', line, since: turnSince(body), action: 'Review', person: designer, ...(v.hats ? { hats: [...v.hats] } : {}) };
  }
  if (turn === 'designer') {
    const open = openDecisionOf(body)!;
    if (v.own) return { where: 'needs', line: `${sayerName(open, v.names)} ${open.kind === 'question' ? 'has a question' : open.kind === 'take-back' ? 'took it back' : 'asked for changes'}`, since: open.at, action: 'Answer', person: { login: open.by ?? null, name: sayerName(open, v.names) } };
    if (same(open.by, v.viewer)) return { where: 'waiting', line: `waiting for ${shown}`, since: open.at, action: '', person: designer };
  }
  return null;
}
