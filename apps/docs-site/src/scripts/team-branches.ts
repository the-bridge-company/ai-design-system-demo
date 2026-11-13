// Team Branches (team shell /studio/<owner>/<repo>/changes/, multi-team): the team's open branches and suggestions,
// with the same loaders as the self-hosted Branches page (scripts/reviews.ts loadList, BranchesList) and the same
// in-place reviews (?pr=N: the branch review; ?suggestion=N: the suggestion review). The team's repo model is read
// first (scripts/team-data.ts, with its progress) because reviews.ts reads the team's settings (owners, rights,
// products) when it loads. The views the self-hosted page reaches by address work for the team too, with the same
// modules (the old History address moved: scripts/history-links historyRedirect), a component change
// request in place (scripts/requests.ts, the team's request issues), Requests when triage is on in Studio, and the
// exploration start form (scripts/explorations.ts, against the team's repository, following its "changes" mode).
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TeamLoadError, TeamPageSkeleton } from '../components/ds/studio/TeamState';
import { loadTeamData, resetTeamData, teamOfPage, type TeamData } from './team-data';
import { TEAM_VIEW_TITLE, teamBranchesRoute } from '../lib/team-branches';
import { legacyTarget } from '../lib/explorations-page';
import { SAMPLE_ANSWERED_EVENT } from '../lib/demo-in-browser';
import { teamFailure } from '../lib/team-load';
import type { PullLike } from '../lib/requests-view';
import type { ExplorationPullLike } from '../lib/explorations-view';
import { studioHref } from '../lib/team-path';
import { historyRedirect } from './history-links';

const $ = (id: string) => document.getElementById(id);

