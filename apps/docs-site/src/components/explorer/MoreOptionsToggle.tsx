// The token cell editor's "More options" disclosure (scripts/explorer/inline-edit.ts): a DS Button, ghost and small,
// that shows or hides the raw value, the other mode and the description. It keeps the data-xe-more hook the editor's
// click handler reads. Like the family tabs, the editor mounts this island once and moves its node into each redraw.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@bridge-ds/react';

export interface MoreOptionsToggleProps {
  open: boolean;
  /** Id of the region it shows and hides. */
  controls: string;
}

export function MoreOptionsToggle({ open, controls }: MoreOptionsToggleProps) {
  return (
    <Button variant="ghost" size="sm" iconStart={open ? ChevronDown : ChevronRight} aria-expanded={open} aria-controls={controls} data-xe-more="">
      More options
    </Button>
  );
}

export interface MoreOptionsToggleMount {
  render: (slot: Element | null, props: MoreOptionsToggleProps) => void;
  unmount: () => void;
}

/** One React root for the life of an editor. Its node moves into each redraw's slot instead of being rebuilt. */
export function mountMoreOptionsToggle(): MoreOptionsToggleMount {
  const host = document.createElement('span');
  host.className = 'xe-more-host';
  const root = createRoot(host);
  return {
    render(slot, props) {
      if (!slot) return;
      slot.replaceWith(host);
      flushSync(() => root.render(<MoreOptionsToggle {...props} />));
    },
    unmount() {
      root.unmount();
    },
  };
}
