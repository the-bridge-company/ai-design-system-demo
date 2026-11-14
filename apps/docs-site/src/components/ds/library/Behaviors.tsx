// The Behaviors section of a component page (docs.json `behaviors`, @bridge-ds/core behaviors.ts): how the component
// reacts, in designer words, grouped by shared family, keys drawn with the DS Kbd and the expected screen reader
// announcement under a behavior that has one. Beside the list, one stage with the real component: "Try it" on a row
// puts focus on it, so the reader performs the behavior there and then.
//
// The stage is the real component in the page when the page runs the design system's own components (`live`, Bridge's
// own Library, through the same registry as the docs examples), else the component's first story from the team's
// Storybook, interactive. A behavior with its own `example` (a loading state) swaps the stage to it while picked.
// Reduced motion: nothing here animates; the component's own motion tokens drop to 0 ms, and the stage comes into view
// without a smooth scroll.
import { useRef, useState } from 'react';
import { Button, Kbd } from '@bridge-ds/react';
import { behaviorGroups, keyLabel, type ComponentBehavior, type ExampleNode } from '@bridge-ds/core';
import ClientExample from '../studio/ClientExample';
import { previewUrl } from '../../../lib/library/component-page';

export interface BehaviorsProps {
  /** Component name, for the copy and the stage's name. */
  name: string;
  behaviors: ComponentBehavior[];
  /** docs.json preview: what the live stage draws by default. */
  preview?: ExampleNode | null | undefined;
  /** True when the page can run the real component itself (Bridge's own Library). */
  live?: boolean;
  /** The team's Storybook and the component's first story: the stage when the page cannot run the component. */
  storybook?: string | undefined;
  storyId?: string | undefined;
}

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="bh-keys">
      {keys.map((k) => (
        <Kbd key={k} keys={keyLabel(k)} size="sm" />
      ))}
    </span>
  );
}

export default function Behaviors({ name, behaviors, preview, live = false, storybook, storyId }: BehaviorsProps) {
  const [active, setActive] = useState<ComponentBehavior | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const groups = behaviorGroups(behaviors);
  const stageNode = live ? (active?.example ?? preview ?? null) : null;
  const frame = !live && storybook && storyId ? previewUrl(storybook, storyId, { theme: 'light' }) : null;
  const hasStage = Boolean(stageNode || frame);

  const tryIt = (b: ComponentBehavior) => {
    setActive(b);
    // After the stage has drawn the behavior's example: focus the real component, so the next key press is the behavior.
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      stage.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    });
  };

  return (
    <section aria-labelledby="behaviors" className="bh">
      <h2 id="behaviors">Behaviors</h2>
      {hasStage && <p className="muted">Pick Try it, then do it on the real {name} beside the list.</p>}
      <div className={hasStage ? 'bh-layout has-stage' : 'bh-layout'}>
        <div className="bh-list">
          {groups.map((g) => (
            <div key={g.family} className="bh-family">
              <h3 className="bh-family-title">{g.family}</h3>
              <ul>
                {g.items.map((b) => (
                  <li key={b.id} className="bh-row" data-active={active?.id === b.id ? '' : undefined}>
                    <div className="bh-line">
                      <span className="bh-text">{b.text}</span>
                      {b.keys && <Keys keys={b.keys} />}
                      {hasStage && (
                        <Button variant="ghost" size="sm" className="bh-try" aria-pressed={active?.id === b.id} aria-label={`Try it: ${b.text}`} onClick={() => tryIt(b)}>
                          Try it
                        </Button>
                      )}
                    </div>
                    {b.announces && (
                      <p className="bh-announce small muted">
                        Expected announcement: <q>{b.announces}</q>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {hasStage && (
          <div className="bh-stage" ref={stageRef}>
            <p className="bh-stage-note small" aria-live="polite">
              {active ? (
                <>
                  Now: {active.text}
                  {active.keys && (
                    <>
                      {' '}
                      <Keys keys={active.keys} />
                    </>
                  )}
                </>
              ) : (
                `The real ${name}: every behavior on the left works here.`
              )}
            </p>
            {stageNode ? (
              <div className="bh-stage-frame stage-checker" role="group" aria-label={`${name}, live`}>
                <ClientExample key={active?.example ? active.id : 'preview'} node={stageNode} />
              </div>
            ) : (
              frame && (
                <iframe
                  className="bh-stage-frame bh-stage-story"
                  src={frame}
                  title={`${name}, live from the Storybook`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
