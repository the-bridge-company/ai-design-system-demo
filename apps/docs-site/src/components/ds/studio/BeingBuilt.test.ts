// @vitest-environment jsdom
// Being built: the list with one tag per row and no row buttons, the detail in place, the empty state that teaches,
// and Claude's fixes as rows of the same list (no section of their own).
import '../../../../../../packages/react/src/test/setup';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assembleBuildRequests, composeBuildRequestIssue } from '@bridge-ds/core';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { fixtureBuildData, FIXTURE_BUILDERS } from '../../../../dev/build-requests';
import { explorationBuildRows, toBuildIssue, toBuildPull, type RestPull } from '../../../lib/building-view';
import { DEFAULT_PRODUCTS } from '@bridge-ds/core';
import { fixRows, parseSession } from '../../../lib/claude-connector';

const NOW = Date.now();
let data: unknown = null;
vi.mock('../../../scripts/building-data', () => ({ loadBuildData: () => Promise.resolve(data), readFixes: () => Promise.resolve([]) }));
const { default: BeingBuilt } = await import('./BeingBuilt');

function fixture() {
  const { issues, pulls } = fixtureBuildData(NOW);
  const nameOf = (l: string) => FIXTURE_BUILDERS[l] ?? l;
  return { views: assembleBuildRequests({ issues: issues.map(toBuildIssue), pulls: pulls.map(toBuildPull), now: NOW, nameOf }), bodies: new Map(issues.map((i) => [i.number, i.body ?? ''])), stale: false, nameOf, jiraBase: null };
}

beforeEach(() => history.replaceState(null, '', '/studio/building/'));

/** Ticks or unticks one box of a filter menu ("Status", "Product", "People"), then closes it. */
async function tick(filter: RegExp, item: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: filter }));
  const menu = await screen.findByRole('menu');
  await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: item }));
  await userEvent.keyboard('{Escape}');
}

