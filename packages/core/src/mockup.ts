/**
 * A mockup an exploration starts from: a Figma frame or a Claude Design page, recognised from the shape of its link
 * alone. Nothing is fetched: whether Claude can open it is only known when Claude reads it.
 */

export type MockupKind = 'figma' | 'claude-design';

export interface Mockup {
  kind: MockupKind;
  /** The clean link: https, no tracking query, no fragment. What the exploration keeps. */
  url: string;
  /** The Figma file key, or the Claude Design page id. */
  id: string;
  /** A Figma frame's node id as Figma shows it ("212:4180"). */
  node?: string;
  /** The Figma file's name when the link carries it ("CRM screens"). */
  fileName?: string;
}

/** Why a pasted link cannot be a mockup: a whole Figma page instead of one frame, or neither Figma nor Claude Design. */
export type MockupProblem = 'not-a-frame' | 'unsupported';

/** What the dialog says for each problem, with how to fix it. */
export const MOCKUP_PROBLEM: Record<MockupProblem, string> = {
  'not-a-frame': 'This link opens a whole Figma page. Select one frame in Figma, choose Copy link to selection, and paste that link.',
  unsupported: 'Bridge reads Figma frames and Claude Design pages. This link is neither: paste one of those.',
};

const MAX = 500;

function urlOf(input: string): URL | null {
  const raw = input.trim();
  if (!raw || raw.length > MAX || /\s/.test(raw)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/** "CRM-screens" -> "CRM screens"; Figma puts the file name in the link with dashes for spaces. */
function fileNameOf(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  let s: string;
  try {
    s = decodeURIComponent(slug);
  } catch {
    s = slug;
  }
  s = s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s && s.length <= 120 ? s : undefined;
}

/**
 * The mockup a link points at, or why it cannot be one. Empty input: neither (the field is optional).
 * - Figma: figma.com/design|file/<key>/<name>?node-id=<frame> (a branch link keeps its branch key). No node, or the
 *   page's own node ("0-1"), is a whole page: "not-a-frame".
 * - Claude Design: claude.ai/artifact/<id> or claude.ai/code/artifact/<id>.
 */
export function parseMockupLink(input: string | null | undefined): { mockup: Mockup | null; problem: MockupProblem | null } {
  if (!input?.trim()) return { mockup: null, problem: null };
  const u = urlOf(input);
  if (!u) return { mockup: null, problem: 'unsupported' };
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'figma.com' || host === 'www.figma.com') {
    const [kind, key, ...rest] = parts;
    if ((kind !== 'design' && kind !== 'file') || !key || !/^[A-Za-z0-9]{6,64}$/.test(key)) return { mockup: null, problem: 'unsupported' };
    // figma.com/design/<key>/branch/<branchKey>/<name>: the branch is the file.
    const branch = rest[0] === 'branch' && rest[1] && /^[A-Za-z0-9]{6,64}$/.test(rest[1]) ? rest[1] : null;
    const id = branch ?? key;
    const slug = branch ? rest[2] : rest[0];
    const raw = (u.searchParams.get('node-id') ?? '').trim();
    const m = /^(\d+)[-:](\d+)$/.exec(raw);
    // The page itself has node 0:n: a link to it, or with no node at all, opens the whole page.
    if (!m || m[1] === '0') return { mockup: null, problem: 'not-a-frame' };
    const fileName = fileNameOf(slug);
    // Path segments stay as the link spelled them (already percent-encoded); "file" links open as "design" today.
    const path = ['design', key, ...(branch ? ['branch', branch] : []), ...(slug ? [slug] : [])].join('/');
    return {
      mockup: { kind: 'figma', url: `https://www.figma.com/${path}?node-id=${m[1]}-${m[2]}`, id, node: `${m[1]}:${m[2]}`, ...(fileName ? { fileName } : {}) },
      problem: null,
    };
  }
  if (host === 'claude.ai' || host === 'www.claude.ai') {
    const at = parts[0] === 'artifact' ? 1 : parts[0] === 'code' && parts[1] === 'artifact' ? 2 : -1;
    const id = at > 0 ? parts[at] : undefined;
    if (!id || parts.length !== at + 1 || !/^[A-Za-z0-9-]{6,80}$/.test(id)) return { mockup: null, problem: 'unsupported' };
    return { mockup: { kind: 'claude-design', url: `https://claude.ai/${at === 2 ? 'code/' : ''}artifact/${id}`, id }, problem: null };
  }
  return { mockup: null, problem: 'unsupported' };
}

/** A mockup link as an exploration may keep it, else null. */
export function mockupOf(link: string | null | undefined): Mockup | null {
  return typeof link === 'string' ? parseMockupLink(link).mockup : null;
}

/** "the Figma frame 212:4180 in CRM screens", "the Claude Design page 8f2c41e0". */
export function mockupLabel(m: Mockup): string {
  if (m.kind === 'figma') return `the Figma frame ${m.node}${m.fileName ? ` in ${m.fileName}` : ''}`;
  return `the Claude Design page ${m.id.slice(0, 8)}`;
}

/** What the recognised card says: its name line and what the link says about it. Never fetched. */
export function mockupCard(m: Mockup): { name: string; meta: string } {
  if (m.kind === 'figma') return { name: m.fileName ?? 'Figma frame', meta: `Figma frame ${m.node}${m.fileName ? '' : ` in file ${m.id}`}` };
  return { name: 'Claude Design page', meta: `Page ${m.id.slice(0, 8)} on claude.ai` };
}

/**
 * What Claude is told when an exploration starts from a mockup: open it, rebuild it in the product with the library's
 * pieces only, measure against the mockup and correct, never invent a token name, then list what the mockup uses that
 * the library does not have. Shared by Studio's start lines and the MCP server's brief.
 */
export function mockupBrief(m: Mockup, productName: string, change?: string | null): string {
  const what = (change ?? '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  const open =
    m.kind === 'figma'
      ? `Open it with the Figma tools (get_design_context and get_screenshot on node ${m.node}).`
      : 'Open it in the browser (Claude in Chrome when you have it) and look at its layout, content and states.';
  return [
    `Start from ${mockupLabel(m)}: ${m.url}. ${open}`,
    `Rebuild it in ${productName} using ONLY the library's components and tokens: list them with the Bridge tools (bridge_list_components, bridge_search_tokens) before you build.`,
    'Then measure your build against the mockup (spacing, sizes, type, colors) and correct it until they match.',
    'Never invent a token name: check each one with bridge_get_token or bridge_search_tokens, and never copy the mockup\'s raw values.',
    'Then list what the mockup uses that the library does not have.',
    what ? `This is the change to explore: ${what}.` : '',
    "If you cannot open the mockup, say so in plain words: it may not be shared with you. Ask the designer to share it, then try again.",
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The start line's short form, for the line the designer pastes (Studio's Ready for Claude AI): plain words only, the
 * mockup, its link, the library's pieces only, and what the library lacks. Measuring, correcting and checking tokens are
 * in the exploration's brief (mockupBrief, from bridge_continue_exploration), which Claude gets anyway.
 */
export function mockupLine(m: Mockup, productName: string): string {
  return `Start from ${mockupLabel(m)} (${m.url}): rebuild it in ${productName} with the library's pieces only, then tell me what it uses that the library does not have.`;
}

/** A mockup's own name as an exploration keeps it: one line, 80 characters at most, no em dash; else null. */
export function mockupNameOf(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  const n = name.replace(/\s+/g, ' ').replace(/\s*\u2014\s*/g, ', ').trim().slice(0, 80).trim();
  return n || null;
}

/**
 * The mockup as designers read it on the exploration page ("Started from Contacts v3"): the name Claude read, else the
 * Figma file's name, else "the mockup". Never a node id or a page id.
 */
export function mockupShownName(m: Mockup, name?: string | null): string {
  return mockupNameOf(name) ?? (m.kind === 'figma' ? m.fileName : undefined) ?? 'the mockup';
}

/**
 * The count the exploration page adds after the mockup's name once its pieces are known: "2 pieces the library doesn't
 * have". Null when there is nothing to say: no mockup, the pieces not known yet, or none missing (said once, no noise).
 */
export function mockupPiecesLine(m: Mockup | null, missing: number | null | undefined): string | null {
  if (!m || typeof missing !== 'number' || !(missing > 0)) return null;
  return `${missing} ${missing === 1 ? 'piece' : 'pieces'} the library doesn't have`;
}
