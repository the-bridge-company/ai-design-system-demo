// Library > Patterns, for any repo model: the index (PatternsView) and one pattern (PatternView). Bridge's own pages
// (pages/patterns/) render them at build time, the pattern page as an island (its stage and its developer fold); a team's Library renders them in the
// browser (LibraryTeamPatterns.tsx). Data: lib/library/patterns.ts over patterns/<id>.pattern.json.
//   Index     one group per kind (Interactions, Actions), each pattern a card: its name and what it is for.
//   Pattern   what it is for, then the stage. An interaction: the components that do it, each in its own words, on the
//             stage. An action: the stage, the rules, the components it uses and where the product does it.
import type { ReactNode } from 'react';
import { Link } from '@bridge-ds/react';
import { LibraryHeader } from '../FoundationParts';
import ActionStage from '../ActionStage';
import InteractionStage from '../InteractionStage';
import DevDetail from '../../DevDetail';
import { patternsLead, type PatternEntry, type PatternGroup } from '../../../../lib/library/patterns';
import { componentHref, patternHref, type LibraryData } from '../library-data';
import { patternKindSection } from '../../../../lib/library-shells';
import '../../../../styles/patterns.css';

export const PATTERNS_PAGE = { title: 'Patterns', art: 'guide' } as const;

/** Pattern id -> its page in this Library. */
export const patternHrefs = (data: Pick<LibraryData, 'team'>, groups: readonly PatternGroup[]): Record<string, string> =>
  Object.fromEntries(groups.flatMap((g) => g.items).map((e) => [e.pattern.id, patternHref(data, e.pattern.id)]));

/** Component name -> its page (an action's components), or its Behaviors section (an interaction's). */
export function patternLinks(data: Pick<LibraryData, 'team' | 'model'>, entry: PatternEntry): Record<string, string> {
  const slugs = new Map((data.model.components?.list ?? []).map((c) => [c.name, c.slug]));
  const names = entry.kind === 'action' ? entry.pattern.components : entry.components.map((c) => c.component);
  return Object.fromEntries(names.flatMap((n) => (slugs.has(n) ? [[n, componentHref(data, slugs.get(n)!, entry.kind === 'interaction' ? '#behaviors' : '')]] : [])));
}

export function PatternsView({ groups, hrefs }: { groups: PatternGroup[]; hrefs: Record<string, string> }) {
  return (
    <>
      <LibraryHeader title={PATTERNS_PAGE.title} art={PATTERNS_PAGE.art} canEdit={false}>
        <p>{patternsLead(groups)}</p>
      </LibraryHeader>
      {groups.map((g) => (
        // The nav's rows under Patterns (Interactions, Actions) open this page on these sections.
        <section key={g.kind} aria-labelledby={patternKindSection(g.kind)} className="pt-group">
          <h2 id={patternKindSection(g.kind)}>{g.label}</h2>
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
        </section>
      ))}
    </>
  );
}

/** The places of an action by the label people read there, in order of first appearance: [label, screens]. */
export function usedByLabel(list: readonly { label: string; screen: string }[]): [string, string[]][] {
  const by = new Map<string, string[]>();
  for (const u of list) (by.get(u.label) ?? by.set(u.label, []).get(u.label)!).push(u.screen);
  return [...by.entries()];
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
}

export function PatternView({ entry, links, live = false, storybook, ruleChange }: PatternViewProps) {
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
              {usedByLabel(entry.pattern.usedIn).map(([label, screens]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  {screens.map((sc) => (
                    <dd key={sc}>{sc}</dd>
                  ))}
                </div>
              ))}
            </dl>
            <DevDetail id="pt-files" title="For developers: where each one is in the code">
              <ul className="pt-files">
                {entry.pattern.usedIn.map((u) => (
                  <li key={`${u.screen} ${u.file}`} className="mono">
                    {u.file}
                  </li>
                ))}
              </ul>
            </DevDetail>
          </section>
        </>
      )}
    </>
  );
}
