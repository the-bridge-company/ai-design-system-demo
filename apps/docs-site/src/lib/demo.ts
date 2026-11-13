// The demo: which design systems are the public demo, and the words a visitor reads there. Pure: no DOM, no
// fetch, covered by demo.test.ts.
//
// A visitor without an account explores the sample team as its lead (Dana, a read-only email member session,
// api/_lib/demo-members.ts): every screen runs the code of any team, and the server refuses each write in the
// sample-team dialog's words (403 `demo`, api/contribute demoWriteRefusal). The sample team has one banner and one call to
// action everywhere, Studio and Library: "Get started", the email sign-in (never GitHub). Edits stay in this browser as
// drafts for the visit (scripts/demo-drafts.ts); every action that would write opens the sample-team dialog (components/ds/studio/MakeItYours.tsx,
// scripts/demo-gate.ts). Everyone reads the sample team that way, signed in or not: a GitHub sign-in or a Bridge account
// of the browser never takes part there (scripts/github-session.ts onSampleTeam). On Bridge's own design system,
// someone who can write to it keeps the normal Studio.

import { canonicalRepo, isTeamKey } from './team-path.js';

/**
 * The design systems that are the public demo, lower case "owner/repo": the self-hosted site's own repository and
 * the demo team on the hosted site (/studio/peterbono/bridge-demo-ds/). The one place to change what "demo" means.
 */
// Current names only: an old one (peterbono/ai-design-system-demo) is read as its new name by isDemoRepo
// (team-path.ts canonicalRepo, the one map of renamed repositories).
export const DEMO_REPOS: readonly string[] = ['the-bridge-company/ai-design-system-demo', 'acme-design-demo/bridge-demo-ds'];

/** True for a demo design system ("owner/repo", any case, old name or new). */
export const isDemoRepo = (repo: string | null | undefined): boolean => DEMO_REPOS.includes(canonicalRepo(repo ?? '').toLowerCase());

/**
 * The two demo design systems are not the same thing for a visitor, so they never share a name:
 *   - peterbono/bridge-demo-ds is a simulated team with sample data: "Acme Design" (Dana leads its design system).
 *   - the-bridge-company/ai-design-system-demo is Bridge's own design system, the real one behind this site: "Bridge DS".
 */
export const SAMPLE_REPO = 'acme-design-demo/bridge-demo-ds';
export const SAMPLE_TEAM = 'Acme Design';
/** Matches `name` in the root bridge.config.json (demo.test.ts checks), for pages that name it before its settings are read. */
export const OWN_TEAM = 'Bridge DS';

/** True for the simulated team with sample data ("owner/repo", any case). */
export const isSampleTeam = (repo: string | null | undefined): boolean => canonicalRepo((repo ?? '').trim()).toLowerCase() === SAMPLE_REPO;

