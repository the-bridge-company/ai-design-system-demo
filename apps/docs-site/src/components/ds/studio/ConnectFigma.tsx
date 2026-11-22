// /studio/connect-figma/?code=…: the browser half of "Sign in with Bridge" in the Figma plugin (api/plugin-link). The
// person is signed in to Bridge as usual; they pick the team and press Connect Figma. The page hands the one-time code,
// the team and this browser's GitHub sign-in to the server, which checks the sign-in can open that team's design
// system; the plugin, which polls with its own secret, receives them once. No token is ever shown. Steps and words:
// lib/connect-figma.ts.
//
// The body of a standalone card (pages/studio/connect-figma.astro, Layout standalone): one heading, one sentence, the
// team choice and one primary action, then who is signed in as a quiet line. Each outcome replaces the card's words:
//   done             "Figma is connected", go back to Figma, one quiet link to Studio
//   expired / used   the code cannot be approved again: start again from the plugin, no action here
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Link, Radio, RadioGroup, Spinner } from '@bridge-ds/react';
import { signInHref } from '../../../lib/account';
import type { Account } from '../../../lib/account';
import { studioHref } from '../../../lib/team-path';
import { CONNECT_WORDS as W, LINK_API, codeFrom, connectStep, endedBy, signedInName, teamLabel, type ConnectStep, type EndedReason } from '../../../lib/connect-figma';

const here = () => location.pathname + location.search;

/** This browser's GitHub sign-in, renewed first when it is close to expiry, with how long it still lasts. */
async function freshGitHub(): Promise<{ token: string; expiresIn: number | null } | null> {
  const a = await import('../../../scripts/account-session');
  const s = await import('../../../scripts/github-session');
  const { needsRefresh } = await import('../../../lib/github-signin');
  if (needsRefresh(s.readAppSession(), Date.now())) await s.refreshSignIn().catch(() => false);
  const token = await a.workingGitHubToken();
  if (!token) return null;
  const at = s.readAppSession()?.expiresAt ?? null;
  return { token, expiresIn: at ? Math.max(60, Math.floor((at - Date.now()) / 1000)) : null };
}

async function otherAccount() {
  const { signOut } = await import('../../../scripts/account-session');
  await signOut().catch(() => {});
  location.assign(signInHref(here()));
}

export default function ConnectFigma() {
  const [step, setStep] = useState<ConnectStep | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [ended, setEnded] = useState<EndedReason | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const code = typeof location === 'undefined' ? null : codeFrom(location.search);

  useEffect(() => {
    let live = true;
    void (async () => {
      const info = await import('../../../scripts/account-session')
        .then(({ getAccount }) => getAccount())
        .catch(() => ({ available: false, account: null }));
      const account: Account | null = info.account;
      const githubHere = await import('../../../scripts/github-session').then((s) => s.readAppSession() !== null).catch(() => false);
      const github = account ? await freshGitHub().catch(() => null) : null;
      // The same teams as the team switcher, the site's own design system included (scripts/pickable-teams.ts).
      const teams = account && github ? await import('../../../scripts/pickable-teams').then(({ loadPickableTeams }) => loadPickableTeams(account, github.token)).catch(() => undefined) : undefined;
      if (!live) return;
      const s = connectStep(code, account, Boolean(github), teams, { reachable: info.available, githubHere });
      setAccount(account);
      setStep(s);
      if (s.kind === 'pick') setTeam(s.teams[0]!.repo);
    })();
    return () => {
      live = false;
    };
  }, [code]);

  // An outcome replaces the card's words: the heading takes focus so it is read out, and the action is gone.
  useEffect(() => {
    if (done || ended) title.current?.focus();
  }, [done, ended]);

  async function connect() {
    if (step?.kind !== 'pick' || !code) return;
    const picked = step.teams.find((t) => t.repo === team);
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const github = await freshGitHub();
      if (!github) {
        setStep({ kind: 'github' });
        return;
      }
      const res = await fetch(LINK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', code, repo: picked.repo, token: github.token, expires_in: github.expiresIn ?? undefined, name: picked.name ?? undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        const end = endedBy(res.status, body.error);
        if (end) setEnded(end);
        // GitHub no longer accepts this browser's sign-in: the step that connects it again.
        else if (body.error === 'signin') setStep({ kind: 'github' });
        else setError(body.message ?? W.failed);
        return;
      }
      setDone(teamLabel(picked));
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  const heading = (text: string) => (
    <h1 id="cf-title" className="cf-title" ref={title} tabIndex={-1}>
      {text}
    </h1>
  );
  const who = account && (
    <p className="cf-who t-ui t-muted">
      {W.signedInAs(signedInName(account))}{' '}
      <Button variant="link" onClick={() => void otherAccount()}>
        {W.otherAccount}
      </Button>
    </p>
  );

  if (done)
    return (
      <>
        {heading(W.doneTitle)}
        <p className="cf-text">{W.done(done)}</p>
        <p className="cf-who t-ui">
          <Link href={studioHref()}>{W.openStudio}</Link>
        </p>
      </>
    );
  if (ended)
    return (
      <>
        {heading(ended === 'used' ? W.usedTitle : W.expiredTitle)}
        <p className="cf-text">{W.startAgain}</p>
      </>
    );
  if (!step)
    return (
      <>
        {heading(W.title)}
        <Spinner label="Checking your sign-in" />
      </>
    );
  switch (step.kind) {
    case 'no-code':
      return (
        <>
          {heading(W.noCodeTitle)}
          <p className="cf-text">{W.noCode}</p>
        </>
      );
    case 'unreachable':
      return (
        <>
          {heading(W.title)}
          <Alert tone="warning">{W.unreachable}</Alert>
          <Button variant="primary" size="lg" fullWidth onClick={() => location.reload()}>
            {W.reload}
          </Button>
        </>
      );
    case 'signin':
      return (
        <>
          {heading(W.title)}
          <p className="cf-text">{step.githubHere ? W.signinGitHubHere : W.signin}</p>
          <Button variant="primary" size="lg" fullWidth onClick={() => location.assign(signInHref(here()))}>
            {W.signinAction}
          </Button>
        </>
      );
    case 'github':
      return (
        <>
          {heading(W.title)}
          <p className="cf-text">{W.github}</p>
          <Button variant="primary" size="lg" fullWidth onClick={() => void import('../../../scripts/account-session').then(({ linkGitHub }) => linkGitHub(here()))}>
            {W.githubAction}
          </Button>
          {who}
        </>
      );
    case 'no-teams':
      return (
        <>
          {heading(W.title)}
          <p className="cf-text">{W.noTeams}</p>
          {who}
        </>
      );
    case 'pick': {
      const many = step.teams.length > 1;
      return (
        <>
          {heading(W.title)}
          <p className="cf-text">{many ? W.lede : W.ledeOne}</p>
          {many ? (
            <RadioGroup label={W.teamLabel} value={team} onValueChange={setTeam}>
              {step.teams.map((t) => (
                <Radio key={t.repo} value={t.repo} label={teamLabel(t)} />
              ))}
            </RadioGroup>
          ) : (
            <p className="cf-text">
              {W.teamLabel}: <strong>{teamLabel(step.teams[0]!)}</strong>
            </p>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <Button variant="primary" size="lg" fullWidth onClick={() => void connect()} disabled={busy} loading={busy}>
            {busy ? W.connecting : W.connect}
          </Button>
          {who}
        </>
      );
    }
  }
}
