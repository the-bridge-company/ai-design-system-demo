// Studio Quality for a team (multi-team PR 3b): the self-hosted page (pages/studio/quality/index.astro) as an island
// that reads the team's repository in the browser. Share at the end of the header's title line (HeaderActions), then
// a quiet line (where the data was read), then the page body shared with the self-hosted page (QualityView: the
// verdict with the lighthouse, the three pillars, one section each). Adoption comes from the team's Bridge snapshot, or says who turns it on. Numbers: lib/team-quality.ts. Repo
// content as React text only; repo links through safeUrl.
import { useEffect, useState } from 'react';
import { Accordion, AccordionItem, CodeBlock, Link } from '@bridge-ds/react';
import type { SnapshotAudit } from '@bridge-ds/core';
import { QualityShare } from './QualityShare';
import { QualityView } from './QualityView';
import { HeaderActions } from './StudioHead';
import { TeamLoadError, TeamLoadProgress, TeamSourceNote, useTeamData } from './TeamState';
import { loadTeamSnapshot } from '../../../scripts/team-data';
import { currentViewer, initGitHubConnect } from '../../../scripts/github-session';
import { viewerRoles } from '../../../lib/suggestions-view';
import { auditAskMessage, auditStep, guidanceLead, teamQuality, unmeasuredNames, type UnmeasuredProduct } from '../../../lib/team-quality';
import { ADOPTION_MEANING } from '../../../lib/quality';
import { HOSTED_DOCS_URL, SNAPSHOT_TEMPLATE_URL } from '../../../lib/team-load';
import { studioHref } from '../../../lib/team-path';

