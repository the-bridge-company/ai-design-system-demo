// @vitest-environment jsdom
// Explorations (the old Changes): no state tabs; Status, Product and People checkbox filters; Waiting on you pinned
// first with "Your turn · <reason>", never repeated below; List, Grid and Board; library changes left to Library
// review; "Start with one screen" for a team with nothing yet; one line when the filters match nothing.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
    xp(1, 'sofia', { status: 'in-review', yourTurn: true, turnReason: 'Sofia sent it for review' }),
    xp(2, 'leo', { product: 'prints' }),
    xp(3, 'ann', { status: 'checking' }),
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

// The list loads these lazily once painted (people and thumbnails, the nav count, Start an exploration). Loaded here
// first, so a lazy load never outlives the test file on a busy runner ("Closing rpc while fetch was pending").
beforeAll(async () => {
  await Promise.all([import('../../../scripts/home-data'), import('../../../scripts/github-session'), import('../../../scripts/waiting-counts'), import('../../../scripts/design-lead')]);
}, 60_000);

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
    // Direction A: the tray says it; the row has no "Your turn" line, its reason once as the line, a Review button,
    // and no status tag.
    const turnRow = pinned.querySelector('li.ex-turn')!;
    expect(turnRow.querySelector('.ex-turn-mark')).toBeNull();
    expect(turnRow.querySelector('.sh-row-line')!.textContent).toMatch(/^Sofia sent it for review( · .+)?$/);
    expect(within(turnRow as HTMLElement).getByRole('link', { name: 'Review Exploration 1' }).getAttribute('href')).toBeTruthy();
    expect(turnRow.textContent).not.toContain('In review');
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
    // Counts include what waits on you (Exploration 1 is pinned, and still counts as In review).
    expect(within(menu).getByRole('menuitemcheckbox', { name: /^In review/ }).textContent).toMatch(/1$/);
    expect(items.map((i) => i.textContent?.replace(/\d+$/, ''))).toEqual(['In progress', 'Exploring', 'In review', 'Ready to build', 'Being built', 'Checking', 'Shipped', 'Not doing this', 'Archived']);
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /^Exploring/ }));
    expect(new URLSearchParams(location.search).get('status')).toBe('in-review,ready-to-build,being-built,checking');
    expect(screen.queryByText('Exploration 2')).toBeNull();
    expect(screen.getByText('Exploration 3')).toBeTruthy();
  });

  it('says what matched nothing, with Clear filters', async () => {
    history.replaceState(null, '', '/studio/explorations/?status=ready-to-build&people=leo&product=prints');
    const user = userEvent.setup();
    render(createElement(BranchesList, props()));
    expect(screen.getByText(/Nothing ready to build by leo in Acme Prints yet\./)).toBeTruthy();
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

  it('shows the Board: one column per status the filter keeps, the column naming the status', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, i) => xp(100 + i, 'leo'));
    const { container } = render(createElement(BranchesList, props({ rows: [...props().rows, ...many] })));
    await user.click(screen.getByRole('radio', { name: /Board/ }));
    const cols = [...container.querySelectorAll('.ex-col h2')].map((h) => h.textContent);
    // What waits on you sits in its own column, marked Your turn, and counts there: no pinned list above the Board.
    // The column's count sits in the nav's pill when some of it waits on you; no "your turn" words.
    // The filter's statuses only (In progress): no Shipped column the List would not show.
    expect(cols).toEqual(['Exploring 13', 'In review 1', 'Ready to build 0', 'Being built 0', 'Checking 1']);
    expect(container.querySelector('.ex-col-num')!.getAttribute('aria-label')).toBe('1, 1 for you');
    // An empty column is marked (it keeps the same width as the others: styles/explorations-board.css).
    expect([...container.querySelectorAll('.ex-col.is-empty h2')].map((h) => h.textContent)).toEqual(['Ready to build 0', 'Being built 0']);
    expect(container.querySelector('.ex-waiting')).toBeNull();
    const lead = container.querySelectorAll('.ex-col')[1]!;
    // The card is tinted (ex-turn) and does not repeat "sent it for review" above its name.
    expect(lead.querySelector('.ex-turn')).toBeTruthy();
    expect(lead.textContent).not.toContain('sent it for review');
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

  it('asks to connect first when the team is read only until connected', () => {
    render(createElement(BranchesList, props({ rows: [], closed: [], viewer: null, connect: 'Connect GitHub' })));
    expect(screen.getByRole('button', { name: 'Connect GitHub' }).hasAttribute('data-gh-open')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Start an exploration' })).toBeNull();
  });

  it('never says the team has nothing when GitHub could not be read', () => {
    const { container } = render(createElement(BranchesList, props({ rows: [], closed: [], unread: true, unreadLine: 'Explorations will show at 22:10.' })));
    expect(screen.queryByRole('heading', { name: 'Start with one screen' })).toBeNull();
    // Rate limited with nothing saved: one quiet line, never "Nothing in progress" nor a count of 0.
    expect(container.textContent).toContain('Explorations will show at 22:10.');
    expect(container.textContent).not.toMatch(/Nothing .*yet|0 explorations/);
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
