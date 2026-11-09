// The viewer of this page, read with lib/design-lead: whether they are a design lead of the team (and may change the
// library). Every Studio page that shows a lead's view asks here, so a lead signed in by email and a lead signed in
// with GitHub get the same pages.
import { isDesignLead, leadsLibrary, type LeadViewer } from '../lib/design-lead';
import { currentAccess, currentContributor, currentViewer } from './github-session';
import { parseExplorationBody } from '@bridge-ds/core';
import { leadHomeRow } from '../lib/lead-decisions';
import { isOwnExploration } from '../lib/home-explorations';
import { siteConfig } from './repo-context';
import { siteApprovers } from './teams';
import type { RepoAccess } from '../lib/access';

function viewerOf(a: RepoAccess | null | undefined = currentAccess()): LeadViewer & { techOwners: readonly string[]; overrideAllowed: readonly string[] } {
  const v = currentViewer();
  const owners = siteApprovers();
  const override = (siteConfig() as { override?: { allowed?: readonly string[] } | null }).override;
  return { access: a, member: currentContributor(), login: v?.email ? null : (v?.login ?? null), designOwners: owners.design, techOwners: owners.tech, overrideAllowed: override?.allowed ?? [] };
}

/** Whether the viewer is a design lead of this team (an email admin or lead, a GitHub admin or design owner). */
export const viewerIsDesignLead = (a?: RepoAccess | null): boolean => isDesignLead(viewerOf(a === undefined ? currentAccess() : a));

/** Whether the viewer may change the library itself: a design lead, or a GitHub tech owner or override holder who may write. */
export const viewerLeadsLibrary = (a?: RepoAccess | null): boolean => leadsLibrary(viewerOf(a === undefined ? currentAccess() : a));

/**
 * Whether the viewer answers on someone else's exploration (Done exploring, a decision, a talk with the lead): a design
 * lead, or an email member the server says decides (any designer too when the team shares review: api/_lib/review-mode
 * decidesOnExplorations). The exploration page and Home's Needs you read it the same way.
 */
export const viewerDecidesExplorations = (): boolean => currentContributor()?.decides === true || viewerIsDesignLead();

/**
 * Whether an exploration waits on the viewer as its lead: Done exploring asked them, or the designer answered them
 * (lib/lead-decisions leadHomeRow, a Needs you row). Home's rows, the nav badge and Changes > Waiting on me read it
 * here, so the three count the same explorations.
 */
export function explorationWaitsOnViewer(p: { body?: string | null; user: { login: string } }): boolean {
  const block = parseExplorationBody(p.body ?? null);
  if (!block || (block.leadAskedAt === undefined && !block.decisions?.length && !block.leadNote)) return false;
  const viewer = currentViewer()?.login ?? null;
  const asker = block.leadAskedBy ?? p.user.login;
  const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  const row = leadHomeRow(p.body, {
    viewer,
    lead: viewerDecidesExplorations() && !(viewer && same(asker, viewer)),
    own: isOwnExploration({ user: p.user, body: p.body ?? null }, viewer, currentContributor()?.ref ?? null),
    viewerName: currentContributor()?.name ?? null,
  });
  return row?.where === 'needs';
}
