// Studio > Patterns, the two drawers (board 2B and 3A to 3E, docs: StudioPatterns.tsx):
//   - PatternRowDrawer: a row opened. What the pattern is for (the drawer's description), the components that do it,
//     its Library page. A member who can write gets one way to suggest: "Ask another component to do this" (an
//     interaction) or "Suggest a change to this pattern" (an action, the PatternChange form), and for an interaction
//     "Suggest a change" (the shared behavior as one component does it). The lead who decides gets the changes that
//     wait on this pattern in an Accordion, the first open, each with the request page's decision (BehaviorDecision,
//     Play both for a component behavior); her own suggest buttons step down to secondary. Once sent, one line says so
//     with "Follow your request".
//   - SuggestPatternDrawer: "Suggest a pattern" from the header (or the empty state). What she wants to share, as two
//     ChoiceCards, then the matching form under them: a new action (name, purpose, rules, at least two places) or a
//     behavior one component has, asked of another component. The text is kept in this browser until it is sent.
// Every send files the existing `request: behavior` (BehaviorRequestForm.tsx). Nothing here is a pattern: a proposal
// shows only in the lead's "Asked, not patterns yet" line, until a developer merges its file.
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { Accordion, AccordionItem, Alert, Button, ButtonGroup, ChoiceCard, ChoiceCardGroup, Divider, Drawer, DrawerContent, Link, Tag } from '@bridge-ds/react';
import type { IntegrationsConfig } from '@bridge-ds/core';
import BehaviorRequestForm from './BehaviorRequestForm';
import BehaviorDecision from './BehaviorDecision';
import { askerFirst } from '../../../lib/requests-view';
import { behaviorFormCopy, behaviorSentLines, interactionChangeCopy, isPatternSuggestKind, patternDrawerCopy, SUGGEST_KINDS, suggestPatternCopy, adoptFormCopy, type BehaviorHolder, type PatternSuggestKind } from '../../../lib/change-intent';
import type { PatternRequest, StudioPatternGroup, StudioPatternRow } from '../../../lib/studio-patterns';
import { studioHref } from '../../../lib/team-path';

const BehaviorReplaySlot = lazy(() => import('./BehaviorReplaySlot'));

/** What the page knows to let a member suggest: the team, its components, and whether this viewer may write. */
export interface PatternSuggestContext {
  /** "owner/name" of the team. */
  repo: string;
  /** The viewer may change this team's library (TeamData.canEdit, the gate of PatternChange): the suggest buttons. */
  canEdit: boolean;
  integrations?: IntegrationsConfig | undefined;
  /** The team's components with their behaviors (docs.json), for "Ask another component to do this". */
  components: BehaviorHolder[];
  /** A pattern's page in the team's Library, absolute, written in the request for developers. */
  pageUrl: (id: string) => string;
}

/** Who decides on this page, and through what: a GitHub owner with their token, or a design lead by email. */
export type Decider = 'github' | 'email' | null;

/** A request's page in Studio, where the person who asked follows it. */
export const requestHref = (n: number): string => studioHref(`explorations/?request=${n}`);

/** Where this browser keeps the "Suggest a pattern" text, per team (lib/demo.ts keeps the sample team's apart). */
export const suggestDraftKey = (repo: string, part: 'kind' | 'action' | 'adopt'): string => `bridge.pattern-draft.${repo.toLowerCase()}.${part}`;

