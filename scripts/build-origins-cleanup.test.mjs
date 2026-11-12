// The plan scripts/build-origins-cleanup.mjs carries out: each write it needs, none once done.
import { describe, expect, it } from 'vitest';
import { CLOSE_COMMENT, TARGETS, describeWrite, planTarget } from './build-origins-cleanup.mjs';

const target = (n, repo = 'acme-design-demo/bridge-demo-ds') => TARGETS.find((t) => t.number === n && t.repo === repo);

describe('build-origins-cleanup plan', () => {
  it('gives a library change Dana approved its origin and her name, then nothing on a second run', () => {
    const t = target(59);
    const item = {
      title: t.title,
      state: 'open',
      labels: [{ name: 'component-change' }],
      body: 'Invoice tables run past the fold. A stickyHeader option would keep the header row in view.\n\n<!-- bridge-request {"summary":"A stickyHeader option would keep the header row in view."} -->\n\nRequested by Malik through Bridge.',
    };
    const writes = planTarget(t, item);
    expect(writes).toHaveLength(1);
    const body = writes[0].body;
    expect(body).toContain('Requested by Dana through Bridge.');
    expect(body).not.toContain('Malik');
    expect(body.match(/Dana approved a stickyHeader/g)).toHaveLength(2);
    expect(body).toContain('<!-- bridge-origin {"kind":"lead","approvedBy":"Dana","reason":"rule for every product"} -->');
    expect(planTarget(t, { ...item, body })).toEqual([]);
  });

  it('links a library piece to its exploration and drops the removed Account app', () => {
    const t = target(57);
    const writes = planTarget(t, { title: t.title, state: 'open', labels: [{ name: 'product: account' }], body: 'x\n**Product:** Account app\n\nRequested by Sofia through Bridge.' });
    expect(writes.map((w) => w.kind)).toEqual(['body', 'remove-label']);
    expect(writes[0].body).toContain('"name":"Contact page summary"');
    expect(writes[0].body).not.toContain('Account app');
  });

  it('closes a leftover as not planned with a comment, once', () => {
    const t = target(58);
    expect(planTarget(t, { title: t.title, state: 'open', labels: [], body: '' })).toEqual([
      { kind: 'comment', body: CLOSE_COMMENT },
      { kind: 'close', reason: 'not_planned' },
    ]);
    expect(planTarget(t, { title: t.title, state: 'closed', labels: [], body: '' })).toEqual([]);
  });

  it("records Dana's Looks right on Contact page summary, never Ann's", () => {
    const t = target(2, 'acme-design-demo/acme-crm-design');
    const body = '<!-- bridge-exploration {"decisions":[{"kind":"looks-right","at":"2026-11-08T21:55:40.179Z","round":1,"byName":"Ann","sha":"b84"}]} -->';
    expect(planTarget(t, { title: t.title, state: 'open', labels: [], body })[0].body).toContain('"byName":"Dana"');
  });

  it('leaves an item whose title changed, and says when one is missing', () => {
    const t = target(48);
    expect(planTarget(t, { title: 'Something else', state: 'closed', labels: [], body: '' })[0].kind).toBe('skip');
    expect(describeWrite(t, planTarget(t, null)[0])).toContain('not found');
    expect(planTarget(t, { title: t.title, state: 'closed', labels: [], body: '' })).toEqual([{ kind: 'add-label', label: 'archived' }]);
  });

  it('never writes an em dash', () => {
    expect(JSON.stringify(TARGETS) + CLOSE_COMMENT).not.toContain('—');
  });
});
