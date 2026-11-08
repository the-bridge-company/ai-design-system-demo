// A write action on a demo team (board D2): Create branch, New brand, Send suggestion, Start an exploration, a token
// edit sent for review... A calm DS Dialog, never an error. On the sample team (Acme Design) it first says what the
// action does on a real team (lib/demo.ts demoActionLine, "Send to Figma puts this screen..."), then that nothing is sent, and the
// way to do it for real is the sample team's one call to action, "Get started" (the email sign-in, never GitHub), the
// same as its banner (DemoBanner.tsx). On Bridge's own team, a guest signs in ("Sign in with GitHub"; the shared session
// listens for data-gh-signin, scripts/github-session.ts). "Keep exploring" closes it. Words in lib/demo.ts; when it
// opens: scripts/demo-gate.ts.
import { Eye } from 'lucide-react';
import { Alert, Button, ButtonGroup, Dialog, DialogClose, DialogContent } from '@bridge-ds/react';
import { GitHubMark } from './brand-icons';
import ButtonLink from '../ButtonLink';
import { DEMO_ACTION_DEFAULT, demoDialog, DEMO_WORDS, isOwnTeam } from '../../../lib/demo';
import { SIGNIN_PAGE } from '../../../lib/account';
import { ghButton } from '../../../lib/gh-wording';
import '../../../styles/demo-home.css';

export interface MakeItYoursProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The site signs in with GitHub (else the token paste: "Connect GitHub"). */
  signIn: boolean;
  /** "owner/repo" of the page: Bridge's own design system is never called the demo. */
  repo?: string;
  /**
   * What the action would do on a real team (lib/demo.ts demoActionLine): on the sample team it leads the dialog, and
   * the note says nothing is sent and how to do it for real. Unset: the line for any action.
   */
  line?: string;
}

/** The demo's write-action dialog. */
export function MakeItYours({ open, onOpenChange, signIn, repo, line }: MakeItYoursProps) {
  const words = demoDialog(repo);
  const own = isOwnTeam(repo);
  // Bridge's own design system keeps its sign-in words; the sample team explains the action, then why nothing happened.
  const lead = own ? words.lead : (line ?? DEMO_ACTION_DEFAULT);
  const note = own ? DEMO_WORDS.dialogNote : words.lead;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="miy"
        title={<span className="miy-title">{words.title}</span>}
        description={lead}
        footer={
          <ButtonGroup align="end" className="miy-actions">
            <DialogClose render={<Button variant="secondary" />}>{DEMO_WORDS.keepExploring}</DialogClose>
            {own ? (
              <Button variant="primary" iconStart={GitHubMark} data-gh-open="" data-gh-signin={signIn ? '' : undefined} onClick={() => onOpenChange(false)}>
                {ghButton(signIn)}
              </Button>
            ) : (
              <ButtonLink variant="primary" href={SIGNIN_PAGE} data-demo-start="">
                {DEMO_WORDS.getStarted}
              </ButtonLink>
            )}
          </ButtonGroup>
        }
      >
        <Alert tone="neutral" icon={Eye}>
          {note}
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
