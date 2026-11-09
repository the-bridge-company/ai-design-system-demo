// The review queue chrome (pages/studio/review.astro, scripts/review-queue-page.ts), board Q1 "Review all: Approve
// and next": the list on the start side ("‹ Home", "Review all · 3 of 20" with its progress, a window of rows around
// the current one, each with what the viewer did to it, titles on up to two lines), the head of an item that is not
// reviewed in place, and the one bar at the bottom, the same for every item: comment, Ask for changes, Approve, More
// actions, then one keyboard line. The queue moves on after a decision; a toast says what was done, with Undo.
// Rules: lib/queue-nav.ts.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Circle, CircleAlert, CircleDot, CircleX, Ellipsis, UserRoundPlus } from 'lucide-react';
import { Badge, Button, Icon, IconButton, Input, Kbd, Link, Menu, MenuContent, MenuItem, MenuTrigger, Progress, SidebarNav, SidebarNavItem, SidebarNavSection, Skeleton, ToastProvider, Tooltip, useToast, type UseToastReturn } from '@bridge-ds/react';
import { capturedLine } from '../../../lib/preview-shots';
import ButtonLink from '../ButtonLink';
import { positionLabel, queueWindow, type QueueOutcome } from '../../../lib/queue-nav';
import { Who, type Face } from './faces';
import { studioHref } from '../../../lib/team-path';

export interface QueueRow {
  key: string;
  title: string;
  /** Who waits on the viewer (a person or Claude); no face for rows without one. */
  person?: Face | null;
}

export interface QueueListProps {
  rows: QueueRow[];
  selected: string | null;
  outcomes: ReadonlyMap<string, QueueOutcome>;
  onSelect: (key: string) => void;
}

const MARK: Record<QueueOutcome | 'current' | 'todo', { icon: typeof Check; label: string }> = {
  approved: { icon: Check, label: 'Approved' },
  suggested: { icon: CircleAlert, label: 'Changes asked for' },
  asked: { icon: UserRoundPlus, label: 'Asked someone else' },
  declined: { icon: CircleX, label: 'Declined' },
  current: { icon: CircleDot, label: 'Open now' },
  todo: { icon: Circle, label: 'To review' },
};

export function QueueList({ rows, selected, outcomes, onSelect }: QueueListProps) {
  const index = rows.findIndex((r) => r.key === selected);
  // A window of the same size around the current row (lib/queue-nav queueWindow): the list keeps its height.
  const { start, end, more } = queueWindow(rows.length, index);
  const done = rows.filter((r) => outcomes.has(r.key)).length;
  return (
    <div className="rq-list">
      <Link variant="subtle" href={studioHref()} className="rq-home">
        <Icon icon={ChevronLeft} /> Home
      </Link>
      <p className="rq-count">
        <strong>Review all</strong>
        <span className="rq-muted"> · {index >= 0 ? positionLabel(rows.length, index) : `${rows.length} waiting`}</span>
      </p>
      <Progress value={done} max={Math.max(rows.length, 1)} size="sm" aria-label={`${done} of ${rows.length} done`} getAriaValueText={() => `${done} of ${rows.length} done`} />
      <SidebarNav aria-label="Waiting on you" className="rq-items">
        <SidebarNavSection>
          {rows.slice(start, end).map((r) => {
            const state = outcomes.get(r.key) ?? (r.key === selected ? 'current' : 'todo');
            const m = MARK[state];
            return (
              <SidebarNavItem
                key={r.key}
                href={`?item=${encodeURIComponent(r.key)}`}
                className={`rq-item-row is-${state}`}
                active={r.key === selected}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(r.key);
                }}
              >
                <Icon icon={m.icon} size="sm" className="rq-mark" label={m.label} />
                {r.person && <Who p={r.person} size="xs" className="rq-face" />}
                <span className="rq-item-text">{r.title}</span>
              </SidebarNavItem>
            );
          })}
        </SidebarNavSection>
        {more > 0 && <p className="rq-muted rq-more">and {more} more</p>}
      </SidebarNav>
    </div>
  );
}

