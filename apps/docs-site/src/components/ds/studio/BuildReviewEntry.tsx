// The way into Check the build, region by region (BuildReview.tsx), on the exploration page at Check the build: a
// summary, never the whole check. Two parts, one read of the check (scripts/build-review-data.ts, kept a little while):
//   - BuildReviewEntry, the page's screen block once Bridge measured the build: a short flat list of where the build
//     differs from the approved design, one line per difference (its number, name, what changes, "Phone only", its
//     answer once given, a chevron). The whole line opens that difference in the check page; on hover and focus the
//     two versions open under that line only, with "Look at N" at its end. The header's one primary follows progress,
//     never the line: Start the check, Continue, then Send your answer (in the Your turn zone once it holds it).
//     Under the lines, the handover notes as a checklist each answerer ticks (Bridge cannot measure them), folded
//     until someone starts. Before the measure, the page's own screen block (`fallback`).
//   - BuildReviewActions, in the Your turn zone: how many differences are answered, and Send your answer once all are.
//     While Bridge has not measured the build yet, it says so and keeps the zone's own answers (`fallback`).
// Words and rules: lib/build-review-view.ts (LEDGER_WORDS, ledgerOf).
import "../../../styles/build-review-entry.css";
import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Smartphone } from "lucide-react";
import { Badge, Button, Checkbox, Icon, Link, Progress } from "@bridge-ds/react";
import ButtonLink from "../ButtonLink";
import { Who } from "./faces";
import { studioHref } from "../../../lib/team-path";
import {
  eitherLine,
  firstAnswerOf,
  handoverRows,
  isPhoneOnly,
  ledgerOf,
  notesState,
  possessive,
  reviewPath,
  LEDGER_WORDS as L,
  REVIEW_WORDS as W,
  type ReviewItem,
  type ReviewRead,
  type Tick,
  type Verdict,
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
  if (src) return <img src={src} alt={alt} loading="lazy" />;
  return alt ? <span className="brl-wait" role="img" aria-label={alt} /> : <span className="brl-wait" aria-hidden="true" />;
}

