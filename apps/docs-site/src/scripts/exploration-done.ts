// "Done exploring" from an exploration page or a product branch page: opens the DS Dialog
// (components/ds/studio/DoneExploring.tsx) with the pieces the last check found, then runs the core call with the
// viewer's token. Two reviews (docs/specs/two-reviews.md, lib/done-reviews.ts): the product's design review when it is
// on and someone other than the author can give it, and the library decision when something is new for the library.
// Both start together (core askReviewsOnGitHub); with neither, it goes straight to Ready to build
// (doneExploringOnGitHub) and the line says why. Nothing closes. No React here: the dialog is its own island, reached
// by an event.
import { askReviewsOnGitHub, doneExploringOnGitHub, parseExplorationBody, pmOpinionOf, type GitHubClient, type ProductConfig, type ReviewsAsked } from '@bridge-ds/core';
import { donePieces } from '../lib/explorations-view';
import { authorIds, viewerIds, type TeamReviews } from '../lib/team-reviews';
import { asksSomeone, doneConfirmationLine, doneDialogLine, githubAsked, pmGateRequired, productNameOf, reviewsAtDone, teamReviewsForDone } from '../lib/done-reviews';
import { isSampleTeam } from '../lib/demo';
import type { DoneExploringDetail } from '../components/ds/studio/DoneExploring';
import { currentContributor, currentViewer, getToken, readRepo } from './github-session';
import { siteApprovers } from './teams';
import { siteConfig } from './repo-context';
import { teamReview, type TeamReview } from './contribute-session';
import { checkPieces } from './connector-api';
import { viewerDecidesExplorations } from './design-lead';

export const DONE_EXPLORING_EVENT = 'bridge:done-exploring-ask';

/**
 * What stops Done exploring at the PM gate (board R1): when the design review does not apply to this exploration (off
 * for its product, or nobody but the author to give it), the product's PM says it looks good (or agreed in a call)
 * before the developers. A product with no PM set skips it. The sentence to show, or null when it may go.
 */
export function pmGateStop(x: { review: Pick<TeamReview, 'pms'>; asked: ReviewsAsked; product: string | null | undefined; body: string | null | undefined }): string | null {
  if (!pmGateRequired(x.asked, Boolean(parseExplorationBody(x.body)?.designOkAt))) return null;
  const pm = x.product ? x.review.pms?.[x.product] : undefined;
  if (!pm) return null;
  const said = pmOpinionOf(x.body)?.kind;
  if (said === 'pm-ok' || said === 'pm-call') return null;
  return said === 'pm-changes' ? `${pm.name} asked for changes. Answer them first: nothing goes to the developers before ${pm.name} says it looks good.` : `Share it with ${pm.name} first: nothing goes to the developers before ${pm.name} says it looks good.`;
}

