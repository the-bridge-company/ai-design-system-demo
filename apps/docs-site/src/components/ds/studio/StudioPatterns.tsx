// Studio > Patterns (lib/nav.ts STUDIO_PATTERNS_HREF): the patterns of the design system, from patterns/<id>.pattern.json
// (lib/library/patterns.ts, the Library's groups and order), in one DS Table under quiet group labels (Interactions,
// Actions; the group says the kind once, rows never repeat it). Each row: the pattern's name, what it is for, the
// components it uses (said once on the group row when every row of the group uses the same ones, lib/studio-patterns.ts
// sharedComponents; the rows' empty cells point to it for screen readers). For whoever decides on behavior requests (a
// reviewer of the library or a design lead, as Home's Decide rows), one more column: the changes asked on each pattern
// that wait for a decision (lib/studio-patterns.ts), each linked to its request page, and one quiet line under the
// table for proposals that are not patterns yet ("Asked, not patterns yet: Archive, Type to jump on Menu"). Nobody
// else sees either.
//
// On either host, a member who can write suggests (PatternDrawers.tsx): "Suggest a pattern" on the header's
// title line (or in the empty state, then the only one), and every row opens a drawer, like the Components drawer,
// with the pattern, its Library page and one way to suggest. A reader keeps the table as it is, names linked to the
// Library. Nothing a person proposes becomes a row: a pattern exists once a developer merged its file.
//
// Two hosts, the same body: Bridge's own Studio (pages/studio/patterns.astro, StudioPatterns below: the groups, the
// components and the request settings built at build time, who may write read in the browser from the session's access
// to this site's repository, as every self-hosted Studio page does) and a team's Studio (pages/team-shell/patterns.astro,
// TeamPatterns below, the team's model read in the browser). Signed out, both read only.
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Hand } from 'lucide-react';
import { Button, EmptyState, Link, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@bridge-ds/react';
import { BEHAVIOR_REQUEST_LABEL, readBehaviors } from '@bridge-ds/core';
import { TeamLoadError, TeamPageSkeleton, TeamSourceNote, useTeamData } from './TeamState';
import { HeaderActions } from './StudioHead';
import { leadNameOf } from './BehaviorRequestForm';
import RequestDecide from './RequestDecide';
import { PatternRowDrawer, requestHref, SuggestPatternDrawer, type Decider, type PatternSuggestContext } from './PatternDrawers';
import { askedNotPatterns, patternRequests, sharedComponents, studioPatternGroups, studioPatternsLead, type AskedProposal, type PatternRequest, type StudioPatternGroup } from '../../../lib/studio-patterns';
import { suggestPatternCopy } from '../../../lib/change-intent';
import { libraryPatterns, PATTERN_QUERY, PATTERNS_ROUTE } from '../../../lib/library/patterns';
import { libraryHref } from '../../../lib/library-shells';
import { setPageSummary } from '../../../lib/page-summary';
import type { BehaviorIssue } from '../../../lib/home-model';

// The session module, imported once for the page's hooks (the requests read and, on Bridge's own Studio, the access).
let sessionModule: Promise<typeof import('../../../scripts/github-session')> | null = null;
const githubSession = () => (sessionModule ??= import('../../../scripts/github-session'));

interface Asked {
  requests: Map<string, PatternRequest[]>;
  proposals: AskedProposal[];
  decider: Exclude<Decider, null>;
}

/**
 * The changes asked on each pattern and the proposals that are not patterns yet, read once for a viewer who decides
 * on them (null for anyone else, or until read). The same read as Home's Decide rows (scripts/home-data.ts): the open
 * `request: behavior` issues of the repository. `drop` forgets one the lead decided here.
 */
function usePatternRequests(groups: readonly StudioPatternGroup[], behaviorNames: ReadonlyMap<string, string>): { asked: Asked | null; drop: (n: number) => void } {
  const [asked, setAsked] = useState<Asked | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const [session, { loadTeams }, { viewerRole }, { viewerIsDesignLead }] = await Promise.all([githubSession(), import('../../../scripts/teams'), import('../../../scripts/needs-you'), import('../../../scripts/design-lead')]);
      const repo = session.readRepo();
      await session.resolveAccess(repo).catch(() => null);
      await loadTeams();
      const github = session.signedInWithGitHub() && viewerRole() === 'reviewer';
      if (!github && !viewerIsDesignLead()) return;
      const f = await session.ghGet<BehaviorIssue[]>(`/repos/${repo.owner}/${repo.repo}/issues?labels=${encodeURIComponent(BEHAVIOR_REQUEST_LABEL)}&state=open&per_page=50`);
      if (live) setAsked({ requests: patternRequests(f.data, groups), proposals: askedNotPatterns(f.data, groups, behaviorNames), decider: github ? 'github' : 'email' });
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [groups, behaviorNames]);
  const drop = useCallback(
    (n: number) =>
      setAsked((a) => (a ? { ...a, requests: new Map([...a.requests].map(([id, list]) => [id, list.filter((q) => q.number !== n)] as const)), proposals: a.proposals.filter((p) => p.number !== n) } : a)),
    [],
  );
  return { asked, drop };
}

