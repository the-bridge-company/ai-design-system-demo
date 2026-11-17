// @vitest-environment jsdom
// Studio > Patterns: the kinds as quiet row groups, each row linked to its Library page, and the column of changes
// asked only when something waits for the viewer's decision.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { PatternsTable } from './StudioPatterns';
import type { StudioPatternGroup } from '../../../lib/studio-patterns';

const GROUPS: StudioPatternGroup[] = [
  { kind: 'interaction', label: 'Interactions', rows: [{ id: 'close-on-escape', name: 'Close on Escape', purpose: 'Escape closes what opened.', components: ['Dialog', 'Select'], href: '/patterns/close-on-escape/' }] },
  { kind: 'action', label: 'Actions', rows: [{ id: 'delete', name: 'Delete', purpose: 'Removes something for good.', components: ['Button', 'AlertDialog'], href: '/patterns/delete/' }] },
];

describe('PatternsTable', () => {
  it('keeps the group of a kind with no pattern, with how one comes to exist in one cell across the columns', async () => {
    const groups: StudioPatternGroup[] = [GROUPS[0]!, { kind: 'action', label: 'Actions', rows: [] }];
    const { container } = render(createElement(PatternsTable, { groups, requests: null }));
    expect(screen.getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['Interactions', 'Close on EscapeEscape closes what opened.', 'Actions']);
    const cell = container.querySelector<HTMLTableCellElement>('[data-spt-empty="action"] td')!;
    expect(cell.colSpan).toBe(2);
    expect(cell.textContent).toBe('None yet. An action appears here once people do the same task the same way in at least two places, like Delete.');
    // No fake row: nothing in it to open or link.
    expect(within(cell).queryByRole('link')).toBeNull();
    expect(container.querySelector('[data-spt-row]:not([data-spt-row="close-on-escape"])')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("spans the decision column too when something waits on the other kind", () => {
    const groups: StudioPatternGroup[] = [{ kind: 'interaction', label: 'Interactions', rows: [] }, GROUPS[1]!];
    const { container } = render(createElement(PatternsTable, { groups, requests: new Map([['delete', [{ number: 12, title: 'Delete pattern: offer Undo' }]]]) }));
    const cell = container.querySelector<HTMLTableCellElement>('[data-spt-empty="interaction"] td')!;
    expect(cell.colSpan).toBe(3);
    expect(cell.textContent).toContain('An interaction appears here once two components do the same thing the same way');
  });

  it('groups the rows under their kind once, each name opening its Library page, a lone row keeping its components', async () => {
    const { container } = render(createElement(PatternsTable, { groups: GROUPS, requests: null }));
    expect(screen.getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['Interactions', 'Close on EscapeEscape closes what opened.', 'Actions', 'DeleteRemoves something for good.']);
    expect(screen.getByRole('link', { name: 'Delete' }).getAttribute('href')).toBe('/patterns/delete/');
    expect(screen.getByText('Button, AlertDialog')).toBeTruthy();
    expect(container.querySelector('[data-spt-shared]')).toBeNull();
    expect(screen.queryByText('Waiting for your decision')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('shows the changes asked only when some wait, on the rows they concern', () => {
    render(createElement(PatternsTable, { groups: GROUPS, requests: new Map([['delete', [{ number: 12, title: 'Delete pattern: offer Undo' }]]]) }));
    expect(screen.getByRole('columnheader', { name: 'Waiting for your decision' })).toBeTruthy();
    const row = screen.getByRole('link', { name: 'Delete' }).closest('tr')!;
    expect(within(row).queryByText('1 change asked')).toBeNull();
    expect(within(row).getByRole('link', { name: 'Delete pattern: offer Undo' }).getAttribute('href')).toMatch(/\/studio\/explorations\/\?request=12$/);
  });

  it('lists every change asked on a row, with no count repeating the links', () => {
    render(createElement(PatternsTable, { groups: GROUPS, requests: new Map([['delete', [{ number: 12, title: 'Offer Undo' }, { number: 13, title: 'Type the name' }]]]) }));
    const row = screen.getByRole('link', { name: 'Delete' }).closest('tr')!;
    expect(within(row).getAllByRole('listitem')).toHaveLength(2);
    expect(within(row).queryByText('2 changes asked')).toBeNull();
  });

  it('says the components once on the group row when every row shares them, and keeps them per row when they differ', async () => {
    const row = (id: string, name: string, components: string[]) => ({ id, name, purpose: `${name}.`, components, href: `/patterns/${id}/` });
    const groups: StudioPatternGroup[] = [
      { kind: 'interaction', label: 'Interactions', rows: [row('close-on-escape', 'Close on Escape', ['Combobox', 'Select']), row('type-ahead', 'Type ahead', ['Select', 'Combobox'])] },
      { kind: 'action', label: 'Actions', rows: [row('delete', 'Delete', ['Button', 'AlertDialog']), row('send', 'Send for review', ['Button'])] },
    ];
    const { container } = render(createElement(PatternsTable, { groups, requests: new Map([['delete', [{ number: 12, title: 'Offer Undo' }]]]) }));
    const uses = (id: string) => container.querySelector(`[data-spt-row="${id}"] .spt-col-uses`)!.textContent;
    const shared = container.querySelector<HTMLElement>('[data-spt-group="interaction"] .spt-group')!;
    expect(within(shared).getByRole('rowheader').textContent).toBe('Interactions');
    expect(shared.querySelector('[data-spt-shared]')!.textContent).toBe('Combobox, Select');
    expect([uses('close-on-escape'), uses('type-ahead')]).toEqual(['', '']);
    expect(container.querySelector('[data-spt-group="action"] [data-spt-shared]')).toBeNull();
    expect([uses('delete'), uses('send')]).toEqual(['Button, AlertDialog', 'Button']);
    expect(screen.getAllByText('Combobox, Select')).toHaveLength(1);
    await expectNoAxeViolations(container);
  });

  it('draws no column for an empty answer', () => {
    render(createElement(PatternsTable, { groups: GROUPS, requests: new Map() }));
    expect(screen.queryByText('Waiting for your decision')).toBeNull();
  });
});
