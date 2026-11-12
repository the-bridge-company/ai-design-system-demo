// @vitest-environment jsdom
// Library review's feedback through the DS: a decision shows a DS Toast with Undo while it waits to be sent, Undo
// takes it back, a sent decision answers with its line; the designer's "who decides" note is a DS Banner; One by one
// on a phone moves with the DS Pagination.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryReviewView, type LibraryReviewProps } from './LibraryReview';
import { change, conflict, LEAD, newComponent } from '../../../lib/library-fixtures.test-helpers';
import type { ReviewData } from '../../../scripts/library-review-data';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  history.replaceState(null, '', '/');
});

const data = (designer = false): ReviewData => ({
  pieces: [change({ mine: designer }), newComponent(), conflict()],
  viewer: designer ? { reviews: false, name: 'Sofia', leadsPublishTier1: false } : LEAD,
  lead: 'Dana',
  tech: null,
  secondLead: null,
  loading: false,
  failed: null,
  thumbs: new Map(),
  products: [],
  screens: new Map(),
  screenRoutes: new Map(),
});

const props = (send: LibraryReviewProps['send'], designer = false): LibraryReviewProps => ({
  load: async (paint) => paint(data(designer)),
  send,
  comment: async () => 'Sent.',
  ask: async () => 'Asked.',
  demo: () => false,
  openDemo: () => {},
  links: { explorations: '/studio/explorations/', howItWorks: '/how-review-works/' },
  go: () => {},
});

describe('Library review feedback, with DS components', () => {
  it('a decision waits in a DS Toast with Undo; Undo takes it back and nothing is sent', async () => {
    const send = vi.fn(async () => 'Added.');
    render(createElement(LibraryReviewView, props(send)));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to the library' }));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.getByText('Added Deeper primary blue.')).toBeInTheDocument();
    fireEvent.click(undo);
    await waitFor(() => expect(screen.queryByText('Added Deeper primary blue.')).toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    expect(send).not.toHaveBeenCalled();
  });

  it('once sent, the waiting toast gives way to the line the send answered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const send = vi.fn(async () => 'Sent to the library.');
    render(createElement(LibraryReviewView, props(send)));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to the library' }));
    await screen.findByRole('button', { name: 'Undo' });
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Sent to the library.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull());
  });

  it('tells a designer who decides in a DS Banner, with the way to how review works', async () => {
    history.replaceState(null, '', '/?view=list');
    render(createElement(LibraryReviewView, props(async () => 'x', true)));
    const banner = await screen.findByRole('region', { name: /Dana decides what the library keeps/ });
    expect(banner).toHaveTextContent('Nothing to do meanwhile.');
    expect(screen.getByRole('link', { name: 'How library review works' })).toHaveAttribute('href', '/how-review-works/');
  });

  it('moves through the pieces with the DS Pagination (compact) in One by one', async () => {
    render(createElement(LibraryReviewView, props(async () => 'x')));
    const pager = await screen.findByRole('navigation', { name: 'Pieces, one by one' });
    expect(pager).toHaveTextContent('Piece 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next piece' }));
    await waitFor(() => expect(pager).toHaveTextContent('Piece 2 of 3'));
  });
});