/** Hosts the DS toasts of the queue and hands their API to the page script. */
export function QueueToasts({ onReady }: { onReady: (api: UseToastReturn) => void }) {
  return (
    <ToastProvider limit={2}>
      <ToastBridge onReady={onReady} />
    </ToastProvider>
  );
}

function ToastBridge({ onReady }: { onReady: (api: UseToastReturn) => void }) {
  const api = useToast();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

/** One button of the bar. `href` makes it a link (a row that is reviewed on its own page). */
export interface QueueBarAction {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  href?: string;
  /** Gets the comment. */
  onClick?: (text: string) => void;
  /** Said when the comment is empty: the button needs it (Ask for changes says what to change). */
  needsText?: string;
  /** The words of the sample team's dialog when the button would write (scripts/demo-gate.ts). */
  demoWrite?: string;
}

export interface QueueBarMenuItem {
  label: string;
  /** What it returns is said under the bar ("Link copied."). */
  onClick: () => void | string | Promise<void | string>;
  disabled?: boolean;
  tone?: 'danger';
}

export interface QueueBarProps {
  /** The comment field; false when the item takes no comment here, `note` says where it is reviewed in its place. */
  comment: boolean;
  note?: string | null;
  /** Ask for changes (or Decline for a join request), left of the primary action. */
  secondary: QueueBarAction | null;
  /** Approve, or the link that opens the item where it is reviewed. */
  primary: QueueBarAction | null;
  menu: QueueBarMenuItem[];
  /** The keys that work on this item (QueueKeys). */
  keys: readonly QueueKey[];
  said: string;
  /** Focus the comment field when it grows (S with an empty comment). */
  focusComment: number;
}

/** A key the bar answers to: A approves, S asks for changes, Enter opens an item reviewed on its own page. */
export type QueueKey = 'approve' | 'suggest' | 'open';

/**
 * The keys of the queue, one line at the same place under every item: only the keys that work on the item on screen,
 * then J and K, which always move.
 */
export function QueueKeys({ keys }: { keys: readonly QueueKey[] }) {
  return (
    <p className="rq-bar-keys rq-muted">
      Keyboard:{' '}
      {keys.includes('approve') && (
        <>
          <Kbd keys="A" /> approve ·{' '}
        </>
      )}
      {keys.includes('suggest') && (
        <>
          <Kbd keys="S" /> ask for changes ·{' '}
        </>
      )}
      {keys.includes('open') && (
        <>
          <Kbd keys="Enter" /> open ·{' '}
        </>
      )}
      <Kbd keys="J" /> <Kbd keys="K" /> next and previous
    </p>
  );
}

/**
 * The one bar of the queue, at the same place for every item: the comment (or a line that says where the item is
 * reviewed), the secondary action, the primary action last (Fitts: the widest target, where the eye ends), More
 * actions, then the keyboard line. The page fills it with what the item on screen allows.
 */
export function QueueBar(p: QueueBarProps) {
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  const field = useRef<HTMLInputElement>(null);
  // Only a new request focuses the field, never the value it had when the bar was made for this item.
  const asked = useRef(p.focusComment);
  useEffect(() => {
    if (p.focusComment === asked.current) return;
    asked.current = p.focusComment;
    field.current?.focus();
  }, [p.focusComment]);
  useEffect(() => {
    setSaid(p.said);
  }, [p.said]);
  const press = (a: QueueBarAction) => {
    if (a.needsText && !text.trim()) {
      setSaid(a.needsText);
      field.current?.focus();
      return;
    }
    setSaid('');
    a.onClick?.(text.trim());
    setText('');
  };
  const button = (a: QueueBarAction, variant: 'primary' | 'secondary') =>
    a.href ? (
      <ButtonLink variant={variant} size="lg" href={a.href} className="rq-bar-btn" data-rq-open="">
        {a.label}
      </ButtonLink>
    ) : (
      <Button variant={variant} size="lg" className="rq-bar-btn" disabled={a.disabled} loading={a.loading} data-rq-act={variant === 'primary' ? 'approve' : 'suggest'} data-demo-write={a.demoWrite} onClick={() => press(a)}>
        {a.label}
      </Button>
    );
  return (
    <div className="rq-bar" role="region" aria-label="Your review">
      <div className="rq-bar-row">
        <div className="rq-bar-field">
          {p.comment ? (
            <Input ref={field} label="Comment" hideLabel size="lg" placeholder="Add a comment (optional)" value={text} onValueChange={setText} data-rq-comment="" />
          ) : (
            <p className="rq-bar-note rq-muted">{p.note}</p>
          )}
        </div>
        {p.secondary && button(p.secondary, 'secondary')}
        {p.primary && button(p.primary, 'primary')}
        {p.menu.length > 0 && (
          <Menu>
            <Tooltip content="More actions">
              <MenuTrigger render={<IconButton icon={Ellipsis} label="More actions" variant="secondary" size="lg" className="rq-bar-more" />} />
            </Tooltip>
            <MenuContent side="top" align="end">
              {p.menu.map((m) => (
                <MenuItem
                  key={m.label}
                  disabled={m.disabled}
                  tone={m.tone}
                  onClick={() => {
                    void Promise.resolve(m.onClick()).then((r) => r && setSaid(r));
                  }}
                >
                  {m.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
      <QueueKeys keys={p.keys} />
      <p className="rq-said" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

export interface QueueItemProps {
  title: string;
  /** Who waits: their face before the line. */
  person: Face | null;
  /** "Sofia is done exploring". */
  line: string;
  detail?: string | null | undefined;
  pill?: { label: string; tone: 'warning' | 'danger' | 'success' | 'neutral' } | null | undefined;
  /** An exploration: its captured screen (linked to that screen on its preview when known) and its next step. */
  glance?: { shot: { src: string; capturedAt: string | null; href: string | null } | null; nextStep: string | null } | 'loading' | null;
  /** A guidance draft: its first lines. */
  excerpt?: string | null | undefined;
}

function Capture({ shot }: { shot: { src: string; capturedAt: string | null; href: string | null } }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const img = <img src={shot.src} alt="The latest captured screen of this exploration" loading="lazy" onError={() => setFailed(true)} />;
  return (
    <figure className="rq-shot">
      {shot.href ? (
        <Link variant="subtle" href={shot.href} target="_blank" rel="noopener" className="rq-shot-frame" aria-label="Open this screen in the preview (opens in a new tab)">
          {img}
        </Link>
      ) : (
        <span className="rq-shot-frame">{img}</span>
      )}
      {shot.capturedAt && <figcaption className="rq-muted">{capturedLine(shot.capturedAt, Date.now())}</figcaption>}
    </figure>
  );
}

/**
 * A row that is not reviewed in place (an exploration, usage guidance drafts, library health, setup, a join request):
 * the same head as a branch or a suggestion (the title in the display face, its status, who waits), then what there is
 * to see before opening it (an exploration's captured screen and next step, a draft's first lines), so every item of
 * the queue reads the same. Its action is in the bar.
 */
export function QueueItem(p: QueueItemProps) {
  const g = p.glance && p.glance !== 'loading' ? p.glance : null;
  return (
    <div className="br is-single is-queue rq-other">
      <header className="br-head">
        <h2 className="br-title" tabIndex={-1}>
          {p.title}{' '}
          {p.pill && (
            <Badge tone={p.pill.tone} className="br-status">
              {p.pill.label}
            </Badge>
          )}
        </h2>
        <p className="br-who">
          {p.person && <Who p={p.person} size="sm" className="br-face" />}
          <span>{p.line}</span>
        </p>
        {p.detail && <p className="br-from">{p.detail}</p>}
      </header>
      {p.glance === 'loading' && <Skeleton variant="rect" className="rq-shot-skel" />}
      {g && (g.shot || g.nextStep) && (
        <section className="rq-what" aria-label="Where it stands">
          {g.shot && <Capture shot={g.shot} />}
          {g.nextStep && (
            <p className="rq-next">
              <strong>Next step:</strong> {g.nextStep}
            </p>
          )}
        </section>
      )}
      {p.excerpt && (
        <section className="rq-what" aria-labelledby="rq-draft">
          <h3 id="rq-draft" className="rq-what-h">
            The draft
          </h3>
          <p className="rq-excerpt">{p.excerpt}</p>
        </section>
      )}
    </div>
  );
}
