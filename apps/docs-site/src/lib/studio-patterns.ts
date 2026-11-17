// Studio > Patterns: the patterns of a design system (patterns/<id>.pattern.json, grouped by kind as the Library groups
// them, lib/library/patterns.ts) as Studio rows, and the open behavior requests that concern each one. Pure: the
// groups, the Library addresses and the issues come in as arguments (pages/studio/patterns.astro builds Bridge's own,
// components/ds/studio/StudioPatterns.tsx a team's in the browser). Unit tested in studio-patterns.test.ts.
//
// A behavior request concerns a pattern when its Bridge block asks about it (behavior.of 'pattern', its id), or when
// it asks about one component's behavior whose id is an interaction pattern (behavior.of 'component', behavior = the
// pattern id: "Select: close on Escape" concerns Close on Escape). Only the ones that wait for the lead's decision
// (open, `request: behavior` without `bridge-build`, nobody on them): one made the default is on Being built.
import { behaviorAskOf, isNewPatternAsk, type PatternKind, isUndecidedBehaviorRequest, parseRequestIssue, requesterOf, requestIssueTitle, type BehaviorAsk } from '@bridge-ds/core';
import { patternComponents, patternKindGroups, type PatternGroup } from './library/patterns';
import type { BehaviorIssue } from './home-model';

/**
 * Studio's Patterns page opened to suggest one (the Library's "Suggest an action" beside an empty kind): ?suggest=<kind>
 * opens the Suggest a pattern drawer on that kind, ?suggest=pattern on the choice of kind.
 */
export const SUGGEST_QUERY = 'suggest';
export const suggestPatternRoute = (kind: PatternKind | null): string => `patterns/?${SUGGEST_QUERY}=${kind ?? 'pattern'}`;

/** What the address asks: a kind, `null` for any kind, `undefined` when it asks nothing. */
export function suggestAsked(search: string): PatternKind | null | undefined {
  const v = new URLSearchParams(search).get(SUGGEST_QUERY);
  if (v === null) return undefined;
  return v === 'interaction' || v === 'action' ? v : null;
}

export interface StudioPatternRow {
  id: string;
  name: string;
  purpose: string;
  /** The components it uses (an action names them, an interaction is the components that do it). */
  components: string[];
  /** Its page in the Library. */
  href: string;
  /** An action's rules, in its file's order (what "Suggest a change to this pattern" picks from). */
  rules?: string[];
  /** An interaction's components with their own words for it (what "Suggest a change to this behavior" picks from). */
  uses?: { component: string; text: string }[];
}

export interface StudioPatternGroup {
  kind: PatternGroup['kind'];
  /** The quiet label of the group, as in the Library ("Interactions", "Actions"). */
  label: string;
  rows: StudioPatternRow[];
}

/** An open behavior request on a pattern: its issue number and its title, to link to its page. */
export interface PatternRequest {
  number: number;
  title: string;
  /** What it asks (the row drawer shows it to the lead, with the decision). */
  ask?: BehaviorAsk;
  /** Who asked, as the request names them ("Sofia", "@leo"). */
  asker?: string;
  /** Their GitHub login when the request has one (the decline reason notifies them). */
  requester?: string;
}

/**
 * The Library groups as Studio rows, in the Library's order; `href` gives each pattern's Library page. Both kinds, always:
 * a kind the design system lacks keeps its group with no row (the table says how one comes to exist).
 */
export function studioPatternGroups(groups: readonly PatternGroup[], href: (id: string) => string): StudioPatternGroup[] {
  return patternKindGroups(groups).map((g) => ({
    kind: g.kind,
    label: g.label,
    rows: g.items.map((e) => ({
      id: e.pattern.id,
      name: e.pattern.name,
      purpose: e.pattern.purpose,
      components: patternComponents(e),
      href: href(e.pattern.id),
      ...(e.kind === 'action' ? { rules: e.pattern.rules } : { uses: e.components.map((c) => ({ component: c.component, text: c.text })) }),
    })),
  }));
}

/**
 * The components every row of a group uses, when they all use the same ones (in any order): the group row says them
 * once and its rows leave the cell empty. Null for a group of one row (it keeps its own value) or rows that differ.
 */
export function sharedComponents(group: Pick<StudioPatternGroup, 'rows'>): string[] | null {
  const [first, ...rest] = group.rows;
  if (!first || !rest.length || !first.components.length) return null;
  const key = (c: readonly string[]) => [...c].sort().join('\n');
  const k = key(first.components);
  return rest.every((r) => key(r.components) === k) ? first.components : null;
}

/**
 * The open behavior requests that wait for a decision, per pattern id (oldest first). Requests about anything else
 * (a component behavior no pattern names, a pattern this design system does not have) are left out.
 */
