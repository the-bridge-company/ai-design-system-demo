// Request access (pages/request.astro): Bridge opens on invitation. The sign-in screen's page (SignInPage), three
// states, one primary action each:
//   - form: the work email (prefilled from ?email=), the company, where the design system lives (optional) and what
//     to fix first, then Request access. Under it, Sign in for someone who already has access, and the demo.
//   - sent: "Request received.", when and to which email we answer, Continue the demo, and Change my request.
//   - pending: a visitor who comes back (this browser keeps { email, at }): where the request stands as three steps,
//     Continue the demo, and Change my request.
// Words and rules in lib/access-request.ts; the server checks the same ones (api/access).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Alert, Button, Icon, Input, Link, Stepper } from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { SignInPage } from './SignInPage';
import {
  ACCESS_API,
  ACCESS_DEMO,
  ACCESS_STORE_KEY,
  ACCESS_WORDS as W,
  accessDay,
  checkAccessRequest,
  emailFromQuery,
  parseRemembered,
  type AccessErrors,
  type AccessField,
  type RememberedRequest,
} from '../../../lib/access-request';
import { PRIVACY_PAGE, SIGNIN_PAGE, ACCOUNT_WORDS } from '../../../lib/account';
import '../../../styles/account.css';

type View = 'form' | 'sent' | 'pending';

function remembered(): RememberedRequest | null {
  try {
    return parseRemembered(localStorage.getItem(ACCESS_STORE_KEY));
  } catch {
    return null;
  }
}

function remember(r: RememberedRequest): void {
  try {
    localStorage.setItem(ACCESS_STORE_KEY, JSON.stringify(r));
  } catch {
    /* storage blocked: the page still says it was sent */
  }
}

/** POST /api/access. Tests replace it. */
export const accessApi = {
  send: async (body: Record<string, string>): Promise<Response> =>
    fetch(ACCESS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Bridge-Account': '1' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ action: 'request', ...body }),
    }),
};

const FIELDS: AccessField[] = ['email', 'company', 'where', 'fix'];

