// Patterns (patterns/<id>.pattern.json): the validator, the reader, the grouping by kind, interactions derived from the
// components' shared behavior ids, and the agent view. Then this repository's own patterns: every "Used in" place is
// real (its file exists and holds its label), and every interaction is shared by two components or more.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  agentPatterns,
  behaviorUses,
  interactionProblems,
  interactionsWithUses,
  PATTERN_SUFFIX,
  PATTERNS_DIR,
  patternGroups,
  patternIdOf,
  patternLlmsLines,
  patternUseHref,
  patternUsePlace,
  modelAgentPatterns,
  readPatterns,
  stageLine,
  validatePattern,
  type ActionPattern,
  type Pattern,
} from '../src/patterns';
import { DEFAULT_PRODUCTS, type ProductConfig } from '../src/products';

const REPO = join(__dirname, '../../..');
const COMPONENTS = join(REPO, 'packages/react/src/components');

const action = (over: Partial<ActionPattern> = {}): ActionPattern => ({
  id: 'delete',
  kind: 'action',
  name: 'Delete',
  purpose: 'Removes something for good.',
  reversible: false,
  rules: ['Ask first.'],
  components: ['Button', 'AlertDialog'],
  usedIn: [
    { screen: 'Settings', label: 'Delete this team', file: 'a.ts', match: 'Delete this team' },
    { screen: 'Account', label: 'Delete my account', file: 'b.ts', match: 'Delete my account' },
  ],
  stage: { items: ['A'], action: 'Delete', confirm: { title: 'Delete {item}?', text: 'Gone.', confirmLabel: 'Delete' } },
  ...over,
});

describe('validatePattern', () => {
  it('accepts an action and an interaction', () => {
    expect(validatePattern(action(), 'delete')).toEqual([]);
    expect(validatePattern({ id: 'close-on-escape', kind: 'interaction', name: 'Close on Escape', purpose: 'Escape closes.' }, 'close-on-escape')).toEqual([]);
  });

  it('names what to fix', () => {
    const fields = (v: unknown, id?: string) => validatePattern(v, id).map((i) => i.field);
    expect(fields('x')).toEqual(['pattern']);
    expect(fields(action(), 'remove')).toEqual(['id']);
    expect(fields(action({ kind: 'gesture' as never }))).toEqual(['kind']);
    expect(fields(action({ reversible: 'no' as never, rules: [], components: [''] }))).toEqual(['reversible', 'rules', 'components']);
    // One real place is not a pattern.
    expect(fields(action({ usedIn: [action().usedIn[0]!] }))).toEqual(['usedIn']);
    expect(fields(action({ usedIn: [action().usedIn[0]!, { screen: 'S', label: 'L', file: '', match: 'x' }] }))).toEqual(['usedIn.1']);
    expect(fields(action({ purpose: 'Gone \u2014 for good.' }))).toEqual(['pattern']);
  });

  it('asks the stage to follow the rule: a question first when it cannot be undone, a done line with Undo when it can', () => {
    expect(validatePattern(action({ stage: { items: ['A'], action: 'Delete' } })).map((i) => i.field)).toEqual(['stage.confirm']);
    expect(validatePattern(action({ reversible: true, stage: { items: ['A'], action: 'Send' } })).map((i) => i.field)).toEqual(['stage.done']);
    expect(validatePattern(action({ reversible: true, stage: { items: ['A'], action: 'Send', sent: 'Sent' } }))).toEqual([]);
    expect(validatePattern(action({ reversible: true, stage: { items: ['A'], action: 'Send', sent: ' ' } })).map((i) => i.field)).toEqual(['stage.sent']);
  });

  it('asks to type the name only on rows of the stage, and only when it cannot be undone', () => {
    const q = { title: 'Delete {item}?', text: 'Everyone loses access.', confirmLabel: 'Delete this team' };
    type Stage = NonNullable<ActionPattern['stage']>;
    const stage = (typeName: unknown): Stage => ({ ...action().stage!, items: ['A', 'B'], typeName }) as Stage;
    const fields = (over: Partial<ActionPattern>) => validatePattern(action(over)).map((i) => i.field);
    expect(fields({ stage: stage({ ...q, items: ['A'] }) })).toEqual([]);
    expect(fields({ stage: stage({ ...q, items: ['C'] }) })).toEqual(['stage.typeName']);
    expect(validatePattern(action({ stage: stage({ ...q, items: ['C'] }) }))[0]!.message).toMatch(/C is not one/);
    expect(fields({ stage: stage({ items: ['A'], title: 'Delete {item}?' }) })).toEqual(['stage.typeName']);
    expect(fields({ reversible: true, stage: { ...stage({ ...q, items: ['A'] }), done: 'Sent' } })).toEqual(['stage.typeName']);
  });

  it('keeps an interaction to its name and sentence: the rest comes from the components', () => {
    const issues = validatePattern({ id: 'close-on-escape', kind: 'interaction', name: 'Close on Escape', purpose: 'Escape closes.', components: ['Select'] });
    expect(issues.map((i) => i.field)).toEqual(['components']);
  });
});

