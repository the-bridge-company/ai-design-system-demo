// What "Play both" needs on a behavior request (components/ds/studio/BehaviorReplay.tsx), read once per request with
// the list's reader (github-session ghGet) and the team's model (scripts/team-data):
//   - where Claude's preview stands: the request's preview comment the team's workflow keeps (core parsePreviewState),
//     and whether the workflow is in the repository at all (off: nothing runs);
//   - the two stories: today's from the team's Storybook (bridge.config.json storybook.url, else
//     previews.production.storybook), the preview's from the per-branch Storybook (previews.apps.storybook) of
//     agent/preview-<n>, the component's first story in both;
//   - the keys to press and today's announcement, from the component's docs.json (lib/story-replay).
// Null when there is nothing to play: a pattern, a component without a story or a team without a Storybook.
import { BEHAVIOR_PREVIEW_WORKFLOW_FILE, parsePreviewState, previewUrl, readBehaviors, type BehaviorAsk, type BehaviorPreviewState } from '@bridge-ds/core';
import { ghGet, readRepo } from './github-session';
import { behaviorOf, keysStoryUrl, replaySequence, replayStateOf } from '../lib/story-replay';
import { httpsStorybook } from '../lib/team-components';
import type { ReplayState } from '../lib/story-replay';

export interface PreviewPlay {
  state: ReplayState;
  keys: string[];
  announces: string | null;
  component: string;
  /** The preview's own state, for Being built's check (its branch and round). */
  preview: BehaviorPreviewState | null;
  /** today's Storybook, and the per-branch template, for a developer's build. */
  storybook: string;
  template: string | null;
  storyId: string;
  /** The component's behaviors with keys, from its docs.json: the rows of a developer's check. */
  behaviors: { id: string; family: string; text: string; keys: string[] }[];
}

const cache = new Map<string, Promise<PreviewPlay | null>>();

/** Read once per request and page; `fresh` reads again (after the requester changed her words). */
export function behaviorPreviewPlay(number: number, ask: BehaviorAsk, opts: { fresh?: boolean } = {}): Promise<PreviewPlay | null> {
  const { owner, repo } = readRepo();
  const key = `${owner}/${repo}#${number}`;
  if (opts.fresh || !cache.has(key)) cache.set(key, read(`/repos/${owner}/${repo}`, number, ask).catch(() => null));
  return cache.get(key)!;
}

async function read(R: string, number: number, ask: BehaviorAsk): Promise<PreviewPlay | null> {
  if (ask.of !== 'component') return null;
  const { teamOfPage, loadTeamData } = await import('./team-data');
  if (!teamOfPage()) return null;
  const data = await loadTeamData();
  const c = data.model.components?.list.find((x) => x.name === ask.id);
  const storybook = httpsStorybook(data.storybook);
  const story = c?.stories[0];
  if (!c || !story || !storybook) return null;
  const template = data.model.config.previews?.apps?.storybook ?? null;
  const [comments, workflow] = await Promise.all([
    ghGet<{ body?: string | null }[]>(`${R}/issues/${number}/comments?per_page=100`, { fresh: true })
      .then((f) => f.data)
      .catch(() => []),
    ghGet<unknown>(`${R}/contents/${BEHAVIOR_PREVIEW_WORKFLOW_FILE}?ref=${encodeURIComponent(data.defaultBranch)}`)
      .then(() => true)
      .catch(() => false),
  ]);
  const preview = parsePreviewState(comments);
  const behaviors = c.docs?.behaviors;
  const { announces } = behaviorOf(behaviors, ask);
  return {
    state: replayStateOf({ preview, workflow, today: storybook, template, storyId: story.id }),
    keys: replaySequence(behaviors, ask.behavior),
    announces,
    component: c.name,
    preview,
    storybook,
    template,
    storyId: story.id,
    behaviors: readBehaviors(behaviors).flatMap((b) => (b.keys?.length ? [{ id: b.id, family: b.family, text: b.text, keys: b.keys }] : [])),
  };
}

/** A branch's Storybook story that answers the keys, from the per-branch template, or null without one. */
export function branchStoryUrl(template: string | null, branch: string, storyId: string, pr?: number): string | null {
  const base = template ? httpsStorybook(previewUrl(template, { branch, ...(pr ? { pr } : {}) })) : undefined;
  return base ? keysStoryUrl(base, storyId) : null;
}
