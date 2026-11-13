// Studio's one filter pattern (owner, 2026-11-12): every filter of a bar is a DS Select with an inline label, the name
// in secondary text then the value ("Status Waiting", "Product All products", "Person Everyone"), hugging its content,
// at the md control height of the search field and the view switch beside it. People, products, families and statuses
// combine, so every filter takes several values (the list stays open while options are ticked). Nothing ticked is the
// filter's "all" word, never an option; an option's count is the count tag; an option with nothing in it is not
// listed; the trigger reads the first ticked option then "+N" (rules: lib/filter-summary). Used by Explorations, Being
// built and Library review; styles/list-filters.css lays the row out (one scrolling row on a phone).
import { Select } from '@bridge-ds/react';
import { filterSummary, listedOptions, type FilterOption } from '../../../lib/filter-summary';
import { CountTag } from './CountTag';
import '../../../styles/list-filters.css';

export type MultiOption = FilterOption;

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
