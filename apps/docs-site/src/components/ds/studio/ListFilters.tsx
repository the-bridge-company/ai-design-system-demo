// Studio's one filter pattern (owner, 2026-11-12): every filter of a bar is a DS Select with an inline label, the name
// in secondary text then the value ("Status Waiting", "Product All products", "Person Everyone"), hugging its content,
// at the md control height of the search field and the view switch beside it. ListFiltersBar is the row of two single
// filters (product, person) with the count and Clear filters; MultiFilter is one filter that takes several values
// (Explorations, Being built, Library review). The rules are lib/branches-page (activeFilters, filterChoices,
// inFilters), the address ?product= and ?people=; each page says what its rows are.
import type { ReactNode } from 'react';
import { Badge, Button, Select } from '@bridge-ds/react';
import { ALL_PRODUCTS, type filterChoices, type ListFilters } from '../../../lib/branches-page';
import { EVERYONE } from '../../../lib/review-categories';
import '../../../styles/list-filters.css';

/** The empty line when the filters leave nothing, before Clear filters. */
export const NO_FILTER_MATCH = 'Nothing here matches these filters.';

export function ClearFilters({ onPick }: { onPick: (f: ListFilters) => void }) {
  return (
    <Button variant="link" onClick={() => onPick({ product: null, by: null })}>
      Clear filters
    </Button>
  );
}

const count = (n: number) => (
  <Badge tone="neutral" size="sm">
    {n}
  </Badge>
);

export interface ListFiltersBarProps {
  active: ListFilters;
  choices: ReturnType<typeof filterChoices>;
  onPick: (f: ListFilters) => void;
  /** The count of what is listed ("3 changes."). */
  summary: string;
  /** Offer Clear filters after the count; with nothing left, the empty line under the bar offers it instead. */
  clear: boolean;
  /** At the end of the row, away from what narrows the list: how it is shown (ListCard ViewSwitch). */
  end?: ReactNode;
}

export function ListFiltersBar({ active, choices, onPick, summary, clear, end }: ListFiltersBarProps) {
  return (
    <div className="bl-bar">
      <span className="bl-narrow">
        <Select
          inlineLabel="Product"
          className="bl-filter"
          value={active.product ?? ALL_PRODUCTS}
          onValueChange={(v) => onPick({ ...active, product: !v || v === ALL_PRODUCTS ? null : v })}
          options={choices.products.map((o) => ({ value: o.value, label: o.label, badge: count(o.count) }))}
        />
        <Select
          inlineLabel="Person"
          className="bl-filter"
          value={active.by ?? EVERYONE}
          onValueChange={(v) => onPick({ ...active, by: !v || v === EVERYONE ? null : v })}
          options={choices.people.map((d) => ({ value: d.value, label: d.label, badge: count(d.count), disabled: d.count === 0 && d.value !== (active.by ?? EVERYONE) }))}
        />
      </span>
      <p className="t-ui t-muted bl-summary" aria-live="polite">
        {summary}
        {clear && (
          <>
            {' '}
            <ClearFilters onPick={onPick} />
          </>
        )}
      </p>
      {end}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Several values at once (Explorations, Being built, Library review): the DS Select with multiple, the list staying
// open while options are ticked. "reset" (Everyone, In progress, All products) goes first and is ticked while it
// holds; ticking it resets the filter, ticking anything else narrows it.

export interface MultiOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiFilterProps {
  /** The inline label, the filter's name: "Status", "Product", "Person". */
  label: string;
  /** What the trigger reads ("In progress", "Leo +1"). */
  shown: string;
  options: readonly MultiOption[];
  picked: readonly string[];
  onPick: (values: string[]) => void;
  /** The first item that resets the filter ("Everyone", "In progress", "All products"), ticked while it holds. */
  reset?: { label: string; active: boolean; onReset: () => void };
}

/** The reset item's value: never a real product, person or status. */
const RESET = '\u0000reset';

export function MultiFilter({ label, shown, options, picked, onPick, reset }: MultiFilterProps) {
  const values = reset?.active ? [RESET, ...picked] : [...picked];
  return (
    <Select
      multiple
      inlineLabel={label}
      displayValue={shown}
      className="bl-filter"
      options={[
        ...(reset ? [{ value: RESET, label: reset.label }] : []),
        ...options.map((o) => ({ value: o.value, label: o.label, badge: o.count === undefined ? undefined : count(o.count) })),
      ]}
      values={values}
      onValuesChange={(next) => {
        if (reset && next.includes(RESET) && !values.includes(RESET)) reset.onReset();
        else onPick(next.filter((v) => v !== RESET));
      }}
    />
  );
}
