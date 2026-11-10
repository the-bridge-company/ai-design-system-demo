// "Who gets it" (board LR5): one piece of Library review and the screens it changes, opened from the reach link of One
// by one and List (?reach=<piece>). Under the title, what it changes in one line ("11 screens in 2 products: buttons
// and links."), then where it comes from, then per product the screens that change, measured by the capture robot on
// each product's live version (lib/library-reach.ts measuredReach): Today, With this change, or both Side by side,
// always the same screen. A product appears only when one of its screens changes; the others are named once at the
// end. A piece nobody uses yet shows the screens that asked for it. Until a change is measured, Bridge says so over a
// quiet skeleton, never a guess. The lead decides at the bottom, the same decision as One by one. Styles:
// styles/library-review.css (lr-reach-*).
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Link, SegmentedControl, Skeleton } from '@bridge-ds/react';
import { ChevronLeft } from 'lucide-react';
import { BranchThumb } from './BranchThumb';
import { originSentence, REACH_SHOWN, shownScreens, type Measured, type MeasuredScreen } from '../../../lib/library-reach';
import { canDecide, keepLabel, tokenGroup, type ReviewPiece, type Viewer } from '../../../lib/library-review';
import { reachImageSrc } from '../../../scripts/library-reach-data';

type Mode = 'today' | 'with' | 'side';

export type ReachAct = { kind: 'add' | 'keep' | 'existing' };

/** A product as a chip: its initial in a small mark, then its name (the Map's product boxes, Who gets it's sections). */
export function ProductChip({ name, as: Tag = 'span', id }: { name: string; as?: 'span' | 'h2'; id?: string }) {
  return (
    <Tag className="lr-product" id={id}>
      <span className="lr-product-mark" aria-hidden="true">
        {name.trim().replace(/^acme\s+/i, '').charAt(0).toUpperCase() || '?'}
      </span>
      <span className="lr-product-name">{name}</span>
    </Tag>
  );
}