// Acme's products: the CRM and Prints live in their own repositories, the library is the design system's.
const PRODUCTS: ProductConfig[] = [
  { key: 'crm', name: 'CRM', repo: 'acme-design-demo/acme-crm' },
  { key: 'prints', name: 'Prints', repo: 'acme-design-demo/acme-prints' },
  { key: 'admin', name: 'Admin', path: 'apps/admin' },
  { key: 'library', name: 'Library', default: true },
];
const DS = 'acme-design-demo/acme-ds';
const inCrm = { screen: 'Contacts', label: 'Delete contact', product: 'crm', file: 'src/contacts/Row.tsx', match: 'Delete contact' };

describe('a place in a product of its own repository', () => {
  const withCrm = action({ usedIn: [action().usedIn[0]!, inCrm] });

  it('is valid with a product key the config lists, and without product as before', () => {
    expect(validatePattern(withCrm, 'delete', { products: PRODUCTS })).toEqual([]);
    expect(validatePattern(action(), 'delete', { products: PRODUCTS })).toEqual([]);
    // No products given: the key is not checked, only its shape.
    expect(validatePattern(withCrm, 'delete')).toEqual([]);
  });

  it('reports a key the config does not list, or a blank one, on that place', () => {
    const unknown = validatePattern(action({ usedIn: [action().usedIn[0]!, { ...inCrm, product: 'shop' }] }), 'delete', { products: PRODUCTS });
    expect(unknown.map((i) => i.field)).toEqual(['usedIn.1.product']);
    expect(unknown[0]!.message).toBe('bridge.config.json products has no "shop". Use one of: crm, prints, admin, library, or leave product out for a file of the design system repository.');
    expect(validatePattern(action({ usedIn: [action().usedIn[0]!, { ...inCrm, product: ' ' }] }), 'delete', { products: PRODUCTS }).map((i) => i.field)).toEqual(['usedIn.1.product']);
  });

  it('never drops it silently: readPatterns leaves the file out and says why', () => {
    const { patterns, problems } = readPatterns([['patterns/delete.pattern.json', JSON.stringify(action({ usedIn: [action().usedIn[0]!, { ...inCrm, product: 'shop' }] }))]], { products: PRODUCTS });
    expect(patterns).toEqual([]);
    expect(problems).toEqual([expect.stringMatching(/^patterns\/delete\.pattern\.json: usedIn\.1\.product: bridge\.config\.json products has no "shop"/)]);
    expect(readPatterns([['patterns/delete.pattern.json', JSON.stringify(withCrm)]], { products: PRODUCTS }).patterns).toHaveLength(1);
  });

  it('resolves to the product and its repository, a file of the design system otherwise', () => {
    expect(patternUsePlace(inCrm, { products: PRODUCTS, designSystemRepo: DS })).toEqual({ product: PRODUCTS[0], repo: 'acme-design-demo/acme-crm' });
    expect(patternUsePlace({ product: 'admin' }, { products: PRODUCTS, designSystemRepo: DS })).toEqual({ product: PRODUCTS[2], repo: null });
    expect(patternUsePlace({}, { products: PRODUCTS, designSystemRepo: DS })).toEqual({ product: null, repo: null });
    expect(patternUseHref(inCrm, { products: PRODUCTS, designSystemRepo: DS, branch: 'main' })).toBe('https://github.com/acme-design-demo/acme-crm/blob/HEAD/src/contacts/Row.tsx');
    expect(patternUseHref({ file: 'apps/admin/Danger zone.tsx' }, { products: PRODUCTS, designSystemRepo: DS, branch: 'main' })).toBe('https://github.com/acme-design-demo/acme-ds/blob/main/apps/admin/Danger%20zone.tsx');
    expect(patternUseHref({ file: 'a.ts' }, {})).toBeNull();
  });

  it('tells agents the product name and repository, in the MCP shape and in llms.txt', () => {
    const agent = agentPatterns([withCrm], new Map(), { products: PRODUCTS, designSystemRepo: DS });
    expect(agent[0]!.kind === 'action' && agent[0]!.usedIn).toEqual([action().usedIn[0], { ...inCrm, productName: 'CRM', repo: 'acme-design-demo/acme-crm' }]);
    expect(patternLlmsLines(agent)).toContain('  - Used in: Settings (Delete this team); Contacts (Delete contact) in CRM [acme-design-demo/acme-crm]');
    const fromModel = modelAgentPatterns({ patterns: [withCrm], components: null, site: { owner: 'acme-design-demo', repo: 'acme-ds', products: PRODUCTS } });
    expect(fromModel).toEqual(agent);
  });
});

