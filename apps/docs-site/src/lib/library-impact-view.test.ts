import { describe, expect, it } from 'vitest';
import { explorationKeyOf, explorationPrBody, libraryConflicts, parseExplorationBody, withExplorationLibrary, withLibraryChoice, withLibraryNeeds, withPieceDecision, withPiecesRecord, type MissingPiece, type PiecesRecord } from '@bridge-ds/core';
import { decidedParts, keepLabel, KEEP_TODAY, keptKeys, leadBuildLine, leadLibraryLine, ledgerLabel, ledgerPick, libraryImpactView, libraryOptions, lookOf, looksRightBlock, namesLine, pickNames, pickOf, proposeNames, waitingForLibraryLine, wayWords, type ConflictView } from './library-impact-view';

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
    const words = libraryImpactView({ body: bodyWith([], [], ['SegmentedControl', 'EmptyState']), designer: 'Ann', lead: 'Dana', approved: false, canDecide: false });
    if (words.state === 'nothing') expect(words.uses).toEqual(['Segmented control', 'Empty state']);
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
    expect(leadLibraryLine(v, 'Sofia')).toBe('Sending also adds the Timeline to the library.');
  });

  it('reads Exploring for the lead too while the designer is still exploring: Needs you only once asked', () => {
    const v = libraryImpactView({ body: bodyWith([timeline]), designer: 'Sofia', lead: 'you', approved: false, asked: false, canDecide: false });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows[0]!.status).toMatchObject({ key: 'exploring', label: 'Exploring' });
    expect(leadLibraryLine(v, 'Sofia')).toBeNull();
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
    expect(leadLibraryLine(v, 'Sofia')).toBe('Sending also adds the 2 changes below to the library.');
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

  it('lets the designer reply to "Use an existing piece instead" (LR11), never to another answer', () => {
    let body = bodyWith([timeline, compact]);
    body = withExplorationLibrary(body, (l) => withPieceDecision(withPieceDecision(l, { piece: 'component-timeline', verdict: 'existing', use: 'Badge', at: 'x', byName: 'Dana Reyes' }), { piece: 'statcard-size-compact', verdict: 'local', at: 'x', byName: 'Dana' }));
    const v = libraryImpactView({ body, designer: 'Sofia', lead: 'Dana', approved: false, canDecide: false, replyTo: 'Dana' });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows.map((r) => r.reply)).toEqual(['Dana', null]);
    const lead = libraryImpactView({ body, designer: 'Sofia', lead: 'you', approved: false, canDecide: true });
    if (lead.state === 'rows') expect(lead.rows.every((r) => r.reply === null)).toBe(true);
  });
});

