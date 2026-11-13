// "What this changes in the library" (boards LI1 to LI5, LI8, EB1 to EB4, and the ledger board v3 of 2026-11-10): the
// section every exploration page has, and Review all shows inside each exploration. The title and its count first,
// then one row per piece. Each piece has one header line (its kind tile, its name, one tag, where it comes from), then
// what the lead decides: a new component shows the piece as built and one tick ("Add Timeline to the library"); a
// change to a component part reads like the component's own options ("Padding: Comfortable", 20 px, +4 px), the new
// ones ticked to add, the ones already in the library listed under them, and one button that says the outcome. Once
// decided, a piece folds into one sentence. Everyone but the lead reads the same rows without ticks or buttons.
// Nothing to change is the best outcome: a Field Guide moment, never a bare line. View model:
// lib/library-impact-view.ts; data and writes: scripts/library-impact.ts. Styles: styles/library-impact.css.
import { useEffect, useId, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Ellipsis, TriangleAlert } from 'lucide-react';
import { Accordion, AccordionItem, Avatar, AvatarGroup, Badge, Button, ButtonGroup, Card, Checkbox, Dialog, DialogClose, DialogContent, Icon, IconButton, Input, Link, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton, Textarea, Tooltip, VisuallyHidden } from '@bridge-ds/react';
import { Drawing } from './Drawing';
import { Who } from './faces';
import { People } from './People';
import { siteIcon } from '../../../brand/site-icons';
import { ledgerLabel, ledgerPick, PIECE_ACTION_HINT, PIECE_ACTION_LABEL, type ConflictView, type ImpactRowView, type ImpactSide, type LibraryImpactView, type OptionRow, type PieceAction, type Said, type WayLook } from '../../../lib/library-impact-view';
import { nameFace } from '../../../lib/people';
import { statusTagClass } from '../../../lib/status-tag';
import { possessiveOf, stagedPieces } from '../../../lib/exploration-layout';
import { SEP } from '../../../lib/sep';

/**
 * The lead's choice on each new library piece, on the exploration page (staged there: Send to the developers applies
 * it). `capture`: the designer's screen as captured, the piece shown as it was built.
 */
export interface NewPieceChoices {
  capture: string | null;
  designer: string;
  choices: Record<string, 'approve' | 'local'>;
  onChoice: (piece: string, choice: 'approve' | 'local') => void;
}

/** The screen the pieces were built in: its capture (the piece as built) and where to see it on the page. */
export interface ImpactScreen {
  capture: string | null;
  designer: string;
  /** The exploration's name: "Order fulfilment timeline". */
  name: string;
  /** "See it in the screen": the screen on this page. */
  href: string | null;
}

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

const person = (name: string) => ({ login: nameFace(name), name, agent: false, avatar: null });

