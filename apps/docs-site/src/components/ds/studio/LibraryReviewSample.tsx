// One side of a library piece drawn from its data (Library review: One by one, List, Who gets it): a color in place, a
// space as a bar, a corner as a shape, a type size as "Aa"; anything else as the change's own thumbnail. Data values,
// not style literals.
import { BranchThumb } from './BranchThumb';
import { colorLook, tokenGroup, type ReviewPiece } from '../../../lib/library-review';
import type { ThumbSpec } from '../../../lib/branch-thumb';
import { emptySideWords } from '../../../lib/new-piece-preview';

export const thumbOf = (p: ReviewPiece, thumbs: Map<string, ThumbSpec>): ThumbSpec => {
  const t = thumbs.get(p.key);
  if (t) return t;
  if (p.swatch) return { kind: 'color', token: '', before: p.swatch.before, after: p.swatch.after };
  return { kind: 'icon', icon: p.kind === 'Docs' ? 'guidance' : tokenGroup(p.category) ? 'token' : 'component' };
};

/** The before side is empty for something new. */
export const isNew = (p: ReviewPiece) => /^New\b/.test(p.kind) || p.kind === 'Docs';

/**
 * One side of a piece, drawn from its data: a color as a swatch, a space as a bar, a corner as a shape, a type size as
 * "Aa"; anything else as the change's own thumbnail (a component, docs). Data values, not style literals.
 */
export function Sample({ spec, side, size, title = '' }: { spec: ThumbSpec; side: 'before' | 'after'; size: 'row' | 'card'; title?: string }) {
  const big = size === 'card';
  if (spec.kind === 'color') {
    const hex = spec[side];
    if (!hex) return <span className="lr-plate-none">{emptySideWords(side)}</span>;
    // The token in place (data colours, not style literals): text on its surface, a filled card, or the main button.
    // A dark piece is drawn in the dark theme's own surfaces (raised for popovers and menus), whatever the page theme.
    const { look, dark, raised } = colorLook(title);
    const cls = `lr-look lr-look-${look}${big ? ' is-big' : ''}${dark ? ' is-dark' : ''}${raised ? ' is-raised' : ''}`;
    if (look === 'text')
      return (
        <span className={cls} data-theme={dark ? 'dark' : undefined}>
          <span style={{ color: hex }}>{big ? 'Last touch 2 days ago' : 'Aa'}</span>
        </span>
      );
    if (look === 'surface')
      return (
        <span className={cls} style={{ background: hex }}>
          <span className="lr-look-line" />
          {big && <span className="lr-look-line is-short" />}
        </span>
      );
    return (
      <span className={cls} style={{ background: hex }}>
        {big ? 'Save' : ''}
      </span>
    );
  }
  if (spec.kind === 'space' || spec.kind === 'radius' || spec.kind === 'type') {
    const v = spec[side];
    if (v === null) return <span className="lr-plate-none">{emptySideWords(side)}</span>;
    const max = Math.max(spec.before ?? 0, spec.after ?? 0, 1);
    const room = big ? 160 : 40;
    if (spec.kind === 'space') return <span className="lr-space" style={{ width: `${Math.round((v / max) * room)}px` }} />;
    if (spec.kind === 'radius') return <span className={`lr-corner${big ? ' is-big' : ''}`} style={{ borderRadius: `${Math.min(v, big ? 32 : 12)}px` }} />;
    return (
      <span className="lr-glyph" style={{ fontSize: `${Math.round((v / max) * (big ? 56 : 18))}px` }}>
        Aa
      </span>
    );
  }
  if (spec.kind === 'image') return <img className="lr-img" src={spec[side]} alt="" loading="lazy" decoding="async" />;
  return <BranchThumb spec={spec} size={size} />;
}

