// bridge gaps / bridge fix: Fix with Claude from the terminal. The same operations as the MCP tools (packages/mcp/src/
// figma-fixes.ts): the components that differ in Figma, one gap case, the values referee on proposed fixes, and the
// change for review. Bridge never runs Claude itself: `bridge fix <component> --with-claude` prints the line to say to
// the person's own Claude (Claude Code or Claude Desktop with Bridge connected), which runs the rounds with the MCP tools.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIX_LOOP_MAX_ROUNDS } from '@bridge-ds/core';
import { figmaFixes } from '@bridge-ds/mcp';
import { cliContext, TOKEN_HELP, type Access } from './auth.js';
import { defaultIO, RequestUsageError, type RequestArgs, type RequestIO } from './request.js';

export const FIX_HELP = `bridge gaps / bridge fix: Fix with Claude, for components whose Figma build differs from their story

Usage:
  bridge gaps [--json]
      The components that differ (Differs) or cannot be checked (Can't check, with the reason), from the
      plugin's latest Check fidelity run, else from the measure's own check.
  bridge fix <component> --case [--json]
      Its gap case (each difference with the part, expected code value, Figma value and delta) and the
      figma-fixes.json schema: the brief a Claude writes fixes from.
  bridge fix <component> --try <fixes.json> [--json]
      The values referee, offline: validates the fixes, lays them on the measure, rebuilds the set and
      compares each differing variant with the code, before and after (closer, same or worse).
  bridge fix <component> --propose <fixes.json> --summary "..." [--dry-run] [--json]
      figma-fixes.json with the fixes on a new branch, opened for review (a draft pull request labelled
      drafted-by-claude with a token; a local bridge/* branch otherwise, never pushed).
  bridge fix <component> --with-claude [--json]
      The line to say to your own Claude (Claude Code or Claude Desktop with Bridge connected): it reads the
      gap case, proposes fixes, Bridge tries them, it revises with the deltas, up to ${FIX_LOOP_MAX_ROUNDS} rounds; then it opens
      the closest fixes for review, or a status fix (Differs, with the reason) when none came closer.

Files (all optional): --measured measured-specs.json (default: in the repo, else on the bridge-requests
branch where the automatic measure publishes it), --fidelity figma-fidelity.json (the plugin's Check
fidelity run; default: in the repo, else on the bridge-requests branch), --fixes-file figma-fixes.json.
The pixel check (the story shot against the real Figma render) runs in the plugin after the next pull.
${TOKEN_HELP}
Exit codes: 0 ok, 1 not closer or blocked, 2 usage or setup error.`;

const flag = (a: RequestArgs, k: string) => {
  const v = a.flags[k]?.[a.flags[k]!.length - 1];
  return v === 'true' ? undefined : v;
};
const has = (a: RequestArgs, k: string) => Boolean(a.flags[k]);

const files = (a: RequestArgs) => ({
  ...(flag(a, 'measured') ? { measured: flag(a, 'measured') } : {}),
  ...(flag(a, 'fidelity') ? { fidelity: flag(a, 'fidelity') } : {}),
  ...(flag(a, 'fixes-file') ? { fixesFile: flag(a, 'fixes-file') } : {}),
});

function readFixes(root: string, path: string | undefined, what: string): unknown[] {
  if (!path) throw new RequestUsageError(`${what} needs a JSON file of fix objects.\n\n${FIX_HELP}`);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  } catch (e) {
    throw new RequestUsageError(`${path}: ${(e as Error).message}`);
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { fixes?: unknown }).fixes)) return (data as { fixes: unknown[] }).fixes;
  throw new RequestUsageError(`${path} is not a list of fix objects (or a figma-fixes.json with "fixes").`);
}

/** What the person says to their own Claude to fix a component (the Figma plugin and Studio say the same). */
export const fixPhrase = (component: string) => `Fix ${component} in Figma with Bridge`;

/** --with-claude: Bridge never runs Claude; the person's own Claude does, through the Bridge MCP server. */
export const withClaudeLines = (component: string) => [
  `Bridge does not run Claude for you: your own Claude does, with Bridge connected (Claude Code: claude mcp add bridge, or the Bridge connector in Claude Desktop).`,
  `In Claude, say: "${fixPhrase(component)}"`,
];

