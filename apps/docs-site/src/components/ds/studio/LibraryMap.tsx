// The Map view of Library review (board lr-map): where each piece comes from, what changes in the library, who gets
// it, in three columns linked by curves (lib/library-map buildMap). The map is only a way in (owner, 2026-11-13): under it
// sits the List itself (LibraryReview ListView, the same rows, checkboxes, hover controls and decisions, from the same
// state), every piece while no box is picked. Clicking a box narrows that List ("Showing what <exploration> asks for ·
// 3 of 14 · Show all 14", said once; one piece picked keeps the count, its row names it). The picked box is in the
// address (?focus=), so a link opens it. A conflict is two links into one piece, its box tagged "2 ways" (the DS tag).
// The curves are measured from the boxes once laid out, so they follow any width and any number of boxes.
// Styles: styles/library-review.css (lr-map-*).
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Button } from '@bridge-ds/react';
import { buildMap, focusOf, mapLinkId, mapListOf, readMapFocus, withMapFocus, type MapGraph } from '../../../lib/library-map';
import type { ReachProductInput } from '../../../lib/library-reach';
import type { ReviewPiece, Viewer } from '../../../lib/library-review';
import { foldColumn, waysTag } from '../../../lib/library-askers';
import { ProductChip } from './LibraryReach';

interface Curve {
  id: string;
  d: string;
  conflict: boolean;
}

/** A box of the map: a toggle button that narrows the list (pressed while it does). */
function MapBox({ id, label, sub, kind, pressed, lit, quiet, conflict, dashed, onPick, refOf }: { id: string; label: string; sub?: string; kind: 'source' | 'piece' | 'product'; pressed: boolean; lit: boolean; quiet: boolean; conflict?: boolean; dashed?: boolean; onPick: (id: string) => void; refOf: (id: string, el: HTMLElement | null) => void }) {
  const cls = ['lr-map-box', `is-${kind}`, pressed ? 'is-pressed' : '', lit ? 'is-lit' : '', quiet ? 'is-quiet' : '', conflict ? 'is-conflict' : '', dashed ? 'is-dashed' : ''].filter(Boolean).join(' ');
  return (
    // bridge-audit-ignore-next-line: a map box is one toggle target holding a name and a line under it; the DS has no toggle card and Button would cut it to one label
    <button type="button" className={cls} aria-pressed={pressed} ref={(el) => refOf(id, el)} onClick={() => onPick(id)}>
      {kind === 'product' ? <ProductChip name={label} /> : <span className="lr-map-label">{label}</span>}
      {/* A conflict's "2 ways" is the DS tag, the same as in the list (C9), never an amber box. */}
      {sub && (conflict ? (
        <span className="lr-map-sub">
          <Badge tone="neutral" size="sm">
            {sub}
          </Badge>
        </span>
      ) : (
        <span className="lr-map-sub">{sub}</span>
      ))}
    </button>
  );
}

/**
 * `list` draws the List with the pieces given (null: every piece, the List as it is); `onNarrow` runs when a box narrows
 * the list or Show all widens it, as a filter change does in the List (the selection clears).
 */
