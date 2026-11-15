// A behavior request's decision zone, on its page (Changes > a request, ?request=N, painted by scripts/requests.ts):
// today's sentence struck, an arrow, the wanted sentence, on one line, with who asked. For the person who decides (a
// design system owner, the same gate as Assign and Decline), three actions:
//   - Make it the default: it becomes a build request developers pick up in Being built (core makeBehaviorDefaultOnGitHub);
//   - Not now: the existing Decline dialog, with a required reason the requester reads (RequestDecide.tsx);
//   - Ask <first name>: a question to the requester, in a DS Dialog, posted on the request (core askRequesterOnGitHub).
// Never "for one product only": a behavior is the library's, for every product. Words: lib/requests-view.ts.
import { useId, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, ButtonGroup, Dialog, DialogClose, DialogContent, Textarea, VisuallyHidden } from '@bridge-ds/react';
import { askRequesterProblems } from '@bridge-ds/core';

export interface BehaviorDecisionActions {
  /** Makes it the default. Throws with a sentence that says how to fix it. */
  onDefault: () => Promise<void>;
  /** Opens the Decline dialog; focus comes back to `from` when it is kept. */
  onNotNow: (from: HTMLElement) => void;
  /** Posts the question. Throws with a sentence that says how to fix it. */
  onAsk: (text: string) => Promise<void>;
}

export interface BehaviorDecisionProps {
  /** Today's sentence; empty for something it does not do yet. */
  today: string;
  wanted: string;
  /** Who asked, as the page names them ("Dana Kim", "@dana"). */
  asker: string;
  /** The name on the Ask button ("Dana"). */
  askerFirst: string;
  /** Where it gets in the way, when the requester said. */
  where?: string | undefined;
  /** Only for the person who decides; unset, the zone only says what is asked. */
  actions?: BehaviorDecisionActions | null;
  /** "Play both": today and Claude's preview (BehaviorReplaySlot), for the lead and the person who asked. */
  replay?: ReactNode;
}

export default function BehaviorDecision({ today, wanted, asker, askerFirst, where, actions, replay }: BehaviorDecisionProps) {
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const askButton = useRef<HTMLButtonElement>(null);

  const makeDefault = async () => {
    if (!actions) return;
    setBusy(true);
    setError(null);
    try {
      await actions.onDefault();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!actions) return;
    const problems = askRequesterProblems(question);
    if (problems.length) {
      setInvalid(problems.join(' '));
      field.current?.focus();
      return;
    }
    setSending(true);
    setAskError(null);
    try {
      await actions.onAsk(question);
      setSending(false);
      setAsking(false);
      setAsked(true);
      requestAnimationFrame(() => askButton.current?.focus());
    } catch (err) {
      setAskError((err as Error).message);
      setSending(false);
    }
  };

  return (
    <section className="rq-bh" aria-labelledby={headingId}>
      <h2 id={headingId} className="rq-bh-who">
        {asker} asks to change how it behaves
      </h2>
      <p className="rq-bh-line">
        {today ? (
          <>
            <VisuallyHidden>Today: </VisuallyHidden>
            <s className="rq-bh-today">{today}</s>
            <span className="rq-bh-arrow" aria-hidden="true">
              →
            </span>
            <VisuallyHidden>. Wanted: </VisuallyHidden>
          </>
        ) : (
          <span className="rq-bh-today">Something it does not do yet: </span>
        )}
        <strong className="rq-bh-wanted">{wanted}</strong>
      </p>
      {where && <p className="rq-bh-where">It gets in the way in {where.replace(/[.]+$/, '')}.</p>}
      {replay}
      {actions && (
        <>
          <ButtonGroup className="rq-decide">
            <Button variant="primary" loading={busy} disabled={busy} onClick={() => void makeDefault()} data-demo-write="make it the default">
              {busy ? 'Making it the default' : 'Make it the default'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={(e) => actions.onNotNow(e.currentTarget)} data-demo-write="decline requests">
              Not now
            </Button>
            <Button
              ref={askButton}
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setQuestion('');
                setInvalid(null);
                setAskError(null);
                setAsking(true);
              }}
              data-demo-write="ask the requester"
            >
              {`Ask ${askerFirst}`}
            </Button>
          </ButtonGroup>
          {asked && (
            <p className="rq-bh-where" role="status">
              {`Question sent to ${askerFirst}. The request waits for you to decide.`}
            </p>
          )}
          {error && (
            <Alert tone="danger" className="ex-ask-error">
              {error}
            </Alert>
          )}
          <Dialog open={asking} onOpenChange={(o) => !o && !sending && setAsking(false)}>
            <DialogContent
              size="sm"
              title={`Ask ${askerFirst}`}
              description={`${askerFirst} reads it on the request, which stays open until you decide.`}
              initialFocus={field}
              footer={
                <ButtonGroup align="end">
                  <DialogClose render={<Button variant="secondary" disabled={sending} />}>Cancel</DialogClose>
                  <Button variant="primary" loading={sending} disabled={sending} onClick={() => void send()}>
                    {sending ? 'Sending' : 'Send question'}
                  </Button>
                </ButtonGroup>
              }
            >
              <Textarea
                ref={field}
                label="Your question"
                required
                rows={3}
                error={invalid ?? undefined}
                value={question}
                onValueChange={(v) => {
                  setQuestion(v);
                  setInvalid(null);
                }}
              />
              {askError && (
                <Alert tone="danger" className="ex-ask-error">
                  {askError}
                </Alert>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
