import { describe, expect, it } from 'vitest';
import {
  addressWithBuildFilters,
  BUILD_STATE_LABEL,
  buildBoardColumns,
  buildGroups,
  cardLine,
  buildCountLine,
  buildFiltersFromAddress,
  buildStateOf,
  buildStateTag,
  DEFAULT_BUILD_FILTERS,
  emptyBuildLine,
  isBuildFiltered,
  movedAtOf,
  NOT_SHIPPED,
  passesBuild,
  personLine,
  possessive,
} from './building-page';
import { checkLine } from './building-view';
import { YOU } from './branches-page';
import { LATE_DAYS } from './status-ladder';

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
    expect(buildStateTag('waiting')).toEqual({ label: 'Ready to build', tone: 'neutral' });
    // Amber only once the wait is late (core LATE_DAYS): never because it waits at all.
    expect(buildStateTag('waiting', LATE_DAYS)).toEqual({ label: 'Ready to build', tone: 'neutral' });
    expect(buildStateTag('waiting', LATE_DAYS + 1)).toEqual({ label: 'Ready to build', tone: 'warning' });
    expect(buildStateTag('in-progress')).toEqual({ label: 'Being built', tone: 'info' });
    expect(buildStateTag('in-review')).toEqual({ label: 'Checking', tone: 'neutral' });
    expect(buildStateTag('shipped')).toEqual({ label: 'Shipped', tone: 'success' });
    expect(Object.values(BUILD_STATE_LABEL)).not.toContain('Requested');
  });
});

describe('Being built: the filters', () => {
  it('opens on Not shipped yet, everyone, every product', () => {
    expect(buildFiltersFromAddress('')).toEqual(DEFAULT_BUILD_FILTERS);
    expect(DEFAULT_BUILD_FILTERS.status).toEqual(['waiting', 'in-progress', 'in-review']);
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
    expect(emptyBuildLine({ status: ['in-review'], product: ['crm'], people: ['leo'] }, { person: () => 'Leo', product: () => 'Acme CRM' })).toBe('Nothing being checked by Leo in Acme CRM right now.');
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
      ['Ready to build', 1],
      ['Being built', 0],
      ['Checking', 2],
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

describe('Being built: a card names who has it now, then when it last moved (as Explorations)', () => {
  it('names the builders once someone builds it, else where it comes from (never who asked), then the age', () => {
    expect(cardLine({ builders: [], origin: 'Library change Dana approved', movedAt: ago(2), now: NOW })).toEqual({ who: 'Library change Dana approved', when: '2 days ago' });
    expect(cardLine({ builders: ['Malik Benali'], origin: 'From Contact page summary', movedAt: ago(1), now: NOW })).toEqual({ who: 'Malik', when: 'yesterday' });
    expect(cardLine({ builders: ['Malik', 'Ana'], origin: 'Exploration Dana sent', movedAt: null, now: NOW })).toEqual({ who: 'Malik and Ana', when: null });
    expect(cardLine({ builders: [], origin: 'From Order fulfilment timeline', movedAt: 'not a date', now: NOW })).toEqual({ who: 'From Order fulfilment timeline', when: null });
    expect(cardLine({ builders: [], origin: null, movedAt: null, now: NOW })).toEqual({ who: null, when: null });
  });

  it('dates a row by its latest step, else by when it was sent', () => {
    expect(movedAtOf({ createdAt: ago(9), timeline: [{ at: ago(9) }, { at: ago(3) }, {}] })).toBe(ago(3));
    expect(movedAtOf({ createdAt: ago(9), timeline: [] })).toBe(ago(9));
    expect(movedAtOf({})).toBeNull();
  });
});

describe('Being built: List and Grid group by product, as Explorations', () => {
  const products = [
    { key: 'shop', name: 'Acme Prints' },
    { key: 'crm', name: 'Acme CRM' },
    { key: 'library', name: 'Library' },
  ];
  const row = (id: string, product: string, state: 'waiting' | 'in-progress' | 'in-review' | 'shipped') => ({ id, product, state });

  it("keeps the products' order, the library's work under Library, and drops empty groups", () => {
    const groups = buildGroups([row('a', 'library', 'waiting'), row('b', 'crm', 'in-review'), row('c', 'library', 'in-progress')], products);
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['Acme CRM', 1],
      ['Library', 2],
    ]);
  });

  it('orders a group along the ladder: Ready to build, Being built, Checking, Shipped, keeping the order within one', () => {
    const groups = buildGroups(
      [row('1', 'library', 'in-review'), row('2', 'library', 'shipped'), row('3', 'library', 'waiting'), row('4', 'library', 'in-progress'), row('5', 'library', 'waiting')],
      products,
    );
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(['3', '5', '4', '1', '2']);
  });

  it('lists a product the configuration does not name after the known ones, by its key', () => {
    expect(buildGroups([row('x', 'admin', 'waiting'), row('y', 'shop', 'waiting')], products).map((g) => g.label)).toEqual(['Acme Prints', 'admin']);
  });
});
