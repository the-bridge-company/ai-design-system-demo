// Types of the `bridge audit` report: design-system adoption and drift in a product codebase.
// The JSON report is versioned (`schemaVersion`); packages/core/audit-report.schema.json describes it.

export const AUDIT_SCHEMA_VERSION = 1;

/** What a hardcoded value stands for. */
export type FindingCategory =
  | 'color'
  | 'spacing'
  | 'size'
  | 'radius'
  | 'border-width'
  | 'shadow'
  | 'duration'
  | 'easing'
  | 'z-index'
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'line-height';

export const FINDING_CATEGORIES: FindingCategory[] = ['color', 'spacing', 'size', 'radius', 'border-width', 'shadow', 'duration', 'easing', 'z-index', 'font-family', 'font-size', 'font-weight', 'line-height'];

/** Where a value was written. */
export type FindingSource = 'css' | 'style' | 'sx' | 'styled' | 'theme' | 'tailwind' | 'jsx-attr' | 'js';

export type Confidence = 'exact' | 'high' | 'medium' | 'low';

export interface TokenSuggestion {
  /** Token path, e.g. color.text.muted. */
  token: string;
  /** CSS variable, e.g. --color-text-muted. */
  cssVar: string;
  /** Resolved token value in the mode it matched. */
  value: string;
  /** Mode combination the value matched in (colors), e.g. "theme=dark". Absent for the default mode. */
  mode?: string;
  /** deltaE OK x 100 for colors, px for lengths, ms for durations, steps otherwise. 0 = exact. */
  distance: number;
  /** 0..1 */
  confidence: number;
  level: Confidence;
}

export interface StyleFinding {
  line: number;
  column: number;
  category: FindingCategory;
  /** CSS property (kebab-case) or object key the value belongs to. */
  property?: string;
  /** The literal as written: "#1976d2", "13px", "p-[13px]". */
  value: string;
  source: FindingSource;
  suggestion?: TokenSuggestion;
  /** `bridge audit --fix` can replace it (exact token match in a CSS file). */
  autofix?: boolean;
}

export type ComponentKind = 'ds' | 'foreign' | 'native' | 'recreated';

export interface ComponentFinding {
  line: number;
  column: number;
  /** JSX name as written: Button, Card.Header, button. */
  name: string;
  kind: Exclude<ComponentKind, 'ds'>;
  /** Package or origin: @mui/material, react-admin, shadcn/ui (local), native, local. */
  library: string;
  /** DS component to use instead, when one fits. */
  suggestion?: string;
}

export interface FileReport {
  /** Path relative to the audited root, with forward slashes. */
  path: string;
  lang: 'css' | 'scss' | 'less' | 'tsx' | 'jsx' | 'ts' | 'js' | 'astro' | 'vue' | 'svelte';
  tokenUsages: number;
  /** References to another theme (MUI theme, Tailwind scale classes): not hardcoded, not the DS either. */
  themeRefs: number;
  hardcoded: number;
  dsComponents: number;
  /** Foreign, native and re-created component instances. */
  otherComponents: number;
  findings: StyleFinding[];
  components: ComponentFinding[];
  /** Findings and components left out of the counts on purpose, each with its reason. */
  ignored?: IgnoredItem[];
  /** `bridge-audit-ignore-next-line` comments that ignored nothing because they give no reason. */
  ignoreErrors?: { line: number; message: string }[];
}

/** Where an ignore comes from: an escape-hatch comment in the file, or an entry of the allowlist file. */
export type IgnoreVia = 'comment' | 'allowlist';

/** A finding or component the audit saw but does not count, kept in the report so it stays visible. */
export interface IgnoredItem {
  line: number;
  column: number;
  kind: 'value' | 'component';
  /** The value as written ("13px") or the element or component name ("select"). */
  what: string;
  reason: string;
  via: IgnoreVia;
}

/** One entry of an allowlist file: a known violation, left out of the counts for a stated reason. */
export interface AllowlistEntry {
  /** Path relative to the audited folder, as in the report. */
  file: string;
  line: number;
  /** Element, component or value on that line ("select", "13px"). Absent: everything on the line. */
  what?: string;
  reason: string;
}

export interface CategoryCount {
  hardcoded: number;
  /** Findings whose value equals a token (safe to replace). */
  exact: number;
  /** Findings with a token suggestion of any confidence. */
  suggested: number;
}

export interface TopFix {
  category: FindingCategory;
  value: string;
  count: number;
  files: number;
  suggestion?: TokenSuggestion;
}