export function patternRequests(issues: readonly BehaviorIssue[], groups: readonly StudioPatternGroup[]): Map<string, PatternRequest[]> {
  const ids = new Map<string, StudioPatternGroup['kind']>(groups.flatMap((g) => g.rows.map((r) => [r.id, g.kind] as const)));
  const out = new Map<string, PatternRequest[]>();
  const sorted = [...issues].sort((a, b) => a.number - b.number);
  for (const i of sorted) {
    // As Home's Decide rows (home-model behaviorNeeds): someone on it (Ask) means it waits on them, not on the lead.
    if (i.pull_request || !isUndecidedBehaviorRequest(i.labels) || (i.assignees ?? []).length) continue;
    const r = parseRequestIssue(i.body);
    const ask = behaviorAskOf(r);
    if (!r || !ask) continue;
    const id = ask.of === 'pattern' ? ask.id : ask.behavior;
    // A component behavior concerns a pattern only when that pattern is an interaction (the behavior id names it).
    if (!id || !ids.has(id) || (ask.of === 'component' && ids.get(id) !== 'interaction')) continue;
    (out.get(id) ?? out.set(id, []).get(id)!).push({ number: i.number, title: requestIssueTitle(r), ask, ...whoAsked(i, r.requestedBy) });
  }
  return out;
}

/** Who asked a request: the name Bridge's server wrote, else the GitHub login. */
function whoAsked(i: BehaviorIssue, requestedBy: string | undefined): { asker: string; requester?: string } {
  const login = requestedBy ?? i.user?.login ?? '';
  const named = requesterOf(i.body)?.name;
  return { asker: named ?? (login ? `@${login.replace(/^@/, '')}` : 'Someone'), ...(login ? { requester: login } : {}) };
}

/** A proposal that is not a pattern yet, for the lead's one "Asked, not patterns yet" line. */
export interface AskedProposal {
  number: number;
  /** "Archive" (a new action), "Type to jump on Menu" (a behavior asked of a component that does not do it yet). */
  name: string;
}

/** "type-to-jump" as words, when no component names the behavior: "Type to jump". */
const idWords = (id: string) => id.replace(/[-_]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());

/**
 * The undecided behavior requests that propose something that is not a pattern yet (oldest first): a new action
 * (a pattern ask with places, its id not a row), or a behavior asked of a component that does not do it yet (a
 * component ask with a behavior id and no sentence for today) whose id is no interaction row. A request on a row is
 * that row's (patternRequests). `behaviorNames`: behavior id -> its words in a component's docs.json, else the id in
 * words. Never a row, never in the Library: a pattern exists once its file is merged.
 */
export function askedNotPatterns(issues: readonly BehaviorIssue[], groups: readonly StudioPatternGroup[], behaviorNames: ReadonlyMap<string, string> = new Map()): AskedProposal[] {
  const ids = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)));
  const out: AskedProposal[] = [];
  for (const i of [...issues].sort((a, b) => a.number - b.number)) {
    if (i.pull_request || !isUndecidedBehaviorRequest(i.labels) || (i.assignees ?? []).length) continue;
    const r = parseRequestIssue(i.body);
    const ask = behaviorAskOf(r);
    if (!r || !ask) continue;
    if (isNewPatternAsk(ask) && !ids.has(ask.id)) out.push({ number: i.number, name: r.component.replace(/\s+pattern$/i, '').trim() || idWords(ask.id) });
    else if (ask.of === 'component' && ask.behavior && !ask.today && !ids.has(ask.behavior)) out.push({ number: i.number, name: `${behaviorNames.get(ask.behavior) ?? idWords(ask.behavior)} on ${ask.id}` });
  }
  return out;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The header's one sentence: how many of each kind, then, for whoever decides on them, how many wait for a decision.
 * `waiting` is null while unknown or for a viewer who does not decide.
 */
export function studioPatternsLead(groups: readonly StudioPatternGroup[], waiting: number | null = null, proposals = 0): string {
  const n = (kind: StudioPatternGroup['kind']) => groups.find((g) => g.kind === kind)?.rows.length ?? 0;
  const parts = [n('interaction') ? count(n('interaction'), 'interaction') : '', n('action') ? count(n('action'), 'action') : ''].filter(Boolean);
  // No pattern: the empty state under the header says it, once.
  if (!parts.length) return '';
  const head = `${parts.join(' and ')} shared across the product`;
  // New proposals (askedNotPatterns) wait on the same person: counted in the same sentence, once.
  const asks = [waiting ? `${count(waiting, 'change')} asked on them` : '', proposals ? `${proposals} new ${proposals === 1 ? 'one' : 'ones'}` : ''].filter(Boolean);
  const total = (waiting ?? 0) + proposals;
  return asks.length ? `${head}, ${asks.join(' and ')} ${total === 1 ? 'waits' : 'wait'} for your decision.` : `${head}.`;
}

/** The words of a pattern's requests cell: "1 change asked", "2 changes asked". */
export const requestsLabel = (n: number): string => `${count(n, 'change')} asked`;
