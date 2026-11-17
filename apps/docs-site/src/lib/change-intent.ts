// "Change this component" in the Studio Components drawer: the designer drives the change, a developer builds it
// with Claude and checks the code. The drawer first asks what she wants to change (three intents), then leads to the
// flow that does it: the component's tokens, an exploration a developer builds from her Figma frame, or a mismatch report. The
// words and the rules live here, pure and tested (change-intent.test.ts); scripts/request-form.ts paints them.
import { behaviorRequestOf, type BehaviorAsk, type BuildRequestInput, type ComponentChangeRequest, type RequestKind } from '@bridge-ds/core';
import { ghAction } from './gh-wording';
import { requestFromForm, type RequestForm } from './requests-view';

export type ChangeIntent = 'look' | 'variant' | 'wrong';

export interface IntentOption {
  value: ChangeIntent;
  label: string;
  /** One plain line: what happens when she picks it. */
  line: string;
}

export const CHANGE_INTENTS: IntentOption[] = [
  { value: 'look', label: 'Adjust the look', line: 'Colors, radius, spacing, type. You edit its tokens. The before and after goes to review.' },
  {
    value: 'variant',
    label: 'Add a variant or option',
    line: 'A new variant, size, state or option, designed in Figma. A developer builds it with Claude from your Figma frame, in an exploration. You check it in the component sandbox, then send it for review.',
  },
  { value: 'wrong', label: 'Something looks wrong', line: 'It does not match Figma. Report the mismatch with the frame.' },
];

/** The line under "Adjust the look" when the component paints with no token (a layout component). */
export const NO_TOKEN_LINE = 'It paints with no token of its own, so there is nothing to adjust here.';

export const isChangeIntent = (x: unknown): x is ChangeIntent => x === 'look' || x === 'variant' || x === 'wrong';

/** The intent options for one component: "Adjust the look" is off when it has no token to edit. */
export function intentOptions(hasTokens: boolean): (IntentOption & { disabled: boolean })[] {
  return CHANGE_INTENTS.map((o) => (o.value === 'look' && !hasTokens ? { ...o, line: NO_TOKEN_LINE, disabled: true } : { ...o, disabled: false }));
}

/**
 * The form the drawer shows: `explore` (Add a variant or option, a developer builds it with Claude), `ask` (the same need sent to a
 * developer instead) or `mismatch` (Something looks wrong). Null for "Adjust the look": that one is a link to the
 * component's tokens, no form.
 */
export type ChangeFormMode = 'explore' | 'ask' | 'mismatch';

export const formModeFor = (intent: ChangeIntent): ChangeFormMode | null => (intent === 'variant' ? 'explore' : intent === 'wrong' ? 'mismatch' : null);

/** The request kind each form sends (the existing kinds of @bridge-ds/core, so the labels stay `request: <kind>`). */
export const REQUEST_KIND_OF: Record<ChangeFormMode, RequestKind> = { explore: 'new-variant', ask: 'new-variant', mismatch: 'bug' };

export interface ChangeFormCopy {
  heading: string;
  title: { label: string; placeholder: string };
  summary: { label: string; placeholder: string };
  /** The "What, now, in Figma" rows: only a mismatch lists values. */
  changes: boolean;
  /** The Figma frame link and the image: required for an exploration (the developer builds from them), else optional. */
  frame: { required: boolean; link: string; image: string };
  /** The quiet switch between an exploration and a plain request, keeping what she typed. */
  swap: { to: ChangeFormMode; label: string } | null;
  submit: string;
  busy: string;
  /** The signed-out final action: it opens the GitHub connect dialog. */
  connect: string;
  /** What blocks the submit, per empty field, saying how to fix it. */
  missing: { title: string; summary: string; frame: string };
}

