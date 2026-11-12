// Studio Quality, the view: what the redesigned page shows, from the numbers both versions of the page already compute
// (the self-hosted page from lib/stats.ts at build time, the team page from lib/team-quality.ts in the browser).
// One story first: a verdict with a mood for the lighthouse drawing (clear, haze, fog) and at most one action, then
// three pillars of the same shape (accessibility, adoption, documentation), then adoption per product with the
// earlier runs kept aside. Pure: quality-view.test.ts covers the grouping and the verdict.
import { deltaPhrase, type Finding } from './quality';
import { HEALTH_SECTION, type HealthFigure } from './library-health';
import { pctWord, pieceWord } from './adoption-report';

/** The weather around the lighthouse: clear when nothing needs you, haze when something needs a look, fog when it blocks. */
export type Mood = 'clear' | 'haze' | 'fog';

export interface Verdict {
  mood: Mood;
  /** The one display line (Fraunces). */
  title: string;
  /** One plain sentence under it. */
  sentence: string;
  /** The one primary action of the page: only when something needs the viewer. */
  action: { label: string; href: string } | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A product counts as barely using the library under this share of its components from the design system. The one
 * threshold the verdict uses: the page shows each product's share next to it, so the verdict never calls a library
 * healthy next to a product far under it.
 */
export const LOW_ADOPTION_PCT = 50;

/**
 * Unused tokens count against health past this share of the tokens designers pick from (the semantic set Studio
 * Tokens lists). Unused primitives never do: a palette keeps steps no role reads yet.
 */
export const UNUSED_TOKENS_SHARE = 0.25;

/**
 * Token counts, one definition for the Quality page, its verdict and the line that links to Studio Tokens:
 * `tokens` are the semantic tokens designers pick from (the set Studio Tokens lists by default), `primitives` the raw
 * palette and scale values under them. "Unused" means no component or global stylesheet reads it, directly or
 * through an alias (core tokenUsage).
 */
export interface TokenUsageCount {
  tokens: { total: number; unused: number };
  primitives: { total: number; unused: number };
}

/** Every unused token, both kinds. */
export const unusedCount = (u: TokenUsageCount): number => u.tokens.unused + u.primitives.unused;

/** One product's share of components from the design system, as the adoption card shows it. */
export interface ProductShare {
  name: string;
  pct: number | null;
}

/** A reason the library is not called healthy although nothing blocks it. */
export interface HealthGap {
  kind: 'adoption' | 'tokens';
  text: string;
}

/** What keeps the library from being healthy although nothing blocks it, in plain words, from the shown numbers. */
export function healthGaps(input: { products?: readonly ProductShare[] | undefined; tokens?: TokenUsageCount | undefined }): HealthGap[] {
  const out: HealthGap[] = [];
  const low = (input.products ?? []).filter((p): p is { name: string; pct: number } => p.pct !== null && p.pct < LOW_ADOPTION_PCT).sort((a, b) => a.pct - b.pct);
  for (const p of low) out.push({ kind: 'adoption', text: `${p.name} takes ${Math.round(p.pct)}% of its components from the library` });
  const t = input.tokens?.tokens;
  if (t && t.total > 0 && t.unused / t.total > UNUSED_TOKENS_SHARE) out.push({ kind: 'tokens', text: `${t.unused} of ${t.total} tokens are not in use` });
  return out;
}

const sentenceOf = (parts: readonly string[]) => {
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
  return list ? `${list.charAt(0).toUpperCase()}${list.slice(1)}.` : '';
};

/** The verdict's words when every shown number is fine: the only place the page says the library is healthy. */
export const HEALTHY_TITLE = 'The library is healthy';

/**
 * The verdict, from the same numbers the page shows: contrast failures and blocking findings (fog), then the other
 * open findings and the health gaps (haze: low adoption in a product, many unused tokens), else clear. "The library
 * is healthy" only when nothing blocks it, nothing needs a look and no product is far from using it.
 */
export function qualityVerdict(input: { contrastFail: number; findings: Finding[]; products?: readonly ProductShare[] | undefined; tokens?: TokenUsageCount | undefined }): Verdict {
  const open = input.findings.filter((f) => f.severity === 'fail' || f.severity === 'warn');
  const blocking = open.filter((f) => f.severity === 'fail');
  if (input.contrastFail) {
    return {
      mood: 'fog',
      title: 'Something blocks the library',
      sentence: `${plural(input.contrastFail, 'color pair fails', 'color pairs fail')} contrast, so the token build waits until ${input.contrastFail === 1 ? 'it passes' : 'they pass'}.`,
      action: { label: 'See the failing pairs', href: `#${HEALTH_SECTION.contrast}` },
    };
  }
  if (blocking.length) {
    const first = blocking[0]!;
    return {
      mood: 'fog',
      title: 'Something blocks the library',
      sentence: blocking.length === 1 ? `${first.title.replace(/\.$/, '')}.` : `${plural(blocking.length, 'problem')} to fix, starting with ${first.title.replace(/\.$/, '')}.`,
      action: first.action ? { label: 'Fix it', href: first.action.href } : null,
    };
  }
  const gaps = healthGaps(input);
  if (open.length || gaps.length) {
    const first = open[0];
    const label = first?.action?.label === 'Review' ? 'Review guidance' : (first?.action?.label ?? null);
    const findingLine = !first ? '' : open.length === 1 ? `${first.title.replace(/\.$/, '')}.` : `${plural(open.length, 'thing needs', 'things need')} a look, starting with ${first.title.replace(/\.$/, '')}.`;
    // The button follows the headline (owner, 2026-11-12): a product far from using the library is the headline, so
    // its button opens the products; otherwise the first finding's action, else the unused tokens.
    const adoption = gaps.some((g) => g.kind === 'adoption');
    const action = adoption
      ? { label: 'See each product', href: `#${HEALTH_SECTION.adoption}` }
      : first?.action && label
        ? { label: open.length === 1 ? label : 'Start with the first', href: first.action.href }
        : gaps[0]
          ? { label: 'See unused tokens', href: '#ql-tokens' }
          : null;
    return {
      mood: 'haze',
      title: adoption ? 'Nothing blocks the library, but not every product uses it yet' : 'Nothing blocks the library',
      sentence: [sentenceOf(gaps.map((g) => g.text)), findingLine].filter(Boolean).join(' '),
      action,
    };
  }
  return { mood: 'clear', title: HEALTHY_TITLE, sentence: 'Nothing blocks it and nothing needs you. Bridge checks again with every change.', action: null };
}

// ---------------------------------------------------------------------------------------------------------------
// The three pillars: the same card for each (name, one big number, a meter when the number is a ratio, one sentence,
// where to look next).

export interface Pillar {
  id: 'contrast' | 'adoption' | 'guidance';
  /** The pillar's name, the card's title. */
  name: string;
  /** The big honest number: "304 of 304", "98.9%", or words when there is nothing to count. */
  value: string;
  /** What the number counts. */
  label: string;
  /** 0 to 100 when the number is a ratio; null leaves the meter out. */
  meter: number | null;
  /** One plain sentence. */
  sentence: string;
  /** Danger only when something fails. */
  tone: 'fail' | null;
  /** Where to look next: its section further down. */
  next: { label: string; href: string };
  /**
   * The pillar's own picture, so the card shows what the number is made of instead of a meter that is full on every
   * card: the brand and theme tiles, each product's share, one dot per component. Null keeps the meter and sentence.
   */
  viz: PillarViz | null;
  /** The adoption gain since before Bridge, in points ("+90.2 pts"), next to the number. */
  delta: string | null;
}

export type PillarViz =
  | { kind: 'combos'; items: { label: string; pass: number; total: number }[] }
  | { kind: 'products'; items: { name: string; pct: number }[] }
  | { kind: 'docs'; reviewed: number; drafted: number; total: number };

export interface PillarInput {
  figures: HealthFigure[];
  contrast: { total: number; fail: number; hasChecks?: boolean };
  /** Combined component adoption now (0 to 100), null without an audit. */
  adoption: number | null;
  /** Combined adoption before Bridge, for the gain next to the number. */
  adoptionBefore?: number | null | undefined;
  /** What the earlier value was, as the adoption sentence says it: "before Bridge" (default) or "at the first audit". */
  adoptionSince?: string | undefined;
  /**
   * Each product's latest component adoption, for the adoption card's rows, with how many components it uses (`uses`):
   * the headline weighs each product by it, so the card says how many it counts.
   */
  products?: { name: string; pct: number | null; uses?: number }[] | undefined;
  /** The contrast checks per brand and theme, for the accessibility card's tiles. */
  combos?: { label: string; pass: number; total: number }[] | undefined;
  guidance: { total: number; reviewed: number; drafted?: number | undefined };
}

/** The pillars, in the page's order: accessibility, adoption, documentation. Each reuses its health figure's sentence. */
export function qualityPillars(input: PillarInput): Pillar[] {
  const fig = (id: HealthFigure['id']) => input.figures.find((f) => f.id === id);
  const c = input.contrast;
  const contrastFig = fig('contrast');
  const adoptionFig = fig('adoption');
  const guidanceFig = fig('guidance');
  const checks = c.hasChecks !== false && c.total > 0;
  const pass = c.total - c.fail;
  const g = input.guidance;
  const combos = checks && input.combos?.length ? input.combos : null;
  const products = (input.products ?? []).filter((p): p is { name: string; pct: number; uses?: number } => p.pct !== null);
  // The headline counts every component in every product (lib/library-health combinedAdoption), so a big product weighs
  // more than a small one and the number is not the mean of the rows: the label says what it counts.
  const uses = products.length > 1 && products.every((p) => typeof p.uses === 'number') ? products.reduce((n, p) => n + (p.uses ?? 0), 0) : null;
  const before = input.adoption !== null && input.adoptionBefore != null ? input.adoption - input.adoptionBefore : null;
  return [
    {
      id: 'contrast',
      name: 'Accessibility',
      value: checks ? `${pass} of ${c.total}` : (contrastFig?.value ?? 'No checks yet'),
      label: checks ? 'color pairs pass contrast' : 'contrast checks',
      meter: checks ? (pass / c.total) * 100 : null,
      sentence: checks ? (contrastFig?.detail ?? '') : (contrastFig?.detail ?? 'No contrast checks are set up yet.'),
      tone: c.fail ? 'fail' : null,
      next: { label: c.fail ? 'See the failing pairs' : 'See each brand and theme', href: `#${HEALTH_SECTION.contrast}` },
      viz: combos ? { kind: 'combos', items: combos } : null,
      delta: null,
    },
    {
      id: 'adoption',
      name: 'Adoption',
      value: input.adoption === null ? (adoptionFig?.value ?? 'No audit yet') : (adoptionFig?.value ?? ''),
      label: input.adoption === null ? 'adoption in products' : uses ? `of all ${uses.toLocaleString('en-US')} components in ${products.length} products come from the design system` : 'of components come from the design system',
      meter: input.adoption,
      sentence: adoptionFig?.detail ?? 'No adoption audit has been published yet.',
      tone: null,
      next: { label: input.adoption === null ? 'How adoption is measured' : 'See each product', href: `#${HEALTH_SECTION.adoption}` },
      viz: input.adoption !== null && products.length ? { kind: 'products', items: products.map((p) => ({ name: p.name, pct: p.pct })) } : null,
      delta: before !== null && Math.abs(before) >= 0.1 ? `${before > 0 ? '+' : '−'}${Math.round(Math.abs(before) * 10) / 10} pts ${input.adoptionSince === 'at the first audit' ? 'since the first audit' : 'since Bridge'}` : null,
    },
    {
      id: 'guidance',
      name: 'Documentation',
      value: guidanceFig?.value ?? `${g.reviewed} of ${g.total}`,
      label: g.total ? 'components have reviewed guidance' : 'components to document',
      meter: g.total ? (g.reviewed / g.total) * 100 : null,
      sentence: guidanceFig?.detail ?? '',
      tone: null,
      next: { label: g.reviewed < g.total ? 'See what is left' : 'See the guidance', href: `#${HEALTH_SECTION.guidance}` },
      viz: g.total ? { kind: 'docs', reviewed: g.reviewed, drafted: g.drafted ?? 0, total: g.total } : null,
      delta: null,
    },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Adoption per product: the latest run of each product leads, with its trend when an earlier run exists; every other
// run (the before and after of a migration, a product no longer audited) waits under Earlier runs.

export interface AdoptionRun {
  id: string;
  /** The run's own label ("Bridge admin, after migration"). */
  label: string;
  /** What groups runs into one product: the audited folder, or the app id on the self-hosted page. */
  product: string;
  /** The product's name when the caller knows it; otherwise it comes from the label. */
  productName?: string;
  /** ISO date of the run. */
  generatedAt: string;
  token: number | null;
  component: number | null;
  /** Component instances from the design system, and every UI component instance. */
  ds: number;
  ui: number;
  /** The full report. */
  href: string;
  /** The run before the product moved to Bridge (the self-hosted page knows it): the trend says so instead of a date. */
  baseline?: boolean;
  /** The group of pieces that moves the components figure most once it uses the library (core SnapshotAudit.topGain). */
  topGain?: { component: string; gain: number };
}

export interface ProductAdoption {
  product: string;
  name: string;
  latest: AdoptionRun;
  /** The run before the latest, for the trend; null with one run. */
  previous: AdoptionRun | null;
  /** The first run, for the combined figure's starting point; null with one run. */
  first: AdoptionRun | null;
  /** How many runs this product has. */
  runs: number;
}

export interface AdoptionView {
  products: ProductAdoption[];
  /** Every other run, newest first. */
  earlier: AdoptionRun[];
}

/** A product's name from a run label: "Bridge admin, main" is "Bridge admin"; a label without a comma is the name. */
export function productName(label: string): string {
  const i = label.lastIndexOf(', ');
  return i > 0 ? label.slice(0, i) : label;
}

/** Runs taken by one snapshot land within seconds; an hour of slack keeps a slow workflow's runs together. */
const SAME_SNAPSHOT_MS = 60 * 60 * 1000;

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Groups runs by product. `liveSince` is when the snapshot was written: when some runs come from it, only the products
 * those runs audit are current, and a product no longer audited (a migration's original source) moves to the
 * earlier runs. Without live runs (reports carried as files), each product's latest run is current.
 */
export function adoptionView(runs: readonly AdoptionRun[], opts: { liveSince?: string } = {}): AdoptionView {
  const byProduct = new Map<string, AdoptionRun[]>();
  for (const r of runs) byProduct.set(r.product, [...(byProduct.get(r.product) ?? []), r]);
  const groups = [...byProduct.values()].map((list) => [...list].sort((a, b) => time(a.generatedAt) - time(b.generatedAt)));
  const since = opts.liveSince ? time(opts.liveSince) - SAME_SNAPSHOT_MS : null;
  const isLive = (r: AdoptionRun) => since !== null && time(r.generatedAt) >= since;
  const anyLive = runs.some(isLive);
  const current = groups.filter((g) => !anyLive || isLive(g[g.length - 1]!));
  const products: ProductAdoption[] = current
    .map((g) => {
      const latest = g[g.length - 1]!;
      return {
        product: latest.product,
        name: latest.productName ?? productName(latest.label),
        latest,
        previous: g.length > 1 ? g[g.length - 2]! : null,
        first: g.length > 1 ? g[0]! : null,
        runs: g.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = new Set(products.map((p) => p.latest));
  const earlier = runs.filter((r) => !shown.has(r)).sort((a, b) => time(b.generatedAt) - time(a.generatedAt));
  return { products, earlier };
}

/** The current products in the shape of the combined health figure: the latest run now, the first run before. */
export function adoptionFigureInput(view: AdoptionView): { now: { dsComponentInstances: number; uiComponentInstances: number }; before: { dsComponentInstances: number; uiComponentInstances: number } | null }[] {
  const m = (r: AdoptionRun) => ({ dsComponentInstances: r.ds, uiComponentInstances: r.ui });
  return view.products.map((p) => ({ now: m(p.latest), before: p.first ? m(p.first) : null }));
}

/** A run's date as the page shows it: "Oct 16, 2026". */
export const runDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
};

/** The trend of a product's components since its run before: "Up 1 point since Oct 16, 2026." Null with one run. */
export function productTrend(p: ProductAdoption): string | null {
  if (!p.previous || p.previous.component === null || p.latest.component === null) return null;
  return deltaPhrase(p.latest.component - p.previous.component, p.previous.baseline ? 'before the move to Bridge' : runDate(p.previous.generatedAt));
}

/** A percentage as the page shows it: one decimal, "n/a" when the audit has nothing to count. */
export const pctLabel = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 10) / 10}%`);

/**
 * The calm token note, each kind counted against its own total so the number matches the list it opens:
 * "14 of 119 tokens and 86 of 267 primitives are not in use yet", or that every token is in use.
 */
export function unusedLine(u: TokenUsageCount): string {
  if (!unusedCount(u)) return 'Every token is in use';
  const part = (n: number, total: number, one: string, many: string) => (total ? `${n} of ${total} ${total === 1 ? one : many}` : `${n} ${n === 1 ? one : many}`);
  const parts = [u.tokens.unused ? part(u.tokens.unused, u.tokens.total, 'token', 'tokens') : '', u.primitives.unused ? part(u.primitives.unused, u.primitives.total, 'primitive', 'primitives') : ''].filter(Boolean);
  return `${parts.join(' and ')} ${unusedCount(u) === 1 ? 'is' : 'are'} not in use yet`;
}

/**
 * The biggest gain of a run in one plain line ("Buttons would take it from 13% to 24%."), or null when the run does not
 * carry one or it would not raise the figure.
 */
export function gainLine(run: Pick<AdoptionRun, 'component' | 'topGain'>): string | null {
  const g = run.topGain;
  if (!g || run.component === null || g.gain <= run.component) return null;
  const what = pieceWord(g.component, 2);
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} would take it from ${pctWord(run.component, g.gain)} to ${pctWord(g.gain, run.component)}.`;
}

/**
 * The Home health line when no contrast check fails. Home knows only the contrast gate (not adoption nor unused
 * tokens), so it says what it knows, in the verdict own words, and leaves "healthy" to the Quality page.
 */
export const HOME_CLEAR_LINE = 'Nothing blocks the library.';
