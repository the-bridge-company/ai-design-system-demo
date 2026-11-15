// Studio, Settings, Claude: Claude's previews of behavior requests (core behavior-preview.ts). One sentence for everyone
// (on, or not yet), and in the developer fold "Turn on Claude's previews": a pull request that adds the workflow to the
// team's repository, the same way as the automatic measure (lib/measure-setting.ts). The secret is the team's own and
// lives in GitHub: Bridge never asks for it, never shows it. Words and small rules; pure, so tests read them.

import { BEHAVIOR_PREVIEW_WORKFLOW_FILE, PREVIEW_SETUP_ACTION } from '@bridge-ds/core';

export const PREVIEW_WORDS = {
  label: "Claude's previews",
  on: 'When someone asks to change how a component behaves, Claude makes the change on its own branch, so you can try both before deciding.',
  onNoBranches: 'Claude makes the change on its own branch when someone asks to change how a component behaves. To try it here, your Storybook needs a preview of each branch.',
  off: 'Not on yet. With it, Claude makes each behavior change on its own branch, so you can try both before deciding.',
  checking: "Checking Claude's previews.",
  unknown: "Bridge could not check Claude's previews right now. Try again in a minute.",
  action: PREVIEW_SETUP_ACTION,
  busy: 'Opening the pull request',
  what: `${PREVIEW_SETUP_ACTION} adds one workflow to your repository. It runs Claude Code with your own Anthropic API key when someone asks to change how a component behaves, and opens a draft pull request with the change. Someone on your team reviews it like any change.`,
  secret: 'ANTHROPIC_API_KEY: your own Anthropic API key, added in GitHub (Settings, Secrets and variables, Actions). Bridge never asks for it and never sees it.',
  sent: 'Sent for review. Once it is merged and the secret is added, the next behavior request gets its preview.',
  signIn: 'Sign in with GitHub to set it up.',
} as const;

export type PreviewSettingState = { kind: 'on'; branches: boolean } | { kind: 'off' } | { kind: 'unknown' };

export function previewSentence(s: PreviewSettingState): string {
  if (s.kind === 'on') return s.branches ? PREVIEW_WORDS.on : PREVIEW_WORDS.onNoBranches;
  return s.kind === 'off' ? PREVIEW_WORDS.off : PREVIEW_WORDS.unknown;
}

/** The pull request that adds the workflow. */
export function previewSetupProposal(o: { prefix: string; date: Date; tierLabel: string }) {
  const stamp = o.date.toISOString().slice(0, 10).replace(/-/g, '');
  return {
    branch: `${o.prefix}behavior-preview-setup-${stamp}`,
    title: "ci: Claude's previews of behavior requests",
    message: `ci: Claude's previews of behavior requests\n\nAdds ${BEHAVIOR_PREVIEW_WORKFLOW_FILE} (Studio, Settings, ${PREVIEW_SETUP_ACTION}).`,
    body: [
      `Adds \`${BEHAVIOR_PREVIEW_WORKFLOW_FILE}\`, from Studio (Settings, Claude, ${PREVIEW_SETUP_ACTION}).`,
      '',
      'When an issue labelled `request: behavior` is opened, edited by its requester or commented by them, it runs Claude Code on `agent/preview-<n>`: the component, its docs.json `behaviors` entry and a test that presses the keys. It opens a draft pull request "Preview for #<n>" (it never closes the request) and keeps one comment on the request that Studio reads.',
      '',
      'Secret to add after merging: `ANTHROPIC_API_KEY`, your own Anthropic API key (Settings, Secrets and variables, Actions). Without it, the request gets one comment saying so, and nothing else runs.',
      '',
      "Token: the run's `GITHUB_TOKEN` (contents, pull requests and issues: write). Your default branch is never written.",
      '',
      `Risk: ${o.tierLabel}.`,
    ].join('\n'),
  };
}
