// The exploration page's layout rules (the approved redesign, Nov 2026): who sees what in each stage, by role. Pure: no
// DOM, no fetch; covered by exploration-layout.test.ts. The page (components/ds/studio/ExplorationPage.tsx) reads them.
//
// Header: the title, ONE status tag (the only place the stage is said), "..." and, for a developer once the work is
// handed to developers, Code. Under it one plain line: "Sofia's exploration in Acme CRM, started Nov 6".
// Left column: the screen, What this changes in the library, Activity (one timeline with the decisions, the comment box
// at its end naming who reads it). Right column: the turn block (the one Harbor zone, always there: "Your turn" when
// the viewer acts now, else what happens now and the steps still to come, waitBlockOf), then the handover notes.
import { SEP_SPLIT } from './sep';

/** Who reads the page, as its rules see them. */
export type PageRole = 'owner' | 'designer' | 'lead' | 'developer' | 'pm' | 'viewer';

/** Where the exploration is, as the page lays it out. */
export type PageStage = 'not-started' | 'exploring' | 'waiting-for-lead' | 'ready' | 'building' | 'check' | 'shipped' | 'declined' | 'archived';

/**
 * The viewer's part on this page. `owner`: who started it or carries it on (their words, their Done exploring). `lead`:
 * a design lead on someone else's work. `pm`: the product manager of its product. `developer`: signed in with GitHub,
 * working in the code (never routed through Bridge as a designer, never an email member). Anyone else on the team who
 * designs is `designer`; signed out or unknown is `viewer`.
 */
export function pageRoleOf(x: { owner: boolean; lead: boolean; pm: boolean; github: boolean; viaBridge: boolean; member: boolean; signedIn: boolean }): PageRole {
  if (x.owner) return 'owner';
  if (x.lead) return 'lead';
  if (x.pm) return 'pm';
  if (x.github && !x.viaBridge && !x.member) return 'developer';
  if (x.signedIn) return 'designer';
  return 'viewer';
}

/** The stage of the page from what it knows: the lifecycle read, the wait on a lead, the build check. */
export function pageStageOf(x: { stage: 'loading' | 'not-started' | 'exploring' | 'handed-off'; archived?: boolean; waitingForLead?: boolean; handoff?: 'ready' | 'building' | 'shipped' | null; checking?: boolean; declined?: boolean }): PageStage {
  if (x.archived) return 'archived';
  if (x.stage === 'not-started' || x.stage === 'loading') return 'not-started';
  if (x.stage === 'exploring') return x.waitingForLead ? 'waiting-for-lead' : 'exploring';
  if (x.declined) return 'declined';
  if (x.handoff === 'shipped') return 'shipped';
  if (x.checking) return 'check';
  return x.handoff === 'building' ? 'building' : 'ready';
}

/** The stages after the work went to the developers: their Code button shows from here on. */
const HANDED: readonly PageStage[] = ['ready', 'building', 'check', 'shipped'];

/** Code (the GitHub-style popover) in the header: for a developer, once it is handed to developers. Designers never see git. */
export const codeShown = (role: PageRole, stage: PageStage): boolean => role === 'developer' && HANDED.includes(stage);

/** A developer while it is still explored: one line instead of any code. */
export const DEV_EXPLORING_LINE = "Still being explored. You get a task in your repository when it's ready.";
export const devLineOf = (role: PageRole, stage: PageStage): string | null => (role === 'developer' && (stage === 'exploring' || stage === 'waiting-for-lead') ? DEV_EXPLORING_LINE : null);

/** What the Harbor zone holds: only what waits on the viewer now, one primary action for the whole page. */
export type ZoneKind =
  | 'done' // the owner, exploring: Ready to hand it to Dana?
  | 'answer-lead' // the lead's words wait on the designer
  | 'not-doing' // ended by a lead, with the reason (the designer reads it)
  | 'lead-review' // the lead decides: send it to the developers
  | 'lead-take' // a reviewer: I'll look
  | 'pm' // the product manager's own say
  | 'declined' // the developers closed it: back to exploring
  | 'question' // a question on the task waits on the viewer
  | 'check' // Check the build: Looks right or Needs changes
  | 'their-version' // the developers' version waits for the viewer's answer
  | 'shipped' // the celebration
  | null;

