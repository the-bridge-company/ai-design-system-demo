import { describe, expect, it } from 'vitest';
import { PREVIEW_WORDS, previewSentence, previewSetupProposal } from './preview-setting';

describe("Settings, Claude's previews", () => {
  it('says where it stands in plain words, the secret named, never asked for', () => {
    expect(previewSentence({ kind: 'on', branches: true })).toBe(PREVIEW_WORDS.on);
    expect(previewSentence({ kind: 'on', branches: false })).toContain('your Storybook needs a preview of each branch');
    expect(previewSentence({ kind: 'off' })).toBe(PREVIEW_WORDS.off);
    expect(PREVIEW_WORDS.secret).toContain('Bridge never asks for it and never sees it');
    const p = previewSetupProposal({ prefix: 'bridge/', date: new Date('2026-11-15T00:00:00Z'), tierLabel: 'Tier 3' });
    expect(p.branch).toBe('bridge/behavior-preview-setup-20261115');
    expect(p.body).toContain('.github/workflows/bridge-behavior-preview.yml');
    expect(p.body).toContain('ANTHROPIC_API_KEY');
    for (const w of [...Object.values(PREVIEW_WORDS), p.title, p.body]) expect(w).not.toMatch(/\u2014/);
  });
});
