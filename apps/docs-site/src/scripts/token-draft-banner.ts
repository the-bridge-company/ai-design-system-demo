// "Your draft, only in this browser" on Tokens (moved from Changes, Explorations redesign phase 2): the token and docs
// edits kept in this browser, and the way to send them. Hidden while there is no draft.
import { draftCount } from './shell';
import { docsEdits, draftSummary, tokenEdits } from '../lib/docs-draft-model';
import type { Draft } from '../lib/editor-model';
import { sendButton } from '../lib/gh-wording';
import { changesModeOnPage } from './changes-mode';

function readDraft(): Draft {
  try {
    return (JSON.parse(localStorage.getItem('bridge.draft.v1') ?? 'null') as Draft | null) ?? { edits: [] };
  } catch {
    return { edits: [] };
  }
}

function paint() {
  const box = document.getElementById('tk-draft');
  if (!box) return;
  const n = draftCount();
  box.hidden = n === 0;
  if (!n) return;
  const draft = readDraft();
  const what = document.getElementById('tk-draft-n');
  if (what) what.textContent = draftSummary(draft);
  // Docs edits only: send them from the edit mode of the first one's Library page.
  const docs = docsEdits(draft);
  const cta = box.querySelector<HTMLAnchorElement>('a');
  const docsOnly = docs.length > 0 && !tokenEdits(draft).length;
  if (cta && docsOnly) cta.href = `/components/${docs[0]!.slug}/?edit=1`;
  const label = cta?.querySelector('[data-label]') ?? null;
  if (label) label.textContent = sendButton(docsOnly ? 'docs' : 'tokens', changesModeOnPage());
}

export function initTokenDraftBanner() {
  paint();
  document.addEventListener('bridge:draft', paint);
  window.addEventListener('storage', paint);
}
