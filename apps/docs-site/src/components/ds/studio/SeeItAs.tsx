// "See it as" on the sample team's banner (DemoBanner.tsx): one menu of the team's five people, each with their face
// and what they do in plain words. Picking one shows Studio again as that person (scripts/demo-cast.ts playCast):
// their home, their gates, their words. Only on the sample team, only for a visitor (lib/demo-cast.ts).
import { ChevronDown } from 'lucide-react';
import { Button, Icon, Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger, VisuallyHidden } from '@bridge-ds/react';
import { Who } from './faces';
import { CAST_WORDS, SAMPLE_CAST, castFaceLogin, castPerson, type CastKey, type CastPerson } from '../../../lib/demo-cast';

export interface SeeItAsProps {
  /** Who the page plays now. */
  current: CastKey;
  /** A person picked (scripts/demo-cast.ts playCast). */
  onPick: (key: CastKey) => void;
}

// Everyone drawn, the developer too (lib/demo-cast castGitHub): one look for the five people.
const face = (p: CastPerson) => ({ login: castFaceLogin(p), name: p.name, avatar: null });

export function SeeItAs({ current, onPick }: SeeItAsProps) {
  const now = castPerson(current) ?? SAMPLE_CAST[0]!;
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="sm" className="see-as-trigger" />}>
        <span className="see-as-label">{CAST_WORDS.seeItAs}</span>
        <Who p={face(now)} size="xs" />
        <span className="see-as-name">{now.name}</span>
        <VisuallyHidden>, {now.job}</VisuallyHidden>
        <Icon icon={ChevronDown} size="sm" />
      </MenuTrigger>
      <MenuContent className="see-as-menu" align="end">
        <MenuRadioGroup label={CAST_WORDS.menuTitle} value={now.key} onValueChange={(v) => v !== now.key && castPerson(v) && onPick(castPerson(v)!.key)}>
          {SAMPLE_CAST.map((p) => (
            <MenuRadioItem key={p.key} value={p.key} closeOnClick className="see-as-item">
              <Who p={face(p)} size="sm" />
              <span className="see-as-who">
                <span className="see-as-item-name">{p.name}</span>
                <span className="see-as-job">{p.job}</span>
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <p className="see-as-note">{CAST_WORDS.menuNote}</p>
      </MenuContent>
    </Menu>
  );
}
