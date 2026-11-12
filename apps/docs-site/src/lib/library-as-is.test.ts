// What reaches the lead: a part is a decision only when at least one way is new to the library (owner, 2026-11-12).
import { describe, expect, it } from 'vitest';
import { explorationKeyOf, explorationPrBody, libraryConflicts, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { asIsLine, asIsOption, decisionConflicts, isDecision } from './library-as-is';
import { usesLibraryAsIs } from './library-baseline';
import { libraryImpactView } from './library-impact-view';
import { leadDecisions } from './exploration-layout';
import { pieceOfConflict } from './library-review';

const pad = (v: string, px: string) => ({ category: 'spacing', property: 'padding', value: v, resolved: px });
const restyleOf = (id: string, values: MissingPiece['values']): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled from outside the library.', name: 'card', component: 'Card', values, where: [], restyle: { selector: '.x' } });
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const src = (repo: string, n: number, name: string, product: string, designer: string, pieces: MissingPiece[]) => ({ key: explorationKeyOf(repo, n), name, product, designer, record: { checkedAt: 'x', pieces, links: [] } });

// The sample team: Sofia's Order fulfilment timeline (Acme Prints) and Leo's Deal pipeline cards (Acme CRM).
const sofiaPiece = restyleOf('card-timeline-restyle', [pad('var(--space-6)', '24px')]);
const leoPiece = restyleOf('card-deal-restyle', [pad('var(--space-3)', '12px')]);
const sofia = src('acme-design-demo/acme-prints-design', 1, 'Order fulfilment timeline', 'Acme Prints', 'Sofia', [sofiaPiece, timeline]);
const leo = src('acme-design-demo/acme-crm-design', 1, 'Deal pipeline cards', 'Acme CRM', 'Leo', [leoPiece]);
// The same two screens when Sofia's card keeps the library's default (20 px): every way is already in the library.
const sofiaDefault = { ...sofia, record: { ...sofia.record, pieces: [restyleOf('card-timeline-restyle', [pad('var(--space-5)', '20px')]), timeline] } };

const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-fulfilment-timeline' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const bodyOf = (pieces: MissingPiece[]) => withPiecesRecord(start, { checkedAt: '2026-11-12T08:00:00.000Z', pieces, links: [], uses: ['Card'] });

describe('the rule: a way new to the library makes a decision', () => {
  it('every value already an option of the part (the default included) uses the library as is', () => {
    expect(usesLibraryAsIs('Card', 'padding', ['12'])).toBe(true);
    expect(usesLibraryAsIs('Card', 'padding', ['20', '12px'])).toBe(true);
    expect(usesLibraryAsIs('Card', 'padding', ['24', '12'])).toBe(false);
    // A part Bridge does not know, a value it cannot read, nothing at all: a decision, never hidden on a guess.
    expect(usesLibraryAsIs('Stat card', 'gap', ['12'])).toBe(false);
    expect(usesLibraryAsIs('Card', 'padding', ['Space 3'])).toBe(false);
    expect(usesLibraryAsIs('Card', 'padding', [])).toBe(false);
  });

  it('a piece is as is only when it changes one part to a value the library has', () => {
    expect(asIsOption(leoPiece)?.name).toBe('Compact');
    expect(asIsOption(restyleOf('d', [pad('var(--space-5)', '20px')]))).toMatchObject({ name: 'Default', isDefault: true });
    expect(asIsOption(sofiaPiece)).toBeNull();
    expect(asIsOption(timeline)).toBeNull();
    // A fill on top of the default padding asks for something new.
    expect(asIsOption(restyleOf('f', [pad('var(--space-5)', '20px'), { category: 'color', property: 'background-color', value: 'var(--color-bg-subtle)' }]))).toBeNull();
  });

  it('says it in one quiet line', () => {
    expect(asIsLine('Leo', 'Card', 'padding', { name: 'Compact', px: 12 })).toBe("Leo's screen uses Compact (12 px), already in the library. Nothing to decide.");
    expect(asIsLine('James', 'Card', 'padding', { name: 'Default', px: 20, isDefault: true })).toBe("James' screen uses the default Card padding (20 px), already in the library. Nothing to decide.");
  });
});

describe('the demo: Sofia 24 px and Leo 12 px is a decision', () => {
  const conflicts = libraryConflicts(sofia, [leo]);

  it('stays a conflict, a Library review item and a step for the lead', () => {
    expect(conflicts).toHaveLength(1);
    expect(isDecision(conflicts[0]!, [sofia, leo])).toBe(true);
    expect(decisionConflicts(conflicts, [sofia, leo])).toHaveLength(1);
    const piece = pieceOfConflict(conflicts[0]!, { name: sofia.name, product: sofia.product, href: null, productKey: 'prints' }, 'Dana');
    expect(piece.state).toBe('waiting');
    expect(leadDecisions({ conflicts, staged: [], choices: {} }).map((d) => d.title)).toEqual(['Card padding']);
  });

  it('one new way keeps every way of the part, the ones already in the library included', () => {
    const ann = src('acme-design-demo/acme-crm-design', 3, 'Activity feed filters', 'Acme CRM', 'Ann', [restyleOf('card-feed', [pad('var(--space-5)', '20px')])]);
    const all = libraryConflicts(leo, [ann, sofia]);
    expect(all).toHaveLength(2);
    expect(isDecision(all[0]!, [leo, ann, sofia])).toBe(false);
    expect(decisionConflicts(all, [leo, ann, sofia])).toHaveLength(2);
  });

  it('the exploration page tags it and waits for the lead', () => {
    const v = libraryImpactView({ body: bodyOf(sofia.record.pieces), designer: 'Sofia', lead: 'you', approved: false, canDecide: true, conflicts, others: [leo], screen: sofia.name, product: sofia.product });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.conflicts).toHaveLength(1);
    const card = v.rows.find((r) => r.id === sofiaPiece.id)!;
    expect(card.tag).toEqual({ label: 'New option', tone: 'info' });
    expect(v.conflicts[0]!.ledger.fresh.map((r) => [r.name, r.value])).toEqual([['Comfortable', '24 px']]);
    expect(v.conflicts[0]!.ledger.have.map((r) => [r.name, r.value])).toEqual([
      ['Default', '20 px'],
      ['Compact', '12 px'],
    ]);
  });
});

