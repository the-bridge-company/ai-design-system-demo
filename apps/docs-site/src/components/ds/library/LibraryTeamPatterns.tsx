// A team's Library, Patterns (src/pages/library-shell/patterns/): the same views as Bridge's own pages
// (views/PatternsView.tsx), fed with the team's model read in the browser (scripts/team-data.ts). One shell for both:
//   /library/<owner>/<repo>/patterns/          the index, by kind
//   /library/<owner>/<repo>/patterns/?p=<id>   one pattern (a team's patterns are only known once its data is read)
// An interaction's stage is each component's first story from the team's Storybook (bridge.config.json storybook.url).
import { useEffect, useMemo } from 'react';
import { Shapes } from 'lucide-react';
import { EmptyState } from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { LibraryPage, LibrarySourceNote, LibraryZone } from './LibraryState';
import { studioLink, teamLibraryData } from './library-data';
import PatternChange from './PatternChange';
import { PATTERNS_PAGE, PatternsView, PatternView, patternHrefs, patternLinks } from './views/PatternsView';
import { libraryPatterns, patternById, PATTERN_QUERY, PATTERNS_ROUTE } from '../../../lib/library/patterns';
import { httpsStorybook } from '../../../lib/team-components';
import { libraryHref } from '../../../lib/library-shells';
import { resetTeamData, type TeamData } from '../../../scripts/team-data';
import '../../../styles/component.css';
import '../../../styles/library.css';

const reload = () => {
  resetTeamData();
  location.reload();
};

/** The pattern in the address (?p=<id>), or null on the index. */
const patternInAddress = (): string | null => {
  const id = new URLSearchParams(location.search).get(PATTERN_QUERY);
  return id && /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null;
};

function Ready({ data, refreshing }: { data: TeamData; refreshing: boolean }) {
  const view = teamLibraryData(data);
  const groups = useMemo(() => libraryPatterns(data.model), [data.model]);
  const id = useMemo(patternInAddress, []);
  const entry = id ? patternById(groups, id) : undefined;
  const all = libraryHref(data.owner, data.repo, PATTERNS_ROUTE);
  useEffect(() => {
    if (entry) document.title = document.title.replace(/^[^|]*\|/, `${entry.pattern.name} |`);
    void import('../../../scripts/shell').then((shell) => shell.initToc());
    // The nav's rows by kind (#pt-interaction, #pt-action) land here before the sections exist: go to it once drawn.
    if (!id && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [entry, id]);
  const source = <LibrarySourceNote data={data} refreshing={refreshing} onRefresh={reload} />;

  if (!id) {
    return (
      <>
        {groups.length ? (
          <PatternsView groups={groups} hrefs={patternHrefs(view, groups)} />
        ) : (
          <EmptyState icon={Shapes} headingLevel={2} title="No patterns yet" description="Patterns come from the patterns folder of the design system's repository." />
        )}
        {source}
      </>
    );
  }
  if (!entry) {
    return (
      <>
        <EmptyState
          icon={Shapes}
          headingLevel={2}
          title={`No pattern named "${id}"`}
          description="It may have been renamed or removed from the repository."
          actions={
            <ButtonLink variant="primary" href={all}>
              See every pattern
            </ButtonLink>
          }
        />
        {source}
      </>
    );
  }
  return (
    <>
      {/* No breadcrumb: the nav's Patterns entry is current, and the title says the pattern once. */}
      <PatternView
        entry={entry}
        links={patternLinks(view, entry)}
        storybook={httpsStorybook(data.storybook)}
        site={data.model.site}
        ruleChange={
          // Only a member who can write sends requests (the gate of Edit on a component page); readers never see it.
          entry.kind === 'action' && data.canEdit ? (
            <PatternChange
              pattern={entry.pattern}
              owner={data.owner}
              repo={data.repo}
              integrations={data.model.site.integrations}
              pageUrl={new URL(`${all}?${PATTERN_QUERY}=${encodeURIComponent(entry.pattern.id)}`, location.origin).href}
              requestHref={(n) => studioLink(view, `explorations/?request=${n}`)}
            />
          ) : undefined
        }
      />
      {source}
    </>
  );
}

export default function LibraryTeamPatterns() {
  return (
    <LibraryPage
      label="Reading the patterns"
      header={(data) => (data || patternInAddress() ? null : <LibraryZone title={PATTERNS_PAGE.title} art={PATTERNS_PAGE.art} lead="Interactions several components share, and actions people take across the product." />)}
      ready={(data, r) => <Ready data={data} refreshing={r.refreshing} />}
    />
  );
}
