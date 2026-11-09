import { describe, expect, it } from 'vitest';
import { explorationPrBody, withDecision, withLeadAsked, withoutLeadAsked } from '@bridge-ds/core';
import {
  addressWithFilters,
  boardColumns,
  BOARD_COLUMNS,
  changesToExplorations,
  countLine,
  DEFAULT_FILTERS,
  emptyFilterLine,
  filtersFromAddress,
  IN_PROGRESS,
  isFiltered,
  legacyTarget,
  multiTriggerLabel,
  passes,
  splitWaiting,
  STATE_LABEL,
  statusOf,
  statusTriggerLabel,
  turnReason,
  YOU,
} from './explorations-page';
import { jargonIn } from './vocabulary';

const start = explorationPrBody({ name: 'Late tag', purpose: 'p', slug: 'late-tag', author: 'sofia' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const asked = withLeadAsked(start, { at: '2026-11-07T10:00:00.000Z', by: 'sofia', byName: 'Sofia' });
const changes = withDecision(withoutLeadAsked(asked), { kind: 'changes', at: '2026-11-07T11:00:00.000Z', by: 'dana', byName: 'Dana', text: 'Tighter' });
const question = withDecision(asked, { kind: 'question', at: '2026-11-07T11:00:00.000Z', by: 'leo', byName: 'Leo', text: 'Which tab?' });
const notDoing = withDecision(withoutLeadAsked(asked), { kind: 'not-doing', at: '2026-11-07T11:00:00.000Z', by: 'dana', byName: 'Dana' });
const looksRight = withDecision(withoutLeadAsked(asked), { kind: 'looks-right', at: '2026-11-07T11:00:00.000Z', by: 'dana', byName: 'Dana' });

describe('one status per exploration, in designer words', () => {
  it('reads the talk with the lead while it runs', () => {
    expect(statusOf({ lifecycle: 'exploration', stage: 'exploring', body: start })).toBe('exploring');
    expect(statusOf({ lifecycle: 'exploration', stage: 'waiting-for-lead', body: asked })).toBe('waiting-for-lead');
    expect(statusOf({ lifecycle: 'exploration', body: asked })).toBe('waiting-for-lead');
    expect(statusOf({ lifecycle: 'exploration', stage: 'exploring', body: changes })).toBe('needs-changes');
    expect(statusOf({ lifecycle: 'exploration', stage: 'exploring', body: notDoing })).toBe('not-doing');
  });
  it('collapses every developer stage into With developers', () => {
    for (const stage of ['being-built', 'in-review', 'approved'] as const) expect(statusOf({ lifecycle: 'exploration', stage, body: start })).toBe('with-developers');
    expect(statusOf({ lifecycle: 'exploration', stage: 'waiting-for-code', body: start })).toBe('with-developers');
  });
  it('says Looks right once the lead approved, and Waiting for the library while pieces are missing', () => {
    expect(statusOf({ lifecycle: 'exploration', stage: 'waiting-for-code', body: looksRight })).toBe('looks-right');
    expect(statusOf({ lifecycle: 'exploration', stage: 'waiting-for-code', body: looksRight, waitsForLibrary: true })).toBe('waiting-for-library');
  });
  it('ends as Shipped, Not doing this or Archived', () => {
    expect(statusOf({ lifecycle: 'exploration', stage: 'next-release' })).toBe('shipped');
    expect(statusOf({ lifecycle: 'exploration', stage: 'shipped' })).toBe('shipped');
    expect(statusOf({ lifecycle: 'shipped', merged_at: '2026-11-01T00:00:00Z' })).toBe('shipped');
    expect(statusOf({ lifecycle: 'exploration', stage: 'not-planned' })).toBe('not-doing');
    expect(statusOf({ lifecycle: 'exploration', stage: 'archived' })).toBe('archived');
    expect(statusOf({ lifecycle: 'exploration', archived: true, stage: 'exploring' })).toBe('archived');
  });
  it('maps a product branch by its review', () => {
    expect(statusOf({ lifecycle: 'draft' })).toBe('with-developers');
    expect(statusOf({ lifecycle: 'ready', statusKind: 'changes-requested' })).toBe('needs-changes');
    expect(statusOf({ lifecycle: 'ready', statusKind: 'needs-design' })).toBe('waiting-for-lead');
    expect(statusOf({ lifecycle: 'ready', statusKind: 'ready' })).toBe('looks-right');
  });
  it('never speaks developer jargon', () => {
    for (const l of [...Object.values(STATE_LABEL), ...BOARD_COLUMNS.map((c) => c.label)]) expect(jargonIn(l)).toEqual([]);
    expect(IN_PROGRESS.map((s) => STATE_LABEL[s])).toEqual(['Exploring', 'Waiting for lead', 'Needs changes', 'Waiting for the library', 'Looks right', 'With developers']);
  });
});

describe('filters and the address', () => {
  it('opens on In progress, every product, everyone', () => {
    expect(filtersFromAddress('')).toEqual(DEFAULT_FILTERS);
    expect(isFiltered(filtersFromAddress(''))).toBe(false);
    expect(addressWithFilters('', DEFAULT_FILTERS)).toBe('');
  });
  it('round-trips several statuses, products and people', () => {
    const f = { status: ['needs-changes', 'exploring'] as const, product: ['crm', 'prints'], people: [YOU, 'leo'] };
    const s = addressWithFilters('?pr=3', { ...f, status: [...f.status] });
    expect(s).toBe('?pr=3&status=exploring,needs-changes&product=crm,prints&people=you,leo');
    expect(filtersFromAddress(s)).toEqual({ status: ['exploring', 'needs-changes'], product: ['crm', 'prints'], people: [YOU, 'leo'] });
  });
  it('maps the old ?state=, ?status= and History links to the Status filter', () => {
    expect(filtersFromAddress('?state=shipped').status).toEqual(['shipped']);
    expect(filtersFromAddress('?state=archived').status).toEqual(['archived']);
    expect(filtersFromAddress('?state=code').status).toEqual(['with-developers']);
    expect(filtersFromAddress('?state=building').status).toEqual(['with-developers']);
    expect(filtersFromAddress('?status=merged').status).toEqual(['shipped']);
    expect(filtersFromAddress('?status=draft').status).toEqual(['with-developers']);
    expect(filtersFromAddress('?view=history').status).toEqual(['shipped']);
    // Waiting on me is a section now, never a filter: the default.
    expect(filtersFromAddress('?state=waiting').status).toEqual([...IN_PROGRESS]);
    expect(filtersFromAddress('?tier=2').status).toEqual([...IN_PROGRESS]);
    expect(addressWithFilters('?state=shipped&tier=2', filtersFromAddress('?state=shipped'))).toBe('?status=shipped');
  });
  it('keeps the old people and product links', () => {
    expect(filtersFromAddress('?who=mine').people).toEqual([YOU]);
    expect(filtersFromAddress('?by=leo').people).toEqual(['leo']);
    expect(filtersFromAddress('?people=everyone').people).toEqual([]);
    expect(filtersFromAddress('?kind=library', 'library').product).toEqual(['library']);
    // An open exploration's ?product= is its own product, not a filter.
    expect(filtersFromAddress('?exploration=4&product=crm').product).toEqual([]);
    expect(addressWithFilters('?exploration=4&product=crm', { ...DEFAULT_FILTERS })).toBe('?exploration=4&product=crm');
  });
  it('keeps a row when its status, product and person are picked', () => {
    const row = { status: 'exploring' as const, product: 'crm', people: ['leo'] };
    expect(passes(row, DEFAULT_FILTERS)).toBe(true);
    expect(passes(row, { ...DEFAULT_FILTERS, status: ['shipped'] })).toBe(false);
    expect(passes(row, { ...DEFAULT_FILTERS, product: ['prints'] })).toBe(false);
    expect(passes(row, { ...DEFAULT_FILTERS, product: ['prints', 'crm'], people: ['leo'] })).toBe(true);
    expect(passes(row, { ...DEFAULT_FILTERS, people: [YOU] })).toBe(false);
  });
  it('says what the triggers hold and what matched nothing', () => {
    expect(statusTriggerLabel(IN_PROGRESS)).toBe('In progress');
    expect(statusTriggerLabel(['shipped'])).toBe('Shipped');
    expect(statusTriggerLabel(['shipped', 'archived'])).toBe('2 statuses');
    expect(multiTriggerLabel([], (v) => v, 'Everyone')).toBe('Everyone');
    expect(multiTriggerLabel(['Leo', 'Ann'], (v) => v, 'Everyone')).toBe('Leo +1');
    const names = { person: (k: string) => ({ leo: 'Leo' })[k] ?? k, product: (k: string) => ({ crm: 'Acme CRM' })[k] ?? k };
    expect(emptyFilterLine({ status: ['waiting-for-lead'], product: ['crm'], people: ['leo'] }, names)).toBe('Nothing waiting for lead by Leo in Acme CRM yet.');
    expect(emptyFilterLine({ ...DEFAULT_FILTERS, people: [YOU] }, names)).toBe('Nothing in progress by you yet.');
    expect(countLine(3, 7)).toBe('3 of 7 explorations.');
    expect(countLine(1, 1)).toBe('1 exploration.');
  });
});

describe('Waiting on you', () => {
  it('pins the rows that wait on the viewer and never repeats them below', () => {
    const rows = [
      { n: 1, yourTurn: false },
      { n: 2, yourTurn: true },
      { n: 3, yourTurn: false },
    ];
    const { waiting, rest } = splitWaiting(rows);
    expect(waiting.map((r) => r.n)).toEqual([2]);
    expect(rest.map((r) => r.n)).toEqual([1, 3]);
  });
  it('says why it is your turn', () => {
    expect(turnReason({ body: asked, designer: 'Sofia' })).toBe('Sofia sent it for review');
    expect(turnReason({ body: changes, designer: 'Sofia', component: 'ProfileHeader' })).toBe('Dana asked a change on ProfileHeader');
    expect(turnReason({ body: changes, designer: 'Sofia' })).toBe('Dana asked a change');
    expect(turnReason({ body: question, designer: 'Sofia' })).toBe('Leo asked you a question');
    expect(turnReason({ body: null, designer: 'Ann', reviewWaits: true })).toBe('Ann sent it for review');
  });
});

describe('the Board', () => {
  const now = Date.parse('2026-11-09T12:00:00Z');
  const rows = [
    { id: 'a', status: 'exploring' as const },
    { id: 'b', status: 'waiting-for-library' as const },
    { id: 'c', status: 'looks-right' as const },
    { id: 'd', status: 'shipped' as const, shippedAt: '2026-11-01T00:00:00Z' },
    { id: 'e', status: 'shipped' as const, shippedAt: '2026-09-01T00:00:00Z' },
    { id: 'f', status: 'archived' as const },
  ];
  it('has one column per status, Looks right holding Waiting for the library, Shipped the last 30 days', () => {
    const cols = boardColumns(rows, [...IN_PROGRESS, 'shipped'], now);
    expect(cols.map((c) => c.key)).toEqual(['exploring', 'waiting-for-lead', 'needs-changes', 'looks-right', 'with-developers', 'shipped']);
    expect(cols.find((c) => c.key === 'looks-right')!.rows.map((r) => r.id)).toEqual(['b', 'c']);
    expect(cols.find((c) => c.key === 'shipped')!.rows.map((r) => r.id)).toEqual(['d']);
    expect(cols.flatMap((c) => c.rows).some((r) => r.id === 'f')).toBe(false);
  });
  it('shows only the columns the Status filter keeps', () => {
    expect(boardColumns(rows, ['shipped'], now).map((c) => c.key)).toEqual(['shipped']);
    expect(boardColumns(rows, ['archived'], now)).toEqual([]);
  });
});

describe('old Changes links', () => {
  it('sends what moved to Library review', () => {
    expect(legacyTarget('?suggestion=12')).toBe('library-review/?suggestion=12');
    expect(legacyTarget('?origin=lead')).toBe('library-review/?origin=lead');
    expect(legacyTarget('?group=library&people=you')).toBe('library-review/?group=library');
    expect(legacyTarget('?pr=3')).toBeNull();
    expect(legacyTarget('?exploration=4')).toBeNull();
  });
  it('opens explorations and branches in place, keeps requests, maps old filters', () => {
    expect(changesToExplorations('?pr=3')).toBe('explorations/?pr=3');
    expect(changesToExplorations('?exploration=4&product=crm')).toBe('explorations/?exploration=4&product=crm');
    expect(changesToExplorations('?view=requests')).toBe('explorations/?view=requests');
    expect(changesToExplorations('?request=9')).toBe('explorations/?request=9');
    expect(changesToExplorations('?state=shipped')).toBe('explorations/?status=shipped');
    expect(changesToExplorations('?status=merged')).toBe('explorations/?status=shipped');
    expect(changesToExplorations('?state=exploring&people=you')).toBe('explorations/?people=you&status=exploring');
    expect(changesToExplorations('?tier=2')).toBe('explorations/');
    expect(changesToExplorations('')).toBe('explorations/');
    expect(changesToExplorations('', '#other-branches')).toBe('explorations/');
    expect(changesToExplorations('?suggestion=5')).toBe('library-review/?suggestion=5');
  });
});

