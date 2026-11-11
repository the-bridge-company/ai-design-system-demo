// The adoption report of one product, in a designer's words (validated design 2026-11-11, the "designer version"):
// a plain verdict with one primary action, two score cards in words, then three tabs. Pieces: groups named for
// designers ("Buttons that look like ours but aren't · 102 buttons, spread over 68 parts of the app"), counting whole
// pieces (core adoptionPieces: a menu with its items is one menu), then the pieces the library is missing. Colors and
// Sizes and spacing: what the product wrote itself next to the library value to use, with how close it is. The
// developers' detail (fix at the source, the exact change, file and line with a link) waits behind one fold per group.
// Counting (decided 2026-11-11): the product's own shadcn/ui copy counts as not the library, and the verdict says so in
// one sentence; Tailwind scale classes count neither for nor against (said in "How this is measured").
// Pure: no DOM, no fetch. adoption-report.test.ts covers it.
import { adoptionPieces, adoptionValues, screenForPlaces, sourceLabel, type AuditIgnore, type AuditIgnores, type LibraryGap, type PieceGroup, type PiecePlace, type ValueGroup, type ValueMatch, type ValuePlace } from '@bridge-ds/core';
import type { AuditCrop, AuditReport, AuditScreen, FindingCategory, HistoryPoint } from '@bridge-ds/core/audit';
import type { Mood } from './quality-view';

// ---------------------------------------------------------------------------------------------------------------
// Words

/** A library component in a designer's words: [one, many]. Unknown names keep their name. */
const PIECE_WORDS: Record<string, [string, string]> = {
  Accordion: ['accordion', 'accordions'],
  Alert: ['alert', 'alerts'],
  AlertDialog: ['confirm dialog', 'confirm dialogs'],
  Avatar: ['avatar', 'avatars'],
  Badge: ['badge', 'badges'],
  Banner: ['banner', 'banners'],
  Breadcrumb: ['breadcrumb trail', 'breadcrumb trails'],
  Button: ['button', 'buttons'],
  Card: ['card', 'cards'],
  Checkbox: ['checkbox', 'checkboxes'],
  CodeBlock: ['code block', 'code blocks'],
  Combobox: ['search box', 'search boxes'],
  Dialog: ['dialog', 'dialogs'],
  Divider: ['divider', 'dividers'],
  Drawer: ['side panel', 'side panels'],
  EmptyState: ['empty state', 'empty states'],
  Field: ['field label', 'field labels'],
  Icon: ['icon', 'icons'],
  IconButton: ['icon button', 'icon buttons'],
  Input: ['text field', 'text fields'],
  Link: ['link', 'links'],
  Menu: ['menu', 'menus'],
  NumberField: ['number field', 'number fields'],
  Pagination: ['page picker', 'page pickers'],
  Popover: ['popover', 'popovers'],
  Progress: ['progress bar', 'progress bars'],
  RadioGroup: ['radio group', 'radio groups'],
  SegmentedControl: ['segmented control', 'segmented controls'],
  Select: ['select menu', 'select menus'],
  SidebarNav: ['sidebar', 'sidebars'],
  Skeleton: ['loading placeholder', 'loading placeholders'],
  Slider: ['slider', 'sliders'],
  Spinner: ['spinner', 'spinners'],
  Switch: ['switch', 'switches'],
  Table: ['table', 'tables'],
  Tabs: ['tab set', 'tab sets'],
  Tag: ['tag', 'tags'],
  Textarea: ['text area', 'text areas'],
  Toast: ['toast', 'toasts'],
  Tooltip: ['tooltip', 'tooltips'],
};

