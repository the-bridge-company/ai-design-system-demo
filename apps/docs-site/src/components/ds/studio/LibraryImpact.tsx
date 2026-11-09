// "What this changes in the library" (boards LI1 to LI5, LI8): the section every exploration page has, and Review all
// shows inside each exploration. One summary line first, then one row per piece (what it is, before and after, one
// status tag, its ⋯ menu for the lead), a conflict's two ways right under the row it blocks, and what else comes from
// the library. Nothing to change is the best outcome: a Field Guide moment, never a bare line. View model:
// lib/library-impact-view.ts; data and writes: scripts/library-impact.ts. Styles: styles/library-impact.css.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Ellipsis, TriangleAlert } from 'lucide-react';
import { Accordion, AccordionItem, Badge, Button, ButtonGroup, Dialog, DialogClose, DialogContent, Icon, IconButton, Input, Menu, MenuContent, MenuItem, MenuTrigger, Radio, RadioGroup, Skeleton, Textarea, Tooltip } from '@bridge-ds/react';
import { Drawing } from './Drawing';
import { PIECE_ACTION_HINT, PIECE_ACTION_LABEL, type ConflictView, type ImpactRowView, type ImpactSide, type LibraryImpactView, type PieceAction } from '../../../lib/library-impact-view';

export interface LibraryImpactActions {
  /** The lead answers one piece; `input` is what to change, or the piece to use instead. */
  onPiece?: ((piece: string, action: PieceAction, input?: string) => Promise<string | void>) | null;
  /** The lead keeps one way where two explorations change the same component differently. */
  onChoose?: ((piece: string, pick: string) => Promise<string | void>) | null;
}

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
                  <Badge tone="neutral" size="md">
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
          const conflict = view.conflicts.find((c) => c.piece === r.id && !c.pick) ?? null;
          return (
            <li key={r.id} className={conflict ? 'li-item has-conflict' : 'li-item'}>
              <Row row={r} onPiece={actions.onPiece ?? null} say={say} />
              {conflict && <Conflict c={conflict} onChoose={actions.onChoose ?? null} say={say} />}
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
          <span>
            <strong>Everything else comes from the library:</strong> {view.uses.join(', ')}
          </span>
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

function Row({ row, onPiece, say }: { row: ImpactRowView; onPiece: LibraryImpactActions['onPiece'] | null; say: (s: string) => void }) {
  const [ask, setAsk] = useState<'changes' | 'existing' | null>(null);
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
        <Badge tone={row.status.tone} size="md">
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

/** A piece another exploration changes the other way (LI4): the two ways and both, right under the row it blocks. */
function Conflict({ c, onChoose, say }: { c: ConflictView; onChoose: LibraryImpactActions['onChoose'] | null; say: (s: string) => void }) {
  const [pick, setPick] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const choose = () => {
    if (!onChoose || !pick) return;
    setBusy(true);
    onChoose(c.piece, pick)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="li-conflict" role="group" aria-label={`Two ways for ${c.component}`}>
      <p className="li-conflict-line">
        <Badge tone="danger" size="md">
          Same component, two ways
        </Badge>
        <span>
          <strong>{c.other.name}</strong> · {c.other.product} · {c.line}
        </span>
      </p>
      {onChoose ? (
        <>
          <RadioGroup label={`Which way does ${c.component} take?`} value={pick} onValueChange={setPick} orientation="horizontal" className="li-ways">
            {c.options.map((o) => (
              <Radio key={o.value} value={o.value} label={o.label} description={o.hint} />
            ))}
          </RadioGroup>
          <div className="li-conflict-act">
            <span className="li-muted">{c.note}</span>
            <Button variant="primary" size="md" disabled={!pick} loading={busy} onClick={choose} data-demo-write="choose a way for a component">
              Keep this way
            </Button>
          </div>
        </>
      ) : (
        <p className="li-muted">The design lead picks one way, or both as two sizes. Until then nothing reaches the developers.</p>
      )}
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
