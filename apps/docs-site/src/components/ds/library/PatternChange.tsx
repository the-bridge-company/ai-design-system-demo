// "Suggest a change to this pattern" on a team's Library action pattern page (LibraryTeamPatterns.tsx), for a member
// who can write (TeamData.canEdit, the same gate as Edit on a component page); readers never see it. One DS Dialog with
// the behavior request form (studio/BehaviorRequestForm.tsx): which rule, or something it does not do yet, and what it
// should do instead. It files the same behavior request as "Change how it behaves" in Studio's Components drawer, so
// the design system lead decides on it in the same place. Once sent, one line says so, with the request in Studio.
import { useEffect, useId, useRef, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button, ButtonGroup, Dialog, DialogClose, DialogContent, Link } from '@bridge-ds/react';
import type { ActionPattern, IntegrationsConfig } from '@bridge-ds/core';
import BehaviorRequestForm from '../studio/BehaviorRequestForm';
import { behaviorFormCopy, behaviorSentLines } from '../../../lib/change-intent';
import { setLibraryTeam } from '../../../scripts/repo-context';

export interface PatternChangeProps {
  pattern: Pick<ActionPattern, 'id' | 'name' | 'rules'>;
  owner: string;
  repo: string;
  integrations?: IntegrationsConfig | undefined;
  /** The pattern's page in the team's Library, written in the request for developers. */
  pageUrl?: string | undefined;
  /** A request's page in the team's Studio, by number. */
  requestHref: (n: number) => string;
}

export default function PatternChange({ pattern, owner, repo, integrations, pageUrl, requestHref }: PatternChangeProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const copy = behaviorFormCopy('pattern', null);

  // The send goes through the member's session on this team (an email member through Bridge, a GitHub member with
  // their token), as Edit on a component page does (TeamEditMode.tsx).
  useEffect(() => {
    setLibraryTeam({ owner, repo });
    return () => setLibraryTeam(null);
  }, [owner, repo]);

  useEffect(() => {
    if (sent === null) return;
    const t = window.setTimeout(() => doneRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [sent]);

  if (sent !== null) {
    const s = behaviorSentLines(sent);
    return (
      <p className="pt-change-done" role="status" tabIndex={-1} ref={doneRef}>
        <strong>{s.lead}</strong> {s.next} <Link href={requestHref(sent)}>{s.link}</Link>
      </p>
    );
  }
  return (
    <>
      <Button variant="secondary" size="sm" iconStart={MessageSquarePlus} onClick={() => setOpen(true)}>
        {copy.heading}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && !busy && setOpen(false)}>
        <DialogContent
          size="md"
          title={copy.heading}
          description="The design system lead decides. Once it is the default, your developers build it."
          footer={
            <ButtonGroup align="end">
              <DialogClose render={<Button variant="secondary" disabled={busy} />}>Cancel</DialogClose>
              <Button variant="primary" type="submit" form={formId} loading={busy} data-demo-write="send a behavior request">
                {busy ? copy.busy : copy.submit}
              </Button>
            </ButtonGroup>
          }
        >
          <BehaviorRequestForm
            formId={formId}
            target={{ of: 'pattern', id: pattern.id, name: pattern.name, rules: pattern.rules }}
            repo={`${owner}/${repo}`}
            integrations={integrations}
            pageUrl={pageUrl}
            busy={busy}
            onBusy={setBusy}
            onSent={(n) => {
              setOpen(false);
              setSent(n);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