export const pieceWord = (component: string, n: number): string => {
  const w = PIECE_WORDS[component];
  return w ? w[n === 1 ? 0 : 1] : n === 1 ? `${component} piece` : `${component} pieces`;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "DropdownMenuItem" -> "dropdown menu item"; "Dialog.Title" -> "dialog title". */
export const humanName = (name: string): string =>
  name
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .trim();

/** A percent for people: whole numbers, one decimal only when rounding would hide a move. */
export const pctWord = (v: number | null, other?: number | null): string => {
  if (v === null) return 'n/a';
  const whole = Math.round(v);
  if (other !== undefined && other !== null && Math.round(other) === whole && Math.round(other * 10) !== Math.round(v * 10)) return `${Math.round(v * 10) / 10}%`;
  return `${whole}%`;
};

const parts = (files: number) => (files === 1 ? 'in one part of the app' : `spread over ${files} parts of the app`);

// ---------------------------------------------------------------------------------------------------------------
// Code links

export interface CodePlace {
  /** "owner/name" of the product's code. */
  repo: string;
  /** Commit or branch the links point at. */
  ref: string;
  /** The audited folder inside the repository ("src"; "" for its root). */
  root: string;
}

/**
 * Where the audited code is on GitHub: what the report records (bridge snapshot, target.repo/ref/root), else the
 * product's repository (bridge.config.json products[].repo) with the folder read from the audited path when it names
 * the repository's checkout ("../acme-crm/src" for acme-design-demo/acme-crm: "src") at its default branch. Null when
 * Bridge cannot tell: no link rather than a wrong one.
 */
export function codePlace(target: AuditReport['target'], productRepo: string | undefined): CodePlace | null {
  const repo = target.repo ?? productRepo;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  let root = target.root;
  if (root === undefined) {
    const name = repo.split('/')[1]!.toLowerCase();
    const segs = target.path.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
    const at = segs.findIndex((s) => s.toLowerCase() === name);
    if (at < 0) return null;
    root = segs.slice(at + 1).join('/');
  }
  return { repo, ref: target.ref ?? 'HEAD', root: root.replace(/^\/+|\/+$/g, '') };
}

/** The file and line on GitHub. */
export function codeHref(place: CodePlace | null, file: string, line: number): string | null {
  if (!place) return null;
  const path = [place.root, file].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${place.repo}/blob/${encodeURIComponent(place.ref)}/${path}#L${line}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces

export interface PieceRow {
  key: string;
  component: string;
  title: string;
  detail: string;
  /** "Switching them takes Acme CRM from 13% to 24% library pieces": before, after, the rest. */
  gain: { from: string; to: string } | null;
  /** "One change covers 90 of them." and the sentence after it. */
  source: { lead: string; text: string } | null;
  /** The developers' fold. */
  dev: {
    summary: string;
    fix: { file: string; line: number; name: string; instances: number; before: string; after: string } | null;
    places: { file: string; line: number; what: string; from: string; href: string | null }[];
  };
  /** Where they live in the product: the screen holding most of them, with its picture when captured. */
  screen: ScreenPicture | null;
  /** A close picture of a few of them as the product draws them, null until one is cropped. */
  crop: CropPicture | null;
  /** Without a close picture, why, in plain words. */
  cropWhy: string;
  group: PieceGroup;
}

function pieceTitle(g: PieceGroup): string {
  const many = pieceWord(g.component, 2);
  const local = g.sources.filter((s) => s.local).reduce((n, s) => n + s.pieces, 0);
  const share = g.pieces ? local / g.pieces : 0;
  if (share >= 0.5) return cap(g.sources.length > 1 ? `${many} that look like ours but aren't` : `${many} that copy the library's ${g.component}`);
  if (g.sources.length > 1) return cap(`${many} made ${inWords(g.sources.length)} different ways`);
  const only = g.sources[0];
  if (only?.library === 'native') return cap(`${many} written in plain HTML`);
  return cap(`${many} from ${only?.label ?? 'another library'}`);
}

/** The groups of pieces, biggest change first, in words. */
export function pieceRows(groups: PieceGroup[], ctx: { product: string; current: number | null; packageName: string | null; code: CodePlace | null; screens?: AuditScreen[] | undefined; crops?: AuditCrop[] | undefined }): PieceRow[] {
  return groups.map((g) => {
    const one = pieceWord(g.component, 1);
    const many = pieceWord(g.component, 2);
    const src = g.sourceFile;
    const rest = src ? g.pieces - src.instances : 0;
    const screen = screenPicture(ctx.screens, g.places, many);
    return {
      key: g.key,
      component: g.component,
      title: pieceTitle(g),
      detail: `${count(g.pieces, one, many)}, ${parts(g.files)}.`,
      gain: g.gain !== null && ctx.current !== null ? { from: pctWord(ctx.current, g.gain), to: pctWord(g.gain, ctx.current) } : null,
      source: src
        ? {
            lead: `One change covers ${Math.min(src.instances, g.pieces)} of them.`,
            text: `${ctx.product} keeps its own copy of ${src.name}. When the developers point that copy to the library's ${g.component}, ${rest > 0 ? `${src.instances} ${many} switch at once, the other ${rest} one by one.` : `they all switch at once.`}`,
          }
        : null,
      dev: {
        summary: `For developers: ${count(g.places.length, 'place')} in the code`,
        fix: src
          ? {
              file: src.file,
              line: src.line,
              name: src.name,
              instances: src.instances,
              before: `export function ${src.name}(…)`,
              after: `export { ${g.component}${src.name !== g.component ? ` as ${src.name}` : ''} } from '${ctx.packageName ?? 'the library'}'`,
            }
          : null,
        places: g.places.map((p) => placeRow(p, ctx.code, src)),
      },
      screen,
      crop: cropPicture(ctx.crops, ctx.screens, g.key, screen),
      cropWhy: cropWhy(ctx.crops, ctx.screens, g.key, screen, many, ctx.product),
      group: g,
    };
  });
}

function placeRow(p: PiecePlace, code: CodePlace | null, src: PieceGroup['sourceFile']) {
  const what = p.kind === 'native' ? `<${p.name}>` : p.name;
  const from = src && p.file === src.file && p.line === src.line ? `own copy, used ${src.instances} times` : p.kind === 'native' ? 'HTML' : sourceLabel(p.library);
  return { file: p.file, line: p.line, what, from: p.part ? `${from}, part of a bigger piece` : from, href: codeHref(code, p.file, p.line) };
}

export interface GapCard {
  key: string;
  name: string;
  detail: string;
  screen: ScreenPicture | null;
  gap: LibraryGap;
}

/** The pieces the library is missing, as cards. */
export function gapCards(gaps: LibraryGap[], screens?: AuditScreen[]): GapCard[] {
  return gaps.map((g) => ({ key: g.key, name: cap(humanName(g.name)), detail: `${count(g.pieces, 'place')}${g.files > 1 ? `, ${g.files} parts of the app` : ''}`, screen: screenPicture(screens, g.places, 'places'), gap: g }));
}

// ---------------------------------------------------------------------------------------------------------------
// Pictures of the product

/** Where a group lives in the product: the screen holding most of it (core screenForPlaces), in words. */
export interface ScreenPicture {
  /** "Contacts". */
  name: string;
  /** "/#/contacts", as opened on the product's address. */
  route: string;
  /** The picture in the bridge-shots branch ("audits/acme-crm/contacts.webp"), null until it is captured. */
  image: string | null;
  /** The address it was captured from, for "Open this screen". */
  url: string | null;
  capturedAt: string | null;
  /** "All 12 buttons are on the Contacts screen." / "15 of the 102 are on the Contacts screen." */
  line: string;
}

/** A picture path Bridge itself writes (scripts/preview-shots.mjs screens), never anything else from the report. */
const PICTURE = /^audits\/[a-z0-9][a-z0-9._-]*\/[a-z0-9-]+\.webp$/;

/** Where a group sits, in plain words; `many` names the pieces ("buttons"). */
export function screenLine(name: string, n: number, total: number, many: string): string {
  if (n >= total) return total === 1 ? `It is on the ${name} screen.` : `All ${total} ${many} are on the ${name} screen.`;
  return `${n} of the ${total} ${n === 1 ? 'is' : 'are'} on the ${name} screen.`;
}

/** The screen of a group's places, with its picture when the report has a safe one. Null: no screen holds any. */
export function screenPicture(screens: AuditScreen[] | undefined, places: { file: string }[], many: string): ScreenPicture | null {
  const pick = screenForPlaces(screens, places);
  if (!pick) return null;
  const s = pick.screen;
  const name = s.name || s.route;
  const image = typeof s.image === 'string' && PICTURE.test(s.image) ? s.image : null;
  return {
    name,
    route: s.route,
    image,
    url: image && typeof s.url === 'string' && /^https:\/\//.test(s.url) ? s.url : null,
    capturedAt: image ? (s.capturedAt ?? null) : null,
    line: screenLine(name, pick.count, pick.total, many),
  };
}

/** A close picture of a group: a few real instances, cropped from a screen of the live product. */
export interface CropPicture {
  /** The picture in the bridge-shots branch ("audits/acme-crm/piece-button.webp"). */
  image: string;
  /** Its size in CSS pixels: shown at that size, like the library's own sample next to it. */
  width: number;
  height: number;
  capturedAt: string | null;
  /** The screen it was cropped from, for "See it on the Contacts screen". */
  screen: ScreenPicture | null;
}

/**
 * Why a group has no close picture: Bridge looked on the captured screens and found none it could show (a side panel
 * that only opens on a phone), it has not captured the group's screen yet, or no screen holds the group.
 */
export function cropWhy(crops: AuditCrop[] | undefined, screens: AuditScreen[] | undefined, key: string, groupScreen: ScreenPicture | null, many: string, product: string): string {
  const looked = Boolean(crops?.some((c) => c?.key === key)) && Boolean(screens?.some((s) => typeof s.image === 'string'));
  if (looked) return `Bridge looked on the screens of ${product} it captured and found no ${many} it could show.`;
  if (groupScreen) return `Bridge has not found ${many} to show on the ${groupScreen.name} screen yet.`;
  return 'Bridge does not know which screen shows these yet.';
}

/** The close picture of a group when the report has a safe one, with the screen it comes from. Null otherwise. */
export function cropPicture(crops: AuditCrop[] | undefined, screens: AuditScreen[] | undefined, key: string, groupScreen: ScreenPicture | null): CropPicture | null {
  const c = crops?.find((x) => x?.key === key);
  if (!c || typeof c.image !== 'string' || !PICTURE.test(c.image)) return null;
  const size = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 2000 ? Math.round(n) : null);
  const width = size(c.width);
  const height = size(c.height);
  if (!width || !height) return null;
  const from = c.from ?? c.route;
  let screen: ScreenPicture | null = null;
  if (groupScreen && groupScreen.route === from) screen = groupScreen;
  else {
    const s = screens?.find((x) => x.route === from);
    if (s) {
      const name = s.name || s.route;
      const image = typeof s.image === 'string' && PICTURE.test(s.image) ? s.image : null;
      screen = {
        name,
        route: s.route,
        image,
        url: image && typeof s.url === 'string' && /^https:\/\//.test(s.url) ? s.url : null,
        capturedAt: image ? (s.capturedAt ?? null) : null,
        line: `This one is on the ${name} screen.`,
      };
    }
  }
  return { image: c.image, width, height, capturedAt: c.capturedAt ?? null, screen };
}

/** "375 more parts belong to pieces the library already has, like dropdown menu items and card contents." */
export function partsLine(p: { count: number; examples: string[] }): string | null {
  if (!p.count) return null;
  const ex = p.examples.slice(0, 2).map((n) => {
    const h = humanName(n);
    return /s$/.test(h) ? h : `${h}s`;
  });
  return `${p.count} more ${p.count === 1 ? 'part belongs' : 'parts belong'} to pieces the library already has${ex.length ? `, like ${ex.join(' and ')}` : ''}. They switch with their piece.`;
}

/** The groups after the first few, in one line: "Select menus, tooltips, cards and 23 more". */
export function restLine(names: string[]): string {
  const u = [...new Set(names)];
  const head = u.slice(0, 3);
  const text = u.length > 3 ? `${head.join(', ')} and ${u.length - 3} more` : head.length > 1 ? `${head.slice(0, -1).join(', ')} and ${head[head.length - 1]}` : (head[0] ?? '');
  return cap(text);
}

// ---------------------------------------------------------------------------------------------------------------
// Values

/** A color's plain name from its value: "Light gray", "Near black", "Pale pink". */
export function colorName(hex: string | undefined): string {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex ?? '');
  if (!m) return 'Color';
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const see = m[2] && parseInt(m[2], 16) < 255 ? 'See-through ' : '';
  if (s < 0.14 || d < 0.06) {
    const gray = l < 0.08 ? 'black' : l < 0.2 ? 'near black' : l < 0.4 ? 'dark gray' : l < 0.68 ? 'gray' : l < 0.9 ? 'light gray' : l < 0.985 ? 'pale gray' : 'white';
    return cap(`${see.toLowerCase()}${gray}`);
  }
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const hue = h < 15 || h >= 345 ? 'red' : h < 45 ? 'orange' : h < 66 ? 'yellow' : h < 165 ? 'green' : h < 195 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : 'pink';
  const tone = l > 0.85 ? 'pale ' : l > 0.68 ? 'light ' : l < 0.3 ? 'dark ' : '';
  return cap(`${see.toLowerCase()}${tone}${hue}`);
}

