import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_ACTION_DEFAULT, demoActionLine, demoActionNames, DEMO_REPOS, demoBanner, demoDialog, DEMO_STASH_KEY, DEMO_VISIT_KEY, DEMO_WORDS, SHARED_DRAFT_KEY, swapDemoDrafts, exploresDemo, humanizeRepo, onBridge, isDemoRepo, OWN_TEAM, showcaseRedirect, teamDisplayName } from './demo';

describe('the demo', () => {
  it('is the self-hosted repository and the hosted demo team, any case', () => {
    expect(DEMO_REPOS).toContain('the-bridge-company/ai-design-system-demo');
    expect(DEMO_REPOS).toContain('acme-design-demo/bridge-demo-ds');
    expect(isDemoRepo('Peterbono/Bridge-Demo-DS')).toBe(true);
    expect(isDemoRepo('acme/ds')).toBe(false);
    // Bridge's own repository moves to the-bridge-company: both names are the demo while it moves.
    expect(isDemoRepo('The-Bridge-Company/AI-Design-System-Demo')).toBe(true);
    expect(isDemoRepo('The-Bridge-Company/AI-Design-System-Demo')).toBe(true);
    expect(isDemoRepo(null)).toBe(false);
  });

  it('lets a visitor explore, and its owner work as usual', () => {
    const repo = 'acme-design-demo/bridge-demo-ds';
    expect(exploresDemo({ repo, signedIn: false, write: null })).toBe(true);
    expect(exploresDemo({ repo, signedIn: true, write: false })).toBe(true);
    // Signed in and not known yet: the Studio acts as usual, so the owner is never stopped.
    expect(exploresDemo({ repo, signedIn: true, write: null })).toBe(false);
    expect(exploresDemo({ repo, signedIn: true, write: true })).toBe(false);
    expect(exploresDemo({ repo: 'acme/ds', signedIn: false, write: null })).toBe(false);
  });

  it('says the sample team sends nothing, in designer words, with one call to action (board D2)', () => {
    expect(DEMO_WORDS.getStarted).toBe('Get started');
    expect(demoBanner('acme-design-demo/bridge-demo-ds')).toEqual({ title: 'Acme Design.', text: 'This is a sample team: your edits stay in this browser and nothing is sent.' });
    expect(demoDialog('acme-design-demo/bridge-demo-ds')).toEqual({ title: 'This is a sample team.', lead: 'Nothing is sent from Acme Design. Get started to do this with your own team.' });
    // The sample team never sends a visitor to GitHub.
    for (const t of [...Object.values(demoBanner('acme-design-demo/bridge-demo-ds')), ...Object.values(demoDialog('acme-design-demo/bridge-demo-ds')), DEMO_WORDS.sampleNote, DEMO_WORDS.tryIt]) expect(t).not.toMatch(/GitHub|repo/);
    for (const t of Object.values(DEMO_WORDS)) expect(t).not.toMatch(/\u2014|pull request|token/);
  });

  it("never calls Bridge's own design system the demo", () => {
    const own = demoDialog('the-bridge-company/ai-design-system-demo');
    expect(`${own.title} ${own.lead}`).not.toMatch(/demo|for real/i);
  });
});