/** The words of the form in each mode. */
export function changeFormCopy(mode: ChangeFormMode, component: string, signIn = false): ChangeFormCopy {
  const add = { label: 'What to add', placeholder: 'A danger ghost variant' };
  const why = { label: 'What it is for', placeholder: `Where you need it, and how it differs from the ${component} we have.` };
  const missing = { title: 'Say what to add, for example "A danger ghost variant".', summary: 'Say what it is for and where you need it.', frame: FRAME_MISSING };
  const optional = { required: false, link: 'Figma link (optional)', image: 'Image (optional)' };
  if (mode === 'explore')
    return {
      heading: 'Describe the new option',
      title: add,
      summary: why,
      changes: false,
      frame: { required: true, link: 'Figma link', image: 'Image' },
      swap: { to: 'ask', label: 'Send a plain request instead' },
      submit: 'Start exploration',
      busy: 'Starting exploration',
      connect: ghAction('start', signIn),
      missing,
    };
  if (mode === 'ask')
    return {
      heading: 'Ask a developer',
      title: add,
      summary: why,
      changes: false,
      frame: optional,
      swap: { to: 'explore', label: 'Start an exploration instead' },
      submit: 'Send to a developer',
      busy: 'Sending',
      connect: ghAction('send', signIn),
      missing,
    };
  return {
    heading: 'Report a mismatch',
    title: { label: 'What looks wrong', placeholder: 'The focus ring is thinner than in Figma' },
    summary: { label: 'Details', placeholder: 'Where you saw it, what Figma shows, and what it does instead.' },
    changes: true,
    frame: optional,
    swap: null,
    submit: 'Send report',
    busy: 'Sending report',
    connect: ghAction('send', signIn),
    missing: { title: 'Say what looks wrong, for example "The focus ring is thinner than in Figma".', summary: 'Add the details: where you saw it and what Figma shows.', frame: FRAME_MISSING },
  };
}

/** Said when an exploration has neither a Figma link nor an image. */
export const FRAME_MISSING = 'Add the Figma frame link or an image: the developer builds it from your design.';

/**
 * Problems that block the submit, in the words of the form she sees. Empty when it can be sent. An exploration needs a
 * Figma link or an image (`figma`, `image`): without the design, nobody can build it.
 */
export function changeFormProblems(mode: ChangeFormMode, f: { title: string; summary: string; figma?: string; image?: boolean }): string[] {
  const { missing, frame } = changeFormCopy(mode, '');
  const noFrame = frame.required && !(f.figma ?? '').trim() && !f.image;
  return [...(f.title.trim() ? [] : [missing.title]), ...(f.summary.trim() ? [] : [missing.summary]), ...(noFrame ? [missing.frame] : [])];
}

/** The request a form sends: the existing request shape, with the kind its mode stands for. */
export function changeRequest(component: string, mode: ChangeFormMode, f: Omit<RequestForm, 'kind'>, requestedBy?: string): ComponentChangeRequest {
  const changes = REQUEST_KIND_OF[mode] === 'bug' ? f.changes : [];
  return requestFromForm(component, { ...f, kind: REQUEST_KIND_OF[mode], changes }, requestedBy);
}

/** What the drawer says once the request is sent, in the designer's words. */
export function sentLine(mode: Exclude<ChangeFormMode, 'explore'>, n: number): string {
  return mode === 'mismatch' ? `Report #${n} sent. It closes when the fix ships.` : `Request #${n} sent. It closes when the change ships.`;
}

/** What the drawer says once the exploration started: a developer builds it with Claude, from the message she sends. */
export function startedLines(name: string, request: number): { lead: string; next: string } {
  return {
    lead: `${name} is ready for a developer.`,
    next: `A developer builds request #${request} with Claude, in the exploration. Copy the message below and send it to them. You check the result in the component sandbox, then send it for review.`,
  };
}

/** The label of the copy button under the message, and what it says once copied. */
export const COPY_MESSAGE = { label: 'Copy message', done: 'Message copied', field: 'Message for the developer' } as const;

/**
 * The message a designer sends a developer once the exploration started: what to build, the design (Figma frame,
 * image), where it lives in Studio, and what to say to Claude. Plain text, ready to paste in chat or email.
 */
