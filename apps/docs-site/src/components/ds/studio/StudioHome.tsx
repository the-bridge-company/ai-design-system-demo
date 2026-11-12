// The Studio home, direction D (lib/home-model.ts holds the rules and the words). Mounted by pages/studio/index.astro.
//   - The Harbor zone: the greeting, who waits on the viewer and for how long, the Needs you rows (one row component,
//     the whole row is the link), the grouped row with the one primary action "Review all", and a tertiary hint.
//   - One muted health line under the zone.
//   - Your explorations (lib/home-explorations.ts): the product screens tried with Claude AI, each card the explored
//     screen, "Start an exploration" as the first card. Library changes are not cards here: they wait in the review
//     queue for reviewers, live on Changes, and their author gets one line under the section ("Your changes").
//   - Nothing needs the viewer: "What do you want to explore?" in a window onto the calm harbor (QuietScene), what is
//     open of their own work in one sentence (each clause opens Changes on it), and "Start an exploration", the one
//     primary button, right under the headline in the same window.
//   - Someone without a review right (`contributor`): only what waits on them (their branches sent back with changes),
//     never the review queue, and on the first visit a two-step tour of their explorations and how to start (HomeTour.tsx).
// NeedList is shared with the review queue (pages/studio/review.astro), so a row reads the same in both places.
// Admins also get join requests (board E7b, scripts/team-home.ts): one row per person, Decline and Approve inline while
// 3 things or fewer wait; more than that, it folds into "N more" like any row and Review all leads there.
import { createRoot, type Root } from 'react-dom/client';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Who } from './faces';
import { Alert, AvatarGroup, Badge, Button, Icon, Link, Skeleton, ToastProvider } from '@bridge-ds/react';
import { ExplorationCardItem, ProductFolders } from './ExplorationCards';
import { Drawing } from './Drawing';
import { QuietScene } from './QuietScene';
import StartExploration from './StartExploration';
import { BuildLine } from './BuildLine';
import { loadBuildData } from '../../../scripts/building-data';
import ButtonLink from '../ButtonLink';
import {
  AVATARS_SHOWN,
  contributorTourSteps,
  moreNeedsAction,
  contributorTour,
  type ContributorTourAt,
  SEP,
  hintSnoozed,
  onlyReviewerLine,
  splitNeeds,
  waitingSummary,
  type BranchCard,
  type HomeState,
  type NeedRow,
  type Person,
} from '../../../lib/home-model';
import { explorationsFor, libraryChangesLine, ownOpenWork, PARTIAL_LINE, pickUpHref, quietParts, recentExplorations, YOUR_CHANGES_HREF, type ExplorationCard, type QuietPart } from '../../../lib/home-explorations';
import { studioHref } from '../../../lib/team-path';
import { inProgressCount, waitingToBePickedUp } from '../../../lib/waiting-counts';
import { openBuildRequests, type BuildRequestView } from '@bridge-ds/core';
import { pageRows } from '../../../lib/building-view';
import { productFolders, type ProductStateKey } from '../../../lib/product-page';
import { siteConfig } from '../../../scripts/repo-context';
import { defaultProduct, productsOf, type ProductConfig } from '@bridge-ds/core';
import { leadTour, leadTourSteps, type LeadTourAt } from '../../../lib/lead-tour';
import { useNarrow, useTour, type TourPlace } from './HomeTour';

// The rows of the queue (NeedList) and Approve and Decline on a join request live in NeedRows.tsx, shared with
// Settings > Members and the home of a team with no design system yet (JoinRequests.tsx).
export { NeedList, NeedRowItem, type JoinHandlers, type JoinOutcome } from './NeedRows';
import { NeedList, type JoinHandlers } from './NeedRows';


/**
 * "Ann, Dana, Claude AI and 6 others are waiting on you." with their avatars and the oldest wait; for a product
 * manager whose opinion is only asked, "Sofia and Leo would like your opinion." and no age (home-model waitingSummary).
 */
