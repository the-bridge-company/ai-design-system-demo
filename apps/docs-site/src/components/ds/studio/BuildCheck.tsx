// Check the build (board R4), in the hand-off zone of a design copy exploration once the developers' version is ready:
// one sentence, who checks it and where each stands (the designer and the product manager, the design lead when the
// library changed), and for them Looks right or Needs changes. Needs changes asks what needs to change first: the build
// is off (back to the developer) or the design must change (back to the designer, a new round). Bridge's server signs
// it on the developers' work and keeps the "Design check" on it. Words: lib/build-check-view.ts.
import { useState, type FormEvent } from "react";
import { Button, Radio, RadioGroup, Textarea } from "@bridge-ds/react";
import {
  BUILD_WORDS as W,
  type BuildCheckView,
  type BuildWhy,
} from "../../../lib/build-check-view";
import { BuildReviewActions } from "./BuildReviewEntry";

/**
 * `inZone`: inside the page's "Your turn" zone, which already asks the question and whose rail names who checks: only
 * the answer (Looks right, the page's one primary action, or Needs changes and its form) and what an answer does.
 */
export function BuildCheck({
  v,
  say,
  inZone = false,
}: {
  v: BuildCheckView;
  say: (s: string) => void;
  inZone?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState<BuildWhy>("build");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"looks-right" | "changes" | null>(null);
  const send = (kind: "looks-right" | "changes") => {
    if (!v.onSay || (kind === "changes" && !text.trim())) return;
    setBusy(kind);
    v.onSay({ kind, ...(kind === "changes" ? { why, text: text.trim() } : {}) })
      .then((r) => {
        setAsking(false);
        setText("");
        if (r) say(r);
      })
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(null));
  };
  // Looks right or Needs changes. In the zone with the review mode, they live in its final answer: the zone shows them
  // only while Bridge has not measured the build yet (BuildReviewActions).
  const answers = (
    <>
      {v.onSay &&
        (asking ? (
          <form
            className="xp-lead-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              send("changes");
            }}
          >
            <RadioGroup
              label={W.whatChanges}
              value={why}
              onValueChange={(x) => setWhy(x === "design" ? "design" : "build")}
            >
              <Radio
                value="build"
                label={W.buildOff}
                description={W.buildOffHint(v.builder)}
              />
              <Radio
                value="design"
                label={W.designChange}
                description={W.designChangeHint(v.designer)}
              />
            </RadioGroup>
            <Textarea
              label={W.note}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="xp-pm-acts">
              {inZone && (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setAsking(false)}
                >
                  {W.cancel}
                </Button>
              )}
              <Button
                type="submit"
                variant={inZone ? "primary" : "inverse"}
                size="md"
                loading={busy === "changes"}
                disabled={!text.trim() || busy !== null}
              >
                {W.send}
              </Button>
              {!inZone && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setAsking(false)}
                >
                  {W.cancel}
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="xp-pm-acts">
            {inZone && (
              <Button
                variant="secondary"
                size="md"
                disabled={busy !== null}
                onClick={() => setAsking(true)}
              >
                {W.needsChanges}
              </Button>
            )}
            <Button
              variant={inZone ? "primary" : "inverse"}
              size="md"
              loading={busy === "looks-right"}
              disabled={busy !== null}
              onClick={() => send("looks-right")}
            >
              {W.looksRight}
            </Button>
            {!inZone && (
              <Button
                variant="secondary"
                size="md"
                disabled={busy !== null}
                onClick={() => setAsking(true)}
              >
                {W.needsChanges}
              </Button>
            )}
          </div>
        ))}
    </>
  );
  return (
    <div
      className="xp-build"
      {...(inZone ? {} : { "aria-labelledby": "xp-build-h" })}
    >
      {!inZone && (
        <>
          <h3 className="xp-h3" id="xp-build-h">
            {W.title}
          </h3>
          <p>{v.line}</p>
        </>
      )}
      {!inZone && (
        <ul className="xp-build-rows">
          {v.rows.map((r) => (
            <li key={r.role} className="xp-build-row">
              <span className="xp-build-who">
                <strong>{r.name}</strong>
                {r.part && `, ${r.part}`}
              </span>
              <span className={`xp-build-state is-${r.state}`}>
                {r.stateLine}
              </span>
              {r.note && <span className="xp-build-note">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {v.review && inZone ? (
        <BuildReviewActions
          product={v.review.product}
          number={v.review.number}
          builder={v.builder}
          fallback={answers}
        />
      ) : (
        answers
      )}
      {v.note && !(v.review && inZone) && <p className="xp-muted">{v.note}</p>}
    </div>
  );
}
