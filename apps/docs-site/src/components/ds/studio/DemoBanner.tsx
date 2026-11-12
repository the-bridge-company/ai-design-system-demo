// The banner over every page of a demo team for a visitor who cannot change it, Studio and Library alike. One banner,
// one action (lib/demo.ts):
//   - The sample team (Acme Design): "Acme Design. This is a sample team: your edits stay in this browser and nothing
//     is sent." with "Get started", the email sign-in (lib/account.ts SIGNIN_PAGE), never GitHub. A visitor signed in to
//     a Bridge account gets "Back to your workspace" instead: they have already started.
//   - Bridge's own team, for a guest: "Bridge DS, read only." with "Back to your workspace" (or "Connect your design
//     system" with no workspace yet, lib/start.ts demoBack).
// On the sample team a visitor also gets "See it as" (SeeItAs.tsx): the same Studio as any of its five people.
// The action is secondary weight: the page keeps its own primary (Review all on the demo home). A DS Banner, neutral,
// with the board's warm tint (styles/demo-home.css). Mounted by scripts/demo-gate.ts into the layout's [data-demo-strip].
import { useId, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Banner, Button } from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { DEMO_WORDS, demoBanner } from '../../../lib/demo';
import { SIGNIN_PAGE } from '../../../lib/account';
import type { CastKey } from '../../../lib/demo-cast';
import { SeeItAs } from './SeeItAs';
import '../../../styles/demo-home.css';

export interface DemoBannerProps {
  /** owner/repo: the sample team (Acme Design) or Bridge's own design system pick the words (lib/demo.ts demoBanner). */
  repo: string;
  /**
   * Where "Back to your workspace" leads, for a visitor who has one (signed in to a Bridge account, or Bridge's own team);
   * `connect` when there is none yet. Null on the sample team for a visitor who has not started: "Get started".
   */
  back?: { href: string; connect: boolean } | null;
  /** "Connect your design system" clicked (scripts/start-connect.ts). */
  onConnect?: (e: Event, href: string) => void;
  /** The sample team's "See it as" (a visitor only): who the page plays, and what picking someone does. */
  cast?: { current: CastKey; onPick: (key: CastKey) => void } | null;
}

export function DemoBanner({ repo, back, onConnect, cast }: DemoBannerProps) {
  const words = demoBanner(repo);
  // On a phone the banner is one line (the team name, Details, the action): the sentence and "See it as" open under
  // it on demand, so the strip stops taking the first screen (styles/demo-home.css). Wider screens show it all and
  // never draw the Details button.
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const action = !back ? (
    <ButtonLink variant="secondary" href={SIGNIN_PAGE} data-demo-start="">
      {DEMO_WORDS.getStarted}
    </ButtonLink>
  ) : back.connect ? (
    <ButtonLink variant="secondary" href={back.href} onClick={(e) => onConnect?.(e.nativeEvent, back.href)}>
      {DEMO_WORDS.connectOwn}
    </ButtonLink>
  ) : (
    <ButtonLink variant="secondary" href={back.href}>
      {DEMO_WORDS.backToWorkspace}
    </ButtonLink>
  );
  return (
    <Banner
      appearance="neutral"
      icon={Info}
      className="demo-banner demo-banner-sample"
      data-open={open ? '' : undefined}
      title={
        <>
          <b>{words.title}</b>{' '}
          <span className="demo-banner-text" id={detailId}>
            {words.text}
          </span>
          <Button variant="ghost" size="sm" iconEnd={ChevronDown} className="demo-banner-more" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}>
            {DEMO_WORDS.bannerDetails}
          </Button>
        </>
      }
      actions={
        cast ? (
          <span className="demo-banner-actions">
            <SeeItAs current={cast.current} onPick={cast.onPick} />
            {action}
          </span>
        ) : (
          action
        )
      }
    />
  );
}