/** The repository part of "owner/repo" in words: "ai-design-system-demo" reads "Ai design system demo". */
export const humanizeRepo = (repo: string): string => {
  const part = repo.trim().split('/').pop()?.trim() ?? '';
  const words = part.replace(/[-_.\s]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : repo.trim();
};

/**
 * The one name a team goes by everywhere it is named (the team chip and its menu, recent teams, the Library, Settings,
 * the invite page and email): bridge.config.json `name` when the team set one (`config`, its settings once read; the
 * sample team's names it Acme Design), else Bridge for Bridge's own design system, else the repository name in words
 * ("Design system", never "acme/design-system").
 */
export const teamDisplayName = (repo: string, config?: { name?: unknown } | null): string => {
  // The sample team's name is a fixture, first: whatever else names it (a name kept in this browser or by the account,
  // a snapshot read before its settings), it never paints "Bridge demo ds".
  if (isSampleTeam(repo)) return SAMPLE_TEAM;
  const own = typeof config?.name === 'string' ? config.name.trim().replace(/\s+/g, ' ') : '';
  if (own) return own;
  if (isTeamKey(repo)) return 'Your team';
  if (isDemoRepo(repo)) return OWN_TEAM;
  return humanizeRepo(repo);
};

/** " on Bridge" after a team's name, or nothing when the team is Bridge itself: never "Join Bridge on Bridge". */
export const onBridge = (team: string): string => (team.trim().toLowerCase() === 'bridge' ? '' : ' on Bridge');

/**
 * The visitor explores the demo: it is a demo repository and they cannot write to it. Signed in, `write` stays
 * unknown (null) until GitHub answers; until then the Studio behaves as usual, so its owner is never stopped.
 */
export function exploresDemo(x: { repo: string | null | undefined; signedIn: boolean; write: boolean | null }): boolean {
  if (!isDemoRepo(x.repo)) return false;
  if (!x.signedIn) return true;
  return x.write === false;
}

// ---------------------------------------------------------------------------------------------------------------
// The words

export const DEMO_WORDS = {
  /** The one banner of the sample team, on every Studio and Library page (board D1). */
  bannerTitle: `${SAMPLE_TEAM}.`,
  bannerText: 'This is a sample team: your edits stay in this browser and nothing is sent.',
  /** On a phone the banner folds to one line: this button opens the sentence (and "See it as") under it. */
  bannerDetails: 'Details',
  /** The one call to action of the sample team: the email sign-in (lib/account.ts SIGNIN_PAGE), never GitHub. */
  getStarted: 'Get started',
  /** The same banner on Bridge's own design system, for a guest: its data is real, so it is not called sample data. */
  ownSampleTitle: `${OWN_TEAM}, read only.`,
  ownSampleText: "You're looking at the design system behind Bridge. Nothing here changes your own design system.",
  backToWorkspace: 'Back to your workspace',
  /** The same banner for someone who has no workspace yet. */
  connectOwn: 'Connect your design system',
  /** A write action on the sample team (board D2). */
  dialogTitle: 'This is a sample team.',
  dialogLead: 'Nothing is sent from Acme Design. Get started to do this with your own team.',
  /** The same dialog on Bridge's own design system: real data, read only for a visitor, never called the demo. */
  ownDialogTitle: 'Sign in with GitHub to do this.',
  ownDialogLead: 'This is the design system behind Bridge, read only for visitors. Nothing is saved.',
  dialogNote: 'You pick the repos Bridge can see. It starts read-only and asks again before it writes anything.',
  /** The sample-team dialog's note: what happens on a real team. */
  sampleNote: 'With your own team, Bridge reads your design system and sends nothing until you ask.',
  keepExploring: 'Keep exploring',
  /** After Looks right on the sample team (it runs in this browser, SAMPLE_IN_BROWSER): nothing is sent. */
  sampleLooksRight: 'On the sample team it stays in this browser.',
  /** Start an exploration on the sample team: it starts in this browser, nothing is sent. */
  sampleStartTitle: 'Started in this browser',
  /** Add a product on the sample team: it is added in this browser (SAMPLE_IN_BROWSER), nothing is sent. */
  sampleProduct: 'On the sample team it stays in this browser.',

  /** The account menu's way to the sample team, for a signed-in member (never between real teams in the team menu). */
  tryIt: `Try it · ${SAMPLE_TEAM}`,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Drafts made on the sample team (token edits, docs edits, a new brand) stay in this
// browser for the visit and never mix with a real team's: entering the sample team puts a real draft aside, leaving it for any other page drops the
// sample drafts and brings the real draft back. Pure over a Storage-like store (scripts/demo-drafts.ts runs it).

/** The token and docs draft every Studio page shares (scripts/token-editor.ts). */
export const SHARED_DRAFT_KEY = 'bridge.draft.v1';
/** Where a real draft waits while the visitor is on the sample team. */
export const DEMO_STASH_KEY = 'bridge.draft.v1.before-demo';
/** Set while the visitor is on the sample team: their drafts there are sample drafts. */
export const DEMO_VISIT_KEY = 'bridge.demo.visit';

export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

/** The keys of drafts kept for the sample team only: its brand draft and its per-change drafts. */
const sampleScoped = (k: string) => {
  const low = k.toLowerCase();
  return low.startsWith('bridge.') && low.includes(SAMPLE_REPO) && /draft/.test(low);
};

/** Keeps sample drafts and real drafts apart. `onSample`: this page is the sample team. Returns what it did. */
export function swapDemoDrafts(store: DraftStore, onSample: boolean): 'entered' | 'left' | 'none' {
  const visiting = store.getItem(DEMO_VISIT_KEY) === '1';
  if (onSample) {
    if (visiting) return 'none';
    const real = store.getItem(SHARED_DRAFT_KEY);
    if (real !== null) store.setItem(DEMO_STASH_KEY, real);
    store.removeItem(SHARED_DRAFT_KEY);
    store.setItem(DEMO_VISIT_KEY, '1');
    return 'entered';
  }
  if (!visiting) return 'none';
  const scoped: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && sampleScoped(k)) scoped.push(k);
  }
  for (const k of scoped) store.removeItem(k);
  const real = store.getItem(DEMO_STASH_KEY);
  if (real !== null) store.setItem(SHARED_DRAFT_KEY, real);
  else store.removeItem(SHARED_DRAFT_KEY);
  store.removeItem(DEMO_STASH_KEY);
  store.removeItem(DEMO_VISIT_KEY);
  return 'left';
}