/** "Request #42 sent to Dana. Dana decides. ..." with the way to follow it. */
function SentLine({ n, lead }: { n: number; lead: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The send button left with the form: the focus goes to what was sent, once the drawer settled its own focus.
    const t = window.setTimeout(() => ref.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [n]);
  const s = behaviorSentLines(n, lead);
  return (
    <div ref={ref} tabIndex={-1} className="spt-sent">
      <Alert
        tone="success"
        actions={
          <Link href={requestHref(n)} variant="standalone">
            {s.link}
          </Link>
        }
      >
        {s.lead} {s.next}
      </Alert>
    </div>
  );
}

type RowMode = 'view' | 'adopt' | 'change';

export interface PatternRowDrawerProps {
  row: StudioPatternRow | null;
  kind: StudioPatternGroup['kind'] | null;
  /** Null for a viewer who cannot suggest (the drawer then only shows the pattern and, for the lead, what waits). */
  suggest: PatternSuggestContext | null;
  lead: string | null;
  /** The changes on this pattern that wait for the viewer's decision (the lead only), oldest first. */
  waiting: readonly PatternRequest[];
  decider: Decider;
  /** A request was decided here: the page drops it from what waits. */
  onDecided: (n: number) => void;
  onClose: () => void;
}

export function PatternRowDrawer({ row, kind, suggest, lead, waiting, decider, onDecided, onClose }: PatternRowDrawerProps) {
  const formId = useId();
  const [mode, setMode] = useState<RowMode>('view');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  // Another row: start on the pattern.
  useEffect(() => {
    setMode('view');
    setSent(null);
    setBusy(false);
  }, [row?.id]);
  const c = patternDrawerCopy(lead);
  const interaction = kind === 'interaction';
  const canSuggest = Boolean(suggest?.canEdit);
  const deciding = Boolean(decider) && waiting.length > 0;
  const send = `Send to ${lead ?? 'the design system lead'}`;
  const back = () => {
    setMode('view');
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const footer =
    !row ? null : sent !== null ? (
      <ButtonGroup align="end">
        <Button variant="secondary" onClick={onClose}>
          {c.close}
        </Button>
      </ButtonGroup>
    ) : mode !== 'view' ? (
      <ButtonGroup align="end">
        <Button variant="ghost" disabled={busy} onClick={back}>
          {c.back}
        </Button>
        <Button variant="primary" type="submit" form={formId} loading={busy} data-demo-write="send a behavior request">
          {busy ? 'Sending' : send}
        </Button>
      </ButtonGroup>
    ) : canSuggest ? (
      // One primary action per view: the lead's is her decision, so her own suggest buttons are secondary.
      <ButtonGroup align="end">
        {interaction ? (
          <>
            <Button variant="secondary" onClick={() => setMode('change')}>
              {interactionChangeCopy(lead).open}
            </Button>
            <Button ref={openerRef} variant={deciding ? 'secondary' : 'primary'} onClick={() => setMode('adopt')}>
              {adoptFormCopy(true, lead).heading}
            </Button>
          </>
        ) : (
          <Button ref={openerRef} variant={deciding ? 'secondary' : 'primary'} onClick={() => setMode('change')}>
            {behaviorFormCopy('pattern', null, lead).heading}
          </Button>
        )}
      </ButtonGroup>
    ) : null;

  const formHeading = mode === 'adopt' ? adoptFormCopy(true, lead).heading : interaction ? interactionChangeCopy(lead).heading : behaviorFormCopy('pattern', null, lead).heading;
  const pageUrl = row && suggest ? suggest.pageUrl(row.id) : undefined;
  const components = (
    <div className="spt-d-uses">
      <h3 className="spt-d-h">{c.components}</h3>
      <div className="spt-d-tags">
        {(row?.components ?? []).map((name) => (
          <Tag key={name} size="sm">
            {name}
          </Tag>
        ))}
      </div>
    </div>
  );

  return (
    <Drawer open={Boolean(row)} onOpenChange={(o) => !o && !busy && onClose()}>
      {row && (
        <DrawerContent size={mode === 'view' && !deciding ? 'md' : 'lg'} title={row.name} description={row.purpose} closeLabel="Close" footer={footer}>
          <div className="spt-d">
            {sent !== null && <SentLine n={sent} lead={lead} />}
            {mode === 'view' && sent === null && deciding && decider && (
              <section className="spt-d-wait" aria-labelledby={`${formId}-wait`}>
                <h3 className="spt-d-h" id={`${formId}-wait`}>
                  {c.waiting(waiting.length)}
                </h3>
                <Accordion defaultValue={[String(waiting[0]!.number)]} headingLevel={4}>
                  {waiting.map((q) => (
                    <AccordionItem key={q.number} value={String(q.number)} title={q.title} meta={`${q.asker ?? 'Someone'} · #${q.number}`}>
                      <WaitingRequest q={q} repo={suggest?.repo ?? ''} decider={decider} onDecided={() => onDecided(q.number)} />
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
            {components}
            {mode === 'view' ? (
              <p className="spt-d-link">
                <Link href={row.href} variant="standalone">
                  {c.library}
                </Link>
              </p>
            ) : (
              suggest && (
                <>
                  <Divider spacing="none" />
                  <section className="spt-d-form" aria-labelledby={`${formId}-h`}>
                    <h3 className="spt-d-h" id={`${formId}-h`}>
                      {formHeading}
                    </h3>
                    <BehaviorRequestForm
                      formId={formId}
                      target={
                        mode === 'adopt'
                          ? { of: 'adopt', components: suggest.components, behavior: row.id, wanted: row.purpose }
                          : interaction
                            ? { of: 'interaction', id: row.id, uses: row.uses ?? [] }
                            : { of: 'pattern', id: row.id, name: row.name, rules: row.rules ?? [] }
                      }
                      repo={suggest.repo}
                      integrations={suggest.integrations}
                      pageUrl={pageUrl}
                      busy={busy}
                      onBusy={setBusy}
                      onSent={(n) => {
                        setMode('view');
                        setSent(n);
                      }}
                    />
                    {mode === 'change' && <p className="spt-after">{c.after}</p>}
                  </section>
                </>
              )
            )}
          </div>
        </DrawerContent>
      )}
    </Drawer>
  );
}

/** One change that waits for the lead, as on its request page: what is asked, Play both, and the decision. */
function WaitingRequest({ q, repo, decider, onDecided }: { q: PatternRequest; repo: string; decider: Exclude<Decider, null>; onDecided: () => void }) {
  const [actions, setActions] = useState<import('./BehaviorDecision').BehaviorDecisionActions | null>(null);
  useEffect(() => {
    let live = true;
    void import('../../../scripts/pattern-decide').then(({ patternDecisionActions }) => live && setActions(patternDecisionActions(repo, q, decider, onDecided)));
    return () => {
      live = false;
    };
    // Once per request and decider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, q.number, decider]);
  if (!q.ask) return null;
  const asker = q.asker ?? 'Someone';
  return (
    <div className="spt-d-req">
      <BehaviorDecision
        heading={false}
        decisionFirst
        today={q.ask.today}
        wanted={q.ask.wanted}
        where={q.ask.where}
        asker={asker}
        askerFirst={askerFirst(asker)}
        actions={actions}
        // Play both: keys on a component, so only for a component behavior (an action has no replay).
        replay={
          q.ask.of === 'component' ? (
            <Suspense fallback={null}>
              <BehaviorReplaySlot number={q.number} ask={q.ask} viewer="lead" />
            </Suspense>
          ) : null
        }
      />
      <p className="spt-d-link">
        <Link href={requestHref(q.number)} variant="standalone">
          Open the request
        </Link>
      </p>
    </div>
  );
}

export interface SuggestPatternDrawerProps {
  open: boolean;
  suggest: PatternSuggestContext;
  lead: string | null;
  /** The page's rows (a new action's name must not be one) and the interaction ids (their drawer asks about them). */
  rows: readonly StudioPatternRow[];
  interactions: ReadonlySet<string>;
  /** "Suggest a change to it instead": the drawer of the pattern a name already is. */
  onDuplicate: (id: string) => void;
  onClose: () => void;
}

const readKind = (repo: string): PatternSuggestKind | null => {
  try {
    const k = localStorage.getItem(suggestDraftKey(repo, 'kind'));
    return isPatternSuggestKind(k) ? k : null;
  } catch {
    return null;
  }
};

export function SuggestPatternDrawer({ open, suggest, lead, rows, interactions, onDuplicate, onClose }: SuggestPatternDrawerProps) {
  const formId = useId();
  const [kind, setKind] = useState<PatternSuggestKind | null>(() => readKind(suggest.repo));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const c = suggestPatternCopy(lead);
  // Opened again: a fresh start after a send; the kept draft comes back otherwise.
  useEffect(() => {
    if (!open) return;
    setSent(null);
    setKind(readKind(suggest.repo));
  }, [open, suggest.repo]);
  const pick = (v: string) => {
    if (!isPatternSuggestKind(v)) return;
    setKind(v);
    try {
      localStorage.setItem(suggestDraftKey(suggest.repo, 'kind'), v);
    } catch {
      /* storage blocked: the pick stays on screen only */
    }
  };
  const footer =
    sent !== null ? (
      <ButtonGroup align="end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ButtonGroup>
    ) : (
      <ButtonGroup align="end">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        {kind && (
          <Button variant="primary" type="submit" form={formId} loading={busy} data-demo-write="suggest a pattern">
            {busy ? c.busy : c.submit}
          </Button>
        )}
      </ButtonGroup>
    );
  return (
    <Drawer open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      {open && (
        <DrawerContent size="lg" title={c.title} description={c.description} closeLabel="Close" footer={footer}>
          <div className="spt-d">
            {sent !== null ? (
              <SentLine n={sent} lead={lead} />
            ) : (
              <>
                <ChoiceCardGroup label={c.kind} value={kind ?? undefined} onValueChange={pick} orientation="horizontal" name={`${formId}-kind`}>
                  {SUGGEST_KINDS.map((k) => (
                    <ChoiceCard key={k.value} value={k.value} title={k.title} description={k.line} />
                  ))}
                </ChoiceCardGroup>
                {kind && <Divider spacing="none" />}
                {kind === 'action' && (
                  <BehaviorRequestForm
                    formId={formId}
                    target={{ of: 'pattern-new', patterns: rows, onDuplicate }}
                    repo={suggest.repo}
                    integrations={suggest.integrations}
                    busy={busy}
                    onBusy={setBusy}
                    onSent={setSent}
                    draftKey={suggestDraftKey(suggest.repo, 'action')}
                  />
                )}
                {kind === 'interaction' && (
                  <BehaviorRequestForm
                    formId={formId}
                    target={{ of: 'adopt', components: suggest.components, interactions }}
                    repo={suggest.repo}
                    integrations={suggest.integrations}
                    busy={busy}
                    onBusy={setBusy}
                    onSent={setSent}
                    draftKey={suggestDraftKey(suggest.repo, 'adopt')}
                  />
                )}
              </>
            )}
          </div>
        </DrawerContent>
      )}
    </Drawer>
  );
}
