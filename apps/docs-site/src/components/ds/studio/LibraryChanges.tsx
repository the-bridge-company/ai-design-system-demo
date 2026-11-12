// The Library group of Changes (boards LI6 and LI7, decided 2026-11-09): it stays for everyone, designer, PM and
// lead, and every change in it says where it comes from (lib/library-origin): "Needed by <exploration> · <product>",
// the exploration one click away, or "From the DS lead · <reason>". A toolbar under the heading narrows it: All /
// From explorations / From the DS lead, with counts (?origin=). The design lead also groups it (?group=):
//   - By component (the default for a lead): one folded group per component, its summary on the trigger ("Card:
//     asked by 2 explorations, two different ways"). A conflict opens with Compare and pick (the conflict choice on
//     the exploration page); an exploration asking for what the lead already made opens with Approve, build once.
//     Single changes stay folded with their tag on the trigger; the lead's own changes that wait on nobody fold into
//     one last group (progressive disclosure: only what needs the lead is open).
//   - By exploration: one folded group per exploration that asked for library pieces, then the lead's own.
// Rows are the list's own rows (BranchRow), their status tag the exploration section's words (Needs Dana, Approved,
// Being built, Kept in this screen). Styles: styles/changes.css (bl-lib-*). A quiet "Open Library review" link under the
// heading opens the lead's own queue (pages/studio/library-review.astro), which takes this group's place later.
import { useState, type ReactNode } from 'react';
import { Accordion, AccordionItem, Badge, Icon, Link, SegmentedControl } from '@bridge-ds/react';
import { Library, Monitor, ShieldCheck } from 'lucide-react';
import ButtonLink from '../ButtonLink';
import {
  auditOriginLine,
  groupByComponent,
  groupByExploration,
  leadGroupingParam,
  libraryTag,
  originCounts,
  originFilterParam,
  ORIGIN_FILTER_LABEL,
  originLine,
  passesOrigin,
  withLeadGrouping,
  withOriginFilter,
  componentOf,
  type LeadGrouping,
  type LibraryGroup,
  type LibraryItem,
  type AuditOrigin,
  type ExplorationOrigin,
  type LibraryOrigin,
  type LibraryTag,
  type OriginFilter,
} from '../../../lib/library-origin';
import { statusTagClass } from '../../../lib/status-tag';
import { studioHref } from '../../../lib/team-path';
import { SEP } from '../../../lib/sep';

/** What a library row needs from the list's row. */
export interface LibraryRowFacts {
  key: string;
  title: string;
  origin: LibraryOrigin;
  statusKind: string | null;
  /** It waits on the viewer (lib/waiting-on, as Waiting on me): the only change tagged "Needs you". */
  turn?: boolean;
  draft: boolean;
  figmaComponent: string | null;
  /** The viewer made it. */
  mine: boolean;
}

export interface LibraryChangesProps<X> {
  /** The library group's heading (the product's name and its link), built by the list. */
  heading: ReactNode;
  rows: X[];
  facts: (x: X) => LibraryRowFacts;
  /** One row, as the list draws it, with the origin under its title and the library's status tag. */
  renderRow: (
    x: X,
    o: {
      note: ReactNode;
      pill: { label: string; tone: LibraryTag['tone'] } | null;
    }
  ) => ReactNode;
  /** The grid's card, when the list shows cards: no groups there. */
  renderCard?: ((x: X, o: { note: ReactNode; pill: { label: string; tone: LibraryTag['tone'] } | null }) => ReactNode) | null;
  lead: { you: boolean; name: string | null };
}

const setParam = (search: string) => {
  const url = new URL(location.href);
  url.search = search;
  history.replaceState(history.state, '', url);
};

/**
 * A change sent from a product's adoption report: "From the Acme CRM adoption report", the report as a link (it opens
 * inside Bridge). Being built and Changes rows say it under their title, like an exploration's "Needed by".
 */
export function AuditNote({ origin }: { origin: AuditOrigin }) {
  return (
    <span className="t-ui t-muted bl-origin">
      <Icon icon={ShieldCheck} size="xs" aria-hidden="true" />
      <span>
        {origin.href ? (
          <>
            From the <Link href={origin.href}>{origin.product ?? 'product'} adoption report</Link>
          </>
        ) : (
          auditOriginLine(origin)
        )}
      </span>
    </span>
  );
}

