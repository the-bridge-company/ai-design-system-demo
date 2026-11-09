// Studio Branches page controller: the list (every branch, explorations included, what shipped under its own tab), the
// views old addresses reach (the exploration start form from a request ?view=explorations&for=N (an old &start=new
// opens the Start an exploration dialog), Requests
// ?view=requests when request triage is on in Studio, lib/studio-flags), a branch opened in place (?pr=N), a component
// change request opened in place (?request=N), a suggestion opened in place (?suggestion=N, scripts/suggestions.ts),
// the local draft strip, and the routes old pages redirect to
// (#other-branches, ?branch=). The header names the view, with a link back to all branches outside the list. The old
// History address (?view=history) moved: Shipped, the next release on Being built, the Library changelog
// (scripts/history-links historyRedirect).
import { initWorkFilter } from './work-filter';
import { closePr, initReviewAuth, loadList, openPr } from './reviews';
import { historyRedirect } from './history-links';
import { initRequests, loadRequests, openRequest } from './requests';
import { closeSuggestion, onViewerChange, openSuggestion } from './suggestions';
import { explorationParam } from '../lib/explorations-view';
import { initExplorations, loadExplorations, openExploration, paintExplorationCount, startForRequest } from './explorations';
import type { ExplorationPullLike } from '../lib/explorations-view';
import type { PullLike } from '../lib/requests-view';
import { initGitHubConnect } from './github-session';
import { REQUEST_TRIAGE_IN_STUDIO } from '../lib/studio-flags';
import { studioHref } from '../lib/team-path';
import { legacyTarget } from '../lib/explorations-page';

type View = 'review' | 'requests' | 'explorations';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let listLoaded: Promise<{ number: number; head: { ref: string } }[]> | null = null;
const VIEW_QUERY: Record<View, string> = { review: '', requests: '?view=requests', explorations: '?view=explorations' };

/** The open pull requests In review already read (with their bodies), so Requests links them at no request. */
const openPullsForRequests = (): Promise<PullLike[] | null> | undefined =>
  listLoaded?.then((pulls) => (pulls.every((p) => 'body' in p) ? (pulls as unknown as PullLike[]) : null));

/** The same open pull requests for Explorations (the In review list is read once, explorations included). */
const openPullsForExplorations = () => {
  listLoaded ??= loadList();
  return listLoaded.then((pulls) => (pulls.every((p) => 'body' in p) ? (pulls as unknown as ExplorationPullLike[]) : null));
};

const VIEW_TITLE: Record<View, string> = { review: 'Explorations', requests: 'Requests', explorations: 'Explorations' };

function selectTab(view: View) {
  const title = document.querySelector<HTMLElement>('#cg-main .st-title');
  if (title) title.textContent = VIEW_TITLE[view];
  // The header's summary sentence speaks for the list only (components/ds/studio/BranchesList writes it).
  const summary = document.querySelector<HTMLElement>('#cg-main [data-st-summary]');
  if (summary) summary.hidden = view !== 'review';
  $('cg-back-link').hidden = view === 'review';
  // One primary per view: the start form has its own, so Start an exploration steps down to secondary there
  // (components/ds/studio/StartExploration START_CHANGE_EVENT; on the list the selection bar decides).
  // The island reads data-start-variant when it mounts after this, and the event when it is already there.
  const variant = view !== 'review' || document.querySelector('.cg-bar') ? 'secondary' : 'primary';
  const slot = document.querySelector<HTMLElement>('[data-greet]');
  if (slot) slot.dataset.startVariant = variant;
  document.dispatchEvent(new CustomEvent('bridge:start-change', { detail: { variant, hidden: false } }));
  $('cg-review').hidden = view !== 'review';
  $('cg-requests').hidden = view !== 'requests';
  $('cg-explore').hidden = view !== 'explorations';
}

/** The suggestion review host (pages/studio/changes.astro), beside #rv-detail. */
const sgHost = () => document.getElementById('sg-detail');

/** Opens suggestion `n` in place, with the way back to all branches. */
function showSuggestion(n: number, push: boolean) {
  closePr();
  $('cg-main').hidden = true;
  if (push) history.pushState({ suggestion: n }, '', `?suggestion=${n}`);
  window.scrollTo({ top: 0 });
  const el = sgHost();
  if (el) void openSuggestion(n, { el, crumbs: [{ label: 'Explorations', href: studioHref('explorations/') }, { label: 'Suggestion' }] });
}

function showView(view: View) {
  closePr();
  closeSuggestion(sgHost());
  $('cg-main').hidden = false;
  selectTab(view);
  if (view === 'requests') void loadRequests(openPullsForRequests());
  else if (view === 'explorations') void loadExplorations(openPullsForExplorations);
  else {
    listLoaded ??= loadList();
  }
  void listLoaded?.then((pulls) => paintExplorationCount(pulls as unknown as ExplorationPullLike[]));
}

