// The search palette's field: a DS Input with the search icon before the value and the Esc hint after it, as a
// combobox over the results list (scripts/shell.ts drives the list, arrow keys and aria-activedescendant). A .tsx
// file because .astro markup cannot pass React elements as the Input's prefix and suffix. Rendered statically.
import { Icon, Input, Kbd } from '@bridge-ds/react';
import { Search } from 'lucide-react';

export default function PaletteField() {
  return (
    // bridge-audit-ignore-next-line: the search palette is the WAI-ARIA combobox with an always-open listbox inside a DS Dialog (ScriptDialog), filled by scripts/shell.ts from the static search index; the DS Combobox is a popup anchored to its input with no inline-list mode (Tier 2 request: a Command or inline-list Combobox)
    <Input
      id="palette-q"
      data-palette-q=""
      type="text"
      size="lg"
      aria-label="Search"
      placeholder="Search tokens, components, pages, or paste a hex"
      autoComplete="off"
      spellCheck={false}
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-autocomplete="list"
      prefix={<Icon icon={Search} size="sm" />}
      suffix={<Kbd keys="Esc" size="sm" />}
    />
  );
}
