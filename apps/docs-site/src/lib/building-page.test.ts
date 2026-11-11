import { describe, expect, it } from 'vitest';
import {
  addressWithBuildFilters,
  BUILD_STATE_LABEL,
  buildBoardColumns,
  buildCountLine,
  buildFiltersFromAddress,
  buildStateOf,
  buildStateTag,
  buildStatusTriggerLabel,
  DEFAULT_BUILD_FILTERS,
  emptyBuildLine,
  isBuildFiltered,
  NOT_SHIPPED,
  passesBuild,
  personLine,
  possessive,
} from './building-page';
import { checkLine } from './building-view';
import { YOU } from './branches-page';

const NOW = Date.parse('2026-11-11T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe('Being built: one word per status', () => {
  it('reads every build status in the page words, picked up as In progress', () => {
    expect(buildStateOf({ status: 'requested', shippedAt: null }, NOW)).toBe('waiting');
    expect(buildStateOf({ status: 'picked-up', shippedAt: null }, NOW)).toBe('in-progress');
    expect(buildStateOf({ status: 'in-progress', shippedAt: null }, NOW)).toBe('in-progress');
    expect(buildStateOf({ status: 'in-review', shippedAt: null }, NOW)).toBe('in-review');
    expect(buildStateOf({ status: 'not-planned', shippedAt: null }, NOW)).toBe('not-planned');
  });

  it('keeps Shipped for the last 30 days, as Explorations, and what waits for the library release whatever its age', () => {
    expect(buildStateOf({ status: 'shipped', shippedAt: ago(20) }, NOW)).toBe('shipped');
    expect(buildStateOf({ status: 'shipped', shippedAt: ago(30) }, NOW)).toBe('shipped');
    expect(buildStateOf({ status: 'shipped', shippedAt: ago(31) }, NOW)).toBeNull();
    expect(buildStateOf({ status: 'shipped', shippedAt: null }, NOW)).toBeNull();
    expect(buildStateOf({ status: 'shipped', shippedAt: ago(90), nextRelease: true }, NOW)).toBe('shipped');
  });

  it('tags a row with the same word as the filter, never Requested', () => {
    expect(buildStateTag('waiting')).toEqual({ label: 'Waiting to be picked up', tone: 'warning' });
    expect(buildStateTag('in-progress')).toEqual({ label: 'In progress', tone: 'info' });
    expect(buildStateTag('in-review')).toEqual({ label: 'In review', tone: 'warning' });
    expect(buildStateTag('shipped')).toEqual({ label: 'Shipped', tone: 'success' });
    expect(Object.values(BUILD_STATE_LABEL)).not.toContain('Requested');
  });
});

describe('Being built: the filters', () => {
  it('opens on Not shipped yet, everyone, every product', () => {
    expect(buildFiltersFromAddress('')).toEqual(DEFAULT_BUILD_FILTERS);
    expect(DEFAULT_BUILD_FILTERS.status).toEqual(['waiting', 'in-progress', 'in-review']);
    expect(buildStatusTriggerLabel(NOT_SHIPPED)).toBe('Not shipped yet');
    expect(isBuildFiltered(DEFAULT_BUILD_FILTERS)).toBe(false);
    expect(addressWithBuildFilters('', DEFAULT_BUILD_FILTERS)).toBe('');
  });

  it('keeps the filters in the address, comma separated, as Explorations', () => {
    const f = { status: ['in-review' as const, 'shipped' as const], product: ['crm'], people: [YOU, 'leo'] };
    const q = addressWithBuildFilters('?request=12', f);
    expect(q).toBe('?request=12&status=in-review,shipped&product=crm&people=you,leo');
    expect(buildFiltersFromAddress(q)).toEqual({ status: ['in-review', 'shipped'], product: ['crm'], people: [YOU, 'leo'] });
    expect(isBuildFiltered(f)).toBe(true);
  });

  it('reads the old addresses: ?people= alone, ?by=, ?who=mine and the old tab words', () => {
    expect(buildFiltersFromAddress('?people=malik-haddad').people).toEqual(['malik-haddad']);
    expect(buildFiltersFromAddress('?by=leo').people).toEqual(['leo']);
    expect(buildFiltersFromAddress('?who=mine').people).toEqual([YOU]);
    expect(buildFiltersFromAddress('?status=shipped-this-week').status).toEqual(['shipped']);
    expect(buildFiltersFromAddress('?status=requested').status).toEqual(['waiting']);
  });

  it('names the trigger and the count like Explorations', () => {
    expect(buildStatusTriggerLabel(['shipped'])).toBe('Shipped');
    expect(buildStatusTriggerLabel(['waiting', 'in-progress', 'in-review', 'shipped'])).toBe('All statuses');
    expect(buildStatusTriggerLabel(['waiting', 'shipped'])).toBe('2 statuses');
    expect(buildCountLine(8, 8)).toBe('8 changes.');
    expect(buildCountLine(1, 1)).toBe('1 change.');
    expect(buildCountLine(3, 10)).toBe('3 of 10 changes.');
  });

  it('keeps a row when its status, product and one of its people are picked', () => {
    const row = { state: 'in-review' as const, product: 'crm', people: ['malik', 'leo'] };
    expect(passesBuild(row, DEFAULT_BUILD_FILTERS)).toBe(true);
    expect(passesBuild(row, { ...DEFAULT_BUILD_FILTERS, people: ['leo'] })).toBe(true);
    expect(passesBuild(row, { ...DEFAULT_BUILD_FILTERS, people: ['ann'] })).toBe(false);
    expect(passesBuild(row, { ...DEFAULT_BUILD_FILTERS, product: ['prints'] })).toBe(false);
    expect(passesBuild({ ...row, state: 'shipped' }, DEFAULT_BUILD_FILTERS)).toBe(false);
  });

  it('says what the filters leave out when nothing matches', () => {
    expect(emptyBuildLine(DEFAULT_BUILD_FILTERS, { person: (k) => k, product: (k) => k })).toBe('Nothing waiting or being built right now.');
    expect(emptyBuildLine({ status: ['in-review'], product: ['crm'], people: ['leo'] }, { person: () => 'Leo', product: () => 'Acme CRM' })).toBe('Nothing in review by Leo in Acme CRM right now.');
  });
});

