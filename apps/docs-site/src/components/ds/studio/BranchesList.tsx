// Explorations (/studio/explorations/, the old Changes): every exploration of the team, the rules and words in
// lib/explorations-page (owner decisions 2026-11-09, phase 2 of the redesign).
//   - One filters row, left-aligned: three checkbox dropdowns in the small Select's look (ListFilters MultiFilter):
//     Status (default In progress, the first six statuses), Product, People (Everyone resets), then the count and
//     Clear filters; at its end how the list is shown: List, Grid or Board (ListCard ViewSwitch). The address keeps
//     them (?status=, ?product=, ?people=); old ?state=, ?status=, ?tier= and History links map to Status.
//   - Waiting on you, pinned first whatever the filters, with its count: each row says "Your turn · <reason>". Its rows
//     come from the one rule of every surface (row.yourTurn: lib/waiting-on and the lead's turn, lib/lead-decisions,
//     the same as Home's queue and the nav badge). Not repeated in the groups below; not shown when nothing waits.
//   - Then the explorations grouped by product, the Home's rows (BranchRow) or cards (ListCard) with their real
//     screens and illustrated avatars, each with its one status tag. The Board instead: one column per status (read
//     only, no drag), at most BOARD_CAP cards then "Show all N"; the column says the status, so its cards do not.
//   - Library changes, docs drafts and suggestions are not explorations: they live on Library review. A team with no
//     exploration yet sees "Start with one screen"; filters matching nothing say so with Clear filters.
// Mounted and repainted by scripts/reviews.ts (loadList), which reads GitHub; this file only enriches what is shown
// (display names and thumbnails, with a working token only).
import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton } from '@bridge-ds/react';
import DsButtonLink from '../ButtonLink';
import { BranchRow } from './BranchRow';
import { Who } from './faces';
import { MultiFilter } from './ListFilters';
import { ListCard, useExplorationShots, useListView, ViewSwitch } from './ListCard';
import { Drawing } from './Drawing';
import StartExploration from './StartExploration';
import { designRows, isYours, knownNames, productOf, shippedAtOf, shippedByTask, shippedOn } from '../../../lib/branches-page';
import { authorPerson, CLAUDE, displayName, person, requesterPerson, SEP, type Person, type PillTone } from '../../../lib/home-model';
import { designerKey } from '../../../lib/review-categories';
import { isNameAuthor } from '../../../lib/author';
import { defaultProduct, DEFAULT_PRODUCTS, isExplorationBranch, type ProductConfig, type ToolingConfig } from '@bridge-ds/core';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import type { FileSignals } from '../../../lib/work-nature';
import type { Lifecycle } from '../../../lib/change-status';
import type { LifecycleStage } from '../../../lib/review-state';
import type { LibraryOrigin } from '../../../lib/library-origin';
import { setPageSummary } from '../../../lib/page-summary';
import { DEMO_HOME } from '../../../lib/start';
import {
  addressWithFilters,
  BOARD_CAP,
  boardColumns,
  countLine,
  DEFAULT_FILTERS,
  emptyFilterLine,
  explorationsSummary,
  filtersFromAddress,
  IN_PROGRESS,
  IN_PROGRESS_LABEL,
  isFiltered,
  multiTriggerLabel,
  passes,
  splitWaiting,
  STATE_LABEL,
  STATE_TONE,
  STATES,
  statusOf,
  statusTriggerLabel,
  YOU,
  type ExplorationFilters,
  type ExplorationState,
} from '../../../lib/explorations-page';
import '../../../styles/explorations-board.css';

