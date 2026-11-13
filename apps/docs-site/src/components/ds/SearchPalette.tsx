// The Cmd+K search palette: the DS Combobox in inline mode (the list always open under the field), inside the DS
// Dialog `palette` that scripts/shell.ts opens. Each time it opens, the shell sends PALETTE_OPEN_EVENT on the dialog:
// the query clears, the index loads once (Bridge's /search-index.json, or a team's Library from the model its page
// already read) and the field takes focus. Enter or a click opens the highlighted result.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Combobox, Icon, Kbd, type ComboboxOption } from '@bridge-ds/react';
import { isDialogOpen } from '@bridge-ds/react/dom';
import { Search } from 'lucide-react';
import { siteIcon } from '../../brand/site-icons';
import { PALETTE_OPEN_EVENT, rankResults } from '../../lib/palette-search';
import type { SearchItem } from '../../lib/search';

const KIND_LABEL = { page: 'Page', component: 'Component', token: 'Token' } as const;
const KIND_ICON = { page: 'doc', component: 'diamonds', token: 'grid' } as const;

let index: Promise<SearchItem[]> | null = null;

/** The search index, read once per page. */
function loadSearchIndex(): Promise<SearchItem[]> {
  index ??= (async () => {
    try {
      if (document.documentElement.hasAttribute('data-library-shell')) {
        // A team's Library searches the team, from the model its page already read (no extra request, none to the
        // GitHub API for a reader who is signed out: scripts/team-data.ts reads the published snapshot).
        const [{ loadTeamData }, { librarySearchIndex }] = await Promise.all([import('../../scripts/team-data'), import('../../lib/library/search-index')]);
        const team = await loadTeamData();
        return librarySearchIndex(team.model, team.owner, team.repo);
      }
      const studio = document.documentElement.dataset.space === 'studio';
      if (studio && document.documentElement.hasAttribute('data-hosted')) {
        // A team's Studio searches the team: its components and tokens, opened in Studio, never Bridge's docs (A8).
        const [{ loadTeamData }, { studioSearchIndex }, { studioHref }] = await Promise.all([import('../../scripts/team-data'), import('../../lib/library/search-index'), import('../../lib/team-path')]);
        return studioSearchIndex((await loadTeamData()).model, studioHref);
      }
      const r = await fetch('/search-index.json');
      const all = (await r.json()) as SearchItem[];
      if (!studio) return all;
      // Bridge's own Studio: its components and tokens, without the documentation pages.
      const { studioOnly } = await import('../../lib/library/search-index');
      return studioOnly(all);
    } catch {
      return [];
    }
  })();
  return index;
}

/** One result as a Combobox option: the kind glyph (or a color token's own color), the title, its line, its kind. */
function toOption(item: SearchItem, i: number): ComboboxOption {
  return {
    value: `${i}:${item.href}`,
    label: item.title,
    description: item.meta,
    prefix: item.swatch ? (
      <span className="palette-kind kind-token has-swatch" style={{ '--sw': item.swatch } as CSSProperties} />
    ) : (
      <span className={`palette-kind kind-${item.kind}`}>
        <Icon icon={siteIcon(KIND_ICON[item.kind])} size="sm" />
      </span>
    ),
    suffix: KIND_LABEL[item.kind],
  };
}

/** Studio searches the team's design system only; the Library its pages too. */
const placeholderFor = (space: string | undefined) => (space === 'studio' ? 'Search tokens and components, or paste a hex' : 'Search tokens, components, pages, or paste a hex');

export default function SearchPalette() {
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(placeholderFor(undefined));
  useEffect(() => setPlaceholder(placeholderFor(document.documentElement.dataset.space)), []);
  const [data, setData] = useState<SearchItem[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (data ? rankResults(query, data) : []), [query, data]);
  const options = useMemo(() => results.map(toOption), [results]);

  useEffect(() => {
    const dialog = document.getElementById('palette');
    if (!dialog) return;
    const onOpen = () => {
      setQuery('');
      void loadSearchIndex().then(setData);
      requestAnimationFrame(() => input.current?.focus());
    };
    dialog.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    // Opened before this island woke up (a fast Cmd+K): catch up.
    if (isDialogOpen(dialog)) onOpen();
    return () => dialog.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
  }, []);

  // The count in the dialog's footer (a polite live region there).
  useEffect(() => {
    const count = document.getElementById('palette-count');
    if (count) count.textContent = query.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : '';
  }, [query, results.length]);

  const open = (value: string | string[] | null) => {
    const item = typeof value === 'string' ? results[Number(value.split(':')[0])] : undefined;
    if (item) window.location.href = item.href;
  };

  return (
    <Combobox
      ref={input}
      inline
      className="palette-results"
      size="lg"
      aria-label="Search"
      placeholder={placeholder}
      spellCheck={false}
      options={options}
      filter={null}
      value={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={open}
      loading={data === null}
      loadingMessage="Loading the search index"
      emptyMessage={query.trim() ? `Nothing matches "${query.trim()}". Try a token path like color.action, or a hex.` : 'Type to search.'}
      prefix={<Icon icon={Search} size="sm" />}
      suffix={<Kbd keys="Esc" size="sm" />}
    />
  );
}
