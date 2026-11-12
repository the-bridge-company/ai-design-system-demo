// One "how it works" section of the homepage as the DS Tabs, vertical (HpStepSection.astro hydrates it when it
// scrolls into view): a heading, one sentence, three numbered step tabs (the active one shows its sentence and a
// progress bar) and the panel with the step's drawing. Base UI gives the tab roles, arrow keys (they select, like
// the page had), Home and End. The active step advances every 4.5 s while the section is on screen, and pauses on
// hover or focus; under reduced motion nothing advances on its own (lib/homepage.ts stepTick). A panel mounts when
// its step is picked, so its drawing's animation starts over. `p0`, `p1`, `p2`: the drawings (Astro slots, static
// HTML); `labels`: what each drawing shows, for screen readers.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Tab, Tabs, TabsList, TabsPanel } from '@bridge-ds/react';
import { STEP_MS, stepTick } from '../../lib/homepage';

interface Step {
  title: string;
  text: string;
}

export interface HpStepsProps {
  id: string;
  title: string;
  lede: string;
  steps: [Step, Step, Step];
  labels: [string, string, string];
  flip?: boolean;
  p0?: ReactNode;
  p1?: ReactNode;
  p2?: ReactNode;
}

export default function HpSteps({ id, title, lede, steps, labels, flip = false, p0, p1, p2 }: HpStepsProps) {
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const live = useRef({ step: 0, t: 0, inView: false, hover: false, focus: false });
  const drawings = [p0, p1, p2];

  const pick = (v: unknown) => {
    const n = Number(v);
    if (!Number.isInteger(n)) return;
    live.current.step = n;
    live.current.t = 0;
    setStep(n);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const io = new IntersectionObserver((es) => es.forEach((e) => (live.current.inView = e.isIntersecting && e.intersectionRatio >= 0.4)), {
      threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });
    io.observe(el);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const s = live.current;
      if (!rm.matches) {
        const r = stepTick(s.t, dt, s.step, !s.inView || s.hover || s.focus, steps.length);
        if (r.step !== s.step) pick(r.step);
        else s.t = r.elapsed;
      }
      bars.current.forEach((b, k) => {
        if (b) b.style.transform = `scaleX(${k !== s.step ? 0 : rm.matches ? 1 : Math.min(1, s.t / STEP_MS).toFixed(4)})`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [steps.length]);

  return (
    <Tabs
      ref={root}
      orientation="vertical"
      value={step}
      onValueChange={pick}
      className={`hp-wrap hp-tabgrid${flip ? ' hp-flip' : ''}`}
      onMouseEnter={() => (live.current.hover = true)}
      onMouseLeave={() => (live.current.hover = false)}
      onFocus={() => (live.current.focus = true)}
      onBlur={(e) => (live.current.focus = Boolean(e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)))}
    >
      <div className="hp-tabtext">
        <h2 id={id} className="hp-st-h">
          {title}
        </h2>
        <p className="hp-st-p">{lede}</p>
        <TabsList className="hp-steps" aria-labelledby={id} activateOnFocus>
          {steps.map((s, j) => (
            <Tab key={j} value={j} id={`${id}-t${j}`} className="hp-step" aria-labelledby={`${id}-n${j}`} aria-describedby={`${id}-d${j}`}>
              <span className="hp-n" aria-hidden="true">
                {j + 1}
              </span>
              <span className="hp-step-body">
                <span className="hp-tt" id={`${id}-n${j}`}>
                  {s.title}
                </span>
                <span className="hp-more">
                  <span>
                    <span className="hp-more-text" id={`${id}-d${j}`}>
                      {s.text}
                    </span>
                    <span className="hp-prog" aria-hidden="true">
                      <span className="hp-bar">
                        <i ref={(el) => void (bars.current[j] = el)} />
                      </span>
                      <span className="hp-cnt">{`${j + 1} of 3`}</span>
                    </span>
                  </span>
                </span>
              </span>
            </Tab>
          ))}
        </TabsList>
      </div>
      <div className="hp-panel">
        {drawings.map((d, j) => (
          <TabsPanel key={j} value={j} className="hp-ui hp-on">
            <div role="img" aria-label={labels[j]}>
              {d}
            </div>
          </TabsPanel>
        ))}
      </div>
    </Tabs>
  );
}
