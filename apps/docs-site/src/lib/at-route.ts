// The page a preview link opens on (Open the preview, See it in the product, Open the build, Approved version): the
// exploration's screen (core Exploration.screen) when one is chosen, else the page a capture found the change on.
// Pure: no DOM, no fetch, covered by scripts/product-branch.test.ts and core's explorations tests.
import { previewAtScreen } from '@bridge-ds/core';

/**
 * The link on a screen of the same preview (`route`: "/plans", "/#/orders", "/?tenant=a#/orders"): its path, its query
 * before its hash route, Bridge's own parameters on the link kept. Anything that is not a place on the same preview
 * leaves the link as it is.
 */
export const atRoute = (link: string, route: string | null | undefined): string => previewAtScreen(link, route);
