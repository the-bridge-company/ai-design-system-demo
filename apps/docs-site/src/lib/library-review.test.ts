// Library review (boards LR2 to LR14): every piece once, who may decide it, the checkbox filters and the words.
import { describe, expect, it } from 'vitest';
import { withNeededBy, type ProductConfig } from '@bridge-ds/core';
import {
  batchable,
  canDecide,
  conflictLede,
  countLine,
  emptyLine,
  filterChoices,
  filterValue,
  groupPieces,
  isTokenStructure,
  joinSmallGroups,
  keepLabel,
  keyAction,
  mergePieces,
  nextActor,
  passes,
  pieceOfChange,
  pieceOfConflict,
  pieceOfExploration,
  publishesWithoutReview,
  reviewParams,
  selectionLine,
  summaryLine,
  waitLine,
  wayLine,
  withReviewParams,
  type ChangeInput,
  type ReviewPiece,
  type Viewer,
} from './library-review';

const PRODUCTS: ProductConfig[] = [
  { key: 'library', name: 'Library', default: true },
  { key: 'prints', name: 'Acme Prints', repo: 'acme/prints' },
  { key: 'crm', name: 'Acme CRM', repo: 'acme/crm' },
];

const LEAD: Viewer = { reviews: true, name: 'Dana', leadsPublishTier1: true };
const DESIGNER: Viewer = { reviews: false, name: 'Sofia', leadsPublishTier1: true };

const needed = (piece: string, title: string, nearest?: string) =>
  withNeededBy('Body.', { pr: 2, title: 'Bulk actions on products', branch: 'explore/bulk', url: 'https://github.com/acme/prints-design/pull/2', product: 'prints', productName: 'Acme Prints', piece, pieceTitle: title, repo: 'acme/prints-design', ...(nearest ? { nearest } : {}) });

const change = (x: Partial<ChangeInput> = {}): ChangeInput => ({
  repo: 'acme/ds',
  number: 13,
  title: 'feat(tokens): Deepen the primary blue for stronger buttons',
  body: needed('color-primary-deeper', 'Deeper primary blue'),
  labels: [],
  statusKind: 'needs-design',
  mine: false,
  by: 'Leo',
  designer: 'Leo',
  ...x,
});

describe('a library change as a piece', () => {
  it('reads its exploration, its words and waits on the lead', () => {
    const p = pieceOfChange(change(), PRODUCTS);
    expect(p).toMatchObject({ title: 'Deeper primary blue', kind: 'Color change', category: 'Colors', state: 'waiting', waitsOn: 'you', tier: 2 });
    expect(p.asked?.name).toBe('Bulk actions on products');
    expect(p.asked?.product).toBe('Acme Prints');
    expect(canDecide(p, LEAD)).toBe(true);
  });

  it('is decided once design said yes, with developers while they build, shipped once merged', () => {
    expect(pieceOfChange(change({ statusKind: 'ready' })).decided).toBe('added');
    expect(pieceOfChange(change({ statusKind: 'ci-running' })).decided).toBe('building');
    expect(pieceOfChange(change({ merged: true })).decided).toBe('shipped');
  });

  it('never lets a lead decide their own change', () => {
    const p = pieceOfChange(change({ mine: true }));
    expect(canDecide(p, LEAD)).toBe(false);
    expect(waitLine(p, { lead: 'Ana', tech: null })).toBe('Waiting on Ana, second reviewer');
  });

  it('keeps a token removal waiting on the tech owner once design approved it (Tier 3 needs both)', () => {
    const p = pieceOfChange(change({ title: 'Deprecate color.bg.zone', body: null, statusKind: 'needs-tech' }));
    expect(p.tier).toBe(3);
    expect(p.state).toBe('waiting');
    expect(p.waitsOn).toBe('tech');
    expect(canDecide(p, LEAD)).toBe(false);
    expect(waitLine(p, { lead: null, tech: 'Malik' })).toBe('Waiting on Malik, tech owner: removing a token needs both');
    expect(isTokenStructure('feat(tokens): Add a highlight surface for new items')).toBe(true);
    expect(isTokenStructure('Deepen the primary blue')).toBe(false);
  });

  it('publishes a lead’s own docs without review', () => {
    const p = pieceOfChange(change({ title: 'Tabs: when tabs are the wrong choice', body: null, labels: ['docs'], mine: true, merged: true }));
    expect(p.tier).toBe(1);
    expect(publishesWithoutReview(p, LEAD)).toBe(true);
    expect(p.decided).toBe('published');
    expect(publishesWithoutReview(p, { ...LEAD, leadsPublishTier1: false })).toBe(false);
  });

  it('carries the match the exploration’s check found', () => {
    expect(pieceOfChange(change({ body: needed('color-highlight', 'Highlight surface', 'info surface'), nearest: 'info surface' })).match).toEqual({ label: 'Info surface' });
  });
});

