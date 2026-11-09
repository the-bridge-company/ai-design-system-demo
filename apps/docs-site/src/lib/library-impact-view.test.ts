import { describe, expect, it } from 'vitest';
import { explorationKeyOf, explorationPrBody, libraryConflicts, withExplorationLibrary, withLibraryNeeds, withPieceDecision, withPiecesRecord, type MissingPiece, type PiecesRecord } from '@bridge-ds/core';
import { conflictView, leadLibraryLine, libraryImpactView, looksRightBlock, waitingForLibraryLine } from './library-impact-view';

const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen. The library has nothing like it yet.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const compact: MissingPiece = { id: 'statcard-size-compact', kind: 'variant', title: 'StatCard: compact size', summary: 'A compact size for StatCard.', name: 'compact', component: 'StatCard', aspect: 'size', values: [{ category: 'size', property: 'size', value: 'compact' }], where: [], change: { before: 'default', after: 'compact' } };
const inset: MissingPiece = { id: 'token-layout-inset', kind: 'token', title: 'Token change: Padding inside cards', summary: 'From 16px to 12px.', name: 'Padding inside cards', label: 'Padding inside cards', values: [{ category: 'token', value: 'var(--space-3)' }], where: [], token: { path: 'layout.inset', type: 'dimension', value: 'var(--space-3)', files: [] }, change: { before: 'var(--space-4)', after: 'var(--space-3)', beforeResolved: '16px', afterResolved: '12px' } };
const restyle = (value: string, resolved: string, id: string): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled from outside the library.', name: 'card', component: 'Card', values: [{ category: 'spacing', property: 'padding', value, resolved }], where: [], restyle: { selector: '.x' } });

const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-fulfilment-timeline' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const bodyWith = (pieces: MissingPiece[], links: PiecesRecord['links'] = [], uses: string[] = []) => withPiecesRecord(start, { checkedAt: '2026-11-09T08:00:00.000Z', pieces, links, uses });

describe('the section on the exploration page', () => {
  it('says nothing was checked yet, rather than an empty section', () => {
    expect(libraryImpactView({ body: start, designer: 'Sofia', lead: 'Dana', approved: false, canDecide: true })).toEqual({ state: 'unchecked', line: 'Bridge has not checked this exploration against the library yet.' });
  });

  it('celebrates nothing to change, with the pieces it uses and no invented numbers (LI1)', () => {
    const v = libraryImpactView({ body: bodyWith([], [], ['Badge', 'Card']), designer: 'Ann', lead: 'Dana', approved: false, canDecide: true });
    expect(v.state).toBe('nothing');
    if (v.state !== 'nothing') return;
    expect(v.uses).toEqual(['Badge', 'Card']);
    expect(v.line).toContain('Ann built it with the pieces the library already has');
    expect(v.line).not.toMatch(/\d/);
  });

  it('shows a new component waiting for the lead, with the menu for the lead only (LI2)', () => {
    const v = libraryImpactView({ body: bodyWith([timeline], [], ['Card', 'Timeline']), designer: 'Sofia', lead: 'Dana', approved: false, canDecide: true });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.summary).toBe('1 new component. Nothing else changes.');
    expect(v.rows[0]).toMatchObject({ kind: 'New component', title: 'Timeline', status: { label: 'Needs Dana' }, before: { label: 'Not in the library', empty: true }, after: { label: 'Timeline' } });
    expect(v.rows[0]!.menu).toEqual(['approve', 'changes', 'local', 'existing']);
    expect(v.uses).toEqual(['Card']);
    const other = libraryImpactView({ body: bodyWith([timeline]), designer: 'Sofia', lead: 'Dana', approved: false, canDecide: false });
    if (other.state === 'rows') expect(other.rows[0]!.menu).toEqual([]);
    expect(leadLibraryLine(v, 'Sofia')).toBe('Sofia is done exploring. Looks right also accepts the Timeline into the library. To answer one on its own, use its menu.');
  });

  it('shows a token change and a new size in plain words, the token path under Details, and where it reaches (LI3)', () => {
    const v = libraryImpactView({ body: bodyWith([inset, compact]), designer: 'Sofia', lead: 'Dana', approved: false, canDecide: true, products: ['Acme Prints', 'Acme CRM'] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.summary).toBe('1 token change and 1 new size.');
    expect(v.rows.map((r) => [r.kind, r.title])).toEqual([
      ['Change to Stat card', 'New size: Compact'],
      ['Token change', 'Padding inside cards'],
    ]);
    expect(v.rows[1]).toMatchObject({ before: { label: '16' }, after: { label: '12' }, details: [{ label: 'Token', value: 'layout.inset' }] });
    expect(v.reach?.line).toContain('Acme Prints and Acme CRM');
    expect(leadLibraryLine(v, 'Sofia')).toContain('the 2 library changes below');
  });

  it("shows the lead's own answers and what was approved and filed", () => {
    let body = bodyWith([timeline, compact], [{ piece: 'component-timeline', kind: 'request', number: 7, url: 'u', title: 't', at: 'x' }]);
    body = withExplorationLibrary(body, (l) => withPieceDecision(l, { piece: 'statcard-size-compact', verdict: 'changes', at: 'x', byName: 'Dana', text: 'Smaller label too' }));
    const v = libraryImpactView({ body, designer: 'Sofia', lead: 'Dana', approved: true, canDecide: true });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows.map((r) => r.status.label)).toEqual(['Being built', 'Changes asked']);
    expect(v.rows[1]!.note).toBe('Dana: Smaller label too');
    expect(v.rows.every((r) => r.menu.length === 0)).toBe(true);
    const released = libraryImpactView({ body, designer: 'Sofia', lead: 'Dana', approved: true, canDecide: false, released: new Set([7]) });
    if (released.state === 'rows') expect(released.rows[0]!.status.label).toBe('In the library');
  });
});

