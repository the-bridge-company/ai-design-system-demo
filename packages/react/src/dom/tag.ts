import styles from '../components/Tag/Tag.module.css';
import type { TagTone } from '../components/Tag';
import { attrs, classNames, content, type HtmlAttributes, type TrustedHtml } from './html';

export interface TagHtmlOptions {
  /** Same as `<Tag tone>`. Default `neutral`. */
  tone?: TagTone;
  /** Same as `<Tag size>`. Default `md`. */
  size?: 'sm' | 'md';
  /** Extra classes for layout (margins, grid placement), never to restyle the tag. */
  className?: string;
  /** Extra attributes on the tag: `data-*` hooks, `id`, `title`, `aria-*`. */
  attributes?: HtmlAttributes;
}

/**
 * The exact markup of a static `<Tag>` (a label for a value: a token name, a filter value) as an HTML string, for
 * pages that build rows in plain scripts. `text` is escaped; pass `trusted(html)` for markup you escaped yourself.
 * Toggle and removable tags need their React behavior: use the React `<Tag>` for those. To make a static tag act
 * (open the token it names), put it inside your own `<button>` or `<a>`.
 */
export function tagHtml(text: string | number | TrustedHtml, options: TagHtmlOptions = {}): string {
  const { tone = 'neutral', size = 'md', className } = options;
  return `<span class="${classNames(styles.tag, styles[tone], styles[size], className)}"${attrs(options.attributes)}><span class="${styles.label}"><span class="${styles.text}">${content(text)}</span></span></span>`;
}
