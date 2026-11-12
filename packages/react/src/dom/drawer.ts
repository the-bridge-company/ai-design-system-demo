// The React Drawer for pages without React at runtime: `drawerHtml()` returns the markup `<DrawerContent>` renders
// (same elements and Drawer.module.css classes, so the same sheet, scrim and slide), and it opens and closes with the
// Dialog functions (`openDialog`, `closeDialog`, `bindDialogs`): a drawer is a modal dialog that slides from an edge,
// so focus moves inside and stays there, Escape and a click on the scrim close it, focus returns to what opened it
// and the page behind does not scroll. The popup is role="dialog" with aria-modal="true", named by its title.
//
//   panel.innerHTML = drawerHtml({ id: 'token', title: 'color.bg.default', body: trusted(details) });
//   openDialog('token', { initialFocus: popup }); closeDialog('token');
//
// Swipe to dismiss is React only (Base UI Drawer); the static drawer closes with its close button, Escape or the scrim.
import styles from '../components/Drawer/Drawer.module.css';
import buttonStyles from '../components/Button/Button.module.css';
import iconButtonStyles from '../components/IconButton/IconButton.module.css';
import type { DrawerSide, DrawerSize } from '../components/Drawer';
import { attrs, classNames, content, escapeHtml, type HtmlAttributes, type TrustedHtml } from './html';
import { iconHtml } from './icons';

export interface DrawerHtmlOptions {
  /** Id of the drawer root: `openDialog(id)` and `[data-dialog-open="id"]` triggers use it. Also prefixes the title and description ids. */
  id: string;
  /** Same as `<DrawerContent title>`: the heading, and the accessible name. Escaped; pass `trusted()` for markup. */
  title: string | TrustedHtml;
  /** Same as `<DrawerContent description>`. */
  description?: string | TrustedHtml;
  /** The body, already rendered and escaped: `trusted(html)`. */
  body?: TrustedHtml;
  /** Same as `<DrawerContent footer>`: sticky footer actions, `trusted(html)`. */
  footer?: TrustedHtml;
  /** Same as `<Drawer side>`. Default `end`. */
  side?: DrawerSide;
  /** Same as `<DrawerContent size>`. Default `md`. */
  size?: DrawerSize;
  /** Same as `<DrawerContent hideClose>`. */
  hideClose?: boolean;
  /** Same as `<DrawerContent closeLabel>`. Default "Close panel". */
  closeLabel?: string;
  /** Same as `<Drawer disablePointerDismissal>`. */
  disablePointerDismissal?: boolean;
  /** Extra classes on the popup for layout, never to restyle the drawer. */
  className?: string;
  /** Extra attributes on the popup (the element with role="dialog"): `data-*` hooks, `aria-*`. */
  attributes?: HtmlAttributes;
  /** Extra attributes on the body, the part a script fills: `data-*` hooks. */
  bodyAttributes?: HtmlAttributes;
}

/**
 * The exact markup of an open-able `<Drawer><DrawerContent>` as an HTML string, hidden until `openDialog()`. It moves
 * to the end of `<body>` when it opens, like the React portal.
 */
export function drawerHtml(options: DrawerHtmlOptions): string {
  const { id, title, description, body, footer, side = 'end', size = 'md', hideClose = false, closeLabel = 'Close panel', disablePointerDismissal = false, className } = options;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const popupAttrs = attrs({
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: -1,
    class: classNames(styles.popup, styles[side], styles[size], className),
    'aria-labelledby': titleId,
    'aria-describedby': description != null ? descriptionId : undefined,
    'data-dialog-popup': true,
    ...options.attributes,
  });
  const close = hideClose
    ? ''
    : `<button type="button" tabindex="0" aria-label="${escapeHtml(closeLabel)}" class="${classNames(buttonStyles.button, buttonStyles.ghost, buttonStyles.sm, buttonStyles.iconOnly, iconButtonStyles.iconButton, styles.close)}" data-dialog-close="">${iconHtml('x', 'sm')}</button>`;
  return (
    `<div id="${escapeHtml(id)}" data-bridge-dialog="" data-bridge-drawer=""${disablePointerDismissal ? ' data-disable-pointer-dismissal=""' : ''} hidden="">` +
    `<div role="presentation" class="${styles.backdrop}" aria-hidden="true" data-dialog-backdrop=""></div>` +
    `<div role="presentation" class="${classNames(styles.viewport, styles[`viewport-${side}`])}" data-dialog-viewport="">` +
    `<div${popupAttrs}>` +
    (side === 'bottom' ? `<div class="${styles.handle}" aria-hidden="true"></div>` : '') +
    `<div class="${styles.header}"><div class="${styles.heading}">` +
    `<h2 id="${escapeHtml(titleId)}" class="${styles.title}">${content(title)}</h2>` +
    (description != null ? `<p id="${escapeHtml(descriptionId)}" class="${styles.description}">${content(description)}</p>` : '') +
    `</div>${close}</div>` +
    `<div class="${styles.body}"${attrs(options.bodyAttributes)}>${body?.html ?? ''}</div>` +
    (footer != null ? `<div class="${styles.footer}">${footer.html}</div>` : '') +
    `</div></div></div>`
  );
}