export interface ListRow {
  number: number;
  /** The human title, without its Jira key. */
  title: string;
  /** The pull request title as written ("fix(studio): ..."): its scope tells Bridge's own work (lib/branches-page designRows). */
  rawTitle?: string | null;
  jira: string | null;
  author: string;
  /** Claude made it: Claude's identity on the row. */
  agent: boolean;
  /** `pr`: the branch review in place (?pr=N); `exploration`: the exploration in place (?exploration=N). */
  opens: 'pr' | 'exploration';
  /** An exploration: when it last moved ("2 h ago"), after who on line 2. */
  ago?: string | null;
  pill: { label: string; tone: PillTone | 'info' } | null;
  lifecycle: Lifecycle | 'exploration';
  yourTurn: boolean;
  /** Why it waits on the viewer, after "Your turn · " (lib/explorations-page turnReason). */
  turnReason?: string | null;
  /** Where it stands, in the page's words (lib/explorations-page statusOf), when the row's record was read. */
  status?: ExplorationState | null;
  /** The viewer made it, when the author does not say so (an email contributor's own: lib/branches-page ownedBy). */
  mine?: boolean;
  behindBy: number | null;
  /** What the status read says about the changed files. */
  signals: FileSignals | null;
  guidance: boolean;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string } | null;
  merged_at?: string | null;
  /** Pull request labels: a `product: <key>` label puts the branch in that product's group. */
  labels?: { name: string }[] | null;
  neededBy?: number | null;
  neededByProduct?: string | null;
  /** An exploration in a product's own repository: the product key. Its number is the product's own. */
  product?: string | null;
  /** Who asked for it, as Bridge records it in the body ("Requested by Ann Leroy."): the designer of the change. */
  requester?: { name: string | null; login: string | null } | null;
  /** An exploration's lifecycle stage once read (lib/review-state). */
  stage?: LifecycleStage | null;
  /** Shipped by the developers' task while the design pull request stays open (lib/exploration-state). */
  shippedAt?: string | null;
  reviewLine?: string | null;
  origin?: LibraryOrigin | null;
  statusKind?: string | null;
  figmaComponent?: string | null;
}

export interface BranchesListProps {
  /** Open branches and running explorations, most urgent first. */
  rows: ListRow[];
  /** The most recently closed branches (merged or not), null until read: the merged ones are Shipped. */
  closed: ListRow[] | null;
  /** Archived explorations (open pull requests, previews alive). */
  archived?: ListRow[];
  closedLimit: number;
  loading: boolean;
  viewer: string | null;
  viewerName?: string | null;
  /** A working GitHub token: names and thumbnails are read. */
  connected: boolean;
  /** bridge.config.json products, in group order. Absent: the default products. */
  products?: ProductConfig[];
  /** bridge.config.json tooling: pull requests that only change Bridge itself stay out. */
  tooling?: ToolingConfig | null;
  /** Asks scripts/reviews.ts for the closed list (Shipped). */
  readClosed: () => void;
  /** GitHub could not be read (rate limit, offline): the list may miss explorations, so no "Start with one screen". */
  unread?: boolean;
  /** The components of the library, for Start an exploration's component picker (empty state). */
  components?: { name: string; slug: string; family?: string }[];
}

