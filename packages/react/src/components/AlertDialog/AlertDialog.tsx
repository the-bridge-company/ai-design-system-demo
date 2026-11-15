import { forwardRef, useCallback, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { cx } from '../../utils/cx';
import { useScopeAttributes } from '../../theme';
import { Button } from '../Button';
import { ButtonGroup } from '../ButtonGroup';
import { Input } from '../Input';
import dialogStyles from '../Dialog/Dialog.module.css';
import styles from './AlertDialog.module.css';

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** AlertDialogTrigger and AlertDialogContent. */
  children?: ReactNode;
}

/**
 * Interrupts the user to confirm a consequential action, usually destructive. Base UI AlertDialog:
 * role alertdialog, focus trapped, no dismissal by clicking outside.
 */
export function AlertDialog({ open, defaultOpen, onOpenChange, children }: AlertDialogProps) {
  return (
    <BaseAlertDialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next: boolean) => onOpenChange(next) : undefined}
    >
      {children}
    </BaseAlertDialog.Root>
  );
}

/** Opens the alert dialog. Compose with our Button: `<AlertDialogTrigger render={<Button variant="danger" />}>`. */
export const AlertDialogTrigger = BaseAlertDialog.Trigger;

export type AlertDialogTone = 'danger' | 'primary';

export interface AlertDialogContentProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** A question that names the action and the object: "Delete 3 tokens?" */
  title: ReactNode;
  /** The consequence, in one or two sentences. Say what cannot be undone. */
  description: ReactNode;
  /** Label of the confirming button, a verb that repeats the action: "Delete tokens". */
  confirmLabel: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Called when the user confirms. The dialog closes unless `closeOnConfirm` is false. */
  onConfirm?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Keep the dialog open after confirm (for async work: control `open` and pass `loading`). Default true. */
  closeOnConfirm?: boolean;
  /** Shows the confirm button as loading. */
  loading?: boolean;
  /** `danger` (default) for destructive actions, `primary` for consequential but safe ones. */
  tone?: AlertDialogTone;
  /** Optional extra content between the description and the actions, like a list of affected items. */
  children?: ReactNode;
  /**
   * High impact only (deleting a team, an account, anything other people lose): the text the person types to confirm,
   * usually the name of what goes ("Marketing team"). Adds a field under the description; the confirm button stays
   * off until the typed text matches. The match ignores spaces before and after and is case-sensitive.
   */
  confirmText?: string;
  /** Label of that field. Default: Type "<confirmText>" to confirm. */
  confirmTextLabel?: string;
}

/** True when what was typed matches the text to type: outer spaces ignored, case-sensitive. */
export const confirmTextMatches = (typed: string, confirmText: string): boolean => typed.trim() === confirmText.trim();

/**
 * Title, consequence and two actions. Focus starts on Cancel, the safe choice; with `confirmText`, on the field to type
 * in, and the confirm button stays off until the text matches.
 */
export const AlertDialogContent = forwardRef<HTMLDivElement, AlertDialogContentProps>(function AlertDialogContent(
  { title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, closeOnConfirm = true, loading = false, tone = 'danger', confirmText, confirmTextLabel, className, children, ...rest },
  ref,
) {
  const scope = useScopeAttributes();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // What was typed, for the text it was typed for: a new text to type starts empty.
  const [typed, setTyped] = useState({ for: confirmText, value: '' });
  // The field mounts each time the dialog opens: it starts empty then too.
  const fieldRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el) setTyped({ for: undefined, value: '' });
  }, []);
  const typing = confirmText !== undefined && confirmText.trim() !== '';
  const value = typed.for === confirmText ? typed.value : '';
  const blocked = typing && !confirmTextMatches(value, confirmText);
  // Enter in the field confirms only once the text matches; before that it does nothing.
  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!blocked && !loading) confirmRef.current?.click();
  };
  const confirm = (
    <Button ref={confirmRef} variant={tone} loading={loading} disabled={blocked} onClick={onConfirm}>
      {confirmLabel}
    </Button>
  );
  return (
    <BaseAlertDialog.Portal>
      <BaseAlertDialog.Backdrop className={dialogStyles.backdrop} {...scope} />
      <BaseAlertDialog.Viewport className={dialogStyles.viewport} {...scope}>
        <BaseAlertDialog.Popup
          ref={ref}
          initialFocus={typing ? inputRef : cancelRef}
          className={cx(dialogStyles.popup, dialogStyles.sm, styles.alert, className)}
          {...rest}
        >
          <div className={cx(dialogStyles.header, styles.header)}>
            <div className={dialogStyles.heading}>
              <BaseAlertDialog.Title className={dialogStyles.title}>{title}</BaseAlertDialog.Title>
              <BaseAlertDialog.Description className={dialogStyles.description}>{description}</BaseAlertDialog.Description>
            </div>
          </div>
          {children != null && <div className={dialogStyles.body}>{children}</div>}
          {typing && (
            <div className={styles.confirmText}>
              <Input
                ref={fieldRef}
                label={confirmTextLabel ?? `Type "${confirmText.trim()}" to confirm`}
                hint={`${confirmLabel} stays off until the text matches.`}
                value={value}
                onValueChange={(next) => setTyped({ for: confirmText, value: next })}
                onKeyDown={onFieldKeyDown}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}
          <div className={styles.actions}>
            <ButtonGroup align="end">
              <BaseAlertDialog.Close ref={cancelRef} render={<Button variant="secondary" />}>
                {cancelLabel}
              </BaseAlertDialog.Close>
              {closeOnConfirm && !loading && !blocked ? <BaseAlertDialog.Close render={confirm} /> : confirm}
            </ButtonGroup>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Viewport>
    </BaseAlertDialog.Portal>
  );
});
