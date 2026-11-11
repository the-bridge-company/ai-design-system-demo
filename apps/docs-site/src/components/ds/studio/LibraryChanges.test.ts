// @vitest-environment jsdom
// The Library group of Changes (boards LI6, LI7): every row says where it comes from, the filter narrows by origin,
// and the design lead groups the changes by component, with only what needs a decision open.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { AuditNote, LibraryChanges, type LibraryChangesProps } from './LibraryChanges';
import type { LibraryOrigin } from '../../../lib/library-origin';

interface Row {
  n: number;
  title: string;
  origin: LibraryOrigin;
  kind: string;
}

const explo = (name: string, number: number): LibraryOrigin => ({
  kind: 'exploration',
  name,
  product: 'Acme CRM',
  productKey: 'crm',
  number,
  href: `/studio/explorations/?exploration=${number}&product=crm`,
  piece: null,
  component: null,
  kept: false,
  conflict: false,
});

const ROWS: Row[] = [
  { n: 1, title: 'Card: Less room inside: 12', origin: explo('Deal pipeline cards', 4), kind: 'needs-design' },
  { n: 2, title: 'Card: More room inside: 20', origin: explo('Contact page summary', 5), kind: 'needs-design' },
  { n: 3, title: 'Focus ring easier to see', origin: { kind: 'lead', reason: 'a11y' }, kind: 'ci-failing' },
];

const props = (over: Partial<LibraryChangesProps<Row>> = {}): LibraryChangesProps<Row> => ({
  heading: 'Library',
  rows: ROWS,
  facts: (r) => ({ key: String(r.n), title: r.title, origin: r.origin, statusKind: r.kind, draft: false, figmaComponent: null, mine: r.origin.kind === 'lead' }),
  renderRow: (r, o) =>
    createElement('li', { key: r.n, 'data-row': r.n }, createElement('span', null, r.title), o.note, o.pill ? createElement('span', { className: 'pill' }, o.pill.label) : null),
  lead: { you: false, name: 'Dana' },
  ...over,
});

afterEach(() => history.replaceState(null, '', '/'));

describe('LibraryChanges', () => {
  it('every row says where it comes from, the exploration a link, with the exploration section tags', async () => {
    const { container } = render(createElement(LibraryChanges<Row>, props()));
    expect(screen.getByRole('link', { name: 'Deal pipeline cards' }).getAttribute('href')).toContain('exploration=4&product=crm');
    expect(container.textContent).toContain('Needed by Deal pipeline cards · Acme CRM');
    expect(container.textContent).toContain('From the DS lead · accessibility fix');
    expect([...container.querySelectorAll('.pill')].map((p) => p.textContent)).toEqual(['Needs Dana', 'Needs Dana', 'Being built']);
    expect(container.textContent).not.toMatch(/#\d|acme\//);
    await expectNoAxeViolations(container);
  });

  it('the filter narrows by origin, with counts, and keeps it in the address', async () => {
    const { container } = render(createElement(LibraryChanges<Row>, props()));
    const filter = screen.getByRole('radiogroup', { name: 'Where the changes come from' });
    expect(within(filter).getAllByRole('radio').map((r) => r.textContent)).toEqual(['All 3', 'From explorations 2', 'From the DS lead 1']);
    await userEvent.click(within(filter).getByRole('radio', { name: 'From the DS lead 1' }));
    expect(container.querySelectorAll('[data-row]')).toHaveLength(1);
    expect(location.search).toBe('?origin=lead');
  });

  it('a designer sees no grouping; the lead groups by component, the conflict open with Compare and pick', async () => {
    render(createElement(LibraryChanges<Row>, props()));
    expect(screen.queryByRole('radiogroup', { name: 'Group the library changes' })).toBeNull();

    const { container } = render(createElement(LibraryChanges<Row>, props({ lead: { you: true, name: 'Dana' } })));
    expect(screen.getByRole('radiogroup', { name: 'Group the library changes' })).toBeTruthy();
    expect(container.textContent).toContain('asked by 2 explorations, two different ways');
    const pick = screen.getByRole('link', { name: 'Compare and pick' });
    expect(pick.getAttribute('href')).toContain('exploration=4');
    // The lead's own change, waiting on nobody, is folded at the end.
    const own = screen.getByRole('button', { name: /Your own changes/ });
    expect(own.getAttribute('aria-expanded')).toBe('false');
    await expectNoAxeViolations(container);
  });
});

describe('AuditNote', () => {
  it('a change sent from an adoption report names the report, as a link to it', async () => {
    const { container } = render(createElement(AuditNote, { origin: { kind: 'audit', name: 'Buttons', product: 'Acme CRM', productKey: 'crm', href: '/studio/quality/report/?product=crm' } }));
    expect(container.textContent).toBe('From the Acme CRM adoption report');
    expect(screen.getByRole('link', { name: 'Acme CRM adoption report' }).getAttribute('href')).toBe('/studio/quality/report/?product=crm');
    await expectNoAxeViolations(container);
  });

  it('a product no longer listed: the words, no link', () => {
    const { container } = render(createElement(AuditNote, { origin: { kind: 'audit', name: 'Buttons', product: null, productKey: 'gone', href: null } }));
    expect(container.textContent).toBe('From an adoption report');
    expect(container.querySelector('a')).toBeNull();
  });
});
