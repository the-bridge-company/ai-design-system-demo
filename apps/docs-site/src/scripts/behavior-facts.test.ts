// A behavior request's facts read with the list's own reader (ghGet), whoever the viewer is: the folder listing, its
// docs.json keys and the Base UI primitive of its source; a read that fails leaves its fact out.
import { describe, expect, it, vi } from 'vitest';

const FOLDER = 'packages/react/src/components/Select';
const files: Record<string, unknown> = {
  [`/repos/acme/ds/contents/${FOLDER}`]: [
    { name: 'Select.tsx', path: `${FOLDER}/Select.tsx`, type: 'file' },
    { name: 'Select.docs.json', path: `${FOLDER}/Select.docs.json`, type: 'file' },
    { name: 'Select.test.tsx', path: `${FOLDER}/Select.test.tsx`, type: 'file' },
    { name: 'Select.module.css', path: `${FOLDER}/Select.module.css`, type: 'file' },
  ],
  [`/repos/acme/ds/contents/${FOLDER}/Select.docs.json`]: JSON.stringify({ behaviors: [{ id: 'tab-leaves', family: 'Focus', text: 'Tab leaves without picking', keys: ['Tab'] }] }),
  [`/repos/acme/ds/contents/${FOLDER}/Select.tsx`]: "import { Select as BaseSelect } from '@base-ui/react/select';",
  '/repos/acme/ds/issues/75/comments?per_page=100': [{ body: 'Dana made it the default in Bridge Studio.', created_at: '2026-11-15T10:00:00Z' }],
};
const ghGet = vi.fn(async (path: string) => {
  if (!(path in files)) throw new Error('404');
  return { data: files[path], stale: false };
});
vi.mock('./github-session', () => ({ ghGet: (p: string) => ghGet(p), readRepo: () => ({ owner: 'acme', repo: 'ds' }) }));
vi.mock('./repo-context', () => ({ siteConfig: () => ({ components: { dir: 'packages/react/src/components' } }) }));
vi.mock('./team-data', () => ({ teamOfPage: () => null, loadTeamData: async () => Promise.reject(new Error('no team')) }));

const { behaviorFactsOf } = await import('./behavior-facts');

describe('behaviorFactsOf', () => {
  it('reads keys, real files, the primitive and who made it the default', async () => {
    const f = await behaviorFactsOf(75, { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks' });
    expect(f.madeDefault).toEqual({ by: 'Dana', at: '2026-11-15T10:00:00Z' });
    expect(f.facts).toEqual({
      keys: ['Tab'],
      docsPath: `${FOLDER}/Select.docs.json`,
      files: [`${FOLDER}/Select.tsx`, `${FOLDER}/Select.docs.json`, `${FOLDER}/Select.test.tsx`],
      primitives: [{ name: 'Select', module: '@base-ui/react/select' }],
    });
  });

  it('leaves out what cannot be read', async () => {
    const f = await behaviorFactsOf(76, { of: 'component', id: 'Combobox', behavior: 'x', today: 'a', wanted: 'b' });
    expect(f).toEqual({ facts: {}, madeDefault: null });
  });
});
