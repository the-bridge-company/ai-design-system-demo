// @bridge-ds/react/dom: the Bridge components for pages that build markup in plain scripts (static sites, server
// templates, vanilla TypeScript), without React at runtime. Each renderer returns the exact markup its React
// component renders, with the same class names (the same CSS Modules), so it looks and behaves the same; parity
// tests guard it. Behavior that needs JavaScript is one `bind*` call per page.
//
//   import { badgeHtml, tooltipAttributes, bindTooltips } from '@bridge-ds/react/dom';
//   row.innerHTML = `${badgeHtml('Approved', { tone: 'success', attributes: tooltipAttributes('Approved by the design owner', { focusable: true }) })}`;
//   bindTooltips();
//
// Renderers are named `<component>Html` so `bridge audit` counts them as design system components.
export { escapeHtml, trusted, attrs as htmlAttributes, type HtmlAttributes, type TrustedHtml } from './html';
export { badgeHtml, badgeClassName, type BadgeHtmlOptions } from './badge';
export { buttonHtml, buttonClassName, iconButtonHtml, type ButtonHtmlOptions, type IconButtonHtmlOptions } from './button';
export type { DomIconName } from './icons';
export { avatarHtml, type AvatarHtmlOptions } from './avatar';
export { tooltipAttributes, tooltipHtmlAttributes, bindTooltips, type TooltipAttributeOptions, type BindTooltipsOptions } from './tooltip';
export { codeBlockHtml, bindCodeBlocks, type CodeBlockHtmlOptions } from './code-block';
export { tokenValueHtml, type TokenValueHtmlOptions } from './token-value';
export { checklistHtml, checklistRowHtml, type ChecklistHtmlOptions, type ChecklistRowHtmlOptions } from './checklist';
export { segmentedControlHtml, bindSegmentedControls, selectSegment, type SegmentHtmlItem, type SegmentedControlHtmlOptions } from './segmented-control';
export { switchHtml, bindSwitches, setSwitchChecked, type SwitchHtmlOptions } from './switch';
export { dialogHtml, bindDialogs, openDialog, closeDialog, isDialogOpen, dialogReturnValue, type DialogHtmlOptions, type OpenDialogOptions } from './dialog';
export { drawerHtml, type DrawerHtmlOptions } from './drawer';
export { copyText } from '../utils/copy';
export type { BadgeTone, BadgeAppearance, BadgeSize } from '../components/Badge';
export type { ButtonVariant, ButtonSize } from '../components/Button';
export type { IconButtonVariant } from '../components/IconButton';
export type { AvatarSize, AvatarFallback, AvatarKind, AvatarAgentBrand } from '../components/Avatar';
export type { ChecklistStatus } from '../components/Checklist';
export type { TokenValueSize } from '../components/TokenValue';
export type { TooltipSide } from '../components/Tooltip';
export type { DialogSize } from '../components/Dialog';
export type { SwitchSize, SwitchLabelPlacement } from '../components/Switch';
export type { SegmentedControlSize, SegmentedControlAppearance } from '../components/SegmentedControl';
export type { DrawerSide, DrawerSize } from '../components/Drawer';
