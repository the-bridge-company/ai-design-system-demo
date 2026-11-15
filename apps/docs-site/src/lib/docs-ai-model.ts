// In-place docs drafting on a Library component page, as pure functions: which sections a scope drafts, which ones
// are outdated, the prompt and the answer. The answer comes from someone's own Claude through the Bridge MCP server
// (the draft exchange): Bridge never calls Claude itself. The browser side (src/scripts/docs-ai.ts) only adds the GitHub
// session. Shared logic lives in @bridge-ds/core (prefillDocs, docsPrompt, docs-ai.ts), as for the MCP tools.
import {
  type ComponentDocsJson,
  type DocsConventions,
  type DocsDraftTask,
  type DocsPrefillInput,
  type DocsSections,
  type DocsTaskAnswer,
  type DraftResult,
  PROSE_KEYS,
  type ProseKey,
  docsSectionsAnswer,
  docsTaskPrompt,
  missingProse,
  prefillDocs,
  sanitizeDocsReplacement,
} from '@bridge-ds/core';

/** What to draft: the whole page (only gaps, or every section), one section, or a selected passage. */
export type DraftScope =
  | { kind: 'page-fill' } // draft empty sections; written sections older than the code are only checked, fixed when no longer true
  | { kind: 'page-rewrite' } // rewrite every prose section
  | { kind: 'section'; key: ProseKey } // one section
  | { kind: 'selection'; key: ProseKey; text: string; mode: 'clearer' | 'shorter' | 'voice' }; // rewrite a selected passage in the Bridge voice

/**
 * Who writes: someone's own Claude through the Bridge MCP server (set up from the message of developerSetupMessage, never
 * shown to the designer as terminal steps). The only way: Bridge never calls Claude with a key.
 */
export type DraftWay = 'my-claude';

export interface DraftAvailability {
  ways: DraftWay[];
  preferred: DraftWay | null;
}

/**
 * Drafted sections (sections scopes) or the rewritten passage (selection, `sections` stays empty). `checked` (sections
 * scopes): written sections Claude checked against newer code and left unchanged, "Still accurate"; a checked section
 * that came back in `sections` was fixed, "Updated".
 */
export interface DraftDocsResult {
  sections: Partial<Record<ProseKey, ComponentDocsJson[ProseKey]>>;
  replacement?: string;
  checked?: ProseKey[];
}

/** /docs-ai/<slug>.json: the facts from the code and the repo conventions, built with the site. */
export interface DocsAiContext {
  slug: string;
  name: string;
  /** Repo paths of the component files (commit dates decide which sections are outdated). */
  files: { tsx: string; css: string; docs: string };
  /** prefillDocs input without the docs: the browser adds the docs it has now. */
  input: Omit<DocsPrefillInput, 'existing' | 'change'>;
  conventions: DocsConventions;
}

export const PROSE_SECTIONS = PROSE_KEYS;

/** The way open in this browser: a GitHub session that can write the draft exchange. */
export function availability(has: { exchange: boolean }): DraftAvailability {
  const ways: DraftWay[] = has.exchange ? ['my-claude'] : [];
  return { ways, preferred: ways[0] ?? null };
}

/**
 * Sections that are empty, or older than the component code: when the last commit of the tsx or the css is newer than
 * the last commit of docs.json, every written section is outdated (a docs.json not committed yet counts as oldest).
 * Without dates (GitHub could not be read) only the empty ones.
 */
export function outdatedFromDates(docs: Partial<ComponentDocsJson> | null | undefined, dates?: { code: (string | null | undefined)[]; docs: string | null | undefined } | null): ProseKey[] {
  const empty = missingProse(docs);
  if (!dates) return empty;
  const code = Math.max(...dates.code.map((d) => (d ? Date.parse(d) : Number.NaN)).filter((n) => !Number.isNaN(n)), Number.NEGATIVE_INFINITY);
  if (code === Number.NEGATIVE_INFINITY) return empty;
  const written = dates.docs ? Date.parse(dates.docs) : Number.NEGATIVE_INFINITY;
  if (!(code > written)) return empty;
  return [...PROSE_KEYS];
}

