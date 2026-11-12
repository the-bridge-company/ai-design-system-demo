import styles from '../components/Badge/Badge.module.css';
import type { BadgeAppearance, BadgeSize, BadgeTone } from '../components/Badge';
import { attrs, classNames, content, type HtmlAttributes, type TrustedHtml } from './html';
import { iconHtml, type DomIconName } from './icons';

export interface BadgeHtmlOptions {
  /** Same as `<Badge tone>`. Default `neutral`. */
  tone?: BadgeTone;
  /** Same as `<Badge appearance>`. Default `subtle`. */
  appearance?: BadgeAppearance;
  /** Same as `<Badge size>`. Default `md`. */
  size?: BadgeSize;
  /** Same as `<Badge dot>`. */
  dot?: boolean;
  /** Same as `<Badge icon>`, from the glyphs the DOM renderers draw (`check`, `x`, ...). Wins over `dot`. */
  icon?: DomIconName;
  /** Extra classes for layout (margins, grid placement), never to restyle the badge. */
  className?: string;
  /** Extra attributes on the badge: `data-*` hooks, `id`, `title`, `aria-*`, or `tooltipAttributes()`. */
  attributes?: HtmlAttributes;
}

/** The class list `<Badge>` puts on its root, for code that creates the element itself. */
export function badgeClassName({ tone = 'neutral', appearance = 'subtle', size = 'md', className }: Omit<BadgeHtmlOptions, 'dot' | 'icon' | 'attributes'> = {}): string {
  return classNames(styles.badge, styles[appearance], styles[tone], styles[size], className);
}

/**
 * The exact markup of `<Badge>` as an HTML string, for pages that build rows in plain scripts. `text` is escaped;
 * pass `trusted(html)` for markup you escaped yourself. `icon` takes the glyphs of `./icons` (the React one any Lucide icon).
 */
export function badgeHtml(text: string | number | TrustedHtml, options: BadgeHtmlOptions = {}): string {
  const dot = options.icon ? iconHtml(options.icon, 'xs', styles.icon) : options.dot ? `<span class="${styles.dot}" aria-hidden="true"></span>` : '';
  return `<span class="${badgeClassName(options)}"${attrs(options.attributes)}>${dot}${content(text)}</span>`;
}
