// Library > Foundations > Color, for any repo model: each semantic color group at work in both themes, then its
// tokens, and the primitive palette behind them. Bridge's own page renders it at build time (pages/foundations/
// color.astro), a team's Library in the browser (LibraryTeamPage.tsx).
import { Button, Link } from '@bridge-ds/react';
import type { SpecimenGroup } from '../../../foundations/Specimens';
import { groupRows } from '../../../../lib/library/foundations';
import { luminance } from '../../../../lib/library/contrast';
import { anchorOf } from '../../../../lib/library/token-href';
import { colorRamps, tokenAxes, tokenRows } from '../../../../lib/library/tokens';
import { CopyAsSwitch, GroupSection, LibraryHeader, TokenGroup } from '../FoundationParts';
import { pageHref, studioLink, type LibraryData } from '../library-data';
import { ConfluenceCopy } from '../ConfluenceCopy';

const SPECIMEN: Record<string, SpecimenGroup> = {
  'color.bg': 'color.bg',
  'color.surface': 'color.surface',
  'color.text': 'color.text',
  'color.border': 'color.border',
  'color.action': 'color.action',
  'color.control': 'color.control',
  'color.signal': 'color.signal',
  'color.overlay': 'color.overlay',
  'color.feedback': 'color.feedback',
  'color.selection': 'color.selection',
  focus: 'focus',
};

// Step label color: whichever of the system's own extremes (palette neutral 950 or 0) reads better on the swatch.
// A translucent step (rgb(... / 0.08)) is drawn over white, so its label is picked on that composite, not on the
// opaque hex. (The label used --color-neutral-*, which does not exist, so it fell back to the page's ink: 1.3:1 on
// black.)
const alphaOf = (css: string) => {
  const m = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(css);
  return m ? Number(m[1]) / (m[2] ? 100 : 1) : 1;
};
const overWhite = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c: number) => Math.round(c * a + 255 * (1 - a));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
};
/** Relative luminance of palette neutral 950, the darkest ink of both brands (about 0.009 to 0.012). */
const INK_LUMINANCE = 0.011;
const labelOn = (hex: string | undefined, css: string) => {
  if (!hex) return 'var(--palette-neutral-950)';
  const l = luminance(overWhite(hex, alphaOf(css)));
  return (l + 0.05) / (INK_LUMINANCE + 0.05) >= 1.05 / (l + 0.05) ? 'var(--palette-neutral-950)' : 'var(--palette-neutral-0)';
};
const swatchOf = (cssVar: string, css: string) =>
  alphaOf(css) < 1 ? { backgroundImage: `linear-gradient(var(${cssVar}), var(${cssVar}))`, backgroundColor: 'var(--palette-neutral-0)' } : { backgroundColor: `var(${cssVar})` };

export const COLOR_PAGE = {
  title: 'Color',
  art: 'paint',
  studio: 'tokens/?focus=color',
  lead: 'Every color has a job. Each group shows its tokens at work in both themes, then lists them. Design and build with these semantic tokens.',
} as const;

export default function ColorView({ data }: { data: LibraryData }) {
  const { model } = data;
  const { modes } = tokenAxes(model);
  const colors = tokenRows(model).semantic.filter((s) => s.type === 'color');
  const groups = [...new Set(colors.map((s) => s.group))];
  const sections = groups.map((g) => ({ group: g, rows: groupRows(model, g).filter((r) => r.type === 'color') })).filter((s) => s.rows.length);
  const semanticUsing = (primitivePath: string) => colors.filter((s) => modes.some((m) => s.modes[m]!.chain.includes(primitivePath))).map((s) => s.path);
  return (
    <div data-fd-page="">
      <LibraryHeader title={COLOR_PAGE.title} art={COLOR_PAGE.art} studio={studioLink(data, COLOR_PAGE.studio)} canEdit={data.extras.canEdit} actions={<><CopyAsSwitch /><ConfluenceCopy data={data} route={pageHref(data, 'foundations/color/')} /></>}>
        {COLOR_PAGE.lead}
      </LibraryHeader>

      {sections.map((s) => (
        <TokenGroup key={s.group} data={data} group={s.group} rows={s.rows} preview="color" specimen={SPECIMEN[s.group]} scope="brand" />
      ))}

      <GroupSection
        id="primitives"
        title="Primitive palette"
        note="Raw values. Components never use these directly; semantic tokens point to them. Use them when you propose a new semantic token, not when you design a screen."
      >
        {colorRamps(model).map(({ hue, steps }) => (
          <section key={hue} aria-labelledby={`ramp-${hue}`} className="fd-ramp">
            <h3 id={`ramp-${hue}`}>{hue}</h3>
            <div className="ramp-strip" role="list">
              {steps.map((p) => {
                const n = semanticUsing(p.path).length;
                return (
                  <div key={p.path} className="ramp-step" id={anchorOf(p.cssVar)} role="listitem">
                    <span className="ramp-color" style={{ ...swatchOf(p.cssVar, p.css), color: labelOn(p.hex, p.css) }}>
                      <strong>{p.segments.slice(2).join('.') || p.segments.slice(1).join('.')}</strong>
                    </span>
                    <span className="ramp-meta">
                      <Button variant="link" size="sm" className="ramp-copy" data-copy={`var(${p.cssVar})`} aria-label={`${p.hex}, copy CSS variable var(${p.cssVar})`} title={`Copy var(${p.cssVar})`}>
                        {p.hex}
                      </Button>
                      <span className="ramp-n">{n > 0 ? `${n}\u00a0semantic` : 'Unused'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <p>
          Want to know exactly who uses a value? Paste a hex in search, or filter <Link href={pageHref(data, 'tokens/')}>All tokens</Link>.
        </p>
      </GroupSection>
    </div>
  );
}
