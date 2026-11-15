// Component change requests: a designer asks for a new component or a change to a coded one (variant, prop, structure,
// visual, token binding, bug) from Figma or Studio. Variable edits never become requests: they are pull requests
// people approve (tokens are data). Components need code, so they become requests. Code stays the source of truth, so a request never rewrites React: it lands as
// a GitHub issue that people (or Claude, through the MCP server or the CLI) implement in a pull request that closes it.
// Shared by the Figma plugin, Studio, the MCP server, the CLI and the Jira Action, so a request reads the same
// everywhere. The issue body is plain Markdown for people plus one hidden JSON block for tools.

import { draftBehaviorText } from './change-drafts';
import { EXPLORATION_LABEL, explorationRules } from './explorations';
import { subjectTitle } from './titles';

export type RequestKind = 'new-component' | 'new-variant' | 'prop-change' | 'structure' | 'visual' | 'token-binding' | 'bug' | 'behavior' | 'other';
export type RequestSource = 'figma' | 'studio' | 'cli' | 'mcp';
export type RequestStatus = 'requested' | 'in-progress' | 'done' | 'declined';

export const REQUEST_KINDS: { value: RequestKind; label: string; hint: string }[] = [
  { value: 'new-component', label: 'New component', hint: 'A component the design system does not have yet.' },
  { value: 'new-variant', label: 'New variant', hint: 'A size, tone or state the component does not have yet.' },
  { value: 'prop-change', label: 'Option change (prop)', hint: 'Add, rename or change an option (a prop in code) or its default.' },
  { value: 'structure', label: 'Structure change', hint: 'A part was added, removed or moved.' },
  { value: 'visual', label: 'Visual change', hint: 'Spacing, radius, layout or icon placement.' },
  { value: 'token-binding', label: 'Token change', hint: 'The component should paint with another token.' },
  { value: 'bug', label: 'Bug', hint: 'It looks or behaves differently from the guidance.' },
  { value: 'behavior', label: 'Behavior change', hint: 'How a component or an action pattern behaves: one of its behaviors or rules, or something it does not do yet.' },
  { value: 'other', label: 'Other', hint: 'Anything else.' },
];

/** Every request issue carries this label; tools list requests by it. */
export const REQUEST_LABEL = 'component-change';

export interface RequestChange {
  /** What changes: a prop, a variant axis, a token, a part ("radius", "size", "color.action.primary.bg"). */
  field: string;
  before?: string | undefined;
  after?: string | undefined;
}

export interface ComponentChangeRequest {
  /** Component name as exported ("Button"), or the proposed name of a new component. */
  component: string;
  kind: RequestKind;
  /** One line, sentence case: "Add a danger ghost variant". */
  title: string;
  /** What and why, in the requester's words. */
  summary: string;
  /**
   * What changed for developers in one sentence ("Icon added after the label in primary sm: Pencil, 16px"): written
   * by Claude from the before and after images, or drafted from the detected changes. Optional.
   */
  line?: string | undefined;
  changes: RequestChange[];
  /** Where the design lives, when it comes from Figma. */
  figma?: { fileKey?: string | undefined; nodeId?: string | undefined; nodeName?: string | undefined; url?: string | undefined } | undefined;
  /** Image URLs (Figma exports committed to the requests branch, or links). */
  images?: string[] | undefined;
  source: RequestSource;
  /** GitHub login, when known. */
  requestedBy?: string | undefined;
  /**
   * Exploration branch (`explore/<slug>`) to implement it on instead of a pull request to main. The issue gets the
   * `exploration` label and the brief says to work on that branch (docs/EXPLORATIONS.md).
   */
  exploration?: string | undefined;
  /** Build request details (before and after images, props needed, spec path): build-requests.ts. */
  build?: import('./build-requests').BuildRequestExtra | undefined;
  /**
   * Where the change comes from, when an exploration needs it ("Add to the library" on its page, or its Looks right):
   * the Changes Library row says "Needed by <name> · <product>". Unset for a change the DS lead starts.
   */
  origin?: RequestOrigin | undefined;
  /** A behavior request (kind `behavior`): which behavior or rule, today's sentence and the wanted one. */
  behavior?: BehaviorAsk | undefined;
}