/** The banner's words for a demo repository: the sample team's, or Bridge's own. */
export function demoBanner(repo: string | null | undefined): { title: string; text: string } {
  const w = DEMO_WORDS;
  return isOwnTeam(repo) ? { title: w.ownSampleTitle, text: w.ownSampleText } : { title: w.bannerTitle, text: w.bannerText };
}

/** The write-action dialog's words for a demo repository: the sample team's, or Bridge's own (never "the demo"). */
export function demoDialog(repo: string | null | undefined): { title: string; lead: string } {
  return isOwnTeam(repo) ? { title: DEMO_WORDS.ownDialogTitle, lead: DEMO_WORDS.ownDialogLead } : { title: DEMO_WORDS.dialogTitle, lead: DEMO_WORDS.dialogLead };
}

// ---------------------------------------------------------------------------------------------------------------
// What an action does on a real team: the sample-team dialog says it in one or two plain sentences, so a visitor
// learns the product from the action they just tried. One map, keyed by what names the action: the mark on the
// button ([data-demo-write], [data-gh-gate]), the action the server refused (api/contribute, api/invites,
// api/entry: "set-pm", "invite"), or the words on the button the visitor clicked ("Looks right").

const SEND_TO_FIGMA = "Send to Figma puts this screen in your team's Figma file, built from your library's components, so designers can pick it up there.";
const DONE_EXPLORING = 'Done exploring tells your team this idea is ready: you pick what the library should keep, and developers get what they need to build it.';
const LOOKS_RIGHT = 'Looks right tells whoever made it that it is good to go, so the work moves on to the next step.';
const NEEDS_CHANGES = 'Needs changes sends them your notes, and the work waits for them to try again.';
const APPROVE = 'Approve says this change is right for the library. Once the people who decide agree, every product that uses the library can take it.';
const COMMENT = 'Your comment shows on the change for everyone working on it, and the people on it hear about it.';
const START = 'Start an exploration gives you a safe place to try an idea with Claude AI on a live preview of your product. The library stays as it is.';
const INVITE = 'Invite emails the people you add, so they join your team in Bridge with the role you pick.';
const SET_PM = 'The product manager is the person who says an exploration is right for the product before developers build it.';
const LIBRARY_UPDATE = 'Bring the latest in: this product gets everything the library gained since, every change your team approved.';
const ADD_PRODUCT = 'Add a product brings a product your team designs for into Bridge, so designers can explore it with your library.';
const HAND_OVER = 'Handing it over gives this exploration to someone else on the team, who picks it up from where it is.';

