import styles from '../components/Button/Button.module.css';
import iconButtonStyles from '../components/IconButton/IconButton.module.css';
import type { ButtonSize, ButtonVariant } from '../components/Button';
import type { IconButtonVariant } from '../components/IconButton';
import { attrs, classNames, content, escapeHtml, type HtmlAttributes, type TrustedHtml } from './html';
import { iconHtml, type DomIconName } from './icons';

export interface ButtonHtmlOptions {
  /** Same as `<Button variant>`. Default `primary`. */
  variant?: ButtonVariant;
  /** Same as `<Button size>`. Default `md`. */
  size?: ButtonSize;
  /** Same as `<Button iconStart>`, from the DOM renderers' glyphs. */
  iconStart?: DomIconName;
  /** Same as `<Button iconEnd>`. */
  iconEnd?: DomIconName;
  /** Same as `<Button fullWidth>`. */
  fullWidth?: boolean;
  /** Same as `<Button disabled>`: a script re-enables it by removing both `disabled` and `data-disabled`. */
  disabled?: boolean;
  /** Same as `<Button pressed>`: a toggle. A script flips `aria-pressed`; the look follows the attribute. */
  pressed?: boolean;
  /** A link styled as a button, the markup of `<Button render={<a href />}>`: for navigation only. */
  href?: string;
  /** Same as `<Button type>` (not with `href`). Default `button`. */
  type?: 'button' | 'submit' | 'reset';
  /** Extra classes for layout (margins, grid placement), never to restyle the button. */
  className?: string;
  /** Extra attributes: `data-*` hooks, `id`, `title`, `aria-*`, `target` and `rel` on a link. */
  attributes?: HtmlAttributes;
}

/** The class list `<Button>` puts on its root, for code that creates the element itself. */
export function buttonClassName({ variant = 'primary', size = 'md', fullWidth = false, pressed, className }: Pick<ButtonHtmlOptions, 'variant' | 'size' | 'fullWidth' | 'pressed' | 'className'> = {}): string {
  return classNames(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, pressed !== undefined && styles.toggle, className);
}

/**
 * The exact markup of `<Button>` as an HTML string, for pages that build rows in plain scripts: a `<button>`, or with
 * `href` the `<a>` of `<Button render={<a href />}>`. `label` is escaped; pass `trusted(html)` for markup you
 * escaped yourself. A script changes the text with the label span (`:scope > span`), so the icon stays.
 */
export function buttonHtml(label: string | TrustedHtml, options: ButtonHtmlOptions = {}): string {
  const { iconStart, iconEnd, href, disabled = false, pressed, type = 'button', attributes } = options;
  const inner =
    (iconStart ? iconHtml(iconStart, 'sm', styles.icon) : '') + `<span class="${styles.label}">${content(label)}</span>` + (iconEnd ? iconHtml(iconEnd, 'sm', styles.icon) : '');
  const cls = buttonClassName(options);
  if (href !== undefined) return `<a href="${escapeHtml(href)}" class="${cls}"${attrs(attributes)}>${inner}</a>`;
  const head = attrs({ type, 'data-disabled': disabled || undefined, tabindex: 0, disabled: disabled || undefined, 'aria-pressed': pressed === undefined ? undefined : String(pressed) });
  return `<button${head}${attrs(attributes)} class="${cls}">${inner}</button>`;
}

export interface IconButtonHtmlOptions {
  /** Same as `<IconButton variant>`. Default `ghost`. */
  variant?: IconButtonVariant;
  /** Same as `<IconButton size>`. Default `md`. */
  size?: ButtonSize;
  /** Same as `<IconButton disabled>`. */
  disabled?: boolean;
  /** Extra classes for layout, never to restyle the button. */
  className?: string;
  /** Extra attributes: `data-*` hooks, `id`, `title`. */
  attributes?: HtmlAttributes;
}

/** The exact markup of `<IconButton>` as an HTML string. `label` is its accessible name: say the action. */
export function iconButtonHtml(icon: DomIconName, label: string, options: IconButtonHtmlOptions = {}): string {
  const { variant = 'ghost', size = 'md', disabled = false, className, attributes } = options;
  const cls = classNames(styles.button, styles[variant], styles[size], styles.iconOnly, iconButtonStyles.iconButton, className);
  // A tabindex in attributes replaces the default one, like tabIndex on the React one (a roving grid cell: -1).
  const { tabindex = 0, ...rest } = attributes ?? {};
  const head = attrs({ type: 'button', 'data-disabled': disabled || undefined, tabindex, disabled: disabled || undefined, 'aria-label': label });
  return `<button${head}${attrs(rest)} class="${cls}">${iconHtml(icon, size === 'lg' ? 'md' : 'sm')}</button>`;
}
