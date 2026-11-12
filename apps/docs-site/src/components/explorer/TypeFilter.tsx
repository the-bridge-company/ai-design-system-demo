// Studio Tokens: the type filter of the toolbar (scripts/explorer/index.ts). One DS SegmentedControl, All then each
// type in scope with its count (arrow keys, Home and End, one radio group), and, when the table is scoped to a
// component (?component=), a removable DS Tag ahead of it. The explorer is vanilla: it mounts this island once on its
// toolbar slot (mountTypeFilter) and redraws it with new props on every render.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { SegmentedControl, Tag } from '@bridge-ds/react';

export interface TypeFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface TypeFilterProps {
  options: TypeFilterOption[];
  value: string;
  onPick: (value: string) => void;
  /** "Used by Button": the component the table is scoped to, removable. */
  component?: string;
  onClearComponent?: () => void;
}

export function TypeFilter({ options, value, onPick, component, onClearComponent }: TypeFilterProps) {
  return (
    <>
      {component && (
        <Tag className="xp-used-by" onRemove={onClearComponent} removeLabel={`filter: used by ${component}`} title="Show every token again">
          {`Used by ${component}`}
        </Tag>
      )}
      <SegmentedControl
        label="Filter by type"
        size="md"
        className="xp-types"
        value={value}
        onValueChange={(v) => v !== value && onPick(v)}
        items={options.map((o) => ({ value: o.value, label: o.label, count: o.count, attributes: { 'data-xp-chip': o.value } }))}
      />
    </>
  );
}

export interface TypeFilterMount {
  /** Draws the filter synchronously, so focus can move into it right after. */
  render: (props: TypeFilterProps) => void;
  unmount: () => void;
}

/** One React root on the toolbar slot for the life of the page. */
export function mountTypeFilter(host: HTMLElement): TypeFilterMount {
  const root = createRoot(host);
  return {
    render(props) {
      flushSync(() => root.render(<TypeFilter {...props} />));
    },
    unmount() {
      root.unmount();
    },
  };
}
