// Behaviors of a component: short sentences in designer words on how it reacts ("Enter picks and closes"), kept in
// the `behaviors` list of <Name>.docs.json. One source drives three readers: the spec on the Library page, the "Try
// it" stage there (the real component, performed by the reader) and what AI agents read through the MCP server.
//
// Each behavior has a stable id shared across components (close-on-escape) and a family shared across components
// (Closing), while the text is the component's own wording ("Closes on Escape" on Select, "Escape closes the list" on
// Combobox). Ids follow the component version: an agent reads them with the version of the package that ships them.
// Pure: no I/O.

/** A docs.json example node ({ c, p, children }), as the docs examples write it. */
export type BehaviorExampleNode = string | { c: string; p?: Record<string, unknown>; children?: BehaviorExampleNode[] };

export interface ComponentBehavior {
  /** Stable id, kebab-case, shared by every component that behaves the same way: "close-on-escape". */
  id: string;
  /** Shared family name, one of BEHAVIOR_FAMILIES. The Library groups the list by it. */
  family: string;
  /** The component's own wording, in sentence case: "Closes on Escape". */
  text: string;
  /** What the stage tells the reader to do to see it, one line: "Open the list, then press Esc". Page only. */
  try?: string;
  /**
   * Keys that perform it, as KeyboardEvent.key values ("Enter", "ArrowDown", "Escape", " " is written "Space"). Each one
   * works alone. One pointer gesture is written here too: `click-outside` (CLICK_OUTSIDE), a click away from the
   * component and its popup, so a mouse behavior ("Closes on a click outside") can be replayed and shown like a key.
   */
  keys?: string[];
  /** What a screen reader says when it happens, shown as "Expected announcement". */
  announces?: string;
  /** The example the stage draws to try this behavior, when the docs preview cannot show it (a loading state). */
  example?: BehaviorExampleNode;
}

/** What an agent reads: the behavior without what only the stage uses (its line and its example). */
export type AgentBehavior = Pick<ComponentBehavior, 'id' | 'family' | 'text' | 'keys' | 'announces'>;

/** The shared family names, in the order a list reads best. A new family is a deliberate change here. */
export const BEHAVIOR_FAMILIES = ['Opening', 'Filtering', 'Moving', 'Picking', 'Closing', 'Focus', 'Feedback'] as const;
export type BehaviorFamily = (typeof BEHAVIOR_FAMILIES)[number];

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EM_DASH = /\u2014/;

export interface BehaviorIssue {
  field: string;
  message: string;
}

const isText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

/** What blocks a `behaviors` list: a known shape, kebab-case ids used once, shared families, no em dash. Absent is fine. */
export function validateBehaviors(list: unknown): BehaviorIssue[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return [{ field: 'behaviors', message: 'Write behaviors as a list.' }];
  const out: BehaviorIssue[] = [];
  const seen = new Set<string>();
  list.forEach((b: unknown, i) => {
    const at = `behaviors.${i}`;
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      out.push({ field: at, message: 'Give every behavior an id, a family and a sentence.' });
      return;
    }
    const o = b as Record<string, unknown>;
    if (!isText(o.id) || !ID.test(o.id)) out.push({ field: `${at}.id`, message: 'Give the behavior a kebab-case id, like close-on-escape.' });
    else if (seen.has(o.id)) out.push({ field: `${at}.id`, message: `The id ${o.id} is used twice: each behavior has its own.` });
    else seen.add(o.id);
    if (!isText(o.family) || !(BEHAVIOR_FAMILIES as readonly string[]).includes(o.family)) {
      out.push({ field: `${at}.family`, message: `Use a shared family: ${BEHAVIOR_FAMILIES.join(', ')}.` });
    }
    if (!isText(o.text)) out.push({ field: `${at}.text`, message: 'Say the behavior in one short sentence.' });
    if (o.keys !== undefined && (!Array.isArray(o.keys) || !o.keys.length || !o.keys.every(isText))) {
      out.push({ field: `${at}.keys`, message: 'List the keys by name, like ["Enter"], or leave keys out.' });
    }
    if (o.try !== undefined && !isText(o.try)) out.push({ field: `${at}.try`, message: 'Say what to do on the stage in one line, or leave try out.' });
    if (o.announces !== undefined && !isText(o.announces)) out.push({ field: `${at}.announces`, message: 'Fill or remove the announcement.' });
    if (o.example !== undefined && (typeof o.example !== 'object' || o.example === null || typeof (o.example as { c?: unknown }).c !== 'string')) {
      out.push({ field: `${at}.example`, message: 'An example names a component: { "c": "Combobox", "p": { ... } }.' });
    }
    if (EM_DASH.test(JSON.stringify([o.text, o.try, o.announces]))) out.push({ field: `${at}.text`, message: 'Replace the em dashes with a colon, a comma or two sentences.' });
  });
  return out;
}

/**
 * The behaviors a page can show, from any docs.json (a repository Bridge does not control may write any shape):
 * well-formed entries only, keys and announcement kept when they are text. Empty when there are none.
 */
export function readBehaviors(list: unknown): ComponentBehavior[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((b: unknown): ComponentBehavior[] => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return [];
    const o = b as Record<string, unknown>;
    if (!isText(o.id) || !isText(o.family) || !isText(o.text)) return [];
    const keys = Array.isArray(o.keys) ? o.keys.filter(isText) : [];
    const example = o.example && typeof o.example === 'object' && typeof (o.example as { c?: unknown }).c === 'string' ? (o.example as BehaviorExampleNode) : undefined;
    return [
      {
        id: o.id,
        family: o.family,
        text: o.text,
        ...(isText(o.try) ? { try: o.try } : {}),
        ...(keys.length ? { keys } : {}),
        ...(isText(o.announces) ? { announces: o.announces } : {}),
        ...(example ? { example } : {}),
      },
    ];
  });
}

/** Behaviors grouped by family: shared families in BEHAVIOR_FAMILIES order, any other after them, in order of appearance. */
export function behaviorGroups(list: readonly ComponentBehavior[]): { family: string; items: ComponentBehavior[] }[] {
  const groups = new Map<string, ComponentBehavior[]>();
  for (const b of list) (groups.get(b.family) ?? groups.set(b.family, []).get(b.family)!).push(b);
  const rank = (f: string) => {
    const i = (BEHAVIOR_FAMILIES as readonly string[]).indexOf(f);
    return i < 0 ? BEHAVIOR_FAMILIES.length : i;
  };
  return [...groups.entries()].map(([family, items]) => ({ family, items })).sort((a, b) => rank(a.family) - rank(b.family));
}

/** The behaviors an agent reads ({ id, family, text, keys?, announces? }), from any docs.json value. */
export const agentBehaviors = (list: unknown): AgentBehavior[] => readBehaviors(list).map(({ example: _example, try: _try, ...b }) => b);

/** The pointer gesture a behavior's `keys` may hold: a click away from the component and its popup. */
export const CLICK_OUTSIDE = 'click-outside';

/** How a key reads on a page: "↓" for ArrowDown, "Esc" for Escape, "Click outside" for the gesture (the Kbd component gives each its full name). */
export function keyLabel(key: string): string {
  const map: Record<string, string> = { ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', ' ': 'Space', [CLICK_OUTSIDE]: 'Click outside' };
  return map[key] ?? key;
}
