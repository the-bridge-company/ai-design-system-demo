// Studio "Being built" (pages/studio/building.astro and its team shell): the build requests sent from Figma and where
// each one stands, read from GitHub only (scripts/building-data.ts, rules in lib/building-view.ts and @bridge-ds/core).
//   - One sentence first (the Harbor zone), then Explorations' filters row (lib/building-page, decisions 2026-11-11):
//     Status (Waiting to be picked up, In progress, In review, Shipped in the last 30 days; default Not shipped yet),
//     Product and People, the same checkbox menus (ListFilters MultiFilter), the count, then List, Grid or Board
//     (ListCard ViewSwitch). The address keeps them (?status=, ?product=, ?people=). List and Grid group by product as
//     Explorations does (ListGroup: the product's title and count tag, the library's work under Library), the ladder's
//     order inside a group (Ready to build, Being built, Checking). One row per build request: the shared BranchRow,
//     when it was sent, one status tag in the filter's word; a card is Explorations' ListCard, its person line who has
//     it now and when it last moved ("Malik · yesterday"; before anyone builds it, where it comes from: "Library change
//     Dana approved", lib/build-origin), no product chip (the group says it). An In review row names who must review ("Waiting for Sofia's check", "Changes requested by
//     Lee"); a merged library change reads In the next release until it is published. The whole row opens the detail
//     in place (?request=N, ?pull=N); no row buttons. The Board: one column per status, read only, no tags on cards.
//   - The detail: what was sent (summary, before and after, props needed, the Figma link), the status line, and a
//     "For developers" fold with the GitHub links (and Jira, with JIRA_IN_BRIDGE) and "Copy brief for Claude".
//   - Claude's fixes (the fix sessions of the team's Claude) are rows of the same list, with the same tags and filters:
//     "Button" then "Claude's fix from Figma, asked by Dana" and where it stands, from its pull request when the list
//     read it (lib/claude-connector fixRows). Such a row opens Claude's fix in Studio; while Claude works, the page reads
//     the sessions again every 10 seconds (paused while the tab is hidden).
//   - The Product and People filters read a row by its product and by the people it shows (lib/building-view
//     rowProduct, rowPeople); a row with nobody on it stays under Everyone.
//   - Explorations handed to developers (Done exploring) are rows of the same list too, with an "Exploration" tag: the
//     product, who said Done exploring and when. Such a row opens the exploration in Studio.
//   - How the list is shown is remembered per person (lib/list-view).
//   - Nothing sent yet: what a build request is, where it comes from, who picks it up.
//   - GitHub busy for the viewer with nothing kept: one calm notice with when Bridge is back (BusyNotice), never
//     "Nothing sent yet"; it reads again once on its own after the reset.
// Read only: developers split and track the work in GitHub or Jira. Repo content goes in as React text only, links
// through safeUrl.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Accordion,
  AccordionItem,
  Alert,
  AvatarGroup,
  Badge,
  Button,
  Icon,
  Link,
  Skeleton,
  VisuallyHidden,
} from "@bridge-ds/react";
import { Check, Copy, Hammer } from "lucide-react";
import {
  BUILD_IMAGE_LABEL,
  DEFAULT_PRODUCTS,
  type BuildRequestView,
  type ProductConfig,
} from "@bridge-ds/core";
import type { ThumbSpec } from "../../../lib/branch-thumb";
import { BranchRow } from "./BranchRow";
import { CountTag } from "./CountTag";
import { ListGroup } from "./ListGroup";
import { ComponentPreviewsProvider, previewedNames, useComponentPreviewsOf, type SitePreviewList } from "./ComponentPreviews";
import { MultiFilter } from "./ListFilters";
import { ListCard, useExplorationShots, useListView, ViewSwitch } from "./ListCard";
import { useCopy } from "./TeamLink";
import { DEV_MESSAGE_WORDS } from "../../../lib/developers-message";
import { BusyNotice } from "./BusyNotice";
import { githubBusy, type GitHubBusy } from "../../../lib/github-busy";
import { Drawing } from "./Drawing";
import { Who } from "./faces";
import { YOU } from "../../../lib/branches-page";
import { multiTriggerLabel } from "../../../lib/explorations-page";
import { buildOriginLine, originOfRow } from "../../../lib/build-origin";
import {
  addressWithBuildFilters,
  BUILD_BOARD_CAP,
  BUILD_STATE_LABEL,
  BUILD_STATES,
  buildBoardColumns,
  buildGroups,
  cardLine,
  buildCountLine,
  buildFiltersFromAddress,
  buildStateOf,
  buildStatusTriggerLabel,
  DEFAULT_BUILD_FILTERS,
  emptyBuildLine,
  isBuildFiltered,
  isDefaultStatus,
  NOT_SHIPPED,
  NOT_SHIPPED_LABEL,
  movedAtOf,
  passesBuild,
  type BuildFilters,
  type BuildState,
} from "../../../lib/building-page";
import { person } from "../../../lib/home-model";
import { safeUrl } from "../../../lib/html";
import { JIRA_IN_BRIDGE } from "../../../lib/studio-flags";
import {
  EMPTY_WORDS,
  buildDetail,
  componentThumb,
  detailFromQuery,
  detailQuery,
  jiraLink,
  pageSentence,
  pageRows,
  propLine,
  rowLine,
  rowPeople,
  rowProduct,
  rowThumb,
  shortDate,
  statusTag,
  timelineSteps,
  viewTitle,
  type ExplorationBuildRow,
  type LifecycleExtra,
} from "../../../lib/building-view";
import { FIX_ROW_TITLE, type FixRow } from "../../../lib/claude-connector";
import { studioHref } from "../../../lib/team-path";
import { setPageSummary } from "../../../lib/page-summary";
import { isNameAuthor, nameOfAuthor } from "../../../lib/author";
import { nameFace } from "../../../lib/people";
import {
  loadBuildData,
  readFixes,
  type BuildData,
} from "../../../scripts/building-data";
import { statusTagClass } from '../../../lib/status-tag';
import { statedOrigin } from '../../../lib/library-origin';
import { AuditNote } from './LibraryChanges';
import '../../../styles/explorations-board.css';

