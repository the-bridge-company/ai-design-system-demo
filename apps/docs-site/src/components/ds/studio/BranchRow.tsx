// One branch row, the same everywhere a branch is listed (Studio home Needs you, the review queue, Branches): the
// before/after thumbnail, who, then two fixed lines so every row aligns: line 1 the title alone, on one line with an
// ellipsis (the full title in its title attribute; the link covers the whole card); line 2 an optional Jira key in
// mono, the muted sentence and the status pill right after it (proximity). Then an optional end slot (a row button,
// or how far main moved on with "Update from main"). `lead` holds a control before the thumbnail (Branches: the checkbox to
// preview token branches together); controls inside the card stay clickable above the covering link (DS Card).
// Styles: styles/studio-home.css (sh-row-*).
import type { MouseEvent, ReactNode } from 'react';
import { Badge, Card, CardBody, Link } from '@bridge-ds/react';
import { BranchThumb } from './BranchThumb';
import { SEP, type PillTone } from '../../../lib/home-model';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import { statusTagClass } from '../../../lib/status-tag';

const TONE = { warning: 'warning', danger: 'danger', success: 'success', neutral: 'neutral', info: 'info' } as const;

export interface BranchRowProps {
  thumb: ThumbSpec;
  /** The avatar (or an icon for rows without a person). Decorative: the line names the person. */
  who: ReactNode;
  title: string;
  /** The title attribute of the row's link (its hover text) when the title alone does not say what the row is. */
  hint?: string;
  href: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Extra attributes on the title link (data-open-pr for the in-place branch review). */
  linkAttributes?: Record<string, string | number | undefined>;
  selected?: boolean;
  /** Jira ticket key, after the title in mono. */
  jira?: string | null;
  /** Line 2, before the pill: who, or why it waits. */
  line?: string | null;
  pill?: { label: string; tone: PillTone | 'info' } | null;
  lead?: ReactNode;
  end?: ReactNode;
  className?: string;
  /**
   * One line (the home's Needs you, boards D20 and D1b): the title, then " · " and the line, muted, on the same line;
   * `tags` and the pill on the right, before `end`. Default: the two lines every other list uses.
   */
  compact?: boolean;
  /** Chips before the pill ("Sample" on the demo). */
  tags?: ReactNode;
  /** Two-line rows: after the line, before the tags (a library change's origin, with its exploration link). */
  note?: ReactNode;
  /** Two-line rows: a line above the title ("Your turn" on Explorations). */
  eyebrow?: ReactNode;
  /** Two-line rows: before the line, shown on phones only where the avatar column hides (a small face). */
  lineLead?: ReactNode;
  /** Compact rows only: a second muted line under the title (a join request's email and role). */
  detail?: string | null;
  /**
   * Two-line rows: the tags and the status tag at the row's end, in one column every row shares (before `end`), instead
   * of after the line. Full-width lists (Explorations, Being built) use it: the status column fills the row's right
   * side, where a tag right after a short line left half the row empty.
   */
  statusAtEnd?: boolean;
  /** With `statusAtEnd`: a muted second line under the status tag, who or what the row waits on. */
  statusNote?: string | null;
}

export function BranchRow({ thumb, who, title, hint, href, onClick, linkAttributes, selected, jira, line, pill, lead, end, className, compact, tags, detail, note, eyebrow, lineLead, statusAtEnd, statusNote }: BranchRowProps) {
  const chip = pill && (
    <Badge tone={TONE[pill.tone]} size="md" className={statusTagClass(TONE[pill.tone], 'sh-row-pill')}>
      {pill.label}
    </Badge>
  );
  if (compact) {
    return (
      <li className={className ? `sh-row-item ${className}` : 'sh-row-item'}>
        <Card interactive padding="compact" className={selected ? 'sh-row sh-row-compact is-selected' : 'sh-row sh-row-compact'}>
          <CardBody className="sh-row-body">
            {lead}
            <BranchThumb spec={thumb} size="row" />
            <span className="sh-row-who" aria-hidden="true">
              {who}
            </span>
            <span className="sh-row-text">
              <Link href={href} variant="subtle" className="t-body sh-row-title" title={hint ?? (line ? `${title} · ${line}` : title)} data-card-primary onClick={onClick} aria-current={selected ? 'true' : undefined} {...linkAttributes}>
                <span className="sh-strong">{title}</span>
                {jira && <span className="t-ui t-muted sh-mono"> {jira}</span>}
                {line && (
                  <span className="t-ui t-muted sh-row-meta">
                    {/* Its own span: on a phone the line goes under the title and the dot goes. */}
                    <span className="sh-row-sep">{SEP}</span>
                    {line}
                  </span>
                )}
              </Link>
              {detail && <span className="t-ui t-muted sh-row-detail">{detail}</span>}
            </span>
            {(tags || chip) && (
              <span className="sh-row-chips">
                {tags}
                {chip}
              </span>
            )}
            {end}
          </CardBody>
        </Card>
      </li>
    );
  }
  return (
    <li className={className ? `sh-row-item ${className}` : 'sh-row-item'}>
      <Card interactive padding="compact" className={selected ? 'sh-row is-selected' : 'sh-row'}>
        <CardBody className="sh-row-body">
          {lead}
          <BranchThumb spec={thumb} size="row" />
          <span className="sh-row-who" aria-hidden="true">
            {who}
          </span>
          <span className="sh-row-text">
            {eyebrow}
            <Link href={href} variant="subtle" className="t-body sh-row-title" title={hint ?? title} data-card-primary onClick={onClick} aria-current={selected ? 'true' : undefined} {...linkAttributes}>
              <span className="sh-strong">{title}</span>
            </Link>
            {(jira || line || (!statusAtEnd && (pill || tags)) || note) && (
              <span className="sh-row-sub">
                {jira && <span className="t-ui t-muted sh-mono sh-row-jira">{jira}</span>}
                {lineLead}
                {line && <span className="t-ui t-muted sh-row-line">{line}</span>}
                {note}
                {!statusAtEnd && tags}
                {!statusAtEnd && chip}
              </span>
            )}
          </span>
          {statusAtEnd && (tags || chip) && (
            <span className={statusNote ? 'sh-row-chips sh-row-status-end has-note' : 'sh-row-chips sh-row-status-end'}>
              {tags}
              {chip}
              {statusNote && <span className="t-ui t-muted sh-row-status-note">{statusNote}</span>}
            </span>
          )}
          {end}
        </CardBody>
      </Card>
    </li>
  );
}
