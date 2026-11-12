// A page waits for its reads before its first paint (never a first answer that a second one changes a moment later),
// but never forever: a read that hangs lets the page paint after a while.

/** Settles when `p` settles (never rejects), or after `ms`, whichever comes first. */
export function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    p.then(
      () => undefined,
      () => undefined,
    ).then(() => {
      clearTimeout(t);
      resolve();
    });
  });
}
