// Which components from the code a Figma file already has, by name (level 0 mapping: no variant sync, nothing drawn).
// A team's own components count, not only the sets Bridge drew: "Forms/Select" or "select" in Figma is the code's
// Select. The Bridge mark (shared plugin data dsbridge / componentId) still wins when a set carries it. Pure.

/** A component or component set of the file, as the main thread lists it ('list-components'). */
export interface FigmaComponentName {
  name: string;
  nodeId: string;
  /** The code component Bridge drew this set from, when it carries Bridge's mark. */
  componentId?: string | undefined;
}

/**
 * The name a component is matched by: the last segment of a Figma path ("Forms/Select" -> "Select"), lower case,
 * without spaces, hyphens, underscores or dots ("Icon Button", "icon-button" and "IconButton" are one name).
 */
export function normalizeComponentName(name: string): string {
  const last = name.split('/').map((s) => s.trim()).filter(Boolean).pop() ?? '';
  return last.toLowerCase().replace(/[\s\-_.]+/g, '');
}

export interface PresenceInFigma {
  /** Code components drawn by Bridge (the mark): Compare with code can compare them. */
  marked: string[];
  /** Code components the file has under the same name, not drawn by Bridge. */
  byName: { name: string; figmaName: string; nodeId: string }[];
  /** Code components the file does not have. */
  missing: string[];
}

/**
 * Where each code component stands in Figma. `marked` names the code components the plan already found by Bridge's
 * mark; the others are matched by name against the file's components, the marked sets left out.
 */
export function presenceInFigma(codeNames: readonly string[], marked: readonly string[], figma: readonly FigmaComponentName[]): PresenceInFigma {
  const markedSet = new Set(marked);
  const byKey = new Map<string, FigmaComponentName>();
  for (const f of figma) {
    if (f.componentId) continue;
    const k = normalizeComponentName(f.name);
    if (k && !byKey.has(k)) byKey.set(k, f);
  }
  const out: PresenceInFigma = { marked: [], byName: [], missing: [] };
  for (const name of [...new Set(codeNames)]) {
    if (markedSet.has(name)) {
      out.marked.push(name);
      continue;
    }
    const hit = byKey.get(normalizeComponentName(name));
    if (hit) out.byName.push({ name, figmaName: hit.name, nodeId: hit.nodeId });
    else out.missing.push(name);
  }
  return out;
}

/** Shown under Compare with code for a component the file has by name only. */
export const NOT_DRAWN_BY_BRIDGE = "Bridge can't compare this one yet: it was not drawn by Bridge.";
