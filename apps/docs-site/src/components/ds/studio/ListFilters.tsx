// The quieter row under the tabs of a list (Changes, Being built): two small DS Selects, the product (All products,
// then each product) and the person (Everyone, You, then each person by name), then the count of what is listed and
// Clear filters, and at the end how the list is shown (`end`, the ViewSwitch of ListCard). The rules are
// lib/branches-page (activeFilters, filterChoices, inFilters), the address ?product= and ?people=; each page says
// what its rows are and keeps the filters with its own tabs.
import type { ReactNode } from 'react';
import { Badge, Button, Icon, Menu, MenuCheckboxItem, MenuContent, MenuSeparator, MenuTrigger, Select } from '@bridge-ds/react';
import { ChevronDown } from 'lucide-react';
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
          label="Product"
          hideLabel
          size="sm"
          value={active.product ?? ALL_PRODUCTS}
          onValueChange={(v) => onPick({ ...active, product: !v || v === ALL_PRODUCTS ? null : v })}
          options={choices.products.map((o) => ({ value: o.value, label: o.label, badge: count(o.count) }))}
        />
        <Select
          label="People"
          hideLabel
          size="sm"
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
// Checkbox filters (Explorations): the small Select's look, a list of checkboxes behind it (DS Menu checkbox items),
// several picked at once. The menu stays open while boxes are ticked; "reset" (Everyone, In progress) goes first.

export interface MultiOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiFilterProps {
  /** The accessible name: "Status", "Product", "People". */
  label: string;
  /** What the trigger reads ("In progress", "Leo +1"). */
  shown: string;
  options: readonly MultiOption[];
  picked: readonly string[];
  onPick: (values: string[]) => void;
  /** The first item that resets the filter ("Everyone", "In progress", "All products"), checked while it holds. */
  reset?: { label: string; active: boolean; onReset: () => void };
}

export function MultiFilter({ label, shown, options, picked, onPick, reset }: MultiFilterProps) {
  const toggle = (v: string, on: boolean) => onPick(on ? [...picked.filter((x) => x !== v), v] : picked.filter((x) => x !== v));
  return (
    <Menu>
      <MenuTrigger className="bl-multi" aria-label={`${label}: ${shown}`}>
        <span className="bl-multi-value">{shown}</span>
        <Icon icon={ChevronDown} size="sm" className="bl-multi-chevron" />
      </MenuTrigger>
      <MenuContent aria-label={label} className="bl-multi-menu">
        {reset && (
          <>
            <MenuCheckboxItem checked={reset.active} onCheckedChange={() => reset.onReset()}>
              {reset.label}
            </MenuCheckboxItem>
            <MenuSeparator />
          </>
        )}
        {options.map((o) => (
          <MenuCheckboxItem key={o.value} checked={picked.includes(o.value)} onCheckedChange={(on) => toggle(o.value, on)}>
            <span className="bl-multi-item">
              <span>{o.label}</span>
              {o.count !== undefined && count(o.count)}
            </span>
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
