// One group of a Studio list (Explorations and Being built, owner decision 2026-11-12): its title, its count tag
// (CountTag), then its rows or cards. The same heading on both pages, so a product reads the same wherever its work is
// listed. Styles: styles/list-group.css.
import type { ReactNode } from 'react';
import { CountTag } from './CountTag';
import '../../../styles/list-group.css';

export interface ListGroupProps {
  /** The heading's id ("bl-acme-crm"). */
  id: string;
  /** "Acme CRM", "Library", "Waiting on you". */
  label: string;
  count: number;
  /** On the section ("ex-waiting"). */
  className?: string;
  children: ReactNode;
}

export function ListGroup({ id, label, count, className, children }: ListGroupProps) {
  return (
    <section className={className ? `bl-group ${className}` : 'bl-group'} aria-labelledby={id}>
      <h2 className="bl-h2" id={id}>
        {label} <CountTag n={count} />
      </h2>
      {children}
    </section>
  );
}