const ROLE_NOUN: Record<string, string> = { border: 'line', surface: 'background', bg: 'background', text: 'text', fg: 'text', icon: 'icon', action: 'button', feedback: '', focus: 'focus', link: 'link' };

/** A token's plain name: color.border.strong -> "Strong line"; color.surface.selected -> "Selected background". */
export function tokenName(path: string): string {
  const segs = path.split('.').filter((s) => !['color', 'palette'].includes(s));
  if (!segs.length) return path;
  const [role, ...rest] = segs;
  const last = rest[rest.length - 1];
  if (last && ROLE_NOUN[last] !== undefined && rest.length > 1) return cap(`${rest.slice(0, -1).map(humanName).join(' ')} ${role} ${ROLE_NOUN[last] || last}`.replace(/\s+/g, ' ').trim());
  const noun = ROLE_NOUN[role!];
  if (noun === undefined) return cap(segs.map(humanName).join(' '));
  return cap(`${rest.map(humanName).join(' ')} ${noun}`.replace(/\s+/g, ' ').trim());
}

const MATCH_WORDS: Record<ValueMatch, { color: string; value: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  same: { color: 'Same color', value: 'Same value', tone: 'success' },
  'very-close': { color: 'Very close', value: 'Very close', tone: 'info' },
  close: { color: 'Close, check the meaning', value: 'Close, check the meaning', tone: 'warning' },
  none: { color: 'No library color yet', value: 'No library value yet', tone: 'neutral' },
};

