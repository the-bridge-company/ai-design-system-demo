import styles from '../components/SegmentedControl/SegmentedControl.module.css';
import type { SegmentedControlAppearance, SegmentedControlSize } from '../components/SegmentedControl';
import { attrs, classNames, escapeHtml, type HtmlAttributes } from './html';

export interface SegmentHtmlItem {
  value: string;
  /** Visible label, plain text (escaped). */
  label: string;
  disabled?: boolean;
  /** Extra attributes on the segment's button: `data-*` hooks a script reads, `id`, `title`. */
  attributes?: HtmlAttributes;
}

export interface SegmentedControlHtmlOptions {
  /** The selected value. Default: the first segment. */
  value?: string;
  /** Accessible name of the group, or pass `aria-labelledby` in `attributes`. */
  label?: string;
  /** Same as `<SegmentedControl size>`. Default `md`. */
  size?: SegmentedControlSize;
  /** Same as `<SegmentedControl appearance>`. Default `default`. */
  appearance?: SegmentedControlAppearance;
  /** Same as `<SegmentedControl fullWidth>`. */
  fullWidth?: boolean;
  /** Extra classes for layout, never to restyle the control. */
  className?: string;
  /** Extra attributes on the group: `data-*` hooks, `id`, `aria-labelledby`. */
  attributes?: HtmlAttributes;
}

/**
 * The markup of `<SegmentedControl>` as an HTML string, for plain-script pages: the same classes
 * (SegmentedControl.module.css) and the same static contract (`data-segmented-control` on the group, `data-segment`
 * and `data-value` on each radio button, `aria-checked` on the selected one). Call `bindSegmentedControls()` once so
 * clicks and the arrow keys move the selection; the group then fires a bubbling `change` event.
 */
export function segmentedControlHtml(items: SegmentHtmlItem[], options: SegmentedControlHtmlOptions = {}): string {
  const { size = 'md', appearance = 'default', fullWidth = false, label, className } = options;
  const value = options.value ?? items[0]?.value;
  const segments = items
    .map((item) => {
      const on = item.value === value;
      return (
        `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}"${on ? ' data-checked=""' : ' data-unchecked=""'}` +
        `${item.disabled ? ' disabled data-disabled=""' : ''} data-segment="" data-value="${escapeHtml(item.value)}" class="${styles.segment}"${attrs(item.attributes)}>` +
        `<span class="${styles.label}">${escapeHtml(item.label)}</span></button>`
      );
    })
    .join('');
  const root = classNames(styles.root, styles[size], appearance === 'strong' && styles.strong, fullWidth && styles.fullWidth, className);
  return `<div role="radiogroup"${label ? ` aria-label="${escapeHtml(label)}"` : ''} aria-orientation="horizontal" data-segmented-control="" class="${root}"${attrs(options.attributes)}><div class="${styles.track}" data-segment-track="">${segments}</div></div>`;
}

/** Selects one segment of a rendered control: `aria-checked`, the state attributes and the roving `tabindex`. */
export function selectSegment(group: HTMLElement, value: string): void {
  for (const seg of Array.from(group.querySelectorAll<HTMLElement>('[data-segment]'))) {
    const on = seg.dataset.value === value;
    seg.setAttribute('aria-checked', String(on));
    seg.setAttribute('tabindex', on ? '0' : '-1');
    seg.toggleAttribute('data-checked', on);
    seg.toggleAttribute('data-unchecked', !on);
  }
}

/**
 * Wires every `segmentedControlHtml()` control under `root`, like Base UI's RadioGroup: a click picks a segment, the
 * arrow keys (and Home, End) move the selection and the focus, Tab leaves the group. Each pick fires a bubbling `change`
 * event on the group, with the value in `data-value` of the selected segment. One delegated pair of listeners; returns
 * the function that removes them.
 */
export function bindSegmentedControls(root: Document | HTMLElement = document): () => void {
  const pick = (group: HTMLElement, seg: HTMLElement) => {
    if (seg.hasAttribute('disabled') || seg.getAttribute('aria-checked') === 'true') return;
    selectSegment(group, seg.dataset.value ?? '');
    group.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const onClick = (e: Event) => {
    const seg = (e.target as Element | null)?.closest?.<HTMLElement>('[data-segmented-control] [data-segment]');
    const group = seg?.closest<HTMLElement>('[data-segmented-control]');
    if (seg && group) pick(group, seg);
  };
  const onKey = (e: Event) => {
    const k = e as KeyboardEvent;
    const seg = (k.target as Element | null)?.closest?.<HTMLElement>('[data-segmented-control] [data-segment]');
    const group = seg?.closest<HTMLElement>('[data-segmented-control]');
    if (!seg || !group) return;
    const all = Array.from(group.querySelectorAll<HTMLElement>('[data-segment]')).filter((s) => !s.hasAttribute('disabled'));
    const rtl = getComputedStyle(group).direction === 'rtl';
    const at = all.indexOf(seg);
    const step = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[k.key];
    const to = k.key === 'Home' ? all[0] : k.key === 'End' ? all[all.length - 1] : step ? all[(at + step + all.length) % all.length] : undefined;
    if (!to) return;
    k.preventDefault();
    to.focus();
    pick(group, to);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
  };
}
