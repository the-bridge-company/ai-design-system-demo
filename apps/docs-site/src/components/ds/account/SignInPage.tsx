// The page of the sign-in screen (SignIn.tsx) and of Request access (RequestAccess.tsx): the step on paper, then the one
// Harbor zone with the story of a bridge closing (SignInScene). Styles: styles/account.css (.acc-page).
import type { ReactNode } from 'react';
import { SignInScene } from './SignInScene';
import { ACCOUNT_WORDS as W } from '../../../lib/account';

/**
 * The page every step shares, so going from the email to the code to a room only changes the left column: the step
 * (with `foot` at the bottom of the column), then the one Harbor zone. The step comes first in the DOM too: it is the
 * reading order, the tab order and the phone order. The zone holds no action, so it never competes with the step.
 * `pitch`: what Bridge is, for the step that meets someone new (past it, they have chosen).
 */
export function SignInPage({ children, foot, pitch = false }: { children: ReactNode; foot?: ReactNode; pitch?: boolean }) {
  return (
    <div className="acc-page">
      <div className="acc-pane">
        {children}
        {foot}
      </div>
      <div className="zone acc-zone">
        <div className="acc-zone-text">
          {pitch && (
            <>
              <p className="acc-pitch">{W.pitch}</p>
              <p className="acc-pitch-lead">{W.pitchLead}</p>
            </>
          )}
        </div>
        <SignInScene />
      </div>
    </div>
  );
}
