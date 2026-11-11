// The adoption report read as a designer reads a screen: whole pieces, not JSX lines. A menu with its trigger, content
// and items is one menu; a dialog with its title and footer is one dialog. Findings that name the same library
// component to use instead ("use Button") are one group, whatever they come from (the product's own shadcn/ui copy, an
// HTML <button>, another library), so the report lists a few causes instead of hundreds of lines. Values (colors,
// sizes, spacing) group by the library token they are closest to, with how close it is.
// Pure (no fs, no TypeScript compiler): Studio runs it in the browser on a published report, the CLI on a fresh one.
import { parseCssColor } from './color';
import { scanClassString } from './tailwind';
import type { AuditReport, ComponentFinding, Confidence, FindingCategory, FindingSource, StyleFinding, TokenSuggestion } from './types';
import { rgbaToHex, type Rgba } from '../values';

/** #rrggbb, or #rrggbbaa when it is see-through. */
const toHex = (c: Rgba) => (c.a < 1 ? `${rgbaToHex(c)}${Math.round(Math.max(0, c.a) * 255).toString(16).padStart(2, '0')}` : rgbaToHex(c));

/** One component found in the code, with the piece it belongs to. */
export interface PiecePlace {
  /** Path relative to the audited folder. */
  file: string;
  line: number;
  column: number;
  /** As written: Button, DropdownMenuItem, Dialog.Title, button. */
  name: string;
  library: string;
  kind: ComponentFinding['kind'];
  /** A part of a bigger piece (a menu's item, a dialog's title): it switches with its piece. */
  part: boolean;
}

/** Where a group's pieces come from: the product's own copy, plain HTML, another library. */
export interface PieceSource {
  /** Words for people: "shadcn/ui", "HTML", "own copy", "react-router". */
  label: string;
  library: string;
  /** The product keeps this code itself (a local copy of shadcn/ui, a component written in the product). */
  local: boolean;
  /** Whole pieces from this source. */
  pieces: number;
}

/** A local file that re-creates the library component: pointing it at the library switches all its uses at once. */
export interface PieceSourceFile {
  file: string;
  line: number;
  name: string;
  /** How many places use it. */
  instances: number;
}

export interface PieceGroup {
  /** Stable across runs: "piece:Button". Requests and "Not a problem" decisions are kept by it. */
  key: string;
  /** The library component to use instead. */
  component: string;
  /** Whole pieces (a menu with its items counts once). */
  pieces: number;
  /** Every component the audit counted, parts included: what the adoption figure counts. */
  instances: number;
  /** Parts of the app (files) they are spread over. */
  files: number;
  sources: PieceSource[];
  /** The product's own copy of this component, when one change covers most of them. */
  sourceFile?: PieceSourceFile;
  places: PiecePlace[];
  /** Component adoption, in percent, once this group uses the library. Null without UI components. */
  gain: number | null;
}

/** A piece the library has nothing like: no library component to use instead. */
export interface LibraryGap {
  key: string;
  /** As written in the code: Item, ResponsiveBar, Toggle. */
  name: string;
  library: string;
  pieces: number;
  instances: number;
  files: number;
  places: PiecePlace[];
}

