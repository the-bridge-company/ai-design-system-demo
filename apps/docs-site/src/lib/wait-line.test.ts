import { describe, expect, it } from 'vitest';
import { shortWaitLine } from './wait-line';

describe('the short wait line of a row or a card', () => {
  it('names who it waits on, never the reviews and pieces', () => {
    expect(shortWaitLine("Waiting for Dana's design review and library decision on Card padding and Timeline")).toBe('Waiting for Dana');
    expect(shortWaitLine("Waiting for James' library decision on Timeline")).toBe('Waiting for James');
    expect(shortWaitLine('Waiting for your design review and your library decision on Timeline')).toBe('Waiting for you');
    expect(shortWaitLine('Waiting for the library decision on Timeline')).toBe('Waiting for the library decision');
    expect(shortWaitLine('Waiting for the Acme CRM design review')).toBe('Waiting for a design review');
  });

  it('keeps any other line as it is', () => {
    expect(shortWaitLine('Changes asked')).toBe('Changes asked');
    expect(shortWaitLine(null)).toBeNull();
  });
});