export default function RequestAccess() {
  const [start] = useState(() => {
    const fromQuery = emailFromQuery(location.search);
    const kept = remembered();
    // A request kept in this browser shows where it stands, unless the address asks for another email.
    const view: View = kept && (!fromQuery || fromQuery.toLowerCase() === kept.email.toLowerCase()) ? 'pending' : 'form';
    return { view, kept, email: fromQuery || kept?.email || '' };
  });
  const [view, setView] = useState<View>(start.view);
  const [sent, setSent] = useState<RememberedRequest | null>(start.kept);
  const [values, setValues] = useState({ email: start.email, company: '', where: '', fix: '' });
  const [errors, setErrors] = useState<AccessErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = { email: useRef<HTMLInputElement>(null), company: useRef<HTMLInputElement>(null), where: useRef<HTMLInputElement>(null), fix: useRef<HTMLInputElement>(null) };
  const first = useRef(true);

  // Each new state moves focus to its title (the form keeps the page's natural start on first load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('acc-title')?.focus();
  }, [view]);

  const set = (field: AccessField) => (v: string) => {
    setValues((s) => ({ ...s, [field]: v }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const showErrors = (e: AccessErrors) => {
    setErrors(e);
    const bad = FIELDS.find((f) => e[f]);
    if (bad) refs[bad].current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAlert(null);
    const checked = checkAccessRequest(values);
    if (!checked.ok) return showErrors(checked.errors);
    setErrors({});
    setBusy(true);
    try {
      let res: Response;
      try {
        res = await accessApi.send({ ...checked.value });
      } catch {
        setAlert(W.offline);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; at?: string; message?: string; fields?: AccessErrors };
      if (res.ok && body.ok && typeof body.at === 'string') {
        const r = { email: checked.value.email, at: body.at };
        remember(r);
        setSent(r);
        setView('sent');
        return;
      }
      if (res.status === 400 && body.fields) return showErrors(body.fields);
      setAlert(res.status === 429 ? W.limited : typeof body.message === 'string' && body.message ? body.message : W.failed);
    } finally {
      setBusy(false);
    }
  };

  const change = () => {
    if (sent) setValues((s) => ({ ...s, email: sent.email }));
    setAlert(null);
    setView('form');
  };

  const header = (title: string, lead: ReactNode) => (
    <>
      <h1 id="acc-title" className="acc-title" tabIndex={-1}>
        {title}
      </h1>
      <p className="acc-lead">{lead}</p>
    </>
  );

  const demoAndChange = (
    <div className="acc-ways">
      <ButtonLink variant="primary" size="lg" href={ACCESS_DEMO} fullWidth>
        {W.continueDemo}
      </ButtonLink>
      <p className="acc-quiet">
        {view === 'sent' && <>{W.wrongEmail} </>}
        <Button variant="link" size="sm" className="ent-inline" onClick={change}>
          {W.change}
        </Button>
      </p>
    </div>
  );

  let body: ReactNode;
  if (view === 'sent' && sent) {
    body = (
      <>
        {header(
          W.sentTitle,
          <>
            {W.sentLead[0]}
            {accessDay(sent.at)}
            {W.sentLead[1]}
            <strong className="ent-strong">{sent.email}</strong>
            {W.sentLead[2]}
          </>,
        )}
        {demoAndChange}
      </>
    );
  } else if (view === 'pending' && sent) {
    body = (
      <>
        {header(
          W.pendingTitle,
          <>
            {W.pendingLead[0]}
            <strong className="ent-strong">{sent.email}</strong>
            {W.pendingLead[1]}
          </>,
        )}
        <Stepper
          className="acc-steps"
          label={W.steps}
          current={1}
          steps={[
            { label: W.stepSent, meta: accessDay(sent.at) },
            { label: W.stepReviewed, meta: W.stepReviewedMeta },
            { label: W.stepAccess, meta: W.stepAccessMeta },
          ]}
        />
        {demoAndChange}
      </>
    );
  } else {
    body = (
      <>
        {header(W.title, W.lead)}
        {alert && (
          <Alert tone="danger" className="acc-alert">
            {alert}
          </Alert>
        )}
        <form className="acc-form" noValidate onSubmit={(e) => void submit(e)}>
          <Input
            ref={refs.email}
            label={W.emailLabel}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            size="lg"
            prefix={<Icon icon={Mail} size="sm" />}
            placeholder={W.emailPlaceholder}
            value={values.email}
            error={errors.email}
            onValueChange={set('email')}
          />
          <Input ref={refs.company} label={W.companyLabel} name="company" autoComplete="organization" size="lg" maxLength={120} value={values.company} error={errors.company} onValueChange={set('company')} />
          <Input
            ref={refs.where}
            label={W.whereLabel}
            hint={W.whereHint}
            type="url"
            name="where"
            inputMode="url"
            size="lg"
            maxLength={300}
            placeholder={W.wherePlaceholder}
            value={values.where}
            error={errors.where}
            onValueChange={set('where')}
          />
          <Input ref={refs.fix} label={W.fixLabel} name="fix" size="lg" maxLength={300} value={values.fix} error={errors.fix} onValueChange={set('fix')} />
          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
            {W.submit}
          </Button>
          <p className="acc-quiet">
            {W.haveAccess} <Link href={SIGNIN_PAGE}>{W.signIn}</Link>
          </p>
        </form>
        <div className="acc-demo">
          <p className="acc-quiet">{W.demoLead}</p>
          <ButtonLink href={ACCESS_DEMO} variant="secondary" fullWidth>
            {W.demo}
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <SignInPage
      pitch={view === 'form'}
      foot={
        <p className="acc-foot">
          <Link href={PRIVACY_PAGE}>{ACCOUNT_WORDS.privacy}</Link>
        </p>
      }
    >
      <section className="acc" aria-labelledby="acc-title">
        {body}
      </section>
    </SignInPage>
  );
}
