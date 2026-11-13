// @vitest-environment jsdom
// Library review for assistive tech: the List is a valid ARIA table (no row group inside a row group), One by one's
// side list keeps the heading outline (h1, then h2 per family, h3 per group), and axe finds nothing.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { LibraryReviewView, type LibraryReviewProps } from './LibraryReview';
import { change, conflict, LEAD, newComponent } from '../../../lib/library-fixtures.test-helpers';
import type { ReviewData } from '../../../scripts/library-review-data';

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});

const data = (): ReviewData => ({
  pieces: [change(), newComponent(), conflict()],
  viewer: LEAD,
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

const props = (): LibraryReviewProps => ({
  load: async (paint) => paint(data()),
  send: async () => 'Done.',
  comment: async () => 'Sent.',
  ask: async () => 'Asked.',
  demo: () => false,
  openDemo: () => {},
  links: { explorations: '/studio/explorations/', howItWorks: '/how-review-works/' },
  go: () => {},
});

const page = () =>
  render(
    createElement('main', null, createElement('h1', null, 'Library review'), createElement(LibraryReviewView, props())),
  );

describe('Library review, for assistive tech', () => {
  it('draws the List as a table whose row groups sit in the table, never in another row group', async () => {
    history.replaceState(null, '', '/?view=list');
    page();
    const table = await screen.findByRole('table', { name: 'Library pieces' });
    const groups = within(table).getAllByRole('rowgroup');
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.parentElement?.closest('[role="rowgroup"]')).toBeNull();
    // Every row is owned by the table or one of its row groups.
    for (const r of within(table).getAllByRole('row')) expect(r.closest('[role="rowgroup"], [role="table"]')).not.toBeNull();
    // Each family still has its name, as the h2 of its head row.
    expect(within(table).getByRole('heading', { level: 2, name: /Foundations/ })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('keeps the heading outline in One by one: an h2 per family, an h3 per group, no level skipped', async () => {
    page();
    const side = await screen.findByRole('navigation', { name: 'Pieces' });
    await waitFor(() => expect(within(side).getAllByRole('heading').length).toBeGreaterThan(0));
    const levels = within(side)
      .getAllByRole('heading')
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(2);
    // Starting from the page's h1, no heading goes more than one level deeper than the one before it.
    let prev = 1;
    for (const l of levels) {
      expect(l - prev).toBeLessThanOrEqual(1);
      prev = l;
    }
    await expectNoAxeViolations();
  });

  it("filters with Studio's one filter pattern: DS Selects named by their inline label and value, ticked by keyboard", async () => {
    history.replaceState(null, '', '/?view=list');
    page();
    await screen.findByRole('table', { name: 'Library pieces' });
    const status = screen.getByRole('combobox', { name: 'Status: Waiting' });
    expect(screen.getByRole('combobox', { name: 'Asked by: Anyone' })).toHaveClass('bl-filter');
    expect(screen.getByRole('combobox', { name: 'Product: All products' })).toHaveClass('bl-filter');
    status.focus();
    await userEvent.keyboard('{ArrowDown}');
    const list = await screen.findByRole('listbox');
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    // Each option with its count tag; a status with nothing in it (Decided, here) is not listed.
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Waiting3']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    // Products combine: the list stays open while they are ticked, the trigger leads with the first then "+N".
    await userEvent.click(screen.getByRole('combobox', { name: 'Product: All products' }));
    const products = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(products.length).toBeGreaterThan(1);
    const label = (o: HTMLElement) => (o.textContent ?? '').replace(/\d+$/, '');
    await userEvent.click(products[0]!);
    await userEvent.click(products[1]!);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('combobox', { name: `Product: ${label(products[0]!)} +1` })).toBeInTheDocument());
    await expectNoAxeViolations();
  });
});