export function developerMessage(x: { component: string; title: string; request: number; figma?: string | null; image?: string | null; exploration: string; requestUrl?: string | null }): string {
  return [
    `Hi, can you build this ${x.component} change with Claude? ${x.title.trim()}`,
    '',
    ...(x.figma ? [`Figma frame: ${x.figma}`] : []),
    ...(x.image ? [`Image: ${x.image}`] : []),
    ...(x.requestUrl ? [`Request: ${x.requestUrl}`] : []),
    `Exploration in Studio: ${x.exploration}`,
    '',
    `In Claude Code with the Bridge MCP server, say "build Bridge request #${x.request}". Claude reads the request and the design, then works in the exploration. I check it in the sandbox and send it for review.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// "Change this component" on a team (the hosted Components drawer, components/ds/studio/ChangeComponent.tsx). The
// same three paths as Bridge's own drawer, for a team whose developers build from build requests
// (docs/BUILD-REQUESTS.md): "Adjust the look" leads to the team's token editor; "Add a variant or option" (a variant,
// an option or a layout) and "Something looks wrong" each file one build request, the same issue the Figma plugin
// files (@bridge-ds/core composeBuildRequestIssue), so Being built, the CLI and the MCP server read it the same way.

/** The intents on a team: the same three, the second one said for a build request. */
export const TEAM_CHANGE_INTENTS: IntentOption[] = [
  CHANGE_INTENTS[0]!,
  {
    value: 'variant',
    label: 'Add a variant or option',
    line: 'A new variant, size, option or layout, designed in Figma. Your developers build it from your Figma frame, and you follow it in Being built until it is in the library.',
  },
  { value: 'wrong', label: 'Something looks wrong', line: 'It does not match Figma. Your developers get the report with the frame and fix it.' },
];

/**
 * A team's intents: the three of Bridge's own drawer, plus "Change how it behaves" (behavior requests, decided by the
 * design system lead before developers build them). Bridge's own drawer (scripts/request-form.ts) keeps its three.
 */
export type TeamChangeIntent = ChangeIntent | 'behave';

export interface TeamIntentOption {
  value: TeamChangeIntent;
  label: string;
  line: string;
}

/** The fourth intent on a team: how the component behaves when people use it. */
export const BEHAVE_INTENT: TeamIntentOption = {
  value: 'behave',
  label: 'Change how it behaves',
  line: 'What it does when people use it, like what Escape or Enter does. The design system lead decides, then your developers build it.',
};

export const isTeamChangeIntent = (x: unknown): x is TeamChangeIntent => isChangeIntent(x) || x === 'behave';

/** The intent options of a team's component: "Adjust the look" is off when it has no token to edit. */
export function teamIntentOptions(hasTokens: boolean): (TeamIntentOption & { disabled: boolean })[] {
  return [...TEAM_CHANGE_INTENTS, BEHAVE_INTENT].map((o) => (o.value === 'look' && !hasTokens ? { ...o, line: NO_TOKEN_LINE, disabled: true } : { ...o, disabled: false }));
}

/** The form on a team: a structure change or a mismatch report. Null for "Adjust the look" (a link). */
export type BuildFormMode = 'structure' | 'mismatch';

export const buildModeFor = (intent: TeamChangeIntent): BuildFormMode | null => (intent === 'variant' ? 'structure' : intent === 'wrong' ? 'mismatch' : null);

/** What kind of structure change, in her words, and the build request kind it files. */
export const STRUCTURE_KINDS: { value: 'new-variant' | 'prop-change' | 'structure'; label: string }[] = [
  { value: 'new-variant', label: 'A new variant or size' },
  { value: 'prop-change', label: 'A new or changed option' },
  { value: 'structure', label: 'A layout change' },
];

export type StructureKind = (typeof STRUCTURE_KINDS)[number]['value'];

export const isStructureKind = (x: unknown): x is StructureKind => STRUCTURE_KINDS.some((k) => k.value === x);

/** The kind a mismatch report files: the same as on Bridge's own drawer (REQUEST_KIND_OF.mismatch). */
export const MISMATCH_KIND: RequestKind = REQUEST_KIND_OF.mismatch;

/** Said when a structure change has no Figma link: on a team the frame link is the design. */
export const TEAM_FRAME_MISSING = 'Add the Figma frame link: your developers build it from your design.';

export interface BuildFormCopy {
  heading: string;
  title: { label: string; placeholder: string };
  summary: { label: string; placeholder: string };
  /** The "What differs" rows: only a mismatch lists values. */
  changes: boolean;
  /** The kind picker: only a structure change has one. */
  kind: boolean;
  figma: { required: boolean; label: string };
  submit: string;
  busy: string;
  missing: { title: string; summary: string; figma: string };
}

/** The words of the team form in each mode. */
export function buildFormCopy(mode: BuildFormMode, component: string): BuildFormCopy {
  if (mode === 'structure')
    return {
      heading: 'Describe the change',
      title: { label: 'What to add or change', placeholder: 'A danger ghost variant' },
      summary: { label: 'What it is for', placeholder: `Where you need it, and how it differs from the ${component} we have.` },
      changes: false,
      kind: true,
      figma: { required: true, label: 'Figma link' },
      submit: 'Send to developers',
      busy: 'Sending',
      missing: { title: 'Say what to add or change, for example "A danger ghost variant".', summary: 'Say what it is for and where you need it.', figma: TEAM_FRAME_MISSING },
    };
  const copy = changeFormCopy('mismatch', component);
  return {
    heading: copy.heading,
    title: copy.title,
    summary: copy.summary,
    changes: true,
    kind: false,
    figma: { required: false, label: 'Figma link (optional)' },
    submit: copy.submit,
    busy: copy.busy,
    missing: { title: copy.missing.title, summary: copy.missing.summary, figma: TEAM_FRAME_MISSING },
  };
}

/** Problems that block the send, in the words of the form she sees. Empty when it can be sent. */
export function buildFormProblems(mode: BuildFormMode, f: { title: string; summary: string; figma: string }): string[] {
  const { missing, figma } = buildFormCopy(mode, '');
  const noFrame = figma.required && !f.figma.trim();
  return [...(f.title.trim() ? [] : [missing.title]), ...(f.summary.trim() ? [] : [missing.summary]), ...(noFrame ? [missing.figma] : [])];
}

/** The form a team's drawer reads. `figma` is what `figmaFromLink` made of the link (undefined when empty). */
export interface BuildForm {
  kind: StructureKind;
  title: string;
  summary: string;
  changes: { field: string; before: string; after: string }[];
  figma?: { url: string; fileKey?: string; nodeId?: string } | undefined;
}

/**
 * The build request a team's form files (core BuildRequestInput, source "studio"): a structure change with the kind she
 * picked, or a mismatch report (kind bug) with the rows she filled. `requestedBy` is the GitHub login when there is one;
 * an email member is named by Bridge's server ("Requested by ... through Bridge.").
 */
export function teamBuildRequest(component: string, mode: BuildFormMode, f: BuildForm, requestedBy?: string | null): BuildRequestInput {
  const r = requestFromForm(component, { kind: mode === 'mismatch' ? MISMATCH_KIND : f.kind, title: f.title, summary: f.summary, changes: mode === 'mismatch' ? f.changes : [] });
  return {
    component: r.component,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    ...(r.changes.length ? { changes: r.changes } : {}),
    figma: f.figma ?? {},
    source: 'studio',
    ...(requestedBy ? { requestedBy } : {}),
  };
}

/** What the drawer says once it is sent, and where she follows it. */
export function buildSentLines(mode: BuildFormMode, n: number): { lead: string; next: string; link: string } {
  return mode === 'mismatch'
    ? { lead: `Report #${n} sent to your developers.`, next: 'It reads Shipped in Being built once the fix is in the library.', link: 'Follow it in Being built' }
    : { lead: `Build request #${n} sent to your developers.`, next: 'You follow it in Being built until it is in the library.', link: 'Follow it in Being built' };
}

/**
 * Said above the Components list when a home's "Ask for a component change" led here without a component
 * (?intent=variant): the next step, in one line.
 */
export const PICK_COMPONENT_LINE = 'Pick the component you want to change, then choose Change this component.';

// ---------------------------------------------------------------------------------------------------------------
// "Change how it behaves" (a component's behaviors) and "Suggest a change to this pattern" (an action pattern's rules):
// one short form that files a behavior request (@bridge-ds/core behaviorRequestOf, kind `behavior`). It waits for the
// design system lead, who makes it the default (it becomes a build request in Being built) or says why not now.

/** The choice for something the component or the pattern does not do yet. */
export const BEHAVIOR_NEW = 'new';

export interface BehaviorChoice {
  value: string;
  label: string;
}

/** What she picks from: the component's own behaviors, in its own words, then "Something it does not do yet". */
export function behaviorChoices(behaviors: readonly { id: string; text: string }[]): BehaviorChoice[] {
  return [...behaviors.map((b) => ({ value: b.id, label: b.text })), { value: BEHAVIOR_NEW, label: 'Something it does not do yet' }];
}

/** The rules of an action pattern, by place ("rule-0"), then "Something it does not do yet". */
export function ruleChoices(rules: readonly string[]): BehaviorChoice[] {
  return [...rules.map((text, i) => ({ value: `rule-${i}`, label: text })), { value: BEHAVIOR_NEW, label: 'Something it does not do yet' }];
}

export interface BehaviorFormCopy {
  heading: string;
  which: { label: string; placeholder: string };
  wanted: string;
  where: { label: string; hint: string };
  submit: string;
  busy: string;
  missing: { which: string; wanted: string };
}

/**
 * The words of the form, for a component's behavior or an action pattern's rule. `choice`: what she picked. `lead`: the
 * team's one design lead by first name (lib/design-lead soleLeadName), else null for "the design system lead".
 */
export function behaviorFormCopy(of: 'component' | 'pattern', choice: string | null, lead: string | null = null): BehaviorFormCopy {
  const what = of === 'pattern' ? 'rule' : 'behavior';
  return {
    heading: of === 'pattern' ? 'Suggest a change to this pattern' : 'Change how it behaves',
    which: { label: `Which ${what}`, placeholder: `Pick a ${what}` },
    wanted: choice === BEHAVIOR_NEW ? 'What should it do?' : 'What should it do instead?',
    where: { label: 'Where it gets in the way (optional)', hint: 'A screen or a product.' },
    submit: `Send to ${lead ?? 'the design system lead'}`,
    busy: 'Sending',
    missing: { which: `Pick the ${what} you want to change, or Something it does not do yet.`, wanted: 'Say what it should do, in a sentence.' },
  };
}

/** Problems that block the send, in the words of the form. Empty when it can be sent. */
export function behaviorFormProblems(of: 'component' | 'pattern', f: { choice: string | null; wanted: string }): string[] {
  const { missing } = behaviorFormCopy(of, f.choice);
  return [...(f.choice ? [] : [missing.which]), ...(f.wanted.trim() ? [] : [missing.wanted])];
}

/**
 * The behavior request the form files. A component: `id` its name, the behavior picked by id. A pattern: `id` its id,
 * the rule by its place; the issue starts with "<Name> pattern". Today's sentence is the one the Library shows.
 */
export function behaviorRequest(
  target: { of: 'component'; name: string; behaviors: readonly { id: string; text: string }[] } | { of: 'pattern'; id: string; name: string; rules: readonly string[] },
  f: { choice: string; wanted: string; where: string },
  requestedBy?: string | null,
): ComponentChangeRequest {
  const isNew = f.choice === BEHAVIOR_NEW;
  let ask: BehaviorAsk;
  if (target.of === 'component') {
    const picked = isNew ? undefined : target.behaviors.find((b) => b.id === f.choice);
    ask = { of: 'component', id: target.name, ...(picked ? { behavior: picked.id } : {}), today: picked?.text ?? '', wanted: f.wanted, where: f.where };
  } else {
    const i = isNew ? -1 : Number(/^rule-(\d+)$/.exec(f.choice)?.[1] ?? -1);
    const rule = i >= 0 ? target.rules[i] : undefined;
    ask = { of: 'pattern', id: target.id, ...(rule !== undefined ? { rule: i } : {}), today: rule ?? '', wanted: f.wanted, where: f.where };
  }
  return behaviorRequestOf(target.of === 'pattern' ? `${target.name} pattern` : target.name, ask, { source: 'studio', requestedBy });
}

/** What the form says once sent, and where she follows it (the request in Studio). `lead`: as in behaviorFormCopy. */
export function behaviorSentLines(n: number, lead: string | null = null): { lead: string; next: string; link: string } {
  return { lead: `Request #${n} sent to ${lead ?? 'the design system lead'}.`, next: `${lead ?? 'They'} decide${lead ? 's' : ''}. Once it is the default, your developers build it.`, link: 'Follow your request' };
}

// ---------------------------------------------------------------------------------------------------------------
// "Suggest a pattern" on Studio > Patterns (components/ds/studio/PatternSuggest.tsx) and "Ask another component to do
// this" in a pattern's drawer: two more targets of the same behavior request, decided by the design system lead in
// the same place. Nothing here creates a pattern: a pattern exists once a developer merged its file and the repository
// test checked it against the code (an action's places, an interaction's two components).

/** What a suggestion shares: a behavior components should do the same way, or an action people take in places. */
export type PatternSuggestKind = 'interaction' | 'action';

export const SUGGEST_KINDS: { value: PatternSuggestKind; title: string; line: string }[] = [
  { value: 'interaction', title: 'Something components should do the same way', line: 'A behavior one component has, like Type to jump. You ask another component to do it too.' },
  { value: 'action', title: 'An action people take in several places', line: 'Like Archive or Delete. You name the places where people do it today.' },
];

export const isPatternSuggestKind = (x: unknown): x is PatternSuggestKind => x === 'interaction' || x === 'action';

/** The words of the "Suggest a pattern" drawer and its entry points. `lead`: as in behaviorFormCopy. */
export function suggestPatternCopy(lead: string | null = null) {
  return {
    open: 'Suggest a pattern',
    title: 'Suggest a pattern',
    description: `${lead ?? 'The design system lead'} decides, then your developers make it a pattern. It shows here once it is in the code.`,
    kind: 'What do you want to share?',
    submit: `Send to ${lead ?? 'the design system lead'}`,
    busy: 'Sending',
    /** The empty state's sentence for someone who can suggest one. */
    empty: `A pattern is an interaction several components share, or an action people take across the product. Seen one in your products? Suggest it: ${lead ?? 'the design system lead'} decides, then your developers add it.`,
  } as const;
}

/** One place people do a proposed action today, as the form holds it. */
export interface PlaceDraft {
  screen: string;
  label: string;
  link: string;
}

export const EMPTY_PLACE: PlaceDraft = { screen: '', label: '', link: '' };

/** A new action, as the form holds it. `rules`: one rule per line. */
export interface NewPatternDraft {
  name: string;
  purpose: string;
  rules: string;
  places: PlaceDraft[];
}

export const EMPTY_NEW_PATTERN: NewPatternDraft = { name: '', purpose: '', rules: '', places: [EMPTY_PLACE, EMPTY_PLACE] };

/** The fewest places a new action needs, as a pattern file does (core validatePattern). */
export const MIN_PLACES = 2;

export const NEW_PATTERN_COPY = {
  name: { label: 'Name', hint: 'The verb people read on the button.' },
  purpose: 'What it is for',
  rules: { label: 'Its rules, as people see them', hint: 'One rule per line.' },
  places: { title: 'Where people do it today', line: 'At least two places: the screen, and the label people read there.' },
  place: (n: number) => `Place ${n}`,
  screen: { label: 'Screen', placeholder: 'Acme CRM, Deals list' },
  label: { label: 'What people read there', placeholder: 'Archive deal' },
  link: { label: 'Link or image (optional)', placeholder: 'A Figma frame or a page' },
  remove: (n: number) => `Remove place ${n}`,
  add: 'Add a place',
  missing: {
    name: 'Name the action, like Archive.',
    purpose: 'Say what it is for, in a sentence.',
    rules: 'Write at least one rule, as people see it.',
    places: 'Name at least two places where people do it today: the screen and the label they read.',
  },
  /** A name that is a pattern already: the words before the link that opens it. */
  duplicate: (name: string) => `${name} is already a pattern.`,
  duplicateLink: 'Suggest a change to it instead.',
} as const;

/** The kebab-case id a proposed name would have ("Move to archive" -> "move-to-archive"). */
export const patternIdFrom = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The pattern a proposed name already is (same name or same id, any case), or undefined. */
export function duplicatePattern<T extends { id: string; name: string }>(name: string, patterns: readonly T[]): T | undefined {
  const n = name.trim().toLowerCase();
  const id = patternIdFrom(name);
  if (!n) return undefined;
  return patterns.find((p) => p.name.trim().toLowerCase() === n || (id && p.id === id));
}

/** The rules of the form, one per line, blank lines left out. */
export const rulesOfText = (text: string): string[] =>
  text
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

/** The places with a screen and a label: the ones that count. */
export const filledPlaces = (places: readonly PlaceDraft[]): PlaceDraft[] => places.filter((p) => p.screen.trim() && p.label.trim());

/** What blocks the send of a new action, per field (empty when it can be sent). `patterns`: the rows of the page. */
export function newPatternProblems(f: NewPatternDraft, patterns: readonly { id: string; name: string }[]): { name?: string; duplicate?: string; purpose?: string; rules?: string; places?: string } {
  const m = NEW_PATTERN_COPY.missing;
  const dup = duplicatePattern(f.name, patterns);
  return {
    ...(f.name.trim() ? {} : { name: m.name }),
    ...(dup ? { duplicate: dup.id } : {}),
    ...(f.purpose.trim() ? {} : { purpose: m.purpose }),
    ...(rulesOfText(f.rules).length ? {} : { rules: m.rules }),
    ...(filledPlaces(f.places).length >= MIN_PLACES ? {} : { places: m.places }),
  };
}

/** The behavior request a new action files: a pattern ask with its proposed id, its rules and its places. */
export function newPatternRequest(f: NewPatternDraft, requestedBy?: string | null): ComponentChangeRequest {
  const name = f.name.trim();
  const ask: BehaviorAsk = {
    of: 'pattern',
    id: patternIdFrom(name),
    today: '',
    wanted: f.purpose,
    rules: rulesOfText(f.rules),
    places: filledPlaces(f.places).map((p) => ({ screen: p.screen.trim(), label: p.label.trim(), ...(p.link.trim() ? { link: p.link.trim() } : {}) })),
  };
  return behaviorRequestOf(`${name} pattern`, ask, { source: 'studio', requestedBy });
}

/** A component of the team as the adoption picker reads it: its name and its own behaviors (docs.json). */
export interface BehaviorHolder {
  name: string;
  behaviors: readonly { id: string; text: string }[];
}

/** A behavior some component has: its id, its words, the components that list it. */
export interface SharedBehaviorChoice {
  value: string;
  label: string;
  /** The components that already do it. */
  by: string[];
}

/**
 * The behaviors a component already has that are not an interaction yet ("Type to jump, from Select"), in component
 * order, each once: what "Something components should do the same way" offers. `interactions`: the interaction rows'
 * ids, which their own drawer asks about.
 */
export function sharedBehaviorChoices(components: readonly BehaviorHolder[], interactions: ReadonlySet<string> = new Set()): SharedBehaviorChoice[] {
  const out = new Map<string, SharedBehaviorChoice>();
  for (const c of components)
    for (const b of c.behaviors) {
      if (interactions.has(b.id)) continue;
      const seen = out.get(b.id);
      if (seen) seen.by.push(c.name);
      else out.set(b.id, { value: b.id, label: b.text, by: [c.name] });
    }
  return [...out.values()].map((x) => ({ ...x, label: `${x.label}, from ${x.by.join(', ')}` }));
}

/** The components that do not list `behavior` yet, in component order: who can be asked to do it too. */
export const adopterChoices = (components: readonly BehaviorHolder[], behavior: string | null): { value: string; label: string }[] =>
  behavior ? components.filter((c) => !c.behaviors.some((b) => b.id === behavior)).map((c) => ({ value: c.name, label: c.name })) : [];

/** The words of the adoption form. `fromRow`: in a pattern's drawer, where the behavior is the row's. */
export function adoptFormCopy(fromRow: boolean, lead: string | null = null) {
  return {
    heading: 'Ask another component to do this',
    behavior: { label: 'Which behavior?', hint: 'What one component does today, from the Library.', placeholder: 'Pick a behavior' },
    component: { label: fromRow ? 'Which component?' : 'Which component should do it too?', hint: 'Only components that do not do it yet.', placeholder: 'Pick a component' },
    loading: 'Reading the components',
    none: 'Every component already does this.',
    noBehavior: 'No component lists a behavior yet. Start from a component: Change how it behaves.',
    wanted: 'What should it do?',
    where: { label: 'Where it gets in the way (optional)', hint: 'A screen or a product.' },
    after: fromRow
      ? `${lead ?? 'The design system lead'} decides. Once it is the default, your developers build it and it shows here.`
      : 'Once two components do it, it shows here as an interaction. Your developers give it its name.',
    submit: `Send to ${lead ?? 'the design system lead'}`,
    busy: 'Sending',
    missing: { behavior: 'Pick the behavior to share.', component: 'Pick the component that should do it too.', wanted: 'Say what it should do, in a sentence.' },
  } as const;
}

/** An adoption, as the form holds it. */
export interface AdoptDraft {
  behavior: string | null;
  component: string | null;
  wanted: string;
  where: string;
}

/** What blocks the send of an adoption (empty when it can be sent). */
export function adoptProblems(f: AdoptDraft): { behavior?: string; component?: string; wanted?: string } {
  const m = adoptFormCopy(false).missing;
  return { ...(f.behavior ? {} : { behavior: m.behavior }), ...(f.component ? {} : { component: m.component }), ...(f.wanted.trim() ? {} : { wanted: m.wanted }) };
}

/**
 * The behavior request an adoption files: a component ask on the component that should do it, with the behavior id
 * and no sentence for today (it does not do it yet). Studio > Patterns shows it on that interaction's row, or in the
 * lead's "Asked, not patterns yet" line while no interaction has that id (lib/studio-patterns.ts askedNotPatterns).
 */
export function adoptRequest(f: AdoptDraft & { behavior: string; component: string }, requestedBy?: string | null): ComponentChangeRequest {
  return behaviorRequestOf(f.component, { of: 'component', id: f.component, behavior: f.behavior, today: '', wanted: f.wanted, where: f.where }, { source: 'studio', requestedBy });
}

/**
 * "Suggest a change" on an interaction's drawer: the shared behavior as one component does it, changed. It files the
 * component behavior request (behaviorRequest, that behavior picked), which Studio > Patterns shows on the row.
 */
export function interactionChangeCopy(lead: string | null = null) {
  return {
    heading: 'Suggest a change to this behavior',
    open: 'Suggest a change',
    which: { label: 'On which component?', placeholder: 'Pick a component', hint: 'Each one says it in its own words, from the Library.' },
    wanted: 'What should it do instead?',
    where: { label: 'Where it gets in the way (optional)', hint: 'A screen or a product.' },
    submit: `Send to ${lead ?? 'the design system lead'}`,
    missing: { which: 'Pick the component whose behavior you want to change.', wanted: 'Say what it should do, in a sentence.' },
  } as const;
}

/** The words of a pattern's drawer. */
export function patternDrawerCopy(lead: string | null = null) {
  return {
    components: 'Components that do it',
    uses: 'Components it uses',
    library: 'Open in Library',
    back: 'Back',
    close: 'Close',
    /** The lead's section: what waits for their decision on this pattern. */
    waiting: (n: number) => `${n} ${n === 1 ? 'waits' : 'wait'} for your decision`,
    after: `${lead ?? 'The design system lead'} decides. Once it is the default, your developers build it and it shows here.`,
  } as const;
}