/** The setup a developer does: the workflow, then one audit per product (a checkout first for its own repo), then a push. */
function AuditSetup({ products }: { products: UnmeasuredProduct[] }) {
  return (
    <>
      {products.length ? (
        <>
          <p>
            Copy the Bridge data workflow into <span className="mono">.github/workflows/</span>, then in its <span className="mono">bridge snapshot</span> step:
          </p>
          <ul className="ql-steps">
            {products.map((p) => {
              const { checkout, flag } = auditStep(p);
              return (
                <li key={p.key}>
                  {p.name}:{' '}
                  {checkout ? (
                    <>
                      check out <span className="mono">{checkout}</span> inside the repository (<span className="mono">actions/checkout</span> with <span className="mono">repository</span> and <span className="mono">path</span>), then add <span className="mono">{flag}</span>
                    </>
                  ) : (
                    <>
                      add <span className="mono">{flag}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p>The results show here after the next push.</p>
        </>
      ) : (
        <p>
          Copy the Bridge data workflow into <span className="mono">.github/workflows/</span> and add <span className="mono">--audit "&lt;folder&gt;=&lt;label&gt;"</span> to its{' '}
          <span className="mono">bridge snapshot</span> step, once per product folder. The results show here after the next push.
        </p>
      )}
      <p>
        <Link href={SNAPSHOT_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
          Get the workflow
        </Link>
        {' · '}
        <Link href={HOSTED_DOCS_URL} target="_blank" rel="noopener noreferrer">
          How the snapshot works
        </Link>
      </p>
    </>
  );
}

/** The "For developers" fold a designer forwards: the message to send and the setup. */
function ForDevelopers({ repo, products }: { repo: string; products: UnmeasuredProduct[] }) {
  return (
    <Accordion className="ql-dev" headingLevel={3}>
      <AccordionItem value="dev" title="For developers">
        <CodeBlock code={auditAskMessage(repo, products, SNAPSHOT_TEMPLATE_URL, HOSTED_DOCS_URL)} label="Message for a developer" wrap />
        <AuditSetup products={products} />
      </AccordionItem>
    </Accordion>
  );
}

/**
 * No audit to show: what adoption is, which of the team's products wait for one, and who turns it on. A tech owner
 * reads what could not be found and gets the setup; anyone else (a designer) reads that a developer turns it on, and
 * the message to send them and the setup wait in a "For developers" fold: no branch, workflow or flag in a designer's
 * words.
 */
function NoAudit({ snapshot, repo, developer, products }: { snapshot: boolean; repo: string; developer: boolean; products: UnmeasuredProduct[] }) {
  const waiting = products.length ? `${unmeasuredNames(products)} ${products.length === 1 ? 'is' : 'are'} not measured yet.` : null;
  if (developer) {
    return (
      <div className="tp-locked">
        <p>
          <strong>{waiting ?? 'No adoption audit yet.'}</strong>{' '}
          {snapshot
            ? waiting
              ? "This repository's Bridge snapshot carries no audit of them."
              : "Bridge read this repository's Bridge snapshot, and it carries no adoption audit."
            : 'Bridge could not find a Bridge snapshot (the bridge-data branch) in this repository, and audits come from it.'}{' '}
          {ADOPTION_MEANING}
        </p>
        <AuditSetup products={products} />
      </div>
    );
  }
  return (
    <div className="tp-locked">
      <p>
        <strong>{waiting ?? 'No adoption audit yet.'}</strong> {ADOPTION_MEANING} A developer of your team turns it on: the message to send them is under For developers.
      </p>
      <ForDevelopers repo={repo} products={products} />
    </div>
  );
}

/** Below the measured products: how to measure the rest, in the viewer's words. */
function MeasureRest({ repo, developer, products }: { repo: string; developer: boolean; products: UnmeasuredProduct[] }) {
  if (developer) {
    return (
      <div className="ql-measure">
        <AuditSetup products={products} />
      </div>
    );
  }
  return (
    <div className="ql-measure">
      <p className="ql-muted">A developer of your team adds an audit for each product not measured yet: the message to send them is under For developers.</p>
      <ForDevelopers repo={repo} products={products} />
    </div>
  );
}

/** Studio Quality of the team in the address. SSR renders the skeleton; the browser reads the team. */
export default function TeamQuality() {
  const { load, retry } = useTeamData();
  // undefined: still looking; null: no snapshot; a list (maybe empty): the snapshot's audits.
  const [audits, setAudits] = useState<SnapshotAudit[] | null | undefined>(undefined);
  // When the snapshot was written: its own runs are the current products (lib/quality-view adoptionView).
  const [snapshotAt, setSnapshotAt] = useState<string | undefined>(undefined);
  const sha = load.status === 'ready' ? load.data.sha : null;
  // A tech owner sets the audit up; anyone else asks a developer (NoAudit).
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => {
    initGitHubConnect((v) => setViewer(v?.login ?? null));
    setViewer(currentViewer()?.login ?? null);
  }, []);
  useEffect(() => {
    if (!sha) return;
    let live = true;
    void loadTeamSnapshot().then((s) => {
      if (!live) return;
      setSnapshotAt(s?.generatedAt);
      setAudits(s ? s.audits : null);
    });
    return () => {
      live = false;
    };
  }, [sha]);

  if (load.status === 'loading') return <TeamLoadProgress label="Reading the quality of this design system" />;
  if (load.status === 'error') return <TeamLoadError failure={load.failure} onRetry={retry} />;
  const { data, refreshing } = load;
  const developer = viewerRoles(viewer, data.model.config.governance.owners).includes('tech');
  const q = teamQuality({ model: data.model, owner: data.owner, repo: data.repo, sha: data.sha, audits: audits ?? null, ...(snapshotAt ? { snapshotAt } : {}), audience: developer ? 'developer' : 'designer' });
  return (
    <div className="ql">
      <div className="tq-top">
        <TeamSourceNote data={data} refreshing={refreshing} onRefresh={retry} />
      </div>
      <HeaderActions>
        <QualityShare figures={q.figures} sentence={q.sentence} path={studioHref('quality/')} />
      </HeaderActions>
      <QualityView
        verdict={q.verdict}
        pillars={q.pillars}
        contrast={{ hasChecks: q.hasChecks, gate: q.gate, combos: q.contrast.combos, failRows: q.failRows }}
        adoption={q.adoption}
        adoptionEmpty={audits === undefined ? <p className="ql-muted">Looking for the Bridge snapshot of this repository.</p> : <NoAudit snapshot={audits !== null} repo={`${data.owner}/${data.repo}`} developer={developer} products={q.unmeasured} />}
        adoptionUnmeasured={q.unmeasured}
        adoptionMeasure={<MeasureRest repo={`${data.owner}/${data.repo}`} developer={developer} products={q.unmeasured} />}
        guidance={{ lead: guidanceLead(q.guidance), findings: q.guidanceFindings }}
        tokens={{ findings: q.tokenFindings, unusedTotal: q.unusedTotal, unusedHref: q.unusedHref, problems: q.problems }}
      />
    </div>
  );
}
