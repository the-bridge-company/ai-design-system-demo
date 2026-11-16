import { describe, expect, it } from 'vitest';
import { navPatternsKey, notePatterns, rememberedPatterns, shownDesignPages } from './nav-patterns';
import { navFor, STUDIO_PATTERNS_HREF, studioNav } from './nav';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('Studio nav: Patterns', () => {
  const design = (nav: ReturnType<typeof studioNav>) => nav.filter((e) => e.place === 'design-system').map((e) => e.label);

  it("sits under Design system right after Components on Bridge's own Studio, which has patterns", () => {
    expect(design(studioNav())).toEqual(['Components', 'Patterns', 'Tokens', 'Quality']);
    const entry = studioNav().find((e) => e.label === 'Patterns')!;
    expect(entry).toMatchObject({ href: STUDIO_PATTERNS_HREF, icon: 'hand', place: 'design-system' });
    expect(entry.until).toBeUndefined();
    expect(entry.meta).not.toContain('—');
  });

  it("is built hidden on a team's Studio, shown once its data has patterns", () => {
    const entry = navFor('studio', { team: true }).find((e) => e.label === 'Patterns')!;
    expect(entry.until).toBe('patterns');
    const pages = navFor('studio', { team: true }).filter((e) => e.place === 'design-system');
    expect(shownDesignPages(pages, false).map((p) => p.label)).toEqual(['Components', 'Tokens', 'Quality']);
    expect(shownDesignPages(pages, true).map((p) => p.label)).toEqual(['Components', 'Patterns', 'Tokens', 'Quality']);
  });

  it("remembers per team whether it has patterns, nothing for a team never read", () => {
    const store = memory();
    expect(rememberedPatterns('acme-design-demo/bridge-demo-ds', store)).toBeNull();
    notePatterns('Acme-Design-Demo/bridge-demo-ds', true, store);
    expect(rememberedPatterns('acme-design-demo/bridge-demo-ds', store)).toBe(true);
    notePatterns('acme/ds', false, store);
    expect(rememberedPatterns('acme/ds', store)).toBe(false);
    expect(navPatternsKey('A/B')).toBe('bridge.nav.patterns:a/b');
    expect(rememberedPatterns(null, store)).toBeNull();
    expect(rememberedPatterns('acme/ds', null)).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(rememberedPatterns('acme/ds', broken)).toBeNull();
    expect(() => notePatterns('acme/ds', true, broken)).not.toThrow();
  });
});
