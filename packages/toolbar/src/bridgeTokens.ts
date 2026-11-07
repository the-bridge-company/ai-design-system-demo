// The toolbar is Bridge's chrome, not the product: it wears the Bridge brand on any host, whatever that host's design
// system, tokens or global CSS. Its token values come from @bridge-ds/tokens, bundled into the toolbar when it is
// built (the `?raw` import), resolved here for the Bridge brand and compact density in light and dark, every var()
// replaced by its value, and written as plain values scoped to the toolbar's own elements. Nothing is read from the
// host's :root, and the selectors out-rank any token rule a host (or a live token swap) can write.
import tokensCss from '@bridge-ds/tokens/tokens.css?raw';

/** Marks an element (and what is inside it) as Bridge chrome: the toolbar root, the outline layer. */
export const PIN_ATTR = 'data-bridge-pin';
/** Same, as a class, for popups the DS portals out (Tooltip and Popover accept a className, not attributes). */
export const PIN_CLASS = 'bridge-pin';
/** The <style> that holds the toolbar's tokens. */
export const TOKENS_STYLE_ATTR = 'data-bridge-pinned';

type Scope = Record<string, string>;
interface Rule {
  selectors: string[];
  decls: [string, string][];
  media: string | null;
}

/** Top-level rules and the rules of @media blocks, in source order. The generated tokens.css has no other at-rule. */
export function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const block = (text: string, media: string | null) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      // Matching close brace (one level of nesting, for @media).
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) block(body, prelude.slice(6).trim());
      else if (!prelude.startsWith('@')) {
        const decls: [string, string][] = [];
        for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g)) decls.push([m[1]!, m[2]!.trim()]);
        rules.push({ selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean), decls, media });
      }
      i = j;
    }
  };
  block(src, null);
  return rules;
}

/** The specificity of a selector made of :root, [attr], [attr="v"] and :not([...]) on one element, or -1 when it does not match the scope. */
function match(selector: string, scope: Scope): number {
  let spec = 0;
  let rest = selector;
  while (rest.length) {
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^:root/))) {
      spec++;
    } else if ((m = rest.match(/^:not\(\[([\w-]+)(?:="([^"]*)")?\]\)/))) {
      const [, name, value] = m;
      const has = name! in scope && (value === undefined || scope[name!] === value);
      if (has) return -1;
      spec++;
    } else if ((m = rest.match(/^\[([\w-]+)(?:="([^"]*)")?\]/))) {
      const [, name, value] = m;
      const has = name! in scope && (value === undefined || scope[name!] === value);
      if (!has) return -1;
      spec++;
    } else {
      // A selector this resolver does not know (descendants, classes): never the toolbar's own scope.
      return -1;
    }
    rest = rest.slice(m[0].length).trim();
  }
  return spec;
}

/** Every custom property tokens.css gives one element with these attributes, with var() resolved to plain values. */
export function resolveTokens(css: string, scope: Scope, opts: { media?: (query: string) => boolean } = {}): Map<string, string> {
  const raw = new Map<string, { value: string; spec: number; order: number }>();
  let order = 0;
  for (const rule of parseRules(css)) {
    if (rule.media && !(opts.media?.(rule.media) ?? false)) continue;
    const spec = Math.max(...rule.selectors.map((s) => match(s, scope)));
    if (spec < 0) continue;
    for (const [name, value] of rule.decls) {
      order++;
      const prev = raw.get(name);
      if (!prev || spec >= prev.spec) raw.set(name, { value, spec, order });
    }
  }
  const done = new Map<string, string>();
  const resolving = new Set<string>();
  const valueOf = (name: string): string | null => {
    if (done.has(name)) return done.get(name)!;
    const own = raw.get(name);
    if (!own || resolving.has(name)) return null;
    resolving.add(name);
    const value = substitute(own.value);
    resolving.delete(name);
    if (value !== null) done.set(name, value);
    return value;
  };
  // var(--x) and var(--x, fallback), innermost first.
  const substitute = (value: string): string | null => {
    let out = value;
    for (let guard = 0; out.includes('var(') && guard < 50; guard++) {
      const start = out.lastIndexOf('var(');
      let depth = 1;
      let end = start + 4;
      for (; end < out.length && depth; end++) {
        if (out[end] === '(') depth++;
        else if (out[end] === ')') depth--;
      }
      const inner = out.slice(start + 4, end - 1);
      const comma = inner.indexOf(',');
      const ref = (comma < 0 ? inner : inner.slice(0, comma)).trim();
      const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
      const resolved = valueOf(ref) ?? fallback;
      if (resolved === null) return null;
      out = out.slice(0, start) + resolved + out.slice(end);
    }
    return out;
  };
  for (const name of raw.keys()) valueOf(name);
  return done;
}

/** Selectors of the toolbar's own elements, at a specificity no token rule reaches (tokens.css tops out at 0,2,0). */
const ROOTS = [`[${PIN_ATTR}][${PIN_ATTR}][${PIN_ATTR}]`, `.${PIN_CLASS}.${PIN_CLASS}.${PIN_CLASS}`];
const at = (suffix = '') => ROOTS.map((r) => r + suffix).join(',\n');
const body = (decls: Iterable<[string, string]>) => [...decls].map(([n, v]) => `  ${n}: ${v};`).join('\n');

/** The stylesheet that gives the toolbar's elements the Bridge tokens: light by default, dark under data-theme="dark". */
export function bridgeTokenSheet(css: string = tokensCss): string {
  const base = { 'data-brand': 'bridge', 'data-density': 'compact' };
  const light = resolveTokens(css, { ...base, 'data-theme': 'light' });
  const darkValues = resolveTokens(css, { ...base, 'data-theme': 'dark' });
  const reduce = (q: string) => /prefers-reduced-motion:\s*reduce/.test(q);
  const lightReduced = resolveTokens(css, { ...base, 'data-theme': 'light' }, { media: reduce });
  const darkOnly = [...darkValues].filter(([n, v]) => light.get(n) !== v);
  const reducedOnly = [...lightReduced].filter(([n, v]) => light.get(n) !== v);
  // A portaled popup carries the class; the scope attributes sit on its positioner, one level up.
  const dark = `${at('[data-theme="dark"]')},\n[data-theme="dark"] > ${ROOTS[1]}`;
  const parts = [`${at()} {\n${body(light)}\n}`, `${dark} {\n${body(darkOnly)}\n}`];
  if (reducedOnly.length) parts.push(`@media (prefers-reduced-motion: reduce) {\n${at()} {\n${body(reducedOnly)}\n}\n}`);
  // The positioner of a portaled popup: only its layer (z-index), in a rule of its own (:has).
  const layers = [...light].filter(([n]) => n.startsWith('--layer-'));
  parts.push(`:has(> ${ROOTS[1]}) {\n${body(layers)}\n}`);
  return parts.join('\n');
}

let sheet: string | null = null;

/** Adds the toolbar's token stylesheet to <head> once, last, so it also follows the page's own stylesheets. */
export function installBridgeTokens(doc: Document = document): HTMLStyleElement {
  let el = doc.head.querySelector<HTMLStyleElement>(`style[${TOKENS_STYLE_ATTR}]`);
  if (!el) {
    el = doc.createElement('style');
    el.setAttribute(TOKENS_STYLE_ATTR, '');
    el.textContent = sheet ??= bridgeTokenSheet();
    doc.head.appendChild(el);
  }
  return el;
}
