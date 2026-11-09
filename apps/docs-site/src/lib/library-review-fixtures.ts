// Sample data for the worst case of many explorations asking for one piece (owner, 2026-11-09): 12 explorations of
// the sample team's two products. Fictional names only. Used by library-askers.test.ts, and in local development only
// by the Library review island (?fixture=many-askers, never in a production build) to look at the List, the popover,
// One by one, the Map and Who gets it with 12 askers.
import type { AskedBy, ReviewPiece } from './library-review';

const ROWS: [string, string, 'Acme CRM' | 'Acme Prints', number][] = [
  ['Contact page summary', 'Sofia', 'Acme CRM', 1],
  ['Deal pipeline cards', 'Leo', 'Acme CRM', 2],
  ['Bulk actions on products', 'Leo', 'Acme Prints', 3],
  ['Order fulfilment timeline', 'Sofia', 'Acme Prints', 4],
  ['Onboarding empty states', 'Ann', 'Acme CRM', 5],
  ['Compact dashboard numbers', 'Maya', 'Acme Prints', 6],
  ['Invoice detail header', 'Noah', 'Acme Prints', 7],
  ['Team settings page', 'Iris', 'Acme CRM', 8],
  ['Account switcher', 'Tom', 'Acme CRM', 9],
  ['Print proof review', 'Lina', 'Acme Prints', 10],
  ['Shipping rates table', 'Omar', 'Acme Prints', 11],
  ['Lead import flow', 'Zoe', 'Acme CRM', 12],
];

/** 12 explorations, the most recent first (one hour apart), from `now`. */
export function manyAskers(now = Date.parse('2026-11-09T12:00:00Z')): AskedBy[] {
  return ROWS.map(([name, designer, product, n], i) => ({
    key: `fixture-${product === 'Acme CRM' ? 'crm' : 'prints'}#${100 + n}`,
    name,
    product,
    productKey: product === 'Acme CRM' ? 'crm' : 'prints',
    href: null,
    designer,
    at: new Date(now - i * 3_600_000).toISOString(),
  }));
}

/**
 * The pieces with the first exploration's piece asked by 12 explorations: its own exploration stays first, 11 sample
 * ones join it. Local development only.
 */
export function withManyAskers(pieces: readonly ReviewPiece[]): ReviewPiece[] {
  const i = pieces.findIndex((p) => p.asked && !p.conflict && p.state === 'waiting');
  if (i < 0) return [...pieces];
  const p = pieces[i]!;
  const extra = manyAskers().filter((a) => a.name !== p.asked!.name).slice(0, 11);
  const out = [...pieces];
  out[i] = { ...p, asked: { ...p.asked!, at: new Date(Date.parse('2026-11-09T13:00:00Z')).toISOString() }, also: extra };
  return out;
}
