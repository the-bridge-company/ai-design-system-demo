// The stage of an action pattern (patterns/<id>.pattern.json `stage`): rows, each with the action, performed with the
// real DS components the rule names. It cannot be undone: the AlertDialog asks first, the row goes on confirm. It can
// be undone: the row goes at once and a Toast says so, with Undo that brings it back in its place. "Start again"
// brings every row back. Nothing leaves the page: the rows are the stage's own.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, Button, ToastProvider, useToast } from '@bridge-ds/react';
import { stageLine, type ActionPattern } from '@bridge-ds/core';

const ICONS = { trash: Trash2 } as const;

/** The line over the rows: what to do, and what the rule makes happen. */
export const stageNote = (p: Pick<ActionPattern, 'reversible' | 'stage'>): string =>
  p.reversible ? `Try ${p.stage!.action} on a row: it goes at once, with Undo in the message that appears.` : `Try ${p.stage!.action} on a row: it asks first, since it cannot be undone.`;

function Rows({ pattern }: { pattern: ActionPattern }) {
  const stage = pattern.stage!;
  const [left, setLeft] = useState<string[]>(stage.items);
  const [asking, setAsking] = useState<string | null>(null);
  const toast = useToast();
  // A row comes back in its place: the stage's order, not the end of the list.
  const restore = (item: string) => setLeft((xs) => stage.items.filter((x) => x === item || xs.includes(x)));
  const remove = (item: string) => setLeft((xs) => xs.filter((x) => x !== item));

  const act = (item: string) => {
    if (!pattern.reversible) return setAsking(item);
    remove(item);
    const id = toast.add({
      title: stageLine(stage.done!, item),
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          restore(item);
          toast.close(id);
          if (stage.undone) toast.add({ title: stageLine(stage.undone, item), tone: 'neutral' });
        },
      },
    });
  };
  const icon = stage.icon ? ICONS[stage.icon] : undefined;

  return (
    <>
      {left.length > 0 && (
        <ul className="pt-rows">
          {left.map((item) => (
            <li key={item} className="pt-row">
              <span className="pt-row-name">{item}</span>
              <Button variant="secondary" size="sm" iconStart={icon} onClick={() => act(item)} aria-label={`${stage.action}: ${item}`}>
                {stage.action}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {left.length < stage.items.length && (
        <div className="pt-again">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.close();
              setLeft(stage.items);
            }}
          >
            Start again
          </Button>
        </div>
      )}
      {stage.confirm && (
        <AlertDialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
          <AlertDialogContent
            title={stageLine(stage.confirm.title, asking ?? '')}
            description={stage.confirm.text}
            confirmLabel={stage.confirm.confirmLabel}
            onConfirm={() => {
              if (asking) remove(asking);
              setAsking(null);
            }}
          />
        </AlertDialog>
      )}
    </>
  );
}

export default function ActionStage({ pattern }: { pattern: ActionPattern }) {
  if (!pattern.stage) return null;
  return (
    <div className="bh-stage pt-stage" role="region" aria-label={`Try ${pattern.name}`}>
      <p className="bh-stage-note">{stageNote(pattern)}</p>
      <div className="bh-stage-frame pt-stage-frame">
        <ToastProvider>
          <Rows pattern={pattern} />
        </ToastProvider>
      </div>
    </div>
  );
}
