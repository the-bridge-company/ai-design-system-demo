// Studio's one filter pattern (owner, 2026-11-12): every filter of a bar is a DS Select with an inline label, the name
// in secondary text then the value ("Status Waiting", "Product All products", "Person Everyone"), hugging its content,
// at the md control height of the search field and the view switch beside it. People, products, families and statuses
// combine, so every filter takes several values (the list stays open while options are ticked). Nothing ticked is the
// filter's "all" word, never an option; an option's count is the count tag; an option with nothing in it is not
// listed; the trigger reads the first ticked option then "+N" (rules: lib/filter-summary). Used by Explorations, Being
// built and Library review; styles/list-filters.css lays the row out (one scrolling row on a phone).
import { useEffect, useRef, type ReactNode } from 'react';
import { Select } from '@bridge-ds/react';
import { filterSummary, listedOptions, type FilterOption } from '../../../lib/filter-summary';
import { CountTag } from './CountTag';
import '../../../styles/list-filters.css';

export type MultiOption = FilterOption;

/** Marks which edges of a scrolling filter row hide filters (`data-overflow`: start, end, both), so the CSS fades them. */
export function markRowOverflow(row: HTMLElement) {
  const max = row.scrollWidth - row.clientWidth;
  const start = row.scrollLeft > 1;
  const end = max - row.scrollLeft > 1;
  const value = start && end ? 'both' : start ? 'start' : end ? 'end' : null;
  if (value) row.setAttribute('data-overflow', value);
  else row.removeAttribute('data-overflow');
}

/**
 * Scrolls a row sideways so `target` (a filter that took focus) sits fully inside it, clear of the faded edges
 * (`fade` px each side). Only the row's scrollLeft moves: never the page, never vertically.
 */
export function revealInRow(row: HTMLElement, target: HTMLElement, fade: number) {
  if (row.scrollWidth <= row.clientWidth) return;
  const box = row.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const start = t.left - box.left + row.scrollLeft;
  const end = t.right - box.left + row.scrollLeft;
  if (start - fade < row.scrollLeft) row.scrollLeft = Math.max(0, start - fade);
  else if (end + fade > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.min(row.scrollWidth - row.clientWidth, end + fade - row.clientWidth);
}

/** The fade width the stylesheet gives the row (--_fade), in px. */
const fadeOf = (row: HTMLElement) => {
  const probe = getComputedStyle(row).scrollPaddingInlineStart;
  const n = parseFloat(probe);
  return Number.isFinite(n) ? n : 0;
};

export interface FilterRowProps {
  /** The page's own class for the row ("bl-narrow", "lr-bar-row"); the scroll and the fade come from "bl-scroll". */
  className: string;
  as?: 'div' | 'span';
  children: ReactNode;
}

/**
 * The filters of a bar, one row. On a phone it scrolls sideways inside itself (never the page) and fades the edge that
 * hides a filter, so a cut filter reads as "more this way" (styles/list-filters.css .bl-scroll).
 */
export function FilterRow({ className, as: Tag = 'div', children }: FilterRowProps) {
  const ref = useRef<HTMLElement | null>(null);
  // Every render: a picked value changes a trigger's width, and so whether the row overflows.
  useEffect(() => {
    if (ref.current) markRowOverflow(ref.current);
  });
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const mark = () => markRowOverflow(row);
    // Tab onto a filter under the fade (or past the edge): bring it fully into the row, clear of the fade.
    const reveal = (e: FocusEvent) => {
      const target = e.target instanceof HTMLElement ? (e.target.closest<HTMLElement>('.bl-filter') ?? e.target) : null;
      if (target && target !== row) revealInRow(row, target, fadeOf(row));
    };
    row.addEventListener('scroll', mark, { passive: true });
    row.addEventListener('focusin', reveal);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark);
    observer?.observe(row);
    return () => {
      row.removeEventListener('scroll', mark);
      row.removeEventListener('focusin', reveal);
      observer?.disconnect();
    };
  }, []);
  return (
    <Tag ref={ref as never} className={`bl-scroll ${className}`}>
      {children}
    </Tag>
  );
}

export interface MultiFilterProps {
  /** The inline label, the filter's name: "Status", "Product", "Person". */
  label: string;
  /** What the trigger reads when nothing is ticked: "Everyone", "All products", "Not shipped yet". */
  all: string;
  options: readonly MultiOption[];
  /** The ticked values; empty means the "all" word. */
  picked: readonly string[];
  onPick: (values: string[]) => void;
}

export function MultiFilter({ label, all, options, picked, onPick }: MultiFilterProps) {
  return (
    <Select
      multiple
      inlineLabel={label}
      displayValue={filterSummary(options, picked, all)}
      className="bl-filter"
      options={listedOptions(options, picked).map((o) => ({ value: o.value, label: o.label, badge: o.count === undefined ? undefined : <CountTag n={o.count} /> }))}
      values={picked}
      onValuesChange={onPick}
    />
  );
}
