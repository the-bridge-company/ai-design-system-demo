// Start from a mockup: a Figma frame or a Claude Design page recognised from its link alone, the brief Claude gets,
// and the link the exploration keeps.
import { describe, expect, it } from 'vitest';
import { explorationMockupOf, explorationPrBody, parseExplorationBody } from '../src/explorations';
import { MOCKUP_PROBLEM, mockupBrief, mockupCard, mockupLabel, mockupLine, mockupOf, parseMockupLink } from '../src/mockup';
import { startBrief } from '../src/products';

const FRAME = 'https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180&t=abc123-1';

describe('parseMockupLink', () => {
  it('empty is neither a mockup nor a problem: the field is optional', () => {
    expect(parseMockupLink('')).toEqual({ mockup: null, problem: null });
    expect(parseMockupLink('   ')).toEqual({ mockup: null, problem: null });
    expect(parseMockupLink(null)).toEqual({ mockup: null, problem: null });
  });

  it('recognises a Figma frame link and keeps a clean link, without the tracking query', () => {
    expect(parseMockupLink(FRAME)).toEqual({
      mockup: { kind: 'figma', url: 'https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180', id: 'k3P9xQab', node: '212:4180', fileName: 'CRM screens' },
      problem: null,
    });
    // An older "file" link, no www, a colon in the node, no https: all the same frame.
    expect(parseMockupLink('figma.com/file/k3P9xQab/CRM-screens?node-id=212%3A4180').mockup?.url).toBe('https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180');
    // A file name with encoded characters reads plain.
    expect(parseMockupLink('https://www.figma.com/design/k3P9xQab/Sales%20rework?node-id=40-912').mockup?.fileName).toBe('Sales rework');
    // A branch: the branch key is the file.
    const b = parseMockupLink('https://www.figma.com/design/k3P9xQab/branch/Br4nchKey9/CRM-screens?node-id=1-2').mockup!;
    expect(b).toMatchObject({ id: 'Br4nchKey9', node: '1:2', fileName: 'CRM screens', url: 'https://www.figma.com/design/k3P9xQab/branch/Br4nchKey9/CRM-screens?node-id=1-2' });
  });

  it('a Figma link to a whole page is "not a frame"', () => {
    expect(parseMockupLink('https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=0-1')).toEqual({ mockup: null, problem: 'not-a-frame' });
    expect(parseMockupLink('https://www.figma.com/design/k3P9xQab/CRM-screens')).toEqual({ mockup: null, problem: 'not-a-frame' });
    expect(MOCKUP_PROBLEM['not-a-frame']).toMatch(/Copy link to selection/);
  });

  it('recognises a Claude Design page, from claude.ai or Claude Code', () => {
    expect(parseMockupLink('https://claude.ai/artifact/8f2c41e0-1b2c-4d5e-9f00-112233445566?x=1#top')).toEqual({
      mockup: { kind: 'claude-design', url: 'https://claude.ai/artifact/8f2c41e0-1b2c-4d5e-9f00-112233445566', id: '8f2c41e0-1b2c-4d5e-9f00-112233445566' },
      problem: null,
    });
    expect(parseMockupLink('https://claude.ai/code/artifact/abc123def').mockup).toMatchObject({ kind: 'claude-design', url: 'https://claude.ai/code/artifact/abc123def' });
  });

  it('anything else is unsupported, with a sentence that says what to paste', () => {
    for (const bad of [
      'https://miro.com/app/board/uXjVN1q2=/',
      'https://www.figma.com/board/k3P9xQab/Ideas?node-id=1-2',
      'https://www.figma.com/proto/k3P9xQab/CRM?node-id=1-2',
      'https://claude.ai/chat/8f2c41e0',
      'https://claude.ai/artifact/',
      'https://evil.com/claude.ai/artifact/abcdef12',
      'https://figma.com.evil.com/design/k3P9xQab/x?node-id=1-2',
      'javascript:alert(1)',
      'not a link',
    ])
      expect(parseMockupLink(bad), bad).toEqual({ mockup: null, problem: 'unsupported' });
    expect(MOCKUP_PROBLEM.unsupported).toBe('Bridge reads Figma frames and Claude Design pages. This link is neither: paste one of those.');
  });
});

