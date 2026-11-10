// The side nav's collapse toggle, in the top bar just before the logo (layouts/Layout.astro), the same place open or
// collapsed. Wide screens only: on a phone the rail is the sheet behind the menu button and this button is hidden.
// Collapsed, the rail is a 64px column of icons (styles/site.css, <html data-rail="collapsed">) and every item names
// itself in a DS Tooltip on its right, with its count ("Library review · 12 waiting"). `[` toggles it from anywhere but
// a field. The choice is this browser's (lib/rail-collapse.ts); the head script in Layout.astro applies it before
// first paint, so the page never jumps.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { PanelLeft } from 'lucide-react';
import { IconButton, Kbd, Tooltip } from '@bridge-ds/react';
import {
  isRailShortcut,
  RAIL_ATTR,
  RAIL_DESKTOP_QUERY,
  RAIL_SHORTCUT,
  RAIL_WORDS,
  railTipText,
  railToggleLabel,
  readRailCollapsed,
  saveRailCollapsed,
} from '../../lib/rail-collapse';

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isCollapsed = () => document.documentElement.getAttribute(RAIL_ATTR) === 'collapsed';
const desktop = () => matchMedia(RAIL_DESKTOP_QUERY).matches;

/** The rail's items that name themselves in a tooltip once collapsed. */
const TIP_TARGETS = ['.nav-link', '.rail-section a', '.tc-trigger', '.acc-menu-trigger', '.gh-acct-who', '.gh-acct-connect :is(a, button)', '.gh-acct-rejected button'].join(', ');

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** What a collapsed item's tooltip says: the name it shows when open, and its waiting count. */
function tipFor(el: HTMLElement): string {
  if (el.matches('.nav-link')) {
    const label = el.querySelector(':scope > span:not(.rail-num):not(.nav-chev)');
    const n = Number(text(el.querySelector('.rail-num:not([hidden]) [data-nav-count-value]'))) || 0;
    return railTipText(text(label), n);
  }
  if (el.matches('.tc-trigger')) return text(el.querySelector('.tc-name'));
  if (el.matches('.acc-menu-trigger')) return text(el.querySelector('.acc-menu-name'));
  if (el.matches('.gh-acct-who')) return text(el.querySelector('.gh-acct-login')) || 'Account';
  if (el.matches('.rail-section a')) {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    return text(el.querySelector(':scope > span:not([aria-hidden])'));
  }
  return text(el);
}

interface Tip {
  key: number;
  text: string;
  box: CSSProperties;
}

export default function RailCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const seq = useRef(0);

  // The head script already set the attribute: read it once mounted.
  useEffect(() => setCollapsed(isCollapsed()), []);

  const apply = useCallback((next: boolean, announce = false) => {
    if (next) document.documentElement.setAttribute(RAIL_ATTR, 'collapsed');
    else document.documentElement.removeAttribute(RAIL_ATTR);
    saveRailCollapsed(storage(), next);
    setCollapsed(next);
    setTip(null);
    if (announce) {
      const live = document.getElementById('live');
      if (live) live.textContent = next ? RAIL_WORDS.collapsed : RAIL_WORDS.expanded;
    }
  }, []);

  // `[` toggles, wide screens only, never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!desktop()) return;
      if (e.key === 'Escape') {
        setTip(null);
        return;
      }
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!isRailShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.isComposing, defaultPrevented: e.defaultPrevented, target: t })) return;
      e.preventDefault();
      apply(!isCollapsed(), true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [apply]);

  // Collapsed: hover or focus on a rail item shows its name on the right. One tooltip, anchored on a box laid over the
  // item (the rail's links are server markup and other islands, not children of this one).
  useEffect(() => {
    const rail = document.getElementById('rail');
    if (!rail) return;
    const targetOf = (e: Event) => {
      if (!isCollapsed() || !desktop()) return null;
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(TIP_TARGETS) : null;
      return el && rail.contains(el) ? el : null;
    };
    const show = (el: HTMLElement) => {
      // A menu open from this item says the rest.
      if ((el.hasAttribute('aria-haspopup') && el.getAttribute('aria-expanded') === 'true') || el.closest('details[open]')) return setTip(null);
      const words = tipFor(el);
      if (!words) return setTip(null);
      const r = el.getBoundingClientRect();
      seq.current += 1;
      setTip({ key: seq.current, text: words, box: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    const over = (e: Event) => {
      const el = targetOf(e);
      // Focus from a click (a menu about to open) says nothing; keyboard focus shows the name.
      if (el && (e.type !== 'focusin' || el.matches(':focus-visible'))) show(el);
    };
    const out = (e: Event) => {
      const next = (e as FocusEvent | PointerEvent).relatedTarget;
      const from = targetOf(e);
      if (from && next instanceof Node && from.contains(next)) return;
      setTip(null);
    };
    const hide = () => setTip(null);
    rail.addEventListener('pointerover', over);
    rail.addEventListener('pointerout', out);
    rail.addEventListener('focusin', over);
    rail.addEventListener('focusout', out);
    rail.addEventListener('pointerdown', hide);
    rail.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
    return () => {
      rail.removeEventListener('pointerover', over);
      rail.removeEventListener('pointerout', out);
      rail.removeEventListener('focusin', over);
      rail.removeEventListener('focusout', out);
      rail.removeEventListener('pointerdown', hide);
      rail.removeEventListener('scroll', hide);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Collapsed, a Library group (Foundations, Components) has no room for its pages: its button opens the rail, and the
  // group with it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!isCollapsed() || !desktop()) return;
      const btn = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('#rail [data-nav-group]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      apply(false);
      if (btn.getAttribute('aria-expanded') !== 'true') btn.click();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [apply]);

  const label = railToggleLabel(collapsed);
  return (
    <>
      <Tooltip
        side="bottom"
        align="start"
        content={
          <span className="rail-collapse-tip">
            {label}
            <Kbd keys={RAIL_SHORTCUT} size="sm" />
          </span>
        }
      >
        <IconButton icon={PanelLeft} label={label} className="rail-collapse" aria-expanded={!collapsed} aria-controls="rail" aria-keyshortcuts={RAIL_SHORTCUT} onClick={() => apply(!collapsed)} />
      </Tooltip>
      {tip && (
        <Tooltip key={tip.key} open side="right" content={tip.text}>
          <span className="rail-tip-anchor" style={tip.box} aria-hidden="true" />
        </Tooltip>
      )}
    </>
  );
}
