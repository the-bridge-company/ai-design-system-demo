// @vitest-environment jsdom
// Check the build on the exploration page (direction A, the ledger of differences, CTA 1) and the full check's answers
// for a design lead: rows as the way in with "Look at N" on each row, answered rows folded, "Show N more", the handover
// notes checklist saved tick by tick, and a lead who answers the check.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import type { ItemState, ReviewItem, ReviewRead, SizeKey } from '../../../lib/build-review-view';

const item = (n: number, sizes: SizeKey[] = ['laptop', 'small']): ReviewItem => ({ n, sig: `r0000000${n}`, name: ['Header', 'Navigation', 'Add a note', 'Tags', 'Tasks', 'Contact Cletus Doyle', 'Cletus Doyle', 'The page on a phone'][n - 1]!, line: `What changed in ${n}`, facts: [], sizes, boxes: {}, crop: { size: sizes[0]!, a: `r${n}-a`, b: `r${n}-b` } });
const ITEMS = [item(1), item(2), item(3), item(4), item(5), item(6, ['phone']), item(7, ['phone']), item(8, ['phone'])];
const states = (v: Record<number, 'fine' | 'fix'> = {}): ItemState[] => ITEMS.map((it) => ({ sig: it.sig, mine: v[it.n] ?? null, carried: false, askedBefore: false, others: [] }));

const world = vi.hoisted(() => ({ read: null as unknown, ticks: [] as { key: string; found: boolean }[], said: [] as { sig: string; verdict: string | null }[] }));
vi.mock('../../../scripts/build-review-data', () => ({
  teamOfPage: async () => 'acme-design-demo/bridge-demo-ds',
  loadReview: async () => world.read,
  loadReviewKept: async () => world.read,
  imageSrc: async (u: string) => u,
  imageUrl: (_t: string, _c: string, _p: number, _r: string, n: string) => `/img/${n}`,
  sayHandover: async (_t: unknown, key: string, found: boolean) => {
    world.ticks.push({ key, found });
    return found ? [{ key, byName: 'Sofia', role: 'designer', at: 'x' }] : [];
  },
  sayItem: async (_t: unknown, sig: string, verdict: string | null) => {
    world.said.push({ sig, verdict });
    return states();
  },
}));

const { BuildReviewEntry } = await import('./BuildReviewEntry');
const BuildReview = (await import('./BuildReview')).default;

function read(o: Partial<ReviewRead> = {}): ReviewRead {
  return {
    ready: true,
    state: 'pending',
    rows: [{ role: 'designer', required: true, state: 'waiting' }],
    head: 'h'.repeat(40),
    code: 'acme-design-demo/acme-crm',
    round: 1,
    role: 'designer',
    me: 'Sofia',
    pm: null,
    pull: { number: 4, url: 'https://github.com/acme-design-demo/acme-crm/pull/4', builder: 'acme-malik', builderName: 'Malik' },
    designerName: 'Sofia',
    exploration: { name: 'Contact page summary', screen: null, branch: null },
    review: { run: '1794287648265', head: 'h'.repeat(40), measuredAt: new Date(Date.now() - 17 * 3600_000).toISOString(), route: null, urls: { approved: 'https://approved.example', build: 'https://build.example' }, sizes: [{ key: 'laptop', width: 1280, height: 800, a: null, b: null, missing: {} }, { key: 'small', width: 1024, height: 768, a: null, b: null, missing: {} }, { key: 'phone', width: 390, height: 844, a: null, b: null, missing: {} }], items: ITEMS, ignored: 0 },
    queued: false,
    items: states(),
    fixed: [],
    meant: [],
    notes: [],
    handover: { decisions: ['Three tiles, always in the same order.', 'Going quiet appears after 30 days.'], edgeCases: [{ component: 'Contact summary', state: 'New contact with no history', covered: true }] },
    ticks: [],
    ...o,
  };
}

afterEach(() => {
  cleanup();
  world.ticks = [];
  world.said = [];
});