export function MapView({ pieces, products, viewer, list, onNarrow }: { pieces: ReviewPiece[]; products: ReachProductInput[]; viewer: Viewer; list: (shown: ReviewPiece[] | null) => ReactNode; onNarrow: () => void }) {
  const graph: MapGraph = useMemo(() => buildMap(pieces, products, viewer), [pieces, products, viewer]);
  const [picked, setPickedState] = useState<string | null>(() => (typeof location === 'undefined' ? null : readMapFocus(location.search)));
  const setPicked = (id: string | null) => {
    setPickedState(id);
    if (typeof location !== 'undefined') history.replaceState(history.state, '', `${location.pathname}${withMapFocus(location.search, id)}`);
  };
  const focus = picked ? focusOf(graph, picked) : null;
  const listed = mapListOf(focus);
  const wrap = useRef<HTMLDivElement | null>(null);
  const boxes = useRef(new Map<string, HTMLElement>());
  const [curves, setCurves] = useState<Curve[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // An exploration column past 10 boxes folds the rest into one "+N more" box, unfolded on click.
  const [unfolded, setUnfolded] = useState(false);
  const folded = foldColumn(graph.sources, unfolded);
  const hidden = new Set(graph.sources.slice(folded.shown.length).map((x) => x.id));

  // A box picked on a map that changed (a filter, a decision) and is no longer there: the list shows everything again.
  useLayoutEffect(() => {
    if (picked && graph.pieces.length && !focusOf(graph, picked)) setPicked(null);
  }, [graph, picked]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const draw = () => {
      const r = el.getBoundingClientRect();
      const out: Curve[] = [];
      for (const l of graph.links) {
        // A folded source draws its link from the "+N more" box.
        const a = (boxes.current.get(l.from) ?? (hidden.has(l.from) ? boxes.current.get('s:more') : undefined))?.getBoundingClientRect();
        const b = boxes.current.get(l.to)?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.right - r.left;
        const y1 = a.top + a.height / 2 - r.top;
        const x2 = b.left - r.left;
        const y2 = b.top + b.height / 2 - r.top;
        const dx = Math.max((x2 - x1) / 2, 0);
        out.push({ id: mapLinkId(l), d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, conflict: l.conflict });
      }
      setSize({ w: r.width, h: r.height });
      setCurves(out);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph, unfolded]);

  const refOf = (id: string, el: HTMLElement | null) => {
    if (el) boxes.current.set(id, el);
    else boxes.current.delete(id);
  };
  const showAll = () => {
    setPicked(null);
    onNarrow();
  };
  const pick = (id: string) => {
    setPicked(picked === id ? null : id);
    onNarrow();
  };
  const state = (id: string) => ({ pressed: picked === id, lit: Boolean(focus?.lit.has(id)), quiet: Boolean(focus && !focus.lit.has(id)) });
  const shown = focus ? pieces.filter((p) => focus.keys.has(p.key)) : pieces;
  // Lit links draw last, over the quiet ones.
  const ordered = [...curves].sort((a, b) => Number(Boolean(focus?.lit.has(a.id))) - Number(Boolean(focus?.lit.has(b.id))));

  return (
    <>
      <section className="lr-map" aria-label="Where each piece comes from and who gets it">
        <div className="lr-map-grid" ref={wrap}>
          <svg className="lr-map-links" width={size.w} height={size.h} viewBox={`0 0 ${size.w || 1} ${size.h || 1}`} aria-hidden="true" focusable="false">
            {ordered.map((c) => (
              <path key={c.id} d={c.d} className={`lr-map-link${c.conflict ? ' is-conflict' : ''}${focus?.lit.has(c.id) ? ' is-lit' : ''}${focus && !focus.lit.has(c.id) ? ' is-quiet' : ''}`} />
            ))}
          </svg>
          <div className="lr-map-col">
            <h3 className="lr-map-head">Where it comes from</h3>
            <div className="lr-map-stack is-spread">
              {folded.shown.map((s) => (
                <MapBox key={s.id} id={s.id} label={s.label} sub={s.sub} kind="source" dashed={s.lead} onPick={pick} refOf={refOf} {...state(s.id)} />
              ))}
              {folded.more > 0 && <MapBox id="s:more" label={`+${folded.more}`} sub="Show every exploration" kind="source" pressed={false} lit={false} quiet={Boolean(focus)} onPick={() => setUnfolded(true)} refOf={refOf} />}
            </div>
          </div>
          <div className="lr-map-col">
            <h3 className="lr-map-head">What changes in the library</h3>
            <div className="lr-map-stack">
              {graph.pieces.map((n) => (
                <MapBox key={n.id} id={n.id} label={n.label} sub={n.conflict ? waysTag(pieces.find((p) => p.key === n.keys[0])?.conflict?.ways.length ?? 2) : undefined} kind="piece" conflict={n.conflict} onPick={pick} refOf={refOf} {...state(n.id)} />
              ))}
            </div>
          </div>
          <div className="lr-map-col">
            <h3 className="lr-map-head">Who gets it</h3>
            <div className="lr-map-stack is-spread">
              {graph.products.length ? (
                graph.products.map((p) => <MapBox key={p.id} id={p.id} label={p.label} kind="product" onPick={pick} refOf={refOf} {...state(p.id)} />)
              ) : (
                <p className="lr-muted lr-map-none">No product in Bridge yet</p>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* Under the map: the List, every piece, or what a picked box narrows to under one line. */}
      {listed.kind === 'some' && focus ? (
        <section className="lr-map-list" aria-label={listed.named ? `${focus.line.before}${focus.line.strong}${focus.line.after}` : `${shown.length} of ${pieces.length}`}>
          <div className="lr-map-focus" role="status">
            <p className="lr-map-focus-text">
              {listed.named && (
                <>
                  {focus.line.before}
                  <strong>{focus.line.strong}</strong>
                  {focus.line.after}
                </>
              )}
              <Badge tone="neutral" size="sm" className={listed.named ? 'lr-map-focus-count' : undefined}>
                {shown.length} of {pieces.length}
              </Badge>
            </p>
            <Button variant="link" onClick={showAll}>
              Show all {pieces.length}
            </Button>
          </div>
          {list(shown)}
        </section>
      ) : (
        list(null)
      )}
    </>
  );
}