/**
 * What a behavior request asks (phase 2 of behaviors): one behavior of a component (its docs.json `behaviors`,
 * behaviors.ts) or one rule of an action pattern (patterns/<id>.pattern.json, patterns.ts), or something it does not do
 * yet, and what it should do instead. The design system lead decides: made the default, it becomes a build request
 * (the `bridge-build` label, build-requests.ts); not now, it is declined with a reason.
 */
export interface BehaviorAsk {
  of: 'component' | 'pattern';
  /** The component name ("Select") or the pattern id ("delete"). */
  id: string;
  /** The behavior id ("close-on-escape"), for a component behavior. Absent for something it does not do yet. */
  behavior?: string | undefined;
  /** The rule's place in the pattern's `rules`, from 0, for a pattern rule. Absent for something it does not do yet. */
  rule?: number | undefined;
  /** Today's sentence, as the Library says it. Empty for something it does not do yet. */
  today: string;
  /** What it should do instead, in the requester's words. */
  wanted: string;
  /** Where it gets in the way (a screen, a product), when the requester said. */
  where?: string | undefined;
}

/** The label of a behavior request (every request carries `request: <kind>`). */
export const BEHAVIOR_REQUEST_LABEL = 'request: behavior';

const isText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

/** The behavior ask of a request, checked (a body anyone can edit may hold any shape), or null when it has none. */
export function behaviorAskOf(r: Pick<ComponentChangeRequest, 'kind' | 'behavior'> | null | undefined): BehaviorAsk | null {
  const b = r?.behavior as Partial<BehaviorAsk> | undefined;
  if (!b || r?.kind !== 'behavior' || typeof b !== 'object') return null;
  if ((b.of !== 'component' && b.of !== 'pattern') || !isText(b.id) || !isText(b.wanted) || typeof (b.today ?? '') !== 'string') return null;
  const rule = typeof b.rule === 'number' && Number.isInteger(b.rule) && b.rule >= 0 ? b.rule : undefined;
  return {
    of: b.of,
    id: b.id.trim(),
    ...(isText(b.behavior) ? { behavior: b.behavior.trim() } : {}),
    ...(rule !== undefined ? { rule } : {}),
    today: (b.today ?? '').trim(),
    wanted: b.wanted.trim(),
    ...(isText(b.where) ? { where: b.where.trim() } : {}),
  };
}

/**
 * The request a behavior ask files: kind `behavior`, its title and summary drafted from the two sentences
 * (change-drafts draftBehaviorText), and one change row (what, today, wanted) so every reader of requests shows it.
 * `subject` is what the issue title starts with: the component name, or "<Pattern name> pattern".
 */
export function behaviorRequestOf(subject: string, ask: BehaviorAsk, opts: { source?: RequestSource; requestedBy?: string | null | undefined } = {}): ComponentChangeRequest {
  const clean: BehaviorAsk = {
    of: ask.of,
    id: ask.id.trim(),
    ...(ask.behavior?.trim() ? { behavior: ask.behavior.trim() } : {}),
    ...(ask.rule !== undefined ? { rule: ask.rule } : {}),
    today: ask.today.trim(),
    wanted: ask.wanted.trim(),
    ...(ask.where?.trim() ? { where: ask.where.trim() } : {}),
  };
  const text = draftBehaviorText(subject, clean);
  const field = clean.behavior ?? (clean.rule !== undefined ? `Rule ${clean.rule + 1}` : 'New behavior');
  return {
    component: subject.trim(),
    kind: 'behavior',
    title: text.title,
    summary: text.summary,
    changes: [{ field, ...(clean.today ? { before: clean.today } : {}), after: clean.wanted }],
    source: opts.source ?? 'studio',
    ...(opts.requestedBy ? { requestedBy: opts.requestedBy } : {}),
    behavior: clean,
  };
}

/**
 * The exploration a library request comes from (decision 2026-11-09). `repo` is "owner/name" of the repository the
 * exploration lives in (a product's design copy, or the design system's own), `number` its pull request, `product` the
 * product's key in bridge.config.json ("prints"; its name comes from there), `name` the exploration's name ("Order
 * fulfilment timeline").
 */
export interface ExplorationRequestOrigin {
  kind: 'exploration';
  repo: string;
  number: number;
  product: string;
  name: string;
}

