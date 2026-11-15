// @vitest-environment jsdom
// askFirst: the DS AlertDialog a plain script opens (Discard in the token editor's review drawer). Focus on Cancel,
// Cancel and Escape answer no, the confirm button answers yes, and it never calls window.confirm. Axe clean.
import '../../../../packages/react/src/test/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../packages/react/src/test/axe';
import { askFirst } from './ask-first';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('askFirst', () => {
  it('asks in an alert dialog that starts on Cancel, and Cancel answers no', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const answer = askFirst({ title: 'Discard 3 changes?', description: 'Your draft is emptied in this browser. This cannot be undone.', confirmLabel: 'Discard changes' });
    const dialog = screen.getByRole('alertdialog', { name: 'Discard 3 changes?' });
    expect(dialog).toHaveAccessibleDescription('Your draft is emptied in this browser. This cannot be undone.');
    expect(document.activeElement).toHaveTextContent('Cancel');
    await expectNoAxeViolations();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await answer).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('the confirm button answers yes; Escape answers no', async () => {
    const yes = askFirst({ title: 'Discard 1 change?', description: 'Gone.', confirmLabel: 'Discard change' });
    fireEvent.click(screen.getByRole('button', { name: 'Discard change' }));
    expect(await yes).toBe(true);
    const no = askFirst({ title: 'Discard 1 change?', description: 'Gone.', confirmLabel: 'Discard change' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await no).toBe(false);
  });
});