const ACTION_LINES: Readonly<Record<string, string>> = {
  'send to figma': SEND_TO_FIGMA,
  'send to figma again': SEND_TO_FIGMA,
  'keep an exploration': DONE_EXPLORING,
  'done exploring': DONE_EXPLORING,
  'say it is done exploring': DONE_EXPLORING,
  'looks right': LOOKS_RIGHT,
  'needs changes': NEEDS_CHANGES,
  'ask for changes': NEEDS_CHANGES,
  'request changes': NEEDS_CHANGES,
  approve: APPROVE,
  'review changes': APPROVE,
  'review suggestions': APPROVE,
  'comment on changes': COMMENT,
  comment: COMMENT,
  'pm word': 'Your answer goes to the designer of this exploration, next to its preview.',
  'start an exploration': START,
  'start explorations': START,
  'start exploration': START,
  invite: INVITE,
  'invite collaborators': INVITE,
  'invite people': INVITE,
  'send invite': INVITE,
  'send invites': INVITE,
  resend: INVITE,
  'set pm': SET_PM,
  'set the product manager': SET_PM,
  'library update': LIBRARY_UPDATE,
  'update from the library': LIBRARY_UPDATE,
  'bring the latest in': LIBRARY_UPDATE,
  'send the library update': LIBRARY_UPDATE,
  'update this feature': 'Update brings this feature up to the latest library, so it uses your newest components.',
  'edit tokens in a change': 'Editing this change updates the colors, spacing and type every product shares, and asks for a review before anything ships.',
  'send changes for review': 'Send for review asks the people who decide to look at your changes before they reach the library.',
  'create a brand': 'A new brand gives a product its own colors and type on the same library. The people who decide review it first.',
  'send a new brand': 'A new brand gives a product its own colors and type on the same library. The people who decide review it first.',
  'undo a change': 'Undo puts the library back the way it was before this change, once the people who decide agree.',
  'send a build request': 'A build request asks developers to build this component change, with your design attached.',
  'assign requests': 'Assign gives this request to someone on the team, who then sees it waiting for them.',
  'assign someone': 'Assign gives this request to someone on the team, who then sees it waiting for them.',
  'decline requests': 'Decline closes this request and tells the person who asked why.',
  'save usage guidance': 'Saving guidance changes how the library tells everyone to use this component.',
  'edit the roles': 'Roles decide who reviews and who approves changes on your team.',
  'change when it runs': 'This sets when Bridge compares your product screen by screen to catch changes nobody meant to make.',
  'propose integrations': "Connecting a tool lets Bridge share your team's work with it, once the people who decide agree.",
  'exploration keeper': HAND_OVER,
  'hand over': HAND_OVER,
  'take it over': 'Taking it over makes this exploration yours, and the person who had it hears why.',
  'take it back': 'Taking it back stops the developers before they start, with your reason, so the design can change first.',
  archive: 'Archive takes this exploration off the lists. Its preview keeps working.',
  rename: 'Rename changes this name for everyone on the team.',
  'back to exploring': 'Back to exploring opens this idea again, so you can keep changing it before developers start.',
  'set role': 'A role decides what someone can do on your team: view, edit, or run it.',
  'invite role': 'A role decides what someone can do on your team: view, edit, or run it.',
  remove: 'Remove takes this person off your team.',
  'set lead': 'A lead reviews the explorations of your team before developers build them.',
  'set review mode': 'This decides who reviews explorations on your team: one lead, or any designer.',
  'rename team': 'Renaming the team changes its name everywhere your people see it.',
  'add a product': ADD_PRODUCT,
  'add products': ADD_PRODUCT,
};

/** The sample-team dialog's line for an action nobody named: still what a real team gets. */
export const DEMO_ACTION_DEFAULT = 'On your own team, this changes your design system for everyone who works on it.';

/** "Send to Figma again", "set-pm", "Looks right." read the same: lower case, words only. */
const actionKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * What the action would do on a real team, for the sample-team dialog: the line of the first name in `names` the map
 * knows (the mark or refused action first, then what the visitor clicked, newest first), else a line for any action.
 */