function Waiting({ needs, now }: { needs: NeedRow[]; now: number }) {
  const s = waitingSummary(needs, now);
  if (!s) return null;
  const { people } = s;
  // A div, not a p: the avatar group is a block (a div inside a p is invalid HTML).
  return (
    <div className="t-body sh-waitline">
      {people.length > 0 && (
        <AvatarGroup aria-label={s.group} max={AVATARS_SHOWN} size="md" className="sh-stack">
          {people.map((p) => (
            <Who key={p.agent ? '#agent' : p.login} p={p} name={p.name} decorative={false} />
          ))}
        </AvatarGroup>
      )}
      <span>
        <b className="sh-strong">{s.names}</b>
        {s.rest}
        {s.note && <span className="t-muted">{` ${s.note}`}</span>}
      </span>
    </div>
  );
}

const HINT_KEY = 'bridge.home.only-reviewer.snoozed';

function readSnooze(): number | null {
  try {
    const v = Number(localStorage.getItem(HINT_KEY));
    return v ? v : null;
  } catch {
    return null;
  }
}

function OnlyReviewerHint({ needs, snoozed }: { needs: NeedRow[]; snoozed: boolean }) {
  const [hidden, setHidden] = useState(snoozed);
  const line = onlyReviewerLine(needs);
  if (!line || hidden) return null;
  const notNow = () => {
    try {
      localStorage.setItem(HINT_KEY, String(Date.now()));
    } catch {
      /* private mode: the hint comes back on the next visit */
    }
    setHidden(true);
  };
  return (
    <p className="t-ui t-muted sh-hint">
      <span>{line.text}</span>
      <Link href={studioHref('settings/#roles')}>Add a reviewer</Link>
      <Button variant="ghost" size="sm" onClick={notNow}>
        Not now
      </Button>
    </p>
  );
}

function Needs({ needs, now, snoozed, tour, join, contributor }: { needs: NeedRow[]; now: number; snoozed: boolean; tour?: HomeTour; join?: JoinHandlers; contributor?: boolean }) {
  const { shown, more } = splitNeeds(needs);
  const moreAction = moreNeedsAction(Boolean(contributor));
  // A reviewer's Review all opens Library review, the one queue of library pieces: the other rows (a usage guidance
  // draft, a library check, an exploration's review) unfold here, each row acting on its own.
  const [unfolded, setUnfolded] = useState(false);
  // The step floats under the rows it talks about (HomeTour.tsx): its anchor sits on the zone's bottom edge wherever
  // it renders, and takes no room.
  const narrow = useNarrow();
  return (
    <>
      {narrow && tour?.('rows')}
      {/* One item: its button is the page's primary. Two or three: secondary buttons. More: no row buttons, each row is
          its own link and "Review all" acts. */}
      <NeedList rows={shown} compact shots action={more ? undefined : shown.length === 1 ? 'primary' : 'secondary'} join={join} />
      {!narrow && tour?.('rows')}
      {more && (
        <div className="sh-more">
          <p className="t-body sh-more-text">
            <b className="sh-strong">{more.label}</b>
            {more.parts && (
              <span className="t-muted">
                {SEP}
                {more.parts}
              </span>
            )}
          </p>
          {/* A reviewer: Library review, the one queue of library pieces. Someone without a review right: their own work
              on Explorations (only reviewers get the queue). */}
          {!contributor && (
            <Button variant="ghost" size="md" aria-expanded={unfolded} onClick={() => setUnfolded((o) => !o)}>
              {unfolded ? 'Fold them' : 'Show them here'}
            </Button>
          )}
          <ButtonLink variant="primary" href={studioHref(moreAction.path)} className="sh-more-btn">
            {moreAction.label}
          </ButtonLink>
        </div>
      )}
      {more && unfolded && !contributor && <NeedList rows={needs.slice(shown.length)} compact shots join={join} />}
      {more && tour?.('more')}
      <OnlyReviewerHint needs={needs} snoozed={snoozed} />
    </>
  );
}

export interface HomeComponent {
  name: string;
  slug: string;
  family?: string;
}

/** Exploration cards in one row on a wide screen (board D1): "Start an exploration" and three cards. */
export const EXPLORATION_CARDS = 3;

/** The one sentence of the section when there is no exploration yet. */
export const EXPLORE_LINE = 'Try a product screen with Claude AI. Bridge spots what the library does not have, and what works goes to review.';

/**
 * "Your explorations": the product screens tried with Claude AI, the promise of the product. "Start an exploration"
 * first, like "+ New" in Figma's file browser (the slot never moves), then the first cards and "See all N". None yet:
 * the drawing, one sentence and the one button. Library changes are not here: they wait in the review queue for
 * reviewers, and live on Changes (the "Your changes" line under this section, for their author).
 */
