// A component's Library preview, the one Library > Components cards show (views/ComponentsView.tsx) and Studio's
// Being built thumbnails reuse (components/ds/studio/BranchThumb.tsx): the real component when the page runs it
// (`Example`, Bridge's own Library), else its first story from the design system's Storybook in a lazy, inert,
// sandboxed frame, on the stage checkerboard in the light theme. Decorative: the card or row names the component.
// `queued` (pages drawn in the browser with many previews at once): a frame starts loading only once near the screen,
// a few at a time (lib/frame-queue), so a board of cards does not boot every Storybook frame together.
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { ExampleNode } from '@bridge-ds/core';
import { mainStory, previewUrl, readableDocs } from '../../../lib/library/component-page';
import type { ComponentInfo } from '../../../lib/library/components';
import { queueFrame } from '../../../lib/frame-queue';
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

function StoryFrame({ src, title, className, queued }: { src: string; title: string; className: string; queued: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [go, setGo] = useState(!queued);
  useEffect(() => {
    if (!queued || go || !ref.current) return;
    return queueFrame(ref.current, () => setGo(true));
  }, [queued, go]);
  return <iframe ref={ref} className={className} src={go ? src : undefined} title={title} tabIndex={-1} loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />;
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
}) {
  const source = stageSource(c, storybook, Example);
  return (
    <Tag className={`${className} stage-checker`} data-theme="light" aria-hidden="true" {...INERT}>
      {source === 'example' && Example && c.preview ? (
        <Example node={c.preview} />
      ) : source === 'story' && storybook && c.storyId ? (
        <StoryFrame className={frameClassName} src={previewUrl(storybook, c.storyId, { theme: 'light' })} title={`${c.name} preview`} queued={queued} />
      ) : (
        empty
      )}
    </Tag>
  );
}
