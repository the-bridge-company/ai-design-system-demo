// On the demo (lib/demo.ts DEMO_REPOS), a visitor who cannot write to it explores freely (boards D1, D2 and EmptyA2):
//   - the one banner over every Studio and Library page (components/ds/studio/DemoBanner.tsx), with one action: on the
//     sample team "Get started" (the email sign-in), or "Back to your workspace" for someone signed in to Bridge;
//   - every action that would change the demo opens the demo dialog (components/ds/studio/MakeItYours.tsx): on the
//     sample team "This is a sample team." with the same "Get started", never a GitHub sign-in out of context.
// Someone who can write to the demo (its owner) keeps the normal Studio.
//
// Which actions: on the sample team, every write but the few that run in this browser (lib/demo.ts SAMPLE_IN_BROWSER:
// Start an exploration, Looks right), any element marked [data-demo-write="<what it does>"] ("create branches", "approve changes"), and
// the actions the session gates while signed out ([data-gh-gate="<verb phrase>"]). One capture listener on the
// document, wired once by the shared GitHub session (scripts/github-session.ts initGitHubConnect), so it runs before
// the page's own handlers and before the session opens its sign-in dialog. The React parts load on first use.
import { demoActionLine, exploresDemo, isOwnTeam, isSampleTeam, runsInBrowser } from '../lib/demo';
import { repoContext } from './repo-context';
import { castOn, playCast } from './demo-cast';

export interface DemoGateDeps {
  /** "owner/repo" of the page. */
  repo: () => string;
  /** The GitHub login when signed in. */
  login: () => string | null;
  /** Write access on the page's repository: null while GitHub has not said. */
  write: () => boolean | null;
  /** The site signs in with GitHub. */
  signIn: () => boolean;
  /** False while a saved sign-in is still being checked: the Studio acts as usual until then. */
  known: () => boolean;
  /** A signed-out visitor reading as a member of the demo team (its read-only session). */
  visitor?: () => boolean;
  /** Calls `fn` whenever who is visiting, or what they can do, changes. */
  subscribe: (fn: () => void) => void;
}

let deps: DemoGateDeps | null = null;

/**
 * A visitor on the sample team who is not signed in with GitHub: its buttons say what they do ("Send for review"),
 * never "Connect GitHub to...", since the sample team's one way in is "Get started" (and a click opens the demo
 * dialog). Synchronous, from the address: safe to call while painting a label.
 */
export function sampleVisitor(): boolean {
  const r = repoContext();
  return isSampleTeam(`${r.owner}/${r.repo}`) && !document.documentElement.hasAttribute('data-no-repo') && (!deps?.login() || Boolean(deps.visitor?.()));
}

/** True when this visitor explores the demo: write actions open the demo dialog. */
export function exploringDemo(): boolean {
  if (!deps || !deps.known()) return false;
  // The start screen and the browser workspace are built on the demo's site but read no repository: never the demo.
  if (document.documentElement.hasAttribute('data-no-repo')) return false;
  const login = deps.login();
  return exploresDemo({ repo: deps.repo(), signedIn: Boolean(login), write: login ? deps.write() : false });
}

let paintLayer: ((open: boolean, line?: string) => void) | null = null;

/**
 * What the visitor clicked last (newest first, the last minute): the dialog names the action a refused write came
 * from ("Looks right", then the form's Send) when the server's refusal does not say it (lib/demo.ts demoActionLine).
 */
const trail: { name: string; at: number }[] = [];
const TRAIL_MS = 60_000;

