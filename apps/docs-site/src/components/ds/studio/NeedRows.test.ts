import { describe, expect, it } from 'vitest';
import { explorationRefOf } from './NeedRows';

describe('a Needs you row that opens an exploration', () => {
  it('reads the exploration from its address, so the row shows its capture', () => {
    expect(explorationRefOf('/studio/acme-design-demo/bridge-demo-ds/explorations/?exploration=1&product=prints')).toEqual({ number: 1, product: 'prints' });
    expect(explorationRefOf('?exploration=4')).toEqual({ number: 4, product: null });
  });

  it('leaves every other row alone', () => {
    expect(explorationRefOf('/studio/library-review/?pr=12')).toBeNull();
    expect(explorationRefOf('?exploration=abc')).toBeNull();
  });
});
