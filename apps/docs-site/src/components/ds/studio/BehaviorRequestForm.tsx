// The behavior request form, one for both doors (phase 2 of behaviors):
//   - "Change how it behaves" in a team's Components drawer (ChangeComponent.tsx): pick one of the component's own
//     behaviors (its docs.json `behaviors`, in its own words) or "Something it does not do yet";
//   - "Suggest a change to this pattern" on a team's Library pattern page (library/PatternChange.tsx): pick one of the
//     action pattern's rules, or "Something it does not do yet".
// Then "What should it do instead?" (required) and where it gets in the way (optional). The send files one behavior
// request on the team's repository with the member's session (scripts/behavior-request-send.ts): it waits for the
// design system lead, who decides on its page. The send button lives in the caller's footer (`form={formId}`).
//   - "Suggest a pattern" on Studio > Patterns (PatternSuggest.tsx), two more targets: `pattern-new`, a new action
//     (name, what it is for, rules, at least two places where people do it today), and `adopt`, a behavior one
//     component has, asked of a component that does not do it yet (also "Ask another component to do this" in a
//     pattern's drawer, with the behavior preset). Their text is kept in this browser (`draftKey`) until it is sent,
//     so the sample team's Send (the sample-team dialog) never loses it.
// Words and rules: lib/change-intent.ts.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { soleLeadName } from '../../../lib/design-lead';
import { Alert, Button, IconButton, Input, Select, Textarea, VisuallyHidden } from '@bridge-ds/react';
import type { ComponentChangeRequest, IntegrationsConfig } from '@bridge-ds/core';
import {
  adopterChoices,
  adoptFormCopy,
  adoptProblems,
  adoptRequest,
  behaviorChoices,
  behaviorFormCopy,
  behaviorFormProblems,
  behaviorRequest,
  EMPTY_NEW_PATTERN,
  EMPTY_PLACE,
  NEW_PATTERN_COPY,
  newPatternProblems,
  newPatternRequest,
  ruleChoices,
  sharedBehaviorChoices,
  interactionChangeCopy,
  type AdoptDraft,
  type BehaviorHolder,
  type NewPatternDraft,
} from '../../../lib/change-intent';

const leads = new Map<string, Promise<string | null>>();

/**
 * The team's one design lead by first name, for "Send to Dana" and "Request #N sent to Dana." (lib/design-lead
 * soleLeadName, from the team's people read once per page and team), else null: the words say "the design system lead".
 */
export function leadNameOf(repo: string): Promise<string | null> {
  if (!leads.has(repo))
    leads.set(
      repo,
      Promise.all([import('../../../scripts/contribute-session'), import('../../../scripts/github-session')])
        .then(([c, g]) => c.contributeTeam(repo, g.currentContributor() ? null : g.getToken()))
        .then((t) => soleLeadName(t.members))
        .catch(() => null),
    );
  return leads.get(repo)!;
}

/** leadNameOf as React state: null until it is read, and when there is none. */
export function useLeadName(repo: string): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void leadNameOf(repo).then((n) => live && setName(n));
    return () => {
      live = false;
    };
  }, [repo]);
  return name;
}

export type BehaviorTarget =
  | { of: 'component'; name: string; behaviors: readonly { id: string; text: string }[] }
  | { of: 'pattern'; id: string; name: string; rules: readonly string[] }
  /** A new action: `patterns` are the page's rows (a name that is one already is refused, with a way to it). */
  | { of: 'pattern-new'; patterns: readonly { id: string; name: string }[]; onDuplicate?: ((id: string) => void) | undefined }
  /**
   * A behavior asked of another component: `components` the team's, with their behaviors (null while they are read);
   * `behavior` preset in a pattern's drawer (the row's id), else picked; `interactions` the interaction rows' ids
   * (their own drawer asks about them); `wanted` what "What should it do?" starts with.
   */
  | { of: 'adopt'; components: readonly BehaviorHolder[] | null; behavior?: string | undefined; interactions?: ReadonlySet<string> | undefined; wanted?: string | undefined }
  /** A change to a shared behavior (an interaction's id), as one of the components that do it says it. */
  | { of: 'interaction'; id: string; uses: readonly { component: string; text: string }[] };

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
  /** Where this browser keeps the text until it is sent (`pattern-new` and `adopt`); unset, nothing is kept. */
  draftKey?: string | undefined;
}

/**
 * Sends a request with the viewer's session; the number, or the sentence the form shows. GitHub's own words only for
 * someone signed in with GitHub (lib/vocabulary: designers never read them).
 */
