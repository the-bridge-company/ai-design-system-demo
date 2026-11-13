import { forwardRef, Fragment, useId, useMemo, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '../../utils/cx';
import { useScopeAttributes } from '../../theme';
import { Field, useFieldContext } from '../Field';
import { Icon } from '../Icon';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './Select.module.css';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  /** Submitted value. */
  value: string;
  /** Visible text, also used for typeahead. */
  label: string;
  /** Optional second line under the label. */
  description?: string;
  disabled?: boolean;
  /** Group heading. Consecutive options with the same group are rendered under one label. */
  group?: string;
  /**
   * A Badge (or Tag) after the label: a count, a status. Shown on the item and, when this option is selected, in the
   * trigger. Its text is part of what assistive tech reads for the option, so keep it short ("In review", "3").
   */
  badge?: ReactNode;
}

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'defaultValue' | 'onChange' | 'prefix' | 'children'> {
  /** The choices. Keep them under about ten; use Combobox for long or searchable lists. */
  options: SelectOption[];
  /** Text shown when nothing is selected. Describe the choice, not the action: "No theme". */
  placeholder?: string;
  /** Selected value (controlled). `null` means nothing selected. */
  value?: string | null;
  /** Initially selected value (uncontrolled). */
  defaultValue?: string | null;
  /** Called with the new value when the user picks an option. */
  onValueChange?: (value: string | null) => void;
  /** Visible label. When set, the Select wraps itself in a Field. Leave unset inside a Field. */
  label?: string;
  /** Help under the label (Field description). Only with `label`. */
  hint?: ReactNode;
  /** Error message. Marks the select invalid and announces the message. Only with `label`. */
  error?: ReactNode;
  /** Visually hide the Field label (it stays the accessible name). */
  hideLabel?: boolean;
  required?: boolean;
  /** Name for form submission (a hidden input carries the value). */
  name?: string;
  /** Height follows the density tokens. Default `md`. */
  size?: SelectSize;
  /** Content before the value, usually an Icon. */
  prefix?: ReactNode;
  /**
   * A short name inside the trigger, before the value, in secondary text: "Status Waiting", "Product All products".
   * For filter bars: the trigger then hugs its content (never under a small minimum) and is named by the label and the
   * value together, so no Field `label` is needed.
   */
  inlineLabel?: string;
  /**
   * What the trigger reads instead of the selected option's label: a summary such as "In progress" or "Leo +1".
   * Mostly with `multiple`. Without it, a multiple Select reads the first picked label then "+N".
   */
  displayValue?: string;
  /** Several values at once: the list stays open while options are ticked. Use `values` and `onValuesChange`. */
  multiple?: boolean;
  /** Selected values (controlled), with `multiple`. */
  values?: readonly string[];
  /** Called with every selected value when the user ticks or unticks an option, with `multiple`. */
  onValuesChange?: (values: string[]) => void;
  /** Popup open state (controlled). */
  open?: boolean;
  /** Open on first render (uncontrolled). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Where the popup is rendered. Default: the end of the body, above every layer including a Dialog or Drawer, so
   * the list is never covered. Pass an element (or a ref) to keep it inside a container, for example a shadow root.
   */
  portalContainer?: HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null;
}

interface OptionGroup {
  group: string | undefined;
  options: SelectOption[];
}

function groupOptions(options: SelectOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
}

