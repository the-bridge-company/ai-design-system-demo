// The stage of an action pattern (patterns/<id>.pattern.json `stage`): rows, each with the action, performed with the
// real DS components the rule names. It cannot be undone: the AlertDialog asks first, the row goes on confirm; a row
// whose impact is high (`typeName`) asks the person to type its name first (AlertDialog confirmText). It can
// be undone: the row goes at once and a Toast says so, with Undo that brings it back in its place. "Start again"
// brings every row back. Nothing leaves the page: the rows are the stage's own.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, Button, ToastProvider, useToast } from '@bridge-ds/react';
import { stageLine, type ActionPattern, type PatternStage, type StageQuestion } from '@bridge-ds/core';

const ICONS = { trash: Trash2 } as const;

/** "A", "A and B", "A, B and C". */
const listOf = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The line over the rows: what to do, and what the rule makes happen. */
export const stageNote = (p: Pick<ActionPattern, 'reversible' | 'stage'>): string => {
  const s = p.stage!;
  if (p.reversible) return `Press ${s.action} on a row: it goes at once, with Undo in the message that appears.`;
  const typed = s.typeName?.items ?? [];
  const asks = `Press ${s.action} on a row: it asks first, since it cannot be undone.`;
  return typed.length ? `${asks} ${listOf(typed)} also asks for ${typed.length > 1 ? 'their names' : 'its name'}: other people lose ${typed.length > 1 ? 'them' : 'it'}.` : asks;
};

/** The question a row asks: its own when its impact is high (the name typed to confirm), else the plain one. */
export function stageQuestion(stage: PatternStage, item: string): (StageQuestion & { typeName: boolean }) | null {
  if (stage.typeName?.items.includes(item)) return { ...stage.typeName, typeName: true };
  return stage.confirm ? { ...stage.confirm, typeName: false } : null;
}

function Rows({ pattern }: { pattern: ActionPattern }) {
  const stage = pattern.stage!;
  const [left, setLeft] = useState<string[]>(stage.items);
  const [asking, setAsking] = useState<string | null>(null);
  // The row last asked about: the dialog keeps its words while it closes.
  const [asked, setAsked] = useState<string | null>(null);
  const toast = useToast();
  // A row comes back in its place: the stage's order, not the end of the list.
  const restore = (item: string) => setLeft((xs) => stage.items.filter((x) => x === item || xs.includes(x)));
  const remove = (item: string) => setLeft((xs) => xs.filter((x) => x !== item));

  const act = (item: string) => {
    if (!pattern.reversible) {
      setAsked(item);
      return setAsking(item);
    }
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
  const question = asked !== null ? stageQuestion(stage, asked) : null;

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
      {question && asked !== null && (
        <AlertDialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
          <AlertDialogContent
            title={stageLine(question.title, asked)}
            description={stageLine(question.text, asked)}
            confirmLabel={stageLine(question.confirmLabel, asked)}
            confirmText={question.typeName ? asked : undefined}
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
