import { describe, expect, it } from 'vitest';
import { PROSE_KEYS, type ComponentDocsJson } from '@bridge-ds/core';
import { availability, isEmptyTask, outdatedFromDates, resultFromExchange, scopeTask, taskPrompt, type DocsAiContext } from './docs-ai-model';

const EM = '\u2014';

const full: ComponentDocsJson = {
  summary: 'Shows a short status next to a name.',
  whenToUse: ['Next to a name.'],
  whenNotToUse: ['For actions.'],
  dos: [{ title: 'Keep it short', text: 'One or two words.' }],
  donts: [{ title: 'No sentences', text: 'Use a callout.' }],
  accessibility: ['Color is never the only signal.'],
  contentGuidelines: ['Sentence case.'],
  anatomy: { root: 'Container' },
};

const ctx: DocsAiContext = {
  slug: 'badge',
  name: 'Badge',
  files: { tsx: 'packages/react/src/components/Badge/Badge.tsx', css: 'packages/react/src/components/Badge/Badge.module.css', docs: 'packages/react/src/components/Badge/Badge.docs.json' },
  input: { name: 'Badge', description: 'Short status label.', props: [{ name: 'tone', type: "'info' | 'danger'", required: false, defaultValue: "'info'" }], tokens: ['--color-text-default'], cssClasses: ['root', 'danger'] },
  conventions: { voice: 'Sentence case.', source: 'export const Badge = () => null;', styles: '.root { color: var(--color-text-default); }' },
};

describe('availability', () => {
  it('one way: your own Claude through the draft exchange, once signed in', () => {
    expect(availability({ exchange: false })).toEqual({ ways: [], preferred: null });
    expect(availability({ exchange: true })).toEqual({ ways: ['my-claude'], preferred: 'my-claude' });
  });
});

describe('scope selection', () => {
  it('page-fill skips reviewed, non-empty, up-to-date sections', () => {
    const docs = { ...full, whenNotToUse: [], contentGuidelines: undefined };
    const t = scopeTask({ kind: 'page-fill' }, docs);
    expect(t).toEqual({ kind: 'sections', keys: ['whenNotToUse', 'contentGuidelines'] });
  });

  it('page-fill sends written sections older than the code as checks, never as rewrites', () => {
    const t = scopeTask({ kind: 'page-fill' }, { ...full, whenNotToUse: [] }, ['summary', 'whenNotToUse']);
    expect(t).toEqual({ kind: 'sections', keys: ['summary', 'whenNotToUse'], check: ['summary'] });
  });

  it('page-fill on complete, up-to-date docs has nothing to draft', () => {
    const t = scopeTask({ kind: 'page-fill' }, full, []);
    expect(isEmptyTask(t)).toBe(true);
  });

  it('page-rewrite takes every prose section, never anatomy', () => {
    expect(scopeTask({ kind: 'page-rewrite' }, full)).toEqual({ kind: 'sections', keys: [...PROSE_KEYS], rewrite: true });
  });

  it('section: one key, rewritten when it holds text; anatomy is refused', () => {
    expect(scopeTask({ kind: 'section', key: 'dos' }, full)).toEqual({ kind: 'sections', keys: ['dos'], rewrite: true });
    expect(scopeTask({ kind: 'section', key: 'dos' }, { ...full, dos: [] })).toEqual({ kind: 'sections', keys: ['dos'] });
    expect(() => scopeTask({ kind: 'section', key: 'anatomy' as never }, full)).toThrow(/code/);
  });

  it('selection keeps the passage and the mode, and needs text', () => {
    expect(scopeTask({ kind: 'selection', key: 'summary', text: ' Shows a status. ', mode: 'shorter' }, full)).toEqual({ kind: 'selection', key: 'summary', text: 'Shows a status.', mode: 'shorter' });
    expect(() => scopeTask({ kind: 'selection', key: 'summary', text: ' ', mode: 'voice' }, full)).toThrow(/Select/);
  });
});

