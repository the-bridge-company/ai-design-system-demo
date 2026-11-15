// Component docs drafted with Claude: the task (which sections, or a selected passage), the prompt, and the answer's
// sanitizing into a docs.json. Claude is always the person's own, through the Bridge MCP server (the draft exchange of
// the Library page, bridge_draft_docs): Bridge never calls Claude itself. Shared so an answer is cleaned the same way
// everywhere. Pure: no DOM, no Node-only API.

import { cleanDraftText } from './change-drafts';
import {
  type ComponentDocsJson,
  type DocsConventions,
  type DocsExampleNode,
  type DocsGuidance,
  type DocsPrefill,
  PROSE_KEYS,
  type ProseKey,
  docsPrompt,
  markClaudeDraft,
} from './docs-draft';

/** How a selected passage is rewritten. */
export type DocsSelectionMode = 'clearer' | 'shorter' | 'voice';
export const DOCS_SELECTION_MODES: Record<DocsSelectionMode, string> = {
  clearer: 'Make it clearer: plain words, one idea per sentence, the most useful fact first.',
  shorter: 'Make it shorter: keep every fact, drop filler, aim for half the words or fewer.',
  voice: 'Put it in the Bridge voice: sentence case, verbs first, calm and precise, no marketing words, no em dash.',
};
export const isDocsSelectionMode = (m: unknown): m is DocsSelectionMode => typeof m === 'string' && m in DOCS_SELECTION_MODES;
export const isProseKey = (k: unknown): k is ProseKey => typeof k === 'string' && (PROSE_KEYS as readonly string[]).includes(k);

/**
 * One drafting job on a component's docs. "sections": write these prose sections (rewrite: even when they hold text;
 * check: written sections older than the code, returned only when no longer true for it, so an absent one is still
 * accurate). "selection": rewrite one passage of a section, nothing else.
 */
export type DocsDraftTask =
  | { kind: 'sections'; keys: ProseKey[]; rewrite?: boolean | undefined; check?: ProseKey[] | undefined }
  | { kind: 'selection'; key: ProseKey; text: string; mode: DocsSelectionMode };

/** Problems in a task, as sentences. Empty when valid. */
export function validateDocsTask(x: unknown): string[] {
  if (!x || typeof x !== 'object') return ['The docs task is missing.'];
  const t = x as Partial<Record<string, unknown>>;
  if (t.kind === 'sections') {
    const keys = t.keys;
    if (!Array.isArray(keys) || !keys.length || !keys.every(isProseKey)) return [`The docs task lists no sections: use ${PROSE_KEYS.join(', ')}.`];
    if (t.check !== undefined && (!Array.isArray(t.check) || !t.check.every(isProseKey))) return ['check must list prose sections.'];
    return [];
  }
  if (t.kind === 'selection') {
    const out: string[] = [];
    if (!isProseKey(t.key)) out.push(`The selection needs a section: ${PROSE_KEYS.join(', ')}.`);
    if (typeof t.text !== 'string' || !t.text.trim()) out.push('The selection has no text.');
    if (!isDocsSelectionMode(t.mode)) out.push('The selection mode must be clearer, shorter or voice.');
    return out;
  }
  return ['The docs task kind must be "sections" or "selection".'];
}

/** The keys a task writes. */
export const docsTaskKeys = (t: DocsDraftTask): ProseKey[] => (t.kind === 'sections' ? t.keys : [t.key]);

/** The prompt to rewrite a selected passage of a section: the facts and the conventions, the passage, one rule. */
export function docsSelectionPrompt(prefill: DocsPrefill, conventions: DocsConventions, sel: { key: ProseKey; text: string; mode: DocsSelectionMode }): string {
  const base = docsPrompt(prefill, conventions, { keys: [sel.key] });
  // Reuse the facts and conventions of the sections prompt, with the selection task and contract on top.
  const facts = base.slice(base.indexOf('Facts computed from the code:'));
  return [
    `Rewrite one passage of the "${sel.key}" section of ${prefill.component}.docs.json for the Bridge design system.`,
    DOCS_SELECTION_MODES[sel.mode],
    '',
    'Rules:',
    '- Keep its meaning and every fact that the code supports. Never add props, variants, keyboard behavior or tokens that are not in the facts or the source below.',
    '- Bridge voice: sentence case, plain words, verbs first, no em dashes, no marketing words, no Markdown.',
    '- Rewrite only the passage: it is pasted back in place of the selection, inside the rest of the section.',
    '- Answer with one JSON object, nothing else: { "replacement": "the rewritten passage" }.',
    '',
    `<passage>\n${sel.text.trim()}\n</passage>`,
    '',
    facts,
  ].join('\n');
}

/** The prompt of a task: docsPrompt for sections (only those keys), docsSelectionPrompt for a selection. */
export function docsTaskPrompt(prefill: DocsPrefill, conventions: DocsConventions, task: DocsDraftTask): string {
  if (task.kind === 'selection') return docsSelectionPrompt(prefill, conventions, task);
  return docsPrompt(prefill, conventions, { keys: task.keys, ...(task.rewrite ? { rewrite: true } : {}), ...(task.check?.length ? { check: task.check } : {}) });
}

