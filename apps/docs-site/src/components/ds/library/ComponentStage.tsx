// A component's Library preview, the one Library > Components cards show (views/ComponentsView.tsx) and Studio's
// Being built thumbnails reuse (components/ds/studio/BranchThumb.tsx): the real component when the page runs it
// (`Example`, Bridge's own Library), else its first story from the design system's Storybook in a lazy, inert,
// sandboxed frame, on the stage checkerboard in the light theme. Decorative: the card or row names the component.
// `queued` (pages drawn in the browser with many previews at once): a frame starts loading only once near the screen,
// a few at a time (lib/frame-queue), so a board of cards does not boot every Storybook frame together.
// `fit` (a thumbnail, owner decision 2026-11-12): the whole preview, scaled down to fit the stage inside its padding
// and centered, never cut at the edge (lib/story-frame fitTransform). An Example is measured in the page; a story
// posts its size (embed=bridge-thumb, .storybook/preview.tsx), and a Storybook that does not shows its whole canvas.
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { ExampleNode } from '@bridge-ds/core';
import { mainStory, previewUrl, readableDocs } from '../../../lib/library/component-page';
import type { ComponentInfo } from '../../../lib/library/components';
import { queueFrame } from '../../../lib/frame-queue';
import { fitCss, fitTransform, postedStorySize, thumbStoryUrl, THUMB_FALLBACK_SCALE, type ContentBox } from '../../../lib/story-frame';
import '../../../styles/component-stage.css';

/** What a preview needs of a component: its name, its docs.json preview, its first story. */
export interface StageComponent {
  name: string;
  /** docs.json "preview", drawn by `Example`. */
  preview?: ExampleNode | null | undefined;
  /** The first story's id, loaded from the Storybook. */
  storyId?: string | null | undefined;
}

/** Out of the tab order and the accessibility tree (FoundationParts INERT, kept here so a thumbnail does not load the foundations). */
const INERT = { inert: '' } as Record<string, string>;

export type StageExample = ComponentType<{ node: ExampleNode }>;

/** A library component as the stage reads it: its docs.json preview and its first story (lib/library/component-page mainStory). */
export const stageComponent = (c: Pick<ComponentInfo, 'name' | 'docs' | 'stories'>): StageComponent => ({
  name: c.name,
  preview: readableDocs(c.docs)?.preview ?? null,
  storyId: mainStory(c)?.id ?? null,
});

/** What the stage draws for a component: the Example, the story frame, or nothing (no preview yet). */
export function stageSource(c: StageComponent, storybook: string | undefined, Example: StageExample | undefined): 'example' | 'story' | null {
  if (Example) return c.preview ? 'example' : null;
  return c.storyId && storybook ? 'story' : null;
}

/** How long a fitted frame waits after loading for its story's size before it shows its whole canvas instead. */
const FALLBACK_MS = 2500;

const observe = (el: Element, read: () => void): (() => void) => {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const ro = new ResizeObserver(read);
  ro.observe(el);
  return () => ro.disconnect();
};

/** The stage's size and inner padding (its CSS, tokens only), kept current. */
function useStageBox(stage: RefObject<HTMLElement | null>, on: boolean) {
  const [box, setBox] = useState<{ width: number; height: number; pad: number } | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!on || !el) return;
    const read = () => {
      const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
      setBox((b) => (b && b.width === el.clientWidth && b.height === el.clientHeight && b.pad === pad ? b : { width: el.clientWidth, height: el.clientHeight, pad }));
    };
    read();
    return observe(el, read);
  }, [stage, on]);
  return box;
}

const fitStyle = (content: ContentBox | null, box: { width: number; height: number; pad: number } | null): CSSProperties | undefined =>
  content && box && box.width > 0 && box.height > 0 ? { transform: fitCss(fitTransform(content, box, box.pad)) } : undefined;

/** The Example laid out at its own size (up to the canvas width), measured, then fitted into the stage. */
function FitExample({ stage, children }: { stage: RefObject<HTMLElement | null>; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [content, setContent] = useState<ContentBox | null>(null);
  const box = useStageBox(stage, true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setContent((c) => (width > 0 && height > 0 ? (c && c.width === width && c.height === height ? c : { left: 0, top: 0, width, height }) : null));
    };
    read();
    return observe(el, read);
  }, []);
  const style = fitStyle(content, box);
  return (
    <span ref={ref} className={style ? 'stage-fit is-fitted' : 'stage-fit'} style={style}>
      {children}
    </span>
  );
}

function StoryFrame({ src, title, className, queued, fit, stage }: { src: string; title: string; className: string; queued: boolean; fit: boolean; stage: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [go, setGo] = useState(!queued);
  const [content, setContent] = useState<ContentBox | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const box = useStageBox(stage, fit);
  useEffect(() => {
    if (!queued || go || !ref.current) return;
    return queueFrame(ref.current, () => setGo(true));
  }, [queued, go]);
  // The story posts the box it draws each time it changes; only this frame's messages count.
  useEffect(() => {
    if (!fit) return;
    const told = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const size = postedStorySize(e.data);
      if (size) setContent(size);
    };
    window.addEventListener('message', told);
    return () => window.removeEventListener('message', told);
  }, [fit]);
  useEffect(() => {
    if (!fit || !loaded || content) return;
    const timer = setTimeout(() => setGaveUp(true), FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [fit, loaded, content]);
  const fitted = fitStyle(content, box);
  const style: CSSProperties | undefined = !fit ? undefined : fitted ?? (gaveUp ? { transform: `scale(${THUMB_FALLBACK_SCALE})` } : undefined);
  return (
    <iframe
      ref={ref}
      className={fit ? `${className} stage-fit-frame${style ? ' is-fitted' : ''}` : className}
      style={style}
      src={go ? (fit ? thumbStoryUrl(src) : src) : undefined}
      title={title}
      tabIndex={-1}
      loading="lazy"
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
    />
  );
}

export function ComponentStage({
  c,
  storybook,
  Example,
  className,
  frameClassName,
  empty = null,
  as: Tag = 'div',
  queued = false,
  fit = false,
}: {
  c: StageComponent;
  storybook: string | undefined;
  Example?: StageExample | undefined;
  /** The stage's own class (its size); the checkerboard comes with it. */
  className: string;
  /** The story frame's class. */
  frameClassName: string;
  /** What shows without a preview. */
  empty?: ReactNode;
  as?: 'div' | 'span';
  queued?: boolean;
  /** A thumbnail: the whole preview, scaled to fit inside the stage's padding and centered. */
  fit?: boolean;
}) {
  const source = stageSource(c, storybook, Example);
  const stage = useRef<HTMLElement>(null);
  const example = source === 'example' && Example && c.preview ? <Example node={c.preview} /> : null;
  return (
    <Tag ref={stage as RefObject<HTMLDivElement & HTMLSpanElement>} className={`${className} stage-checker${fit ? ' is-fit' : ''}`} data-theme="light" aria-hidden="true" {...INERT}>
      {example ? (
        fit ? <FitExample stage={stage}>{example}</FitExample> : example
      ) : source === 'story' && storybook && c.storyId ? (
        <StoryFrame className={frameClassName} src={previewUrl(storybook, c.storyId, { theme: 'light' })} title={`${c.name} preview`} queued={queued} fit={fit} stage={stage} />
      ) : (
        empty
      )}
    </Tag>
  );
}
