// The Library <-> Studio switch at the end of the top bar: the DS SegmentedControl in link mode, a nav of two
// segments, each with its drawn icon (an open book for the Library, pen and notes for Studio) and its word (icon only
// on a phone). The space you are in is the current page (aria-current, the raised plate); the other one is the link
// that loads it, carrying the page's item across (lib/space-switch.ts). Rendered statically by the layout (no
// hydration); scripts/space-switch.ts plays the switch on click, refreshes the target where the query or the team
// decides it, and the first-visit hint. Styles: styles/space-switch.css.
import { Avatar, SegmentedControl, type SegmentAttributes } from '@bridge-ds/react';
import { otherSpace, SWITCH_LABEL, switchTooltip, type SwitchSpace } from '../lib/space-switch';

export interface SpaceSwitchProps {
  /** The space this page is in: its word shows on the pill. */
  space: SwitchSpace;
  /** Where the link goes (lib/space-switch.ts switchTarget). */
  href: string;
  /** The item carried across ("Button"), for the tooltip. */
  item?: string | null;
}

/** Pen and notes: two lines of notes, a scribble the pen writes on hover, and the pen. 20 by 20, stroked. */
function PenIcon() {
  return (
    <svg className="ss-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M3.2 5.2h6.2M3.2 8.6h4.4" />
      <path className="ss-scrib" pathLength={1} d="M3 15.6c1.2-1.6 2.2 1 3.4-.4s2-1.2 2.8.2 2 .2 2.6-.8" />
      <g className="ss-nib">
        <path d="M15.6 2.6l2 2-7.4 7.4-2.8.8.8-2.8z" />
        <path d="M14.2 4l2 2" />
      </g>
    </svg>
  );
}

/** Open book: two pages and a spine, with a leaf that turns on hover. */
function BookIcon() {
  return (
    <svg className="ss-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M10 5.4C8.2 4 5.6 3.8 2.8 4.8v10.6c2.8-1 5.4-.8 7.2.6" />
      <path d="M10 5.4c1.8-1.4 4.4-1.6 7.2-.6v10.6c-2.8-1-5.4-.8-7.2.6" />
      <path d="M10 5.4V16" />
      <path className="ss-leaf" d="M10 5.4c1.4-.9 3-1.2 4.8-1v10.2c-1.8-.2-3.4.1-4.8 1" />
    </svg>
  );
}

export default function SpaceSwitch({ space, href, item = null }: SpaceSwitchProps) {
  const other = otherSpace(space);
  // The link to the other space: the hooks scripts/space-switch.ts reads, and the tooltip naming the destination.
  const link: SegmentAttributes = {
    'data-space-switch': '',
    'data-switch-space': space,
    'data-switch-item': item ?? undefined,
    'data-tooltip': switchTooltip(space, item),
    'data-tooltip-side': 'bottom',
  };
  const segment = (s: SwitchSpace) => ({
    value: s,
    label: <span className="ss-label">{s === 'library' ? 'Library' : 'Studio'}</span>,
    leading: (
      <span className="ss-icon">
        {s === 'library' ? <BookIcon /> : <PenIcon />}
        {/* A signed-in maintainer sees their face here instead of the pen (scripts/maintainer.ts paints it). */}
        {s === 'studio' && space === 'library' && (
          <span className="ss-avatar" data-team-avatar="" hidden>
            <Avatar name="Studio" size="xs" decorative data-team-avatar-img="" />
          </span>
        )}
      </span>
    ),
    href: s === other ? href : undefined,
    attributes: s === other ? link : { 'data-switch-current': '' },
  });
  // Owner, 2026-11-12: each segment shows its icon and its word; an icon for one space and a word for the other read
  // as one button.
  return <SegmentedControl className="space-nav" label={SWITCH_LABEL} value={space} data-mode={space} items={[segment('library'), segment('studio')]} />;
}
