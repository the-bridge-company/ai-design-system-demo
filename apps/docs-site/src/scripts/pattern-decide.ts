// The lead's decision on a behavior request from a pattern's drawer (components/ds/studio/PatternDrawers.tsx), the
// same three actions and the same calls as the request's own page (scripts/requests.ts mountBehavior): a GitHub owner
// decides with their own token (core makeBehaviorDefaultOnGitHub, askRequesterOnGitHub, declineRequestOnGitHub); a design
// lead signed in by email through Bridge's server (contribute-session decideBehaviorRequest), which checks their
// member record again. Not now opens the existing Decline dialog (RequestDecide.tsx, mounted once by the page).
import { askRequesterOnGitHub, declineReasonProblems, declineRequestOnGitHub, makeBehaviorDefaultOnGitHub } from '@bridge-ds/core';
import { declineAudience } from '../lib/requests-view';
import { currentViewer, getToken, studioClient } from './github-session';
import { DECLINE_EVENT, type DeclineAskDetail } from '../components/ds/studio/RequestDecide';
import type { BehaviorDecisionActions } from '../components/ds/studio/BehaviorDecision';

export interface DecideTarget {
  number: number;
  title: string;
  /** The requester's GitHub login, when the request has one. */
  requester?: string | undefined;
}

/** The decision actions on request `t` of `repo` ("owner/name"); `onDecided` runs once it is decided (default or not now). */
export function patternDecisionActions(repo: string, t: DecideTarget, via: 'github' | 'email', onDecided: () => void): BehaviorDecisionActions {
  const client = () => studioClient(repo, getToken() ?? '');
  const login = () => currentViewer()?.login ?? null;
  const byEmail = (decision: 'default' | 'not-now' | 'ask', text?: string) =>
    import('./contribute-session').then(({ decideBehaviorRequest }) => decideBehaviorRequest(repo, { number: t.number, decision, ...(text ? { text } : {}) }));
  return {
    onDefault: async () => {
      if (via === 'github') await makeBehaviorDefaultOnGitHub(client(), t.number, login());
      else await byEmail('default');
      onDecided();
    },
    onNotNow: (from: HTMLElement) => {
      const detail: DeclineAskDetail = {
        number: t.number,
        title: t.title,
        audience: declineAudience(t.requester ?? ''),
        problems: declineReasonProblems,
        confirm: async (reason) => {
          if (via === 'github') await declineRequestOnGitHub(client(), t.number, reason, login());
          else await byEmail('not-now', reason);
        },
        closed: (done) => {
          if (done) onDecided();
          else if (from.isConnected) from.focus();
        },
      };
      document.dispatchEvent(new CustomEvent(DECLINE_EVENT, { detail }));
    },
    onAsk: (text: string) => (via === 'github' ? askRequesterOnGitHub(client(), t.number, text, { by: login(), requester: t.requester ?? null }) : byEmail('ask', text)),
  };
}
