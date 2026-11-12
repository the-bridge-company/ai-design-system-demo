// @vitest-environment jsdom
// Studio Home from a failed or partial read: never an empty state it cannot be sure of ("Nothing needs you",
// "Nothing in progress", "What do you want to explore?" over the calm harbor). A failed read says why, once; a
// partial one says so in one quiet line.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudioHome, type StudioHomeProps } from './StudioHome';
import { PARTIAL_LINE } from '../../../lib/home-explorations';
import { folderLine, productFolders } from '../../../lib/product-page';
import type { ProductConfig } from '@bridge-ds/core';

const NOW = Date.parse('2026-11-12T10:00:00Z');
const PRODUCTS: ProductConfig[] = [
  { key: 'crm', name: 'Acme CRM' },
  { key: 'library', name: 'Library', default: true },
];

const props = (over: Partial<StudioHomeProps> = {}): StudioHomeProps => ({
  state: 'empty',
  greeting: 'Good evening, Sofia.',
  needs: [],
  branches: [],
  explorations: [],
  health: null,
  now: NOW,
  components: [],
  signedOut: { line: '', button: '', signIn: true },
  failed: null,
  startHrefs: { tokens: '#t', component: '#c', guidance: '#g' },
  products: PRODUCTS,
  recent: true,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('StudioHome, empty versus failed', () => {
  it('truly empty: the calm harbor says nothing needs you, and folders say nothing is in progress', () => {
    const { container } = render(createElement(StudioHome, props()));
    expect(container.textContent).toContain('Nothing needs you');
    expect(container.textContent).toContain('Nothing in progress');
  });

  it('failed: says why once, never "Nothing needs you", "Nothing in progress" nor "What do you want to explore?"', () => {
    const failed = 'Bridge is busy, try again in 5 min.';
    const { container } = render(createElement(StudioHome, props({ failed })));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Nothing needs you/);
    expect(text).not.toMatch(/Nothing in progress/);
    expect(text).not.toMatch(/What do you want to explore\?/);
    // No folder of a product it could not read.
    expect(text).not.toContain('Acme CRM');
    expect(text.split(failed).length - 1).toBe(1);
  });

  it('partial: one quiet line, no "Nothing needs you", and folders without "Nothing in progress"', () => {
    const { container } = render(createElement(StudioHome, props({ partial: true })));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Nothing needs you/);
    expect(text).not.toMatch(/Nothing in progress/);
    // Nor the calm harbor's question, which would say nothing waits.
    expect(text).not.toMatch(/What do you want to explore\?/);
    expect(text.split(PARTIAL_LINE).length - 1).toBe(1);
    // The products the team names are still there (its own, never the defaults).
    expect(text).toContain('Acme CRM');
  });

  it('partial with rows waiting: the rows, and the quiet line once under them', () => {
    const { container } = render(createElement(StudioHome, props({ state: 'busy', partial: true, branches: [{ number: 4, title: 'Dense table spacing', href: '#', stage: 'draft', updated: '2026-11-11T10:00:00Z', reviewer: null, thumb: { kind: 'icon', icon: 'branch' } }] })));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Nothing needs you/);
    expect(text.split(PARTIAL_LINE).length - 1).toBe(1);
  });
});

describe('folderLine', () => {
  it('says "Nothing in progress" only when every read answered', () => {
    expect(folderLine([])).toBe('Nothing in progress');
    expect(folderLine([], ' · ', [], null, true)).toBe('');
    expect(folderLine([{ lifecycle: 'exploring' }], ' · ', [], null, true)).toBe('1 exploring');
    expect(productFolders(PRODUCTS, [], 3, {}, true).map((f) => f.line)).toEqual(['', '']);
  });
});