describe('a conflict (LI4)', () => {
  const leoBody = bodyWith([restyle('var(--space-3)', '12px', 'card-deal')]);
  const leo = { key: explorationKeyOf('acme/crm-design', 1), name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', record: { checkedAt: 'x', pieces: [restyle('var(--space-3)', '12px', 'card-deal')], links: [] } };
  const sofia = { key: explorationKeyOf('acme/crm-design', 2), name: 'Contact page summary', product: 'Acme CRM', designer: 'Sofia', record: { checkedAt: 'x', pieces: [restyle('var(--space-5)', '20px', 'card-summary')], links: [] } };
  const conflicts = libraryConflicts(leo, [sofia]);

  it('blocks Looks right until the lead picks a way, and says why in the bar and the zone', () => {
    const v = libraryImpactView({ body: leoBody, designer: 'Leo', lead: 'Dana', approved: false, canDecide: true, conflicts });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows[0]!.status).toMatchObject({ key: 'conflict', label: 'Two ways' });
    expect(v.rows[0]!.menu).toEqual([]);
    expect(v.conflicts).toHaveLength(1);
    expect(looksRightBlock(conflicts)).toBe('Pick a way for Card first');
    expect(leadLibraryLine(v, 'Leo')).toBe('Leo is done exploring. Pick a way for Card below, then answer. Looks right waits for that choice.');
  });

  it("offers Leo's way, Sofia's way and both, in plain words", () => {
    const c = conflictView(conflicts[0]!);
    expect(c.options.map((o) => [o.label, o.hint])).toEqual([
      ["Leo's way", 'Less room inside: 12'],
      ["Sofia's way", 'More room inside: 20'],
      ['Both, as two sizes', "Compact and roomy, today's stays the default"],
    ]);
    expect(c.note).toBe('Your choice answers both explorations. Sofia and Leo are told.');
  });

  it('opens Looks right again once settled', () => {
    expect(looksRightBlock([{ ...conflicts[0]!, pick: 'both' }])).toBeNull();
  });
});

describe('waiting for the library', () => {
  it('names the pieces the library has not released yet, then clears', () => {
    const body = withExplorationLibrary(start, (l) => withLibraryNeeds(l, [{ piece: 'component-timeline', title: 'Timeline', repo: 'acme/ds', number: 7 }]));
    expect(waitingForLibraryLine(body, () => false)).toBe('Waiting for the library: Timeline');
    expect(waitingForLibraryLine(body, () => true)).toBeNull();
    expect(waitingForLibraryLine(start, () => false)).toBeNull();
  });
});