/** The name of a clicked control: its demo mark, its gate phrase, else its label or words. */
export function clickedName(el: HTMLElement): string {
  return (el.dataset.demoWrite ?? el.dataset.ghGate ?? el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

/** Notes a click for the dialog's line. Exported for tests. */
export function noteClick(target: EventTarget | null, now = Date.now()) {
  const el = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-demo-write], [data-gh-gate], button, a, [role="menuitem"]');
  if (!el || el.closest('[data-demo-layer]')) return;
  const name = clickedName(el);
  if (!name) return;
  trail.unshift({ name, at: now });
  trail.length = Math.min(trail.length, 4);
}

/** The recent clicks' names, newest first. */
export function recentClicks(now = Date.now()): string[] {
  return trail.filter((t) => now - t.at < TRAIL_MS).map((t) => t.name);
}
let loading: Promise<void> | null = null;

/** The demo dialog, mounted once in its own root at the end of the body. */
function layer(): Promise<void> {
  loading ??= (async () => {
    const [{ createElement }, { createRoot }, { MakeItYours }] = await Promise.all([import('react'), import('react-dom/client'), import('../components/ds/studio/MakeItYours')]);
    const el = document.createElement('div');
    el.dataset.demoLayer = '';
    document.body.append(el);
    const root = createRoot(el);
    let last: string | undefined;
    paintLayer = (open, line) => {
      if (line !== undefined) last = line;
      root.render(createElement(MakeItYours, { open, onOpenChange: (o: boolean) => paintLayer!(o), signIn: deps?.signIn() ?? true, repo: deps?.repo(), line: last }));
    };
  })();
  return loading;
}

/**
 * Opens the demo dialog (board D2): "This is a sample team." on the sample team, with what the action does on a real
 * team. `action`: its demo mark or the action the server refused ("set-pm"); without one, what the visitor clicked.
 */
export async function openMakeItYours(action?: string | null): Promise<void> {
  const line = demoActionLine([action, ...recentClicks()]);
  await layer();
  paintLayer!(true, line);
}

let banner: Promise<(on: boolean, visiting?: boolean) => void> | null = null;

/** Where the banner's one action leads (DemoBanner.tsx): null is "Get started", for a visitor who has not started. */
async function bannerBack(repo: string): Promise<{ href: string; connect: boolean } | null> {
  const [{ startFacts }, { demoBack, awayFrom }, { loadReserved }, { getAccount }, { defaultNext }] = await Promise.all([
    import('./start'),
    import('../lib/start'),
    import('../lib/team-open'),
    import('./account-session'),
    import('../lib/account'),
  ]);
  const facts = startFacts();
  const { account } = await getAccount().catch(() => ({ account: null }));
  // Never back to the page it is on (a "Back to your workspace" that reloads Bridge DS): the account's own team instead.
  const away = (b: { href: string; connect: boolean }) => (b.connect ? b : awayFrom(b, { pathname: location.pathname, repo }, account?.teams ?? []));
  if (isOwnTeam(repo)) return away(account?.teams.length ? { href: defaultNext(account, facts.recent), connect: false } : demoBack(facts, await loadReserved()));
  // The sample team: someone signed in to Bridge goes back to their own team; anyone else gets started.
  if (!account) return null;
  return away(account.teams.length ? { href: defaultNext(account, facts.recent), connect: false } : demoBack(facts, await loadReserved()));
}

/**
 * Paints the demo banner into the layout's [data-demo-strip] when `show`, hides it otherwise. `visitor`: whether the
 * reader is the sample team's visitor (its "See it as"); the page's session says it when not given.
 */
async function paintStrip(show: boolean, repo: string, visitor?: boolean) {
  const slot = document.querySelector<HTMLElement>('[data-demo-strip]');
  if (!slot) return;
  if (!show && !banner) return;
  banner ??= (async () => {
    const [{ createElement }, { createRoot }, { flushSync }, { DemoBanner }, { connectDesignSystem }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('react-dom'),
      import('../components/ds/studio/DemoBanner'),
      import('./start-connect'),
    ]);
    const root = createRoot(slot);
    // Read once per page from this browser and the account (no GitHub call).
    const back = await bannerBack(repo);
    return (on: boolean, visiting?: boolean) => {
      // Hidden first when it goes, shown only once the banner is in it when it comes: the strip is never shown empty
      // for a frame (the sample team's reserve, styles/site.css, holds while it is hidden), so nothing under it moves.
      if (!on) slot.hidden = true;
      // A built "Connect GitHub to..." button says what it does instead on the sample team ([data-demo-label]).
      if (on && isSampleTeam(repo))
        document.querySelectorAll<HTMLElement>('[data-demo-write][data-demo-label]').forEach((el) => {
          (el.querySelector<HTMLElement>(':scope > span') ?? el).textContent = el.dataset.demoLabel ?? '';
          el.removeAttribute('data-gh-open');
        });
      // "See it as" (lib/demo-cast.ts): a visitor of the sample team plays any of its people; a member stays themselves.
      const person = on && (visiting ?? deps?.visitor?.()) ? castOn(repo) : null;
      const cast = person ? { current: person.key, onPick: playCast } : null;
      flushSync(() => root.render(on ? createElement(DemoBanner, { repo, back, onConnect: connectDesignSystem, cast }) : null));
      if (on) slot.hidden = false;
    };
  })();
  (await banner)(show, visitor);
}

/** Shows the demo banner while the visitor explores the demo, hides it otherwise. */
const paintBanner = () => paintStrip(exploringDemo(), deps!.repo());

/**
 * The sample team's Library: the same banner, for everyone (the Library is read only for all, so its owner sees it
 * too). Called by scripts/library-team.ts on a team Library page. A visitor gets "See it as" too, once the server
 * gave the visitor's read-only session (as the person picked, ?as=): the Library reads as them, as the Studio does.
 */
export function paintLibraryBanner(repo: string) {
  if (!isSampleTeam(repo)) return;
  void paintStrip(true, repo, false);
  void (async () => {
    const [{ contributeInfo, holdsVisitorSession }, { hasWorkingToken }] = await Promise.all([import('./contribute-session'), import('./github-session')]);
    if (hasWorkingToken()) return;
    await contributeInfo(repo).catch(() => null);
    if (holdsVisitorSession(repo)) await paintStrip(true, repo, true);
  })();
}

/** Wires the gate once per page. */
export function bindDemoGate(d: DemoGateDeps) {
  if (deps) {
    deps = d;
    return;
  }
  deps = d;
  d.subscribe(() => void paintBanner());
  void paintBanner();
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      noteClick(target);
      const el = target?.closest<HTMLElement>('[data-demo-write], [data-gh-gate]');
      if (!el || !exploringDemo()) return;
      // On the sample team, Start an exploration and Looks right run in this browser (lib/demo.ts SAMPLE_IN_BROWSER).
      if (runsInBrowser(deps?.repo(), el.dataset.demoWrite ?? el.dataset.ghGate)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      target?.closest('details')?.removeAttribute('open');
      void openMakeItYours(el.dataset.demoWrite ?? el.dataset.ghGate);
    },
    true,
  );
}
