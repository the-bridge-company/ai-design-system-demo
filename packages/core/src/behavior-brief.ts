// What a developer (or Claude) needs to build a behavior request the design system lead made the default (phase 2,
// requests.ts BehaviorAsk): the behavior today and the wanted one, its id and keys from the component's docs.json, the
// files to change (real paths only, read by the caller), the Base UI primitive the source imports (read from the
// source, never guessed), and what to do: the code, the docs.json `behaviors` entry, a test that presses the keys, a
// changeset, a pull request that closes the request. Also who made it the default, read from the comment Bridge
// writes. Pure: no I/O.

import { behaviorAskOf, isNewPatternAsk, type BehaviorAsk, type ComponentChangeRequest } from './requests';

/** What the caller read in the repository for the brief. Every field is optional: absent means not known. */
export interface BehaviorFacts {
  /** The behavior entry's keys, as the component's docs.json lists them today. */
  keys?: string[] | undefined;
  /** The component's docs.json, repo-relative, when it exists. */
  docsPath?: string | undefined;
  /** Repo-relative files that exist: its source, its docs.json, its tests (or the pattern file). */
  files?: string[] | undefined;
  /** The Base UI primitives its source imports (basePrimitivesOf). */
  primitives?: BasePrimitive[] | undefined;
}

export interface BasePrimitive {
  /** The name imported: "Select". */
  name: string;
  /** The module it comes from: "@base-ui/react/select". */
  module: string;
}

/** Base UI modules that are helpers, not a primitive a component wraps. */
const HELPERS = new Set(['use-render', 'merge-props', 'utils', 'direction-provider', 'csp-provider', 'unstable-use-media-query', 'use-button']);

/**
 * The Base UI primitives a component's source imports ("import { Select as BaseSelect } from '@base-ui/react/select'"
 * gives Select from @base-ui/react/select), helpers left out. Read from the source only: empty when it imports none.
 */
export function basePrimitivesOf(source: string | null | undefined): BasePrimitive[] {
  const out: BasePrimitive[] = [];
  for (const m of (source ?? '').matchAll(/import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@base-ui(?:-components)?\/react\/([a-z0-9-]+))['"]/g)) {
    if (/^import\s*type\b/.test(m[0]) || HELPERS.has(m[3]!)) continue;
    for (const part of m[1]!.split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name) && !out.some((p) => p.name === name && p.module === m[2])) out.push({ name, module: m[2]! });
    }
  }
  return out;
}

/**
 * Who made a behavior request the default and when, from the comment Bridge writes (requests.ts
 * behaviorDefaultComment, "Dana made it the default in Bridge Studio.", or an earlier "Made the default by @lee in
 * Bridge Studio."). The latest one wins. Null when no comment says it.
 */
export function madeDefaultOf(comments: readonly { body?: string | null; createdAt?: string | null; created_at?: string | null }[]): { by: string | null; at: string | null } | null {
  for (const c of [...comments].reverse()) {
    const body = c.body ?? '';
    const at = c.createdAt ?? c.created_at ?? null;
    const named = /^(.{1,80}?) made it the default in Bridge Studio\./m.exec(body);
    if (named) return { by: named[1]!.trim(), at };
    const old = /^Made the default(?: by (@?[A-Za-z0-9-]{1,39}))? in Bridge Studio\./m.exec(body);
    if (old) return { by: old[1] ?? null, at };
  }
  return null;
}

/**
 * The brief Claude gets to build a behavior request (Being built "Copy the request for Claude", CLI and MCP through
 * requestBrief and buildRequestBrief). Empty when the request carries no readable behavior ask.
 */
