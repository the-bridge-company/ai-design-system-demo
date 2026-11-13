// The Cmd+K search palette: the DS Combobox in inline mode (the list always open under the field), inside the DS
// Dialog `palette` that scripts/shell.ts opens. Each time it opens, the shell sends PALETTE_OPEN_EVENT on the dialog:
// the query clears, the index loads once and the field takes focus. Enter or a click opens the highlighted result.
//   - Bridge's Library: /search-index.json. A team's Library: its pages, components and tokens, from the model its
//     page already read.
//   - A Studio (a team's, or Bridge's own): what the page holds at once (components, tokens, products, Studio's pages),
//     then what Studio's pages read from GitHub (explorations, Library review pieces, build requests) while a loading
//     row says so (scripts/studio-search.ts). Results are grouped by kind (lib/studio-search STUDIO_KIND_ORDER).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Combobox, Icon, Kbd, type ComboboxOption } from '@bridge-ds/react';
import { isDialogOpen } from '@bridge-ds/react/dom';
import { Search, type LucideIcon } from 'lucide-react';
import { siteIcon } from '../../brand/site-icons';
import { PALETTE_OPEN_EVENT, rankGrouped, rankResults } from '../../lib/palette-search';
import type { SearchItem, SearchKind } from '../../lib/search';
import { GROUP_LABEL, STUDIO_KIND_ORDER } from '../../lib/studio-search';
import { PRODUCT_ICON } from './studio/ProductMark';

const KIND_LABEL: Record<SearchKind, string> = { page: 'Page', component: 'Component', token: 'Token', exploration: 'Exploration', piece: 'Library piece', request: 'Build request', product: 'Product' };
/** The same glyph as the side nav entry each kind lives under. */
const KIND_ICON: Record<SearchKind, LucideIcon> = {
  page: siteIcon('doc'),
  component: siteIcon('diamonds'),
  token: siteIcon('grid'),
  exploration: siteIcon('branch'),
  piece: siteIcon('review'),
  request: siteIcon('wrench'),
  product: PRODUCT_ICON,
};

const isStudio = () => document.documentElement.dataset.space === 'studio' && !document.documentElement.hasAttribute('data-no-repo');

let studioModule: Promise<typeof import('../../scripts/studio-search')> | null = null;
/** Studio's reads (scripts/studio-search.ts), loaded once. */
const studioSearch = () => (studioModule ??= import('../../scripts/studio-search'));

let index: Promise<SearchItem[]> | null = null;
let live: Promise<SearchItem[]> | null = null;

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
      // A Studio searches its own team (A8): never Bridge's documentation pages.
      if (isStudio()) return await (await studioSearch()).loadStudioLocal();
      const r = await fetch('/search-index.json');
      return (await r.json()) as SearchItem[];
    } catch {
      return [];
    }
  })();
  return index;
}

/** What a Studio reads from GitHub for the search, once per page; nothing elsewhere. */
function loadLiveIndex(): Promise<SearchItem[]> {
  live ??= isStudio()
    ? studioSearch().then(
        (m) => m.loadStudioLive(),
        () => [],
      )
    : Promise.resolve([]);
  return live;
}

/** One result as a Combobox option: the kind glyph (or a color token's own color), the title, its line, its kind. */
function toOption(item: SearchItem, i: number, grouped: boolean): ComboboxOption {
  return {
    value: `${i}:${item.href}`,
    label: item.title,
    description: item.meta,
    prefix: item.swatch ? (
      <span className="palette-kind kind-token has-swatch" style={{ '--sw': item.swatch } as CSSProperties} />
    ) : (
      <span className={`palette-kind kind-${item.kind}`}>
        <Icon icon={KIND_ICON[item.kind]} size="sm" />
      </span>
    ),
    // Grouped, the group's heading names the kind once; the row does not say it again.
    ...(grouped ? { group: GROUP_LABEL[item.kind] } : { suffix: KIND_LABEL[item.kind] }),
  };
}

/** Studio names its main kinds (as its header button does, layouts/Layout.astro); the Library its pages too. */
export const placeholderFor = (space: string | undefined) => (space === 'studio' ? 'Search explorations, components, tokens' : 'Search tokens, components, pages, or paste a hex');

export default function SearchPalette() {
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(placeholderFor(undefined));
  useEffect(() => setPlaceholder(placeholderFor(document.documentElement.dataset.space)), []);
  const [data, setData] = useState<SearchItem[] | null>(null);
  const [extra, setExtra] = useState<SearchItem[] | null>(null);
  const [grouped, setGrouped] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // What GitHub answers comes first in Studio's order (explorations lead), the page's own after it.
  const all = useMemo(() => (data ? [...(extra ?? []), ...data] : null), [data, extra]);
  const results = useMemo(() => (all ? (grouped ? rankGrouped(query, all, STUDIO_KIND_ORDER) : rankResults(query, all)) : []), [query, all, grouped]);
  const options = useMemo(() => results.map((r, i) => toOption(r, i, grouped)), [results, grouped]);

  useEffect(() => {
    const dialog = document.getElementById('palette');
    if (!dialog) return;
    const onOpen = () => {
      setQuery('');
      setGrouped(isStudio());
      void loadSearchIndex().then(setData);
      void loadLiveIndex().then(setExtra);
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
      loading={data === null || extra === null}
      loadingMessage={data === null ? 'Loading the search index' : 'Reading explorations, reviews and build requests'}
      emptyMessage={query.trim() ? `Nothing matches "${query.trim()}". ${grouped ? 'Try an exploration, a component or a token path like color.action.' : 'Try a token path like color.action, or a hex.'}` : 'Type to search.'}
      prefix={<Icon icon={Search} size="sm" />}
      suffix={<Kbd keys="Esc" size="sm" />}
    />
  );
}
