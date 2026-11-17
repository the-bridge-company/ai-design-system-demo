// @vitest-environment jsdom
// Studio > Patterns, suggest and decide (boards 1A, 2B, 3A to 3E, 4, 5A to 5D): a member who can write gets "Suggest a
// pattern" in the header and a drawer per row; the suggest drawer asks what to share with two ChoiceCards, then shows
// the matching form (a new action with its places, or a behavior asked of another component); a reader gets no
// button and names linked to the Library; the empty state holds the only "Suggest a pattern"; the lead sees what waits
// on a row in an Accordion with the decision, and the proposals that are not patterns yet in one quiet line. On the
// sample team the Send carries the demo mark and the text stays in this browser.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { behaviorRequestOf, composeRequestIssue, type BehaviorAsk } from '@bridge-ds/core';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import StudioPatterns, { PatternsBody, type SiteSuggest } from './StudioPatterns';
import { suggestDraftKey, type PatternSuggestContext } from './PatternDrawers';
import type { StudioPatternGroup } from '../../../lib/studio-patterns';
import type { BehaviorIssue } from '../../../lib/home-model';

const gh = vi.hoisted(() => ({ lead: false, issues: [] as unknown[], sent: [] as unknown[], access: null as { write: boolean } | null }));

vi.mock('../../../scripts/github-session', () => ({
  readRepo: () => ({ owner: 'acme', repo: 'ds' }),
  resolveAccess: async () => gh.access,
  onAccess: () => undefined,
  signedInWithGitHub: () => false,
  currentViewer: () => null,
  currentContributor: () => null,
  getToken: () => null,
  ghAuthFailure: () => null,
  ghGet: async () => ({ data: gh.issues }),
}));
vi.mock('../../../scripts/teams', () => ({ loadTeams: async () => [] }));
vi.mock('../../../scripts/needs-you', () => ({ viewerRole: () => 'member' }));
vi.mock('../../../scripts/design-lead', () => ({ viewerIsDesignLead: () => gh.lead }));
vi.mock('../../../scripts/contribute-session', () => ({ contributeTeam: async () => ({ members: [] }), decideBehaviorRequest: vi.fn(async () => undefined) }));
vi.mock('../../../scripts/behavior-request-send', () => ({
  sendBehaviorRequest: vi.fn(async (_repo: string, request: unknown) => {
    gh.sent.push(request);
    return 42;
  }),
}));

const row = (id: string, name: string, components: string[], extra: object = {}) => ({ id, name, purpose: `${name} purpose.`, components, href: `/library/acme/ds/patterns/?p=${id}`, ...extra });
const GROUPS: StudioPatternGroup[] = [
  {
    kind: 'interaction',
    label: 'Interactions',
    rows: [
      row('close-on-escape', 'Close on Escape', ['Combobox', 'Select'], { uses: [{ component: 'Combobox', text: 'Closes on Escape' }, { component: 'Select', text: 'Closes on Escape' }] }),
      row('pick-with-enter', 'Pick with Enter', ['Select', 'Combobox'], { uses: [{ component: 'Select', text: 'Enter picks' }, { component: 'Combobox', text: 'Enter picks' }] }),
    ],
  },
  { kind: 'action', label: 'Actions', rows: [row('delete', 'Delete', ['Button', 'AlertDialog'], { rules: ['Ask first.', 'Type the name.'] })] },
];

const suggest = (canEdit = true): PatternSuggestContext => ({
  repo: 'acme/ds',
  canEdit,
  components: [
    { name: 'Select', behaviors: [{ id: 'type-to-jump', text: 'Type to jump' }, { id: 'close-on-escape', text: 'Closes on Escape' }] },
    { name: 'Combobox', behaviors: [{ id: 'close-on-escape', text: 'Closes on Escape' }] },
    { name: 'Menu', behaviors: [] },
  ],
  pageUrl: (id) => `https://bridge.example/library/acme/ds/patterns/?p=${id}`,
});

function issue(number: number, subject: string, ask: BehaviorAsk): BehaviorIssue {
  const { title, body } = composeRequestIssue(behaviorRequestOf(subject, ask));
  return { number, title, body: `${body}\n\nRequested by Sofia through Bridge.`, labels: ['component-change', 'request: behavior'], created_at: '2026-11-16T10:00:00Z' };
}

