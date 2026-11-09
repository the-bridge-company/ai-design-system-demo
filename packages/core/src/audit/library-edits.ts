// What a branch changes in the library beyond hand-written values (decision 2026-11-09, "What this changes in the
// library"). Three things the adoption audit cannot see on its own:
// - a piece the branch builds because the library lacks it, marked on its outermost element the way Claude marks a
//   changed area: data-bridge-piece="Timeline" (a component) or data-bridge-pattern="Drag cards between columns"
//   (how things behave together). The marker is the designer's word for it, so it is never guessed from a file name;
// - a token edited in a design copy, where the library is vendored (design-system/ ... tokens.css): its value before
//   and after, what each resolves to, and its own description as its name ("Padding inside cards");
// - a new size on a component the branch already had: a `size` union that gains a member ("compact"). The default
//   stays, so it reads "New size: Compact".
// Pure: file texts in, pieces out (missing-pieces.ts adds them to the check).
import type { LayeredTokenSet } from '../layered';
import { pieceId, type MissingPiece } from '../prod-branch';

export interface EditedFile {
  path: string;
  before: string | null;
  after: string | null;
}

/** Files of the vendored library in a design copy: never product code, their edits are library edits. */
export const LIBRARY_COPY_DIR = /(^|\/)design-system\//;