function Explorations({
  explorations,
  components,
  title,
  seeAll,
  tour,
}: {
  explorations: ExplorationCard[];
  components: HomeComponent[];
  title: string;
  seeAll: string;
  tour?: HomeTour | undefined;
}) {
  const narrow = useNarrow();
  const shown = explorations.slice(0, EXPLORATION_CARDS);
  return (
    <section className="sh-section" aria-labelledby="sh-explorations">
      <header className="sh-section-head">
        <h2 id="sh-explorations" className="sh-h2">
          {title}
        </h2>
        {/* "See all N": the explorations in progress, the number the list it opens shows by default (lib/waiting-counts). */}
        {explorations.length > EXPLORATION_CARDS && <Link href={seeAll}>{seeAllWords(inProgressCount(explorations))}</Link>}
      </header>
      {/* The step floats under the cards (its anchor sits on the section's bottom edge, taking no room), so it never
          covers the first card ("Start an exploration"). */}
      {narrow && tour?.('branches')}
      {explorations.length ? (
        <ul className="sh-cards">
          {/* On the demo too: its button carries data-demo-write, so a visitor gets the demo's sign-in dialog
              (scripts/demo-gate.ts). */}
          <li className="sh-card-item sh-create">
            <StartExploration components={components} appearance="card" />
          </li>
          {shown.map((c) => (
            <ExplorationCardItem key={c.key ?? c.number} c={c} />
          ))}
        </ul>
      ) : (
        <div className="sh-explore-empty">
          <Drawing name="paint" width={88} />
          <p className="t-body sh-explore-empty-text">{EXPLORE_LINE}</p>
          <StartExploration components={components} appearance="button" />
        </div>
      )}
      {!narrow && tour?.('branches')}
      {tour?.('start')}
    </section>
  );
}

/**
 * The quiet team Home's explorations (`recent`), under the ways to start: at most four of the same cards, newest first,
 * and "See all N" on Changes when there are more. Purely informative: no Start card (the ways to start sit above), no
 * badge, no action.
 */
function RecentExplorations({ cards, title, seeAll }: { cards: ExplorationCard[]; title: string; seeAll: string }) {
  const recent = recentExplorations(cards);
  if (!recent.cards.length) return null;
  return (
    <section className="sh-section" aria-labelledby="sh-explorations">
      <header className="sh-section-head">
        <h2 id="sh-explorations" className="sh-h2">
          {title}
        </h2>
        {cards.length > recent.cards.length && <Link href={seeAll}>{seeAllWords(recent.total)}</Link>}
      </header>
      <ul className="sh-cards" data-recent-explorations="">
        {recent.cards.map((c) => (
          <ExplorationCardItem key={c.key ?? c.number} c={c} />
        ))}
      </ul>
    </section>
  );
}

/** "You have 2 library changes in progress. See your changes": the author's library changes, on Changes. */
function YourChanges({ n }: { n: number }) {
  const line = libraryChangesLine(n);
  if (!line) return null;
  return (
    <p className="t-ui t-muted sh-health">
      <span>{line}</span>
      <Link href={YOUR_CHANGES_HREF()}>See your changes</Link>
    </p>
  );
}

export interface HealthLine {
  /** Danger rows live in Needs you; this line only says it is healthy, or names an adoption drop. */
  text: string;
  tone: 'ok' | 'drop';
  href: string;
  link: string;
}

function Health({ h }: { h: HealthLine }) {
  return (
    <p className="t-ui t-muted sh-health">
      <Icon icon={h.tone === 'ok' ? CircleCheck : CircleAlert} size="sm" />
      <span>{h.text}</span>
      <Link href={h.href}>{h.link}</Link>
    </p>
  );
}

/**
 * The status line under the Harbor zone: the library's health ("Nothing blocks the library. Open Quality") and, while setup steps
 * are left, "7 of 8 connected" with its checklist, in the same quiet voice. Neither competes with the greeting.
 */
function Status({ health, setup }: { health: HealthLine | null; setup?: ReactNode }) {
  if (!health && !setup) return null;
  return (
    <div className="sh-status" data-home-status="">
      {health && <Health h={health} />}
      {setup && <div className="sh-setup">{setup}</div>}
    </div>
  );
}