const ledger = async (props: { turnShown?: boolean } = {}) => {
  render(createElement(BuildReviewEntry, { product: 'crm', number: 2, builder: 'Malik', fallback: createElement('p', null, 'The compare'), ...props }));
  return screen.findByRole('region', { name: /Where Malik's build differs/ });
};

describe('the ledger of differences', () => {
  it('the designer: every difference one line, each line the way in; the two versions only once a line is hovered or focused', async () => {
    world.read = read();
    const region = await ledger();
    expect(within(region).getByRole('heading', { name: "Where Malik's build differs from your design" })).toBeInTheDocument();
    expect(within(region).getByText('8 differences, 3 only on a phone')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Start the check' })).toHaveAttribute('href', expect.stringContaining('item=r00000001'));
    const lines = within(region).getAllByRole('link', { name: /^Look at \d/ });
    expect(lines).toHaveLength(8);
    expect(lines[2]).toHaveAccessibleName('Look at 3, Add a note');
    expect(lines[2]).toHaveAttribute('href', expect.stringContaining('explorations/review/?exploration=2&product=crm&item=r00000003'));
    expect(within(region).queryByRole('button', { name: /Show \d more/ })).toBeNull();
    // No crops until a line is hovered or focused, and then under that line only.
    expect(region.querySelectorAll('.brl-pair')).toHaveLength(0);
    lines[2]!.focus();
    await waitFor(() => expect(region.querySelectorAll('.brl-pair')).toHaveLength(1));
    expect(lines[2]!.closest('li')!.querySelector('.brl-pair')).not.toBeNull();
    // The header's primary never follows the line.
    expect(within(region).getByRole('link', { name: 'Start the check' })).toHaveAttribute('href', expect.stringContaining('item=r00000001'));
    await expectNoAxeViolations(region);
  });

  it('after 2 of 8: answered lines keep their place and number with their answer; Continue', async () => {
    world.read = read({ items: states({ 1: 'fine', 2: 'fix' }) });
    const region = await ledger();
    const lines = within(region).getAllByRole('link', { name: /^Look at \d/ });
    expect(lines.slice(0, 3).map((a) => a.getAttribute('aria-label'))).toEqual(['Look at 1, Header: Fine as built', 'Look at 2, Navigation: Fix this', 'Look at 3, Add a note']);
    expect(lines[0]!.closest('li')!.querySelector('.brl-num')!.textContent).toBe('1');
    expect(within(region).getByText('2 of 8 answered · 1 to fix so far')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Continue' })).toHaveAttribute('href', expect.stringContaining('item=r00000003'));
    expect(within(region).queryByRole('link', { name: 'Start the check' })).toBeNull();
  });

  it('all answered: the zone holds Send your answer, so the header has no primary', async () => {
    world.read = read({ items: states(Object.fromEntries(ITEMS.map((i) => [i.n, 'fine']))) });
    const region = await ledger({ turnShown: true });
    expect(within(region).queryByRole('link', { name: /Send your answer|Continue|Start the check/ })).toBeNull();
    expect(within(region).getByRole('link', { name: /Open Malik's build/ })).toBeInTheDocument();
  });

  it('the handover notes: folded until someone starts, then each tick is saved', async () => {
    world.read = read();
    const region = await ledger();
    const show = within(region).getByRole('button', { name: 'Show' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(within(region).getByText('3 to find in the build')).toBeInTheDocument();
    await userEvent.click(show);
    expect(within(region).getByText("Bridge cannot measure these. Tick each one you see working in Malik's build.")).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('checkbox', { name: /Three tiles/ }));
    await waitFor(() => expect(world.ticks).toHaveLength(1));
    expect(world.ticks[0]!.found).toBe(true);
    await waitFor(() => expect(within(region).getByText('2 to find in the build')).toBeInTheDocument());
    await expectNoAxeViolations(region);
  });

  it('a design lead: "Sofia or you can answer", the same actionable rows, and Sofia\'s handover notes', async () => {
    world.read = read({ role: 'lead', me: 'Dana' });
    const region = await ledger();
    expect(within(region).getByRole('heading', { name: "Where Malik's build differs from Sofia's design" })).toBeInTheDocument();
    expect(within(region).getByText('Sofia or you can answer. The first answer goes to Malik.')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Start the check' })).toBeInTheDocument();
    expect(within(region).getByRole('heading', { name: "Sofia's handover notes" })).toBeInTheDocument();
  });

  it('once Dana answered first, Sofia sees it with the answer and can add a comment, no second verdict', async () => {
    world.read = read({ rows: [{ role: 'designer', required: true, state: 'waiting' }, { role: 'lead', required: false, state: 'looks-right', byName: 'Dana' }] });
    const region = await ledger();
    expect(within(region).getByText('Dana answered, sent to Malik')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Add a comment' })).toHaveAttribute('href', '#xp-compose');
    expect(within(region).queryByRole('link', { name: /Start the check|Continue/ })).toBeNull();
  });

  it('someone who cannot answer reads the rows with Look at the differences, and cannot tick', async () => {
    world.read = read({ role: null, me: 'Leo', items: states({ 1: 'fine' }) });
    const region = await ledger();
    expect(within(region).getByRole('link', { name: 'Look at the differences' })).toBeInTheDocument();
    expect(within(region).queryByRole('progressbar')).toBeNull();
  });

  it('before Bridge measured the build: the page\'s own screen block', async () => {
    world.read = read({ review: null });
    render(createElement(BuildReviewEntry, { product: 'crm', number: 2, fallback: createElement('p', null, 'The compare') }));
    expect(await screen.findByText('The compare')).toBeInTheDocument();
  });
});

describe('the full check: a design lead answers', () => {
  it('Dana opens a difference and says Fine as built: her buttons are on, never "You can look"', async () => {
    window.history.pushState({}, '', '/studio/explorations/review/?exploration=2&product=crm&item=r00000001');
    world.read = read({ role: 'lead', me: 'Dana' });
    render(createElement(BuildReview));
    const fine = (await screen.findAllByRole('button', { name: 'Fine as built' }))[0]!;
    expect(fine).toBeEnabled();
    expect(screen.queryByText(/You can look/)).toBeNull();
    await userEvent.click(fine);
    await waitFor(() => expect(world.said).toEqual([{ sig: 'r00000001', verdict: 'fine' }]));
  });

  it('the stepper: one step per difference with its state, the current one marked, every step clickable, then Send', async () => {
    window.history.pushState({}, '', '/studio/explorations/review/?exploration=2&product=crm&item=r00000003');
    world.read = read({ items: states({ 1: 'fine', 2: 'fix' }) });
    render(createElement(BuildReview));
    const steps = await screen.findByRole('list', { name: 'Differences to look at' });
    const buttons = within(steps).getAllByRole('button');
    expect(buttons).toHaveLength(9);
    expect(buttons[0]).toHaveAccessibleName('1. Header, Fine as built');
    expect(buttons[1]).toHaveAccessibleName('2. Navigation, Fix this');
    expect(buttons[2]).toHaveAttribute('aria-current', 'step');
    expect(buttons[5]).toHaveAccessibleName('6. Contact Cletus Doyle, To look at, only on a phone');
    expect(buttons[8]).toHaveAccessibleName('Send to Malik');
    expect(screen.getByText('3 of 8')).toBeInTheDocument();
    await userEvent.click(buttons[3]!);
    expect(within(steps).getAllByRole('button')[3]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    // The panel names the neighbours.
    expect(screen.getByRole('button', { name: '3 Add a note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 Tasks' })).toBeInTheDocument();
    await expectNoAxeViolations(steps);
  });

  it('the recap: the ones to fix with Change, the fine ones folded, one primary Send to Malik', async () => {
    window.history.pushState({}, '', '/studio/explorations/review/?exploration=2&product=crm&item=answer');
    world.read = read({ items: states(Object.fromEntries(ITEMS.map((i) => [i.n, [2, 7, 8].includes(i.n) ? 'fix' : 'fine']))) });
    render(createElement(BuildReview));
    const recap = await screen.findByRole('form', { name: 'Send your answer to Malik' });
    expect(within(recap).getByText('You looked at all 8. 3 to fix, 5 fine as built. Malik gets each one with its pictures and comments.')).toBeInTheDocument();
    expect(within(recap).getAllByRole('button', { name: /^Change \d/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Change 2, Navigation', 'Change 7, Cletus Doyle', 'Change 8, The page on a phone']);
    expect(within(recap).getByText('1 Header, 3 Add a note, 4 Tags, 5 Tasks, 6 Contact Cletus Doyle')).toBeInTheDocument();
    expect(within(recap).getByRole('button', { name: 'Send to Malik' })).toBeEnabled();
    await userEvent.click(within(recap).getByRole('button', { name: 'Change 7, Cletus Doyle' }));
    expect(await screen.findByRole('heading', { name: 'Cletus Doyle' })).toBeInTheDocument();
  });

  it('once Sofia answered first, Dana has no verdict left, and still comments', async () => {
    window.history.pushState({}, '', '/studio/explorations/review/?exploration=2&product=crm&item=r00000001');
    world.read = read({ role: 'lead', me: 'Dana', rows: [{ role: 'designer', required: true, state: 'looks-right', byName: 'Sofia' }] });
    render(createElement(BuildReview));
    const fine = (await screen.findAllByRole('button', { name: 'Fine as built' }))[0]!;
    expect(fine).toBeDisabled();
    expect(screen.getByText(/Sofia answered, sent to Malik: Looks right\. You can still comment on a difference\./)).toBeInTheDocument();
  });
});
