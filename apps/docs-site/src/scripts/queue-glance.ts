// What the review queue shows of an exploration it does not review in place (scripts/review-queue-page.ts): the
// captured screen (the same capture as the exploration page, scripts/preview-shots previewShotOf), linked to that
// screen on the exploration's preview when Bridge knows its address, and the next step of "Where it stands" (the
// exploration's note file, core parseExplorationNotes). Two reads at most (the pull request and its note file), once per
// exploration; a read that fails shows less, never an error.
import { branchPreviewUrl, explorationNotePathOf, parseExplorationNotes } from '@bridge-ds/core';
import { ghGet, readRepo } from './github-session';
import { previewShotOf } from './preview-shots';
import { atRoute } from '../lib/at-route';

export interface ExplorationGlance {
  shot: { src: string; capturedAt: string | null; href: string | null } | null;
  nextStep: string | null;
}

/** The exploration a queue row opens ("exploration-review-acme-crm#12", "exploration-review-12"), or null. */
export function explorationOfKey(key: string | null | undefined): { number: number; product: string | null } | null {
  const m = /^exploration-review-(?:(.+)#)?(\d+)$/.exec(key ?? '');
  return m ? { number: Number(m[2]), product: m[1] ?? null } : null;
}

const glances = new Map<string, Promise<ExplorationGlance>>();

export function explorationGlance(x: { number: number; product: string | null }): Promise<ExplorationGlance> {
  const key = `${x.product ?? ''}#${x.number}`;
  let g = glances.get(key);
  if (!g) {
    g = read(x);
    glances.set(key, g);
  }
  return g;
}

async function read(x: { number: number; product: string | null }): Promise<ExplorationGlance> {
  const own = x.product ? (await import('./product-repos')).productRepoByKey(x.product) : null;
  const ds = readRepo();
  const repo = own ? own.repo : `${ds.owner}/${ds.repo}`;
  const [shot, branch] = await Promise.all([
    previewShotOf(x).catch(() => null),
    ghGet<{ head: { ref: string } }>(`/repos/${repo}/pulls/${x.number}`)
      .then((r) => r.data.head.ref)
      .catch(() => null),
  ]);
  let nextStep: string | null = null;
  if (branch) {
    const path = explorationNotePathOf(null, branch);
    const text = await ghGet<string>(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path}`, { raw: true })
      .then((r) => r.data)
      .catch(() => null);
    nextStep = text ? parseExplorationNotes(text).nextStep.trim() || null : null;
  }
  const preview = own && branch ? branchPreviewUrl(own.product.preview, branch) : null;
  return {
    shot: shot ? { src: shot.src, capturedAt: shot.capturedAt ?? null, href: preview ? atRoute(preview, shot.route ?? shot.screen) : null } : null,
    nextStep,
  };
}
