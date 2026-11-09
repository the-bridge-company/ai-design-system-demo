// @vitest-environment jsdom
// Explorations (the old Changes): no state tabs; Status, Product and People checkbox filters; Waiting on you pinned
// first with "Your turn · <reason>", never repeated below; List, Grid and Board; library changes left to Library
// review; "Start with one screen" for a team with nothing yet; one line when the filters match nothing.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { BranchesList, type BranchesListProps, type ListRow } from './BranchesList';

const products = [
  { key: 'crm', name: 'Acme CRM' },
  { key: 'prints', name: 'Acme Prints' },
  { key: 'library', name: 'Library', default: true },
];

const xp = (n: number, author: string, over: Partial<ListRow> = {}): ListRow => ({
  number: n,
  title: `Exploration ${n}`,
  jira: null,
  author,
  agent: false,
  opens: 'exploration',
  pill: null,
  lifecycle: 'exploration',
  yourTurn: false,
  behindBy: null,
  signals: null,
  guidance: false,
  head: { ref: `explore/x-${n}`, sha: `s${n}` },
  base: null,
  labels: null,
  neededBy: null,
  requester: null,
  product: 'crm',
  status: 'exploring',
  ...over,
});

/** A library change (a token branch): Library review's, never listed here. */
const libraryChange = (n: number): ListRow => xp(n, 'malik', { opens: 'pr', lifecycle: 'ready', product: null, head: { ref: `bridge/tokens-${n}`, sha: `t${n}` }, status: null, title: `Library change ${n}` });

const props = (over: Partial<BranchesListProps> = {}): BranchesListProps => ({
  rows: [
    xp(1, 'sofia', { status: 'waiting-for-lead', yourTurn: true, turnReason: 'Sofia sent it for review' }),
    xp(2, 'leo', { product: 'prints' }),
    xp(3, 'ann', { status: 'needs-changes' }),
    libraryChange(9),
  ],
  closed: [],
  closedLimit: 50,
  loading: false,
  viewer: 'dana',
  connected: false,
  products,
  readClosed: () => undefined,
  ...over,
});

beforeEach(() => history.replaceState(null, '', '/studio/explorations/'));