export async function initTeamBranches(): Promise<void> {
  const state = document.querySelector<HTMLElement>('[data-tb-state]');
  const main = $('cg-main');
  if (!state || !main) return;
  let stateRoot: Root | null = createRoot(state);
  stateRoot.render(createElement(TeamPageSkeleton, { label: "Reading this team's explorations" }));

  let data: TeamData;
  try {
    data = await loadTeamData();
  } catch (err) {
    const team = teamOfPage();
    state.classList.remove('lp-wait');
    stateRoot.render(
      createElement(TeamLoadError, {
        failure: teamFailure(err, team ? `${team.owner}/${team.repo}` : 'this repository'),
        onRetry: () => {
          resetTeamData();
          location.reload();
        },
      }),
    );
    return;
  }
  stateRoot.unmount();
  stateRoot = null;
  state.remove();

  const list = $('cg-list');
  if (list) list.dataset.tokensRoot = data.model.tokens.root;
  // What the self-hosted page embeds at build time (#bridge-branches), from the team: no preview apps of its own yet.
  if (!$('bridge-branches')) {
    const cfg = document.createElement('script');
    cfg.type = 'application/json';
    cfg.id = 'bridge-branches';
    cfg.textContent = JSON.stringify({ owner: data.owner, repo: data.repo, defaultBranch: data.defaultBranch, apps: {}, packages: [] });
    document.body.append(cfg);
  }
  // Loaded once the team's settings are known: reviews.ts reads them when it loads.
  const reviews = await import('./reviews');
  // Start an exploration (the empty state) picks among the team's components.
  reviews.setStartComponents((data.model.components?.list ?? []).map((c) => ({ name: c.name, slug: c.slug, family: c.category })).sort((a, b) => a.name.localeCompare(b.name)));
  const suggestions = await import('./suggestions');
  const sgHost = $('sg-detail');
  const header = document.querySelector<HTMLElement>('[data-team-shell] > .st-head');
  let listLoaded: ReturnType<typeof reviews.loadList> | null = null;
  // An answer given in this browser on the sample team (Looks right): the list reads again when shown.
  document.addEventListener(SAMPLE_ANSWERED_EVENT, () => (listLoaded = null));

  type MainView = keyof typeof TEAM_VIEW_TITLE;
  const panels: Record<MainView, HTMLElement | null> = { list: $('cg-review'), requests: $('cg-requests'), explorations: $('cg-explore') };
  // The list, or one of the views the header and addresses reach; null: a branch, suggestion or request in place,
  // which has its own title and way back.
  const showMain = (view: MainView | null) => {
    main.hidden = view === null;
    if (header) header.hidden = view === null;
    if (view === null) return;
    const title = header?.querySelector('.st-title');
    if (title) title.textContent = TEAM_VIEW_TITLE[view];
    const summary = header?.querySelector<HTMLElement>('[data-st-summary]');
    if (summary) summary.hidden = view !== 'list';
    const backLink = $('cg-back-link');
    if (backLink) backLink.hidden = view === 'list';
    for (const [k, el] of Object.entries(panels)) if (el) el.hidden = k !== view;
  };

  // The team's open pull requests, read once by the list, for requests (which close them) and explorations.
  // Null when the list was read without bodies: each module then reads what it needs itself.
  const openPulls = <T,>(): Promise<T[] | null> => {
    listLoaded ??= reviews.loadList();
    return listLoaded.then((pulls) => (pulls.every((p) => 'body' in p) ? (pulls as unknown as T[]) : null));
  };
  // Loaded on first use: each reads the team's repository and settings when it loads, known by now.
  let requests: typeof import('./requests') | null = null;
  let explorations: typeof import('./explorations') | null = null;
  const loadRequestsModule = async () => {
    if (!requests) {
      requests = await import('./requests');
      requests.initRequests();
    }
    return requests;
  };
  const loadExplorationsModule = async () => {
    if (!explorations) {
      explorations = await import('./explorations');
      explorations.initExplorations();
    }
    return explorations;
  };

  const route = async () => {
    // What moved to Library review (suggestions, the old Library group): there, the query kept.
    const away = legacyTarget(location.search, location.hash);
    if (away) {
      location.replace(studioHref(away));
      return;
    }
    // An old History address: Shipped here (the list opens on it), or another page.
    const moved = historyRedirect();
    if (moved) {
      const to = new URL(moved, location.href);
      if (to.pathname !== location.pathname) {
        location.replace(to.href);
        return;
      }
      history.replaceState(history.state, '', `${to.search}${to.hash}`);
    }
    const r = teamBranchesRoute(location.search);
    if (r.view !== 'suggestion') suggestions.closeSuggestion(sgHost);
    if (r.view === 'pr') {
      showMain(null);
      void reviews.openPr(r.n, false);
      return;
    }
    reviews.closePr();
    if (r.view === 'exploration') {
      // An exploration: the exploration page, which reads a product's own repository when it lives there.
      showMain(null);
      const m = await loadExplorationsModule();
      void m.openExploration(r.n, false, r.product);
      return;
    }
    if (r.view === 'suggestion') {
      showMain(null);
      if (sgHost) void suggestions.openSuggestion(r.n, { el: sgHost, crumbs: [{ label: 'Explorations', href: studioHref('explorations/') }, { label: 'Suggestion' }] });
      return;
    }
    if (r.view === 'request') {
      showMain(null);
      const m = await loadRequestsModule();
      void m.openRequest(r.n, false, openPulls<PullLike>());
      return;
    }
    if (r.view === 'requests') {
      showMain('requests');
      const m = await loadRequestsModule();
      void m.loadRequests(openPulls<PullLike>());
      return;
    }
    if (r.view === 'explorations') {
      showMain('explorations');
      const m = await loadExplorationsModule();
      void m.loadExplorations(() => openPulls<ExplorationPullLike>());
      // Started for a request: the form, filled from it; from an old &start=new address: the form, open (the team shell has no header dialog).
      if (r.forRequest) void m.startForRequest(r.forRequest);
      else {
        const opener = $('ex-start-open');
        if (opener?.getAttribute('aria-expanded') !== 'true') opener?.click();
      }
      return;
    }
    showMain('list');
    listLoaded ??= reviews.loadList();
  };
  const go = (search: string) => {
    history.pushState({}, '', search || location.pathname);
    void route();
    window.scrollTo({ top: 0 });
  };

  reviews.initReviewAuth();
  document.addEventListener('bridge:changes-view', () => showMain(null));
  document.addEventListener('click', (e) => {
    const me = e as MouseEvent;
    if (me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0) return;
    const t = e.target as HTMLElement;
    const pr = t.closest<HTMLElement>('[data-open-pr], [data-open-exploration]');
    const sg = t.closest<HTMLElement>('[data-open-suggestion]');
    const rq = t.closest<HTMLElement>('[data-open-request]');
    const n = Number(pr?.dataset.openPr ?? pr?.dataset.openExploration ?? sg?.dataset.openSuggestion ?? rq?.dataset.openRequest);
    if (n) {
      e.preventDefault();
      const product = pr?.dataset.product;
      // An exploration opens on its exploration page, in the design system repository or a product's own one.
      const exploration = pr?.dataset.openExploration !== undefined ? `?exploration=${n}${product ? `&product=${encodeURIComponent(product)}` : ''}` : null;
      go(sg ? `?suggestion=${n}` : rq ? `?request=${n}` : (exploration ?? `?pr=${n}`));
      return;
    }
    const start = t.closest<HTMLElement>('[data-start-for]');
    if (start) {
      e.preventDefault();
      go(`?view=explorations&for=${Number(start.dataset.startFor)}`);
      return;
    }
    if (t.closest('[data-back-requests]')) {
      e.preventDefault();
      go('?view=requests');
      return;
    }
    if (t.closest('[data-back]')) {
      e.preventDefault();
      go('');
      return;
    }
  });
  window.addEventListener('popstate', () => void route());
  void route();
}
