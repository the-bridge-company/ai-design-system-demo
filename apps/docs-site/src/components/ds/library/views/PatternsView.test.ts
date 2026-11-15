// @vitest-environment jsdom
// Library > Patterns: the index by kind, an action performed on its stage with the real components the rule names
// (AlertDialog first when it cannot be undone, the row saying it is done when it can), an interaction with each component in
// its own words on the Behaviors stage, and the component page's shared rows linking to their interaction.
import '../../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../../packages/react/src/test/axe';
import { repoModel } from '../../../../lib/model';
import { loadComponents } from '../../../../lib/library/components';
import { libraryPatterns, patternById } from '../../../../lib/library/patterns';
import type { LibraryData } from '../library-data';
import ComponentView from './ComponentView';
import { PatternsView, PatternView, patternHrefs, patternLinks, usedByLabel } from './PatternsView';

const own: LibraryData = { model: repoModel, team: null, extras: {} };
const SB = 'https://storybook.example.com';
const groups = libraryPatterns(repoModel);
const view = (id: string, extra: { live?: boolean; storybook?: string } = { live: true }) => {
  const entry = patternById(groups, id)!;
  return render(createElement(PatternView, { entry, links: patternLinks(own, entry), ...extra }));
};

describe('Patterns index', () => {
  it('lists each kind once, each pattern by name with what it is for, and never a second "Patterns" title', () => {
    const { container } = render(createElement(PatternsView, { groups, hrefs: patternHrefs(own, groups) }));
    expect([...container.querySelectorAll('h1, h2')].map((h) => h.textContent)).toEqual(['Patterns', 'Interactions', 'Actions']);
    expect(screen.getByRole('link', { name: 'Delete' })).toHaveAttribute('href', '/patterns/delete/');
    expect(container.textContent).toContain('Escape closes an open list.');
  });
});

describe('an action', () => {
  it('that cannot be undone asks first in an AlertDialog, then the row goes; Start again brings it back', async () => {
    view('delete');
    const stage = screen.getByRole('region', { name: 'Try Delete' });
    expect(within(stage).getByText('Press Delete on a row: it asks first, since it cannot be undone. Marketing team also asks for its name: other people lose it.')).toBeInTheDocument();
    fireEvent.click(within(stage).getByRole('button', { name: 'Delete: Spring sale draft' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Spring sale draft?')).toBeInTheDocument();
    expect(within(dialog).getByText(/This cannot be undone/)).toBeInTheDocument();
    // Plain confirmation: nothing to type.
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    expect(within(stage).queryByText('Spring sale draft')).toBeNull();
    fireEvent.click(within(stage).getByRole('button', { name: 'Start again' }));
    expect(within(stage).getByText('Spring sale draft')).toBeInTheDocument();
  });

  it('whose impact is high asks to type the name: Delete this team stays off until it matches', async () => {
    view('delete');
    const stage = screen.getByRole('region', { name: 'Try Delete' });
    fireEvent.click(within(stage).getByRole('button', { name: 'Delete: Marketing team' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Marketing team?')).toBeInTheDocument();
    const field = within(dialog).getByRole('textbox', { name: 'Type "Marketing team" to confirm' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete this team' });
    expect(confirm).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Marketing' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Marketing team' } });
    const on = within(dialog).getByRole('button', { name: 'Delete this team' });
    expect(on).toBeEnabled();
    await expectNoAxeViolations(dialog);
    fireEvent.click(on);
    expect(within(stage).queryByText('Marketing team')).toBeNull();
  });

  it('sent for review goes at once and the row says so in its place, no Undo; Start again brings it back', async () => {
    view('send-for-review');
    const stage = screen.getByRole('region', { name: 'Try Send for review' });
    expect(within(stage).getByText('Press Send for review on a row: it goes at once, and the row says Sent for review.')).toBeInTheDocument();
    fireEvent.click(within(stage).getByRole('button', { name: 'Send for review: Card radius' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(stage).getByText('Card radius')).toBeInTheDocument();
    expect(within(stage).getByText('Sent for review')).toBeInTheDocument();
    expect(within(stage).queryByRole('button', { name: 'Send for review: Card radius' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await expectNoAxeViolations(stage);
    fireEvent.click(within(stage).getByRole('button', { name: 'Start again' }));
    expect(within(stage).getByRole('button', { name: 'Send for review: Card radius' })).toBeInTheDocument();
  });

  it('says its rules, its components as links, and where the product does it, files folded for developers', async () => {
    const { container } = view('delete');
    expect([...container.querySelectorAll('h1, h2')].map((h) => h.textContent)).toEqual(['Delete', 'Try it', 'Rules', 'Components', 'Used in']);
    expect(screen.getByRole('link', { name: 'AlertDialog' })).toHaveAttribute('href', '/components/alert-dialog/');
    expect(container.querySelector('.pt-used')!.textContent).toContain('Settings, Danger zone');
    expect(container.querySelector('.pt-used')!.textContent).not.toContain('apps/docs-site');
    expect(usedByLabel([{ label: 'A', screen: 'x' }, { label: 'B', screen: 'y' }, { label: 'A', screen: 'z' }])).toEqual([['A', ['x', 'z']], ['B', ['y']]]);
    await expectNoAxeViolations();
  });
});

describe('an interaction', () => {
  it('shows each component in its own words, its name linking to its Behaviors, and the picked one on the stage', () => {
    view('close-on-escape', { storybook: SB });
    expect(screen.getByRole('link', { name: 'Select' })).toHaveAttribute('href', '/components/select/#behaviors');
    const row = screen.getByRole('button', { name: /Escape closes the list/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-pressed', 'true');
    const stage = screen.getByRole('region', { name: 'Try it on the real Combobox' });
    expect(stage.querySelector('iframe')).not.toBeNull();
    // Said once: the section is the components, the stage says "Try it on the real ...".
    expect([...document.querySelectorAll('h1, h2')].map((h) => h.textContent)).toEqual(['Close on Escape', 'Components']);
  });
});

describe('a component page', () => {
  it('links each shared behavior row to its interaction, and only those', () => {
    const select = loadComponents(repoModel).find((c) => c.name === 'Select')!;
    const { container } = render(createElement(ComponentView, { data: { ...own, extras: { storybook: SB } }, component: select }));
    const shared = [...container.querySelectorAll<HTMLAnchorElement>('.bh-pattern')].map((a) => a.getAttribute('href'));
    expect(shared.sort()).toEqual(['/patterns/close-on-escape/', '/patterns/focus-after-close/', '/patterns/pick-with-enter/']);
  });
});