export async function runGaps(a: RequestArgs, root: string, io: RequestIO = defaultIO()): Promise<number> {
  if (has(a, 'help')) return io.print(FIX_HELP), 0;
  const ctx = await cliContext(root, io, a, 'read');
  const r = await figmaFixes.figmaGapsOp(ctx, files(a));
  if (has(a, 'json')) return io.print(JSON.stringify(r, null, 2)), 0;
  if ('say' in r) return io.print([r.say, '', ...(r.steps ?? [])].join('\n')), 0;
  if ('note' in r) io.print(r.note);
  for (const g of r.gaps) io.print(`${g.component}: ${g.status === 'differs' ? 'Differs' : "Can't check"}. ${g.summary}`);
  io.print(`Next: ${r.next}`);
  return 0;
}

export async function runFix(a: RequestArgs, root: string, io: RequestIO = defaultIO()): Promise<number> {
  const component = a._[1];
  if (has(a, 'help') || component === 'help') return io.print(FIX_HELP), 0;
  if (!component) throw new RequestUsageError(`bridge fix needs a component name.\n\n${FIX_HELP}`);
  const json = has(a, 'json');
  const out = (r: unknown, text: () => void) => (json ? io.print(JSON.stringify(r, null, 2)) : text());
  const f = files(a);
  const writes = has(a, 'propose') && !has(a, 'dry-run');
  const access: Access = writes ? 'write' : 'read';

  if (has(a, 'with-claude')) {
    if (json) io.print(JSON.stringify({ status: 'handoff', say: fixPhrase(component) }, null, 2));
    else io.print(withClaudeLines(component).join('\n'));
    return 0;
  }

  const ctx = await cliContext(root, io, a, access);
  if (has(a, 'try')) {
    const r = await figmaFixes.tryFigmaFixOp(ctx, { component, fixes: readFixes(root, flag(a, 'try'), 'bridge fix --try'), ...f });
    out(r, () => {
      io.print(r.summary);
      if (r.detail) io.print(r.detail);
      io.print(`Next: ${r.next}`);
    });
    return r.status === 'checked' && r.verdict === 'closer' ? 0 : 1;
  }
  if (has(a, 'propose')) {
    const summary = flag(a, 'summary');
    if (!summary) throw new RequestUsageError('bridge fix --propose needs --summary "...": one or two sentences for the reviewer.');
    const r = await figmaFixes.proposeFigmaFixesOp(ctx, { component, fixes: readFixes(root, flag(a, 'propose'), 'bridge fix --propose'), summary, dryRun: has(a, 'dry-run'), source: 'cli', ...f });
    if (json) return io.print(JSON.stringify(r, null, 2)), r.status === 'blocked' ? 1 : 0;
    printProposed(io, r as Record<string, unknown>);
    return r.status === 'blocked' ? 1 : 0;
  }
  // --case, or nothing: the gap case and the schema.
  const r = await figmaFixes.getGapCaseOp(ctx, { component, ...f });
  out(r, () => {
    io.print(r.gap.summary);
    if (r.gap.variants.length) io.print(`\n${r.gap.detail}`);
    if ('note' in r) io.print(`\n${r.note}`);
    io.print(`\n${r.schema}`);
    io.print(`\nNext: ${r.next}`);
  });
  return 0;
}

function printProposed(io: RequestIO, r: Record<string, unknown>) {
  if (r.status === 'blocked') {
    io.print(`Not proposed: ${String(r.why)}`);
    if (r.hint) io.print(String(r.hint));
    return;
  }
  if (r.summary) io.print(String(r.summary));
  if (r.status === 'pr-opened') io.print(`pull request: #${String(r.pr)} ${String(r.url)}`);
  if (r.branch) io.print(`branch: ${String(r.branch)}`);
  if (r.message) io.print(String(r.message));
  if (r.status === 'dry-run' || r.status === 'preview') io.print(`\n${String(r.prBody)}`);
  if (r.next) io.print(String(r.next));
}
