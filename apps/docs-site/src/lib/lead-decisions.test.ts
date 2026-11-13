import { describe, expect, it } from 'vitest';
import { explorationPrBody, withDecision, withDesignOk, withDoneExploring, withLeadAsked, withLeadAskedTo, withLibraryAsked, withoutLeadAsked, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { decisionRows, decisionTag, designerZoneTitle, leadHomeRow, leadWaitLine, nextName, rowAgeFrom, rowTime, sayerName, turnSince } from './lead-decisions';
import { waitingLabel } from './home-model';

const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };

const start = explorationPrBody({ name: 'Late tag', purpose: 'p', slug: 'late-tag', author: 'ann' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const asked = withLeadAsked(start, { at: '2026-11-07T10:00:00.000Z', by: 'ann' });
const lead = { viewer: 'flo', lead: true, own: false };
const designer = { viewer: 'ann', lead: false, own: true };

describe('the Decisions list', () => {
  it('names who said it and what, newest first', () => {
    const rows = decisionRows(
      [
        { kind: 'changes', at: 't1', round: 1, by: 'flo', text: 'Tighter' },
        { kind: 'answer', at: 't2', round: 2, byName: 'Ann' },
        { kind: 'handed', at: 't3', round: 2, by: 'flo', to: ['Mia'] },
        { kind: 'asked-someone', at: 't4', round: 2, by: 'flo', to: ['dana'] },
      ],
      { flo: 'Florian', dana: 'Dana' },
    );
    expect(rows.map((r) => `${r.name} ${r.verb}`)).toEqual(['Florian asked Dana to review', 'Florian handed it over to Mia', 'Ann answered', 'Florian asked for changes']);
    expect(rows[3]!.why).toBe('Tighter');
  });
  it('reads a display name before a login, and never the name prefix', () => {
    expect(sayerName({ by: 'name:Goulou' })).toBe('Goulou');
    expect(sayerName({ byName: 'Ann', by: 'ann' })).toBe('Ann');
  });
});

describe('the tag and the zone', () => {
  it('says what the talk made of it', () => {
    // The one status ladder: changes asked is back to Exploring, a question keeps it In review (who answers is a line).
    expect(decisionTag({ kind: 'changes' }, 'Ann')).toEqual({ label: 'Exploring', tone: 'info' });
    expect(decisionTag({ kind: 'question' }, 'Ann')).toEqual({ label: 'In review', tone: 'neutral' });
    expect(decisionTag({ kind: 'not-doing' }, 'Ann')).toEqual({ label: 'Not doing this', tone: 'neutral' });
    expect(decisionTag(null, 'Ann')).toBeNull();
    expect(designerZoneTitle('changes', 'Florian')).toBe('Florian asks for changes');
    expect(designerZoneTitle('question', 'Florian')).toBe('Florian has a question');
  });
  it('names a reopened exploration after it', () => {
    expect(nextName('Late tag')).toBe('Late tag 2');
    expect(nextName('Late tag 2')).toBe('Late tag 3');
  });
});

describe('the Home of a lead and a designer (board L6)', () => {
  it('two reviews: the row names the hats it asks, one row for both, none without a hat', () => {
    expect(leadHomeRow(asked, { ...lead, lead: false, hats: ['design-review', 'library'] })).toMatchObject({ where: 'needs', line: "ann's screen: your design review and a library decision", hats: ['design-review', 'library'] });
    expect(leadHomeRow(asked, { ...lead, hats: ['design-review'] })?.line).toBe("ann's screen: your design review");
    expect(leadHomeRow(asked, { ...lead, hats: ['library'] })?.line).toBe("ann's screen: a library decision");
    expect(leadHomeRow(asked, { ...lead, hats: [] })).toBeNull();
    expect(leadHomeRow(asked, { ...lead, own: true, hats: ['library'] })).toBeNull();
  });
  it('a lead has it in Needs you only while the next word is theirs', () => {
    expect(leadHomeRow(asked, lead)).toMatchObject({ where: 'needs', line: 'ann is done exploring', action: 'Review' });
    expect(leadHomeRow(asked, { ...lead, lead: false })).toBeNull();
  });
  it('asked by name: the other leads no longer see it', () => {
    const to = withDecision(withLeadAskedTo(asked, ['dana']), { kind: 'asked-someone', at: 't', by: 'flo', to: ['dana'] });
    expect(leadHomeRow(to, lead)).toBeNull();
    expect(leadHomeRow(to, { ...lead, viewer: 'dana' })?.line).toBe('flo asks you to look');
  });
  it('a question: quiet for the lead who asked, Needs you for the designer', () => {
    const q = withDecision(asked, { kind: 'question', at: 't', by: 'flo', text: 'Which tab?' });
    expect(leadHomeRow(q, lead)).toMatchObject({ where: 'waiting', line: 'waiting for ann' });
    expect(leadHomeRow(q, { ...lead, viewer: 'dana' })).toBeNull();
    expect(leadHomeRow(q, designer)).toMatchObject({ where: 'needs', line: 'flo has a question', action: 'Answer' });
  });
  it('the answer moves it up', () => {
    const a = withDecision(withDecision(asked, { kind: 'question', at: 't', by: 'flo', text: 'Which?' }), { kind: 'answer', at: 't2', by: 'ann', text: 'Orders' });
    expect(leadHomeRow(a, lead)).toMatchObject({ where: 'needs', line: 'ann answered your question' });
  });
  it('changes wait on the designer, then a new ask on the lead', () => {
    const c = withDecision(withoutLeadAsked(asked), { kind: 'changes', at: 't', by: 'flo', text: 'Tighter' });
    expect(leadHomeRow(c, designer)?.line).toBe('flo asked for changes');
    expect(leadHomeRow(c, lead)?.where).toBe('waiting');
    const back = withLeadAsked(withDecision(c, { kind: 'answer', at: 't2', by: 'ann', text: 'Done' }), { at: 't3', by: 'ann' });
    expect(leadHomeRow(back, lead)?.line).toBe('ann answered your changes');
  });
  it('nothing once it went to the developers', () => {
    expect(leadHomeRow(withDoneExploring(asked, { branch: 'explore/late-tag', doneAt: 't' }), lead)).toBeNull();
  });
});

describe('a lead while their question waits on the designer', () => {
  it('reads that it is theirs', () => {
    expect(leadWaitLine({ by: 'Flo' }, 'flo', 'GoulouPhoto')).toBe('You asked GoulouPhoto. Waiting for their answer.');
  });
  it('another lead reads who asked', () => {
    expect(leadWaitLine({ by: 'dana', byName: 'Dana' }, 'flo', 'GoulouPhoto')).toBe('Dana asked GoulouPhoto. Waiting for their answer.');
  });
});

describe('one clock for "waiting"', () => {
  it('counts the lead\'s turn from when it was sent for review, never from when it started or last moved', () => {
    expect(turnSince(start)).toBeNull();
    expect(turnSince(asked)).toBe('2026-11-07T10:00:00.000Z');
    // Home's row and the Explorations list read the same moment.
    expect(leadHomeRow(asked, lead)?.since).toBe(turnSince(asked));
    expect(rowAgeFrom({ body: asked, updated: '2026-11-10T03:47:20Z', yourTurn: true })).toBe('2026-11-07T10:00:00.000Z');
    // Not the viewer's turn: when it last moved.
    expect(rowAgeFrom({ body: asked, updated: '2026-11-10T03:47:20Z', yourTurn: false })).toBe('2026-11-10T03:47:20Z');
    expect(rowAgeFrom({ body: start, updated: '2026-11-10T03:47:20Z', yourTurn: true })).toBe('2026-11-10T03:47:20Z');
  });
  it('restarts the clock when the designer answers, and counts the designer\'s turn from the question', () => {
    const q = withDecision(asked, { kind: 'question', at: '2026-11-08T09:00:00.000Z', by: 'flo', text: 'Which tab?' });
    expect(turnSince(q)).toBe('2026-11-08T09:00:00.000Z');
    const a = withDecision(q, { kind: 'answer', at: '2026-11-09T09:00:00.000Z', by: 'ann', text: 'Orders' });
    expect(turnSince(a)).toBe('2026-11-09T09:00:00.000Z');
    expect(leadHomeRow(a, lead)?.since).toBe('2026-11-09T09:00:00.000Z');
  });
  it("keeps counting the library decision from its ask after the design review's Looks right (never New today)", () => {
    const both = withLibraryAsked(withLeadAsked(withPiecesRecord(start, { checkedAt: 't', pieces: [timeline], links: [] }), { at: '2026-11-07T10:00:00.000Z', byName: 'Sofia' }), { at: '2026-11-07T10:00:00.000Z' });
    expect(turnSince(both)).toBe('2026-11-07T10:00:00.000Z');
    const yes = withDecision(withDesignOk(both, { at: '2026-11-12T11:00:00.000Z' }), { kind: 'looks-right', hat: 'design', at: '2026-11-12T11:00:00.000Z', byName: 'Dana' });
    expect(turnSince(yes)).toBe('2026-11-07T10:00:00.000Z');
    expect(waitingLabel(turnSince(yes)!, Date.parse('2026-11-12T12:00:00.000Z'))).toBe('Waiting 5 days');
  });
  it('a listed row that waits on the viewer says Home\'s "Waiting 5 days", never its last change; any other row its last change', () => {
    const both = withLibraryAsked(withLeadAsked(withPiecesRecord(start, { checkedAt: 't', pieces: [timeline], links: [] }), { at: '2026-11-07T10:00:00.000Z', byName: 'Sofia' }), { at: '2026-11-07T10:00:00.000Z' });
    const yes = withDecision(withDesignOk(both, { at: '2026-11-12T11:00:00.000Z' }), { kind: 'looks-right', hat: 'design', at: '2026-11-12T11:00:00.000Z', byName: 'Dana' });
    const now = Date.parse('2026-11-12T12:00:00.000Z');
    const ago = (iso: string) => `changed ${iso.slice(0, 10)}`;
    expect(rowTime({ body: yes, updated: '2026-11-11T09:00:00Z', waitsOnViewer: true, now }, ago)).toBe('Waiting 5 days');
    expect(rowTime({ body: yes, updated: '2026-11-11T09:00:00Z', waitsOnViewer: false, now }, ago)).toBe('changed 2026-11-11');
    // Next to a "Waiting for ..." note, waiting is said once.
    expect(rowTime({ body: yes, updated: '2026-11-11T09:00:00Z', waitsOnViewer: true, now, line: 'Waiting for your library decision on Timeline' }, ago)).toBe('5 days');
    expect(rowTime({ body: yes, updated: '2026-11-11T09:00:00Z', waitsOnViewer: true, now, line: 'Sofia sent it for review' }, ago)).toBe('Waiting 5 days');
  });
});