describe('demoActionLine: what an action does on a real team, in the sample-team dialog', () => {
  it('names each action by its mark, the refused action, or the words clicked', () => {
    expect(demoActionLine(['send to Figma'])).toMatch(/^Send to Figma puts this screen in your team's Figma file, built from your library's components/);
    expect(demoActionLine(['Send to Figma again'])).toBe(demoActionLine(['send to Figma']));
    expect(demoActionLine(['keep an exploration'])).toMatch(/^Done exploring tells your team/);
    expect(demoActionLine(['Done exploring'])).toBe(demoActionLine(['keep an exploration']));
    expect(demoActionLine(['Looks right'])).toMatch(/^Looks right tells/);
    expect(demoActionLine(['Needs changes'])).toMatch(/^Needs changes sends/);
    expect(demoActionLine(['review changes'])).toMatch(/^Approve says/);
    expect(demoActionLine(['comment on changes'])).toMatch(/^Your comment/);
    expect(demoActionLine(['start an exploration'])).toMatch(/^Start an exploration/);
    expect(demoActionLine(['invite'])).toMatch(/^Invite emails/);
    expect(demoActionLine(['set-pm'])).toMatch(/^The product manager/);
    expect(demoActionLine(['library-update'])).toMatch(/^Bring the latest in/);
    expect(demoActionLine(['edit the roles'])).toMatch(/^Roles decide/);
  });

  it('the first name it knows wins (the mark, then the newest click); none known: the line for any action', () => {
    expect(demoActionLine([null, 'Send', 'Needs changes', 'Looks right'])).toBe(demoActionLine(['Needs changes']));
    expect(demoActionLine(['send to Figma', 'Looks right'])).toBe(demoActionLine(['send to Figma']));
    expect(demoActionLine([])).toBe(DEMO_ACTION_DEFAULT);
    expect(demoActionLine([undefined, 'Open the preview'])).toBe(DEMO_ACTION_DEFAULT);
  });

  it('every line is one or two plain sentences in the Bridge voice: no em dash, no developer words', () => {
    for (const line of [...demoActionNames().map((n) => demoActionLine([n])), DEMO_ACTION_DEFAULT]) {
      expect(line).not.toMatch(/\u2014|GitHub|pull request|branch|commit|token|repo|merge|PR\b/i);
      expect(line.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
      expect(line).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe('teamDisplayName', () => {
  it('a team without a name goes by its repository name in words, never owner/repo', () => {
    expect(teamDisplayName('the-bridge-company/ai-design-system-demo')).toBe('Bridge DS');
    expect(teamDisplayName('acme-design-demo/bridge-demo-ds')).toBe('Acme Design');
    expect(teamDisplayName('acme/design-system')).toBe('Design system');
  });

  it("a team's own name from bridge.config.json wins, the sample team's included", () => {
    expect(teamDisplayName('acme/design-system', { name: '  Acme   Studio ' })).toBe('Acme Studio');
    expect(teamDisplayName('the-bridge-company/ai-design-system-demo', { name: 'Bridge DS' })).toBe('Bridge DS');
    expect(teamDisplayName('acme-design-demo/bridge-demo-ds', { name: 'Acme Design' })).toBe('Acme Design');
    expect(teamDisplayName('acme/ds', { name: ' ' })).toBe('Ds');
    expect(teamDisplayName('acme/ds', null)).toBe('Ds');
  });

  it('says " on Bridge" after a team, except when the team is Bridge itself', () => {
    expect(`Join Acme${onBridge('Acme')}`).toBe('Join Acme on Bridge');
    expect(`Join Bridge${onBridge('Bridge')}`).toBe('Join Bridge');
    expect(onBridge(' bridge ')).toBe('');
    expect(onBridge('Bridge Labs')).toBe(' on Bridge');
  });

  it("names Bridge's own design system as the root bridge.config.json does", () => {
    const root = JSON.parse(readFileSync(new URL('../../../../bridge.config.json', import.meta.url), 'utf8')) as { name?: string };
    expect(root.name).toBe(OWN_TEAM);
    expect(teamDisplayName('the-bridge-company/ai-design-system-demo', root)).toBe('Bridge DS');
  });

  it("names the sample team Acme Design whatever name comes with it (kept, served or read from a snapshot)", () => {
    expect(teamDisplayName('acme-design-demo/bridge-demo-ds')).toBe('Acme Design');
    expect(teamDisplayName('Acme-Design-Demo/Bridge-Demo-DS', { name: 'Bridge demo ds' })).toBe('Acme Design');
    expect(teamDisplayName('peterbono/bridge-demo-ds', { name: 'bridge-demo-ds' })).toBe('Acme Design');
    // Any other team keeps its own name first.
    expect(teamDisplayName('acme/ds', { name: 'Acme Studio' })).toBe('Acme Studio');
  });

  it('puts a repository name in words', () => {
    expect(humanizeRepo('the-bridge-company/ai-design-system-demo')).toBe('Ai design system demo');
    expect(humanizeRepo('acme_ui.kit')).toBe('Acme ui kit');
    expect(humanizeRepo('acme/ds')).toBe('Ds');
  });
});

/** A Storage stand-in. */
function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    dump: () => Object.fromEntries(m),
  };
}

describe('drafts on the sample team', () => {
  it('keeps the visit drafts apart from a real draft, and drops them on leaving', () => {
    const s = store({ [SHARED_DRAFT_KEY]: '{"edits":["real"]}', 'bridge.brand-draft:acme/ds': 'real brand' });
    expect(swapDemoDrafts(s, true)).toBe('entered');
    // On the sample team: the real draft waits apart, the visitor starts empty.
    expect(s.getItem(SHARED_DRAFT_KEY)).toBeNull();
    expect(s.getItem(DEMO_STASH_KEY)).toBe('{"edits":["real"]}');
    // Edits during the visit stay in this browser, page after page.
    s.setItem(SHARED_DRAFT_KEY, '{"edits":["sample"]}');
    s.setItem('bridge.brand-draft:acme-design-demo/bridge-demo-ds', 'sample brand');
    s.setItem('bridge.draft.change.acme-design-demo/bridge-demo-ds#12.v1', 'sample change');
    expect(swapDemoDrafts(s, true)).toBe('none');
    expect(s.getItem(SHARED_DRAFT_KEY)).toBe('{"edits":["sample"]}');
    // Leaving for a real team: the sample drafts go, the real draft comes back, untouched.
    expect(swapDemoDrafts(s, false)).toBe('left');
    expect(s.dump()).toEqual({ [SHARED_DRAFT_KEY]: '{"edits":["real"]}', 'bridge.brand-draft:acme/ds': 'real brand' });
    expect(swapDemoDrafts(s, false)).toBe('none');
  });

  it('leaves no draft behind when there was no real one', () => {
    const s = store();
    swapDemoDrafts(s, true);
    s.setItem(SHARED_DRAFT_KEY, '{"edits":["sample"]}');
    swapDemoDrafts(s, false);
    expect(s.dump()).toEqual({});
    expect(s.getItem(DEMO_VISIT_KEY)).toBeNull();
  });
});

describe('a signed-out visitor of the own Studio', () => {
  const go = (pathname: string, more: { search?: string; hash?: string; maybeSignedIn?: boolean } = {}) => showcaseRedirect({ pathname, maybeSignedIn: false, ...more });
  it('goes to the same page of the sample team, never a real team', () => {
    expect(go('/studio/')).toBe('/studio/acme-design-demo/bridge-demo-ds/');
    expect(go('/studio')).toBe('/studio/acme-design-demo/bridge-demo-ds/');
    expect(go('/studio/explorations/', { search: '?view=board', hash: '#x' })).toBe('/studio/acme-design-demo/bridge-demo-ds/explorations/?view=board#x');
    expect(go('/studio/settings/')).toBe('/studio/acme-design-demo/bridge-demo-ds/settings/');
  });
  it('sends a product or component page to the sample team list', () => {
    expect(go('/studio/products/dasboard-data-test-d/')).toBe('/studio/acme-design-demo/bridge-demo-ds/products/');
    expect(go('/studio/components/docs/button/')).toBe('/studio/acme-design-demo/bridge-demo-ds/components/');
  });
  it('keeps a page for someone who may be signed in, a team address and the pages around sign-in', () => {
    expect(go('/studio/', { maybeSignedIn: true })).toBeNull();
    expect(go('/studio/acme-design-demo/bridge-demo-ds/')).toBeNull();
    expect(go('/studio/the-bridge-company/ai-design-system-demo/')).toBeNull();
    expect(go('/studio/auth/')).toBeNull();
    expect(go('/studio/workspace/')).toBeNull();
    expect(go('/studio/invite/')).toBeNull();
    expect(go('/library/')).toBeNull();
  });
  it('reads nothing outside itself, so the layout can run its source inline', () => {
    const run = new Function(`return (${showcaseRedirect.toString()})`)() as typeof showcaseRedirect;
    expect(run({ pathname: '/studio/tokens/', maybeSignedIn: false })).toBe('/studio/acme-design-demo/bridge-demo-ds/tokens/');
  });
});
