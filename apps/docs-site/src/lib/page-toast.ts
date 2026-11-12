// Asks the page's DS Toast island (components/ds/PageToaster.tsx) to show a toast, from any plain script.
import type { ToastTone } from '@bridge-ds/react';

export const PAGE_TOAST_EVENT = 'bridge:toast';

export interface PageToast {
  title: string;
  tone?: ToastTone;
  timeout?: number;
}

export function toast(t: PageToast | string): void {
  const detail: PageToast = typeof t === 'string' ? { title: t } : t;
  document.dispatchEvent(new CustomEvent<PageToast>(PAGE_TOAST_EVENT, { detail }));
}
