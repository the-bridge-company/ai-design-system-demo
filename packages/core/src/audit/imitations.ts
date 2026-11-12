// Component imitations: product code that rebuilds a pattern the design system already ships, often out of DS parts
// (a DS Link given role="tab" and an underline in CSS), so a count of DS versus non-DS elements calls it adoption.
// The rules come from the DS component inventory: a pattern is checked only when the DS exports the component that
// covers it, and the DS component sources themselves are never checked. An imitation is not adoption: the element
// is left out of the component adoption counts and listed under `imitations` with the DS component to use.
import { blankComments } from './css';
import type { ImitationFinding, ImitationRuleId } from './types';

/** What a DS component covers: ARIA roles, words in class names, words in data attributes. */
export interface ImitationPattern {
  /** The DS component to use. */
  component: string;
  /** Also fits, when the first does not (a radio group of cards is a RadioGroup, not a SegmentedControl). */
  also?: string[];
  /** ARIA roles only this component should render. */
  roles?: string[];
  /** Words in a class name (one segment of `page-tabs`, `xe_tablist`, `navCount`) that name the pattern. */
  classWords?: string[];
  /** Words in a data attribute name (`data-set-tab`) that mark an element as part of the pattern. */
  dataWords?: string[];
}

/**
 * The patterns, keyed by the DS component that covers them, in priority order (a `.chip-btn` is a Tag, not a Button).
 * Every other DS component also covers its own name in kebab case (`.empty-state`, `.code-block`), see imitationRules.
 */
export const IMITATION_PATTERNS: ImitationPattern[] = [
  { component: 'Tabs', roles: ['tab', 'tablist', 'tabpanel'], classWords: ['tab', 'tabs', 'tablist', 'tabpanel'], dataWords: ['tab', 'tabs', 'tablist'] },
  { component: 'SegmentedControl', also: ['RadioGroup'], roles: ['radiogroup', 'radio'], classWords: ['segmented', 'toggle-group'] },
  { component: 'AlertDialog', also: ['Dialog'], roles: ['alertdialog'] },
  { component: 'Dialog', also: ['Drawer', 'Popover'], roles: ['dialog'], classWords: ['modal', 'dialog'] },
  { component: 'Menu', roles: ['menu', 'menubar', 'menuitem', 'menuitemradio', 'menuitemcheckbox'], classWords: ['dropdown'] },
  { component: 'Combobox', also: ['Select'], roles: ['combobox', 'listbox', 'option'] },
  { component: 'Switch', roles: ['switch'], classWords: ['switch'] },
  { component: 'Checkbox', roles: ['checkbox'] },
  { component: 'Slider', roles: ['slider'] },
  { component: 'Progress', roles: ['progressbar'] },
  { component: 'Tooltip', roles: ['tooltip'], classWords: ['tooltip', 'tip'] },
  // Singular words only: `.cl-tags` holds tags, `.xp-chips` holds chips.
  { component: 'Tag', also: ['Badge'], classWords: ['chip', 'tag'] },
  { component: 'Badge', also: ['Tag'], classWords: ['badge', 'pill', 'count', 'counter'] },
  { component: 'Button', also: ['IconButton'], roles: ['button'], classWords: ['btn', 'button'] },
  { component: 'Kbd', classWords: ['kbd'] },
];

/**
 * DS components whose kebab name is too generic to say "imitation" by itself: layout and text primitives, and
 * surfaces any app styles on its own (`.card`, `.table`). Their roles and words above still apply.
 */
const NAME_ONLY_SKIP = new Set(['Card', 'Container', 'Grid', 'Stack', 'Inline', 'Field', 'Form', 'Icon', 'Link', 'Divider', 'VisuallyHidden', 'PageHeader', 'Table', 'Image', 'Input', 'Select', 'TokenValue']);

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Words of a class name: `page-tabs` -> page, tabs; `navCount` -> nav, count; `xe_tablist` -> xe, tablist. */
export function classSegments(cls: string): string[] {
  return kebab(cls).split(/[-_]+/).filter(Boolean);
}

/** Does the class name hold `word` (one segment, or several for `toggle-group`)? */
function hasWord(segs: string[], word: string): boolean {
  const w = word.split('-');
  for (let i = 0; i + w.length <= segs.length; i++) if (w.every((x, k) => segs[i + k] === x)) return true;
  return false;
}

export interface ImitationRules {
  components: Set<string>;
  patterns: ImitationPattern[];
  byRole: Map<string, ImitationPattern>;
}

