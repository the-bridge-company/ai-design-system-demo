// Library review (/studio/library-review/, boards LR2 to LR14): the DS lead's one queue for library pieces, visible to
// everyone. Two views (?view=), switched from the title line: One by one (the list on the start side, one piece in
// the main area, its decision under it, keys A add, K keep, the down arrow next; a conflict is a compare stage and one
// radio list) and List (chapters per family, a group rail, one row per piece, a checkbox per row and per group, and
// the bottom bar that says what the selection touches before acting), then the Map. Directions C, D2 and E
// (owner, 2026-11-10): lib/library-review-list.ts (chapters, tally, marks), lib/library-review-compare.ts.
// Filters are checkbox lists (Status, Asked by, Product); no tabs. A designer opens on her own pieces, reads who decides
// in one banner and sees no buttons; her rows show only what changed (an exception). Decisions are the exploration's
// own (scripts/library-review-data.ts): deciding here or on the exploration page is the same decision. Undo stays
// a few seconds before a decision is sent. Rules: lib/library-review.ts. Styles: styles/library-review.css.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarGroup, Badge, Button, Card, CardBody, Checkbox, Icon, IconButton, Input, Link, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuTrigger, Banner, Pagination, Popover, PopoverContent, PopoverTrigger, Progress, SegmentedControl, Skeleton, Tag, ToastProvider, Tooltip, useToast, VisuallyHidden } from '@bridge-ds/react';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, Ellipsis, Info } from 'lucide-react';
import { siteIcon } from '../../../brand/site-icons';
import ButtonLink from '../ButtonLink';
import { QuietScene } from './QuietScene';
import { Who } from './faces';
import { People } from './People';
import { ProductMark as ProductIcon } from './ProductMark';
import { namedFace } from '../../../lib/cast-faces';
import { isNew, Sample, thumbOf } from './LibraryReviewSample';
import { afterCaption, showsBefore } from '../../../lib/new-piece-preview';
import { libraryQueueCount, libraryQueueSubtitle, withLocal } from '../../../lib/library-queue';
import { MapView } from './LibraryMap';
import { ReachPage } from './LibraryReach';
import { mapAvailable } from '../../../lib/library-map';
import { measuredReach, reachCell, reachOf, type Measured, type Reach, type ReachData } from '../../../lib/library-reach';
import { hasLegacy, itemTarget, landing, libraryPageOf, pieceSearch, readLegacy, readPiece, viewSearch, withoutLegacy } from '../../../lib/library-review-links';
import { studioHref } from '../../../lib/team-path';
import { ASKED_DIRECTLY, askedColumns, askedCountLine, askersOf, faceName, FACES_SHOWN, groupAskers, moreTag, waysTag } from '../../../lib/library-askers';
import { chapterReach, chaptersOf, listGrid, productMarks, railLabel, shownColumns, sideLabel, tallyOf, tallySentence } from '../../../lib/library-review-list';
import { BOTH, checkedKeepLabel, checkedLooks, checkedOfPick, checkedOutcome, checkedPick, compareView, defaultChecked, STAGE_SCALE, TODAY, type CompareOption, type CompareView } from '../../../lib/library-review-compare';
import { withManyAskers } from '../../../lib/library-review-fixtures';
import {
  batchable,
  keepMissing,
  canDecide,
  colorLook,
  contrastWords,
  cssRgba,
  decidedTag,
  designerBanner,
  emptyLine,
  filterChoices,
  filterValue,
  groupPieces,
  joinSmallGroups,
  keepLabel,
  keyAction,
  nextActor,
  passes,
  pieceWaitTone,
  reviewParams,
  reviewProgress,
  selectionLine,
  STATUS_CHOICES,
  summaryLine,
  tokenGroup,
  waitLine,
  withReviewParams,
  YOU,
  type AskedBy,
  type ColorLook,
  type FilterChoice,
  type ReviewFilters,
  type ReviewPiece,
  type ReviewView,
} from '../../../lib/library-review';
import { ACTIONS_SELECTOR, setPageSummary, setPageSummaryLead } from '../../../lib/page-summary';
import { statusTagClass } from '../../../lib/status-tag';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import { askOther, commentOn, decide, loadLibraryReview, pickWay, readViewer, type ReviewData } from '../../../scripts/library-review-data';
import { rememberMine } from '../../../scripts/needs-you';
import { setReviewCount } from '../../../scripts/shell';
import { exploringDemo, openMakeItYours } from '../../../scripts/demo-gate';
import { onSampleTeam, readRepo } from '../../../scripts/github-session';
import { siteConfig } from '../../../scripts/repo-context';
import { AA_MIN, contrastRatio, defaultProduct, productsOf, type ProductConfig } from '@bridge-ds/core';
import { productHref } from '../../../lib/product-page';
import { libraryHref } from '../../../lib/library-shells';
import { SEP } from '../../../lib/sep';

/** How long a decision waits, with Undo, before it is sent. */
const UNDO_MS = 5000;

type Act = { kind: 'add' | 'keep' | 'existing' | 'keep-both' } | { kind: 'pick'; way: string };

interface Pending {
  key: string;
  act: Act;
  line: string;
}