/** The check of one exploration, read once for both parts: null while it reads, 'none' when there is nothing. */
function useReview(product: string, number: number): { d: ReviewRead | null | "none"; team: string } {
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
  studioHref(`${reviewPath(number, product)}${item ? `&item=${encodeURIComponent(item)}` : ""}`);

const builderOf = (d: ReviewRead, hint?: string) => d.pull.builderName ?? d.pull.builder ?? hint ?? "the developer";

/** The Your turn zone at Check the build: how many differences are answered; Send your answer once all are. */
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
  if (d === "none" || !d.review) {
    const builder = (d !== "none" && (d.pull.builderName ?? d.pull.builder)) || builderHint || "the developer";
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
  const builder = builderOf(d, builderHint);
  const l = ledgerOf(d);
  const first = firstAnswerOf(d);
  if (first)
    return (
      <p className="bre-line">
        {L.answeredFirst(first.byName, builder)}: {first.answer}.
      </p>
    );
  const either = eitherLine(d, builder);
  return (
    <div className="bre-turn">
      {either && <p className="bre-line">{either}</p>}
      <div className="bre-progress">
        <span>{L.progress(l.done, l.total)}</span>
        <Progress value={l.done} max={Math.max(1, l.total)} size="sm" aria-label={L.progress(l.done, l.total)} />
      </div>
      {l.cta === "send" && (
        <ButtonLink href={hrefOf(product, number, "answer")} variant="primary" size="md" fullWidth>
          {L.send(builder)}
        </ButtonLink>
      )}
    </div>
  );
}

/** One difference: the whole row opens it in the full check; "Look at N" shows on hover and focus. */
function Row({
  it,
  href,
  verdict,
  img,
  buildLabel,
}: {
  it: ReviewItem;
  href: string;
  verdict: Verdict | null;
  img: (name: string) => string;
  buildLabel: string;
}) {
  // The two versions open under this line only, on hover or focus; their pictures load the first time.
  const [seen, setSeen] = useState(false);
  const said = verdict === "fine" ? W.fine : verdict === "fix" ? W.fix : null;
  const label = `${L.lookAtLabel(it.n, it.name)}${said ? `: ${said}` : ""}`;
  return (
    <li className={`brl-row ${verdict ? `is-${verdict}` : ""}`} onPointerEnter={() => setSeen(true)} onFocus={() => setSeen(true)}>
      {/* bridge-audit-ignore-next-line: the whole line is the way into that difference (CTA 1), its keyboard stop too; a DS Link would underline the row. "Look at N" repeats it for the pointer. */}
      <a href={href} className="brl-cover" aria-label={label} />
      <span className="brl-num" aria-hidden="true">
        {it.n}
      </span>
      <p className="brl-line">
        <strong>{it.name}</strong> <span className="brl-muted">{it.line}</span>
      </p>
      <span className="brl-end">
        {isPhoneOnly(it) && (
          <Badge size="sm" icon={Smartphone}>
            {W.phoneOnly}
          </Badge>
        )}
        {said && (
          <Badge size="sm" tone={verdict === "fine" ? "success" : "danger"} {...(verdict === "fine" ? { icon: Check } : {})}>
            {said}
          </Badge>
        )}
        <Icon icon={ChevronRight} size="sm" className="brl-chev" />
        <ButtonLink href={href} variant="secondary" size="sm" iconEnd={ChevronRight} className="brl-go" tabIndex={-1} aria-hidden="true">
          {L.lookAt(it.n)}
        </ButtonLink>
      </span>
      {seen && (
        <div className="brl-pair">
          <figure>
            <figcaption>{L.approved}</figcaption>
            {it.crop.a ? <Crop url={img(it.crop.a)} alt="" /> : <span className="brl-wait" />}
          </figure>
          <figure>
            <figcaption>{buildLabel}</figcaption>
            {it.crop.b ? <Crop url={img(it.crop.b)} alt="" /> : <span className="brl-wait" />}
          </figure>
        </div>
      )}
    </li>
  );
}

/** The handover notes as a checklist each answerer ticks: Bridge cannot measure them. Every tick is saved. */
function Notes({
  d,
  product,
  number,
  builder,
  started,
}: {
  d: ReviewRead;
  product: string;
  number: number;
  builder: string;
  started: boolean;
}) {
  const rows = handoverRows(d.handover);
  const [ticks, setTicks] = useState<Tick[]>(d.ticks ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = notesState(rows, ticks, started);
  const [open, setOpen] = useState(!s.folded);
  if (!rows.length) return null;
  const canTick = Boolean(d.role);
  const designer = d.role === "designer" ? null : (d.designerName ?? "The designer");
  const tick = (key: string, found: boolean) => {
    setBusy(key);
    setError(null);
    const before = ticks;
    setTicks((t) => (found ? [...t.filter((x) => x.key !== key), { key, byName: d.me, role: d.role ?? "lead", at: new Date().toISOString() }] : t.filter((x) => x.key !== key)));
    void data()
      .then((m) => m.sayHandover({ product, number }, key, found))
      .then((t) => setTicks(t))
      .catch(() => {
        setTicks(before);
        setError(L.tickFailed);
      })
      .finally(() => setBusy(null));
  };
  return (
    <div className="brl-notes">
      <div className="brl-notes-head">
        <h3 id="brl-notes-h" className="brl-notes-title">
          {L.notesTitle(designer)}
        </h3>
        <span className="brl-muted">{L.notesLeft(s.left, rows.length)}</span>
        <Button
          variant="ghost"
          size="sm"
          iconEnd={open ? ChevronUp : ChevronDown}
          aria-expanded={open}
          aria-controls="brl-notes-list"
          onClick={() => setOpen((x) => !x)}
          className="brl-toggle"
        >
          {open ? L.hide : L.show}
        </Button>
      </div>
      {open && (
        <div id="brl-notes-list">
          <p className="brl-muted brl-hint">{L.notesHint(builder)}</p>
          <ul className="brl-checks" aria-labelledby="brl-notes-h">
            {rows.map((r) => (
              <li key={r.key}>
                <Checkbox
                  label={r.text}
                  description={r.kind}
                  checked={s.found.has(r.key)}
                  readOnly={!canTick}
                  disabled={busy === r.key}
                  onCheckedChange={(c) => canTick && tick(r.key, c)}
                />
              </li>
            ))}
          </ul>
          {error && (
            <p className="brl-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The screen block's summary at Check the build: the ledger of differences, then the handover notes. `fallback` (the
 * page's screen block) until Bridge measured the build. `turnShown`: the Your turn zone holds Send your answer, so the
 * header's primary steps back once every difference is answered (one primary per view).
 */
export function BuildReviewEntry({
  product,
  number,
  builder: builderHint,
  fallback = null,
  turnShown = false,
}: {
  product: string;
  number: number;
  builder?: string;
  fallback?: ReactNode;
  turnShown?: boolean;
}) {
  const { d, team } = useReview(product, number);
  if (d === null || d === "none" || !d.review) return <>{fallback}</>;
  const m = d.review;
  const builder = builderOf(d, builderHint);
  const designer = d.role === "designer" ? null : (d.designerName ?? "the designer");
  const l = ledgerOf(d);
  const first = firstAnswerOf(d);
  const either = eitherLine(d, builder);
  const href = (item?: string) => hrefOf(product, number, item);
  const img = (name: string) =>
    `/api/contribute?${new URLSearchParams({
      repo: team,
      buildImage: "1",
      code: d.code,
      pull: String(d.pull.number),
      run: m.run,
      name,
    })}`;
  const sizes = m.sizes.filter((s) => s.a || s.b).length || m.sizes.length;
  const cta =
    l.cta === "start" ? (
      <ButtonLink href={href(l.todo[0]?.sig ?? "first")} variant="primary" size="md">
        {L.start}
      </ButtonLink>
    ) : l.cta === "continue" ? (
      <ButtonLink href={href(l.todo[0]?.sig ?? "first")} variant="primary" size="md">
        {L.continue}
      </ButtonLink>
    ) : l.cta === "send" && !turnShown ? (
      <ButtonLink href={href("answer")} variant="primary" size="md">
        {L.send(builder)}
      </ButtonLink>
    ) : l.cta === "look" ? (
      <ButtonLink href={href("first")} variant="secondary" size="md">
        {L.look}
      </ButtonLink>
    ) : null;
  return (
    <section className="brl" aria-labelledby="brl-h">
      <header className="brl-head">
        <div className="brl-headtext">
          <p className="brl-muted brl-meta">{L.measured(m.measuredAt, sizes)}</p>
          <h2 id="brl-h" className="brl-title">
            {L.title(builder, designer)}
          </h2>
          <p className="brl-muted">{l.sub}</p>
          {either && (
            <p className="brl-either">
              <Who p={{ login: d.designerName ?? "designer", name: d.designerName ?? "Designer" }} size="xs" />
              <span>{either}</span>
            </p>
          )}
        </div>
        <div className="brl-acts">
          {m.urls.build && (
            <ButtonLink href={m.urls.build} target="_blank" rel="noopener" variant="secondary" size="md" iconEnd={ExternalLink}>
              {W.openBuildOf(possessive(builder))}
            </ButtonLink>
          )}
          {cta}
        </div>
      </header>
      {first && (
        <div className="brl-first">
          <p>
            <strong>{L.answeredFirst(first.byName, builder)}</strong>{" "}
            <Badge size="sm" tone={first.answer === "Looks right" ? "success" : "danger"}>
              {first.answer}
            </Badge>
          </p>
          {first.text && <p className="brl-muted">{first.text}</p>}
          <Link href="#xp-compose">{L.addComment}</Link>
        </div>
      )}
      <ul className="brl-rows" aria-label={L.label}>
        {l.rows.map(({ it, verdict }) => (
          <Row key={it.sig} it={it} href={href(it.sig)} verdict={verdict} img={img} buildLabel={L.builtBy(builder)} />
        ))}
      </ul>
      <Notes d={d} product={product} number={number} builder={builder} started={l.done > 0 || d.items.some((s) => s.others.length > 0)} />
    </section>
  );
}