const rulesCache = new WeakMap<Set<string>, ImitationRules>();

/** The patterns this design system covers: only for components it exports, plus each component's own kebab name. */
export function imitationRules(components: Set<string>): ImitationRules {
  const hit = rulesCache.get(components);
  if (hit) return hit;
  const patterns: ImitationPattern[] = [];
  for (const p of IMITATION_PATTERNS) {
    if (!components.has(p.component)) {
      // The component is not in this DS: fall back to an alternative it does export, or drop the pattern.
      const alt = p.also?.find((c) => components.has(c));
      if (!alt) continue;
      patterns.push({ ...p, component: alt, also: p.also!.filter((c) => c !== alt && components.has(c)) });
      continue;
    }
    patterns.push({ ...p, ...(p.also ? { also: p.also.filter((c) => components.has(c)) } : {}) });
  }
  const named = new Set(patterns.map((p) => p.component));
  for (const c of [...components].sort()) {
    if (NAME_ONLY_SKIP.has(c) || named.has(c)) continue;
    patterns.push({ component: c, classWords: [kebab(c)] });
  }
  const byRole = new Map<string, ImitationPattern>();
  for (const p of patterns) for (const r of p.roles ?? []) if (!byRole.has(r)) byRole.set(r, p);
  const rules = { components, patterns, byRole };
  rulesCache.set(components, rules);
  return rules;
}

/** The pattern a class name names, and the word that says it. Exact look-alike tokens (`pill`) are left to the components count. */
export function classPattern(cls: string, rules: ImitationRules, only?: (p: ImitationPattern) => boolean): { pattern: ImitationPattern; word: string } | undefined {
  const segs = classSegments(cls);
  for (const p of rules.patterns) {
    if (only && !only(p)) continue;
    const word = p.classWords?.find((w) => hasWord(segs, w));
    if (word) return { pattern: p, word };
  }
  return undefined;
}

/** A file of the design system's own components (`Tabs/Tabs.tsx`, `Tabs/Tabs.module.css`, `dom/badge.ts`): never an imitation. */
export function isDsComponentSource(path: string, components: Set<string>): boolean {
  const segs = path.split('/');
  for (let i = 0; i < segs.length - 1; i++) if (components.has(segs[i]!) && segs[i + 1]!.startsWith(segs[i]!)) return true;
  // DOM renderers of the DS package (`@bridge-ds/react/dom`): `react/src/dom/badge.ts`.
  return /(^|\/)react\/src\/dom\//.test(path);
}

/** The family a DS element belongs to: `Tabs.Tab` -> Tabs, `MenuItem` -> Menu when Menu exists. */
const family = (ds: string, components: Set<string>) => {
  const root = ds.split('.')[0]!;
  if (components.has(root)) return root;
  return [...components].filter((c) => root.startsWith(c)).sort((a, b) => b.length - a.length)[0] ?? root;
};
const coversPattern = (dsName: string, p: ImitationPattern, components: Set<string>) => {
  const f = family(dsName, components);
  return f === p.component || (p.also ?? []).includes(f);
};

/** One element as the scanners see it, with the attribute values they could read (empty when dynamic). */
export interface ElementFacts {
  /** Tag or component as written: `button`, `Link`, `Tabs.Tab`. */
  name: string;
  line: number;
  column: number;
  /** The DS component it is, when it is one. */
  ds?: string;
  /** Lower-case native tag, when it is one. */
  native?: string;
  /** Attribute name -> static values it can take (both branches of a condition); [] when dynamic. */
  attrs: Map<string, string[]>;
  /** Static class tokens. */
  classes: string[];
  /** Rendered once per item of a list (`items.map((x) => <button ...>)`). */
  repeated?: boolean;
  /** The element's only content is a separator glyph (`<span>·</span>`). */
  separatorOnly?: string;
}

const COUNT_WORDS = ['count', 'counter'];
/** State modifiers (`is-pill`, `has-tip`) describe a state of something else, not the pattern itself. */
const isModifier = (cls: string) => /^(is|has)-/.test(cls);
const COUNT_TAGS = new Set(['span', 'small', 'sup', 'b', 'strong', 'em', 'i', 'mark', 'output', 'div']);
const BUTTONISH_TAGS = new Set(['a', 'button', 'div', 'span', 'label']);
/** Exact class tokens the components count already reports as look-alikes (`class="pill"`). */
const LOOKALIKE_TOKENS = new Set(['pill', 'badge', 'chip', 'tooltip', 'tip', 'has-tip']);
export const SEPARATOR_GLYPHS = /^\s*[·•]\s*$/;

