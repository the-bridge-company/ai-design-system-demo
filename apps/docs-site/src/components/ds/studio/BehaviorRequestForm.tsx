// The behavior request form, one for both doors (phase 2 of behaviors):
//   - "Change how it behaves" in a team's Components drawer (ChangeComponent.tsx): pick one of the component's own
//     behaviors (its docs.json `behaviors`, in its own words) or "Something it does not do yet";
//   - "Suggest a change to this pattern" on a team's Library pattern page (library/PatternChange.tsx): pick one of the
//     action pattern's rules, or "Something it does not do yet".
// Then "What should it do instead?" (required) and where it gets in the way (optional). The send files one behavior
// request on the team's repository with the member's session (scripts/behavior-request-send.ts): it waits for the
// design system lead, who decides on its page. The send button lives in the caller's footer (`form={formId}`).
// Words and rules: lib/change-intent.ts.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Input, Select, Textarea } from '@bridge-ds/react';
import type { IntegrationsConfig } from '@bridge-ds/core';
import { behaviorChoices, behaviorFormCopy, behaviorFormProblems, behaviorRequest, ruleChoices } from '../../../lib/change-intent';

export type BehaviorTarget = { of: 'component'; name: string; behaviors: readonly { id: string; text: string }[] } | { of: 'pattern'; id: string; name: string; rules: readonly string[] };

export interface BehaviorRequestFormProps {
  formId: string;
  target: BehaviorTarget;
  /** "owner/name" of the team. */
  repo: string;
  integrations?: IntegrationsConfig | undefined;
  /** The page in the team's Library, written in the request for developers. */
  pageUrl?: string | undefined;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  /** Sent: the request's number. */
  onSent: (n: number) => void;
}

export default function BehaviorRequestForm({ formId, target, repo, integrations, pageUrl, busy, onBusy, onSent }: BehaviorRequestFormProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const [wanted, setWanted] = useState('');
  const [where, setWhere] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const copy = behaviorFormCopy(target.of, choice);
  const options = target.of === 'component' ? behaviorChoices(target.behaviors) : ruleChoices(target.rules);
  const key = target.of === 'component' ? target.name : target.id;

  // Another component or pattern: start empty.
  useEffect(() => {
    setChoice(null);
    setWanted('');
    setWhere('');
    setProblems([]);
    setFailed(null);
  }, [key]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = behaviorFormProblems(target.of, { choice, wanted });
    setProblems(found);
    setFailed(null);
    if (found.length || !choice) {
      requestAnimationFrame(() => boxRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const [{ sendBehaviorRequest }, session] = await Promise.all([import('../../../scripts/behavior-request-send'), import('../../../scripts/github-session')]);
    const login = session.signedInWithGitHub() ? (session.currentViewer()?.login ?? null) : null;
    onBusy(true);
    try {
      const n = await sendBehaviorRequest(repo, behaviorRequest(target, { choice, wanted, where }, login), { integrations, pageUrl });
      onBusy(false);
      onSent(n);
    } catch (err) {
      onBusy(false);
      const auth = session.ghAuthFailure(err, 'send it');
      // GitHub's own words only for someone signed in with GitHub (lib/vocabulary: designers never read them).
      const said = login && err instanceof Error && err.message ? ` GitHub said: ${err.message}` : '';
      setFailed(auth ? auth.text : `It was not sent. Your text stays here: try again in a moment.${said}`);
    }
  };

  const whichProblem = problems.includes(copy.missing.which) ? copy.missing.which : undefined;
  const wantedProblem = problems.includes(copy.missing.wanted) ? copy.missing.wanted : undefined;
  return (
    <form id={formId} ref={boxRef} className="tcm-chg-form" noValidate onSubmit={(e) => void submit(e)} aria-label={copy.heading}>
      <Select
        label={copy.which.label}
        placeholder={copy.which.placeholder}
        required
        value={choice}
        onValueChange={(v) => {
          setChoice(v);
          setProblems((p) => p.filter((x) => x !== copy.missing.which));
        }}
        options={options}
        error={whichProblem}
        aria-invalid={whichProblem ? true : undefined}
      />
      <Textarea label={copy.wanted} name="wanted" rows={3} required value={wanted} onValueChange={setWanted} error={wantedProblem} aria-invalid={wantedProblem ? true : undefined} />
      <Input label={copy.where.label} name="where" autoComplete="off" hint={copy.where.hint} value={where} onValueChange={setWhere} />
      {failed && (
        <p className="tcm-chg-error" role="alert">
          {failed}
        </p>
      )}
    </form>
  );
}
