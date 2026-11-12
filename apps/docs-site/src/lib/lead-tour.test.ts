import { describe, expect, it } from 'vitest';
import { leadTour, leadTourSteps } from './lead-tour';

describe("the lead's home tour", () => {
  it('tours what the page shows, in order', () => {
    expect(leadTourSteps({ rows: true, more: true, branches: true })).toEqual(['rows', 'more', 'branches']);
    expect(leadTourSteps({ rows: true, more: false, branches: true })).toEqual(['rows', 'branches']);
    expect(leadTourSteps({ rows: false, more: false, branches: false })).toEqual([]);
  });

  it('words each step for the lead, without em dashes', () => {
    expect(leadTour('rows').title).toBe('Changes wait for your review');
    for (const at of ['rows', 'more', 'branches'] as const) expect(Object.values(leadTour(at)).join(' ')).not.toMatch(/—/);
  });
});
