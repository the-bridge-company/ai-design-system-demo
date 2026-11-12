import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { libraryEdits, missingPieces } from '../src/audit';
import { loadDesignSystem } from '../src/node/audit';
import { explorationPrBody, parseExplorationBody, withExplorationLibrary, withLeadAsked } from '../src/explorations';
import {
  cleanExplorationLibrary,
  componentWords,
  explorationKeyOf,
  impactItemOf,
  impactItems,
  impactQueueLine,
  impactStatus,
  impactSummary,
  libraryConflicts,
  localPieces,
  openConflicts,
  piecesToAdd,
  valueWords,
  waitingForLibrary,
  waitingLine,
  withLibraryChoice,
  withLibraryNeeds,
  withoutPieceDecision,
  withPieceDecision,
  type ImpactSource,
} from '../src/library-impact';
import { pieceRequest, type MissingPiece, type PiecesRecord, type ProductBranchRef } from '../src/prod-branch';
import { composeRequestIssue, parseRequestIssue, requestOriginOf } from '../src/requests';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen. The library has nothing like it yet.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const compact: MissingPiece = { id: 'statcard-size-compact', kind: 'variant', title: 'StatCard: compact size', summary: 'A compact size for StatCard.', name: 'compact', component: 'StatCard', aspect: 'size', values: [{ category: 'size', property: 'size', value: 'compact' }], where: [], change: { before: 'default', after: 'compact' } };
const inset: MissingPiece = {
  id: 'token-layout-inset',
  kind: 'token',
  title: 'Token change: Padding inside cards',
  summary: 'From 16px to 12px, everywhere the library uses it, not only in this screen.',
  name: 'Padding inside cards',
  label: 'Padding inside cards',
  values: [{ category: 'token', value: 'var(--space-3)' }],
  where: [],
  token: { path: 'layout.inset', type: 'dimension', value: 'var(--space-3)', files: [] },
  change: { before: 'var(--space-4)', after: 'var(--space-3)', beforeResolved: '16px', afterResolved: '12px' },
};
const cardRestyle = (value: string, resolved: string, id = 'card-deal-card-restyle'): MissingPiece => ({ id, kind: 'variant', title: 'Card: deal card restyle', summary: 'Card restyled from outside the library.', name: 'deal card', component: 'Card', aspect: 'size', values: [{ category: 'spacing', property: 'padding', value, resolved }], where: [], restyle: { selector: '.acme-deal-card' } });
const record = (pieces: MissingPiece[], links: PiecesRecord['links'] = []): PiecesRecord => ({ checkedAt: '2026-11-09T08:00:00.000Z', pieces, links });

