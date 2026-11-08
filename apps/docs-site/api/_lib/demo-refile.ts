// The sample team's requests and suggestions, filed again the way Bridge files them for an email member.
//
// The sample team (src/lib/demo.ts SAMPLE_REPO) got its component change requests and suggestions from its maintainer's
// own GitHub account, so Studio names that account on them (Being built, Changes), where a real team whose designers
// joined by email sees the designer: Bridge opens their issues with its GitHub App and a "Requested by <name> through
// Bridge." line (api/contribute planCall, src/lib/author.ts authorFor). This plans the fix: each such open issue filed
// again for one of the sample team's members (api/_lib/demo-members.ts), same title, body and labels, through the very
// path a member's own request takes (api/contribute runAsMember); the old one closed as a duplicate with a comment that
// links its replacement, never deleted; a developer's pull request that closes it pointed at the replacement.
//
// Pure: planDemoRefile reads GitHub's REST shapes and says what to do, api/contribute action `refile-demo` does it
// (scripts/refile-demo-items.mjs). Covered by src/lib/demo-refile.test.ts. Bundled with api/contribute, which ships
// without the core package: the two readings of core it needs are kept here, and the test holds them equal to core's.
import { DEMO_MEMBERS, RETIRED_DEMO_MEMBERS, type DemoMember } from './demo-members.js';

/** Labels of what a member files as an issue: a component change request (a build request) or a suggestion. */
export const REFILE_LABELS: readonly string[] = ['component-change', 'bridge-build', 'bridge-suggestion'];

/**
 * Who asks for what, by the title's subject ("Card: a subtle tone…"), when the body names nobody on the team: designers
 * (Leo, Sofia, Ann). A body that already names a member keeps them. Never the team's developer: what he asks for he
 * files from his own GitHub account (RETIRED_DEMO_MEMBERS), as a real team's developer does.
 */
export const DEMO_REQUESTERS: Readonly<Record<string, string>> = {
  Avatar: 'sofia@acme.example',
  Button: 'ann@acme.example',
  Card: 'leo@acme.example',
  EmptyState: 'leo@acme.example',
  ProfileHeader: 'ann@acme.example',
  Select: 'sofia@acme.example',
  Table: 'leo@acme.example',
  Toast: 'leo@acme.example',
};

/** Anyone else's ask, when neither the body nor the table names someone. */
export const DEFAULT_REQUESTER = 'leo@acme.example';

/** The fields of GET /repos/{o}/{r}/issues and /pulls this reads. */
export interface RefileIssue {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  labels: ({ name?: string } | string)[];
  user?: { login: string } | null;
  pull_request?: unknown;
}

export interface RefilePull {
  number: number;
  body?: string | null;
  state: string;
}

export interface RefileItem {
  /** The issue filed by the maintainer's account. */
  old: number;
  title: string;
  labels: string[];
  /** The body to file: the old one without its hand-written "Requested by" line (the member's line replaces it). */
  body: string;
  member: Pick<DemoMember, 'email' | 'name'>;
  /** Why this member: the body's line names them, or the subject table. */
  why: 'body' | 'subject' | 'default';
  /** An open replacement already filed through Bridge for this member (a run that stopped halfway): reused, not filed again. */
  existing: number | null;
  /** Open pull requests that close the old issue: their "Closes #old" becomes "Closes #new". */
  relink: number[];
}

export interface RefilePlan {
  items: RefileItem[];
  skipped: { number: number; title: string; why: string }[];
}