const TONE = {
  warning: "warning",
  danger: "danger",
  success: "success",
  neutral: "neutral",
  info: "info",
} as const;
const avatar = (login: string) =>
  `https://github.com/${encodeURIComponent(login)}.png?size=64`;
/** A person by login, or by name only ("name:Leo", lib/author): drawn face, plain name, never looked up on GitHub. */
const personFor = (login: string, data: BuildData) =>
  isNameAuthor(login) ? person(nameFace(nameOfAuthor(login)), nameOfAuthor(login), null) : person(login, data.nameOf(login), avatar(login));
const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const POLL_MS = 10_000;
type Row = (BuildRequestView | FixRow | ExplorationBuildRow) & LifecycleExtra;
const isFix = (v: Row): v is FixRow => "fix" in v;
const isExploration = (v: Row): v is ExplorationBuildRow => "exploration" in v;
/** A listed row, classified once: its status in the page's words, its product and the people it shows. */
interface Item {
  v: Row;
  state: BuildState;
  product: string;
  /** People keys, as the People filter reads them (YOU for the viewer). */
  people: string[];
  names: { key: string; name: string }[];
}

function Builders({
  v,
  data,
  size = "md",
}: {
  v: BuildRequestView;
  data: BuildData;
  size?: "sm" | "md";
}) {
  if (!v.builders.length)
    return (
      <span className="bb-nobody" aria-hidden="true">
        <Icon icon={Hammer} size="sm" />
      </span>
    );
  const people = v.builders.map((l) => personFor(l, data));
  if (people.length === 1) return <Who p={people[0]!} size={size} />;
  return (
    <AvatarGroup aria-label="Building it" max={2} size={size}>
      {people.map((p) => (
        <Who key={p.login} p={p} size={size} />
      ))}
    </AvatarGroup>
  );
}

/** The one person a card names: who builds it, else who asked for it. */
function cardPerson(v: Row, data: BuildData) {
  const login = v.builders[0] ?? v.requestedBy ?? null;
  if (!login) return person("~bridge", "Waiting for a developer", null);
  return personFor(login, data);
}

/** The screens of the explorations among the rows (their preview captures), by row id. */
function useShots(views: readonly Row[]) {
  return useExplorationShots(
    views.filter(isExploration).map((v) => ({ key: v.id, number: Number(/exploration=(\d+)/.exec(v.exploration.href)?.[1] ?? 0), product: (v as { productKey?: string | null }).productKey ?? null })),
  );
}

