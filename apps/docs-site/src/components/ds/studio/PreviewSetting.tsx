// Settings, Claude, below the measure: Claude's previews of behavior requests. One row, one sentence for everyone; the
// "For developers" fold holds the one action, Turn on Claude's previews (a pull request that adds the workflow), what it
// does and the facts, the secret named but never asked for. When GitHub does not let Bridge write a workflow, the fold
// gives the file: Open on GitHub and Copy the workflow. Words: lib/preview-setting.ts; GitHub: scripts/preview-setup.ts.
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardBody, Link } from '@bridge-ds/react';
import { BEHAVIOR_PREVIEW_WORKFLOW_FILE } from '@bridge-ds/core';
import { useCopy } from './TeamLink';
import { NoticeLine } from './MemberParts';
import { DevFold } from './SettingsParts';
import type { Notice } from './members-state';
import { isWorkflowRefusal, MEASURE_WORDS } from '../../../lib/measure-setting';
import { PREVIEW_WORDS as W, previewSentence, type PreviewSettingState } from '../../../lib/preview-setting';
import type { AccessContext } from '../../../lib/library-access';
import { readRepo } from '../../../scripts/github-session';

export default function PreviewSetting({ context }: { context: AccessContext }) {
  const [state, setState] = useState<PreviewSettingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [manual, setManual] = useState<{ yaml: string; url: string } | null>(null);
  const { copied, said, copy } = useCopy();

  useEffect(() => {
    if (context !== 'real') return;
    let live = true;
    void import('../../../scripts/preview-setup')
      .then((m) => m.readPreviewState())
      .then(
        (s) => live && setState(s),
        () => live && setState({ kind: 'unknown' }),
      );
    return () => {
      live = false;
    };
  }, [context]);

  const setUp = async () => {
    setNotice(null);
    setBusy(true);
    const m = await import('../../../scripts/preview-setup');
    try {
      const pr = await m.openPreviewSetup();
      setNotice({ tone: 'success', text: W.sent, link: { label: `Pull request #${pr.number}`, href: pr.url } });
    } catch (e) {
      if (e instanceof Error && e.message === 'signin') setNotice({ tone: 'info', text: W.signIn });
      else if (isWorkflowRefusal(e)) {
        const yaml = m.previewWorkflowForTeam();
        const r = readRepo();
        setManual({ yaml, url: `https://github.com/${r.owner}/${r.repo}/new/${encodeURIComponent(r.defaultBranch)}?filename=${encodeURIComponent(BEHAVIOR_PREVIEW_WORKFLOW_FILE)}` });
        setNotice({ tone: 'info', text: MEASURE_WORDS.needsGitHub });
      } else setNotice({ tone: 'danger', text: e instanceof Error && e.message ? e.message : 'Something went wrong. Try again in a minute.' });
    } finally {
      setBusy(false);
    }
  };

  if (context !== 'real') return null;
  return (
    <Card id="claude-previews">
      <CardBody>
        <div className="set-rows">
          <div className="set-row">
            <p className="set-row-label">{W.label}</p>
            <div className="set-row-value">
              <p role="status">{state ? previewSentence(state) : W.checking}</p>
            </div>
          </div>
        </div>
        <DevFold
          facts={[
            { term: 'Workflow', value: BEHAVIOR_PREVIEW_WORKFLOW_FILE, code: true },
            { term: 'Secret', value: W.secret },
            { term: 'Branch', value: 'agent/preview-<n>, a draft pull request "Preview for #<n>"', code: true },
          ]}
        >
          <p className="set-row-help">{W.what}</p>
          {state?.kind === 'off' && (
            <p className="set-connection">
              <Button variant="secondary" data-density="compact" loading={busy} disabled={busy} onClick={() => void setUp()}>
                {busy ? W.busy : W.action}
              </Button>
            </p>
          )}
          <NoticeLine notice={notice} />
          {manual && (
            <p className="set-connection">
              <Link href={manual.url} external>
                {MEASURE_WORDS.openOnGitHub}
              </Link>
              <Button variant="ghost" data-density="compact" iconStart={copied ? Check : Copy} onClick={() => void copy(manual.yaml, MEASURE_WORDS.copied)}>
                {copied ? MEASURE_WORDS.copied : MEASURE_WORDS.copy}
              </Button>
              <span className="sr-only" role="status" aria-live="polite">
                {said}
              </span>
            </p>
          )}
        </DevFold>
      </CardBody>
    </Card>
  );
}
