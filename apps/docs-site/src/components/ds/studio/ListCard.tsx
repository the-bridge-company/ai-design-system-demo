// A listed change as a card, for the grid view of Changes and Being built: the same card as the Home's explorations
// (ExplorationCards, styles sh-card-*), fed by what a row already knows. The screen on top, the title, then the fixed
// footer: its one status tag, then who it belongs to and when its screen was captured. The product, when the list
// does not group by product, sits in the screen's corner (BranchThumb chip), so it reads at a glance.
// The grid itself is the Home's grid (ul.sh-cards), so a card is the same size everywhere in Studio.
// The switch between the two views sits in each list's filter bar (ViewSwitch).
import { Badge, Card, Link, SegmentedControl } from '@bridge-ds/react';
import { LayoutGrid, List } from 'lucide-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Who } from './faces';
import { BranchThumb, captureAgeOf } from './BranchThumb';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import { SEP, type Person, type PillTone } from '../../../lib/home-model';
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
  /** In the screen's corner, when the group heading does not already say it: "Account app". */
  product?: string | null;
  pill?: { label: string; tone: PillTone | 'info' } | null;
  /** A chip before the tag ("Exploration", "Sample"). */
  tags?: ReactNode;
  /** A line under the title: where a library change comes from (LibraryChanges OriginNote). */
  note?: ReactNode;
}

export function ListCard({ thumb, title, href, linkAttributes, onClick, person, product, pill, tags, note }: ListCardProps) {
  const age = captureAgeOf(thumb);
  return (
    <li className="sh-card-item">
      <Card interactive padding="none" className="sh-card">
        <BranchThumb spec={thumb} size="card" chip={product ?? null} />
        <div className="sh-card-body">
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
                {person.name}
                {age ? (
                  <span className="sh-card-product">
                    {SEP}
                    {age}
                  </span>
                ) : null}
              </span>
            </span>
          </span>
        </div>
      </Card>
    </li>
  );
}

/** The switch at the end of a list's filter bar: rows, or cards. */
export function ViewSwitch({ view, onPick }: { view: ListView; onPick: (v: ListView) => void }) {
  return (
    <SegmentedControl
      className="bl-view"
      size="sm"
      label={LIST_VIEW_WORDS.label}
      value={view}
      onValueChange={(v) => onPick(v === 'grid' ? 'grid' : 'list')}
      items={[
        { value: 'list', label: LIST_VIEW_WORDS.list, icon: List },
        { value: 'grid', label: LIST_VIEW_WORDS.grid, icon: LayoutGrid },
      ]}
    />
  );
}
