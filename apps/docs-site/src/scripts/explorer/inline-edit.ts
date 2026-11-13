// The Studio cell editor: ONE popover anchored to the value cell (a bottom sheet on phones). It decides from the
// swatches: palette families as tabs (the DS Tabs, components/explorer/FamilyTabs.tsx, with the DS Menu for the
// others), one ramp with the current step selected (DS RadioGroup tiles with step numbers and the "was" mark, components/explorer/RampPicker.tsx), one contrast line for the pending value,
// and More options (raw value, the other mode, the description) on demand. Nothing changes until Apply, which adds
// the edit to the local draft (scripts/token-editor.ts: same draft, guardrails and pull request as before). Under the
// contrast line, a mini preview of the real components that use the token, light and dark, repaints on every pick.
import { buttonHtml } from '@bridge-ds/react/dom';
import { aliasTarget, hexToRgba, isAlias, parseColor, rgbaToDtcg, rgbaToHex, type ContrastResult } from '@bridge-ds/core';
import { contrastSummary, shortName, summarizePairs, type ContrastSummary } from '../../lib/explorer/contrast-summary';
import { componentsUsing, transitiveDependents } from '../../lib/explorer/flow';
import { isStageToken, previewSamples } from '../../lib/preview-fit';
import { fitFrames, sampleFrame, sampleNames, sampleTemplate } from './preview-frames';
import { cssText } from '../../lib/explorer/format';
import { cellValue, modeKeyFor, tierAxis, type Column } from '../../lib/explorer/model';
import { familyTabs, locateSwatch, rampFamilies, swatchLabel, type RampFamily } from '../../lib/explorer/swatch-ramp';
import { aliasOptions, applyValues, draftDescription, draftValue, editDescription, pendingOverrides, previewContrast } from '../token-editor';
import type { ExplorerData } from './types';
import { cssValue, esc, icon } from './util';
import { mountFamilyTabs } from '../../components/explorer/FamilyTabs';
import { mountRampPicker } from '../../components/explorer/RampPicker';
import { mountMoreOptionsToggle } from '../../components/explorer/MoreOptionsToggle';
import { SEP } from '../../lib/sep';

interface Open {
  pop: HTMLElement;
  cell: HTMLElement;
  dispose: () => void;
}
let current: Open | null = null;

/** The picked step of the ramp (a DS RadioGroup): where focus goes back after a redraw. */
const PICKED_STEP = '.xe-ramp-host [role="radio"][aria-checked="true"]';

export const inlineEditorOpen = () => current !== null;

/** Closes the editor without applying. Focus goes back to the cell unless the caller moves it elsewhere. */
export function closeInlineEditor(returnFocus = true) {
  if (!current) return;
  const { pop, cell, dispose } = current;
  current = null;
  dispose();
  pop.remove();
  cell.removeAttribute('data-open');
  cell.setAttribute('aria-expanded', 'false');
  if (returnFocus) cell.focus({ preventScroll: true });
}

const colorOf = (value: unknown): string | undefined => {
  const c = isAlias(value) ? undefined : parseColor(value);
  return c ? rgbaToHex(c).slice(0, 7) : undefined;
};

/** Raw value field of More options, by type. */
function rawField(type: string, value: unknown, id: string): string {
  if (type === 'color') {
    const hex = colorOf(value) ?? '';
    return `<div class="xe-raw"><input type="color" value="${hex || '#000000'}" data-xe-color aria-label="Pick any color" /><input id="${id}" class="xe-input mono" value="${esc(hex)}" placeholder="#rrggbb" data-xe-hex spellcheck="false" autocomplete="off" /></div>`;
  }
  if (type === 'dimension' || type === 'duration') {
    const d = !isAlias(value) && value && typeof value === 'object' ? (value as { value: number; unit: string }) : { value: '', unit: type === 'duration' ? 'ms' : 'px' };
    return `<div class="xe-raw"><input id="${id}" class="xe-input num" type="number" value="${esc(String(d.value))}" step="${type === 'duration' ? 25 : 1}" data-xe-num data-unit="${esc(d.unit)}" /><span class="xe-unit mono">${esc(d.unit)}</span></div>`;
  }
  return `<input id="${id}" class="xe-input mono" value="${esc(isAlias(value) ? '' : JSON.stringify(value))}" data-xe-json spellcheck="false" autocomplete="off" />`;
}