export interface AdoptionPieces {
  /** Component adoption now, in percent (the report's figure). */
  current: number | null;
  dsInstances: number;
  uiInstances: number;
  /** Biggest change first. */
  groups: PieceGroup[];
  missing: LibraryGap[];
  /** Parts counted with their piece (dialog titles, tooltip texts), and the most common ones. */
  parts: { count: number; examples: string[] };
  /** Instances that come from code the product keeps itself (its own shadcn/ui copy, re-created components). */
  local: { instances: number; share: number };
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

/** "shadcn/ui (local)" -> "shadcn/ui"; "native" -> "HTML"; "local" -> "own copy". */
export function sourceLabel(library: string): string {
  if (library === 'native') return 'HTML';
  if (library === 'local') return 'own copy';
  return library.replace(/\s*\(local\)$/, '');
}

const isLocal = (c: Pick<ComponentFinding, 'kind' | 'library'>) => c.kind === 'recreated' || /\(local\)$/.test(c.library);

const upperAt = (s: string, i: number) => {
  const ch = s.charAt(i);
  return ch !== '' && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
};

interface Entry {
  file: string;
  c: ComponentFinding;
}

/**
 * Whole pieces of a report: every component finding is put under its piece (DropdownMenuItem under DropdownMenu,
 * Dialog.Title under Dialog), and pieces are grouped by the library component to use instead. A piece no library
 * component fits is a missing piece. `files` keeps only the files it accepts (an area of the app).
 */
export function adoptionPieces(report: Pick<AuditReport, 'files' | 'metrics' | 'components'>, opts: { files?: (path: string) => boolean } = {}): AdoptionPieces {
  const keep = opts.files ?? (() => true);
  const entries: Entry[] = report.files.filter((f) => keep(f.path)).flatMap((f) => f.components.map((c) => ({ file: f.path, c })));
  // The library's component names: every suggestion the audit made, and the ones the product already uses.
  const known = new Set<string>([...Object.keys(report.components.ds), ...entries.flatMap((e) => (e.c.suggestion ? [e.c.suggestion] : []))]);
  // Names per library, to find a part's piece by its prefix (DialogTitle -> Dialog).
  const names = new Map<string, Map<string, string | undefined>>();
  for (const { c } of entries) {
    const lib = names.get(c.library) ?? new Map<string, string | undefined>();
    const base = c.name.split('.')[0]!;
    if (!lib.has(base) || (!lib.get(base) && c.suggestion && !c.name.includes('.'))) lib.set(base, c.name.includes('.') ? lib.get(base) : c.suggestion);
    names.set(c.library, lib);
  }
  const rootCache = new Map<string, string>();
  const rootOf = (library: string, name: string): string => {
    const id = `${library}|${name}`;
    const hit = rootCache.get(id);
    if (hit) return hit;
    let root = name;
    if (library !== 'native') {
      const base = name.split('.')[0]!;
      const lib = names.get(library)!;
      let best = '';
      for (const p of lib.keys()) {
        if (p.length >= base.length || p.length <= best.length || !base.startsWith(p) || !upperAt(base, p.length)) continue;
        // A longer name with a library component of its own is its own piece (AlertDialog is not a part of Alert).
        const own = lib.get(base);
        const parent = lib.get(p);
        if (own && parent && own !== parent) continue;
        best = p;
      }
      root = best ? rootOf(library, best) : base;
    }
    rootCache.set(id, root);
    return root;
  };
  // Families: one per library and piece. A family's pieces are its root elements (Dialog, Menu.Root, a bare Command),
  // plus one per file where only its parts show (the piece is made elsewhere).
  interface Family {
    library: string;
    root: string;
    roots: number;
    places: PiecePlace[];
    suggestions: Map<string, number>;
  }
  const families = new Map<string, Family>();
  for (const { file, c } of entries) {
    const root = rootOf(c.library, c.name);
    const [base, sub] = c.name.split('.') as [string, string | undefined];
    const isRoot = c.library === 'native' || (base === root && (sub === undefined || sub === 'Root'));
    const id = `${c.library}|${root}`;
    const fam = families.get(id) ?? { library: c.library, root, roots: 0, places: [], suggestions: new Map<string, number>() };
    if (isRoot) fam.roots++;
    if (isRoot && c.suggestion) fam.suggestions.set(c.suggestion, (fam.suggestions.get(c.suggestion) ?? 0) + 1);
    fam.places.push({ file, line: c.line, column: c.column, name: c.name, library: c.library, kind: c.kind, part: !isRoot });
    families.set(id, fam);
  }
  const piecesOf = (fam: Family) => {
    const withRoot = new Set(fam.places.filter((p) => !p.part).map((p) => p.file));
    const orphanFiles = new Set(fam.places.filter((p) => p.part && !withRoot.has(p.file)).map((p) => p.file));
    return fam.roots + orphanFiles.size;
  };
  const targetOf = (fam: Family): string | undefined => {
    const top = [...fam.suggestions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) return top;
    return known.has(fam.root) ? fam.root : undefined;
  };

  const ds = report.metrics.dsComponentInstances;
  const ui = report.metrics.uiComponentInstances;
  const groups = new Map<string, PieceGroup>();
  const missing: LibraryGap[] = [];
  for (const fam of families.values()) {
    const pieces = piecesOf(fam);
    const target = targetOf(fam);
    const files = new Set(fam.places.map((p) => p.file)).size;
    if (!target) {
      missing.push({ key: `missing:${fam.library}:${fam.root}`, name: fam.root, library: fam.library, pieces, instances: fam.places.length, files, places: fam.places });
      continue;
    }
    const g = groups.get(target) ?? { key: `piece:${target}`, component: target, pieces: 0, instances: 0, files: 0, sources: [], places: [], gain: null };
    g.pieces += pieces;
    g.instances += fam.places.length;
    g.places.push(...fam.places);
    const label = sourceLabel(fam.library);
    const src = g.sources.find((s) => s.library === fam.library);
    if (src) src.pieces += pieces;
    else g.sources.push({ label, library: fam.library, local: fam.places.some((p) => isLocal(p)), pieces });
    groups.set(target, g);
  }
  const recreated = report.components.recreated ?? [];
  for (const g of groups.values()) {
    g.files = new Set(g.places.map((p) => p.file)).size;
    g.sources.sort((a, b) => b.pieces - a.pieces || a.label.localeCompare(b.label));
    g.places.sort((a, b) => Number(a.part) - Number(b.part) || a.file.localeCompare(b.file) || a.line - b.line);
    g.gain = pct(ds + g.instances, ui);
    // The product's own file that re-creates this component, used most: one change there switches its uses.
    const roots = new Set(g.places.map((p) => p.name.split('.')[0]!));
    const own = recreated.filter((r) => (r.name === g.component || roots.has(r.name)) && keep(r.file)).sort((a, b) => b.instances - a.instances)[0];
    if (own && own.instances > 1) g.sourceFile = { file: own.file, line: own.line, name: own.name, instances: own.instances };
  }
  const partNames = new Map<string, number>();
  let partCount = 0;
  for (const g of groups.values())
    for (const p of g.places)
      if (p.part) {
        partCount++;
        partNames.set(p.name, (partNames.get(p.name) ?? 0) + 1);
      }
  const localInstances = entries.filter((e) => isLocal(e.c)).length;
  return {
    current: report.metrics.componentAdoption,
    dsInstances: ds,
    uiInstances: ui,
    groups: [...groups.values()].sort((a, b) => b.instances - a.instances || b.pieces - a.pieces || a.component.localeCompare(b.component)),
    missing: missing.sort((a, b) => b.pieces - a.pieces || b.instances - a.instances || a.name.localeCompare(b.name)),
    parts: {
      count: partCount,
      examples: [...partNames.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([n]) => n),
    },
    local: { instances: localInstances, share: entries.length ? Math.round((localInstances / entries.length) * 1000) / 10 : 0 },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Values

/** How close a value is to the library token suggested for it. "none": the library has nothing close. */
export type ValueMatch = 'same' | 'very-close' | 'close' | 'none';

export const valueMatch = (level: Confidence | undefined): ValueMatch => (level === 'exact' ? 'same' : level === 'high' ? 'very-close' : level ? 'close' : 'none');

export interface ValuePlace {
  file: string;
  line: number;
  column: number;
  /** As written: "#888", "bg-zinc-100", "p-[13px]". */
  value: string;
  source: FindingSource;
  property?: string;
}

export interface ValueGroup {
  /** Stable across runs: "value:color:color.border.strong", or "value:color:none" for values with no token. */
  key: string;
  category: FindingCategory;
  /** How close most of them are (a tie reads as the farther one). */
  match: ValueMatch;
  /** The token to use instead (absent for "none"). */
  token?: Pick<TokenSuggestion, 'token' | 'cssVar' | 'value' | 'mode'>;
  /** The distinct values as written, most used first, each with its color when it is one ("#rrggbb" or "#rrggbbaa"). */
  values: { value: string; count: number; color?: string }[];
  count: number;
  files: number;
  places: ValuePlace[];
  /** Token adoption, in percent, once these use the token. Null when the code has no style value. */
  gain: number | null;
}

/** The color a finding's value paints: a CSS color, or a Tailwind palette or arbitrary class. Undefined otherwise. */
export function findingColor(value: string): string | undefined {
  const direct = parseCssColor(value.trim());
  if (direct) return toHex(direct);
  const hit = scanClassString(value).find((h) => h.value);
  if (!hit?.value) return undefined;
  const c = parseCssColor(hit.value);
  if (!c) return undefined;
  // bg-black/10: the opacity modifier.
  const alpha = /\/(\d{1,3})$/.exec(value);
  return toHex(alpha ? { ...c, a: Math.min(100, Number(alpha[1])) / 100 } : c);
}

const MATCH_ORDER: ValueMatch[] = ['same', 'very-close', 'close', 'none'];

/** Hardcoded values grouped by the token to use instead and how close it is, biggest group first. */
export function adoptionValues(report: Pick<AuditReport, 'files' | 'metrics'>, opts: { categories?: FindingCategory[]; files?: (path: string) => boolean } = {}): ValueGroup[] {
  const keep = opts.files ?? (() => true);
  const cats = opts.categories ? new Set(opts.categories) : null;
  const groups = new Map<string, ValueGroup & { fileSet: Set<string>; byValue: Map<string, { value: string; count: number; color?: string }>; matches: Map<ValueMatch, number> }>();
  for (const f of report.files) {
    if (!keep(f.path)) continue;
    for (const x of f.findings as StyleFinding[]) {
      if (cats && !cats.has(x.category)) continue;
      const match = valueMatch(x.suggestion?.level);
      const key = x.suggestion && match !== 'none' ? `value:${x.category}:${x.suggestion.token}` : `value:${x.category}:none`;
      const g =
        groups.get(key) ??
        ({
          key,
          category: x.category,
          match,
          ...(x.suggestion && match !== 'none' ? { token: { token: x.suggestion.token, cssVar: x.suggestion.cssVar, value: x.suggestion.value, ...(x.suggestion.mode ? { mode: x.suggestion.mode } : {}) } } : {}),
          values: [],
          count: 0,
          files: 0,
          places: [],
          gain: null,
          fileSet: new Set<string>(),
          byValue: new Map(),
          matches: new Map(),
        } as ValueGroup & { fileSet: Set<string>; byValue: Map<string, { value: string; count: number; color?: string }>; matches: Map<ValueMatch, number> });
      g.count++;
      g.matches.set(match, (g.matches.get(match) ?? 0) + 1);
      g.fileSet.add(f.path);
      g.places.push({ file: f.path, line: x.line, column: x.column, value: x.value, source: x.source, ...(x.property ? { property: x.property } : {}) });
      const v = g.byValue.get(x.value) ?? { value: x.value, count: 0, ...(x.category === 'color' && findingColor(x.value) ? { color: findingColor(x.value)! } : {}) };
      v.count++;
      g.byValue.set(x.value, v);
      groups.set(key, g);
    }
  }
  const { tokenUsages, hardcoded } = report.metrics;
  return [...groups.values()]
    .map(({ fileSet, byValue, matches, ...g }) => ({
      ...g,
      match: [...matches.entries()].sort((a, b) => b[1] - a[1] || MATCH_ORDER.indexOf(b[0]) - MATCH_ORDER.indexOf(a[0]))[0]![0],
      files: fileSet.size,
      values: [...byValue.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      places: g.places.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
      // A value that keeps no token (none) cannot move the figure until the library has one.
      gain: g.match === 'none' ? null : pct(tokenUsages + g.count, tokenUsages + hardcoded),
    }))
    .sort((a, b) => Number(a.match === 'none') - Number(b.match === 'none') || b.count - a.count || MATCH_ORDER.indexOf(a.match) - MATCH_ORDER.indexOf(b.match) || a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------------------------------------------
// "Not a problem": decisions people take in Studio, kept next to the reports on the bridge-data branch, and read by
// the next audit as allowlist entries (the same escape hatch as a reviewed allowlist file).

/** The file on the bridge-data branch that keeps the decisions. */
export const AUDIT_IGNORES_FILE = 'audit-ignores.json';

export interface AuditIgnore {
  /** bridge.config.json product key ("crm"). */
  product: string;
  /** The group key (PieceGroup.key, ValueGroup.key, LibraryGap.key). */
  group: string;
  /** The group's title when it was decided, for people reading the file. */
  title?: string;
  reason: string;
  /** Who decided: a GitHub login or a member's name. */
  by?: string;
  /** ISO date. */
  at: string;
  /** The places the decision covers: a new place of the same kind shows again (it is a new decision to take). */
  places: { file: string; line: number; what?: string }[];
}

export interface AuditIgnores {
  version: 1;
  ignores: AuditIgnore[];
}

/** Read the decisions file; anything malformed is left out (never throws). */
export function parseAuditIgnores(json: unknown): AuditIgnores {
  const list = (json as { ignores?: unknown } | null)?.ignores;
  if (!Array.isArray(list)) return { version: 1, ignores: [] };
  const ignores: AuditIgnore[] = [];
  for (const x of list as Partial<AuditIgnore>[]) {
    if (!x || typeof x.product !== 'string' || typeof x.group !== 'string' || typeof x.reason !== 'string' || !x.reason.trim() || !Array.isArray(x.places)) continue;
    const places = x.places.filter((p): p is AuditIgnore['places'][number] => !!p && typeof p.file === 'string' && Number.isInteger(p.line) && p.line > 0 && (p.what === undefined || typeof p.what === 'string'));
    ignores.push({
      product: x.product,
      group: x.group,
      ...(typeof x.title === 'string' ? { title: x.title } : {}),
      reason: x.reason.trim(),
      ...(typeof x.by === 'string' ? { by: x.by } : {}),
      at: typeof x.at === 'string' ? x.at : '',
      places,
    });
  }
  return { version: 1, ignores };
}

/** The decisions of one product as allowlist entries for its audit. */
export function ignoresAllowlist(file: AuditIgnores, product: string | undefined): { file: string; line: number; what?: string; reason: string }[] {
  if (!product) return [];
  return file.ignores
    .filter((x) => x.product === product)
    .flatMap((x) => x.places.map((p) => ({ file: p.file, line: p.line, ...(p.what ? { what: p.what } : {}), reason: `Not a problem${x.by ? ` (${x.by} in Bridge)` : ' (in Bridge)'}: ${x.reason}` })));
}

/** The file with one more decision (a decision on the same product and group replaces the earlier one). */
export function withAuditIgnore(file: AuditIgnores, ignore: AuditIgnore): AuditIgnores {
  return { version: 1, ignores: [...file.ignores.filter((x) => !(x.product === ignore.product && x.group === ignore.group)), ignore] };
}

/** What saveAuditIgnore needs of a GitHub client (core GitHubClient getFile and putFile). */
export interface AuditIgnoresStore {
  getFile(path: string, ref?: string): Promise<{ text: string; sha: string } | undefined>;
  putFile(input: { path: string; content: string; branch: string; message: string; sha?: string | undefined }): Promise<string>;
}

/**
 * Keeps one decision in the decisions file of a branch (the bridge-data branch). Read, add, write with the sha read:
 * when the file changed in between (another decision, or the bridge-data workflow publishing the branch again), GitHub
 * refuses the write (409, or 422 for a file created meanwhile) and the decision is added again to the file as it is
 * now, up to `attempts` times. Returns the file written; throws the last refusal.
 */
export async function saveAuditIgnore(store: AuditIgnoresStore, ignore: AuditIgnore, opts: { branch: string; message: string; attempts?: number }): Promise<AuditIgnores> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  for (let i = 1; ; i++) {
    const current = await store.getFile(AUDIT_IGNORES_FILE, opts.branch);
    let file = parseAuditIgnores(null);
    try {
      file = parseAuditIgnores(current ? JSON.parse(current.text) : null);
    } catch {
      /* a broken file is replaced */
    }
    const next = withAuditIgnore(file, ignore);
    try {
      await store.putFile({ path: AUDIT_IGNORES_FILE, content: `${JSON.stringify(next, null, 2)}\n`, branch: opts.branch, message: opts.message, sha: current?.sha });
      return next;
    } catch (err) {
      const status = (err as { status?: unknown } | null)?.status;
      if (i >= attempts || (status !== 409 && status !== 422)) throw err;
    }
  }
}
