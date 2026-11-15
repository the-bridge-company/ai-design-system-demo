// The change for review of Claude's Figma fixes (figma-fix-run.ts): the same for every surface, and it refuses fixes
// that move the component further from the code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GOVERNANCE, figmaFixesProposal, parseFidelityRun, parseMeasuredSpecsFile, type BridgeConfig } from '../src';

const GAP = join(__dirname, 'fixtures/gap');
const input = {
  component: 'TextInput',
  measured: parseMeasuredSpecsFile(readFileSync(join(GAP, 'carbon-measured-hidden-boxes.json'), 'utf8')),
  run: parseFidelityRun(readFileSync(join(GAP, 'textinput-fidelity.json'), 'utf8')),
};
const config = { governance: DEFAULT_GOVERNANCE } as unknown as BridgeConfig;
const labelFixed = { id: 'textinput-label-height', kind: 'part', component: 'TextInput', part: 'cds--text-input-label-wrapper', height: 'fixed', reason: 'Carbon keeps 24 px for the label row.', by: 'claude' };
const outerFixed = { id: 'textinput-field-height', kind: 'part', component: 'TextInput', part: 'cds--text-input-field-outer-wrapper', height: 'fixed', reason: 'The field keeps its measured height.', by: 'claude' };
const shrink = { id: 'textinput-label-shrink', kind: 'part', component: 'TextInput', part: 'cds--text-input-label-wrapper', height: 4, reason: 'Smaller label row.', by: 'claude' };

describe('figmaFixesProposal', () => {
  const base = { ...input, config, fixesPath: 'figma-fixes.json', tool: 'Bridge (source: test)', source: 'test', summary: 'TextInput keeps its label row height.' };

  it('the change for review: figma-fixes.json, labels, a draft on the component branch', () => {
    const p = figmaFixesProposal({ ...base, proposed: [labelFixed, outerFixed] });
    expect(p.status).toBe('ready');
    if (p.status !== 'ready') return;
    expect(p.branchStem).toBe('bridge/figma-fixes-text-input');
    expect(p.labels).toEqual(expect.arrayContaining(['drafted-by-claude', 'figma-fixes', 'source: test']));
    expect(p.draft).toBe(true);
    expect(JSON.parse(p.fileContents[0]!.content).fixes).toHaveLength(2);
    expect(p.fixes.map((f) => f.reason)).toEqual([labelFixed.reason, outerFixed.reason]);
    expect(p.prBody).toContain('Drafted by Claude through Bridge (source: test)');
  });

  it('refuses fixes that move the component further from the code', () => {
    const p = figmaFixesProposal({ ...base, proposed: [shrink] });
    expect(p).toMatchObject({ status: 'blocked', verdict: 'worse' });
    expect(p.status === 'blocked' && p.why).toContain('further from the code');
  });

  it('throws on an invalid fix or a summary that is not one', () => {
    expect(() => figmaFixesProposal({ ...base, proposed: [{ ...labelFixed, height: 'tall' }] })).toThrow(/^Not proposed: /);
    expect(() => figmaFixesProposal({ ...base, summary: 'short', proposed: [labelFixed] })).toThrow(/summary/);
  });
});
