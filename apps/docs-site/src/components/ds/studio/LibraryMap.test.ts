// @vitest-environment jsdom
// The Map of Library review is only a way in (owner, 2026-11-13): under the map sits the List itself, the same rows,
// checkboxes and decisions, narrowed to the box picked. A designer still sees no decision there, as in the List.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryReviewView, type LibraryReviewProps } from './LibraryReview';
import { change, conflict, LEAD, newComponent } from '../../../lib/library-fixtures.test-helpers';
import type { ReviewData } from '../../../scripts/library-review-data';

afterEach(() => {
  cleanup();
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

const props = (designer = false): LibraryReviewProps => ({
  load: async (paint) => paint(data(designer)),
  send: async () => 'Done.',
  comment: async () => 'Sent.',
  ask: async () => 'Asked.',
  demo: () => false,
  openDemo: () => {},
  links: { explorations: '/studio/explorations/', howItWorks: '/how-review-works/' },
  go: () => {},
});

const titles = (table: HTMLElement) => within(table).queryAllByRole('row').flatMap((r) => [...r.querySelectorAll('.lr-row-title')].map((t) => t.textContent));

const open = async (view: 'map' | 'list', designer = false) => {
  history.replaceState(null, '', `/?view=${view}`);
  render(createElement(LibraryReviewView, props(designer)));
  return screen.findByRole('table', { name: 'Library pieces' });
};

describe('the List under the map', () => {
  it('shows the whole List under the map while no box is picked, the same rows as the List view', async () => {
    const list = titles(await open('list'));
    cleanup();
    const table = await open('map');
    expect(screen.getByRole('region', { name: 'Where each piece comes from and who gets it' })).toBeInTheDocument();
    expect(titles(table)).toEqual(list);
    // No hint, no compact row: the List itself.
    expect(screen.queryByText('Click a box to see what it asks for.')).toBeNull();
    expect(within(table).getByRole('checkbox', { name: 'Select Deeper primary blue' })).toBeInTheDocument();
  });

  it('a picked exploration narrows the same List, with checkboxes and Decide for the lead, said once', async () => {
    await open('map');
    fireEvent.click(screen.getByRole('button', { name: /^Contact page summary/ }));
    expect(location.search).toContain('focus=');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Showing what Contact page summary asks for2 of 3');
    expect(within(status).getByRole('button', { name: 'Show all 3' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Library pieces' });
    expect(titles(table).sort()).toEqual(['Card', 'ProfileHeader']);
    expect(within(table).getByRole('button', { name: 'Decide ProfileHeader' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Compare Card' })).toBeInTheDocument();
    // The selection is the List's own: a checkbox brings the List's selection bar.
    fireEvent.click(within(table).getByRole('checkbox', { name: 'Select ProfileHeader' }));
    expect(screen.getByRole('region', { name: 'Selected pieces' })).toBeInTheDocument();
    // Show all widens back to the whole List, like clearing a filter (the selection clears too).
    fireEvent.click(within(status).getByRole('button', { name: 'Show all 3' }));
    expect(titles(screen.getByRole('table', { name: 'Library pieces' }))).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Selected pieces' })).toBeNull();
    expect(location.search).not.toContain('focus=');
  });

  it('one piece picked: its own List row with the count, its name said once by the row', async () => {
    await open('map');
    fireEvent.click(screen.getByRole('button', { name: /^ProfileHeader/ }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^1 of 3Show all 3$/);
    const table = screen.getByRole('table', { name: 'Library pieces' });
    expect(titles(table)).toEqual(['ProfileHeader']);
    expect(within(table).getByRole('checkbox', { name: 'Select ProfileHeader' })).toBeInTheDocument();
    // The title opens One by one, as in the List.
    fireEvent.click(within(table).getByRole('link', { name: 'ProfileHeader' }));
    expect(screen.queryByRole('region', { name: 'Where each piece comes from and who gets it' })).toBeNull();
  });

  it('a designer sees the List under the map with no checkbox and no decision', async () => {
    const table = await open('map', true);
    expect(screen.getByRole('region', { name: 'Where each piece comes from and who gets it' })).toBeInTheDocument();
    expect(titles(table).length).toBeGreaterThan(0);
    expect(within(table).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(table).queryByRole('button', { name: /^(Decide|Compare) / })).toBeNull();
  });
});
