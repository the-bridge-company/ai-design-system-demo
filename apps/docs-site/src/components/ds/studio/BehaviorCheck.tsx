// "Check against the preview" in Being built (board G4), for the developer building a behavior request: every
// behavior of the component that has keys (its docs.json) is played on Claude's preview and on their build (the
// preview of their pull request's branch), one row each; a row checks when both say the same. Done when every row
// checks. Shown only when both previews exist (the team's Storybook publishes each branch, BeingBuilt.tsx decides).
import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge, Button, Icon } from '@bridge-ds/react';
import { replaySequence, resultLine, sameResult, SIDE_LABEL, type KeysResult } from '../../../lib/story-replay';
import { useKeyReplay } from './BehaviorReplay';
import '../../../styles/replay.css';

export interface BehaviorCheckProps {
  component: string;
  /** Claude's preview and the developer's build, stories that answer the keys. */
  preview: string;
  build: string;
  /** The component's behaviors with keys (docs.json), the request's own first. */
  behaviors: readonly { id: string; family: string; text: string; keys: string[] }[];
}

export const CHECK_WORDS = {
  title: 'Check against the preview',
  play: 'Play every row',
  playing: 'Playing',
  count: (ok: number, all: number) => `${ok} of ${all} match`,
  done: 'Your build does what the preview does.',
  same: 'Matches',
  differs: 'Differs',
} as const;

export default function BehaviorCheck({ component, preview, build, behaviors }: BehaviorCheckProps) {
  const headingId = useId();
  const frames = [
    { side: 'preview' as const, src: preview },
    { side: 'build' as const, src: build },
  ];
  const { run, frameRef, play } = useKeyReplay(frames);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Map<string, { preview: KeysResult | null; build: KeysResult | null }>>(new Map());

  const go = async () => {
    setBusy(true);
    setRows(new Map());
    for (const b of behaviors) {
      const keys = replaySequence(behaviors, b.id);
      const r = await play(keys);
      setRows((m) => new Map(m).set(b.id, { preview: r.get('preview') ?? null, build: r.get('build') ?? null }));
    }
    setBusy(false);
  };
  const ok = behaviors.filter((b) => {
    const r = rows.get(b.id);
    return r && sameResult(r.preview, r.build);
  }).length;
  const done = rows.size === behaviors.length && ok === behaviors.length && behaviors.length > 0;
  return (
    <section className="bb-section bb-check" aria-labelledby={headingId}>
      <h3 className="t-ui bb-h" id={headingId}>
        {CHECK_WORDS.title}
      </h3>
      <p className="t-ui">
        <Button variant="secondary" size="sm" loading={busy} disabled={busy} onClick={() => void go()}>
          {busy ? CHECK_WORDS.playing : CHECK_WORDS.play}
        </Button>{' '}
        {rows.size > 0 && <span role="status">{done ? CHECK_WORDS.done : CHECK_WORDS.count(ok, behaviors.length)}</span>}
      </p>
      <div className="rq-replay-sides">
        {frames.map((f) => (
          <figure key={f.side} className="rq-replay-side">
            <figcaption className="t-ui rq-replay-label">{SIDE_LABEL[f.side]}</figcaption>
            <iframe key={`${f.side}-${run}`} ref={frameRef(f.side)} src={f.src} title={`${component}, ${SIDE_LABEL[f.side]}`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" className="rq-replay-frame" />
          </figure>
        ))}
      </div>
      <ul className="t-ui bb-check-rows">
        {behaviors.map((b) => {
          const r = rows.get(b.id);
          const same = r ? sameResult(r.preview, r.build) : null;
          return (
            <li key={b.id} className="bb-check-row">
              <span className="bb-check-text">{b.text}</span>
              {same === true && (
                <span className="bb-check-ok">
                  <Icon icon={Check} size="sm" /> {CHECK_WORDS.same}
                </span>
              )}
              {same === false && (
                <>
                  <Badge tone="warning">{CHECK_WORDS.differs}</Badge>
                  <span className="t-muted bb-check-why">
                    {SIDE_LABEL.preview}: {resultLine(r!.preview)} {SIDE_LABEL.build}: {resultLine(r!.build)}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
