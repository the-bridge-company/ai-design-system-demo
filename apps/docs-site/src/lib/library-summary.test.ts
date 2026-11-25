import { describe, expect, it } from 'vitest';
import { explorationPrBody, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { libraryImpactView, type ConflictView, type ImpactRowView, type LibraryImpactView } from './library-impact-view';
import { librarySummary } from './library-summary';

type Rows = Extract<LibraryImpactView, { state: 'rows' }>;

const row = (id: string, kind: string, key: ImpactRowView['status']['key'], tag: ImpactRowView['tag'] = { label: 'New', tone: 'info' }): ImpactRowView => ({
  id,
  kind,
  title: id,
  summary: `${id} in one line`,
  before: null,
  after: null,
  status: { key, label: key, tone: 'neutral' },
  note: null,
  details: [],
  menu: [],
  reply: null,
  tag,
  origin: { people: ['Sofia'], products: ['Acme Prints'] },
  settled: null,
});

const view = (rows: ImpactRowView[], conflicts: string[] = []): Rows => ({
  state: 'rows',
  summary: '',
  count: '',
  tail: null,
  rows,
  conflicts: conflicts.map((piece) => ({ piece }) as ConflictView),
  uses: ['Badge'],
  reach: null,
});

describe('the summary of the library section on the exploration page', () => {
  it('counts what waits, says what the pieces are and sends to Library review, nothing decided yet', () => {
    const s = librarySummary(view([row('Timeline', 'New component', 'needs-lead'), row('Space', 'Token change', 'needs-lead', { label: 'Change', tone: 'neutral' }), row('Card', 'Change to', 'conflict', { label: 'New option', tone: 'info' })], ['Card']), { designer: 'Sofia' });
    expect(s.count).toBe('3 to decide');
    expect(s.sentence).toBe("Sofia's screen asks the library to decide on 3 pieces: 1 with ways to choose from, 1 new component and 1 change.");
    expect(s.cta).toBe('Decide in Library review');
    expect(s.done).toBeNull();
    expect(s.uses).toEqual(['Badge']);
  });

  it('shows the three open pieces that need the most thought: ways to choose from, then new, then changes', () => {
    const rows = [
      row('a', 'Token change', 'needs-lead'),
      row('b', 'New component', 'needs-lead'),
      row('c', 'Change to', 'conflict'),
      row('d', 'New pattern', 'needs-lead'),
      row('e', 'New component', 'approved'),
      row('f', 'Token change', 'needs-lead'),
    ];
    const s = librarySummary(view(rows, ['c']), { designer: 'Sofia', pieceHref: (r, conflict) => (conflict ? `?piece=x:${r.id}` : `?piece=p:${r.id}`) });
    expect(s.rows.map((r) => r.id)).toEqual(['c', 'b', 'd']);
    expect(s.rows[0]!.href).toBe('?piece=x:c');
    expect(s.rows[1]!.href).toBe('?piece=p:b');
    expect(s.more).toBe('and 2 more');
    expect(s.count).toBe('1 of 6 decided');
    expect(s.sentence).toBe('5 left: 1 with ways to choose from, 1 new component and 3 new pieces.');
    expect(s.cta).toBe('Continue in Library review');
  });

  it('once every piece is decided: no rows, no button, what the library took in one sentence', () => {
    const s = librarySummary(view([row('a', 'New component', 'approved'), row('b', 'New component', 'local'), row('c', 'Change to', 'approved'), row('d', 'Token change', 'existing')], ['c']), { designer: 'Sofia' });
    expect(s.count).toBe('All 4 decided');
    expect(s.rows).toEqual([]);
    expect(s.more).toBeNull();
    expect(s.cta).toBeNull();
    expect(s.sentence).toBeNull();
    expect(s.done).toBe("1 added, 1 way chosen, 1 use a library piece instead and 1 kept in Sofia's screen.");
  });

  it('never counts a piece used as the library has it', () => {
    const s = librarySummary(view([row('a', 'New component', 'needs-lead'), row('b', 'Change to', 'existing', null)]), { designer: 'Leo' });
    expect(s.total).toBe(1);
    expect(s.count).toBe('1 to decide');
    expect(s.more).toBeNull();
  });

  it('reads the section built from an exploration', () => {
    const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen. The library has nothing like it yet.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
    const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-fulfilment-timeline' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
    const body = withPiecesRecord(start, { checkedAt: '2026-11-09T08:00:00.000Z', pieces: [timeline], links: [], uses: ['Card'] });
    const v = libraryImpactView({ body, designer: 'Sofia', lead: 'you', approved: false, canDecide: true, libraryHat: true });
    if (v.state !== 'rows') throw new Error(v.state);
    const s = librarySummary(v, { designer: 'Sofia' });
    expect(s.count).toBe('1 to decide');
    expect(s.rows).toEqual([{ id: 'component-timeline', name: 'Timeline', what: 'Built in this screen. The library has nothing like it yet.', tag: { label: 'New', tone: 'info' }, href: null }]);
    expect(s.sentence).toBe("Sofia's screen asks the library to decide on 1 piece: 1 new component.");
  });
});
