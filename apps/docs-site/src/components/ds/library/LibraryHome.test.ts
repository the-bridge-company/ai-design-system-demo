// @vitest-environment jsdom
// The team Library's home while it reads (no persona in the address, the visit the gate checked at 1 s): the hero
// names the sample team Acme Design from the first render, and a team whose name is not known yet gets a skeleton,
// never its repository in words.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const page = vi.hoisted(() => ({ team: { owner: 'acme-design-demo', repo: 'bridge-demo-ds' } }));
vi.mock('../../../scripts/team-data', () => ({ teamOfPage: () => page.team, loadTeamLlms: () => new Promise(() => undefined) }));
vi.mock('./LibraryGate', () => ({ default: () => null, emailFallback: () => null, useLibraryGate: () => ({ step: 'open', answer: null }) }));
vi.mock('../studio/TeamState', () => ({
  useTeamData: () => ({ load: { status: 'loading' }, retry: () => undefined }),
  TeamLoadStatus: ({ label }: { label: string }) => createElement('p', { role: 'status' }, label),
  TeamSourceNote: () => null,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const hero = async () => {
  const { default: LibraryHome } = await import('./LibraryHome');
  const { container } = render(createElement(LibraryHome));
  await act(async () => undefined);
  return container.querySelector('#hero-title')!;
};

describe('LibraryHome while it reads', () => {
  it('names the sample team Acme Design without a persona, even when this browser kept another name', async () => {
    localStorage.setItem('bridge.teamNames', JSON.stringify({ 'acme-design-demo/bridge-demo-ds': 'Bridge demo ds' }));
    expect((await hero()).textContent).toBe('The Acme Design design system');
  });

  it('shows a skeleton for a team whose name is not known yet, never the repository in words', async () => {
    page.team = { owner: 'globex', repo: 'tokens-kit' };
    const h1 = await hero();
    expect(h1.textContent).not.toMatch(/Tokens kit/i);
    expect(h1.querySelector('[aria-hidden="true"]')).not.toBeNull();
    page.team = { owner: 'acme-design-demo', repo: 'bridge-demo-ds' };
  });
});
