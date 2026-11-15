// A behavior request on a team (components/ds/studio/BehaviorRequestForm.tsx): one request issue on the team's
// repository, kind `behavior` (@bridge-ds/core composeRequestIssue), with the viewer's session: a GitHub member writes
// it with their own token, an email member through Bridge's server (/api/contribute, which adds "Requested by <name>
// through Bridge."), the same way as a build request (scripts/build-request-send.ts). No bridge-build label: it waits
// for the design system lead, who makes it the default (then it is a build request) or says why not now. The labels
// of bridge.config.json integrations.requests apply; its assignees do not, so the lead is the one who decides.
import { composeRequestIssue, type ComponentChangeRequest, type IntegrationsConfig } from '@bridge-ds/core';
import { getToken, studioClient } from './github-session';

/** Files the behavior request on `repo` ("owner/name") and returns its number. Throws what GitHub or Bridge's server said. */
export async function sendBehaviorRequest(repo: string, request: ComponentChangeRequest, opts: { integrations?: IntegrationsConfig | undefined; pageUrl?: string | undefined } = {}): Promise<number> {
  const issue = composeRequestIssue(request, { labels: opts.integrations?.requests?.labels ?? [], ...(opts.pageUrl ? { componentUrl: opts.pageUrl } : {}) });
  const created = await studioClient(repo, getToken()).createIssue({ title: issue.title, body: issue.body, labels: issue.labels });
  return created.number;
}
