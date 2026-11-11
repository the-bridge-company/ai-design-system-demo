// Check the build on the exploration page, direction A (the ledger of differences): the header's primary by progress,
// answered rows folded, "N more", who may answer and the first answer, the handover notes checklist.
import { describe, expect, it } from 'vitest';
import { buildStateOf } from '../../api/_lib/build-check';
import { ticksIn, withTick, type HandoverTick } from '../../api/_lib/build-review';
import { withDemo } from '../scripts/build-review-data';
import { ctaOf, eitherLine, firstAnswerOf, handoverRows, isPhoneOnly, ledgerOf, notesState, noteKey, STEP_WORDS, verdictsOf, type ItemState, type ReviewItem, type ReviewRead, type SizeKey } from './build-review-view';

const item = (n: number, sizes: SizeKey[] = ['laptop', 'small']): ReviewItem => ({ n, sig: `r0000000${n}`, name: `Part ${n}`, line: `Line ${n}`, facts: [], sizes, boxes: {}, crop: { size: sizes[0]!, a: `r${n}-a`, b: `r${n}-b` } });
const ITEMS = [item(1), item(2), item(3), item(4), item(5), item(6, ['phone']), item(7, ['phone']), item(8, ['phone'])];
const states = (v: Record<number, 'fine' | 'fix'> = {}): ItemState[] => ITEMS.map((it) => ({ sig: it.sig, mine: v[it.n] ?? null, carried: false, askedBefore: false, others: [] }));
const read = (o: Partial<ReviewRead> = {}) => ({
  review: { run: '1', head: 'h', measuredAt: '2026-11-10T05:00:00Z', route: null, urls: { approved: null, build: null }, sizes: [], items: ITEMS, ignored: 0 },
  items: states(),
  role: 'designer' as ReviewRead['role'],
  rows: [{ role: 'designer' as const, required: true, state: 'waiting' as const }] as ReviewRead['rows'],
  designerName: 'Sofia',
  ...o,
});