/** The flags the page reads to pick the zone, in the order the turn goes. */
export interface ZoneFlags {
  archived: boolean;
  notDoing: boolean;
  /** The lead's words wait on this viewer (DesignerZone with a send). */
  answersLead: boolean;
  /** The lead's review bar is this viewer's. */
  leadBar: boolean;
  /** I'll look: a reviewer while nobody took it. */
  leadTake: boolean;
  pmMine: boolean;
  /** Done exploring is this viewer's (owner, exploring). */
  canDone: boolean;
  declinedBack: boolean;
  question: boolean;
  checkSay: boolean;
  theirVersion: boolean;
}

/**
 * Done exploring waits on the viewer only when the exploration is theirs: a lead (or anyone else) who may also say it
 * for the team (a keeper on someone else's work) follows it while it is explored, never "Your exploration".
 */
export const canSayDone = (role: PageRole, done: { kind: string } | null | undefined): boolean => role === 'owner' && done?.kind === 'run';

export function zoneOf(stage: PageStage, f: ZoneFlags): ZoneKind {
  if (f.notDoing) return 'not-doing';
  if (f.archived || stage === 'archived' || stage === 'not-started') return null;
  if (stage === 'shipped') return 'shipped';
  if (stage === 'declined') return f.declinedBack ? 'declined' : null;
  if (f.answersLead) return 'answer-lead';
  if (f.leadBar) return 'lead-review';
  if (f.leadTake) return 'lead-take';
  if (f.pmMine && (stage === 'exploring' || stage === 'waiting-for-lead')) return 'pm';
  if (stage === 'exploring') return f.canDone ? 'done' : null;
  // Check the build: the answer is the turn; a developer's note on it is the zone's quote, never a second zone.
  if (stage === 'check' && f.checkSay) return 'check';
  if (f.question) return 'question';
  if (stage === 'check') return null;
  if (f.theirVersion) return 'their-version';
  return null;
}

/** "Ready to hand it to Dana?": the owner's question while exploring. */
export const handOverTitle = (lead: string | null | undefined): string => (lead?.trim() ? `Ready to hand it to ${lead.trim()}?` : 'Ready to hand it over?');

/** "Left in your notes: the narrow screen, then the A/B call." from the handover notes' next step. */
export function notesContext(next: string | null | undefined): string | null {
  const t = next?.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const first = t.charAt(0).toLowerCase() + t.slice(1);
  return `Left in your notes: ${/[.?!]$/.test(first) ? first : `${first}.`}`;
}

/** "Sofia's exploration in Acme CRM, started Nov 6", from the author's name and the "Acme CRM · Nov 6" tail. */
export function ownerLine(name: string, tail: string, viewerIsAuthor = false): string {
  const [product, when] = tail.split(SEP_SPLIT).map((s) => s.trim());
  const who = viewerIsAuthor ? 'Your exploration' : `${name}${/s$/i.test(name) ? "'" : "'s"} exploration`;
  return [product ? `${who} in ${product}` : who, when ? `started ${when}` : ''].filter(Boolean).join(', ');
}

