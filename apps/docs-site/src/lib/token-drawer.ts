// The token detail drawer of the Library foundation pages, as the DS Drawer (@bridge-ds/react/dom drawerHtml): one
// per page, from components/explorer/TokenDetailDrawer.astro (Bridge's pages) or components/foundations/
// LibraryShellKit.astro (a team's Library). scripts/explorer/drawer.ts paints the token into its body and opens it
// with openDialog: focus trap, Escape, scrim click and focus return come from the DS.
import { drawerHtml } from '@bridge-ds/react/dom';

export const TOKEN_DRAWER_ID = 'fd-token-drawer';

export const tokenDrawerHtml = (): string =>
  drawerHtml({
    id: TOKEN_DRAWER_ID,
    title: 'Token',
    description: '',
    closeLabel: 'Close token details',
    className: 'fd-drawer',
    bodyAttributes: { 'data-fd-detail': true },
  });