/** The team's products (bridge.config.json), as this page knows them. */
function pageProducts(): ProductConfig[] {
  try {
    return productsOf(siteConfig() as { products?: ProductConfig[] });
  } catch {
    return productsOf(null);
  }
}

export interface StudioHomeProps {
  state: HomeState;
  /** Once, right after Entry opened a team the person just joined: "You joined Acme Design." */
  note?: string | null;
  greeting: string;
  needs: NeedRow[];
  /** The viewer's own library changes and suggestions: counted in one line under the explorations, listed on Changes. */
  branches: BranchCard[];
  /**
   * The team's explorations (lib/home-explorations), each marked `own`: a lead or reviewer sees them all under
   * "Explorations", a contributor only their own under "Your explorations" (home by role).
   */
  explorations: ExplorationCard[];
  /**
   * Where each of the library's own changes stands (lib/product-page libraryChangeState), the ones Changes lists under
   * Library: the Library folder counts them with its explorations, in the same words as a product's folder.
   */
  libraryWork?: readonly ProductStateKey[];
  health: HealthLine | null;
  /** What a lead asked and waits for, quiet and without buttons (board L6). */
  waitingOnOthers?: readonly HomeWaiting[];
  /** Show the calm Being built line under the zone (BuildLine): what developers build from Figma, never a Needs you row. */
  building?: boolean;
  now: number;
  components: HomeComponent[];
  /** Signed out: the line and the button label (Sign in with GitHub, or Connect GitHub). */
  signedOut: { line: string; button: string; signIn: boolean };
  /** GitHub could not be read. */
  failed: string | null;
  /**
   * Some reads behind the home failed (scripts/home-data HomeData.partial): what shows is real but may be incomplete,
   * so the home says so in one quiet line, never "Nothing needs you" nor "Nothing in progress".
   */
  partial?: boolean;
  /** Kept for callers: the library ways to start live on their own pages now, not on the Home (the one button). */
  startHrefs: Record<'tokens' | 'component' | 'guidance', string>;
  /**
   * Signed in with setup steps left: "4 of 8 connected" and its checklist (Onboarding.tsx), on the status line under
   * the Harbor zone, next to the library's health: out of the greeting, which keeps the zone for what needs you.
   */
  setup?: ReactNode;
  /** bridge.config.json products, for the product folders under the explorations. Absent: the page's (repo-context). */
  products?: ProductConfig[];
  /**
   * The viewer holds no review right (an email contributor, or a member no owner list names): the needs are only
   * their branches sent back with changes, and the contributor tour runs on the first visit.
   */
  contributor?: boolean;
  /**
   * A lead of the team: a reviewer, or an admin (an email admin included, who manages without GitHub). They get the
   * lead tour on the first visit (the rows that wait on the lead, the whole queue, the branches), never the
   * contributor's.
   */
  lead?: boolean;
  /**
   * Can view (an email member who reads only): the quiet home asks what they want to look at, with no way to start an
   * exploration (they change nothing; the server refuses every write anyway).
   */
  viewOnly?: boolean;
  /**
   * A developer (lib/home-model isBuilderHome): the quiet home leads with what is being built by or for them, Being
   * built on them, never "What do you want to explore?" nor the explorations tour.
   */
  builder?: boolean;
  /** Admins: Approve and Decline on join requests (board E7b). */
  join?: JoinHandlers;
  /**
   * The team Home (scripts/team-home.ts): when nothing needs the viewer, the ways to start stay on top, the greeting
   * says what is open of their own work, then "Recent explorations" (RecentExplorations) and the product folders.
   */
  recent?: boolean;
  /**
   * The viewer's own pieces still waiting in Library review (lib/library-review yourWaitingPieces), once it was read:
   * the quiet sentence says this number, the one Library review lists under Asked by: You.
   */
  libraryPieces?: number | null;
}

/** Where a tour step can point: the lead's (lib/lead-tour LeadTourAt) and the contributor's ("start", the ways to start). */
export type HomeTourAt = LeadTourAt | ContributorTourAt;
/** The tour's popover for a step, anchored where it points (below a block, or beside a control), or nothing. */
type HomeTour = (at: HomeTourAt, place?: TourPlace) => ReactNode;

const CONTRIBUTOR_TOUR_KEY = 'bridge.home.contributor-tour';
const LEAD_TOUR_KEY = 'bridge.home.lead-tour';

/** The review drawing without its empty sky: the scene only, so it never makes the greeting taller than its text. */
const REVIEW_CROP = '0 98 232 86';

