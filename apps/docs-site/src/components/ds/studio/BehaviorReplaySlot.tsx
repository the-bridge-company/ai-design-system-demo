// The request page's "Play both" (BehaviorDecision's replay), loaded once the page knows who looks: the design lead
// who decides or the person who asked (anyone else sees nothing of it). With no preview yet, they read the line to say
// to their own Claude; while someone's Claude prepares it, the page reads again every 30 seconds (paused while the tab
// is hidden). The person who asked can change her words while the lead has not decided (board G2): the request is
// saved with them, the preview made from the old words asks to be updated ("Ask your Claude to update the preview"),
// and the next one says "Updated from your words".
import { useEffect, useState } from 'react';
import { Button, ButtonGroup, Textarea } from '@bridge-ds/react';
import type { BehaviorAsk } from '@bridge-ds/core';
import BehaviorReplay from './BehaviorReplay';
import type { PreviewPlay } from '../../../scripts/behavior-preview-data';

const POLL_MS = 30_000;

export interface BehaviorReplaySlotProps {
  number: number;
  ask: BehaviorAsk;
  viewer: 'lead' | 'requester';
  /** The person who asked, before the lead decided: saves her new words. Throws in words she can act on. */
  onSaveWords?: ((wanted: string) => Promise<void>) | null;
  /** For tests: the read. */
  load?: (fresh: boolean, ask: BehaviorAsk) => Promise<PreviewPlay | null>;
}

export const WORDS_EDIT = {
  open: 'Change your words',
  label: 'What should it do instead?',
  save: 'Save and update the preview',
  saving: 'Saving',
  cancel: 'Cancel',
  empty: 'Say what it should do, in a sentence.',
} as const;

export default function BehaviorReplaySlot({ number, ask, viewer, onSaveWords, load }: BehaviorReplaySlotProps) {
  const [play, setPlay] = useState<PreviewPlay | null>(null);
  const [round, setRound] = useState(0);
  const [editing, setEditing] = useState(false);
  const [words, setWords] = useState(ask.wanted);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Her words now: once she saved new ones, a preview made from the old ones is out of date.
  const [current, setCurrent] = useState<BehaviorAsk>(ask);
  useEffect(() => setCurrent(ask), [ask]);

  useEffect(() => {
    let live = true;
    const read = (fresh: boolean) =>
      (load ?? ((f: boolean, a: BehaviorAsk) => import('../../../scripts/behavior-preview-data').then((m) => m.behaviorPreviewPlay(number, a, { fresh: f }))))(fresh, current).then((p) => live && setPlay(p));
    void read(round > 0);
    return () => {
      live = false;
    };
  }, [number, current, round, load]);

  // Claude is preparing it: read again until it is ready or failed.
  useEffect(() => {
    if (play?.state.kind !== 'preparing') return;
    const t = window.setTimeout(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setRound((n) => n + 1);
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [play]);

  if (!play) return null;
  const save = async () => {
    if (!onSaveWords) return;
    if (!words.trim()) return setProblem(WORDS_EDIT.empty);
    setSaving(true);
    setProblem(null);
    try {
      await onSaveWords(words.trim());
      setEditing(false);
      setCurrent({ ...current, wanted: words.trim() });
      setRound((n) => n + 1);
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rq-replay-slot">
      <BehaviorReplay state={play.state} keys={play.keys} announces={play.announces} viewer={viewer} number={number} component={play.component} />
      {viewer === 'requester' && onSaveWords &&
        (editing ? (
          <div className="rq-replay-edit">
            <Textarea label={WORDS_EDIT.label} rows={3} required value={words} onValueChange={(v) => { setWords(v); setProblem(null); }} error={problem ?? undefined} />
            <ButtonGroup>
              <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={() => void save()}>
                {saving ? WORDS_EDIT.saving : WORDS_EDIT.save}
              </Button>
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => setEditing(false)}>
                {WORDS_EDIT.cancel}
              </Button>
            </ButtonGroup>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {WORDS_EDIT.open}
          </Button>
        ))}
    </div>
  );
}