export function LibraryImpact({
  view,
  actions = {},
  say,
  headingLevel = 2,
  newPieces = null,
  screen = null,
}: {
  view: LibraryImpactView;
  actions?: LibraryImpactActions;
  say: (s: string) => void;
  headingLevel?: 2 | 3;
  newPieces?: NewPieceChoices | null;
  screen?: ImpactScreen | null;
  /** Kept for callers: the ledger's button names the outcome whatever the page's zone says. */
  quiet?: boolean;
  onPage?: boolean;
}) {
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
            {view.title}
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
        <p className="li-muted li-count">
          {view.count}
          {view.tail && (
            <span className="li-summary-tail">
              {SEP}
              {view.tail}
            </span>
          )}
        </p>
      </header>
      <ul className="li-rows">
        {view.rows.map((r) => (
          <li key={r.id} className="li-item">
            <Piece row={r} conflict={view.conflicts.find((c) => c.piece === r.id) ?? null} actions={actions} say={say} headingLevel={headingLevel} newPieces={newPieces} screen={screen} />
          </li>
        ))}
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

/** One piece: its header line, then what is decided on it, or the sentence it folded into. */
function Piece({ row, conflict, actions, say, headingLevel, newPieces, screen }: { row: ImpactRowView; conflict: ConflictView | null; actions: LibraryImpactActions; say: (s: string) => void; headingLevel: 2 | 3; newPieces: NewPieceChoices | null; screen: ImpactScreen | null }) {
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const isNew = /^new (component|pattern)/i.test(row.kind);
  const staged = Boolean(newPieces && stagedPieces([row], Boolean(actions.onPiece)).length);
  const name = conflict ? `${row.title} ${conflict.ledger.property.toLowerCase()}` : row.title;
  const settled = row.settled && !changing;
  // Change: a decided part goes back to its choice (onUndo); a decided new piece shows its tick again.
  const canChange = conflict ? Boolean(conflict.decided && actions.onUndo && conflict.decides) : Boolean(actions.onPiece && row.menu.includes('local'));
  const change = () => {
    if (!conflict) return setChanging(true);
    setBusy(true);
    actions.onUndo!(row.id)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  let body;
  if (settled) {
    body = (
      <>
        <p className="li-said">
          <SaidLine parts={row.settled!} />
          {canChange && (
            <>
              {' '}
              <Button variant="link" size="sm" loading={busy} onClick={change} className="li-inline-link" data-demo-write="change a library decision">
                Change
              </Button>
            </>
          )}
        </p>
        {/* A div, not a p: the DS AvatarGroup inside People is a block. */}
        {conflict?.decided && (
          <div className="li-said">
            <People names={conflict.decided.people} size="sm" text={conflict.decided.told} />
          </div>
        )}
      </>
    );
  } else if (conflict) {
    body = <Ledger c={conflict} onChoose={actions.onChoose ?? null} onComment={actions.onComment ?? null} say={say} />;
  } else if (isNew) {
    // Two reviews: the library decision on its row replaces the tick staged into the design review's Looks right.
    const decision = Boolean(row.libraryDecision);
    body = <NewPiece row={row} np={staged && !decision ? newPieces : null} screen={screen} onPiece={changing && !decision ? (actions.onPiece ?? null) : null} say={say} />;
  } else {
    body = <Row row={row} onPiece={actions.onPiece ?? null} onReply={actions.onReply ?? null} say={say} />;
  }
  // A new piece keeps the lead's other answers (ask for changes, use an existing piece) in a ⋯ on its header line;
  // its tick is the add / keep-in-the-screen answer.
  const headMenu = isNew && !settled && actions.onPiece ? row.menu.filter((a) => a === 'changes' || a === 'existing') : [];
  return (
    // data-waiting: the piece the lead still has to choose; "Choose Card padding" in the Your turn zone lands here.
    <div className="li-piece" data-waiting={conflict && !settled && !conflict.decided ? '' : undefined}>
      <PieceHead row={row} name={name} headingLevel={headingLevel} menu={headMenu.length ? <PieceMenu row={row} items={headMenu} onPiece={actions.onPiece!} say={say} /> : null} />
      {body}
      {row.libraryDecision && !settled && !conflict && actions.onPiece && <LibraryDecision row={row} d={row.libraryDecision} onPiece={actions.onPiece} say={say} />}
    </div>
  );
}

/**
 * The library decision on a piece's row (two reviews): the hat's words, then Library review's two answers. Apart from
 * the design review: a library owner answers here whatever the screen's review says.
 */
function LibraryDecision({ row, d, onPiece, say }: { row: ImpactRowView; d: NonNullable<ImpactRowView['libraryDecision']>; onPiece: NonNullable<LibraryImpactActions['onPiece']>; say: (s: string) => void }) {
  const [busy, setBusy] = useState<PieceAction | null>(null);
  const act = (a: PieceAction) => {
    setBusy(a);
    onPiece(row.id, a)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(null));
  };
  return (
    <div className="li-pick" role="group" aria-label={`${d.title}: ${row.title}`}>
      <p className="li-said">
        <strong>{d.title}.</strong> {d.as}
      </p>
      <ButtonGroup>
        <Button variant="secondary" size="md" loading={busy === 'local'} disabled={busy !== null} data-demo-write="answer a library piece" onClick={() => act('local')}>
          {d.keep}
        </Button>
        <Button variant="secondary" size="md" loading={busy === 'approve'} disabled={busy !== null} data-demo-write="answer a library piece" onClick={() => act('approve')}>
          {d.add}
        </Button>
      </ButtonGroup>
    </div>
  );
}

/** The lead's other answers on a piece, behind ⋯, each asking for its text in a small dialog. */
function PieceMenu({ row, items, onPiece, say }: { row: ImpactRowView; items: readonly PieceAction[]; onPiece: NonNullable<LibraryImpactActions['onPiece']>; say: (s: string) => void }) {
  const [ask, setAsk] = useState<'changes' | 'existing' | null>(null);
  const act = (a: PieceAction, input?: string) =>
    onPiece(row.id, a, input).then(
      (r) => {
        if (r) say(r);
      },
      (err: Error) => {
        say(err.message);
        throw err;
      },
    );
  return (
    <span className="li-head-menu">
      <Menu>
        <Tooltip content={`More about ${row.title}`}>
          <MenuTrigger render={<IconButton icon={Ellipsis} label={`More about ${row.title}`} variant="secondary" size="md" />} />
        </Tooltip>
        <MenuContent align="end">
          {items.map((a) => (
            <MenuItem key={a} data-demo-write="answer a library piece" onClick={() => setAsk(a as 'changes' | 'existing')}>
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
      <AskDialog
        open={ask !== null}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask === 'existing' ? `Use an existing piece instead of ${row.title}?` : `Ask for changes on ${row.title}?`}
        description={ask === 'existing' ? 'Say which piece of the library to use. The designer reads it on the exploration.' : 'Only this piece goes back. The screen keeps waiting for your answer.'}
        label={ask === 'existing' ? 'Piece of the library' : 'What to change'}
        multiline={ask !== 'existing'}
        confirm={ask === 'existing' ? 'Use it instead' : 'Ask for changes'}
        onConfirm={(text) => act(ask!, text)}
      />
    </span>
  );
}

/** The piece's one header line: the kind tile, its name, one tag, and where it comes from on the right. */
function PieceHead({ row, name, headingLevel, menu = null }: { row: ImpactRowView; name: string; headingLevel: 2 | 3; menu?: ReactNode }) {
  const H = headingLevel === 2 ? 'h3' : 'h4';
  const { people, products } = row.origin;
  return (
    <div className="li-phead">
      <span className="li-tile" aria-hidden="true">
        <Icon icon={siteIcon('diamonds')} size="sm" />
      </span>
      <H className="li-pname">{name}</H>
      {row.tag && (
        <Badge tone={row.tag.tone} size="md" className={statusTagClass(row.tag.tone)}>
          {row.tag.label}
        </Badge>
      )}
      {(people.length > 0 || products.length > 0) && (
        <span className="li-origin">
          {people.length > 0 && (
            <AvatarGroup aria-label={people.join(', ')} size="xs" max={3} className="li-faces">
              {people.map((p) => (
                <Who key={p} p={person(p)} name={p} size="xs" />
              ))}
            </AvatarGroup>
          )}
          <span>{products.join(', ')}</span>
        </span>
      )}
      {menu}
    </div>
  );
}

/**
 * A new component the screen built (board v3): the piece as built, from the designer's screen, where it comes from,
 * then for the lead one tick, "Add Timeline to the library". Not ticked, it stays in the designer's screen. Sending to
 * the developers applies it (or, once decided, a change applies at once).
 */
function NewPiece({ row, np, screen, onPiece, say }: { row: ImpactRowView; np: NewPieceChoices | null; screen: ImpactScreen | null; onPiece: LibraryImpactActions['onPiece'] | null; say: (s: string) => void }) {
  const designer = np?.designer ?? screen?.designer ?? row.origin.people[0] ?? 'The designer';
  const capture = np?.capture ?? screen?.capture ?? null;
  // The capture is the whole screen: a small picture beside the line, the whole capture in a dialog on click.
  const [big, setBig] = useState(false);
  const shotAlt = `${row.title}, as built in ${possessiveOf(designer)} screen`;
  const [now, setNow] = useState<'approve' | 'local'>(row.status.key === 'local' ? 'local' : 'approve');
  const value = np ? (np.choices[row.id] ?? 'approve') : now;
  const tick = (on: boolean) => {
    const v = on ? 'approve' : 'local';
    if (np) return np.onChoice(row.id, v);
    setNow(v);
    onPiece?.(row.id, v)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message));
  };
  return (
    <>
      <figure className="li-crop">
        {capture ? (
          <>
            {/* bridge-audit-ignore-next-line: the small picture is the target that opens the whole capture; the DS has no image button and Button would draw a label around it */}
            <button type="button" className="li-crop-shot" aria-label={`${shotAlt}, see it full size`} aria-haspopup="dialog" onClick={() => setBig(true)}>
              <img src={capture} alt="" loading="lazy" />
            </button>
            <Dialog open={big} onOpenChange={setBig}>
              <DialogContent title={shotAlt} size="lg">
                <img className="li-crop-full" src={capture} alt={shotAlt} />
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        <figcaption className="li-said li-muted">
          <Who p={person(designer)} size="xs" className="li-face" />
          {possessiveOf(designer)} {row.title}
          {screen?.name ? `, from ${screen.name}` : ''}
          {screen?.href && (
            <>
              {SEP}
              <Link href={screen.href} data-keep-branch="">
                See it in the screen
              </Link>
            </>
          )}
        </figcaption>
      </figure>
      {(np || onPiece) && (
        <div className={value === 'approve' ? 'li-pick is-on' : 'li-pick'}>
          <Checkbox label={`Add ${row.title} to the library`} description={`Not ticked: it stays in ${possessiveOf(designer)} screen only`} checked={value === 'approve'} onCheckedChange={tick} />
        </div>
      )}
      {!np && !onPiece && row.note && <p className="li-note">{row.note}</p>}
    </>
  );
}

/** A small library card drawn at an option's room inside: the hatch is the room, the content sits on paper. */
function Specimen({ look, today = false }: { look: WayLook | null; today?: boolean }) {
  const vars: Record<string, string> = {};
  if (look?.padding != null) vars['--_pad'] = `${look.padding}px`;
  if (look?.gap != null) vars['--_gap'] = `${look.gap}px`;
  if (look?.radius != null) vars['--_radius'] = `${look.radius}px`;
  const style = Object.keys(vars).length ? (vars as CSSProperties) : undefined;
  const cls = ['li-spec', today && 'is-today', look?.borderless && 'is-borderless', look?.filled && 'is-filled'].filter(Boolean).join(' ');
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

/** A sentence that names people (their face first) and values (in bold). */
function SaidLine({ parts }: { parts: readonly Said[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p.face && <Who p={person(p.face)} size="xs" className="li-face" />}
          {p.strong ? <strong>{p.text}</strong> : p.text}
        </span>
      ))}
    </>
  );
}

/** The option's value on the right: "20 px" and, under it, how far it sits from the default. */
function OptValue({ r }: { r: OptionRow }) {
  return (
    <span className="li-opt-val">
      <strong>{r.value}</strong>
      {r.delta && <span className="li-muted">{r.delta}</span>}
    </span>
  );
}

/** Where an option comes from, its face first: "Sofia's way · Order fulfilment timeline · Acme Prints". */
function OptLine({ r }: { r: OptionRow }) {
  return (
    <span className="li-opt-line">
      {r.face && <Who p={person(r.face)} size="xs" className="li-face" />}
      {r.line}
    </span>
  );
}

/**
 * A change to a component part (board v3), read like the component's own options. "Add to the library": one row per
 * new value, ticked for the lead, with the name Bridge proposes and Rename. "Already in the library": the default and
 * the options a screen can use as they are. One footer: who is told, Comment, and the button that names the outcome.
 */
function Ledger({ c, onChoose, onComment, say }: { c: ConflictView; onChoose: LibraryImpactActions['onChoose'] | null; onComment: LibraryImpactActions['onComment'] | null; say: (s: string) => void }) {
  const L = c.ledger;
  const decides = c.decides && Boolean(onChoose);
  const [ticked, setTicked] = useState<boolean[]>(() => L.fresh.map(() => true));
  const [names, setNames] = useState<string[]>(() => L.fresh.map((r) => r.name));
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [cards, setCards] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const added = L.fresh.flatMap((r, i) => (ticked[i] ? [{ keys: r.keys, name: names[i] ?? r.name, proposed: r.name }] : []));
  const label = ledgerLabel(c.component, added.map((a) => a.name));
  const choose = () => {
    if (!onChoose) return;
    setBusy(true);
    onChoose(c.piece, ledgerPick(added))
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  const tick = (i: number, on: boolean) => setTicked((t) => t.map((x, j) => (j === i ? on : x)));
  const startRename = (i: number) => {
    setDraft(names[i] ?? '');
    setRenaming(i);
  };
  const endRename = (keep: boolean) => {
    if (renaming === null) return;
    const v = draft.trim();
    if (keep && v) setNames((n) => n.map((x, j) => (j === renaming ? v : x)));
    setRenaming(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      endRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endRename(false);
    }
  };
  const prop = L.property;
  return (
    <div className={cards ? 'li-ledger show-cards' : 'li-ledger'}>
      {L.fresh.length > 0 && (
        <>
          <p className="li-group">Add to the library</p>
          <ul className="li-opts" aria-label={`New ${prop.toLowerCase()} options for ${c.component}`}>
            {L.fresh.map((r, i) => {
              const on = decides && Boolean(ticked[i]);
              const shown = names[i] ?? r.name;
              return (
                <li key={r.keys.join(' ')} className={on ? 'li-opt is-on' : 'li-opt'}>
                  <span className="li-opt-tick">
                    {decides && <Checkbox label={<VisuallyHidden>{`Add ${prop}: ${shown} to ${c.component}`}</VisuallyHidden>} checked={on} onCheckedChange={(v) => tick(i, v)} />}
                  </span>
                  <span className="li-opt-card" onClick={decides ? () => tick(i, !on) : undefined}>
                    <Specimen look={r.look} />
                  </span>
                  <span className="li-opt-text">
                    <span className="li-opt-name">
                      {renaming === i ? (
                        <Input label={`Name of the ${prop.toLowerCase()} option`} hideLabel size="sm" value={draft} onValueChange={setDraft} onKeyDown={onKey} onBlur={() => endRename(true)} autoFocus className="li-rename" />
                      ) : (
                        <>
                          <span>
                            {prop}: {shown}
                          </span>
                          {decides && (
                            <Button variant="link" size="sm" onClick={() => startRename(i)} aria-label={`Rename ${shown}`} className="li-inline-link">
                              Rename
                            </Button>
                          )}
                        </>
                      )}
                    </span>
                    <OptLine r={r} />
                  </span>
                  <OptValue r={r} />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {L.have.length > 0 && (
        <>
          <p className="li-group">Already in the library</p>
          <ul className="li-opts is-have" aria-label={`${prop} options ${c.component} already has`}>
            {L.have.map((r) => (
              <li key={`${r.name}-${r.keys.join(' ')}`} className="li-opt">
                <span className="li-opt-tick" />
                <span className="li-opt-card">
                  <Specimen look={r.look} today={r.isDefault} />
                </span>
                <span className="li-opt-text">
                  <span className="li-opt-name">
                    <span>
                      {prop}: {r.name}
                    </span>
                    {r.isDefault && (
                      <Badge tone="neutral" size="sm">
                        The default
                      </Badge>
                    )}
                  </span>
                  <OptLine r={r} />
                </span>
                <OptValue r={r} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Button variant="link" size="sm" className="li-see-cards" aria-expanded={cards} onClick={() => setCards((v) => !v)}>
        {cards ? 'Hide the cards' : 'See the cards side by side'}
      </Button>
      <div className="li-act">
        {/* A div, not a p: the notified line's DS AvatarGroup is a block. Who is notified reads as Library review's
            footer does (People.tsx): their faces, then "Leo and Sofia will be notified." */}
        <div className="li-act-note">
          <p className="li-muted">
            {c.noteParts.map((p, i) =>
              p.href ? (
                <Link key={i} href={p.href} data-keep-branch="">
                  {p.text}
                </Link>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
          {c.notified && <People names={c.notified.people} size="sm" text={c.notified.text} />}
        </div>
        {(onComment || decides) && (
          <div className="li-btns">
            {onComment && (
              <Button variant="secondary" size="md" data-demo-write="comment on the ways" onClick={() => setCommenting(true)}>
                {c.comment}
              </Button>
            )}
            {decides && (
              <Button variant="primary" size="md" loading={busy} onClick={choose} data-demo-write="choose a way for a component">
                {label}
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
          description={c.decides ? `Everyone who changed ${c.component} reads it on their exploration.` : 'The library owners read it on this exploration, before choosing.'}
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

function Side({ side }: { side: ImpactSide }) {
  return (
    <figure className="li-side">
      <span className={side.empty ? 'li-plate is-empty' : 'li-plate'}>{side.label}</span>
      <figcaption className="li-cap">{side.caption}</figcaption>
    </figure>
  );
}

/** Any other piece (a token, a size): what it does, before and after, the lead's note, and the lead's ⋯ menu. */
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
        <span className="li-muted">{row.summary}</span>
        {row.note && <span className="li-note">{row.note}</span>}
        {row.reply && onReply && (
          <span className="li-reply">
            <Button variant="secondary" size="sm" data-demo-write="reply to a library decision" onClick={() => setReplying(true)}>
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
