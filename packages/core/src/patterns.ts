// Patterns: what the product does the same way across several components, kept one file per pattern in the
// repository's `patterns/` folder (<id>.pattern.json). One source drives three readers, as component behaviors do
// (behaviors.ts): the Library's Patterns pages, the stage there (real components performing the pattern) and what AI
// agents read through the MCP server and llms.txt.
//
// Two kinds, one section:
//   interaction  one gesture several components share, derived from the behavior ids of their docs.json
//                (close-on-escape on Select and Combobox). Its file only says its name and one sentence; which
//                components have it, and each one's own wording, are read from the components. It exists only while
//                two components or more list that id (interactionProblems).
//   action       a task a person does that spans several components (Delete, Send for review), written by hand.
//
// Nothing in a pattern is invented: `usedIn` names the real places of the product that do it, each with the file that
// holds its label (`file`) and the text that file must contain (`match`). A repository checks those in its tests, so a
// pattern cannot drift away from the product. Pure: no I/O.

import { readBehaviors } from './behaviors';

/** The folder of pattern files, repo-relative. */
export const PATTERNS_DIR = 'patterns';
/** The suffix of a pattern file: patterns/delete.pattern.json. */
export const PATTERN_SUFFIX = '.pattern.json';

/** The kinds of pattern, in the order the Library lists them, with the name each group goes by. */
export const PATTERN_KINDS = ['interaction', 'action'] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];
export const PATTERN_KIND_LABEL: Record<PatternKind, string> = { interaction: 'Interactions', action: 'Actions' };

/** A real place of the product that does it. */
export interface PatternUse {
  /** Where a person sees it, in their words: "Settings, Danger zone". */
  screen: string;
  /** The label they read there: "Delete this team". */
  label: string;
  /** The repo-relative file that holds that label or its handler. */
  file: string;
  /** Text that file contains (the label as written, or the call that words it). */
  match: string;
}

/** The icons a stage button may carry. */
export const STAGE_ICONS = ['trash'] as const;

/** A question the stage asks first: title, consequence and the confirm button. "{item}" is the row. */
export interface StageQuestion {
  title: string;
  text: string;
  confirmLabel: string;
}

/** What the stage plays: rows, each with the action. Page only, agents never read it. */
export interface PatternStage {
  /** The rows the stage starts with: "Marketing site". */
  items: string[];
  /** The button on each row: "Delete". */
  action: string;
  /** The icon at the start of that button, when the rules name one. */
  icon?: (typeof STAGE_ICONS)[number];
  /** The question asked first, when it cannot be undone. "{item}" is the row, in each line. */
  confirm?: StageQuestion;
  /**
   * The rows whose impact is high (other people lose them), asked with their own question: the person types the row's
   * name before the confirm button turns on (AlertDialog confirmText). The other rows keep the plain `confirm`.
   */
  typeName?: StageQuestion & { items: string[] };
  /** What the toast says once done, when it can be undone. "{item}" is the row. */
  done?: string;
  /** What the toast says after Undo. "{item}" is the row. */
  undone?: string;
}

interface PatternBase {
  /** Stable id, kebab-case, also the file name: "delete". An interaction's id is the shared behavior id. */
  id: string;
  /** The title people read: "Delete", "Close on Escape". */
  name: string;
  /** What it is for, in one sentence. */
  purpose: string;
}

/** An interaction: its components and their wording come from their docs.json behaviors (behaviorUses). */
export interface InteractionPattern extends PatternBase {
  kind: 'interaction';
}

export interface ActionPattern extends PatternBase {
  kind: 'action';
  /** Whether it can be taken back. It decides the rule: Undo in a toast, or a question first. */
  reversible: boolean;
  /** Short sentences, the shared rule first. */
  rules: string[];
  /** The design system components it uses, by name. */
  components: string[];
  /** The real places that do it, two or more. */
  usedIn: PatternUse[];
  stage?: PatternStage;
}

export type Pattern = InteractionPattern | ActionPattern;