export function demoActionLine(names: readonly (string | null | undefined)[]): string {
  for (const n of names) {
    const line = n ? ACTION_LINES[actionKey(n)] : undefined;
    if (line) return line;
  }
  return DEMO_ACTION_DEFAULT;
}

/** The start step's lines on the sample team: what started, and what Claude AI does with it on a real team. */
export const sampleStartLines = (name: string, where: string): { line: string; next: string } => ({
  line: `${name} is a new exploration in ${where}. On the sample team it stays in this browser.`,
  next: `With your own team, Claude AI opens it on a live preview of ${where} and you explore from there.`,
});

/**
 * The sample team's actions that run in this browser instead of opening the sample-team dialog: the banner says edits
 * stay in this browser, so the ones a visitor tries first do (Start an exploration as a designer, Looks right as Dana,
 * Add a product as Dana). Nothing is sent: the start and the product are kept here for the visit and Looks right is
 * painted from a copy kept here (lib/demo-in-browser.ts). Every other write needs a real repository and keeps the
 * dialog (scripts/demo-gate.ts).
 */
export const SAMPLE_IN_BROWSER: readonly string[] = ['start explorations', 'start an exploration', 'start exploration', 'say the design looks right', 'add a product', 'add products'];

/** True when `action` (a [data-demo-write] mark) runs in this browser on `repo`: the sample team only. */
export const runsInBrowser = (repo: string | null | undefined, action: string | null | undefined): boolean => isSampleTeam(repo) && Boolean(action) && SAMPLE_IN_BROWSER.includes(actionKey(action!));

/** The names the dialog has a line for (demo.test.ts checks every line reads in the Bridge voice). */
export const demoActionNames = (): string[] => Object.keys(ACTION_LINES);

/** Bridge's own design system: a demo repository that is not the sample team. */
export const isOwnTeam = (repo: string | null | undefined): boolean => isDemoRepo(repo) && !isSampleTeam(repo);

// ---------------------------------------------------------------------------------------------------------------
// A signed-out visitor never reads a real team, Bridge's own included: the hosted site's own Studio (/studio/, built
// from this repository with its real products) sends them to the same page of the sample team before anything paints.

/** What the browser knows before any script runs. */
export interface ShowcaseVisit {
  pathname: string;
  search?: string;
  hash?: string;
  /**
   * Anything that says this browser may be signed in: a GitHub token, an email membership or recent teams kept here,
   * a sign-in under way. The page then stays and the session scripts decide (scripts/email-studio.ts).
   */
  maybeSignedIn: boolean;
}

/**
 * Where a signed-out visitor of the hosted site's own Studio goes instead: the same page of the sample team (a product
 * or component page goes to its list: the sample team has others), with the query and the anchor. Null keeps the
 * page: not an own Studio page (a team address, the start screen, sign-in pages), or someone who may be signed in.
 * Self-contained on purpose: the layout runs its source inline before first paint, so it reads nothing outside itself.
 */
export function showcaseRedirect(v: ShowcaseVisit): string | null {
  if (v.maybeSignedIn) return null;
  const root = '/studio/';
  const sample = '/studio/acme-design-demo/bridge-demo-ds/';
  const routes = ['', 'brands', 'building', 'changes', 'components', 'explorations', 'library-review', 'products', 'quality', 'review', 'settings', 'tokens'];
  if (v.pathname !== '/studio' && v.pathname.indexOf(root) !== 0) return null;
  const rest = v.pathname.slice(root.length).replace(/^\/+/, '');
  const first = rest.split('/')[0] || '';
  if (routes.indexOf(first) < 0) return null;
  // A product or a component of Bridge's own design system: the sample team's list of them (it has its own).
  const route = first === 'products' || first === 'components' ? `${first}/` : rest;
  return sample + route + (v.search || '') + (v.hash || '');
}
