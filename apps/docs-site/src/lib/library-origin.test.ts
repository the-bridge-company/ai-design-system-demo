// Every library change says where it comes from (boards LI6, LI7): the origin a Bridge block states, else its
// "Needed by" block, else the DS lead with the reason Bridge can tell. The lead groups them by component or by
// exploration.
import { describe, expect, it } from 'vitest';
import { withNeededBy, type NeededBy, type ProductConfig } from '@bridge-ds/core';
import {
  changeOf,
  componentOf,
  groupByComponent,
  groupByExploration,
  inferLeadReason,
  libraryOrigin,
  libraryTag,
  originCounts,
  originFilterParam,
  originLine,
  passesOrigin,
  statedOrigin,
  withOriginFilter,
  type LibraryItem,
  type LibraryOrigin,
  type LibraryTag,
} from './library-origin';

const PRODUCTS: ProductConfig[] = [
  { key: 'library', name: 'Library', default: true },
  { key: 'prints', name: 'Acme Prints', repo: 'acme/prints' },
  { key: 'crm', name: 'Acme CRM', repo: 'acme/crm' },
];

const block = (mark: string, data: unknown) => `Some words.\n\n<!-- ${mark} ${JSON.stringify(data)} -->`;

describe('statedOrigin', () => {
  it('reads the origin field of any Bridge block', () => {
    const body = block('bridge-library-piece', {
      piece: 'timeline',
      origin: {
        kind: 'exploration',
        repo: 'acme/prints-design',
        number: 7,
        product: 'prints',
        name: 'Order fulfilment timeline',
      },
    });
    const o = statedOrigin(body, PRODUCTS);
    expect(o).toMatchObject({
      kind: 'exploration',
      name: 'Order fulfilment timeline',
      product: 'Acme Prints',
      productKey: 'prints',
      number: 7,
    });
    expect(o?.kind === 'exploration' && o.href).toContain('changes/?exploration=7&product=prints');
  });

  it('reads a bridge-origin block holding the origin itself', () => {
    expect(statedOrigin(block('bridge-origin', { kind: 'lead', reason: 'accessibility' }))).toEqual({ kind: 'lead', reason: 'a11y' });
    expect(
      statedOrigin(
        block('bridge-origin', {
          kind: 'lead',
          reason: 'from the Figma UI kit',
        })
      )
    ).toEqual({ kind: 'lead', reason: 'figma' });
  });

  it('is tolerant: string numbers, unknown fields, broken blocks', () => {
    const body = `${block('bridge-x', 'not an object')}\n<!-- bridge-broken {nope -->\n${block('bridge-y', {
      origin: {
        kind: 'exploration',
        number: '12',
        product: 'crm',
        repo: 'acme/crm',
        name: 'Deal pipeline cards',
        extra: [1],
      },
    })}`;
    expect(statedOrigin(body, PRODUCTS)).toMatchObject({
      name: 'Deal pipeline cards',
      number: 12,
      product: 'Acme CRM',
    });
    expect(statedOrigin(block('bridge-y', { origin: { kind: 'exploration' } }))).toBeNull();
    expect(statedOrigin(block('bridge-y', { origin: { kind: 'mystery', name: 'x' } }))).toBeNull();
    expect(statedOrigin(null)).toBeNull();
  });

  it('a product that is not the team’s any more keeps its name but has no link', () => {
    const o = statedOrigin(
      block('bridge-y', {
        origin: {
          kind: 'exploration',
          number: 2,
          product: 'account',
          productName: 'Account app',
          repo: 'acme/account',
          name: 'Profile page',
        },
      }),
      PRODUCTS
    );
    expect(o).toMatchObject({ product: 'Account app', href: null });
  });

  it('falls back to the Needed by block', () => {
    const n: NeededBy = {
      pr: 2,
      title: 'Profile page',
      branch: 'explore/profile-page',
      url: 'u',
      product: 'crm',
      productName: 'Acme CRM',
      piece: 'avatar-xl',
      pieceTitle: 'Avatar: xl size',
      repo: 'acme/crm',
    };
    const o = statedOrigin(withNeededBy('Body', n), PRODUCTS);
    expect(o).toMatchObject({
      kind: 'exploration',
      name: 'Profile page',
      product: 'Acme CRM',
      piece: 'Avatar: xl size',
    });
    expect(o?.kind === 'exploration' && o.href).toContain('exploration=2&product=crm');
  });

  it('never puts a repository or a number in the words', () => {
    const o = statedOrigin(
      block('bridge-y', {
        origin: {
          kind: 'exploration',
          number: 7,
          product: 'prints',
          repo: 'acme/prints-design',
          name: 'Order fulfilment timeline',
        },
      }),
      PRODUCTS
    )!;
    expect(originLine(o)).toBe('Needed by Order fulfilment timeline · Acme Prints');
    expect(originLine(o)).not.toMatch(/#|\d|acme\//);
  });
});

describe('inferLeadReason', () => {
  it('a push from Figma is the UI kit', () => {
    expect(
      inferLeadReason({
        title: 'Button: new size Large',
        labels: [{ name: 'from-figma' }],
      })
    ).toBe('figma');
    expect(
      inferLeadReason({
        title: 'Button',
        body: '<!-- bridge-from-figma {"component":"Button","route":"claude-draft"} -->',
      })
    ).toBe('figma');
  });

  it('a brand, a contrast fix, docs, a token rule', () => {
    expect(
      inferLeadReason({
        title: 'Add the Forest brand',
        headRef: 'bridge/brand-forest',
      })
    ).toBe('brand');
    expect(
      inferLeadReason({
        title: 'Fix muted text contrast on dark raised surfaces',
      })
    ).toBe('a11y');
    expect(
      inferLeadReason({
        title: 'Button: loadingLabel announces the action while it runs',
      })
    ).toBe('a11y');
    expect(
      inferLeadReason({
        title: 'Tabs: when tabs are the wrong choice',
        labels: ['docs'],
        headRef: 'docs/tabs-1',
      })
    ).toBe('docs');
    expect(inferLeadReason({ title: 'Slider', guidance: true })).toBe('docs');
    expect(inferLeadReason({ title: 'Deprecate color.bg.zone', labels: ['tokens'] })).toBe('rule');
    expect(inferLeadReason({ title: 'Tighter card and panel corners' })).toBe('rule');
  });

  it('says nothing when nothing tells', () => {
    expect(inferLeadReason({ title: 'Card: subtle tone for secondary groups' })).toBeNull();
  });
});

describe('libraryOrigin and originLine', () => {
  it('the stated origin wins, else the DS lead with its reason, else the DS lead alone', () => {
    expect(originLine(libraryOrigin({ title: 'Add the Forest brand' }))).toBe('From the DS lead · new brand');
    expect(originLine(libraryOrigin({ title: 'Card: subtle tone for secondary groups' }))).toBe('From the DS lead');
    expect(
      libraryOrigin({
        title: 'Add the Forest brand',
        body: block('bridge-origin', {
          kind: 'exploration',
          name: 'Brand night',
          number: 3,
        }),
      }).kind
    ).toBe('exploration');
  });

  it('the filter counts and keeps', () => {
    const os: LibraryOrigin[] = [
      { kind: 'lead', reason: null },
      { kind: 'lead', reason: 'a11y' },
      statedOrigin(block('bridge-origin', { kind: 'exploration', name: 'A', number: 1 }))!,
    ];
    expect(originCounts(os)).toEqual({ all: 3, explorations: 1, lead: 2 });
    expect(os.filter((o) => passesOrigin(o, 'lead'))).toHaveLength(2);
    expect(originFilterParam('?origin=explorations')).toBe('explorations');
    expect(originFilterParam('?origin=nope')).toBe('all');
    expect(withOriginFilter('?state=all&origin=lead', 'all')).toBe('?state=all');
    expect(withOriginFilter('', 'lead')).toBe('?origin=lead');
  });
});

describe('libraryTag', () => {
  const lead = { you: false, name: 'Dana' };
  it('uses the exploration section words', () => {
    expect(libraryTag({ kind: 'needs-design' }, lead)?.label).toBe('Needs Dana');
    expect(libraryTag({ kind: 'needs-approval' }, { you: true, name: 'Dana' })?.label).toBe('Needs you');
    expect(libraryTag({ kind: 'needs-tech' }, lead)?.label).toBe('Approved');
    expect(libraryTag({ kind: 'ci-failing' }, lead)?.label).toBe('Being built');
    expect(libraryTag({ draft: true }, lead)?.label).toBe('Being built');
    expect(libraryTag({ kept: true, kind: 'needs-design' }, lead)?.label).toBe('Kept in this screen');
    expect(libraryTag({ kind: 'merged' }, lead)).toBeNull();
  });
});

describe('componentOf', () => {
  it('reads the component from the title, the piece or the Figma push', () => {
    expect(componentOf({ title: 'Button: new size Large' })).toBe('Button');
    expect(componentOf({ title: 'New ProfileHeader component' })).toBe('ProfileHeader');
    expect(componentOf({ title: 'feat(tokens): Deepen the primary blue' })).toBeNull();
    expect(componentOf({ title: 'Anything', figmaComponent: 'Card' })).toBe('Card');
    expect(
      componentOf({
        title: 'Less room',
        origin: statedOrigin(
          block('bridge-origin', {
            kind: 'exploration',
            name: 'X',
            number: 1,
            pieceTitle: 'New component: Timeline',
          })
        ),
      })
    ).toBe('Timeline');
    expect(changeOf('Button: New size: Large', 'Button')).toBe('new size large');
  });
});

// ---------------------------------------------------------------------------------------------------------------

const NEEDS: LibraryTag = {
  state: 'needs',
  label: 'Needs you',
  tone: 'warning',
};
const APPROVED: LibraryTag = {
  state: 'approved',
  label: 'Approved',
  tone: 'success',
};
const BUILDING: LibraryTag = {
  state: 'building',
  label: 'Being built',
  tone: 'info',
};
const explo = (name: string, number: number, product = 'crm'): LibraryOrigin =>
  statedOrigin(
    block('bridge-origin', {
      kind: 'exploration',
      name,
      number,
      product,
      repo: `acme/${product}`,
    }),
    PRODUCTS
  )!;
const item = (key: string, title: string, origin: LibraryOrigin, tag: LibraryTag | null, component = componentOf({ title })): LibraryItem<string> => ({
  key,
  title,
  origin,
  component,
  tag,
  mine: origin.kind === 'lead',
  row: key,
});

// Board LI7, as data.
const LI7 = [
  item('1', 'Card: Less room inside: 12', explo('Deal pipeline cards', 4), NEEDS),
  item('2', 'Card: More room inside: 20', explo('Contact page summary', 5), NEEDS),
  item('3', 'Button: New style: quiet danger', explo('Bulk actions on products', 2, 'prints'), APPROVED),
  item('4', 'Button: New size: Large', explo('Onboarding empty states', 6), NEEDS),
  item('5', 'Button: New size: Large', { kind: 'lead', reason: 'figma' }, BUILDING),
  item('6', 'New Timeline component', explo('Order fulfilment timeline', 1, 'prints'), NEEDS),
  item('7', 'Space inside cards', explo('Compact dashboard numbers', 3, 'prints'), NEEDS),
  item('8', 'Focus ring', { kind: 'lead', reason: 'a11y' }, BUILDING),
  item('9', 'Acme Night', { kind: 'lead', reason: 'brand' }, BUILDING),
];

describe('groupByComponent', () => {
  const groups = groupByComponent(LI7, { you: true });

  it('Card first: two explorations, two different ways, open, Compare and pick on the first', () => {
    const card = groups[0]!;
    expect(card.label).toBe('Card');
    expect(card.conflict).toBe(true);
    expect(card.summary).toBe('asked by 2 explorations, two different ways');
    expect(card.open).toBe(true);
    expect(card.href).toContain('exploration=4');
  });

  it('Button: 2 explorations and 1 change from you, one build for the same Large size', () => {
    const button = groups[1]!;
    expect(button.label).toBe('Button');
    expect(button.conflict).toBe(false);
    expect(button.summary).toBe('asked by 2 explorations and 1 change from you');
    expect(button.buildOnce?.key).toBe('4');
    expect(button.open).toBe(true);
  });

  it('single changes waiting on the lead stay folded, with their tag on the header', () => {
    const timeline = groups.find((g) => g.label === 'Timeline')!;
    expect(timeline).toMatchObject({
      summary: 'asked by Order fulfilment timeline',
      open: false,
      needsLead: true,
    });
    expect(timeline.tag?.label).toBe('Needs you');
    expect(groups.find((g) => g.label === 'Space inside cards')?.open).toBe(false);
  });

  it("the lead's own changes that wait on nobody fold into one last group", () => {
    const last = groups.at(-1)!;
    expect(last.label).toBe('Your own changes');
    expect(last.items.map((i) => i.key)).toEqual(['8', '9']);
    expect(last.summary).toBe('2 changes · accessibility fix, new brand');
    expect(last.open).toBe(false);
    expect(last.tag?.label).toBe('Being built');
  });

  it('another viewer reads the DS lead, not you', () => {
    const g = groupByComponent(LI7, { you: false });
    expect(g[1]!.summary).toBe('asked by 2 explorations and 1 change from the DS lead');
    expect(g.at(-1)!.label).toBe('More from the DS lead');
  });

  it("the lead never reads 'you' for a change someone else made", () => {
    const others = LI7.map((i) => ({ ...i, mine: false }));
    const g = groupByComponent(others, { you: true });
    expect(g[1]!.summary).toBe('asked by 2 explorations and 1 change from the DS lead');
    expect(g.at(-1)!.label).toBe('More from the DS lead');
    expect(groupByExploration(others, { you: true }).at(-1)!.label).toBe('From the DS lead');
  });

  it('one approved exploration and another waiting is no conflict', () => {
    const g = groupByComponent([LI7[2]!, LI7[3]!], { you: true });
    expect(g[0]!.conflict).toBe(false);
  });
});

describe('groupByExploration', () => {
  it('one group per exploration, those waiting on the lead first, the lead last', () => {
    const groups = groupByExploration(LI7, { you: true });
    expect(groups.at(-1)).toMatchObject({
      label: 'From you',
      summary: '3 changes',
    });
    expect(groups[0]!.needsLead).toBe(true);
    const bulk = groups.find((g) => g.label === 'Bulk actions on products')!;
    expect(bulk.summary).toBe('Acme Prints · 1 library change');
    expect(bulk.needsLead).toBe(false);
    expect(bulk.href).toContain('exploration=2&product=prints');
  });
});