/** Picks one value from a short list in a popup. Base UI Select, styled like Input, wired to Field. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    placeholder = 'Select an option',
    value,
    defaultValue,
    onValueChange,
    label,
    hint,
    error,
    hideLabel,
    required,
    disabled,
    name,
    size = 'md',
    prefix,
    inlineLabel,
    displayValue,
    multiple = false,
    values,
    onValuesChange,
    open,
    defaultOpen,
    onOpenChange,
    portalContainer,
    className,
    ...rest
  },
  ref,
) {
  const field = useFieldContext();
  const scope = useScopeAttributes();
  const items = useMemo(() => options.map((o) => ({ value: o.value, label: o.label })), [options]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const hasBadges = options.some((o) => o.badge != null);
  const groups = useMemo(() => groupOptions(options), [options]);

  // With an inline label and no Field label, the label and the value name the trigger together ("Product: All
  // products"): a combobox does not take its name from its content.
  const inlineId = useId();
  const named = inlineLabel != null && label === undefined && rest['aria-label'] == null && rest['aria-labelledby'] == null;
  const valueId = named ? `${inlineId}-value` : undefined;
  const labelOf = (v: string) => byValue.get(v)?.label ?? v;
  // What the trigger reads for a multiple pick: the summary given, else the first label then "+N".
  const multipleText = (picked: readonly string[]) => {
    if (displayValue != null) return displayValue;
    if (!picked.length) return placeholder;
    return picked.length === 1 ? labelOf(picked[0]!) : `${labelOf(picked[0]!)} +${picked.length - 1}`;
  };

  const valueNode = multiple ? (
    <BaseSelect.Value id={valueId} className={cx(styles.value, displayValue != null && styles.valueShown)} placeholder={placeholder}>
      {(v: string[] | null) => multipleText(v ?? [])}
    </BaseSelect.Value>
  ) : hasBadges ? (
    <BaseSelect.Value id={valueId} className={cx(styles.value, styles.valueWithBadge, displayValue != null && styles.valueShown)} placeholder={placeholder}>
      {(v: string | null) => {
        const o = v == null ? undefined : byValue.get(v);
        if (!o) return displayValue ?? (v == null ? placeholder : v);
        return (
          <>
            <span className={styles.valueText}>{displayValue ?? o.label}</span>
            {o.badge != null && <span className={styles.badge}>{o.badge}</span>}
          </>
        );
      }}
    </BaseSelect.Value>
  ) : displayValue != null ? (
    <BaseSelect.Value id={valueId} className={cx(styles.value, styles.valueShown)} placeholder={placeholder}>
      {() => displayValue}
    </BaseSelect.Value>
  ) : (
    <BaseSelect.Value id={valueId} className={styles.value} placeholder={placeholder} />
  );

  // A multiple Select keeps an array value; a single one a string (or null).
  const rootValue = multiple
    ? { value: values === undefined ? undefined : [...values], onValueChange: onValuesChange ? (next: unknown) => onValuesChange([...((next as string[] | null) ?? [])]) : undefined }
    : { value, defaultValue, onValueChange: onValueChange ? (next: unknown) => onValueChange((next as string | null) ?? null) : undefined };

  const select = (
    <BaseSelect.Root
      items={items}
      multiple={multiple}
      {...rootValue}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
      required={required ?? (field.required || undefined)}
      disabled={disabled}
      name={name}
    >
      <BaseSelect.Trigger
        ref={ref}
        className={cx(styles.trigger, styles[size], inlineLabel != null && styles.hug, className)}
        aria-invalid={field.invalid || (error ? true : undefined)}
        aria-labelledby={named ? `${inlineId}-label ${valueId}` : undefined}
        {...rest}
      >
        {prefix != null && <span className={styles.affix}>{prefix}</span>}
        {inlineLabel != null ? (
          <span className={styles.labelled}>
            <span id={named ? `${inlineId}-label` : undefined} className={styles.inlineLabel}>
              {inlineLabel}
              <VisuallyHidden>: </VisuallyHidden>
            </span>
            {valueNode}
          </span>
        ) : (
          valueNode
        )}
        <BaseSelect.Icon className={styles.chevron}>
          <Icon icon={ChevronDown} size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={portalContainer ?? undefined}>
        <BaseSelect.Positioner className={styles.positioner} sideOffset={4} alignItemWithTrigger={false} {...scope}>
          <BaseSelect.Popup className={styles.popup}>
            <BaseSelect.List className={styles.list}>
              {groups.map((g, gi) => {
                const rendered = g.options.map((o) => (
                  <BaseSelect.Item key={o.value} value={o.value} label={o.label} disabled={o.disabled} className={styles.item}>
                    <span className={styles.itemBody}>
                      <BaseSelect.ItemText className={styles.itemText}>{o.label}</BaseSelect.ItemText>
                      {o.description && <span className={styles.itemDescription}>{o.description}</span>}
                    </span>
                    {o.badge != null && <span className={styles.badge}>{o.badge}</span>}
                    <BaseSelect.ItemIndicator keepMounted={hasBadges} className={cx(styles.indicator, hasBadges && styles.indicatorSlot)}>
                      <Icon icon={Check} size="sm" />
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ));
                return (
                  <Fragment key={g.group ?? `ungrouped-${gi}`}>
                    {gi > 0 && <BaseSelect.Separator className={styles.separator} />}
                    {g.group ? (
                      <BaseSelect.Group className={styles.group}>
                        <BaseSelect.GroupLabel className={styles.groupLabel}>{g.group}</BaseSelect.GroupLabel>
                        {rendered}
                      </BaseSelect.Group>
                    ) : (
                      rendered
                    )}
                  </Fragment>
                );
              })}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );

  if (label === undefined) return select;
  return (
    <Field label={label} description={hint} error={error} required={required} disabled={disabled} hideLabel={hideLabel}>
      {select}
    </Field>
  );
});
