// Who leads the design of a team, read the same way on every Studio page (Explorations, Changes, Review all, an
// exploration's decision panels, Settings, Quality, Home): one rule for a person signed in by email and a person signed
// in with GitHub, so two leads of two teams see the same pages.
//
//   - Signed in by email (an email member of the team): an admin of the team, or a member marked lead
//     (api/_lib/members.ts `lead`, given in Settings > Members). On the sample team every signed-out visitor reads as
//     Dana, its lead: the lead's pages, every write still behind the sample-team dialog.
//   - Signed in with GitHub: an admin of the team's repository, or one of its design owners (bridge.config.json
//     governance.owners.design, teams expanded by the caller); on a team that names none yet, anyone who may write.
//
// The server checks every write again: this only decides which view a page shows. Pure.

export interface LeadViewer {
  /** What the viewer may do on the team's repository (lib/access RepoAccess): `contributor` for an email member. */
  access: { admin?: boolean; write?: boolean; contributor?: boolean } | null | undefined;
  /** The viewer's email member record on this team, when signed in by email (lib/contribute ContributeMember). */
  member?: { role?: string | null; lead?: boolean | null } | null;
  /** The viewer's GitHub login, when signed in with GitHub. */
  login?: string | null;
  /** The team's design owners (GitHub logins, `@` allowed). */
  designOwners?: readonly string[] | null;
}

const key = (l: string) => l.trim().replace(/^@/, '').toLowerCase();
const listed = (login: string | null | undefined, list: readonly string[] | null | undefined) => Boolean(login && (list ?? []).some((l) => key(l) === key(login)));

/** Whether the viewer is a design lead of the team: the lead's views on every Studio page. */
export function isDesignLead(x: LeadViewer): boolean {
  // An email member: their record says it (an admin, or marked lead); an email session read before its record is
  // only as good as the access's admin flag.
  if (x.member || x.access?.contributor) return x.member ? x.member.role === 'admin' || x.member.lead === true : Boolean(x.access?.admin);
  if (!x.access) return false;
  if (x.access.admin) return true;
  // A team that names no design owner yet: anyone who may write leads, as anyone who may write reviews then
  // (lib/home-model holdsReviewRight).
  const named = (x.designOwners ?? []).filter((l) => key(l));
  return named.length ? listed(x.login, named) : Boolean(x.access.write);
}

/**
 * Whether the viewer may change the library itself (start an exploration in it, send a product its library update): a
 * design lead, or someone signed in with GitHub who may write and is a tech owner or may override (the people the
 * library's writes go to on GitHub, lib/write-route productRouteFor).
 */
export function leadsLibrary(x: LeadViewer & { techOwners?: readonly string[] | null; overrideAllowed?: readonly string[] | null }): boolean {
  if (isDesignLead(x)) return true;
  if (x.member || x.access?.contributor || !x.access?.write) return false;
  return listed(x.login, x.techOwners) || listed(x.login, x.overrideAllowed);
}
