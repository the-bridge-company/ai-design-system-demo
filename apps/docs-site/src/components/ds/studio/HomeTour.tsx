// The home's first-visit tour: one DS Popover per step, floating by what the step points at (portaled, the DS
// Popover's own positioning and collision handling), "N of M", Skip tour and Next (Done on the last). It is a transient
// overlay: it takes no room in the page, so nothing moves when it opens or closes (the anchor is a zero-size mark and
// no blank space is ever reserved for the step). A step points under a block ("below": rows, cards) or beside a
// control ("beside": the hero's primary button, the step to its right over the drawing, flipping under it on a phone).
// Remembered in this browser once finished. Two tours use it: the lead's (StudioHome.tsx, lib/lead-tour.ts), and the
// contributor's, for someone without a review right (StudioHome.tsx, lib/home-model.ts contributorTour). A step steps
// aside while a dialog is open (Add a product, Start an exploration, Account...) and comes back, at the same step, once
// it closes (useDialogOpen).
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@bridge-ds/react';
import '../../../styles/demo-home.css';

/** Phone widths, the home's own breakpoint (studio-home.css). */
export const NARROW_TOUR = '(max-width: 640px)';

/** Waits for the popover to open and take focus before measuring, in ms. */
const TOUR_SETTLE = 120;

/**
 * Open dialogs a floating step must never sit on: Base UI dialogs and drawers (a dialog popup with no anchor side;
 * popovers and menus carry data-side), alert dialogs, and Studio's own modal dialogs (aria-modal).
 */
const OPEN_DIALOG = '[role="dialog"][data-open]:not([data-side]), [role="alertdialog"][data-open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

/** True when a dialog is open on the page (OPEN_DIALOG): one kept closed under `hidden`, or the tour's own, does not count. */
export function dialogOpen(root: ParentNode = document): boolean {
  return [...root.querySelectorAll<HTMLElement>(OPEN_DIALOG)].some((el) => !el.closest('[hidden], .dh-tour'));
}

/** Follows dialogOpen while `watch` is on: any dialog of the page, whoever opens it, without each one telling the tour. */
export function useDialogOpen(watch: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!watch || typeof MutationObserver === 'undefined') {
      setOpen(false);
      return;
    }
    const check = () => setOpen(dialogOpen());
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-open', 'hidden', 'aria-modal', 'role'] });
    return () => observer.disconnect();
  }, [watch]);
  return open;
}

/** True on a narrow screen (NARROW_TOUR), the home's phone layout. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_TOUR).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(NARROW_TOUR);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

/** Where a step points: under a block (rows, cards), or beside a control (the hero's primary button). */
export type TourPlace = 'below' | 'beside';

/**
 * The DS Popover side for a place. Below: under the block, from its start. Beside: to the control's right, its top
 * level with the control, over the hero's sky and drawing; with no room there (a phone) the Popover flips it under the
 * control and keeps it in the viewport. Never over the control itself.
 */
export const tourSide = (place: TourPlace): { side: 'bottom' | 'inline-end'; align: 'start' } => ({ side: place === 'beside' ? 'inline-end' : 'bottom', align: 'start' });

function TourFoot({ n, total, onNext, onFinish, primaryRef }: { n: number; total: number; onNext: () => void; onFinish: () => void; primaryRef?: RefObject<HTMLButtonElement> }) {
  const last = n === total;
  return (
    <div className="dh-tour-foot">
      {/* A tour of one step has no "1 of 1". */}
      <span className="t-ui t-muted">{total > 1 ? `${n} of ${total}` : ''}</span>
      <span className="dh-tour-actions">
        {!last && (
          <Button variant="ghost" size="sm" onClick={onFinish}>
            Skip tour
          </Button>
        )}
        <Button ref={primaryRef} variant="primary" size="sm" onClick={last ? onFinish : onNext}>
          {last ? 'Done' : 'Next'}
        </Button>
      </span>
    </div>
  );
}

/** One step of a tour: a DS Popover floating by what the step points at. It reserves no room in the page. */
export function TourStep({
  n,
  total,
  words,
  place = 'below',
  onNext,
  onFinish,
  onClose,
}: {
  n: number;
  total: number;
  words: { title: string; text: string };
  place?: TourPlace;
  onNext: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const anchor = useId();
  // The step sits above dialogs (z.popover over z.modal): it waits, at this step, while one is open.
  const covered = useDialogOpen(true);
  // Focus lands on Next (Done on the last step), the action the step asks for, not on Skip tour.
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (covered) return;
    const t = window.setTimeout(() => {
      // When what the step points at sits low on the screen, scroll (nothing in the page changes size) so the step is
      // in view, never so far that what it points at leaves the top.
      const anchorBox = document.querySelector(`[data-tour-anchor="${anchor}"]`)?.getBoundingClientRect();
      if (!anchorBox) return;
      const pop = document.querySelector<HTMLElement>('.dh-tour')?.getBoundingClientRect();
      const bottom = Math.max(anchorBox.bottom, pop && pop.height > 0 ? pop.bottom : anchorBox.bottom);
      const short = Math.min(bottom - window.innerHeight, anchorBox.top);
      if (short > 0) window.scrollBy({ top: short });
    }, TOUR_SETTLE);
    return () => window.clearTimeout(t);
  }, [covered, anchor, n]);
  const { side, align } = tourSide(place);
  return (
    // Closed, not gone, under a dialog: the anchor stays and the step opens again where it was.
    <Popover open={!covered} onOpenChange={(o) => !o && !covered && onClose()}>
      <PopoverTrigger nativeButton={false} render={<span className={`dh-tour-anchor dh-tour-anchor-${place}`} data-tour-anchor={anchor} aria-hidden="true" tabIndex={-1} />} />
      <PopoverContent side={side} align={align} className="dh-tour" title={words.title} description={words.text} initialFocus={primary}>
        <TourFoot n={n} total={total} onNext={onNext} onFinish={onFinish} primaryRef={primary} />
      </PopoverContent>
    </Popover>
  );
}

function done(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'done';
  } catch {
    return false;
  }
}

/**
 * A tour over `steps` (in order), stored under `key`: returns what to render at each anchor (below it by default,
 * beside it for a control). `ready` false (still loading) keeps it hidden without losing the step.
 */
export function useTour<A extends string>(key: string, steps: A[], words: (at: A) => { title: string; text: string }, ready: boolean): (at: A, place?: TourPlace) => ReactNode {
  const [step, setStep] = useState<number | null>(() => (done(key) ? null : 0));
  const finish = () => {
    try {
      localStorage.setItem(key, 'done');
    } catch {
      /* private mode: the tour comes back on the next visit */
    }
    setStep(null);
  };
  return (at: A, place?: TourPlace) =>
    ready && step !== null && steps[step] === at ? (
      <TourStep key={at} n={step + 1} total={steps.length} words={words(at)} place={place} onNext={() => setStep(step + 1)} onFinish={finish} onClose={() => setStep(null)} />
    ) : null;
}
