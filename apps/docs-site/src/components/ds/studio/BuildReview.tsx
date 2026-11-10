// Check the build, region by region (Studio review mode, /studio/<team>/explorations/review/?exploration=N&product=K):
// a focused full screen over Studio, opened from the exploration page at Check the build. Top bar: Back, whose build
// and which round, the three sizes with their counts, Use the real build, how many differences the reader looked at.
// Left: the list of where the build differs (laptop sizes, then phone only), what stays approved from an earlier round,
// then the handover notes (read only, with Open the build yourself). Middle: the build, the approved design or both,
// with each difference outlined and numbered (dashed when the developer mentions it). Right: one difference (its
// sentence, its measured facts, Fine as built or Fix this, the others' answers, comments pinned on the picture), or
// the final answer. On a phone: one difference per screen. Words and rules: lib/build-review-view.ts; data:
// scripts/build-review-data.ts.
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Laptop, MessageSquare, Monitor, Smartphone } from 'lucide-react';
import { Button, IconButton, Link, Progress, SegmentedControl, Textarea } from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { Who } from './faces';
import { Drawing } from './Drawing';
import { studioHref } from '../../../lib/team-path';
import {
  REVIEW_WORDS as W,
  SIZE_WORDS,
  boxPercent,
  changesText,
  factWords,
  groupsOf,
  otherCheckers,
  sizeCounts,
  standing,
  whenWords,
  type NoteThread,
  type ReviewItem,
  type ReviewRead,
  type ReviewSize,
  type Side,
  type SizeKey,
  type Verdict,
} from '../../../lib/build-review-view';
import type { ReviewTarget } from '../../../scripts/build-review-data';

type Load = { s: 'loading' } | { s: 'error'; message: string } | { s: 'not-ready' } | { s: 'ready'; d: ReviewRead };
type Canvas = 'b' | 'a' | 'both';
type Sent = { kind: 'fixes'; n: number } | { kind: 'ok' } | { kind: 'design' } | null;
const data = () => import('../../../scripts/build-review-data');

function targetOfPage(): ReviewTarget {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  return { number: Number(q.get('exploration')) || 0, product: (q.get('product') ?? '').toLowerCase() };
}

/** A measured picture: read with the reader's token when they signed in with GitHub. */
function Shot({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void data()
      .then((m) => m.imageSrc(url))
      .then((s) => live && setSrc(s))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [url]);
  return src ? <img className={className} src={src} alt={alt} draggable={false} /> : <span className={`${className ?? ''} brv-shot-wait`} role="img" aria-label={alt} />;
}

function useNarrow(): boolean {
  const q = '(max-width: 700px)';
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

export default function BuildReview() {
  const target = useMemo(targetOfPage, []);
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [team, setTeam] = useState('');
  const [host, setHost] = useState<HTMLElement | null>(null);

  // The review mode sits over Studio: its own layer on the page, the rest inert while it is open.
  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'brv-host';
    document.body.appendChild(el);
    const others = [...document.body.children].filter((c) => c !== el && !c.hasAttribute('inert'));
    for (const c of others) c.setAttribute('inert', '');
    setHost(el);
    return () => {
      for (const c of others) c.removeAttribute('inert');
      el.remove();
    };
  }, []);

  const read = () =>
    data()
      .then(async (m) => {
        setTeam(await m.teamOfPage());
        return m.loadReview(target);
      })
      .then((d) => setLoad(d ? { s: 'ready', d } : { s: 'not-ready' }))
      .catch((e: Error) => setLoad({ s: 'error', message: e?.message || W.failed }));
  useEffect(() => {
    void read();
  }, []);
  // While Bridge measures: read again every minute, the page fills in by itself.
  const waiting = load.s === 'ready' && (!load.d.review || load.d.review.head !== load.d.head);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void read(), 60_000);
    return () => clearInterval(t);
  }, [waiting]);

  const back = studioHref(`explorations/?exploration=${target.number}&product=${encodeURIComponent(target.product)}`);
  if (!host) return null;
  const body =
    load.s === 'ready' ? (
      <Review d={load.d} team={team} target={target} back={back} onData={(d) => setLoad({ s: 'ready', d })} />
    ) : (
      <div className="brv brv-plain">
        <header className="brv-top">
          <ButtonLink href={back} variant="ghost" size="md" iconStart={ChevronLeft}>
            {W.back}
          </ButtonLink>
        </header>
        <div className="brv-calm" role="status">
          {load.s !== 'loading' && <Drawing name="review" width={160} />}
          <p>{load.s === 'loading' ? W.reading : load.s === 'not-ready' ? W.notReady : load.message}</p>
          {load.s !== 'loading' && (
            <ButtonLink href={back} variant="secondary" size="md">
              {W.backToExploration}
            </ButtonLink>
          )}
        </div>
      </div>
    );
  return createPortal(body, host);
}

