// Library review (/studio/library-review/, boards LR2 to LR14): the DS lead's one queue for library pieces, visible to
// everyone. Two views (?view=), switched from the title line: One by one (the list on the start side, one piece in
// the main area, its decision under it, keys A add, K keep, the down arrow next) and List (one row per piece in groups,
// a checkbox per row and per group, and the bottom bar that says what the selection touches before acting). Map is
// phase 3.
// Filters are checkbox lists (Status, Asked by, Product); no tabs. A designer opens on her own pieces, reads who decides
// in one banner and sees no buttons; her rows show only what changed (an exception). Decisions are the exploration's
// own (scripts/library-review-data.ts): deciding here or on the exploration page is the same decision. Undo stays
// a few seconds before a decision is sent. Rules: lib/library-review.ts. Styles: styles/library-review.css.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarGroup, Badge, Button, Checkbox, Icon, IconButton, Input, Kbd, Link, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Progress, SegmentedControl, Skeleton, VisuallyHidden } from '@bridge-ds/react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import ButtonLink from '../ButtonLink';
import { BranchThumb } from './BranchThumb';
import { QuietScene } from './QuietScene';
import { isNew, Sample, thumbOf } from './LibraryReviewSample';
import { MapView } from './LibraryMap';
import { ReachPage } from './LibraryReach';
import { mapAvailable } from '../../../lib/library-map';
import { reachCell, reachColumn, reachOf, type Reach } from '../../../lib/library-reach';
import { hasLegacy, itemTarget, landing, readLegacy, withoutLegacy } from '../../../lib/library-review-links';
import { studioHref } from '../../../lib/team-path';
import { askedCell, askedCountLine, askedSubline, askersOf, FACES_SHOWN, groupAskers, waysTag } from '../../../lib/library-askers';
import { familiesOf, shownColumns } from '../../../lib/library-review-list';
import { withManyAskers } from '../../../lib/library-review-fixtures';
import {
  batchable,
  colorLook,
  keepMissing,
  canDecide,
  conflictLede,
  countLine,
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
  waitingForYou,
  passes,
  reviewParams,
  seenLine,
  selectionLine,
  sharedLine,
  STATUS_CHOICES,
  summaryLine,
  tokenGroup,
  waitLine,
  withReviewParams,
  YOU,
  type AskedBy,
  type FilterChoice,
  type ReviewFilters,
  type ReviewPiece,
  type ReviewView,
} from '../../../lib/library-review';
import { ACTIONS_SELECTOR, setPageSummary } from '../../../lib/page-summary';
import { statusTagClass } from '../../../lib/status-tag';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import { askOther, commentOn, decide, loadLibraryReview, pickWay, readViewer, type ReviewData } from '../../../scripts/library-review-data';
import { rememberMine } from '../../../scripts/needs-you';
import { setReviewCount } from '../../../scripts/shell';
import { exploringDemo, openMakeItYours } from '../../../scripts/demo-gate';
import { readRepo } from '../../../scripts/github-session';
import { siteConfig } from '../../../scripts/repo-context';
import { defaultProduct, productsOf, type ProductConfig } from '@bridge-ds/core';
import { productHref } from '../../../lib/product-page';
import { libraryHref } from '../../../lib/library-shells';

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
function AskedChip({ p }: { p: ReviewPiece }) {
  if (!p.asked) return <span className="lr-ask is-lead">{p.mine ? 'From you' : p.by ? `From ${p.by}` : 'From a lead'}</span>;
  const words = (
    <>
      {p.asked.name}
      {p.asked.product && <span className="lr-ask-product"> · {p.asked.product}</span>}
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
      <Badge tone="warning" size="md" className={statusTagClass('warning')}>
        {waysTag(p.conflict.ways.length)}
      </Badge>
    );
  if (!viewerReviews) return null;
  return (
    <Badge tone="warning" size="md" className={statusTagClass('warning')}>
      Waiting
    </Badge>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One by one

/**
 * A card drawn with one way's value (its room inside, its corners): the look itself, not the number. Data values from
 * the explorations' checks; a value Bridge does not know (today's, before a check records it) draws the card as the
 * library ships it.
 */
function MiniCard({ property, value, raised }: { property: string; value: string | null | undefined; raised?: boolean }) {
  const n = Number(value);
  const known = value !== null && value !== undefined && Number.isFinite(n);
  const prop = property.toLowerCase();
  const style = !known ? undefined : prop.startsWith('padding') || prop === 'gap' ? { padding: `${Math.min(Math.max(n, 2), 32)}px` } : prop === 'border-radius' ? { borderRadius: `${Math.min(n, 24)}px` } : undefined;
  return (
    <span className={`lr-mini-card${raised ? ' is-raised' : ''}`} style={style}>
      <span className="lr-look-line" />
      <span className="lr-look-line is-short" />
    </span>
  );
}

function Plate({ children, caption, value, tone }: { children: ReactNode; caption: string; value?: string | null; tone?: 'match' }) {
  return (
    <figure className={`lr-plate${tone === 'match' ? ' is-match' : ''}`}>
      <div className="lr-plate-art">{children}</div>
      <figcaption className="lr-plate-cap">
        <span className="lr-plate-label">{caption}</span>
        {value && <span className="lr-plate-value">{value}</span>}
      </figcaption>
    </figure>
  );
}

const valueOf = (spec: ThumbSpec, side: 'before' | 'after'): string | null => {
  if (spec.kind === 'color') return spec[side]?.toUpperCase() ?? null;
  if (spec.kind === 'space' || spec.kind === 'radius' || spec.kind === 'type') return spec[side] === null ? null : `${spec[side]}`;
  return null;
};

/** The reach link of a piece ("2 products · 1 screen ›"): opens Who gets it. */
function ReachLink({ p, reach, onReach, label, text, quiet, hoverOnly }: { p: ReviewPiece; reach: Reach; onReach: (p: ReviewPiece) => void; label?: string; text?: string; quiet?: boolean; hoverOnly?: boolean }) {
  return (
    <Link
      href={reachHref(p.key)}
      className={`lr-reach-link${quiet ? ' is-quiet' : ''}${hoverOnly ? ' is-hover-only' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        onReach(p);
      }}
      aria-label={`Who gets ${p.title}: ${reach.link}`}
    >
      {label ? `${label} ` : ''}
      {text ?? reach.link}
      <Icon icon={ChevronRight} size="xs" className="lr-reach-chev" />
    </Link>
  );
}

function Detail({ p, thumbs, viewer, lead, tech, onAct, onComment, busy, reach, onReach }: { p: ReviewPiece; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; lead: string | null; tech: string | null; onAct: (p: ReviewPiece, a: Act) => void; onComment: (p: ReviewPiece, text: string) => Promise<void>; busy: boolean; reach: Reach; onReach: (p: ReviewPiece) => void }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState('');
  // A conflict's two ways, each next to today (the default), or the ways alone (lr-conflict).
  const [withToday, setWithToday] = useState(true);
  const [showAskers, setShowAskers] = useState(false);
  const askers = askersOf(p);
  useEffect(() => {
    setCommenting(false);
    setText('');
    setShowAskers(false);
  }, [p.key]);
  const decides = canDecide(p, viewer);
  const spec = thumbOf(p, thumbs);
  const valued = spec.kind === 'color' || spec.kind === 'space' || spec.kind === 'radius' || spec.kind === 'type' || spec.kind === 'image';
  const none = <span className="lr-plate-none">none</span>;
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
  const eyebrow = p.conflict ? `${p.category} · two explorations change it differently` : `${p.category === p.title ? 'Components' : p.category} · ${p.kind.toLowerCase()}`;
  return (
    <article className="lr-detail" aria-labelledby="lr-detail-title">
      <div className="lr-detail-head">
        <div>
          <p className="lr-eyebrow">{eyebrow}</p>
          <h2 className="lr-detail-title" id="lr-detail-title">
            {p.title}
          </h2>
        </div>
        {p.conflict && (
          <SegmentedControl
            size="sm"
            label="What each way is shown with"
            value={withToday ? 'today' : 'ways'}
            onValueChange={(v) => setWithToday(v === 'today')}
            items={[
              { value: 'today', label: 'With today' },
              { value: 'ways', label: 'Ways only' },
            ]}
          />
        )}
      </div>
      {!p.conflict && (
        <p className="lr-detail-ask">
          {askers.length > 1 ? (
            <>
              <AvatarGroup aria-label="Who asked" size="xs" max={FACES_SHOWN}>
                {askers.map((a) => (
                  <Avatar key={a.key} name={a.designer ?? a.name} size="xs" />
                ))}
              </AvatarGroup>
              <span>{askedCountLine(askers.length)}</span>
              <Button variant="link" aria-expanded={showAskers} onClick={() => setShowAskers((o) => !o)}>
                {showAskers ? 'Hide them' : 'Show them'}
              </Button>
            </>
          ) : (
            <>
              <AskedChip p={p} />
              {p.asked?.designer && <span className="lr-muted">{p.mine ? 'You asked for it' : `${p.asked.designer} asked for it`}</span>}
            </>
          )}
          {(p.state === 'decided' || !decides) && <StateTag p={p} viewerReviews={viewer.reviews} />}
          <span className="lr-detail-reach">
            <span className="lr-muted">Who gets it</span> <ReachLink p={p} reach={reach} onReach={onReach} />
          </span>
        </p>
      )}
      {!p.conflict && askers.length > 1 && showAskers && <AskersList list={askers} />}
      {p.conflict ? (
        <>
          <p className="lr-lede">
            {conflictLede(p)} <ReachLink p={p} reach={reach} onReach={onReach} label="Who gets it:" />
          </p>
          <div className="lr-ways">
            {p.conflict.ways.map((w) => (
              <section key={w.key} className={`lr-way${p.conflict!.pick === w.key ? ' is-picked' : ''}`} aria-label={`${w.designer}'s way`}>
                <header className="lr-way-head">
                  <Avatar name={w.designer} size="sm" decorative />
                  <span>
                    <strong className="lr-way-name">{w.designer}'s way</strong>
                    <span className="lr-muted lr-way-from">
                      {w.exploration} · {w.product}
                    </span>
                  </span>
                </header>
                <div className="lr-way-art">
                  {withToday ? (
                    <span className="lr-way-pair">
                      <span className="lr-way-side">
                        <MiniCard property={p.conflict!.property} value={p.conflict!.today} />
                        <span className="lr-muted lr-way-cap">Today</span>
                      </span>
                      <Icon icon={ArrowRight} size="xs" className="lr-arrow" />
                      <span className="lr-way-side">
                        <MiniCard property={p.conflict!.property} value={w.value} raised />
                        <span className="lr-way-cap is-way">{w.designer}'s way</span>
                      </span>
                    </span>
                  ) : (
                    <BranchThumb spec={{ kind: 'screen', src: null, screen: w.exploration, product: w.product, seed: w.key }} size="card" chip={null} />
                  )}
                </div>
                <p className="lr-way-value">{w.line}</p>
                {decides && (
                  <Button variant="secondary" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'pick', way: w.key })} data-demo-write="decide library pieces">
                    Pick this way
                  </Button>
                )}
              </section>
            ))}
          </div>
          <div className="lr-actions lr-decide">
            {decides && p.conflict.ways.every((w) => w.piece) && (
              <Button variant="ghost" size="lg" disabled={busy} onClick={() => onAct(p, { kind: 'keep-both' })} data-demo-write="decide library pieces">
                Keep both in their screens
              </Button>
            )}
            {comment}
            {decides && <span className="lr-muted lr-actions-note">{p.conflict.ways.map((w) => w.designer).join(' and ')} are told, and can comment. You decide without waiting.</span>}
          </div>
          {commentBox}
        </>
      ) : (
        <>
          <div className={`lr-plates${p.match ? ' has-match' : ''}`}>
            <Plate caption="Today" value={valueOf(spec, 'before') ?? p.before}>
              {valued || !isNew(p) ? <Sample spec={spec} side="before" size="card" title={p.title} /> : none}
            </Plate>
            <Plate caption={p.match ? 'Asked for' : 'With this change'} value={valueOf(spec, 'after') ?? p.after}>
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
                <span className="lr-keys" aria-hidden="true">
                  <Kbd keys="A" size="sm" /> add {p.asked && (<><Kbd keys="K" size="sm" /> keep</>)} <Kbd keys="↓" size="sm" /> next
                </span>
              </div>
              {p.match && p.asked?.designer && (
                <p className="lr-muted lr-shared">
                  {p.asked.designer} is told on the exploration and can disagree there: "Reply to {viewer.name ?? 'you'}" puts the piece back here with the reason. You still decide.
                </p>
              )}
              {commentBox}
              {sharedLine(p) && <p className="lr-muted lr-shared">{sharedLine(p)}</p>}
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

function OneByOne({ groups, all, current, seen, decidedCount, onPick, detail }: { groups: ReturnType<typeof joinSmallGroups>; all: ReviewPiece[]; current: string | null; seen: Set<string>; decidedCount: number; onPick: (k: string) => void; detail: ReactNode }) {
  const seenN = all.filter((p) => seen.has(p.key)).length;
  // On a phone: a compact "1 of 12" bar with previous and next above the piece, the list behind "All pieces".
  const [listOpen, setListOpen] = useState(false);
  const at = all.findIndex((p) => p.key === current);
  const go = (step: number) => {
    const n = all[at + step];
    if (n) onPick(n.key);
  };
  return (
    <div className="lr-one">
      <div className="lr-compact">
        <IconButton icon={ChevronLeft} label="Previous piece" variant="secondary" size="md" disabled={at <= 0} onClick={() => go(-1)} />
        <span className="lr-compact-count">
          {at + 1} of {all.length}
        </span>
        <IconButton icon={ChevronRight} label="Next piece" variant="secondary" size="md" disabled={at >= all.length - 1} onClick={() => go(1)} />
        <Button variant="ghost" size="md" className="lr-compact-all" aria-expanded={listOpen} aria-controls="lr-side" onClick={() => setListOpen((o) => !o)}>
          {listOpen ? 'Hide pieces' : 'All pieces'}
        </Button>
      </div>
      <nav className={`lr-side${listOpen ? ' is-open' : ''}`} id="lr-side" aria-label="Pieces">
        <div className="lr-side-head">
          <p className="lr-seen">
            <strong>{seenLine(seenN, all.length)}</strong>
            <span className="lr-muted">{decidedCount} decided</span>
          </p>
          <Progress value={all.length ? (seenN / all.length) * 100 : 0} size="sm" aria-label={seenLine(seenN, all.length)} />
        </div>
        {groups.map((g) => (
          <section key={g.key} className="lr-side-group" aria-label={g.label}>
            <h3 className="lr-side-label">
              {g.label} <span className="lr-muted">{g.pieces.length}</span>
            </h3>
            <ul className="lr-side-list">
              {g.pieces.map((p) => (
                <li key={p.key}>
                  {/* bridge-audit-ignore-next-line: the whole piece row (title, who asked, its flag) is one target that shows the piece, like the review queue rows; the DS has no row button and Button would cut it to one label */}
                  <button type="button" className="lr-side-row" aria-current={current === p.key ? 'true' : undefined} onClick={() => (onPick(p.key), setListOpen(false))}>
                    <span className="lr-side-main">
                      <span className="lr-side-title">{p.title}</span>
                      <span className="lr-muted lr-side-sub">{p.conflict ? askedSubline(p.conflict.ways.map((w) => ({ key: w.key, name: w.exploration, product: w.product, productKey: null, href: null, designer: w.designer }))) : (askedSubline(askersOf(p)) ?? (p.mine ? 'From you' : p.by ? `From ${p.by}` : 'From a lead'))}</span>
                    </span>
                    {p.conflict && !p.conflict.pick ? (
                      <Badge tone="warning" size="sm" className={statusTagClass('warning')}>
                        {waysTag(p.conflict.ways.length)}
                      </Badge>
                    ) : p.match && p.state === 'waiting' ? (
                      <span className="lr-side-flag">Match found</span>
                    ) : decidedTag(p) ? (
                      <span className="lr-muted lr-side-flag">{decidedTag(p)!.label}</span>
                    ) : seen.has(p.key) && current !== p.key ? (
                      <span className="lr-muted lr-side-flag">Seen</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
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
          <h4 className="lr-askers-product">{g.product}</h4>
          <ul className="lr-askers-list">
            {g.askers.map((a) => (
              <li key={a.key} className="lr-askers-row">
                <Avatar name={a.designer ?? a.name} size="xs" decorative />
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

/** The List's Asked by cell, on one line: the most recent exploration as a tag, then a quiet "+N more" (lr-list). */
function AskedCell({ p }: { p: ReviewPiece }) {
  if (p.conflict)
    return (
      <span className="lr-ask-cell">
        <span className="lr-ask">{p.conflict.ways[0]!.exploration}</span>
        <span className="lr-ask-more is-static">+{p.conflict.ways.length - 1} more</span>
      </span>
    );
  if (!p.asked) return p.mine ? null : <AskedChip p={p} />;
  const list = askersOf(p);
  const cell = askedCell(list);
  const lead = { ...p, asked: cell.first ?? p.asked };
  return (
    <span className="lr-ask-cell">
      <AskedChip p={lead} />
      {cell.label && (
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="lr-ask-more" aria-label={`${cell.label}: every exploration that asked for ${p.title}`} />}>{cell.label}</PopoverTrigger>
          <PopoverContent title={`${list.length} explorations asked for it`} align="start" className="lr-askers-pop">
            <AskersList list={list} />
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

/**
 * The list (lr-list, lr-yours, lr-decided, lr-designer): one block per group (Colors, a component, Docs) with space
 * between blocks and a plain heading above each, in families (Foundations, Components, Docs: lib/library-review-list).
 * One column header row at the top, sticky, and the same columns in every block, so they stay aligned:
 *   Waiting, lead:  [box] | Today › after | Piece | Asked by | Who gets it | State | Next | action
 *   Decided:        Today › after | Piece | Asked by | Who gets it | Result
 *   Designer:       Today › after | Piece | Asked by | Who gets it | what changed (an exception)
 * A column shows only when a row fills it. Checkboxes and the row action (a quiet Decide) show on row hover or
 * keyboard focus, and stay once something is selected; always on touch screens.
 */
function ListView({ groups, thumbs, viewer, tech, secondLead, decided, selected, onSelect, onAsk, onOpen, reach, onReach, readOnly = false }: { groups: ReturnType<typeof joinSmallGroups>; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; tech: string | null; secondLead: string | null; decided: boolean; selected: Set<string>; onSelect: (keys: string[], on: boolean) => void; onAsk: (p: ReviewPiece) => void; onOpen: (p: ReviewPiece) => void; reach: (p: ReviewPiece) => Reach; onReach: (p: ReviewPiece) => void; readOnly?: boolean }) {
  const pickable = readOnly ? [] : groups.flatMap((g) => g.pieces.filter((p) => batchable(p, viewer)));
  const allOn = pickable.length > 0 && pickable.every((p) => selected.has(p.key));
  const someOn = pickable.some((p) => selected.has(p.key));
  const mode = !viewer.reviews ? 'designer' : decided ? 'decided' : 'lead';
  // The Map's list is read only: no checkbox, no decision (lr-map).
  const boxes = mode === 'lead' && !readOnly && pickable.length > 0;
  const pair = (p: ReviewPiece) => {
    const spec = thumbOf(p, thumbs);
    const none = isNew(p) && !(spec.kind === 'color' || spec.kind === 'space');
    return (
      <span role="cell" className="lr-col-thumb lr-pair" aria-hidden="true">
        <span className={`lr-mini${none ? ' is-none' : ''}`}>{none ? <span className="lr-plate-none">none</span> : <Sample spec={spec} side="before" size="row" title={p.title} />}</span>
        <Icon icon={ArrowRight} size="xs" className="lr-arrow" />
        <span className="lr-mini">
          <Sample spec={spec} side="after" size="row" title={p.title} />
        </span>
      </span>
    );
  };
  // A conflict says its ways inline after the piece's subline: the State column never holds it alone.
  const state = (p: ReviewPiece) => {
    const d = decidedTag(p);
    if (d)
      return (
        <Badge tone={d.tone} size="md" className={statusTagClass(d.tone)}>
          {d.label}
        </Badge>
      );
    if (p.mine && p.designApproved)
      return (
        <Badge tone="success" size="md" className={statusTagClass('success')}>
          You approved
        </Badge>
      );
    if (p.exception)
      return (
        <Badge tone="warning" size="md" className={statusTagClass('warning')}>
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
  // A column shows only when a row fills it (no empty State, Next or action column).
  const rows = groups.flatMap((g) => g.pieces);
  const stateOf = (p: ReviewPiece) => (mode === 'designer' ? (decidedTag(p) ? state(p) : p.exception ? <span className="lr-muted">{p.exception}</span> : null) : state(p));
  const reachCol = reachColumn(rows.map(reach));
  const cols = shownColumns({
    state: rows.some((p) => stateOf(p) !== null),
    next: mode === 'lead' && rows.some((p) => nextActor(p, { tech, secondLead }) !== null),
    action: mode !== 'designer' && rows.some((p) => action(p) !== null),
  });
  const showState = cols.includes('state');
  const showNext = cols.includes('next');
  const showAction = cols.includes('action');
  const template = [
    boxes ? 'var(--size-6)' : null,
    'var(--size-40)',
    'minmax(var(--size-64), 3fr)',
    'minmax(0, 1.7fr)',
    'minmax(var(--size-40), 1fr)',
    // Fixed widths where content varies, so every block's grid lines up with the one header row.
    showState ? 'var(--size-40)' : null,
    showNext ? 'minmax(0, 0.8fr)' : null,
    showAction ? 'var(--size-20)' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const families = familiesOf(groups);
  return (
    <div className={`lr-list is-${mode}${selected.size ? ' has-selection' : ''}${readOnly ? ' is-read' : ''}`} role="table" aria-label="Library pieces" style={{ ['--lr-cols-wide' as string]: template }}>
      <div className="lr-list-head" role="row">
        {boxes && (
          <span role="columnheader" className="lr-col-box lr-hover-ctl">
            <Checkbox label={<VisuallyHidden>Select every piece you can decide</VisuallyHidden>} checked={allOn} indeterminate={!allOn && someOn} onCheckedChange={(on) => onSelect(pickable.map((p) => p.key), on)} />
          </span>
        )}
        <span role="columnheader" className="lr-col-thumb">
          Today › After
        </span>
        <span role="columnheader">Piece</span>
        <span role="columnheader">Asked by</span>
        <span role="columnheader">
          Who gets it
          {reachCol.shared && <span className="lr-head-reach">{reachCol.shared}</span>}
        </span>
        {showState && <span role="columnheader">{mode === 'decided' ? 'Result' : 'State'}</span>}
        {showNext && <span role="columnheader">Next</span>}
        {showAction && (
          <span role="columnheader" className="lr-col-end">
            <VisuallyHidden>Action</VisuallyHidden>
          </span>
        )}
      </div>
      {families.map((f) => (
        <div key={f.family} role="rowgroup" className="lr-family" aria-label={f.label ?? undefined}>
          {f.label && (
            <div role="row" className="lr-family-row">
              {/* The checkbox slot, so the overline starts where the block headings start. */}
              {boxes && <span className="lr-col-box" aria-hidden="true" />}
              <span role="cell" className="lr-overline">
                {f.label}
              </span>
            </div>
          )}
          {f.groups.map((g) => {
            const inGroup = g.pieces.filter((p) => boxes && batchable(p, viewer));
            const on = inGroup.length > 0 && inGroup.every((p) => selected.has(p.key));
            const some = inGroup.some((p) => selected.has(p.key));
            return (
              <div key={g.key} role="rowgroup" className="lr-list-group" aria-label={g.label}>
                <div role="row" className="lr-group-row">
                  {boxes && (
                    <span role="cell" className="lr-col-box lr-hover-ctl">
                      {inGroup.length > 0 && <Checkbox label={<VisuallyHidden>{`Select ${g.label}`}</VisuallyHidden>} checked={on} indeterminate={!on && some} onCheckedChange={(v) => onSelect(inGroup.map((p) => p.key), v)} />}
                    </span>
                  )}
                  <span role="cell" className="lr-group-label">
                    <span className="lr-group-name">{g.label}</span>
                    <span className="lr-muted">{g.note ?? g.pieces.length}</span>
                  </span>
                </div>
                <div className="lr-block">
                  {g.pieces.map((p) => {
                    const actor = mode === 'lead' ? nextActor(p, { tech, secondLead }) : null;
                    return (
                      <div role="row" key={p.key} className={`lr-row${selected.has(p.key) ? ' is-selected' : ''}`}>
                        {boxes && (
                          <span role="cell" className="lr-col-box lr-hover-ctl">
                            {batchable(p, viewer) && <Checkbox label={<VisuallyHidden>{`Select ${p.title}`}</VisuallyHidden>} checked={selected.has(p.key)} onCheckedChange={(v) => onSelect([p.key], v)} />}
                          </span>
                        )}
                        {pair(p)}
                        <span role="cell" className="lr-row-piece">
                          <span className="lr-row-title">{p.title}</span>
                          <span className="lr-row-sub">
                            <span className="lr-muted lr-row-kind">{p.kind}</span>
                            {p.conflict && !p.conflict.pick && (
                              <Badge tone="warning" size="sm" className={statusTagClass('warning')}>
                                {waysTag(p.conflict.ways.length)}
                              </Badge>
                            )}
                          </span>
                        </span>
                        <span role="cell" className="lr-row-ask">
                          <AskedCell p={p} />
                        </span>
                        <span role="cell" className="lr-row-reach">
                          {(() => {
                            const c = reachCell(reach(p), Boolean(reachCol.shared));
                            return <ReachLink p={p} reach={reach(p)} onReach={onReach} text={c.label} quiet hoverOnly={c.hoverOnly} />;
                          })()}
                        </span>
                        {showState && (
                          <span role="cell" className="lr-row-state">
                            {stateOf(p)}
                          </span>
                        )}
                        {showNext && (
                          <span role="cell" className="lr-row-next">
                            {actor && (
                              <span className="lr-who">
                                <Avatar name={actor.name} size="xs" decorative />
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
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
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
  const [current, setCurrent] = useState<string | null>(null);
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

  useEffect(() => {
    if (data) setPageSummary(summaryLine(data.viewer, data.lead));
  }, [data]);

  // The nav badge is this page's "wait for you" number, once the statuses are read (the shell shows it to reviewers only).
  const waitingN = data && !data.loading && !data.failed ? waitingForYou(data.pieces, data.viewer) : null;
  useEffect(() => {
    if (waitingN === null) return;
    setReviewCount(waitingN);
    rememberMine(waitingN);
  }, [waitingN]);

  const pieces = useMemo(() => (data?.pieces ?? []).map((p) => (local.has(p.key) ? { ...p, state: 'decided' as const, decided: local.get(p.key) ?? 'added', waitsOn: 'nobody' as const } : p)), [data, local]);
  const filters = params?.filters ?? { status: ['waiting'], asked: [], product: [] };
  const shown = useMemo(() => pieces.filter((p) => passes(p, filters)), [pieces, filters]);
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
  const ordered = useMemo(() => groups.flatMap((g) => g.pieces), [groups]);
  const choices = useMemo(() => filterChoices(pieces), [pieces]);
  const cur = ordered.find((p) => p.key === current) ?? ordered[0] ?? null;

  useEffect(() => {
    if (cur) setSeen((s) => (s.has(cur.key) ? s : new Set([...s, cur.key])));
  }, [cur]);

  const update = (f: ReviewFilters, v: ReviewView = view) => {
    setParams({ filters: f, view: v });
    setSelected(new Set());
    setAddress(withReviewParams(location.search, f, v, { reviews }));
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
    const line = a.kind === 'add' ? `Added ${p.title}.` : a.kind === 'keep-both' ? `Kept ${p.title} in both screens.` : a.kind === 'keep' ? `Kept ${p.title} in ${p.asked?.designer ? `${p.asked.designer}'s` : 'its'} screen.` : a.kind === 'existing' ? `${p.title}: use ${p.match?.label ?? 'the existing piece'}.` : `Picked a way for ${p.title}.`;
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

  return (
    <div className="lr" data-review-count-owner="">
      {actions && showSwitch && !reachPiece && createPortal(viewSwitch, actions)}
      {data.failed && <p className="lr-notice" role="alert">{data.failed}</p>}
      {/* An old suggestion link no library change carries: the suggestion's own review, in place. */}
      <div className="lr-suggestion" ref={suggestionEl} hidden={!suggestion} />
      {reachPiece ? (
        <ReachPage
          p={reachPiece}
          reach={reach(reachPiece)}
          screens={data.screens}
          thumbs={data.thumbs}
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
            <p className="lr-count" aria-live="polite">
              {countLine(pieces, shown, v, filters)}
              {filtered && (
                <>
                  {' · '}
                  <Button variant="link" onClick={() => update({ status: ['waiting'], asked: v.reviews ? [] : [YOU], product: [] })}>
                    {v.reviews ? 'Clear filters' : 'Show everyone'}
                  </Button>
                </>
              )}
            </p>
          </div>
          {!v.reviews && (
            <aside className="lr-banner" aria-label="Who decides">
              <Avatar name={data.lead ?? 'Design lead'} size="sm" decorative />
              <p className="lr-banner-text">
                <strong>{banner.strong}</strong> {banner.rest}
              </p>
              <Link href={links.howItWorks} className="lr-banner-link">
                How library review works
              </Link>
            </aside>
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
              decidedCount={local.size}
              onPick={setCurrent}
              detail={<Detail p={cur} thumbs={data.thumbs} viewer={v} lead={data.lead} tech={data.tech} onAct={act} busy={busy} reach={reach(cur)} onReach={openReach} onComment={(p, t) => (demo() ? Promise.resolve(openDemo()) : comment(p, t).then(setNotice, (e: Error) => setNotice(e.message)))} />}
            />
          ) : view === 'map' ? (
            <MapView
              pieces={ordered}
              products={products}
              viewer={v}
              list={(subset) => (
                <ListView readOnly groups={joinSmallGroups(groupPieces(subset, v))} thumbs={data.thumbs} viewer={v} tech={data.tech} secondLead={data.secondLead} decided={filters.status.length === 1 && filters.status[0] === 'decided'} onOpen={() => undefined} onAsk={() => undefined} selected={new Set()} onSelect={() => undefined} reach={reach} onReach={openReach} />
              )}
            />
          ) : (
            <ListView groups={groups} thumbs={data.thumbs} viewer={v} tech={data.tech} secondLead={data.secondLead} decided={filters.status.length === 1 && filters.status[0] === 'decided'} onOpen={(p) => { setCurrent(p.key); update(filters, 'one'); }} onAsk={(p) => (demo() ? openDemo() : void ask(p).then(setNotice, (e: Error) => setNotice(e.message)))} selected={selected} onSelect={(keys, on) => setSelected((s) => { const c = new Set(s); for (const k of keys) on ? c.add(k) : c.delete(k); return c; })} reach={reach} onReach={openReach} />
          )}
        </>
      )}
      <div className="lr-toasts" aria-live="polite">
        {pending.map((x) => (
          <p key={x.key} className="lr-toast">
            <span>{x.line}</span>
            <Button variant="ghost" size="sm" onClick={() => undo(x.key)}>
              Undo
            </Button>
          </p>
        ))}
        {notice && !pending.length && (
          <p className="lr-toast">
            <span>{notice}</span>
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
              Close
            </Button>
          </p>
        )}
      </div>
      {view === 'list' && sel.length > 0 && <SelectionBar pieces={sel} busy={busy} onKeep={() => batch('keep')} onAdd={() => batch('add')} onClear={() => setSelected(new Set())} />}
    </div>
  );
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
