// Library > Patterns, for any repo model: the index (PatternsView) and one pattern (PatternView). Bridge's own pages
// (pages/patterns/) render them at build time, the pattern page as an island (its stage and its developer fold); a team's Library renders them in the
// browser (LibraryTeamPatterns.tsx). Data: lib/library/patterns.ts over patterns/<id>.pattern.json.
//   Index     one group per kind (Interactions, Actions), each pattern a card: its name and what it is for. A kind with
//             no pattern keeps its place (the nav's row lands on it): a small drawing and how one comes to exist, plus
//             for a member who can write a link to suggest one in Studio. No pattern at all: one empty state instead.
//   Pattern   what it is for, then the stage. An interaction: the components that do it, each in its own words, on the
//             stage. An action: the stage, the rules, the components it uses and where the product does it. A place in
//             a product of its own repository (usedIn[].product) says the product's name, and its file links there.
import type { ReactNode } from 'react';
import { Shapes } from 'lucide-react';
import { EmptyState, Link } from '@bridge-ds/react';
import { patternUseHref, patternUsePlace, type PatternKind, type PatternUse, type ProductConfig } from '@bridge-ds/core';
import { LibraryHeader } from '../FoundationParts';
import ActionStage from '../ActionStage';
import InteractionStage from '../InteractionStage';
import DevDetail from '../../DevDetail';
import ButtonLink from '../../ButtonLink';
import { Drawing } from '../../studio/Drawing';
import { PATTERN_KIND_EMPTY, PATTERN_KIND_SUGGEST, patternKindGroups, PATTERNS_EMPTY, patternsLead, type PatternEntry, type PatternGroup } from '../../../../lib/library/patterns';
import { componentHref, patternHref, type LibraryData } from '../library-data';
import { patternKindSection } from '../../../../lib/library-shells';
import '../../../../styles/patterns.css';

export const PATTERNS_PAGE = { title: 'Patterns', art: 'guide' } as const;
/** What the page holds, before anything is read and when there is no pattern yet (the empty state says the rest). */
export const PATTERNS_INTRO = 'Interactions several components share, and actions people take across the product.';

/** Pattern id -> its page in this Library. */
export const patternHrefs = (data: Pick<LibraryData, 'team'>, groups: readonly PatternGroup[]): Record<string, string> =>
  Object.fromEntries(groups.flatMap((g) => g.items).map((e) => [e.pattern.id, patternHref(data, e.pattern.id)]));

/** Component name -> its page (an action's components), or its Behaviors section (an interaction's). */
export function patternLinks(data: Pick<LibraryData, 'team' | 'model'>, entry: PatternEntry): Record<string, string> {
  const slugs = new Map((data.model.components?.list ?? []).map((c) => [c.name, c.slug]));
  const names = entry.kind === 'action' ? entry.pattern.components : entry.components.map((c) => c.component);
  return Object.fromEntries(names.flatMap((n) => (slugs.has(n) ? [[n, componentHref(data, slugs.get(n)!, entry.kind === 'interaction' ? '#behaviors' : '')]] : [])));
}

export interface PatternsViewProps {
  groups: PatternGroup[];
  hrefs: Record<string, string>;
  /**
   * Where a member who can write suggests a pattern in Studio, for a kind or (null) any: set only for them, readers and
   * visitors get no link.
   */
  suggestHref?: ((kind: PatternKind | null) => string) | undefined;
}

