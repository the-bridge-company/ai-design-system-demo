// "Who gets it" (board lr-reach): one piece of Library review and who gets it, opened from the reach link of One by one
// and List (?reach=<piece>). The origin in one plain sentence, then per product the screens Bridge knows (the preview
// captures of the explorations that asked, the same capture as their card), with a Today / With this change / Side
// by side switch and "Show all N" per product. Products whose screens Bridge cannot list are named once, plainly. The
// lead decides at the bottom, the same decision as One by one. Rules: lib/library-reach.ts. Styles:
// styles/library-review.css (lr-reach-*).
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Link, SegmentedControl } from '@bridge-ds/react';
import { ChevronLeft } from 'lucide-react';
import { BranchThumb } from './BranchThumb';
import { isNew, Sample, thumbOf } from './LibraryReviewSample';
import { effectLine, originSentence, shownScreens, type Reach, type ReachScreen } from '../../../lib/library-reach';
import { canDecide, keepLabel, tokenGroup, type ReviewPiece, type Viewer } from '../../../lib/library-review';
import type { ThumbSpec } from '../../../lib/branch-thumb';

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

function ScreenCard({ s, p, mode, spec, thumbs }: { s: ReachScreen; p: ReviewPiece; mode: Mode; spec: ThumbSpec | undefined; thumbs: Map<string, ThumbSpec> }) {
  const screen: ThumbSpec = spec ?? { kind: 'screen', src: null, screen: s.name, seed: s.key };
  const look = thumbOf(p, thumbs);
  const today = isNew(p) && !(look.kind === 'color' || look.kind === 'space') ? <span className="lr-plate-none">Not in the library yet</span> : <Sample spec={look} side="before" size="card" title={p.title} />;
  const art =
    mode === 'with' ? (
      <BranchThumb spec={screen} size="card" chip={null} />
    ) : mode === 'today' ? (
      <span className="lr-reach-today">{today}</span>
    ) : (
      <span className="lr-reach-side">
        <span className="lr-reach-today">{today}</span>
        <BranchThumb spec={screen} size="card" chip={null} />
      </span>
    );
  const body = (
    <>
      <span className="lr-reach-art">{art}</span>
      <span className="lr-reach-foot">
        <span className="lr-reach-name">{s.name}</span>
        {s.designer && <span className="lr-muted lr-reach-by">{s.designer}</span>}
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

export function ReachPage({ p, reach, screens, thumbs, viewer, busy, onBack, backHref, onAct, onCompare }: { p: ReviewPiece; reach: Reach; screens: Map<string, ThumbSpec>; thumbs: Map<string, ThumbSpec>; viewer: Viewer; busy: boolean; onBack: () => void; backHref: string; onAct: (a: ReachAct) => void; onCompare: () => void }) {
  const [mode, setMode] = useState<Mode>('with');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // Opened from a link: the title takes the focus, as a new page would.
  useEffect(() => {
    titleRef.current?.focus();
  }, [p.key]);
  const origin = originSentence(p, viewer.name);
  const withScreens = reach.products.filter((x) => x.screens.length);
  const without = reach.products.filter((x) => !x.screens.length);
  const decides = canDecide(p, viewer);
  const screenKeyOf = (s: ReachScreen) => `${(s.productKey ?? '').toLowerCase()}#${s.number}`;
  return (
    <article className="lr-reach" aria-labelledby="lr-reach-title">
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
        <h1 className="lr-reach-title" id="lr-reach-title" tabIndex={-1} ref={titleRef}>
          Who gets {p.title}
        </h1>
        {withScreens.length > 0 && (
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
      {/* One line: where it comes from, then what it does to screens. The products are the sections below. */}
      <p className="lr-reach-origin">
        {origin.before}
        {origin.link && (origin.link.href ? <Link href={origin.link.href}>{origin.link.label}</Link> : origin.link.label)}
        {origin.after} <span className="lr-muted">{effectLine(reach)}</span>
      </p>
      {withScreens.length > 0 && mode !== 'with' && <p className="lr-muted lr-reach-note">Bridge keeps each screen with the change only. Today shows the piece as the library has it now.</p>}
      {withScreens.map((x) => {
        const { shown, more } = shownScreens(x.screens, open.has(x.key));
        return (
          <section key={x.key} className="lr-reach-product" aria-labelledby={`lr-reach-${x.key}`}>
            <header className="lr-reach-product-head">
              <ProductChip as="h2" name={x.name} id={`lr-reach-${x.key}`} />
              <span className="lr-muted">
                {x.screens.length} {x.screens.length === 1 ? 'screen asked for it' : 'screens asked for it'}
              </span>
              {more && (
                <Button variant="link" className="lr-reach-more" onClick={() => setOpen((o) => new Set([...o, x.key]))}>
                  {more}
                </Button>
              )}
            </header>
            <div className="lr-reach-grid">
              {shown.map((s) => (
                <ScreenCard key={s.key} s={s} p={p} mode={mode} spec={screens.get(screenKeyOf(s))} thumbs={thumbs} />
              ))}
            </div>
          </section>
        );
      })}
      {without.length > 0 && (
        <p className="lr-reach-unknown">
          <span className="lr-reach-unknown-names">
            {without.map((x) => (
              <ProductChip key={x.key} name={x.name} />
            ))}
          </span>
          <span className="lr-muted">{`No screen listed yet: Bridge does not know which of ${without.length === 1 ? 'its' : 'their'} screens use it.`}</span>
        </p>
      )}
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
            {withScreens.length > 0 && <span className="lr-muted lr-actions-note">Screens come from each exploration's last preview.</span>}
          </div>
        </div>
      )}
    </article>
  );
}
