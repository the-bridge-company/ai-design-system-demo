// Check the build, the robot's pure parts (scripts/preview-shots.mjs measureBuild): which elements of the approved
// design and of the build are the same, what differs between them, how it is grouped and said.
import { describe, expect, it } from 'vitest';
import { buildDiff, colorsDiffer, compareElements, dateShape, mergeSizes, missingPage, normText, regionLine, regionSig, regionsOf, shortText } from './preview-shots.mjs';
import { buildAddresses } from './private-shots.mjs';

const ST = { color: 'rgb(21, 32, 43)', 'background-color': 'rgba(0, 0, 0, 0)', 'font-family': 'Instrument Sans, sans-serif', 'font-size': '14px', 'font-weight': '400', 'text-transform': 'none', 'text-decoration-line': 'none', 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px', 'border-top-color': 'rgb(0, 0, 0)', 'border-top-left-radius': '0px', 'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px', 'box-shadow': 'none' };
let next = 0;
const el = (o) => ({ i: next++, p: -1, tag: 'span', role: '', text: '', label: '', kind: 'text', blk: false, head: null, hd: false, nav: false, mk: null, mkRoot: false, icons: 0, box: [0, 0, 100, 20], st: { ...ST }, ...o, st: { ...ST, ...(o.st ?? {}) } });

/** A page: a header block, a right column with headed sections (Tags, Tasks), a note card. */
function page(v) {
  next = 0;
  const header = el({ tag: 'header', kind: 'block', blk: true, head: 'Cletus Doyle', box: [300, 80, 600, 140] });
  const name = el({ p: header.i, tag: 'h1', text: 'Cletus Doyle', hd: true, box: [320, 90, 300, 50], st: { 'font-size': v.nameSize ?? '30px' } });
  const extra = v.avatar ? [el({ p: header.i, text: 'SK', box: [860, 90, 32, 32] })] : [];
  const tagsH = el({ tag: 'h3', text: 'Tags', hd: true, box: [930, 500, 40, 18] });
  const tag = el({ text: v.tag ?? 'Football fan', box: [935, 525, 90, 24] });
  const add = el({ tag: 'button', kind: 'control', text: 'Add tag', box: [1040, 522, 90, v.addH ?? 32], icons: 1 });
  const tasksH = el({ tag: 'h3', text: 'Tasks', hd: true, box: [930, 600, 40, 18] });
  const title = el({ text: 'Follow up on the unsigned purchase order', box: v.typeFirst ? [1010, 630, 230, 20] : [950, 630, 280, 20] });
  const type = el({ text: 'Follow-up', box: v.typeFirst ? [950, 630, 60, 20] : [950, 660, 60, 20] });
  const due = el({ text: v.due ?? '12/13/2026', box: [1020, 660, 80, 20] });
  const card = el({ tag: 'section', kind: 'block', blk: true, head: 'Notes', box: [300, 400, 600, 300] });
  const notesH = el({ p: card.i, tag: 'h2', text: 'Notes', hd: true, box: [320, 410, 100, 30] });
  const when = el({ p: card.i, text: v.when ?? 'last Friday at 8:24 PM', box: [700, 470, 150, 16] });
  const saveBtn = el({ p: card.i, tag: 'button', kind: 'control', text: 'Add this note', box: [700, 560, 140, 40], icons: v.icon ? 1 : 0 });
  const chart = el({ p: card.i, tag: 'svg', kind: 'media', box: [320, 600, 200, 80] });
  return { w: 1280, h: 1400, vh: 800, words: 300, title: 'Cletus Doyle', els: [header, name, ...extra, tagsH, tag, add, tasksH, title, type, due, card, notesH, when, saveBtn, chart] };
}

describe('words and dates', () => {
  it('reads loosely: case and punctuation do not count', () => {
    expect(normText('Football fan')).toBe(normText('football-fan'));
    expect(shortText('Follow up on the unsigned purchase order', 20)).toBe('Follow up on the un…');
  });

  it('knows a date by its shape, whatever day the page opens', () => {
    expect(dateShape('3 days ago')).toBe('relative');
    expect(dateShape('last Friday at 8:24 PM')).toBe('relative');
    expect(dateShape('Due 12/13/2026')).toBe('numeric');
    expect(dateShape('Dec 13, 2026')).toBe('words');
    expect(dateShape('Added on August 17, 2026')).toBe('words');
    expect(dateShape('Football fan')).toBeNull();
  });

  it('colors differ past a few steps only', () => {
    expect(colorsDiffer('rgb(10, 10, 10)', 'rgb(14, 10, 10)')).toBe(false);
    expect(colorsDiffer('rgb(10, 10, 10)', 'rgb(40, 10, 10)')).toBe(true);
    expect(colorsDiffer('rgba(0, 0, 0, 0)', 'rgba(255, 0, 0, 0)')).toBe(false);
  });
});

describe('comparing two matched elements', () => {
  it('says text, size, outline, height and icon; rounding is noise', () => {
    const a = el({ tag: 'button', kind: 'control', text: 'Add tag', box: [0, 0, 80, 32], st: { 'font-size': '14px' } });
    const b = el({ tag: 'button', kind: 'control', text: 'Add tag', box: [0, 0, 80, 44], icons: 1, st: { 'font-size': '14.5px', 'border-top-width': '1px', 'border-left-width': '1px' } });
    const r = compareElements(a, b);
    expect(r.facts.map((f) => f.k).sort()).toEqual(['height', 'icon', 'outline']);
    expect(r.tiny).toBe(1);
  });

  it('a date in another format is a difference; another day in the same format is not', () => {
    expect(compareElements(el({ text: '12/13/2026' }), el({ text: '13/12/2026' })).facts).toEqual([{ k: 'date', label: 'Date', was: '12/13/2026', now: '13/12/2026' }]);
    expect(compareElements(el({ text: '3 days ago' }), el({ text: '4 days ago' })).facts).toEqual([]);
  });
});

describe('the regions of a page', () => {
  it('a card is its own region; a column of headed sections splits by heading', () => {
    const p = page({});
    const r = regionsOf(p);
    const by = (t) => r.get(p.els.find((e) => e.text === t).i).name;
    expect(by('Add this note')).toBe('Notes');
    expect(by('Football fan')).toBe('Tags');
    expect(by('Follow-up')).toBe('Tasks');
    expect(by('Cletus Doyle')).toBe('Header');
  });

  it('a marked area wins: the exploration named what it changed', () => {
    const p = page({});
    const marked = { ...p.els.find((e) => e.text === 'Tags'), mk: 'Contact tags', mkRoot: true, blk: true };
    p.els = p.els.map((e) => (e.i === marked.i ? marked : e));
    expect(regionsOf(p).get(marked.i).name).toBe('Contact tags');
  });
});

describe('what differs between the approved design and the build', () => {
  it('finds each real difference by region and leaves out live dates and pictures', () => {
    const d = buildDiff(page({}), page({ tag: 'football-fan', avatar: true, nameSize: '44px', addH: 44, typeFirst: true, due: '13/12/2026', when: 'last Friday at 9:14 PM', icon: true }));
    const by = Object.fromEntries(d.regions.map((r) => [r.name, r]));
    expect(Object.keys(by).sort()).toEqual(['Header', 'Notes', 'Tags', 'Tasks']);
    expect(by.Tags.line).toBe('Shows football-fan where the design says Football fan, and the button is taller, 32 to 44');
    expect(by.Header.facts.map((f) => f.k)).toEqual(['added', 'size']);
    expect(by.Tasks.facts.map((f) => f.k)).toEqual(['date', 'order']);
    expect(by.Tasks.facts.find((f) => f.k === 'order')).toMatchObject({ now: 'Follow-up', was: 'Follow up on the unsigned purchase order' });
    expect(by.Notes.line).toBe('The button gained an icon');
    // Boxes on both sides, padded, in page coordinates.
    expect(by.Notes.b).toEqual([288, 388, 624, 324]);
    expect(d.ignored).toBeGreaterThan(0);
  });

  it('the same page twice differs nowhere', () => {
    expect(buildDiff(page({}), page({})).regions).toEqual([]);
  });

  it('one sentence: the two strongest kinds, page words never lower-cased', () => {
    expect(regionLine([{ k: 'missing', was: 'Cold' }, { k: 'space', was: '12', now: '20' }])).toBe('Cold is missing, and more space inside, 12 to 20');
    expect(regionLine([{ k: 'added', now: 'SK' }, { k: 'order', was: 'CD', now: 'Cletus' }])).toBe('Adds SK, not in the design, and Cletus now comes before CD');
  });
});

describe('every size as one list', () => {
  it('one item per region across sizes, laptop first, phone only after, a stable signature', () => {
    const f = [{ k: 'text', label: 'Text', was: 'A', now: 'B', n: 1 }];
    const items = mergeSizes([
      { key: 'laptop', regions: [{ key: 'tags', name: 'Tags', facts: f, a: [1, 1, 1, 1], b: [2, 2, 2, 2], y: 500 }, { key: 'header', name: 'Header', facts: f, a: null, b: [0, 0, 1, 1], y: 80 }] },
      { key: 'small', regions: [{ key: 'tags', name: 'Tags', facts: f, a: null, b: null, y: 500 }] },
      { key: 'phone', regions: [{ key: 'status', name: 'Note status', facts: [{ k: 'missing', label: 'Missing', was: 'Cold', now: '', n: 1 }], a: null, b: [3, 3, 3, 3], y: 100 }] },
    ]);
    expect(items.map((i) => [i.n, i.name, i.sizes])).toEqual([
      [1, 'Header', ['laptop']],
      [2, 'Tags', ['laptop', 'small']],
      [3, 'Note status', ['phone']],
    ]);
    expect(items[1].sig).toBe(regionSig('Tags', f));
    expect(regionSig('Tags', f)).toMatch(/^r[0-9a-f]{8}$/);
    expect(regionSig('Tags', f)).not.toBe(regionSig('Tags', [{ ...f[0], now: 'C' }]));
  });
});

describe('a page that is not the product', () => {
  it('a sign-in wall, an empty page or a not found page is said, never compared', () => {
    expect(missingPage({ words: 200, title: 'Contacts' }, 'https://vercel.com/login')).toBe('wall');
    expect(missingPage({ words: 3, title: '' }, 'https://x.pages.dev/')).toBe('empty');
    expect(missingPage({ words: 40, title: '404: page not found' }, 'https://x.pages.dev/')).toBe('not-found');
    expect(missingPage({ words: 40, title: 'Cletus Doyle' }, 'https://x.pages.dev/')).toBeNull();
  });
});

describe('the workflow', () => {
  it('fills both preview templates from the job', () => {
    const previewUrl = (t, { branch }) => t.replace('{branch}', branch.replace(/\//g, '-'));
    expect(buildAddresses({ pull: 4, approved: { template: 'https://{branch}.design.dev', branch: 'explore/a' }, build: { template: 'https://{branch}.shop.dev', branch: 'build/a' } }, previewUrl)).toEqual({ approved: 'https://explore-a.design.dev', build: 'https://build-a.shop.dev' });
    expect(buildAddresses({ approved: {}, build: {} }, previewUrl)).toBeNull();
  });
});