describe('the exploration block keeps the library decisions', () => {
  const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-fulfilment-timeline' }, { owner: 'o', repo: 'r', packages: [], apps: {} });

  it('reads an older block without a library part, and writes nothing until a decision', () => {
    expect(parseExplorationBody(start)?.library).toBeUndefined();
    expect(withExplorationLibrary(start, (l) => l ?? {})).toBe(start);
  });

  it('keeps one decision per piece, the last one, and survives the next block write', () => {
    let body = withExplorationLibrary(start, (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'changes', at: '2026-11-09T09:00:00.000Z', byName: 'Dana', text: 'Lighter dots' }));
    body = withExplorationLibrary(body, (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'local', at: '2026-11-09T10:00:00.000Z', byName: 'Dana' }));
    body = withLeadAsked(body, { at: '2026-11-09T11:00:00.000Z', byName: 'Sofia' });
    expect(parseExplorationBody(body)?.library?.decisions).toEqual([{ piece: 'component-timeline', verdict: 'local', at: '2026-11-09T10:00:00.000Z', byName: 'Dana' }]);
  });

  it('drops what GitHub content must not hold: unknown verdicts, emails, endless words', () => {
    const l = cleanExplorationLibrary({
      decisions: [
        { piece: 'a', verdict: 'maybe' as never, at: 'x' },
        { piece: 'b', verdict: 'changes', at: 'x', byName: 'dana@acme.com', by: 'not a login!', text: 'w'.repeat(900) },
      ],
      neededBy: [{ piece: 'b', title: 'Timeline', repo: 'acme/ds', number: 7 }],
    })!;
    expect(l.decisions).toHaveLength(1);
    expect(l.decisions![0]).toEqual({ piece: 'b', verdict: 'changes', at: 'x', text: 'w'.repeat(500) });
    expect(l.neededBy).toEqual([{ piece: 'b', title: 'Timeline', repo: 'acme/ds', number: 7 }]);
    expect(cleanExplorationLibrary({ decisions: [] })).toBeUndefined();
  });

  it('keeps one choice per component part and one need per piece', () => {
    const c = withLibraryChoice(withLibraryChoice(undefined, { component: 'Card', property: 'padding', pick: 'a#1', at: 'x' }), { component: 'card', property: 'Padding', pick: 'both', at: 'y' });
    expect(c.choices).toEqual([{ component: 'card', property: 'Padding', pick: 'both', at: 'y' }]);
    const n = withLibraryNeeds(withLibraryNeeds(undefined, [{ piece: 'p', title: 'T', repo: 'r', number: 1 }]), [{ piece: 'p', title: 'T', repo: 'r', number: 2 }]);
    expect(n.neededBy).toEqual([{ piece: 'p', title: 'T', repo: 'r', number: 2 }]);
  });
});

describe('the rows in plain words', () => {
  it('names components, sizes, restyles and tokens the way people say them', () => {
    expect(impactItemOf(timeline)).toMatchObject({ kind: 'component', title: 'Timeline' });
    expect(impactItemOf(compact)).toMatchObject({ kind: 'variant', of: 'Stat card', title: 'New size: Compact', before: 'Default', after: 'Compact' });
    expect(impactItemOf(inset)).toMatchObject({ kind: 'token', title: 'Padding inside cards', before: '16', after: '12', token: 'layout.inset', everywhere: true });
    expect(impactItemOf(cardRestyle('var(--space-3)', '12px'))).toMatchObject({ kind: 'variant', of: 'Card', title: 'Room inside', after: '12', property: 'padding', summary: 'Room inside of Card set to 12 in this screen. The library Card has no such option yet.' });
    expect(impactItemOf(compact).summary).toBe('A compact size for Stat card. The current size stays the default.');
    expect(impactItemOf({ ...timeline, id: 'pattern-drag', pattern: true, component: 'Drag cards between columns' }).kind).toBe('pattern');
  });

  it('reads names and values without code', () => {
    expect(componentWords('StatCard')).toBe('Stat card');
    expect(componentWords('order-timeline')).toBe('Order timeline');
    expect(valueWords('var(--space-3)')).toBe('Space 3');
    expect(valueWords('var(--space-3)', '12px')).toBe('12');
    expect(valueWords('20px')).toBe('20');
  });

  it('orders new components first, then changes to components, then tokens', () => {
    expect(impactItems(record([inset, compact, timeline])).map((i) => i.kind)).toEqual(['component', 'variant', 'token']);
  });
});

describe('summary lines', () => {
  it('celebrates nothing to change', () => {
    expect(impactSummary([])).toBe('Nothing. Every piece comes from the library.');
    expect(impactQueueLine(record([]))).toBe('Nothing new for the library');
  });

  it('says what changes in one sentence', () => {
    expect(impactSummary(impactItems(record([timeline])))).toBe('1 new component. Nothing else changes.');
    expect(impactSummary(impactItems(record([inset, compact])))).toBe('1 token change and 1 new size.');
    expect(impactQueueLine(record([timeline]))).toBe('Screen + 1 new component');
    expect(impactQueueLine(record([inset, compact]))).toBe('Screen + 1 token change, 1 new size');
  });

  it('says nothing for an exploration never checked', () => {
    expect(impactQueueLine(undefined)).toBeNull();
  });
});

