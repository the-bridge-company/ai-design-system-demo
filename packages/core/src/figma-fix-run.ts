// The change for review of Claude's Figma fixes. The rounds are the person's own Claude calling the MCP tools (through
// the hosted Bridge connector or a local server): it proposes fixes from the gap case, the values referee
// (tryFigmaFixes) judges them, and it keeps the closest, or an honest status fix when none came closer. The change for review
// (figmaFixesProposal) is the same for the MCP server, the CLI and the server: the referee runs again, fixes that move
// the component further from the code are refused, and figma-fixes.json goes on a bridge/figma-fixes-<component> branch
// as a draft pull request labelled drafted-by-claude and figma-fixes.
//
// Pure and browser safe, like figma-fix-loop.ts: the caller reads the files, asks Claude and writes to GitHub.

import { baseBranchOf, type BridgeConfig } from './config';
import { figmaFixesPrBody, gapCaseFor, touchesLayout, tryFigmaFixes, type FixVerdict, type GapCaseForInput, type TriedVariant } from './figma-fix-loop';
import type { FigmaFix } from './figma-fixes';
import { DRAFTED_BY_CLAUDE_LABEL } from './figma-push';
import { classifyRisk } from './risk';

/** Where `bridge specs --measure` writes, from the repo root. */
export const DEFAULT_MEASURED_SPECS_FILE = 'measured-specs.json';
/** The label every figma-fixes.json change carries, next to drafted-by-claude. */
export const FIGMA_FIXES_LABEL = 'figma-fixes';

const slug = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'component';

/** The branch a component's fixes go on (a number is added when it is taken): bridge/figma-fixes-text-input. */
export const figmaFixesBranchStem = (config: BridgeConfig, component: string) => `${config.governance.branchPrefix}figma-fixes-${slug(component)}`;

export interface FigmaFixesProposalInput extends GapCaseForInput {
  /** The fixes to propose (fix objects; the repo's fixes with the same ids are replaced). */
  proposed: unknown[];
  /** One or two sentences a reviewer reads first. */
  summary: string;
  config: BridgeConfig;
  /** figma-fixes.json path in the repo. */
  fixesPath: string;
  /** Who drafted it, for the body and the commit: "Bridge MCP (source: mcp)". */
  tool: string;
  /** The `source:` label: mcp, cli, studio. */
  source: string;
}

export interface FigmaFixesReport {
  component: string;
  verdict: FixVerdict;
  summary: string;
  variants: TriedVariant[];
  fixes: string[];
  tier: number;
  prTitle: string;
}

export type FigmaFixesProposal =
  | { status: 'blocked'; verdict: FixVerdict; why: string; detail: string; component: string }
  | {
      status: 'ready';
      report: FigmaFixesReport;
      /** The accepted fixes as validated. */
      fixes: FigmaFix[];
      labels: string[];
      prBody: string;
      fileContents: { path: string; content: string }[];
      title: string;
      message: string;
      /** Tier 2 and above open as a draft. */
      draft: boolean;
      /** The default branch it targets. */
      base: string;
      branchStem: string;
    };

/**
 * The change for review of proposed fixes. The values referee runs again first: a fix that moves the component further
 * from the code is refused, and part or story fixes that move nothing are refused (propose a status fix), unless they
 * size, place or lay out a part: the values referee can't judge layout, Check fidelity decides. Throws a sentence when
 * the fixes are invalid or the summary is not one.
 */
export function figmaFixesProposal(input: FigmaFixesProposalInput): FigmaFixesProposal {
  const { config } = input;
  const tried = tryFigmaFixes(input);
  if (tried.status === 'invalid') throw new Error(`Not proposed: ${tried.problems.join('; ')}.`);
  const summary = (input.summary ?? '').trim();
  if (summary.length < 8) throw new Error('Not proposed: summary is one or two sentences a reviewer reads first (what the fixes do for the designer).');
  if (/—/.test(summary)) throw new Error('Not proposed: the summary uses an em dash: use a colon or a comma.');
  const ids = new Set((input.proposed as { id?: string }[]).map((f) => f.id));
  const proposed = tried.file!.fixes.filter((f) => ids.has(f.id));
  const { gap } = gapCaseFor(input);
  const drawing = proposed.some((f) => f.kind === 'part' || f.kind === 'story' || (f.kind === 'axis' && f.action !== 'map'));
  const measurable = gap.variants.some((v) => v.differences.length);
  if (tried.verdict === 'worse' || (drawing && measurable && tried.verdict === 'same' && !proposed.some(touchesLayout))) {
    return {
      status: 'blocked',
      verdict: tried.verdict,
      why: `${tried.summary} Bridge does not open fixes that move ${gap.component} ${tried.verdict === 'worse' ? 'further from' : 'no closer to'} the code.`,
      detail: tried.detail,
      component: gap.component,
    };
  }
  const content = `${JSON.stringify(tried.file, null, 2)}\n`;
  const fileContents = [{ path: input.fixesPath, content }];
  const risk = classifyRisk({ files: [{ path: input.fixesPath, status: input.fixes ? 'modified' : 'added' }], config });
  const prBody = `${figmaFixesPrBody({ component: gap.component, summary, gap, tried, fixes: proposed, tool: input.tool })}\n\nRisk: ${risk.label}.`;
  const title = `fix(figma): ${gap.component} drawn closer to its story`;
  const message = `${title}\n\n${summary}\n\nFixes: ${proposed.map((f) => f.id).join(', ')}. Drafted by Claude through ${input.tool}.`;
  const labels = [...new Set([...config.governance.labels, `tier: ${risk.tier}`, `source: ${input.source}`, FIGMA_FIXES_LABEL, DRAFTED_BY_CLAUDE_LABEL])];
  const report: FigmaFixesReport = { component: gap.component, verdict: tried.verdict, summary: tried.summary, variants: tried.variants, fixes: proposed.map((f) => f.id), tier: risk.tier, prTitle: title };
  return { status: 'ready', report, fixes: proposed, labels, prBody, fileContents, title, message, draft: risk.tier >= 2, base: baseBranchOf(config), branchStem: figmaFixesBranchStem(config, gap.component) };
}