describe('Explorations', () => {
  it('has no state tabs, three filters, the count and List, Grid, Board', async () => {
    const { container } = render(createElement(BranchesList, props()));
    expect(screen.queryAllByRole('tab')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Status: In progress' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Product: All products' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'People: Everyone' })).toBeTruthy();
    expect(container.querySelector('.bl-bar')!.textContent).toContain('3 explorations.');
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent ?? r.getAttribute('aria-label') ?? r.textContent)).toHaveLength(3);
    await expectNoAxeViolations(container);
  });

  it('pins Waiting on you first with its reason, and never repeats those rows in the groups', () => {
    const { container } = render(createElement(BranchesList, props()));
    const pinned = container.querySelector('.ex-waiting')!;
    expect(pinned.querySelector('h2')!.textContent).toBe('Waiting on you 1');
    expect(pinned.textContent).toMatch(/Your turn\s·\sSofia sent it for review/);
    expect(screen.getAllByText('Exploration 1')).toHaveLength(1);
    // Groups by product, in the products' order.
    expect([...container.querySelectorAll('.bl-group:not(.ex-waiting) h2')].map((h) => h.textContent)).toEqual(['Acme CRM 1', 'Acme Prints 1']);
  });

  it('keeps Waiting on you whatever the filters, and hides it when nothing waits', async () => {
    history.replaceState(null, '', '/studio/explorations/?status=shipped');
    const { container, rerender } = render(createElement(BranchesList, props()));
    expect(container.querySelector('.ex-waiting')).toBeTruthy();
    rerender(createElement(BranchesList, props({ rows: [xp(2, 'leo')] })));
    expect(container.querySelector('.ex-waiting')).toBeNull();
  });

  it('leaves library changes to Library review', () => {
    render(createElement(BranchesList, props()));
    expect(screen.queryByText('Library change 9')).toBeNull();
  });

  it('filters by several statuses from the Status checkboxes and keeps them in the address', async () => {
    const user = userEvent.setup();
    render(createElement(BranchesList, props()));
    await user.click(screen.getByRole('button', { name: 'Status: In progress' }));
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitemcheckbox');
    // Counts include what waits on you (Exploration 1 is pinned, and still counts as Waiting for lead).
    expect(within(menu).getByRole('menuitemcheckbox', { name: /^Waiting for lead/ }).textContent).toMatch(/1$/);
    expect(items.map((i) => i.textContent?.replace(/\d+$/, ''))).toEqual(['In progress', 'Exploring', 'Waiting for lead', 'Needs changes', 'Waiting for the library', 'Looks right', 'With developers', 'Shipped', 'Not doing this', 'Archived']);
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /^Exploring/ }));
    expect(new URLSearchParams(location.search).get('status')).toBe('waiting-for-lead,needs-changes,waiting-for-library,looks-right,with-developers');
    expect(screen.queryByText('Exploration 2')).toBeNull();
    expect(screen.getByText('Exploration 3')).toBeTruthy();
  });

  it('says what matched nothing, with Clear filters', async () => {
    history.replaceState(null, '', '/studio/explorations/?status=looks-right&people=leo&product=prints');
    const user = userEvent.setup();
    render(createElement(BranchesList, props()));
    expect(screen.getByText(/Nothing looks right by leo in Acme Prints yet\./)).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(location.search).toBe('');
    expect(screen.getByText('Exploration 2')).toBeTruthy();
  });

  it('opens old Changes links on the new Status filter', () => {
    history.replaceState(null, '', '/studio/explorations/?state=shipped');
    render(createElement(BranchesList, props({ closed: [xp(20, 'ann', { merged_at: '2026-11-01T00:00:00Z', lifecycle: 'shipped', status: null })] })));
    expect(screen.getByRole('button', { name: 'Status: Shipped' })).toBeTruthy();
    expect(screen.getByText('Exploration 20')).toBeTruthy();
    expect(screen.queryByText('Exploration 2')).toBeNull();
  });

  it('shows the Board: one column per status, the column naming the status, Shipped of the last 30 days', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, i) => xp(100 + i, 'leo'));
    const { container } = render(createElement(BranchesList, props({ rows: [...props().rows, ...many] })));
    await user.click(screen.getByRole('radio', { name: /Board/ }));
    const cols = [...container.querySelectorAll('.ex-col h2')].map((h) => h.textContent);
    // What waits on you sits in its own column, marked Your turn, and counts there: no pinned list above the Board.
    expect(cols).toEqual(['Exploring 13', 'Waiting for lead 1', 'Needs changes 1', 'Looks right 0', 'With developers 0', 'Shipped, last 30 days 0']);
    expect(container.querySelector('.ex-waiting')).toBeNull();
    const lead = container.querySelectorAll('.ex-col')[1]!;
    expect(lead.textContent).toMatch(/Your turn\s·\sSofia sent it for review/);
    expect(container.querySelector('.bl-bar')!.textContent).toContain('15 explorations.');
    const exploring = container.querySelector('.ex-col')!;
    expect(exploring.querySelectorAll('li').length).toBe(10);
    await user.click(within(exploring as HTMLElement).getByRole('button', { name: 'Show all 13' }));
    expect(exploring.querySelectorAll('li').length).toBe(13);
    // The column says the status: its cards carry no status tag.
    expect(exploring.textContent).not.toContain('Exploring2');
    localStorage.clear();
  });

  it('greets a team with no exploration yet with one start, and the sample team', () => {
    render(createElement(BranchesList, props({ rows: [libraryChange(9)], closed: [] })));
    expect(screen.getByRole('heading', { name: 'Start with one screen' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the sample team' }).getAttribute('href')).toBe('/studio/acme-design-demo/bridge-demo-ds/');
    expect(screen.queryByRole('button', { name: /^Status/ })).toBeNull();
  });

  it('never says the team has nothing when GitHub could not be read', () => {
    render(createElement(BranchesList, props({ rows: [], closed: [], unread: true })));
    expect(screen.queryByRole('heading', { name: 'Start with one screen' })).toBeNull();
  });

  it('shows one display name for one person, even where only the login is recorded', () => {
    render(
      createElement(
        BranchesList,
        props({
          viewer: 'leo-gh',
          rows: [xp(1, 'bridge-app[bot]', { requester: { name: 'Leo Martin', login: 'leo-gh' }, ago: '16 h ago' }), xp(2, 'leo-gh', { requester: { name: null, login: 'leo-gh' }, ago: '29 min ago' })],
        }),
      ),
    );
    expect(screen.queryByText(/leo-gh/)).toBeNull();
    expect(screen.getAllByText(/^Leo/).length).toBeGreaterThanOrEqual(2);
  });
});