describe('conflicts', () => {
  const leo: ImpactSource = { key: explorationKeyOf('acme/crm-design', 1), name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', record: record([cardRestyle('var(--space-3)', '12px')]) };
  const sofia: ImpactSource = { key: explorationKeyOf('acme/crm-design', 2), name: 'Contact page summary', product: 'Acme CRM', designer: 'Sofia', record: record([cardRestyle('var(--space-5)', '20px', 'card-contact-summary-card-restyle')]) };
  const ann: ImpactSource = { key: explorationKeyOf('acme/crm-design', 3), name: 'Activity feed filters', product: 'Acme CRM', designer: 'Ann', record: record([]) };

  it('finds the same part of the same component changed two ways', () => {
    const c = libraryConflicts(leo, [sofia, ann]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ component: 'Card', property: 'padding', piece: 'card-deal-card-restyle', mine: { designer: 'Leo', value: '12' }, other: { name: 'Contact page summary', designer: 'Sofia', value: '20' }, pick: null });
    expect(openConflicts(c)).toHaveLength(1);
    expect(impactSummary(impactItems(leo.record), c)).toBe('1 change · 1 needs a choice first, because another exploration changes the same component.');
    expect(impactQueueLine(leo.record, c)).toBe('Screen + 1 library change, 1 needs a choice');
  });

  it('is no conflict when both ways agree, or for itself', () => {
    expect(libraryConflicts(leo, [{ ...sofia, record: record([cardRestyle('var(--space-3)', '12px', 'x')]) }])).toEqual([]);
    expect(libraryConflicts(leo, [leo])).toEqual([]);
  });

  it('is settled by a choice on either side', () => {
    const settled = { ...sofia, library: withLibraryChoice(undefined, { component: 'Card', property: 'padding', pick: 'both', at: 'x' }) };
    const c = libraryConflicts(leo, [settled]);
    expect(c[0]!.pick).toBe('both');
    expect(openConflicts(c)).toEqual([]);
  });

  it('finds two explorations editing one token to different values', () => {
    const a = { ...ann, record: record([inset]) };
    const b = { ...sofia, record: record([{ ...inset, change: { ...inset.change!, after: 'var(--space-5)', afterResolved: '20px' } }]) };
    expect(libraryConflicts(a, [b])[0]).toMatchObject({ component: 'Padding inside cards', property: 'layout.inset' });
  });
});

describe('status per piece', () => {
  const base = { item: { id: 'component-timeline' }, lead: 'Dana' };
  it('waits for the lead until the screen or the piece is approved', () => {
    expect(impactStatus({ ...base, approved: false })).toEqual({ key: 'needs-lead', label: 'Needs Dana', tone: 'neutral' });
    expect(impactStatus({ ...base, approved: true }).label).toBe('Approved');
    expect(impactStatus({ ...base, approved: true, link: { number: 7 } }).label).toBe('Being built');
    expect(impactStatus({ ...base, approved: true, link: { number: 7 }, released: true }).label).toBe('In the library');
  });
  it('reads Exploring for everyone before Done exploring: nobody is asked yet', () => {
    expect(impactStatus({ ...base, lead: 'you', approved: false, asked: false })).toEqual({ key: 'exploring', label: 'Exploring', tone: 'info' });
    expect(impactStatus({ ...base, lead: 'you', approved: false, asked: true }).label).toBe('Needs you');
  });

  it("puts the lead's own answer and an open conflict first", () => {
    expect(impactStatus({ ...base, approved: true, decision: { piece: 'x', verdict: 'local', at: 'x' } }).label).toBe('Kept in this screen');
    expect(impactStatus({ ...base, approved: false, decision: { piece: 'x', verdict: 'existing', at: 'x', use: 'Badge' } }).label).toBe('Uses Badge');
    expect(impactStatus({ ...base, approved: false, decision: { piece: 'x', verdict: 'changes', at: 'x', text: 't' } }).label).toBe('Changes asked');
    const conflict = { component: 'Card', property: 'padding', piece: 'p', mine: { key: 'a', designer: 'Leo', value: '12' }, other: { key: 'b', name: 'n', product: 'p', designer: 'Sofia', value: '20' }, pick: null };
    expect(impactStatus({ ...base, approved: false, conflict }).key).toBe('conflict');
    expect(impactStatus({ ...base, approved: false, conflict: { ...conflict, pick: 'both' } }).key).toBe('needs-lead');
  });
});

