// The drawer preview of a team's story (TeamComponents.tsx) sizes to the story instead of a fixed height. A Storybook
// opened with `embed=bridge` (Bridge's own, .storybook/preview.tsx) drops its full-viewport canvas, centers the story
// and posts its document height to the parent; the frame takes that height, kept between the CSS min and max. A
// Storybook that does not post keeps the frame's resting height (the CSS min). Pure: no DOM.

/** The query parameter that asks a Storybook story for the embedded canvas (sized to the story, height posted). */
export const STORY_EMBED_PARAM = 'embed';
export const STORY_EMBED_VALUE = 'bridge';
/** The message type a story embedded that way posts to its parent. */
export const STORY_HEIGHT_MESSAGE = 'bridge:story-height';

/** A story iframe URL with the embed parameter appended. */
export const embedStoryUrl = (src: string): string => `${src}${src.includes('?') ? '&' : '?'}${STORY_EMBED_PARAM}=${STORY_EMBED_VALUE}`;

/** The height a story posted, in CSS pixels, or null when the message is not a sane story height. */
export function postedStoryHeight(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const { type, height } = data as { type?: unknown; height?: unknown };
  if (type !== STORY_HEIGHT_MESSAGE || typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return null;
  // A runaway page (a story that grows with its frame) stops at a bound far above any CSS max.
  return Math.min(Math.ceil(height), 10000);
}

// ---------------------------------------------------------------------------------------------------------------
// A story as a thumbnail (Being built cards and rows, components/ds/library/ComponentStage `fit`, owner decision
// 2026-11-12): the whole story, scaled to fit its frame with the same inner padding on every side and centered, never
// cut mid-word. A Storybook opened with `embed=bridge-thumb` (Bridge's own, .storybook/preview.tsx) lays the story out
// at its own size and posts the box everything it draws takes (portals included); the frame then scales and centers
// that box. A Storybook that does not post shows its whole canvas, shrunk (THUMB_FALLBACK_SCALE).

export const STORY_THUMB_VALUE = 'bridge-thumb';
/** The message type a story embedded as a thumbnail posts to its parent. */
export const STORY_SIZE_MESSAGE = 'bridge:story-size';
/** How much larger than its frame a thumbnail's canvas is laid out, before it is scaled back (the row's 3x). */
export const THUMB_CANVAS = 3;
/** A Storybook that does not post its size: its whole canvas, shrunk into the frame. */
export const THUMB_FALLBACK_SCALE = 1 / THUMB_CANVAS;

/** A story iframe URL that asks for the thumbnail canvas. */
export const thumbStoryUrl = (src: string): string => `${src}${src.includes('?') ? '&' : '?'}${STORY_EMBED_PARAM}=${STORY_THUMB_VALUE}`;

/** The box a story's content takes, in its own CSS pixels. */
export interface ContentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The content box a story posted, or null when the message is not a sane one. */
export function postedStorySize(data: unknown): ContentBox | null {
  if (!data || typeof data !== 'object') return null;
  const { type, left, top, width, height } = data as Record<string, unknown>;
  if (type !== STORY_SIZE_MESSAGE || !finite(left) || !finite(top) || !finite(width) || !finite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  // A runaway page stops at a bound far above any story.
  return { left, top, width: Math.min(width, 10000), height: Math.min(height, 10000) };
}

/**
 * The transform that fits `content` inside a frame of `frame` size, minus `pad` on each side, centered. It never
 * enlarges (a small button stays at its own size, centered); it shrinks whatever is larger until all of it shows.
 * Origin: the canvas' top left.
 */
export function fitTransform(content: ContentBox, frame: { width: number; height: number }, pad: number): { scale: number; x: number; y: number } {
  const roomW = Math.max(frame.width - 2 * pad, 1);
  const roomH = Math.max(frame.height - 2 * pad, 1);
  const scale = Math.min(1, roomW / content.width, roomH / content.height);
  return {
    scale,
    x: pad + (roomW - content.width * scale) / 2 - content.left * scale,
    y: pad + (roomH - content.height * scale) / 2 - content.top * scale,
  };
}

/** The CSS transform of a fit. */
export const fitCss = (f: { scale: number; x: number; y: number }): string =>
  `translate(${Math.round(f.x * 10) / 10}px, ${Math.round(f.y * 10) / 10}px) scale(${Math.round(f.scale * 10000) / 10000})`;
