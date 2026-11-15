// The React AlertDialog for pages without React at runtime: `alertDialogHtml()` returns the markup
// `<AlertDialogContent>` renders (same elements and Dialog/AlertDialog/ButtonGroup/Button classes, so the same look),
// and it opens and closes with the Dialog functions (`openDialog`, `closeDialog`, `bindDialogs`), so it stacks over an
// open static Dialog or Drawer. Like the React one: role="alertdialog", no dismissal by clicking the scrim, focus
// starts on Cancel. Cancel and Escape close it with an empty return value; the confirm button with "confirm".
//
//   document.body.insertAdjacentHTML('beforeend', alertDialogHtml({ id: 'discard', title: 'Discard 3 changes?',
//     description: 'Your draft is emptied in this browser.', confirmLabel: 'Discard changes' }));
//   openDialog('discard', { initialFocus: cancelButtonOf('discard') });
//   root.addEventListener('close', () => dialogReturnValue(root) === 'confirm' && discard());
//
// Typing a name to confirm (`confirmText`) is React only.
import styles from '../components/AlertDialog/AlertDialog.module.css';
import dialogStyles from '../components/Dialog/Dialog.module.css';
import groupStyles from '../components/ButtonGroup/ButtonGroup.module.css';
import type { AlertDialogTone } from '../components/AlertDialog';
import { buttonHtml } from './button';
import { attrs, classNames, content, escapeHtml, type HtmlAttributes, type TrustedHtml } from './html';

export interface AlertDialogHtmlOptions {
  /** Id of the dialog root: `openDialog(id)` uses it. Also prefixes the title and description ids. */
  id: string;
  /** Same as `<AlertDialogContent title>`: a question that names the action and the object. Escaped. */
  title: string | TrustedHtml;
  /** Same as `<AlertDialogContent description>`: the consequence. Escaped. */
  description: string | TrustedHtml;
  /** Same as `<AlertDialogContent confirmLabel>`: a verb that repeats the action. */
  confirmLabel: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Same as `<AlertDialogContent tone>`. Default `danger`. */
  tone?: AlertDialogTone;
  /** Extra content between the description and the actions, already rendered and escaped: `trusted(html)`. */
  body?: TrustedHtml;
  /** Extra classes on the popup for layout, never to restyle the dialog. */
  className?: string;
  /** Extra attributes on the popup (the element with role="alertdialog"). */
  attributes?: HtmlAttributes;
}

/** The value `dialogReturnValue()` gives once the person confirmed. */
export const ALERT_DIALOG_CONFIRM = 'confirm';

/**
 * The exact markup of an open-able `<AlertDialog><AlertDialogContent>` as an HTML string, hidden until `openDialog()`.
 * Put it anywhere in the page: it moves to the end of `<body>` when it opens, like the React portal.
 */
export function alertDialogHtml(options: AlertDialogHtmlOptions): string {
  const { id, title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', body, className } = options;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const popupAttrs = attrs({
    role: 'alertdialog',
    'aria-modal': 'true',
    tabindex: -1,
    class: classNames(dialogStyles.popup, dialogStyles.sm, styles.alert, className),
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
    'data-dialog-popup': true,
    ...options.attributes,
  });
  const actions =
    `<div role="group" class="${classNames(groupStyles.group, groupStyles.spaced, groupStyles.horizontal, groupStyles['align-end'])}">` +
    buttonHtml(cancelLabel, { variant: 'secondary', attributes: { 'data-dialog-close': true, 'data-alert-cancel': true } }) +
    buttonHtml(confirmLabel, { variant: tone, attributes: { 'data-dialog-close': true, value: ALERT_DIALOG_CONFIRM } }) +
    `</div>`;
  return (
    `<div id="${escapeHtml(id)}" data-bridge-dialog="" data-disable-pointer-dismissal="" hidden="">` +
    `<div role="presentation" class="${dialogStyles.backdrop}" aria-hidden="true" data-dialog-backdrop=""></div>` +
    `<div role="presentation" class="${dialogStyles.viewport}" data-dialog-viewport="">` +
    `<div${popupAttrs}>` +
    `<div class="${classNames(dialogStyles.header, styles.header)}"><div class="${dialogStyles.heading}">` +
    `<h2 id="${escapeHtml(titleId)}" class="${dialogStyles.title}">${content(title)}</h2>` +
    `<p id="${escapeHtml(descriptionId)}" class="${dialogStyles.description}">${content(description)}</p>` +
    `</div></div>` +
    (body != null ? `<div class="${dialogStyles.body}">${body.html}</div>` : '') +
    `<div class="${styles.actions}">${actions}</div>` +
    `</div></div></div>`
  );
}

/** Cancel, the safe choice, where focus starts: pass it to `openDialog(id, { initialFocus })`. */
export function alertDialogCancel(target: string | HTMLElement): HTMLElement | null {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  return el?.querySelector<HTMLElement>('[data-alert-cancel]') ?? null;
}