function route() {
  // What moved to Library review (suggestions, the old Library group): there, the query kept (lib/explorations-page).
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
  const params = new URLSearchParams(location.search);
  const sg = Number(params.get('suggestion'));
  if (sg) {
    showSuggestion(sg, false);
    return;
  }
  closeSuggestion(sgHost());
  const n = Number(params.get('pr'));
  if (n) {
    $('cg-main').hidden = true;
    void openPr(n, false);
    return;
  }
  const req = Number(params.get('request'));
  if (req) {
    closePr();
    $('cg-main').hidden = true;
    void openRequest(req, false, openPullsForRequests());
    return;
  }
  const asked = explorationParam(location.search);
  const ex = asked?.number ?? 0;
  if (ex) {
    closePr();
    $('cg-main').hidden = true;
    void openExploration(ex, false, asked?.product ?? null);
    void loadExplorations(openPullsForExplorations);
    return;
  }
  const v = params.get('view');
  // Request triage off (teams triage in Jira): ?view=requests opens All branches. Explorations are rows of the list:
  // ?view=explorations opens its own view only to start one from a request (&for=N). An old ?start= address
  // (?view=explorations&start=new, the old "New component") opens the header's Start an exploration dialog instead
  // (components/ds/studio/StartExploration startFromAddress), over the list.
  const starting = Boolean(Number(params.get('for')));
  const view: View = (v === 'explorations' && starting) || (v === 'requests' && REQUEST_TRIAGE_IN_STUDIO) ? v : 'review';
  showView(view);
  // Start an exploration from a request: the form, filled from it.
  const forRequest = Number(params.get('for'));
  if (view === 'explorations' && forRequest) void startForRequest(forRequest);
  // Branch scope from the Studio header: open the pull request of that branch, if it has one.
  const branch = params.get('branch');
  if (view === 'review' && branch && listLoaded)
    void listLoaded.then((pulls) => {
      const match = pulls.find((p) => p.head.ref === branch);
      if (match) {
        $('cg-main').hidden = true;
        void openPr(match.number);
      }
    });
}

export function initChanges() {
  initWorkFilter();
  initReviewAuth();
  initExplorations();
  initRequests();
  initGitHubConnect(() => undefined);
  document.addEventListener('bridge:changes-view', () => ($('cg-main').hidden = true));

  document.addEventListener('click', (e) => {
    const me = e as MouseEvent;
    if (me.metaKey || me.ctrlKey || me.shiftKey) return;
    const t = e.target as HTMLElement;
    const pr = t.closest<HTMLAnchorElement>('[data-open-pr]');
    if (pr) {
      e.preventDefault();
      closeSuggestion(sgHost());
      $('cg-main').hidden = true;
      void openPr(Number(pr.dataset.openPr));
      return;
    }
    const sg = t.closest<HTMLAnchorElement>('[data-open-suggestion]');
    if (sg) {
      e.preventDefault();
      showSuggestion(Number(sg.dataset.openSuggestion), true);
      return;
    }
    const rq = t.closest<HTMLAnchorElement>('[data-open-request]');
    if (rq) {
      e.preventDefault();
      closeSuggestion(sgHost());
      $('cg-main').hidden = true;
      void openRequest(Number(rq.dataset.openRequest), true, openPullsForRequests());
      return;
    }
    const start = t.closest<HTMLAnchorElement>('[data-start-for]');
    if (start) {
      e.preventDefault();
      history.pushState({}, '', `?view=explorations&for=${Number(start.dataset.startFor)}`);
      route();
      window.scrollTo({ top: 0 });
      return;
    }
    const ex = t.closest<HTMLAnchorElement>('[data-open-exploration]');
    if (ex) {
      e.preventDefault();
      closeSuggestion(sgHost());
      $('cg-main').hidden = true;
      void openExploration(Number(ex.dataset.openExploration), true, ex.dataset.product || null);
      return;
    }
    if (t.closest('[data-back-requests]')) {
      e.preventDefault();
      history.pushState({}, '', '?view=requests');
      showView('requests');
      return;
    }
    if (t.closest('[data-back]')) {
      e.preventDefault();
      history.pushState({}, '', location.pathname);
      showView('review');
      return;
    }
    const tab = t.closest<HTMLAnchorElement>('[data-cg-view]');
    if (tab) {
      e.preventDefault();
      const view = tab.dataset.cgView as View;
      history.pushState({}, '', VIEW_QUERY[view] || location.pathname);
      showView(view);
    }
  });

  window.addEventListener('popstate', route);
  // A change that turns out to be an exploration (scripts/reviews.ts openPr): its own page, at its own address.
  document.addEventListener('bridge:open-exploration', (e) => {
    const n = Number((e as CustomEvent<{ number: number }>).detail?.number);
    if (!n) return;
    e.preventDefault();
    history.replaceState({ exploration: n, product: null }, '', `?exploration=${n}`);
    route();
  });
  // What the viewer may do on a suggestion depends on who is connected.
  onViewerChange(() => {
    const sg = Number(new URLSearchParams(location.search).get('suggestion'));
    if (sg) showSuggestion(sg, false);
  });
  route();
}
