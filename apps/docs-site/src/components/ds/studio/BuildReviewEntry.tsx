// The way into Check the build, region by region (BuildReview.tsx), on the exploration page at Check the build: a
// summary, never the whole page. Two parts, one read of the check (scripts/build-review-data.ts, kept a little while):
//   - BuildReviewEntry, in the page's screen block (ExplorationPage checkEntry): the three facts first (where the build
//     differs and how many only on a phone, the things to check from the handover notes, what the developer mentions),
//     then a row of crops, one per difference, the same height, numbered, dashed when the developer mentions it: the
//     first four (two on a phone) then a "+N" tile. Each crop opens the review mode at that difference.
//   - BuildReviewActions, in the Your turn zone: [Open <builder>'s build] [Start the check], end-aligned, the primary
//     last; Looks right and Needs changes live in the review mode's final answer. While Bridge has not measured the
//     build yet, it says so and keeps the zone's own answers (`fallback`).
import "../../../styles/build-review-entry.css";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import ButtonLink from "../ButtonLink";
import { studioHref } from "../../../lib/team-path";
import {
  entryFacts,
  possessive,
  reviewPath,
  standing,
  groupsOf,
  REVIEW_WORDS as W,
  type ReviewItem,
  type ReviewRead,
} from "../../../lib/build-review-view";

const data = () => import("../../../scripts/build-review-data");

function Crop({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void data()
      .then((m) => m.imageSrc(url))
      .then((s) => live && setSrc(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [url]);
  return src ? (
    <img src={src} alt={alt} />
  ) : (
    <span className="bre-wait" role="img" aria-label={alt} />
  );
}

/** The check of one exploration, read once for both parts: null while it reads, 'none' when there is nothing. */
function useReview(
  product: string,
  number: number
): { d: ReviewRead | null | "none"; team: string } {
  const [d, setD] = useState<ReviewRead | null | "none">(null);
  const [team, setTeam] = useState("");
  useEffect(() => {
    let live = true;
    void data()
      .then(async (m) => {
        const t = await m.teamOfPage();
        const r = await m.loadReviewKept({ product, number });
        if (live) {
          setTeam(t);
          setD(r ?? "none");
        }
      })
      .catch(() => live && setD("none"));
    return () => {
      live = false;
    };
  }, [product, number]);
  return { d, team };
}

const hrefOf = (product: string, number: number, item?: string) =>
  studioHref(
    `${reviewPath(number, product)}${
      item ? `&item=${encodeURIComponent(item)}` : ""
    }`
  );

/** The Your turn zone's actions at Check the build: open the build, start the check; the old answers until measured. */
export function BuildReviewActions({
  product,
  number,
  builder: builderHint,
  fallback,
}: {
  product: string;
  number: number;
  builder?: string;
  fallback: ReactNode;
}) {
  const { d } = useReview(product, number);
  if (d === null)
    return (
      <p className="bre-line" role="status">
        {W.reading}
      </p>
    );
  const m = d === "none" ? null : d.review;
  if (d === "none" || !m) {
    const builder =
      (d !== "none" && (d.pull.builderName ?? d.pull.builder)) ||
      builderHint ||
      "the developer";
    return (
      <>
        {d !== "none" && (
          <p className="bre-line" role="status">
            {W.measuring(builder)}
          </p>
        )}
        {fallback}
      </>
    );
  }
  const builder =
    d.pull.builderName ?? d.pull.builder ?? builderHint ?? "the developer";
  return (
    <div className="bre-actions">
      {m.urls.build && (
        <ButtonLink
          href={m.urls.build}
          target="_blank"
          rel="noopener"
          variant="secondary"
          size="md"
          iconEnd={ExternalLink}
        >
          {W.openBuildOf(possessive(builder))}
        </ButtonLink>
      )}
      <ButtonLink
        href={hrefOf(product, number, "first")}
        variant="primary"
        size="md"
      >
        {d.role ? W.start : W.look}
      </ButtonLink>
    </div>
  );
}

/** The screen block's summary at Check the build: the facts and the crops. Nothing until the build is measured. */
export function BuildReviewEntry({
  product,
  number,
  builder: builderHint,
}: {
  product: string;
  number: number;
  builder?: string;
}) {
  const { d, team } = useReview(product, number);
  const href = (item?: string) => hrefOf(product, number, item);
  if (d === "none" || !d?.review) return null;
  const builder =
    (d && (d.pull.builderName ?? d.pull.builder)) ||
    builderHint ||
    "the developer";
  const m = d?.review ?? null;
  const items = m && d ? standing(m.items, d.items, {}).open : [];
  const g = groupsOf(items);
  const ordered: ReviewItem[] = [...g.wide, ...g.phone];
  const facts = d && m ? entryFacts(d, builder) : [];
  const img = (name: string) =>
    `/api/contribute?${new URLSearchParams({
      repo: team,
      buildImage: "1",
      code: d?.code ?? "",
      pull: String(d?.pull.number ?? 0),
      run: m?.run ?? "",
      name,
    })}`;
  return (
    <section className="bre" aria-label={W.entryTitle}>
      {
        <>
          <ul className="bre-facts">
            {facts.map((f) => (
              <li key={f.key}>
                <strong>{f.n}</strong>
                <span>{f.line}</span>
              </li>
            ))}
          </ul>
          {ordered.length > 0 && (
            <ul className="bre-crops">
              {ordered.map((it, i) => (
                <li
                  key={it.sig}
                  className={`${i >= 2 ? "bre-wide" : ""} ${
                    i >= 4 ? "bre-more-only" : ""
                  }`}
                >
                  {/* bridge-audit-ignore-next-line: a crop of the build is the link itself, at a fixed height with its number; a DS Link would underline a picture */}
                  <a
                    href={href(it.sig)}
                    className={`bre-crop ${
                      d.meant.includes(it.sig) ? "is-meant" : ""
                    }`}
                    aria-label={`${it.n}. ${it.name}: ${it.line}`}
                  >
                    {it.crop.f || it.crop.b ? (
                      <Crop url={img((it.crop.f ?? it.crop.b)!)} alt="" />
                    ) : (
                      <span className="bre-wait" />
                    )}
                    <span className="bre-pin" aria-hidden="true">
                      {it.n}
                    </span>
                  </a>
                </li>
              ))}
              {ordered.length > 2 && (
                <li
                  className={`bre-more ${
                    ordered.length > 4 ? "" : "bre-phone-only"
                  }`}
                >
                  {/* bridge-audit-ignore-next-line: the "+N" tile sits in the row of crops at their size and opens the rest; a DS Link would underline it out of the row */}
                  <a href={href()} className="bre-crop bre-plus">
                    <span className="bre-plus-wide">
                      +{Math.max(0, ordered.length - 4)}
                    </span>
                    <span className="bre-plus-phone">
                      +{ordered.length - 2}
                    </span>
                  </a>
                </li>
              )}
            </ul>
          )}
        </>
      }
    </section>
  );
}
