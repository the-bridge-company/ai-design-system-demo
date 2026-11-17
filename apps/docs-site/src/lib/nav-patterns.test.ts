import { describe, expect, it } from 'vitest';
import { navFor, STUDIO_PATTERNS_HREF, studioNav } from './nav';

describe('Studio nav: Patterns', () => {
  const design = (nav: ReturnType<typeof studioNav>) => nav.filter((e) => e.place === 'design-system').map((e) => e.label);

  it('sits under Design system right after Components', () => {
    expect(design(studioNav())).toEqual(['Components', 'Patterns', 'Tokens', 'Quality']);
    const entry = studioNav().find((e) => e.label === 'Patterns')!;
    expect(entry).toMatchObject({ href: STUDIO_PATTERNS_HREF, icon: 'hand', place: 'design-system' });
    expect(entry.meta).not.toContain('—');
  });

  it('shows for every design system, with or without patterns: never built hidden (the page says when there is none)', () => {
    expect(navFor('studio').find((e) => e.label === 'Patterns')).not.toHaveProperty('until');
    expect(navFor('library').find((e) => e.label === 'Patterns')).not.toHaveProperty('until');
  });
});