describe('page-fill answers when the code is newer', () => {
  const docs = { ...full, whenNotToUse: [] };
  const task = scopeTask({ kind: 'page-fill' }, docs, [...PROSE_KEYS]);

  it('an accurate section is omitted (Still accurate), a contradicted one returned (Updated), the empty one drafted', () => {
    const answer = { summary: 'Shows a short status next to a name. It has no size prop.', whenNotToUse: ['For actions: use a Button.'] };
    const r = resultFromExchange(task, { docs: answer });
    expect(r.sections).toEqual(answer);
    expect(r.checked).toEqual(['whenToUse', 'dos', 'donts', 'accessibility', 'contentGuidelines']);
    expect(r.checked).not.toContain('summary');
    expect(r.sections).not.toHaveProperty('dos');
  });

  it('every written section still accurate: only the empty one comes back', () => {
    const r = resultFromExchange(task, { docs: { whenNotToUse: ['For actions.'] } });
    expect(r).toEqual({ sections: { whenNotToUse: ['For actions.'] }, checked: ['summary', 'whenToUse', 'dos', 'donts', 'accessibility', 'contentGuidelines'] });
  });

  it('the prompt drafts the empty section and checks the others', () => {
    const p = taskPrompt(ctx, docs, task);
    expect(p).toMatch(/Write these sections of Badge\.docs\.json for the Bridge design system: whenNotToUse\./);
    expect(p).toMatch(/Check these written sections .*: summary, whenToUse, dos, donts, accessibility, contentGuidelines\./);
  });

  it('the exchange answer is read the same way', () => {
    expect(resultFromExchange(task, { docs: { whenNotToUse: ['For actions.'], dos: [{ title: 'Keep it short', text: 'No size prop now.' }] } }).checked).toEqual(['summary', 'whenToUse', 'donts', 'accessibility', 'contentGuidelines']);
  });
});

describe('outdated sections', () => {
  it('every written section is outdated when the code moved after docs.json', () => {
    const docs = { ...full, dos: [] };
    expect(outdatedFromDates(docs, { code: ['2026-10-10T00:00:00Z', '2026-10-01T00:00:00Z'], docs: '2026-10-05T00:00:00Z' })).toEqual([...PROSE_KEYS]);
    expect(outdatedFromDates(docs, { code: ['2026-10-01T00:00:00Z', null], docs: '2026-10-05T00:00:00Z' })).toEqual(['dos']);
  });

  it('empty-only when GitHub could not be read, all when docs.json was never committed', () => {
    expect(outdatedFromDates({ ...full, summary: '' }, null)).toEqual(['summary']);
    expect(outdatedFromDates(full, { code: ['2026-10-01T00:00:00Z'], docs: null })).toEqual([...PROSE_KEYS]);
    expect(outdatedFromDates(full, { code: [null, null], docs: null })).toEqual([]);
  });
});

describe('prompt', () => {
  it('asks only for the task keys, with the facts from the code and the current text', () => {
    const p = taskPrompt(ctx, full, { kind: 'sections', keys: ['dos', 'donts'], rewrite: true });
    expect(p).toMatch(/Rewrite these sections of Badge\.docs\.json for the Bridge design system: dos, donts\./);
    expect(p).toMatch(/Write only these keys: dos, donts\. Never return anatomy/);
    expect(p).toContain('"dos": [{ "title": "...", "text": "..." }]');
    expect(p).toContain('| `tone` |');
    expect(p).toContain('<styles>');
    expect(p).toContain('Shows a short status next to a name.');
    expect(p).not.toContain(EM);
  });

  it('a selection prompt quotes the passage and asks for a replacement', () => {
    const p = taskPrompt(ctx, full, { kind: 'selection', key: 'summary', text: 'Shows a short status.', mode: 'clearer' });
    expect(p).toMatch(/Rewrite one passage of the "summary" section/);
    expect(p).toContain('<passage>\nShows a short status.\n</passage>');
    expect(p).toContain('{ "replacement": "the rewritten passage" }');
    expect(p).toContain('Facts computed from the code:');
  });
});

describe('answers', () => {
  const sections = { kind: 'sections' as const, keys: ['summary', 'dos'] as ('summary' | 'dos')[] };

  it('exchange results are sanitized the same way', () => {
    expect(resultFromExchange(sections, { docs: { summary: `A ${EM} B` } })).toEqual({ sections: { summary: 'A, B' }, checked: [] });
    const sel = { kind: 'selection' as const, key: 'summary' as const, text: 'x', mode: 'shorter' as const };
    expect(resultFromExchange(sel, { replacement: 'Shorter.' })).toEqual({ sections: {}, replacement: 'Shorter.' });
    expect(() => resultFromExchange(sel, {})).toThrow(/no rewritten passage/);
  });
});

describe('the my-Claude way, for a developer', () => {
  it('is a message to copy: the setup with a token placeholder, the page and the phrase', async () => {
    const { COPY_SETUP, developerSetupMessage } = await import('./docs-ai-model');
    expect(COPY_SETUP.label).toBe('Copy setup for a developer');
    const m = developerSetupMessage({ repo: 'acme/ds', component: 'Button', page: 'https://bridge.test/components/button/?edit=1', phrase: 'draft bridge docs' });
    expect(m).toContain('Button usage guidance');
    expect(m).toContain('Page: https://bridge.test/components/button/?edit=1');
    expect(m).toContain('claude mcp add bridge -s user -e GITHUB_TOKEN=your-github-token -- npx -y @bridge-ds/mcp --repo acme/ds');
    expect(m).toContain('say "draft bridge docs" in Claude Code');
    expect(m.includes(String.fromCharCode(0x2014))).toBe(false);
  });
});