/** Text of a value in the pick row: the alias as a short name, or the literal. */
function valueText(type: string, value: unknown): string {
  if (isAlias(value)) return swatchLabel(aliasTarget(value));
  if (type === 'color') return colorOf(value) ?? 'Raw value';
  return cssText(type, value) || 'Raw value';
}

/**
 * Width the editor needs to show the whole color ramp on one line (every tile, its gaps and the host's own side
 * padding, the editor's inner padding), measured from the tiles: every step at a glance, no wrap to reach 950. 0 when
 * there is no tile ramp. On a narrow page the tiles wrap instead.
 */
export function rampWidth(pop: HTMLElement): number {
  const tiles = [...pop.querySelectorAll<HTMLElement>('.xe-ramp .xe-tile')];
  const host = pop.querySelector<HTMLElement>('.xe-ramp-host');
  if (!tiles.length || !host) return 0;
  const group = tiles[0]!.parentElement!;
  const gap = parseFloat(getComputedStyle(group).columnGap) || 0;
  const hs = getComputedStyle(host);
  const pad = (parseFloat(hs.paddingLeft) || 0) + (parseFloat(hs.paddingRight) || 0);
  const sum = tiles.reduce((n, t) => n + t.getBoundingClientRect().width, 0);
  // Plus the editor's border (1px each side) so the last tile never wraps on a rounding error.
  return sum + gap * (tiles.length - 1) + pad + 2;
}

function position(pop: HTMLElement, cell: HTMLElement, container: HTMLElement) {
  if (window.matchMedia('(max-width: 640px)').matches) {
    pop.classList.add('is-sheet');
    return;
  }
  const c = container.getBoundingClientRect();
  const r = cell.getBoundingClientRect();
  const width = Math.min(Math.max(360, Math.ceil(rampWidth(pop))), c.width - 16);
  pop.style.width = `${width}px`;
  const left = Math.max(8, Math.min(r.left - c.left, c.width - width - 8));
  pop.style.left = `${left}px`;
  pop.style.setProperty('--xe-arrow', `${Math.max(16, Math.min(r.left - c.left - left + 24, width - 24))}px`);
  const place = () => {
    const h = pop.offsetHeight;
    const below = r.bottom - c.top + 8;
    // Under the cell when it fits in the viewport, else above it: the edited value stays visible either way.
    const fitsBelow = r.bottom + 8 + h <= window.innerHeight - 8 || r.top - h - 8 < 64;
    pop.classList.toggle('is-above', !fitsBelow);
    pop.style.top = `${fitsBelow ? below : r.top - c.top - h - 8}px`;
  };
  place();
  requestAnimationFrame(place);
}

