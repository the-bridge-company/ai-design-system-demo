// The DS Toast for pages driven by plain scripts (Library foundation pages): one ToastProvider island that shows a
// toast for every `bridge:toast` event (lib/page-toast.ts toast()), so a script never draws its own toast.
import { useEffect } from 'react';
import { ToastProvider, useToast } from '@bridge-ds/react';
import { PAGE_TOAST_EVENT, type PageToast } from '../../lib/page-toast';

function Listener() {
  const toast = useToast();
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<PageToast>).detail;
      if (t?.title) toast.add({ title: t.title, tone: t.tone ?? 'success', timeout: t.timeout ?? 2000 });
    };
    document.addEventListener(PAGE_TOAST_EVENT, on);
    return () => document.removeEventListener(PAGE_TOAST_EVENT, on);
  }, [toast]);
  return null;
}

export default function PageToaster() {
  return (
    <ToastProvider limit={2}>
      <Listener />
    </ToastProvider>
  );
}