/** A component that does an interaction, in its own words (its behavior's text). */
export interface InteractionUse {
  component: string;
  text: string;
  keys?: string[];
  /** What the stage tells the reader to do (the behavior's `try`). Page only. */
  try?: string;
}

/** What an agent reads: an action without its stage; an interaction with the components that do it, in their words. */
export type AgentPattern = Omit<ActionPattern, 'stage'> | (InteractionPattern & { components: Omit<InteractionUse, 'try'>[] });

export interface PatternIssue {
  field: string;
  message: string;
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EM_DASH = /\u2014/;
const isText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';
const isTextList = (x: unknown): x is string[] => Array.isArray(x) && x.length > 0 && x.every(isText);

/** The id a pattern file stands for: patterns/delete.pattern.json -> "delete"; null for any other file. */
export function patternIdOf(path: string): string | null {
  const rel = path.startsWith(`${PATTERNS_DIR}/`) ? path.slice(PATTERNS_DIR.length + 1) : null;
  if (!rel || rel.includes('/') || !rel.endsWith(PATTERN_SUFFIX)) return null;
  const id = rel.slice(0, -PATTERN_SUFFIX.length);
  return ID.test(id) ? id : null;
}

/** What blocks a pattern file. `fileId` is the id its file name gives, when known. */
export function validatePattern(value: unknown, fileId?: string): PatternIssue[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ field: 'pattern', message: 'Write the pattern as an object with an id, a kind, a name and its rules.' }];
  const o = value as Record<string, unknown>;
  const out: PatternIssue[] = [];
  if (!isText(o.id) || !ID.test(o.id)) out.push({ field: 'id', message: 'Give the pattern a kebab-case id, like send-for-review.' });
  else if (fileId !== undefined && o.id !== fileId) out.push({ field: 'id', message: `The id says ${o.id} but the file is ${fileId}${PATTERN_SUFFIX}: use the same name.` });
  if (!(PATTERN_KINDS as readonly unknown[]).includes(o.kind)) out.push({ field: 'kind', message: `Use a known kind: ${PATTERN_KINDS.join(', ')}.` });
  if (!isText(o.name)) out.push({ field: 'name', message: 'Name the pattern as people read it, like Delete.' });
  if (!isText(o.purpose)) out.push({ field: 'purpose', message: 'Say what it is for in one sentence.' });
  if (o.kind === 'interaction') {
    // Everything else of an interaction is read from the components: written here, it would drift from them.
    for (const k of ['reversible', 'rules', 'components', 'usedIn', 'stage']) if (k in o) out.push({ field: k, message: `An interaction takes its components and their words from their docs.json behaviors: remove ${k}.` });
    if (EM_DASH.test(JSON.stringify(value))) out.push({ field: 'pattern', message: 'Replace the em dashes with a colon, a comma or two sentences.' });
    return out;
  }
  if (typeof o.reversible !== 'boolean') out.push({ field: 'reversible', message: 'Say whether it can be undone: true or false.' });
  if (!isTextList(o.rules)) out.push({ field: 'rules', message: 'List the rules, one short sentence each.' });
  if (!isTextList(o.components)) out.push({ field: 'components', message: 'List the components it uses by name, like ["Button", "AlertDialog"].' });
  if (!Array.isArray(o.usedIn) || o.usedIn.length < 2) out.push({ field: 'usedIn', message: 'A pattern names at least two real places that do it.' });
  else
    o.usedIn.forEach((u: unknown, i) => {
      const x = (u && typeof u === 'object' ? u : {}) as Record<string, unknown>;
      if (!isText(x.screen) || !isText(x.label) || !isText(x.file) || !isText(x.match)) out.push({ field: `usedIn.${i}`, message: 'Give each place its screen, its label, its file and the text that file contains.' });
    });
  if (o.stage !== undefined) {
    const s = (o.stage && typeof o.stage === 'object' ? o.stage : {}) as Record<string, unknown>;
    if (!isTextList(s.items) || !isText(s.action)) out.push({ field: 'stage', message: 'A stage lists its rows (items) and names the action on each.' });
    if (s.icon !== undefined && !(STAGE_ICONS as readonly unknown[]).includes(s.icon)) out.push({ field: 'stage.icon', message: `Use a known icon: ${STAGE_ICONS.join(', ')}, or leave icon out.` });
    const c = s.confirm as Record<string, unknown> | undefined;
    if (o.reversible === false && !(c && isText(c.title) && isText(c.text) && isText(c.confirmLabel))) out.push({ field: 'stage.confirm', message: 'It cannot be undone: the stage asks first (confirm: title, text, confirmLabel).' });
    if (s.typeName !== undefined) {
      const t = (s.typeName && typeof s.typeName === 'object' ? s.typeName : {}) as Record<string, unknown>;
      const rows = isTextList(s.items) ? s.items : [];
      if (o.reversible !== false) out.push({ field: 'stage.typeName', message: 'Typing the name is for what cannot be undone: remove typeName, or set reversible to false.' });
      else if (!isTextList(t.items) || !isText(t.title) || !isText(t.text) || !isText(t.confirmLabel)) out.push({ field: 'stage.typeName', message: 'Name the rows whose impact is high (items) and their question: title, text, confirmLabel.' });
      else if (t.items.some((x) => !rows.includes(x))) out.push({ field: 'stage.typeName', message: `Ask to type the name only on rows of the stage: ${(t.items as string[]).filter((x) => !rows.includes(x)).join(', ')} is not one.` });
    }
    if (o.reversible === true && !isText(s.done)) out.push({ field: 'stage.done', message: 'It can be undone: the stage says it is done, with Undo (done).' });
  }
  if (EM_DASH.test(JSON.stringify(value))) out.push({ field: 'pattern', message: 'Replace the em dashes with a colon, a comma or two sentences.' });
  return out;
}

