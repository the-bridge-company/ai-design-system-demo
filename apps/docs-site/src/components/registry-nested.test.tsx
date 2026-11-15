// Example nodes inside props (a Badge in a Select option's `badge`) draw as elements in every client renderer, as the
// static one does (components/Example.tsx): a raw { c, p, children } object took the Library edit page down.
import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { resolveNestedNodes } from './registry';

describe('resolveNestedNodes', () => {
  it('draws nodes at any depth and leaves other values as they are', () => {
    const drawn: string[] = [];
    const out = resolveNestedNodes(
      { options: [{ value: 'a', label: 'A', badge: { c: 'Badge', p: { tone: 'info' }, children: ['New'] } }], size: 'sm' },
      (n) => {
        drawn.push(n.c);
        return <span>{n.c}</span>;
      },
    ) as { options: { badge: unknown; label: string }[]; size: string };
    expect(drawn).toEqual(['Badge']);
    expect(isValidElement(out.options[0]!.badge)).toBe(true);
    expect(out.options[0]!.label).toBe('A');
    expect(out.size).toBe('sm');
  });
});
