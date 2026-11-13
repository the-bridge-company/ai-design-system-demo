// Settings bands before their islands have read the team (pages/team-shell/settings): each in the shape and height it
// ends in, as the island's loading state and as its fallback painted by the build, so the bands under it never move.
// Pure markup (DS parts and words only): the build renders them without a browser.
import { Card, CardBody, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@bridge-ds/react';
import { MEMBERS_WORDS } from '../../../lib/invites';
import { SAMPLE_CAST } from '../../../lib/demo-cast';
import { TEAM_NAME_WORDS } from '../../../lib/team-name';
import '../../../styles/invites.css';

/** Rows reserved for a team never listed in this browser. */
export const MEMBER_ROWS_DEFAULT = 3;
/** The sample team's people (lib/demo-cast.ts): its members list has exactly these rows. */
export const SAMPLE_MEMBER_ROWS = SAMPLE_CAST.length;

/**
 * The members band before its people are read, in the shape it ends in: the title and its sentence, then the table's
 * header and one row per person (face, name, one line, the role), each part a skeleton line in the real row's boxes, so
 * the band holds its final height and nothing under it moves when the names come. Also the island's fallback, painted by
 * the build (pages/team-shell/settings, `fallback`): there it draws SAMPLE_MEMBER_ROWS rows and styles/invites.css
 * keeps MEMBER_ROWS_DEFAULT of them on any other team.
 */
export function MembersSkeleton({ rows, fallback = false }: { rows: number; fallback?: boolean }) {
  return (
    <div className="mem mem-skel" role="status" aria-busy="true" aria-label="Reading who is in this team" data-fallback={fallback ? '' : undefined}>
      <div className="mem-head">
        <div className="mem-head-text">
          <h2 id="set-members" className="mem-title">
            {MEMBERS_WORDS.membersTitle}
          </h2>
          <p className="mem-intro">
            <Skeleton width="44ch" />
          </p>
        </div>
      </div>
      <Table aria-hidden="true" narrowLayout="stack" className="mem-table">
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead className="mem-role-head">{MEMBERS_WORDS.accessHead}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRow key={i} className="mem-skel-row">
              <TableCell label="">
                <span className="mem-person">
                  <Skeleton variant="circle" width="var(--size-6)" height="var(--size-6)" />
                  <span className="mem-person-text">
                    <span className="mem-name">
                      <Skeleton width={i % 2 ? '10ch' : '14ch'} />
                    </span>
                    <span className="mem-line">
                      <Skeleton width="18ch" />
                    </span>
                  </span>
                </span>
              </TableCell>
              <TableCell className="mem-role-cell" label="">
                <span className="mem-role">
                  <Skeleton width="9ch" />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


/**
 * General, the team's name, before the team is read: the row's label and help as they stay (true for every team),
 * the name and the note under it skeleton lines where they come (TeamNameSetting.tsx draws the same row until it knows).
 */
export function TeamNameSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="set-rows" aria-busy="true">
          <div className="set-row">
            <div>
              <p className="set-row-label">{TEAM_NAME_WORDS.label}</p>
              <p className="set-row-help">{TEAM_NAME_WORDS.help}</p>
            </div>
            <div className="set-row-value">
              <p className="set-who">
                <Skeleton width="14ch" />
              </p>
              {/* The note under the name ("Not set yet...", "Saved in your design system's files...") is not known
                  yet: a quiet line in its place, never a sentence that may not be true. */}
              <p className="set-row-help">
                <Skeleton width="30ch" />
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
