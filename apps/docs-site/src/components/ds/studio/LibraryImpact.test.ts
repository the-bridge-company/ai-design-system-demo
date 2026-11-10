// @vitest-environment jsdom
// "What this changes in the library", a component several screens change differently (EB1 to EB4): the lead picks in
// the block, the designer reads it, a settled choice says what the library gets.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { explorationKeyOf, explorationPrBody, libraryConflicts, parseExplorationBody, withExplorationLibrary, withLibraryChoice, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { libraryImpactView } from '../../../lib/library-impact-view';
import { LibraryImpact } from './LibraryImpact';

const restyle = (id: string, px: number): MissingPiece => ({ id, kind: 'variant', title: 'Card: restyle', summary: 'Card restyled.', name: 'card', component: 'Card', values: [{ category: 'spacing', property: 'padding', value: `${px}px`, resolved: `${px}px` }], where: [], restyle: { selector: '.x' } });
const start = explorationPrBody({ name: 'Deal pipeline cards', purpose: 'p', slug: 'deal-pipeline-cards' }, { owner: 'o', repo: 'r', packages: [], apps: {} });
const body = withPiecesRecord(start, { checkedAt: '2026-11-09T08:00:00.000Z', pieces: [restyle('card-deal', 12)], links: [], uses: ['Badge'] });
const leo = { key: explorationKeyOf('acme/crm-design', 1), name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', record: { checkedAt: 'x', pieces: [restyle('card-deal', 12)], links: [] } };
const sofia = { key: explorationKeyOf('acme/crm-design', 2), name: 'Contact page summary', product: 'Acme CRM', designer: 'Sofia', record: { checkedAt: 'x', pieces: [restyle('card-summary', 20)], links: [] } };
const base = { designer: 'Leo', screen: 'Deal pipeline cards', product: 'Acme CRM', approved: false, others: [sofia] };

describe('several ways for Card', () => {
  it('the lead picks in one card, and the button says the outcome', async () => {
    const onChoose = vi.fn().mockResolvedValue('Kept');
    const view = libraryImpactView({ ...base, body, lead: 'you', canDecide: true, conflicts: libraryConflicts(leo, [sofia]) });
    const { container } = render(createElement(LibraryImpact, { view, actions: { onChoose, onComment: vi.fn() }, say: vi.fn() }));
    expect(screen.getByText('Your choice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Keep Leo's way" })).toBeEnabled();
    await userEvent.click(screen.getByRole('radio', { name: /Sofia's way/ }));
    await userEvent.click(screen.getByRole('button', { name: "Keep Sofia's way" }));
    expect(onChoose).toHaveBeenCalledWith('card-deal', sofia.key);
    await userEvent.click(screen.getByRole('radio', { name: /Both, as two sizes/ }));
    expect(screen.getByRole('button', { name: 'Keep both as sizes' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('the designer reads the same block, their way marked, with a Comment and no choice', () => {
    const view = libraryImpactView({ ...base, body, lead: 'Dana', canDecide: false, designerHere: true, conflicts: libraryConflicts(leo, [sofia]) });
    render(createElement(LibraryImpact, { view, actions: { onComment: vi.fn() }, say: vi.fn() }));
    expect(screen.getByText('Dana picks')).toBeInTheDocument();
    expect(screen.getByText("Leo's way (yours)")).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
  });

  it('once decided, says what the library gets, with Undo for the lead', async () => {
    const decided = withExplorationLibrary(body, (l) => withLibraryChoice(l, { component: 'Card', property: 'padding', pick: 'both', at: new Date().toISOString(), byName: 'Dana' }));
    const conflicts = libraryConflicts({ ...leo, library: parseExplorationBody(decided)?.library ?? null }, [sofia]);
    const onUndo = vi.fn().mockResolvedValue('Undone.');
    const view = libraryImpactView({ ...base, body: decided, lead: 'you', canDecide: true, conflicts });
    render(createElement(LibraryImpact, { view, actions: { onUndo }, say: vi.fn() }));
    expect(screen.getByRole('heading', { name: 'Card gets two new sizes' })).toBeInTheDocument();
    expect(screen.getByText('Decided')).toBeInTheDocument();
    expect(screen.getByText('This screen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledWith('card-deal');
  });
});
