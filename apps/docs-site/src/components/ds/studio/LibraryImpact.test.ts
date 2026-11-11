// @vitest-environment jsdom
// "What this changes in the library" (ledger board v3): a component part several screens change differently reads like
// the component's own options. The lead ticks the new ones and the button names the outcome, the designer reads the
// same rows without ticks, and a settled choice folds into one sentence with Change.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { explorationKeyOf, explorationPrBody, libraryConflicts, parseExplorationBody, withExplorationLibrary, withLibraryChoice, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { KEEP_TODAY, libraryImpactView } from '../../../lib/library-impact-view';
import { LibraryImpact } from './LibraryImpact';

const restyle = (id: string, px: number): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled.', name: 'card', component: 'Card', values: [{ category: 'spacing', property: 'padding', value: `${px}px`, resolved: `${px}px` }], where: [], restyle: { selector: '.x' } });
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'Built in this screen.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'p', slug: 'order-fulfilment-timeline' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const body = withPiecesRecord(start, { checkedAt: '2026-11-09T08:00:00.000Z', pieces: [restyle('card-timeline', 20), timeline], links: [], uses: ['Badge'] });
const sofia = { key: explorationKeyOf('acme/prints-design', 1), name: 'Order fulfilment timeline', product: 'Acme Prints', designer: 'Sofia', record: { checkedAt: 'x', pieces: [restyle('card-timeline', 20)], links: [] } };
const leo = { key: explorationKeyOf('acme/crm-design', 1), name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', record: { checkedAt: 'x', pieces: [restyle('card-deal', 12)], links: [] } };
const base = { designer: 'Sofia', screen: 'Order fulfilment timeline', product: 'Acme Prints', approved: false, others: [leo] };
const shot = { capture: null, designer: 'Sofia', name: 'Order fulfilment timeline', href: '#xp-screen' };

describe('the library block, ledger', () => {
  it('the lead ticks the new option, renames it, and the button says the outcome', async () => {
    const onChoose = vi.fn().mockResolvedValue('Done');
    const onChoice = vi.fn();
    const view = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: libraryConflicts(sofia, [leo]) });
    const { container } = render(createElement(LibraryImpact, { view, actions: { onChoose, onComment: vi.fn(), onPiece: vi.fn() }, say: vi.fn(), screen: shot, newPieces: { capture: null, designer: 'Sofia', choices: {}, onChoice } }));
    expect(screen.getByText('2 changes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Card padding' })).toBeInTheDocument();
    expect(screen.getByText('New option')).toBeInTheDocument();
    expect(screen.getByText('Add to the library')).toBeInTheDocument();
    expect(screen.getByText('Already in the library')).toBeInTheDocument();
    expect(screen.getByText('The default')).toBeInTheDocument();
    expect(screen.getByText("Leo's screen can use Compact as it is · Deal pipeline cards · Acme CRM")).toBeInTheDocument();
    // The new component: one tick, its outcome in words.
    const add = screen.getByRole('checkbox', { name: 'Add Timeline to the library' });
    expect(add).toBeChecked();
    await userEvent.click(add);
    expect(onChoice).toHaveBeenCalledWith('component-timeline', 'local');
    // Only the new value has a tick: the default and Compact are already there.
    const tick = screen.getByRole('checkbox', { name: 'Add Padding: Comfortable to Card' });
    expect(screen.getByRole('button', { name: 'Add Comfortable to Card' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rename Comfortable' }));
    const field = screen.getByRole('textbox', { name: 'Name of the padding option' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Roomy{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Add Roomy to Card' }));
    expect(onChoose).toHaveBeenCalledWith('card-timeline', `sizes:${sofia.key}=Roomy`);
    await userEvent.click(tick);
    await userEvent.click(screen.getByRole('button', { name: "Keep today's Card" }));
    expect(onChoose).toHaveBeenLastCalledWith('card-timeline', KEEP_TODAY);
    await expectNoAxeViolations(container);
  });

  it("the lead's other answers on a new piece sit behind its ⋯, and the open part is marked for Choose Card padding", async () => {
    const onPiece = vi.fn().mockResolvedValue('Asked Sofia.');
    const view = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: libraryConflicts(sofia, [leo]) });
    const { container } = render(createElement(LibraryImpact, { view, actions: { onChoose: vi.fn(), onComment: vi.fn(), onPiece }, say: vi.fn(), screen: shot, newPieces: { capture: null, designer: 'Sofia', choices: {}, onChoice: vi.fn() } }));
    await userEvent.click(screen.getByRole('button', { name: 'More about Timeline' }));
    expect(await screen.findByRole('menuitem', { name: /Ask for changes/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /existing piece/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Ask for changes/ }));
    await userEvent.type(await screen.findByRole('textbox', { name: 'What to change' }), 'Tighter steps');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for changes' }));
    expect(onPiece).toHaveBeenCalledWith('component-timeline', 'changes', 'Tighter steps');
    const waiting = container.querySelectorAll('[data-waiting]');
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.querySelector('h3, h4')!.textContent).toBe('Card padding');
  });

  it('a new component shows a small picture of the screen; a click opens the whole capture in a dialog', async () => {
    const view = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: libraryConflicts(sofia, [leo]) });
    const capture = 'https://example.com/shot.png';
    const { container } = render(createElement(LibraryImpact, { view, actions: { onChoose: vi.fn(), onComment: vi.fn(), onPiece: vi.fn() }, say: vi.fn(), screen: { ...shot, capture }, newPieces: { capture, designer: 'Sofia', choices: {}, onChoice: vi.fn() } }));
    const open = screen.getByRole('button', { name: "Timeline, as built in Sofia's screen, see it full size" });
    expect(open.querySelector('img')!.getAttribute('src')).toBe(capture);
    await expectNoAxeViolations(container);
    await userEvent.click(open);
    const dialog = await screen.findByRole('dialog', { name: "Timeline, as built in Sofia's screen" });
    expect(dialog.querySelector('img')!.getAttribute('alt')).toBe("Timeline, as built in Sofia's screen");
  });

  it('the designer reads the same rows, without ticks or the primary button', () => {
    const view = libraryImpactView({ ...base, body, lead: 'Dana', canDecide: false, designerHere: true, conflicts: libraryConflicts(sofia, [leo]) });
    render(createElement(LibraryImpact, { view, actions: { onComment: vi.fn() }, say: vi.fn(), screen: shot }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Padding: Comfortable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See it in the screen' })).toHaveAttribute('href', '#xp-screen');
  });

  it('once decided, folds into one sentence, with Change for the lead', async () => {
    const decided = withExplorationLibrary(body, (l) => withLibraryChoice(l, { component: 'Card', property: 'padding', pick: `sizes:${sofia.key}`, at: new Date().toISOString(), byName: 'Dana' }));
    const conflicts = libraryConflicts({ ...sofia, library: parseExplorationBody(decided)?.library ?? null }, [leo]);
    const onUndo = vi.fn().mockResolvedValue('Undone.');
    const view = libraryImpactView({ ...base, body: decided, lead: 'you', canDecide: true, conflicts });
    render(createElement(LibraryImpact, { view, actions: { onUndo }, say: vi.fn() }));
    expect(screen.getByText('Decided')).toBeInTheDocument();
    expect(screen.getByText('Comfortable 20 px')).toBeInTheDocument();
    expect(screen.getByText('Sofia and Leo are told.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Padding/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onUndo).toHaveBeenCalledWith('card-timeline');
  });
});
