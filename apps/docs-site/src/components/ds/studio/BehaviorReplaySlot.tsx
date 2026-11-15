// The request page's "Play both" (BehaviorDecision's replay), loaded once the page knows who looks: the design lead
// who decides or the person who asked (anyone else sees nothing of it). While Claude prepares the preview, it reads
// again every 30 seconds (paused while the tab is hidden). The person who asked can change her words while the lead
// has not decided (board G2): the request is saved with them, the team's workflow makes the preview again, and the
// next preview says "Updated from your words".
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
  settingsHref: string;
  /** The person who asked, before the lead decided: saves her new words. Throws in words she can act on. */
  onSaveWords?: ((wanted: string) => Promise<void>) | null;
  /** For tests: the read. */
  load?: (fresh: boolean) => Promise<PreviewPlay | null>;
}

export const WORDS_EDIT = {
  open: 'Change your words',
  label: 'What should it do instead?',
  save: 'Save and update the preview',
  saving: 'Saving',
  cancel: 'Cancel',
  empty: 'Say what it should do, in a sentence.',
} as const;

export default function BehaviorReplaySlot({ number, ask, viewer, settingsHref, onSaveWords, load }: BehaviorReplaySlotProps) {
  const [play, setPlay] = useState<PreviewPlay | null>(null);
  const [round, setRound] = useState(0);
  const [editing, setEditing] = useState(false);
  const [words, setWords] = useState(ask.wanted);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Saved new words: what the workflow said before them is the old preview, so it reads as preparing until it answers.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const read = (fresh: boolean) =>
      (load ?? ((f: boolean) => import('../../../scripts/behavior-preview-data').then((m) => m.behaviorPreviewPlay(number, ask, { fresh: f }))))(fresh).then((p) => {
        if (!live) return;
        const old = savedAt !== null && p && (!p.preview?.at || Date.parse(p.preview.at) < savedAt);
        setPlay(p && old ? { ...p, state: { kind: 'preparing' } } : p);
      });
    void read(round > 0);
    return () => {
      live = false;
    };
  }, [number, ask, round, load, savedAt]);

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
      setSavedAt(Date.now());
      setRound((n) => n + 1);
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rq-replay-slot">
      <BehaviorReplay state={play.state} keys={play.keys} announces={play.announces} viewer={viewer} settingsHref={settingsHref} component={play.component} />
      {viewer === 'requester' && onSaveWords && play.state.kind !== 'off' &&
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
