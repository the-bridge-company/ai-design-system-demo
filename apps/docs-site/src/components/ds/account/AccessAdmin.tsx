// The founder's queue (pages/admin/access.astro): who asked for Bridge, and the invite links for prospects. Only an
// address of BRIDGE_ADMIN_EMAILS signed in reads it (api/access answers 401 signin or 403 not_admin to anyone else).
//   - The header says it in one line: "3 requests waiting · 2 of 5 places left this week". Over the weekly cap a
//     warning says so; Invite still works, the founder decides.
//   - One row per request (company, email, the design system link, what they want to fix, when they asked), Not yet
//     and Invite in the row. Not yet asks for an optional note in a dialog. A decided row says how it ended.
//   - Invite links: a small form (who it is for, uses, days), the new link shown once with Copy, then the list with
//     uses, expiry and Revoke.
// Words and rules in lib/access-request.ts.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Inbox } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  Input,
  Link,
  NumberField,
  PageHeader,
  Skeleton,
  Textarea,
  ToastProvider,
  useToast,
} from "@bridge-ds/react";
import ButtonLink from "../ButtonLink";
import {
  ACCESS_API,
  ACCESS_WEEKLY_CAP,
  accessDay,
  ADMIN_WORDS as W,
  sortQueue,
  type AdminLink,
  type QueueRequest,
} from "../../../lib/access-request";
import "../../../styles/access-admin.css";

interface Queue {
  requests: QueueRequest[];
  links: AdminLink[];
  waiting: number;
  week: { invited: number; cap: number };
}

type Load =
  | { state: "loading" }
  | { state: "ready"; queue: Queue }
  | { state: "signin"; href: string }
  | { state: "denied" }
  | { state: "failed" };

