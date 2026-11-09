// The review queue page (pages/studio/review.astro), board Q1 "Review all: Approve and next". Reads the same rows as
// the Studio home (scripts/home-data.ts loadHome), lists them on the start side with what the viewer did to each
// (components/ds/studio/ReviewQueue QueueList), and opens the selected one in the main area. Every item reads the same:
// its title in the display face with its status and who waits, the change, and one bar at the bottom (comment, Ask
// for changes, Approve, More actions, then one keyboard line):
//   - a branch row opens the branch review of Branches in place (scripts/reviews.ts openPr into #rv-detail), without
//     its own bar: the queue's bar replaces it;
//   - a suggestion row (a change a developer applies once owners approve it) opens the suggestion review in place
//     (scripts/suggestions.ts openSuggestion into [data-rq-sg], its queue layout): the bar approves it, asks for
//     changes with the comment, and declines it from More actions; an approval waits for Undo the same way;
//   - an exploration, usage guidance drafts, library health and setup rows show the same head, and the bar's primary
//     action opens the page that handles them; a join request is approved or declined from the bar.
// After a decision the queue moves on: the list mark changes, the next item opens, focus goes to its title, and a toast
// says what was done. Approve waits UNDO_MS before anything is sent, so Undo only cancels: nothing reached GitHub,
// nobody was notified (dismissing a sent approval would leave a trace on the branch and notify its author). Leaving
// the page sends what waits. A approves, S asks for changes, J and K move, for every item.
// The URL keeps the selection (?pr=N or ?item=key) with replaceState only. Rules: lib/queue-nav.ts.
import { createElement as h, Fragment, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button, EmptyState, Progress, Select, Skeleton, type UseToastReturn } from '@bridge-ds/react';
import { Inbox } from 'lucide-react';
import ButtonLink from '../components/ds/ButtonLink';
import { QueueBar, QueueItem, QueueList, QueueToasts, type QueueBarProps } from '../components/ds/studio/ReviewQueue';
import { explorationGlance, explorationOfKey, type ExplorationGlance } from './queue-glance';
import { currentViewer, initGitHubConnect, prefersSignIn, readRepo } from './github-session';
import { joinHandlers } from './join-handlers';
import { viewerRole } from './needs-you';
import { ENTRY_WORDS } from '../lib/entry';
import { setReviewCount } from './shell';
import { loadHome, type HomeStatic } from './home-data';
import { approveBranch, askSomeoneElse, closePr, openPr, suggestChanges } from './reviews';
import { closeSuggestion, forgetSuggestions, openSuggestion, type OpenedSuggestion } from './suggestions';
import { suggestionHref, suggestionOfKey } from '../lib/suggestions-view';
import { branchOf, keyDecision, keyFromSearch, keyMove, moveIndex, nextOpen, outcomeLine, positionLabel, searchFor, UNDO_MS, type QueueOutcome } from '../lib/queue-nav';
import { reviewLink } from '../lib/review-page';
import { ghAction, ghButton } from '../lib/gh-wording';
import type { NeedKind, NeedRow } from '../lib/home-model';
import { studioHref } from '../lib/team-path';

/** The bar's primary action of a row that is not reviewed in place, by kind: the page that handles it. */
const OPEN_LABEL: Record<NeedKind, string> = {
  guidance: 'Review guidance',
  health: 'Open Quality',
  setup: 'Open settings',
  review: 'Open review',
  own: 'Open change',
  join: 'Open Members',
};

/** In the comment's place, for a row that is reviewed on its own page. */
const OPEN_NOTE: Record<NeedKind, string> = {
  guidance: 'You review the guidance on its own page.',
  health: 'You fix it on the Quality page.',
  setup: 'You set it up in Settings.',
  review: 'You review it on its own page.',
  own: 'It opens on its own page.',
  join: '',
};

