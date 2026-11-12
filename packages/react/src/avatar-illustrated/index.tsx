// @bridge-ds/react/avatar-illustrated: the Avatar with its illustrated fallback filled in. A separate entry because
// the drawings (the DiceBear "Notionists" style, design CC0 1.0 by Zoish, code MIT) weigh about 120 kB gzipped:
// products that only need initials never load them. The faces are generated locally from the seed, no network.
//
//   import { Avatar } from '@bridge-ds/react/avatar-illustrated';
//   <Avatar name="Ana Lima" seed="analima" fallback="illustrated" />
import { forwardRef, useMemo, type ComponentProps } from 'react';
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { Avatar as BaseAvatar, type AvatarProps } from '../components/Avatar';

const cache = new Map<string, string>();

/** The face framing every drawing shares: no hands, no body icon, zoomed on the face. */
const FRAME = { gestureProbability: 0, bodyIconProbability: 0, scale: 125, translateY: 12 } as const;

/**
 * The illustrated face for a seed as an SVG string, transparent so the Avatar paints the Harbor zone color behind
 * it. The same seed always gives the same face. No hands or body icons, and framed on the face (zoomed in, moved down): at 20 to 40px a whole bust is noise.
 */
export function illustratedAvatarSvg(seed: string): string {
  return createAvatar(notionists, { seed: seed.trim().toLowerCase() || '?', ...FRAME }).toString();
}

/** The illustrated face for a seed as a data URI, ready for an image `src` (memoized per seed). */
export function illustratedAvatarUri(seed: string): string {
  const key = seed.trim().toLowerCase();
  let uri = cache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(illustratedAvatarSvg(key))}`;
    if (cache.size > 500) cache.clear();
    cache.set(key, uri);
  }
  return uri;
}

/**
 * A drawn face as the parts it is made of, instead of a seed: what a person picks or shuffles (Studio's Your face).
 * Part names are the drawing's own (`variant12`, the hat is `hat`); `glasses` and `beard` are null for none. `v`
 * versions the recipe: a part a later drawing set renames falls back to the seed's.
 */
export interface FaceRecipe {
  v: 1;
  hair: string;
  eyes: string;
  brows: string;
  nose: string;
  lips: string;
  body: string;
  glasses: string | null;
  beard: string | null;
}

/** The parts of a face that a recipe sets, each with every variant the drawings offer, in order. */
export type FacePart = 'hair' | 'eyes' | 'brows' | 'nose' | 'lips' | 'body' | 'glasses' | 'beard';

const variantsOf = (part: FacePart): readonly string[] => {
  const p = (notionists.schema.properties as Record<string, { items?: { enum?: string[] } }>)[part];
  return [...(p?.items?.enum ?? [])].sort();
};

/** Every variant of each part (64 hair styles with the hat, 11 glasses, 12 beards...), sorted by name. */
export const FACE_PART_VARIANTS: Readonly<Record<FacePart, readonly string[]>> = Object.fromEntries(
  (['hair', 'eyes', 'brows', 'nose', 'lips', 'body', 'glasses', 'beard'] as const).map((k) => [k, variantsOf(k)]),
) as Record<FacePart, readonly string[]>;

/** The recipe of the face a seed draws: the same parts illustratedAvatarSvg(seed) shows. */
export function faceRecipe(seed: string): FaceRecipe {
  const extra = createAvatar(notionists, { seed: seed.trim().toLowerCase() || '?', ...FRAME }).toJson().extra as Record<string, unknown>;
  const str = (k: string) => (typeof extra[k] === 'string' ? (extra[k] as string) : null);
  return { v: 1, hair: str('hair')!, eyes: str('eyes')!, brows: str('brows')!, nose: str('nose')!, lips: str('lips')!, body: str('body')!, glasses: str('glasses'), beard: str('beard') };
}

/** The face a recipe draws, as an SVG string framed like every seed drawing (transparent, on the Avatar's Harbor). */
export function illustratedFaceSvg(recipe: FaceRecipe): string {
  const one = (part: FacePart, value: string | null) => (value && FACE_PART_VARIANTS[part].includes(value) ? [value] : undefined);
  const glasses = one('glasses', recipe.glasses);
  const beard = one('beard', recipe.beard);
  return createAvatar(notionists, {
    seed: 'recipe',
    ...FRAME,
    hair: one('hair', recipe.hair) as never,
    eyes: one('eyes', recipe.eyes) as never,
    brows: one('brows', recipe.brows) as never,
    nose: one('nose', recipe.nose) as never,
    lips: one('lips', recipe.lips) as never,
    body: one('body', recipe.body) as never,
    ...(glasses ? { glasses: glasses as never, glassesProbability: 100 } : { glassesProbability: 0 }),
    ...(beard ? { beard: beard as never, beardProbability: 100 } : { beardProbability: 0 }),
  }).toString();
}

/** The face a recipe draws as a data URI, ready for an image `src` (memoized per recipe). */
export function illustratedFaceUri(recipe: FaceRecipe): string {
  const key = `r:${recipe.hair}.${recipe.eyes}.${recipe.brows}.${recipe.nose}.${recipe.lips}.${recipe.body}.${recipe.glasses ?? '-'}.${recipe.beard ?? '-'}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(illustratedFaceSvg(recipe))}`;
    if (cache.size > 500) cache.clear();
    cache.set(key, uri);
  }
  return uri;
}

const IllustratedAvatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(props, ref) {
  const wants = props.fallback === 'illustrated' && props.kind !== 'agent' && !props.illustration;
  const seed = props.seed ?? props.name ?? '';
  const illustration = useMemo(() => (wants ? illustratedAvatarUri(seed) : undefined), [wants, seed]);
  return <BaseAvatar ref={ref} {...(props as ComponentProps<typeof BaseAvatar>)} {...(illustration ? { illustration } : {})} />;
});

/** The Bridge Avatar; with `fallback="illustrated"` it draws a face from `seed` (default: the name). Same props as the main Avatar. */
export const Avatar = IllustratedAvatar as typeof BaseAvatar;

export { AvatarGroup } from '../components/Avatar';
export type { AvatarProps, AvatarGroupProps, AvatarFallback, AvatarKind, AvatarAgentBrand, AvatarSize } from '../components/Avatar';
