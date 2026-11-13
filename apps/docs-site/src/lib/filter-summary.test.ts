import { describe, expect, it } from 'vitest';
import { filterSummary, listedOptions } from './filter-summary';

const PRODUCTS = [
  { value: 'ds', label: 'Design system', count: 0 },
  { value: 'crm', label: 'Acme CRM', count: 5 },
  { value: 'pay', label: 'Acme Pay', count: 4 },
];

describe('filter summary', () => {
  it('reads the all word when nothing is ticked', () => {
    expect(filterSummary(PRODUCTS, [], 'All products')).toBe('All products');
  });

  it('reads one label, or the first ticked option with items then +N', () => {
    expect(filterSummary(PRODUCTS, ['pay'], 'All products')).toBe('Acme Pay');
    expect(filterSummary(PRODUCTS, ['pay', 'crm'], 'All products')).toBe('Acme CRM +1');
    // An empty option never leads: "Acme Pay +1", not "Design system +1".
    expect(filterSummary(PRODUCTS, ['ds', 'pay'], 'All products')).toBe('Acme Pay +1');
    expect(filterSummary(PRODUCTS, ['gone'], 'All products')).toBe('gone');
  });

  it('hides options with no item unless ticked, then lists them last', () => {
    expect(listedOptions(PRODUCTS, []).map((o) => o.value)).toEqual(['crm', 'pay']);
    expect(listedOptions(PRODUCTS, ['ds']).map((o) => o.value)).toEqual(['crm', 'pay', 'ds']);
    // Options without a count are always listed.
    expect(listedOptions([{ value: 'a', label: 'A' }], []).map((o) => o.value)).toEqual(['a']);
  });
});