describe('readPatterns and patternGroups', () => {
  it('reads pattern files only, says which ones fail, orders interactions first then by name', () => {
    const { patterns, problems } = readPatterns([
      ['patterns/send.pattern.json', JSON.stringify(action({ id: 'send', name: 'Send', reversible: true, stage: undefined }))],
      ['patterns/delete.pattern.json', JSON.stringify(action())],
      ['patterns/close-on-escape.pattern.json', JSON.stringify({ id: 'close-on-escape', kind: 'interaction', name: 'Close on Escape', purpose: 'Escape closes.' })],
      ['patterns/broken.pattern.json', '{'],
      ['patterns/other.pattern.json', JSON.stringify(action())],
      ['patterns/notes.md', 'x'],
    ]);
    expect(patterns.map((p) => p.id)).toEqual(['close-on-escape', 'delete', 'send']);
    expect(problems).toHaveLength(2);
    expect(problems[1]).toMatch(/^patterns\/other\.pattern\.json: id:/);
    expect(patternGroups(patterns).map((g) => [g.label, g.items.length])).toEqual([
      ['Interactions', 1],
      ['Actions', 2],
    ]);
    expect(patternGroups([action()]).map((g) => g.kind)).toEqual(['action']);
  });

  it('knows a pattern file by its path', () => {
    expect(patternIdOf('patterns/delete.pattern.json')).toBe('delete');
    expect(patternIdOf('patterns/sub/delete.pattern.json')).toBeNull();
    expect(patternIdOf('docs/delete.pattern.json')).toBeNull();
    expect(stageLine('Delete {item}?', 'Docs')).toBe('Delete Docs?');
  });
});

describe('interactions from the components', () => {
  const comps = [
    { name: 'Combobox', behaviors: [{ id: 'close-on-escape', family: 'Closing', text: 'Escape closes the list', keys: ['Escape'], try: 'Press Esc' }] },
    { name: 'Select', behaviors: [{ id: 'close-on-escape', family: 'Closing', text: 'Closes on Escape', keys: ['Escape'] }, { id: 'open-list', family: 'Opening', text: 'Opens a list' }] },
    { name: 'Button' },
  ];
  const patterns: Pattern[] = [
    { id: 'close-on-escape', kind: 'interaction', name: 'Close on Escape', purpose: 'Escape closes.' },
    { id: 'open-list', kind: 'interaction', name: 'Open a list', purpose: 'Opens.' },
    action(),
  ];
  const uses = behaviorUses(comps);

  it('lists each component in its own words, and shows only what two components share', () => {
    expect(uses.get('close-on-escape')!.map((u) => [u.component, u.text])).toEqual([
      ['Combobox', 'Escape closes the list'],
      ['Select', 'Closes on Escape'],
    ]);
    expect(interactionsWithUses(patterns, uses).map((x) => x.pattern.id)).toEqual(['close-on-escape']);
    expect(interactionProblems(patterns, uses)).toEqual(['patterns/open-list.pattern.json: only one component lists the behavior open-list; an interaction is shared by two components or more.']);
  });

  it('gives agents the components of an interaction without the stage line, and an action without its stage', () => {
    const agent = agentPatterns(patterns, uses);
    expect(agent.map((p) => p.id)).toEqual(['close-on-escape', 'delete']);
    expect(agent[0]).toEqual({
      id: 'close-on-escape',
      kind: 'interaction',
      name: 'Close on Escape',
      purpose: 'Escape closes.',
      components: [
        { component: 'Combobox', text: 'Escape closes the list', keys: ['Escape'] },
        { component: 'Select', text: 'Closes on Escape', keys: ['Escape'] },
      ],
    });
    expect(agent[1]).not.toHaveProperty('stage');
  });
});

