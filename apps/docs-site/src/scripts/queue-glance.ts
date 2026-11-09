// What the review queue shows of an exploration it does not review in place (scripts/review-queue-page.ts): the
// captured screen (the same capture as the exploration page, scripts/preview-shots previewShotOf), linked to that
// screen on the exploration's preview when Bridge knows its address, and the next step of "Where it stands" (the
// exploration's note file, core parseExplorationNotes). Two reads at most (the pull request and its note file), once per
// exploration; a read that fails shows less, never an error.
import { branchPreviewUrl, explorationNotePathOf, impactQueueLine, isWaitingForLead, parseExplorationBody, parseExplorationNotes, parsePiecesRecord } from '@bridge-ds/core';
import { libraryImpactView, type LibraryImpactView } from '../lib/library-impact-view';
import { conflictsOf, impactSourceOf } from './library-impact';
import { ghGet, readRepo } from './github-session';
import { previewShotOf } from './preview-shots';
import { atRoute } from '../lib/at-route';

export interface ExplorationGlance {
  shot: { src: string; capturedAt: string | null; href: string | null } | null;
  nextStep: string | null;
  /**
   * What it changes in the library (board LI5): the line under its title in the list ("Screen + 1 new component") and
   * the section inside the item. Null when Bridge never checked it.
   */
  library?: { line: string; view: LibraryImpactView } | null;
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
  const [shot, pull] = await Promise.all([
    previewShotOf(x).catch(() => null),
    ghGet<{ number: number; title: string; body: string | null; head: { ref: string }; user?: { login?: string } | null }>(`/repos/${repo}/pulls/${x.number}`)
      .then((r) => r.data)
      .catch(() => null),
  ]);
  const branch = pull?.head.ref ?? null;
  let nextStep: string | null = null;
  if (branch) {
    const path = explorationNotePathOf(null, branch);
    const text = await ghGet<string>(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path}`, { raw: true })
      .then((r) => r.data)
      .catch(() => null);
    nextStep = text ? parseExplorationNotes(text).nextStep.trim() || null : null;
  }
  const preview = own && branch ? branchPreviewUrl(own.product.preview, branch) : null;
  const library = pull ? await libraryGlance(pull, repo, own?.product.name ?? 'Library').catch(() => null) : null;
  return {
    library,
    shot: shot ? { src: shot.src, capturedAt: shot.capturedAt ?? null, href: preview ? atRoute(preview, shot.route ?? shot.screen) : null } : null,
    nextStep,
  };
}

/** The library part of an exploration in the queue: the viewer reviews it, so what waits on them reads "Needs you". */
async function libraryGlance(pull: { number: number; title: string; body: string | null; user?: { login?: string } | null }, repo: string, product: string): Promise<ExplorationGlance['library']> {
  const record = parsePiecesRecord(pull.body);
  if (!record) return null;
  const block = parseExplorationBody(pull.body);
  const designer = block?.memberName ?? block?.leadAskedByName ?? pull.user?.login ?? 'The designer';
  const conflicts = await conflictsOf({ ...impactSourceOf(pull, repo, product), designer }).catch(() => []);
  const line = impactQueueLine(record, conflicts);
  if (!line) return null;
  return { line, view: libraryImpactView({ body: pull.body, designer, lead: 'you', approved: !isWaitingForLead(pull.body) && Boolean(block?.doneAt), canDecide: false, conflicts }) };
}
