// Docs drafted with Claude, in place on a Library component page, by someone's own Claude (Claude Code or Desktop with
// the Bridge MCP server) through the draft exchange; Bridge never calls Claude itself: Studio writes a pending session on the requests branch with the GitHub token the site already
//   uses, the designer says "Draft my Bridge changes", and Studio polls the file until the answer is there.
// Results are always proposals: the caller shows them as "Drafted by Claude" (applyDraft marks draftedSections) and
// the designer reviews them. The pure logic is in ../lib/docs-ai-model.ts and @bridge-ds/core.
import {
  type ComponentDocsJson,
  DRAFT_PHRASE,
  type DocsSections,
  type DraftResult,
  DraftPoller,
  type ProseKey,
  applyDocsSections,
  createDocsDraftSession,
  deletePendingDrafts,
  missingProse,
} from '@bridge-ds/core';
import {
  type DocsAiContext,
  type DraftAvailability,
  type DraftDocsResult,
  type DraftScope,
  type DraftWay,
  availability,
  isEmptyTask,
  outdatedFromDates,
  resultFromExchange,
  scopeTask,
  taskPrompt,
} from '../lib/docs-ai-model';
import { getToken, hasWorkingToken, prefersSignIn, readRepo, studioClient } from './github-session';
import { ghVerb } from '../lib/gh-wording';

export type { DraftAvailability, DraftDocsResult, DraftScope, DraftWay } from '../lib/docs-ai-model';
export { DRAFT_PHRASE };

// An Anthropic key an earlier version kept in this browser: forgotten, Bridge never calls Claude with a key.
try {
  if (typeof localStorage !== 'undefined') for (const k of ['bridge.anthropic.key', 'bridge.anthropic.model']) localStorage.removeItem(k);
} catch {
  /* storage blocked: nothing was kept either */
}

/** The way open here: a working GitHub session for the draft exchange. */
export function draftAvailability(): DraftAvailability {
  return availability({ exchange: hasWorkingToken() });
}

const contexts = new Map<string, Promise<DocsAiContext>>();

/** Where the drafting context comes from on a team's Library page (read from its repository), null for this site's. */
let contextSource: ((slug: string) => Promise<DocsAiContext>) | null = null;

/** A team's Library page drafts from its own code (lib/team-docs-ai.ts); null goes back to this site's built files. */
export function setDocsContextSource(source: ((slug: string) => Promise<DocsAiContext>) | null): void {
  contextSource = source;
  contexts.clear();
}

/**
 * The facts from the code and the conventions of a component: /docs-ai/<slug>.json, built with the site, or the team's
 * own when a team's Library page set its source.
 */
export function docsContext(slug: string): Promise<DocsAiContext> {
  let p = contexts.get(slug);
  if (!p && contextSource) {
    p = contextSource(slug);
    p.catch(() => contexts.delete(slug));
    contexts.set(slug, p);
  }
  if (!p) {
    p = fetch(`/docs-ai/${encodeURIComponent(slug)}.json`).then((r) => {
      if (!r.ok) throw new Error(`The drafting context of ${slug} is missing (${r.status}). Reload the page.`);
      return r.json() as Promise<DocsAiContext>;
    });
    p.catch(() => contexts.delete(slug));
    contexts.set(slug, p);
  }
  return p;
}

const repoName = () => {
  const r = readRepo();
  return { full: `${r.owner}/${r.repo}`, branch: r.defaultBranch };
};

/**
 * Prose sections that are empty or older than the component code: last commit of the tsx and the css against the last
 * commit of docs.json on the default branch (GitHub API). Only the empty ones when GitHub cannot be read.
 */
export async function outdatedSections(slug: string, docs: Partial<ComponentDocsJson>): Promise<ProseKey[]> {
  try {
    const ctx = await docsContext(slug);
    const { full, branch } = repoName();
    const gh = studioClient(full, getToken());
    const last = async (path: string) => (await gh.listCommits({ sha: branch, path, perPage: 1 }))[0]?.date ?? null;
    const [tsx, css, written] = await Promise.all([last(ctx.files.tsx), last(ctx.files.css), last(ctx.files.docs)]);
    return outdatedFromDates(docs, { code: [tsx, css], docs: written });
  } catch {
    return missingProse(docs);
  }
}