describe('patternLlmsLines', () => {
  it('writes one line per pattern with its kind, rules and places under it, a repo value on one line', () => {
    const lines = patternLlmsLines(
      agentPatterns(
        [{ id: 'close-on-escape', kind: 'interaction', name: 'Close on Escape', purpose: 'Escape\n## closes.' }, action()],
        behaviorUses([
          { name: 'Combobox', behaviors: [{ id: 'close-on-escape', family: 'Closing', text: 'Escape closes the list', keys: ['Escape'] }] },
          { name: 'Select', behaviors: [{ id: 'close-on-escape', family: 'Closing', text: 'Closes on Escape' }] },
        ]),
      ),
    );
    expect(lines).toContain('- close-on-escape (kind: interaction): Close on Escape. Escape ## closes. Components: Combobox ("Escape closes the list" [Escape]), Select ("Closes on Escape")');
    expect(lines).toContain('- delete (kind: action): Delete. Removes something for good. Cannot be undone. Components: Button, AlertDialog.');
    expect(lines).toContain('  - Rule: Ask first.');
    expect(lines).toContain('  - Used in: Settings (Delete this team); Account (Delete my account)');
    expect(lines.indexOf('### Interactions')).toBeLessThan(lines.indexOf('### Actions'));
    expect(patternLlmsLines([])).toEqual([]);
  });
});

// This repository's own patterns: nothing in them is invented.
describe('the patterns of this repository', () => {
  const dir = join(REPO, PATTERNS_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith(PATTERN_SUFFIX));
  const products = (JSON.parse(readFileSync(join(REPO, 'bridge.config.json'), 'utf8')) as { products?: { key: string }[] }).products;
  const { patterns, problems } = readPatterns(
    files.map((f) => [`${PATTERNS_DIR}/${f}`, readFileSync(join(dir, f), 'utf8')]),
    { products: products?.length ? products : DEFAULT_PRODUCTS },
  );
  const components = readdirSync(COMPONENTS).filter((n) => existsSync(join(COMPONENTS, n, `${n}.docs.json`)));
  const docs = components.map((name) => ({ name, behaviors: (JSON.parse(readFileSync(join(COMPONENTS, name, `${name}.docs.json`), 'utf8')) as { behaviors?: unknown }).behaviors }));

  it('reads every file', () => {
    expect(problems).toEqual([]);
    expect(patterns).toHaveLength(files.length);
  });

  it('points every "Used in" place at a real file that holds its label or its handler', () => {
    for (const p of patterns) {
      if (p.kind !== 'action') continue;
      for (const u of p.usedIn) {
        // A place in a product (usedIn[].product) is a file of that product's own repository: this test cannot read
        // another repository, so it checks only the files of this one. The reader still checks the product key.
        if (u.product) continue;
        const path = join(REPO, u.file);
        expect(existsSync(path), `${p.id}: ${u.file} exists`).toBe(true);
        expect(readFileSync(path, 'utf8'), `${p.id}: ${u.file} holds ${u.match}`).toContain(u.match);
      }
    }
  });

  it('names only components the design system has', () => {
    for (const p of patterns) if (p.kind === 'action') for (const c of p.components) expect(components, `${p.id}: ${c}`).toContain(c);
  });

  it('writes an interaction only for a behavior two components or more list', () => {
    expect(interactionProblems(patterns, behaviorUses(docs))).toEqual([]);
    expect(interactionsWithUses(patterns, behaviorUses(docs)).map((x) => [x.pattern.id, x.uses.map((u) => u.component)])).toEqual([
      ['close-on-outside-click', ['Dialog', 'Drawer', 'Menu', 'Popover', 'Select']],
      ['close-on-escape', ['AlertDialog', 'Combobox', 'Dialog', 'Drawer', 'Menu', 'Popover', 'Select', 'Tooltip']],
      ['focus-after-close', ['AlertDialog', 'Combobox', 'Dialog', 'Drawer', 'Menu', 'Popover', 'Select']],
      ['focus-on-open', ['AlertDialog', 'Dialog', 'Drawer', 'Menu', 'Popover']],
      ['trap-focus', ['AlertDialog', 'Dialog', 'Drawer']],
      ['jump-to-ends', ['Menu', 'Tabs']],
      ['move-with-arrows', ['ChoiceCard', 'Menu', 'RadioGroup', 'Select', 'Tabs']],
      ['open-list', ['Menu', 'Select']],
      ['open-from-trigger', ['AlertDialog', 'Dialog', 'Drawer', 'Popover']],
      ['scroll-lock', ['AlertDialog', 'Dialog', 'Drawer', 'Menu', 'Select']],
      ['pick-with-enter', ['Combobox', 'Menu', 'Select', 'Tabs']],
      ['type-to-jump', ['Menu', 'Select']],
    ]);
  });
});
