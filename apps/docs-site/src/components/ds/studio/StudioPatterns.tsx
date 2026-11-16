// Studio > Patterns (lib/nav.ts STUDIO_PATTERNS_HREF): the patterns of the design system, from patterns/<id>.pattern.json
// (lib/library/patterns.ts, the Library's groups and order), in one DS Table under quiet group labels (Interactions,
// Actions; the group says the kind once, rows never repeat it). Each row: the pattern's name, linked to its Library page,
// what it is for, the components it uses (said once on the group row when every row of the group uses the same ones,
// lib/studio-patterns.ts sharedComponents). For whoever decides on behavior requests (a reviewer of the library or a
// design lead, as Home's Decide rows), one more column: the changes asked on each pattern that wait for a decision
// (lib/studio-patterns.ts), each linked to its request page. Nobody else sees the column.
//
// Two hosts: Bridge's own Studio (pages/studio/patterns.astro, groups built at build time) and a team's Studio
// (pages/team-shell/patterns.astro, TeamPatterns below, the team's model read in the browser).
import { useEffect, useMemo, useState } from 'react';
import { Hand } from 'lucide-react';
import { EmptyState, Link, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@bridge-ds/react';
import { BEHAVIOR_REQUEST_LABEL } from '@bridge-ds/core';
import { TeamLoadError, TeamPageSkeleton, TeamSourceNote, useTeamData } from './TeamState';
import { patternRequests, sharedComponents, studioPatternGroups, studioPatternsLead, type PatternRequest, type StudioPatternGroup } from '../../../lib/studio-patterns';
import { libraryPatterns, PATTERN_QUERY, PATTERNS_ROUTE } from '../../../lib/library/patterns';
import { libraryHref } from '../../../lib/library-shells';
import { setPageSummary } from '../../../lib/page-summary';
import { studioHref } from '../../../lib/team-path';
import type { BehaviorIssue } from '../../../lib/home-model';

/**
 * The changes asked on each pattern, read once for a viewer who decides on them (null for anyone else, or until read).
 * The same read as Home's Decide rows (scripts/home-data.ts): the open `request: behavior` issues of the repository.
 */
function usePatternRequests(groups: readonly StudioPatternGroup[]): Map<string, PatternRequest[]> | null {
  const [requests, setRequests] = useState<Map<string, PatternRequest[]> | null>(null);
  useEffect(() => {
    if (!groups.some((g) => g.rows.length)) return;
    let live = true;
    void (async () => {
      const [session, { loadTeams }, { viewerRole }, { viewerIsDesignLead }] = await Promise.all([import('../../../scripts/github-session'), import('../../../scripts/teams'), import('../../../scripts/needs-you'), import('../../../scripts/design-lead')]);
      const repo = session.readRepo();
      await session.resolveAccess(repo).catch(() => null);
      await loadTeams();
      if (viewerRole() !== 'reviewer' && !viewerIsDesignLead()) return;
      const f = await session.ghGet<BehaviorIssue[]>(`/repos/${repo.owner}/${repo.repo}/issues?labels=${encodeURIComponent(BEHAVIOR_REQUEST_LABEL)}&state=open&per_page=50`);
      if (live) setRequests(patternRequests(f.data, groups));
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [groups]);
  return requests;
}

/** How many changes wait for a decision across the patterns. */
const waitingCount = (requests: Map<string, PatternRequest[]> | null): number | null => (requests ? [...requests.values()].reduce((n, l) => n + l.length, 0) : null);

export function PatternsTable({ groups, requests }: { groups: readonly StudioPatternGroup[]; requests: Map<string, PatternRequest[]> | null }) {
  // The column shows only when something waits: an empty column would say nothing to act on.
  const asked = Boolean(waitingCount(requests));
  const cols = asked ? 3 : 2;
  return (
    <Table aria-label="Patterns by kind" className="spt-table" data-spt-table="">
      <TableHeader>
        <TableRow>
          <TableHead>Pattern</TableHead>
          <TableHead className="spt-col-uses">Components</TableHead>
          {asked && <TableHead className="spt-col-asked">Waiting for your decision</TableHead>}
        </TableRow>
      </TableHeader>
      {groups.map((g) => {
        // Every row uses the same components: the group row says them once, in their column; the rows leave it empty.
        const shared = sharedComponents(g);
        return (
          <TableBody key={g.kind} data-spt-group={g.kind}>
            <TableRow className="spt-group">
              {shared ? (
                <>
                  <TableHead scope="rowgroup">{g.label}</TableHead>
                  <TableCell className="spt-col-uses spt-muted" data-spt-shared="">
                    {shared.join(', ')}
                  </TableCell>
                  {asked && <TableCell className="spt-col-asked" />}
                </>
              ) : (
                <TableHead scope="rowgroup" colSpan={cols}>
                  {g.label}
                </TableHead>
              )}
            </TableRow>
            {g.rows.map((r) => {
              const list = requests?.get(r.id) ?? [];
              return (
                <TableRow key={r.id} data-spt-row={r.id}>
                  <TableCell role="rowheader" className="spt-name">
                    <Link href={r.href}>{r.name}</Link>
                    <span className="spt-purpose">{r.purpose}</span>
                  </TableCell>
                  <TableCell className="spt-col-uses spt-muted">{shared ? null : r.components.join(', ')}</TableCell>
                  {asked && (
                    <TableCell className="spt-col-asked">
                      {list.length > 0 && (
                        <>
                          <ul className="spt-asked">
                            {list.map((q) => (
                              <li key={q.number}>
                                <Link href={studioHref(`explorations/?request=${q.number}`)}>{q.title}</Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        );
      })}
    </Table>
  );
}

/** The page body for any design system: the summary sentence, then the table, or the empty state. */
export function PatternsBody({ groups }: { groups: StudioPatternGroup[] }) {
  const requests = usePatternRequests(groups);
  const waiting = waitingCount(requests);
  useEffect(() => setPageSummary(studioPatternsLead(groups, waiting)), [groups, waiting]);
  if (!groups.some((g) => g.rows.length))
    return (
      <EmptyState
        icon={Hand}
        headingLevel={2}
        align="start"
        title="No patterns yet"
        description="A pattern is an interaction several components share, or an action people take across the product. Each one is a file in the patterns folder of the design system, and shows here and in the Library once it is there."
      />
    );
  return <PatternsTable groups={groups} requests={requests} />;
}

/** Bridge's own Studio: the groups as built. */
export default function StudioPatterns({ groups }: { groups: StudioPatternGroup[] }) {
  return <PatternsBody groups={groups} />;
}

/** A team's Studio: its patterns from its model, read in the browser; each row opens the team's Library page. */
export function TeamPatterns() {
  const { load, retry } = useTeamData();
  const data = load.status === 'ready' ? load.data : null;
  const groups = useMemo(() => (data ? studioPatternGroups(libraryPatterns(data.model), (id) => libraryHref(data.owner, data.repo, `${PATTERNS_ROUTE}?${PATTERN_QUERY}=${encodeURIComponent(id)}`)) : []), [data]);
  if (load.status === 'loading') return <TeamPageSkeleton label="Reading the patterns" rows={4} />;
  if (load.status === 'error') return <TeamLoadError failure={load.failure} onRetry={retry} />;
  return (
    <>
      <TeamSourceNote data={load.data} refreshing={load.refreshing} onRefresh={retry} />
      <PatternsBody groups={groups} />
    </>
  );
}
