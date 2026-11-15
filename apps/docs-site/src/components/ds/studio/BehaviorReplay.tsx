// "Play both" on a behavior request (phase 2, PR 3), for the design lead who decides and for the person who asked:
// today's component (the team's published Storybook) and Claude's preview (the per-branch Storybook of
// agent/preview-<n>, bridge.config.json previews.apps.storybook) side by side, the same keys pressed on both, each
// side's result in one line (lib/story-replay.ts, the frames answer by postMessage). Also used by Being built's
// "Check against the preview" (BehaviorCheck.tsx) with the developer's build as a third side.
// The preview is made by the person's own Claude through the Bridge connector, never by Bridge: Bridge only records it
// (core parsePreviewState, Bridge's app blocks). States:
//   ask        no preview yet (or made from words since changed): "Ask your Claude to make (update) the preview",
//              the line to say ("Make the Bridge preview for request #n") and Copy, the docs drafting hand-off's pattern
//   preparing  "Malik's Claude is preparing the preview."
//   ready      the two frames and Play both; "Updated from your words" once it was made again
//   failed     what went wrong, in one line; the lead can still decide on the sentences; the hand-off again
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Alert, Badge, Button, Kbd } from '@bridge-ds/react';
import { Check, Copy } from 'lucide-react';
import { keyLabel, previewPhrase } from '@bridge-ds/core';
import { PRESS_MESSAGE, READY_MESSAGE, SIDE_LABEL, parseKeysResult, resultLine, type KeysResult, type ReplaySide, type ReplayState } from '../../../lib/story-replay';
import '../../../styles/replay.css';

export interface ReplayFrame {
  side: ReplaySide;
  src: string;
}

const ANSWER_MS = 8000;

/**
 * The frames' replay: `play(keys)` loads every frame fresh, waits for it to say it is ready, asks it to press the
 * keys, and gives back each side's answer (null when one did not answer in time).
 */
