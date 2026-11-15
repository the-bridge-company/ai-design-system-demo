// Claude's preview of a behavior request, made by the person's own Claude through Bridge: Bridge never runs Claude.
//   bridge_make_behavior_preview    everything their Claude needs for request #n: the request, the component's files,
//                                   its docs.json entry and the rules (core behaviorPreviewBrief): change the code and
//                                   the behaviors entry, add a test that presses the keys, push agent/preview-<n>, open a
//                                   draft pull request "Preview for #n" (never "Closes"). On the hosted connector it also
//                                   tells the request that their Claude is preparing it.
//   bridge_report_behavior_preview  records the preview on the request through Bridge: the hosted connector's server
//                                   writes it with Bridge's own GitHub App (api/contribute `behavior-preview`), after
//                                   checking the person is on the team and the issue is an open behavior request, so
//                                   Studio reads only Bridge's records. A local server has no way to record it.
// MCP only: these tools have no CLI command (the CLI's `bridge request implement` builds a request).
import {
  behaviorAskOf,
  behaviorPreviewBrief,
  BEHAVIOR_REQUEST_LABEL,
  parseRequestIssue,
  previewBranch,
  previewReportProblems,
  readBehaviors,
  type BehaviorPreviewState,
} from '@bridge-ds/core';
import { listComponentNames } from './components.js';
import type { BridgeContext } from './context.js';

/** What the hosted connector gives: Bridge's server records the preview (api/mcp, api/contribute). */
export interface BehaviorPreviewHost {
  record: (input: PreviewReport) => Promise<BehaviorPreviewState>;
}

export interface PreviewReport {
  number: number;
  state: 'preparing' | 'ready' | 'failed';
  branch?: string | undefined;
  pr?: number | undefined;
  sha?: string | undefined;
  reason?: string | undefined;
}

export const PREVIEW_TOOL_WORDS = {
  noGitHub: 'No GitHub repo known: set "repo" in bridge.config.json or add an origin remote. Requests are GitHub issues.',
  notBehavior: (n: number) => `Issue #${n} is not a behavior request: it has no "${BEHAVIOR_REQUEST_LABEL}" label or no readable request.`,
  closed: (n: number) => `Request #${n} is closed: there is nothing to preview.`,
  noHost: 'Recording a preview goes through Bridge: connect Bridge in Claude (the Bridge connector), then report it again. The branch and the draft pull request are already there for the team.',
} as const;

async function behaviorRequest(ctx: BridgeContext, n: number) {
  const gh = await ctx.github();
  if (!gh) throw new Error(PREVIEW_TOOL_WORDS.noGitHub);
  const issue = await gh.getIssue(n);
  const request = parseRequestIssue(issue.body);
  const ask = request ? behaviorAskOf(request) : null;
  if (!issue.labels.includes(BEHAVIOR_REQUEST_LABEL) || !request || !ask) throw new Error(PREVIEW_TOOL_WORDS.notBehavior(n));
  if (issue.state !== 'open') throw new Error(PREVIEW_TOOL_WORDS.closed(n));
  return { gh, issue, request, ask };
}

export async function makeBehaviorPreview(ctx: BridgeContext, a: { number: number }) {
  const { gh, issue, request, ask } = await behaviorRequest(ctx, a.number);
  const { config } = await ctx.config();
  const entry = ask.of === 'component' ? (await listComponentNames(ctx.source, config)).find((c) => c.name.toLowerCase() === ask.id.toLowerCase()) : undefined;
  const files = ask.of === 'pattern' ? [`patterns/${ask.id}.pattern.json`] : (entry?.files ?? []);
  const docsPath = files.find((f) => f.endsWith(config.components?.docsSuffix ?? '.docs.json'));
  const docsText = docsPath && ask.behavior ? await ctx.source.read(docsPath).catch(() => null) : null;
  let behavior: ReturnType<typeof readBehaviors>[number] | undefined;
  try {
    behavior = docsText ? readBehaviors((JSON.parse(docsText) as { behaviors?: unknown }).behaviors).find((b) => b.id === ask.behavior) : undefined;
  } catch {
    behavior = undefined;
  }
  const defaultBranch = config.repo?.defaultBranch ?? 'main';
  const brief = behaviorPreviewBrief(request, issue.number, { files, ...(docsPath ? { docsPath } : {}), ...(behavior?.keys?.length ? { keys: behavior.keys } : {}), agentsFile: config.docs.guidelines ?? 'AGENTS.md', defaultBranch });
  // The request says their Claude is on it (hosted connector only). Never blocks the brief.
  const host = ctx.opts.behaviorPreview;
  const told = host ? await host.record({ number: issue.number, state: 'preparing' }).then(() => true, () => false) : false;
  return {
    number: issue.number,
    url: issue.url,
    repo: gh.fullName,
    request,
    ask,
    component: ask.of === 'component' ? { name: entry?.name ?? ask.id, exists: Boolean(entry), files } : { pattern: ask.id, files },
    ...(behavior ? { behavior: { id: behavior.id, text: behavior.text, ...(behavior.keys ? { keys: behavior.keys } : {}), ...(behavior.announces ? { announces: behavior.announces } : {}) } } : {}),
    branch: previewBranch(issue.number),
    pullRequestTitle: `Preview for #${issue.number}`,
    brief,
    recorded: told ? 'preparing' : null,
    // MCP only
    next: `Make the change on ${previewBranch(issue.number)} as the brief says, open the draft pull request "Preview for #${issue.number}", then call bridge_report_behavior_preview. If you cannot push from here (no checkout of ${gh.fullName}), say so to the person and report state "failed" with that reason.`,
  };
}

export async function reportBehaviorPreview(ctx: BridgeContext, a: PreviewReport) {
  const problems = previewReportProblems(a.number, a);
  if (problems.length) throw new Error(problems.join(' '));
  await behaviorRequest(ctx, a.number);
  const host = ctx.opts.behaviorPreview;
  if (!host) throw new Error(PREVIEW_TOOL_WORDS.noHost);
  const preview = await host.record(a);
  return {
    status: 'recorded' as const,
    number: a.number,
    preview,
    next: a.state === 'ready' ? `The lead and the person who asked can play it on request #${a.number} in Bridge Studio, once the team's Storybook has deployed ${a.branch}.` : a.state === 'failed' ? 'Bridge Studio says it could not be made, with your reason; the lead can still decide on the sentences.' : 'Bridge Studio says your Claude is preparing it.',
  };
}
