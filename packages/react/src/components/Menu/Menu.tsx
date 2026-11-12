import { forwardRef, isValidElement, useMemo, type HTMLAttributes, type ReactElement, type ReactNode, type RefObject } from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Check, ChevronRight } from 'lucide-react';
import { cx } from '../../utils/cx';
import { useScopeAttributes } from '../../theme';
import { Icon, type LucideIcon } from '../Icon';
import styles from './Menu.module.css';

export type MenuSide = 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end';
export type MenuAlign = 'start' | 'center' | 'end';

/** A box in viewport coordinates, as `element.getBoundingClientRect()` returns it. */
export interface MenuAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Something that is not an element but has a place on screen: a text selection, a canvas hit, a row cell drawn by a script. */
export interface MenuVirtualAnchor {
  getBoundingClientRect: () => MenuAnchorRect;
  /** The element the virtual box scrolls with, so the menu follows it. */
  contextElement?: Element;
}

/** A point in viewport coordinates, such as a pointer position. */
export interface MenuAnchorPoint {
  x: number;
  y: number;
}

/**
 * What the menu opens from when it is not its MenuTrigger: an element, a ref to one, a virtual box or a point.
 * `null` or leaving it out means the trigger.
 */
export type MenuAnchor = Element | RefObject<Element | null> | MenuVirtualAnchor | MenuAnchorPoint | null;

function pointRect(x: number, y: number): MenuAnchorRect {
  return { x, y, width: 0, height: 0, top: y, right: x, bottom: y, left: x };
}

/** A point becomes a zero-size virtual box (kept stable while it does not move); anything else goes to the positioner as it is. */
function useAnchor(anchor: MenuAnchor | undefined) {
  const point = anchor != null && !('current' in anchor) && !('getBoundingClientRect' in anchor) ? anchor : null;
  const x = point?.x;
  const y = point?.y;
  const virtualPoint = useMemo<MenuVirtualAnchor | undefined>(
    () => (x === undefined || y === undefined ? undefined : { getBoundingClientRect: () => pointRect(x, y) }),
    [x, y],
  );
  return point ? virtualPoint : (anchor as Exclude<MenuAnchor, MenuAnchorPoint> | undefined);
}

export interface MenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Wrap focus from the last item to the first. Default true. */
  loopFocus?: boolean;
  /** MenuTrigger and MenuContent. */
  children?: ReactNode;
}

/**
 * A list of actions or options behind a trigger. Base UI Menu: arrow keys, typeahead, Home and End,
 * submenus with ArrowRight, Escape closes and returns focus.
 */
export function Menu({ open, defaultOpen, onOpenChange, loopFocus = true, children }: MenuProps) {
  return (
    <BaseMenu.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next: boolean) => onOpenChange(next) : undefined}
      loopFocus={loopFocus}
    >
      {children}
    </BaseMenu.Root>
  );
}

/** Opens the menu. Compose with our Button or IconButton: `<MenuTrigger render={<IconButton icon={MoreHorizontal} label="More actions" />} />`. */
export const MenuTrigger = BaseMenu.Trigger;

interface PopupProps extends HTMLAttributes<HTMLDivElement> {
  anchor?: MenuAnchor;
  side?: MenuSide;
  align?: MenuAlign;
  sideOffset?: number;
  alignOffset?: number;
  children?: ReactNode;
}

const MenuPopup = forwardRef<HTMLDivElement, PopupProps>(function MenuPopup({ anchor, side, align, sideOffset, alignOffset, className, children, ...rest }, ref) {
  const scope = useScopeAttributes();
  const positionAnchor = useAnchor(anchor);
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner
        className={styles.positioner}
        anchor={positionAnchor}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={8}
        {...scope}
      >
        <BaseMenu.Popup ref={ref} className={cx(styles.popup, className)} {...rest}>
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
});

export interface MenuContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Default `bottom`. */
  side?: MenuSide;
  /** Default `start`: the menu lines up with the trigger's leading edge. */
  align?: MenuAlign;
  /**
   * Open from something other than the MenuTrigger: an element or a ref to one (a button a script drew in a large
   * table), a virtual box (`{ getBoundingClientRect }`) or a point (`{ x, y }`, such as where the pointer was).
   * Control the menu with `open` and `onOpenChange`; there is no MenuTrigger then, so move focus back yourself on close.
   */
  anchor?: MenuAnchor;
  children?: ReactNode;
}

/** The floating list: MenuItem, MenuCheckboxItem, MenuRadioGroup, MenuGroup, MenuSeparator, MenuSubmenu. */
export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent(
  { side = 'bottom', align = 'start', children, ...rest },
  ref,
) {
  return (
    <MenuPopup ref={ref} side={side} align={align} sideOffset={4} {...rest}>
      {children}
    </MenuPopup>
  );
});

export type MenuItemTone = 'default' | 'danger';

interface ItemDecor {
  /**
   * Icon before the label: a Lucide icon, or an element such as `<Icon icon={Figma} />` or a brand mark. Muted, and
   * hidden from assistive tech. When one item has an icon, every item keeps the slot so labels line up.
   */
  icon?: LucideIcon | ReactElement;
  /** Keyboard shortcut hint, shown muted at the end: "E", "Cmd+D". Purely visual; bind the shortcut yourself. */
  shortcut?: string;
}

