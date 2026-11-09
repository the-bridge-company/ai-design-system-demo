// The lead's answers on an exploration's library pieces, on GitHub (decision 2026-11-09, boards LI2 to LI4): one piece
// at a time from its ⋯ menu, and the way kept when two explorations change the same component differently. Shared by
// Studio (the viewer's own client: their GitHub token, or Bridge's proxy for a member who joined by email) and the
// tools. The rules are in library-impact.ts.

import { findExplorationOnGitHub } from './explorations-github';
import { parseExplorationBody, withExplorationLibrary } from './explorations';
import { GitHubError, type GitHubClient } from './github-client';
import { githubLoginOf } from './github-login';
import { withLibraryChoice, withPieceDecision, type LibraryChoice, type PieceVerdict } from './library-impact';
import { parsePiecesRecord } from './prod-branch';
import { proposePiecesOnGitHub, type ProposedPieces } from './prod-branch-github';
import type { ProductConfig } from './products';
import type { RequestSource } from './requests';

/** The piece is no longer in the exploration's library check (it changed since). */
export const PIECE_GONE = 'This piece is no longer in the exploration. Look at the page again.';

export interface PieceDecisionInput {
  piece: string;
  verdict: PieceVerdict;
  /** Ask for changes on this one: what to change (needed). */
  text?: string | undefined;
  /** Use an existing piece instead: which one (needed). */
  use?: string | undefined;
  /** Who answers: a GitHub login, or the display name of a member without one. */
  by?: string | null | undefined;
  byName?: string | null | undefined;
  date?: Date | undefined;
  /**
   * Approve only this one: the request goes to the library now (proposePiecesOnGitHub), filed in the design system
   * repository (`library`, when the exploration lives in a product's repository) with its origin.
   */
  library?: GitHubClient | undefined;
  products?: readonly ProductConfig[] | undefined;
  previewUrl?: string | null | undefined;
  source?: RequestSource | undefined;
}

/**
 * The lead answers one piece (its ⋯ menu): approve it alone (its library request is filed at once), ask for changes on
 * it, keep it in this screen only, or use an existing piece instead. The screen's own answer (Looks right) stays to
 * give. A piece of a check that no longer lists it is refused.
 */
export async function decidePieceOnGitHub(gh: GitHubClient, ref: string | number, input: PieceDecisionInput): Promise<{ proposed: ProposedPieces | null }> {
  if (!gh.canWrite) throw new GitHubError(401, 'Answering a library piece needs a GitHub token (pull requests: write).');
  if (input.verdict === 'changes' && !input.text?.trim()) throw new GitHubError(422, 'Say what to change on it.');
  if (input.verdict === 'existing' && !input.use?.trim()) throw new GitHubError(422, 'Say which piece of the library to use.');
  const p = await findExplorationOnGitHub(gh, ref);
  const record = parsePiecesRecord(p.body);
  if (!record?.pieces.some((x) => x.id === input.piece)) throw new GitHubError(422, PIECE_GONE);
  const at = (input.date ?? new Date()).toISOString();
  const by = githubLoginOf(input.by ?? undefined);
  const decision = {
    piece: input.piece,
    verdict: input.verdict,
    at,
    ...(by ? { by } : {}),
    ...(input.byName ? { byName: input.byName } : {}),
    ...(input.verdict === 'changes' && input.text?.trim() ? { text: input.text.trim() } : {}),
    ...(input.verdict === 'existing' && input.use?.trim() ? { use: input.use.trim() } : {}),
  };
  // The library side first: a refused request leaves the piece as it was.
  const proposed =
    input.verdict === 'approved' && !record.links.some((l) => l.piece === input.piece)
      ? await proposePiecesOnGitHub(gh, p.number, { pieces: [input.piece], products: input.products ?? [], previewUrl: input.previewUrl, source: input.source ?? 'studio', ...(by ? { openedBy: by } : {}), ...(input.library ? { library: input.library } : {}) })
      : null;
  const fresh = proposed ? await findExplorationOnGitHub(gh, p.number) : p;
  await gh.updatePullRequest(p.number, { body: withExplorationLibrary(fresh.body, (l) => withPieceDecision(l, decision)) });
  return { proposed };
}

export interface LibraryWayInput {
  /** The component both explorations change, and the part ("padding"). */
  component: string;
  property: string;
  /** The way kept: one exploration's key (explorationKeyOf), or "both" (two sizes, today's stays the default). */
  pick: string;
  by?: string | null | undefined;
  byName?: string | null | undefined;
  date?: Date | undefined;
  /** The other exploration: its client (its own repository) and number. Its block records the same choice. */
  other: { gh: GitHubClient; number: number };
  /** The words both designers read on their exploration, under the choice (GitHub tells who follows it). */
  note: string;
}

/**
 * A conflict settled (LI4): the lead picks one way for a component part two explorations change differently, or both
 * as two sizes. The choice is kept on both explorations (Looks right no longer waits on it), and each one gets a word
 * that both designers read, so they can comment. The lead decides without waiting for them.
 */
export async function chooseLibraryWayOnGitHub(gh: GitHubClient, ref: string | number, input: LibraryWayInput): Promise<void> {
  if (!gh.canWrite) throw new GitHubError(401, 'Choosing a way needs a GitHub token (pull requests: write).');
  const p = await findExplorationOnGitHub(gh, ref);
  if (!parseExplorationBody(p.body)) throw new GitHubError(422, 'Bridge cannot find this exploration.');
  const by = githubLoginOf(input.by ?? undefined);
  const choice: LibraryChoice = { component: input.component, property: input.property, pick: input.pick, at: (input.date ?? new Date()).toISOString(), ...(by ? { by } : {}), ...(input.byName ? { byName: input.byName } : {}) };
  await gh.updatePullRequest(p.number, { body: withExplorationLibrary(p.body, (l) => withLibraryChoice(l, choice)) });
  // The other exploration keeps the same choice. A refusal there leaves this one settled: its page shows the choice
  // through this one's record (libraryConflicts reads both sides).
  const o = await findExplorationOnGitHub(input.other.gh, input.other.number).catch(() => null);
  if (o) await input.other.gh.updatePullRequest(o.number, { body: withExplorationLibrary(o.body, (l) => withLibraryChoice(l, choice)) }).catch(() => undefined);
  const words = input.note.trim();
  if (words) {
    await gh.createIssueComment(p.number, words).catch(() => undefined);
    if (o) await input.other.gh.createIssueComment(o.number, words).catch(() => undefined);
  }
}