export interface AuditMetrics {
  /** token usages / (token usages + hardcoded), in percent, one decimal. Null when the code has no style value at all. */
  tokenAdoption: number | null;
  /** DS component instances / all UI component instances, in percent, one decimal. Null without UI components. */
  componentAdoption: number | null;
  tokenUsages: number;
  hardcoded: number;
  themeRefs: number;
  dsComponentInstances: number;
  uiComponentInstances: number;
}

export interface HistoryPoint {
  label?: string;
  generatedAt: string;
  /** The audited commit (target.ref), when known: one point per commit. */
  ref?: string;
  tokenAdoption: number | null;
  componentAdoption: number | null;
  hardcoded: number;
  uiComponentInstances: number;
  dsComponentInstances: number;
}

export interface BaselineDiff {
  label?: string;
  generatedAt: string;
  tokenAdoption: { before: number | null; after: number | null; delta: number | null };
  componentAdoption: { before: number | null; after: number | null; delta: number | null };
  hardcoded: { before: number; after: number; delta: number };
  byCategory: Partial<Record<FindingCategory, { before: number; after: number; delta: number }>>;
  /** Files with fewer hardcoded values or non-DS components than in the baseline. */
  improved: { path: string; before: number; after: number }[];
  regressed: { path: string; before: number; after: number }[];
  newFiles: string[];
  removedFiles: string[];
}

/**
 * A screen of the audited product (`bridge snapshot` from products[].screens or the file routes, see screens.ts): the
 * route to open on the product's address and the files that make it. The picture fields are set once the screen was
 * captured (scripts/preview-shots.mjs screens, into the bridge-shots branch of the design system repository).
 */
export interface AuditScreen {
  /** As opened on the product's address: "/", "/settings", "/#/contacts". */
  route: string;
  /** What a person reads: "Contacts". */
  name: string;
  /** Files of the report (paths as in files[]) that make this screen. */
  files: string[];
  /** The picture in the bridge-shots branch: "audits/<audit id>/<slug>.webp". */
  image?: string;
  /** The address it was captured from. */
  url?: string;
  capturedAt?: string;
  width?: number;
  height?: number;
}

/**
 * A close picture of one group of pieces (adoptionPieces) as the product draws it: a few real instances of the piece
 * (three buttons side by side, one open dialog), cropped from a screen of the live product. `bridge snapshot` writes
 * the group and the screen to look on first; scripts/preview-shots.mjs screens sets the picture fields.
 */
export interface AuditCrop {
  /** The group: "piece:Button". */
  key: string;
  /** The library component of the group: "Button". */
  component: string;
  /** The screen to look on first (a route of screens[]): the one that holds most of the group. */
  route?: string;
  /** The picture in the bridge-shots branch: "audits/<audit id>/piece-button.webp". */
  image?: string;
  /** The route of the screen it was cropped from (may differ from `route` when the piece was not found there). */
  from?: string;
  /** The address it was cropped from. */
  url?: string;
  capturedAt?: string;
  /** Size of the crop in CSS pixels: the picture holds twice as many, for sharp text. */
  width?: number;
  height?: number;
}

export interface AuditReport {
  $schema?: string;
  schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  tool: { name: 'bridge'; version: string };
  label?: string;
  generatedAt: string;
  target: {
    path: string;
    files: number;
    skipped: number;
    /** The audited code's GitHub repository ("owner/name"), when it is a git checkout of one (bridge snapshot). */
    repo?: string;
    /** The commit the audited code was at, so links to a file and line stay right. */
    ref?: string;
    /** The audited folder inside that repository ("src", "" for its root). Files are relative to it. */
    root?: string;
  };
  designSystem: { packages: string[]; components: number; tokens: number; modes: string[] };
  metrics: AuditMetrics;
  byCategory: Partial<Record<FindingCategory, CategoryCount>>;
  components: {
    ds: Record<string, number>;
    foreign: Record<string, { instances: number; components: Record<string, number> }>;
    native: Record<string, number>;
    recreated: { name: string; file: string; line: number; instances: number }[];
  };
  topFiles: { path: string; hardcoded: number; otherComponents: number; tokenUsages: number; dsComponents: number }[];
  topFixes: TopFix[];
  files: FileReport[];
  baseline?: BaselineDiff;
  /** What was left out of the counts on purpose (escape-hatch comments, allowlist), and allowlist entries that match nothing. */
  ignored?: {
    total: number;
    comment: number;
    allowlist: number;
    items: (IgnoredItem & { file: string })[];
    staleAllowlist: AllowlistEntry[];
  };
  /** Earlier runs, oldest first (carried over from the baseline). */
  history: HistoryPoint[];
  /** The product's screens and the files that make each one, with their pictures once captured. */
  screens?: AuditScreen[];
  /** A close picture of each group of pieces, cropped from those screens once captured. */
  crops?: AuditCrop[];
}
