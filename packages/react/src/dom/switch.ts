import styles from '../components/Switch/Switch.module.css';
import type { SwitchLabelPlacement, SwitchSize } from '../components/Switch';
import { attrs, classNames, content, type HtmlAttributes, type TrustedHtml } from './html';

export interface SwitchHtmlOptions {
  /** Same as `<Switch checked>`. Default false. */
  checked?: boolean;
  /** Same as `<Switch size>`. Default `md`. */
  size?: SwitchSize;
  /** Same as `<Switch labelPlacement>`. Default `end`. */
  labelPlacement?: SwitchLabelPlacement;
  /** Same as `<Switch disabled>`. */
  disabled?: boolean;
  /** Id of the visible label, which names the switch. Default: a fresh id on each call. */
  labelId?: string;
  /** Extra classes for layout, never to restyle the switch. */
  className?: string;
  /** Extra attributes on the switch itself (the focusable `role="switch"` element): `data-*` hooks, `id`. */
  attributes?: HtmlAttributes;
}

let next = 0;

/** The `data-checked` / `data-unchecked` pair Base UI sets on the track and the thumb, that the Switch styles read. */
const stateAttr = (checked: boolean) => (checked ? ' data-checked=""' : ' data-unchecked=""');

/**
 * The markup of `<Switch>` as an HTML string, for rows built in plain scripts: the same classes (Switch.module.css),
 * a native `<button role="switch">` (Space, Enter and a click on the label toggle it) in place of Base UI's span. Call
 * `bindSwitches()` once so a click flips it; the page reads `aria-checked` or listens for `change`.
 */
export function switchHtml(label: string | TrustedHtml, options: SwitchHtmlOptions = {}): string {
  const { checked = false, size = 'md', labelPlacement = 'end', disabled = false, className } = options;
  const labelId = options.labelId ?? `bridge-switch-${++next}-label`;
  const state = stateAttr(checked) + (disabled ? ' data-disabled=""' : '');
  return (
    `<label class="${classNames(styles.item, styles[labelPlacement], styles[size], className)}" data-pseudo-root="">` +
    `<button type="button" role="switch" aria-checked="${checked}" aria-labelledby="${labelId}" class="${styles.track}"${state}${disabled ? ' disabled' : ''} data-switch=""${attrs(options.attributes)}>` +
    `<span class="${styles.thumb}"${state}></span></button>` +
    `<span class="${styles.text}"><span id="${labelId}" class="${styles.label}">${content(label)}</span></span></label>`
  );
}

/** Sets a rendered switch on or off: `aria-checked` and the state attributes of its track and thumb. */
export function setSwitchChecked(sw: HTMLElement, checked: boolean): void {
  sw.setAttribute('aria-checked', String(checked));
  for (const el of [sw, ...Array.from(sw.children)]) {
    el.toggleAttribute('data-checked', checked);
    el.toggleAttribute('data-unchecked', !checked);
  }
}

/**
 * Makes every `switchHtml()` switch under `root` toggle on click (keyboard included, it is a button), then fire a
 * bubbling `change` event on it. One delegated listener; call once per root. Returns the function that removes it.
 */
export function bindSwitches(root: Document | HTMLElement = document): () => void {
  const onClick = (e: Event) => {
    const sw = (e.target as Element | null)?.closest?.<HTMLElement>('[data-switch]');
    if (!sw || sw.hasAttribute('disabled')) return;
    setSwitchChecked(sw, sw.getAttribute('aria-checked') !== 'true');
    sw.dispatchEvent(new Event('change', { bubbles: true }));
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