/** A pattern a page can show, from any file (a repository Bridge does not control may write any shape); null when it is not one. */
export function readPattern(value: unknown): Pattern | null {
  return validatePattern(value).length ? null : (value as Pattern);
}

/**
 * The patterns of a repository, from its pattern files (path -> body): well-formed ones only, in kind order then by
 * name. `problems` says which files could not be read and why.
 */
export function readPatterns(files: Iterable<[string, string]>): { patterns: Pattern[]; problems: string[] } {
  const patterns: Pattern[] = [];
  const problems: string[] = [];
  for (const [path, body] of files) {
    const id = patternIdOf(path);
    if (!id) continue;
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch (err) {
      problems.push(`${path}: ${(err as Error).message}`);
      continue;
    }
    const issues = validatePattern(value, id);
    if (issues.length) problems.push(`${path}: ${issues.map((i) => `${i.field}: ${i.message}`).join(' ')}`);
    else patterns.push(value as Pattern);
  }
  const rank = (k: string) => (PATTERN_KINDS as readonly string[]).indexOf(k);
  return { patterns: patterns.sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name)), problems };
}

/** Patterns grouped by kind, in PATTERN_KINDS order, each group with its label. Empty kinds are left out. */
export function patternGroups(list: readonly Pattern[]): { kind: PatternKind; label: string; items: Pattern[] }[] {
  return PATTERN_KINDS.map((kind) => ({ kind, label: PATTERN_KIND_LABEL[kind], items: list.filter((p) => p.kind === kind) })).filter((g) => g.items.length);
}

/** A component as the interaction readers need it: its name and its docs.json behaviors (any shape). */
export interface BehaviorSource {
  name: string;
  behaviors?: unknown;
}

/** Behavior id -> the components that list it, in their own words, in component order. */
export function behaviorUses(components: readonly BehaviorSource[]): Map<string, InteractionUse[]> {
  const uses = new Map<string, InteractionUse[]>();
  for (const c of components) {
    for (const b of readBehaviors(c.behaviors)) {
      const use: InteractionUse = { component: c.name, text: b.text, ...(b.keys ? { keys: b.keys } : {}), ...(b.try ? { try: b.try } : {}) };
      (uses.get(b.id) ?? uses.set(b.id, []).get(b.id)!).push(use);
    }
  }
  return uses;
}

