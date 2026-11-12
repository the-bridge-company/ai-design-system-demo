// A team's Library shell paints its previews with the team's own token values. The site's stylesheet declares Bridge's
// tokens on every [data-theme] scope; on a team's Library, the preview scopes inside the page (specimen panels, token
// swatches, contrast tiles, type and shape samples) get the team's resolved values on top, per brand and theme. The
// page chrome keeps Bridge's.
//
// Token values come from a repository Bridge does not control: names pass safeCustomPropertyName, values
// safeSpecimenValue, and both reach the page through the CSSOM (setProperty on a constructed stylesheet), never as
// stylesheet text. Brand and theme names only make a selector when they are plain slugs.
import type { RepoModel } from '@bridge-ds/core';
import { safeCustomPropertyName, safeSpecimenValue } from '../lib/token-specimens';

const SLUG = /^[a-z0-9][a-z0-9-]*$/i;

export interface TeamTokenScope {
  brand: string;
  theme: string;
  /** Custom property name -> resolved value. */
  vars: Record<string, string>;
}

/** The team's resolved token values per brand and theme, checked. Pure. */
export function teamTokenScopes(model: Pick<RepoModel, 'tokens'>): TeamTokenScope[] {
  const rows = model.tokens.rows;
  const out: TeamTokenScope[] = [];
  for (const brand of rows.brands.filter((b) => SLUG.test(b))) {
    for (const theme of rows.themes.filter((t) => SLUG.test(t))) {
      const vars: Record<string, string> = {};
      const put = (path: string, css: unknown) => {
        const name = safeCustomPropertyName(path);
        const value = safeSpecimenValue(css);
        if (name && value) vars[name] = value;
      };
      for (const p of rows.primitives) put(p.path, p.css);
      for (const t of rows.all) put(t.path, t.brands[brand]?.[theme]?.css ?? t.modes[theme]?.css);
      out.push({ brand, theme, vars });
    }
  }
  return out;
}

/** The selectors the values go to, one per scope kind: the preview scopes inside the page, never the chrome around it. */
export function scopeSelectorList(brand: string, theme: string): string[] {
  const shell = ':root[data-library-shell]';
  return [
    `${shell} main [data-theme="${theme}"][data-brand="${brand}"]`,
    `${shell}[data-theme="${theme}"][data-preview-brand="${brand}"] main :is(.fd-pv, .fd-stage):not([data-theme])`,
  ];
}

/** Where the values go, as one selector list. */
export function scopeSelectors(brand: string, theme: string): string {
  return scopeSelectorList(brand, theme).join(', ');
}

/**
 * One empty rule per selector: a browser that rejects one selector (an older engine without :is()) throws on
 * insertRule ("Failed to execute 'insertRule'"), and a selector list fails as a whole, so each selector gets its own
 * rule and a rejected one only drops itself. Returns the rules that took. Never throws.
 */
export function insertScopeRules(sheet: Pick<CSSStyleSheet, 'insertRule' | 'cssRules'>, selectors: readonly string[]): CSSStyleRule[] {
  const out: CSSStyleRule[] = [];
  for (const selector of selectors) {
    try {
      const index = sheet.insertRule(`${selector} {}`, sheet.cssRules.length);
      const rule = sheet.cssRules[index];
      if (rule && 'style' in rule) out.push(rule as CSSStyleRule);
    } catch {
      /* This browser does not read that selector: the previews keep Bridge's values there. */
    }
  }
  return out;
}

let sheet: CSSStyleSheet | null = null;

/** Paints the team's values on the previews of this page (once per page; a second call replaces the first). */
export function applyTeamTokens(model: Pick<RepoModel, 'tokens'>, doc: Document = document) {
  if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in doc)) return;
  const next = new CSSStyleSheet();
  for (const scope of teamTokenScopes(model)) {
    for (const rule of insertScopeRules(next, scopeSelectorList(scope.brand, scope.theme))) {
      for (const [name, value] of Object.entries(scope.vars)) rule.style.setProperty(name, value);
    }
  }
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets.filter((s) => s !== sheet), next];
  sheet = next;
}
