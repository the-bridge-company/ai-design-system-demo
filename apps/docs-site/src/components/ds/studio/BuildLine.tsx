// The calm Being built line of the Studio home (StudioHome `building`): "Build requests: 1 in progress, 4 in review, 3
// waiting to be picked up." The same rows and the same sentence as the Being built page header (lib/building-view
// pageRows, core buildSummaryLine): build requests, Claude's fixes and explorations handed to developers.
// with a link to the page, under the Harbor zone. Never a Needs you row: a build request waits on developers, not on
// the viewer. Nothing shows while nothing is open, or when the build requests could not be read. Data:
// scripts/building-data.ts, the same on every team.
import { useEffect, useState } from 'react';
import { Icon, Link } from '@bridge-ds/react';
import { Wrench } from 'lucide-react';
import { buildSummaryLine, type BuildRequestView } from '@bridge-ds/core';
import { studioHref } from '../../../lib/team-path';
import { loadBuildData } from '../../../scripts/building-data';
import { pageRows } from '../../../lib/building-view';
import '../../../styles/building.css';

export function BuildLine() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadBuildData()
      .then((d) => live && setLine(buildSummaryLine(pageRows<BuildRequestView>(d, Date.now()))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!line) return null;
  return (
    <p className="t-ui t-muted sh-health bb-home">
      {/* The wrench stays with its sentence (at the start of the first line on a phone); the link wraps after. */}
      <span className="bb-home-text">
        <Icon icon={Wrench} size="sm" className="bb-home-icon" />
        <span>Build requests: {line.charAt(0).toLowerCase() + line.slice(1)}</span>
      </span>
      <Link href={studioHref('building/')}>See what is being built</Link>
    </p>
  );
}
