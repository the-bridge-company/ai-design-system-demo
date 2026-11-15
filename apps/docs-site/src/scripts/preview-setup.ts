// Settings, Claude, Claude's previews (components/ds/studio/PreviewSetting.tsx): whether the team's repository has the
// workflow on its default branch and its Storybook publishes each branch, and "Turn on Claude's previews": a pull
// request that adds the workflow (core behaviorPreviewWorkflowYaml), with the reader's own token, the way the automatic
// measure is set up (scripts/measure-setup.ts). Words: lib/preview-setting.ts.
import { BEHAVIOR_PREVIEW_WORKFLOW_FILE, behaviorPreviewWorkflowYaml, classifyRisk } from '@bridge-ds/core';
import { previewSetupProposal, type PreviewSettingState } from '../lib/preview-setting';
import { getToken, readRepo, studioClient } from './github-session';

/** Where the previews stand. Reads only. */
export async function readPreviewState(): Promise<PreviewSettingState> {
  const repo = readRepo();
  const gh = studioClient(`${repo.owner}/${repo.repo}`, getToken());
  const [workflow, config] = await Promise.all([gh.readFile(BEHAVIOR_PREVIEW_WORKFLOW_FILE, repo.defaultBranch).catch(() => undefined), gh.readFile('bridge.config.json', repo.defaultBranch).catch(() => undefined)]);
  if (workflow === undefined) return { kind: 'off' };
  let branches = false;
  try {
    branches = Boolean((JSON.parse(config ?? '{}') as { previews?: { apps?: { storybook?: unknown } } }).previews?.apps?.storybook);
  } catch {
    branches = false;
  }
  return { kind: 'on', branches };
}

/** The workflow for this team. */
export const previewWorkflowForTeam = (): string => behaviorPreviewWorkflowYaml({ defaultBranch: readRepo().defaultBranch });

/** "Turn on Claude's previews": the workflow on a new branch and a pull request to the default branch. */
export async function openPreviewSetup(): Promise<{ number: number; url: string }> {
  const token = getToken();
  if (!token) throw new Error('signin');
  const repo = readRepo();
  const gh = studioClient(`${repo.owner}/${repo.repo}`, token, { protectedBranches: ['main', 'master', repo.defaultBranch], branchPrefix: 'bridge/' });
  const risk = classifyRisk({ files: [{ path: BEHAVIOR_PREVIEW_WORKFLOW_FILE, status: 'added' }] });
  const p = previewSetupProposal({ prefix: 'bridge/', date: new Date(), tierLabel: `Tier ${risk.tier}${risk.reasons[0] ? ` (${risk.reasons[0]})` : ''}` });
  let branch = p.branch;
  for (let i = 2; await gh.getBranchSha(branch); i++) branch = `${p.branch}-${i}`;
  await gh.commitToNewBranch({ base: repo.defaultBranch, branch, message: p.message, files: [{ path: BEHAVIOR_PREVIEW_WORKFLOW_FILE, content: previewWorkflowForTeam() }] });
  const pr = await gh.createPullRequest({ title: p.title, head: branch, base: repo.defaultBranch, body: p.body, draft: false });
  await gh.addLabels(pr.number, ['source: bridge-web', `tier-${risk.tier}`]).catch(() => false);
  return pr;
}
