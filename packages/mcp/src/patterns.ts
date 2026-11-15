// Patterns for agents (bridge_list_patterns, bridge_get_pattern): the repository's patterns/<id>.pattern.json read
// through @bridge-ds/core patterns.ts. Interactions come with the components that list their behavior id, in each
// component's own words (read from the components' docs.json); actions with their rules, components and the real
// places that do them. Never the stage: that is for the Library page only.
import { agentPatterns, behaviorUses, PATTERN_KINDS, PATTERNS_DIR, patternIdOf, readPatterns, type AgentPattern } from '@bridge-ds/core';
import type { BridgeConfig } from './config.js';
import type { RepoSource } from './source.js';
import { listComponentNames } from './components.js';

/** Every pattern an agent reads, interactions first, then actions, each by name; and what could not be read. */
export async function readAgentPatterns(source: RepoSource, config: BridgeConfig): Promise<{ patterns: AgentPattern[]; problems: string[] }> {
  const paths = (await source.list(PATTERNS_DIR)).filter((p) => patternIdOf(p) !== null);
  if (!paths.length) return { patterns: [], problems: [] };
  const bodies = await Promise.all(paths.map(async (p) => [p, await source.read(p)] as const));
  const { patterns, problems } = readPatterns(bodies.filter((b): b is readonly [string, string] => b[1] !== null).map(([p, b]) => [p, b]));
  // Interactions need the components' behaviors: their docs.json, read only when there is one to fill.
  let components: { name: string; behaviors?: unknown }[] = [];
  if (patterns.some((p) => p.kind === 'interaction') && config.components) {
    const suffix = config.components.docsSuffix;
    const names = await listComponentNames(source, config);
    components = await Promise.all(
      names.map(async ({ name, files }) => {
        const docs = files.find((f) => f.endsWith(`/${name}${suffix}`));
        const text = docs ? await source.read(docs) : null;
        try {
          return { name, behaviors: text ? (JSON.parse(text) as { behaviors?: unknown }).behaviors : undefined };
        } catch {
          return { name };
        }
      }),
    );
  }
  return { patterns: agentPatterns(patterns, behaviorUses(components)), problems };
}

/** The list: id, kind, name and what it is for, optionally one kind. */
export async function listPatterns(source: RepoSource, config: BridgeConfig, a: { kind?: string }) {
  const { patterns, problems } = await readAgentPatterns(source, config);
  const kind = a.kind?.toLowerCase();
  const shown = kind ? patterns.filter((p) => p.kind === kind) : patterns;
  return {
    total: shown.length,
    kinds: [...PATTERN_KINDS],
    patterns: shown.map((p) => ({ id: p.id, kind: p.kind, name: p.name, purpose: p.purpose })),
    ...(problems.length ? { problems } : {}),
    ...(patterns.length ? {} : { message: `No patterns in ${PATTERNS_DIR}/ (one <id>.pattern.json per pattern).` }),
  };
}

/** One pattern by id or name: an interaction with its components in their words, an action with its rules and places. */
export async function getPattern(source: RepoSource, config: BridgeConfig, a: { id: string }) {
  const { patterns } = await readAgentPatterns(source, config);
  const q = a.id.trim().toLowerCase();
  const p = patterns.find((x) => x.id === q || x.name.toLowerCase() === q);
  if (!p) throw new Error(`No pattern "${a.id}". Known: ${patterns.map((x) => x.id).join(', ') || 'none'}.`);
  return p;
}