describe('several ways for one component part (EB1 to EB4)', () => {
  const restyleOf = (id: string, values: MissingPiece['values']): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled from outside the library.', name: 'card', component: 'Card', values, where: [], restyle: { selector: '.x' } });
  const pad = (v: string, px: string) => ({ category: 'spacing', property: 'padding', value: v, resolved: px });
  const leoPiece = restyleOf('card-deal', [pad('var(--space-3)', '12px')]);
  const leoBody = bodyWith([leoPiece]);
  const src = (n: number, name: string, designer: string, piece: MissingPiece) => ({ key: explorationKeyOf('acme/crm-design', n), name, product: 'Acme CRM', designer, record: { checkedAt: 'x', pieces: [piece], links: [] } });
  const leo = src(1, 'Deal pipeline cards', 'Leo', leoPiece);
  const sofia = src(2, 'Contact page summary', 'Sofia', restyleOf('card-summary', [pad('var(--space-5)', '20px')]));
  // Ann's way: a filled card with no border, the room inside of today.
  const ann = src(3, 'Activity feed filters', 'Ann', restyleOf('card-feed', [pad('var(--space-4)', '16px'), { category: 'color', property: 'background-color', value: 'var(--color-bg-subtle)', resolved: '#f4f4f5' }, { category: 'border', property: 'border', value: 'none' }]));
  const two = libraryConflicts(leo, [sofia]);
  const three = libraryConflicts(leo, [sofia, ann]);
  const base = { body: leoBody, designer: 'Leo', screen: 'Deal pipeline cards', product: 'Acme CRM', approved: false, now: new Date('2026-11-10T10:00:30Z') };
  const conflictOf = (v: ReturnType<typeof libraryImpactView>): ConflictView => {
    if (v.state !== 'rows') throw new Error(v.state);
    return v.conflicts[0]!;
  };

  it('gives the lead one card: today, each way, both as sizes, and a button that says the outcome', () => {
    const v = libraryImpactView({ ...base, lead: 'you', canDecide: true, conflicts: two, others: [sofia] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.summary).toBe('1 change');
    expect(v.rows[0]).toMatchObject({ kind: 'Change to', title: 'Card', summary: 'Tighter cards on this screen. The library Card has no tighter size yet.', before: null, after: null, menu: [] });
    expect(v.rows[0]!.status).toMatchObject({ key: 'conflict', label: 'Your choice', tone: 'warning' });
    const c = conflictOf(v);
    expect(c.ways.map((w) => [w.label, w.hint])).toEqual([
      ["Leo's way", 'Tighter · this screen'],
      ["Sofia's way", 'Roomier · Contact page summary'],
    ]);
    expect(c.question).toBe('Which way does Card take?');
    expect(c.context.map((s) => s.text).join('')).toBe("Sofia's Contact page summary (Acme CRM) makes Card roomier.");
    expect(c.context[0]!.face).toBe('Sofia');
    expect(c.note).toBe('Answers both screens. Leo and Sofia are told.');
    expect(c.comment).toBe('Comment to both');
    expect(c.todayHint).toBe('In the library now');
    expect(keepLabel('one', [c.ways[0]!.key], c.ways)).toBe("Keep Leo's way");
    expect(keepLabel('sizes', c.ways.map((w) => w.key), c.ways)).toBe('Keep both as sizes');
  });

  it('says tighter or roomier than today when Bridge knows today', () => {
    expect(wayWords([lookOf(leoPiece), lookOf(sofia.record.pieces[0])], 16)).toEqual([
      { size: 'Tighter', thanToday: true },
      { size: 'Roomier', thanToday: true },
    ]);
  });

  it('shows the designer the same block, read only, their way marked theirs, the lead deciding', () => {
    const c = conflictOf(libraryImpactView({ ...base, lead: 'Dana', canDecide: false, designerHere: true, conflicts: two, others: [sofia] }));
    expect(c.decides).toBe(false);
    expect(c.tag).toBe('Dana picks');
    expect(c.ways[0]!.label).toBe("Leo's way (yours)");
    expect(c.question).toBe('Card, two ways');
    expect(c.context.map((s) => s.text).join('')).toBe("Sofia's Contact page summary (Acme CRM) makes it roomier; yours makes it tighter.");
    expect(c.context[0]!.face).toBe('Sofia');
    expect(c.note).toBe("Tell Dana why yours fits this screen. Dana's choice answers both screens.");
    expect(c.comment).toBe('Comment');
  });

  it('never says "Your choice" where the viewer cannot choose: the lead past their answer picks in Library review', () => {
    const href = '/studio/acme/library-review/?asked=o%2Fr%2310';
    // Dana reads Leo's exploration at Check the build: the page offers no choice (approved, no answer bar).
    const v = libraryImpactView({ ...base, lead: 'you', canDecide: true, approved: true, conflicts: two, others: [sofia], reviewHref: href });
    if (v.state !== 'rows') throw new Error(v.state);
    const c = conflictOf(v);
    expect(c.decides).toBe(false);
    expect(c.tag).toBe('Needs you');
    expect(v.rows[0]!.status.label).toBe('Needs you');
    expect(c.question).toBe('Card, two ways');
    expect(c.context.map((s) => s.text).join('')).toBe("Sofia's Contact page summary (Acme CRM) makes it roomier; this screen makes it tighter.");
    expect(c.noteParts).toEqual([{ text: 'Pick in Library review', href }, { text: ': it answers both screens. Leo and Sofia are told.' }]);
    expect(c.note).not.toMatch(/your choice|exploration's page/i);
  });

  it('names the lead and where they pick for anyone else, linked to Library review', () => {
    const href = '/studio/acme/library-review/?asked=o%2Fr%2310';
    const c = conflictOf(libraryImpactView({ ...base, lead: 'Dana', canDecide: false, conflicts: two, others: [sofia], reviewHref: href }));
    expect(c.tag).toBe('Dana picks');
    expect(c.noteParts).toEqual([{ text: 'Dana picks in ' }, { text: 'Library review', href }, { text: ', for both screens.' }]);
    const unknown = conflictOf(libraryImpactView({ ...base, lead: 'the DS lead', canDecide: false, conflicts: two, others: [sofia] }));
    expect(unknown.tag).toBe('The DS lead picks');
    expect(unknown.note).toBe('The DS lead picks in Library review, for both screens.');
  });

  it("tells the build check what the library pieces wait for, instead of 'no library piece changed'", () => {
    const waiting = libraryImpactView({ ...base, lead: 'Dana', canDecide: false, approved: true, conflicts: two, others: [sofia] });
    expect(leadBuildLine(waiting, 'Dana')).toEqual({ waiting: true, line: 'Card waits on Dana in Library review' });
    expect(leadBuildLine(libraryImpactView({ ...base, lead: 'you', canDecide: false, approved: true, conflicts: two, others: [sofia] }), 'you')).toEqual({ waiting: true, line: 'Card waits on you in Library review' });
    const settled = libraryImpactView({ ...base, body: bodyWith([timeline]), lead: 'Dana', canDecide: false, approved: true });
    expect(leadBuildLine(settled, 'Dana')).toEqual({ waiting: false, line: 'Not needed: the library pieces are decided' });
    expect(leadBuildLine(libraryImpactView({ ...base, body: bodyWith([]), lead: 'Dana', canDecide: false, approved: true }), 'Dana')).toBeNull();
  });

  it('puts three designers in one card: one way, or several as sizes; Ann reads filled with no border', () => {
    const c = conflictOf(libraryImpactView({ ...base, lead: 'you', canDecide: true, conflicts: three, others: [sofia, ann] }));
    expect(c.several).toBe(true);
    expect(c.ways.map((w) => w.size)).toEqual(['Tighter', 'Roomier', 'Filled, no border']);
    expect(c.ways[2]!.look).toEqual({ padding: 16, gap: 8, radius: null, borderless: true, filled: true, shadowless: false });
    // Each plate draws its way's own values: tighter and roomier differ from each other, room and spacing alike.
    expect(c.ways.map((w) => [w.look.padding, w.look.gap])).toEqual([
      [12, 6],
      [20, 10],
      [16, 8],
    ]);
    expect(c.context.map((s) => s.text).join('')).toBe("Two more screens change Card: Sofia's Contact page summary makes it roomier, Ann's Activity feed filters makes it filled, no border. All in Acme CRM.");
    expect(c.note).toBe('Answers all 3 screens. Leo, Sofia and Ann are told.');
    expect(c.todayHint).toBe('Stays the default');
    const kept = [c.ways[0]!.key, c.ways[1]!.key];
    expect(keepLabel('sizes', kept, c.ways)).toBe('Keep 2 sizes: Tighter and Roomier');
    expect(pickOf('sizes', kept, c.ways)).toBe(`sizes:${kept.join(' ')}`);
    expect(pickOf('sizes', c.ways.map((w) => w.key), c.ways)).toBe('both');
    expect(pickOf('one', [c.ways[2]!.key], c.ways)).toBe(c.ways[2]!.key);
    expect(pickOf('sizes', [], c.ways)).toBeNull();
  });

  it('reads a way the check recorded as a space token, a gap or a radius', () => {
    expect(lookOf({ values: [{ category: 'spacing', property: 'padding', value: 'var(--space-3)' }] })).toMatchObject({ padding: 12, gap: 6 });
    expect(lookOf({ values: [{ category: 'spacing', property: 'padding', value: '24px' }, { category: 'spacing', property: 'gap', value: '4px' }, { category: 'radius', property: 'border-radius', value: '6px' }] })).toMatchObject({ padding: 24, gap: 4, radius: 6, borderless: false });
    expect(lookOf(null, 'var(--space-5)')).toMatchObject({ padding: 20, gap: 10 });
  });

  it('stays one short line for ten screens or more', () => {
    const many = Array.from({ length: 10 }, (_, i) => src(10 + i, `Screen ${i}`, `P${i}`, restyleOf(`p${i}`, [pad(`${20 + i}px`, `${20 + i}px`)])));
    const c = conflictOf(libraryImpactView({ ...base, lead: 'you', canDecide: true, conflicts: libraryConflicts(leo, many), others: many }));
    expect(c.ways).toHaveLength(11);
    expect(c.context.map((s) => s.text).join('')).toMatch(/^Ten more screens change Card: P0's Screen 0 makes it .*, P1's Screen 1 makes it .* and 8 more\. All in Acme CRM\.$/);
    expect(c.note).toBe('Answers all 11 screens. Everyone who asked is told.');
    expect(namesLine(['Leo', 'Sofia', 'Ann', 'Max', 'Kim'])).toBe('Leo, Sofia and 3 others');
  });

  it('once decided: two lines, the plates kept, this screen ringed, who chose and who is told', () => {
    const pick = 'both';
    const body = withExplorationLibrary(leoBody, (l) => withLibraryChoice(l, { component: 'Card', property: 'padding', pick, at: '2026-11-10T10:00:00Z', byName: 'Dana' }));
    const settled = libraryConflicts({ ...leo, library: parseExplorationBody(body)?.library ?? null }, [sofia]);
    const v = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: settled, others: [sofia] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows[0]!.status).toMatchObject({ label: 'Decided', tone: 'success' });
    const d = v.conflicts[0]!.decided!;
    expect(d.title).toBe('Card gets two new sizes');
    expect(d.by).toBe('Dana, just now');
    expect(d.told).toBe('Leo and Sofia are told');
    expect(d.plates.map((p) => [p.label, p.sub, p.chip])).toEqual([
      ['Today', 'Stays the default', null],
      ['Tighter', null, 'This screen'],
      ['Roomier', 'Contact page summary', null],
    ]);
    expect(looksRightBlock(settled)).toBeNull();
    const one = keptKeys(sofia.key, v.conflicts[0]!.ways);
    expect(one).toEqual({ mode: 'one', keys: [sofia.key] });
  });

  it("reads Card padding like Card's own options (board v3): the new value to add, the default and Compact already there", () => {
    const v = libraryImpactView({ ...base, lead: 'you', canDecide: true, conflicts: two, others: [sofia] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.count).toBe('1 change');
    expect(v.tail).toBe('1 waits for you');
    expect(v.rows[0]!.tag).toEqual({ label: 'New option', tone: 'info' });
    expect(v.rows[0]!.origin).toEqual({ people: ['Leo', 'Sofia'], products: ['Acme CRM'] });
    const L = conflictOf(v).ledger;
    expect(L.property).toBe('Padding');
    expect(L.fresh.map((r) => [r.name, r.value, r.delta, r.line])).toEqual([['Comfortable', '20 px', '+4 px', "Sofia's way · Contact page summary · Acme CRM"]]);
    expect(L.have.map((r) => [r.name, r.value, r.delta, r.isDefault, r.line])).toEqual([
      ['Default', '16 px', null, true, 'Every screen gets it today. It stays the default.'],
      ['Compact', '12 px', '−4 px', false, "Leo's screen can use Compact as it is · Deal pipeline cards · Acme CRM"],
    ]);
  });

  it('continues the option series for new values and says the outcome on the button', () => {
    const card = libraryOptions('Card', 'padding', null);
    expect([...proposeNames([20, 24], card)]).toEqual([
      [20, 'Comfortable'],
      [24, 'Spacious'],
    ]);
    expect([...proposeNames([8, 4, 28], card)]).toEqual([
      [28, 'Comfortable'],
      [8, 'Tight'],
      [4, 'Dense'],
    ]);
    // A part Bridge does not know: today's value is the default, the rest continues from it.
    expect(libraryOptions('Stat card', 'padding', 16)).toEqual([{ name: 'Default', px: 16, isDefault: true }]);
    expect(ledgerLabel('Card', ['Comfortable'])).toBe('Add Comfortable to Card');
    expect(ledgerLabel('Card', ['Comfortable', 'Spacious'])).toBe('Add 2 options to Card');
    expect(ledgerLabel('Card', [])).toBe("Keep today's Card");
  });

  it('records the ticks and a rename in the pick, and folds a decided part into one sentence', () => {
    expect(ledgerPick([])).toBe(KEEP_TODAY);
    const pick = ledgerPick([{ keys: [sofia.key], name: 'Roomy', proposed: 'Comfortable' }]);
    expect(pick).toBe(`sizes:${sofia.key}=Roomy`);
    expect(pickNames(pick)).toEqual({ [sofia.key]: 'Roomy' });
    expect(ledgerPick([{ keys: [sofia.key], name: 'Comfortable', proposed: 'Comfortable' }])).toBe(`sizes:${sofia.key}`);
    const body = withExplorationLibrary(leoBody, (l) => withLibraryChoice(l, { component: 'Card', property: 'padding', pick: `sizes:${sofia.key}`, at: '2026-11-10T10:00:00Z', byName: 'Dana Wells' }));
    const settled = libraryConflicts({ ...leo, library: parseExplorationBody(body)?.library ?? null }, [sofia]);
    const v = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: settled, others: [sofia] });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.tail).toBe('decided');
    expect(v.rows[0]!.tag).toEqual({ label: 'Decided', tone: 'success' });
    const said = v.rows[0]!.settled!;
    expect(said.map((s) => s.text).join('')).toBe("Card gets a new padding option, Comfortable 20 px, for Sofia's screen. Default 16 px stays the default. Decided by Dana, just now.");
    expect(said.filter((s) => s.strong).map((s) => s.text)).toEqual(['Comfortable 20 px', 'Default 16 px']);
    const renamed = decidedParts(pick, v.conflicts[0]!.ways, 'Card', v.conflicts[0]!.ledger, '');
    expect(renamed.map((s) => s.text).join('')).toBe("Card gets a new padding option, Roomy 20 px, for Sofia's screen. Default 16 px stays the default.");
    const kept = decidedParts(KEEP_TODAY, v.conflicts[0]!.ways, 'Card', v.conflicts[0]!.ledger, '');
    expect(kept.map((s) => s.text).join('')).toBe('Card keeps its padding options as they are. Default 16 px stays the default.');
    expect(keptKeys(KEEP_TODAY, v.conflicts[0]!.ways)).toEqual({ mode: 'sizes', keys: [] });
  });

  it('folds a decided new component into one sentence, with who decided', () => {
    const body = withExplorationLibrary(bodyWith([timeline]), (l) => withPieceDecision(l, { piece: 'component-timeline', verdict: 'approved', at: '2026-11-10T10:00:00Z', byName: 'Dana' }));
    const v = libraryImpactView({ body, designer: 'Sofia', product: 'Acme Prints', lead: 'you', approved: false, canDecide: true, now: new Date('2026-11-10T10:00:20Z') });
    if (v.state !== 'rows') throw new Error(v.state);
    expect(v.rows[0]!.tag).toEqual({ label: 'Decided', tone: 'success' });
    expect(v.rows[0]!.origin).toEqual({ people: ['Sofia'], products: ['Acme Prints'] });
    expect(v.rows[0]!.settled!.map((s) => s.text).join('')).toBe('Timeline is added to the library, for every product. Decided by Dana, just now.');
    expect(v.tail).toBe('decided');
    const open = libraryImpactView({ body: bodyWith([timeline]), designer: 'Sofia', lead: 'you', approved: false, canDecide: true });
    if (open.state !== 'rows') throw new Error(open.state);
    expect(open.rows[0]!.tag).toEqual({ label: 'New', tone: 'info' });
    expect(open.rows[0]!.settled).toBeNull();
  });

  it('offers the choice in the library section only: the zone says nothing of it, the bar points to it', () => {
    const v = libraryImpactView({ ...base, lead: 'you', canDecide: true, conflicts: two, others: [sofia] });
    expect(leadLibraryLine(v, 'Leo')).toBeNull();
    expect(looksRightBlock(two)).toBe('Choose Card padding');
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