describe('Being built', () => {
  it('opens on Not shipped yet: one status tag per row in the filter word, no tabs, no row button', async () => {
    data = fixture();
    const { container } = render(createElement(BeingBuilt));
    expect(await screen.findByText('Tabs: put a count after the label')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('button', { name: 'Status: Not shipped yet' })).toBeTruthy();
    // One word per status: the tag says the filter's word, never "Requested".
    expect(container.textContent).not.toContain('Requested');
    expect(screen.getAllByText('Ready to build').length).toBeGreaterThan(0);
    // Shipped is not in the default: five of the six changes.
    expect(container.querySelectorAll('.sh-row-item')).toHaveLength(5);
    // The list groups by product as Explorations' does: each group a heading with its count tag.
    expect(container.querySelectorAll('section.bl-group > h2.bl-h2 .count-tag').length).toBeGreaterThan(0);
    expect(screen.queryByText('Avatar: add an xs size')).toBeNull();
    expect(container.querySelector('.bl-bar')!.textContent).toContain('5 changes.');
    expect(container.querySelectorAll('.sh-row-item button')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('lists the four statuses with their counts in the Status menu, Shipped from the last 30 days', async () => {
    data = fixture();
    const { container } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    await userEvent.click(screen.getByRole('button', { name: 'Status: Not shipped yet' }));
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual(['Not shipped yet', 'Ready to build2', 'Being built2', 'Checking1', 'Shipped1']);
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true', 'true', 'false']);
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /^Shipped/ }));
    expect(new URLSearchParams(location.search).get('status')).toBe('waiting,in-progress,in-review,shipped');
    expect(screen.getByRole('button', { name: 'Status: All statuses' })).toBeTruthy();
    expect(screen.getByText('Avatar: add an xs size')).toBeTruthy();
    expect(container.querySelectorAll('.sh-row-item')).toHaveLength(6);
    await userEvent.keyboard('{Escape}');
    await expectNoAxeViolations(container);
  });

  it('says who each row waits on: Asked by while waiting, builds it once picked up', async () => {
    data = fixture();
    const { container } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    const text = container.textContent ?? '';
    expect(text).toContain('Asked by Dana');
    expect(text).toContain('Malik builds it');
    expect(text).not.toContain('is building it');
    expect(text).not.toContain('in code review');
  });

  it('shows a Board, one column per status with its count, cards without a status tag', async () => {
    localStorage.clear();
    data = fixture();
    const { container } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
    const board = screen.getByRole('region', { name: 'Board, one column per status' });
    const heads = [...board.querySelectorAll('.ex-col-h')].map((h) => h.textContent);
    expect(heads).toEqual(['Ready to build 2', 'Being built 2', 'Checking 1', 'Shipped, last 30 days 1']);
    expect(board.querySelectorAll('.sh-card-item')).toHaveLength(6);
    expect(board.querySelectorAll('.sh-card-tag')).toHaveLength(0);
    // Explorations' person line on every card: who has it now, then when it last moved, never "Asked by".
    const names = [...board.querySelectorAll('.sh-card-name')].map((n) => n.textContent ?? '');
    expect(names.some((n) => n.startsWith('Dana'))).toBe(true);
    expect(names.every((n) => /·/.test(n))).toBe(true);
    expect(board.textContent).not.toMatch(/Asked by|Shipped by|builds it/);
    expect(container.querySelector('.bl-bar')!.textContent).toContain('6 changes.');
    await expectNoAxeViolations(container);
    // Filtered to In review: one column.
    await tick(/^Status:/, /^Ready to build/);
    await tick(/^Status:/, /^Being built/);
    expect([...container.querySelectorAll('.ex-col-h')].map((h) => h.textContent)).toEqual(['Checking 1']);
    localStorage.clear();
  });

  it('filters, then opens the detail in place with the developer fold', async () => {
    data = fixture();
    render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    await tick(/^Status:/, /^Ready to build/);
    await tick(/^Status:/, /^Being built/);
    expect(screen.queryByText('Tabs: put a count after the label')).toBeNull();
    await userEvent.click(screen.getByText('Badge: add an info tone'));
    expect(location.search).toBe('?request=33&status=in-review');
    expect(screen.getByRole('heading', { name: 'Badge: add an info tone' })).toBeTruthy();
    expect(screen.getByText('Where it stands')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'For developers' })).toBeTruthy();
    // #33 carries a Jira key (DS-128): with Jira off in Bridge, neither the key nor its link shows.
    await userEvent.click(screen.getByRole('button', { name: 'For developers' }));
    expect(document.body.textContent).not.toMatch(/jira|DS-128/i);
  });

  it("has Explorations' Product and People checkbox menus after Status, with the count", async () => {
    data = { ...fixture(), viewer: 'dana' };
    const { container } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    expect(container.querySelectorAll('.bl-bar [role="combobox"]').length).toBe(0);
    expect([...container.querySelectorAll('.bl-bar .bl-multi')].map((b) => b.getAttribute('aria-label'))).toEqual(['Status: Not shipped yet', 'Product: All products', 'People: Everyone']);
    expect(container.querySelector('.bl-bar')!.textContent).toContain('5 changes.');
    await tick(/^People:/, /^Malik/);
    expect(location.search).toBe('?people=malik-haddad');
    expect(screen.getByRole('button', { name: 'People: Malik' })).toBeTruthy();
    expect(container.querySelector('.bl-bar')!.textContent).toContain('2 of 6 changes.');
    // A row with nobody on it left with the filter, and comes back under Everyone.
    expect(screen.queryByText('Tabs: put a count after the label')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(location.search).toBe('');
    expect(screen.getByText('Tabs: put a count after the label')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('opens on the filters of the address and keeps them through a detail', async () => {
    history.replaceState(null, '', '/studio/building/?people=malik-haddad');
    data = fixture();
    render(createElement(BeingBuilt));
    await userEvent.click(await screen.findByText('Badge: add an info tone'));
    expect(location.search).toBe('?request=33&people=malik-haddad');
    await userEvent.click(screen.getByRole('link', { name: 'All build requests' }));
    expect(location.search).toBe('?people=malik-haddad');
    expect(screen.queryByText('Button: add a lg size')).toBeNull();
  });

  it('says so when the filters leave nothing, Clear filters on the same line', async () => {
    history.replaceState(null, '', '/studio/building/?product=admin');
    data = fixture();
    render(createElement(BeingBuilt));
    expect(await screen.findByText(/Nothing waiting or being built in .* right now/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Button: add a lg size')).toBeTruthy();
  });

  it('shows the same changes as cards when the person asks for the grid, and remembers it', async () => {
    localStorage.clear();
    data = fixture();
    const { container, unmount } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    await userEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(container.querySelectorAll('.sh-card-item')).toHaveLength(5);
    expect(container.querySelectorAll('.sh-row-item')).toHaveLength(0);
    // Grouped by product as Explorations' grid: a title with its count tag, so no card repeats the product in its corner.
    const groups = [...container.querySelectorAll('section.bl-group')];
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.reduce((n, g) => n + Number(g.querySelector('.count-tag')?.textContent), 0)).toBe(5);
    expect(container.querySelectorAll('.bt-chip')).toHaveLength(0);
    // Inside a group, the ladder's order: Ready to build, Being built, Checking.
    const LADDER = ['Ready to build', 'Being built', 'Checking', 'Shipped'];
    for (const g of groups) {
      const ranks = [...g.querySelectorAll('.sh-card-tag')].map((t) => LADDER.indexOf(t.textContent ?? ''));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
    // The whole title stays the link's name (the card shows two lines at most).
    for (const a of container.querySelectorAll('a.sh-card-title')) expect(a.getAttribute('title')).toBe(a.textContent);
    await expectNoAxeViolations(container);
    // The next visit opens on the cards: the choice is this person's, and this page's.
    unmount();
    const again = render(createElement(BeingBuilt));
    await again.findByText('Tabs: put a count after the label');
    expect(again.container.querySelectorAll('.sh-card-item')).toHaveLength(5);
    localStorage.clear();
  });

  it('teaches what a build request is when nothing was sent', async () => {
    data = { ...fixture(), views: [] };
    const { container } = render(createElement(BeingBuilt));
    expect(await screen.findByText('Nothing is being built yet.')).toBeTruthy();
    expect(container.textContent).toContain('Bridge Figma plugin');
    // Jira is off in Bridge for the MVP (lib/studio-flags JIRA_IN_BRIDGE): developers pick them up in GitHub.
    expect(container.textContent).toContain('where they work, in GitHub, and');
    expect(container.textContent).not.toMatch(/jira/i);
    await expectNoAxeViolations(container);
  });

  it("lists Claude's fixes in the same list, reconciled with their pull request, counted by the filters", async () => {
    const at = new Date(NOW - 2 * 86_400_000).toISOString();
    const session = parseSession({ component: 'Button', state: 'ready', startedAt: at, updatedAt: at, elapsed: 180, steps: [{ kind: 'proposed', text: 'Claude opened its fix for review', at, by: 'peterbono', review: 'explorations/?pr=598' }] })!;
    const base = fixture();
    const fixes = fixRows([session], [{ number: 598, state: 'closed', merged_at: at, updated_at: at }], NOW, (l) => (l === 'peterbono' ? 'Florian' : l));
    data = { ...base, fixes };
    history.replaceState(null, '', '/studio/building/?status=all');
    const { container } = render(createElement(BeingBuilt));
    expect(await screen.findByText('Button')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Status: All statuses' })).toBeTruthy();
    expect(container.querySelectorAll('.sh-row-item')).toHaveLength(7);
    expect(container.textContent).toContain("Claude's fix from Figma, asked by Florian");
    expect(container.textContent).not.toContain('peterbono');
    expect(container.textContent).not.toContain('Ready for review');
    expect(container.textContent).not.toContain("Claude's fixes\n");
    expect(container.querySelector('a[href="/studio/explorations/?pr=598"]')).toBeTruthy();
    expect(container.innerHTML).not.toContain('github.com/peterbono');
    expect(container.querySelectorAll('.sh-row-item button')).toHaveLength(0);
    // Shipped: the fix stays; Not shipped yet: it leaves.
    await tick(/^Status:/, /^Ready to build/);
    await tick(/^Status:/, /^Being built/);
    await tick(/^Status:/, /^Checking/);
    expect(screen.getByRole('button', { name: 'Status: Shipped' })).toBeTruthy();
    expect(screen.getByText('Button')).toBeTruthy();
    await tick(/^Status:/, /^Not shipped yet/);
    expect(screen.queryByText('Button')).toBeNull();
    await expectNoAxeViolations(container);
  });

  // Issue #489 "Tag: test: rounder tag corners", closed as not planned, with its In code now and In Figma pictures.
  const declinedTag = (closedDaysAgo: number) => {
    const at = new Date(NOW - closedDaysAgo * 86_400_000).toISOString();
    const r = composeBuildRequestIssue({ component: 'Tag', kind: 'visual', title: 'Test: rounder tag corners', summary: 'Tags would read softer.', figma: { nodeName: 'Tone=signal' }, images: { before: ['https://example.com/tag-before.png'], after: ['https://example.com/tag-after.png'] }, source: 'figma', requestedBy: 'dana' });
    return { number: 489, title: r.title, body: r.body, html_url: 'https://github.com/acme/ds/issues/489', state: 'closed', state_reason: 'not_planned', labels: r.labels, user: { login: 'dana' }, assignees: [], created_at: at, closed_at: at };
  };
  const withTag = (closedDaysAgo: number, fixes: unknown[] = []) => {
    const { issues, pulls } = fixtureBuildData(NOW);
    const all = [...issues, declinedTag(closedDaysAgo)];
    const nameOf = (l: string) => FIXTURE_BUILDERS[l] ?? l;
    return { views: assembleBuildRequests({ issues: all.map(toBuildIssue), pulls: pulls.map(toBuildPull), now: NOW, nameOf }), bodies: new Map(all.map((i) => [i.number, i.body ?? ''])), stale: false, nameOf, jiraBase: null, fixes };
  };

  it('keeps a request closed as not planned for a week, with its own pictures and component, then leaves it out', async () => {
    data = withTag(6);
    const { container, unmount } = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    // Not planned is a status of its own, offered while one is listed, never in the default.
    expect(screen.queryByText('Tag: test: rounder tag corners')).toBeNull();
    await tick(/^Status:/, /^Not doing this/);
    const title = await screen.findByText('Tag: test: rounder tag corners');
    const row = title.closest('li')!;
    expect(row.textContent).toContain('Developers closed it without building it');
    expect(row.textContent).toContain('Not doing this');
    const thumb = row.querySelector('.bt')!;
    expect(thumb.getAttribute('data-label')).toBe('Tag');
    expect([...thumb.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['https://example.com/tag-before.png', 'https://example.com/tag-after.png']);
    expect(row.querySelector('a')!.getAttribute('title')).toBe('Tag: test: rounder tag corners');
    expect(container.querySelector('.bl-bar')!.textContent).toContain('6 of 7 changes.');
    unmount();
    history.replaceState(null, '', '/studio/building/');
    data = withTag(8);
    const again = render(createElement(BeingBuilt));
    await screen.findByText('Tabs: put a count after the label');
    expect(screen.queryByText('Tag: test: rounder tag corners')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Status:/ }));
    expect(within(await screen.findByRole('menu')).queryByRole('menuitemcheckbox', { name: /^Not doing this/ })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(again.container.querySelectorAll('.sh-row-item')).toHaveLength(5);
    expect(container.textContent).not.toContain('Tag: test');
  });

  it('shows the empty state once every listed request has left, never an empty list under a sentence', async () => {
    const nameOf = (l: string) => l;
    data = { views: assembleBuildRequests({ issues: [toBuildIssue(declinedTag(9))], pulls: [], now: NOW, nameOf }), bodies: new Map(), stale: false, nameOf, jiraBase: null };
    render(createElement(BeingBuilt));
    expect(await screen.findByText('Nothing is being built yet.')).toBeTruthy();
  });

  it("labels each of Claude's fixes with its own component, one row per session", async () => {
    const at = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
    const stopped = (d: number) => parseSession({ component: 'Button', state: 'stopped', startedAt: at(d), updatedAt: at(d), elapsed: 60, steps: [{ kind: 'step', text: 'Claude stopped', at: at(d), by: 'peterbono' }] })!;
    const fixes = fixRows([stopped(1), stopped(2)], [], NOW);
    expect(new Set(fixes.map((f) => f.id)).size).toBe(2);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    data = withTag(1, fixes);
    history.replaceState(null, '', '/studio/building/?status=all,not-planned');
    const { container } = render(createElement(BeingBuilt));
    await screen.findByText('Tag: test: rounder tag corners');
    expect(error.mock.calls.flat().join(' ')).not.toContain('same key');
    error.mockRestore();
    const rows = [...container.querySelectorAll('.sh-row-item')];
    const fixRowsShown = rows.filter((li) => li.textContent?.includes("Claude's fix from Figma"));
    expect(fixRowsShown).toHaveLength(2);
    for (const li of fixRowsShown) {
      expect(li.querySelector('.bt')!.getAttribute('data-label')).toBe('Button');
      expect(li.querySelector('a')!.getAttribute('title')).toBe("Button: Claude's fix from Figma");
    }
    const tagRow = rows.find((li) => li.textContent?.includes('Tag: test'))!;
    expect(tagRow.querySelector('.bt')!.getAttribute('data-label')).toBe('Tag');
  });

  it('lists explorations handed to developers in the same list, tagged, counted by the filters, opening the exploration', async () => {
    const at = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
    const explored = (n: number, name: string, x: Partial<RestPull>): RestPull => ({
      number: n,
      title: `Exploration: ${name}`,
      html_url: `https://github.com/acme/ds/pull/${n}`,
      state: 'open',
      draft: true,
      created_at: at(5),
      updated_at: at(1),
      labels: ['ready-for-devs', 'product: admin'],
      user: { login: 'peterbono' },
      head: { ref: `explore/${n}`, sha: 'h1' },
      body: `<!-- bridge-exploration ${JSON.stringify({ name, purpose: '', doneAt: at(1), doneSha: 'h1', doneBy: 'peterbono' })} -->`,
      ...x,
    });
    const nameOf = (l: string) => (l === 'peterbono' ? 'Florian' : (FIXTURE_BUILDERS[l] ?? l));
    const explorations = explorationBuildRows(
      [
        explored(611, 'explore new design pr being built', { labels: ['exploration', 'product: admin'] }),
        explored(612, 'Billing screen', { draft: false }),
        explored(613, 'Wishlist', { state: 'closed', merged_at: at(2) }),
        explored(614, 'Still running', { labels: ['exploration'], body: '' }),
      ],
      { products: DEFAULT_PRODUCTS, now: NOW, nameOf },
    );
    data = { ...fixture(), nameOf, explorations };
    // The page header's summary slot (StudioHeader.astro): the island writes its sentence there, explorations counted.
    const summary = document.body.appendChild(Object.assign(document.createElement('p'), { className: 'st-sub' }));
    summary.setAttribute('data-st-summary', '');
    const { container } = render(createElement(BeingBuilt));
    const title = await screen.findByText('Explore new design pr being built');
    expect(summary.textContent).toMatch(/^\d+ being built, \d+ being checked, \d+ ready to build/);
    summary.remove();
    expect(container.querySelectorAll(".sh-row-item")).toHaveLength(7);
    expect(screen.queryByText('Still running')).toBeNull();
    const row = title.closest('li')!;
    // No kind tag: every change starts as an exploration.
    expect([...row.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent === 'Exploration')).toBe(false);
    expect(row.textContent).toContain('Ready to build');
    expect(row.textContent).toContain('Admin demo\u2004\u2060·\u2004Done exploring by Florian on');
    expect(row.querySelector('a')!.getAttribute('href')).toBe('/studio/explorations/?exploration=611');
    // No "How it works" fold under the title, on the self-hosted and the team page: the summary sentence is enough.
    for (const page of ['../../../pages/studio/building.astro', '../../../pages/team-shell/building.astro']) {
      const src = readFileSync(new URL(page, import.meta.url), 'utf8');
      expect(src).not.toContain('slot="how"');
      expect(src).not.toContain('Explorations handed to developers, and changes from Figma or from Components that need code, land here.');
    }
    expect(container.textContent).not.toMatch(/—/);
    // Marked ready for review by the developers: In review, with who must review on its line.
    expect(screen.getByText('Billing screen').closest('li')!.textContent).toContain('Waiting for a reviewer');
    await userEvent.click(screen.getByRole('button', { name: /^Status:/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitemcheckbox').map((i) => i.textContent)).toEqual(['Not shipped yet', 'Ready to build3', 'Being built2', 'Checking2', 'Shipped2']);
    await userEvent.keyboard('{Escape}');
    // Only In review.
    await tick(/^Status:/, /^Ready to build/);
    await tick(/^Status:/, /^Being built/);
    expect(screen.queryByText('Explore new design pr being built')).toBeNull();
    expect(screen.getByText('Billing screen')).toBeTruthy();
    // Shipped, the last 30 days.
    await tick(/^Status:/, /^Shipped/);
    expect(screen.getByText('Wishlist')).toBeTruthy();
    expect(container.querySelectorAll('.sh-row-item button')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('a product added from its address: the row says its developers work elsewhere, and copies them the message', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const at = new Date(NOW - 86_400_000).toISOString();
    const nameOf = (l: string) => (l === 'peterbono' ? 'Florian' : l);
    const products = [...DEFAULT_PRODUCTS, { key: 'poster', name: 'Poster Studio', repo: 'acme/poster-design', address: 'https://posterstudio.com' }];
    const ready = { number: 4, title: 'Exploration: Bigger frame picker', html_url: 'https://github.com/acme/poster-design/pull/4', state: 'open', draft: true, created_at: at, updated_at: at, labels: ['ready-for-devs'], head: { ref: 'explore/frames', sha: 'h1' }, product: 'poster', body: `<!-- bridge-exploration ${JSON.stringify({ name: 'Bigger frame picker', purpose: 'Larger swatches', doneAt: at, doneSha: 'h1', doneBy: 'peterbono' })} -->` } as RestPull;
    const explorations = explorationBuildRows([ready], { products, now: NOW, nameOf, member: true });
    data = { views: [], bodies: new Map(), stale: false, nameOf, jiraBase: null, explorations };
    const { container } = render(createElement(BeingBuilt));
    const row = (await screen.findByText('Bigger frame picker')).closest('li')!;
    expect(row.textContent).toContain('Their developers work elsewhere: send them the message.');
    const button = within(row).getByRole('button', { name: 'Copy for your developers' });
    await user.click(button);
    expect(writeText).toHaveBeenCalledWith(explorations[0]!.exploration.forDevelopers!.message);
    expect(row.textContent).toContain('Message copied. Paste it where your developers work.');
    expect(within(row).getByRole('button', { name: 'Message copied' })).toBeTruthy();
    // The row still opens the exploration.
    expect(row.querySelector('a')!.getAttribute('href')).toBe('/studio/explorations/?exploration=4&product=poster');
    await expectNoAxeViolations(container);
  });

  it('says what a status filter leaves out, with Clear filters, when nothing is in it', async () => {
    const at = new Date(NOW - 86_400_000).toISOString();
    const nameOf = (l: string) => l;
    const ready: RestPull = { number: 611, title: 'Exploration: x', html_url: 'https://github.com/acme/ds/pull/611', state: 'open', draft: true, created_at: at, updated_at: at, labels: ['ready-for-devs'], head: { ref: 'explore/x', sha: 'h1' }, body: `<!-- bridge-exploration ${JSON.stringify({ name: 'Admin filters', purpose: '', doneAt: at, doneSha: 'h1' })} -->` };
    data = { views: [], bodies: new Map(), stale: false, nameOf, jiraBase: null, explorations: explorationBuildRows([ready], { products: DEFAULT_PRODUCTS, now: NOW, nameOf }) };
    render(createElement(BeingBuilt));
    await screen.findByText('Admin filters');
    await tick(/^Status:/, /^Ready to build/);
    await tick(/^Status:/, /^Checking/);
    expect(screen.getByRole('button', { name: 'Status: Being built' })).toBeTruthy();
    expect(screen.getByText(/Nothing being built right now\./)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Admin filters')).toBeTruthy();
  });
});