describe('the header primary follows progress, never the row', () => {
  it('Start the check, Continue, Send your answer; Look for who cannot answer; nothing once someone else answered', () => {
    expect(ctaOf(0, 8, true, false)).toBe('start');
    expect(ctaOf(2, 8, true, false)).toBe('continue');
    expect(ctaOf(8, 8, true, false)).toBe('send');
    expect(ctaOf(0, 8, false, false)).toBe('look');
    expect(ctaOf(3, 8, true, true)).toBeNull();
  });

  it('the list: every difference one line, in order, 8 differences, 3 only on a phone, Start the check', () => {
    const l = ledgerOf(read());
    expect(l.cta).toBe('start');
    expect(l.sub).toBe('8 differences, 3 only on a phone');
    expect(l.rows.map((r) => r.it.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(l.rows.every((r) => r.verdict === null)).toBe(true);
  });
});

describe('answered lines keep their place with their answer', () => {
  it('after 2 of 8: same order, the answers on their lines, Continue on the first still to answer', () => {
    const l = ledgerOf(read({ items: states({ 1: 'fine', 2: 'fix' }) }));
    expect(l.rows.slice(0, 3).map((r) => [r.it.n, r.verdict])).toEqual([
      [1, 'fine'],
      [2, 'fix'],
      [3, null],
    ]);
    expect(l.todo.map((i) => i.n)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(l.cta).toBe('continue');
    expect(l.sub).toBe('2 of 8 answered · 1 to fix so far');
  });

  it('all answered: Send your answer', () => {
    const l = ledgerOf(read({ items: states(Object.fromEntries(ITEMS.map((i) => [i.n, i.n === 2 ? 'fix' : 'fine']))) }));
    expect(l.cta).toBe('send');
    expect(l.todo).toEqual([]);
    expect(l.sub).toBe('8 of 8 answered · 1 to fix');
  });

  it('who cannot answer reads the lines with Look at the differences', () => {
    const l = ledgerOf(read({ role: null }));
    expect(l.cta).toBe('look');
    expect(l.sub).toBe('8 differences, 3 only on a phone');
  });

  it('once someone else answered first, the lines and the steps show their answers', () => {
    const items = states().map((s, i) => (i < 2 ? { ...s, others: [{ role: 'lead' as const, byName: 'Dana', verdict: i === 0 ? ('fine' as const) : ('fix' as const), at: 'x' }] } : s));
    const d = read({ items, rows: [{ role: 'designer', required: true, state: 'waiting' }, { role: 'lead', required: false, state: 'changes', byName: 'Dana', text: 'Fix the menu.' }] });
    expect(verdictsOf(d)).toMatchObject({ r00000001: 'fine', r00000002: 'fix', r00000003: null });
    expect(ledgerOf(d).sub).toBe('2 of 8 answered · 1 to fix so far');
    expect(ledgerOf(d).cta).toBeNull();
    expect(isPhoneOnly(item(6, ['phone']))).toBe(true);
  });
});

describe('the stepper and the recap words', () => {
  it('says where the reader is and what the recap sends', () => {
    expect(STEP_WORDS.of(3, 8)).toBe('3 of 8');
    expect(STEP_WORDS.recapLine(8, 8, 3, 5, 'Malik')).toBe('You looked at all 8. 3 to fix, 5 fine as built. Malik gets each one with its pictures and comments.');
    expect(STEP_WORDS.recapLine(6, 8, 0, 6, 'Malik')).toBe('You looked at 6 of 8. Every one you looked at is fine as built.');
    expect(STEP_WORDS.stateOf(null)).toBe('To look at');
  });
});

describe('who answers: the designer or a design lead, the first answer stands', () => {
  it('a lead reads "Sofia or you can answer"; the designer does not', () => {
    expect(eitherLine(read({ role: 'lead' }), 'Malik')).toBe('Sofia or you can answer. The first answer goes to Malik.');
    expect(eitherLine(read(), 'Malik')).toBeNull();
  });

  it('once one answered, the other sees who and what, and has no verdict left to give', () => {
    const rows: ReviewRead['rows'] = [
      { role: 'designer', required: true, state: 'waiting' },
      { role: 'lead', required: false, state: 'changes', byName: 'Dana', text: 'Tasks must stay in the menu.', why: 'build' },
    ];
    const d = read({ rows });
    expect(firstAnswerOf(d)).toEqual({ byName: 'Dana', role: 'lead', answer: 'Needs changes', text: 'Tasks must stay in the menu.' });
    expect(ledgerOf(d).cta).toBeNull();
    expect(eitherLine(read({ role: 'lead', rows: [{ role: 'designer', required: true, state: 'looks-right', byName: 'Sofia' }] }), 'Malik')).toBeNull();
    expect(firstAnswerOf(read({ role: 'lead', rows: [{ role: 'designer', required: true, state: 'looks-right', byName: 'Sofia' }] }))?.answer).toBe('Looks right');
  });

  it('a lead\'s Looks right counts for the designer who said nothing; a lead needed for the library still answers', () => {
    const w = (role: 'designer' | 'lead', kind: 'looks-right' | 'changes') => ({ role, byName: role, kind, sha: 'h', at: '2026-11-10T00:00:00Z' });
    expect(buildStateOf([w('lead', 'looks-right')], 'h', { pm: false, lead: false }).state).toBe('success');
    expect(buildStateOf([w('lead', 'changes')], 'h', { pm: false, lead: false }).state).toBe('failure');
    expect(buildStateOf([w('designer', 'looks-right')], 'h', { pm: false, lead: true }).state).toBe('pending');
    expect(buildStateOf([], 'h', { pm: false, lead: false }).state).toBe('pending');
  });
});

describe('the handover notes checklist', () => {
  const h = { decisions: ['Three tiles, always in the same order.'], edgeCases: [{ component: 'Contact summary', state: 'New contact with no history', covered: true }] };

  it('decisions then edge cases, each with a stable key', () => {
    const rows = handoverRows(h);
    expect(rows.map((r) => [r.kind, r.text])).toEqual([
      ['Decision', 'Three tiles, always in the same order.'],
      ['Edge case', 'New contact with no history'],
    ]);
    expect(rows[0]!.key).toMatch(/^h[0-9a-f]{8}$/);
    expect(handoverRows(h)[0]!.key).toBe(rows[0]!.key);
    expect(noteKey('a')).not.toBe(noteKey('b'));
  });

  it('folded until someone starts; found ones count, unknown keys do not', () => {
    const rows = handoverRows(h);
    expect(notesState(rows, [], false)).toMatchObject({ left: 2, folded: true });
    expect(notesState(rows, [], true).folded).toBe(false);
    const s = notesState(rows, [{ key: rows[1]!.key }, { key: 'h00000000' }], false);
    expect(s).toMatchObject({ left: 1, folded: false });
    expect([...s.found]).toEqual([rows[1]!.key]);
  });

  it('on the sample team, the visitor\'s answers and ticks stay in the browser and lay over the read', () => {
    const d = { ...read(), ticks: [{ key: 'h00000002', byName: 'Sofia', role: 'designer' as const, at: 'x' }] } as unknown as ReviewRead;
    const over = withDemo(d, { items: { r00000001: 'fix' }, ticks: [{ key: 'h00000001', byName: 'Dana', role: 'lead', at: 'y' }] });
    expect(over.items[0]).toMatchObject({ sig: 'r00000001', mine: 'fix' });
    expect(over.items[1]!.mine).toBeNull();
    expect(over.ticks!.map((t) => t.key)).toEqual(['h00000002', 'h00000001']);
  });

  it('one tick per note per round, whoever ticked it; a new round starts with none', () => {
    const t = (key: string, round: number, byName: string): HandoverTick => ({ key, round, role: 'designer', byName, at: 'x' });
    let ticks = withTick([], t('h00000001', 1, 'Sofia'), true);
    ticks = withTick(ticks, t('h00000001', 1, 'Dana'), true);
    expect(ticksIn(ticks, 1)).toEqual([{ key: 'h00000001', byName: 'Dana', role: 'designer', at: 'x' }]);
    expect(ticksIn(ticks, 2)).toEqual([]);
    expect(withTick(ticks, t('h00000001', 1, 'Sofia'), false)).toEqual([]);
  });
});
