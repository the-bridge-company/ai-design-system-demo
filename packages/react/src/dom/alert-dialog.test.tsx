// AlertDialog outside React: parity of alertDialogHtml() with <AlertDialogContent>, and its behavior with the Dialog
// functions: focus on Cancel, no scrim dismissal, Cancel and Escape answer no, the confirm button answers "confirm",
// and it stacks over an open static dialog.
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { AlertDialog, AlertDialogContent, type AlertDialogContentProps } from '../components/AlertDialog';
import { ALERT_DIALOG_CONFIRM, alertDialogCancel, alertDialogHtml, closeDialog, dialogHtml, dialogReturnValue, isDialogOpen, openDialog, type AlertDialogHtmlOptions } from './index';

/** Elements, classes, text and the attributes users and assistive tech see; ids and framework internals dropped. */
function shape(el: Element): string {
  const keep = ['role', 'type', 'aria-label', 'aria-hidden'];
  const a = keep.filter((n) => el.hasAttribute(n)).map((n) => ` ${n}="${el.getAttribute(n)}"`);
  const cls = el.getAttribute('class');
  const kids = [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : n instanceof Element ? shape(n) : '')).join('');
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}${a.join('')}>${kids}</${el.tagName.toLowerCase()}>`;
}

const describeOf = (popup: Element) => ({
  popup: shape(popup),
  viewport: popup.parentElement!.getAttribute('class'),
  name: document.getElementById(popup.getAttribute('aria-labelledby')!)!.textContent,
  description: document.getElementById(popup.getAttribute('aria-describedby')!)!.textContent,
});

afterEach(() => {
  for (const el of document.querySelectorAll('[data-bridge-dialog]')) closeDialog(el as HTMLElement);
  document.body.innerHTML = '';
});

describe('alertDialogHtml', () => {
  it.each([
    [{ title: 'Discard 3 changes?', description: 'Your draft is emptied in this browser.', confirmLabel: 'Discard changes' }],
    [{ title: 'Add it to the library?', description: 'It goes out with the next release.', confirmLabel: 'Add to the library', tone: 'primary' as const, cancelLabel: 'Not now' }],
  ] as Array<[Omit<AlertDialogHtmlOptions, 'id'>]>)('matches <AlertDialogContent %j>', async (props) => {
    const r = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent {...(props as AlertDialogContentProps)} />
      </AlertDialog>,
    );
    const react = describeOf(await r.findByRole('alertdialog'));
    r.unmount();
    document.body.innerHTML = alertDialogHtml({ id: 'a', ...props });
    expect(describeOf(document.querySelector('[role="alertdialog"]')!)).toEqual(react);
  });

  it('opens on Cancel, ignores the scrim, and answers confirm or not', async () => {
    document.body.innerHTML = `<main><button type="button">Discard</button></main>` + alertDialogHtml({ id: 'd', title: 'Discard 3 changes?', description: 'Your draft is emptied.', confirmLabel: 'Discard changes' });
    const root = document.getElementById('d')!;
    openDialog('d', { initialFocus: alertDialogCancel('d') });
    expect(document.activeElement).toHaveTextContent('Cancel');
    await expectNoAxeViolations();
    fireEvent.click(root.querySelector('[data-dialog-viewport]')!);
    expect(isDialogOpen('d')).toBe(true);
    fireEvent.click(alertDialogCancel('d')!);
    expect(isDialogOpen('d')).toBe(false);
    expect(dialogReturnValue(root)).toBe('');
    openDialog('d');
    fireEvent.click(root.querySelector('button[value]')!);
    expect(isDialogOpen('d')).toBe(false);
    expect(dialogReturnValue(root)).toBe(ALERT_DIALOG_CONFIRM);
  });

  it('stacks over an open static dialog, and Escape closes only itself', () => {
    document.body.innerHTML = dialogHtml({ id: 'sheet', title: 'Review changes' }) + alertDialogHtml({ id: 'ask', title: 'Discard?', description: 'Gone.', confirmLabel: 'Discard' });
    openDialog('sheet');
    openDialog('ask', { initialFocus: alertDialogCancel('ask') });
    expect(document.getElementById('sheet')!.inert).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isDialogOpen('ask')).toBe(false);
    expect(isDialogOpen('sheet')).toBe(true);
  });
});
