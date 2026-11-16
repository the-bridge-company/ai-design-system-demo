// Studio > Patterns: the patterns of a design system (patterns/<id>.pattern.json, grouped by kind as the Library groups
// them, lib/library/patterns.ts) as Studio rows, and the open behavior requests that concern each one. Pure: the
// groups, the Library addresses and the issues come in as arguments (pages/studio/patterns.astro builds Bridge's own,
// components/ds/studio/StudioPatterns.tsx a team's in the browser). Unit tested in studio-patterns.test.ts.
//
// A behavior request concerns a pattern when its Bridge block asks about it (behavior.of 'pattern', its id), or when
// it asks about one component's behavior whose id is an interaction pattern (behavior.of 'component', behavior = the
// pattern id: "Select: close on Escape" concerns Close on Escape). Only the ones that wait for the lead's decision
// (open, `request: behavior` without `bridge-build`, nobody on them): one made the default is on Being built.
import { behaviorAskOf, isUndecidedBehaviorRequest, parseRequestIssue, requestIssueTitle } from '@bridge-ds/core';
import { patternComponents, type PatternGroup } from './library/patterns';
import type { BehaviorIssue } from './home-model';

export interface StudioPatternRow {
  id: string;
  name: string;
  purpose: string;
  /** The components it uses (an action names them, an interaction is the components that do it). */
  components: string[];
  /** Its page in the Library. */
  href: string;
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
}

/** The Library groups as Studio rows, in the Library's order; `href` gives each pattern's Library page. */
export function studioPatternGroups(groups: readonly PatternGroup[], href: (id: string) => string): StudioPatternGroup[] {
  return groups.map((g) => ({
    kind: g.kind,
    label: g.label,
    rows: g.items.map((e) => ({ id: e.pattern.id, name: e.pattern.name, purpose: e.pattern.purpose, components: patternComponents(e), href: href(e.pattern.id) })),
  }));
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
    (out.get(id) ?? out.set(id, []).get(id)!).push({ number: i.number, title: requestIssueTitle(r) });
  }
  return out;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The header's one sentence: how many of each kind, then, for whoever decides on them, how many wait for a decision.
 * `waiting` is null while unknown or for a viewer who does not decide.
 */
export function studioPatternsLead(groups: readonly StudioPatternGroup[], waiting: number | null = null): string {
  const n = (kind: StudioPatternGroup['kind']) => groups.find((g) => g.kind === kind)?.rows.length ?? 0;
  const parts = [n('interaction') ? count(n('interaction'), 'interaction') : '', n('action') ? count(n('action'), 'action') : ''].filter(Boolean);
  // No pattern: the empty state under the header says it, once.
  if (!parts.length) return '';
  const head = `${parts.join(' and ')} shared across the product`;
  return waiting ? `${head}, ${count(waiting, 'change')} asked on them ${waiting === 1 ? 'waits' : 'wait'} for your decision.` : `${head}.`;
}

/** The words of a pattern's requests cell: "1 change asked", "2 changes asked". */
export const requestsLabel = (n: number): string => `${count(n, 'change')} asked`;
