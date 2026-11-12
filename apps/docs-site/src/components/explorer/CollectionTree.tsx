// The Library token explorer's left pane (scripts/explorer/index.ts, mode "read"): collections and their groups, or
// the types, as the DS SidebarNav. Each entry is a SidebarNavItem rendered as a button (it picks what the table shows,
// it does not leave the page), with its token count; the picked one is current. A group's subgroups show while it or
// one of them is picked. The explorer is vanilla: it mounts this island once on the pane (mountCollectionTree) and
// redraws it with new props on every render.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { SidebarNav, SidebarNavItem, SidebarNavSection } from '@bridge-ds/react';

export interface TreeEntry {
  /** Unique key: `all`, `semantic`, `semantic:color`, `type:color`. */
  key: string;
  label: string;
  count: number;
  /** 0 for a collection or a type, 1 for a group, 2 for a subgroup: the indent. */
  depth: 0 | 1 | 2;
  current: boolean;
  /** What a pick selects, as data attributes the explorer reads: data-tier, data-group, data-category. */
  data: Record<`data-${string}`, string>;
}

export interface CollectionTreeProps {
  entries: TreeEntry[];
  /** A line under the list, like "Same collections the Figma plugin creates." */
  note?: string;
  onPick: (entry: TreeEntry) => void;
}

export function CollectionTree({ entries, note, onPick }: CollectionTreeProps) {
  return (
    <>
      <SidebarNav aria-label="Collections and groups" className="xp-tree-nav">
        <SidebarNavSection>
          {entries.map((e) => (
            <SidebarNavItem
              key={e.key}
              render={<button type="button" />}
              active={e.current}
              count={e.count}
              className={e.depth ? `xp-tree-d${e.depth}` : undefined}
              onClick={() => onPick(e)}
              {...e.data}
            >
              {e.label}
            </SidebarNavItem>
          ))}
        </SidebarNavSection>
      </SidebarNav>
      {note && <p className="xp-tree-note">{note}</p>}
    </>
  );
}

export interface CollectionTreeMount {
  render: (props: CollectionTreeProps) => void;
}

/** One React root on the pane for the life of the page. */
export function mountCollectionTree(host: HTMLElement): CollectionTreeMount {
  const root = createRoot(host);
  return {
    render(props) {
      flushSync(() => root.render(<CollectionTree {...props} />));
    },
  };
}
