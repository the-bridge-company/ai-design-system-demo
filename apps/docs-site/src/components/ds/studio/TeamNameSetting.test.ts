// @vitest-environment jsdom
// Settings > General: the note under the team's name states a fact only once it is known (the team's settings read,
// the session's access known): before that, a skeleton line in its place, never "Not set yet" a moment too early.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamNameSetting from './TeamNameSetting';
import { TEAM_NAME_WORDS } from '../../../lib/team-name';

const page = vi.hoisted(() => ({ site: {} as { name?: string }, access: [] as ((a: unknown) => void)[] }));
vi.mock('../../../scripts/repo-context', () => ({ repoContext: () => ({ owner: 'acme-design-demo', repo: 'bridge-demo-ds', hosted: true }), siteConfig: () => page.site }));
vi.mock('../../../scripts/github-session', () => ({ onAccess: (fn: (a: unknown) => void) => void page.access.push(fn) }));
vi.mock('./SettingsParts', () => ({ AdminOnlyNote: () => createElement('p', { className: 'set-row-help' }, 'Only admins change it.') }));

afterEach(() => {
  cleanup();
  page.site = {};
  page.access = [];
});

describe('TeamNameSetting', () => {
  it('never says "Not set yet" before the settings and the access are known: a skeleton line in its place', async () => {
    const { container } = render(createElement(TeamNameSetting));
    await act(async () => undefined);
    expect(screen.queryByText(TEAM_NAME_WORDS.notSet)).toBeNull();
    expect(container.querySelector('.set-row-value .set-row-help[aria-hidden="true"]')).not.toBeNull();
    // Settings read without a name, the session not answered yet: still no sentence that may not be true.
    page.site = { tokens: {} } as { name?: string };
    act(() => document.dispatchEvent(new CustomEvent('bridge:team-model')));
    await act(async () => undefined);
    expect(screen.queryByText(TEAM_NAME_WORDS.notSet)).toBeNull();
    expect(screen.queryByText(TEAM_NAME_WORDS.githubOnly)).toBeNull();
    expect(container.querySelector('.set-row-value .set-row-help[aria-hidden="true"]')).not.toBeNull();
  });
});
