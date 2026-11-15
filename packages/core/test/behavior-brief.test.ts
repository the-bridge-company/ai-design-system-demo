// Building a behavior request (phase 2, PR 2): the brief a developer copies for Claude, the Base UI primitive read
// from the source, who made it the default read from Bridge's comment, and the path to Shipped through Being built.
import { describe, expect, it } from 'vitest';
import {
  assembleBuildRequests,
  basePrimitivesOf,
  behaviorBrief,
  behaviorDefaultComment,
  behaviorRequestOf,
  buildRequestBrief,
  composeRequestIssue,
  madeDefaultOf,
  requestBrief,
  type BehaviorAsk,
} from '../src/index';

const ask: BehaviorAsk = { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the highlighted option, then moves to the next field', where: 'Checkout' };
const req = behaviorRequestOf('Select', ask, { requestedBy: 'sofia' });
const facts = {
  keys: ['Tab'],
  docsPath: 'packages/react/src/components/Select/Select.docs.json',
  files: ['packages/react/src/components/Select/Select.tsx', 'packages/react/src/components/Select/Select.docs.json', 'packages/react/src/components/Select/Select.test.tsx'],
  primitives: [{ name: 'Select', module: '@base-ui/react/select' }],
};

describe('basePrimitivesOf', () => {
  it('names the primitive a source imports, helpers and types left out', () => {
    const src = [
      "import { forwardRef } from 'react';",
      "import { Select as BaseSelect } from '@base-ui/react/select';",
      "import { mergeProps } from '@base-ui/react/merge-props';",
      "import { useRender } from '@base-ui/react/use-render';",
      "import type { Popover } from '@base-ui/react/popover';",
      "import { Menu } from '@base-ui-components/react/menu';",
    ].join('\n');
    expect(basePrimitivesOf(src)).toEqual([
      { name: 'Select', module: '@base-ui/react/select' },
      { name: 'Menu', module: '@base-ui-components/react/menu' },
    ]);
    expect(basePrimitivesOf("import { Button } from './Button';")).toEqual([]);
    expect(basePrimitivesOf(null)).toEqual([]);
  });
});

describe('madeDefaultOf', () => {
  it('reads who made it the default and when, from the comment Bridge writes (the latest wins)', () => {
    expect(madeDefaultOf([{ body: 'A question', created_at: '2026-11-14T09:00:00Z' }, { body: behaviorDefaultComment({ name: 'Dana' }), created_at: '2026-11-15T09:00:00Z' }])).toEqual({ by: 'Dana', at: '2026-11-15T09:00:00Z' });
    expect(madeDefaultOf([{ body: behaviorDefaultComment('lee'), createdAt: '2026-11-15T09:00:00Z' }])).toEqual({ by: '@lee', at: '2026-11-15T09:00:00Z' });
    // The words of the first release ("Made the default by @lee").
    expect(madeDefaultOf([{ body: 'Made the default by @lee in Bridge Studio.\n\n<sub>x</sub>' }])).toEqual({ by: '@lee', at: null });
    expect(madeDefaultOf([{ body: 'Looks good' }])).toBeNull();
  });
});

describe('the brief for Claude', () => {
  it('says the change, the docs.json entry to update, the test that presses the keys and how to close it', () => {
    const b = behaviorBrief(req, { issue: 75, issueUrl: 'https://github.com/acme/ds/issues/75', facts });
    expect(b).toContain('Build Bridge behavior request #75 (https://github.com/acme/ds/issues/75)');
    expect(b).toContain('Behavior: tab-leaves (keys: Tab)');
    expect(b).toContain('Today: Tab leaves without picking');
    expect(b).toContain('Wanted: Tab picks the highlighted option, then moves to the next field');
    expect(b).toContain('Where it gets in the way: Checkout');
    expect(b).toContain('Base UI: it wraps Select (@base-ui/react/select)');
    expect(b).toContain('- packages/react/src/components/Select/Select.test.tsx');
    expect(b).toContain('Update the `tab-leaves` entry of the `behaviors` list in packages/react/src/components/Select/Select.docs.json');
    expect(b).toContain('say in the changeset that `tab-leaves` is deprecated');
    expect(b).toContain('Add a test that presses Tab');
    expect(b).toContain('"Closes #75"');
    expect(b).not.toMatch(/\u2014/);
  });

  it('names no primitive, key or file it was not given', () => {
    const b = behaviorBrief(req, { issue: 75 });
    expect(b).not.toContain('Base UI: it wraps');
    expect(b).not.toContain('Files:');
    expect(b).toContain('presses the keys that do it');
  });

  it('is what requestBrief and buildRequestBrief give for a behavior request', () => {
    expect(requestBrief(req, { issue: 75, facts })).toBe(behaviorBrief(req, { issue: 75, facts }));
    expect(buildRequestBrief({ ...req, build: { v: 1 } }, { issue: 75, facts })).toBe(behaviorBrief(req, { issue: 75, facts }));
  });

  it('a pattern rule: the pattern file and the places it lists', () => {
    const r = behaviorRequestOf('Delete pattern', { of: 'pattern', id: 'delete', rule: 1, today: 'Ask first', wanted: 'Offer Undo' });
    const b = behaviorBrief(r, { issue: 9 });
    expect(b).toContain('Pattern: delete (patterns/delete.pattern.json)');
    expect(b).toContain('Rule: Rule 2');
    expect(b).toContain('usedIn');
  });
});

describe('Being built, then Shipped', () => {
  const issue = (labels: string[]) => ({ number: 75, url: 'https://github.com/acme/ds/issues/75', title: composeRequestIssue(req).title, body: composeRequestIssue(req).body, state: 'open' as const, labels, author: 'bridge-app[bot]', assignees: [], createdAt: '2026-11-14T10:00:00Z' });
  const NOW = Date.parse('2026-11-16T10:00:00Z');

  it('is listed once made the default, and reads Shipped when the change that closes it merges', () => {
    const labels = ['component-change', 'request: behavior', 'source: studio'];
    expect(assembleBuildRequests({ issues: [issue(labels)], pulls: [], now: NOW })).toEqual([]);
    const [waiting] = assembleBuildRequests({ issues: [issue([...labels, 'bridge-build'])], pulls: [], now: NOW });
    expect(waiting).toMatchObject({ number: 75, component: 'Select', requestKind: 'behavior', status: 'requested' });
    const open = { number: 80, url: 'https://github.com/acme/ds/pull/80', state: 'open', draft: false, author: 'acme-malik', body: 'Closes #75', createdAt: '2026-11-15T10:00:00Z' };
    expect(assembleBuildRequests({ issues: [issue([...labels, 'bridge-build'])], pulls: [open], now: NOW })[0]!.status).not.toBe('requested');
    const merged = { ...open, state: 'merged', mergedAt: '2026-11-16T09:00:00Z' };
    const [done] = assembleBuildRequests({ issues: [{ ...issue([...labels, 'bridge-build']), state: 'closed' as const, stateReason: 'completed' }], pulls: [merged], now: NOW });
    expect(done).toMatchObject({ status: 'shipped' });
  });
});
