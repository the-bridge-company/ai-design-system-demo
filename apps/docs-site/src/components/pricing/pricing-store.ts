// The two pricing switches (billing, currency), shared by the islands of /pricing/ (PricingPlans and PricingPrice):
// one module-level value, read with useSyncExternalStore. The server and the first paint show yearly and euros; once
// hydrated, the currency follows the browser language (lib/pricing defaultCurrency) unless the visitor picked one.
import { useSyncExternalStore } from 'react';
import { DEFAULT_BILLING, defaultCurrency, type Billing, type Currency } from '../../lib/pricing';

export interface PricingChoice {
  billing: Billing;
  currency: Currency;
}

const SERVER: PricingChoice = { billing: DEFAULT_BILLING, currency: 'EUR' };
let state: PricingChoice = SERVER;
let fromBrowser = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setPricing(next: Partial<PricingChoice>) {
  state = { ...state, ...next };
  if (next.currency) fromBrowser = true;
  emit();
}

/** Once per page: the currency the browser language reads first. A visitor's own choice wins. */
export function initCurrencyFromBrowser() {
  if (fromBrowser || typeof navigator === 'undefined') return;
  fromBrowser = true;
  const currency = defaultCurrency(navigator.language);
  if (currency !== state.currency) {
    state = { ...state, currency };
    emit();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePricing(): PricingChoice {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}
