// The header search of a team's Library (Cmd+K, scripts/shell.ts): its pages, every component and every token, from
// the model the page already read (no extra request). Same shape as Bridge's own /search-index.json, so the palette
// ranks and paints both the same way. Every string comes from a repository Bridge does not control: it reaches the
// page as text, and swatches go through safeSpecimenValue. Pure, browser-safe.
import type { RepoModel, TokenRow } from '@bridge-ds/core';
import { libraryHref, libraryTeamPages } from '../library-shells';
import type { SearchItem } from '../search';
import { teamComponentRows } from '../team-components';
import { safeSpecimenValue } from '../token-specimens';

type Tier = TokenRow['tier'] | 'primitive';

const TIER_LABEL: Record<Tier, string> = { semantic: 'Semantic', brand: 'Brand', density: 'Density', component: 'Component', primitive: 'Primitive' };
/** Tiers in reading order: what product code uses first, the raw palette last. */
const TIER_ORDER: Tier[] = ['semantic', 'component', 'brand', 'density', 'primitive'];

interface TokenHit {
  path: string;
  cssVar: string;
  tier: Tier;
  /** Values per theme (or one value for a primitive), with a swatch safe for an inline style or null. */
  values: { text: string; swatch: string | null }[];
}

const swatch = (type: string, css: string): string | null => (type === 'color' ? safeSpecimenValue(css) : null);

/** Every token, tier by tier (semantic first, primitives last). */
function tokenHits(model: Pick<RepoModel, 'tokens'>): TokenHit[] {
  const rows = model.tokens.rows;
  const roles: TokenHit[] = rows.all.map((t) => ({
    path: t.path,
    cssVar: t.cssVar,
    tier: t.tier,
    values: Object.values(t.densities && Object.keys(t.modes).length === 0 ? t.densities : t.modes).map((v) => ({ text: v.css, swatch: swatch(t.type, v.css) })),
  }));
  const prims: TokenHit[] = rows.primitives.map((p) => ({ path: p.path, cssVar: p.cssVar, tier: 'primitive', values: [{ text: p.css, swatch: swatch(p.type, p.css) }] }));
  const rank = (t: Tier) => TIER_ORDER.indexOf(t);
  return [...roles, ...prims].sort((a, b) => rank(a.tier) - rank(b.tier));
}

/** The team's components and tokens as search results, each linked by `component` and `token`. */
function designSystemItems(model: Pick<RepoModel, 'tokens' | 'components'>, link: { component: (slug: string) => string; token: (path: string) => string }): SearchItem[] {
  const components: SearchItem[] = teamComponentRows(model).map((c) => ({
    kind: 'component',
    title: c.name,
    href: link.component(c.slug),
    meta: c.summary ?? c.family,
    keys: `${c.slug} ${c.family}`,
  }));
  const tokens: SearchItem[] = tokenHits(model).map((r) => {
    const sw = r.values.find((v) => v.swatch)?.swatch ?? undefined;
    const values = r.values.map((v) => v.text);
    return {
      kind: 'token',
      title: r.path,
      href: link.token(r.path),
      meta: `${TIER_LABEL[r.tier]}, ${values.join(' / ')}`,
      keys: `${r.cssVar} ${values.join(' ')}`,
      ...(sw ? { swatch: sw } : {}),
    };
  });
  return [...components, ...tokens];
}

export function librarySearchIndex(model: Pick<RepoModel, 'tokens' | 'components'>, owner: string, repo: string): SearchItem[] {
  const href = (route: string) => libraryHref(owner, repo, route);
  const pages: SearchItem[] = libraryTeamPages().map((e) => ({ kind: 'page', title: e.label, href: href(e.route), meta: e.meta, keys: 'library' }));
  return [...pages, ...designSystemItems(model, { component: (slug) => href(`components/${encodeURIComponent(slug)}/`), token: (path) => href(`tokens/?t=${encodeURIComponent(path)}`) })];
}

/**
 * The header search of a team's Studio (A8): the team's own components and tokens, opened in Studio (the component's
 * drawer on Components, the token's drawer on Tokens), never Bridge's documentation pages. `studio` turns a Studio path
 * into the team's address (lib/team-path studioHref).
 */
export function studioSearchIndex(model: Pick<RepoModel, 'tokens' | 'components'>, studio: (path: string) => string): SearchItem[] {
  return designSystemItems(model, { component: (slug) => studio(`components/?c=${encodeURIComponent(slug)}`), token: (path) => studio(`tokens/?t=${encodeURIComponent(path)}`) });
}

/** Bridge's own search index, kept to what a Studio searches: components and tokens, no documentation pages. */
export const studioOnly = (items: readonly SearchItem[]): SearchItem[] => items.filter((i) => i.kind !== 'page');
