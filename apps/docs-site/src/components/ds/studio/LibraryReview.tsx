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
import { Avatar, Badge, Button, Checkbox, Icon, IconButton, Input, Kbd, Link, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuTrigger, Progress, SegmentedControl, Skeleton, VisuallyHidden } from '@bridge-ds/react';
import { ArrowRight, ChevronDown, Ellipsis } from 'lucide-react';
import ButtonLink from '../ButtonLink';
import { BranchThumb } from './BranchThumb';
import { QuietScene } from './QuietScene';
import {
  batchable,
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

const thumbOf = (p: ReviewPiece, thumbs: Map<string, ThumbSpec>): ThumbSpec => {
  const t = thumbs.get(p.key);
  if (t) return t;
  if (p.swatch) return { kind: 'color', token: '', before: p.swatch.before, after: p.swatch.after };
  return { kind: 'icon', icon: p.kind === 'Docs' ? 'guidance' : tokenGroup(p.category) ? 'token' : 'component' };
};

/** A filter: a button that reads "Status  Waiting", opening a list of checkboxes. */
function FilterMenu({ name, kind, picked, choices, onChange }: { name: string; kind: 'status' | 'asked' | 'product'; picked: string[]; choices: FilterChoice[]; onChange: (v: string[]) => void }) {
  const value = filterValue(kind, picked, choices);
  return (
    <Menu>
      <MenuTrigger
        render={
          <button type="button" className="lr-filter" aria-label={`${name}: ${value}`}>
            <span className="lr-filter-name">{name}</span>
            <span className="lr-filter-value">{value}</span>
            <Icon icon={ChevronDown} size="sm" aria-hidden="true" />
          </button>
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
  if (!p.asked) return <span className="lr-ask is-lead">{p.mine ? 'From you' : p.by ? `From ${p.by}` : 'From the DS lead'}</span>;
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

function Tag({ p, viewerReviews }: { p: ReviewPiece; viewerReviews: boolean }) {
  const d = decidedTag(p);
  if (d)
    return (
      <Badge tone={d.tone} size="md" className={statusTagClass(d.tone)}>
        {d.label}
      </Badge>
    );
  if (p.conflict)
    return (
      <Badge tone="danger" size="md" className={statusTagClass('danger')}>
        2 ways
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
 * One side of a piece, drawn from its data: a color as a swatch, a space as a bar, a corner as a shape, a type size as
 * "Aa"; anything else as the change's own thumbnail (a component, docs). Data values, not style literals.
 */
function Sample({ spec, side, size }: { spec: ThumbSpec; side: 'before' | 'after'; size: 'row' | 'card' }) {
  const big = size === 'card';
  if (spec.kind === 'color') {
    const hex = spec[side];
    return hex ? <span className={`lr-swatch${big ? ' is-big' : ''}`} style={{ background: hex }} /> : <span className="lr-plate-none">none</span>;
  }
  if (spec.kind === 'space' || spec.kind === 'radius' || spec.kind === 'type') {
    const v = spec[side];
    if (v === null) return <span className="lr-plate-none">none</span>;
    const max = Math.max(spec.before ?? 0, spec.after ?? 0, 1);
    const room = big ? 160 : 40;
    if (spec.kind === 'space') return <span className="lr-space" style={{ width: `${Math.round((v / max) * room)}px` }} />;
    if (spec.kind === 'radius') return <span className={`lr-corner${big ? ' is-big' : ''}`} style={{ borderRadius: `${Math.min(v, big ? 32 : 12)}px` }} />;
    return (
      <span className="lr-glyph" style={{ fontSize: `${Math.round((v / max) * (big ? 56 : 18))}px` }}>
        Aa
      </span>
    );
  }
  if (spec.kind === 'image') return <img className="lr-img" src={spec[side]} alt="" loading="lazy" decoding="async" />;
  return <BranchThumb spec={spec} size={size} />;
}

/** The before side is empty for something new. */
const isNew = (p: ReviewPiece) => /^New\b/.test(p.kind) || p.kind === 'Docs';

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

function Detail({ p, thumbs, viewer, lead, tech, onAct, onComment, busy }: { p: ReviewPiece; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; lead: string | null; tech: string | null; onAct: (p: ReviewPiece, a: Act) => void; onComment: (p: ReviewPiece, text: string) => Promise<void>; busy: boolean }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => {
    setCommenting(false);
    setText('');
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
      <p className="lr-eyebrow">{eyebrow}</p>
      <h2 className="lr-detail-title" id="lr-detail-title">
        {p.title}
      </h2>
      {!p.conflict && (
        <p className="lr-detail-ask">
          <AskedChip p={p} />
          {p.asked?.designer && <span className="lr-muted">{p.mine ? 'You asked for it' : `${p.asked.designer} asked for it`}</span>}
          {(p.state === 'decided' || !decides) && <Tag p={p} viewerReviews={viewer.reviews} />}
        </p>
      )}
      {p.conflict ? (
        <>
          <p className="lr-lede">{conflictLede(p)}</p>
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
                  <BranchThumb spec={{ kind: 'screen', src: null, screen: w.exploration, product: w.product, seed: w.key }} size="card" chip={null} />
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
              {valued || !isNew(p) ? <Sample spec={spec} side="before" size="card" /> : none}
            </Plate>
            <Plate caption={p.match ? 'Asked for' : 'With this change'} value={valueOf(spec, 'after') ?? p.after}>
              <Sample spec={spec} side="after" size="card" />
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
  return (
    <div className="lr-one">
      <nav className="lr-side" aria-label="Pieces">
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
                  <button type="button" className="lr-side-row" aria-current={current === p.key ? 'true' : undefined} onClick={() => onPick(p.key)}>
                    <span className="lr-side-main">
                      <span className="lr-side-title">{p.title}</span>
                      <span className="lr-muted lr-side-sub">{p.conflict ? p.conflict.ways.map((w) => w.exploration).join(', ') : (p.asked?.name ?? (p.mine ? 'From you' : 'From the DS lead'))}</span>
                    </span>
                    {p.conflict && !p.conflict.pick ? (
                      <Badge tone="danger" size="sm" className={statusTagClass('danger')}>
                        2 ways
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

function ListView({ groups, thumbs, viewer, tech, secondLead, selected, onSelect, onAsk }: { groups: ReturnType<typeof joinSmallGroups>; thumbs: Map<string, ThumbSpec>; viewer: ReviewData['viewer']; tech: string | null; secondLead: string | null; selected: Set<string>; onSelect: (keys: string[], on: boolean) => void; onAsk: (p: ReviewPiece) => void }) {
  const pickable = groups.flatMap((g) => g.pieces.filter((p) => batchable(p, viewer)));
  const allOn = pickable.length > 0 && pickable.every((p) => selected.has(p.key));
  const someOn = pickable.some((p) => selected.has(p.key));
  const lead_ = viewer.reviews;
  return (
    <div className={`lr-list${lead_ ? ' is-lead' : ''}`} role="table" aria-label="Library pieces">
      {lead_ && (
        <div className="lr-list-head" role="row">
          <span role="columnheader" className="lr-col-box">
            {pickable.length > 0 && <Checkbox label={<VisuallyHidden>{"Select every piece you can decide"}</VisuallyHidden>} checked={allOn} indeterminate={!allOn && someOn} onCheckedChange={(on) => onSelect(pickable.map((p) => p.key), on)} />}
          </span>
          <span role="columnheader" className="lr-col-thumb">
            Today › After
          </span>
          <span role="columnheader">Piece</span>
          <span role="columnheader">Asked by</span>
          <span role="columnheader" className="lr-col-end">
            Status
          </span>
        </div>
      )}
      {groups.map((g) => {
        const inGroup = g.pieces.filter((p) => batchable(p, viewer));
        const on = inGroup.length > 0 && inGroup.every((p) => selected.has(p.key));
        const some = inGroup.some((p) => selected.has(p.key));
        return (
          <div key={g.key} role="rowgroup" className="lr-list-group">
            {lead_ && <div role="row" className="lr-group-row">
              {lead_ && (
                <span role="cell" className="lr-col-box">
                  {inGroup.length > 0 && <Checkbox label={<VisuallyHidden>{`Select ${g.label}`}</VisuallyHidden>} checked={on} indeterminate={!on && some} onCheckedChange={(v) => onSelect(inGroup.map((p) => p.key), v)} />}
                </span>
              )}
              <span role="cell" className="lr-group-label">
                <span className="lr-group-name">{g.label}</span>
                <span className="lr-muted">{g.note ?? `${g.pieces.length} ${g.pieces.length === 1 ? 'piece' : 'pieces'}`}</span>
              </span>
            </div>}
            {g.pieces.map((p) => {
              const spec = thumbOf(p, thumbs);
              const actor = viewer.reviews ? nextActor(p, { tech, secondLead }) : null;
              return (
                <div role="row" key={p.key} className={`lr-row${selected.has(p.key) ? ' is-selected' : ''}`}>
                  {lead_ && (
                    <span role="cell" className="lr-col-box">
                      {batchable(p, viewer) && <Checkbox label={<VisuallyHidden>{`Select ${p.title}`}</VisuallyHidden>} checked={selected.has(p.key)} onCheckedChange={(v) => onSelect([p.key], v)} />}
                    </span>
                  )}
                  <span role="cell" className="lr-col-thumb lr-pair" aria-hidden="true">
                    <span className={`lr-mini${isNew(p) && !(spec.kind === 'color' || spec.kind === 'space') ? ' is-none' : ''}`}>{isNew(p) && !(spec.kind === 'color' || spec.kind === 'space') ? <span className="lr-plate-none">none</span> : <Sample spec={spec} side="before" size="row" />}</span>
                    <Icon icon={ArrowRight} size="xs" className="lr-arrow" />
                    <span className="lr-mini">
                      <Sample spec={spec} side="after" size="row" />
                    </span>
                  </span>
                  <span role="cell" className="lr-row-piece">
                    <span className="lr-row-title">{p.title}</span>
                    <span className="lr-muted lr-row-kind">{p.kind}</span>
                  </span>
                  <span role="cell" className="lr-row-ask">
                    {p.conflict ? p.conflict.ways.map((w) => <span key={w.key} className="lr-ask">{w.exploration}</span>) : p.mine && !p.asked ? null : <AskedChip p={p} />}
                  </span>
                  {/* Only what differs from the group's state: an exception, who acts next, a decided tag. */}
                  <span role="cell" className="lr-col-end lr-row-end">
                    {p.conflict && !p.conflict.pick ? (
                      <Badge tone="danger" size="md" className={statusTagClass('danger')}>
                        2 ways
                      </Badge>
                    ) : decidedTag(p) ? (
                      <Tag p={p} viewerReviews={false} />
                    ) : actor ? (
                      <span className="lr-who">
                        <Avatar name={actor.name} size="xs" decorative />
                        <span>{actor.label}</span>
                        {p.source.kind === 'change' && (
                          <Menu>
                            <MenuTrigger render={<IconButton icon={Ellipsis} label={`More actions on ${p.title}`} variant="ghost" size="sm" />} />
                            <MenuContent align="end">
                              <MenuItem onClick={() => onAsk(p)} data-demo-write="ask someone else to review">
                                Ask someone else
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        )}
                      </span>
                    ) : p.exception ? (
                      <span className="lr-muted">{p.exception}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
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
}

export function LibraryReviewView({ load, send, comment, ask, demo, openDemo, links }: LibraryReviewProps) {
  const [data, setData] = useState<ReviewData | null>(null);
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
    if (data && !params) setParams(reviewParams(location.search, { reviews: data.viewer.reviews }));
  }, [data, params]);

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
  // A designer reads the list (lr-designer): nothing to decide one by one.
  const view = reviews ? (params?.view ?? 'one') : 'list';
  const shown = useMemo(() => pieces.filter((p) => passes(p, filters)), [pieces, filters]);
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
      onValueChange={(v) => update(filters, v === 'list' ? 'list' : 'one')}
      items={[
        { value: 'one', label: 'One by one' },
        { value: 'list', label: 'List' },
      ]}
    />
  );

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
      {actions && v.reviews && createPortal(viewSwitch, actions)}
      {data.failed && <p className="lr-notice" role="alert">{data.failed}</p>}
      {nothingWaits && !filtered ? (
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
              detail={<Detail p={cur} thumbs={data.thumbs} viewer={v} lead={data.lead} tech={data.tech} onAct={act} busy={busy} onComment={(p, t) => (demo() ? Promise.resolve(openDemo()) : comment(p, t).then(setNotice, (e: Error) => setNotice(e.message)))} />}
            />
          ) : (
            <ListView groups={groups} thumbs={data.thumbs} viewer={v} tech={data.tech} secondLead={data.secondLead} onAsk={(p) => (demo() ? openDemo() : void ask(p).then(setNotice, (e: Error) => setNotice(e.message)))} selected={selected} onSelect={(keys, on) => setSelected((s) => { const c = new Set(s); for (const k of keys) on ? c.add(k) : c.delete(k); return c; })} />
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
  return (
    <LibraryReviewView
      load={loadLibraryReview}
      send={(p, a) => (a.kind === 'pick' ? pickWay(p, a.way, readViewer().name) : decide(p, a.kind))}
      comment={commentOn}
      ask={askOther}
      demo={exploringDemo}
      openDemo={() => void openMakeItYours('decide library pieces')}
      links={links}
    />
  );
}
