// Asks first, from a plain script, in the DS AlertDialog (alertDialogHtml from @bridge-ds/react/dom): the irreversible
// actions of the Action patterns (patterns/delete.pattern.json), never window.confirm. It stacks over an open static
// dialog or drawer (the Dialog functions keep one focus trap), starts on Cancel, and resolves true once confirmed.
import { ALERT_DIALOG_CONFIRM, alertDialogCancel, alertDialogHtml, dialogReturnValue, openDialog, type AlertDialogHtmlOptions } from '@bridge-ds/react/dom';

let asked = 0;

export function askFirst(o: Omit<AlertDialogHtmlOptions, 'id'>): Promise<boolean> {
  const id = `bridge-ask-${++asked}`;
  document.body.insertAdjacentHTML('beforeend', alertDialogHtml({ id, ...o }));
  const root = document.getElementById(id)!;
  return new Promise((resolve) => {
    root.addEventListener(
      'close',
      () => {
        resolve(dialogReturnValue(root) === ALERT_DIALOG_CONFIRM);
        // After its closing motion: the next ask brings its own.
        setTimeout(() => root.remove(), 300);
      },
      { once: true },
    );
    openDialog(root, { initialFocus: alertDialogCancel(root) });
  });
}
