// Studio Home on a team shell (multi-team PR 3b): the same home as /studio/ (components/ds/studio/StudioHome.tsx, the
// GitHub rows of scripts/home-data.ts), with the repo facts the self-hosted page embeds at build time computed in the
// browser from the team's repo model instead: contrast failures, the component list of Start an exploration (Report it), the guidance
// drafts waiting for review. Adoption is not compared here: a team's audits are not paired before and after a move
// the way the demo's are, so its figures live on Quality only. The setup steps are not shown here (they belong to the
// onboarding of hosted teams, multi-team PR 3c).
import { createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { currentContributor, currentViewer, getToken, initGitHubConnect, onAccess, prefersSignIn } from './github-session';
import { setReviewCount } from './shell';
import { rememberMine } from './needs-you';
import { rememberWaitingExplorations } from './waiting-counts';
import { waitingCounts } from '../lib/waiting-counts';
import { viewerIsDesignLead } from './design-lead';
import { loadHome, type HomeData, type HomeStatic } from './home-data';
import { loadTeamData, resetTeamData, teamOfPage, type TeamData } from './team-data';
import { paintStudioHome, type HealthLine, type HomeComponent, type JoinHandlers, type StudioHomeProps } from '../components/ds/studio/StudioHome';
import { JOINED_KEY, joinedNote } from '../lib/entry';
import { joinHandlers } from './join-handlers';
import { TeamLoadError, TeamLoadProgress, TeamSourceNote } from '../components/ds/studio/TeamState';
import { greeting, homeState } from '../lib/home-model';
import { startChangeHref } from '../lib/overview-board';
import { signedOutLine } from '../lib/overview-todo';
import { ghButton } from '../lib/gh-wording';
import { studioHref } from '../lib/team-path';
import { libraryHref } from '../lib/library-shells';
import { teamFailure } from '../lib/team-load';
import { contrastFailures, teamGuidance } from '../lib/team-facts';


/** Can view: an email member who reads only (the home offers no exploration). */
const viewOnly = () => currentContributor()?.role === 'view';

// Approve and Decline on a join request live in scripts/join-handlers.ts (shared with the Review page).
export { joinHandlers };

export interface TeamHomeStatic extends HomeStatic {
  components: HomeComponent[];
  startHrefs: StudioHomeProps['startHrefs'];
}

// The contrast count lives in lib/team-facts.ts (shared with team Review); re-exported for existing callers.
export { contrastFailures };

/** The repo facts of Studio Home for a team (what /studio/ embeds as #home-static), from its repo model. Pure. */
export function teamHomeStatic(data: Pick<TeamData, 'owner' | 'repo' | 'sha' | 'model'>): TeamHomeStatic {
  const comps = data.model.components?.list ?? [];
  const missing = comps.find((c) => !c.docs);
  return {
    contrastFail: contrastFailures(data.model),
    components: comps.map((c) => ({ name: c.name, slug: c.slug, family: c.category })).sort((a, b) => a.name.localeCompare(b.name)),
    // Drafted guidance waits for review: the row opens it in its Library page's edit mode.
    guidance: teamGuidance(data),
    startHrefs: {
      tokens: startChangeHref('look'),
      component: startChangeHref('variant'),
      // The first component without guidance, in its Library page's edit mode (as on Bridge's own Studio home).
      guidance: missing ? `${libraryHref(data.owner, data.repo, `components/${encodeURIComponent(missing.slug.toLowerCase())}/`)}?edit=1` : studioHref('components/'),
    },
  };
}

/**
 * The home's repo facts before the team's design system is read: no components, no failing pair, no guidance draft.
 * The greeting and what Bridge itself knows (join requests) paint with it at once; the rest fills in once read.
 */
export function placeholderHomeStatic(): TeamHomeStatic {
  return { contrastFail: 0, components: [], guidance: [], startHrefs: { tokens: startChangeHref('look'), component: startChangeHref('variant'), guidance: studioHref('components/') } };
}

/** The page's h1 when the failure takes the home's place: the home paints its own otherwise. */
const loadingHeading = () => createElement('h1', { className: 'sr-only' }, 'Home');

/**
 * Paints the team home into `el` (the [data-studio-home] mount), the source line into `sourceEl`, and the design
 * system read (its progress, or why it failed) into `dsEl`. Bridge's own parts (the greeting, join requests) never wait
 * for that read: GitHub can be slow, refuse, or the team be large; the home is there at once and fills in.
 */
export function initTeamHome(el: HTMLElement, sourceEl: HTMLElement | null, dsEl: HTMLElement | null = null) {
  let root: Root | null = null;
  let sourceRoot: Root | null = null;
  let dsRoot: Root | null = null;
  /** The repo facts, once the team's design system is read; null until then (placeholderHomeStatic stands in). */
  let stat: TeamHomeStatic | null = null;
  const placeholder = placeholderHomeStatic();
  const facts = () => stat ?? placeholder;
  /** Repaints the running loadHome with the facts now known (no GitHub read). */
  let repaintHome: (() => void) | null = null;
  let data: HomeData | null = null;
  let known = false;
  // Just joined from Entry: the home says so once (lib/entry.ts JOINED_KEY), then the note is gone.
  let note: string | null = null;
  try {
    const t = teamOfPage();
    note = t ? joinedNote(sessionStorage.getItem(JOINED_KEY), `${t.owner}/${t.repo}`) : null;
    if (note) sessionStorage.removeItem(JOINED_KEY);
  } catch {
    note = null;
  }
  let run = 0;
  // Join requests decided on this page: gone from the list until the next read.
  const gone = new Set<string>();
  const join = joinHandlers(
    () => {
      const t = teamOfPage();
      return t ? `${t.owner}/${t.repo}` : '';
    },
    (key) => {
      gone.add(key);
      paint();
    },
    (key) => {
      gone.delete(key);
      paint();
    },
  );
  const signIn = prefersSignIn();

  function health(): HealthLine | null {
    if (!stat) return null;
    return stat.contrastFail ? null : { text: 'Library healthy.', tone: 'ok', href: studioHref('quality/'), link: 'Open Quality' };
  }

  function paint() {
    const f = facts();
    const now = Date.now();
    const v = currentViewer();
    const signedIn = Boolean(v) || (!known && Boolean(getToken()));
    const d = data && gone.size ? { ...data, needs: data.needs.filter((r) => !gone.has(r.key)) } : data;
    // Nothing needs the viewer: the ways to start stay on top, their work follows under them (`recent`), so their
    // explorations and library changes never turn the quiet home into the busy one.
    // Who reads is not known yet (the sign-in is being checked): the home waits, never a signed-out or someone else's.
    const state = !known ? 'loading' : homeState({ signedIn, loading: !d || d.loading, needs: d?.needs.length ?? 0, branches: 0 });
    root = paintStudioHome(
      el,
      {
        state,
        greeting: known ? greeting(new Date(now).getHours(), v?.name ?? null) : '',
        needs: d?.needs ?? [],
        branches: d?.branches ?? [],
        explorations: d?.explorations ?? [],
        libraryWork: d?.libraryWork ?? [],
        waitingOnOthers: d?.waitingOnOthers ?? [],
        health: health(),
        building: true,
        now,
        components: f.components,
        signedOut: { line: signedOutLine(signIn), button: ghButton(signIn), signIn },
        failed: d?.failed ?? null,
        startHrefs: f.startHrefs,
        // No review right and not a design lead: only what waits on them, and their tour (once the owner teams are read).
        // A design lead (lib/design-lead: an admin or lead by email or GitHub) or a reviewer: the lead tour.
        contributor: Boolean(d && !d.loading && !d.reviewer && !viewerIsDesignLead() && !viewOnly()),
        viewOnly: viewOnly(),
        lead: Boolean(d && !d.loading && (d.reviewer || viewerIsDesignLead())),
        join,
        note,
        recent: true,
      },
      root,
    );
  }

  function reload() {
    data = null;
    repaintHome = null;
    const mine = ++run;
    paint();
    void loadHome(
      facts,
      (d) => {
        if (mine !== run) return;
        data = d;
        paint();
        if (!d.loading && !d.failed && d.viewer) {
          // One source per count (lib/waiting-counts): the explorations that wait for the Explorations badge and
          // page, the rest for Library review.
          const counts = waitingCounts(d.needs);
          rememberWaitingExplorations(counts.explorations);
          setReviewCount(counts.library);
          rememberMine(counts.library);
        }
        if (!d.viewer) setReviewCount(null);
      },
      (fn) => {
        if (mine === run) repaintHome = fn;
      },
      // The team's products (its bridge.config.json) before the explorations are sorted into them and its product
      // repositories read: the same settings Changes and the product pages wait for. A failed read keeps the defaults.
      loadTeamData().catch(() => null),
    );
  }

  /** The design system part: its progress while it is read, why it failed, or nothing once it is there. */
  function paintDs(node: Parameters<Root['render']>[0] | null) {
    if (!dsEl) return;
    dsRoot ??= createRoot(dsEl);
    dsRoot.render(node);
  }

  function start() {
    // How far the read has gone, under the home (a Refresh keeps the home and its facts on screen instead).
    if (!stat) paintDs(createElement(TeamLoadProgress, { label: "Reading this team's design system" }));
    paint();
    loadTeamData().then(
      (loaded) => {
        stat = teamHomeStatic(loaded);
        paintDs(null);
        sourceRoot ??= sourceEl ? createRoot(sourceEl) : null;
        sourceRoot?.render(createElement(TeamSourceNote, { data: loaded, refreshing: false, onRefresh: () => (resetTeamData(), start()) }));
        // The home takes the facts in (contrast, guidance drafts).
        if (repaintHome) repaintHome();
        else paint();
      },
      (err: unknown) => {
        const team = teamOfPage();
        const failure = teamFailure(err, team ? `${team.owner}/${team.repo}` : 'this repository');
        const retry = () => (resetTeamData(), start());
        // Without a slot for it, the failure takes the home's place, as before.
        if (!dsEl) {
          root ??= createRoot(el);
          root.render(createElement(Fragment, null, loadingHeading(), createElement(TeamLoadError, { failure, onRetry: retry })));
          return;
        }
        paintDs(createElement(TeamLoadError, { failure, onRetry: retry, compact: true }));
      },
    );
  }

  start();
  onAccess(() => paint());
  initGitHubConnect(() => {
    known = true;
    reload();
  });
}
