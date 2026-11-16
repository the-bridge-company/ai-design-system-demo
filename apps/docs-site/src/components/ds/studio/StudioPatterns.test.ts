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
  it('groups the rows under their kind once, each name opening its Library page', async () => {
    const { container } = render(createElement(PatternsTable, { groups: GROUPS, requests: null }));
    expect(screen.getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['Interactions', 'Close on EscapeEscape closes what opened.', 'Actions', 'DeleteRemoves something for good.']);
    expect(screen.getByRole('link', { name: 'Delete' }).getAttribute('href')).toBe('/patterns/delete/');
    expect(screen.getByText('Button, AlertDialog')).toBeTruthy();
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

  it('draws no column for an empty answer', () => {
    render(createElement(PatternsTable, { groups: GROUPS, requests: new Map() }));
    expect(screen.queryByText('Waiting for your decision')).toBeNull();
  });
});
