import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../../utils/cx';
import { Icon } from '../Icon';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './Stepper.module.css';

export type StepperOrientation = 'vertical' | 'horizontal';
export type StepStatus = 'done' | 'current' | 'upcoming';

export interface StepperStep {
  /** Who acts and the verb: "Dana decides". */
  label: ReactNode;
  /** Quiet second line, like "now, for 3 days". */
  meta?: ReactNode;
  /** Small decoration before the label, like an Avatar size xs. Hidden from assistive tech. */
  leading?: ReactNode;
}

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Any number of steps, in order. */
  steps: StepperStep[];
  /** Index of the current step: earlier ones are done, later ones upcoming. `steps.length` when all are done. */
  current?: number;
  /** Default `vertical`. `horizontal` stacks when its container is under 30em. */
  orientation?: StepperOrientation;
  /** Accessible name of the list. */
  label?: string;
}

const statusOf = (i: number, current?: number): StepStatus => (current === undefined || i > current ? 'upcoming' : i < current ? 'done' : 'current');
const SAID: Record<StepStatus, string> = { done: ', done', current: '', upcoming: ', to come' };

/** The steps of a flow as one path; the current step has aria-current="step". */
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper({ steps, current, orientation = 'vertical', label, className, ...rest }, ref) {
  return (
    <div ref={ref} className={cx(styles.stepper, styles[orientation], className)} {...rest}>
      <ol className={styles.list} aria-label={label}>
        {steps.map((step, i) => {
          const status = statusOf(i, current);
          return (
            <li key={i} className={cx(styles.step, styles[status])} data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
              <span className={styles.marker} aria-hidden="true">
                {status === 'done' ? <Icon icon={Check} size="xs" /> : i + 1}
              </span>
              <span className={styles.body}>
                <span className={styles.label}>
                  {step.leading != null && (
                    <span className={styles.leading} aria-hidden="true">
                      {step.leading}
                    </span>
                  )}
                  <span>{step.label}</span>
                  {SAID[status] && <VisuallyHidden>{SAID[status]}</VisuallyHidden>}
                </span>
                {step.meta != null && <span className={styles.meta}>{step.meta}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
