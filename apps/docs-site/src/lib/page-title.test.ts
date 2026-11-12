import { describe, expect, it } from 'vitest';
import { titleWith } from './page-title';

describe('titleWith', () => {
  it('puts the opened view in front of the page title', () => {
    expect(titleWith('Explorations | Bridge Studio', 'Order fulfilment timeline')).toBe('Order fulfilment timeline | Explorations | Bridge Studio');
  });

  it('keeps the page title when there is no name yet', () => {
    expect(titleWith('Library review | Bridge Studio', '')).toBe('Library review | Bridge Studio');
    expect(titleWith('Library review | Bridge Studio', null)).toBe('Library review | Bridge Studio');
    expect(titleWith('Library review | Bridge Studio', '   ')).toBe('Library review | Bridge Studio');
  });

  it('flattens white space in the name', () => {
    expect(titleWith('Library review | Bridge Studio', 'Who gets\n  Card')).toBe('Who gets Card | Library review | Bridge Studio');
  });
});
