// The short form of who an exploration waits on, for a list row's or a card's second line (owner review 2026-11-13):
// "Waiting for Dana", never "Waiting for Dana's design review and library decision on Card padding and Timeline".
// The exploration page keeps the whole sentence (core two-reviews waitingFor). Pure. Tested in wait-line.test.ts.

/** "Waiting for Dana's design review and the library decision on Timeline" reads "Waiting for Dana". */
export function shortWaitLine(line: string | null | undefined): string | null {
  if (!line) return null;
  if (!/^Waiting for /.test(line)) return line;
  if (/^Waiting for your /.test(line)) return 'Waiting for you';
  const person = /^Waiting for ([^\s']+)'s? /.exec(line);
  if (person) return `Waiting for ${person[1]}`;
  if (/^Waiting for the library decision/.test(line)) return 'Waiting for the library decision';
  if (/^Waiting for the .*design review/.test(line)) return 'Waiting for a design review';
  return line;
}