const avatarOf = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=64`;

/** The library product reads "Design system" on this page (the side nav's word for it). */
const LIBRARY_NAME = 'Design system';

interface Extra {
  thumb?: ThumbSpec;
  files?: string[] | null;
}

/** Thumbnails, changed files and display names, read once per branch version with a working token only. */
function useExtras(rows: ListRow[], read: 'all' | 'none'): { extras: Map<number, Extra>; people: Map<string, Person> } {
  const [extras, setExtras] = useState<Map<number, Extra>>(new Map());
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const key = rows.map((r) => `${r.number}@${r.head.sha}`).join(',');
  useEffect(() => {
    if (read === 'none' || !rows.length) return;
    let live = true;
    const put = (n: number, e: Extra) => live && setExtras((m) => new Map(m).set(n, { ...m.get(n), ...e }));
    const putPerson = (p: Person) => live && setPeople((m) => new Map(m).set(p.login.toLowerCase(), p));
    void import('../../../scripts/home-data').then(({ personOf, thumbOf, filesOf }) => {
      const logins = new Set<string>();
      for (const r of rows) {
        if (!r.agent && !isNameAuthor(r.author)) logins.add(r.author);
        if (r.requester?.login) logins.add(r.requester.login);
        if (r.product) continue;
        void filesOf(r.number, r.head.sha).then((files) => put(r.number, { files }));
        if (r.base) void thumbOf({ number: r.number, head: r.head, base: r.base }, r.guidance).then((thumb) => put(r.number, { thumb }));
      }
      for (const l of logins) if (!l.includes('[bot]') && !l.includes('@')) void personOf(l, avatarOf(l)).then(putPerson);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, read]);
  return { extras, people };
}

/** An exploration, or work started for a product: what this page lists. Library changes live on Library review. */
const isExplorationRow = (r: ListRow, product: string, libraryKey: string) =>
  r.opens === 'exploration' || Boolean(r.product) || isExplorationBranch(r.head.ref) || product.toLowerCase() !== libraryKey.toLowerCase();

const pillOf = (s: ExplorationState): { label: string; tone: PillTone | 'info' } => {
  const tone = STATE_TONE[s];
  return { label: STATE_LABEL[s], tone };
};

export function BranchesList(p: BranchesListProps) {
  const products = p.products ?? DEFAULT_PRODUCTS;
  const libraryKey = defaultProduct(products).key.toLowerCase();
  const [filters, setFilters] = useState<ExplorationFilters>(() => filtersFromAddress(location.search, libraryKey));
  const [view, setListView] = useListView('changes');
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const viewer = p.viewer;

  const byTask = useMemo(() => shippedByTask(p.rows), [p.rows]);
  const archived = useMemo(() => p.archived ?? [], [p.archived]);
  const closedMerged = useMemo(() => [...(p.closed ?? []).filter((r) => r.merged_at), ...byTask.shipped], [p.closed, byTask.shipped]);
  const all = useMemo(() => [...byTask.open, ...archived, ...closedMerged], [byTask.open, archived, closedMerged]);
  const { extras, people } = useExtras(all, p.connected ? 'all' : 'none');
  const filesOfRow = (r: ListRow) => (r.product ? null : extras.get(r.number)?.files);
  const shots = useExplorationShots(all.filter((r) => r.opens === 'exploration' || isExplorationBranch(r.head.ref)).map((r) => ({ key: `${r.product ?? ''}#${r.number}`, number: r.number, product: r.product ?? null, branch: r.head.ref })));
  const names = useMemo(() => knownNames(all, p.viewer ? { login: p.viewer, name: p.viewerName ?? null } : null), [all, p.viewer, p.viewerName]);

  const resolve = (login: string): Person => {
    const k = login.replace(/^@/, '').toLowerCase();
    const base = people.get(k) ?? person(login, null, avatarOf(login));
    const known = names.get(k);
    return known && base.name === displayName(login) ? { ...base, name: displayName(login, known) } : base;
  };
  const personOf = (r: ListRow): Person => (r.requester && requesterPerson(r.requester, resolve)) ?? (r.agent ? CLAUDE : authorPerson(r.author, resolve));

  // Every row, classified once: its product, status and person.
  const productName = (key: string) => (key === libraryKey ? LIBRARY_NAME : (products.find((pp) => pp.key.toLowerCase() === key)?.name ?? key));
  const classify = (r: ListRow, fixed: ExplorationState | null) => {
    const e = r.product ? undefined : extras.get(r.number);
    const product = (r.product ?? productOf(e?.files ?? null, p.products, r.labels)).toLowerCase();
    const pp = personOf(r);
    const yours = isYours(r, viewer, p.viewerName);
    const status: ExplorationState = fixed ?? r.status ?? statusOf({ lifecycle: r.lifecycle, stage: r.stage, statusKind: r.statusKind, merged_at: r.merged_at, shippedAt: r.shippedAt });
    return { r, e, product, status, person: pp, people: [yours ? YOU : designerKey(pp)], shippedAt: shippedAtOf(r) };
  };
  type Item = ReturnType<typeof classify>;
  const keep = (x: Item) => isExplorationRow(x.r, x.product, libraryKey);
  const openItems = designRows(byTask.open, filesOfRow, p.tooling).map((r) => classify(r, null)).filter(keep);
  const archivedItems = archived.map((r) => classify(r, 'archived')).filter(keep);
  const shippedItems = designRows(closedMerged, filesOfRow, p.tooling)
    .map((r) => classify(r, 'shipped'))
    .filter(keep)
    .sort((a, b) => Date.parse(b.shippedAt ?? '') - Date.parse(a.shippedAt ?? ''));
  const items: Item[] = [...openItems, ...archivedItems, ...shippedItems];

  // Waiting on you: pinned first, whatever the filters (open rows only: nothing archived or shipped waits).
  const { waiting } = splitWaiting(openItems.map((x) => ({ ...x, yourTurn: Boolean(viewer) && x.r.yourTurn })));
  const pinned = new Set(waiting.map((x) => x.r));
  const listed = items.filter((x) => !pinned.has(x.r));
  const kept = listed.filter((x) => passes(x, filters));

  const summary = p.loading && !p.rows.length ? '' : explorationsSummary(openItems.map((x) => x.status));
  useEffect(() => setPageSummary(summary), [summary]);

  // The filters live in the address (lib/explorations-page addressWithFilters).
  const pick = (f: ExplorationFilters) => {
    setFilters(f);
    const url = new URL(location.href);
    url.search = addressWithFilters(url.search, f);
    history.replaceState(history.state, '', url);
  };
  const clear = () => pick({ ...DEFAULT_FILTERS, status: [...DEFAULT_FILTERS.status] });
  const filtered = isFiltered(filters);

  // Shipped needs the closed list: read once the filter or the Board shows it.
  const wantsShipped = filters.status.includes('shipped') || view === 'board';
  const readClosed = p.readClosed;
  useEffect(() => {
    if (wantsShipped && p.closed === null) readClosed();
  }, [wantsShipped, p.closed, readClosed]);

  // The filter options, each with its count over what the other filters keep.
  const countBy = (f: ExplorationFilters) => listed.filter((x) => passes(x, f));
  const statusOptions = STATES.map((s) => ({ value: s, label: STATE_LABEL[s], count: countBy({ ...filters, status: [s] }).length }));
  const productKeys = [...new Set([...products.map((pp) => pp.key.toLowerCase()), ...items.map((x) => x.product)])].filter((k) => items.some((x) => x.product === k) || filters.product.includes(k));
  const productOptions = productKeys.map((k) => ({ value: k, label: productName(k), count: countBy({ ...filters, product: [k] }).length }));
  const personNames = new Map<string, string>();
  for (const x of items) if (x.people[0] !== YOU) personNames.set(x.people[0]!, x.person.name);
  const personOptions = [
    ...(viewer ? [{ value: YOU, label: 'You', count: countBy({ ...filters, people: [YOU] }).length }] : []),
    ...[...personNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => ({ value: k, label: n, count: countBy({ ...filters, people: [k] }).length })),
  ];
  const personLabel = (k: string) => (k === YOU ? 'You' : (personNames.get(k) ?? k));

  const hrefOf = (r: ListRow) => (r.opens === 'pr' ? `?pr=${r.number}` : r.product ? `?exploration=${r.number}&product=${encodeURIComponent(r.product)}` : `?exploration=${r.number}`);
  const linkOf = (r: ListRow) => (r.opens === 'pr' ? { 'data-open-pr': r.number } : { 'data-open-exploration': r.number, ...(r.product ? { 'data-product': r.product } : {}) });
  const thumbOf = (x: Item): ThumbSpec => shots.get(`${x.r.product ?? ''}#${x.r.number}`) ?? x.e?.thumb ?? { kind: 'icon', icon: x.r.guidance ? 'guidance' : 'branch' };
  const keyOf = (r: ListRow) => (r.product ? `${r.product}#${r.number}` : String(r.number));
  /** Line 2: who, then when it last moved or shipped; in Waiting on you, why it is the viewer's turn. */
  const lineOf = (x: Item, turn = false) => {
    if (turn) return `Your turn${SEP}${x.r.turnReason ?? `${x.person.name} sent it for review`}`;
    if (x.status === 'shipped' && x.shippedAt) return `${x.person.name}${SEP}${shippedOn(x.shippedAt)}`;
    return x.r.ago ? `${x.person.name}${SEP}${x.r.ago}` : x.person.name;
  };
  const row = (x: Item, turn = false) => (
    <BranchRow key={keyOf(x.r)} thumb={thumbOf(x)} who={<Who p={x.person} size="md" />} title={x.r.title} jira={x.r.jira} line={lineOf(x, turn)} href={hrefOf(x.r)} linkAttributes={linkOf(x.r)} pill={pillOf(x.status)} />
  );
  const card = (x: Item, opts: { pill?: boolean; product?: boolean; turn?: boolean } = {}) => (
    <ListCard
      key={keyOf(x.r)}
      thumb={thumbOf(x)}
      title={x.r.title}
      href={hrefOf(x.r)}
      linkAttributes={linkOf(x.r)}
      person={x.person}
      product={opts.product ? productName(x.product) : null}
      pill={opts.pill === false ? null : pillOf(x.status)}
      note={opts.turn ? <span className="t-ui ex-turn">{lineOf(x, true)}</span> : undefined}
    />
  );
  const asList = (xs: Item[], turn = false) => (view === 'grid' ? <ul className="sh-cards">{xs.map((x) => card(x, { turn }))}</ul> : <ul className="sh-rows">{xs.map((x) => row(x, turn))}</ul>);

  const loading = p.loading && !p.rows.length;
  const nothingYet = !loading && !p.unread && openItems.length === 0 && archivedItems.length === 0 && (p.closed === null ? !p.loading : shippedItems.length === 0) && !waiting.length;
  // One primary action per view: with nothing yet, the empty state's Start replaces the header's.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('bridge:start-change', { detail: { variant: 'primary', hidden: nothingYet } }));
    const slot = document.querySelector<HTMLElement>('[data-greet]');
    if (slot) slot.dataset.startHidden = String(nothingYet);
  }, [nothingYet]);

  if (loading) {
    return (
      <ul className="sh-rows" aria-hidden="true">
        <li className="sh-row-item">
          <Skeleton variant="rect" className="sh-skel" />
        </li>
        <li className="sh-row-item">
          <Skeleton variant="rect" className="sh-skel" />
        </li>
      </ul>
    );
  }

  if (nothingYet) {
    return (
      <section className="ex-start" aria-labelledby="ex-start-title">
        <Drawing name="review" width={200} />
        <h2 className="ex-start-title" id="ex-start-title">
          Start with one screen
        </h2>
        <p className="t-body t-muted ex-start-text">Pick a screen of one of your products and try an idea on it with Claude. Your team sees it here, with its real screens.</p>
        <div className="ex-start-actions">
          <StartExploration components={p.components ?? []} appearance="primary" />
          <DsButtonLink variant="secondary" href={DEMO_HOME}>
            See the sample team
          </DsButtonLink>
        </div>
      </section>
    );
  }

  const groups = productKeys
    .map((k) => ({ key: k, label: productName(k), rows: kept.filter((x) => x.product === k) }))
    .filter((g) => g.rows.length > 0);
  const boardStatus = filters.status.length === IN_PROGRESS.length && IN_PROGRESS.every((s) => filters.status.includes(s)) ? [...IN_PROGRESS, 'shipped' as const] : filters.status;
  const columns = boardColumns(kept, boardStatus);
  const shownCount = view === 'board' ? columns.reduce((n, c) => n + c.rows.length, 0) : kept.length;

  const board = (
    <div className="ex-board" role="region" aria-label="Board, one column per status" tabIndex={0}>
      {columns.map((c) => {
        const open = opened.has(c.key);
        const shown = open ? c.rows : c.rows.slice(0, BOARD_CAP);
        return (
          <section className="ex-col" key={c.key} aria-labelledby={`ex-col-${c.key}`}>
            <h2 className="ex-col-h" id={`ex-col-${c.key}`}>
              {c.label} <span className="bl-count">{c.rows.length}</span>
            </h2>
            {c.rows.length ? (
              <ul className="ex-col-cards">{shown.map((x) => card(x, { pill: x.status === 'waiting-for-library', product: true }))}</ul>
            ) : (
              <p className="t-ui t-muted ex-col-none">None</p>
            )}
            {c.rows.length > BOARD_CAP && !open && (
              <Button variant="link" onClick={() => setOpened((s) => new Set(s).add(c.key))}>
                Show all {c.rows.length}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="bl ex">
      <div className="bl-bar">
        <span className="bl-narrow">
          <MultiFilter
            label="Status"
            shown={statusTriggerLabel(filters.status)}
            options={statusOptions}
            picked={filters.status}
            onPick={(v) => pick({ ...filters, status: v.length ? STATES.filter((s) => v.includes(s)) : [...IN_PROGRESS] })}
            reset={{ label: IN_PROGRESS_LABEL, active: filters.status.length === IN_PROGRESS.length && IN_PROGRESS.every((s) => filters.status.includes(s)), onReset: () => pick({ ...filters, status: [...IN_PROGRESS] }) }}
          />
          <MultiFilter
            label="Product"
            shown={multiTriggerLabel(filters.product, productName, 'All products')}
            options={productOptions}
            picked={filters.product}
            onPick={(v) => pick({ ...filters, product: v })}
            reset={{ label: 'All products', active: !filters.product.length, onReset: () => pick({ ...filters, product: [] }) }}
          />
          <MultiFilter
            label="People"
            shown={multiTriggerLabel(filters.people, personLabel, 'Everyone')}
            options={personOptions}
            picked={filters.people}
            onPick={(v) => pick({ ...filters, people: v })}
            reset={{ label: 'Everyone', active: !filters.people.length, onReset: () => pick({ ...filters, people: [] }) }}
          />
        </span>
        <p className="t-ui t-muted bl-summary" aria-live="polite">
          {countLine(waiting.length + shownCount, filtered ? waiting.length + listed.length : waiting.length + shownCount)}
          {filtered && (
            <>
              {' '}
              <Button variant="link" onClick={clear}>
                Clear filters
              </Button>
            </>
          )}
        </p>
        <ViewSwitch view={view} onPick={setListView} board />
      </div>

      {waiting.length > 0 && (
        <section className="bl-group ex-waiting" aria-labelledby="bl-waiting">
          <h2 className="bl-h2" id="bl-waiting">
            Waiting on you <span className="bl-count">{waiting.length}</span>
          </h2>
          {asList(waiting, true)}
        </section>
      )}

      {kept.length === 0 ? (
        <p className="t-body t-muted bl-none">
          {emptyFilterLine(filters, { person: personLabel, product: productName })} {filtered && <Button variant="link" onClick={clear}>Clear filters</Button>}
        </p>
      ) : view === 'board' ? (
        board
      ) : (
        groups.map((g) => (
          <section className="bl-group" key={g.key} aria-labelledby={`bl-${g.key}`}>
            <h2 className="bl-h2" id={`bl-${g.key}`}>
              {g.label} <span className="bl-count">{g.rows.length}</span>
            </h2>
            {asList(g.rows)}
          </section>
        ))
      )}
      {filters.status.includes('shipped') && p.closed !== null && p.closed.length >= p.closedLimit && <p className="t-ui t-muted bl-merged">Shipped shows the most recent ones.</p>}
    </div>
  );
}

let root: Root | null = null;

/** Mounts the list into `el` once; later calls repaint it with the new rows (its filters stay). */
export function paintBranchesList(el: HTMLElement, props: BranchesListProps) {
  root ??= createRoot(el);
  root.render(<BranchesList {...props} />);
}

