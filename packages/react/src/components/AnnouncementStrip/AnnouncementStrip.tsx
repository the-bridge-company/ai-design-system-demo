import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { Icon, type LucideIcon } from '../Icon';
import styles from './AnnouncementStrip.module.css';

export type AnnouncementStripAppearance = 'harbor' | 'neutral';

export interface AnnouncementStripProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Names the landmark, in a few words: "Founding teams". Screen reader users find the strip by it. */
  label: string;
  /** The notice, in one or two short sentences. Plain text with at most one emphasis (`strong`). */
  children: ReactNode;
  /** Leading Lucide icon, decorative: the words carry the message. */
  icon?: LucideIcon;
  /** One link after the message, where the reader learns more: a DS Link. Never a Button. Ignored when `href` is set. */
  action?: ReactNode;
  /**
   * Makes the whole strip one link to where the reader learns more: the message is the link's text, so no separate
   * "Read more" is needed. Underlined on hover, with the focus ring inside the strip.
   */
  href?: string;
  /**
   * `harbor` (default): the light Harbor zone (`color.bg.zone`), for a site-wide notice on marketing pages. `neutral`:
   * the subtle ground, when the page under it opens with a Harbor zone of its own.
   */
  appearance?: AnnouncementStripAppearance;
}

/**
 * A quiet strip across the top of every page of a site, above its header: a lasting, site-wide fact the reader should
 * know wherever they land ("Teams that request access by 31 March 2027 stay free"). One line, centred, full bleed, not dismissible,
 * no urgency. A complementary landmark named by `label`, not a live region. For a mode the page is in, use Banner; for
 * a message about the page's content, use Alert.
 */
export const AnnouncementStrip = forwardRef<HTMLElement, AnnouncementStripProps>(function AnnouncementStrip(
  { label, icon, action, href, appearance = 'harbor', className, children, ...rest },
  ref,
) {
  const message = (
    <>
      {icon && <Icon icon={icon} size="sm" className={styles.icon} />}
      <span className={styles.text}>{children}</span>
    </>
  );
  return (
    <aside ref={ref} aria-label={label} className={cx(styles.strip, styles[appearance], href && styles.linked, className)} {...rest}>
      {href ? (
        <a href={href} className={cx(styles.message, styles.whole)}>
          {message}
        </a>
      ) : (
        <p className={styles.message}>
          {message}
          {action != null && action !== false && <span className={styles.action}>{action}</span>}
        </p>
      )}
    </aside>
  );
});