describe('Looks right and the library', () => {
  it('adds every piece except the ones answered on their own and the ones already sent', () => {
    const rec = record([timeline, compact, inset], [{ piece: 'token-layout-inset', kind: 'request', number: 3, url: 'u', title: 't', at: 'x' }]);
    const lib = withPieceDecision(undefined, { piece: 'statcard-size-compact', verdict: 'local', at: 'x' });
    expect(piecesToAdd(rec, lib)).toEqual(['component-timeline']);
    expect(piecesToAdd(rec, withPieceDecision(lib, { piece: 'component-timeline', verdict: 'approved', at: 'x' }))).toEqual(['component-timeline']);
    expect(piecesToAdd(undefined, undefined, ['ticked'])).toEqual(['ticked']);
    expect(localPieces(rec, lib).map((p) => p.id)).toEqual(['statcard-size-compact']);
  });

  it('waits for the library until it releases each piece', () => {
    const lib = withLibraryNeeds(undefined, [
      { piece: 'component-timeline', title: 'Timeline', repo: 'acme/ds', number: 7 },
      { piece: 'statcard-size-compact', title: 'Stat card', repo: 'acme/ds', number: 8 },
    ]);
    const waiting = waitingForLibrary(lib, (n) => n.number === 8);
    expect(waiting.map((w) => w.title)).toEqual(['Timeline']);
    expect(waitingLine(waiting)).toBe('Waiting for the library: Timeline');
    expect(waitingLine(waitingForLibrary(lib, () => false))).toBe('Waiting for the library: Timeline and Stat card');
    expect(waitingLine(waitingForLibrary(lib, () => true))).toBeNull();
  });
});

describe('a library request says which exploration it comes from', () => {
  const branch: ProductBranchRef = { pr: 1, title: 'Exploration: Order fulfilment timeline', branch: 'explore/order-fulfillment-timeline', url: 'https://github.com/acme/prints-design/pull/1', productKey: 'prints', productName: 'Acme Prints', repo: 'acme/prints-design' };
  it('carries origin in its Bridge block, read back as it was written', () => {
    const origin = { kind: 'exploration' as const, repo: 'acme/prints-design', number: 1, product: 'prints', name: 'Order fulfilment timeline' };
    const { request } = pieceRequest(timeline, branch, { origin });
    const parsed = parseRequestIssue(composeRequestIssue(request).body);
    expect(requestOriginOf(parsed)).toEqual(origin);
    expect(requestOriginOf(parseRequestIssue(composeRequestIssue(pieceRequest(timeline, branch).request).body))).toBeNull();
  });
});