describe('Being built: the Board', () => {
  const rows = [
    { id: 1, state: 'waiting' as const },
    { id: 2, state: 'in-review' as const },
    { id: 3, state: 'in-review' as const },
    { id: 4, state: 'shipped' as const },
  ];

  it('has one column per status, Shipped added to the default, empty ones kept small', () => {
    const cols = buildBoardColumns(rows, NOT_SHIPPED);
    expect(cols.map((c) => [c.label, c.rows.length])).toEqual([
      ['Waiting to be picked up', 1],
      ['In progress', 0],
      ['In review', 2],
      ['Shipped, last 30 days', 1],
    ]);
  });

  it('shows only the statuses the filter keeps otherwise', () => {
    expect(buildBoardColumns(rows, ['in-review']).map((c) => c.key)).toEqual(['in-review']);
  });
});

describe('Being built: who a card names, and why', () => {
  it('says Asked by while it waits, builds it once picked up, Shipped by once shipped', () => {
    expect(personLine({ state: 'waiting', builders: [], requester: 'Leo' })).toBe('Asked by Leo');
    // A "Requested by Ann Leroy." line reads like every other card.
    expect(personLine({ state: 'waiting', builders: [], requester: 'Ann Leroy' })).toBe('Asked by Ann');
    expect(personLine({ state: 'in-review', builders: ['Malik Benali', 'Ana'], requester: 'Leo' })).toBe('Malik and Ana build it');
    expect(personLine({ state: 'in-progress', builders: ['Malik'], requester: 'Leo' })).toBe('Malik builds it');
    expect(personLine({ state: 'in-review', builders: ['Malik', 'Ana'], requester: 'Leo' })).toBe('Malik and Ana build it');
    expect(personLine({ state: 'in-review', builders: [], requester: 'Sofia' })).toBe('Asked by Sofia');
    expect(personLine({ state: 'shipped', builders: ['Malik'], requester: 'Leo' })).toBe('Shipped by Malik');
    expect(personLine({ state: 'shipped', builders: [], requester: 'Ann' })).toBe('Asked by Ann');
    expect(personLine({ state: 'waiting', builders: [], requester: null })).toBeNull();
  });

  it("names whose check the developers' version waits for", () => {
    const nameOf = (l: string) => l;
    expect(checkLine({ check: { state: 'pending', waiting: ['Sofia'], changesBy: null } }, nameOf)).toBe("Waiting for Sofia's check");
    expect(checkLine({ check: { state: 'pending', waiting: ['James'], changesBy: null } }, nameOf)).toBe("Waiting for James' check");
    expect(checkLine({ check: { state: 'failure', waiting: [], changesBy: 'Sofia' } }, nameOf)).toBe('Sofia asked for changes');
    expect(possessive('Leo')).toBe("Leo's");
  });
});
