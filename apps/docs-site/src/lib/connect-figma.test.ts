import { describe, expect, it } from 'vitest';
import type { Account } from './account';
import { CONNECT_WORDS, codeFrom, connectStep, endedBy, signedInName, teamLabel } from './connect-figma';

const account = (teams: Account['teams']): Account => ({ email: 'ana@acme.com', name: 'Ana', github: { login: 'ana', id: 1 }, teams });
const team = (repo: string, name: string | null = null) => ({ repo, name, role: 'edit', via: 'email' });

describe('Connect Figma (Studio side of Sign in with Bridge)', () => {
  it('reads only a well-formed code from the address', () => {
    expect(codeFrom('?code=abcdefgh23')).toBe('ABCDEFGH23');
    expect(codeFrom('?code=short')).toBeNull();
    expect(codeFrom('?code=ABCDEFGH01')).toBeNull();
    expect(codeFrom('')).toBeNull();
  });

  it('walks the steps: code, Bridge sign-in, GitHub, a team', () => {
    expect(connectStep(null, account([team('acme/ds')]), true).kind).toBe('no-code');
    expect(connectStep('ABCDEFGH23', null, false).kind).toBe('signin');
    expect(connectStep('ABCDEFGH23', account([team('acme/ds')]), false).kind).toBe('github');
    expect(connectStep('ABCDEFGH23', account([]), true).kind).toBe('no-teams');
    const pick = connectStep('ABCDEFGH23', account([team('zeta/ds', 'Zeta'), team('acme/ds', 'Acme DS')]), true);
    expect(pick.kind === 'pick' && pick.teams.map(teamLabel)).toEqual(['Acme DS', 'Zeta']);
  });

  it('says Bridge is unreachable instead of asking to sign in, and names GitHub when it is connected here', () => {
    expect(connectStep('ABCDEFGH23', null, false, undefined, { reachable: false }).kind).toBe('unreachable');
    expect(connectStep('ABCDEFGH23', null, false, undefined, { reachable: true, githubHere: true })).toEqual({ kind: 'signin', githubHere: true });
    expect(connectStep('ABCDEFGH23', null, false)).toEqual({ kind: 'signin', githubHere: false });
  });

  it('ends the sign-in only on the answers a retry cannot fix (expired, used)', () => {
    expect(endedBy(410, 'expired')).toBe('expired');
    expect(endedBy(400, 'bad_request')).toBe('expired');
    expect(endedBy(409, 'used')).toBe('used');
    expect(endedBy(403, 'wrong_team')).toBeNull();
    expect(endedBy(401, 'signin')).toBeNull();
    expect(endedBy(502, 'unreachable')).toBeNull();
  });

  it('names who is signed in by name, else by email', () => {
    expect(signedInName({ name: 'Ana', email: 'ana@acme.com' })).toBe('Ana');
    expect(signedInName({ name: '  ', email: 'ana@acme.com' })).toBe('ana@acme.com');
  });

  it('says the next step happens in Figma, never "close this tab"', () => {
    expect(CONNECT_WORDS.done('Bridge DS')).toBe('Go back to Figma: DS Bridge now uses the Bridge DS design system.');
    const all = Object.values(CONNECT_WORDS).map((w) => (typeof w === 'function' ? w('Acme') : w)).join(' ');
    expect(all).not.toMatch(/close this tab/i);
  });

  it('never shows a token or an em dash', () => {
    const all = Object.values(CONNECT_WORDS).map((w) => (typeof w === 'function' ? w('Acme') : w)).join(' ');
    expect(all).not.toMatch(/token|—/i);
  });
});