/** "Write to Malik and Dana": who reads the comment box, named. */
export function writeToLine(names: readonly string[]): string {
  const n = [...new Set(names.map((s) => s.trim()).filter(Boolean))];
  if (!n.length) return 'Write a note to the team';
  if (n.length === 1) return `Write to ${n[0]}`;
  if (n.length === 2) return `Write to ${n[0]} and ${n[1]}`;
  return `Write to ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

/** One line of the Activity timeline: an event of the branch, or a decision (a milestone, with its words quoted). */
export interface TimelineItem {
  key: string;
  who: { login: string; name: string; agent: boolean; avatar: string | null };
  /** After the name: "made a change: tighter card padding". */
  text: string;
  when: string;
  /** ISO, when known: the order. */
  at: string | null;
  /** A key step (Done exploring, a decision): a check dot instead of the face. */
  milestone: boolean;
  /** Their words, quoted under the line (a decision's reason, a developer's note). */
  quote: string | null;
}

/** The handover notes' commits: seeded by Bridge, saved from the page or by Claude (core explorations-github). */
const NOTES_COMMIT = /^(note|update|updated) where it stands[.!]?$/i;
export const NOTES_LINE = 'updated the handover notes';

/**
 * A commit subject that only repeats the exploration's name ("Save Bulk actions on products", "Update Bulk actions on
 * products"): it says nothing the page title does not, so the line reads "saved a change".
 */
export function quietChange(text: string, title: string | null | undefined): string {
  const m = /^made a change: (.*)$/i.exec(text.trim());
  // The handover notes' own commits (Bridge seeds them "Note where it stands", the page saves "Update where it stands").
  if (m && NOTES_COMMIT.test(m[1]!.trim())) return NOTES_LINE;
  const t = title?.trim().toLowerCase();
  if (!m || !t) return text;
  const said = m[1]!.trim().replace(/[.!]+$/, '').toLowerCase();
  const rest = said.replace(/^(save|saved|update|updated|wip|work on|edit|edited)\b\s*:?\s*/, '');
  return rest === t || said === t || rest === '' ? 'saved a change' : text;
}

/** "saved 2 changes", "made a change: Tighter padding, 2 times": a run of the same line, said once. */
export function groupedText(text: string, n: number): string {
  if (n < 2) return text;
  if (text === 'saved a change') return `saved ${n} changes`;
  if (text === 'made a change') return `made ${n} changes`;
  return `${text}, ${n} times`;
}

const MILESTONE = /^(said done exploring|done exploring|said it looks right|said it looks good|started the exploration|went back to exploring)/i;

/**
 * The events and the decisions in one timeline, oldest first (it reads down to the comment box). Events without a
 * time keep their order after the dated ones they came with. `quoted`: words already said elsewhere on the page (the
 * Your turn zone quotes them): the line stays, the quote does not repeat.
 */
export function timelineOf(
  events: readonly { who: TimelineItem['who']; text: string; when: string; at?: string | null }[],
  decisions: readonly { key: string; login: string; name: string; verb: string; why: string | null; at: string }[],
  when: (iso: string) => string,
  quoted: readonly string[] = [],
  title?: string | null,
): TimelineItem[] {
  const said = new Set(quoted.map((q) => q.trim()).filter(Boolean));
  const ev: TimelineItem[] = events.map((e, i) => ({ key: `e${i}`, who: e.who, text: quietChange(e.text, title), when: e.when, at: e.at ?? null, milestone: MILESTONE.test(e.text), quote: null }));
  const dc: TimelineItem[] = decisions.map((d) => ({
    key: `d${d.key}`,
    who: { login: d.login, name: d.name, agent: false, avatar: null },
    text: d.verb,
    when: when(d.at),
    at: d.at,
    milestone: true,
    quote: d.why && !said.has(d.why.trim()) ? d.why : null,
  }));
  // Events arrive newest first: reversed, they read oldest first, then the decisions fall in by their time.
  const all = [...ev.reverse(), ...dc];
  const sorted = all
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.at && b.x.at ? a.x.at.localeCompare(b.x.at) : a.i - b.i))
    .map(({ x }) => x);
  // The same person saying the same thing in a row reads once ("Leo saved 2 changes"), at the latest time.
  const out: { item: TimelineItem; text: string; n: number }[] = [];
  for (const x of sorted) {
    const prev = out[out.length - 1];
    if (prev && !x.milestone && !prev.item.milestone && !x.quote && !prev.item.quote && prev.item.who.login === x.who.login && prev.text === x.text) {
      prev.n += 1;
      prev.item = { ...x, key: prev.item.key };
      continue;
    }
    out.push({ item: x, text: x.text, n: 1 });
  }
  return out.map(({ item, text, n }) => (n > 1 ? { ...item, text: groupedText(text, n) } : item));
}

/**
 * The name of the screen an exploration shows, from its route ("/#/products?view=list" reads "Products",
 * "/?tenant=acme#/orders/65" reads "Order", "/#/contacts/31/show" reads "Contact"): never the last region it changed.
 * Null for the home or a route that names nothing.
 */
export function screenNameOfRoute(route: string | null | undefined): string | null {
  const r = route?.trim();
  if (!r) return null;
  const hash = r.indexOf('#');
  const path = (hash >= 0 ? r.slice(hash + 1) : r).replace(/[?].*$/, '');
  const segs = path.split('/').filter(Boolean);
  const isId = (s: string) => /^\d+$/.test(s) || /^[0-9a-f-]{8,}$/i.test(s);
  const words = segs.filter((s) => !isId(s) && !/^(show|edit|view|details?)$/i.test(s));
  const last = words[words.length - 1];
  if (!last) return null;
  // A page of one item ("/orders/65"): the item, in the singular.
  const one = segs.some(isId) && segs.indexOf(last) < segs.findIndex(isId);
  let name = decodeURIComponent(last).replace(/[-_.+]+/g, ' ').trim();
  if (one) name = name.replace(/ies$/i, 'y').replace(/(ss|sh|ch|x)es$/i, '$1').replace(/(?<!s)s$/i, '');
  return name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : null;
}

/** One plain sentence of what the exploration does, from its purpose: the first sentence, at most 200 characters. */
export function aboutLine(purpose: string | null | undefined): string | null {
  const t = purpose?.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const first = /^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t;
  const s = first.length > 200 ? `${first.slice(0, 199).replace(/\s+\S*$/, '')}...` : first;
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?]$/.test(cap) || cap.endsWith('...') ? cap : `${cap}.`;
}

/** The latest `keep` lines shown, the earlier ones folded: "2 earlier changes, Show". */
export function foldTimeline<T>(rows: readonly T[], keep = 4): { earlier: T[]; shown: T[] } {
  if (rows.length <= keep + 1) return { earlier: [], shown: [...rows] };
  return { earlier: rows.slice(0, rows.length - keep), shown: rows.slice(rows.length - keep) };
}

export const earlierLine = (n: number): string => `${n} earlier ${n === 1 ? 'change' : 'changes'}`;

/**
 * The two captures of Check the build show the same screen? Compared by their route ("/#/contacts/31/show"), when both
 * are known: never compare two different screens.
 */
export function sameScreen(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (r: string) => r.trim().replace(/^\/?#?\/?/, '').replace(/[?].*$/, '').replace(/\/+$/, '').toLowerCase();
  if (!a || !b) return true;
  return norm(a) === norm(b);
}

/**
 * Whether the screen's name only repeats the page title ("Fulfilment timeline" under "Order fulfilment timeline"):
 * every word of the shorter one sits in the longer one. The stage then shows its line alone, the name stays for
 * screen readers.
 */
export function repeatsTitle(screen: string | null | undefined, title: string | null | undefined): boolean {
  const words = (t: string) => t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const a = words(screen ?? '');
  const b = words(title ?? '');
  // A one-word screen ("Products" under "Bulk actions on products") names the screen, it never only repeats the title.
  if (a.length < 2 || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, new Set(b)] : [b, new Set(a)];
  return short.every((w) => long.has(w));
}

/** The words of the screen stage. */
export const SCREEN_WORDS = {
  open: 'Open the preview',
  openChip: 'Open',
  sameScreen: 'same screen, both versions',
  notSame: 'not the same screen yet',
  mismatch: (screen: string) => `This capture shows another screen, not ${screen}.`,
  mismatchHint: 'The two sides would compare different screens.',
  latest: (when: string) => (when ? `your latest version, ${when}` : 'your latest version'),
  /** The lead was asked, then the designer changed it: the screen says so, once, in its own line. */
  changedSinceAsked: (designer: string, when: string) => `${possessiveOf(designer)} version, changed ${when ? `${when}, ` : ''}after you were asked`,
} as const;

/** "Sofia's", "James'". */
export const possessiveOf = (name: string): string => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/**
 * The new library pieces the lead decides on the page (a new component the screen built): Add it to the library or Keep
 * it in the designer's screen. The choice is staged; Send to the developers applies it. Only for who can answer them.
 */
export function stagedPieces<T extends { id: string; kind: string; title: string; menu: readonly string[] }>(rows: readonly T[], canAct: boolean): T[] {
  return canAct ? rows.filter((r) => /^new component/i.test(r.kind) && r.menu.includes('approve') && r.menu.includes('local')) : [];
}

/** The words of a new piece's choice. */
export const NEW_PIECE_WORDS = {
  today: 'Today',
  nothing: 'Nothing like it in the library',
  noneYet: (title: string) => `No ${title.toLowerCase()} component`,
  asBuilt: (designer: string, title: string) => `${possessiveOf(designer)} ${title}`,
  asBuiltLine: 'As built in the screen',
  choice: 'Your choice',
  add: (title: string) => `Add ${title} to the library`,
  addHint: 'Every product can use it',
  keep: (designer: string) => `Keep it in ${possessiveOf(designer)} screen`,
  keepHint: 'Built for this screen only',
  applies: 'Sending to the developers applies your choice.',
} as const;

/** The words of the developers' Code popover. */
export const CODE_WORDS = {
  button: 'Code',
  title: 'Code for this exploration',
  terminal: 'Terminal',
  claude: 'Claude',
  getBranch: 'Get the branch',
  checkAgain: 'Check the pieces again',
  askClaude: 'Ask Claude which pieces are missing',
  pasteClaude: 'Paste it in Claude with the Bridge connector. It records the result on the task.',
  openTask: 'Open the task on GitHub',
} as const;

// ---------------------------------------------------------------------------------------------------------------
// The turn block (direction B, Nov 2026): the rail's blue block is always there. With an action it is "Your turn"
// (zoneOf). With nothing to do, it says so, names the step happening now as its title, lists the steps still to come
// with the current one marked, says in one sentence what happens next and holds at most one quiet button. The steps
// are said there once: no separate journey bar, no "Before it ships" list.

/** One step of the block's stepper. `when` follows the text, quiet: "now, for 3 days". */
export interface TurnStep {
  text: string;
  when?: string;
  current?: boolean;
}

/** The block's one button, when the viewer has something real to press. */
export type TurnBlockAction =
  | { kind: 'keep-exploring'; label: string }
  | { kind: 'see-choice'; label: string }
  | { kind: 'unarchive'; label: string }
  | { kind: 'change-view'; label: string }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'send' }
  | null;

export interface TurnBlock {
  eyebrow: string;
  title: string;
  steps: TurnStep[];
  /** The sentences under the stepper, in order: what happens next first. */
  lines: string[];
  action: TurnBlockAction;
}

/** A step of the hand-off as the page reads it (lib/exploration-page HandoffStep). */
export interface HandoffStepLike {
  status: 'done' | 'waiting' | 'warning';
  title: string;
  detail: string;
  current?: boolean;
  link?: { label: string; href: string } | null;
}

/** The review step's detail when the review is the viewer's own (lib/exploration-page.ts). */
export const YOUR_REVIEW = 'Your review';

/** Someone checking the developers' build (BuildCheckView rows), as the block names them. */
export interface CheckPerson {
  name: string;
  /** This viewer. */
  you: boolean;
  said: 'looks-right' | 'changes' | 'waiting' | 'not-needed';
}

/** A library choice the lead makes here that also sets the viewer's own screen in another exploration. */
export interface SharedChoice {
  component: string;
  property: string;
  /** The viewer's own exploration (its name) and its product: "Deal pipeline cards", "Acme CRM". */
  screen: string;
  product: string;
}

export interface WaitInput {
  stage: PageStage;
  role: PageRole;
  /** The exploration's designer, by name ("Sofia"). */
  author: string;
  /** The design lead who decides, by name; null when not known. */
  lead: string | null;
  /** The viewer is that lead (or a lead exploring with nobody else to ask). */
  viewerLeads: boolean;
  product: string;
  /** Whole days since the lead was asked (from the exploration's leadAskedAt); null when unknown. */
  waitedDays?: number | null;
  /** "Dana is looking at it.": a reviewer took it. */
  taken?: string | null;
  /** Who asked the lead can take it back before the lead answers. */
  canKeepExploring?: boolean;
  /** The lead's choice here also sets the viewer's own screen (another exploration of theirs). */
  shared?: SharedChoice | null;
  /** The owner who cannot say Done exploring here (an email member on the product itself): the line that says why. */
  doneNote?: string | null;
  /** After Done exploring: the hand-off's steps. */
  steps?: readonly HandoffStepLike[];
  /** Check the build: who checks it, and what they said. */
  checkers?: readonly CheckPerson[];
  /** The developer building it, by name, when known. */
  builder?: string | null;
  /** The product's developers work elsewhere: "Copy for your developers" is the block's action. */
  send?: boolean;
  /** Archived: Unarchive for who may. */
  canUnarchive?: boolean;
  archivedLine?: string;
  declinedLine?: string;
}

export const TURN_WORDS = {
  nothing: 'Nothing to do for now',
  forDevelopers: 'For the developers',
  optional: 'Optional for you',
  yourTurn: 'Your turn',
  keepExploring: 'Keep exploring',
  unarchive: 'Unarchive',
  giveView: 'Give your view',
  changeView: 'Change your view',
  devCode: 'Code, next to the title, has the branch and the commands.',
} as const;

const named = (lead: string | null): string => lead?.trim() || 'The design lead';
/** "the design lead" mid-sentence; a name stays as it is. */
const midSentence = (s: string): string => (/^The /.test(s) ? `the ${s.slice(4)}` : s);
const andList = (names: readonly string[]): string => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** "Dana decides what the library keeps", "You decide what the library keeps"; short: "Dana decides". */
export function leadStepText(x: { lead: string | null; viewerLeads: boolean }, short = false): string {
  const who = x.viewerLeads ? 'You' : named(x.lead);
  const verb = x.viewerLeads ? 'decide' : 'decides';
  return short ? `${who} ${verb}` : `${who} ${verb} what the library keeps`;
}

/** "now, for 3 days" from the whole days since the lead was asked; "now" when unknown. */
export function waitedWhen(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days) || days < 0) return 'now';
  if (days < 1) return 'now, since today';
  if (days < 2) return 'now, since yesterday';
  return `now, for ${Math.floor(days)} days`;
}

/** Whole days between the lead's ask (ISO) and now; null when unknown. */
export function daysSince(iso: string | null | undefined, now: number): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && now >= t ? Math.floor((now - t) / 86_400_000) : null;
}

const checkStep = (owner: boolean, author: string): string => (owner ? 'You check their version' : `${author} checks their version`);
const buildStep = (product: string, builder?: string | null): string => (builder ? `${builder} builds it` : `${product} developers build it`);
const liveStep = (product: string): string => `Live in ${product}`;

/** The library block's open choices, as sharedChoiceOf reads them (lib/library-impact-view ConflictView). */
export interface ChoiceLike {
  component: string;
  property: string;
  pick: string | null;
  decided: unknown;
  ways: readonly { designer: string; mine: boolean; screen: string; product: string }[];
}

/**
 * A library choice still open on this page that also sets the viewer's own screen: a component part this exploration
 * and one of the viewer's own change differently (the library block's conflict, its other way theirs). Read from the
 * library block's data, never assumed.
 */
export function sharedChoiceOf(me: string | null | undefined, conflicts: readonly ChoiceLike[]): SharedChoice | null {
  const who = me?.trim().toLowerCase();
  if (!who) return null;
  for (const c of conflicts) {
    if (c.decided || c.pick) continue;
    const theirs = c.ways.find((w) => !w.mine && w.designer.trim().toLowerCase() === who);
    if (theirs) return { component: c.component, property: c.property, screen: theirs.screen, product: theirs.product };
  }
  return null;
}

/** "Dana's Card padding choice also sets your Deal pipeline cards in Acme CRM." */
export function sharedChoiceLine(s: SharedChoice, lead: string | null): string {
  const who = lead?.trim() ? possessiveOf(lead.trim()) : "The design lead's";
  return `${who} ${s.component} ${s.property.toLowerCase()} choice also sets your ${s.screen} in ${s.product}.`;
}

/** The hand-off's steps from the current one on, in the block's words. */
function handoffStepsOf(steps: readonly HandoffStepLike[], x: { owner: boolean; author: string; product: string; builder?: string | null }): TurnStep[] {
  const from = Math.max(0, steps.findIndex((s) => s.current));
  return steps
    .slice(from)
    .filter((s) => s.status !== 'done' || s.current)
    .map((s) => {
      const text =
        s.title === 'Developers build it'
          ? buildStep(x.product, s.current ? x.builder : null)
          : s.title === 'Review'
            ? s.current && s.detail === YOUR_REVIEW
              ? 'You review it'
              : checkStep(x.owner, x.author)
            : s.title === 'Shipped'
              ? liveStep(x.product)
              : s.title;
      return { text, ...(s.current ? { current: true, when: 'now' } : {}) };
    });
}

/**
 * The block while the viewer has nothing to do (zoneOf gave no zone), by stage and role. Null before anything was
 * built (not started: the page has no rail) and once shipped (the Shipped zone is always there).
 */
export function waitBlockOf(x: WaitInput): TurnBlock | null {
  const owner = x.role === 'owner';
  const dev = x.role === 'developer';
  const lead = named(x.lead);
  const leadName = x.lead?.trim() || null;
  const product = x.product || 'the product';
  const shared = x.shared && !x.viewerLeads && !owner ? x.shared : null;
  const see: TurnBlockAction = shared ? { kind: 'see-choice', label: `See the ${shared.component} ${shared.property.toLowerCase()} choice` } : null;
  switch (x.stage) {
    case 'not-started':
    case 'shipped':
      return null;
    case 'archived':
      return {
        // The tag already says Archived: the eyebrow never repeats it.
        eyebrow: TURN_WORDS.nothing,
        title: 'Nobody works on it now',
        steps: [],
        lines: [x.archivedLine ?? 'Hidden from the lists, its preview still works.'],
        action: x.canUnarchive ? { kind: 'unarchive', label: TURN_WORDS.unarchive } : null,
      };
    case 'declined':
      return { eyebrow: TURN_WORDS.nothing, title: 'The developers did not build it', steps: [], lines: [x.declinedLine ?? 'Developers closed it without building it.'], action: null };
    case 'exploring': {
      const steps: TurnStep[] = [
        { text: owner ? 'You explore' : `${x.author} explores`, when: 'now', current: true },
        { text: leadStepText({ lead: x.lead, viewerLeads: x.viewerLeads }) },
        { text: buildStep(product) },
        { text: liveStep(product) },
      ];
      const says = owner ? 'you say' : `${x.author} says`;
      const next = dev ? DEV_EXPLORING_LINE : x.viewerLeads ? `It reaches you when ${says} Done exploring.` : `It goes to ${midSentence(lead)} when ${says} Done exploring.`;
      const lines = [owner && x.doneNote ? x.doneNote : next];
      if (shared) lines.push(`This screen's ${shared.component} ${shared.property.toLowerCase()} also sets your ${shared.screen} in ${shared.product}.`);
      return { eyebrow: TURN_WORDS.nothing, title: owner ? 'You are exploring' : `${x.author} is exploring`, steps, lines, action: see };
    }
    case 'waiting-for-lead': {
      const steps: TurnStep[] = [
        { text: leadStepText({ lead: x.lead, viewerLeads: x.viewerLeads }, true), when: waitedWhen(x.waitedDays), current: true },
        { text: buildStep(product) },
        { text: checkStep(owner, x.author) },
        { text: liveStep(product) },
      ];
      const lines: string[] = [];
      if (x.taken) lines.push(x.taken);
      if (dev) lines.push(`You get a task in your repository once ${midSentence(lead)} sends it.`);
      else if (shared) lines.push(`${sharedChoiceLine(shared, x.lead)} Bridge tells you what ${leadName ? `${leadName} picks` : 'the design lead picks'}.`);
      // The reminder is Bridge's rule (api/_lib/notify.ts REMIND_MS): said as the rule, never as something that happened.
      else if (owner) lines.push(`Bridge reminds ${leadName ?? 'the design leads'} once after 2 days without an answer, and tells you as soon as there is one.`);
      else lines.push(`Nothing reaches the developers before ${midSentence(lead)} sends it.`);
      const action: TurnBlockAction = owner && x.canKeepExploring ? { kind: 'keep-exploring', label: TURN_WORDS.keepExploring } : see;
      return { eyebrow: TURN_WORDS.nothing, title: leadStepText({ lead: x.lead, viewerLeads: x.viewerLeads }), steps, lines, action };
    }
    case 'check': {
      const people = (x.checkers ?? []).filter((c) => c.said !== 'not-needed');
      const waiting = people.filter((c) => c.said === 'waiting').map((c) => (c.you ? 'You' : c.name));
      const one = waiting.length === 1 && waiting[0] !== 'You';
      const title = waiting.length ? `${andList(waiting)} ${one ? 'checks' : 'check'} the build` : 'The build is being checked';
      const lines = people.filter((c) => c.said !== 'waiting').map((c) => `${c.you ? 'You' : c.name} ${c.said === 'looks-right' ? 'said it looks right' : 'asked for changes'}.`);
      lines.push(`It goes live in ${product} once it looks right.`);
      return { eyebrow: TURN_WORDS.nothing, title, steps: [{ text: waiting.length ? `${andList(waiting)} ${one ? 'checks' : 'check'}` : 'The build is checked', when: 'now', current: true }, { text: liveStep(product) }], lines, action: null };
    }
    case 'ready':
    case 'building': {
      const steps = handoffStepsOf(x.steps ?? [], { owner, author: x.author, product, builder: x.builder ?? null });
      const now = (x.steps ?? []).find((s) => s.current);
      const title = steps[0]?.text ?? buildStep(product, x.builder);
      // The viewer was asked to review it (a library exploration): theirs, with the way to compare.
      if (now?.title === 'Review' && now.detail === YOUR_REVIEW)
        return { eyebrow: TURN_WORDS.yourTurn, title, steps, lines: [], action: now.link ? { kind: 'link', label: now.link.label, href: now.link.href } : null };
      const lines = now?.detail && !x.send ? [now.detail.replace(/([^.?!])$/, '$1.')] : [];
      if (dev) lines.push(TURN_WORDS.devCode);
      return { eyebrow: dev ? TURN_WORDS.forDevelopers : TURN_WORDS.nothing, title, steps, lines, action: x.send ? { kind: 'send' } : null };
    }
  }
}

