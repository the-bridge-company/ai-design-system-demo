// A group of people, one way everywhere in Studio (lib/people-line.ts): the DS AvatarGroup (its own overlap and "+N")
// then their names, vertically centred on one line. Up to three people every face and name; four or more the first two
// and "+N", "Sofia, Leo and 2 others". Used for Library review's Asked by, who will be notified beside a decision, and
// the faces of a review header. Styles: styles/people.css, imported here so every page that draws a group has them.
import '../../../styles/people.css';
import { Fragment, type ReactNode } from 'react';
import { AvatarGroup } from '@bridge-ds/react';
import { Who } from './faces';
import { nameFace } from '../../../lib/people';
import { peopleFacesMax, peopleNames } from '../../../lib/people-line';

export type PeopleSize = 'xs' | 'sm';

export interface PeopleProps {
  /** Who, in order: the first ones are drawn and named first. */
  names: readonly string[];
  /** The face size of the context: sm (24px) in rows and beside actions, xs (20px) inside a dense line. */
  size?: PeopleSize;
  /** The words beside the faces; default the names ("Sofia and Leo"). A sentence: "Sofia and Leo will be notified." */
  text?: ReactNode;
  /** Faces only (a header with no room for words): the names become the group's accessible name. */
  facesOnly?: boolean;
  /** How a name is drawn, for pages that know more than the name (the sample team's cast). */
  face?: (name: string, size: PeopleSize) => ReactNode;
  className?: string;
}

const drawn = (name: string, size: PeopleSize) => <Who p={{ login: nameFace(name), name, agent: false, avatar: null }} name={name} size={size} />;

export function People({ names, size = 'sm', text, facesOnly = false, face = drawn, className }: PeopleProps) {
  const list = [...new Set(names.filter(Boolean))];
  if (!list.length) return null;
  const words = peopleNames(list);
  const group = (
    <AvatarGroup aria-label={words} aria-hidden={facesOnly ? undefined : true} size={size} max={peopleFacesMax(list.length)} className="people-faces">
      {list.map((n, i) => (
        <Fragment key={`${n}-${i}`}>{face(n, size)}</Fragment>
      ))}
    </AvatarGroup>
  );
  return (
    <span className={['people', `is-${size}`, className].filter(Boolean).join(' ')} title={list.length > 3 ? list.join(', ') : undefined}>
      {group}
      {!facesOnly && <span className="people-names">{text ?? words}</span>}
    </span>
  );
}