/**
 * A request sent from a product's adoption report ("Send to developers"): "From the Acme CRM adoption report" under its
 * title, the report as a link, read from the issue body the list already has (no read per row).
 */
function auditNoteOf(v: Row, data: BuildData) {
  if (isFix(v) || isExploration(v) || v.kind !== 'issue') return undefined;
  const o = statedOrigin(data.bodies.get(v.number), data.products ?? DEFAULT_PRODUCTS);
  return o?.kind === 'audit' ? <AuditNote origin={o} /> : undefined;
}


interface CardContext {
  data: BuildData;
  products: readonly ProductConfig[];
  shots: Map<string, ThumbSpec>;
  onOpen: (v: BuildRequestView) => void;
  now: number;
  /** The product in the screen's corner: on the Board only, where no group title says it. */
  showProduct: boolean;
  /** The status tag (not on the Board: its column says it). */
  pill: boolean;
  /** The library components with a preview: a request for one shows it (lib/building-view rowThumb). */
  previewed: readonly string[];
}

/**
 * One change as Explorations' card (ListCard): its preview, its title, its one status tag, and Explorations' person
 * line, who has it now and when it last moved ("Malik · yesterday", lib/building-page cardLine).
 * Before anyone builds it, the line says where it comes from, never who asked ("Library change Dana approved").
 */
function buildCard(x: Item, c: CardContext) {
  const v = x.v;
  const product = c.showProduct ? (c.products.find((p) => p.key.toLowerCase() === x.product)?.name ?? null) : null;
  // Where it comes from, never who asked (lib/build-origin): an adoption report's origin is its note, with the link.
  const o = originOfRow(v);
  const line = cardLine({ builders: v.builders.map((l) => (isNameAuthor(l) ? nameOfAuthor(l) : c.data.nameOf(l))), origin: o && o.kind !== 'audit' ? buildOriginLine(o) : null, movedAt: movedAtOf(v), now: c.now });
  const common = { person: cardPerson(v, c.data), product, pill: c.pill ? statusTag(v) : null, byline: line.who, when: line.when };
  if (isFix(v)) return <ListCard key={v.id} {...common} thumb={componentThumb(v.component, c.previewed)} title={v.component} href={studioHref(v.fix.href)} />;
  if (isExploration(v))
    return <ListCard key={v.id} {...common} thumb={c.shots.get(v.id) ?? { kind: "screen", src: null, product: v.exploration.product, seed: v.id }} title={v.title} href={studioHref(v.exploration.href)} />;
  return (
    <ListCard
      key={v.id}
      {...common}
      thumb={rowThumb(v, c.data.bodies.get(v.number), c.previewed)}
      title={viewTitle(v)}
      note={auditNoteOf(v, c.data)}
      href={detailQuery(v)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        c.onOpen(v);
      }}
    />
  );
}

/** A list's groups (lib/building-page buildGroups): one per product, as on Explorations (ListGroup). */
type Groups = ReturnType<typeof buildGroups<Item>>;

/**
 * The same changes as cards, in the Home's grid, grouped by product as Explorations' grid is: the group title says the
 * product once, so the cards carry no product chip. Each card has the same one status tag as its row.
 */
function Cards({ groups, data, products, onOpen, previewed, now }: { groups: Groups; data: BuildData; products: readonly ProductConfig[]; onOpen: (v: BuildRequestView) => void; previewed: readonly string[]; now: number }) {
  const shots = useShots(groups.flatMap((g) => g.rows.map((x) => x.v)));
  return (
    <>
      {groups.map((g) => (
        <ListGroup key={g.key} id={`bb-${g.key}`} label={g.label} count={g.rows.length}>
          <ul className="sh-cards bb-cards">{g.rows.map((x) => buildCard(x, { data, products, shots, onOpen, now, showProduct: false, pill: true, previewed }))}</ul>
        </ListGroup>
      ))}
    </>
  );
}

/**
 * The Board, as on Explorations (styles/explorations-board.css): one column per status with its count, read only, at
 * most BUILD_BOARD_CAP cards then "Show all N"; the column says the status, so its cards carry no tag. An empty status
 * folds to a small column. It scrolls sideways inside its own region on a phone.
 */
