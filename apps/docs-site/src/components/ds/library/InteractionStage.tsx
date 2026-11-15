// The stage of an interaction pattern: the components that do it, each under its name (a link to its Behaviors
// section) with its own wording as a toggle row, and one stage with the picked component, the same stage as a component
// page's Behaviors section (Behaviors.tsx BehaviorStage): the real component in the page on Bridge's own Library, its
// first story from the team's Storybook otherwise. Wide: the stage beside the list, kept in view. Narrow: above it.
import { useRef, useState } from 'react';
import { Button, Link } from '@bridge-ds/react';
import { previewUrl } from '../../../lib/library/component-page';
import type { InteractionComponent } from '../../../lib/library/patterns';
import { BehaviorStage, Keys, revealStage } from './Behaviors';

export interface InteractionStageProps {
  components: InteractionComponent[];
  /** Component name -> its Behaviors section. */
  links: Record<string, string>;
  /** True when the page runs the real components itself (Bridge's own Library). */
  live?: boolean;
  /** The team's Storybook: the stage when the page cannot run the components. */
  storybook?: string | undefined;
}

export default function InteractionStage({ components, links, live = false, storybook }: InteractionStageProps) {
  const [picked, setPicked] = useState(components[0]?.component ?? '');
  const stageRef = useRef<HTMLDivElement>(null);
  const active = components.find((c) => c.component === picked) ?? components[0];
  if (!active) return null;
  const node = live ? (active.example ?? active.preview) : null;
  const frame = !live && storybook && active.storyId ? previewUrl(storybook, active.storyId, { theme: 'light' }) : null;
  const hasStage = Boolean(node || frame);

  return (
    <div className={hasStage ? 'bh-layout has-stage' : 'bh-layout'}>
      {hasStage && <BehaviorStage ref={stageRef} name={active.component} note={active.try ?? active.text} node={node} frame={frame} exampleKey={active.component} />}
      <div className="bh-list">
        {components.map((c) => {
          const row = (
            <span className="bh-row-body">
              <span className="bh-text">{c.text}</span>
              {c.keys && <Keys keys={c.keys} />}
            </span>
          );
          return (
            <div key={c.component} className="bh-family">
              <h3 className="pt-comp-title">{links[c.component] ? <Link href={links[c.component]}>{c.component}</Link> : c.component}</h3>
              <ul>
                <li>
                  {hasStage ? (
                    <Button
                      variant="ghost"
                      fullWidth
                      pressed={active.component === c.component}
                      className="bh-row"
                      onClick={() => {
                        setPicked(c.component);
                        revealStage(stageRef.current);
                      }}
                    >
                      {row}
                    </Button>
                  ) : (
                    <div className="bh-row is-static">{row}</div>
                  )}
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