function Review({ d, team, target, back, onData }: { d: ReviewRead; team: string; target: ReviewTarget; back: string; onData: (d: ReviewRead) => void }) {
  const narrow = useNarrow();
  const m = d.review;
  const builder = d.pull.builderName ?? d.pull.builder ?? 'the developer';
  const designer = d.designerName ?? 'the designer';
  const items = m?.items ?? [];
  const [local, setLocal] = useState<Record<string, Verdict | null>>({});
  const st = standing(items, d.items, local);
  // At the size of the difference it opens at, else the laptop (a phone on a phone).
  const [size, setSize] = useState<SizeKey>(() => {
    const want = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('item');
    return narrow ? 'phone' : (items.find((i) => i.sig === want)?.sizes[0] ?? 'laptop');
  });
  const [canvas, setCanvas] = useState<Canvas>(() => (new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('item') ? 'both' : 'b'));
  // Opened from a crop of the exploration page (?item=<sig>), or from Start the check (?item=first): at that difference.
  const [sel, setSel] = useState<string | 'answer' | null>(() => {
    const want = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('item');
    const open = standing(items, d.items, {}).open;
    const g = groupsOf(open);
    const first = [...g.wide, ...g.phone][0];
    return want === 'first' ? (first?.sig ?? null) : want && items.some((i) => i.sig === want) ? want : null;
  });
  const [notes, setNotes] = useState<NoteThread[]>(d.notes);
  const [said, setSaid] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);
  const [showKept, setShowKept] = useState(false);
  const canAnswer = Boolean(d.role);
  const groups = groupsOf(st.open);
  const ordered = [...groups.wide, ...groups.phone];
  const item = typeof sel === 'string' && sel !== 'answer' ? (items.find((i) => i.sig === sel) ?? null) : null;
  const counts = sizeCounts(items);
  const others = otherCheckers(d.rows, d.role, { designer, pm: d.pm });
  const sz = m?.sizes.find((s) => s.key === size) ?? null;
  const shotUrl = (name: string) => imageUrl(team, d.code, d.pull.number, m!.run, name);

  const pick = (it: ReviewItem) => {
    setSel(it.sig);
    if (!it.sizes.includes(size)) setSize(it.sizes[0]!);
    setCanvas('both');
  };
  const say = (it: ReviewItem, v: Verdict) => {
    const next = st.verdict[it.sig] === v ? null : v;
    setLocal((x) => ({ ...x, [it.sig]: next }));
    void data()
      .then((x) => x.sayItem(target, it.sig, next))
      .then((states) => onData({ ...d, items: states }))
      .catch((e: Error) => {
        setLocal((x) => {
          const { [it.sig]: _gone, ...rest } = x;
          return rest;
        });
        setSaid(e.message);
      });
    // The next difference not looked at yet, once this one has its answer.
    if (next) {
      const after = ordered.slice(ordered.indexOf(it) + 1).find((x) => !st.verdict[x.sig] && x.sig !== it.sig);
      if (after) setTimeout(() => pick(after), 250);
    }
  };
  const step = (dir: 1 | -1) => {
    const i = item ? ordered.indexOf(item) : -1;
    const next = ordered[Math.max(0, Math.min(ordered.length - 1, i + dir))];
    if (next) pick(next);
  };

  const top = (
    <header className="brv-top">
      <ButtonLink href={back} variant="ghost" size="md" iconStart={ChevronLeft} className="brv-back">
        {narrow ? undefined : W.back}
      </ButtonLink>
      <div className="brv-title">
        <h1>{W.title(builder)}</h1>
        <span className="brv-muted">{narrow && item ? W.phoneOf(ordered.indexOf(item) + 1, ordered.length) : W.sub(d.exploration.name, d.round)}</span>
      </div>
      {!narrow && m && (
        <SegmentedControl
          className="brv-sizes"
          label={W.sizes}
          value={size}
          onValueChange={(v) => setSize(v as SizeKey)}
          items={(['laptop', 'small', 'phone'] as const).map((k) => ({ value: k, icon: k === 'laptop' ? Laptop : k === 'small' ? Monitor : Smartphone, label: <>{SIZE_WORDS[k]} <span className="brv-count">{counts[k]}</span></> }))}
        />
      )}
      {!narrow && m?.urls.build && (
        <ButtonLink href={m.urls.build} target="_blank" rel="noopener" variant="secondary" size="md" iconEnd={ExternalLink}>
          {W.realBuild}
        </ButtonLink>
      )}
      <span className="brv-grow" />
      {m && st.open.length > 0 && (
        <div className="brv-progress">
          {!narrow && <span className="brv-muted">{W.progress(st.looked, st.open.length)}</span>}
          <Progress value={st.looked} max={st.open.length} size="sm" aria-label={W.progress(st.looked, st.open.length)} />
        </div>
      )}
      {!narrow && (
        <span className="brv-faces">
          {d.rows
            .filter((r) => r.required)
            .map((r) => {
              const name = r.byName ?? (r.role === 'designer' ? designer : r.role === 'pm' ? (d.pm ?? 'Product manager') : 'Design lead');
              return <Who key={r.role} p={{ login: name, name }} size="sm" decorative={false} />;
            })}
        </span>
      )}
    </header>
  );

  if (!m) {
    return (
      <div className="brv brv-plain">
        {top}
        <div className="brv-calm" role="status">
          <Drawing name="review" width={160} />
          <p>{W.measuring(builder)}</p>
        </div>
      </div>
    );
  }

  const answer = (
    <Answer
      d={d}
      st={st}
      builder={builder}
      designer={designer}
      others={others}
      target={target}
      shotUrl={shotUrl}
      sent={sent}
      back={back}
      onSent={(s) => setSent(s)}
      onError={setSaid}
    />
  );

  const side = item ? (
    <ItemPanel
      d={d}
      it={item}
      index={ordered.indexOf(item) + 1}
      total={ordered.length}
      verdict={st.verdict[item.sig] ?? null}
      builder={builder}
      canAnswer={canAnswer}
      notes={notes.filter((n) => n.sig === item.sig)}
      onSay={(v) => say(item, v)}
      onDesign={() => setSel('answer')}
      onNotes={setNotes}
      target={target}
      onError={setSaid}
    />
  ) : null;

  if (narrow) {
    const cur = item ?? ordered[0] ?? null;
    if (!cur || sel === 'answer') {
      return (
        <div className="brv brv-phone">
          {top}
          <div className="brv-phone-body">{answer}</div>
        </div>
      );
    }
    const i = ordered.indexOf(cur);
    return (
      <div className="brv brv-phone">
        {top}
        <div className="brv-phone-body">
          <div className="brv-phone-nav">
            <SegmentedControl label={W.canvas} value={canvas === 'a' ? 'a' : 'b'} onValueChange={(v) => setCanvas(v as Canvas)} items={[{ value: 'a', label: 'Approved' }, { value: 'b', label: W.build }]} />
            <span className="brv-grow" />
            <IconButton icon={ChevronLeft} label={W.previous} variant="secondary" disabled={i <= 0} onClick={() => step(-1)} />
            {i < ordered.length - 1 ? <IconButton icon={ChevronRight} label={W.next} variant="secondary" onClick={() => step(1)} /> : <IconButton icon={ChevronRight} label={W.sendAnswer} variant="secondary" onClick={() => setSel('answer')} />}
          </div>
          <Crop it={cur} side={canvas === 'a' ? 'a' : 'b'} shotUrl={shotUrl} notes={notes.filter((n) => n.sig === cur.sig)} />
          <ItemPanel d={d} it={cur} index={i + 1} total={ordered.length} verdict={st.verdict[cur.sig] ?? null} builder={builder} canAnswer={canAnswer} notes={notes.filter((n) => n.sig === cur.sig)} onSay={(v) => say(cur, v)} onDesign={() => setSel('answer')} onNotes={setNotes} target={target} onError={setSaid} phone />
        </div>
        <div className="brv-phone-bar">
          <div className="brv-actions">
            <Button variant="secondary" size="lg" pressed={st.verdict[cur.sig] === 'fine'} disabled={!canAnswer} onClick={() => say(cur, 'fine')}>
              {W.fine}
            </Button>
            <Button variant="secondary" size="lg" pressed={st.verdict[cur.sig] === 'fix'} disabled={!canAnswer} onClick={() => say(cur, 'fix')}>
              {W.fix}
            </Button>
          </div>
        </div>
        {said && <p className="brv-said" role="status">{said}</p>}
      </div>
    );
  }

  const ready = st.open.length > 0 && st.looked === st.open.length;
  return (
    <div className={`brv ${item || sel === 'answer' ? 'is-three' : ''}`}>
      {top}
      <div className="brv-body">
        <aside className="brv-list" aria-label={W.differs}>
          <div className="brv-scroll">
            <ItemList title={W.differs} list={groups.wide} st={st} sel={item?.sig ?? null} meant={d.meant} builder={builder} onPick={pick} count={st.open.length} />
            {groups.phone.length > 0 && <ItemList title={W.phoneOnly} icon list={groups.phone} st={st} sel={item?.sig ?? null} meant={d.meant} builder={builder} onPick={pick} />}
            {st.kept.length > 0 && (
              <div className="brv-kept">
                <Button variant="ghost" size="sm" onClick={() => setShowKept((x) => !x)} aria-expanded={showKept}>
                  {W.staysApproved(st.kept.length, d.round)}
                </Button>
                {showKept && (
                  <ul className="brv-items">
                    {st.kept.map((it) => (
                      <li key={it.sig}>
                        {/* bridge-audit-ignore-next-line: the whole difference row (number, name, sentence) is one target that opens it, like the review queue rows; the DS has no row button and Button would cut it to one label */}
                        <button type="button" className="brv-item" onClick={() => pick(it)}>
                          <span className="brv-num is-fine">{it.n}</span>
                          <span className="brv-item-text">
                            <span className="brv-item-name">{it.name}</span>
                            <span className="brv-muted">{it.line}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {d.fixed.length > 0 && <p className="brv-muted brv-note">{W.fixedSince(d.fixed.length)}</p>}
            <Handover d={d} url={m.urls.build} />
          </div>
          <div className="brv-end">
            <span className="brv-muted">{!canAnswer ? W.readOnly : ready ? W.allLooked : W.lookFirst(st.open.length - st.looked)}</span>
            <Button variant={ready && sel !== 'answer' ? 'primary' : 'secondary'} size="lg" fullWidth disabled={!canAnswer} onClick={() => setSel('answer')}>
              {W.sendAnswer}
            </Button>
          </div>
        </aside>
        <section className="brv-canvas" aria-label={W.canvas}>
          <div className="brv-bar">
            <SegmentedControl label={W.canvas} value={canvas} onValueChange={(v) => setCanvas(v as Canvas)} items={[{ value: 'b', label: W.build }, { value: 'a', label: W.approved }, { value: 'both', label: W.both }]} />
            <span className="brv-muted">{item ? `${W.of(ordered.indexOf(item) + 1, ordered.length)} · ${item.name}` : sz ? `${SIZE_WORDS[size]}, ${sz.width} wide` : ''}</span>
            <span className="brv-grow" />
            {item ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSel(null)}>
                  {W.wholePage}
                </Button>
                <IconButton icon={ChevronLeft} label={W.previous} size="sm" onClick={() => step(-1)} />
                <IconButton icon={ChevronRight} label={W.next} size="sm" onClick={() => step(1)} />
              </>
            ) : (
              m.ignored > 0 && <span className="brv-muted">{W.ignored(m.ignored)}</span>
            )}
          </div>
          <div className="brv-stage">
            {m.head !== d.head && <p className="brv-older brv-muted">{W.olderMeasure}</p>}
            {item ? (
              <ItemStage it={item} canvas={canvas} builder={builder} shotUrl={shotUrl} notes={notes.filter((n) => n.sig === item.sig)} canAnswer={canAnswer} target={target} onNotes={setNotes} onError={setSaid} />
            ) : sz ? (
              <PageStage sz={sz} canvas={canvas} items={st.open} st={st} meant={d.meant} builder={builder} shotUrl={shotUrl} onPick={pick} />
            ) : null}
          </div>
          {sz && <Minimap sz={sz} items={st.open} sel={item?.sig ?? null} shotUrl={shotUrl} onPick={pick} />}
        </section>
        {(item || sel === 'answer') && <aside className="brv-side">{item ? side : answer}</aside>}
      </div>
      {said && (
        <p className="brv-said" role="status">
          {said}
        </p>
      )}
    </div>
  );
}

function ItemList({ title, icon, list, st, sel, meant, builder, onPick, count }: { title: string; icon?: boolean; list: ReviewItem[]; st: ReturnType<typeof standing>; sel: string | null; meant: string[]; builder: string; onPick: (it: ReviewItem) => void; count?: number }) {
  if (!list.length) return null;
  return (
    <div className="brv-group">
      <h2 className="brv-group-h">
        <span>
          {icon && <Smartphone aria-hidden="true" />}
          {title}
        </span>
        {count !== undefined && <span>{count}</span>}
      </h2>
      <ul className="brv-items">
        {list.map((it) => {
          const v = st.verdict[it.sig];
          return (
            <li key={it.sig}>
              {/* bridge-audit-ignore-next-line: the whole difference row (number, name, sentence, its answer) is one target that opens it, like the review queue rows; the DS has no row button and Button would cut it to one label */}
              <button type="button" className={`brv-item ${sel === it.sig ? 'is-sel' : ''}`} aria-current={sel === it.sig ? 'true' : undefined} onClick={() => onPick(it)}>
                <span className={`brv-num ${v === 'fix' ? 'is-fix' : v === 'fine' ? 'is-fine' : ''}`}>{it.n}</span>
                <span className="brv-item-text">
                  <span className="brv-item-name">{it.name}</span>
                  <span className="brv-muted">{it.line}</span>
                </span>
                <span className={`brv-item-state ${v === 'fix' ? 'is-fix' : v === 'fine' ? 'is-fine' : ''}`}>{v === 'fix' ? 'Fix' : v === 'fine' ? 'Fine' : meant.includes(it.sig) ? `${builder} mentions it` : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Handover({ d, url }: { d: ReviewRead; url: string | null }) {
  const rows = [...d.handover.decisions.map((t) => ({ k: W.decision, t })), ...d.handover.edgeCases.map((e) => ({ k: `${W.edgeCase}${e.component !== 'General' ? `, ${e.component}` : ''}`, t: e.state }))];
  if (!rows.length) return null;
  return (
    <div className="brv-group">
      <h2 className="brv-group-h">
        <span>{W.notes}</span>
        <span>{rows.length}</span>
      </h2>
      <ul className="brv-notes">
        {rows.map((r, i) => (
          <li key={i}>
            <span className="brv-muted">{r.k}</span>
            <span>{r.t}</span>
          </li>
        ))}
      </ul>
      {url && (
        <Link href={url} target="_blank" rel="noopener" external className="brv-note">
          {W.openYourself}
        </Link>
      )}
    </div>
  );
}

/** The whole page at one size: the build, the approved design or both, each difference outlined and numbered. */
function PageStage({ sz, canvas, items, st, meant, builder, shotUrl, onPick }: { sz: ReviewSize; canvas: Canvas; items: ReviewItem[]; st: ReturnType<typeof standing>; meant: string[]; builder: string; shotUrl: (n: string) => string; onPick: (it: ReviewItem) => void }) {
  const sides: Side[] = canvas === 'both' ? ['a', 'b'] : [canvas];
  return (
    <div className={`brv-pages ${sides.length === 2 ? 'is-both' : ''} ${sz.key === 'phone' ? 'is-phone' : ''}`}>
      {sides.map((side) => {
        const shot = sz[side];
        const label = side === 'b' ? W.builtBy(builder) : W.approved;
        if (!shot) {
          return (
            <figure key={side} className="brv-page">
              <figcaption className="brv-muted">{label}</figcaption>
              <p className="brv-calm-line">{W.noPage(side, sz.key)}</p>
            </figure>
          );
        }
        return (
          <figure key={side} className="brv-page">
            {sides.length === 2 && <figcaption className="brv-muted">{label}</figcaption>}
            <div className="brv-frame">
              <Shot url={shotUrl(shot.image)} alt={label} className="brv-img" />
              {items
                .filter((it) => it.boxes[sz.key]?.[side])
                .map((it) => {
                  const raw = it.boxes[sz.key]![side]!;
                  const box = boxPercent(raw, shot);
                  const v = st.verdict[it.sig];
                  const wide = raw[2] * raw[3] > shot.pageW * Math.min(shot.pageH, sz.height * 1.5) * 0.3;
                  return (
                    // bridge-audit-ignore-next-line: an outlined region drawn over the picture at the measured place, with its number; no DS control is a positioned outline
                    <button key={it.sig} type="button" className={`brv-region ${wide ? 'is-wide' : ''} ${meant.includes(it.sig) ? 'is-meant' : ''} ${v ? `is-${v}` : ''}`} style={box} onClick={() => onPick(it)} aria-label={`${it.n}. ${it.name}: ${it.line}`}>
                      <span className="brv-pin">{it.n}</span>
                    </button>
                  );
                })}
            </div>
          </figure>
        );
      })}
      {items.length === 0 && <p className="brv-calm-line">{W.noDifference}</p>}
    </div>
  );
}

/** Where it is: the whole build small, its differences marked, the one open strong; a click opens another. */
function Minimap({ sz, items, sel, shotUrl, onPick }: { sz: ReviewSize; items: ReviewItem[]; sel: string | null; shotUrl: (n: string) => string; onPick: (it: ReviewItem) => void }) {
  const side: Side = sz.b ? 'b' : 'a';
  const shot = sz[side];
  if (!shot) return null;
  return (
    <figure className="brv-mini">
      <figcaption className="brv-muted">{W.whereItIs}</figcaption>
      <div className="brv-frame">
        <Shot url={shotUrl(shot.image)} alt="" className="brv-img" />
        {items
          .filter((it) => it.boxes[sz.key]?.[side])
          .map((it) => (
            // bridge-audit-ignore-next-line: a mark on the small map at the measured place, a mouse shortcut only (the list is the keyboard path); no DS control is a positioned outline
            <button key={it.sig} type="button" tabIndex={-1} aria-hidden="true" className={`brv-mini-box ${sel === it.sig ? 'is-sel' : ''}`} style={boxPercent(it.boxes[sz.key]![side]!, shot)} onClick={() => onPick(it)} />
          ))}
      </div>
    </figure>
  );
}

/** One difference's crop on one side, with the comments pinned on it; a click places a new one. */
function Crop({ it, side, shotUrl, notes, onPlace, placing }: { it: ReviewItem; side: Side; shotUrl: (n: string) => string; notes: NoteThread[]; onPlace?: (x: number, y: number) => void; placing?: { x: number; y: number } | null }) {
  const name = side === 'a' ? it.crop.a : it.crop.b;
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPlace) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPlace((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  if (!name) return <p className="brv-calm-line">{W.noPage(side, it.crop.size)}</p>;
  return (
    <div className={`brv-crop ${onPlace ? 'can-pin' : ''}`} onClick={click}>
      <Shot url={shotUrl(name)} alt={`${it.name}, ${side === 'a' ? W.approved : W.build}`} className="brv-img" />
      {notes
        .filter((n) => n.side === side && !n.resolved)
        .map((n, i) => (
          <span key={n.id} className="brv-note-pin" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }} aria-hidden="true">
            {i + 1}
          </span>
        ))}
      {placing && <span className="brv-note-pin is-new" style={{ left: `${placing.x * 100}%`, top: `${placing.y * 100}%` }} aria-hidden="true" />}
    </div>
  );
}

function ItemStage({ it, canvas, builder, shotUrl, notes, canAnswer, target, onNotes, onError }: { it: ReviewItem; canvas: Canvas; builder: string; shotUrl: (n: string) => string; notes: NoteThread[]; canAnswer: boolean; target: ReviewTarget; onNotes: (n: NoteThread[]) => void; onError: (s: string) => void }) {
  const [placing, setPlacing] = useState<{ side: Side; x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPlacing(null);
    setText('');
  }, [it.sig]);
  const sides: Side[] = canvas === 'both' ? ['a', 'b'] : [canvas];
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!placing || !text.trim()) return;
    setBusy(true);
    void data()
      .then((m) => m.addNote(target, { sig: it.sig, size: it.crop.size, side: placing.side, x: placing.x, y: placing.y, text: text.trim() }))
      .then((n) => {
        onNotes(n);
        setPlacing(null);
        setText('');
      })
      .catch((e2: Error) => onError(e2.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="brv-item-stage">
      <div className={`brv-pair ${sides.length === 2 ? 'is-both' : ''}`}>
        {sides.map((side) => (
          <figure key={side} className="brv-page">
            <figcaption>
              <strong>{side === 'a' ? W.approved : W.builtBy(builder)}</strong>
            </figcaption>
            <Crop it={it} side={side} shotUrl={shotUrl} notes={notes} onPlace={canAnswer ? (x, y) => setPlacing({ side, x, y }) : undefined} placing={placing?.side === side ? placing : null} />
          </figure>
        ))}
      </div>
      {canAnswer &&
        (placing ? (
          <form className="brv-pin-form" onSubmit={send}>
            <Textarea label={W.pinHere} rows={2} value={text} onChange={(e) => setText(e.target.value)} autoFocus hint={W.pinReach(builder)} />
            <div className="brv-actions">
              <Button type="button" variant="secondary" size="md" onClick={() => setPlacing(null)}>
                {W.pinCancel}
              </Button>
              <Button type="submit" variant="secondary" size="md" loading={busy} disabled={!text.trim()}>
                {W.pinSend}
              </Button>
            </div>
          </form>
        ) : (
          <p className="brv-muted brv-pin-hint">
            <MessageSquare aria-hidden="true" />
            {W.pinHint}
          </p>
        ))}
    </div>
  );
}

function ItemPanel({ d, it, index, total, verdict, builder, canAnswer, notes, onSay, onDesign, onNotes, target, onError, phone }: { d: ReviewRead; it: ReviewItem; index: number; total: number; verdict: Verdict | null; builder: string; canAnswer: boolean; notes: NoteThread[]; onSay: (v: Verdict) => void; onDesign: () => void; onNotes: (n: NoteThread[]) => void; target: ReviewTarget; onError: (s: string) => void; phone?: boolean }) {
  const state = d.items.find((s) => s.sig === it.sig);
  return (
    <div className="brv-panel">
      <div>
        <span className="brv-muted brv-kicker">
          {phone ? `${it.name} · ${W.where(it.sizes)}` : `${W.of(index, total)} · ${W.where(it.sizes)}`}
        </span>
        <h2 className="brv-h">{phone ? it.line : it.name}</h2>
      </div>
      {!phone && <p>{it.line}</p>}
      <dl className="brv-facts">
        {it.facts.map((f, i) => {
          const w = factWords(f);
          return (
            <div key={i}>
              <dt>{w.label}</dt>
              <dd>
                {w.colors ? (
                  <>
                    <span className="brv-color" title={w.colors.was.hex}>
                      <span className="brv-swatch" style={{ background: w.colors.was.css }} aria-hidden="true" />
                      <s>{w.colors.was.name}</s>
                    </span>{' '}
                    →{' '}
                    <span className="brv-color" title={w.colors.now.hex}>
                      <span className="brv-swatch" style={{ background: w.colors.now.css }} aria-hidden="true" />
                      {w.colors.now.name}
                    </span>
                  </>
                ) : (
                  <>
                    {w.was !== null && (
                      <>
                        <s>{w.was}</s> →{' '}
                      </>
                    )}
                    {w.now}
                  </>
                )}
                {f.n > 1 ? ` (${f.n} places)` : ''}
              </dd>
            </div>
          );
        })}
      </dl>
      {d.meant.includes(it.sig) && <p className="brv-muted">{W.meant(builder)}</p>}
      {state?.askedBefore && <p className="brv-muted">{W.askedBefore}</p>}
      {!phone && (
        <div className="brv-ask">
          <span className="brv-ask-h">{W.question}</span>
          <div className="brv-actions">
            <Button variant="secondary" size="lg" pressed={verdict === 'fine'} disabled={!canAnswer} onClick={() => onSay('fine')}>
              {W.fine}
            </Button>
            <Button variant="secondary" size="lg" pressed={verdict === 'fix'} disabled={!canAnswer} onClick={() => onSay('fix')}>
              {W.fix}
            </Button>
          </div>
          {canAnswer && (
            <span className="brv-muted">
              {W.orDesign}{' '}
              <Button variant="link" size="sm" onClick={onDesign}>
                {W.changeDesign}
              </Button>
            </span>
          )}
        </div>
      )}
      {state && state.others.length > 0 && (
        <div className="brv-section">
          <span className="brv-muted">{W.othersOn}</span>
          <ul className="brv-others">
            {state.others.map((o) => (
              <li key={o.role}>
                <Who p={{ login: o.byName, name: o.byName }} size="xs" />
                <span>
                  {o.byName}: {W.said(o.verdict)}, <span className="brv-muted">{whenWords(o.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Threads notes={notes} canAnswer={canAnswer} target={target} onNotes={onNotes} onError={onError} />
    </div>
  );
}

function Threads({ notes, canAnswer, target, onNotes, onError }: { notes: NoteThread[]; canAnswer: boolean; target: ReviewTarget; onNotes: (n: NoteThread[]) => void; onError: (s: string) => void }) {
  const [reply, setReply] = useState<Record<string, string>>({});
  if (!notes.length) return null;
  const act = (p: Promise<NoteThread[]>) =>
    p.then(onNotes).catch((e: Error) => {
      onError(e.message);
    });
  return (
    <div className="brv-section">
      <span className="brv-muted">{W.comments}</span>
      <ol className="brv-threads">
        {notes.map((n, i) => (
          <li key={n.id} className={n.resolved ? 'is-resolved' : ''}>
            <div className="brv-msg">
              <span className="brv-note-pin is-static" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{n.byName}</strong> <span className="brv-muted">{whenWords(n.at)}</span>
                <br />
                {n.text}
              </span>
            </div>
            {n.replies.map((r, j) => (
              <div key={j} className="brv-msg is-reply">
                <Who p={{ login: r.byName, name: r.byName }} size="xs" />
                <span>
                  <strong>{r.byName}</strong> <span className="brv-muted">{whenWords(r.at)}</span>
                  <br />
                  {r.text}
                </span>
              </div>
            ))}
            {n.resolved && <span className="brv-muted">{W.resolvedBy(n.resolved.byName)}</span>}
            {canAnswer && (
              <form
                className="brv-reply"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = (reply[n.id] ?? '').trim();
                  if (!t) return;
                  void act(data().then((m) => m.replyNote(target, n.id, t))).then(() => setReply((x) => ({ ...x, [n.id]: '' })));
                }}
              >
                <Textarea aria-label={W.reply} placeholder={W.reply} rows={1} value={reply[n.id] ?? ''} onChange={(e) => setReply((x) => ({ ...x, [n.id]: e.target.value }))} />
                <div className="brv-actions">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void act(data().then((m) => m.resolveNote(target, n.id, !n.resolved)))}>
                    {n.resolved ? W.reopen : W.resolve}
                  </Button>
                  <Button type="submit" variant="secondary" size="sm" disabled={!(reply[n.id] ?? '').trim()}>
                    {W.replySend}
                  </Button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Answer({ d, st, builder, designer, others, target, shotUrl, sent, back, onSent, onError }: { d: ReviewRead; st: ReturnType<typeof standing>; builder: string; designer: string; others: string[]; target: ReviewTarget; shotUrl: (n: string) => string; sent: Sent; back: string; onSent: (s: Sent) => void; onError: (s: string) => void }) {
  const [note, setNote] = useState('');
  const [design, setDesign] = useState(false);
  const [busy, setBusy] = useState(false);
  const fixes = st.fixes;
  const kept = st.fine.length + st.kept.length;
  const unlooked = st.open.length - st.looked;
  if (sent) {
    return (
      <div className="brv-panel brv-sent" role="status">
        <span className="brv-kicker brv-signal">{sent.kind === 'fixes' ? W.sentKicker(builder) : W.done}</span>
        <h2 className="brv-h">{sent.kind === 'fixes' ? W.sentFixes(builder, sent.n) : sent.kind === 'ok' ? W.sentOk : W.sentDesign(designer)}</h2>
        <p>{sent.kind === 'ok' ? W.sentOkLine : W.sentLine(others)}</p>
        <Drawing name="fix" width={120} />
        <div className="brv-actions">
          <ButtonLink href={back} variant="secondary" size="lg">
            {W.backToExploration}
          </ButtonLink>
        </div>
      </div>
    );
  }
  const go = (a: Parameters<typeof import('../../../scripts/build-review-data')['sendAnswer']>[1], s: Sent) => {
    setBusy(true);
    void data()
      .then((m) => m.sendAnswer(target, a))
      .then(() => onSent(s))
      .catch((e: Error) => onError(e.message))
      .finally(() => setBusy(false));
  };
  if (design) {
    return (
      <form
        className="brv-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) go({ kind: 'changes', why: 'design', text: note.trim() }, { kind: 'design' });
        }}
      >
        <div>
          <span className="brv-muted brv-kicker">{W.answerKicker}</span>
          <h2 className="brv-h">{W.designInstead}</h2>
        </div>
        <Textarea label={W.designLabel(designer)} rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="brv-actions">
          <Button type="button" variant="secondary" size="lg" onClick={() => setDesign(false)}>
            {W.pinCancel}
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!note.trim()}>
            {W.sendDesign}
          </Button>
        </div>
      </form>
    );
  }
  return (
    <form
      className="brv-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (fixes.length) go({ kind: 'changes', why: 'build', text: changesText(fixes, note) }, { kind: 'fixes', n: fixes.length });
        else go({ kind: 'looks-right' }, { kind: 'ok' });
      }}
    >
      <div>
        <span className="brv-muted brv-kicker">{W.answerKicker}</span>
        <h2 className="brv-h">{fixes.length ? W.needsChanges : W.looksRight}</h2>
      </div>
      <p>{W.answerLine(fixes.length, kept, d.round)}</p>
      {fixes.length > 0 && (
        <ul className="brv-fixes">
          {fixes.map((f) => (
            <li key={f.sig}>
              {f.crop.b ? <Shot url={shotUrl(f.crop.b)} alt={f.name} className="brv-fix-img" /> : <span className="brv-fix-img" />}
              <span>
                <strong>
                  {f.n}. {f.name}
                </strong>
                <span className="brv-muted">{f.line}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {unlooked > 0 && <p className="brv-muted">{W.stillOpen(unlooked)}</p>}
      {fixes.length > 0 && <Textarea label={W.noteLabel(builder)} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      <div className="brv-actions">
        <Button type="button" variant="secondary" size="lg" onClick={() => setDesign(true)}>
          {W.designInstead}
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          {fixes.length ? W.sendTo(builder) : W.sayLooksRight}
        </Button>
      </div>
      <span className="brv-muted">{W.othersAnswer(others)}</span>
    </form>
  );
}

// The picture addresses need the data module synchronously once loaded: a tiny copy of imageUrl (no fetch).
function imageUrl(team: string, code: string, pull: number, run: string, name: string): string {
  const q = new URLSearchParams({ repo: team, buildImage: '1', code, pull: String(pull), run, name });
  return `/api/contribute?${q}`;
}

