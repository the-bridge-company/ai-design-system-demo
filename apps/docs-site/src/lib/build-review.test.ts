// Check the build, region by region: the server's pure rules (api/_lib/build-review.ts) and the page's
// (lib/build-review-view.ts).
import { describe, expect, it } from 'vitest';
import { applyNote, cleanBuildSummary, fixesComment, handoverOf, itemStates, noteComment, noteOpOf, plainText, roundOf, templatesOf, withItemWord, withoutItemWord, type BuildReview, type ItemWord } from '../../api/_lib/build-review';
import type { BuildWord } from '../../api/_lib/build-check';
import { boxPercent, changesText, colorWord, entryFacts, factWords, groupsOf, otherCheckers, possessive, sizeCounts, standing, type ReviewItem } from './build-review-view';

const SHA = (c: string) => c.repeat(40);
const word = (kind: 'looks-right' | 'changes', sha: string): BuildWord => ({ role: 'designer', byName: 'Mia', kind, sha, at: '2026-11-10T10:00:00Z' });
const iw = (sig: string, round: number, verdict: 'fine' | 'fix', role: ItemWord['role'] = 'designer'): ItemWord => ({ sig, n: 1, name: sig, round, role, byName: role === 'pm' ? 'Dino' : 'Mia', verdict, at: '2026-11-10T10:00:00Z' });

describe('rounds', () => {
  it('one more round for each earlier head someone asked for changes on', () => {
    expect(roundOf([], SHA('a'))).toBe(1);
    expect(roundOf([word('changes', SHA('a'))], SHA('a'))).toBe(1);
    expect(roundOf([word('changes', SHA('a')), word('looks-right', SHA('b'))], SHA('b'))).toBe(2);
    expect(roundOf([word('changes', SHA('a')), word('changes', SHA('a')), word('changes', SHA('b'))], SHA('c'))).toBe(3);
  });
});

describe('what each person says per difference', () => {
  it('a word replaces the same role on the same difference this round; taking it back removes it', () => {
    const w = withItemWord([iw('r1', 1, 'fix')], iw('r1', 1, 'fine'));
    expect(w).toEqual([iw('r1', 1, 'fine')]);
    expect(withoutItemWord(w, { sig: 'r1', round: 1, role: 'designer' })).toEqual([]);
  });

  it('round 2: a difference that did not change stays approved; an earlier fix that still shows stays open; gone ones are fixed', () => {
    const words = [iw('r1', 1, 'fine'), iw('r2', 1, 'fix'), iw('r3', 1, 'fix'), iw('r1', 1, 'fix', 'pm')];
    const s = itemStates([{ sig: 'r1' }, { sig: 'r2' }, { sig: 'r4' }], words, 2, 'designer');
    // r1: the PM asked to fix it last round, so it is not carried for anyone.
    expect(s.items.find((x) => x.sig === 'r1')).toMatchObject({ mine: null, carried: false, askedBefore: true });
    expect(s.items.find((x) => x.sig === 'r2')).toMatchObject({ carried: false, askedBefore: true });
    expect(s.items.find((x) => x.sig === 'r4')).toMatchObject({ carried: false, askedBefore: false });
    expect(s.fixed).toEqual([{ sig: 'r3', name: 'r3' }]);
    const clean = itemStates([{ sig: 'r1' }], [iw('r1', 1, 'fine')], 2, 'designer');
    expect(clean.items[0]).toMatchObject({ carried: true });
    // Someone with no part in the check carries nothing and says nothing.
    expect(itemStates([{ sig: 'r1' }], [iw('r1', 1, 'fine')], 2, null).items[0]).toMatchObject({ mine: null, carried: false });
  });

  it('the others this round, never the reader', () => {
    const s = itemStates([{ sig: 'r1' }], [iw('r1', 1, 'fix'), iw('r1', 1, 'fine', 'pm')], 1, 'designer');
    expect(s.items[0]).toMatchObject({ mine: 'fix', others: [{ role: 'pm', byName: 'Dino', verdict: 'fine' }] });
  });
});

