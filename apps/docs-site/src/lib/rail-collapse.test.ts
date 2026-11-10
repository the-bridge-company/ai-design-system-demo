import { describe, expect, it } from 'vitest';
import { isRailShortcut, productInitials, RAIL_KEY, railTipText, railToggleLabel, readRailCollapsed, saveRailCollapsed } from './rail-collapse';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('rail choice', () => {
  it('reads open by default, collapsed once saved, open again', () => {
    const s = memory();
    expect(readRailCollapsed(s)).toBe(false);
    saveRailCollapsed(s, true);
    expect(s.m.get(RAIL_KEY)).toBe('collapsed');
    expect(readRailCollapsed(s)).toBe(true);
    saveRailCollapsed(s, false);
    expect(readRailCollapsed(s)).toBe(false);
  });

  it('survives a storage that throws or is missing', () => {
    expect(readRailCollapsed(broken)).toBe(false);
    expect(() => saveRailCollapsed(broken, true)).not.toThrow();
    expect(readRailCollapsed(null)).toBe(false);
    expect(() => saveRailCollapsed(null, true)).not.toThrow();
  });
});

describe('isRailShortcut', () => {
  it('takes [ alone', () => {
    expect(isRailShortcut({ key: '[', target: { tagName: 'BODY' } })).toBe(true);
    expect(isRailShortcut({ key: '[', target: { tagName: 'A' } })).toBe(true);
    expect(isRailShortcut({ key: '[' })).toBe(true);
  });

  it('ignores other keys and modifiers', () => {
    expect(isRailShortcut({ key: ']' })).toBe(false);
    expect(isRailShortcut({ key: '[', ctrlKey: true })).toBe(false);
    expect(isRailShortcut({ key: '[', metaKey: true })).toBe(false);
    expect(isRailShortcut({ key: '[', altKey: true })).toBe(false);
    expect(isRailShortcut({ key: '[', isComposing: true })).toBe(false);
    expect(isRailShortcut({ key: '[', defaultPrevented: true })).toBe(false);
  });

  it('ignores typing in a field', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) expect(isRailShortcut({ key: '[', target: { tagName } })).toBe(false);
    expect(isRailShortcut({ key: '[', target: { tagName: 'DIV', isContentEditable: true } })).toBe(false);
  });
});

describe('words', () => {
  it('labels the toggle by what it does', () => {
    expect(railToggleLabel(false)).toBe('Collapse sidebar');
    expect(railToggleLabel(true)).toBe('Expand sidebar');
  });

  it('adds the waiting count to a tooltip', () => {
    expect(railTipText('Library review', 12)).toBe('Library review · 12 waiting');
    expect(railTipText('  Home \n')).toBe('Home');
    expect(railTipText('Explorations', 0)).toBe('Explorations');
  });
});

describe('productInitials', () => {
  const acme = ['Acme CRM', 'Acme Prints'];
  it('drops the word every product shares', () => {
    expect(productInitials('Acme CRM', acme)).toBe('CR');
    expect(productInitials('Acme Prints', acme)).toBe('Pr');
  });

  it('keeps the first word when products differ', () => {
    expect(productInitials('Acme CRM', ['Acme CRM', 'Checkout'])).toBe('AC');
    expect(productInitials('Checkout', ['Acme CRM', 'Checkout'])).toBe('Ch');
    expect(productInitials('Field ops app')).toBe('FO');
  });

  it('handles one product and short names', () => {
    expect(productInitials('Acme CRM', ['Acme CRM'])).toBe('AC');
    expect(productInitials('x')).toBe('X');
    expect(productInitials('')).toBe('');
  });
});
