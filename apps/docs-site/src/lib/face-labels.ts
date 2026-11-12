// Face part labels for the UI (tiles, Shuffle announcement). Kept out of lib/team-faces.ts on purpose: that file is
// loaded by the /api functions, which do not bundle @bridge-ds/react, so importing the names there crashed them.
import type { FaceRecipe } from '@bridge-ds/react/avatar-illustrated';
import { faceVariantName } from '@bridge-ds/react/avatar-illustrated/names';

const num = (v: string) => Number(v.replace(/^variant/, ''));

/** The words a part variant is named by, on its tile and for screen readers: its DS name ("Short curls"). */
export function partLabel(part: 'hair' | 'glasses' | 'beard', v: string | null): string {
  if (part === 'hair') return v === 'hat' ? 'Hat' : (faceVariantName('hair', v ?? '') ?? `Hair style ${num(v ?? '')}`);
  if (part === 'glasses') return v ? (faceVariantName('glasses', v) ?? `Glasses ${num(v)}`) : 'No glasses';
  return v ? (faceVariantName('beard', v) ?? `Beard ${num(v)}`) : 'No beard';
}

/** A face in a few words, for the live region after a Shuffle: "short curls, round glasses". */
export function faceWords(f: FaceRecipe): string {
  const parts = [partLabel('hair', f.hair).toLowerCase()];
  if (f.glasses) parts.push(partLabel('glasses', f.glasses).toLowerCase());
  if (f.beard) parts.push(partLabel('beard', f.beard).toLowerCase());
  return parts.join(', ');
}