describe('every way already in the library: nothing to decide', () => {
  const conflicts = libraryConflicts(sofiaDefault, [leo]);

  it('is no conflict, so no Library review item, no count, no step', () => {
    // Core still sees two different values; the rule takes it out before anything counts it.
    expect(conflicts).toHaveLength(1);
    expect(isDecision(conflicts[0]!, [sofiaDefault, leo])).toBe(false);
    const kept = decisionConflicts(conflicts, [sofiaDefault, leo]);
    expect(kept).toEqual([]);
    expect(leadDecisions({ conflicts: kept, staged: [], choices: {} })).toEqual([]);
  });

  it("a side Bridge cannot read stays a decision", () => {
    expect(isDecision(conflicts[0]!, [sofiaDefault])).toBe(true);
  });

  it('the exploration page reads one quiet line, no tag, waiting for nobody', () => {
    const v = libraryImpactView({ body: bodyOf([leoPiece]), designer: 'Leo', lead: 'you', approved: false, canDecide: true, conflicts: libraryConflicts(leo, [sofiaDefault]), others: [sofiaDefault], screen: leo.name, product: leo.product });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.conflicts).toEqual([]);
    const card = v.rows[0]!;
    expect(card.tag).toBeNull();
    expect(card.menu).toEqual([]);
    expect(card.settled?.map((s) => s.text).join('')).toBe("Leo's screen uses Compact (12 px), already in the library. Nothing to decide.");
    expect(v.tail).toBeNull();
  });

  it("the other side's new component still waits for the lead, its Card row does not", () => {
    const v = libraryImpactView({ body: bodyOf(sofiaDefault.record.pieces), designer: 'Sofia', lead: 'you', approved: false, canDecide: true, conflicts, others: [leo] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows.map((r) => [r.title, r.tag?.label ?? null])).toEqual([
      ['Timeline', 'New'],
      ['Room inside', null],
    ]);
    expect(v.tail).toBe('1 waits for you');
  });
});