const finding = (f: ElementFacts, rule: ImitationRuleId, pattern: string, p: ImitationPattern | string): ImitationFinding => {
  const component = typeof p === 'string' ? p : p.component;
  const also = typeof p === 'string' ? [] : (p.also ?? []);
  return { line: f.line, column: f.column, rule, pattern, element: f.name, suggestion: component, ...(also.length ? { also } : {}) };
};

/**
 * Is this element an imitation of a DS component? `aria-pressed` toggles are reported once the file is read
 * (`toggleSuggestion`), so this returns `toggle` findings with Button as a placeholder.
 */
export function elementImitation(f: ElementFacts, rules: ImitationRules): ImitationFinding | undefined {
  const { components } = rules;
  const ds = f.ds;
  // 1. A role only a DS component should render.
  for (const role of f.attrs.get('role') ?? []) {
    const p = rules.byRole.get(role.trim().toLowerCase());
    if (!p) continue;
    if (ds && coversPattern(ds, p, components)) continue;
    // role="button" on a native button or link-as-button is what Button renders; the native count reports it.
    if (role === 'button' && (f.native === 'button' || (ds && coversPattern(ds, rules.patterns.find((x) => x.component === 'Button') ?? p, components)))) continue;
    return finding(f, 'role', `role="${role}"`, p);
  }
  // 2. A data attribute that names the pattern (`data-set-tab`): the element is wired up by hand as one.
  for (const a of f.attrs.keys()) {
    if (!a.startsWith('data-')) continue;
    const segs = a.slice(5).split('-');
    // `data-segmented-control` and the like mark the DS's own DOM renderers.
    if (components.has(segs.map((s) => s[0]!.toUpperCase() + s.slice(1)).join(''))) continue;
    const p = rules.patterns.find((x) => x.dataWords?.some((w) => segs.includes(w)));
    if (p && !(ds && coversPattern(ds, p, components))) return finding(f, 'data-attr', `${a} attribute`, p);
  }
  // 3. aria-pressed: a toggle, one of a group when repeated (see toggleSuggestion).
  if (f.attrs.has('aria-pressed')) {
    const button = rules.patterns.find((x) => x.component === 'Button');
    if (!(ds && button && coversPattern(ds, button, components))) {
      const seg = rules.patterns.find((x) => x.component === 'SegmentedControl');
      const p = f.repeated && seg ? seg : (button ?? seg);
      if (p) return finding(f, 'toggle', 'aria-pressed toggle', p);
    }
  }
  // 4. A class that names a button on a link or plain element, or a count on a text element (`<span class="nav-count">`:
  //    a muted number needs no border to be the count Badge). Chips and pills are judged by their style sheet rules.
  if (!ds || ds === 'Link') {
    for (const cls of f.classes) {
      if (LOOKALIKE_TOKENS.has(cls) || isModifier(cls)) continue;
      const c = classPattern(cls, rules, (p) => p.component === 'Button' || p.component === 'IconButton');
      if (c && (ds === 'Link' || BUTTONISH_TAGS.has(f.native ?? '')) && f.native !== 'button') return finding(f, 'class', `.${cls} on <${f.name}> (a button look)`, c.pattern);
      const segs = classSegments(cls);
      const badge = rules.patterns.find((p) => p.component === 'Badge');
      if (badge && !ds && COUNT_TAGS.has(f.native ?? '') && COUNT_WORDS.some((w) => segs.includes(w))) return finding(f, 'class', `.${cls} on <${f.name}> (a count)`, badge);
    }
  }
  // 5. A separator glyph typed as an element of its own.
  if (f.separatorOnly && !ds && components.has('Divider')) return finding(f, 'separator', `typed separator "${f.separatorOnly.trim()}"`, 'Divider');
  return undefined;
}

/** `aria-pressed` toggles of one file: two or more, or one rendered per item, are a toggle group. */
export function settleToggles(found: ImitationFinding[], rules: ImitationRules): ImitationFinding[] {
  const toggles = found.filter((x) => x.rule === 'toggle');
  const seg = rules.patterns.find((x) => x.component === 'SegmentedControl');
  if (toggles.length < 2 || !seg) return found;
  return found.map((x) => (x.rule === 'toggle' ? { ...x, suggestion: seg.component, ...(seg.also?.length ? { also: seg.also } : {}) } : x));
}