const read = <T>(id: string): T | null => {
  try {
    return JSON.parse(document.getElementById(id)?.textContent || 'null') as T;
  } catch {
    return null;
  }
};

/** The branch a row opens in place, from its link, else from a ?pr= key ("change-N"). */
const branchNumber = (row: NeedRow | null, key: string | null): number | null => {
  if (row) return branchOf(row);
  const m = key ? /^change-(\d+)$/.exec(key) : null;
  return m ? Number(m[1]) : null;
};

/** Typing, picking in a menu or a list box, or a dialog: the queue's keys belong to that control. */
function ownsKeys(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.closest('input, textarea, select, [contenteditable="true"]')) return true;
  return Boolean(t.closest('[role="menu"], [role="menubar"], [role="menuitem"], [role="listbox"], [role="option"], [role="combobox"], [role="dialog"], [role="alertdialog"]'));
}

export function initReviewQueue() {
  const page = document.querySelector<HTMLElement>('[data-review-queue]');
  if (!page) return;
  const stat = read<HomeStatic>('home-static') ?? { contrastFail: 0, guidance: [] };
  stat.guidance = read<{ drafted: HomeStatic['guidance'] }>('home-guidance')?.drafted ?? [];

  const el = (sel: string) => page.querySelector<HTMLElement>(sel)!;
  const layout = el('[data-rq-layout]');
  const sideEl = el('[data-rq-side]');
  const pickEl = el('[data-rq-pick]');
  const cardEl = el('[data-rq-card]');
  const footEl = el('[data-rq-foot]');
  const emptyEl = el('[data-rq-empty]');
  const toastEl = el('[data-rq-toasts]');
  const sgEl = el('[data-rq-sg]');
  const detail = document.getElementById('rv-detail')!;
  const roots = new Map<HTMLElement, Root>();
  const render = (host: HTMLElement, node: Parameters<Root['render']>[0]) => {
    let r = roots.get(host);
    if (!r) {
      host.replaceChildren();
      r = createRoot(host);
      roots.set(host, r);
    }
    r.render(node);
  };

  let rows: NeedRow[] = [];
  let loading = true;
  let signedIn = false;
  let failed: string | null = null;
  let selected: string | null = keyFromSearch(location.search);
  /** The branch open in #rv-detail. */
  let opened: number | null = null;
  /** The suggestion open in [data-rq-sg], and what it allows once read. */
  let openedSg: number | null = null;
  let sgState: OpenedSuggestion | null = null;
  /** What the viewer did here: decided rows stay listed and marked, even when a later read drops them. */
  const outcomes = new Map<string, QueueOutcome>();
  const decided = new Map<string, NeedRow>();
  /** Approvals waiting for Undo: sent when their time is up, or when the viewer leaves. */
  const waiting = new Map<string, { go: () => Promise<unknown>; timer: ReturnType<typeof setTimeout> }>();
  let canApprove = false;
  let canSuggest = false;
  let busy: 'approve' | 'suggest' | 'ask' | null = null;
  let said = '';
  let focusComment = 0;
  /** After a move, focus goes to the title of the item that opens. */
  let focusTitle = false;
  let toasts: UseToastReturn | null = null;
  let run = 0;

  render(toastEl, h(QueueToasts, { onReady: (api: UseToastReturn) => (toasts = api) }));

  const index = () => rows.findIndex((r) => r.key === selected);
  const rowOf = (key: string | null) => rows.find((r) => r.key === key) ?? null;

  function showSuggestionRow(sg: number | null) {
    if (sg === openedSg) return;
    openedSg = sg;
    sgState = null;
    if (sg === null) {
      closeSuggestion(sgEl);
      return;
    }
    void openSuggestion(sg, {
      el: sgEl,
      inQueue: true,
      approve: (_s, go) => approveLater(go),
      decided: (s, event) => {
        // An approval moved on when it was pressed (it waited for Undo); the others move on once GitHub has them.
        if (event === 'approve') return;
        const d = decide(event === 'decline' ? 'declined' : 'suggested');
        if (!d) return;
        toasts?.add({ title: outcomeLine(event === 'decline' ? 'declined' : 'suggested', s.title), tone: 'success' });
        advance(d.i);
      },
      opened: (s) => {
        sgState = s;
        if (s && focusTitle) {
          focusTitle = false;
          requestAnimationFrame(() => sgEl.querySelector<HTMLElement>('.br-title')?.focus());
        }
      },
    });
  }

  function show(key: string | null) {
    if (key !== selected) {
      joinSaid = '';
      joinGitHub = false;
    }
    selected = key;
    const row = rowOf(key);
    const n = branchNumber(row, key);
    const sg = suggestionOfKey(row?.key ?? key);
    if (row) history.replaceState(history.state, '', `${location.pathname}${searchFor(row)}`);
    showSuggestionRow(sg);
    if (n) {
      if (opened !== n) {
        opened = n;
        canApprove = false;
        canSuggest = false;
        void openPr(n, false);
      }
    } else if (opened !== null) {
      opened = null;
      canApprove = false;
      canSuggest = false;
      closePr();
    }
    paint();
    if (focusTitle && !n && !sg) {
      focusTitle = false;
      requestAnimationFrame(() => cardEl.querySelector<HTMLElement>('.br-title')?.focus());
    }
  }

  function go(to: number | null) {
    if (to === null || !rows[to]) return;
    show(rows[to].key);
  }

  /** After a decision on the row at `i`: the next row without an outcome opens, else the queue is done. */
  function advance(i: number) {
    const to = nextOpen(
      rows.map((r) => r.key),
      i,
      outcomes,
    );
    focusTitle = true;
    if (to === null) {
      if (opened !== null) closePr();
      opened = null;
      showSuggestionRow(null);
      selected = null;
      history.replaceState(history.state, '', location.pathname);
      said = 'Nothing else waits on you.';
      paint();
      return;
    }
    go(to);
  }

  function send(key: string) {
    const w = waiting.get(key);
    if (!w) return;
    waiting.delete(key);
    clearTimeout(w.timer);
    w.go().catch((err: Error) => {
      outcomes.delete(key);
      toasts?.error(`Not approved: ${rowOf(key)?.title ?? 'the change'}`, { description: `${err.message}. Open it and approve again.` });
      paint();
    });
  }

  function decide(outcome: QueueOutcome) {
    const i = index();
    const row = i >= 0 ? rows[i]! : null;
    if (!row) return;
    outcomes.set(row.key, outcome);
    decided.set(row.key, row);
    setReviewCount(rows.filter((r) => r.kind === 'review' && !outcomes.has(r.key)).length);
    return { i, row };
  }

  function approve(text: string) {
    if (busy || !canApprove || !opened) return;
    const n = opened;
    const d = decide('approved');
    if (!d) return;
    later(d, () => approveBranch(n, text));
  }

  /** A suggestion's Approve: the same Undo window as a branch, then scripts/suggestions.ts posts the review. */
  function approveLater(go: () => Promise<void>) {
    if (busy) return;
    const d = decide('approved');
    if (!d) return;
    later(d, async () => {
      await go();
      forgetSuggestions();
    });
  }

  /** Waits UNDO_MS with an Undo toast, then sends; the queue moves on at once. */
  function later(d: { i: number; row: NeedRow }, go: () => Promise<unknown>, description?: string) {
    const key = d.row.key;
    // Nothing is sent before the toast closes: Undo only cancels.
    waiting.set(key, { go, timer: setTimeout(() => send(key), UNDO_MS) });
    const toastId = toasts?.add({
      title: outcomeLine('approved', d.row.title),
      ...(description ? { description } : {}),
      tone: 'success',
      timeout: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const w = waiting.get(key);
          if (!w) return;
          clearTimeout(w.timer);
          waiting.delete(key);
          outcomes.delete(key);
          if (toastId) toasts?.close(toastId);
          toasts?.info(`Not approved: ${d.row.title}`, { description: 'Nothing was sent.', timeout: 3000 });
          focusTitle = true;
          show(key);
        },
      },
    });
    advance(d.i);
  }

  async function act(kind: 'suggest' | 'ask', text = '') {
    if (busy || !opened) return;
    const n = opened;
    busy = kind;
    said = '';
    paint();
    try {
      const names = kind === 'suggest' ? (await suggestChanges(n, text), null) : await askSomeoneElse(n);
      busy = null;
      const d = decide(kind === 'suggest' ? 'suggested' : 'asked');
      if (!d) return;
      toasts?.add({ title: outcomeLine(kind === 'suggest' ? 'suggested' : 'asked', d.row.title), description: names ? `Asked ${names.join(', ')}.` : undefined, tone: 'success' });
      advance(d.i);
    } catch (err) {
      busy = null;
      said = (err as Error).message;
      paint();
    }
  }

  // Join requests: Approve and Decline in the queue card (scripts/join-handlers, the same calls as the Home).
  const { owner: repoOwner, repo: repoName } = readRepo();
  let joinBusy: 'approve' | 'decline' | null = null;
  let joinSaid = '';
  let joinGitHub = false;
  const join = joinHandlers(
    () => `${repoOwner}/${repoName}`,
    () => undefined,
  );
  async function decideJoin(row: NeedRow, approve: boolean) {
    if (joinBusy) return;
    joinBusy = approve ? 'approve' : 'decline';
    joinSaid = '';
    paint();
    const o = await join.decide(row, approve);
    joinBusy = null;
    if (!o.ok) {
      joinGitHub = o.github;
      joinSaid = o.github ? '' : o.text;
      paint();
      return;
    }
    const d = decide(approve ? 'approved' : 'declined');
    if (!d) return;
    const toastId = toasts?.add({
      title: o.text,
      tone: 'success',
      action:
        o.undo && join.undo
          ? {
              label: ENTRY_WORDS.undo,
              onClick: () => {
                void join.undo!(row).then((u) => {
                  if (!u.ok) return toasts?.error(u.text || ENTRY_WORDS.githubToManage);
                  // The decision is taken back: its toast (and its Undo) goes, the new one says so.
                  if (toastId) toasts?.close(toastId);
                  outcomes.delete(row.key);
                  toasts?.info(u.text);
                  paint();
                });
              },
            }
          : undefined,
    });
    advance(d.i);
  }

  function emptyState() {
    const signIn = prefersSignIn();
    return h(EmptyState, {
      icon: Inbox,
      size: 'lg',
      headingLevel: 2,
      title: 'Nothing waits on you.',
      // Someone without a review right (an email member or admin, a GitHub reader: needs-you viewerRole): this queue is
      // the reviewers'; what comes back to them is on Home, never "new reviews land here".
      description:
        failed ??
        (!signedIn
          ? `${ghAction('see what waits on you', signIn)}.`
          : viewerRole() !== 'reviewer'
            ? 'Reviewers look at changes here. When one sends your change back, it shows on Home.'
            : 'New reviews, usage guidance drafts and library checks land here.'),
      actions: signedIn
        ? h(ButtonLink, { variant: 'primary', href: studioHref() }, 'Back to Home')
        : h(
            Fragment,
            null,
            h(Button, { variant: 'primary', 'data-gh-open': '', 'data-gh-signin': signIn ? '' : undefined } as ComponentProps<typeof Button>, ghButton(signIn)),
            h(ButtonLink, { variant: 'secondary', href: studioHref() }, 'Back to Home'),
          ),
    });
  }

  function paint() {
    const empty = !loading && rows.length === 0;
    layout.hidden = empty;
    emptyEl.hidden = !empty;
    if (empty) {
      render(emptyEl, emptyState());
      return;
    }

    const i = index();
    const row = i >= 0 ? rows[i] : null;
    const branch = branchNumber(row, selected);

    render(
      sideEl,
      rows.length ? h(QueueList, { rows: rows.map((r) => ({ ...r, sub: subOf(r) })), selected, outcomes, onSelect: (k: string) => show(k) }) : h(Skeleton, { variant: 'rect', className: 'sh-skel' }),
    );

    // Phones: the list folds into one Select.
    render(
      pickEl,
      rows.length
        ? h(
            Fragment,
            null,
            // Where the viewer is, as on the wide list: the count and the progress above the picker.
            h('p', { className: 'rq-count' }, h('strong', null, 'Review all'), h('span', { className: 'rq-muted' }, ` · ${i >= 0 ? positionLabel(rows.length, i) : `${rows.length} waiting`}`)),
            h(Progress, { value: outcomes.size, max: rows.length, size: 'sm', 'aria-label': `${outcomes.size} of ${rows.length} done` }),
            h(Select, {
              label: 'Waiting on you',
              hideLabel: true,
              size: 'md',
              value: row ? row.key : null,
              placeholder: 'Pick what to review',
              options: rows.map((r) => ({ value: r.key, label: r.title, description: outcomes.has(r.key) ? outcomeLine(outcomes.get(r.key)!, '').trim() : r.line })),
              onValueChange: (v: string | null) => v && show(v),
            }),
          )
        : null,
    );

    // Not a branch nor a suggestion: the same head as every item, its action in the bar.
    const sg = suggestionOfKey(row?.key ?? selected);
    sgEl.hidden = !sg;
    cardEl.hidden = Boolean(branch) || Boolean(sg) || !row;
    render(
      cardEl,
      !branch && !sg && row
        ? h(QueueItem, { title: row.title, person: row.person, line: row.line, detail: row.detail ?? null, pill: row.kind === 'join' ? row.pill : null, glance: glanceOf(row), excerpt: row.excerpt ?? null })
        : null,
    );

    const bar = barFor(row, branch, sg);
    footEl.hidden = !bar;
    // One bar per item: a new item starts with an empty comment.
    render(footEl, bar ? h(QueueBar, { key: selected ?? '', ...bar, said, focusComment }) : null);
  }

  /** An exploration row: its captured screen and next step, read once (scripts/queue-glance), 'loading' meanwhile. */
  const glances = new Map<string, ExplorationGlance>();
  const pendingGlances = new Set<string>();
  function glanceOf(row: NeedRow): ExplorationGlance | 'loading' | null {
    const x = explorationOfKey(row.key);
    if (!x) return null;
    const got = glances.get(row.key);
    if (got) return got;
    if (pendingGlances.has(row.key)) return 'loading';
    pendingGlances.add(row.key);
    void explorationGlance(x).then((g) => {
      glances.set(row.key, g);
      pendingGlances.delete(row.key);
      // The list shows every exploration's library line: a glance read for any row paints again.
      paint();
    });
    return 'loading';
  }

  /** The line under an exploration's title in the list (board LI5), once its glance is read. */
  function subOf(row: NeedRow): string | null {
    if (!explorationOfKey(row.key)) return null;
    const g = glanceOf(row);
    return g && g !== 'loading' ? (g.library?.line ?? null) : null;
  }

  /** What the bar offers for the item on screen: the same places for every item, filled by what it allows. */
  function barFor(row: NeedRow | null, branch: number | null, sg: number | null): Omit<QueueBarProps, 'said' | 'focusComment'> | null {
    const done = outcomes.has(selected ?? '');
    const copy = async (url: string, what: string) => {
      try {
        await navigator.clipboard.writeText(url);
        return `${what} copied.`;
      } catch {
        return 'Copy is not available in this browser. Copy the address from the address bar.';
      }
    };
    if (branch) {
      const links = detail.dataset.developer ? { review: reviewLink(location.origin, branch), developer: detail.dataset.developer } : null;
      return {
        comment: true,
        secondary: { label: 'Ask for changes', disabled: !canSuggest || done || Boolean(busy), loading: busy === 'suggest', needsText: 'Say what to change in the comment first.', onClick: (text) => void act('suggest', text) },
        primary: { label: 'Approve', disabled: !canApprove || done || Boolean(busy), loading: busy === 'approve', onClick: (text) => approve(text) },
        keys: ['approve', 'suggest'],
        menu: [
          { label: 'Ask someone else to review', disabled: !canApprove || Boolean(busy), onClick: () => void act('ask') },
          ...(links
            ? [
                { label: 'Copy link to this review', onClick: () => copy(links.review, 'Link to this review') },
                { label: 'Copy link for a developer', onClick: () => copy(links.developer, 'Link for a developer') },
                { label: 'Open the full review', onClick: () => location.assign(links.review) },
              ]
            : []),
        ],
      };
    }
    if (sg) {
      const b = sgState?.bar;
      const can = (x: boolean | undefined) => Boolean(x) && !done && !busy;
      return {
        comment: true,
        secondary: {
          label: 'Ask for changes',
          disabled: !can(sgState?.canRequestChanges),
          loading: busy === 'suggest',
          needsText: 'Say what should change in the comment first: the author reads it.',
          demoWrite: 'review suggestions',
          onClick: (text) => void sgAct(() => b!.requestChanges(text)),
        },
        primary: { label: b?.approveLabel ?? 'Approve', disabled: !can(sgState?.canApprove), demoWrite: 'review suggestions', onClick: (text) => void b?.approve(text) },
        keys: ['approve', 'suggest'],
        menu: [
          { label: 'Copy link', onClick: () => copy(`${location.origin}${suggestionHref(sg)}`, 'Link to this suggestion') },
          { label: 'Open the full review', onClick: () => location.assign(suggestionHref(sg)) },
          ...(b?.canDecline && !done ? [{ label: 'Decline', tone: 'danger' as const, onClick: () => b.decline() }] : []),
        ],
      };
    }
    if (!row) return null;
    if (row.kind === 'join' && row.request) {
      const name = row.request.name;
      return {
        comment: false,
        note: joinSaid || null,
        secondary: joinGitHub ? null : { label: ENTRY_WORDS.decline, disabled: Boolean(joinBusy) || done, loading: joinBusy === 'decline', onClick: () => void decideJoin(row, false) },
        primary: joinGitHub
          ? { label: ENTRY_WORDS.githubToManage, onClick: () => join.connectGitHub() }
          : { label: `${ENTRY_WORDS.approve} ${name}`, disabled: Boolean(joinBusy) || done, loading: joinBusy === 'approve', onClick: () => void decideJoin(row, true) },
        keys: joinGitHub ? [] : ['approve'],
        menu: [],
      };
    }
    return { comment: false, note: OPEN_NOTE[row.kind] || null, secondary: null, primary: { label: row.action ?? OPEN_LABEL[row.kind], href: row.href }, keys: ['open'], menu: [] };
  }

  /** Ask for changes on the open suggestion: the queue moves on once GitHub has it (showSuggestionRow `decided`). */
  async function sgAct(go: () => Promise<unknown>) {
    if (busy) return;
    busy = 'suggest';
    said = '';
    paint();
    try {
      await go();
      busy = null;
    } catch (err) {
      busy = null;
      said = (err as Error).message;
      paint();
    }
  }

  // What the open review offers (scripts/reviews.ts marks #rv-detail), and focus on its title after a move.
  let lastDev = '';
  new MutationObserver(() => {
    const a = !detail.hidden && detail.hasAttribute('data-can-approve');
    const s = !detail.hidden && detail.hasAttribute('data-can-suggest');
    const dev = detail.dataset.developer ?? '';
    if (a !== canApprove || s !== canSuggest || dev !== lastDev) {
      canApprove = a;
      canSuggest = s;
      lastDev = dev;
      paint();
    }
    const title = detail.querySelector<HTMLElement>('.br-title');
    if (focusTitle && title) {
      focusTitle = false;
      title.tabIndex = -1;
      title.focus();
    }
  }).observe(detail, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-can-approve', 'data-can-suggest', 'data-developer'] });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || layout.hidden || ownsKeys(e.target)) return;
    const move = keyMove(e);
    if (move) {
      const i = index();
      const to = i < 0 && move === 'next' ? (rows.length ? 0 : null) : moveIndex(rows.length, i, move);
      if (to === null) return;
      e.preventDefault();
      go(to);
      return;
    }
    // Enter opens an item reviewed on its own page (the bar's link), unless a control or a link has the focus.
    if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !footEl.hidden && !(e.target instanceof HTMLElement && e.target.closest('a, button, summary, [role="button"]'))) {
      const open = footEl.querySelector<HTMLAnchorElement>('a[data-rq-open]');
      if (open) {
        e.preventDefault();
        open.click();
      }
      return;
    }
    // A and S press what the bar offers, the same for every item: A presses Approve when it can be pressed; S opens
    // the comment, which says what to change, when the item takes one and Ask for changes can be pressed.
    const decision = keyDecision(e);
    if (!decision || footEl.hidden) return;
    const btn = footEl.querySelector<HTMLButtonElement>(`button[data-rq-act="${decision}"]`);
    if (!btn || btn.disabled) return;
    e.preventDefault();
    if (decision === 'approve') btn.click();
    else if (footEl.querySelector('[data-rq-comment]')) {
      focusComment++;
      paint();
    }
  });

  // Leaving the page sends what waits for Undo: an approval is never lost silently.
  window.addEventListener('pagehide', () => [...waiting.keys()].forEach(send));

  // A deep link to a branch or a suggestion opens at once, before the list is read.
  if (selected && (branchNumber(null, selected) || suggestionOfKey(selected))) show(selected);
  else paint();

  let lastLogin: string | null | undefined;
  initGitHubConnect((v) => {
    const login = v?.login ?? null;
    // The viewer changed (or is known now): reopen the branch, the approvals it offers depend on who is connected.
    if (opened && login !== (lastLogin ?? null)) {
      canApprove = false;
      void openPr(opened, false);
    }
    if (openedSg && lastLogin !== undefined && login !== lastLogin) {
      const n = openedSg;
      openedSg = null;
      showSuggestionRow(n);
    }
    lastLogin = login;
    const mine = ++run;
    loading = true;
    rows = [];
    failed = null;
    signedIn = Boolean(login ?? currentViewer());
    paint();
    void loadHome(stat, (d) => {
      if (mine !== run) return;
      signedIn = Boolean(d.viewer);
      failed = d.failed;
      loading = d.loading;
      // Rows decided here stay listed, marked, even once GitHub no longer lists them as waiting.
      const listed = new Set(d.needs.map((r) => r.key));
      rows = [...[...decided.values()].filter((r) => !listed.has(r.key)), ...d.needs];
      if (!d.loading && d.viewer && !d.failed) setReviewCount(d.decisions);
      if (!loading && !rows.length) {
        if (opened !== null) closePr();
        opened = null;
        showSuggestionRow(null);
        selected = null;
      } else if (d.settled && !rowOf(selected) && !(selected && (branchNumber(null, selected) || suggestionOfKey(selected)))) {
        // The first row once the list is read and its order settled, unless the URL names a listed row or a branch.
        const first = rows.findIndex((r) => !outcomes.has(r.key));
        show(rows[first < 0 ? 0 : first]!.key);
        return;
      } else if (opened && rowOf(selected)) {
        history.replaceState(history.state, '', `${location.pathname}${searchFor(rowOf(selected))}`);
      }
      paint();
    });
  });
}
