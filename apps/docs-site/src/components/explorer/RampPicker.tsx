// The token cell editor's ramp (scripts/explorer/inline-edit.ts): the steps of the picked family, one of them the
// pending value. Colors are a DS SegmentedControl of swatches (the step's name and hex are its accessible name and its
// DS tooltip, side bottom: the step names stay readable without a tick row); other types (space, radius, duration) are a DS RadioGroup, one row per step with its value. Both are
// Base UI radio groups: arrow keys move and pick, as before. Like the family tabs, the editor mounts this island once
// (mountRampPicker) and moves its node into each redraw.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Radio, RadioGroup, SegmentedControl, VisuallyHidden } from '@bridge-ds/react';

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
  onPick: (path: string) => void;
}

export function RampPicker({ kind, label, steps, value, onPick }: RampPickerProps) {
  const pick = (v: string) => v && v !== value && onPick(v);
  if (kind === 'steps') {
    return (
      <RadioGroup label={label} hideLabel value={value} onValueChange={pick} className="xe-steps">
        {steps.map((s) => (
          <Radio key={s.path} value={s.path} label={<span className="mono">{s.step}</span>} description={s.value} />
        ))}
      </RadioGroup>
    );
  }
  return (
    <SegmentedControl
      label={label}
      size="sm"
      className="xe-ramp"
      value={value}
      onValueChange={pick}
      items={steps.map((s) => ({
        value: s.path,
        label: <VisuallyHidden>{`${s.label}, ${s.hex ?? ''}`}</VisuallyHidden>,
        leading: <span className="xe-swatch" style={{ backgroundColor: s.hex ?? 'transparent' }} />,
        attributes: { 'data-xe-pick': s.path, 'data-tooltip': `${s.label} · ${s.hex ?? ''}`, 'data-tooltip-side': 'bottom' },
      }))}
    />
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
