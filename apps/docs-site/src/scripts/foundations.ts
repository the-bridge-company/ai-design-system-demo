// Library foundation pages: copy on token names and on each row's copy button (the CSS variable by default; the
// page's Copy as switch picks JS or the Figma name instead, remembered per browser), a DS toast, and opening a token
// row in the detail drawer
// (scripts/explorer/drawer.ts listens to [data-fd-open]). Plain DOM, no framework.
import { parseCopyFormat, type CopyFormat } from '../lib/library-rows';
import { copyText } from './explorer/util';
import { selectSegment } from './shell';
import { toast } from '../lib/page-toast';

const KEY = 'bridge-copy-format';
const WHAT: Record<CopyFormat, string> = { css: 'CSS variable', js: 'JS reference', figma: 'Figma name' };
const valueOf = (el: HTMLElement, f: CopyFormat) => el.dataset[`copy${f.charAt(0).toUpperCase()}${f.slice(1)}`] ?? '';

function stored(): CopyFormat {
  try {
    return parseCopyFormat(localStorage.getItem(KEY));
  } catch {
    return 'css';
  }
}

export function initFoundations() {
  const page = document.querySelector<HTMLElement>('[data-fd-page]');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = '';
  let format = stored();

  function setFormat(next: CopyFormat, save = true) {
    format = next;
    document.querySelectorAll<HTMLElement>('[data-fd-copy]').forEach((b) => {
      const v = valueOf(b, next);
      if (b.hasAttribute('data-fd-copy-icon')) {
        b.title = `Copy ${WHAT[next]}`;
        b.setAttribute('aria-label', `Copy ${WHAT[next]} ${v}`);
      } else {
        b.title = `Copy ${WHAT[next]} ${v}`;
        b.setAttribute('aria-label', `${b.textContent?.trim() ?? ''}, copy ${WHAT[next]}`);
      }
    });
    document.querySelectorAll('[data-fd-copy-format]').forEach((sw) => selectSegment(sw, next));
    if (!save) return;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this page */
    }
  }
  setFormat(format, false);

  const showToast = (text: string) => toast(text);
  // The Copy as switch (a static DS SegmentedControl): the next copies use that format.
  document.addEventListener('bridge:segment', (e) => {
    if (!(e.target as HTMLElement).closest('[data-fd-copy-format]')) return;
    setFormat(parseCopyFormat((e as CustomEvent<{ value: string }>).detail.value));
  });

  // "Used by" buttons: a disclosure each, one open at a time; a click outside or Escape closes it.
  const openUses = () => document.querySelector<HTMLElement>('[data-fd-uses][aria-expanded="true"]');
  function setUses(btn: HTMLElement, open: boolean) {
    btn.setAttribute('aria-expanded', String(open));
    const pop = document.getElementById(btn.getAttribute('aria-controls') ?? '');
    if (pop) pop.hidden = !open;
  }
  document.addEventListener('keydown', (e) => {
    const btn = e.key === 'Escape' ? openUses() : null;
    if (!btn) return;
    setUses(btn, false);
    btn.focus();
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const open = openUses();
    const uses = t.closest<HTMLElement>('[data-fd-uses]');
    if (open && open !== uses && !t.closest('[data-fd-pop]')) setUses(open, false);
    if (uses) {
      setUses(uses, uses.getAttribute('aria-expanded') !== 'true');
      return;
    }
    const name = t.closest<HTMLElement>('[data-fd-copy]');
    if (name) {
      const value = valueOf(name, format);
      void copyText(value, name);
      showToast(`Copied ${value}`);
      return;
    }
    // A click anywhere else on a row opens its details; links, menus and buttons keep their own job.
    const row = t.closest<HTMLElement>('[data-fd-row]');
    if (row && !t.closest('a, button, summary, details, input, select, textarea, [data-fd-pop]')) {
      row.querySelector<HTMLButtonElement>('[data-fd-open]')?.click();
    }
  });
}