export function useKeyReplay(frames: readonly ReplayFrame[]) {
  const refs = useRef(new Map<ReplaySide, HTMLIFrameElement>());
  const [run, setRun] = useState(0);
  const ready = useRef(new Map<ReplaySide, () => void>());

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if ((e.data as { type?: unknown } | null)?.type !== READY_MESSAGE) return;
      for (const [side, el] of refs.current) if (el.contentWindow === e.source) ready.current.get(side)?.();
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  const frameRef = (side: ReplaySide) => (el: HTMLIFrameElement | null) => {
    if (el) refs.current.set(side, el);
    else refs.current.delete(side);
  };

  const play = useCallback(
    async (keys: readonly string[]): Promise<Map<ReplaySide, KeysResult | null>> => {
      // Fresh frames: a story keeps what the last keys did.
      const loaded = new Map(frames.map((f) => [f.side, new Promise<void>((done) => ready.current.set(f.side, done))]));
      setRun((n) => n + 1);
      const out = new Map<ReplaySide, KeysResult | null>();
      await Promise.all(
        frames.map(async (f) => {
          const timeout = new Promise<'late'>((r) => setTimeout(() => r('late'), ANSWER_MS));
          if ((await Promise.race([loaded.get(f.side), timeout])) === 'late') return void out.set(f.side, null);
          const id = `${f.side}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const answer = new Promise<KeysResult | null>((resolve) => {
            const on = (e: MessageEvent) => {
              if (e.source !== refs.current.get(f.side)?.contentWindow) return;
              const r = parseKeysResult(e.data, id);
              if (!r) return;
              window.removeEventListener('message', on);
              resolve(r);
            };
            window.addEventListener('message', on);
            setTimeout(() => {
              window.removeEventListener('message', on);
              resolve(null);
            }, ANSWER_MS);
          });
          refs.current.get(f.side)?.contentWindow?.postMessage({ type: PRESS_MESSAGE, id, keys: [...keys] }, new URL(f.src).origin);
          out.set(f.side, await answer);
        }),
      );
      return out;
    },
    [frames],
  );

  return { run, frameRef, play };
}

export type { ReplayState };

export interface BehaviorReplayProps {
  state: ReplayState;
  /** The keys played, from the component's docs.json. Empty: there is nothing to play. */
  keys: readonly string[];
  /** The behavior's announcement today, from its docs.json ("Expected announcement"). */
  announces?: string | null | undefined;
  /** The design lead who decides (reads that they can still decide), the person who asked, or a developer. */
  viewer: 'lead' | 'requester' | 'developer';
  /** The request's number: the line the person says to their Claude names it. */
  number: number;
  component: string;
}

export const REPLAY_WORDS = {
  preparing: 'Claude is preparing the preview.',
  failed: (reason: string | null) => `Claude could not make the preview${reason ? `: ${reason.replace(/[.]+$/, '')}` : ''}.`,
  decideAnyway: 'You can still decide on the sentences.',
  ask: 'Ask your Claude to make the preview.',
  askUpdate: 'Ask your Claude to update the preview.',
  say: 'In Claude, with Bridge connected, say',
  copy: 'Copy',
  copied: 'Copied',
  preparingBy: (by: string) => `${by}'s Claude is preparing the preview.`,
  updated: 'Updated from your words',
  unplayable: "Claude made the change, but your Storybook does not publish each branch yet, so it cannot be played here.",
  play: 'Play both',
  playing: 'Playing',
  same: 'Same keys on both',
  expected: 'Expected announcement',
} as const;

/** "Ask your Claude to make the preview", and the line to say, with Copy: the hand-off to the person's own Claude. */
function AskClaude({ number, update }: { number: number; update: boolean }) {
  const [copied, setCopied] = useState(false);
  const phrase = previewPhrase(number, update);
  return (
    <p className="t-ui rq-replay-note rq-replay-ask">
      {update ? REPLAY_WORDS.askUpdate : REPLAY_WORDS.ask} {REPLAY_WORDS.say} <q className="rq-replay-phrase">{phrase}</q>{' '}
      <Button
        variant="ghost"
        size="sm"
        iconStart={copied ? Check : Copy}
        onClick={() => {
          void navigator.clipboard?.writeText(phrase).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? REPLAY_WORDS.copied : REPLAY_WORDS.copy}
      </Button>
    </p>
  );
}

export default function BehaviorReplay({ state, keys, announces, viewer, number, component }: BehaviorReplayProps) {
  const headingId = useId();
  const frames: ReplayFrame[] = state.kind === 'ready' ? [{ side: 'today', src: state.today }, { side: 'preview', src: state.preview }] : [];
  const { run, frameRef, play } = useKeyReplay(frames);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Map<ReplaySide, KeysResult | null> | null>(null);

  if (state.kind === 'ask') return <AskClaude number={number} update={state.update} />;
  if (state.kind === 'unplayable')
    return viewer === 'lead' ? <p className="t-ui t-muted rq-replay-note">{REPLAY_WORDS.unplayable}</p> : null;
  if (state.kind === 'preparing')
    return (
      <p className="t-ui t-muted rq-replay-note" role="status">
        {state.by ? REPLAY_WORDS.preparingBy(state.by.split(/\s+/)[0]!) : REPLAY_WORDS.preparing}
      </p>
    );
  if (state.kind === 'failed')
    return (
      <>
        <Alert tone="warning" className="rq-replay-note">
          {REPLAY_WORDS.failed(state.reason)}
          {viewer === 'lead' ? ` ${REPLAY_WORDS.decideAnyway}` : ''}
        </Alert>
        <AskClaude number={number} update={false} />
      </>
    );

  const go = async () => {
    setBusy(true);
    setResults(null);
    setResults(await play(keys));
    setBusy(false);
  };
  return (
    <section className="rq-replay" aria-labelledby={headingId}>
      <div className="rq-replay-head">
        <h3 id={headingId} className="t-ui rq-replay-title">
          {REPLAY_WORDS.same}
        </h3>
        <span className="rq-replay-keys" aria-label={`Keys: ${keys.join(', ')}`}>
          {keys.map((k, i) => (
            <Kbd key={`${k}-${i}`} keys={keyLabel(k)} size="sm" />
          ))}
        </span>
        {state.updated && <Badge tone="info">{REPLAY_WORDS.updated}</Badge>}
        <Button variant="primary" size="sm" loading={busy} disabled={busy || keys.length === 0} onClick={() => void go()}>
          {busy ? REPLAY_WORDS.playing : REPLAY_WORDS.play}
        </Button>
      </div>
      <div className="rq-replay-sides">
        {frames.map((f) => (
          <figure key={f.side} className="rq-replay-side">
            <figcaption className="t-ui rq-replay-label">{SIDE_LABEL[f.side]}</figcaption>
            <iframe key={`${f.side}-${run}`} ref={frameRef(f.side)} src={f.src} title={`${component}, ${SIDE_LABEL[f.side]}`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" className="rq-replay-frame" />
            <p className="t-ui rq-replay-result" role="status">
              {results ? resultLine(results.get(f.side) ?? null) : ''}
            </p>
            {f.side === 'today' && announces && (
              <p className="t-ui t-muted">
                {REPLAY_WORDS.expected}: <q>{announces}</q>
              </p>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