/** A screen image of the measurement (Bridge's own read when it needs the person's token). */
function Shot({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(src.startsWith('/api/') ? null : src);
  useEffect(() => {
    let live = true;
    void reachImageSrc(src).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [src]);
  return url ? <img className="lr-reach-img" src={url} alt={alt} loading="lazy" decoding="async" /> : <span className="lr-reach-img" role="img" aria-label={alt} />;
}

function Side({ s, side, piece }: { s: MeasuredScreen; side: 'before' | 'after'; piece: string }) {
  if (side === 'before')
    return s.before ? (
      <Shot src={s.before} alt={`${s.title} today`} />
    ) : (
      <span className="lr-reach-none">
        <span>Not in the product yet</span>
      </span>
    );
  const a = s.after;
  if (a?.kind === 'screen' && a.src && !s.href) return <Shot src={a.src} alt={`${s.title} with ${piece}`} />;
  return a ? <BranchThumb spec={a} size="card" chip={null} /> : null;
}

function ScreenCard({ s, mode, piece }: { s: MeasuredScreen; mode: Mode; piece: string }) {
  const art =
    mode === 'side' ? (
      <span className="lr-reach-pair">
        <Side s={s} side="before" piece={piece} />
        <Side s={s} side="after" piece={piece} />
      </span>
    ) : (
      <Side s={s} side={mode === 'today' ? 'before' : 'after'} piece={piece} />
    );
  const body = (
    <>
      <span className="lr-reach-art">{art}</span>
      <span className="lr-reach-foot">
        <span className="lr-reach-name">{s.title}</span>
        {(s.words ?? s.designer) && <span className="lr-muted lr-reach-by">{s.words ?? s.designer}</span>}
      </span>
    </>
  );
  return s.href ? (
    <Link className="lr-reach-card" href={s.href} variant="subtle">
      {body}
    </Link>
  ) : (
    <span className="lr-reach-card">{body}</span>
  );
}

/** The quiet place of the cards while Bridge measures: no count, no guess. */
function Measuring() {
  return (
    <div className="lr-reach-grid" aria-busy="true" aria-label="Bridge is measuring which screens change">
      {Array.from({ length: REACH_SHOWN }, (_, i) => (
        <span key={i} className="lr-reach-card lr-reach-wait">
          <Skeleton variant="rect" className="lr-reach-skel" />
          <span className="lr-reach-foot">
            <Skeleton variant="text" width="40%" />
          </span>
        </span>
      ))}
    </div>
  );
}

export function ReachPage({ p, measured, viewer, busy, onBack, backHref, onAct, onCompare }: { p: ReviewPiece; measured: Measured; viewer: Viewer; busy: boolean; onBack: () => void; backHref: string; onAct: (a: ReachAct) => void; onCompare: () => void }) {
  const [mode, setMode] = useState<Mode>('with');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // Opened from a link: the title takes the focus, as a new page would.
  useEffect(() => {
    titleRef.current?.focus();
  }, [p.key]);
  const origin = originSentence(p, viewer.name);
  const m = measured;
  const decides = canDecide(p, viewer);
  const hasScreens = m.products.length > 0;
  return (
    <article className={`lr-reach${mode === 'side' ? ' is-side' : ''}`} aria-labelledby="lr-reach-title">
      <Link
        href={backHref}
        className="lr-reach-back"
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
      >
        <Icon icon={ChevronLeft} size="sm" /> Library review
      </Link>
      <div className="lr-reach-head">
        <div className="lr-reach-titles">
          <h1 className="lr-reach-title" id="lr-reach-title" tabIndex={-1} ref={titleRef}>
            Who gets {p.title}
          </h1>
          <p className="lr-reach-sentence" aria-live="polite">
            {m.headline}
          </p>
        </div>
        {hasScreens && (
          <SegmentedControl
            label="How the screens are shown"
            value={mode}
            onValueChange={(v) => setMode(v === 'today' ? 'today' : v === 'side' ? 'side' : 'with')}
            items={[
              { value: 'today', label: 'Today' },
              { value: 'with', label: 'With this change' },
              { value: 'side', label: 'Side by side' },
            ]}
          />
        )}
      </div>
      <p className="lr-reach-origin lr-muted">
        {origin.before}
        {origin.link && (origin.link.href ? <Link href={origin.link.href}>{origin.link.label}</Link> : origin.link.label)}
        {origin.after}
      </p>
      {m.status === 'measuring' && <Measuring />}
      {m.products.map((x) => {
        const { shown, more } = shownScreens(x.screens, open.has(x.key));
        return (
          <section key={x.key} className="lr-reach-product" aria-labelledby={`lr-reach-${x.key}`}>
            <header className="lr-reach-product-head">
              <ProductChip as="h2" name={x.name} id={`lr-reach-${x.key}`} />
              <span className="lr-muted">{`${x.screens.length} ${x.screens.length === 1 ? 'screen' : 'screens'}`}</span>
              {more && (
                <Button variant="link" className="lr-reach-more" onClick={() => setOpen((o) => new Set([...o, x.key]))}>
                  {more}
                </Button>
              )}
            </header>
            <div className="lr-reach-grid">
              {shown.map((s) => (
                <ScreenCard key={s.key} s={s} mode={mode} piece={p.title} />
              ))}
            </div>
          </section>
        );
      })}
      {m.end && m.end !== m.headline && <p className="lr-reach-end lr-muted">{m.end}</p>}
      {(decides || p.conflict) && (
        <div className="lr-decide lr-reach-decide">
          <div className="lr-actions">
            {p.conflict ? (
              <Button variant="primary" size="lg" onClick={onCompare}>
                Compare the two ways
              </Button>
            ) : (
              <>
                {p.match ? (
                  <>
                    <Button variant="primary" size="lg" disabled={busy} onClick={() => onAct({ kind: 'existing' })} data-demo-write="decide library pieces">
                      Use {p.match.label}
                    </Button>
                    <Button variant="secondary" size="lg" disabled={busy} onClick={() => onAct({ kind: 'add' })} data-demo-write="decide library pieces">
                      Add as a new {tokenGroup(p.category)?.word ?? 'piece'}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="lg" disabled={busy} onClick={() => onAct({ kind: 'add' })} data-demo-write="decide library pieces">
                    Add to the library
                  </Button>
                )}
                {p.asked && (
                  <Button variant="secondary" size="lg" disabled={busy} onClick={() => onAct({ kind: 'keep' })} data-demo-write="decide library pieces">
                    {keepLabel(p)}
                  </Button>
                )}
              </>
            )}
            {hasScreens && <span className="lr-muted lr-actions-note">{m.status === 'measured' ? "Screens come from each product's live version." : "Screens come from each exploration's last preview."}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