const item = { id: 'timeline', kind: 'component' as const, title: 'Timeline' };
const xp = (x: Partial<Parameters<typeof pieceOfExploration>[0]> = {}) =>
  pieceOfExploration({ repo: 'acme/prints-design', number: 1, name: 'Order fulfilment timeline', product: 'Acme Prints', productKey: 'prints', href: '/studio/changes/?exploration=1', designer: 'Sofia', item, decision: null, nearest: null, asked: true, mine: false, ...x });

describe('an exploration’s piece', () => {
  it('waits on the lead once Done exploring was said, never before', () => {
    expect(xp()).toMatchObject({ state: 'waiting', kind: 'New component', waitsOn: 'you' });
    expect(xp({ asked: false })).toBeNull();
  });

  it('reads the lead’s decision from the exploration: the same decision on both pages', () => {
    expect(xp({ decision: { verdict: 'local' } })?.decided).toBe('kept');
    expect(xp({ decision: { verdict: 'existing', use: 'Badge' } })?.decidedLabel).toBe('Uses Badge');
    expect(xp({ decision: { verdict: 'approved' } })?.decided).toBe('added');
  });

  it('offers an existing piece only when the match is close', () => {
    expect(xp({ nearest: { label: 'info surface', level: 'high' } })?.match).toEqual({ label: 'Info surface' });
    expect(xp({ nearest: { label: 'info surface', level: 'low' } })?.match).toBeNull();
  });
});

