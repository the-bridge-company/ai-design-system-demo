// Studio's one filter pattern (components/ds/studio/ListFilters.tsx MultiFilter), the rules without React: which
// options a filter lists and what its trigger reads after its name. Owner gate review 2026-11-12:
//   - a filter combines values (people, products, families, statuses): several can be ticked;
//   - nothing ticked is the filter's "all" word ("Everyone", "All products", "Not shipped yet"), never an option;
//   - an option with no item (count 0) is not listed, unless it is ticked (then last, so it can be unticked);
//   - the trigger reads the first ticked option with items, then "+N" for the others: "Being built +1".

export interface FilterOption {
  value: string;
  label: string;
  /** How many items the option holds; 0 hides it unless ticked. */
  count?: number;
}

/** Whether a value passes a filter: one value ('' is every value) or the ticked values ([] is every value). */
export function inFamilies(value: string, picked: string | readonly string[]): boolean {
  if (typeof picked === 'string') return !picked || value === picked;
  return !picked.length || picked.includes(value);
}

/** The options a filter lists: empty ones only when ticked, and then last. */
export function listedOptions<T extends FilterOption>(options: readonly T[], picked: readonly string[]): T[] {
  const full = options.filter((o) => o.count !== 0);
  const emptyPicked = options.filter((o) => o.count === 0 && picked.includes(o.value));
  return [...full, ...emptyPicked];
}

/** What the trigger reads after the filter's name: the "all" word, one label, or "<first> +N". */
export function filterSummary(options: readonly FilterOption[], picked: readonly string[], all: string): string {
  if (!picked.length) return all;
  const ordered = listedOptions(options, picked).filter((o) => picked.includes(o.value));
  // A ticked value the options no longer know (an old address) still counts, after the known ones.
  const unknown = picked.filter((v) => !options.some((o) => o.value === v));
  const lead = ordered[0]?.label ?? unknown[0]!;
  const n = ordered.length + unknown.length;
  return n === 1 ? lead : `${lead} +${n - 1}`;
}