// ---------------------------------------------------------------------------------------------
// Answers: parse and sanitize

/** One line of docs prose: em dashes out, whitespace folded, trimmed. */
export const cleanDocsText = (s: string): string => cleanDraftText(s.replace(/[\r\n]+/g, ' '));

const isExample = (x: unknown): x is DocsExampleNode => {
  if (typeof x === 'string') return true;
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const n = x as { c?: unknown; p?: unknown; children?: unknown };
  if (typeof n.c !== 'string' || !n.c) return false;
  if (n.p !== undefined && (!n.p || typeof n.p !== 'object' || Array.isArray(n.p))) return false;
  return n.children === undefined || (Array.isArray(n.children) && n.children.every(isExample));
};

const textList = (x: unknown): string[] | undefined => {
  if (typeof x === 'string') x = [x];
  if (!Array.isArray(x)) return undefined;
  const out = x.filter((s): s is string => typeof s === 'string').map(cleanDocsText).filter(Boolean);
  return out.length ? out : undefined;
};

const guidanceList = (x: unknown, examples: boolean): DocsGuidance[] | undefined => {
  if (!Array.isArray(x)) return undefined;
  const out: DocsGuidance[] = [];
  for (const g of x as unknown[]) {
    if (!g || typeof g !== 'object') continue;
    const r = g as { title?: unknown; text?: unknown; example?: unknown };
    const title = typeof r.title === 'string' ? cleanDocsText(r.title) : '';
    const text = typeof r.text === 'string' ? cleanDocsText(r.text) : '';
    if (!title || !text) continue;
    out.push({ title, text, ...(examples && r.example !== undefined && isExample(r.example) ? { example: r.example } : {}) });
  }
  return out.length ? out : undefined;
};

export type DocsSections = Partial<Pick<ComponentDocsJson, ProseKey>>;

/**
 * The prose sections of an answer, kept to the docs.json shapes: only `keys`, summary one cleaned paragraph, lists of
 * non-empty cleaned strings, dos and donts as {title, text} (an example only when `examples` and well formed). Em
 * dashes removed everywhere. Sections that come back empty or in the wrong shape are left out.
 */
export function sanitizeDocsSections(raw: unknown, keys: readonly ProseKey[] = PROSE_KEYS, opts: { examples?: boolean } = {}): DocsSections {
  const out: DocsSections = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (k === 'summary') {
      const s = typeof v === 'string' ? cleanDocsText(v) : '';
      if (s) out.summary = s;
    } else if (k === 'dos' || k === 'donts') {
      const g = guidanceList(v, opts.examples ?? false);
      if (g) out[k] = g;
    } else {
      const l = textList(v);
      if (l) out[k] = l;
    }
  }
  return out;
}

/** A rewritten passage: one cleaned paragraph without wrapping quotes, or '' when there is none. */
export function sanitizeDocsReplacement(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return cleanDocsText(raw.trim().replace(/^["'“]+|["'”]+$/g, ''));
}

/**
 * A task's answer. Sections tasks: `sections` drafted or fixed, and `checked`, the checked sections Claude verified and
 * left unchanged (still accurate). Selection: `replacement` only.
 */
export type DocsTaskAnswer = { sections: DocsSections; checked: ProseKey[]; replacement?: undefined } | { sections: DocsSections; checked?: undefined; replacement: string };

/**
 * Sections and checked of a sections task from an answer object: absent checked keys are still accurate. Throws only
 * when the task checks nothing and none of its keys came back.
 */
export function docsSectionsAnswer(task: Extract<DocsDraftTask, { kind: 'sections' }>, raw: unknown): { sections: DocsSections; checked: ProseKey[] } {
  const check = (task.check ?? []).filter((k) => task.keys.includes(k));
  const sections = check.length ? sanitizeDocsSections(raw, task.keys) : docsSectionsResult(task, raw);
  return { sections, checked: check.filter((k) => sections[k] === undefined) };
}

/** The sections of a task from an answer object (API reply or the exchange). Throws when none of the keys came back. */
export function docsSectionsResult(task: Extract<DocsDraftTask, { kind: 'sections' }>, raw: unknown): DocsSections {
  const sections = sanitizeDocsSections(raw, task.keys);
  if (!Object.keys(sections).length) throw new Error(`Claude's answer holds none of the sections asked for (${task.keys.join(', ')}). Try again.`);
  return sections;
}

/**
 * Drafted sections applied to a docs.json, marked for review: the sections replace the ones there, the rest stays as
 * is (anatomy and preview are code-decided and never come from a draft), and draftedSections lists what waits.
 */
export function applyDocsSections<T extends Partial<ComponentDocsJson>>(docs: T, sections: DocsSections): T {
  const keys = PROSE_KEYS.filter((k) => sections[k] !== undefined);
  if (!keys.length) return docs;
  return markClaudeDraft({ ...docs, ...sections }, keys);
}