export function PatternsView({ groups, hrefs, suggestHref }: PatternsViewProps) {
  const empty = !groups.some((g) => g.items.length);
  return (
    <>
      <LibraryHeader title={PATTERNS_PAGE.title} art={PATTERNS_PAGE.art} canEdit={false}>
        <p>{empty ? PATTERNS_INTRO : patternsLead(groups)}</p>
      </LibraryHeader>
      {empty ? (
        <EmptyState
          icon={Shapes}
          headingLevel={2}
          title="No patterns yet"
          description={PATTERNS_EMPTY}
          actions={
            suggestHref ? (
              <ButtonLink variant="primary" href={suggestHref(null)}>
                Suggest a pattern
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        patternKindGroups(groups).map((g) => (
          // The nav's rows under Patterns (Interactions, Actions) open this page on these sections, empty or not.
          <section key={g.kind} aria-labelledby={patternKindSection(g.kind)} className="pt-group" data-pt-kind={g.kind}>
            <h2 id={patternKindSection(g.kind)}>{g.label}</h2>
            {g.items.length ? (
              <ul className="pt-cards">
                {g.items.map((e) => (
                  <li key={e.pattern.id} className="pt-card">
                    <h3>
                      <Link href={hrefs[e.pattern.id]}>{e.pattern.name}</Link>
                    </h3>
                    <p>{e.pattern.purpose}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pt-empty" data-pt-empty={g.kind}>
                <Drawing name="components" width={56} className="pt-empty-art" />
                <p className="t-ui t-muted">
                  {PATTERN_KIND_EMPTY[g.kind]}
                  {suggestHref && (
                    <>
                      {' '}
                      <Link href={suggestHref(g.kind)}>{PATTERN_KIND_SUGGEST[g.kind]}</Link>
                    </>
                  )}
                </p>
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}

/** The places of an action by the label people read there, in order of first appearance: [label, places]. */
export function placesByLabel<T extends { label: string }>(list: readonly T[]): [string, T[]][] {
  const by = new Map<string, T[]>();
  for (const u of list) (by.get(u.label) ?? by.set(u.label, []).get(u.label)!).push(u);
  return [...by.entries()];
}

/** The places of an action by label, screens only: [label, screens]. */
export const usedByLabel = (list: readonly { label: string; screen: string }[]): [string, string[]][] => placesByLabel(list).map(([label, places]) => [label, places.map((u) => u.screen)]);

/** The repository a Library shows: where its places' files are (the design system's own, or a product's). */
export interface PatternSite {
  owner: string;
  repo: string;
  defaultBranch?: string | undefined;
  products?: readonly ProductConfig[] | undefined;
}

/** A place as the page shows it: the product's name when it names one, and its file on GitHub when that is known. */
export function patternPlace(u: PatternUse, site: PatternSite | undefined): { productName: string | null; href: string | null } {
  if (!site) return { productName: u.product ?? null, href: null };
  const ctx = { products: site.products, designSystemRepo: site.owner && site.repo ? `${site.owner}/${site.repo}` : null, branch: site.defaultBranch };
  const { product } = patternUsePlace(u, ctx);
  return { productName: product?.name ?? u.product ?? null, href: patternUseHref(u, ctx) };
}

export interface PatternViewProps {
  entry: PatternEntry;
  /** Component name -> its Library page (an action) or its Behaviors section (an interaction). */
  links: Record<string, string>;
  /** True when the page runs the real components itself (Bridge's own Library). */
  live?: boolean;
  storybook?: string | undefined;
  /** Under an action's rules, for a member who can send requests: "Suggest a change to this pattern" (PatternChange). */
  ruleChange?: ReactNode;
  /** The repository and its products (model.site): a place's product name and its file's link on GitHub. */
  site?: PatternSite | undefined;
}

export function PatternView({ entry, links, live = false, storybook, ruleChange, site }: PatternViewProps) {
  const { pattern } = entry;
  return (
    <>
      <LibraryHeader title={pattern.name} canEdit={false}>
        <p>{pattern.purpose}</p>
      </LibraryHeader>
      {/* An interaction is its components, each on the stage ("Try it on the real Select"): the section says Components. */}
      <section aria-labelledby="pt-try" className="pt-section">
        <h2 id="pt-try">{entry.kind === 'interaction' ? 'Components' : 'Try it'}</h2>
        {entry.kind === 'interaction' ? <InteractionStage components={entry.components} links={links} live={live} storybook={storybook} /> : <ActionStage pattern={entry.pattern} />}
      </section>
      {entry.kind === 'action' && (
        <>
          <section aria-labelledby="pt-rules" className="pt-section">
            <h2 id="pt-rules">Rules</h2>
            <ul className="pt-rules">
              {entry.pattern.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {ruleChange && <div className="pt-change">{ruleChange}</div>}
          </section>
          <section aria-labelledby="pt-components" className="pt-section">
            <h2 id="pt-components">Components</h2>
            <ul className="pt-inline">
              {entry.pattern.components.map((c) => (
                <li key={c}>{links[c] ? <Link href={links[c]}>{c}</Link> : c}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pt-used" className="pt-section">
            <h2 id="pt-used">Used in</h2>
            {/* Each label once, with every screen that shows it. */}
            <dl className="pt-used">
              {placesByLabel(entry.pattern.usedIn).map(([label, places]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  {places.map((u) => {
                    const { productName } = patternPlace(u, site);
                    return <dd key={`${u.screen} ${u.product ?? ''}`}>{productName ? `${u.screen}, in ${productName}` : u.screen}</dd>;
                  })}
                </div>
              ))}
            </dl>
            <DevDetail id="pt-files" title="For developers: where each one is in the code">
              <ul className="pt-files">
                {entry.pattern.usedIn.map((u) => {
                  const { productName, href } = patternPlace(u, site);
                  const file = productName ? `${productName}: ${u.file}` : u.file;
                  return (
                    <li key={`${u.screen} ${u.product ?? ''} ${u.file}`} className="mono">
                      {href ? (
                        <Link href={href} external>
                          {file}
                        </Link>
                      ) : (
                        file
                      )}
                    </li>
                  );
                })}
              </ul>
            </DevDetail>
          </section>
        </>
      )}
    </>
  );
}