export interface MenuItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'>, ItemDecor {
  /** `danger` for destructive items. Put them last, after a separator. */
  tone?: MenuItemTone;
  disabled?: boolean;
  /** Fires on click, Enter and Space. */
  onClick?: () => void;
  /** Close the menu after activation. Default true. */
  closeOnClick?: boolean;
  /** Typeahead text when the children are not plain text. */
  label?: string;
}

function ItemContent({ icon, shortcut, children, end }: ItemDecor & { children: ReactNode; end?: ReactNode }) {
  return (
    <>
      <span className={styles.leading} aria-hidden="true">
        {icon && (isValidElement(icon) ? icon : <Icon icon={icon as LucideIcon} size="sm" />)}
      </span>
      <span className={styles.label}>{children}</span>
      {shortcut && (
        <kbd className={styles.shortcut} aria-hidden="true">
          {shortcut}
        </kbd>
      )}
      {end}
    </>
  );
}

/** An action. */
export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { icon, shortcut, tone = 'default', disabled, onClick, closeOnClick = true, label, className, children, ...rest },
  ref,
) {
  return (
    <BaseMenu.Item
      ref={ref}
      disabled={disabled}
      onClick={onClick ? () => onClick() : undefined}
      closeOnClick={closeOnClick}
      label={label}
      className={cx(styles.item, tone === 'danger' && styles.danger, className)}
      {...rest}
    >
      <ItemContent icon={icon} shortcut={shortcut}>
        {children}
      </ItemContent>
    </BaseMenu.Item>
  );
});

export interface MenuCheckboxItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  shortcut?: string;
  /** Default false: toggling keeps the menu open so several options can be set. */
  closeOnClick?: boolean;
}

/** An on/off option. The check mark sits in the leading slot. */
export const MenuCheckboxItem = forwardRef<HTMLDivElement, MenuCheckboxItemProps>(function MenuCheckboxItem(
  { checked, defaultChecked, onCheckedChange, disabled, shortcut, closeOnClick = false, className, children, ...rest },
  ref,
) {
  return (
    <BaseMenu.CheckboxItem
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange ? (next: boolean) => onCheckedChange(next) : undefined}
      disabled={disabled}
      closeOnClick={closeOnClick}
      className={cx(styles.item, className)}
      {...rest}
    >
      <span className={styles.leading}>
        <BaseMenu.CheckboxItemIndicator keepMounted className={styles.indicator}>
          <Icon icon={Check} size="sm" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      <span className={styles.label}>{children}</span>
      {shortcut && (
        <kbd className={styles.shortcut} aria-hidden="true">
          {shortcut}
        </kbd>
      )}
    </BaseMenu.CheckboxItem>
  );
});

export interface MenuRadioGroupProps {
  /** Visible group label, also the accessible name. */
  label?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}

/** One choice among several, like a theme or a sort order. */
export function MenuRadioGroup({ label, value, defaultValue, onValueChange, disabled, children }: MenuRadioGroupProps) {
  return (
    <BaseMenu.RadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange ? (next: unknown) => onValueChange(next as string) : undefined}
      disabled={disabled}
      className={styles.group}
    >
      {label && <BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>}
      {children}
    </BaseMenu.RadioGroup>
  );
}

export interface MenuRadioItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  value: string;
  disabled?: boolean;
  /** Default false. */
  closeOnClick?: boolean;
}

export const MenuRadioItem = forwardRef<HTMLDivElement, MenuRadioItemProps>(function MenuRadioItem(
  { value, disabled, closeOnClick = false, className, children, ...rest },
  ref,
) {
  return (
    <BaseMenu.RadioItem ref={ref} value={value} disabled={disabled} closeOnClick={closeOnClick} className={cx(styles.item, className)} {...rest}>
      <span className={styles.leading}>
        <BaseMenu.RadioItemIndicator keepMounted className={cx(styles.indicator, styles.radioDot)} />
      </span>
      <span className={styles.label}>{children}</span>
    </BaseMenu.RadioItem>
  );
});

export interface MenuGroupProps {
  /** Visible group label. */
  label?: ReactNode;
  children?: ReactNode;
}

/** Groups related items under an optional label. */
export function MenuGroup({ label, children }: MenuGroupProps) {
  return (
    <BaseMenu.Group className={styles.group}>
      {label && <BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>}
      {children}
    </BaseMenu.Group>
  );
}

/** A hairline between groups. */
export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cx(styles.separator, className)} />;
}

export interface MenuSubmenuProps extends ItemDecor {
  /** The item that opens the submenu. */
  label: ReactNode;
  disabled?: boolean;
  /** Submenu items. */
  children?: ReactNode;
}

/** A nested menu. Opens with ArrowRight, Enter or hover; ArrowLeft and Escape close it. */
export function MenuSubmenu({ label, icon, disabled, children }: MenuSubmenuProps) {
  return (
    <BaseMenu.SubmenuRoot>
      <BaseMenu.SubmenuTrigger disabled={disabled} className={cx(styles.item, styles.submenuTrigger)}>
        <ItemContent icon={icon} end={<Icon icon={ChevronRight} size="sm" className={styles.chevron} />}>
          {label}
        </ItemContent>
      </BaseMenu.SubmenuTrigger>
      <MenuPopup side="inline-end" align="start" sideOffset={2} alignOffset={-5}>
        {children}
      </MenuPopup>
    </BaseMenu.SubmenuRoot>
  );
}