async function sendRequest(repo: string, make: (login: string | null) => ComponentChangeRequest, opts: { integrations?: IntegrationsConfig | undefined; pageUrl?: string | undefined }): Promise<{ n: number } | { failed: string }> {
  const [{ sendBehaviorRequest }, session] = await Promise.all([import('../../../scripts/behavior-request-send'), import('../../../scripts/github-session')]);
  const login = session.signedInWithGitHub() ? (session.currentViewer()?.login ?? null) : null;
  try {
    return { n: await sendBehaviorRequest(repo, make(login), opts) };
  } catch (err) {
    const auth = session.ghAuthFailure(err, 'send it');
    const said = login && err instanceof Error && err.message ? ` GitHub said: ${err.message}` : '';
    return { failed: auth ? auth.text : `It was not sent. Your text stays here: try again in a moment.${said}` };
  }
}

/** Form state kept in this browser under `key` (read once, written on every change); plain state without a key. */
function useKeptState<T>(key: string | undefined, initial: T): [T, (next: T | ((v: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (!key) return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...(JSON.parse(raw) as T) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked: the text stays on screen only */
    }
  }, [key, value]);
  const clear = () => {
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      /* nothing kept */
    }
  };
  return [value, setValue, clear];
}

/** The line that says why it was not sent. */
const Failed = ({ text }: { text: string | null }) =>
  text ? (
    <p className="tcm-chg-error" role="alert">
      {text}
    </p>
  ) : null;

