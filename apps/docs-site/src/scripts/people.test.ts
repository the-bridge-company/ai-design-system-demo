// @vitest-environment jsdom
// People in plain-script rows: every team, the sample team (Acme Design) included, reads a login by its profile name,
// looked up on GitHub, and a member Bridge knows by name as written.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ repo: { owner: 'acme-design-demo', repo: 'bridge-demo-ds' }, ghGet: vi.fn() }));

vi.mock('./github-session', () => ({
  currentViewer: () => null,
  esc: (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  ghGet: s.ghGet,
  hasWorkingToken: () => false,
}));
vi.mock('./repo-context', () => ({ repoContext: () => ({ ...s.repo, defaultBranch: 'main', hosted: true }), siteConfig: () => ({}) }));
vi.mock('@bridge-ds/react/avatar-illustrated', () => ({ illustratedAvatarUri: (seed: string) => `data:image/svg+xml,${seed}` }));

const { displayName, lookUpNames, paintPeople, personHtml } = await import('./people');

const host = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.replaceChildren(el);
  return el;
};

beforeEach(() => {
  s.repo = { owner: 'acme-design-demo', repo: 'bridge-demo-ds' };
  s.ghGet.mockReset();
  s.ghGet.mockResolvedValue({ data: { name: 'Florian G' } });
});

describe('personHtml on the sample team, as on any team', () => {
  it('reads a real account by its profile name, never a stand-in persona', async () => {
    const el = host(personHtml('peterbono'));
    const name = () => el.querySelector('.person-name')?.textContent;
    expect(name()).toBe('peterbono');
    expect(el.querySelector('[data-face]')?.getAttribute('data-face')).toBe('peterbono');
    await paintPeople(el);
    expect(s.ghGet).toHaveBeenCalledWith('/users/peterbono');
    expect(name()).toBe('Florian G');
  });

  it('shows an email member Bridge recorded by name as written, never looked up', () => {
    const el = host(personHtml('name:Ann'));
    expect(el.querySelector('.person-name')?.textContent).toBe('Ann');
    expect(el.querySelector('[data-person]')).toBeNull();
  });

  it('keeps Claude as Claude AI', () => {
    expect(host(personHtml('claude[bot]')).querySelector('.person-name')?.textContent).toBe('Claude AI');
    expect(displayName('claude', true)).toBe('Claude AI');
  });

  it('looks names up the same way as on any team', async () => {
    await lookUpNames(['someone']);
    expect(s.ghGet).toHaveBeenCalledWith('/users/someone');
  });
});

describe('personHtml on another team', () => {
  it('keeps the login until the profile name is read', async () => {
    s.repo = { owner: 'acme', repo: 'ds' };
    const el = host(personHtml('octo-cat', { agent: true }));
    const name = () => el.querySelector('.person-name')?.textContent;
    expect(name()).toBe('Claude AI, with octo-cat');
    await paintPeople(el);
    expect(s.ghGet).toHaveBeenCalledWith('/users/octo-cat');
    expect(name()).toBe('Claude AI, with Florian G');
  });
});

describe('personHtml with a written name', () => {
  it('shows a name Bridge recorded ("Requested by Priya Shah") as written, never looked up nor lower-cased', async () => {
    s.repo = { owner: 'acme', repo: 'acme-flow' };
    const el = host(personHtml('Priya Shah'));
    const name = () => el.querySelector('.person-name')?.textContent;
    expect(name()).toBe('Priya Shah');
    expect(el.querySelector('[data-person]')).toBeNull();
    await paintPeople(el);
    expect(name()).toBe('Priya Shah');
    expect(s.ghGet).not.toHaveBeenCalledWith(expect.stringContaining('Priya'));
  });
});
