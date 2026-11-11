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

/**
 * The lead who decides on a team's explorations, by first name, as Studio names them to everyone else ("Dana decides
 * before the developers build it"): on a team whose leads are members by email, its lead who runs the team (an admin
 * marked lead) first, else its first lead; never a GitHub design owner then, who is not the one asked on such a team.
 * A team without an email lead names its GitHub leads (`github`, the names this browser knows), else its email admin.
 * Empty when unknown. `except`: a lead exploring themselves (their first name): the other lead, never them, and never
 * the admin as a stand-in.
 */
export function deciderNames(members: readonly { name: string; role: string; lead?: boolean }[] | null | undefined, github: readonly string[], except?: string | null): string[] {
  const firstWord = (n: string) => n.trim().split(/\s+/)[0]!;
  const other = (n: string) => !except?.trim() || firstWord(n).toLowerCase() !== firstWord(except).toLowerCase();
  const named = (members ?? []).filter((m) => m.name.trim() && other(m.name));
  const leads = named.filter((m) => m.lead);
  const first = (m: { name: string } | undefined) => (m ? [firstWord(m.name)] : []);
  if (leads.length) return first(leads.find((m) => m.role === 'admin') ?? leads[0]);
  const ghLeads = github.filter(other);
  if (ghLeads.length) return ghLeads;
  return except?.trim() ? [] : first(named.find((m) => m.role === 'admin'));
}

/**
 * Who a review ask goes to (Done exploring, a designer's answer, Ask someone else to review), by the same rule as
 * deciderNames: on a team whose reviewers are members by email, those members (`names`, the lead who runs the team
 * first) and nobody is mentioned on GitHub, since no design owner is the one asked there; else the team's GitHub design
 * owners (`mention`, logins; a team handle and the viewer never). `except`: who asks (their reference, login or name),
 * never asked themselves.
 */
export function reviewAsk(x: {
  emailLeads: readonly { name: string; role?: string | null; ref?: string | null }[];
  githubLeads: readonly string[];
  except?: { ref?: string | null; login?: string | null; name?: string | null } | null;
}): { mention: string[]; names: string[] } {
  const firstWord = (n: string) => n.trim().split(/\s+/)[0]!;
  const ex = x.except ?? {};
  const named = x.emailLeads.filter((m) => m.name.trim());
  if (named.length) {
    const others = named.filter((m) => !(ex.ref && m.ref === ex.ref) && !(ex.name?.trim() && firstWord(m.name).toLowerCase() === firstWord(ex.name).toLowerCase()));
    const ordered = [...others.filter((m) => m.role === 'admin'), ...others.filter((m) => m.role !== 'admin')];
    return { mention: [], names: ordered.map((m) => firstWord(m.name)) };
  }
  const mention = x.githubLeads.map((l) => l.trim().replace(/^@/, '')).filter((l) => l && !l.includes('/') && key(l) !== key(ex.login ?? ''));
  return { mention, names: [] };
}