/**
 * The core task of a scope. page-fill: the empty sections are drafted; written sections older than the code are sent as
 * "check" sections, returned only when something in them is no longer true for the code (wording kept elsewhere);
 * written, up-to-date text is never sent. An empty key list means nothing to draft. page-rewrite: every prose section. section: that one, rewritten when it
 * holds text. selection: the passage only.
 */
export function scopeTask(scope: DraftScope, docs: Partial<ComponentDocsJson> | null | undefined, outdated: readonly ProseKey[] = missingProse(docs)): DocsDraftTask {
  const empty = missingProse(docs);
  switch (scope.kind) {
    case 'page-fill': {
      const keys = PROSE_KEYS.filter((k) => empty.includes(k) || outdated.includes(k));
      const stale = keys.filter((k) => !empty.includes(k));
      return { kind: 'sections', keys, ...(stale.length ? { check: stale } : {}) };
    }
    case 'page-rewrite':
      return { kind: 'sections', keys: [...PROSE_KEYS], rewrite: true };
    case 'section':
      if (!PROSE_KEYS.includes(scope.key)) throw new Error(`"${scope.key}" is not a prose section. Anatomy and preview come from the code.`);
      return { kind: 'sections', keys: [scope.key], ...(empty.includes(scope.key) ? {} : { rewrite: true }) };
    case 'selection':
      if (!PROSE_KEYS.includes(scope.key)) throw new Error(`"${scope.key}" is not a prose section.`);
      if (!scope.text.trim()) throw new Error('Select the text to rewrite first.');
      return { kind: 'selection', key: scope.key, text: scope.text.trim(), mode: scope.mode };
  }
}

/** True when a task has nothing to write (page-fill on complete, up-to-date docs). */
export const isEmptyTask = (t: DocsDraftTask) => t.kind === 'sections' && t.keys.length === 0;

/** The prompt of a task for this component, with the docs as they are now (edited or not). */
export function taskPrompt(ctx: DocsAiContext, docs: Partial<ComponentDocsJson> | null | undefined, task: DocsDraftTask): string {
  const prefill = prefillDocs({ ...ctx.input, existing: docs ?? null });
  return docsTaskPrompt(prefill, ctx.conventions, task);
}

/** The result from the draft exchange (the user's own Claude wrote it through the Bridge MCP server). */
export function resultFromExchange(task: DocsDraftTask, r: Pick<DraftResult, 'docs' | 'replacement'>): DraftDocsResult {
  if (task.kind === 'selection') {
    const replacement = sanitizeDocsReplacement(r.replacement);
    if (!replacement) throw new Error('Claude sent no rewritten passage. Try again.');
    return { sections: {}, replacement };
  }
  return toResult(docsSectionsAnswer(task, r.docs ?? {}));
}

function toResult(a: DocsTaskAnswer | { sections: DocsSections; checked: ProseKey[]; replacement?: undefined }): DraftDocsResult {
  return a.replacement !== undefined ? { sections: {}, replacement: a.replacement } : { sections: a.sections, checked: a.checked };
}

/** The label of the my-Claude way for a designer: a message to copy, never a terminal command or a GitHub token. */
export const COPY_SETUP = { label: 'Copy setup for a developer', done: 'Setup copied' } as const;

/**
 * What a designer sends a developer so their Claude can draft this page's guidance: the one-time setup (the Bridge MCP
 * server for this repository, with their own GitHub token) and the phrase that drafts. The token stays a placeholder.
 */
export function developerSetupMessage(x: { repo: string; component: string; page: string; phrase: string }): string {
  return [
    `Hi, can you draft the ${x.component} usage guidance with Claude? I review each section before it is sent.`,
    `Page: ${x.page}`,
    '',
    'One-time setup in a terminal, with your GitHub token (Contents read and write on the repository):',
    `claude mcp add bridge -s user -e GITHUB_TOKEN=your-github-token -- npx -y @bridge-ds/mcp --repo ${x.repo}`,
    '',
    `Then, when I start a draft on the page, say "${x.phrase}" in Claude Code.`,
  ].join('\n');
}