const focusFirstInvalid = (box: HTMLElement | null) => requestAnimationFrame(() => box?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

export default function BehaviorRequestForm(props: BehaviorRequestFormProps) {
  const { target } = props;
  if (target.of === 'pattern-new') return <NewPatternForm {...props} target={target} />;
  if (target.of === 'adopt') return <AdoptForm {...props} target={target} />;
  if (target.of === 'interaction') return <InteractionChangeForm {...props} target={target} />;
  return <ChangeForm {...props} target={target} />;
}

/** A new action pattern: name, what it is for, its rules, and the places people do it today. */
function NewPatternForm({ formId, target, repo, integrations, pageUrl, busy, onBusy, onSent, draftKey }: BehaviorRequestFormProps & { target: Extract<BehaviorTarget, { of: 'pattern-new' }> }) {
  const [f, setF, clear] = useKeptState<NewPatternDraft>(draftKey, EMPTY_NEW_PATTERN);
  const [shown, setShown] = useState<ReturnType<typeof newPatternProblems>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const c = NEW_PATTERN_COPY;
  const set = <K extends keyof NewPatternDraft>(k: K, v: NewPatternDraft[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setShown((p) => ({ ...p, [k]: undefined, ...(k === 'name' ? { duplicate: undefined } : {}) }));
  };
  const setPlace = (i: number, k: keyof NewPatternDraft['places'][number], v: string) => {
    setF((x) => ({ ...x, places: x.places.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
    setShown((p) => ({ ...p, places: undefined }));
  };
  const dup = shown.duplicate ? target.patterns.find((p) => p.id === shown.duplicate) : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = newPatternProblems(f, target.patterns);
    setShown(found);
    setFailed(null);
    if (Object.keys(found).length) {
      focusFirstInvalid(boxRef.current);
      return;
    }
    onBusy(true);
    const out = await sendRequest(repo, (login) => newPatternRequest(f, login), { integrations, pageUrl });
    onBusy(false);
    if ('failed' in out) return setFailed(out.failed);
    clear();
    onSent(out.n);
  };

  const nameError: ReactNode = dup ? (
    <>
      {c.duplicate(dup.name)}{' '}
      {target.onDuplicate ? (
        <Button variant="link" onClick={() => target.onDuplicate?.(dup.id)}>
          {c.duplicateLink}
        </Button>
      ) : (
        c.duplicateLink
      )}
    </>
  ) : (
    shown.name
  );
  return (
    <form id={formId} ref={boxRef} className="tcm-chg-form" noValidate onSubmit={(e) => void submit(e)} aria-label="A new action">
      <Input label={c.name.label} name="name" autoComplete="off" required hint={c.name.hint} value={f.name} onValueChange={(v) => set('name', v)} error={nameError} aria-invalid={nameError ? true : undefined} />
      <Textarea label={c.purpose} name="purpose" rows={2} required value={f.purpose} onValueChange={(v) => set('purpose', v)} error={shown.purpose} aria-invalid={shown.purpose ? true : undefined} />
      <Textarea label={c.rules.label} name="rules" rows={3} required hint={c.rules.hint} value={f.rules} onValueChange={(v) => set('rules', v)} error={shown.rules} aria-invalid={shown.rules ? true : undefined} />
      <fieldset className="spt-places" aria-describedby={`${formId}-places-line`}>
        <legend className="spt-places-h">
          {c.places.title}
          <span className="spt-required" aria-hidden="true">
            *
          </span>
          <VisuallyHidden> (required)</VisuallyHidden>
        </legend>
        <p className="spt-places-line" id={`${formId}-places-line`}>
          {c.places.line}
        </p>
        <div className="spt-places-list">
          {f.places.map((p, i) => (
            <div className="spt-place" key={i} role="group" aria-label={c.place(i + 1)}>
              <div className="spt-place-head">
                <span className="spt-place-n" aria-hidden="true">
                  {c.place(i + 1)}
                </span>
                <IconButton icon={X} label={c.remove(i + 1)} size="sm" variant="ghost" onClick={() => setF((x) => ({ ...x, places: x.places.filter((_, j) => j !== i) }))} />
              </div>
              <div className="spt-place-pair">
                <Input label={c.screen.label} placeholder={c.screen.placeholder} autoComplete="off" value={p.screen} onValueChange={(v) => setPlace(i, 'screen', v)} aria-invalid={shown.places && !p.screen.trim() ? true : undefined} />
                <Input label={c.label.label} placeholder={c.label.placeholder} autoComplete="off" value={p.label} onValueChange={(v) => setPlace(i, 'label', v)} aria-invalid={shown.places && !p.label.trim() ? true : undefined} />
              </div>
              <Input label={c.link.label} placeholder={c.link.placeholder} autoComplete="off" value={p.link} onValueChange={(v) => setPlace(i, 'link', v)} />
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" iconStart={Plus} onClick={() => setF((x) => ({ ...x, places: [...x.places, EMPTY_PLACE] }))}>
              {c.add}
            </Button>
          </div>
          {shown.places && <Alert tone="danger">{shown.places}</Alert>}
        </div>
      </fieldset>
      <Failed text={failed} />
    </form>
  );
}

/** A behavior one component has, asked of a component that does not do it yet. */
function AdoptForm({ formId, target, repo, integrations, pageUrl, busy, onBusy, onSent, draftKey }: BehaviorRequestFormProps & { target: Extract<BehaviorTarget, { of: 'adopt' }> }) {
  const preset = target.behavior ?? null;
  const [f, setF, clear] = useKeptState<AdoptDraft>(draftKey, { behavior: preset, component: null, wanted: target.wanted ?? '', where: '' });
  const [shown, setShown] = useState<ReturnType<typeof adoptProblems>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const lead = useLeadName(repo);
  const c = adoptFormCopy(Boolean(preset), lead);
  const behavior = preset ?? f.behavior;
  const loading = target.components === null;
  const behaviors = loading ? [] : sharedBehaviorChoices(target.components ?? [], target.interactions);
  const adopters = loading ? [] : adopterChoices(target.components ?? [], behavior);
  // A component picked for another behavior that does it already: picked again.
  const component = f.component && adopters.some((a) => a.value === f.component) ? f.component : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const draft = { ...f, behavior, component };
    const found = adoptProblems(draft);
    setShown(found);
    setFailed(null);
    if (Object.keys(found).length || !draft.behavior || !draft.component) {
      focusFirstInvalid(boxRef.current);
      return;
    }
    const ready = { ...draft, behavior: draft.behavior, component: draft.component };
    onBusy(true);
    const out = await sendRequest(repo, (login) => adoptRequest(ready, login), { integrations, pageUrl });
    onBusy(false);
    if ('failed' in out) return setFailed(out.failed);
    clear();
    onSent(out.n);
  };

  return (
    <form id={formId} ref={boxRef} className="tcm-chg-form" noValidate onSubmit={(e) => void submit(e)} aria-label={c.heading}>
      {!preset && (
        <Select
          label={c.behavior.label}
          hint={!loading && !behaviors.length ? c.noBehavior : c.behavior.hint}
          placeholder={loading ? c.loading : c.behavior.placeholder}
          disabled={loading || !behaviors.length}
          required
          value={f.behavior}
          onValueChange={(v) => {
            setF((x) => ({ ...x, behavior: v }));
            setShown((p) => ({ ...p, behavior: undefined }));
          }}
          options={behaviors.map((b) => ({ value: b.value, label: b.label }))}
          error={shown.behavior}
          aria-invalid={shown.behavior ? true : undefined}
        />
      )}
      <Select
        label={c.component.label}
        hint={behavior && !loading && !adopters.length ? c.none : c.component.hint}
        placeholder={loading ? c.loading : c.component.placeholder}
        disabled={loading || !behavior || !adopters.length}
        required
        value={component}
        onValueChange={(v) => {
          setF((x) => ({ ...x, component: v }));
          setShown((p) => ({ ...p, component: undefined }));
        }}
        options={adopters}
        error={shown.component}
        aria-invalid={shown.component ? true : undefined}
      />
      <Textarea
        label={c.wanted}
        name="wanted"
        rows={3}
        required
        value={f.wanted}
        onValueChange={(v) => {
          setF((x) => ({ ...x, wanted: v }));
          setShown((p) => ({ ...p, wanted: undefined }));
        }}
        error={shown.wanted}
        aria-invalid={shown.wanted ? true : undefined}
      />
      <Input label={c.where.label} name="where" autoComplete="off" hint={c.where.hint} value={f.where} onValueChange={(v) => setF((x) => ({ ...x, where: v }))} />
      <p className="spt-after">{c.after}</p>
      <Failed text={failed} />
    </form>
  );
}

/**
 * A change to a shared behavior: which component's (each says it in its own words), and what it should do instead. It
 * files that component's behavior request with the behavior picked (behaviorRequest), as its Components drawer does.
 */
function InteractionChangeForm({ formId, target, repo, integrations, pageUrl, busy, onBusy, onSent }: BehaviorRequestFormProps & { target: Extract<BehaviorTarget, { of: 'interaction' }> }) {
  const [component, setComponent] = useState<string | null>(target.uses.length === 1 ? target.uses[0]!.component : null);
  const [wanted, setWanted] = useState('');
  const [where, setWhere] = useState('');
  const [shown, setShown] = useState<{ which?: string; wanted?: string }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const lead = useLeadName(repo);
  const c = interactionChangeCopy(lead);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const use = target.uses.find((u) => u.component === component);
    const found = { ...(use ? {} : { which: c.missing.which }), ...(wanted.trim() ? {} : { wanted: c.missing.wanted }) };
    setShown(found);
    setFailed(null);
    if (!use || Object.keys(found).length) {
      focusFirstInvalid(boxRef.current);
      return;
    }
    onBusy(true);
    const out = await sendRequest(repo, (login) => behaviorRequest({ of: 'component', name: use.component, behaviors: [{ id: target.id, text: use.text }] }, { choice: target.id, wanted, where }, login), { integrations, pageUrl });
    onBusy(false);
    if ('failed' in out) setFailed(out.failed);
    else onSent(out.n);
  };

  return (
    <form id={formId} ref={boxRef} className="tcm-chg-form" noValidate onSubmit={(e) => void submit(e)} aria-label={c.heading}>
      <Select
        label={c.which.label}
        placeholder={c.which.placeholder}
        hint={c.which.hint}
        required
        value={component}
        onValueChange={(v) => {
          setComponent(v);
          setShown((p) => ({ ...p, which: undefined }));
        }}
        options={target.uses.map((u) => ({ value: u.component, label: `${u.component}: ${u.text}` }))}
        error={shown.which}
        aria-invalid={shown.which ? true : undefined}
      />
      <Textarea
        label={c.wanted}
        name="wanted"
        rows={3}
        required
        value={wanted}
        onValueChange={(v) => {
          setWanted(v);
          setShown((p) => ({ ...p, wanted: undefined }));
        }}
        error={shown.wanted}
        aria-invalid={shown.wanted ? true : undefined}
      />
      <Input label={c.where.label} name="where" autoComplete="off" hint={c.where.hint} value={where} onValueChange={setWhere} />
      <Failed text={failed} />
    </form>
  );
}

/** A change to one of a component's behaviors, or to one of an action pattern's rules. */
function ChangeForm({ formId, target, repo, integrations, pageUrl, busy, onBusy, onSent }: BehaviorRequestFormProps & { target: Extract<BehaviorTarget, { of: 'component' | 'pattern' }> }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [wanted, setWanted] = useState('');
  const [where, setWhere] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const lead = useLeadName(repo);
  const copy = behaviorFormCopy(target.of, choice, lead);
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
    onBusy(true);
    const out = await sendRequest(repo, (login) => behaviorRequest(target, { choice, wanted, where }, login), { integrations, pageUrl });
    onBusy(false);
    if ('failed' in out) setFailed(out.failed);
    else onSent(out.n);
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
      <Failed text={failed} />
    </form>
  );
}
