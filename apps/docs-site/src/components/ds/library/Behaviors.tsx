// The Behaviors section of a component page (docs.json `behaviors`, @bridge-ds/core behaviors.ts): how the component
// reacts, in designer words. One stage with the real component, then the list: one list per shared family, rows
// divided, each row a DS toggle Button (text, keys in the DS Kbd, the expected screen reader announcement). The row
// picked says, on the stage, what to do to see it ("Open the list, then press Esc").
//
// The stage is the real component in the page when the page runs the design system's own components (`live`, Bridge's
// own Library, through the same registry as the docs examples), else the component's first story from the team's
// Storybook, interactive. A behavior with its own `example` (a loading state) swaps the stage to it while picked.
// Wide: the stage sits beside the list and stays in view (sticky). Narrow: it comes first, above the list.
// A behavior other components share has its Patterns page: "Shared" beside its row links to it.
// Reduced motion: nothing here animates; the component's own motion tokens drop to 0 ms, and bringing the stage into
// view does not scroll smoothly.
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Button, Kbd, Link } from '@bridge-ds/react';
import { behaviorGroups, keyLabel, type ComponentBehavior, type ExampleNode } from '@bridge-ds/core';
import ClientExample from '../studio/ClientExample';
import { CP_TOC_REFRESH, previewUrl } from '../../../lib/library/component-page';

export interface BehaviorsProps {
  /** Component name, for the stage's name. */
  name: string;
  behaviors: ComponentBehavior[];
  /** docs.json preview: what the live stage draws by default. */
  preview?: ExampleNode | null | undefined;
  /** True when the page can run the real component itself (Bridge's own Library). */
  live?: boolean;
  /** The team's Storybook and the component's first story: the stage when the page cannot run the component. */
  storybook?: string | undefined;
  storyId?: string | undefined;
  /** Behavior id -> the Patterns page of a behavior other components share too (lib/library/patterns.ts). */
  patterns?: Record<string, string> | undefined;
  /**
   * A team member who can send requests: the team's Studio Components drawer, opened on this component with "Change how
   * it behaves" picked (?c=<slug>&intent=behave). Unset for readers: they never see it.
   */
  changeHref?: string | undefined;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the element is fully in the viewport. */
function inView(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= (window.innerHeight || document.documentElement.clientHeight);
}

export interface BehaviorStageProps {
  /** Component name, for the stage's name. */
  name: string;
  /** What to do to see it, one line. */
  note: string;
  /** The live example to draw (the page runs the real component), else null. */
  node: ExampleNode | null;
  /** The Storybook story to frame when the page cannot run the component, else null. */
  frame: string | null;
  /** Remounts the live example when it changes (a behavior with its own example). */
  exampleKey: string;
}

/** The stage: "Try it on the real <Name>", the line to do, and the real component (live or from the Storybook). */
export const BehaviorStage = forwardRef<HTMLDivElement, BehaviorStageProps>(function BehaviorStage({ name, note, node, frame, exampleKey }, ref) {
  const labelId = useId();
  return (
    <div className="bh-stage" ref={ref} role="region" aria-labelledby={labelId}>
      <p className="bh-stage-label" id={labelId}>
        Try it on the real {name}
      </p>
      <p className="bh-stage-note" aria-live="polite">
        {note}
      </p>
      {node ? (
        <div className="bh-stage-frame stage-checker">
          <ClientExample key={exampleKey} node={node} />
        </div>
      ) : (
        frame && (
          <iframe
            className="bh-stage-frame bh-stage-story"
            src={frame}
            title={`${name} from the Storybook`}
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        )
      )}
    </div>
  );
});

/** True when the element is fully in the viewport; else brings it into view (smoothly unless reduced motion). */
export function revealStage(el: HTMLElement | null) {
  if (el && !inView(el)) el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** A behavior's keys in the DS Kbd. */
export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="bh-keys">
      {keys.map((k) => (
        <Kbd key={k} keys={keyLabel(k)} size="sm" />
      ))}
    </span>
  );
}

export default function Behaviors({ name, behaviors, preview, live = false, storybook, storyId, patterns, changeHref }: BehaviorsProps) {
  const groups = behaviorGroups(behaviors);
  // The first row shown (families are reordered), not the first one in the data.
  const first = groups[0]?.items[0] ?? behaviors[0];
  const [activeId, setActiveId] = useState(first?.id ?? '');
  const stageRef = useRef<HTMLDivElement>(null);
  const active = behaviors.find((b) => b.id === activeId) ?? first;
  const stageNode = live ? (active?.example ?? preview ?? null) : null;
  const frame = !live && storybook && storyId ? previewUrl(storybook, storyId, { theme: 'light' }) : null;
  const hasStage = Boolean(stageNode || frame);

  // The page's "On this page" rail lists the h2s of the shown panel: ask it again once this section is in the page.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent(CP_TOC_REFRESH));
  }, []);

  const pick = (b: ComponentBehavior) => {
    setActiveId(b.id);
    // The stage says what to do: bring it into view when it is not (narrow pages, where it sits above the list).
    revealStage(stageRef.current);
  };

  return (
    <section aria-labelledby="behaviors" className="bh">
      <h2 id="behaviors">Behaviors</h2>
      <div className={hasStage ? 'bh-layout has-stage' : 'bh-layout'}>
        {hasStage && active && <BehaviorStage ref={stageRef} name={name} note={active.try ?? active.text} node={stageNode} frame={frame} exampleKey={active.example ? active.id : 'preview'} />}
        <div className="bh-list">
          {groups.map((g) => (
            <div key={g.family} className="bh-family">
              <h3 className="bh-family-title">{g.family}</h3>
              <ul>
                {g.items.map((b) => {
                  const row = (
                    <span className="bh-row-body">
                      <span className="bh-text">{b.text}</span>
                      {b.keys && <Keys keys={b.keys} />}
                      {b.announces && (
                        <span className="bh-announce">
                          Expected announcement: <q>{b.announces}</q>
                        </span>
                      )}
                    </span>
                  );
                  const shared = patterns?.[b.id];
                  return (
                    <li key={b.id} className={shared ? 'bh-item has-pattern' : 'bh-item'}>
                      {hasStage ? (
                        <Button variant="ghost" fullWidth pressed={active?.id === b.id} className="bh-row" onClick={() => pick(b)}>
                          {row}
                        </Button>
                      ) : (
                        <div className="bh-row is-static">{row}</div>
                      )}
                      {/* Other components do it too: its pattern, beside the row (a link never sits inside the row's button). */}
                      {shared && (
                        <Link href={shared} className="bh-pattern" variant="subtle" aria-label={`${b.text}: the pattern other components share`}>
                          Shared
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {changeHref && (
        <p className="bh-change">
          <Link href={changeHref}>Ask to change how it behaves</Link>
        </p>
      )}
    </section>
  );
}
