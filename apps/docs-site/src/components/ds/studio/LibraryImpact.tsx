// "What this changes in the library" (boards LI1 to LI5, LI8, EB1 to EB4): the section every exploration page has, and
// Review all shows inside each exploration. One summary line first, then one row per piece (what it is, before and
// after, one status tag, its ⋯ menu for the lead), and what else comes from the library. A piece several explorations
// change differently shows every way in the same card, side by side under its row: the lead picks there (the one place
// the choice is offered), everyone else reads it, and once settled it says what the library gets. Nothing to change is
// the best outcome: a Field Guide moment, never a bare line. View model: lib/library-impact-view.ts; data and writes:
// scripts/library-impact.ts. Styles: styles/library-impact.css.
import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowRight, Check, Ellipsis, TriangleAlert } from 'lucide-react';
import { Accordion, AccordionItem, Avatar, Badge, Button, ButtonGroup, Card, Checkbox, Dialog, DialogClose, DialogContent, Icon, IconButton, Input, Menu, MenuContent, MenuItem, MenuTrigger, Radio, RadioGroup, Skeleton, Textarea, Tooltip } from '@bridge-ds/react';
import { Drawing } from './Drawing';
import { Who } from './faces';
import { keepLabel, pickOf, PIECE_ACTION_HINT, PIECE_ACTION_LABEL, type ConflictView, type DecidedView, type ImpactRowView, type ImpactSide, type LibraryImpactView, type PieceAction, type Said, type WayLook, type WayView } from '../../../lib/library-impact-view';
import { nameFace } from '../../../lib/people';
import { statusTagClass } from '../../../lib/status-tag';

export interface LibraryImpactActions {
  /** The lead answers one piece; `input` is what to change, or the piece to use instead. */
  onPiece?: ((piece: string, action: PieceAction, input?: string) => Promise<string | void>) | null;
  /** The lead keeps one way, or several as sizes, where explorations change the same component differently. */
  onChoose?: ((piece: string, pick: string) => Promise<string | void>) | null;
  /** The lead takes the choice back: the ways wait for a choice again. */
  onUndo?: ((piece: string) => Promise<string | void>) | null;
  /** A word on the ways: the lead's reaches every screen that asked, the designer's reaches the lead. */
  onComment?: ((piece: string, text: string) => Promise<string | void>) | null;
  /** The designer replies to the lead's "Use an existing piece instead": the piece goes back to the lead with the reason. */
  onReply?: ((piece: string, text: string) => Promise<string | void>) | null;
}

/** How many ways show before "Show N more": ten screens asking still read as one card. */
const WAYS_SHOWN = 3;