describe('what the dialog and Claude say', () => {
  const frame = parseMockupLink(FRAME).mockup!;
  const page = parseMockupLink('https://claude.ai/artifact/8f2c41e0-1b2c').mockup!;

  it('labels and the recognised card say only what the link says', () => {
    expect(mockupLabel(frame)).toBe('the Figma frame 212:4180 in CRM screens');
    expect(mockupLabel(page)).toBe('the Claude Design page 8f2c41e0');
    expect(mockupCard(frame)).toEqual({ name: 'CRM screens', meta: 'Figma frame 212:4180' });
    expect(mockupCard(page)).toEqual({ name: 'Claude Design page', meta: 'Page 8f2c41e0 on claude.ai' });
  });

  it('the brief: rebuild with the library only, measure and correct, never invent a token, list what is missing', () => {
    const b = mockupBrief(frame, 'Acme CRM', ' Contacts page with a quick filter. ');
    expect(b).toMatch(/^Start from the Figma frame 212:4180 in CRM screens: https:\/\/www\.figma\.com\/design\/k3P9xQab\/CRM-screens\?node-id=212-4180\./);
    expect(b).toContain('get_design_context');
    expect(b).toContain("Rebuild it in Acme CRM using ONLY the library's components and tokens");
    expect(b).toContain('measure your build against the mockup');
    expect(b).toContain('Never invent a token name: check each one with bridge_get_token or bridge_search_tokens');
    expect(b).toContain('list what the mockup uses that the library does not have');
    expect(b).toContain('This is the change to explore: Contacts page with a quick filter.');
    expect(b).not.toMatch(/—/);
    expect(mockupBrief(page, 'Acme CRM')).toContain('Claude in Chrome');
  });

  it('startBrief: the mockup decides, the live page only shows today; else the live page; else nothing', () => {
    expect(startBrief({ mockup: frame, startPage: 'https://acme.com/contacts' }, 'Acme CRM')).toMatch(/https:\/\/acme\.com\/contacts shows how Acme CRM looks today; the mockup decides\.$/);
    expect(startBrief({ startPage: 'https://acme.com/contacts' }, 'Acme CRM')).toMatch(/^Start from https:\/\/acme\.com\/contacts, a page of Acme CRM/);
    expect(startBrief({}, 'Acme CRM')).toBeNull();
  });
});

describe('the exploration keeps the mockup', () => {
  const ctx = { owner: 'acme', repo: 'ds', packages: [], apps: {} };

  it('in its block and its pull request body, and reads it back', () => {
    const body = explorationPrBody({ name: 'Contacts quick filter', purpose: '', mockup: FRAME }, ctx);
    const e = parseExplorationBody(body)!;
    expect(e.mockup).toBe('https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180');
    expect(explorationMockupOf(e)?.kind).toBe('figma');
    expect(body).toContain('**Mockup.** Starts from the Figma frame 212:4180 in CRM screens (https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180), rebuilt with the library.');
  });

  it('never keeps a link that is not a mockup', () => {
    expect(parseExplorationBody(explorationPrBody({ name: 'X', purpose: '', mockup: 'javascript:alert(1)' }, ctx))!.mockup).toBeUndefined();
    expect(mockupOf('https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=0-1')).toBeNull();
  });
});

describe('mockupLine', () => {
  it('one sentence for the line the designer pastes: the mockup, its link and the four rules', () => {
    const m = parseMockupLink(FRAME).mockup!;
    expect(mockupLine(m, 'Acme CRM')).toBe(
      "Start from the Figma frame 212:4180 in CRM screens (https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180): rebuild it in Acme CRM with the library's pieces only, measure it against the mockup and correct, never invent a token name (check with bridge_get_token), then tell me what it uses that the library does not have.",
    );
  });
});