const conflict = () =>
  pieceOfConflict(
    { component: 'Card', property: 'padding', piece: 'card-padding', mine: { key: 'acme/prints-design#1', designer: 'Sofia', value: '24' }, other: { key: 'acme/crm-design#1', name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', value: '12' }, pick: null },
    { name: 'Order fulfilment timeline', product: 'Acme Prints', href: null, productKey: 'prints' },
    'Dana',
    { otherPiece: 'card-room', today: '16' },
  );

describe('a conflict', () => {
  it('is one piece with two ways, each said against today', () => {
    const c = conflict();
    expect(c.conflict?.ways.map((w) => w.line)).toEqual(['More room inside than today: 24 instead of 16.', 'Less room inside than today: 12 instead of 16.']);
    expect(c.conflict?.ways[1]?.piece).toBe('card-room');
    expect(batchable(c, LEAD)).toBe(false);
    expect(canDecide(c, LEAD)).toBe(true);
    expect(wayLine('padding', '24', null)).toBe("Room inside set to 24. Today's library has no such option.");
    expect(wayLine('padding', '20', null, { designer: 'Leo', value: '12' })).toBe("More room inside: 20, where Leo's way has 12. Today's library has no such option.");
  });

  it('opens with today’s context when Bridge knows it', () => {
    expect(conflictLede({ title: 'Card', screens: 14 })).toBe('Both screens wait on this. Card is in 14 screens today; pick one way for the library, the other screen adapts or keeps its own.');
    expect(conflictLede({ title: 'Card', screens: null })).toBe('Both screens wait on this. Pick one way for the library, the other screen adapts or keeps its own.');
  });

  it('takes the place of both sides’ own pieces of that part', () => {
    const c = conflict();
    const side = pieceOfExploration({ repo: 'acme/crm-design', number: 1, name: 'Deal pipeline cards', product: 'Acme CRM', productKey: 'crm', href: null, designer: 'Leo', item: { id: 'card-room', kind: 'variant', title: 'Room inside', of: 'Card', property: 'padding', after: '12' }, decision: null, nearest: null, asked: true, mine: false })!;
    const other = xp();
    expect(mergePieces([], [side, other!], [c], new Set()).map((p) => p.key)).toEqual([c.key, other!.key]);
  });
});

describe('every piece once', () => {
  it('drops a recorded piece that already has its library change', () => {
    const p = xp()!;
    expect(mergePieces([], [p], [], new Set(['acme/prints-design#1:timeline']))).toEqual([]);
  });
});

const pieces = (): ReviewPiece[] => [pieceOfChange(change()), pieceOfChange(change({ number: 14, title: 'feat(tokens): Add a 56px spacing step', body: null, by: 'Dana', mine: true })), xp()!];

describe('filters', () => {
  it('opens on Waiting for everyone, on her own pieces for a designer', () => {
    expect(reviewParams('', { reviews: true }).filters).toEqual({ status: ['waiting'], asked: [], product: [] });
    expect(reviewParams('', { reviews: false }).filters.asked).toEqual(['you']);
    expect(reviewParams('?view=list&status=decided&product=crm,prints', { reviews: true })).toEqual({ view: 'list', filters: { status: ['decided'], asked: [], product: ['crm', 'prints'] } });
  });

  it('writes only what differs from the defaults', () => {
    expect(withReviewParams('', { status: ['waiting'], asked: [], product: [] }, 'one', { reviews: true })).toBe('');
    expect(withReviewParams('', { status: ['waiting'], asked: [], product: [] }, 'one', { reviews: false })).toBe('?asked=anyone');
    expect(reviewParams('?asked=anyone', { reviews: false }).filters.asked).toEqual([]);
    expect(withReviewParams('?x=1', { status: ['decided'], asked: ['you'], product: ['crm'] }, 'list', { reviews: true })).toBe('?x=1&status=decided&asked=you&product=crm&view=list');
  });

  it('narrows by status, asker and product', () => {
    const all = pieces();
    expect(all.filter((p) => passes(p, { status: [], asked: ['you'], product: [] })).map((p) => p.source)).toEqual([all[1]!.source]);
    expect(all.filter((p) => passes(p, { status: [], asked: [], product: ['library'] }))).toHaveLength(1);
    const choices = filterChoices(all);
    expect(choices.asked[0]).toEqual({ value: 'you', label: 'You' });
    expect(choices.product.at(-1)).toEqual({ value: 'library', label: 'Library' });
    expect(filterValue('asked', [], choices.asked)).toBe('Anyone');
    expect(filterValue('status', ['waiting'], [{ value: 'waiting', label: 'Waiting' }])).toBe('Waiting');
  });
});

describe('groups and words', () => {
  it('groups by what changes, the viewer’s own last', () => {
    const g = groupPieces(pieces(), LEAD);
    expect(g.map((x) => x.label)).toEqual(['For you to decide', 'Yours, waiting on someone else']);
    expect(g.at(-1)?.note).toBe('You never approve your own change');
    expect(groupPieces(pieces().filter((p) => !p.mine), LEAD).map((x) => x.label)).toEqual(['Colors', 'Timeline']);
  });

  it('names who acts next on the viewer’s own piece, once per row', () => {
    const own = pieceOfChange(change({ mine: true }));
    expect(nextActor(own, { tech: 'Malik', secondLead: 'Ana' })).toEqual({ name: 'Ana', label: 'Ana' });
    const removal = pieceOfChange(change({ title: 'Remove the old zone background token', body: null, statusKind: 'needs-tech', mine: true }));
    expect(nextActor(removal, { tech: 'Malik', secondLead: 'Ana' })).toEqual({ name: 'Malik', label: 'Malik, tech' });
    expect(nextActor(pieceOfChange(change()), { tech: 'Malik', secondLead: 'Ana' })).toBeNull();
  });

  it('joins small component groups asked by the same exploration', () => {
    const a = xp({ item: { id: 'avatar', kind: 'variant', title: 'New size: Xl', of: 'Avatar', property: 'size' } })!;
    const b = xp({ item: { id: 'ph', kind: 'component', title: 'ProfileHeader' } })!;
    expect(joinSmallGroups(groupPieces([a, b], LEAD)).map((x) => x.label)).toEqual(['Avatar and ProfileHeader']);
  });

  it('counts what waits for the lead and what of theirs waits on others', () => {
    const all = pieces();
    expect(countLine(all, all, LEAD, { status: ['waiting'], asked: [], product: [] })).toBe('2 wait for you · 1 of yours waits on others');
    expect(countLine(all, all.slice(0, 1), DESIGNER, { status: ['waiting'], asked: ['you'], product: [] })).toBe('1 piece');
  });

  it('says who decides', () => {
    expect(summaryLine(LEAD, 'Dana')).toBe('What enters the library. You decide here; the whole team can look.');
    expect(summaryLine(DESIGNER, 'Dana')).toBe('What enters the library. Dana decides here.');
  });

  it('says what a selection touches before acting', () => {
    const all = pieces();
    expect(selectionLine([all[0]!])).toEqual({ what: '1 color selected', touches: 'Deeper primary blue changes every screen that uses it. Look at it first.' });
    expect(selectionLine([all[2]!]).touches).toBe('Asked by 1 exploration. Nothing changes until a screen uses it.');
    expect(keepLabel(all[0]!)).toBe("Keep in Leo's screen");
  });

  it('celebrates an empty queue with the week in one sentence', () => {
    const done = [pieceOfChange(change({ merged: true })), xp({ decision: { verdict: 'local' } })!, xp({ decision: { verdict: 'existing', use: 'Badge' } })!];
    expect(emptyLine(done, LEAD, 'Dana')).toEqual({ title: 'Nothing waits on the library', sentence: 'You decided all 3 pieces. 1 added, 1 kept in its screen, 1 used an existing piece.' });
    expect(emptyLine(done, DESIGNER, 'Dana').sentence).toBe('Dana decided all your pieces.');
  });

  it('maps the One by one keys', () => {
    expect(['a', 'K', 'ArrowDown', 'ArrowUp', 'x'].map(keyAction)).toEqual(['add', 'keep', 'next', 'prev', null]);
  });
});