const CATEGORY_WORDS: Partial<Record<FindingCategory, string>> = {
  size: 'Sizes',
  spacing: 'Spacing',
  radius: 'Corner radius',
  'border-width': 'Line widths',
  shadow: 'Shadows',
  duration: 'Animation times',
  easing: 'Animation curves',
  'z-index': 'Layers',
  'font-family': 'Fonts',
  'font-size': 'Text sizes',
  'font-weight': 'Text weights',
  'line-height': 'Line heights',
};

export const SIZE_CATEGORIES: FindingCategory[] = ['size', 'spacing', 'radius', 'border-width', 'shadow', 'duration', 'easing', 'z-index', 'font-family', 'font-size', 'font-weight', 'line-height'];

export interface ValueRow {
  key: string;
  title: string;
  detail: string;
  match: { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' };
  /** The product's values as swatches (colors) or words. */
  product: { value: string; color?: string; name: string }[];
  productCaption: string;
  library: { name: string; token: string; value: string; color?: string } | null;
  dev: { summary: string; places: { file: string; line: number; what: string; from: string; href: string | null }[]; use: string | null };
  group: ValueGroup;
}

const names = (xs: string[]) => {
  const u = [...new Set(xs)];
  if (u.length <= 2) return u.join(' and ');
  return `${u.slice(0, 2).join(', ')} and ${u.length - 2} more`;
};

/** Value groups in words. */
export function valueRows(groups: ValueGroup[], ctx: { product: string; code: CodePlace | null }): ValueRow[] {
  return groups.map((g) => {
    const isColor = g.category === 'color';
    const shown = g.values.map((v) => ({ value: v.value, ...(v.color ? { color: v.color } : {}), name: isColor ? colorName(v.color) : v.value }));
    const words = MATCH_WORDS[g.match];
    const title = isColor
      ? g.match === 'none'
        ? 'Colors the library does not have'
        : names(shown.map((s) => s.name.toLowerCase())).replace(/^./, (c) => c.toUpperCase())
      : `${CATEGORY_WORDS[g.category] ?? cap(g.category)}: ${names(g.values.map((v) => v.value))}`;
    return {
      key: g.key,
      title,
      detail: `${count(g.count, 'place')}, ${parts(g.files)}.`,
      match: { label: isColor ? words.color : words.value, tone: words.tone },
      product: shown,
      productCaption: isColor ? (shown.length > 1 ? `${shown.length} colors of ${ctx.product}` : `${ctx.product} ${shown[0]?.name.toLowerCase() ?? 'color'}`) : shown.length > 1 ? `${shown.length} values` : 'As written',
      library: g.token ? { name: tokenName(g.token.token), token: g.token.token, value: g.token.value, ...(isColor ? { color: g.token.value } : {}) } : null,
      dev: {
        summary: `For developers: ${count(g.places.length, 'place')} in the code`,
        use: g.token ? `var(${g.token.cssVar})` : null,
        places: g.places.map((p: ValuePlace) => ({ file: p.file, line: p.line, what: p.value, from: p.property ? p.property : p.source, href: codeHref(ctx.code, p.file, p.line) })),
      },
      group: g,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict, score cards, trend

export interface ScoreCard {
  id: 'pieces' | 'values';
  name: string;
  value: string;
  label: string;
  /** "up from 12% two weeks ago", with its direction; null on the first run. */
  trend: { text: string; direction: 'up' | 'down' | 'flat' } | null;
  /** Points of the line (oldest first), two or more; empty on the first run. */
  points: { at: string; value: number }[];
}

const ago = (from: string, to: string): string => {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${inWords(days)} days ago`;
  if (days < 14) return 'a week ago';
  if (days < 31) return `${inWords(Math.round(days / 7))} weeks ago`;
  if (days < 60) return 'a month ago';
  return `${Math.round(days / 30)} months ago`;
};

/**
 * The two score cards. The trend reads the report's history (one point per measured commit), else earlier runs of
 * the same product the snapshot still carries; with none, the card says when the trend starts.
 */
export function scoreCards(report: Pick<AuditReport, 'metrics' | 'history' | 'generatedAt'>, product: string, earlier: HistoryPoint[] = []): ScoreCard[] {
  const past = (report.history?.length ? report.history : earlier).slice().sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
  const card = (id: ScoreCard['id'], name: string, now: number | null, label: string, pick: (h: HistoryPoint) => number | null): ScoreCard => {
    const pts = [...past.map((h) => ({ at: h.generatedAt, value: pick(h) })), { at: report.generatedAt, value: now }].filter((p): p is { at: string; value: number } => p.value !== null);
    const prev = pts.length > 1 ? pts[pts.length - 2]! : null;
    let trend: ScoreCard['trend'] = null;
    if (prev && now !== null) {
      const d = Math.round((now - prev.value) * 10) / 10;
      const when = ago(prev.at, report.generatedAt);
      trend = d > 0 ? { text: `up from ${pctWord(prev.value, now)} ${when}`, direction: 'up' } : d < 0 ? { text: `down from ${pctWord(prev.value, now)} ${when}`, direction: 'down' } : { text: `same as ${when}`, direction: 'flat' };
    }
    return { id, name, value: pctWord(now), label, trend, points: pts.length > 1 ? pts : [] };
  };
  return [
    card('pieces', 'Pieces', report.metrics.componentAdoption, `of the buttons, menus and other pieces in ${product} come from the library`, (h) => h.componentAdoption),
    card('values', 'Colors and sizes', report.metrics.tokenAdoption, `of the colors, sizes and spacing in ${product} come from the library`, (h) => h.tokenAdoption),
  ];
}

/**
 * The score card's line before a second point exists. A point is added each time Bridge reads the product's code, which
 * happens when that code changes (measuredLines), never on a schedule: so the trend starts then.
 */
export const firstRunLine = (product: string): string => `The trend starts when ${product}'s code changes.`;

export interface ReportVerdict {
  mood: Mood;
  title: string;
  sentence: string;
  /** The groups "Send to developers" sends (none: no action). */
  send: string[];
}

const joinWords = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The verdict in plain words: why the number is what it is, and the one job that moves it most. */
export function reportVerdict(rows: PieceRow[], report: Pick<AuditReport, 'metrics'>, product: string, local: { instances: number }): ReportVerdict {
  const comp = report.metrics.componentAdoption;
  const tok = report.metrics.tokenAdoption;
  const other = report.metrics.uiComponentInstances - report.metrics.dsComponentInstances;
  if ((comp === null || comp >= 80) && (tok === null || tok >= 90)) {
    const n = rows.reduce((s, r) => s + r.group.pieces, 0);
    return { mood: 'clear', title: `${product} is built from the library`, sentence: n ? `Only ${count(n, 'piece')} ${n === 1 ? 'is' : 'are'} its own.` : 'Every piece Bridge found comes from the library.', send: [] };
  }
  const copies = rows.filter((r) => {
    const g = r.group;
    const l = g.sources.filter((s) => s.local).reduce((a, s) => a + s.pieces, 0);
    return g.pieces > 0 && l / g.pieces >= 0.5;
  });
  const shadcn = rows.some((r) => r.group.sources.some((s) => s.local && /shadcn/i.test(s.library)));
  if (other > 0 && local.instances / other >= 0.4 && copies.length) {
    const top = copies.slice(0, 3);
    return {
      mood: 'haze',
      title: `Most of ${product}'s ${joinWords(top.map((r) => pieceWord(r.component, 2)))} are copies of the library's`,
      sentence: `They look like ours, but they are ${product}'s own ${shadcn ? 'copy of shadcn/ui' : 'code'}, so library updates never reach them and they count as not from the library. Switching them is one job for the developers.`,
      send: top.map((r) => r.key),
    };
  }
  const first = rows[0];
  if (!first) return { mood: tok !== null && tok < 90 ? 'haze' : 'clear', title: `${product}'s pieces come from the library`, sentence: 'What is left is in its colors, sizes and spacing.', send: [] };
  return {
    mood: 'haze',
    title: `${product} builds many of its pieces itself`,
    sentence: `The biggest group is ${first.title.charAt(0).toLowerCase()}${first.title.slice(1)}${first.gain ? `: switching them takes ${product} from ${first.gain.from} to ${first.gain.to}` : ''}.`,
    send: [first.key],
  };
}

/** "How this is measured", in plain words. */
export function measuredLines(product: string): string[] {
  return [
    `Bridge reads ${product}'s code each time it changes and counts every piece of the interface and every color, size and spacing value.`,
    'A piece counts as from the library when the code uses the library\'s own component. A copy of it, even a perfect one, counts as not from the library: library updates never reach it. That includes a copy of shadcn/ui kept in the product.',
    'A piece and its parts count once: a menu with its items is one menu. Its parts switch with it.',
    'A color, size or spacing value counts as from the library when it uses a library token. Tailwind scale classes (like p-4 or text-sm) count neither for nor against: they follow the product\'s own scale.',
    `Pictures of ${product} come from its live address, opened after a check. A group shows a few of its pieces as ${product} draws them, cropped from the screen that holds most of them; dialogs, menus and side panels are opened with their own button, nothing is saved or sent. Developers say which files make which screen in bridge.config.json (screens); without that, Bridge reads the routes in the code.`,
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// The whole report

export interface ReportModel {
  product: string;
  verdict: ReportVerdict;
  cards: ScoreCard[];
  pieces: PieceRow[];
  gaps: GapCard[];
  partsLine: string | null;
  colors: ValueRow[];
  sizes: ValueRow[];
  code: CodePlace | null;
  /** Decisions taken in Studio for this product ("Not a problem"), newest first. */
  ignored: AuditIgnore[];
}

export function reportModel(report: AuditReport, opts: { product: string; productKey: string; productRepo?: string | undefined; ignores?: AuditIgnores | null; earlier?: HistoryPoint[] }): ReportModel {
  const decided = (opts.ignores?.ignores ?? []).filter((x) => x.product === opts.productKey);
  const off = new Set(decided.map((x) => x.group));
  const code = codePlace(report.target, opts.productRepo);
  const p = adoptionPieces(report);
  const pieces = pieceRows(
    p.groups.filter((g) => !off.has(g.key)),
    { product: opts.product, current: report.metrics.componentAdoption, packageName: report.designSystem.packages[0] ?? null, code, screens: report.screens, crops: report.crops },
  );
  return {
    product: opts.product,
    verdict: reportVerdict(pieces, report, opts.product, p.local),
    cards: scoreCards(report, opts.product, opts.earlier),
    pieces,
    gaps: gapCards(
      p.missing.filter((g) => !off.has(g.key)),
      report.screens,
    ),
    partsLine: partsLine(p.parts),
    colors: valueRows(adoptionValues(report, { categories: ['color'] }).filter((g) => !off.has(g.key)), { product: opts.product, code }),
    sizes: valueRows(adoptionValues(report, { categories: SIZE_CATEGORIES }).filter((g) => !off.has(g.key)), { product: opts.product, code }),
    code,
    ignored: decided.slice().sort((a, b) => b.at.localeCompare(a.at)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Actions

/** A request "Send to developers" filed: its issue number, when GitHub gave one (none on the sample team). */
export interface SentRequest {
  number: number | null;
}

/**
 * What the page says once groups went to the developers (a toast, then the verdict's line): how many requests, for
 * which product, and where to follow them. `open`: the one request to open in Being built (?request=N), or null to
 * open Being built itself; `link`: the link's words, null for no link. `local`: the sample team, nothing leaves the browser.
 */
export function sentWords(sent: readonly SentRequest[], ctx: { product: string; title?: string | null; local: boolean }): { title: string; description: string; open: number | null; link: string | null } {
  if (ctx.local) return { title: 'Sent to developers', description: 'Sample team: nothing left this browser.', open: null, link: null };
  const numbered = sent.map((s) => s.number).filter((x): x is number => typeof x === 'number' && x > 0);
  if (sent.length <= 1) {
    const what = ctx.title ? `: ${ctx.title.charAt(0).toLowerCase()}${ctx.title.slice(1)}` : '';
    return { title: 'Sent to developers', description: `One request for ${ctx.product}'s developers${what}.`, open: numbered[0] ?? null, link: numbered[0] ? `Open request #${numbered[0]}` : 'See it in Being built' };
  }
  return { title: `Sent ${count(sent.length, 'request')} to developers`, description: `One per group, for ${ctx.product}'s developers.`, open: null, link: 'See them in Being built' };
}

/** The request "Send to developers" files for a group (one GitHub issue per group, the component-change flow). */
export function groupRequest(
  row: { key: string; title: string; detail: string; component?: string; places: { file: string; line: number; what: string }[]; fix?: { file: string; line: number; before: string; after: string } | null; use?: string | null; token?: string | null },
  ctx: { product: string; productKey: string; run: string; url: string; requestedBy?: string | undefined },
) {
  const listed = row.places.slice(0, 40).map((p) => `- \`${p.file}:${p.line}\` ${p.what}`);
  const more = row.places.length > listed.length ? [`- and ${row.places.length - listed.length} more (see the report)`] : [];
  const fix = row.fix ? [`Fix at the source: \`${row.fix.file}:${row.fix.line}\`: \`${row.fix.before}\` becomes \`${row.fix.after}\`.`, ''] : [];
  const use = row.use ? [`Use \`${row.use}\` instead.`, ''] : [];
  const summary = [`From the adoption report of ${ctx.product}: ${row.title.charAt(0).toLowerCase()}${row.title.slice(1)}. ${row.detail}`, '', ...fix, ...use, `Places in ${ctx.product}:`, ...listed, ...more, '', `Report: ${ctx.url}`].join('\n');
  const component = row.component ?? row.token ?? 'Tokens';
  return {
    component,
    kind: 'other' as const,
    title: row.component ? `Switch ${ctx.product}'s ${pieceWord(row.component, 2)} to the library's ${row.component}` : `Use the library's ${row.token ?? 'tokens'} in ${ctx.product}`,
    summary,
    changes: [{ field: 'Use instead', after: row.use ?? row.component ?? row.token ?? '' }],
    source: 'studio' as const,
    ...(ctx.requestedBy ? { requestedBy: ctx.requestedBy } : {}),
    origin: { kind: 'audit' as const, product: ctx.productKey, run: ctx.run, group: row.key, name: row.title, url: ctx.url },
  };
}

/** Problems with a "Not a problem" reason, as sentences that say how to fix them. */
export function ignoreReasonProblems(reason: string): string[] {
  const r = reason.trim();
  if (!r) return ['Say why in a few words: the next person reads it.'];
  if (r.length < 8) return ['Say a bit more, so the next person knows why: at least 8 characters.'];
  return [];
}

export type { PieceGroup, ValueGroup };
