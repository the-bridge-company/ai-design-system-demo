// The "Figma is ahead" line on Bridge's own Library component page (pages/components/[slug].astro), an island in the
// ComponentView `ahead` slot: Bridge's build requests read in the browser (scripts/building-data.ts). It is work in
// progress for the team that maintains the library (its link opens Studio's Being built), so only a maintainer of the
// repository sees it (scripts/maintainer.ts, the same check as FigmaLinkSite); a public reader of the Library does not.
import { useEffect, useState } from 'react';
import { FigmaAhead } from './ds/library/FigmaAhead';
import { loadBuildData } from '../scripts/building-data';
import { studioHref } from '../lib/team-path';
import { isMaintainer, onMaintainer } from '../scripts/maintainer';

export default function FigmaAheadSite({ component }: { component: string }) {
  const [lead, setLead] = useState(isMaintainer);
  useEffect(() => {
    setLead(isMaintainer());
    return onMaintainer(setLead);
  }, []);
  if (!lead) return null;
  return <FigmaAhead component={component} href={studioHref('building/')} load={() => loadBuildData()} />;
}