/** An interaction is shared: at least this many components list its id. */
export const INTERACTION_MIN_COMPONENTS = 2;

/** The interactions to show: those whose id two components or more list, each with them. */
export function interactionsWithUses(patterns: readonly Pattern[], uses: Map<string, InteractionUse[]>): { pattern: InteractionPattern; uses: InteractionUse[] }[] {
  return patterns.flatMap((p) => {
    const list = p.kind === 'interaction' ? (uses.get(p.id) ?? []) : [];
    return p.kind === 'interaction' && list.length >= INTERACTION_MIN_COMPONENTS ? [{ pattern: p, uses: list }] : [];
  });
}

/** An interaction written for an id fewer than two components list: it would be a pattern of one, or of none. */
export function interactionProblems(patterns: readonly Pattern[], uses: Map<string, InteractionUse[]>): string[] {
  return patterns.flatMap((p) => {
    if (p.kind !== 'interaction') return [];
    const n = uses.get(p.id)?.length ?? 0;
    return n >= INTERACTION_MIN_COMPONENTS ? [] : [`${PATTERNS_DIR}/${p.id}${PATTERN_SUFFIX}: ${n === 0 ? 'no component lists' : 'only one component lists'} the behavior ${p.id}; an interaction is shared by two components or more.`];
  });
}

/** The patterns an agent reads: shared interactions with their components in their words, actions without their stage. */
export function agentPatterns(patterns: readonly Pattern[], uses: Map<string, InteractionUse[]>): AgentPattern[] {
  const shared = new Map(interactionsWithUses(patterns, uses).map((x) => [x.pattern.id, x.uses]));
  return patterns.flatMap((p): AgentPattern[] => {
    if (p.kind === 'action') {
      const { stage: _stage, ...rest } = p;
      return [rest];
    }
    const list = shared.get(p.id);
    return list ? [{ ...p, components: list.map(({ try: _try, ...u }) => u) }] : [];
  });
}

/** "{item}" in a stage line, filled. */
export const stageLine = (line: string, item: string): string => line.replace(/\{item\}/g, item);

/** The patterns of a repo model for agents: its patterns, and its components' behaviors for the interactions. */
export const modelAgentPatterns = (model: { patterns?: Pattern[] | undefined; components: { list: { name: string; docs: { behaviors?: unknown } | null }[] } | null }): AgentPattern[] =>
  agentPatterns(model.patterns ?? [], behaviorUses((model.components?.list ?? []).map((c) => ({ name: c.name, behaviors: c.docs?.behaviors }))));

/** One line of repo text: whitespace collapsed, so a value cannot open a heading or a list of its own. */
const one = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** llms.txt lines for patterns: one heading per kind, one line per pattern with its kind. Empty without patterns. */
export function patternLlmsLines(list: readonly AgentPattern[]): string[] {
  if (!list.length) return [];
  const out = ['## Patterns', '', 'Shared across the product. Interactions: one gesture several components share, each in its own words. Actions: a task people take, with its rules.', ''];
  for (const kind of PATTERN_KINDS) {
    const items = list.filter((p) => p.kind === kind);
    if (!items.length) continue;
    out.push(`### ${PATTERN_KIND_LABEL[kind]}`, '');
    for (const p of items) {
      if (p.kind === 'interaction') {
        const comps = p.components.map((c) => `${one(c.component)} ("${one(c.text)}"${c.keys ? ` [${c.keys.map(one).join(', ')}]` : ''})`).join(', ');
        out.push(`- ${p.id} (kind: interaction): ${one(p.name)}. ${one(p.purpose)} Components: ${comps}`);
      } else {
        out.push(
          `- ${p.id} (kind: action): ${one(p.name)}. ${one(p.purpose)} ${p.reversible ? 'Can be undone.' : 'Cannot be undone.'} Components: ${p.components.map(one).join(', ')}.`,
          ...p.rules.map((r) => `  - Rule: ${one(r)}`),
          `  - Used in: ${p.usedIn.map((u) => `${one(u.screen)} (${one(u.label)})`).join('; ')}`,
        );
      }
    }
    out.push('');
  }
  return out;
}