/** Opens the editor on a value cell. */
export function openInlineEditor(opts: { container: HTMLElement; cell: HTMLElement; d: ExplorerData; path: string; col: Column; columns: Column[] }) {
  closeInlineEditor(false);
  const { container, cell, d, path, col, columns } = opts;
  const t = d.head.byPath.get(path);
  if (!t) return;
  const mode = modeKeyFor(t.tier, col);
  const axis = tierAxis(t.tier);
  // The other mode of this token (Dark when editing Light), for "Edit dark too".
  const other = columns.map((c) => ({ col: c, mode: modeKeyFor(t.tier, c) })).find((x) => x.mode !== mode);
  const isColor = t.type === 'color';
  const options = aliasOptions(path);
  const candidates = options.map((p) => {
    const v = cellValue(d.head, p, col.ctx);
    return { path: p, hex: isColor ? v.hex : undefined, value: isColor ? v.hex : v.line };
  });
  const families: RampFamily[] = rampFamilies(candidates);
  const start = draftValue(path, mode);
  const startOther = other ? draftValue(path, other.mode) : undefined;
  const startDesc = draftDescription(path);
  const startTarget = isAlias(start) ? aliasTarget(start) : undefined;
  /** The family of a value: the tab the editor shows for it (null for a raw value or a target outside the ramps). */
  const familyOf = (value: unknown) => locateSwatch(families, isAlias(value) ? aliasTarget(value) : undefined)?.family ?? null;
  const state = {
    value: start,
    otherValue: startOther,
    otherOn: false,
    desc: startDesc,
    // The family tab shown is the family of the current value (neutral.0 opens on Neutral), never the first tab by default.
    family: familyOf(start) ?? 0,
    moreOpen: false,
    showPairs: false,
  };
  const id = `xe-${Math.random().toString(36).slice(2, 8)}`;
  // Pairs in scope: the edited token and every token that aliases it, in the cell's brand and in the edited mode.
  const affected = new Set([path, ...transitiveDependents(d.head, path)]);
  const inScope = (r: ContrastResult, m: string) =>
    (affected.has(r.pair.foreground) || affected.has(r.pair.background)) &&
    (axis === 'brand' ? r.brand === m : r.brand === col.ctx.brand) &&
    (axis === 'theme' ? r.theme === m : true);

  // The real components that paint with this token, for the mini preview (at most three, light and dark).
  const tpl = sampleTemplate();
  const using = componentsUsing(path, [...affected].filter((p) => p !== path), d.usage).map((c) => c.name);
  const shown = previewSamples(using, sampleNames(tpl), { max: 3 });
  const isBg = isColor && isStageToken(path);
  const themes = d.modes.themes.length ? d.modes.themes : ['light'];

  const pop = document.createElement('div');
  pop.className = 'xe-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', `${id}-title`);
  pop.dataset.theme = document.documentElement.dataset.theme ?? 'light';
  // The family tabs are a React island (DS Tabs): one root for this editor, moved into every redraw.
  const familyTabsRoot = mountFamilyTabs();
  // The ramp too (DS RadioGroup: swatch tiles for colors, a list of steps for other types).
  const rampRoot = mountRampPicker();
  // And More options (a DS Button that shows the raw value, the other mode and the description).
  const moreRoot = mountMoreOptionsToggle();

  let summary: ContrastSummary | null = null;
  let failing: { fg: string; bg: string; ratio?: number; min: number }[] = [];
  const computeContrast = () => {
    if (!isColor) return;
    const pending = [{ path, mode, value: state.value }];
    if (state.otherOn && other) pending.push({ path, mode: other.mode, value: state.otherValue });
    const results = previewContrast(pending).filter((r) => inScope(r, mode) || (state.otherOn && other ? inScope(r, other.mode) : false));
    const checks = results.map((r) => ({ fg: r.pair.foreground, bg: r.pair.background, ratio: r.ratio, min: r.pair.min }));
    summary = contrastSummary(checks, path);
    failing = summarizePairs(checks).filter((p) => !p.passes);
  };

  const draw = () => {
    drawPop();
    paintPreview();
  };
  const drawPop = () => {
    const target = isAlias(state.value) ? aliasTarget(state.value) : undefined;
    const fam = families[state.family];
    const tabs = familyTabs(families, state.family);
    const hex = isColor ? (target ? cellValue(d.head, target, col.ctx).hex : colorOf(state.value)) : undefined;
    const changed = JSON.stringify(state.value) !== JSON.stringify(start);
    // "was": the same dot as the one on the original step of the ramp (RampPicker), so the two read as one mark.
    const wasText = `<span class="xe-was"><span class="xe-was-dot" aria-hidden="true"></span>was ${esc(valueText(t.type, start))}</span>`;
    // Every type reads the same way: the name, then its resolved value (hex, 16px, cubic-bezier(...)) and the "was" mark.
    const resolved = isColor ? (hex ?? '') : target ? cellValue(d.head, target, col.ctx).line : '';
    const sub = [resolved ? esc(resolved) : '', changed ? wasText : ''].filter(Boolean).join(SEP);
    const picker = fam
      ? // The tabs and More (DS Tabs and Menu) and the ramp are drawn into their slots after this markup.
        `<div class="xe-families"><div data-xe-tabs-slot></div></div>
        <div data-xe-ramp-slot></div>`
      : '';
    const status = !isColor || !summary
      ? ''
      : summary.tone === 'pass'
        ? `<div class="xe-status is-pass" role="status">${icon('check', 16)}<span>${esc(summary.text.replace(/(\d+ pairs?)/, '§$1§')).replace(/§(.+?)§/, '<strong>$1</strong>')}</span></div>`
        : summary.tone === 'fail'
          ? `<div class="xe-status is-warn" role="status">${icon('alert', 16)}<span>${esc(summary.text)}</span><button type="button" class="xe-link" aria-expanded="${state.showPairs}" data-xe-pairs>${state.showPairs ? 'Hide pairs' : 'See pairs'}</button></div>${
              state.showPairs
                ? `<ul class="xe-pairs">${failing
                    .map((p) => `<li><span class="mono">${esc(shortName(p.fg))} on ${esc(shortName(p.bg))}</span><span class="num">${p.ratio === undefined ? 'n/a' : `${p.ratio.toFixed(2)}:1`}, needs ${esc(String(p.min))}</span></li>`)
                    .join('')}</ul>`
                : ''
            }`
          : `<div class="xe-status" role="status">${icon('info', 16)}<span>${esc(summary.text)}</span></div>`;
    const otherLabel = other ? other.col.label : '';
    const more = `<div class="xe-more" id="${id}-more" ${state.moreOpen || !fam ? '' : 'hidden'}>
        <label class="xe-label" for="${id}-raw">${fam ? 'Raw value' : 'Value'}</label>${rawField(t.type, state.value, `${id}-raw`)}
        ${
          other
            ? `<label class="xe-check"><input type="checkbox" data-xe-other-on ${state.otherOn ? 'checked' : ''} /> Edit ${esc(otherLabel.toLowerCase())} too</label>
               ${
                 state.otherOn
                   ? `<label class="xe-label" for="${id}-other">${esc(otherLabel)} points to</label><input id="${id}-other" class="xe-input mono" list="${id}-list" value="${esc(isAlias(state.otherValue) ? aliasTarget(state.otherValue) : '')}" data-xe-other spellcheck="false" autocomplete="off" /><datalist id="${id}-list">${options
                       .map((o) => `<option value="${esc(o)}"></option>`)
                       .join('')}</datalist>`
                   : ''
               }`
            : ''
        }
        <label class="xe-label" for="${id}-desc">Description</label><textarea id="${id}-desc" class="xe-input" rows="2" data-xe-desc>${esc(state.desc)}</textarea>
      </div>`;
    pop.innerHTML = `
      <p class="xe-title" id="${id}-title"><span class="mono">${esc(path)}</span><span class="xe-mode">${SEP}${esc(col.label)}</span></p>
      <div class="xe-pick">${isColor ? `<span class="xe-big" style="background-color:${cssValue(hex ?? 'transparent')}" aria-hidden="true"></span>` : ''}<span><span class="xe-pick-name mono">${esc(valueText(t.type, state.value))}</span><span class="xe-pick-sub mono">${sub}</span></span></div>
      ${picker}
      ${status}
      ${shown.usesToken ? `<div class="xe-pop-pv" data-xe-pop-pv><p class="xe-pop-pv-label">${esc(shown.names.join(', '))}, as they will look</p><div class="xe-pop-pv-grid" data-xe-pop-pv-grid></div></div>` : ''}
      ${more}
      <div class="xe-foot">
        ${fam ? '<span data-xe-more-slot></span>' : ''}
        <span class="xe-grow"></span>
        ${buttonHtml('Cancel', { variant: 'secondary', size: 'sm', attributes: { 'data-xe-cancel': true } })}
        ${buttonHtml('Apply', { size: 'sm', attributes: { 'data-xe-apply': true } })}
      </div>`;
    if (fam) {
      familyTabsRoot.render(pop.querySelector('[data-xe-tabs-slot]'), {
        tabs: tabs.tabs.map((f) => ({ value: f, label: families[f]!.label })),
        more: tabs.more.map((f) => ({ value: f, label: families[f]!.label })),
        value: state.family,
        onPick: pickFamily,
      });
      rampRoot.render(pop.querySelector('[data-xe-ramp-slot]'), {
        kind: isColor ? 'color' : 'steps',
        label: fam.label,
        steps: fam.swatches.map((x) => ({ path: x.path, label: x.label, step: x.step, ...(x.hex ? { hex: x.hex } : {}), ...(x.value ? { value: x.value } : {}) })),
        value: fam.swatches.some((x) => x.path === target) ? target! : '',
        original: startTarget ?? '',
        onPick: pickStep,
      });
      moreRoot.render(pop.querySelector('[data-xe-more-slot]'), { open: state.moreOpen, controls: `${id}-more` });
    }
  };

  /** Light and dark frames of the components, with the pending value painted on top of the draft. */
  const paintPreview = () => {
    const grid = pop.querySelector<HTMLElement>('[data-xe-pop-pv-grid]');
    if (!grid || !tpl || !shown.usesToken) return;
    const pending = [{ path, mode, value: state.value }];
    if (state.otherOn && other && state.otherValue !== undefined) pending.push({ path, mode: other.mode, value: state.otherValue });
    const stage = isBg ? `var(--${path.replace(/\./g, '-')})` : 'var(--color-bg-default)';
    for (const theme of themes) {
      const ctx = { brand: axis === 'brand' ? mode : col.ctx.brand, theme, density: col.ctx.density };
      const edited = axis !== 'theme' || theme === mode || (state.otherOn && other?.mode === theme);
      const cell = document.createElement('div');
      cell.className = 'xe-pv-col';
      cell.innerHTML = `<p class="xe-pv-label">${esc(theme.charAt(0).toUpperCase() + theme.slice(1))}${edited ? '' : ', unchanged'}</p>`;
      cell.append(sampleFrame(tpl, shown.names, ctx, pendingOverrides(pending, ctx), stage));
      grid.append(cell);
    }
    requestAnimationFrame(() => fitFrames(grid));
  };

  let timer = 0;
  const refresh = (focusSel?: string) => {
    draw();
    if (focusSel) pop.querySelector<HTMLElement>(focusSel)?.focus();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      computeContrast();
      const active = document.activeElement;
      const sel = active instanceof HTMLElement && pop.contains(active) ? selectorOf(active) : null;
      draw();
      if (sel) pop.querySelector<HTMLElement>(sel)?.focus();
    }, 40);
  };
  const selectorOf = (el: HTMLElement) => {
    if (el.dataset.xeFam) return `[data-xe-fam="${el.dataset.xeFam}"]`;
    // A step of the ramp (DS RadioGroup, tiles or list): the picked one.
    if (el.getAttribute('role') === 'radio') return PICKED_STEP;
    for (const a of ['data-xe-hex', 'data-xe-num', 'data-xe-json', 'data-xe-other', 'data-xe-desc', 'data-xe-more', 'data-xe-pairs', 'data-xe-apply', 'data-xe-cancel', 'data-xe-other-on', 'data-xe-color'])
      if (el.hasAttribute(a)) return `[${a}]`;
    return null;
  };

  // A family picked from the tabs or from the More menu: its ramp shows, focus stays on (or lands on) its tab.
  function pickFamily(f: number) {
    state.family = f;
    refresh(`[data-xe-fam="${f}"]`);
  }
  // A step picked in the ramp (click or arrow keys): the pending value, focus stays on the step.
  function pickStep(p: string) {
    state.value = `{${p}}`;
    state.family = familyOf(state.value) ?? state.family;
    refresh(PICKED_STEP);
  }

  const apply = () => {
    const values = [{ path, mode, value: state.value }];
    if (state.otherOn && other && state.otherValue !== undefined) values.push({ path, mode: other.mode, value: state.otherValue });
    applyValues(values);
    if (state.desc.trim() !== startDesc.trim()) editDescription(path, state.desc);
    closeInlineEditor();
  };

  pop.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-xe-pairs')) {
      state.showPairs = !state.showPairs;
      draw();
      pop.querySelector<HTMLElement>('[data-xe-pairs]')?.focus();
    } else if (b.hasAttribute('data-xe-more')) {
      state.moreOpen = !state.moreOpen;
      draw();
      pop.querySelector<HTMLElement>(state.moreOpen ? '[data-xe-hex], [data-xe-num], [data-xe-json]' : '[data-xe-more]')?.focus();
    } else if (b.hasAttribute('data-xe-cancel')) closeInlineEditor();
    else if (b.hasAttribute('data-xe-apply')) apply();
  });
  pop.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.matches('[data-xe-color]')) {
      const c = hexToRgba(el.value);
      if (c) state.value = rgbaToDtcg(c);
      refresh('[data-xe-color]');
    } else if (el.matches('[data-xe-hex]')) {
      const v = el.value.trim();
      const ok = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v);
      el.setAttribute('aria-invalid', String(!ok && v !== ''));
      const c = ok ? hexToRgba(v) : undefined;
      if (!c) return;
      state.value = rgbaToDtcg(c);
      refreshKeepCaret(el, '[data-xe-hex]');
    } else if (el.matches('[data-xe-num]')) {
      const n = Number(el.value);
      if (el.value === '' || !Number.isFinite(n)) return;
      state.value = { value: n, unit: el.dataset.unit ?? 'px' };
      refreshKeepCaret(el, '[data-xe-num]');
    } else if (el.matches('[data-xe-json]')) {
      try {
        state.value = JSON.parse(el.value);
        el.setAttribute('aria-invalid', 'false');
        refreshKeepCaret(el, '[data-xe-json]');
      } catch {
        el.setAttribute('aria-invalid', 'true');
      }
    } else if (el.matches('[data-xe-other]')) {
      const p = el.value.trim();
      const ok = options.includes(p);
      el.setAttribute('aria-invalid', String(Boolean(p) && !ok));
      if (ok) {
        state.otherValue = `{${p}}`;
        computeContrast();
        refreshKeepCaret(el, '[data-xe-other]');
      }
    } else if (el.matches('[data-xe-desc]')) state.desc = el.value;
  });
  pop.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.matches('[data-xe-other-on]')) {
      state.otherOn = el.checked;
      refresh('[data-xe-other-on]');
    }
  });
  // Re-render without losing the caret in a text field.
  const refreshKeepCaret = (el: HTMLInputElement | HTMLTextAreaElement, sel: string) => {
    const pos = el.selectionStart;
    const val = el.value;
    refresh(sel);
    const again = pop.querySelector<HTMLInputElement>(sel);
    if (again && again.value !== val) again.value = val;
    try {
      if (again && pos !== null) again.setSelectionRange(pos, pos);
    } catch {
      /* number inputs have no selection */
    }
  };

  pop.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeInlineEditor();
      return;
    }
    // Arrow keys in the ramp and the family tabs are their DS components' own (Base UI radio group and tabs).
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      apply();
    } else if (e.key === 'Tab') {
      const f = [...pop.querySelectorAll<HTMLElement>('input, textarea, button:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1]!.focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0]!.focus();
      }
    }
    e.stopPropagation();
  });

  const outside = (e: PointerEvent) => {
    const target = e.target as Element;
    // The More families menu (DS Menu) and the swatch tooltips render in a portal: they belong to the editor.
    if (target.closest?.('.xe-fam-menu')) return;
    if (!pop.contains(target) && !cell.contains(target)) closeInlineEditor(false);
  };
  document.addEventListener('pointerdown', outside, true);

  computeContrast();
  // In the page before the first draw: the family tabs (Base UI) register their tabs when they mount, in the document.
  container.append(pop);
  draw();
  cell.dataset.open = '';
  cell.setAttribute('aria-expanded', 'true');
  position(pop, cell, container);
  // The editor just took its final width (the whole ramp): draw the family tabs again so the raised plate sits under
  // the picked family's tab as laid out now.
  requestAnimationFrame(() => {
    if (current?.pop === pop) familyTabsRoot.remeasure();
  });
  current = {
    pop,
    cell,
    dispose: () => {
      window.clearTimeout(timer);
      familyTabsRoot.unmount();
      rampRoot.unmount();
      moreRoot.unmount();
      document.removeEventListener('pointerdown', outside, true);
    },
  };
  (pop.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ?? pop.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? pop.querySelector<HTMLElement>('input, textarea, button'))?.focus();
}
