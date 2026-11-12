// A listed change as a card, for the grid view of Changes and Being built: the same card as the Home's explorations
// (ExplorationCards, styles sh-card-*), fed by what a row already knows. The screen on top, the title (up to two
// lines, the whole of it in the link's name and tooltip), then the footer: its one status tag, then one person line,
// "Sofia · 2 days ago": who it belongs to now and when (its screen's capture, or the age the list gives). A grouped
// list says the product once in its group title; only an ungrouped list (the Board) puts it in the screen's corner.
// The grid itself is the Home's grid (ul.sh-cards), so a card is the same size everywhere in Studio.
// The switch between the two views sits in each list's filter bar (ViewSwitch).
import { Badge, Card, Link, SegmentedControl } from '@bridge-ds/react';
import { Columns3, LayoutGrid, List } from 'lucide-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Who } from './faces';
import { BranchThumb, captureAgeOf } from './BranchThumb';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import type { Person, PillTone } from '../../../lib/home-model';
import { SEP } from '../../../lib/sep';
import { LIST_VIEW_EVENT, LIST_VIEW_WORDS, readListView, rememberListView, type ListView, type ListViewChange } from '../../../lib/list-view';
import { statusTagClass } from '../../../lib/status-tag';

/**
 * The view a page is read in: List until this person picks the grid. Read after the first paint (the server renders
 * the rows), then kept in step with every other list on the page, which may be painted in its own React root.
 */
export function useListView(page: string): [ListView, (v: ListView) => void] {
  const [view, setView] = useState<ListView>('list');
  useEffect(() => {
    setView(readListView(page));
    const told = (e: Event) => {
      const d = (e as CustomEvent<ListViewChange>).detail;
      if (d?.page === page) setView(d.view);
    };
    document.addEventListener(LIST_VIEW_EVENT, told);
    return () => document.removeEventListener(LIST_VIEW_EVENT, told);
  }, [page]);
  return [view, (v: ListView) => rememberListView(page, v)];
}

/**
 * The screens of the explorations listed, by each one's key: the capture of its preview (lib/preview-shots, one raw file
 * for all, no GitHub API call), the same on every team. One without keeps its thumbnail.
 */
export function useExplorationShots(items: readonly { key: string; number: number; product: string | null; branch?: string | null }[]): Map<string, ThumbSpec> {
  const [shots, setShots] = useState<Map<string, ThumbSpec>>(new Map());
  const list = items.map((i) => i.key).join(',');
  useEffect(() => {
    if (!items.length) return;
    let live = true;
    const set = (key: string, spec: ThumbSpec) => live && setShots((m) => new Map(m).set(key, spec));
    void Promise.all([import('../../../scripts/preview-shots'), import('../../../lib/preview-shots')]).then(([{ previewShotOf }, { shotThumb }]) => {
      for (const i of items) {
        void previewShotOf({ number: i.number, product: i.product })
          .catch(() => null)
          .then((shot) => {
            if (shot) set(i.key, shotThumb(shot, { seed: i.product ? `${i.product}#${i.number}` : String(i.number) }));
          });
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  return shots;
}

const TONE = { warning: 'warning', danger: 'danger', success: 'success', neutral: 'neutral', info: 'info' } as const;

export interface ListCardProps {
  thumb: ThumbSpec;
  title: string;
  href: string;
  /** Extra attributes on the title link (data-open-pr, data-open-exploration: the review opens in place). */
  linkAttributes?: Record<string, string | number | undefined>;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Whose it is: the face and the name in the footer. */
  person: Person;
  /** What the footer says after the face instead of the bare name ("Malik and Ana"). */
  byline?: string | null;
  /** The "when" after the name ("2 days ago"), when the list knows a better one than the screen's capture; null for none. */
  when?: string | null;
  /** In the screen's corner, when no group heading says it (the Board): "Account app". */
  product?: string | null;
  pill?: { label: string; tone: PillTone | 'info' } | null;
  /** A chip before the tag ("Exploration", "Sample"). */
  tags?: ReactNode;
  /** A line under the title: where a library change comes from (LibraryChanges OriginNote). */
  note?: ReactNode;
  /** A line above the title ("Your turn" on Explorations). */
  eyebrow?: ReactNode;
  /** On the card's list item ("ex-turn": what waits on the viewer). */
  className?: string;
  /** An action at the end of the footer ("Review" on what waits on the viewer). */
  action?: ReactNode;
}

export function ListCard({ thumb, title, href, linkAttributes, onClick, person, byline, when, product, pill, tags, note, eyebrow, className, action }: ListCardProps) {
  const age = when !== undefined ? when : captureAgeOf(thumb);
  return (
    <li className={className ? `sh-card-item ${className}` : 'sh-card-item'}>
      <Card interactive padding="none" className="sh-card">
        <BranchThumb spec={thumb} size="card" chip={product ?? null} />
        <div className="sh-card-body">
          {eyebrow}
          <span className="sh-card-head">
            <Link href={href} variant="subtle" className="t-body sh-card-title" title={title} data-card-primary onClick={onClick} {...linkAttributes}>
              <span className="sh-strong">{title}</span>
            </Link>
          </span>
          {note ? <span className="sh-card-note">{note}</span> : null}
          <span className="sh-card-foot">
            <span className="sh-card-tagline">
              {tags}
              {pill && (
                <Badge tone={TONE[pill.tone]} size="sm" className={statusTagClass(TONE[pill.tone], 'sh-card-tag')}>
                  {pill.label}
                </Badge>
              )}
            </span>
            <span className="t-ui sh-card-who">
              <Who p={person} size="xs" />
              <span className="sh-card-name">
                {byline || person.name}
                {age ? (
                  <span className="sh-card-product">
                    {SEP}
                    {age}
                  </span>
                ) : null}
              </span>
            </span>
            {action}
          </span>
        </div>
      </Card>
    </li>
  );
}

/** The switch at the end of a list's filter bar: rows, or cards. */
/** List and Grid; `board` adds the Board (Explorations). A page without the Board reads a remembered Board as List. */
export function ViewSwitch({ view, onPick, board = false }: { view: ListView; onPick: (v: ListView) => void; board?: boolean }) {
  return (
    <SegmentedControl
      className="bl-view"
      size="sm"
      label={LIST_VIEW_WORDS.label}
      value={view === 'board' && !board ? 'list' : view}
      onValueChange={(v) => onPick(v === 'grid' ? 'grid' : v === 'board' && board ? 'board' : 'list')}
      items={[
        { value: 'list', label: LIST_VIEW_WORDS.list, icon: List },
        { value: 'grid', label: LIST_VIEW_WORDS.grid, icon: LayoutGrid },
        ...(board ? [{ value: 'board', label: LIST_VIEW_WORDS.board, icon: Columns3 }] : []),
      ]}
    />
  );
}