/** POST /api/access with the CSRF header and the account cookie. Tests replace it. */
export const adminApi = {
  post: async (body: Record<string, unknown>): Promise<Response> =>
    fetch(ACCESS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Bridge-Account": "1",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    }),
};

async function call<T>(
  body: Record<string, unknown>
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; data: Record<string, unknown> }
> {
  let res: Response;
  try {
    res = await adminApi.post(body);
  } catch {
    return { ok: false, status: 0, data: {} };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return res.ok
    ? { ok: true, data: data as T }
    : { ok: false, status: res.status, data };
}

const message = (data: Record<string, unknown>) =>
  typeof data.message === "string" && data.message ? data.message : W.failed;

/** "github.com/acme/ds": the link as people read it. */
function shortLink(href: string): string {
  try {
    const u = new URL(href);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.replace(
      /\/$/,
      ""
    );
  } catch {
    return href;
  }
}

function RequestRow({
  r,
  busy,
  onInvite,
  onNotYet,
}: {
  r: QueueRequest;
  busy: boolean;
  onInvite: () => void;
  onNotYet: () => void;
}) {
  const decided =
    r.status === "invited" && r.approvedAt
      ? r.approvedVia === "link"
        ? W.invitedByLink(accessDay(r.approvedAt))
        : W.invited(accessDay(r.approvedAt))
      : r.status === "declined" && r.declinedAt
      ? W.declined(accessDay(r.declinedAt))
      : null;
  return (
    <li className="aa-row" data-status={r.status}>
      <div className="aa-row-main">
        <p className="aa-row-title">
          <span className="aa-company">{r.company}</span>
          <span className="aa-email">{r.email}</span>
        </p>
        <p className="aa-fix">{r.fix}</p>
        <p className="aa-meta">
          {r.where ? (
            <Link href={r.where} external>
              {shortLink(r.where)}
            </Link>
          ) : (
            <span>{W.noWhere}</span>
          )}
          <span aria-hidden="true"> · </span>
          <span>{W.sent(accessDay(r.at))}</span>
        </p>
      </div>
      <div className="aa-row-actions">
        {r.status === "pending" || !decided ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={onNotYet}>
              {W.notYet}
            </Button>
            <Button variant="primary" loading={busy} onClick={onInvite}>
              {W.invite}
            </Button>
          </>
        ) : (
          <Badge tone={r.status === "invited" ? "success" : "neutral"}>
            {decided}
          </Badge>
        )}
      </div>
    </li>
  );
}

function LinkRow({
  l,
  busy,
  onRevoke,
}: {
  l: AdminLink;
  busy: boolean;
  onRevoke: () => void;
}) {
  return (
    <li className="aa-link" data-state={l.state}>
      <div className="aa-row-main">
        <p className="aa-link-label">{l.label}</p>
        <p className="aa-meta">
          {W.linkMeta(l.uses, l.maxUses, l.state, accessDay(l.expiresAt))}
        </p>
      </div>
      {l.state === "valid" ? (
        <Button variant="ghost" disabled={busy} onClick={onRevoke}>
          {W.revoke}
        </Button>
      ) : (
        <Badge tone="neutral">{l.state === "used" ? "Used" : "Expired"}</Badge>
      )}
    </li>
  );
}

function Queue({
  initial,
  onReload,
}: {
  initial: Queue;
  onReload: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState<Queue>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notYet, setNotYet] = useState<QueueRequest | null>(null);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({
    label: "",
    uses: 1 as number | null,
    days: 14 as number | null,
  });
  const [labelError, setLabelError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const labelField = useRef<HTMLInputElement>(null);

  const cap = q.week.cap ?? ACCESS_WEEKLY_CAP;
  const left = Math.max(0, cap - q.week.invited);
  const replace = (r: QueueRequest) =>
    setQ((s) => {
      const requests = s.requests.map((x) =>
        x.email.toLowerCase() === r.email.toLowerCase() ? r : x
      );
      return {
        ...s,
        requests,
        waiting: requests.filter((x) => x.status === "pending").length,
      };
    });

  const invite = async (r: QueueRequest) => {
    setBusy(r.email);
    setProblem(null);
    const out = await call<{ request: QueueRequest; week: Queue["week"] }>({
      action: "invite",
      email: r.email,
    });
    setBusy(null);
    if (!out.ok) return setProblem(message(out.data));
    replace(out.data.request);
    setQ((s) => ({ ...s, week: out.data.week ?? s.week }));
    toast.add({
      title: W.invitedToast(r.email),
      tone: "success",
      timeout: 4000,
    });
  };

  const sendNotYet = async (e: FormEvent) => {
    e.preventDefault();
    if (!notYet) return;
    const r = notYet;
    setBusy(r.email);
    setProblem(null);
    const out = await call<{ request: QueueRequest }>({
      action: "not-yet",
      email: r.email,
      note,
    });
    setBusy(null);
    setNotYet(null);
    setNote("");
    if (!out.ok) return setProblem(message(out.data));
    replace(out.data.request);
    toast.add({
      title: W.declinedToast(r.email),
      tone: "success",
      timeout: 4000,
    });
  };

  const createLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      setLabelError(W.badLabel);
      labelField.current?.focus();
      return;
    }
    setBusy("create-link");
    setProblem(null);
    const out = await call<{ link: AdminLink; url: string }>({
      action: "create-link",
      label: form.label,
      maxUses: form.uses ?? 1,
      days: form.days ?? 14,
    });
    setBusy(null);
    if (!out.ok) return setProblem(message(out.data));
    setQ((s) => ({ ...s, links: [out.data.link, ...s.links] }));
    setCreated(out.data.url);
    setCopied(false);
    setForm({ label: "", uses: 1, days: 14 });
  };

  const revoke = async (l: AdminLink) => {
    setBusy(l.id);
    setProblem(null);
    const out = await call<{ ok: true }>({ action: "revoke-link", id: l.id });
    setBusy(null);
    if (!out.ok) return setProblem(message(out.data));
    setQ((s) => ({ ...s, links: s.links.filter((x) => x.id !== l.id) }));
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const requests = sortQueue(q.requests);
  return (
    <div className="aa">
      <PageHeader title={W.title} lead={W.summary(q.waiting, left, cap)} />
      {q.week.invited >= cap && (
        <Alert tone="warning" className="aa-alert">
          {W.overCap(cap)}
        </Alert>
      )}
      {problem && (
        <Alert
          tone="danger"
          className="aa-alert"
          onDismiss={() => setProblem(null)}
          actions={
            <Button variant="secondary" size="sm" onClick={onReload}>
              {W.retry}
            </Button>
          }
        >
          {problem}
        </Alert>
      )}

      <section className="aa-section" aria-label={W.title}>
        {requests.length ? (
          <ul className="aa-list">
            {requests.map((r) => (
              <RequestRow
                key={r.email}
                r={r}
                busy={busy === r.email}
                onInvite={() => void invite(r)}
                onNotYet={() => setNotYet(r)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Inbox}
            title={W.emptyTitle}
            description={W.emptyText}
            headingLevel={2}
            className="aa-empty"
          />
        )}
      </section>

      <section className="aa-section" aria-labelledby="aa-links">
        <div className="aa-section-head">
          <h2 id="aa-links" className="aa-h2">
            {W.linksTitle}
          </h2>
          <p className="aa-lead">{W.linksLead}</p>
        </div>
        <form
          className="aa-link-form"
          noValidate
          onSubmit={(e) => void createLink(e)}
        >
          <div className="aa-label-field">
            <Input
              ref={labelField}
              label={W.labelLabel}
              name="label"
              maxLength={80}
              placeholder={W.labelPlaceholder}
              value={form.label}
              error={labelError ?? undefined}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, label: v }));
                if (labelError) setLabelError(null);
              }}
            />
          </div>
          <NumberField
            className="aa-num"
            label={W.usesLabel}
            name="uses"
            min={1}
            max={50}
            value={form.uses}
            onValueChange={(v) => setForm((f) => ({ ...f, uses: v }))}
          />
          <NumberField
            className="aa-num"
            label={W.daysLabel}
            name="days"
            min={1}
            max={90}
            value={form.days}
            onValueChange={(v) => setForm((f) => ({ ...f, days: v }))}
          />
          <Button
            type="submit"
            variant="secondary"
            className="aa-create"
            loading={busy === "create-link"}
          >
            {W.createLink}
          </Button>
        </form>
        {created && (
          <Alert
            tone="success"
            className="aa-alert"
            title={W.newLinkTitle}
            onDismiss={() => setCreated(null)}
            actions={
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                {copied ? W.copied : W.copy}
              </Button>
            }
          >
            <code className="aa-url">{created}</code>
          </Alert>
        )}
        {q.links.length ? (
          <ul className="aa-list">
            {q.links.map((l) => (
              <LinkRow
                key={l.id}
                l={l}
                busy={busy === l.id}
                onRevoke={() => void revoke(l)}
              />
            ))}
          </ul>
        ) : (
          <p className="aa-lead">{W.noLinks}</p>
        )}
      </section>

      <Dialog
        open={notYet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNotYet(null);
            setNote("");
          }
        }}
      >
        <DialogContent
          size="sm"
          title={W.notYetTitle(notYet?.company ?? "")}
          description={W.notYetText}
          footer={
            <div className="aa-dialog-actions">
              <Button variant="ghost" onClick={() => setNotYet(null)}>
                {W.cancel}
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="aa-not-yet"
                loading={busy !== null && busy === notYet?.email}
              >
                {W.notYetSend}
              </Button>
            </div>
          }
        >
          <form id="aa-not-yet" noValidate onSubmit={(e) => void sendNotYet(e)}>
            <Textarea
              label={W.noteLabel}
              hint={W.noteHint}
              name="note"
              rows={3}
              maxLength={600}
              value={note}
              onValueChange={setNote}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccessAdmin() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const out = await call<Queue>({ action: "list" });
      if (!live) return;
      if (out.ok) return setLoad({ state: "ready", queue: out.data });
      if (out.status === 401)
        return setLoad({
          state: "signin",
          href:
            typeof out.data.signIn === "string"
              ? out.data.signIn
              : "/signin/?next=%2Fadmin%2Faccess%2F",
        });
      if (out.status === 403 && out.data.error === "not_admin")
        return setLoad({ state: "denied" });
      setLoad({ state: "failed" });
    })();
    return () => {
      live = false;
    };
  }, [round]);

  const reload = () => {
    setLoad({ state: "loading" });
    setRound((n) => n + 1);
  };

  if (load.state === "loading")
    return (
      <div className="aa" aria-busy="true">
        <PageHeader title={W.title} lead={<Skeleton width="40%" />} />
        <Skeleton height="var(--size-20)" />
      </div>
    );
  if (load.state === "signin")
    return (
      <div className="aa">
        <PageHeader title={W.signInTitle} lead={W.signInText} />
        <div>
          <ButtonLink href={load.href} variant="primary" size="lg">
            {W.signIn}
          </ButtonLink>
        </div>
      </div>
    );
  if (load.state === "denied")
    return (
      <div className="aa">
        <PageHeader title={W.title} lead={W.notAdmin} />
      </div>
    );
  if (load.state === "failed")
    return (
      <div className="aa">
        <PageHeader title={W.title} />
        <Alert
          tone="danger"
          actions={
            <Button variant="secondary" size="sm" onClick={reload}>
              {W.retry}
            </Button>
          }
        >
          {W.failed}
        </Alert>
      </div>
    );
  return (
    <ToastProvider limit={2}>
      <Queue key={round} initial={load.queue} onReload={reload} />
    </ToastProvider>
  );
}