/** The docs with drafted sections applied and marked for review (draftedBy, needsReview, draftedSections). */
export function applyDraft<T extends Partial<ComponentDocsJson>>(docs: T, sections: DraftDocsResult['sections']): T {
  return applyDocsSections(docs, sections as DocsSections);
}

const aborted = () => new DOMException('Drafting was cancelled.', 'AbortError');

async function viaMyClaude(
  input: { slug: string; name: string; path: string; task: Parameters<typeof resultFromExchange>[0]; prompt: string },
  signal: AbortSignal | undefined,
  onStatus: ((s: string) => void) | undefined,
): Promise<DraftResult> {
  if (!hasWorkingToken()) throw new Error(`${ghVerb(prefersSignIn())} first: your own Claude answers through the repo.`);
  const { full, branch } = repoName();
  const gh = studioClient(full, getToken());
  onStatus?.('Sending the request to Claude Code');
  const session = await createDocsDraftSession(gh, { component: input.name, slug: input.slug, path: input.path, task: input.task, prompt: input.prompt, baseBranch: branch });
  const cleanup = () => deletePendingDrafts(gh, session.sessionId).catch(() => false);
  onStatus?.(`Waiting for a developer. They say "${DRAFT_PHRASE}" in Claude Code or Claude Desktop with the Bridge MCP server.`);
  return new Promise<DraftResult>((resolve, reject) => {
    const done = (fn: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      void cleanup();
      fn();
    };
    const poller = new DraftPoller({
      client: gh,
      sessionId: session.sessionId,
      onResults: (results) => {
        const r = results.find((x) => x.id === session.items[0]!.id);
        done(() => (r ? resolve(r) : reject(new Error('Claude answered without the docs. Try again.'))));
      },
      onTimeout: () => done(() => reject(new Error(`No answer from Claude after 10 minutes. Ask a developer to say "${DRAFT_PHRASE}" in Claude Code, then try again.`))),
      onGone: () => done(() => reject(new Error('The request was removed before Claude answered. Try again.'))),
      onError: () => onStatus?.('Still waiting for a developer (GitHub did not answer, retrying)'),
    });
    const onAbort = () => {
      poller.stop();
      done(() => reject(aborted()));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    poller.start();
  });
}

/**
 * Drafts docs for a scope, the designer's own way. Sections scopes return the drafted sections and `checked`: written
 * sections page-fill checked against newer code and Claude left unchanged ("Still accurate"); a checked section in
 * `sections` was fixed ("Updated"). page-fill returns nothing, without calling Claude, when nothing is empty or
 * outdated. Selection returns `replacement` only. Nothing is
 * saved: the caller shows the result as "Drafted by Claude" for review. Rejects with an AbortError on `signal`.
 */
export async function draftDocs(input: {
  slug: string;
  name: string;
  docs: Partial<ComponentDocsJson>;
  scope: DraftScope;
  way: DraftWay;
  signal?: AbortSignal;
  onStatus?: (s: string) => void;
}): Promise<{ sections: Partial<Record<ProseKey, ComponentDocsJson[ProseKey]>>; replacement?: string; checked?: ProseKey[] }> {
  const { slug, docs, scope, way, signal, onStatus } = input;
  if (signal?.aborted) throw aborted();
  onStatus?.('Reading the component code');
  const ctx = await docsContext(slug);
  const outdated = scope.kind === 'page-fill' ? await outdatedSections(slug, docs) : undefined;
  const task = scopeTask(scope, docs, outdated);
  if (isEmptyTask(task)) {
    onStatus?.('Every section is written and up to date');
    return { sections: {}, checked: [] };
  }
  const prompt = taskPrompt(ctx, docs, task);
  if (signal?.aborted) throw aborted();
  const r = await viaMyClaude({ slug, name: input.name || ctx.name, path: ctx.files.docs, task, prompt }, signal, onStatus);
  const result = resultFromExchange(task, r);
  onStatus?.('Drafted by Claude AI. Review it before you propose it.');
  return result;
}