describe('the measure the workflow sends', () => {
  const raw = {
    route: '/#/contacts/31/show',
    urls: { approved: 'https://a.pages.dev/#/x', build: 'javascript:alert(1)' },
    ignored: 3,
    sizes: [{ key: 'laptop', width: 1280, height: 800, missing: { b: 'wall' }, a: { image: 'p-laptop-a', w: 1024, h: 900, pageW: 1280, pageH: 1100 }, b: null }, { key: 'tv', width: 3000 }],
    items: [
      { n: 1, sig: 'r0000abcd', name: 'Tags', line: 'Shows x', facts: [{ k: 'text', label: 'Text', was: 'A', now: 'B', n: 1 }, { k: 'evil', label: 'x' }], sizes: ['laptop', 'tv'], boxes: { laptop: { a: [1, 2, 3, 4], b: 'no' } }, crop: { size: 'laptop', a: 'r1-a', b: '../x' } },
      { n: 2, sig: 'bad', name: 'X', sizes: ['laptop'] },
    ],
  };
  it('keeps only what is well formed', () => {
    const r = cleanBuildSummary(raw, { run: '1762768800000', head: SHA('a'), now: 0 })!;
    expect(r.sizes).toEqual([{ key: 'laptop', width: 1280, height: 800, missing: { b: 'wall' }, a: { image: 'p-laptop-a', w: 1024, h: 900, pageW: 1280, pageH: 1100 }, b: null }]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ sig: 'r0000abcd', sizes: ['laptop'], facts: [{ k: 'text' }], boxes: { laptop: { a: [1, 2, 3, 4], b: null } }, crop: { size: 'laptop', a: 'r1-a' } });
    expect(r.items[0]!.crop.b).toBeUndefined();
    expect(r.urls).toEqual({ approved: 'https://a.pages.dev/#/x', build: null });
    expect(cleanBuildSummary(raw, { run: 'x', head: SHA('a'), now: 0 })).toBeNull();
  });

  it('the preview templates of the product: the build and the approved design', () => {
    const config = { products: [{ repo: 'Acme/Shop', preview: 'https://{branch}.shop.dev', design: { preview: 'https://{branch}.design.dev' } }] };
    expect(templatesOf(config, 'acme/shop')).toEqual({ build: 'https://{branch}.shop.dev', approved: 'https://{branch}.design.dev' });
    expect(templatesOf({ products: [{ repo: 'acme/shop', preview: 'https://x' }] }, 'acme/shop')).toBeNull();
  });
});

describe('comments pinned on a difference', () => {
  const review = { run: '1762768800000', items: [{ sig: 'r1', n: 4, name: 'Tags', crop: { size: 'laptop', a: 'r4-a', b: 'r4-b' } }] } as unknown as BuildReview;
  it('a new comment needs words and a difference of the last measure', () => {
    expect(noteOpOf({ op: 'add', sig: 'r1', text: ' ' }, review, 1, 'nabcdef12')).toBe('Write your comment first.');
    expect(noteOpOf({ op: 'add', sig: 'r9', text: 'x' }, review, 1, 'nabcdef12')).toMatch(/not in the last check/);
    expect(noteOpOf({ op: 'add', sig: 'r1', text: 'x', x: 2, y: -1, side: 'a' }, review, 1, 'nabcdef12')).toMatchObject({ op: 'add', id: 'nabcdef12', n: 4, x: 1, y: 0, side: 'a', image: 'r4-a', run: '1762768800000' });
    expect(noteOpOf({ op: 'reply', id: 'bad', text: 'x' }, review, 1, 'n1')).toBe('Say which comment.');
  });

  it('threads: add, answer, resolve and open again', () => {
    const op = noteOpOf({ op: 'add', sig: 'r1', text: 'Name as typed' }, review, 1, 'nabcdef12');
    if (typeof op === 'string') throw new Error(op);
    const who = { byName: 'Mia', role: 'designer' as const };
    let t = applyNote([], op, who, 'T1')!;
    t = applyNote(t, { op: 'reply', id: 'nabcdef12', text: 'Agreed' }, { byName: 'Dino', role: 'pm' }, 'T2')!;
    t = applyNote(t, { op: 'resolve', id: 'nabcdef12', resolved: true }, who, 'T3')!;
    expect(t[0]).toMatchObject({ text: 'Name as typed', replies: [{ byName: 'Dino', text: 'Agreed' }], resolved: { byName: 'Mia', at: 'T3' } });
    expect(applyNote(t, { op: 'resolve', id: 'nabcdef12', resolved: false }, who, 'T4')![0]!.resolved).toBeNull();
    expect(applyNote(t, { op: 'reply', id: 'nzzzzzzzz', text: 'x' }, who, 'T5')).toBeNull();
  });

  it('what reaches the task keeps people\'s words as words: no mention, no picture, no heading of theirs', () => {
    expect(plainText('## Hi @malik ![x](y) <b>')).toBe('Hi @​malik [x](y) b');
    const c = noteComment({ byName: 'Mia', role: 'designer', text: 'Line one\nline two', n: 4, name: 'Tags', size: 'phone', side: 'a' }, { image: 'https://b/i', link: 'https://b/r' });
    expect(c).toBe('Mia (designer) commented on 4. Tags, phone, on the approved design:\n\n> Line one\n> line two\n\n![Tags](https://b/i)\n\n[Answer in Bridge](https://b/r)');
    const f = fixesComment({ byName: 'Mia', role: 'pm', round: 2, fixes: [{ n: 4, name: 'Tags', line: 'Shows x', facts: [{ k: 'added', label: 'New', was: '', now: 'SK', n: 1 }], image: null }], note: 'Thanks', kept: 9, link: 'https://b/r' });
    expect(f).toContain('Mia (product manager) checked the build, round 2: 1 thing to fix.');
    expect(f).toContain('- New: SK');
    expect(f).toContain('The other 9 differences stay approved in the next round.');
  });
});