export function LibraryImpact({ view, actions = {}, say, headingLevel = 2 }: { view: LibraryImpactView; actions?: LibraryImpactActions; say: (s: string) => void; headingLevel?: 2 | 3 }) {
  const id = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  if (view.state === 'loading')
    return (
      <section className="li-section" aria-label="What this changes in the library">
        <Skeleton variant="rect" className="li-skel" />
      </section>
    );
  if (view.state === 'nothing')
    return (
      <section className="li-section li-nothing" aria-labelledby={`${id}-h`}>
        <Drawing name="components" width={148} className="li-art" label="Every piece already sits in the library" />
        <div className="li-nothing-text">
          <p className="li-kind li-kind-strong">What this changes in the library</p>
          <H className="li-display" id={`${id}-h`}>
            Nothing. Every piece comes from the library.
          </H>
          <p className="li-lead">{view.line}</p>
          {view.uses.length > 0 && (
            <ul className="li-chips" aria-label="Pieces it uses from the library">
              {view.uses.map((u) => (
                <li key={u}>
                  <Badge tone="neutral" size="md" className="li-chip">
                    {u}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  if (view.state === 'unchecked')
    return (
      <section className="li-section li-quiet" aria-labelledby={`${id}-h`}>
        <H className="li-title" id={`${id}-h`}>
          What this changes in the library
        </H>
        <p className="li-muted">{view.line}</p>
      </section>
    );
  return (
    <section className="li-section" aria-labelledby={`${id}-h`}>
      <header className="li-head">
        <H className="li-title" id={`${id}-h`}>
          What this changes in the library
        </H>
        <p className="li-muted">{view.summary}</p>
      </header>
      <ul className="li-rows">
        {view.rows.map((r) => {
          const conflict = view.conflicts.find((c) => c.piece === r.id) ?? null;
          if (conflict?.decided)
            return (
              <li key={r.id} className="li-item">
                <Decided d={conflict.decided} piece={r.id} tag={r.status} onUndo={actions.onUndo ?? null} say={say} headingLevel={headingLevel} />
              </li>
            );
          return (
            <li key={r.id} className={conflict ? 'li-item has-conflict' : 'li-item'}>
              <Row row={r} onPiece={actions.onPiece ?? null} onReply={actions.onReply ?? null} say={say} />
              {conflict && <Conflict c={conflict} onChoose={actions.onChoose ?? null} onComment={actions.onComment ?? null} say={say} />}
            </li>
          );
        })}
      </ul>
      {view.reach && (
        <p className="li-foot li-reach">
          <Icon icon={TriangleAlert} size="sm" />
          <span>
            <strong>This token reaches beyond this screen.</strong> {view.reach.line}
          </span>
        </p>
      )}
      {view.uses.length > 0 && (
        <p className="li-foot">
          <Icon icon={Check} size="sm" className="li-ok" />
          <span>Everything else comes from the library: {view.uses.join(', ')}.</span>
        </p>
      )}
    </section>
  );
}

function Side({ side }: { side: ImpactSide }) {
  return (
    <figure className="li-side">
      <span className={side.empty ? 'li-plate is-empty' : 'li-plate'}>{side.label}</span>
      <figcaption className="li-cap">{side.caption}</figcaption>
    </figure>
  );
}

function Row({ row, onPiece, onReply, say }: { row: ImpactRowView; onPiece: LibraryImpactActions['onPiece'] | null; onReply?: LibraryImpactActions['onReply'] | null; say: (s: string) => void }) {
  const [ask, setAsk] = useState<'changes' | 'existing' | null>(null);
  const [replying, setReplying] = useState(false);
  const act = (a: PieceAction, input?: string) =>
    onPiece!(row.id, a, input)
      .then((r) => {
        if (r) say(r);
      })
      .catch((err: Error) => {
        say(err.message);
        throw err;
      });
  return (
    <div className="li-row">
      <div className="li-what">
        <span className="li-kind">{row.kind}</span>
        <strong className="li-name">{row.title}</strong>
        <span className="li-muted">{row.summary}</span>
        {row.note && <span className="li-note">{row.note}</span>}
        {row.reply && onReply && (
          <span className="li-reply">
            <Button variant="secondary" size="sm" data-demo-write="reply to the lead" onClick={() => setReplying(true)}>
              Reply to {row.reply}
            </Button>
          </span>
        )}
        {row.details.length > 0 && (
          <Accordion className="li-details" appearance="flush">
            <AccordionItem value="details" title="Details">
              <dl className="li-dl">
                {row.details.map((d) => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd className="li-mono">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionItem>
          </Accordion>
        )}
      </div>
      {(row.before || row.after) && (
        <div className="li-compare" aria-label={`${row.before ? `${row.before.caption}: ${row.before.label}. ` : ''}${row.after ? `${row.after.caption}: ${row.after.label}.` : ''}`}>
          {row.before && <Side side={row.before} />}
          {row.before && row.after && <Icon icon={ArrowRight} size="sm" className="li-arrow" />}
          {row.after && <Side side={row.after} />}
        </div>
      )}
      <div className="li-status">
        <Badge tone={row.status.tone} size="md" className={statusTagClass(row.status.tone)}>
          {row.status.label}
        </Badge>
      </div>
      <div className="li-menu">
        {onPiece && row.menu.length > 0 && (
          <Menu>
            <Tooltip content={`More about ${row.title}`}>
              <MenuTrigger render={<IconButton icon={Ellipsis} label={`More about ${row.title}`} variant="secondary" size="md" />} />
            </Tooltip>
            <MenuContent align="end">
              {row.menu.map((a) => (
                <MenuItem key={a} data-demo-write="answer a library piece" onClick={() => (a === 'changes' || a === 'existing' ? setAsk(a) : void act(a).catch(() => undefined))}>
                  {PIECE_ACTION_HINT[a] ? (
                    <span className="li-menu-item">
                      {PIECE_ACTION_LABEL[a]}
                      <span className="li-cap">{PIECE_ACTION_HINT[a]}</span>
                    </span>
                  ) : (
                    PIECE_ACTION_LABEL[a]
                  )}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
      {row.reply && onReply && (
        <AskDialog
          open={replying}
          onOpenChange={setReplying}
          title={`Reply to ${row.reply}?`}
          description={`${row.title} goes back to ${row.reply} with your reason. ${row.reply} still decides.`}
          label="Why this piece, not the existing one"
          multiline
          confirm={`Reply to ${row.reply}`}
          onConfirm={(text) =>
            onReply(row.id, text).then(
              (r) => {
                if (r) say(r);
              },
              (err: Error) => {
                say(err.message);
                throw err;
              },
            )
          }
        />
      )}
      {onPiece && (
        <AskDialog
          open={ask !== null}
          onOpenChange={(o) => !o && setAsk(null)}
          title={ask === 'existing' ? `Use an existing piece instead of ${row.title}?` : `Ask for changes on ${row.title}?`}
          description={ask === 'existing' ? 'Say which piece of the library to use. The designer reads it on the exploration.' : 'Only this piece goes back. The screen keeps waiting for your answer.'}
          label={ask === 'existing' ? 'Piece of the library' : 'What to change'}
          multiline={ask !== 'existing'}
          confirm={ask === 'existing' ? 'Use it instead' : 'Ask for changes'}
          onConfirm={(text) => act(ask!, text).then(() => undefined)}
        />
      )}
    </div>
  );
}

/** A sentence that names people (their face first) and screens (in bold). */
function SaidLine({ parts }: { parts: readonly Said[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p.face && <Who p={{ login: nameFace(p.face), name: p.face, agent: false, avatar: null }} size="xs" className="li-face" />}
          {p.strong ? <strong>{p.text}</strong> : p.text}
        </span>
      ))}
    </>
  );
}

/**
 * A small library card drawn with a way's change: its room inside, a fill, no border. The same card on every plate,
 * so only the change differs. Decorative: the words under each plate say the same.
 */
function Specimen({ look }: { look: WayLook | null }) {
  // The way's own values, as recorded (pixels from the check, not from this page's scale): the card is sized by them, so
  // a tighter way draws a smaller card than today's and a roomier one a larger card.
  const vars: Record<string, string> = {};
  if (look?.padding != null) vars['--_pad'] = `${look.padding}px`;
  if (look?.gap != null) vars['--_gap'] = `${look.gap}px`;
  if (look?.radius != null) vars['--_radius'] = `${look.radius}px`;
  const style = Object.keys(vars).length ? (vars as CSSProperties) : undefined;
  const cls = ['li-spec', look?.borderless && 'is-borderless', look?.filled && 'is-filled'].filter(Boolean).join(' ');
  return (
    <Card padding="none" className={cls} style={style} aria-hidden="true">
      <span className="li-spec-in">
        <span className="li-spec-title">Card title on two lines</span>
        <span className="li-spec-row">
          <span className="li-spec-value">$7.5K</span>
          <Avatar name="Ann Lee" size="xs" decorative />
        </span>
        <span className="li-spec-row">
          <Badge tone="neutral" size="sm">
            Tag
          </Badge>
          <Badge tone="neutral" size="sm">
            29 d
          </Badge>
        </span>
      </span>
    </Card>
  );
}

/** A way's plate: its card, and on a phone today's card before it, so each plate still compares with today. */
function Stage({ look, today = false, onPick }: { look: WayLook | null; today?: boolean; onPick?: (() => void) | undefined }) {
  return (
    <div className={today ? 'li-stage is-today' : 'li-stage'} aria-hidden="true" onClick={onPick}>
      {!today && (
        <>
          <span className="li-ghost">
            <Specimen look={null} />
            <span className="li-cap">Today</span>
          </span>
          <span className="li-ghost li-arrow">
            <Icon icon={ArrowRight} size="sm" />
          </span>
        </>
      )}
      <Specimen look={look} />
    </div>
  );
}

const face = (w: WayView) => <Who p={{ login: nameFace(w.designer), name: w.designer, agent: false, avatar: null }} size="xs" className="li-face" />;

/** The way's name with its face, as the radio, the tick or the plain label says it. */
const WayName = ({ w }: { w: WayView }) => (
  <span className="li-way-name">
    {face(w)}
    {w.label}
  </span>
);

/**
 * Several explorations change the same component part (EB1, EB2, three ways and more): one card, plates side by side
 * (today, then each designer's way), a ring on the way kept. The lead picks one way, or keeps several as sizes, and
 * the button says the outcome; everyone else reads the same block with a Comment.
 */
function Conflict({ c, onChoose, onComment, say }: { c: ConflictView; onChoose: LibraryImpactActions['onChoose'] | null; onComment: LibraryImpactActions['onComment'] | null; say: (s: string) => void }) {
  const qid = useId();
  const decides = c.decides && Boolean(onChoose);
  const mine = c.ways.find((w) => w.mine) ?? c.ways[0]!;
  const [mode, setMode] = useState<'one' | 'sizes'>(c.several ? 'sizes' : 'one');
  const [one, setOne] = useState<string>(mine.key);
  const [ticked, setTicked] = useState<string[]>(() => c.ways.map((w) => w.key));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const both = !c.several && one === 'both';
  const kind: 'one' | 'sizes' = mode === 'sizes' || both ? 'sizes' : 'one';
  const keys = mode === 'sizes' ? ticked : both ? c.ways.map((w) => w.key) : [one];
  const pick = pickOf(kind, keys, c.ways);
  const shown = more ? c.ways : c.ways.slice(0, WAYS_SHOWN);
  const hidden = c.ways.length - shown.length;
  const cols = shown.length + (c.several ? 0 : 1);
  const bothHint = `${c.ways.map((w, i) => (i ? w.size.toLowerCase() : w.size)).join(' and ')}, today's stays the default`;
  const choose = () => {
    if (!onChoose || !pick) return;
    setBusy(true);
    onChoose(c.piece, pick)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  const today = (
    <div className="li-way li-way-today">
      <Stage look={null} today />
      <span className="li-way-text">
        <span className="li-way-name">Today</span>
        <span className="li-way-hint">{c.todayHint}</span>
      </span>
    </div>
  );
  const bothPlate = (
    <div className="li-stage li-stage-both" aria-hidden="true" onClick={decides ? () => setOne('both') : undefined}>
      {c.ways.slice(0, 2).map((w) => (
        <span key={w.key} className="li-pair">
          <Specimen look={w.look} />
          <span className="li-cap">{w.size}</span>
        </span>
      ))}
    </div>
  );
  const style = { '--_ways': cols } as CSSProperties;
  let ways;
  if (decides && mode === 'one') {
    ways = (
      <RadioGroup label={`Ways for ${c.component}`} hideLabel value={one} onValueChange={setOne} className="li-ways-set">
        <div className="li-ways" style={style}>
          {today}
          {shown.map((w) => (
            <div key={w.key} className={one === w.key ? 'li-way is-on' : 'li-way'}>
              <Stage look={w.look} onPick={() => setOne(w.key)} />
              <Radio value={w.key} label={<WayName w={w} />} description={w.hint} />
            </div>
          ))}
          {!c.several && (
            <div className={both ? 'li-way is-on' : 'li-way'}>
              {bothPlate}
              <Radio value="both" label={<span className="li-way-name">Both, as two sizes</span>} description={bothHint} />
            </div>
          )}
        </div>
      </RadioGroup>
    );
  } else if (decides) {
    const tick = (k: string, on: boolean) => setTicked((t) => (on ? [...t.filter((x) => x !== k), k] : t.filter((x) => x !== k)));
    ways = (
      <div className="li-ways" style={style} role="group" aria-label={`Ways that become sizes of ${c.component}`}>
        {today}
        {shown.map((w) => {
          const on = ticked.includes(w.key);
          return (
            <div key={w.key} className={on ? 'li-way is-on' : 'li-way'}>
              <Stage look={w.look} onPick={() => tick(w.key, !on)} />
              <Checkbox label={<WayName w={w} />} description={w.hint} checked={on} onCheckedChange={(v) => tick(w.key, v)} />
            </div>
          );
        })}
      </div>
    );
  } else {
    ways = (
      <ul className="li-ways" style={style} aria-label={`Ways for ${c.component}`}>
        <li className="li-way-li li-today-li">{today}</li>
        {shown.map((w) => (
          <li key={w.key} className="li-way-li">
            <div className="li-way">
              <Stage look={w.look} />
              <span className="li-way-text">
                <WayName w={w} />
                <span className="li-way-hint">{w.hint}</span>
              </span>
            </div>
          </li>
        ))}
        {!c.several && (
          <li className="li-way-li">
            <div className="li-way">
              {bothPlate}
              <span className="li-way-text">
                <span className="li-way-name">Both, as two sizes</span>
                <span className="li-way-hint">{bothHint}</span>
              </span>
            </div>
          </li>
        )}
      </ul>
    );
  }
  return (
    <div className="li-decide" role="group" aria-labelledby={qid}>
      <p className="li-q" id={qid}>
        {c.question}
      </p>
      <p className="li-ctx">
        <SaidLine parts={c.context} />
      </p>
      {decides && c.several && (
        <RadioGroup label="How to answer" hideLabel orientation="horizontal" value={mode} onValueChange={(v) => setMode(v as 'one' | 'sizes')} className="li-mode">
          <Radio value="one" label="One way" />
          <Radio value="sizes" label="Keep several as sizes" description="Tick the ways that become sizes. Today stays the default." />
        </RadioGroup>
      )}
      {ways}
      {hidden > 0 && (
        <Button variant="secondary" size="sm" className="li-more" onClick={() => setMore(true)}>
          Show {hidden} more
        </Button>
      )}
      <div className="li-act">
        <p className="li-note">{c.note}</p>
        {(onComment || decides) && (
          <div className="li-btns">
            {onComment && (
              <Button variant="secondary" size="md" data-demo-write="comment on the ways" onClick={() => setCommenting(true)}>
                {c.comment}
              </Button>
            )}
            {decides && (
              <Button variant="primary" size="md" disabled={!pick} loading={busy} onClick={choose} data-demo-write="choose a way for a component">
                {keepLabel(kind, keys, c.ways)}
              </Button>
            )}
          </div>
        )}
      </div>
      {onComment && (
        <AskDialog
          open={commenting}
          onOpenChange={setCommenting}
          title={c.decides ? `${c.comment}?` : `Comment on ${c.component}?`}
          description={c.decides ? `Everyone who changed ${c.component} reads it on their exploration.` : 'The DS lead reads it on this exploration, before choosing.'}
          label="Your comment"
          multiline
          confirm="Send"
          onConfirm={(text) =>
            onComment(c.piece, text).then(
              (r) => {
                if (r) say(r);
              },
              (err: Error) => {
                say(err.message);
                throw err;
              },
            )
          }
        />
      )}
    </div>
  );
}

/** The small line drawing of a settled choice (EB3): two cards drawn in, a check settles on them. */
function DecidedArt() {
  return (
    <svg className="li-dart" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect className="d1" x="6" y="14" width="22" height="28" rx="5" />
      <rect className="d2" x="34" y="8" width="26" height="38" rx="6" />
      <path className="d3" d="M10 52 h44" />
      <circle className="d4" cx="47" cy="50" r="9" />
      <path className="d5" d="M42.5 50.5 l3 3 l6 -6.5" />
    </svg>
  );
}

/**
 * A settled choice (EB3, EB4): what the library gets in one line, who chose and who is told, then today and the ways
 * kept, the one this screen takes ringed. The lead may undo it until the screen is approved.
 */
function Decided({ d, piece, tag, onUndo, say, headingLevel }: { d: DecidedView; piece: string; tag: ImpactRowView['status']; onUndo: LibraryImpactActions['onUndo'] | null; say: (s: string) => void; headingLevel: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h3' : 'h4';
  const [busy, setBusy] = useState(false);
  const undo = () => {
    if (!onUndo) return;
    setBusy(true);
    onUndo(piece)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="li-decided">
      <DecidedArt />
      <div className="li-decided-body">
        <div className="li-decided-head">
          <H className="li-decided-title">{d.title}</H>
          <Badge tone={tag.tone} size="md" className={statusTagClass(tag.tone)}>
            {tag.label}
          </Badge>
        </div>
        <p className="li-muted li-decided-by">
          {d.by} · {d.told}
          {onUndo && (
            <>
              {' · '}
              <Button variant="link" size="sm" loading={busy} onClick={undo} data-demo-write="undo a choice of way" className="li-undo">
                Undo
              </Button>
            </>
          )}
        </p>
        <ul className="li-dgrid" aria-label={`${d.title}: what the library keeps`}>
          {d.plates.map((p) => (
            <li key={p.key} className={p.chip ? 'li-dfig is-mine' : p.today ? 'li-dfig is-today' : 'li-dfig'}>
              <div className="li-dplate">
                <Specimen look={p.look} />
              </div>
              <span className="li-dlab">
                <span className="li-dname">{p.label}</span>
                {p.chip ? (
                  <Badge tone="info" size="sm" className={`${statusTagClass('info')} li-chip-mine`}>
                    {p.chip}
                  </Badge>
                ) : (
                  p.sub && <span className="li-cap">{p.sub}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AskDialog(p: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; label: string; multiline: boolean; confirm: string; onConfirm: (text: string) => Promise<void> }) {
  const formId = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (p.open) {
      setText('');
      setError(null);
    }
  }, [p.open]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setError(p.multiline ? 'Say what to change: the designer reads it.' : 'Say which piece to use.');
    setBusy(true);
    p.onConfirm(text.trim())
      .then(() => p.onOpenChange(false))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open={p.open} onOpenChange={(o) => !busy && p.onOpenChange(o)}>
      <DialogContent
        title={p.title}
        description={p.description}
        size="sm"
        hideClose
        footer={
          <ButtonGroup align="end">
            <DialogClose render={<Button variant="secondary" disabled={busy} />}>Cancel</DialogClose>
            <Button type="submit" form={formId} variant="primary" loading={busy}>
              {p.confirm}
            </Button>
          </ButtonGroup>
        }
      >
        <form id={formId} onSubmit={submit}>
          {p.multiline ? (
            <Textarea label={p.label} rows={3} value={text} onChange={(e) => setText(e.target.value)} {...(error ? { error } : {})} />
          ) : (
            <Input label={p.label} value={text} onValueChange={setText} {...(error ? { error } : {})} />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
