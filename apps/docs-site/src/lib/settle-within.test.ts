import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleWithin } from './settle-within';

describe('settleWithin: the first paint waits for its reads, never forever', () => {
  afterEach(() => vi.useRealTimers());

  it('settles when the reads land, a failed read included', async () => {
    await expect(settleWithin(Promise.resolve(1), 1000)).resolves.toBeUndefined();
    await expect(settleWithin(Promise.reject(new Error('busy')), 1000)).resolves.toBeUndefined();
  });

  it('a read that hangs lets the page paint after the wait', async () => {
    vi.useFakeTimers();
    let done = false;
    void settleWithin(new Promise(() => undefined), 8000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(7999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