function Board({ items, status, data, products, onOpen, previewed, now }: { items: Item[]; status: readonly BuildState[]; data: BuildData; products: readonly ProductConfig[]; onOpen: (v: BuildRequestView) => void; previewed: readonly string[]; now: number }) {
  const shots = useShots(items.map((x) => x.v));
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const columns = buildBoardColumns(items, status);
  return (
    <div className="ex-board bb-board" role="region" aria-label="Board, one column per status" tabIndex={0}>
      {columns.map((col) => {
        const open = opened.has(col.key);
        const shown = open ? col.rows : col.rows.slice(0, BUILD_BOARD_CAP);
        return (
          <section className={col.rows.length ? "ex-col" : "ex-col is-empty"} key={col.key} aria-labelledby={`bb-col-${col.key}`}>
            <h2 className="ex-col-h" id={`bb-col-${col.key}`}>
              {col.label} <CountTag n={col.rows.length} />
            </h2>
            {col.rows.length > 0 && <ul className="ex-col-cards">{shown.map((x) => buildCard(x, { data, products, shots, onOpen, now, showProduct: true, pill: false, previewed }))}</ul>}
            {col.rows.length > BUILD_BOARD_CAP && !open && (
              <Button variant="link" onClick={() => setOpened((s) => new Set(s).add(col.key))}>
                Show all {col.rows.length}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Rows({
  views,
  data,
  now,
  onOpen,
  previewed,
}: {
  views: Row[];
  data: BuildData;
  now: number;
  onOpen: (v: BuildRequestView) => void;
  previewed: readonly string[];
}) {
  return (
    <ul className="sh-rows bb-rows">
      {views.map((v) => {
        // Claude's fix: the row opens it in Studio (its review), like the home opens a branch.
        if (isFix(v))
          return (
            <BranchRow
              key={v.id}
              thumb={componentThumb(v.component, previewed)}
              who={<Builders v={v} data={data} />}
              title={v.component}
              hint={`${v.component}: ${FIX_ROW_TITLE}`}
              href={studioHref(v.fix.href)}
              line={v.fix.line}
              pill={statusTag(v)}
              statusAtEnd
              className={v.stale ? "bb-stale" : undefined}
            />
          );
        // An exploration handed to developers: the row opens the exploration. No kind tag: every change starts as an
        // exploration, its line ("Done exploring on Oct 31") already says where it comes from.
        if (isExploration(v) && v.exploration.forDevelopers)
          return <SendRow key={v.id} v={v} message={v.exploration.forDevelopers.message} who={<Builders v={v} data={data} />} />;
        if (isExploration(v))
          return (
            <BranchRow
              key={v.id}
              thumb={{ kind: "screen", src: null, product: v.exploration.product, seed: v.id }}
              who={<Builders v={v} data={data} />}
              title={v.title}
              hint={v.title}
              href={studioHref(v.exploration.href)}
              line={v.exploration.line}
              pill={statusTag(v)}
              statusAtEnd
              className={v.stale ? "bb-stale" : undefined}
            />
          );
        const href = detailQuery(v);
        const click = (e: MouseEvent<HTMLAnchorElement>) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(v);
        };
        return (
          <BranchRow
            key={v.id}
            thumb={rowThumb(v, data.bodies.get(v.number), previewed)}
            who={<Builders v={v} data={data} />}
            title={viewTitle(v)}
            href={href}
            onClick={click}
            line={rowLine(v, now, data.nameOf)}
            note={auditNoteOf(v, data)}
            pill={statusTag(v)}
            statusAtEnd
            className={v.stale ? "bb-stale" : undefined}
          />
        );
      })}
    </ul>
  );
}

/**
 * An exploration of a product added from its address: its developers work elsewhere. The row says so and copies them
 * the message (lib/developers-message), on the same line; once copied, the line says where to paste it.
 */
function SendRow({ v, message, who }: { v: ExplorationBuildRow & LifecycleExtra; message: string; who: ReactNode }) {
  const { copied, said, copy } = useCopy(3000);
  const failed = Boolean(said) && said !== DEV_MESSAGE_WORDS.said;
  return (
    <BranchRow
      thumb={{ kind: "screen", src: null, product: v.exploration.product, seed: v.id }}
      who={who}
      title={v.title}
      hint={v.title}
      href={studioHref(v.exploration.href)}
      line={copied || failed ? said : v.exploration.line}
      pill={statusTag(v)}
      statusAtEnd
      className={v.stale ? "bb-stale bb-send-row" : "bb-send-row"}
      end={
        <span className="bb-send">
          <Button variant="secondary" size="md" iconStart={copied ? Check : Copy} onClick={() => void copy(message, DEV_MESSAGE_WORDS.said)}>
            {copied ? DEV_MESSAGE_WORDS.copied : DEV_MESSAGE_WORDS.copy}
          </Button>
          <VisuallyHidden role="status">{said}</VisuallyHidden>
        </span>
      }
    />
  );
}

function Empty() {
  return (
    <div className="bb-empty">
      <Drawing name="fix" width={160} />
      <h2 className="bb-empty-title">{EMPTY_WORDS.title}</h2>
      <p className="t-body bb-measure">{EMPTY_WORDS.text}</p>
      <p className="t-ui t-muted bb-measure">{EMPTY_WORDS.more}</p>
    </div>
  );
}

function CopyBrief({ brief }: { brief: string }) {
  const [done, setDone] = useState<"copied" | "failed" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setDone("copied");
    } catch {
      setDone("failed");
    }
  };
  return (
    <span className="bb-copy">
      <Button variant="secondary" onClick={() => void copy()}>
        Copy brief for Claude
      </Button>
      <span className="t-ui t-muted" role="status">
        {done === "copied"
          ? "Copied. Paste it in Claude Code."
          : done === "failed"
          ? "Your browser blocked copying. Open the issue on GitHub: the brief is there."
          : ""}
      </span>
    </span>
  );
}

function Detail({
  v,
  data,
  onBack,
}: {
  v: BuildRequestView;
  data: BuildData;
  onBack: () => void;
}) {
  const d = useMemo(
    () =>
      v.kind === "issue" ? buildDetail(data.bodies.get(v.number), v) : null,
    [v, data]
  );
  const steps = timelineSteps(v);
  const tag = statusTag(v);
  const jira = jiraLink(v.jira, data.jiraBase);
  const figma = safeUrl(d?.figmaUrl ?? v.figmaUrl);
  const who = (l?: string) => (l ? data.nameOf(l) : null);
  const back = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onBack();
  };
  return (
    <article className="bb-detail" aria-labelledby="bb-detail-title">
      <Link href="?" variant="standalone" onClick={back} className="bb-back">
        All build requests
      </Link>
      <header className="bb-head">
        <h2 className="bb-title" id="bb-detail-title">
          {viewTitle(v)}
        </h2>
        <p className="t-body bb-sub">
          <Badge tone={TONE[tag.tone]} size="md" className={statusTagClass(TONE[tag.tone])}>
            {tag.label}
          </Badge>{" "}
          {v.sentence}
        </p>
      </header>

      <div className="bb-body">
        <div className="bb-main">
          <section className="bb-section" aria-labelledby="bb-sent">
            <h3 className="t-ui bb-h" id="bb-sent">
              What was sent
            </h3>
            {d ? (
              <>
                <p className="t-body bb-measure">{d.summary}</p>
                {d.line && <p className="t-body bb-measure">{d.line}</p>}
                {(d.before.length > 0 || d.after.length > 0) && (
                  <div className="bb-images">
                    {(
                      [
                        [BUILD_IMAGE_LABEL.before, d.before],
                        [BUILD_IMAGE_LABEL.after, d.after],
                      ] as const
                    ).flatMap(([k, urls]) =>
                      urls.flatMap((u, i) => {
                        const src = safeUrl(u);
                        const alt = `${v.component}, ${k.charAt(0).toLowerCase()}${k.slice(1)}`;
                        return src
                          ? [
                              <figure key={`${k}-${i}`} className="bb-figure">
                                <figcaption className="t-ui t-muted">
                                  {k}
                                </figcaption>
                                <Link
                                  href={src}
                                  {...external}
                                  className="bb-frame"
                                  aria-label={`${alt}, open full size`}
                                >
                                  <img src={src} alt={alt} loading="lazy" />
                                </Link>
                              </figure>,
                            ]
                          : [];
                      })
                    )}
                  </div>
                )}
                {d.props.length > 0 && (
                  <>
                    <h4 className="t-ui bb-h4">Options it needs</h4>
                    <ul className="t-body bb-list">
                      {d.props.map((p) => (
                        <li key={p.name}>{propLine(p)}</li>
                      ))}
                    </ul>
                  </>
                )}
                {d.props.length === 0 && d.changes.length > 0 && (
                  <ul className="t-body bb-list">
                    {d.changes.map((c) => (
                      <li key={c.field}>
                        {c.field}: {c.before ? `${c.before} becomes ` : ""}
                        {c.after ?? "removed"}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="t-body bb-measure">
                It was sent from the Figma plugin as a library change. The
                design and what changed are on the change.
              </p>
            )}
            <p className="t-ui t-muted bb-meta">
              {originOfRow(v)
                ? `${buildOriginLine(originOfRow(v)!)}. Sent on ${shortDate(v.createdAt)}.`
                : v.requestedBy
                ? `Sent by ${data.nameOf(v.requestedBy)} on ${shortDate(
                    v.createdAt
                  )}.`
                : `Sent on ${shortDate(v.createdAt)}.`}{" "}
              {figma && (
                <Link href={figma} {...external}>
                  Open in Figma
                </Link>
              )}
            </p>
          </section>

          <Accordion className="bb-dev" headingLevel={3}>
            <AccordionItem value="dev" title="For developers">
              <ul className="t-ui bb-links">
                <li>
                  <Link href={safeUrl(v.url, "#")} {...external}>
                    {v.kind === "issue"
                      ? `Build request #${v.number} on GitHub`
                      : `Change #${v.number} on GitHub`}
                  </Link>
                </li>
                {v.pull && v.pull.number !== v.number && (
                  <li>
                    <Link href={safeUrl(v.pull.url, "#")} {...external}>
                      Pull request #{v.pull.number} on GitHub
                    </Link>
                  </li>
                )}
                {JIRA_IN_BRIDGE && v.jira && (
                  <li>
                    {jira ? (
                      <Link href={jira} {...external}>
                        {v.jira} in Jira
                      </Link>
                    ) : (
                      <span>Jira: {v.jira}</span>
                    )}
                  </li>
                )}
              </ul>
              {d?.brief ? (
                <>
                  <p className="t-ui t-muted bb-measure">
                    The brief gives Claude Code the change, the props, the Figma
                    link and how to close this request when it ships.
                    {d.hasSpec ? " The full spec is in the issue." : ""}
                  </p>
                  <CopyBrief brief={d.brief} />
                </>
              ) : (
                <p className="t-ui t-muted bb-measure">
                  The brief for Claude is on the branch: bridge figma show{" "}
                  {v.number}.
                </p>
              )}
            </AccordionItem>
          </Accordion>
        </div>
        <aside className="bb-aside">
          <section className="bb-section bb-status" aria-labelledby="bb-status">
            <h3 className="t-ui bb-h" id="bb-status">
              Where it stands
            </h3>
            <ol className="bb-steps">
              {steps.map((s) => (
                <li
                  key={s.status}
                  className={`bb-step${s.reached ? " is-reached" : ""}${
                    s.current ? " is-current" : ""
                  }`}
                  aria-current={s.current ? "step" : undefined}
                >
                  <span className="bb-dot" aria-hidden="true">
                    {s.reached && <Icon icon={Check} size="sm" />}
                  </span>
                  <span className="t-ui bb-step-text">
                    <span className="bb-step-label">{s.label}</span>
                    {(s.who || s.at) && (
                      <span className="t-muted">
                        {" "}
                        {[who(s.who), s.at ? shortDate(s.at) : null]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                    {!s.reached && <span className="sr-only"> (not yet)</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </article>
  );
}

/**
 * `library`: Bridge's own components with their docs.json previews (pages/studio/building.astro). A team's page reads
 * its own library instead (ComponentPreviews), after the list.
 */
export default function BeingBuilt({ library }: { library?: SitePreviewList } = {}) {
  const previews = useComponentPreviewsOf(library);
  const previewed = useMemo(() => previewedNames(previews), [previews]);
  const [data, setData] = useState<BuildData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<GitHubBusy | null>(null);
  const [run, setRun] = useState(0);
  const [view, pickView] = useListView("building");
  const [filters, setFilters] = useState<BuildFilters>(() =>
    typeof location === "undefined"
      ? { ...DEFAULT_BUILD_FILTERS, status: [...NOT_SHIPPED] }
      : buildFiltersFromAddress(location.search)
  );
  const [open, setOpen] = useState<{
    kind: "issue" | "pull";
    number: number;
  } | null>(() =>
    typeof location === "undefined" ? null : detailFromQuery(location.search)
  );
  const now = useMemo(() => Date.now(), [data]);

  // While Claude works on a fix, its row follows each step: the sessions are read again (never GitHub).
  const working = Boolean(data?.fixes?.some((f) => f.fix.working));
  useEffect(() => {
    if (!data || !working) return;
    let live = true;
    const timer = setTimeout(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setData({ ...data });
        return;
      }
      readFixes(data)
        .then((fixes) => live && setData({ ...data, fixes }))
        .catch(() => {});
    }, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [data, working]);

  useEffect(() => {
    let live = true;
    loadBuildData(run > 0 ? { fresh: true } : {})
      .then((d) => {
        if (!live) return;
        setBusy(null);
        setData(d);
      })
      .catch((err: unknown) => {
        if (!live) return;
        // GitHub busy: a wait with when Bridge is back, not a failure.
        const b = githubBusy(err);
        if (b) setBusy(b);
        else setFailed(true);
      });
    const pop = () => setOpen(detailFromQuery(location.search));
    window.addEventListener("popstate", pop);
    return () => {
      live = false;
      window.removeEventListener("popstate", pop);
    };
  }, [run]);

  // The page header's summary sentence (lib/page-summary): what waits for a developer and what is being built.
  const summary = data ? pageSentence(pageRows<FixRow | ExplorationBuildRow>(data, now)) : "";
  useEffect(() => setPageSummary(summary), [summary]);

  // The filters stay in the address while a detail is open, and when it closes.
  const go = useCallback(
    (v: BuildRequestView | null) => {
      const query = addressWithBuildFilters(v ? detailQuery(v) : "", filters);
      history.pushState(null, "", v ? query : `${location.pathname}${query}`);
      setOpen(v ? { kind: v.kind, number: v.number } : null);
      window.scrollTo({ top: 0 });
    },
    [filters]
  );

  // The filters live in the address (?status=, ?product=, ?people=), as on Explorations.
  const pick = useCallback((f: BuildFilters) => {
    setFilters(f);
    const url = new URL(location.href);
    url.search = addressWithBuildFilters(url.search, f);
    history.replaceState(history.state, "", url);
  }, []);
  const clear = () => pick({ ...DEFAULT_BUILD_FILTERS, status: [...NOT_SHIPPED] });

  if (busy && !data)
    return <BusyNotice busy={busy} onRetry={() => setRun((n) => n + 1)} />;
  if (failed)
    return (
      <Alert tone="warning" title="Build requests could not be read right now.">
        Reload the page in a minute. They are also on GitHub, labelled
        component-change.
      </Alert>
    );
  if (!data)
    return (
      <div className="bb" aria-busy="true" aria-label="Reading build requests">
        <Skeleton variant="rect" className="bb-skel" />
        <Skeleton variant="rect" className="bb-skel" />
      </div>
    );

  const current = open
    ? data.views.find((v) => v.kind === open.kind && v.number === open.number)
    : null;
  if (current)
    return <Detail v={current} data={data} onBack={() => go(null)} />;
  // Only what "All" lists counts: a request declined more than a week ago has left the page (sentence, counts, empty).
  const rows = pageRows<FixRow | ExplorationBuildRow>(data, now);
  if (!rows.length) return <Empty />;

  // Every row, classified once (lib/building-page): its status, product and people. What shipped more than 30 days
  // ago has left the page.
  const products = data.products ?? DEFAULT_PRODUCTS;
  const me = { nameOf: data.nameOf, viewer: data.viewer ?? null, viewerName: data.viewerName ?? null };
  const items: Item[] = (rows as Row[]).flatMap((v) => {
    const state = buildStateOf(v, now);
    if (!state) return [];
    const names = rowPeople(v, me);
    return [{ v, state, product: rowProduct(v, products), people: names.map((p) => p.key), names }];
  });
  const filtered = isBuildFiltered(filters);
  const kept = items.filter((x) => passesBuild(x, filters));

  // The filter options, Explorations' checkbox menus, each with its count over what the other filters keep.
  const countBy = (f: BuildFilters) => items.filter((x) => passesBuild(x, f)).length;
  const offered = BUILD_STATES.filter((s) => s !== "not-planned" || items.some((x) => x.state === s) || filters.status.includes(s));
  const statusOptions = offered.map((s) => ({ value: s, label: BUILD_STATE_LABEL[s], count: countBy({ ...filters, status: [s] }) }));
  const productName = (k: string) => products.find((p) => p.key.toLowerCase() === k)?.name ?? k;
  const productKeys = [...new Set([...products.map((p) => p.key.toLowerCase()), ...items.map((x) => x.product)])].filter((k) => items.some((x) => x.product === k) || filters.product.includes(k));
  const productOptions = productKeys.map((k) => ({ value: k, label: productName(k), count: countBy({ ...filters, product: [k] }) }));
  const personNames = new Map<string, string>();
  for (const x of items) for (const p of x.names) if (p.key !== YOU) personNames.set(p.key, p.name);
  const personLabel = (k: string) => (k === YOU ? "You" : (personNames.get(k) ?? k));
  const personOptions = [
    ...(data.viewer ? [{ value: YOU, label: "You", count: countBy({ ...filters, people: [YOU] }) }] : []),
    ...[...personNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => ({ value: k, label: n, count: countBy({ ...filters, people: [k] }) })),
  ];

  // The Board shows Shipped too while the Status filter is on its default, as Explorations' Board does.
  const boardItems = view === "board" ? items.filter((x) => passesBuild(x, { ...filters, status: isDefaultStatus(filters.status) ? [...NOT_SHIPPED, "shipped"] : filters.status })) : kept;
  const shownCount = boardItems.length;
  // List and Grid: one group per product, in Explorations' order, the ladder's order inside (lib/building-page).
  const groups = buildGroups(kept, products);
  return (
    <ComponentPreviewsProvider value={previews}>
      <div className="bb ex">
        {data.stale && (
          <div className="bb-notes">
            <p className="t-ui t-muted">
              Shown as last read: GitHub is busy, it refreshes on its own.
            </p>
          </div>
        )}
        <div className="bl-bar">
          <span className="bl-narrow">
            <MultiFilter
              label="Status"
              shown={buildStatusTriggerLabel(filters.status, offered)}
              options={statusOptions}
              picked={filters.status}
              onPick={(v) => pick({ ...filters, status: v.length ? BUILD_STATES.filter((s) => v.includes(s)) : [...NOT_SHIPPED] })}
              reset={{ label: NOT_SHIPPED_LABEL, active: isDefaultStatus(filters.status), onReset: () => pick({ ...filters, status: [...NOT_SHIPPED] }) }}
            />
            <MultiFilter
              label="Product"
              shown={multiTriggerLabel(filters.product, productName, "All products")}
              options={productOptions}
              picked={filters.product}
              onPick={(v) => pick({ ...filters, product: v })}
              reset={{ label: "All products", active: !filters.product.length, onReset: () => pick({ ...filters, product: [] }) }}
            />
            <MultiFilter
              label="People"
              shown={multiTriggerLabel(filters.people, personLabel, "Everyone")}
              options={personOptions}
              picked={filters.people}
              onPick={(v) => pick({ ...filters, people: v })}
              reset={{ label: "Everyone", active: !filters.people.length, onReset: () => pick({ ...filters, people: [] }) }}
            />
          </span>
          <p className="t-ui t-muted bl-summary" aria-live="polite">
            {buildCountLine(shownCount, filtered ? items.length : shownCount)}
            {filtered && shownCount > 0 && (
              <>
                {" "}
                <Button variant="link" onClick={clear}>
                  Clear filters
                </Button>
              </>
            )}
          </p>
          <ViewSwitch view={view} onPick={pickView} board />
        </div>
        {shownCount === 0 ? (
          <p className="t-body t-muted bb-none">
            {emptyBuildLine(filters, { person: personLabel, product: productName })}{" "}
            {filtered && (
              <Button variant="link" onClick={clear}>
                Clear filters
              </Button>
            )}
          </p>
        ) : view === "board" ? (
          <Board items={boardItems} status={filters.status} data={data} products={products} onOpen={go} previewed={previewed} now={now} />
        ) : view === "grid" ? (
          <Cards groups={groups} data={data} products={products} onOpen={go} previewed={previewed} now={now} />
        ) : (
          groups.map((g) => (
            <ListGroup key={g.key} id={`bb-${g.key}`} label={g.label} count={g.rows.length}>
              <Rows views={g.rows.map((x) => x.v)} data={data} now={now} onOpen={go} previewed={previewed} />
            </ListGroup>
          ))
        )}
      </div>
    </ComponentPreviewsProvider>
  );
}