/** The markers a branch puts on what it builds outside the library. */
export const PIECE_MARKER_ATTR = 'data-bridge-piece';
export const PATTERN_MARKER_ATTR = 'data-bridge-pattern';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Timeline" and "Drag cards between columns" from the markers the branch added (in text it did not have before). */
function markers(files: readonly EditedFile[]): MissingPiece[] {
  const out: MissingPiece[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    if (!f.after || LIBRARY_COPY_DIR.test(f.path)) continue;
    for (const attr of [PIECE_MARKER_ATTR, PATTERN_MARKER_ATTR]) {
      const re = new RegExp(`${attr}=["'{]{1,2}([^"'}]{2,80})["'}]`, 'g');
      for (const m of f.after.matchAll(re)) {
        const name = m[1]!.replace(/\s+/g, ' ').trim();
        if (!name || f.before?.includes(m[0])) continue;
        const key = `${attr}|${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const line = f.after.slice(0, m.index).split('\n').length;
        const pattern = attr === PATTERN_MARKER_ATTR;
        out.push({
          id: pieceId([pattern ? 'pattern' : 'component', name]),
          kind: 'component',
          title: `${pattern ? 'New pattern' : 'New component'}: ${cap(name)}`,
          summary: pattern ? `How it behaves, built in this screen. The library has no pattern for it yet.` : `Built in this screen. The library has nothing like it yet.`,
          name,
          component: cap(name),
          values: [],
          where: [{ file: f.path, line }],
          ...(pattern ? { pattern: true } : {}),
        });
      }
    }
  }
  return out;
}

/** Custom properties of a stylesheet, with the description comment that follows each one on its line. */
function customProperties(text: string): Map<string, { value: string; note: string | null; line: number }> {
  const out = new Map<string, { value: string; note: string | null; line: number }>();
  text.split('\n').forEach((l, i) => {
    const m = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);\s*(?:\/\*\*?\s*(.*?)\s*\*\/)?/i.exec(l);
    // The first definition wins: base values come before theme and density overrides in a generated stylesheet.
    if (m && !out.has(m[1]!)) out.set(m[1]!, { value: m[2]!.trim(), note: m[3]?.trim() || null, line: i + 1 });
  });
  return out;
}

/** What a value resolves to in a stylesheet's own custom properties: var(--space-4) to "16px". */
function resolveIn(props: Map<string, { value: string }>, value: string, depth = 0): string | undefined {
  const ref = /^var\((--[a-z0-9-]+)(?:\s*,[^)]*)?\)$/i.exec(value.trim())?.[1];
  if (!ref) return value.trim();
  const next = props.get(ref)?.value;
  return next && depth < 8 ? resolveIn(props, next, depth + 1) : undefined;
}

/** "Padding inside cards, dialogs, popovers." names the token "Padding inside cards". */
const noteName = (note: string | null): string | null => {
  const first = note?.split(/[,.;:(]/)[0]?.trim();
  return first && first.length <= 48 ? first : null;
};

/** A token path from its custom property: --layout-inset reads layout.inset. */
const pathOfVar = (name: string) => name.replace(/^--/, '').replace(/-/g, '.');

/** Token edits in the vendored library of a design copy. */
function tokenEdits(files: readonly EditedFile[]): MissingPiece[] {
  const out: MissingPiece[] = [];
  for (const f of files) {
    if (!LIBRARY_COPY_DIR.test(f.path) || !/\.css$/.test(f.path) || !f.before || !f.after) continue;
    const before = customProperties(f.before);
    const after = customProperties(f.after);
    for (const [name, now] of after) {
      const was = before.get(name);
      if (!was || was.value === now.value) continue;
      const label = noteName(now.note ?? was.note);
      const path = pathOfVar(name);
      const beforeResolved = resolveIn(before, was.value);
      const afterResolved = resolveIn(after, now.value);
      out.push({
        id: pieceId(['token', path]),
        kind: 'token',
        title: `Token change: ${label ?? path}`,
        summary: `From ${beforeResolved ?? was.value} to ${afterResolved ?? now.value}, everywhere the library uses it, not only in this screen.`,
        name: label ?? path,
        values: [{ category: 'token', value: now.value, ...(afterResolved ? { resolved: afterResolved } : {}) }],
        where: [{ file: f.path, line: now.line }],
        token: { path, type: 'dimension', value: now.value, files: [] },
        ...(label ? { label } : {}),
        change: { before: was.value, after: now.value, ...(beforeResolved ? { beforeResolved } : {}), ...(afterResolved ? { afterResolved } : {}) },
      });
    }
  }
  return out;
}

const UNION = /\bsize\??\s*:\s*((?:['"][\w-]+['"]\s*\|?\s*)+)/;
const membersOf = (union: string) => [...union.matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]!);

/** The component a line of a file belongs to: the closest `function Name(`, `const Name =` or `interface NameProps` above it. */
function componentAt(text: string, offset: number): string | null {
  const head = text.slice(0, offset);
  const found = [...head.matchAll(/(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*=|interface\s+([A-Z]\w*?)Props\b|type\s+([A-Z]\w*?)Props\s*=)/g)].pop();
  return found ? (found[1] ?? found[2] ?? found[3] ?? found[4] ?? null) : null;
}

/** New sizes on components the branch already had (a `size` union that gains a member). */
function newSizes(files: readonly EditedFile[]): MissingPiece[] {
  const out: MissingPiece[] = [];
  for (const f of files) {
    if (!f.before || !f.after || !/\.(tsx|ts|jsx|js)$/.test(f.path)) continue;
    const old = new Map<string, string[]>();
    for (const m of f.before.matchAll(new RegExp(UNION, 'g'))) {
      const c = componentAt(f.before, m.index!);
      if (c) old.set(c, membersOf(m[1]!));
    }
    // A component the file already had that gains a size prop: its first size is today's, the others are new.
    const had = (c: string) => new RegExp(`(?:function\\s+${c}\\s*\\(|const\\s+${c}\\s*=)`).test(f.before!);
    for (const m of f.after.matchAll(new RegExp(UNION, 'g'))) {
      const c = componentAt(f.after, m.index!);
      const was = c ? (old.get(c) ?? (had(c) ? membersOf(m[1]!).slice(0, 1) : undefined)) : undefined;
      if (!c || !was) continue;
      for (const added of membersOf(m[1]!).filter((x) => !was.includes(x))) {
        out.push({
          id: pieceId([c, 'size', added]),
          kind: 'variant',
          title: `${c}: ${added} size`,
          summary: `A ${added} size for ${c}. The current size stays the default.`,
          name: added,
          component: c,
          aspect: 'size',
          values: [{ category: 'size', property: 'size', value: added }],
          where: [{ file: f.path, line: f.after.slice(0, m.index).split('\n').length }],
          change: { before: 'default', after: added },
        });
      }
    }
  }
  return out;
}

/** What a token reference resolves to in the library ("12px" for var(--space-3)), when the token set knows it. */
export function resolveCssVar(set: LayeredTokenSet | undefined, value: string): string | undefined {
  const ref = /^var\((--[a-z0-9-]+)(?:\s*,[^)]*)?\)$/i.exec(value.trim())?.[1];
  if (!ref || !set) return undefined;
  try {
    const path = set.allPaths().find((p) => set.cssVarName(p) === ref);
    if (!path) return undefined;
    const css = set.resolve(path, set.defaultCombo).css;
    return css || undefined;
  } catch {
    return undefined;
  }
}

/** Everything this file finds: markers, token edits in a design copy, new sizes. */
export function libraryEdits(files: readonly EditedFile[]): MissingPiece[] {
  return [...markers(files), ...newSizes(files), ...tokenEdits(files)];
}
