// A behavior request in Being built (BeingBuilt.tsx Detail), once the design system lead made it the default:
//   - BehaviorSent, for everyone: today's sentence struck, an arrow, the wanted one, where it gets in the way, who
//     asked and who made it the default (from the comment Bridge writes, scripts/behavior-facts.ts);
//   - BehaviorDevelopers, in "For developers" for a developer only: the behavior id and its keys from the component's
//     docs.json, the files to change (real paths read from the repository), the Base UI primitive its source imports,
//     and "Copy the request for Claude" (core buildRequestBrief, behavior-brief.ts). Nothing here is guessed: what
//     the repository does not say stays out.
import { useState } from 'react';
import { Button, Kbd, Link, VisuallyHidden } from '@bridge-ds/react';
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
  /** The request on GitHub: a plain link line. */
  github?: { href: string; label: string } | null;
}

/**
 * Labelled rows, each only when the repository says it: Behavior (its id and keys), Files to change, Base UI. Then the
 * request on GitHub, then "Copy the request for Claude", last. A read that fails leaves its row out, never a bare id.
 */
export function BehaviorDevelopers({ ask, facts, brief, github }: BehaviorDevelopersProps) {
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
  const keys = facts?.keys ?? [];
  const files = facts?.files ?? [];
  const primitives = facts?.primitives ?? [];
  const behaviorRow = ask.of === 'component' && (ask.behavior ? keys.length > 0 : true);
  return (
    <div className="bb-bh-dev">
      {facts === null ? (
        <p className="t-ui t-muted">Reading the files of {ask.id}.</p>
      ) : (
        (behaviorRow || files.length > 0 || primitives.length > 0) && (
          <dl className="t-ui bb-bh-facts">
            {behaviorRow && (
              <div>
                <dt>Behavior</dt>
                <dd>
                  {ask.behavior ? (
                    <>
                      <span className="mono">{ask.behavior}</span>{' '}
                      <span className="bb-bh-keys">
                        {keys.map((k) => (
                          <Kbd key={k} keys={keyLabel(k)} size="sm" />
                        ))}
                      </span>
                    </>
                  ) : (
                    'A new behavior'
                  )}
                </dd>
              </div>
            )}
            {files.length > 0 && (
              <div>
                <dt>Files to change</dt>
                <dd>
                  <ul className="bb-bh-files">
                    {files.map((f) => (
                      <li key={f} className="mono">
                        {f}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {primitives.length > 0 && (
              <div>
                <dt>Base UI</dt>
                <dd>It wraps {primitives.map((p) => `${p.name} from ${p.module}`).join(', ')}.</dd>
              </div>
            )}
          </dl>
        )
      )}
      {github && (
        <p className="t-ui">
          <Link href={github.href} target="_blank" rel="noopener noreferrer">
            {github.label}
          </Link>
        </p>
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
