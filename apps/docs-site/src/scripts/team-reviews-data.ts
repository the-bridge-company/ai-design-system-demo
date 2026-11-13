// The team's two reviews in the browser (lib/team-reviews.ts TeamReviews), read once per page for every surface that
// names a hat: the exploration page, Explorations, Home and Library review. The facts: the server's review settings and
// members (scripts/contribute-session teamReview), the GitHub design owners and products of bridge.config.json, and on
// the sample team its cast's reviews when the server keeps none (lib/review-lines withSampleReviews). `teamReviewsNow`
// answers synchronously once read (null before), for the pure list builders that cannot wait.
import { productsOf, type ProductConfig } from '@bridge-ds/core';
import { currentContributor, currentViewer, getToken, readRepo } from './github-session';
import { siteConfig } from './repo-context';
import { siteApprovers } from './teams';
import { knownNames } from './people';
import { isSampleTeam } from '../lib/demo';
import { reviewGithubOwners, viewerIds, type ReviewMember, type TeamReviews } from '../lib/team-reviews';
import { withSampleReviews } from '../lib/review-lines';

let reading: Promise<TeamReviews> | null = null;
let read: TeamReviews | null = null;

function products(): ProductConfig[] {
  try {
    return productsOf(siteConfig() as { products?: ProductConfig[] });
  } catch {
    return productsOf(null);
  }
}

function githubOwners(): string[] {
  try {
    return siteApprovers().design;
  } catch {
    return [];
  }
}

/** The team's reviews, read once per page. Anything unread reads as a GitHub team: bridge.config.json decides. */
export function loadTeamReviews(): Promise<TeamReviews> {
  reading ??= (async () => {
    const { owner, repo } = readRepo();
    // The sample team names only its cast: never the account hosting its repository.
    const owners = reviewGithubOwners(`${owner}/${repo}`, githubOwners());
    const names = knownNames();
    // GitHub people by the name this browser knows ("Dana"), never a bare login when a name is known.
    const github: ReviewMember[] = owners.filter((l) => !l.includes('/')).map((l) => ({ login: l, name: names[l.toLowerCase()]?.name?.split(/\s+/)[0] ?? l }));
    let team: TeamReviews = { designReview: null, members: github, githubOwners: owners, products: products() };
    try {
      const { teamReview } = await import('./contribute-session');
      const r = await teamReview(`${owner}/${repo}`, currentContributor() ? null : getToken());
      team = { ...team, designReview: r.designReview, members: [...r.members, ...github], ...(r.note ? { note: true } : {}) };
    } catch {
      // No member list here: bridge.config.json decides, as before.
    }
    read = withSampleReviews(team, isSampleTeam(`${owner}/${repo}`));
    return read;
  })();
  return reading;
}

/** The reviews once read, else null: a list painted before them says the old words and repaints. */
export const teamReviewsNow = (): TeamReviews | null => read;

/** The viewer's ids for lib/team-reviews: their GitHub login and their member id. */
export const viewerReviewIds = (): string[] => viewerIds(currentContributor() ? null : (currentViewer()?.login ?? null), currentContributor()?.ref ?? null);