/** An app account ("bridge-design-studio[bot]"): it opens work for people, it is never the person (src/lib/author.ts). */
export const isAppLogin = (login: string | null | undefined): boolean => Boolean(login) && (/\[bot\]$/i.test(login!.trim()) || /^app\//i.test(login!.trim()));

/** Issue numbers a pull request body closes ("Closes #42", "fixes #7", "resolves #3"): core requests.ts closingIssueNumbers. */
export function closingIssueNumbers(body: string | null | undefined): number[] {
  const out = new Set<number>();
  for (const m of (body ?? '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) out.add(Number(m[1]));
  return [...out];
}

/** The name the first "Requested by <name>." line gives (Bridge's "… through Bridge." too), else null: core requesterOf, names only. */
export function requesterName(body: string | null | undefined): string | null {
  const m = /(?:^|\n)[ \t>*_-]*(?:<sub>)?\s*Requested (?:from [^\n<]{1,40}? )?by ([^\n<]{1,120}?)(?:\s+with Bridge)?\.?\s*(?:<\/sub>)?[ \t]*(?=\n|$)/i.exec(body ?? '');
  if (!m) return null;
  const who = m[1]!.trim().replace(/\.$/, '').replace(/\s+through Bridge$/i, '').replace(/\s*\([^()\s@]+@[^()\s]+\)$/, '');
  const both = /^(.+?)\s*\(@([^)\s]+)\)$/.exec(who);
  if (both) return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(both[2]!) ? both[1]!.trim() : null;
  if (who.startsWith('@')) return null;
  return /^[\p{L}][\p{L}'’. -]{0,60}$/u.test(who) && who.split(/\s+/).length <= 5 ? who : null;
}

const labelNames = (labels: RefileIssue['labels']) => labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean);

/** A requester line written by hand ("Requested by Leo."), not Bridge's own ("… through Bridge."). */
const HAND_LINE = /^[ \t]*(?:<sub>)?[ \t]*Requested by (?![^\n]*through Bridge)[^\n<]{1,120}?\.?[ \t]*(?:<\/sub>)?[ \t]*$/gim;

/** The body without its hand-written requester line, trailing blank lines dropped. */
export const withoutHandLine = (body: string): string => body.replace(HAND_LINE, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');

const byName = (name: string | null | undefined) => (name ? DEMO_MEMBERS.find((m) => m.name.toLowerCase() === name.trim().toLowerCase()) : undefined);
const byEmail = (email: string) => DEMO_MEMBERS.find((m) => m.email === email)!;

/** Someone the sample team once had as an email member, by the name a body's line gives (RETIRED_DEMO_MEMBERS). */
export const retiredRequester = (body: string | null | undefined) => {
  const name = requesterName(body)?.trim().toLowerCase();
  return name ? RETIRED_DEMO_MEMBERS.find((m) => m.name.toLowerCase() === name) : undefined;
};

/** Why an issue whose line names a former email member is left as it is. */
export const retiredWhy = (r: { name: string; github: string }): string => `requested by ${r.name}, who files from his GitHub account (${r.github}), not as an email member`;

/** The member an issue is filed again for, and why. */
export function requesterFor(i: Pick<RefileIssue, 'title' | 'body'>): { member: DemoMember; why: RefileItem['why'] } {
  const named = byName(requesterName(i.body));
  if (named) return { member: named, why: 'body' };
  const subject = /^([^:]+):/.exec(i.title)?.[1]?.trim() ?? '';
  const table = DEMO_REQUESTERS[subject];
  return table ? { member: byEmail(table), why: 'subject' } : { member: byEmail(DEFAULT_REQUESTER), why: 'default' };
}

/** Whether Bridge's App filed this issue for a member already: the app opened it and its line says so. */
const filedThroughBridge = (i: RefileIssue) => isAppLogin(i.user?.login) && /Requested by [^\n]+ through Bridge\./.test(i.body ?? '');

/** What to file again: the open requests and suggestions an account (not the App) opened. Pure. */
export function planDemoRefile(input: { issues: readonly RefileIssue[]; pulls: readonly RefilePull[] }): RefilePlan {
  const out: RefilePlan = { items: [], skipped: [] };
  const open = input.issues.filter((i) => i.state === 'open' && !i.pull_request);
  const replacements = open.filter(filedThroughBridge);
  for (const i of open) {
    const labels = labelNames(i.labels);
    if (!labels.some((l) => REFILE_LABELS.includes(l))) continue;
    if (isAppLogin(i.user?.login)) continue;
    const retired = retiredRequester(i.body);
    if (retired) {
      out.skipped.push({ number: i.number, title: i.title, why: retiredWhy(retired) });
      continue;
    }
    const { member, why } = requesterFor(i);
    const existing = replacements.find((r) => r.title === i.title && requesterName(r.body) === member.name)?.number ?? null;
    const relink = input.pulls.filter((p) => p.state === 'open' && closingIssueNumbers(p.body).includes(i.number)).map((p) => p.number);
    out.items.push({ old: i.number, title: i.title, labels, body: withoutHandLine(i.body ?? ''), member: { email: member.email, name: member.name }, why, existing, relink });
  }
  for (const i of open) {
    const labels = labelNames(i.labels);
    if (labels.some((l) => REFILE_LABELS.includes(l)) || isAppLogin(i.user?.login)) continue;
    out.skipped.push({ number: i.number, title: i.title, why: 'not a request or a suggestion' });
  }
  out.items.sort((a, b) => a.old - b.old);
  out.skipped.sort((a, b) => a.number - b.number);
  return out;
}

/** "Closes #old" (any closing keyword) becomes "Closes #new"; everything else in the body stays. */
export function relinkBody(body: string, from: number, to: number): string {
  return body.replace(new RegExp(`\\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)(\\s+)#${from}\\b`, 'gi'), `$1$2#${to}`);
}

/** An open pull request of a design copy, as GET /repos/{o}/{r}/pulls gives it. */
export interface CopyPull {
  number: number;
  state: string;
  body?: string | null;
  head?: { ref?: string; repo?: { full_name?: string } | null } | null;
  base?: { repo?: { full_name?: string } | null } | null;
  labels?: ({ name?: string } | string)[] | null;
}

/**
 * The sample team's explorations a member started, from a design copy's open pull requests: an explore/* branch of the
 * copy itself, not archived, whose Bridge block names a member of the sample team (memberName, read by `nameOf`).
 */
export function demoExplorationsOf(pulls: readonly CopyPull[], nameOf: (body: string) => unknown): { items: { pull: number; branch: string; member: Pick<DemoMember, 'email' | 'name'> }[]; skipped: { pull: number; why: string }[] } {
  const out = { items: [] as { pull: number; branch: string; member: Pick<DemoMember, 'email' | 'name'> }[], skipped: [] as { pull: number; why: string }[] };
  for (const p of pulls) {
    const branch = p.head?.ref ?? '';
    if (p.state !== 'open' || !branch.startsWith('explore/')) continue;
    const own = p.head?.repo?.full_name && p.base?.repo?.full_name && p.head.repo.full_name.toLowerCase() === p.base.repo.full_name.toLowerCase();
    if (!own) {
      out.skipped.push({ pull: p.number, why: 'its branch is in another repository' });
      continue;
    }
    if (labelNames(p.labels ?? []).includes('archived')) {
      out.skipped.push({ pull: p.number, why: 'archived' });
      continue;
    }
    const name = nameOf(p.body ?? '');
    const member = typeof name === 'string' ? byName(name) : undefined;
    if (!member) {
      out.skipped.push({ pull: p.number, why: 'it names no member of the sample team' });
      continue;
    }
    out.items.push({ pull: p.number, branch, member: { email: member.email, name: member.name } });
  }
  out.items.sort((a, b) => a.pull - b.pull);
  return out;
}

/** The comment left on the old issue before it closes as a duplicate. */
export const refiledComment = (name: string, to: number): string =>
  `Filed again through Bridge for ${name} as #${to}, so Studio shows who asked for it. Follow it there. Nothing is lost: this issue stays in the history.`;