export function askDoneExploring(
  r: { number: number; name: string; author?: string | null; product?: string | null },
  body: string | null | undefined,
  opts: {
    client: () => GitHubClient;
    /**
     * The design system repository, when the exploration lives in a product's own one (`client` writes that one): the
     * ticked pieces are filed there as requests, where the library owners work.
     */
    library?: () => GitHubClient;
    previewUrl: string | null;
    products?: readonly ProductConfig[];
    after: (line: string) => void;
    focus?: HTMLElement | null;
    /**
     * Never checked: run the library check while the dialog is open. `repo` is the design system repository the
     * server checks from, `ref` the exploration ("12", "shop#12"), `body` reads its description again afterwards.
     */
    check?: { repo: string; ref: string; body: () => Promise<string | null | undefined> } | null;
  },
) {
  const found = donePieces(body);
  const who0 = currentViewer();
  const viewer = who0 && !who0.email ? who0.login : null;
  const repo = readRepo();
  const full = `${repo.owner}/${repo.repo}`;
  const me = currentContributor()?.ref ?? null;
  const products = opts.products?.length ? opts.products : ((siteConfig().products as ProductConfig[] | undefined) ?? []);
  // Never asked of their own exploration: its author, and whoever says Done exploring for it.
  const author = [...new Set([...authorIds(body, r.author), ...viewerIds(viewer, me)])];
  const product = productNameOf(products, r.product);
  // The description as last read: a check while the dialog is open records the pieces, then the asks read them.
  let latest = body;
  const sample = isSampleTeam(full);
  void (sample ? Promise.resolve<TeamReview | null>(null) : teamReview(full, currentContributor() ? null : getToken())).then((review) => {
    const team = teamReviewsForDone({ sample, review, githubOwners: siteApprovers().design, products });
    open(team, review);
  });
  function open(team: TeamReviews, review: TeamReview | null) {
    const asksFor = (ticked: readonly string[]) => reviewsAtDone(latest, { team, product: r.product, author, ticked });
    const first = asksFor(found.pieces.map((p) => p.id));
    const viaReview = asksSomeone(first);
    const detail: DoneExploringDetail = {
      number: r.number,
      name: r.name,
      pieces: found.pieces,
      checked: found.checked,
      sent: found.sent,
      viaLead: viaReview,
      youLead: !viaReview && viewerDecidesExplorations(),
      ...(viaReview ? { description: doneDialogLine(first, product) ?? undefined } : {}),
      confirm: async (pieces) => {
        const asked = asksFor(pieces);
        // The PM gate: with no design review, the product's PM says it looks good before the developers.
        const pmStop = pmGateStop({ review: review ?? {}, asked, product: r.product, body: latest });
        if (pmStop) throw new Error(pmStop);
        // A member who joined by email is named by their display name in the developers' task, never by their email.
        const v = currentViewer();
        const who = v ? (v.email ? { openedByName: v.name?.trim() || 'a designer' } : { openedBy: v.login }) : {};
        const now = donePieces(latest).pieces;
        const titles = (id: string) => now.find((p) => p.id === id)?.title ?? found.pieces.find((p) => p.id === id)?.title ?? id;
        const e = parseExplorationBody(latest);
        const authorName = team.members.find((m) => m.ref && m.ref === e?.member)?.name ?? e?.author ?? (v?.email ? v.name : v?.login) ?? null;
        if (asksSomeone(asked)) {
          // Both reviews start together. Only GitHub logins are named on GitHub (lib/done-reviews githubAsked).
          await askReviewsOnGitHub(opts.client(), r.number, {
            pieces,
            ...who,
            design: asked.design ? { to: githubAsked(asked.design.reviewers) } : null,
            library: asked.library ? { to: githubAsked(asked.library.owners) } : null,
          });
          opts.after(doneConfirmationLine(asked, { product, authorName, titles }));
          return;
        }
        const res = await doneExploringOnGitHub(opts.client(), r.number, { pieces, products: opts.products ?? [], previewUrl: opts.previewUrl, ...who, ...(opts.library ? { library: opts.library() } : {}), source: 'studio' });
        // The designer reads what happened to their pieces; GitHub housekeeping (a label, the note) is for developers.
        const other = res.warnings.filter((w) => !res.pieces.warnings.includes(w));
        if (other.length) console.warn(`Done exploring #${r.number}: ${other.join(' ')}`);
        opts.after(`${doneConfirmationLine(asked, { product, authorName, requests: res.pieces.proposed.length })}${res.pieces.warnings.length ? ` ${res.pieces.warnings.join(' ')}` : ''}`);
      },
      closed: (done) => {
        if (!done && opts.focus?.isConnected) opts.focus.focus();
      },
      check: opts.check
        ? async () => {
            const c = opts.check!;
            const res = await checkPieces(c.repo, c.ref).catch(() => null);
            if (!res) return null;
            const fresh = await c.body().catch(() => null);
            const after = donePieces(fresh);
            if (after.checked) {
              latest = fresh;
              return after;
            }
            // Checked, nothing missing: the server's answer is enough, even when GitHub still serves the description
            // from before the check.
            return res.checked && res.pieces === 0 ? { checked: true, pieces: [], sent: 0 } : null;
          }
        : null,
    };
    document.dispatchEvent(new CustomEvent(DONE_EXPLORING_EVENT, { detail }));
  }
}