describe("Bridge's check finds what an exploration changes in the library", () => {
  it('reads a marked piece and a marked pattern, once, only when the branch added them', () => {
    const after = 'export const T = () => <ol data-bridge-piece="Timeline">x</ol>;\nexport const D = () => <div data-bridge-pattern="Drag cards between columns" />;\n';
    const p = libraryEdits([{ path: 'src/orders/T.tsx', before: null, after }]);
    expect(p.map((x) => [x.kind, x.title, x.pattern ?? false])).toEqual([
      ['component', 'New component: Timeline', false],
      ['component', 'New pattern: Drag cards between columns', true],
    ]);
    expect(libraryEdits([{ path: 'src/orders/T.tsx', before: after, after }])).toEqual([]);
  });

  it('reads a token edited in the vendored library of a design copy, with its own description as its name', () => {
    const before = ':root {\n  --space-3: 12px;\n  --space-4: 16px;\n  --layout-inset: var(--space-4); /** Padding inside cards, dialogs, popovers. */\n}\n';
    const after = before.replace('--layout-inset: var(--space-4)', '--layout-inset: var(--space-3)');
    const [t] = libraryEdits([{ path: 'design-system/tokens/tokens.css', before, after }]);
    expect(t!.summary).toBe('From 16 to 12, everywhere the library uses it, not only in this screen.');
    expect(t).toMatchObject({ kind: 'token', label: 'Padding inside cards', token: { path: 'layout.inset' }, change: { before: 'var(--space-4)', after: 'var(--space-3)', beforeResolved: '16px', afterResolved: '12px' } });
    expect(impactItemOf(t!)).toMatchObject({ title: 'Padding inside cards', before: '16', after: '12' });
  });

  it('reads a new size on a component the branch already had', () => {
    const before = "export function StatCard({ size = 'default' }: { label: string; size?: 'default' }) {\n  return null;\n}\n";
    const after = before.replace("size?: 'default'", "size?: 'default' | 'compact'");
    const [s] = libraryEdits([{ path: 'src/ui/index.tsx', before, after }]);
    expect(s).toMatchObject({ kind: 'variant', component: 'StatCard', aspect: 'size', change: { after: 'compact' } });
    expect(impactItemOf(s!).title).toBe('New size: Compact');
  });

  it('reads a size prop a component gains: its first size is today, the others are new', () => {
    const before = "export function StatCard({ label }: { label: string }) {\n  return null;\n}\n";
    const after = "export function StatCard({ label, size = 'default' }: { label: string; size?: 'default' | 'compact' }) {\n  return null;\n}\n";
    expect(libraryEdits([{ path: 'src/ui/index.tsx', before, after }]).map((p) => p.title)).toEqual(['StatCard: compact size']);
    expect(libraryEdits([{ path: 'src/ui/New.tsx', before: null, after }])).toEqual([]);
  });

  it('never audits the vendored library as product code, and resolves a restyle to its value', () => {
    const { index, set } = loadDesignSystem(REPO);
    const r = missingPieces({
      ds: index,
      set,
      files: [
        { path: 'design-system/react/components/Card/Card.module.css', before: '.card { color: red; }\n', after: '.card { color: #c2410c; }\n' },
        { path: 'src/deals/DealCard.tsx', before: null, after: "import { Card } from '@bridge-ds/react';\nexport const D = () => <Card className=\"acme-deal-card\">x</Card>;\n" },
        { path: 'src/deals/deals.css', before: '', after: '.acme-deal-card {\n  padding: var(--space-3);\n}\n' },
      ],
    });
    const restyle = r.pieces.find((p) => p.component === 'Card');
    expect(restyle?.values[0]).toMatchObject({ property: 'padding', value: 'var(--space-3)' });
    expect(restyle?.values[0]?.resolved).toMatch(/px$/);
    expect(r.pieces.some((p) => p.where.some((w) => w.file.startsWith('design-system/')))).toBe(false);
  });
});

describe('a reply to the lead (Library review, LR11)', () => {
  it('takes the answer off the piece, so it waits on the lead again, and keeps the others', () => {
    const at = '2026-11-09T10:00:00Z';
    const l = withPieceDecision(withPieceDecision(undefined, { piece: 'a', verdict: 'existing', use: 'Info surface', at }), { piece: 'b', verdict: 'local', at });
    expect(withoutPieceDecision(l, 'a').decisions?.map((d) => d.piece)).toEqual(['b']);
    expect(withoutPieceDecision(undefined, 'a').decisions).toEqual([]);
  });
});