/**
 * A group of a product's adoption report sent to developers from Studio ("Send to developers"): `product` the
 * product's key, `run` the audit id (audits/<run>.json on the bridge-data branch), `group` the group's key (core
 * adoptionPieces / adoptionValues, stable across runs), `name` its title in the report ("Buttons that look like ours
 * but aren't"), `url` the report's page in Studio.
 */
export interface AuditRequestOrigin {
  kind: 'audit';
  product: string;
  run: string;
  group: string;
  name: string;
  url?: string;
}

export type RequestOrigin = ExplorationRequestOrigin | AuditRequestOrigin;

/** The origin in a request's Bridge block, or null when it has none (or an unreadable one). */
export function requestOriginOf(r: Pick<ComponentChangeRequest, 'origin'> | null | undefined): RequestOrigin | null {
  const o = r?.origin as (Omit<Partial<ExplorationRequestOrigin>, 'kind'> & Omit<Partial<AuditRequestOrigin>, 'kind'> & { kind?: string }) | undefined;
  if (!o) return null;
  if (o.kind === 'exploration') return typeof o.repo === 'string' && typeof o.number === 'number' && typeof o.product === 'string' && typeof o.name === 'string' ? (o as ExplorationRequestOrigin) : null;
  if (o.kind === 'audit') return typeof o.product === 'string' && typeof o.run === 'string' && typeof o.group === 'string' && typeof o.name === 'string' ? (o as unknown as AuditRequestOrigin) : null;
  return null;
}

