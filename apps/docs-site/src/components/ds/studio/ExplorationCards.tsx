// The card family of explorations, shared by the Studio home and the product pages (Gestalt similarity: the same kind
// of thing is the same card everywhere):
//   - ExplorationCardItem: one exploration, its explored screen on top, the title, then a fixed footer (its tag, then who
//     explores it and the product on one line).
//   - ProductFolderCard: one product, like a project folder in Figma: a mosaic of its latest explorations' screens
//     (their captures, else their plates), the product name and what is in progress ("2 exploring · 1 waiting for
//     code"). The whole card opens the product page (lib/product-page.ts). With no screen yet (the library has none of
//     its own), a Field Guide drawing holds the mosaic's place.
import { Badge, Card, Link } from '@bridge-ds/react';
import { Who } from './faces';
import { shortAgo } from '@bridge-ds/core';
import { BranchThumb } from './BranchThumb';
import type { ExplorationCard } from '../../../lib/home-explorations';
import { SEP } from '../../../lib/home-model';
import type { ProductFolder } from '../../../lib/product-page';
import { statusTagClass } from '../../../lib/status-tag';
import { Drawing } from './Drawing';

/** The corner of a library exploration's screen: it belongs to no product. */
const LIBRARY = 'Library';

export function ExplorationCardItem({ c, showProduct = true }: { c: ExplorationCard; showProduct?: boolean }) {
  // When it last moved, the same age as its row on Explorations (core shortAgo of updated_at), never the capture's.
  const age = c.updated ? shortAgo(c.updated) || null : null;
  return (
    <li className="sh-card-item">
      <Card interactive padding="none" className="sh-card">
        <BranchThumb spec={c.preview} size="card" chip={showProduct ? (c.product ?? LIBRARY) : null} />
        <div className="sh-card-body">
          <span className="sh-card-head">
            <Link href={c.href} variant="subtle" className="t-body sh-card-title" title={c.title} data-card-primary>
              <span className="sh-strong">{c.title}</span>
            </Link>
          </span>
          {/* A fixed footer, pinned to the bottom: the DS tag of its page, then who explores it and when it last moved (as
              on Explorations), on one line (a long one ends in an ellipsis). Every card of a row has the same footer, so the
              tags and the names line up whatever the titles' length. The product sits in the screen's corner; on a
              product page it goes without saying and is left out. */}
          <span className="sh-card-foot">
            <span className="sh-card-tagline">
              {c.state && (
                <Badge tone={c.tone ?? 'neutral'} dot={c.dot ?? false} size="sm" className={statusTagClass(c.tone ?? 'neutral', 'sh-card-tag')}>
                  {c.state}
                </Badge>
              )}
            </span>
            <span className="t-ui sh-card-who">
              <Who p={c.author} size="xs" />
              <span className="sh-card-name">
                {c.author.name}
                {age ? <span className="sh-card-product">{SEP}{age}</span> : null}
              </span>
            </span>
          </span>
        </div>
      </Card>
    </li>
  );
}

/**
 * One product as a folder: the mosaic of its latest screens (one, two, or the newest large and the next two stacked),
 * its name and what is in progress. No screen yet: the Field Guide drawing of the library (or of a product), never an
 * empty plate.
 */
export function ProductFolderCard({ f }: { f: ProductFolder }) {
  // The mosaic is decorative (aria-hidden): who explores its screens is said once, in words, for screen readers.
  const people = [...new Set(f.shots.map((s) => s.who.name))];
  return (
    <li className="sh-card-item">
      <Card interactive padding="none" className="sh-card pf-card">
        {/* No screen to show (the library, or a product nothing explored yet): a Field Guide drawing in the mosaic's
            place, so every folder of the row has the same top and the row reads as one family. */}
        {f.shots.length === 0 && (
          <span className="pf-mosaic pf-art" data-panes="1" aria-hidden="true">
            <span className="pf-pane pf-art-pane">
              <Drawing name={f.library ? 'components' : 'address'} width={112} className="pf-art-drawing" />
            </span>
          </span>
        )}
        {f.shots.length > 0 && (
          <span className="pf-mosaic" data-panes={f.shots.length} aria-hidden="true">
            {f.shots.map((s, i) => (
              <span key={s.key} className={`pf-pane pf-pane-${i}`}>
                <BranchThumb spec={s.spec} size="card" />
                {/* Who explores this screen, on its top-left corner: the same face as on their cards and in Members. */}
                <span className="pf-pane-who" title={s.who.name}>
                  <Who p={s.who} size="xs" />
                </span>
              </span>
            ))}
          </span>
        )}
        <div className="sh-card-body">
          <span className="sh-card-head">
            <Link href={f.href} variant="subtle" className="t-body sh-card-title" data-card-primary>
              <span className="sh-strong">{f.name}</span>
            </Link>
          </span>
          <span className="sh-card-foot">
            <span className="t-ui t-muted sh-card-product">{f.line}</span>
            {people.length > 0 && <span className="sr-only">Explored by {people.join(', ')}.</span>}
          </span>
        </div>
      </Card>
    </li>
  );
}

/** "Products": a row of folder cards, aligned on the exploration cards' grid. */
export function ProductFolders({ folders }: { folders: ProductFolder[] }) {
  if (!folders.length) return null;
  return (
    <section className="sh-section" aria-labelledby="sh-products">
      <header className="sh-section-head">
        <h2 id="sh-products" className="sh-h2">
          Products
        </h2>
      </header>
      <ul className="sh-cards" data-product-folders="">
        {folders.map((f) => (
          <ProductFolderCard key={f.key} f={f} />
        ))}
      </ul>
    </section>
  );
}
