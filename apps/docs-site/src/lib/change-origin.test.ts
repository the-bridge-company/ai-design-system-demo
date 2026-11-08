// Every change says where it comes from, when Bridge knows it: the "Needed by" block of the change or of the request
// it closes, and nothing at all otherwise. The sample team's branches carry real "Needed by" blocks in their bodies,
// read like any team's.
import { describe, expect, it } from 'vitest';
import { withNeededBy, type NeededBy } from '@bridge-ds/core';
import { changeOrigin, neededByOfChange } from './product-branch';
import { changeNeed, person } from './home-model';
import { suggestionNeed } from './suggestions-view';

const needed: NeededBy = { pr: 12, title: 'Billing screen', branch: 'explore/billing', url: 'u', product: 'admin', productName: 'Admin demo', piece: 'p', pieceTitle: 'P' };
const NOW = Date.parse('2026-11-06T12:00:00Z');
const ann = person('ann', 'Ann Leroy', null);
const facts = { number: 3, title: 'Deepen the blue', author: ann, asker: ann, since: null, thumb: { kind: 'icon', icon: 'branch' } as const };

describe('changeOrigin', () => {
  it('names the exploration, its product and its page', () => {
    expect(changeOrigin(needed)).toMatchObject({ name: 'Billing screen', product: 'Admin demo', exploration: true, number: 12, productKey: null });
    expect(changeOrigin(needed)?.href).toContain('changes/?exploration=12');
  });

  it('a product branch is not called an exploration', () => {
    expect(changeOrigin({ ...needed, branch: 'agent/billing' })?.exploration).toBe(false);
  });

  it('carries the product of a branch in the product own repository', () => {
    const o = changeOrigin({ ...needed, repo: 'acme/shop', product: 'shop' });
    expect(o?.productKey).toBe('shop');
    expect(o?.href).toContain('changes/?exploration=12&product=shop');
  });

  it('no block, no origin', () => {
    expect(changeOrigin(null)).toBeNull();
    expect(changeOrigin(undefined)).toBeNull();
  });
});

describe('neededByOfChange', () => {
  const never = () => Promise.reject(new Error('no read expected'));

  it('reads the change itself first, without a read', async () => {
    expect(await neededByOfChange(withNeededBy('Closes #4', needed), never)).toMatchObject({ pr: 12 });
  });

  it('follows "Closes #n" to the request Done exploring filed', async () => {
    const issues: Record<number, string> = { 4: 'A plain issue', 5: withNeededBy('The request', needed) };
    const found = await neededByOfChange('Closes #4\n\nCloses #5', async (n) => issues[n]);
    expect(found).toMatchObject({ title: 'Billing screen' });
  });

  it('a change that closes nothing, or an issue nobody needed, has no origin', async () => {
    expect(await neededByOfChange('## What changed', never)).toBeNull();
    expect(await neededByOfChange(null, never)).toBeNull();
    expect(await neededByOfChange('Closes #4', async () => 'A plain issue')).toBeNull();
  });

  it('a read that fails counts as nothing known', async () => {
    expect(await neededByOfChange('Closes #4', never)).toBeNull();
  });
});

describe('the rows read the link', () => {
  it('a review row says where it comes from, before who asks', () => {
    expect(changeNeed({ ...facts, task: 'requested', origin: 'Profile page' }, NOW).line).toBe('from Profile page · Ann asks for your review');
    expect(changeNeed({ ...facts, task: 'tech', origin: 'Profile page' }, NOW).line).toBe('from Profile page · Ann asks for your tech review');
    expect(changeNeed({ ...facts, task: 'ship', origin: 'Profile page' }, NOW).line).toContain('from Profile page');
  });

  it('no origin, no line', () => {
    expect(changeNeed({ ...facts, task: 'requested' }, NOW).line).toBe('Ann asks for your review');
    expect(changeNeed({ ...facts, task: 'requested', origin: ' ' }, NOW).line).toBe('Ann asks for your review');
  });

  it("the viewer's own branch keeps its own line", () => {
    expect(changeNeed({ ...facts, task: 'own-ship', origin: 'Profile page' }, NOW).line).not.toContain('Profile page');
  });

  it('a suggestion says it too', () => {
    expect(suggestionNeed({ number: 8, title: 'T', createdAt: '2026-11-01T00:00:00Z', origin: 'Profile page' }, ann, NOW).line).toContain('from Profile page');
    expect(suggestionNeed({ number: 8, title: 'T', createdAt: '2026-11-01T00:00:00Z' }, ann, NOW).line).not.toContain('from');
  });
});

describe('on the sample team', () => {
  it("reads a change's origin from its own Needed by block, as on any team", async () => {
    const body = withNeededBy('Deeper blue for buttons.', { ...needed, pr: 36, title: 'Profile page', branch: 'explore/profile-page', product: 'account', productName: 'Account app' });
    const origin = changeOrigin(await neededByOfChange(body, async () => null));
    expect(origin).toMatchObject({ name: 'Profile page', product: 'Account app', number: 36 });
  });

  it('a change without a block has no origin, whatever its branch', async () => {
    expect(changeOrigin(await neededByOfChange('Deeper blue for buttons.', async () => null))).toBeNull();
  });
});