export interface RequestIssue {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

const MARK = 'bridge-request';
const kindLabel = (k: RequestKind) => REQUEST_KINDS.find((x) => x.value === k)?.label ?? 'Other';
const kindSlug = (k: RequestKind) => `request: ${k}`;

/**
 * Issue title: "Button: add a danger ghost variant". A behavior request's title is the wanted sentence, kept as written
 * ("Select: Tab picks the highlighted option"): its first word is often a key's name.
 */
export function requestIssueTitle(r: Pick<ComponentChangeRequest, 'component' | 'title'> & { kind?: RequestKind | null | undefined }): string {
  return subjectTitle(r.component, r.title, r.kind === 'behavior' ? [r.title.trim().split(/\s+/)[0] ?? ''] : []);
}

/** The GitHub issue for a request: readable Markdown, the labels tools filter on, and a hidden JSON block. */
export function composeRequestIssue(r: ComponentChangeRequest, opts: { labels?: string[]; assignees?: string[]; componentUrl?: string } = {}): RequestIssue {
  // "Now" only when something says what it is today: a piece from a product branch only knows what is requested.
  const now = r.changes.some((c) => c.before?.trim());
  const rows = !r.changes.length
    ? []
    : now
      ? ['| What | Now | Requested |', '| --- | --- | --- |', ...r.changes.map((c) => `| ${cell(c.field)} | ${cell(c.before ?? '')} | ${cell(c.after ?? '')} |`)]
      : ['| What | Requested |', '| --- | --- |', ...r.changes.map((c) => `| ${cell(c.field)} | ${cell(c.after ?? '')} |`)];
  const figma = r.figma?.url ? `[${r.figma.nodeName ?? 'Open in Figma'}](${r.figma.url})` : r.figma?.nodeName ? r.figma.nodeName : '';
  const body = [
    r.kind === 'new-component' ? `## New component request: ${r.component}` : `## ${kindLabel(r.kind)} request for ${r.component}`,
    '',
    r.summary.trim(),
    '',
    ...(r.line?.trim() ? [`**What changes:** ${r.line.trim()}`, ''] : []),
    ...(rows.length ? [...rows, ''] : []),
    ...(r.images?.length ? [...r.images.map((u, i) => `![${r.component} design ${i + 1}](${u})`), ''] : []),
    ...(figma ? [`**Design:** ${figma}`, ''] : []),
    ...(opts.componentUrl ? [`**Component:** ${opts.componentUrl}`, ''] : []),
    ...(r.kind === 'behavior' && r.behavior?.where?.trim() ? [`**Where it gets in the way:** ${r.behavior.where.trim()}`, ''] : []),
    ...(r.kind === 'behavior' ? ['**The design system lead decides first.** Build it once it carries the `bridge-build` label (made the default in Bridge Studio).', ''] : []),
    ...(r.exploration ? [`**Exploration:** \`${r.exploration}\`. Implement it on that branch, not in a pull request to main: it ships to product staging as a snapshot, and developers take the branch once the designer is done exploring.`, ''] : []),
    '## How to implement',
    '',
    r.exploration
      ? `Commit the change to \`${r.exploration}\` (its draft pull request is the place). With Claude: \`bridge request implement <number>\` (CLI) or the \`bridge_get_request\` MCP tool. The request closes when developers ship that branch.`
      : `Code is the source of truth: change the component in a pull request that says \`Closes #<this issue>\`, so this request closes when it merges. With Claude: \`bridge request implement <number>\` (CLI) or the \`bridge_get_request\` MCP tool.`,
    '',
    `<sub>Requested from ${sourceLabel(r.source)}${r.requestedBy ? ` by @${r.requestedBy}` : ''} with Bridge.</sub>`,
    '',
    `<!-- ${MARK} ${JSON.stringify(r)} -->`,
  ].join('\n');
  const labels = [...new Set([REQUEST_LABEL, kindSlug(r.kind), `source: ${r.source}`, ...(r.exploration ? [EXPLORATION_LABEL] : []), ...(opts.labels ?? [])])];
  return { title: requestIssueTitle(r), body, labels, assignees: opts.assignees ?? [] };
}

/** The request inside an issue body, or undefined when the body has no valid Bridge block. */
export function parseRequestIssue(body: string | null | undefined): ComponentChangeRequest | undefined {
  if (!body) return undefined;
  const m = new RegExp(`<!-- ${MARK} (\\{[\\s\\S]*?\\}) -->`).exec(body);
  if (!m) return undefined;
  try {
    const r = JSON.parse(m[1]!) as ComponentChangeRequest;
    return r && typeof r.component === 'string' && typeof r.title === 'string' ? { ...r, changes: Array.isArray(r.changes) ? r.changes : [] } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The issue body with the request linked to an exploration branch: the hidden block gets `exploration` (what the
 * Explorations view, the MCP server and the CLI read) and the readable part says where to implement it. The rest of the
 * body stays as people wrote it. Undefined when the body has no Bridge block (nothing to link).
 */
export function withRequestExploration(body: string | null | undefined, branch: string): string | undefined {
  const r = parseRequestIssue(body);
  if (!r || !body) return undefined;
  const block = new RegExp(`<!-- ${MARK} \\{[\\s\\S]*?\\} -->`);
  let out = body.replace(block, () => `<!-- ${MARK} ${JSON.stringify({ ...r, exploration: branch })} -->`);
  const line = `**Exploration:** \`${branch}\`. Implement it on that branch, not in a pull request to main: it ships to product staging as a snapshot, and developers take the branch once the designer is done exploring.`;
  if (/^\*\*Exploration:\*\* .*$/m.test(out)) out = out.replace(/^\*\*Exploration:\*\* .*$/m, () => line);
  else if (out.includes('\n## How to implement')) out = out.replace('\n## How to implement', () => `\n${line}\n\n## How to implement`);
  else out = out.replace(block, (m) => `${line}\n\n${m}`);
  return out;
}

/** Problems with a decline reason, as sentences that say how to fix them. */
export function declineReasonProblems(reason: string): string[] {
  const r = reason.trim();
  if (!r) return ['Say why, in one or two sentences: the requester reads it.'];
  if (r.length < 10) return ['Say a bit more, so the requester knows why: at least 10 characters.'];
  return [];
}

/**
 * Who acts, in a comment Bridge posts: a GitHub login (written @login), or an email member by name ({ name }), who has
 * no login (Bridge's server posts for them).
 */
export type RequestActor = string | { name: string } | null | undefined;

/** "@flo" for a login, "Dana" for an email member, null when unknown. */
export function requestActorText(by: RequestActor): string | null {
  if (!by) return null;
  if (typeof by === 'string') return by.replace(/^@/, '').trim() ? `@${by.replace(/^@/, '').trim()}` : null;
  return by.name.trim() || null;
}

const quoted = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');

/** The comment posted on a declined request: who declined it and why, in the decliner's words. */
export function declineComment(reason: string, by?: RequestActor): string {
  const who = requestActorText(by);
  return [`Declined${who ? ` by ${who}` : ''} in Bridge Studio.`, '', quoted(reason), '', '<sub>Closed as not planned. Reopen the issue if things change.</sub>'].join('\n');
}

/** The comment posted when the lead makes a behavior request the default: it now waits for a developer. */
export function behaviorDefaultComment(by?: RequestActor): string {
  const who = requestActorText(by);
  return [who ? `${who} made it the default in Bridge Studio.` : 'Made the default in Bridge Studio.', '', '<sub>It now waits for a developer in Being built (label `bridge-build`).</sub>'].join('\n');
}

/** Problems with a question to the requester, as sentences that say how to fix them. */
export function askRequesterProblems(text: string): string[] {
  return text.trim() ? [] : ['Write your question first: the requester reads it.'];
}

/**
 * The comment a lead's question to the requester posts: who asks (and the requester, mentioned when it is a login),
 * then the question as they wrote it. "Dana asks @mia, before deciding:".
 */
export function askRequesterComment(text: string, by?: RequestActor, requester?: string | null): string {
  const who = requestActorText(by);
  const to = requester && /^[A-Za-z0-9-]+$/.test(requester.replace(/^@/, '')) ? `@${requester.replace(/^@/, '')}` : '';
  const head = who ? `${who} asks${to ? ` ${to}` : ''}, before deciding:` : `A question${to ? ` for ${to}` : ''}, before deciding:`;
  return [head, '', quoted(text)].join('\n');
}

/**
 * Where a request stands: open with no linked pull request = requested; open with an open linked pull request =
 * in progress; closed as completed or by a merged pull request = done; closed otherwise = declined.
 */
export function requestStatus(issue: { state: 'open' | 'closed'; stateReason?: string | null | undefined; linkedPrs?: { state: 'open' | 'closed'; merged?: boolean }[] }): RequestStatus {
  const prs = issue.linkedPrs ?? [];
  if (issue.state === 'open') return prs.some((p) => p.state === 'open') ? 'in-progress' : 'requested';
  if (prs.some((p) => p.merged) || issue.stateReason === 'completed') return 'done';
  return 'declined';
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { requested: 'Requested', 'in-progress': 'In progress', done: 'Done', declined: 'Declined' };

/** Issue numbers a pull request body closes ("Closes #42", "fixes #7", "resolves #3"). */
export function closingIssueNumbers(body: string | null | undefined): number[] {
  const out = new Set<number>();
  for (const m of (body ?? '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) out.add(Number(m[1]));
  return [...out];
}

/** Path of a Figma image attached to a request, on the requests branch. */
export const REQUESTS_BRANCH = 'bridge-requests';
export function requestImagePath(component: string, date: Date): string {
  const slug = component.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'component';
  return `.bridge/requests/${slug}-${date.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')}.png`;
}

/**
 * The brief Claude gets to implement a request (CLI `bridge request implement`, MCP `bridge_get_request`): the request,
 * the component's files, the repo rules, and how to open the pull request so it closes the issue.
 */
export function requestBrief(r: ComponentChangeRequest, ctx: { issue: number; issueUrl?: string; files?: string[]; agentsFile?: string; exploration?: string | undefined }): string {
  const exploration = ctx.exploration ?? r.exploration;
  return [
    `Implement Bridge component change request #${ctx.issue}${ctx.issueUrl ? ` (${ctx.issueUrl})` : ''}.`,
    '',
    `Component: ${r.component}`,
    `Kind: ${kindLabel(r.kind)}`,
    `Request: ${r.title}`,
    ...(r.line?.trim() ? [`What changes: ${r.line.trim()}`] : []),
    '',
    r.summary.trim(),
    '',
    ...(r.changes.length ? ['Changes asked:', ...r.changes.map((c) => `- ${c.field}: ${c.before ?? '(none)'} -> ${c.after ?? '(removed)'}`), ''] : []),
    ...(r.figma?.url ? [`Design: ${r.figma.url}`, ''] : []),
    ...(r.images?.length ? ['Images:', ...r.images.map((u) => `- ${u}`), ''] : []),
    ...(ctx.files?.length ? ['Files of this component:', ...ctx.files.map((f) => `- ${f}`), ''] : []),
    'Rules:',
    `- Follow ${ctx.agentsFile ?? 'AGENTS.md'}: tokens only in component CSS, Base UI for behavior, states, tests, story, docs.json, changeset.`,
    '- A new component, prop or variant is Tier 2: open the pull request as a draft (new component: follow the new component checklist). A token add or rename is Tier 3: describe it, do not invent values.',
    ...(exploration
      ? [`- This request is part of the exploration ${exploration}.`, ...explorationRules(exploration), `- Reference the request in the commit message ("Refs #${ctx.issue}"). Shipping the exploration closes it.`]
      : [`- Work on a branch named agent/request-${ctx.issue}. The pull request body must contain "Closes #${ctx.issue}".`]),
    // Sent from a product's adoption report: the pull request says so too, so Bridge's Changes row names the report.
    ...(r.kind === 'behavior' && r.behavior
      ? [
          r.behavior.of === 'pattern'
            ? `- It changes a rule of the ${r.behavior.id} pattern: update patterns/${r.behavior.id}.pattern.json and the places it lists in usedIn, so the pattern and the product stay the same.`
            : `- It changes how ${r.component} behaves: update the behavior${r.behavior.behavior ? ` ${r.behavior.behavior}` : ''} in its docs.json \`behaviors\` list with the new sentence, with the code and the tests.`,
        ]
      : []),
    ...(r.origin?.kind === 'audit' ? [`- Also put this line in the pull request body, unchanged (Bridge shows where the change comes from): <!-- bridge-origin ${JSON.stringify(r.origin).replace(/>/g, '\\u003e')} -->`] : []),
    '- If the request is unclear or conflicts with the guidance, comment on the issue instead of guessing.',
  ].join('\n');
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const sourceLabel = (s: RequestSource) => (s === 'figma' ? 'Figma' : s === 'studio' ? 'Bridge Studio' : s === 'cli' ? 'the CLI' : 'Claude (MCP)');

// ---------------------------------------------------------------------------------------------
// Integrations (bridge.config.json "integrations"): where requests go besides the GitHub issue.

export interface JiraIntegration {
  /** Jira site, e.g. "https://acme.atlassian.net". The token lives in the repo secrets, never in config. */
  baseUrl: string;
  /** Project key, e.g. "DS". */
  project: string;
  /** Issue type, default "Task". */
  issueType?: string | undefined;
  labels?: string[] | undefined;
}

export interface IntegrationsConfig {
  requests?: { labels?: string[] | undefined; assignees?: string[] | undefined } | undefined;
  /** Mirror each request to Jira through the bridge-jira GitHub Action. */
  jira?: JiraIntegration | undefined;
}

/** Problems in an integrations block, as sentences that say how to fix them. Empty when valid. */
export function validateIntegrations(i: IntegrationsConfig | undefined): string[] {
  const out: string[] = [];
  if (!i?.jira) return out;
  if (!/^https:\/\/[^/]+/.test(i.jira.baseUrl ?? '')) out.push('Jira site must start with https://, for example https://acme.atlassian.net.');
  if (!/^[A-Z][A-Z0-9_]{1,9}$/.test(i.jira.project ?? '')) out.push('Jira project key is 2 to 10 capital letters or digits, like DS.');
  return out;
}

/** The Jira issue fields the Action sends for a request (Jira Cloud REST v3, Atlassian document format). */
export function jiraIssueFields(r: ComponentChangeRequest, jira: JiraIntegration, issueUrl: string): Record<string, unknown> {
  const text = (t: string) => ({ type: 'text', text: t });
  const para = (...c: unknown[]) => ({ type: 'paragraph', content: c });
  return {
    project: { key: jira.project },
    issuetype: { name: jira.issueType ?? 'Task' },
    summary: requestIssueTitle(r),
    labels: [...new Set(['bridge', REQUEST_LABEL, ...(jira.labels ?? [])])].map((l) => l.replace(/\s+/g, '-')),
    description: {
      type: 'doc',
      version: 1,
      content: [
        para(text(r.summary.trim() || r.title)),
        ...(r.line?.trim() ? [para(text(r.line.trim()))] : []),
        ...r.changes.map((c) => para(text(`${c.field}: ${c.before ?? '(none)'} -> ${c.after ?? '(removed)'}`))),
        para({ type: 'text', text: 'GitHub request', marks: [{ type: 'link', attrs: { href: issueUrl } }] }),
      ],
    },
  };
}