/** How many changes wait for a decision across the patterns. */
const waitingCount = (requests: Map<string, PatternRequest[]> | null | undefined): number | null => (requests ? [...requests.values()].reduce((n, l) => n + l.length, 0) : null);

/** The team's one design lead by first name, for a viewer who can suggest (null until read, and when there is none). */
function useLead(repo: string | null): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!repo) return;
    let live = true;
    void leadNameOf(repo).then((n) => live && setName(n));
    return () => {
      live = false;
    };
  }, [repo]);
  return name;
}

export interface PatternsTableProps {
  groups: readonly StudioPatternGroup[];
  requests: Map<string, PatternRequest[]> | null;
  /** Opens a row's drawer; unset, each name links to its Library page (a reader). */
  onOpen?: ((id: string) => void) | undefined;
}

export function PatternsTable({ groups, requests, onOpen }: PatternsTableProps) {
  const uid = useId();
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
        // Every row uses the same components: the group row says them once, in their column; the rows leave it empty
        // and point to it (aria-describedby), so a screen reader on a row still hears them.
        const shared = sharedComponents(g);
        const sharedId = `${uid}-${g.kind}-uses`;
        return (
          <TableBody key={g.kind} data-spt-group={g.kind}>
            <TableRow className="spt-group">
              {shared ? (
                <>
                  <TableHead scope="rowgroup">{g.label}</TableHead>
                  <TableCell className="spt-col-uses spt-muted" data-spt-shared="" id={sharedId}>
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
                    {onOpen ? (
                      <Button variant="link" className="spt-open" aria-haspopup="dialog" onClick={() => onOpen(r.id)}>
                        {r.name}
                      </Button>
                    ) : (
                      <Link href={r.href}>{r.name}</Link>
                    )}
                    <span className="spt-purpose">{r.purpose}</span>
                  </TableCell>
                  <TableCell className="spt-col-uses spt-muted" {...(shared ? { 'aria-describedby': sharedId } : {})}>
                    {shared ? null : r.components.join(', ')}
                  </TableCell>
                  {asked && (
                    <TableCell className="spt-col-asked">
                      {list.length > 0 && (
                        <ul className="spt-asked">
                          {list.map((q) => (
                            <li key={q.number}>
                              <Link href={requestHref(q.number)}>{q.title}</Link>
                            </li>
                          ))}
                        </ul>
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

/** The lead's one quiet line: proposals that are not patterns yet, each linked to its request. */
export function AskedLine({ proposals }: { proposals: readonly AskedProposal[] }) {
  if (!proposals.length) return null;
  return (
    <p className="spt-asked-line" data-spt-asked="">
      <span className="spt-asked-label">Asked, not patterns yet:</span>{' '}
      {proposals.map((p, i) => (
        <Fragment key={p.number}>
          {i > 0 && ', '}
          <Link href={requestHref(p.number)}>{p.name}</Link>
        </Fragment>
      ))}
    </p>
  );
}

const NO_NAMES: ReadonlyMap<string, string> = new Map();

export interface PatternsBodyProps {
  groups: StudioPatternGroup[];
  /** A team's page: what a member needs to suggest. Unset (Bridge's own Studio), the page reads only. */
  suggest?: PatternSuggestContext | null | undefined;
}

/** The page body for any design system: the summary sentence, then the table, or the empty state. */
export function PatternsBody({ groups, suggest = null }: PatternsBodyProps) {
  // Behavior id -> its words in a component's docs.json, for the lead's "Type to jump on Menu".
  const behaviorNames = useMemo(() => (suggest ? new Map(suggest.components.flatMap((c) => c.behaviors.map((b) => [b.id, b.text] as const)).reverse()) : NO_NAMES), [suggest]);
  const { asked, drop } = usePatternRequests(groups, behaviorNames);
  const requests = asked?.requests ?? null;
  const waiting = waitingCount(requests);
  const proposals = asked?.proposals ?? [];
  useEffect(() => setPageSummary(studioPatternsLead(groups, waiting, proposals.length)), [groups, waiting, proposals.length]);
  const lead = useLead(suggest?.repo ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const rows = useMemo(() => groups.flatMap((g) => g.rows.map((r) => ({ row: r, kind: g.kind }))), [groups]);
  const interactions = useMemo(() => new Set(rows.filter((r) => r.kind === 'interaction').map((r) => r.row.id)), [rows]);
  const canSuggest = Boolean(suggest?.canEdit);
  // A row opens its drawer for whoever can act in it: a member who suggests, or the lead who decides.
  const drawers = Boolean(suggest && (canSuggest || asked));
  const open = rows.find((r) => r.row.id === openId) ?? null;
  const empty = !groups.some((g) => g.rows.length);
  const copy = suggestPatternCopy(lead);

  const suggestDrawer = suggest && canSuggest && (
    <SuggestPatternDrawer
      open={suggesting}
      suggest={suggest}
      lead={lead}
      rows={rows.map((r) => r.row)}
      interactions={interactions}
      onDuplicate={(id) => {
        setSuggesting(false);
        setOpenId(id);
      }}
      onClose={() => setSuggesting(false)}
    />
  );
  const openSuggest = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} aria-haspopup="dialog" onClick={() => setSuggesting(true)}>
      {copy.open}
    </Button>
  );

  if (empty)
    return (
      <>
        <EmptyState
          icon={Hand}
          headingLevel={2}
          align="start"
          title="No patterns yet"
          description={
            canSuggest
              ? copy.empty
              : 'A pattern is an interaction several components share, or an action people take across the product. Each one is a file in the patterns folder of the design system, and shows here and in the Library once it is there.'
          }
          // The empty state holds the only "Suggest a pattern": the header keeps none.
          actions={canSuggest ? openSuggest('primary') : undefined}
        />
        {asked && <AskedLine proposals={proposals} />}
        {asked && <RequestDecide />}
        {suggestDrawer}
      </>
    );
  return (
    <>
      {canSuggest && <HeaderActions>{openSuggest('secondary')}</HeaderActions>}
      <PatternsTable groups={groups} requests={requests} onOpen={drawers ? setOpenId : undefined} />
      {asked && <AskedLine proposals={proposals} />}
      {asked && <RequestDecide />}
      {drawers && (
        <PatternRowDrawer
          row={open?.row ?? null}
          kind={open?.kind ?? null}
          suggest={suggest}
          lead={lead}
          waiting={(open && requests?.get(open.row.id)) || []}
          decider={asked?.decider ?? null}
          onDecided={drop}
          onClose={() => setOpenId(null)}
        />
      )}
      {suggestDrawer}
    </>
  );
}

/** What Bridge's own Studio knows at build time to let a member suggest (the rest is read in the browser). */
export type SiteSuggest = Pick<PatternSuggestContext, 'integrations' | 'components'>;

/**
 * Bridge's own Studio: this site's repository and whether the viewer may write to it (the session's access, the same
 * rule as a team's canEdit: GitHub write access, or an email member who can edit), null signed out and until known.
 */
function useSiteSuggest(groups: readonly StudioPatternGroup[], site: SiteSuggest | undefined): PatternSuggestContext | null {
  const [seen, setSeen] = useState<{ repo: string; canEdit: boolean } | null>(null);
  useEffect(() => {
    if (!site) return;
    let live = true;
    void (async () => {
      const session = await githubSession();
      const r = session.readRepo();
      const repo = `${r.owner}/${r.repo}`;
      const paint = (a: { write: boolean } | null) => live && setSeen(a ? { repo, canEdit: a.write } : null);
      // Every later read (a sign-in, a sign-out) repaints; the first one is asked here.
      session.onAccess(paint);
      paint(await session.resolveAccess(r));
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [site]);
  return useMemo(() => {
    if (!site || !seen) return null;
    const hrefs = new Map(groups.flatMap((g) => g.rows.map((r) => [r.id, r.href] as const)));
    return { ...site, ...seen, pageUrl: (id) => new URL(hrefs.get(id) ?? '/', location.origin).href };
  }, [groups, site, seen]);
}

/** Bridge's own Studio: the groups as built; a member who can write suggests from here, as on a team. */
export default function StudioPatterns({ groups, site }: { groups: StudioPatternGroup[]; site?: SiteSuggest }) {
  const suggest = useSiteSuggest(groups, site);
  return <PatternsBody groups={groups} suggest={suggest} />;
}

/** A team's Studio: its patterns from its model, read in the browser; a member who can write suggests from here. */
export function TeamPatterns() {
  const { load, retry } = useTeamData();
  const data = load.status === 'ready' ? load.data : null;
  // The sample team's visitor explores as its people: the buttons show, and Send opens the sample-team dialog.
  const [sample, setSample] = useState(false);
  useEffect(() => {
    if (!data) return;
    let live = true;
    void import('../../../scripts/demo-gate').then((d) => live && setSample(d.sampleVisitor()));
    return () => {
      live = false;
    };
  }, [data]);
  const groups = useMemo(() => (data ? studioPatternGroups(libraryPatterns(data.model), (id) => libraryHref(data.owner, data.repo, `${PATTERNS_ROUTE}?${PATTERN_QUERY}=${encodeURIComponent(id)}`)) : []), [data]);
  const suggest = useMemo<PatternSuggestContext | null>(
    () =>
      data
        ? {
            repo: `${data.owner}/${data.repo}`,
            canEdit: Boolean(data.canEdit) || sample,
            integrations: data.model.site.integrations,
            components: (data.model.components?.list ?? []).map((c) => ({ name: c.name, behaviors: readBehaviors(c.docs?.behaviors).map((b) => ({ id: b.id, text: b.text })) })),
            pageUrl: (id) => new URL(libraryHref(data.owner, data.repo, `${PATTERNS_ROUTE}?${PATTERN_QUERY}=${encodeURIComponent(id)}`), location.origin).href,
          }
        : null,
    [data, sample],
  );
  // Loading and errors: the buttons wait until membership is known, so nothing flashes and disappears.
  if (load.status === 'loading') return <TeamPageSkeleton label="Reading the patterns" rows={4} />;
  if (load.status === 'error') return <TeamLoadError failure={load.failure} onRetry={retry} />;
  return (
    <>
      <TeamSourceNote data={load.data} refreshing={load.refreshing} onRefresh={retry} />
      <PatternsBody groups={groups} suggest={suggest} />
    </>
  );
}
