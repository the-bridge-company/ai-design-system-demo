// A component's one Figma status on a team's Library page (FigmaLink and FigmaAhead together): "In Figma: Button",
// then "Figma is ahead: 1 change being built (Malik)" while build requests are open. Never "Not linked to Figma yet"
// beside "Figma is ahead": changes sent from Figma mean the component is in Figma. The not-linked hint and its next
// step go to a lead or an admin only (`canFix`), once the build requests are read (FigmaLink figmaLineKind).
import { FigmaLink, figmaLineKind, type FigmaLinkProps } from './FigmaLink';
import { FigmaAheadLine, useFigmaAheadLine, type FigmaAheadProps } from './FigmaAhead';

export interface FigmaStatusProps extends FigmaLinkProps {
  component: string;
  /** Being built in Studio, for this library's team. */
  buildingHref: string;
  load: FigmaAheadProps['load'];
}

export function FigmaStatus({ component, buildingHref, load, ...link }: FigmaStatusProps) {
  const ahead = useFigmaAheadLine(component, load);
  const kind = figmaLineKind({ link: link.link, canFix: link.canFix, ahead });
  return (
    <>
      {kind !== 'none' && <FigmaLink {...link} />}
      {ahead && <FigmaAheadLine line={ahead} href={buildingHref} />}
    </>
  );
}