/** The origin under a row's title: the exploration as a link (opened in place), the adoption report, or the DS lead and why. */
export function OriginNote({ origin }: { origin: LibraryOrigin }) {
  if (origin.kind === 'audit') return <AuditNote origin={origin} />;
  if (origin.kind === 'exploration') {
    return (
      <span className="t-ui t-muted bl-origin">
        <Icon icon={Monitor} size="xs" aria-hidden="true" />
        <span>
          Needed by{' '}
          {origin.href ? (
            <Link href={origin.href} data-open-exploration={origin.number ?? undefined} {...(origin.productKey ? { 'data-product': origin.productKey } : {})}>
              {origin.name}
            </Link>
          ) : (
            origin.name
          )}
          {origin.product ? `${SEP}${origin.product}` : ''}
          {/* No link: its product is not one of the team's products any more. Said, so the plain name is not a dead end. */}
          {!origin.href && origin.product ? ', no longer in Studio' : ''}
        </span>
      </span>
    );
  }
  return (
    <span className="t-ui t-muted bl-origin">
      <Icon icon={Library} size="xs" aria-hidden="true" />
      <span>{originLine(origin)}</span>
    </span>
  );
}

export function LibraryChanges<X>(p: LibraryChangesProps<X>) {
  const [filter, setFilter] = useState<OriginFilter>(() => originFilterParam(location.search));
  const [grouping, setGrouping] = useState<LeadGrouping>(() => leadGroupingParam(location.search));
  // Groups the lead opened or folded; the others follow their default (open when a decision waits on the lead).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const items: LibraryItem<X>[] = p.rows.map((x) => {
    const f = p.facts(x);
    const kept = f.origin.kind === 'exploration' && f.origin.kept;
    return {
      key: f.key,
      title: f.title,
      origin: f.origin,
      component: componentOf({
        title: f.title,
        origin: f.origin,
        figmaComponent: f.figmaComponent,
      }),
      tag: libraryTag({ kind: f.statusKind, draft: f.draft, kept, turn: f.turn }, p.lead),
      mine: f.mine,
      row: x,
    };
  });
  const counts = originCounts(items.map((i) => i.origin));
  // A filter left on an empty side shows everything rather than nothing.
  const active: OriginFilter = counts[filter] > 0 ? filter : 'all';
  const shown = items.filter((i) => passesOrigin(i.origin, active));
  const cards = Boolean(p.renderCard);
  const grouped = p.lead.you && !cards;

  const pickFilter = (v: string) => {
    const f = (v === 'explorations' || v === 'lead' ? v : 'all') as OriginFilter;
    setFilter(f);
    setParam(withOriginFilter(location.search, f));
  };
  const pickGrouping = (v: string) => {
    const g: LeadGrouping = v === 'exploration' ? 'exploration' : 'component';
    setGrouping(g);
    setParam(withLeadGrouping(location.search, g));
  };

  const row = (i: LibraryItem<X>) =>
    p.renderRow(i.row, {
      note: <OriginNote origin={i.origin} />,
      pill: i.tag ? { label: i.tag.label, tone: i.tag.tone } : null,
    });

  const groups: LibraryGroup<X>[] = grouped ? (grouping === 'exploration' ? groupByExploration(shown, p.lead) : groupByComponent(shown, p.lead)) : [];
  const isOpen = (g: LibraryGroup<X>) => toggled[g.key] ?? g.open;
  const onOpen = (open: string[]) =>
    setToggled((t) => ({
      ...t,
      ...Object.fromEntries(groups.map((g) => [g.key, open.includes(g.key)])),
    }));

  // Opens the exploration in place (scripts/changes, scripts/team-branches read these attributes).
  const opens = (o: ExplorationOrigin) => ({ 'data-open-exploration': o.number ?? undefined, ...(o.productKey ? { 'data-product': o.productKey } : {}) });

  // The one action of a group, on its own line inside it, next to what it acts on.
  const action = (g: LibraryGroup<X>) => {
    const first = g.items.find((i) => i.origin.kind === 'exploration')?.origin;
    if (g.conflict && first?.kind === 'exploration' && first.href)
      return (
        <div className="bl-lib-act">
          <p className="t-ui">Two explorations ask for {g.label} in different ways. Pick one before either reaches the library.</p>
          <ButtonLink size="sm" variant="primary" href={first.href} {...opens(first)}>
            Compare and pick
          </ButtonLink>
        </div>
      );
    const once = g.buildOnce?.origin;
    if (once?.kind === 'exploration' && once.href)
      return (
        <div className="bl-lib-act">
          <p className="t-ui">
            {once.name} asks for what {p.lead.you ? 'you already made' : 'the library owners already made'}. <strong>Approve it and they share one build.</strong>
          </p>
          <ButtonLink size="sm" variant="primary" href={once.href} {...opens(once)}>
            Approve, build once
          </ButtonLink>
        </div>
      );
    return null;
  };

  // The trigger: the component (or exploration) on line 1, its summary and shared tag on line 2, like every row.
  const trigger = (g: LibraryGroup<X>) => (
    <span className="bl-lib-trigger">
      <span className="bl-lib-label">{g.label}</span>
      <span className="t-ui bl-lib-meta">
        <span className={g.conflict ? 'bl-lib-sum is-conflict' : 'bl-lib-sum'}>{g.summary}</span>
        {g.conflict ? (
          <Badge tone="danger" size="md">
            Two ways
          </Badge>
        ) : (
          g.tag && (
            <Badge tone={g.tag.tone} size="md" className={statusTagClass(g.tag.tone)}>
              {g.tag.label}
            </Badge>
          )
        )}
      </span>
    </span>
  );

  return (
    <section className="bl-group bl-lib" aria-labelledby="bl-library">
      <div className="bl-head">
        <h2 className="bl-h2" id="bl-library">
          {p.heading}
        </h2>
        <p className="t-ui t-muted bl-reach">
          What every product will get, and where each change comes from.{' '}
          {/* The lead's one queue for library pieces lives on its own page (lib/library-review); this group stays until it replaces it. */}
          <Link href={studioHref('library-review/')} data-keep-branch="">
            Open Library review
          </Link>
        </p>
      </div>
      {(counts.explorations > 0 && counts.lead > 0) || p.lead.you ? (
        <div className="bl-lib-bar">
          {counts.explorations > 0 && counts.lead > 0 && (
            <SegmentedControl
              size="sm"
              label="Where the changes come from"
              value={active}
              onValueChange={pickFilter}
              items={(['all', 'explorations', 'lead'] as const).map((f) => ({
                value: f,
                label: ORIGIN_FILTER_LABEL[f],
                count: counts[f],
              }))}
            />
          )}
          {grouped && (
            <SegmentedControl
              size="sm"
              className="bl-lib-group"
              label="Group the library changes"
              value={grouping}
              onValueChange={pickGrouping}
              items={[
                { value: 'component', label: 'By component' },
                { value: 'exploration', label: 'By exploration' },
              ]}
            />
          )}
        </div>
      ) : null}
      {cards ? (
        <ul className="sh-cards" aria-labelledby="bl-library">
          {shown.map((i) => p.renderCard!(i.row, { note: <OriginNote origin={i.origin} />, pill: i.tag ? { label: i.tag.label, tone: i.tag.tone } : null }))}
        </ul>
      ) : grouped ? (
        <Accordion
          multiple
          appearance="contained"
          headingLevel={3}
          className="bl-lib-groups"
          value={groups.filter(isOpen).map((g) => g.key)}
          onValueChange={onOpen}
        >
          {groups.map((g) => (
            <AccordionItem key={g.key} value={g.key} title={trigger(g)}>
              {g.conflict && action(g)}
              <ul className="sh-rows">{g.items.map(row)}</ul>
              {!g.conflict && action(g)}
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <ul className="sh-rows" aria-labelledby="bl-library">
          {shown.map(row)}
        </ul>
      )}
    </section>
  );
}