describe('the handover notes, read only', () => {
  it('decisions and edge cases with their component', () => {
    const md = '## Context\n\n- not this\n\n## Decisions\n\n- One\n- Two\n\n## Edge cases\n\n- [x] Loose one\n\n### Button\n\n- [ ] Loading\n\n## Next step\n\n- later';
    expect(handoverOf(md)).toEqual({ decisions: ['One', 'Two'], edgeCases: [{ component: 'General', state: 'Loose one', covered: true }, { component: 'Button', state: 'Loading', covered: false }] });
    expect(handoverOf(null)).toEqual({ decisions: [], edgeCases: [] });
  });
});

const item = (n: number, sig: string, sizes: ReviewItem['sizes']): ReviewItem => ({ n, sig, name: `Item ${n}`, line: 'x', facts: [], sizes, boxes: {}, crop: { size: sizes[0]! } });

describe('the page', () => {
  const items = [item(1, 'a', ['laptop', 'small', 'phone']), item(2, 'b', ['laptop']), item(3, 'c', ['phone'])];
  it('groups laptop sizes first, then phone only, and counts each size', () => {
    expect(groupsOf(items)).toEqual({ wide: [items[0], items[1]], phone: [items[2]] });
    expect(sizeCounts(items)).toEqual({ laptop: 2, small: 1, phone: 2 });
  });

  it('where each stands: a click wins over the server, what stays approved is apart', () => {
    const states = [
      { sig: 'a', mine: 'fine' as const, carried: false, askedBefore: false, others: [] },
      { sig: 'b', mine: null, carried: true, askedBefore: false, others: [] },
      { sig: 'c', mine: null, carried: false, askedBefore: false, others: [] },
    ];
    const s = standing(items, states, { c: 'fix' });
    expect(s.kept.map((i) => i.sig)).toEqual(['b']);
    expect(s.open.map((i) => i.sig)).toEqual(['a', 'c']);
    expect(s.fixes.map((i) => i.sig)).toEqual(['c']);
    expect(s.looked).toBe(2);
    expect(standing(items, states, { a: null }).verdict.a).toBeNull();
  });

  it('says a fact and a color as a designer reads them', () => {
    expect(colorWord('rgb(11, 74, 139)')).toBe('#0B4A8B');
    expect(colorWord('rgba(0, 0, 0, 0)')).toBe('none');
    expect(factWords({ k: 'fill', label: 'Background', was: 'rgba(0, 0, 0, 0)', now: 'rgb(255, 255, 255)', n: 1 })).toEqual({ label: 'Background', was: 'none', now: '#FFFFFF' });
    expect(factWords({ k: 'added', label: 'New', was: '', now: 'SK', n: 1 })).toEqual({ label: 'Not in the design', was: null, now: 'SK' });
    expect(possessive('Malik')).toBe("Malik's");
    expect(possessive('Charles')).toBe("Charles'");
  });

  it('the text of Needs changes names the things to fix', () => {
    expect(changesText([{ n: 4, name: 'Tags' }, { n: 5, name: 'Tasks' }], '')).toBe('2 things to fix: 4. Tags, 5. Tasks.');
    expect(changesText([{ n: 4, name: 'Tags' }], 'Thanks')).toBe('1 thing to fix: 4. Tags.\n\nThanks');
  });

  it('a box in percent of the page', () => {
    expect(boxPercent([128, 0, 640, 700], { pageW: 1280, pageH: 1400 })).toEqual({ left: '10.000%', top: '0.000%', width: '50.000%', height: '50.000%' });
  });

  it('the entry: only the facts with a number', () => {
    const d = { review: { items } as never, items: [], handover: { decisions: ['x'], edgeCases: [] }, meant: [] };
    expect(entryFacts(d, 'Malik')).toEqual([
      { key: 'differ', n: 3, line: 'places differ from your approved design, 1 only on a phone' },
      { key: 'notes', n: 1, line: 'thing to check from your handover notes' },
    ]);
  });

  it('who else checks, by name', () => {
    const rows = [
      { role: 'designer' as const, required: true, state: 'waiting' as const },
      { role: 'pm' as const, required: true, state: 'waiting' as const },
      { role: 'lead' as const, required: false, state: 'waiting' as const },
    ];
    expect(otherCheckers(rows, 'designer', { designer: 'Mia', pm: 'Dino' })).toEqual(['Dino']);
    expect(otherCheckers(rows, null, { designer: 'Mia', pm: null })).toEqual(['Mia', 'the product manager']);
  });
});
