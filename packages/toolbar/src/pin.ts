// The toolbar and the outline layer are Bridge's chrome, not the product: they never take on the host's design system
// nor a change's colours. Their tokens are the Bridge tokens bundled at build time (bridgeTokens.ts), written once in
// one stylesheet whose selectors out-rank the page's tokens and the live swap. Nothing is fetched or read at run time.
import { useLayoutEffect } from 'react';
import { installBridgeTokens } from './bridgeTokens';

export { PIN_ATTR, PIN_CLASS } from './bridgeTokens';

/** Writes the toolbar's Bridge tokens before its first paint. */
export function usePinnedBridgeTokens(): void {
  useLayoutEffect(() => {
    installBridgeTokens();
  }, []);
}