// A template literal part may stop inside an attribute value (`style="--n:${n}"`): an open quote may run to the end.
const TAG_RE = /<([a-zA-Z][\w-]*)\b((?:[^<>"']|"[^"]*(?:"|$)|'[^']*(?:'|$))*)(>|$)/g;
const ATTR_RE = /(?:^|\s)([\w:-]+)\s*=\s*(?:"([^"]*)"?|'([^']*)'?|([^\s"'>]+))/g;

/**
 * Markup built in a string or a template literal part (`<button role="tab" ...>`): every imitation in it.
 * `base` is the string's offset in the file and `pos` turns an offset into line and column.
 */
export function htmlStringImitations(text: string, base: number, pos: (offset: number) => { line: number; column: number }, rules: ImitationRules): ImitationFinding[] {
  const out: ImitationFinding[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    const name = m[1]!;
    const attrs = new Map<string, string[]>();
    const classes: string[] = [];
    for (const a of m[2]!.matchAll(ATTR_RE)) {
      const v = a[2] ?? a[3] ?? a[4] ?? '';
      const n = a[1]!.toLowerCase();
      attrs.set(n, v.includes('${') ? [] : [v]);
      if (n === 'class' || n === 'classname') classes.push(...v.split(/\s+/).filter((t) => t && !t.includes('$')));
    }
    if (/\saria-pressed\b/.test(m[2]!) && !attrs.has('aria-pressed')) attrs.set('aria-pressed', []);
    const at = pos(base + m.index!);
    const facts: ElementFacts = { name, ...at, attrs, classes, native: name.toLowerCase(), repeated: true };
    let f = elementImitation(facts, rules);
    if (!f) {
      // A class that names a tab, segmented or button pattern on any element of the string.
      for (const cls of classes) {
        if (LOOKALIKE_TOKENS.has(cls) || isModifier(cls)) continue;
        const c = classPattern(cls, rules, (p) => ['Tabs', 'SegmentedControl', 'Button', 'IconButton'].includes(p.component));
        if (c && !(c.pattern.component === 'Button' && name === 'button')) {
          f = finding(facts, 'html-string', `class "${cls}" in an HTML string`, c.pattern);
          break;
        }
      }
    } else f = { ...f, rule: 'html-string', pattern: `${f.pattern} in an HTML string` };
    if (f) out.push(f);
  }
  // `</a> · <a ...>`: a separator typed between two elements.
  if (rules.components.has('Divider')) {
    for (const m of text.matchAll(/>([^\S\n]*[·•][^\S\n]*)</g)) {
      out.push({ ...pos(base + m.index! + 1), rule: 'separator', pattern: `typed separator "${m[1]!.trim()}" in an HTML string`, element: 'text', suggestion: 'Divider' });
    }
  }
  return out;
}

/** Properties that give an element its own look: a border, a background, a radius, a shadow. */
const LOOK_PROPS = /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-(color|style|width))?|border-radius|border-(top|bottom)-(left|right)-radius|background(-color|-image)?|box-shadow)$/;
const NO_LOOK = /^(none|0|transparent|inherit|initial|unset|revert|revert-layer)$/i;
const STATE_ATTR_RE = /\[\s*(aria-pressed|role)\s*(?:[~|^$*]?=\s*["']?([\w-]+)["']?)?\s*\]/g;

/** An imitation in a style sheet: a selector that names a DS pattern and draws its own border, background or radius. */
export interface CssImitation extends ImitationFinding {
  /** Class names of the selector that name the pattern: a class used only on the DS component itself is an override, not an imitation. */
  classes?: string[];
  /** Every DS component those classes name: a class set only on one of them styles it. */
  candidates?: string[];
  /** One finding per pattern and file: the hover, selected and variant rules of `.btn` are the same imitation. */
  anchor?: string;
}

/**
 * Style sheet rules that hand-draw a DS pattern: `.page-tabs a[aria-selected="true"] { border-bottom: ... }`,
 * `.rv-seg button[aria-pressed="true"] { background: ... }`. One finding per rule, at its selector.
 */
export function cssImitations(text: string, lang: 'css' | 'scss' | 'less', rules: ImitationRules, pos: (offset: number) => { line: number; column: number }, offset = 0): CssImitation[] {
  const clean = blankComments(text, lang !== 'css');
  const out: CssImitation[] = [];
  const seen = new Set<string>();
  const stack: { selector: string; start: number; props: Set<string> }[] = [];
  let segStart = 0;
  let quote: string | null = null;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quote) {
      if (c === quote && clean[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{') {
      const raw = clean.slice(segStart, i);
      const lead = raw.length - raw.trimStart().length;
      stack.push({ selector: raw.trim(), start: segStart + lead, props: new Set() });
      segStart = i + 1;
    } else if (c === ';' || c === '}') {
      const decl = /^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(clean.slice(segStart, i));
      const top = stack[stack.length - 1];
      if (decl && top && LOOK_PROPS.test(decl[1]!.toLowerCase()) && !NO_LOOK.test(decl[2]!.replace(/\s*!important$/, ''))) top.props.add(decl[1]!.toLowerCase());
      if (c === '}') {
        const block = stack.pop();
        if (block && block.props.size && !block.selector.startsWith('@')) {
          const chain = [...stack.filter((s) => !s.selector.startsWith('@')).map((s) => s.selector), block.selector].join(' ');
          const f = selectorImitation(chain, block.selector, rules);
          if (f && !seen.has(f.anchor!)) {
            seen.add(f.anchor!);
            const { anchor: _a, ...x } = f;
            out.push({ ...pos(offset + block.start), ...x, pattern: `${f.pattern} drawn by hand (${[...block.props].join(', ')})` });
          }
        }
      }
      segStart = i + 1;
    }
  }
  return out;
}

function selectorImitation(chain: string, own: string, rules: ImitationRules): Omit<CssImitation, 'line' | 'column'> | undefined {
  if (/^(from|to|\d+(\.\d+)?%)(\s*,|$)/.test(own) || /:global\(/.test(chain)) return undefined;
  const element = own.replace(/\s+/g, ' ').slice(0, 120);
  const classes = [...chain.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
  const names = (p: ImitationPattern, cls: string) => !LOOKALIKE_TOKENS.has(cls) && !isModifier(cls) && Boolean(p.classWords?.some((w) => hasWord(classSegments(cls), w)));
  for (const p of rules.patterns) {
    const hits = classes.filter((cls) => names(p, cls));
    if (hits.length) {
      // The outermost class that names the pattern: `.page-tabs a[aria-selected] .page-tab-count` is one tab bar.
      const cls = hits[0]!;
      // Every component the classes name (`tab-count`: Tabs and Badge), to recognise an override of any of them.
      const candidates = rules.patterns.filter((q) => hits.some((h) => names(q, h))).flatMap((q) => [q.component, ...(q.also ?? [])]);
      return { rule: 'css', pattern: `.${cls}`, element, suggestion: p.component, ...(p.also?.length ? { also: p.also } : {}), classes: hits, candidates, anchor: `.${cls}` };
    }
  }
  for (const m of chain.matchAll(STATE_ATTR_RE)) {
    const attr = m[1]!.toLowerCase();
    const p = attr === 'role' ? (m[2] ? rules.byRole.get(m[2].toLowerCase()) : undefined) : rules.patterns.find((x) => x.component === 'SegmentedControl');
    if (p && !(attr === 'role' && m[2] === 'button')) {
      const pattern = attr === 'role' ? `[role="${m[2]}"]` : '[aria-pressed]';
      const first = /\.(-?[_a-zA-Z][\w-]*)/.exec(chain)?.[1];
      return { rule: 'css', pattern, element, suggestion: p.component, ...(p.also?.length ? { also: p.also } : {}), anchor: `${first ? `.${first} ` : ''}${pattern}` };
    }
  }
  return undefined;
}

/** Where a class name is used in the markup of the audited files, and on which DS components. */
export type ClassUses = Map<string, { ds: Set<string>; other: number }>;

/**
 * A style sheet finding whose classes are only ever set on the DS component it names (`<Badge className="tab-count">`
 * styled in CSS) is an override of that component, not an imitation of it.
 */
export function isDsOverride(f: CssImitation, uses: ClassUses, components: Set<string>): boolean {
  if (!f.classes?.length) return false;
  return f.classes.every((cls) => {
    const u = uses.get(cls);
    if (!u || u.other > 0 || !u.ds.size) return false;
    const fits = new Set([f.suggestion, ...(f.also ?? []), ...(f.candidates ?? [])]);
    return [...u.ds].every((d) => fits.has(family(d, components)));
  });
}
