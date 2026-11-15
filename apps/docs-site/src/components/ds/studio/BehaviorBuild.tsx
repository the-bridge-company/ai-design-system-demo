// A behavior request in Being built (BeingBuilt.tsx Detail), once the design system lead made it the default:
//   - BehaviorSent, for everyone: today's sentence struck, an arrow, the wanted one, where it gets in the way, who
//     asked and who made it the default (from the comment Bridge writes, scripts/behavior-facts.ts);
//   - BehaviorDevelopers, in "For developers" for a developer only: the behavior id and its keys from the component's
//     docs.json, the files to change (real paths read from the repository), the Base UI primitive its source imports,
//     and "Copy the request for Claude" (core buildRequestBrief, behavior-brief.ts). Nothing here is guessed: what
//     the repository does not say stays out.
import { useState } from 'react';
import { Button, Kbd, VisuallyHidden } from '@bridge-ds/react';
import { keyLabel, type BehaviorAsk, type BehaviorFacts } from '@bridge-ds/core';

export interface BehaviorSentProps {
  ask: BehaviorAsk;
  /** "Asked by Sofia on Nov 14. Dana made it the default on Nov 15.": said once, under the change. */
  meta: string;
}

export function BehaviorSent({ ask, meta }: BehaviorSentProps) {
  return (
    <>
      <p className="t-body bb-measure bb-bh-line">
        {ask.today ? (
          <>
            <VisuallyHidden>Today: </VisuallyHidden>
            <s className="t-muted">{ask.today}</s>
            <span className="t-muted bb-bh-arrow" aria-hidden="true">
              →
            </span>
            <VisuallyHidden>. Wanted: </VisuallyHidden>
          </>
        ) : (
          <span className="t-muted">Something it does not do yet: </span>
        )}
        <strong>{ask.wanted}</strong>
      </p>
      {ask.where && <p className="t-body bb-measure">It gets in the way in {ask.where.replace(/[.]+$/, '')}.</p>}
      <p className="t-meta t-muted bb-meta">{meta}</p>
    </>
  );
}

export interface BehaviorDevelopersProps {
  ask: BehaviorAsk;
  /** What the repository says, once read; null while it is read. */
  facts: BehaviorFacts | null;
  brief: string | null;
}

export function BehaviorDevelopers({ ask, facts, brief }: BehaviorDevelopersProps) {
  const [done, setDone] = useState<'copied' | 'failed' | null>(null);
  const copy = async () => {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setDone('copied');
    } catch {
      setDone('failed');
    }
  };
  const which = ask.of === 'pattern' ? (ask.rule !== undefined ? `Rule ${ask.rule + 1} of the ${ask.id} pattern` : `A new rule of the ${ask.id} pattern`) : ask.behavior ?? 'A new behavior';
  return (
    <div className="bb-bh-dev">
      <p className="t-ui bb-measure">
        <span className={ask.behavior ? 'mono' : undefined}>{which}</span>
        {facts?.keys?.length ? (
          <>
            {' '}
            <span className="bb-bh-keys">
              {facts.keys.map((k) => (
                <Kbd key={k} keys={keyLabel(k)} size="sm" />
              ))}
            </span>
          </>
        ) : null}
      </p>
      {facts === null ? (
        <p className="t-ui t-muted">Reading the files of {ask.id}.</p>
      ) : (
        <>
          {facts.files?.length ? (
            <>
              <h4 className="t-ui bb-h4">Files to change</h4>
              <ul className="t-ui bb-list bb-bh-files">
                {facts.files.map((f) => (
                  <li key={f} className="mono">
                    {f}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {facts.primitives?.length ? (
            <p className="t-ui t-muted bb-measure">
              It wraps {facts.primitives.map((p) => `${p.name} from ${p.module}`).join(', ')}.
            </p>
          ) : null}
        </>
      )}
      {brief && (
        <span className="bb-copy">
          <Button variant="secondary" onClick={() => void copy()}>
            Copy the request for Claude
          </Button>
          <span className="t-ui t-muted" role="status">
            {done === 'copied' ? 'Copied. Paste it in Claude Code.' : done === 'failed' ? 'Your browser blocked copying. The request is on GitHub.' : ''}
          </span>
        </span>
      )}
    </div>
  );
}