/** A filter: a button that reads "Status  Waiting", opening a list of checkboxes. */
function FilterMenu({ name, kind, picked, choices, onChange }: { name: string; kind: 'status' | 'asked' | 'product'; picked: string[]; choices: FilterChoice[]; onChange: (v: string[]) => void }) {
  const value = filterValue(kind, picked, choices);
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="secondary" size="md" className="lr-filter" iconEnd={ChevronDown} aria-label={`${name}: ${value}`}>
            <span className="lr-filter-name">{name}</span> <span className="lr-filter-value">{value}</span>
          </Button>
        }
      />
      <MenuContent align="start">
        {kind !== 'status' && (
          <MenuCheckboxItem checked={!picked.length} onCheckedChange={() => onChange([])}>
            {kind === 'asked' ? 'Anyone' : 'All products'}
          </MenuCheckboxItem>
        )}
        {choices.map((c) => (
          <MenuCheckboxItem key={c.value} checked={picked.includes(c.value)} onCheckedChange={(on) => onChange(on ? [...picked, c.value] : picked.filter((x) => x !== c.value))}>
            {c.label}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** The exploration that asked, as a chip that opens it. */
/** A count next to its label: the DS count tag (ink tabular figures on a neutral fill), centred on the label. */
function Count({ n }: { n: number }) {
  return (
    <Badge appearance="count" size="sm" className="lr-count">
      {n}
    </Badge>
  );
}

/** A middle dot between two parts of one line: the shared separator (lib/sep SEP), its room built in. */
function Sep() {
  return (
    <span className="lr-sep" aria-hidden="true">
      {SEP}
    </span>
  );
}

/** The detail's eyebrow, said once: "Colors · new color", "Docs" (never "Docs · docs"). */
const eyebrowParts = (p: ReviewPiece): string[] => {
  const what = p.category === p.title ? 'Components' : p.category;
  const kind = p.kind.toLowerCase();
  return what.toLowerCase() === kind ? [what] : [what, kind];
};

function AskedChip({ p }: { p: ReviewPiece }) {
  if (!p.asked) return <span className="lr-ask is-lead">{p.mine ? 'From you' : p.by ? `From ${p.by}` : 'From a lead'}</span>;
  const words = (
    <>
      {p.asked.name}
      {p.asked.product && (
        <span className="lr-ask-product">
          <Sep />
          {p.asked.product}
        </span>
      )}
    </>
  );
  return p.asked.href ? (
    <Link className="lr-ask" href={p.asked.href} variant="subtle">
      {words}
    </Link>
  ) : (
    <span className="lr-ask">{words}</span>
  );
}

function StateTag({ p, viewerReviews }: { p: ReviewPiece; viewerReviews: boolean }) {
  const d = decidedTag(p);
  if (d)
    return (
      <Badge tone={d.tone} size="md" className={statusTagClass(d.tone)}>
        {d.label}
      </Badge>
    );
  if (p.conflict)
    return (
      <Badge tone={pieceWaitTone(p)} size="md" className={statusTagClass(pieceWaitTone(p))}>
        {waysTag(p.conflict.ways.length)}
      </Badge>
    );
  if (!viewerReviews) return null;
  return (
    <Badge tone={pieceWaitTone(p)} size="md" className={statusTagClass(pieceWaitTone(p))}>
      Waiting
    </Badge>
  );
}

/** A product's mark for an exploration's product name ("Acme CRM" C), or null when Bridge knows no product. */
type MarkOf = (product: string | null | undefined) => string | null;

/**
 * How the review draws people it knows by name only: the sample team's cast by their own seeds, "You" as the viewer.
 * Set once by the page (LibraryReviewView), read by every face below.
 */
const FaceNames = createContext<{ sample: boolean; you: string | null }>({ sample: false, you: null });

/**
 * A person known by name, as the same drawn face they have on every Studio surface (faces.tsx Who, seeded by
 * lib/cast-faces namedFace), never initials.
 */
function NameFace({ name, size = 'sm', decorative = true }: { name: string; size?: 'xs' | 'sm'; decorative?: boolean }) {
  const ctx = useContext(FaceNames);
  const who = name === 'You' && ctx.you ? ctx.you : name;
  return <Who p={namedFace(who, { sample: ctx.sample })} size={size} decorative={decorative} name={name} />;
}

/** How People (the one group of people, People.tsx) draws a name here: the review's own faces. */
const nameFaceOf = (name: string, size: 'xs' | 'sm') => <NameFace name={name} size={size} />;

/** A person's face, whole: nothing sits on it. */
function Face({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' }) {
  return (
    <span className="lr-face" title={name}>
      <NameFace name={name} size={size} />
    </span>
  );
}

/** A family's line icon (the side nav's: Tokens grid, Components diamonds, a doc) in an outlined circle. */
function FamilyIcon({ name, size = 'md' }: { name: 'grid' | 'diamonds' | 'doc'; size?: 'sm' | 'md' }) {
  return (
    <span className={`lr-fam-icon is-${size}`} aria-hidden="true">
      <Icon icon={siteIcon(name)} size={size === 'md' ? 'lg' : 'sm'} />
    </span>
  );
}

/**
 * Who asked, in the side list of One by one: the List's two columns on one line, the same anatomy on every row (owner,
 * 2026-11-12). The face and first name, then the exploration ("Sofia · Contact page summary"), or "Asked directly"
 * when no exploration asked. Only the exploration shortens when the line is narrow (its full name on hover); "+N"
 * counts the other explorations. No product mark: the product is named on the piece.
 */
function AskedLine({ p }: { p: ReviewPiece }) {
  const c = askedColumns(p);
  const from = c.from;
  return (
    <>
      <Face name={c.person} size="xs" />
      <span className="lr-line-who">{c.person}</span>
      <span className="lr-line-sep" aria-hidden="true">
        {SEP.trim()}
      </span>
      <VisuallyHidden>, </VisuallyHidden>
      {from.kind === 'direct' ? (
        <span className="lr-line-t">{ASKED_DIRECTLY}</span>
      ) : (
        <>
          <span className="lr-line-t" title={from.first.name}>
            {from.first.name}
          </span>
          {from.more > 0 && <MoreTag n={from.more} what="explorations" />}
        </>
      )}
    </>
  );
}

/** The quiet link from a piece to its page in the library (its component on Components, its kind on Tokens). */
/** The quiet link to the piece's library page. `title`: beside the h2 of the detail, where the icon matches the title's
 * size (20px on a 32px target) instead of the list rows' 16px. */
function LibraryPageLink({ p, title = false }: { p: ReviewPiece; title?: boolean }) {
  const page = libraryPageOf(p);
  if (!page) return null;
  return (
    <Link href={studioHref(page.path)} variant="subtle" className={title ? 'lr-page-link is-title' : 'lr-page-link'} title={`Open ${page.label}`}>
      <Icon icon={BookOpen} size={title ? 'md' : 'sm'} />
      <VisuallyHidden>Open {page.label}</VisuallyHidden>
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One by one

/**
 * A colour drawn as text or as the main button: its contrast, measured on the plate as drawn (the text on its surface,
 * the label on the colour), with AA said in words so the result never rests on the badge colour alone.
 */
function useDrawnContrast(art: RefObject<HTMLDivElement | null>, hex: string | null | undefined, look: ColorLook | null): number | null {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    const el = art.current?.querySelector<HTMLElement>('.lr-look');
    if (!el || !hex || (look !== 'text' && look !== 'action')) return setRatio(null);
    const cs = getComputedStyle(el);
    const drawn = cssRgba(look === 'text' ? cs.backgroundColor : cs.color);
    try {
      setRatio(drawn ? (look === 'text' ? contrastRatio(hex, drawn) : contrastRatio(drawn, hex)) : null);
    } catch {
      setRatio(null);
    }
  }, [art, hex, look]);
  return ratio;
}

function Plate({ children, caption, value, tone, contrast }: { children: ReactNode; caption: string; value?: string | null; tone?: 'match'; contrast?: { hex: string | null; look: ColorLook } | null }) {
  const art = useRef<HTMLDivElement | null>(null);
  const ratio = useDrawnContrast(art, contrast?.hex, contrast?.look ?? null);
  const said = ratio === null ? null : contrastWords(ratio, AA_MIN.text);
  return (
    <figure className={`lr-plate${tone === 'match' ? ' is-match' : ''}`}>
      <div className="lr-plate-art" ref={art}>
        {children}
      </div>
      <figcaption className="lr-plate-cap">
        <span className="lr-plate-label">{caption}</span>
        <span className="lr-plate-meta">
          {said && (
            <Badge tone={said.pass ? 'success' : 'danger'} size="sm" className={`lr-plate-ratio ${statusTagClass(said.pass ? 'success' : 'danger')}`}>
              {said.text}
            </Badge>
          )}
          {value && <span className="lr-plate-value">{value}</span>}
        </span>
      </figcaption>
    </figure>
  );
}

const valueOf = (spec: ThumbSpec, side: 'before' | 'after'): string | null => {
  if (spec.kind === 'color') return spec[side]?.toUpperCase() ?? null;
  if (spec.kind === 'space' || spec.kind === 'radius' || spec.kind === 'type') return spec[side] === null ? null : `${spec[side]}`;
  return null;
};

/** The reach link of a piece ("11 screens ›", "Not counted yet ›"): opens Who gets it. */
function ReachLink({ p, cell, onReach, label, text, quiet, hoverOnly }: { p: ReviewPiece; cell: string; onReach: (p: ReviewPiece) => void; label?: string; text?: string; quiet?: boolean; hoverOnly?: boolean }) {
  return (
    <Link
      href={reachHref(p.key)}
      className={`lr-reach-link${quiet ? ' is-quiet' : ''}${hoverOnly ? ' is-hover-only' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        onReach(p);
      }}
      aria-label={`Who gets ${p.title}: ${cell}`}
    >
      {label ? `${label} ` : ''}
      {text ?? cell}
      <Icon icon={ChevronRight} size="xs" className="lr-reach-chev" />
    </Link>
  );
}

function Detail({ p, thumbs, viewer, lead, tech, onAct, onComment, busy, measured, onReach, mark }: { p: ReviewPiece; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; lead: string | null; tech: string | null; onAct: (p: ReviewPiece, a: Act) => void; onComment: (p: ReviewPiece, text: string) => Promise<void>; busy: boolean; measured: Measured; onReach: (p: ReviewPiece) => void; mark: MarkOf }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState('');
  const [showAskers, setShowAskers] = useState(false);
  const askers = askersOf(p);
  useEffect(() => {
    setCommenting(false);
    setText('');
    setShowAskers(false);
  }, [p.key]);
  const decides = canDecide(p, viewer);
  const spec = thumbOf(p, thumbs);
  // Something new has no before: only its after side, "New in this screen" (lib/new-piece-preview).
  const before = showsBefore(isNew(p), spec);
  const wait = viewer.reviews ? waitLine(p, { lead, tech }) : null;
  const comment = (
    <>
      {!commenting ? (
        <Button variant="ghost" size="lg" onClick={() => setCommenting(true)}>
          {p.conflict ? 'Comment to both' : 'Comment'}
        </Button>
      ) : null}
    </>
  );
  const commentBox = commenting && (
    <form
      className="lr-comment"
      onSubmit={(e) => {
        e.preventDefault();
        void onComment(p, text).then(() => {
          setText('');
          setCommenting(false);
        });
      }}
    >
      <Input label="Comment" hideLabel size="lg" placeholder={p.asked?.designer ? `Write to ${p.asked.designer}` : 'Add a comment'} value={text} onValueChange={setText} autoFocus />
      <Button type="submit" variant="secondary" size="lg" disabled={!text.trim()} data-demo-write="comment on library pieces">
        Send
      </Button>
      <Button variant="ghost" size="lg" onClick={() => setCommenting(false)}>
        Cancel
      </Button>
    </form>
  );
  if (p.conflict)
    return (
      <Compare
        p={p}
        decides={decides}
        busy={busy}
        onAct={onAct}
        wait={wait}
        mark={mark}
        commenting={commenting}
        onCommentOpen={() => setCommenting(true)}
        commentBox={commentBox}
        tag={(p.state === 'decided' || !decides) && <StateTag p={p} viewerReviews={viewer.reviews} />}
      />
    );
  // Two parts and a separator the CSS spaces (.lr-eyebrow-sep): typed " · " left 2px each side of a 1px dot.
  // Said once: "Docs", never "Docs · docs".
  const [what, kind] = eyebrowParts(p);
  const eyebrow = (
    <>
      <span>{what}</span>
      {kind && (
        <>
          <Sep />
          <span>{kind}</span>
        </>
      )}
    </>
  );
  return (
    <article className="lr-detail" aria-labelledby="lr-detail-title">
      <div className="lr-detail-head">
        <div>
          <p className="lr-eyebrow">{eyebrow}</p>
          <div className="lr-title-line is-solo">
            <h2 className="lr-detail-title" id="lr-detail-title">
              {p.title}
            </h2>
            <LibraryPageLink p={p} title />
          </div>
        </div>
      </div>
      <p className="lr-detail-ask">
        {askers.length > 1 ? (
          <>
            <AvatarGroup aria-label="Who asked" size="xs" max={FACES_SHOWN}>
              {askers.map((a) => (
                <NameFace key={a.key} name={faceName(a)} size="xs" decorative={false} />
              ))}
            </AvatarGroup>
            <span>{askedCountLine(askers.length)}</span>
            <Button variant="link" aria-expanded={showAskers} onClick={() => setShowAskers((o) => !o)}>
              {showAskers ? 'Hide them' : 'Show them'}
            </Button>
          </>
        ) : (
          <>
            {!p.asked && p.by && !p.mine ? (
              <span className="lr-detail-who">
                <NameFace name={p.by} size="sm" />
                <span className="lr-muted">From {p.by}</span>
              </span>
            ) : (
              <AskedChip p={p} />
            )}
            {p.asked?.designer && (
              <span className="lr-detail-who">
                <NameFace name={p.asked.designer} size="sm" />
                <span className="lr-muted">{p.mine ? 'You asked for it' : `${p.asked.designer} asked for it`}</span>
              </span>
            )}
          </>
        )}
        {(p.state === 'decided' || !decides) && <StateTag p={p} viewerReviews={viewer.reviews} />}
        <span className="lr-detail-reach">
          <span className="lr-muted">Who gets it</span> <ReachLink p={p} cell={measured.cell} onReach={onReach} />
        </span>
      </p>
      {askers.length > 1 && showAskers && <AskersList list={askers} />}
      {(
        <>
          <div className={`lr-plates${p.match ? ' has-match' : ''}`}>
            {before && (
              <Plate caption="Today" value={valueOf(spec, 'before') ?? p.before} contrast={spec.kind === 'color' ? { hex: spec.before, look: colorLook(p.title).look } : null}>
                <Sample spec={spec} side="before" size="card" title={p.title} />
              </Plate>
            )}
            <Plate caption={p.match ? 'Asked for' : afterCaption(isNew(p), spec, 'With this change')} value={valueOf(spec, 'after') ?? p.after} contrast={spec.kind === 'color' ? { hex: spec.after, look: colorLook(p.title).look } : null}>
              <Sample spec={spec} side="after" size="card" title={p.title} />
            </Plate>
            {p.match && (
              <Plate caption="Already in the library" value={p.match.label} tone="match">
                <span className="lr-plate-name">{p.match.label}</span>
              </Plate>
            )}
          </div>
          {p.match && (
            <p className="lr-match">
              <span className="lr-match-tag">Match found</span>
              <span>{p.match.label} is almost the same and already in the library.</span>
            </p>
          )}
          {p.exception && <p className="lr-muted">{p.exception}.</p>}
          {decides ? (
            <div className="lr-decide">
              <div className="lr-actions">
                {p.match ? (
                  <>
                    <Button variant="primary" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'existing' })} data-demo-write="decide library pieces">
                      Use {p.match.label}
                    </Button>
                    <Button variant="secondary" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'add' })} data-demo-write="decide library pieces">
                      Add as a new {tokenGroup(p.category)?.word ?? 'piece'}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'add' })} data-demo-write="decide library pieces">
                    Add to the library
                  </Button>
                )}
                {p.asked && (
                  <Button variant="secondary" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'keep' })} data-demo-write="decide library pieces">
                    {keepLabel(p)}
                  </Button>
                )}
                {comment}
              </div>
              {p.match && p.asked?.designer && (
                <p className="lr-muted lr-shared">
                  {p.asked.designer} is told on the exploration and can disagree there: "Reply to {viewer.name ?? 'you'}" puts the piece back here with the reason. You still decide.
                </p>
              )}
              {commentBox}
            </div>
          ) : (
            <div className="lr-decide">
              {wait && <p className="lr-muted">{wait}.</p>}
              <div className="lr-actions">{comment}</div>
              {commentBox}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/**
 * One option of a conflict, on one row: its colour key, the person (the library's mark for today), the value and its
 * word, where it is used. Every row has the same anatomy, so the columns line up whatever the row.
 */
function OptionRow({ o, mark }: { o: CompareOption; mark: MarkOf }) {
  return (
    <span className="lr-opt-row">
      <span className={`lr-key is-hue-${o.hue ?? 'both'}`} aria-hidden="true" />
      <span className="lr-opt-who">
        {o.who ? (
          <NameFace name={o.who} size="xs" />
        ) : (
          <span className="lr-opt-lib" aria-hidden="true">
            <Icon icon={BookOpen} size="xs" />
          </span>
        )}
        <strong>{o.name}</strong>
      </span>
      <span className="lr-opt-val">
        {o.valueText && <strong>{o.valueText}</strong>}
        {o.words && <span>{o.words}</span>}
      </span>
      <span className="lr-opt-where">
        {'text' in o.where ? (
          o.where.text
        ) : (
          <>
            <ProductIcon product={o.where.product} />
            {o.where.exploration}
          </>
        )}
      </span>
    </span>
  );
}

/**
 * What the stage draws: the library's own Card (DS Card and CardBody), its room inside set to one option's value.
 * Without a value, the Card as the library renders it today.
 */
function Specimen({ component, value, bodyRef }: { component: string; value: number | null; bodyRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <Card className="lr-specimen">
      <CardBody ref={bodyRef} className="lr-specimen-in" style={value === null ? undefined : { padding: `${value}px` }}>
        <strong className="lr-specimen-title">{component} title on two lines</strong>
        <span className="lr-specimen-mid">
          <strong>$7.5K</strong>
          <Avatar name="Ada Lovelace" size="sm" decorative />
        </span>
        <span className="lr-specimen-foot">
          <Tag>Tag</Tag>
          <Tag>29 d</Tag>
        </span>
      </CardBody>
    </Card>
  );
}

/**
 * Today's room inside of the library's Card when the check recorded none: the DS Card as it renders here, measured
 * (its body's padding), so today's value comes from the library itself, never a number written in the page.
 */
function useLibraryInset(on: boolean): [number | null, ReactNode] {
  const [inset, setInset] = useState<number | null>(null);
  const probe = on ? (
    <span className="lr-probe" aria-hidden="true">
      <Specimen
        component="Card"
        value={null}
        bodyRef={(el) => {
          if (!el) return;
          const n = Number.parseFloat(getComputedStyle(el).paddingTop);
          if (Number.isFinite(n) && n !== inset) setInset(n);
        }}
      />
    </span>
  ) : null;
  return [on ? inset : null, probe];
}

/**
 * The compare stage (direction D2, owner 2026-11-12): what the checked rows look like, one look per value. Side by side
 * draws one Card per look, each with its room inside; Overlay draws one Card at 150% with each look's content box
 * outlined in its colour. Each look's label sits under its Card, its colour key first, on the Card's start edge.
 */
function Stage({ view, mode, checked, component }: { view: CompareView; mode: 'overlay' | 'side'; checked: readonly string[]; component: string }) {
  const looks = checkedLooks(view, checked);
  if (!looks.length)
    return (
      <div className="lr-stage is-empty">
        <p className="lr-stage-empty">Check a way below to see it here.</p>
      </div>
    );
  const label = (l: (typeof looks)[number]) => (
    <>
      <span className={`lr-key is-hue-${l.hue}`} aria-hidden="true" />
      {/* Whose look, then its value, said once each ("Sofia 24 px", "Today 20 px", "Leo 12 px (Compact)"). */}
      <span>
        {l.who} <strong>{l.value} px</strong>
        {l.option && <span className="lr-stage-option"> ({l.option})</span>}
      </span>
    </>
  );
  if (mode === 'side')
    return (
      <div className="lr-stage is-side">
        {looks.map((l) => (
          <figure key={l.label} className="lr-stage-way">
            <Specimen component={component} value={l.value} />
            <figcaption className="lr-stage-cap">{label(l)}</figcaption>
          </figure>
        ))}
      </div>
    );
  // The Card drawn at the roomiest look: every other content box is wider and stays outside the content.
  const base = Math.max(...looks.map((l) => l.value));
  return (
    <div className="lr-stage">
      <figure className="lr-stage-way">
        <div className="lr-stage-art" style={{ ['--lr-scale' as string]: STAGE_SCALE }}>
          <span className="lr-stage-card">
            <Specimen component={component} value={base} />
            {looks.map((l) => (
              <span key={l.label} className={`lr-ol is-hue-${l.hue}`} style={{ inset: `${l.value}px` }} aria-hidden="true" />
            ))}
          </span>
        </div>
        <figcaption className="lr-stage-keys">
          {/* A class keeps the global prose list spacing (li + li) off: the labels share one centre line. */}
          <ul className="lr-stage-key-list" aria-label="The content box of each way">
            {looks.map((l) => (
              <li key={l.label} className="lr-stage-cap">
                {label(l)}
              </li>
            ))}
          </ul>
          <span className="lr-stage-note">Shown at 150%</span>
        </figcaption>
      </figure>
    </div>
  );
}

/**
 * A conflict in One by one (direction D2, rows as checkboxes since 2026-11-12): the title with its ways tag, the part
 * that differs said once, the compare stage, then one checkbox per row (today and each way) that drives the stage, the
 * outcome in one sentence and one footer: who is told, "Comment to both", one primary that names the outcome. Checking
 * two or more values keeps them as sizes; the pick recorded is one the exploration page reads (checkedPick).
 */
function Compare({ p, decides, busy, onAct, wait, mark, commenting, onCommentOpen, commentBox, tag }: { p: ReviewPiece; decides: boolean; busy: boolean; onAct: (p: ReviewPiece, a: Act) => void; wait: string | null; mark: MarkOf; commenting: boolean; onCommentOpen: () => void; commentBox: ReactNode; tag: ReactNode }) {
  const c = p.conflict!;
  const [inset, probe] = useLibraryInset(c.component === 'Card' && /^padding/i.test(c.property) && (c.today === null || c.today === undefined));
  const view = compareView(p, 'Every screen', inset)!;
  const [mode, setMode] = useState<'overlay' | 'side'>(view.overlay ? 'overlay' : 'side');
  // Null until the lead ticks a row: the start follows today's value once the library is measured.
  const [ticked, setTicked] = useState<string[] | null>(null);
  const checked = ticked ?? (c.pick ? checkedOfPick(c.pick, view) : defaultChecked(view));
  const toggle = (key: string, on: boolean) => setTicked(on ? [...checked.filter((k) => k !== key), key] : checked.filter((k) => k !== key));
  const open = decides && !c.pick;
  const pick = checkedPick(view, checked);
  const outcome = checkedOutcome(view, checked);
  const rows = [view.today, ...view.ways];
  return (
    <article className="lr-detail lr-compare" aria-labelledby="lr-detail-title">
      <div className="lr-detail-head">
        <div className="lr-title-line">
          <h2 className="lr-detail-title" id="lr-detail-title">
            {p.title}
          </h2>
          {!c.pick && (
            <Badge tone={pieceWaitTone(p)} size="md" className={statusTagClass(pieceWaitTone(p))}>
              {waysTag(c.ways.length)}
            </Badge>
          )}
          {tag}
          <LibraryPageLink p={p} title />
        </div>
        {view.overlay && (
          <SegmentedControl
            size="sm"
            label="How the ways are shown"
            value={mode}
            onValueChange={(v) => setMode(v === 'side' ? 'side' : 'overlay')}
            items={[
              { value: 'side', label: 'Side by side' },
              { value: 'overlay', label: 'Overlay' },
            ]}
          />
        )}
      </div>
      <p className="lr-compare-what">
        <strong>{view.part}</strong> differs.
      </p>
      <Stage view={view} mode={mode} checked={checked} component={c.component} />
      {probe}
      <div className="lr-opts" role="group" aria-label={open ? 'What the library keeps' : 'Ways to look at'}>
        {rows.map((o) => (
          <Checkbox key={o.key} value={o.key} className="lr-opt" checked={checked.includes(o.key)} onCheckedChange={(on) => toggle(o.key, on)} label={<OptionRow o={o} mark={mark} />} />
        ))}
      </div>
      {open && (
        <p className={`lr-compare-outcome${outcome ? '' : ' is-none'}`} aria-live="polite">
          {outcome ? `${outcome}.` : 'Check at least one row to decide.'}
        </p>
      )}
      <div className="lr-compare-foot">
        <span className="lr-compare-told">
          {open ? <People names={view.people} size="sm" face={nameFaceOf} text={view.told} /> : wait && `${wait}.`}
        </span>
        {/* The two actions stay together on one line: when the footer wraps, they move under who is told as a pair,
            never the comment above the primary. */}
        {(!commenting || open) && (
          <span className="lr-compare-acts">
            {!commenting && (
              <Button variant="secondary" size="lg" onClick={onCommentOpen}>
                {view.people.length === 2 ? 'Comment to both' : view.people.length > 2 ? 'Comment to all' : 'Comment'}
              </Button>
            )}
            {open && (
              <Button variant="primary" size="lg" disabled={busy || pick === null} onClick={() => pick && onAct(p, { kind: 'pick', way: pick })} data-demo-write="decide library pieces">
                {checkedKeepLabel(view, checked)}
              </Button>
            )}
          </span>
        )}
      </div>
      {commentBox}
    </article>
  );
}

/**
 * The side list scrolls on its own and its end is always on screen: its height runs from where it starts (under the
 * filters, then under the top bar once sticky) to the window's bottom. Wide screens only; on a phone it is a drawer.
 */
function useSideFitsScreen() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const wide = window.matchMedia('(min-width: 761px)');
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!wide.matches) return el.style.removeProperty('--lr-side-max');
        const stuck = parseFloat(getComputedStyle(el).top) || 0;
        const top = Math.max(el.getBoundingClientRect().top, stuck);
        el.style.setProperty('--lr-side-max', `${Math.max(240, window.innerHeight - top - 16)}px`);
      });
    };
    fit();
    window.addEventListener('scroll', fit, { passive: true });
    window.addEventListener('resize', fit);
    wide.addEventListener('change', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      wide.removeEventListener('change', fit);
    };
  }, []);
  return ref;
}

function OneByOne({ groups, all, current, seen, onPick, detail, mark }: { groups: ReturnType<typeof joinSmallGroups>; all: ReviewPiece[]; current: string | null; seen: Set<string>; onPick: (k: string) => void; detail: ReactNode; mark: MarkOf }) {
  const seenN = all.filter((p) => seen.has(p.key)).length;
  // The pieces the filters show, so the count follows the active filter.
  const progress = reviewProgress(all.length, seenN, all.filter((p) => p.state === 'decided').length);
  // On a phone: a compact "1 of 12" bar with previous and next above the piece, the list behind "All pieces".
  const [listOpen, setListOpen] = useState(false);
  const sideRef = useSideFitsScreen();
  const at = all.findIndex((p) => p.key === current);
  const go = (step: number) => {
    const n = all[at + step];
    if (n) onPick(n.key);
  };
  // The state of a row, as a small mark on its end: a conflict's ways, a match, or a result. Seen pieces get no mark: the seen count above says it once.
  const stateMark = (p: ReviewPiece) => {
    if (p.conflict && !p.conflict.pick)
      return (
        <Badge tone={pieceWaitTone(p)} size="sm" className={statusTagClass(pieceWaitTone(p))}>
          {waysTag(p.conflict.ways.length)}
        </Badge>
      );
    if (p.match && p.state === 'waiting') return <span className="lr-side-flag">Match found</span>;
    const d = decidedTag(p);
    if (d) return <span className="lr-muted lr-side-flag">{d.label}</span>;
    return null;
  };
  return (
    <div className="lr-one">
      <div className="lr-compact">
        <Pagination variant="compact" size="md" noun="Piece" aria-label="Pieces, one by one" pageCount={all.length} page={at + 1} onPageChange={(n) => go(n - 1 - at)} />
        <Button variant="ghost" size="md" className="lr-compact-all" aria-expanded={listOpen} aria-controls="lr-side" onClick={() => setListOpen((o) => !o)}>
          {listOpen ? 'Hide pieces' : 'All pieces'}
        </Button>
      </div>
      <nav ref={sideRef} className={`lr-side${listOpen ? ' is-open' : ''}`} id="lr-side" aria-label="Pieces">
        <div className="lr-side-head">
          <p className="lr-seen">
            <strong>{progress.headline}</strong>
            {progress.seenNote && <span className="lr-muted">{progress.seenNote}</span>}
          </p>
          <Progress value={progress.value} size="sm" tone={progress.done ? 'success' : 'signal'} aria-label={progress.headline} />
        </div>
        {chaptersOf(groups).map((ch) => (
          <section key={ch.key} className="lr-side-chapter" aria-label={ch.label}>
            {/* The outline under the page's h1: an h2 per family, an h3 per group, no level skipped (WCAG 1.3.1). */}
            <h2 className="lr-side-fam">
              {ch.icon && <FamilyIcon name={ch.icon} size="sm" />}
              <span className="lr-side-fam-name">{ch.label}</span>
              <Count n={ch.groups.reduce((n, g) => n + g.pieces.length, 0)} />
            </h2>
            {ch.groups.map((g) => {
              const label = ch.rail ? sideLabel(railLabel(g, ch), g.pieces) : null;
              return (
                <div key={g.key} className="lr-side-group">
                  {label && (
                    <h3 className="lr-side-label">
                      {label}{' '}
                      <Count n={g.pieces.length} />
                    </h3>
                  )}
                  <ul className="lr-side-list" aria-label={g.label}>
                    {g.pieces.map((p) => (
                      <li key={p.key}>
                        {/* bridge-audit-ignore-next-line: the whole piece row (title, who asked, its state) is one target that shows the piece, like the review queue rows; the DS has no row button and Button would cut it to one label */}
                        <button type="button" className="lr-side-row" aria-current={current === p.key ? 'true' : undefined} onClick={() => (onPick(p.key), setListOpen(false))}>
                          <span className="lr-side-main">
                            <span className="lr-side-title">{p.title}</span>
                            <span className="lr-muted lr-side-sub">
                              <AskedLine p={p} />
                            </span>
                          </span>
                          {stateMark(p)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="lr-main">{detail}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// List

/** Every exploration that asked, as the "+N more" popover and the detail's full list: by product, a face per row. */
function AskersList({ list }: { list: AskedBy[] }) {
  return (
    <div className="lr-askers">
      {groupAskers(list).map((g) => (
        <section key={g.product} className="lr-askers-group" aria-label={g.product}>
          <h3 className="lr-askers-product">{g.product}</h3>
          <ul className="lr-askers-list">
            {g.askers.map((a) => (
              <li key={a.key} className="lr-askers-row">
                <NameFace name={faceName(a)} size="xs" />
                {a.href ? (
                  <Link href={a.href} className="lr-askers-name">
                    {a.name}
                  </Link>
                ) : (
                  <span className="lr-askers-name">{a.name}</span>
                )}
                {a.designer && <span className="lr-muted lr-askers-by">{a.designer}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "+N explorations" after a name ("+N" after a person): a compact tag, and the same in words to a screen reader. */
function MoreTag({ n, what }: { n: number; what: 'explorations' | 'people' }) {
  const t = moreTag(n, what);
  const label = what === 'people' ? `${n} more ${n === 1 ? 'person' : 'people'}` : t.label;
  return (
    <>
      <Badge tone="neutral" size="sm" className="lr-more-tag" aria-hidden="true">
        {t.tag}
      </Badge>
      <VisuallyHidden>{`, ${label}`}</VisuallyHidden>
    </>
  );
}

/**
 * The List's Asked by cell (owner, 2026-11-12, one kind of info per column, the same anatomy on every row): the face
 * and first name of everyone who asked, as every group of people in Studio (People.tsx, lib/people-line): up to three,
 * every face and name ("Sofia and Leo", never one face and "+1"); four or more, two and "+N". The names wrap on two
 * lines before anyone is hidden. Never an exploration, never a product: those are the From column's.
 */
function AskedByCell({ p }: { p: ReviewPiece }) {
  return <People names={askedColumns(p).people} size="sm" face={nameFaceOf} className="lr-asked" />;
}

/**
 * The List's From cell: the exploration it came from on one line (its full name on hover when the column is narrow),
 * its products by name under it in muted text, then "+N explorations" that opens every exploration grouped by product. A piece no
 * exploration asked for says "Asked directly", in the same place, in muted text.
 */
function FromCell({ p }: { p: ReviewPiece }) {
  const { from } = askedColumns(p);
  if (from.kind === 'direct')
    return (
      <span className="lr-from">
        <span className="lr-from-line">
          <span className="lr-from-name lr-muted">{ASKED_DIRECTLY}</span>
        </span>
      </span>
    );
  const a = from.first;
  return (
    <span className="lr-from">
      <span className="lr-from-line">
        {a.href ? (
          <Link href={a.href} variant="subtle" className="lr-from-name" title={a.name}>
            {a.name}
          </Link>
        ) : (
          <span className="lr-from-name" title={a.name}>
            {a.name}
          </span>
        )}
        {from.more > 0 && (
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="lr-from-more" aria-label={`${moreTag(from.more).label} asked for ${p.title}`} />}>
              <Badge tone="neutral" size="sm" className="lr-more-tag">
                {moreTag(from.more).tag}
              </Badge>
            </PopoverTrigger>
            <PopoverContent title={`${from.all.length} explorations asked for it`} align="start" className="lr-askers-pop">
              <AskersList list={from.all} />
            </PopoverContent>
          </Popover>
        )}
      </span>
      {from.product && <span className="lr-muted lr-from-product">{from.product}</span>}
    </span>
  );
}

/** A piece's own address: One by one on it. */
const pieceHref = (key: string) => (typeof location === 'undefined' ? `?piece=${encodeURIComponent(key)}` : pieceSearch(location.search, key));

/**
 * The list as chapters (lr-list, direction C; lr-yours, lr-decided, lr-designer): one chapter per family (Foundations,
 * Components, Docs) with its icon, name, count, one line and what it reaches, then one card where each group's name
 * sits in a left rail beside its rows (lib/library-review-list chaptersOf). The column header is inside the card, on
 * the row grid, in sentence case:
 *   Waiting, lead:  [box] | Today › After | Piece | Asked by | From | Who gets it | State | Next | action
 *   Decided:        Today › After | Piece | Asked by | From | Who gets it | State (the result)
 *   Designer:       Today › After | Piece | Asked by | From | Who gets it | State (what changed, an exception)
 * Asked by is a face and a first name, From the exploration on one line with its product under it ("Asked directly"
 * when none): one kind of info per column, the same anatomy on every row (lib/library-askers askedColumns). Each card
 * has its own grid (lib/library-review-list listGrid); when the card runs out of room, Who gets it folds first, then
 * Today › After (styles/library-review.css).
 * The Piece column says only what the piece is: its name (a link to it in One by one, and a quiet link to its page in
 * the library) and its kind. A state (a conflict's "2 ways", a result) sits in State; a waiting row shows none there,
 * its chapter already says it waits. A column shows only when a row fills it. Checkboxes and the row action (a quiet
 * Decide) show on row hover or keyboard focus, and stay once something is selected; always on touch screens.
 * `bare`: one piece's row alone (the Map's single-piece focus), no chapter, no rail, no column header.
 */
function ListView({ groups, thumbs, viewer, tech, secondLead, decided, selected, onSelect, onAsk, onOpen, reach, measure, onReach, mark, readOnly = false, bare = false }: { groups: ReturnType<typeof joinSmallGroups>; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; tech: string | null; secondLead: string | null; decided: boolean; selected: Set<string>; onSelect: (keys: string[], on: boolean) => void; onAsk: (p: ReviewPiece) => void; onOpen: (p: ReviewPiece) => void; reach: (p: ReviewPiece) => Reach; measure: (p: ReviewPiece) => Measured; onReach: (p: ReviewPiece) => void; mark: MarkOf; readOnly?: boolean; bare?: boolean }) {
  const mode = !viewer.reviews ? 'designer' : decided ? 'decided' : 'lead';
  // The Map's list is read only: no checkbox, no decision (lr-map).
  const pickableOf = (list: readonly ReviewPiece[]) => (readOnly ? [] : list.filter((p) => batchable(p, viewer)));
  const allRows = groups.flatMap((g) => g.pieces);
  const boxes = mode === 'lead' && !readOnly && pickableOf(allRows).length > 0;
  const pair = (p: ReviewPiece) => {
    const spec = thumbOf(p, thumbs);
    // Something new has no before: the after side alone, never the word "none" (lib/new-piece-preview).
    const before = showsBefore(isNew(p), spec);
    return (
      <span role="cell" className="lr-col-thumb lr-pair" aria-hidden="true">
        {before && (
          <>
            <span className="lr-mini">
              <Sample spec={spec} side="before" size="row" title={p.title} />
            </span>
            <Icon icon={ArrowRight} size="xs" className="lr-arrow" />
          </>
        )}
        <span className="lr-mini">
          <Sample spec={spec} side="after" size="row" title={p.title} />
        </span>
      </span>
    );
  };
  // The State column: a conflict's ways, a result, the viewer's own approval, an exception. A waiting row: nothing.
  const state = (p: ReviewPiece) => {
    const d = decidedTag(p);
    if (d)
      return (
        <Badge tone={d.tone} size="md" className={statusTagClass(d.tone)}>
          {d.label}
        </Badge>
      );
    if (p.conflict && !p.conflict.pick)
      return (
        <Badge tone={pieceWaitTone(p)} size="md" className={statusTagClass(pieceWaitTone(p))}>
          {waysTag(p.conflict.ways.length)}
        </Badge>
      );
    if (p.mine && p.designApproved)
      return (
        <Badge tone="success" size="md" className={statusTagClass('success')}>
          You approved
        </Badge>
      );
    if (p.exception)
      return mode === 'designer' ? (
        <span className="lr-muted">{p.exception}</span>
      ) : (
        <Badge tone="neutral" size="md">
          {p.exception}
        </Badge>
      );
    return null;
  };
  const action = (p: ReviewPiece) => {
    if (readOnly) return null;
    if (canDecide(p, viewer))
      return (
        <Button variant="secondary" size="sm" className="lr-row-act" onClick={() => onOpen(p)} aria-label={`${p.conflict ? 'Compare' : 'Decide'} ${p.title}`}>
          {p.conflict ? 'Compare' : 'Decide'}
        </Button>
      );
    if (p.mine && p.state === 'waiting' && p.source.kind === 'change')
      return (
        <Menu>
          <MenuTrigger render={<IconButton icon={Ellipsis} label={`More actions on ${p.title}`} variant="ghost" size="sm" className="lr-row-act" />} />
          <MenuContent align="end">
            <MenuItem onClick={() => onAsk(p)} data-demo-write="ask someone else to review">
              Ask someone else
            </MenuItem>
          </MenuContent>
        </Menu>
      );
    return null;
  };
  // A column shows only when a row of its card fills it (no empty State, Next or action column): each chapter card has
  // its own header row, so a State column one chapter needs never leaves an empty one in the others.
  const colsOf = (rows: readonly ReviewPiece[]) => {
    const cols = shownColumns({
      state: rows.some((p) => state(p) !== null),
      next: mode === 'lead' && rows.some((p) => nextActor(p, { tech, secondLead }) !== null),
      action: mode !== 'designer' && rows.some((p) => action(p) !== null),
    });
    const showState = cols.includes('state');
    const grid = listGrid({
      box: boxes,
      askedMore: rows.some((p) => askedColumns(p).morePeople > 0),
      state: !showState ? 'none' : rows.every((p) => !decidedTag(p) && !p.exception && !(p.mine && p.designApproved)) ? 'tag' : 'words',
      next: cols.includes('next'),
      action: cols.includes('action'),
    });
    const style = { ['--lr-cols-wide' as string]: grid.wide, ['--lr-cols-mid' as string]: grid.mid, ['--lr-cols-narrow' as string]: grid.narrow };
    return { showState, showNext: cols.includes('next'), showAction: cols.includes('action'), style };
  };
  type Cols = ReturnType<typeof colsOf>;
  const row = (p: ReviewPiece, { showState, showNext, showAction }: Cols) => {
    const actor = mode === 'lead' ? nextActor(p, { tech, secondLead }) : null;
    const m = measure(p);
    const c = reachCell(m);
    return (
      <div role="row" key={p.key} className={`lr-row${selected.has(p.key) ? ' is-selected' : ''}`}>
        {boxes && (
          <span role="cell" className="lr-col-box lr-hover-ctl">
            {batchable(p, viewer) ? (
              <Checkbox label={<VisuallyHidden>{`Select ${p.title}`}</VisuallyHidden>} checked={selected.has(p.key)} onCheckedChange={(v) => onSelect([p.key], v)} />
            ) : (
              // A piece the lead decides alone (a conflict picks a way, a removal needs its own answer): the box shows,
              // off, and says why, so the row never looks like it lost its checkbox.
              canDecide(p, viewer) && (
                <Tooltip content={p.conflict ? 'Pick a way first: Compare' : 'Decided on its own'}>
                  <span className="lr-box-off">
                    <Checkbox disabled label={<VisuallyHidden>{p.conflict ? `${p.title}: pick a way first` : `${p.title}: decided on its own`}</VisuallyHidden>} checked={false} />
                  </span>
                </Tooltip>
              )
            )}
          </span>
        )}
        {pair(p)}
        <span role="cell" className="lr-row-piece">
          <span className="lr-row-head">
            {viewer.reviews ? (
              <Link
                href={pieceHref(p.key)}
                variant="subtle"
                className="lr-row-title"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(p);
                }}
              >
                {p.title}
              </Link>
            ) : (
              <span className="lr-row-title">{p.title}</span>
            )}
            <LibraryPageLink p={p} />
          </span>
          <span className="lr-muted lr-row-kind">{p.kind}</span>
        </span>
        <span role="cell" className="lr-row-ask">
          <AskedByCell p={p} />
        </span>
        <span role="cell" className="lr-row-from">
          <FromCell p={p} />
        </span>
        <span role="cell" className="lr-row-reach lr-col-reach">
          <ReachLink p={p} cell={c.label} onReach={onReach} quiet hoverOnly={c.hoverOnly} />
        </span>
        {showState && (
          <span role="cell" className="lr-row-state">
            {state(p)}
          </span>
        )}
        {showNext && (
          <span role="cell" className="lr-row-next">
            {actor && (
              <span className="lr-who">
                <NameFace name={actor.name} size="xs" />
                <span>{actor.label}</span>
              </span>
            )}
          </span>
        )}
        {showAction && (
          <span role="cell" className="lr-col-end lr-row-end lr-hover-ctl">
            {action(p)}
          </span>
        )}
      </div>
    );
  };
  if (bare) {
    const c = colsOf(allRows);
    return (
      <div className={`lr-list is-${mode} is-bare${readOnly ? ' is-read' : ''}`} role="table" aria-label="Library piece">
        <div role="rowgroup" className="lr-bare" style={c.style}>
          {allRows.map((p) => row(p, c))}
        </div>
      </div>
    );
  }
  const chapters = chaptersOf(groups);
  // The group rail of a chapter, when a group has a name to show: a chapter whose one group is its one piece ("Button"
  // over "Button: loading text...") left an empty Group cell under its header (Malik, 2026-11-12).
  const railOf = (ch: (typeof chapters)[number]) => {
    const labels = new Map(ch.groups.map((g) => [g.key, ch.rail ? sideLabel(railLabel(g, ch), g.pieces) : null]));
    return { labels, rail: Boolean(ch.rail) && [...labels.values()].some(Boolean) };
  };
  // A list with a rail folds its columns sooner (styles/library-review.css, has-rails): the same columns in every card.
  const rails = chapters.some((ch) => railOf(ch).rail);
  return (
    <div className={`lr-list is-${mode}${rails ? ' has-rails' : ''}${selected.size ? ' has-selection' : ''}${readOnly ? ' is-read' : ''}`} role="table" aria-label="Library pieces">
      {chapters.map((ch) => {
        const rows = ch.groups.flatMap((g) => g.pieces);
        const cr = chapterReach(rows.map((p) => ({ reach: reach(p), measured: measure(p) })));
        const pickable = boxes ? pickableOf(rows) : [];
        const allOn = pickable.length > 0 && pickable.every((p) => selected.has(p.key));
        const someOn = pickable.some((p) => selected.has(p.key));
        const { labels, rail } = railOf(ch);
        const c = colsOf(rows);
        const { showState, showNext, showAction } = c;
        return (
          // A chapter is a plain wrapper: ARIA has no group of row groups, so its head row (with its h2) and each
          // group's rowgroup sit straight in the table (WCAG 1.3.1).
          <div key={ch.key} className={`lr-chapter${rail ? ' has-rail' : ''}`}>
            <div role="row" className="lr-chapter-head">
              <span role="cell" className="lr-chapter-title">
                {ch.icon && <FamilyIcon name={ch.icon} />}
                <span className="lr-chapter-text">
                  <span className="lr-chapter-line">
                    <h2 className="lr-chapter-name">{ch.label}</h2>
                    <Count n={rows.length} />
                  </span>
                  {ch.note && <span className="lr-chapter-note">{ch.note}</span>}
                </span>
              </span>
              <span role="cell" className="lr-chapter-reach">
                {cr.names ? (
                  <>
                    <span>Reaches</span>
                    <ProductIcon product={cr.products.map((x) => x.name).join(', ')} />
                    <span className="lr-chapter-names">{cr.names}</span>
                  </>
                ) : (
                  'Not on a screen yet'
                )}
              </span>
            </div>
            <div className="lr-chapter-card" style={c.style}>
              <div role="row" className="lr-chapter-cols">
                {rail && (
                  <span role="columnheader" className="lr-rail-head">
                    Group
                  </span>
                )}
                {boxes && (
                  <span role="columnheader" className="lr-col-box lr-hover-ctl">
                    {pickable.length > 0 && <Checkbox label={<VisuallyHidden>{`Select every piece of ${ch.label} you can decide`}</VisuallyHidden>} checked={allOn} indeterminate={!allOn && someOn} onCheckedChange={(on) => onSelect(pickable.map((p) => p.key), on)} />}
                  </span>
                )}
                <span role="columnheader" className="lr-col-thumb">
                  Today › After
                </span>
                <span role="columnheader">Piece</span>
                <span role="columnheader">Asked by</span>
                <span role="columnheader">From</span>
                <span role="columnheader" className="lr-col-reach">
                  Who gets it
                </span>
                {showState && <span role="columnheader">State</span>}
                {showNext && <span role="columnheader">Next</span>}
                {showAction && (
                  <span role="columnheader" className="lr-col-end">
                    <VisuallyHidden>Action</VisuallyHidden>
                  </span>
                )}
              </div>
              {ch.groups.map((g) => {
                const inGroup = boxes ? pickableOf(g.pieces) : [];
                const on = inGroup.length > 0 && inGroup.every((p) => selected.has(p.key));
                const some = inGroup.some((p) => selected.has(p.key));
                const label = labels.get(g.key) ?? null;
                return (
                  <div key={g.key} role="rowgroup" className="lr-list-group" aria-label={g.label}>
                    {rail && (
                      <div role="row" className="lr-group-row">
                        {boxes && (
                          <span role="cell" className="lr-col-box lr-hover-ctl">
                            {inGroup.length > 0 && <Checkbox label={<VisuallyHidden>{`Select ${g.label}`}</VisuallyHidden>} checked={on} indeterminate={!on && some} onCheckedChange={(v) => onSelect(inGroup.map((p) => p.key), v)} />}
                          </span>
                        )}
                        <span role="cell" className="lr-group-label">
                          {label && (
                            <>
                              <span className="lr-group-name">{label}</span>
                              <Count n={g.pieces.length} />
                            </>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="lr-block">{g.pieces.map((p) => row(p, c))}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function SelectionBar({ pieces, busy, onKeep, onAdd, onClear }: { pieces: ReviewPiece[]; busy: boolean; onKeep: () => void; onAdd: () => void; onClear: () => void }) {
  const s = selectionLine(pieces);
  const keepable = pieces.every((p) => p.asked);
  return (
    <div className="cg-bar lr-bar" role="region" aria-label="Selected pieces">
      <p className="cg-bar-text">
        <span className="cg-bar-title">{s.what}</span>
        <span>{s.touches}</span>
        {!keepable && <span>{keepMissing(pieces)}</span>}
      </p>
      <div className="cg-bar-actions">
        <Button variant="ghost" size="md" onClick={onClear}>
          Clear
        </Button>
        {keepable && (
          <Button variant="secondary" size="md" disabled={busy} onClick={onKeep} data-demo-write="decide library pieces">
            {keepLabel(pieces)}
          </Button>
        )}
        <Button variant="primary" size="md" disabled={busy} onClick={onAdd} data-demo-write="decide library pieces">
          Add {pieces.length === 1 ? 'it' : `all ${pieces.length}`}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The page

const setAddress = (search: string) => {
  const url = new URL(location.href);
  url.search = search;
  history.replaceState(history.state, '', url);
};

/** The address of a piece's Who gets it page: this page with ?reach=<piece>. */
const reachHref = (key: string) => {
  if (typeof location === 'undefined') return `?reach=${encodeURIComponent(key)}`;
  const q = new URLSearchParams(location.search);
  q.set('reach', key);
  return `?${q.toString()}`;
};

const readReach = () => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('reach'));

/** Where the Map can be read: not on a phone (it falls back to List there). */
const NARROW = '(max-width: 760px)';

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

export interface LibraryReviewProps {
  /** Reads the page's data (scripts/library-review-data.ts loadLibraryReview), painting as it goes. */
  load: (paint: (d: ReviewData) => void) => Promise<void>;
  /** Sends one decision; resolves with the line to say. */
  send: (p: ReviewPiece, a: Act) => Promise<string>;
  comment: (p: ReviewPiece, text: string) => Promise<string>;
  /** "Ask someone else" on the viewer's own change. */
  ask: (p: ReviewPiece) => Promise<string>;
  /** The visitor explores the sample team: writes open the sample-team dialog instead. */
  demo: () => boolean;
  openDemo: () => void;
  /** Where "Open Explorations" and "How library review works" go. */
  links: { explorations: string; howItWorks: string };
  /** Leaves for another Studio page (an old address of the review queue that belongs elsewhere). */
  go?: (studioPath: string) => void;
  /** Opens a suggestion's own review in `el` (an old ?suggestion= address no library change carries). */
  openSuggestion?: (n: number, el: HTMLElement) => void;
}

export function LibraryReviewView({ load, send, comment, ask, demo, openDemo, links, go = (path) => location.replace(studioHref(path)), openSuggestion }: LibraryReviewProps) {
  const [data, setData] = useState<ReviewData | null>(null);
  const narrow = useNarrowScreen();
  // An old address (the review queue's ?pr= and ?item=, the Library group's ?suggestion=, ?origin=, ?group=): read
  // once, then taken off the address (lib/library-review-links).
  const legacy = useRef(typeof location === 'undefined' ? null : readLegacy(location.search));
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const suggestionEl = useRef<HTMLDivElement | null>(null);
  // Who gets it (?reach=<piece>): a page of its own over the review, with the browser's Back.
  const [reachKey, setReachKey] = useState<string | null>(() => readReach());
  useEffect(() => {
    const onPop = () => setReachKey(readReach());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const l = legacy.current;
    if (!l) return;
    const target = itemTarget(l.item);
    if (target !== null) go(target);
  }, []);
  const reviews = data?.viewer.reviews ?? false;
  const [params, setParams] = useState<{ filters: ReviewFilters; view: ReviewView } | null>(null);
  // A piece's own address (?piece=<key>, a row's name in the List) opens it in One by one.
  const [current, setCurrent] = useState<string | null>(() => (typeof location === 'undefined' ? null : readPiece(location.search)));
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<Map<string, ReviewPiece['decided']>>(new Map());
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef(new Map<string, number>());
  const [actions, setActions] = useState<Element | null>(null);

  useEffect(() => {
    void load(setData);
    setActions(document.querySelector(ACTIONS_SELECTOR));
  }, [load]);

  // The filters follow the viewer: a designer opens on her own pieces once the page knows who she is.
  useEffect(() => {
    if (data && !params) setParams(reviewParams(withoutLegacy(location.search), { reviews: data.viewer.reviews }));
  }, [data, params]);

  // An old address lands once every piece is read: it selects its piece or filter instead of the default view.
  useEffect(() => {
    const l = legacy.current;
    if (!data || data.loading || !params || !l) return;
    legacy.current = null;
    if (!hasLegacy(l)) return;
    const to = landing(l, data.pieces, { reviews: data.viewer.reviews });
    if (to.redirect !== null) return void go(to.redirect);
    const f = { ...params.filters, ...to.filters };
    const v = to.view ?? params.view;
    setParams({ filters: f, view: v });
    if (to.current) setCurrent(to.current);
    if (to.suggestion) setSuggestion(to.suggestion);
    setAddress(withReviewParams(withoutLegacy(location.search), f, v, { reviews: data.viewer.reviews }));
  }, [data, params]);

  useEffect(() => {
    if (suggestion && suggestionEl.current && openSuggestion) openSuggestion(suggestion, suggestionEl.current);
  }, [suggestion]);

  // The summary under the title: for whoever decides, the count in words once the statuses are read ("12 wait for
  // you: 5 foundations, 5 components and 2 docs."); otherwise who decides here.
  // Waiting (the default): the library decisions only, said so, one count with the list and the badge (lib/library-queue):
  // "12 library decisions wait for you, as design system owner." and where design reviews are. Decided: the tally.
  const tallyText = useMemo(() => {
    if (!data || data.loading || data.failed || !data.viewer.reviews) return null;
    const f = params?.filters ?? { status: ['waiting'], asked: [], product: [] };
    const decidedView = f.status.length === 1 && f.status[0] === 'decided';
    if (!decidedView) return libraryQueueSubtitle(data.pieces ?? [], data.viewer, local);
    const all = withLocal(data.pieces ?? [], local);
    return tallySentence(tallyOf(all, all.filter((p) => passes(p, f, data.viewer.name)), data.viewer, f));
  }, [data, local, params]);
  useEffect(() => {
    if (!data) return;
    if (tallyText) setPageSummaryLead(tallyText.strong, tallyText.rest);
    else setPageSummary(summaryLine(data.viewer, data.lead));
  }, [data, tallyText?.strong, tallyText?.rest]);

  // The nav badge is this page's "wait for you" number, once the statuses are read (the shell shows it to reviewers only).
  const waitingN = data && !data.loading && !data.failed ? libraryQueueCount(data.pieces, data.viewer, local) : null;
  useEffect(() => {
    if (waitingN === null) return;
    setReviewCount(waitingN);
    rememberMine(waitingN);
  }, [waitingN]);

  const pieces = useMemo(() => withLocal(data?.pieces ?? [], local), [data, local]);
  const filters = params?.filters ?? { status: ['waiting'], asked: [], product: [] };
  const shown = useMemo(() => pieces.filter((p) => passes(p, filters, data?.viewer.name ?? null)), [pieces, filters, data]);
  // A designer reads the list or the map (lr-designer): nothing to decide one by one. The Map falls back to List on a
  // phone and when nothing is there to draw.
  const asked = params?.view ?? (reviews ? 'one' : 'list');
  const wanted = reviews ? asked : asked === 'map' ? 'map' : 'list';
  const canMap = mapAvailable({ narrow, pieces: shown.length });
  const view: ReviewView = wanted === 'map' && !canMap ? 'list' : wanted;
  const products = data?.products ?? [];
  const reachCache = useMemo(() => new Map<string, Reach>(), [pieces, products]);
  const reach = (p: ReviewPiece): Reach => {
    let r = reachCache.get(p.key);
    if (!r) reachCache.set(p.key, (r = reachOf(p, products)));
    return r;
  };
  // Who gets it, measured (scripts/library-reach-data.ts): undefined while read, null when the team has none yet.
  const [reachData, setReachData] = useState<ReachData | null | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    let live = true;
    void import('../../../scripts/library-reach-data')
      .then(({ loadReach }) => loadReach())
      .catch(() => null)
      .then((d) => live && setReachData(d));
    return () => {
      live = false;
    };
  }, [Boolean(data)]);
  const asking = useMemo(() => {
    const out = new Map<string, { spec: ThumbSpec; route: string | null }>();
    for (const [k, spec] of data?.screens ?? []) out.set(k, { spec, route: data?.screenRoutes.get(k) ?? null });
    return out;
  }, [data]);
  const measureCache = useMemo(() => new Map<string, Measured>(), [pieces, products, reachData, asking]);
  const measure = (p: ReviewPiece): Measured => {
    let m = measureCache.get(p.key);
    if (!m) measureCache.set(p.key, (m = measuredReach(p, reach(p), reachData ?? null, asking)));
    return m;
  };
  const openReach = (p: ReviewPiece) => {
    history.pushState(history.state, '', reachHref(p.key));
    setReachKey(p.key);
    window.scrollTo({ top: 0 });
  };
  const closeReach = () => {
    const q = new URLSearchParams(location.search);
    q.delete('reach');
    const s = q.toString();
    history.pushState(history.state, '', `${location.pathname}${s ? `?${s}` : ''}`);
    setReachKey(null);
  };
  const groups = useMemo(() => (data ? joinSmallGroups(groupPieces(shown, data.viewer)) : []), [shown, data]);
  // The order of the chapters (Foundations, Components, Docs), the same in the List and the side list of One by one.
  const ordered = useMemo(() => chaptersOf(groups).flatMap((c) => c.groups.flatMap((g) => g.pieces)), [groups]);
  // Product marks: one letter, two when initials collide ("Pr", "Pa").
  const marks = useMemo(() => productMarks([...products.map((x) => x.name), ...pieces.flatMap((p) => [...askersOf(p).map((a) => a.product ?? ''), ...(p.conflict?.ways.map((w) => w.product) ?? [])])]), [products, pieces]);
  const mark: MarkOf = (name) => (name ? (marks.get(name) ?? null) : null);
  const choices = useMemo(() => filterChoices(pieces, data?.viewer.name ?? null), [pieces, data?.viewer.name]);
  const cur = ordered.find((p) => p.key === current) ?? ordered[0] ?? null;

  useEffect(() => {
    if (cur) setSeen((s) => (s.has(cur.key) ? s : new Set([...s, cur.key])));
  }, [cur]);

  const update = (f: ReviewFilters, v: ReviewView = view) => {
    setParams({ filters: f, view: v });
    setSelected(new Set());
    setAddress(viewSearch(withReviewParams(location.search, f, v, { reviews }), v));
  };

  /** A row's name: that piece in One by one, its own address (?piece=). */
  const openPiece = (p: ReviewPiece) => {
    setCurrent(p.key);
    setParams({ filters, view: 'one' });
    setSelected(new Set());
    setAddress(pieceSearch(location.search, p.key));
    window.scrollTo({ top: 0 });
  };

  const next = useCallback(
    (from: string, step = 1) => {
      const i = ordered.findIndex((p) => p.key === from);
      const n = ordered[i + step] ?? ordered[i - step] ?? null;
      setCurrent(n?.key ?? null);
    },
    [ordered],
  );

  const flush = (pnd: Pending, p: ReviewPiece) => {
    timers.current.delete(pnd.key);
    setPending((l) => l.filter((x) => x.key !== pnd.key));
    send(p, pnd.act)
      .then((line) => setNotice(line))
      .catch((err: Error) => {
        setLocal((m) => {
          const c = new Map(m);
          c.delete(p.key);
          return c;
        });
        setNotice(err.message);
      });
  };

  /** One decision: shown at once, sent after a few seconds unless undone. */
  const act = (p: ReviewPiece, a: Act) => {
    if (demo()) return void openDemo();
    const decided: ReviewPiece['decided'] = a.kind === 'keep' || a.kind === 'keep-both' ? 'kept' : a.kind === 'existing' ? 'existing' : 'added';
    const line = a.kind === 'add' ? `Added ${p.title}.` : a.kind === 'keep-both' ? `Kept ${p.title} in both screens.` : a.kind === 'keep' ? `Kept ${p.title} in ${p.asked?.designer ? `${p.asked.designer}'s` : 'its'} screen.` : a.kind === 'existing' ? `${p.title}: use ${p.match?.label ?? 'the existing piece'}.` : a.kind === 'pick' && a.way === TODAY ? `Kept today's ${p.title}.` : a.kind === 'pick' && (a.way === BOTH || a.way.startsWith('sizes:')) ? `Kept ${p.title} as sizes.` : `Kept ${p.conflict?.ways.find((w) => a.kind === 'pick' && w.key === a.way)?.designer ?? 'one'}'s way for ${p.title}.`;
    const pnd: Pending = { key: p.key, act: a, line };
    setLocal((m) => new Map(m).set(p.key, decided));
    setPending((l) => [...l.filter((x) => x.key !== p.key), pnd]);
    setNotice(null);
    timers.current.set(p.key, window.setTimeout(() => flush(pnd, p), UNDO_MS));
    if (view === 'one') next(p.key);
  };

  const undo = (key: string) => {
    const t = timers.current.get(key);
    if (t) window.clearTimeout(t);
    timers.current.delete(key);
    setPending((l) => l.filter((x) => x.key !== key));
    setLocal((m) => {
      const c = new Map(m);
      c.delete(key);
      return c;
    });
    setCurrent(key);
  };

  const batch = (kind: 'add' | 'keep') => {
    const list = pieces.filter((p) => selected.has(p.key) && data && batchable(p, data.viewer));
    if (demo()) return void openDemo();
    setBusy(true);
    for (const p of list) act(p, { kind });
    setSelected(new Set());
    setBusy(false);
  };

  // Keys of One by one: A adds, K keeps, the arrows move. Never while typing.
  useEffect(() => {
    if (view !== 'one' || !cur || !data) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable], [role="menu"], [role="dialog"]')) return;
      const a = keyAction(e.key);
      if (!a) return;
      if (a === 'next' || a === 'prev') {
        e.preventDefault();
        next(cur.key, a === 'next' ? 1 : -1);
        return;
      }
      if (!canDecide(cur, data.viewer) || cur.conflict) return;
      if (a === 'keep' && !cur.asked) return;
      e.preventDefault();
      act(cur, { kind: a === 'add' ? (cur.match ? 'existing' : 'add') : 'keep' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const viewSwitch = (
    <SegmentedControl
      className="lr-views"
      label="How the pieces are shown"
      value={view}
      onValueChange={(v) => update(filters, v === 'list' ? 'list' : v === 'map' ? 'map' : 'one')}
      items={[
        ...(reviews ? [{ value: 'one', label: 'One by one' }] : []),
        { value: 'list', label: 'List' },
        // The Map needs room and something to draw: hidden on a phone and on an empty list.
        ...(canMap ? [{ value: 'map', label: 'Map' }] : []),
      ]}
    />
  );
  // A designer gets the switch only when there is a second view to pick.
  const showSwitch = reviews || canMap;

  // Who gets it is a page of its own: the review's header gives way to its title.
  const reachPiece = reachKey ? (pieces.find((p) => p.key === reachKey) ?? null) : null;
  useEffect(() => {
    const head = document.querySelector<HTMLElement>('.st-head');
    if (head) head.hidden = Boolean(reachPiece);
    return () => {
      if (head) head.hidden = false;
    };
  }, [Boolean(reachPiece)]);

  if (!data || !params)
    return (
      <div className="lr" aria-busy="true" data-review-count-owner="">
        <Skeleton variant="rect" className="lr-skel" />
      </div>
    );

  const v = data.viewer;
  const waitingAll = pieces.filter((p) => p.state === 'waiting');
  const decidedAll = pieces.filter((p) => p.state === 'decided');
  const onlyWaiting = filters.status.length === 1 && filters.status[0] === 'waiting';
  const nothingWaits = !data.loading && onlyWaiting && !(v.reviews ? waitingAll : waitingAll.filter((p) => p.mine)).length;
  const defaultAsked = v.reviews ? !filters.asked.length : filters.asked.length === 1 && filters.asked[0] === YOU;
  const filtered = !onlyWaiting || !defaultAsked || filters.product.length > 0;
  const banner = designerBanner(data.lead);
  const empty = emptyLine(decidedAll, v, data.lead);
  const sel = pieces.filter((p) => selected.has(p.key));
  const faces = { sample: onSampleTeam(), you: v.name };

  return (
    <FaceNames.Provider value={faces}>
    <div className="lr" data-review-count-owner="">
      {actions && showSwitch && !reachPiece && createPortal(viewSwitch, actions)}
      {data.failed && <p className="lr-notice" role="alert">{data.failed}</p>}
      {/* An old suggestion link no library change carries: the suggestion's own review, in place. */}
      <div className="lr-suggestion" ref={suggestionEl} hidden={!suggestion} />
      {reachPiece ? (
        <ReachPage
          p={reachPiece}
          measured={measure(reachPiece)}
          viewer={v}
          busy={busy}
          backHref={(() => {
            const q = new URLSearchParams(location.search);
            q.delete('reach');
            const s = q.toString();
            return s ? `?${s}` : location.pathname;
          })()}
          onBack={closeReach}
          onAct={(a) => {
            act(reachPiece, a);
            if (!demo()) closeReach();
          }}
          onCompare={() => {
            setCurrent(reachPiece.key);
            closeReach();
            update(filters, 'one');
          }}
        />
      ) : nothingWaits && !filtered ? (
        <section className="zone lr-empty" aria-labelledby="lr-empty-title">
          <QuietScene scene="lighthouse" width={240} className="lr-empty-art" />
          <div className="lr-empty-text">
            <h2 className="lr-empty-title" id="lr-empty-title">
              {empty.title}
            </h2>
            <p className="lr-empty-sentence">{empty.sentence}</p>
            <div className="lr-actions">
              {decidedAll.length > 0 && (
                <Button variant="primary" size="lg" onClick={() => update({ ...filters, status: ['decided'] })}>
                  {v.reviews ? 'See what you decided' : 'See what was decided'}
                </Button>
              )}
              <ButtonLink href={links.explorations} variant={decidedAll.length ? 'secondary' : 'primary'} size="lg">
                Open Explorations
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="lr-bar-row">
            <FilterMenu name="Status" kind="status" picked={filters.status} choices={STATUS_CHOICES} onChange={(s) => update({ ...filters, status: s as ReviewFilters['status'] })} />
            <FilterMenu name="Asked by" kind="asked" picked={filters.asked} choices={choices.asked} onChange={(a) => update({ ...filters, asked: a })} />
            <FilterMenu name="Product" kind="product" picked={filters.product} choices={choices.product} onChange={(pr) => update({ ...filters, product: pr })} />
            {filtered && (
              <Button variant="link" className="lr-clear" onClick={() => update({ status: ['waiting'], asked: v.reviews ? [] : [YOU], product: [] })}>
                {v.reviews ? 'Clear filters' : 'Show everyone'}
              </Button>
            )}
          </div>
          {!v.reviews && (
            <Banner appearance="harbor" icon={Info} title={banner.strong}>
              {banner.rest} <Link href={links.howItWorks}>How library review works</Link>
            </Banner>
          )}
          {data.loading && !shown.length ? (
            <Skeleton variant="rect" className="lr-skel" />
          ) : !shown.length ? (
            <p className="lr-none">
              Nothing here matches these filters.{' '}
              <Button variant="link" onClick={() => update({ status: ['waiting'], asked: v.reviews ? [] : [YOU], product: [] })}>
                Clear filters
              </Button>
            </p>
          ) : view === 'one' && cur ? (
            <OneByOne
              groups={groups}
              all={ordered}
              current={cur.key}
              seen={seen}
              onPick={setCurrent}
              mark={mark}
              detail={<Detail key={cur.key} p={cur} thumbs={data.thumbs} viewer={v} lead={data.lead} tech={data.tech} onAct={act} busy={busy} measured={measure(cur)} onReach={openReach} mark={mark} onComment={(p, t) => (demo() ? Promise.resolve(openDemo()) : comment(p, t).then(setNotice, (e: Error) => setNotice(e.message)))} />}
            />
          ) : view === 'map' ? (
            <MapView
              pieces={ordered}
              products={products}
              viewer={v}
              list={(subset, single) => (
                <ListView readOnly bare={single} groups={joinSmallGroups(groupPieces(subset, v))} thumbs={data.thumbs} viewer={v} tech={data.tech} secondLead={data.secondLead} decided={filters.status.length === 1 && filters.status[0] === 'decided'} onOpen={openPiece} onAsk={() => undefined} selected={new Set()} onSelect={() => undefined} reach={reach} measure={measure} onReach={openReach} mark={mark} />
              )}
            />
          ) : (
            <ListView groups={groups} thumbs={data.thumbs} viewer={v} tech={data.tech} secondLead={data.secondLead} decided={filters.status.length === 1 && filters.status[0] === 'decided'} onOpen={openPiece} onAsk={(p) => (demo() ? openDemo() : void ask(p).then(setNotice, (e: Error) => setNotice(e.message)))} selected={selected} onSelect={(keys, on) => setSelected((s) => { const c = new Set(s); for (const k of keys) on ? c.add(k) : c.delete(k); return c; })} reach={reach} measure={measure} onReach={openReach} mark={mark} />
          )}
        </>
      )}
      <DecisionToasts pending={pending} notice={notice} onUndo={undo} onCloseNotice={() => setNotice(null)} />
      {view === 'list' && sel.length > 0 && <SelectionBar pieces={sel} busy={busy} onKeep={() => batch('keep')} onAdd={() => batch('add')} onClear={() => setSelected(new Set())} />}
    </div>
    </FaceNames.Provider>
  );
}


/**
 * What was just decided, as DS toasts: one per decision with Undo while it waits to be sent (it closes when sent or
 * undone), then the line the send answered, until closed.
 */
function DecisionToasts(props: { pending: Pending[]; notice: string | null; onUndo: (key: string) => void; onCloseNotice: () => void }) {
  return (
    <ToastProvider limit={3}>
      <DecisionToastSync {...props} />
    </ToastProvider>
  );
}

function DecisionToastSync({ pending, notice, onUndo, onCloseNotice }: { pending: Pending[]; notice: string | null; onUndo: (key: string) => void; onCloseNotice: () => void }) {
  const api = useToast();
  const shown = useRef(new Set<string>());
  const undoRef = useRef(onUndo);
  undoRef.current = onUndo;
  const closeRef = useRef(onCloseNotice);
  closeRef.current = onCloseNotice;
  useEffect(() => {
    const now = new Set(pending.map((x) => `lr-pending-${x.key}`));
    for (const id of shown.current) if (!now.has(id)) api.close(id);
    for (const x of pending) {
      const id = `lr-pending-${x.key}`;
      if (shown.current.has(id)) api.update(id, { title: x.line });
      else api.add({ id, title: x.line, timeout: 0, action: { label: 'Undo', onClick: () => undoRef.current(x.key) } });
    }
    shown.current = now;
  }, [pending, api]);
  const showNotice = notice && !pending.length ? notice : null;
  const noticeOpen = useRef(false);
  useEffect(() => {
    if (!showNotice) {
      if (noticeOpen.current) api.close('lr-notice');
      noticeOpen.current = false;
      return;
    }
    if (noticeOpen.current) api.update('lr-notice', { title: showNotice });
    else
      api.add({
        id: 'lr-notice',
        title: showNotice,
        timeout: 0,
        onClose: () => {
          noticeOpen.current = false;
          closeRef.current();
        },
      });
    noticeOpen.current = true;
  }, [showNotice, api]);
  return null;
}

/** The island: the page's data and writes (scripts/library-review-data.ts), the sample team's gate, the links. */
export default function LibraryReview() {
  const links = useMemo(() => {
    const { owner, repo } = readRepo();
    let products: ProductConfig[];
    try {
      products = productsOf(siteConfig() as { products?: ProductConfig[] });
    } catch {
      products = productsOf(null);
    }
    return { explorations: productHref(defaultProduct(products).key), howItWorks: libraryHref(owner, repo, 'how-review-works/') };
  }, []);
  // Local development only: ?fixture=many-askers puts 12 explorations on one piece (lib/library-review-fixtures).
  const load = useMemo(() => {
    const fixture = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true && new URLSearchParams(location.search).get('fixture') === 'many-askers';
    return fixture ? (paint: (d: ReviewData) => void) => loadLibraryReview((d) => paint({ ...d, pieces: withManyAskers(d.pieces) })) : loadLibraryReview;
  }, []);
  return (
    <LibraryReviewView
      load={load}
      send={(p, a) => (a.kind === 'pick' ? pickWay(p, a.way, readViewer().name) : decide(p, a.kind))}
      comment={commentOn}
      ask={askOther}
      demo={exploringDemo}
      openDemo={() => void openMakeItYours('decide library pieces')}
      links={links}
      openSuggestion={(n, el) => {
        void import('../../../scripts/suggestions').then(({ openSuggestion }) => openSuggestion(n, { el, crumbs: [{ label: 'Library review', href: studioHref('library-review/') }] }));
      }}
    />
  );
}