/**
 * The product manager's view (boards R1, R3) as the turn block. Once the lead is asked their view is optional ("Give
 * your view"); while it is explored the designer shares it with them first. Said: their step is done, the block waits
 * like everyone else's and their word stays changeable.
 */
export function pmBlockOf(x: { stage: PageStage; said: boolean; lead: string | null; author: string; product: string; line: string }): TurnBlock {
  const lead = named(x.lead);
  const leadName = x.lead?.trim() || null;
  const product = x.product || 'the product';
  const asked = x.stage === 'waiting-for-lead';
  const decides = leadStepText({ lead: x.lead, viewerLeads: false });
  const last = { text: `${x.author} checks, then it goes live` };
  if (x.said)
    return {
      eyebrow: TURN_WORDS.nothing,
      title: asked ? decides : `${x.author} is exploring`,
      steps: asked
        ? [{ text: leadStepText({ lead: x.lead, viewerLeads: false }, true), when: 'now', current: true }, { text: buildStep(product) }, last]
        : [{ text: `${x.author} explores`, when: 'now', current: true }, { text: decides }, { text: buildStep(product) }, last],
      lines: [x.line],
      action: { kind: 'change-view', label: TURN_WORDS.changeView },
    };
  return {
    eyebrow: asked ? TURN_WORDS.optional : TURN_WORDS.yourTurn,
    title: `Your view, before ${midSentence(lead)} decides`,
    steps: asked
      ? [{ text: 'You give your view', when: 'optional, now', current: true }, { text: decides }, { text: buildStep(product) }, last]
      : [{ text: 'You give your view', when: 'now', current: true }, { text: `${x.author} says Done exploring` }, { text: decides }, { text: buildStep(product) }],
    lines: [asked ? `${lead} can decide without it. If you give it, ${leadName ? `${leadName} reads` : 'they read'} it first.` : `${x.author} shares it with you before it goes to ${midSentence(lead)}.`],
    action: null,
  };
}
