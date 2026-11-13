// @vitest-environment jsdom
// Settings bands before their islands read: the members band reserves one row per person (the count this browser saw
// last, the sample team's five, else three), in the real row's boxes.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEMBER_ROWS_DEFAULT, MembersSkeleton, SAMPLE_MEMBER_ROWS, TeamNameSkeleton } from './SettingsSkeletons';
import { SAMPLE_CAST } from '../../../lib/demo-cast';
import { SAMPLE_PRODUCT_ROWS } from './ProductsNav';

vi.mock('../../../scripts/repo-context', () => ({ repoContext: () => ({ owner: 'acme', repo: 'ds', hosted: true }), siteConfig: () => ({}) }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Settings skeletons', () => {
  it('draws one member row per person, in the boxes of a member row, hidden from assistive tech', () => {
    const { container } = render(createElement(MembersSkeleton, { rows: SAMPLE_MEMBER_ROWS }));
    expect(container.querySelectorAll('.mem-skel-row')).toHaveLength(5);
    expect(container.querySelectorAll('.mem-skel-row .mem-person .mem-name, .mem-skel-row .mem-person .mem-line')).toHaveLength(10);
    expect(container.querySelector('.mem-skel')!.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('table')!.getAttribute('aria-hidden')).toBe('true');
  });

  it("knows the sample team's numbers: five people, two products in the nav", () => {
    expect(SAMPLE_MEMBER_ROWS).toBe(SAMPLE_CAST.length);
    expect(SAMPLE_MEMBER_ROWS).toBe(5);
    expect(MEMBER_ROWS_DEFAULT).toBe(3);
    expect(SAMPLE_PRODUCT_ROWS).toBe(2);
  });

  it('reserves the count this browser saw last, else the sample team, else three', async () => {
    const { memberRowsFor, memberRowsKey } = await import('./MembersSection');
    expect(memberRowsFor('globex/tokens')).toBe(3);
    expect(memberRowsFor('acme-design-demo/bridge-demo-ds')).toBe(5);
    localStorage.setItem(memberRowsKey('Globex/Tokens'), '7');
    expect(memberRowsFor('globex/tokens')).toBe(7);
  });

  it("General's row keeps its label and help as they stay", () => {
    const { container } = render(createElement(TeamNameSkeleton));
    expect(container.querySelector('.set-row-label')!.textContent).toBeTruthy();
    expect(container.querySelector('.set-row-value .set-who')).not.toBeNull();
  });
});
