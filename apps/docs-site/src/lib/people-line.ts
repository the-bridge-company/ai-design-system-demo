// One rule for a group of people anywhere in Studio (owner, 2026-11-12): up to three people, every face in the DS
// AvatarGroup and every name ("Sofia and Leo", "Sofia, Leo and Ann"); four or more, the first two faces then the
// group's own "+N", and "Sofia, Leo and 2 others". Never one face and a "+1" for two people, never faces side by side
// with a gap. Drawn by components/ds/studio/People.tsx. Pure: no DOM.

/** Up to this many people, everyone is shown by face and by name. */
export const PEOPLE_SHOWN = 3;

/** Past PEOPLE_SHOWN, this many faces and names lead, the rest are counted. */
export const PEOPLE_LEAD = 2;

/** "Sofia", "Sofia and Leo", "Sofia, Leo and Ann", "Sofia, Leo and 2 others". A repeated name counts once. */
export function peopleNames(names: readonly string[]): string {
  const list = [...new Set(names.filter(Boolean))];
  if (list.length <= 1) return list[0] ?? '';
  if (list.length <= PEOPLE_SHOWN) return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  const rest = list.length - PEOPLE_LEAD;
  return `${list.slice(0, PEOPLE_LEAD).join(', ')} and ${rest} others`;
}

/** How many faces the AvatarGroup draws before its "+N": everyone up to three, else the first two. */
export const peopleFacesMax = (count: number): number => (count <= PEOPLE_SHOWN ? PEOPLE_SHOWN : PEOPLE_LEAD);

/**
 * Who hears about a decision, as a real sentence beside the action that sends it: "Sofia will be notified.",
 * "Sofia and Leo will be notified.", "Sofia, Leo and 2 others will be notified."; empty when nobody is.
 */
export function notifiedLine(names: readonly string[]): string {
  const who = peopleNames(names);
  return who ? `${who} will be notified.` : '';
}
