// The Patterns pages of a Library, for any repo model (Bridge's own at build time, a team's in the browser): the
// patterns of patterns/<id>.pattern.json (@bridge-ds/core patterns.ts) grouped by kind, each interaction with the
// components that list its behavior id, in their own words. Pure: the model comes in as an argument.
import { behaviorUses, interactionsWithUses, PATTERN_KIND_LABEL, PATTERN_KINDS, readBehaviors, type ActionPattern, type ExampleNode, type InteractionPattern, type InteractionUse, type PatternKind, type RepoModel } from '@bridge-ds/core';

/** The Library route of the Patterns index, and of one pattern on Bridge's own Library. */
export const PATTERNS_ROUTE = 'patterns/';
export const patternRoute = (id: string): string => `${PATTERNS_ROUTE}${encodeURIComponent(id)}/`;
/** On a team's Library the patterns share one shell: the pattern is in the query (?p=close-on-escape). */
export const PATTERN_QUERY = 'p';

/** A component that does an interaction, with what its stage needs. */
export interface InteractionComponent extends InteractionUse {
  slug: string;
  /** docs.json preview: what a live stage draws. */
  preview: ExampleNode | null;
  /** The behavior's own stage example, when it has one. */
  example?: ExampleNode;
  /** The component's first story, for a stage from the team's Storybook. */
  storyId?: string;
}

export type PatternEntry = { kind: 'action'; pattern: ActionPattern } | { kind: 'interaction'; pattern: InteractionPattern; components: InteractionComponent[] };

export interface PatternGroup {
  kind: PatternKind;
  label: string;
  items: PatternEntry[];
}

/**
 * The patterns a Library shows, grouped by kind in PATTERN_KINDS order: every action, and the interactions two
 * components or more share (an interaction file for an id fewer components list stays out). Empty without patterns.
 */
export function libraryPatterns(model: RepoModel): PatternGroup[] {
  const patterns = model.patterns ?? [];
  if (!patterns.length) return [];
  const comps = model.components?.list ?? [];
  const uses = behaviorUses(comps.map((c) => ({ name: c.name, behaviors: c.docs?.behaviors })));
  const byName = new Map(comps.map((c) => [c.name, c]));
  const interactions = new Map(
    interactionsWithUses(patterns, uses).map(({ pattern, uses: list }) => [
      pattern.id,
      list.flatMap((u): InteractionComponent[] => {
        const c = byName.get(u.component);
        if (!c) return [];
        const example = readBehaviors(c.docs?.behaviors).find((b) => b.id === pattern.id)?.example;
        const story = c.stories[0];
        return [{ ...u, slug: c.slug, preview: (c.docs?.preview as ExampleNode | undefined) ?? null, ...(example ? { example } : {}), ...(story ? { storyId: story.id } : {}) }];
      }),
    ]),
  );
  const entries = patterns.flatMap((p): PatternEntry[] => {
    if (p.kind === 'action') return [{ kind: 'action', pattern: p }];
    const components = interactions.get(p.id);
    return components ? [{ kind: 'interaction', pattern: p, components }] : [];
  });
  return PATTERN_KINDS.map((kind) => ({ kind, label: PATTERN_KIND_LABEL[kind], items: entries.filter((e) => e.kind === kind) })).filter((g) => g.items.length);
}

/** One pattern of a Library by id, or undefined. */
export const patternById = (groups: readonly PatternGroup[], id: string): PatternEntry | undefined => groups.flatMap((g) => g.items).find((e) => e.pattern.id === id);

/** Behavior id -> its interaction pattern, for the component page's Behaviors rows. */
export const interactionIds = (groups: readonly PatternGroup[]): Set<string> => new Set(groups.flatMap((g) => g.items).filter((e) => e.kind === 'interaction').map((e) => e.pattern.id));

/** The components a pattern uses: an action names them, an interaction is the components that do it. */
export const patternComponents = (e: PatternEntry): string[] => (e.kind === 'action' ? e.pattern.components : e.components.map((c) => c.component));

/** The one line of the Patterns index and of the nav: how many of each kind. */
export function patternsLead(groups: readonly PatternGroup[]): string {
  const n = (kind: PatternKind) => groups.find((g) => g.kind === kind)?.items.length ?? 0;
  const parts = [
    n('interaction') ? `${n('interaction')} ${n('interaction') === 1 ? 'interaction' : 'interactions'} several components share` : '',
    n('action') ? `${n('action')} ${n('action') === 1 ? 'action' : 'actions'} people take across the product` : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(', and ')}. Each one works the same wherever it appears.` : 'No patterns yet.';
}

/** One page under Patterns in a team's Library nav: the pattern's name, its page, the kind label above a kind's first. */
export interface TeamPatternNavItem {
  id: string;
  href: string;
  label: string;
  meta: string;
  /** The first pattern of a kind: the quiet label above it (Interactions, Actions), as on Bridge's own Library. */
  heading?: string;
  /** The pattern this page shows (?p=<id>). */
  current: boolean;
}

/**
 * The patterns of a team's Library nav, under Overview: the same order and kind labels as Bridge's own (lib/nav.ts
 * patternsNav), only the team's own patterns, each at its page (`href(id)`, the team's ?p=<id>). Empty without patterns.
 */
export function teamPatternsNav(groups: readonly PatternGroup[], href: (id: string) => string, currentId: string | null = null): TeamPatternNavItem[] {
  return groups.flatMap((g) =>
    g.items.map((e, i): TeamPatternNavItem => ({
      id: e.pattern.id,
      href: href(e.pattern.id),
      label: e.pattern.name,
      meta: e.pattern.purpose,
      ...(i === 0 ? { heading: g.label } : {}),
      current: e.pattern.id === currentId,
    })),
  );
}