export function behaviorBrief(r: ComponentChangeRequest, ctx: { issue?: number | undefined; issueUrl?: string | undefined; agentsFile?: string | undefined; facts?: BehaviorFacts | undefined } = {}): string {
  const ask = behaviorAskOf(r);
  if (!ask) return '';
  const f = ctx.facts ?? {};
  const ref = ctx.issue ? `#${ctx.issue}` : 'this request';
  if (isNewPatternAsk(ask)) return newPatternBrief(r, ask, ref, ctx);
  const pattern = ask.of === 'pattern';
  const patternFile = `patterns/${ask.id}.pattern.json`;
  const which = pattern ? (ask.rule !== undefined ? `Rule ${ask.rule + 1}` : 'A new rule') : ask.behavior ? `${ask.behavior}${f.keys?.length ? ` (keys: ${f.keys.join(', ')})` : ''}` : 'A new behavior';
  const docs = f.docsPath ?? `the ${ask.id} docs.json`;
  const keys = f.keys?.length ? f.keys.join(', ') : null;
  const files = f.files?.length ? f.files : pattern ? [patternFile] : [];
  return [
    `Build Bridge behavior request ${ref}${ctx.issueUrl ? ` (${ctx.issueUrl})` : ''}: the design system lead made it the default, for every product.`,
    '',
    pattern ? `Pattern: ${ask.id} (${patternFile})` : `Component: ${ask.id}`,
    `${pattern ? 'Rule' : 'Behavior'}: ${which}`,
    `Today: ${ask.today || '(it does not do this yet)'}`,
    `Wanted: ${ask.wanted}`,
    ...(ask.where ? [`Where it gets in the way: ${ask.where}`] : []),
    ...(f.primitives?.length ? [`Base UI: it wraps ${f.primitives.map((p) => `${p.name} (${p.module})`).join(', ')}. Use what that primitive offers before writing your own handling.`] : []),
    ...(files.length ? ['', 'Files:', ...files.map((x) => `- ${x}`)] : []),
    '',
    'Do:',
    pattern
      ? `1. Change the product so the pattern does what "Wanted" says, in every place ${patternFile} lists in usedIn.`
      : `1. Change ${ask.id} so it does what "Wanted" says. Keep every other behavior as it is. Do not add or rename props unless the change cannot be made without one: then say why in the pull request.`,
    pattern
      ? `2. Update the rule in ${patternFile} with the new sentence, and its stage when it plays this rule.`
      : ask.behavior
        ? `2. Update the \`${ask.behavior}\` entry of the \`behaviors\` list in ${docs}: its text says the new behavior, its keys are the keys that do it. Keep the id when the meaning stays; when the meaning changes, give it a new kebab-case id and say in the changeset that \`${ask.behavior}\` is deprecated (agents read behavior ids with the version of the package that ships them).`
        : `2. Add an entry to the \`behaviors\` list in ${docs}: a new kebab-case id, a shared family, the sentence, and its keys.`,
    `3. Add a test that ${keys ? `presses ${keys}` : 'presses the keys that do it'} and checks the new behavior${pattern ? ' where the pattern is used' : ''}.`,
    '4. Add a changeset.',
    `5. Work on a branch named agent/build-${ctx.issue ?? '<issue number>'}. The pull request body must contain "Closes ${ctx.issue ? `#${ctx.issue}` : '#<issue number>'}", so the request reads Shipped when it merges.`,
    '',
    'Rules:',
    `- Follow ${ctx.agentsFile ?? 'AGENTS.md'}: Base UI for behavior, tokens only in component CSS, tests, docs.json, changeset.`,
    `- If something is unclear, comment on ${ref} instead of guessing.`,
  ].join('\n');
}

/**
 * The brief for a new action pattern proposed from Studio (requests.ts isNewPatternAsk): write its pattern file from
 * the request, with a real file and match for every place, found in the product code. Nothing invented: a place whose
 * code cannot be found is asked about on the request, and the repository test refuses a match that is not in its file.
 */
function newPatternBrief(r: ComponentChangeRequest, ask: BehaviorAsk, ref: string, ctx: { issue?: number | undefined; issueUrl?: string | undefined; agentsFile?: string | undefined }): string {
  const name = r.component.replace(/\s+pattern$/i, '').trim() || ask.id;
  const file = `patterns/${ask.id}.pattern.json`;
  return [
    `Build Bridge behavior request ${ref}${ctx.issueUrl ? ` (${ctx.issueUrl})` : ''}: the design system lead made this new action pattern the default.`,
    '',
    `Pattern: ${name} (${file}, a new file, kind "action")`,
    `What it is for: ${ask.wanted}`,
    ...(ask.rules?.length ? ['Rules, as people see them:', ...ask.rules.map((x) => `- ${x}`)] : []),
    'Where people do it today:',
    ...(ask.places ?? []).map((p) => `- ${p.screen}: "${p.label}"${p.link ? ` (${p.link})` : ''}`),
    '',
    'Do:',
    `1. Write ${file}: id "${ask.id}", kind "action", name "${name}", its purpose and rules from above, the components it uses, and usedIn.`,
    '2. For every place, find the screen in the product code (the Bridge connector lists the product repositories) and write its usedIn entry: the screen, the label people read, the file and a match that is in that file. A place in a product with its own repository also gets product: its key from bridge.config.json products, and its file is relative to that repository.',
    `3. If a place cannot be found in the code, leave it out and comment on ${ref} instead of guessing. A pattern needs at least two places.`,
    '4. Run the tests: the pattern test fails when a match is not in its file.',
    '5. Add a changeset.',
    `6. Work on a branch named agent/build-${ctx.issue ?? '<issue number>'}. The pull request body must contain "Closes ${ctx.issue ? `#${ctx.issue}` : '#<issue number>'}", so the request reads Shipped when it merges.`,
    '',
    'Rules:',
    `- Follow ${ctx.agentsFile ?? 'AGENTS.md'}.`,
    `- If something is unclear, comment on ${ref} instead of guessing.`,
  ].join('\n');
}