const field = (label: string, scope: HTMLElement) => within(scope).getByLabelText(new RegExp(`^${label.replace(/[?]/g, '\\?')}`));
const type = (label: string, value: string, scope: HTMLElement) => fireEvent.change(field(label, scope), { target: { value } });
const drawer = () => screen.getByRole('dialog');

beforeEach(() => {
  gh.lead = false;
  gh.issues = [];
  gh.sent = [];
  gh.access = null;
  localStorage.clear();
});
afterEach(() => vi.clearAllMocks());

describe('a reader', () => {
  it('gets the table with no button, each name linked to its Library page', async () => {
    const { container } = render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest(false) }));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Suggest a pattern' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Delete' }).getAttribute('href')).toBe('/library/acme/ds/patterns/?p=delete');
    expect(screen.queryByText(/Asked, not patterns yet/)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("keeps today's empty state, with no button", () => {
    render(createElement(PatternsBody, { groups: [], suggest: suggest(false) }));
    expect(screen.getByRole('heading', { name: 'No patterns yet' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('a member who can write', () => {
  it('finds one "Suggest a pattern" and rows that open a drawer, the shared components still read on each row', async () => {
    const { container } = render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    await act(async () => undefined);
    expect(screen.getAllByRole('button', { name: 'Suggest a pattern' })).toHaveLength(1);
    const open = screen.getByRole('button', { name: 'Close on Escape' });
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
    // The group says the components once; each row's empty cell points to it.
    const shared = container.querySelector<HTMLElement>('[data-spt-shared]')!;
    const cell = container.querySelector('[data-spt-row="close-on-escape"] .spt-col-uses')!;
    expect(cell.getAttribute('aria-describedby')).toBe(shared.id);
    expect(shared.textContent).toBe('Combobox, Select');
    await expectNoAxeViolations(container);
  });

  it('in the empty state, gets the only "Suggest a pattern", with who decides', () => {
    render(createElement(PatternsBody, { groups: [], suggest: suggest() }));
    const buttons = screen.getAllByRole('button', { name: 'Suggest a pattern' });
    expect(buttons).toHaveLength(1);
    expect(screen.getByText(/Seen one in your products\? Suggest it: the design system lead decides/)).toBeTruthy();
  });

  it('asks what to share first, then shows the matching form only', async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    const d = drawer();
    expect(within(d).getByText('What do you want to share?')).toBeTruthy();
    expect(within(d).queryByLabelText(/^Name/)).toBeNull();
    // No send before a choice: one primary action, once there is something to send.
    expect(within(d).queryByRole('button', { name: /^Send to/ })).toBeNull();
    fireEvent.click(within(d).getByRole('radio', { name: /An action people take in several places/ }));
    expect(field('Name', d)).toBeTruthy();
    expect(within(d).getByRole('group', { name: 'Place 2' })).toBeTruthy();
    // The places are required like the other fields: the same marker, and said to screen readers.
    expect(within(d).getByRole('group', { name: /^Where people do it today\s*\*?\s*\(required\)/ })).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Send to the design system lead' }).getAttribute('data-demo-write')).toBe('suggest a pattern');
    await expectNoAxeViolations(d);
  });

  it('refuses a new action with fewer than two places, and a name that is a pattern, with a way to that pattern', async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    fireEvent.click(within(drawer()).getByRole('radio', { name: /An action people take/ }));
    type('Name', 'delete', drawer());
    type('What it is for', 'Keeps it.', drawer());
    type('Its rules', 'Nothing is deleted.', drawer());
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Send to the design system lead' }));
    await waitFor(() => expect(within(drawer()).getByText('Delete is already a pattern.', { exact: false })).toBeTruthy());
    expect(within(drawer()).getByRole('alert').textContent).toContain('Name at least two places where people do it today');
    expect(gh.sent).toHaveLength(0);
    // The way to the existing pattern opens its drawer.
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Suggest a change to it instead.' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Delete' })).toBeTruthy());
  });

  it('sends a new action with its places as a behavior request, then says so with the way to follow it', async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    fireEvent.click(within(drawer()).getByRole('radio', { name: /An action people take/ }));
    const d = drawer();
    type('Name', 'Archive', d);
    type('What it is for', 'Keeps it out of the lists.', d);
    type('Its rules', 'Nothing is deleted.', d);
    const [p1, p2] = [within(d).getByRole('group', { name: 'Place 1' }), within(d).getByRole('group', { name: 'Place 2' })];
    type('Screen', 'Acme CRM, Deals', p1);
    type('What people read there', 'Archive deal', p1);
    type('Screen', 'Acme Prints, Orders', p2);
    type('What people read there', 'Move to archive', p2);
    fireEvent.click(within(d).getByRole('button', { name: 'Send to the design system lead' }));
    await waitFor(() => expect(gh.sent).toHaveLength(1));
    expect(gh.sent[0]).toMatchObject({ kind: 'behavior', component: 'Archive pattern', behavior: { of: 'pattern', id: 'archive', places: [{ screen: 'Acme CRM, Deals', label: 'Archive deal' }, { screen: 'Acme Prints, Orders', label: 'Move to archive' }] } });
    await waitFor(() => expect(within(drawer()).getByText(/Request #42 sent to the design system lead\./)).toBeTruthy());
    expect(within(drawer()).getByRole('link', { name: 'Follow your request' }).getAttribute('href')).toMatch(/explorations\/\?request=42$/);
    // Sent: the draft is gone.
    expect(localStorage.getItem(suggestDraftKey('acme/ds', 'action'))).toBeNull();
  });

  it('keeps the text in this browser until it is sent (the sample team keeps it behind its dialog)', () => {
    const { unmount } = render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    fireEvent.click(within(drawer()).getByRole('radio', { name: /An action people take/ }));
    type('Name', 'Archive', drawer());
    unmount();
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    expect((field('Name', drawer()) as HTMLInputElement).value).toBe('Archive');
  });

  it('asks a behavior of another component, offering only behaviors that are not interactions yet', async () => {
    localStorage.setItem(suggestDraftKey('acme/ds', 'kind'), 'interaction');
    localStorage.setItem(suggestDraftKey('acme/ds', 'adopt'), JSON.stringify({ behavior: 'type-to-jump', component: 'Menu', wanted: 'Typing a letter jumps to the item.', where: '' }));
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a pattern' }));
    const d = drawer();
    expect(within(d).getByText('Once two components do it, it shows here as an interaction. Your developers give it its name.')).toBeTruthy();
    expect(within(d).getByText('Only components that do not do it yet.')).toBeTruthy();
    expect(field('Where people would feel it', d)).toBeTruthy();
    await expectNoAxeViolations(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Send to the design system lead' }));
    await waitFor(() => expect(gh.sent).toHaveLength(1));
    expect(gh.sent[0]).toMatchObject({ component: 'Menu', behavior: { of: 'component', id: 'Menu', behavior: 'type-to-jump', today: '' } });
  });

  it("opens a row's drawer: the pattern, its components, its Library page and one way to suggest", async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Close on Escape' }));
    const d = await screen.findByRole('dialog', { name: 'Close on Escape' });
    expect(within(d).getByText('Combobox', { selector: '*' })).toBeTruthy();
    expect(within(d).getByRole('link', { name: 'Open in Library' }).getAttribute('href')).toBe('/library/acme/ds/patterns/?p=close-on-escape');
    expect(within(d).getByRole('button', { name: 'Suggest a change' })).toBeTruthy();
    const ask = within(d).getByRole('button', { name: 'Ask another component to do this' });
    expect(ask.className).toMatch(/primary/);
    await expectNoAxeViolations(d);
    fireEvent.click(ask);
    // The behavior is the row's: only the component is asked, among those that do not do it.
    expect(within(drawer()).queryByText('Which behavior?')).toBeNull();
    expect((field('What should it do?', drawer()) as HTMLTextAreaElement).value).toBe('Close on Escape purpose.');
    expect(within(drawer()).getByRole('button', { name: 'Back' })).toBeTruthy();
    await expectNoAxeViolations(drawer());
  });

  it("shows an action's rules in its drawer, numbered under the purpose; an interaction has none", async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const d = await screen.findByRole('dialog', { name: 'Delete' });
    const rules = within(d).getByRole('list', { name: 'Rules' });
    expect(rules.tagName).toBe('OL');
    expect(within(rules).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ask first.', 'Type the name.']);
    expect(within(d).getByRole('link', { name: 'Open in Library' })).toBeTruthy();
    await expectNoAxeViolations(d);
    // The form picks among the same rules: the list leaves with the view.
    fireEvent.click(within(d).getByRole('button', { name: 'Suggest a change to this pattern' }));
    expect(within(drawer()).queryByRole('list', { name: 'Rules' })).toBeNull();
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Back' }));
    fireEvent.keyDown(drawer(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close on Escape' }));
    const i = await screen.findByRole('dialog', { name: 'Close on Escape' });
    expect(within(i).queryByRole('list', { name: 'Rules' })).toBeNull();
  });

  it("opens an action's drawer on the rule form of PatternChange", async () => {
    render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const d = await screen.findByRole('dialog', { name: 'Delete' });
    fireEvent.click(within(d).getByRole('button', { name: 'Suggest a change to this pattern' }));
    expect(within(drawer()).getByRole('form', { name: 'Suggest a change to this pattern' })).toBeTruthy();
    expect(within(drawer()).getByText('The design system lead decides. Once it is the default, your developers build it and it shows here.')).toBeTruthy();
  });
});

describe('the lead who decides', () => {
  const rule: BehaviorAsk = { of: 'pattern', id: 'delete', today: '', wanted: 'Name what goes with it.' };
  const archive: BehaviorAsk = { of: 'pattern', id: 'archive', today: '', wanted: 'Keeps it.', places: [{ screen: 'Deals', label: 'Archive deal' }, { screen: 'Orders', label: 'Move to archive' }] };

  it('sees the proposals that are not patterns yet in one line, never as rows, and decides in the row drawer', async () => {
    gh.lead = true;
    gh.issues = [issue(45, 'Delete pattern', rule), issue(46, 'Archive pattern', archive)];
    const { container } = render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    await waitFor(() => expect(container.querySelector('[data-spt-asked]')).toBeTruthy());
    const line = container.querySelector<HTMLElement>('[data-spt-asked]')!;
    expect(line.textContent).toBe('Asked, not patterns yet: Archive');
    expect(within(line).getByRole('link', { name: 'Archive' }).getAttribute('href')).toMatch(/request=46$/);
    expect(container.querySelector('[data-spt-row="archive"]')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Waiting for your decision' })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const d = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(d).getByRole('heading', { name: 'One change waits for your decision' })).toBeTruthy();
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Make it the default' })).toBeTruthy());
    expect(within(d).getByText('Sofia · #45')).toBeTruthy();
    // One primary: the decision. Her own suggest button steps down.
    expect(within(d).getByRole('button', { name: 'Suggest a change to this pattern' }).className).not.toMatch(/primary/);
    await expectNoAxeViolations(d);
  });

  it('nobody else sees the line or the column', async () => {
    gh.issues = [issue(46, 'Archive pattern', archive)];
    const { container } = render(createElement(PatternsBody, { groups: GROUPS, suggest: suggest() }));
    await act(async () => undefined);
    expect(container.querySelector('[data-spt-asked]')).toBeNull();
    expect(screen.queryByText('Waiting for your decision')).toBeNull();
  });
});

describe("Bridge's own Studio (pages/studio/patterns.astro)", () => {
  const site: SiteSuggest = { components: [{ name: 'Select', behaviors: [{ id: 'type-to-jump', text: 'Type to jump' }] }] };

  it('stays read only signed out: no button, names linked to the Library', async () => {
    const { container } = render(createElement(StudioPatterns, { groups: GROUPS, site }));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Suggest a pattern' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Delete' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('stays read only for a member who only reads', async () => {
    gh.access = { write: false };
    render(createElement(StudioPatterns, { groups: GROUPS, site }));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Suggest a pattern' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Delete' })).toBeTruthy();
  });

  it('gives a member who can write the same button and drawers as a team page', async () => {
    gh.access = { write: true };
    const { container } = render(createElement(StudioPatterns, { groups: GROUPS, site }));
    expect(await screen.findByRole('button', { name: 'Suggest a pattern' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Delete' })).toBeNull();
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const d = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(d).getByRole('list', { name: 'Rules' })).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Suggest a change to this pattern' })).toBeTruthy();
  });
});
