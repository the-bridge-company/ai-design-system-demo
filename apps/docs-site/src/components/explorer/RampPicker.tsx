// The token cell editor's ramp (scripts/explorer/inline-edit.ts): the steps of the picked family, one of them the
// pending value. Colors are a DS RadioGroup of tiles (appearance="tile"): each step a 32px swatch with its step number
// under it (50 ... 950), the picked one in the DS checked ring, and the value the token had when the editor opened
// marked "was" (a dot on its swatch, and its name says so). No grey track: the ramp reads as the palette it is. Other
// types (space, radius, duration) are a DS RadioGroup list, one row per step with its value. Both are Base UI radio
// groups: arrow keys move and pick, as before. Like the family tabs, the editor mounts this island once
// (mountRampPicker) and moves its node into each redraw.
import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Radio, RadioGroup, VisuallyHidden } from '@bridge-ds/react';

export interface RampStep {
  /** Token path: the value picked is `{path}`. */
  path: string;
  /** Short name: `neutral.500`, `space.4`. */
  label: string;
  /** The step on its own, `500`. */
  step: string;
  /** Colors: the hex in the edited mode. */
  hex?: string;
  /** Other types: the value, `16px`. */
  value?: string;
}

export interface RampPickerProps {
  kind: 'color' | 'steps';
  /** Accessible name: the family, `Neutral`. */
  label: string;
  steps: RampStep[];
  /** Path of the picked step, or '' when the value is not one of them (a raw value). */
  value: string;
  /** Path of the value the token had when the editor opened (the "was" mark), or '' when it was not a step. */
  original?: string;
  onPick: (path: string) => void;
}

export function RampPicker({ kind, label, steps, value, original = '', onPick }: RampPickerProps) {
  const pick = (v: string) => v && v !== value && onPick(v);
  if (kind === 'steps') return <StepList label={label} steps={steps} value={value} original={original} onPick={pick} />;
  return (
    <RadioGroup label={label} hideLabel appearance="tile" value={value} onValueChange={pick} className="xe-ramp">
      {steps.map((s) => {
        const was = s.path === original;
        return (
          <Radio
            key={s.path}
            value={s.path}
            className={was ? 'xe-tile is-was' : 'xe-tile'}
            label={
              <span className="xe-tile-body" data-tooltip={`${s.label} · ${s.hex ?? ''}`} data-tooltip-side="bottom">
                <span className="xe-tile-sw" style={{ backgroundColor: s.hex ?? 'transparent' }} aria-hidden="true">
                  {was && <span className="xe-tile-was" data-xe-was="" />}
                </span>
                <span className="xe-tile-step mono" aria-hidden="true">
                  {s.step}
                </span>
                <VisuallyHidden>{`${s.label}, ${s.hex ?? ''}${was ? ', was' : ''}`}</VisuallyHidden>
              </span>
            }
          />
        );
      })}
    </RadioGroup>
  );
}

/**
 * Steps of a size, radius, duration or easing: a DS RadioGroup list that scrolls past a few steps. The original value
 * carries the same "was" mark as the color ramp and the pick row (a dot and the word, not ", was" glued to the value).
 * The edge that hides more steps fades (data-fade on the list: start, end, both), so a step cut by the edge reads as
 * "more below", and the picked step scrolls into view.
 */
function StepList({ label, steps, value, original, onPick }: { label: string; steps: RampStep[]; value: string; original: string; onPick: (v: string) => void }) {
  const ref = useRef<HTMLFieldSetElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const more = el.scrollHeight - el.clientHeight > 1;
      const top = more && el.scrollTop > 1;
      const bottom = more && el.scrollTop < el.scrollHeight - el.clientHeight - 1;
      const fade = top && bottom ? 'both' : top ? 'start' : bottom ? 'end' : '';
      if (fade) el.setAttribute('data-fade', fade);
      else el.removeAttribute('data-fade');
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  });
  useLayoutEffect(() => {
    // Only the list scrolls (never the page under the editor).
    const el = ref.current;
    const item = el?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.closest('label');
    if (!el || !item) return;
    // The list is positioned (token-explorer.css), so a step's offsetTop is measured from it.
    const top = item.offsetTop;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + item.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + item.offsetHeight - el.clientHeight;
  }, [value]);
  return (
    <RadioGroup ref={ref} label={label} hideLabel value={value} onValueChange={onPick} className="xe-steps">
      {steps.map((s) => (
        <Radio
          key={s.path}
          value={s.path}
          label={
            <span className="xe-step-name">
              <span className="mono">{s.step}</span>
              {s.path === original && (
                <span className="xe-was" data-xe-was="">
                  <span className="xe-was-dot" aria-hidden="true" />
                  was
                </span>
              )}
            </span>
          }
          description={s.value}
        />
      ))}
    </RadioGroup>
  );
}

export interface RampPickerMount {
  /** Draws the ramp (synchronously, so focus can move to a step right after) into the slot of the editor's redraw. */
  render: (slot: Element | null, props: RampPickerProps) => void;
  unmount: () => void;
}

/** One React root for the life of an editor. Its node moves into each redraw's slot instead of being rebuilt. */
export function mountRampPicker(): RampPickerMount {
  const host = document.createElement('div');
  host.className = 'xe-ramp-host';
  const root = createRoot(host);
  return {
    render(slot, props) {
      if (!slot) return;
      slot.replaceWith(host);
      flushSync(() => root.render(<RampPicker {...props} />));
    },
    unmount() {
      root.unmount();
    },
  };
}
