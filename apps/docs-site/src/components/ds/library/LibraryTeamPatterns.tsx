// A team's Library, Patterns (src/pages/library-shell/patterns/): the same views as Bridge's own pages
// (views/PatternsView.tsx), fed with the team's model read in the browser (scripts/team-data.ts):
//   /library/<owner>/<repo>/patterns/interactions/   Patterns > Interactions (and actions/: Patterns > Actions)
//   /library/<owner>/<repo>/patterns/?p=<id>         one pattern (a team's patterns are only known once its data is read)
//   /library/<owner>/<repo>/patterns/                the old index: sends to Interactions
// An interaction's stage is each component's first story from the team's Storybook (bridge.config.json storybook.url).
import { useEffect, useMemo } from 'react';
import { Shapes } from 'lucide-react';
import { EmptyState } from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { LibraryPage, LibrarySourceNote, LibraryZone } from './LibraryState';
import { patternKindHref, studioLink, teamLibraryData } from './library-data';
import PatternChange from './PatternChange';
import { PATTERNS_ART, PatternKindView, PatternView, patternHrefs, patternLinks } from './views/PatternsView';
import { libraryPatterns, patternById, PATTERN_KIND_INTRO, PATTERN_KIND_ROUTE, patternKindGroup, PATTERN_QUERY, PATTERNS_ROUTE } from '../../../lib/library/patterns';
import { PATTERN_KIND_LABEL, type PatternKind } from '@bridge-ds/core';
import { httpsStorybook } from '../../../lib/team-components';
import { libraryHref } from '../../../lib/library-shells';
import { suggestPatternRoute } from '../../../lib/studio-patterns';
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

function Ready({ data, refreshing, kind }: { data: TeamData; refreshing: boolean; kind: PatternKind | null }) {
  const view = teamLibraryData(data);
  const groups = useMemo(() => libraryPatterns(data.model), [data.model]);
  const id = useMemo(patternInAddress, []);
  const entry = id ? patternById(groups, id) : undefined;
  const all = libraryHref(data.owner, data.repo, PATTERNS_ROUTE);
  useEffect(() => {
    if (entry) document.title = document.title.replace(/^[^|]*\|/, `${entry.pattern.name} |`);
    void import('../../../scripts/shell').then((shell) => shell.initToc());
  }, [entry]);
  const source = <LibrarySourceNote data={data} refreshing={refreshing} onRefresh={reload} />;

  if (kind) {
    return (
      <>
        <PatternKindView
          group={patternKindGroup(groups, kind)}
          hrefs={patternHrefs(view, groups)}
          // Only a member who can write suggests (the gate of Edit on a component page); readers and visitors get no link.
          suggestHref={data.canEdit ? (k) => studioLink(view, suggestPatternRoute(k)) : undefined}
        />
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
            <ButtonLink variant="primary" href={patternKindHref(view, 'interaction')}>
              See the interactions
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

/**
 * `kind`: the shell of Patterns > Interactions or Patterns > Actions. Unset, the pattern shell (?p=<id>); with no pattern
 * in the address it is the old index, which sends to Interactions (as Bridge's own /patterns/ does).
 */
export default function LibraryTeamPatterns({ kind = null }: { kind?: PatternKind | null }) {
  const old = !kind && typeof location !== 'undefined' && !patternInAddress();
  useEffect(() => {
    if (!old) return;
    // A link to the old index's Actions section (#pt-action) still lands on Actions.
    const to = location.hash === '#pt-action' ? PATTERN_KIND_ROUTE.action : PATTERN_KIND_ROUTE.interaction;
    location.replace(`${location.pathname.replace(/\/?$/, '/')}${to.slice(PATTERNS_ROUTE.length)}`);
  }, [old]);
  if (old) return null;
  return (
    <LibraryPage
      label="Reading the patterns"
      header={(data) => (data || !kind ? null : <LibraryZone title={PATTERN_KIND_LABEL[kind]} art={PATTERNS_ART} lead={PATTERN_KIND_INTRO[kind]} />)}
      ready={(data, r) => <Ready data={data} refreshing={r.refreshing} kind={kind} />}
    />
  );
}