/** A developer's quiet home (StudioHomeProps.builder): what they build, on Being built. */
export const BUILDER_WORDS = { title: 'What are you building today?', button: 'See what you are building', path: 'building/?people=you', pickUp: 'Pick up a build request' } as const;

/** The Harbor zone's line when nothing waits on the viewer: honest first, then the calm. */
export const QUIET_LINE = 'Nothing needs you. The harbor is calm.';

/** "See all 7", or "See all" when nothing is in progress (the list then opens on its default, empty filter). */
const seeAllWords = (n: number) => (n > 0 ? `See all ${n}` : 'See all');

/**
 * On a developer's Home, the build requests nobody picked up yet (lib/waiting-counts waitingToBePickedUp), the same rows as
 * the Being built line (BuildLine, lib/building-view pageRows): null while read or unreadable.
 */
function usePickUp(on: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    loadBuildData()
      .then((d) => live && setN(waitingToBePickedUp(openBuildRequests(pageRows<BuildRequestView>(d, Date.now())))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [on]);
  return on ? n : null;
}

/** The quiet sentence (lib/home-explorations quietParts): its counts open Changes on the viewer's own work at that stage. */
function QuietLine({ parts }: { parts: QuietPart[] }) {
  return (
    <>
      {parts.map((x, i) =>
        x.href ? (
          <Link key={i} href={x.href}>
            {x.text}
          </Link>
        ) : (
          <Fragment key={i}>{x.text}</Fragment>
        ),
      )}
    </>
  );
}

/** "You joined Acme Design.": said once, dismissible. */
function JoinedNote({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Alert tone="success" className="sh-note" onDismiss={() => setOpen(false)}>
      {text}
    </Alert>
  );
}

/** The products' folders, the library's own changes counted on the Library folder as Changes lists them. */
function homeFolders(p: StudioHomeProps) {
  const products = p.products ?? pageProducts();
  return productFolders(products, p.explorations, undefined, { [defaultProduct(products).key.toLowerCase()]: p.libraryWork ?? [] }, Boolean(p.partial || p.failed));
}

export function StudioHome(p: StudioHomeProps) {
  // The toasts of the home: a join request approved or declined, with Undo.
  return (
    <ToastProvider limit={2}>
      <HomeBody {...p} />
    </ToastProvider>
  );
}

function HomeBody(p: StudioHomeProps) {
  const snoozed = hintSnoozed(readSnooze(), p.now);
  const own = useTour<ContributorTourAt>(CONTRIBUTOR_TOUR_KEY, contributorTourSteps(p.state === 'empty'), (at) => contributorTour(at, p.state === 'empty'), Boolean(p.contributor) && !p.builder && (p.state === 'busy' || p.state === 'empty'));
  // The lead's tour speaks of changes: rows that are only join requests (or a health note) are not what it shows. Its
  // first step points at the rows on screen, so it runs only when they hold a change; changes folded under "N more"
  // get the Review all step alone.
  const isChange = (r: NeedRow) => r.kind === 'review' || r.kind === 'guidance';
  const changeRows = p.needs.some(isChange);
  const split = splitNeeds(p.needs);
  const byRole = explorationsFor(p.explorations, Boolean(p.contributor));
  const pickUp = usePickUp(Boolean(p.builder) && p.state === 'empty');
  const leadSteps = leadTourSteps({ rows: split.shown.some(isChange), more: changeRows && Boolean(split.more), branches: byRole.cards.length > 0 });
  const lead = useTour<LeadTourAt>(LEAD_TOUR_KEY, leadSteps, (at) => leadTour(at), Boolean(p.lead) && !p.contributor && p.state === 'busy' && leadSteps.length > 0);
  const tour: HomeTour | undefined = p.contributor
    ? (at, place) => (at === 'branches' || at === 'start' ? own(at, place) : null)
    : p.lead
      ? (at) => (at === 'rows' || at === 'more' || at === 'branches' ? lead(at) : null)
      : undefined;
  const explorations = (
    <Explorations
      explorations={byRole.cards}
      components={p.components}
      title={byRole.title}
      seeAll={byRole.seeAll}
      tour={tour}
    />
  );
  if (p.state === 'signed-out') {
    return (
      <div className="sh">
        <section className="zone sh-zone" aria-labelledby="sh-hello">
          <div className="sh-head">
            <div className="sh-head-text">
              <h1 id="sh-hello" className="sh-hello">
                {p.greeting}
              </h1>
              <p className="t-body">{p.signedOut.line}</p>
              <span className="sh-connect">
                <Button variant="primary" className="sh-connect-btn" data-gh-open data-gh-signin={p.signedOut.signIn ? '' : undefined}>
                  {p.signedOut.button}
                </Button>
              </span>
            </div>
            <Drawing name="review" width={220} crop={REVIEW_CROP} className="sh-art" />
          </div>
        </section>
      </div>
    );
  }
  const note = p.note ? <JoinedNote text={p.note} /> : null;
  // A read failed or came back partial: never the calm harbor ("Nothing needs you", "What do you want to explore?"),
  // which would claim nothing waits: the zone says why, and what was read shows below it.
  if (p.state === 'empty' && !p.failed && !p.partial) {
    return (
      <div className="sh">
        {note}
        <section className="zone sh-zone sh-zone-empty" aria-labelledby="sh-hello">
          {/* Nothing needs the viewer: the zone is one window onto the calm harbor (on a phone, only the water). The
              sentence, the headline and the one primary button stand in its sky; designers mostly explore, so editing
              tokens, asking for a component change and writing guidance stay on their own pages, never here. */}
          <div className="sh-window">
            <QuietScene scene="harbor" layout="window" />
            <div className="sh-head-text">
              <p className="t-body">
                {p.greeting} <QuietLine parts={quietParts(p.recent ? ownOpenWork(p.explorations, p.branches) : null, Boolean(p.failed || p.partial), { pieces: p.libraryPieces ?? null, pickUp, pickUpButton: Boolean(p.builder && pickUp) })} />
              </p>
              <h1 id="sh-hello" className="sh-hello">
                {p.builder ? BUILDER_WORDS.title : p.viewOnly ? 'What do you want to look at?' : 'What do you want to explore?'}
              </h1>
              {p.builder ? (
                <span className="sh-start">
                  {/* Build requests wait: the button picks one up, the sentence's count says how many (said once). */}
                  <ButtonLink variant="primary" href={pickUp ? pickUpHref() : studioHref(BUILDER_WORDS.path)}>
                    {pickUp ? BUILDER_WORDS.pickUp : BUILDER_WORDS.button}
                  </ButtonLink>
                </span>
              ) : (
                !p.viewOnly && (
                  <span className="sh-start">
                    <StartExploration components={p.components} appearance="primary" />
                    {/* "Where to start" floats beside the button it points at, over the harbor's sky: the hero keeps
                        its height, the step covers neither the button nor the headline. */}
                    {tour?.('start', 'beside')}
                  </span>
                )
              )}
            </div>
          </div>
          {tour?.('branches')}
          {p.viewOnly && tour?.('start')}
        </section>
        {p.failed && <p className="t-ui t-muted sh-health">{p.failed}</p>}
        <Status health={p.health} setup={p.setup} />
        {p.building && <BuildLine />}
        {p.recent && (
          <>
            <RecentExplorations cards={byRole.cards} title={byRole.title} seeAll={byRole.seeAll} />
            {/* The products, like project folders in Figma, counted on all the team's explorations. */}
            <ProductFolders folders={homeFolders(p)} />
          </>
        )}
      </div>
    );
  }
  const loading = p.state === 'loading';
  // Nothing waits AND every read answered: only then the calm harbor. A failed read says why, a partial one says so.
  const quiet = !loading && p.needs.length === 0 && !p.failed && !p.partial;
  const zoneLine = p.needs.length ? 'Your changes need you.' : (p.failed ?? (p.partial ? PARTIAL_LINE : QUIET_LINE));
  return (
    <div className="sh">
      {note}
      <section className={`zone sh-zone${quiet ? ' sh-zone-quiet' : ''}`} aria-labelledby="sh-hello" aria-busy={loading || undefined}>
        {/* Nothing waits: the zone becomes a window onto a calm harbor, not an empty box (on a phone, only the water). */}
        {quiet && <QuietScene scene="harbor" layout="window" />}
        <div className="sh-head">
          <div className="sh-head-text">
            {/* Who reads is not known yet: their name is held, never someone else's in the meantime. */}
            <h1 id="sh-hello" className="sh-hello" aria-label={p.greeting ? undefined : 'Home'}>
              {p.greeting || <Skeleton variant="text" className="sh-skel-line" />}
            </h1>
            {/* Optional asks (a product manager's view) get their own line, "Sofia would like your opinion.", never "Your
                changes need you.": they are not Ann's changes and nothing waits on her. */}
            {loading ? <p className="t-body">Checking what needs you.</p> : p.needs.some((r) => r.waitsOnYou || r.optional) ? <Waiting needs={p.needs} now={p.now} /> : <p className="t-body">{zoneLine}</p>}
          </div>
        </div>
        {loading ? (
          <>
            {/* Join requests come from Bridge, not GitHub: they show while the rest still loads. */}
            {p.needs.some((r) => r.kind === 'join') && <Needs needs={p.needs.filter((r) => r.kind === 'join')} now={p.now} snoozed={snoozed} join={p.join} />}
            <ul className="sh-rows" aria-hidden="true">
              <li className="sh-row-item">
                <Skeleton variant="rect" className="sh-skel" />
              </li>
            </ul>
          </>
        ) : (
          p.needs.length > 0 && <Needs needs={p.needs} now={p.now} snoozed={snoozed} tour={tour} join={p.join} contributor={Boolean(p.contributor)} />
        )}
      </section>
      {/* Said once: in the zone when nothing else is there, else under it, quietly. */}
      {!loading && p.needs.length > 0 && (p.failed || p.partial) && <p className="t-ui t-muted sh-health">{p.failed ?? PARTIAL_LINE}</p>}
      {/* Until the read is done, nothing below the zone says anything: no empty explorations, no "Nothing in progress",
          no count that is about to change. The space they take is held instead, so nothing jumps when they come. */}
      {loading ? (
        <HomeSkeleton building={Boolean(p.building)} />
      ) : (
        <>
          <Status health={p.health} setup={p.setup} />
          <WaitingOnOthers rows={p.waitingOnOthers ?? []} />
          {p.building && <BuildLine />}
          {/* A failed read: no empty explorations ("Start your first") nor a count of 0 from it. */}
          {!p.failed && explorations}
          {!p.failed && <YourChanges n={p.branches.length} />}
        </>
      )}
      {/* The products, like project folders in Figma: each opens its page, with the explorations made in it. */}
      {/* The folders count what was read: without the team's reads (failed), they would count nothing. */}
      {!loading && !p.failed && <ProductFolders folders={homeFolders(p)} />}
    </div>
  );
}

export interface HomeWaiting {
  key: string;
  title: string;
  /** "waiting for GoulouPhoto". */
  line: string;
  href: string;
}

/** Nothing to do here: each row moves up to Needs you when they answer. */
function WaitingOnOthers({ rows }: { rows: readonly HomeWaiting[] }) {
  if (!rows.length) return null;
  return (
    <section className="sh-waiting" aria-labelledby="sh-waiting-h">
      <h2 className="sh-waiting-h" id="sh-waiting-h">
        Waiting on others
      </h2>
      <p className="t-ui t-muted">Nothing to do here. It moves up to Needs you when they answer.</p>
      <ul className="sh-waiting-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={r.href}>{r.title}</Link>
            <span className="t-muted">
              {SEP}
              {r.line}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cards held in place while the home reads: the exploration row and the products row, as many as a wide row shows. */
export const SKELETON_CARDS = EXPLORATION_CARDS + 1;

/** The space of the explorations and the products while the home reads: their headings and cards, drawn quiet. */
function HomeSkeleton({ building }: { building: boolean }) {
  // The Being built line reads meanwhile, so it is there with the rest instead of pushing the cards down after.
  useEffect(() => {
    if (building) void loadBuildData().catch(() => undefined);
  }, [building]);
  const row = (label: string) => (
    <section className="sh-section" aria-hidden="true" data-home-skeleton={label}>
      <Skeleton variant="text" className="sh-skel-heading" />
      <ul className="sh-cards">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <li key={i} className="sh-card-item">
            <Skeleton variant="rect" className="sh-skel-card" />
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <>
      {row('explorations')}
      {row('products')}
    </>
  );
}

/** Mounts the home into `el` once; later calls repaint it. */
export function paintStudioHome(el: HTMLElement, props: StudioHomeProps, root?: Root | null): Root {
  const r = root ?? createRoot(el);
  r.render(<StudioHome {...props} />);
  return r;
}
