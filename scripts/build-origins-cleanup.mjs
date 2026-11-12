#!/usr/bin/env node
// Tidies the sample team's build work so Being built and Explorations tell the same story (owner rule 2026-11-12):
// build work only comes from an exploration Dana (the lead) sent to developers, or a library change Dana approved in
// Library review. Designers, developers and PMs never file build requests directly, so nothing reads "Asked by Leo".
// Studio already hides every build item without such an origin (apps/docs-site/src/lib/build-origin.ts); this script
// gives the items the demo keeps their origin, and closes the leftovers of the early demo.
//
// Plan (acme-design-demo/bridge-demo-ds unless said):
//   - Library changes Dana approved, one per status: #59 Table sticky header (Ready to build), #56 Card subtle tone
//     (Being built, Malik's draft #64), #55 Button loading label (Checking, Malik's #63). A `bridge-origin` lead block,
//     "Requested by Dana through Bridge.", and the summary says Dana approved it.
//   - Library pieces the Contact page summary exploration needs (acme-crm-design#2, Malik's #62 and #65 already say
//     "Needed by" it): #52 ProfileHeader, #57 Avatar xl. An exploration `bridge-origin` block, no more Account app (the
//     product left the sample team): its line and its `product: account` label go.
//   - Leftovers nobody from the lead sent: #58 Toast undo, #60 Select search. Closed as not planned, with a comment.
//   - Malik's pull requests #62 to #65: "Requested by Ann/Malik/Sofia." becomes "Approved by Dana." (words only).
//   - acme-crm-design#2 Contact page summary: its Looks right was recorded for Ann, the PM, who never decides. Dana's.
//   - #48 Plan comparison: an Account app exploration (product removed) shipped on 2026-10-25: labelled `archived`.
// Never deletes anything. Idempotent: a second run finds nothing to do. Dry run by default.
//
//   node scripts/build-origins-cleanup.mjs            dry run: prints each change
//   node scripts/build-origins-cleanup.mjs --apply    does it, with the GitHub CLI's token (gh auth login) or GH_TOKEN
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TEAM = 'acme-design-demo/bridge-demo-ds';
export const CRM_COPY = 'acme-design-demo/acme-crm-design';

const lead = (reason) => `<!-- bridge-origin ${JSON.stringify({ kind: 'lead', approvedBy: 'Dana', reason })} -->`;
const fromContactSummary = (piece) =>
  `<!-- bridge-origin ${JSON.stringify({ kind: 'exploration', repo: CRM_COPY, number: 2, product: 'crm', name: 'Contact page summary', pieceTitle: piece })} -->`;

/** What each issue or pull request should become. `replace`: [from, to] text swaps, every occurrence. */
export const TARGETS = [
  {
    repo: TEAM,
    number: 59,
    title: 'Table: keep the header visible on scroll',
    replace: [
      ['Requested by Malik through Bridge.', 'Requested by Dana through Bridge.'],
      ['A stickyHeader option would keep the header row in view.', 'Dana approved a stickyHeader option in Library review: it keeps the header row in view.'],
    ],
    append: lead('rule for every product'),
  },
  {
    repo: TEAM,
    number: 56,
    title: 'Card: a subtle tone for secondary groups',
    replace: [
      ['Requested by Leo through Bridge.', 'Requested by Dana through Bridge.'],
      ['Dana asks for a quieter card: tinted, no border.', 'Dana approved a quieter card in Library review: tinted, no border.'],
    ],
    append: lead('rule for every product'),
  },
  {
    repo: TEAM,
    number: 55,
    title: 'Button: change the label while loading',
    replace: [
      ['Requested by Ann through Bridge.', 'Requested by Dana through Bridge.'],
      ['Ann asks for a loading label (\\"Saving\\") that is announced once.', 'Dana approved a loading label (\\"Saving\\") that is announced once.'],
      ['Ann asks for a loading label ("Saving") that is announced once.', 'Dana approved a loading label ("Saving") that is announced once.'],
    ],
    append: lead('accessibility fix'),
  },
  {
    repo: TEAM,
    number: 52,
    title: 'ProfileHeader: new ProfileHeader for profile and account pages',
    replace: [
      ['Requested by Ann through Bridge.', 'Requested by Dana through Bridge.'],
      ['\n**Product:** Account app\n', '\n'],
      [
        'Dana is designing the Account app profile page and rebuilt the same avatar, name and role block three times in Figma. A ProfileHeader next to PageHeader would give every profile the same top.',
        'Contact page summary in Acme CRM needs the avatar, name and role block every page about one person repeats. Dana approved a ProfileHeader next to PageHeader, so every profile gets the same top.',
      ],
    ],
    append: fromContactSummary('New component: ProfileHeader'),
    removeLabels: ['product: account'],
  },
  {
    repo: TEAM,
    number: 57,
    title: 'Avatar: an xl size for profile pages',
    replace: [
      ['Requested by Sofia through Bridge.', 'Requested by Dana through Bridge.'],
      ['\n**Product:** Account app\n', '\n'],
      [
        'The profile page mock uses a 64px avatar. Avatar stops at lg (40px), so the Account app scales it by hand.',
        'Contact page summary in Acme CRM shows a 64px avatar. Avatar stops at lg (40px), so Dana approved an xl size instead of scaling it by hand.',
      ],
    ],
    append: fromContactSummary('Avatar: xl size'),
    removeLabels: ['product: account'],
  },
  {
    repo: TEAM,
    number: 58,
    title: 'Toast: an undo action after deleting',
    close: 'not_planned',
  },
  {
    repo: TEAM,
    number: 60,
    title: 'Select: a search field when there are many options',
    close: 'not_planned',
  },
  { repo: TEAM, number: 62, title: 'New ProfileHeader component', pull: true, replace: [['Requested by Ann.', 'Approved by Dana.']] },
  { repo: TEAM, number: 63, title: 'Button: loadingLabel announces the action while it runs', pull: true, replace: [['Requested by Malik.', 'Approved by Dana.']] },
  { repo: TEAM, number: 64, title: 'Card: subtle tone for secondary groups', pull: true, replace: [['Requested by Sofia.', 'Approved by Dana.']] },
  { repo: TEAM, number: 65, title: 'Avatar: xl size for profile pages', pull: true, replace: [['Requested by Ann.', 'Approved by Dana.']] },
  {
    repo: CRM_COPY,
    number: 2,
    title: 'Exploration: Contact page summary',
    pull: true,
    replace: [['"kind":"looks-right","at":"2026-11-08T21:55:40.179Z","round":1,"byName":"Ann"', '"kind":"looks-right","at":"2026-11-08T21:55:40.179Z","round":1,"byName":"Dana"']],
  },
  { repo: TEAM, number: 48, title: 'Plan comparison', pull: true, addLabels: ['archived'] },
];

export const CLOSE_COMMENT =
  'Closed while tidying the sample team. Build work comes from an exploration the design lead sends to developers, or a library change the lead approves in Library review: nobody files it directly. Nothing was deleted.';

const labelNames = (labels) => (labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));

/**
 * The writes one target still needs, from the item as GitHub has it now (`{ title, body, state, labels }`). Empty when
 * it is already done. Pure: covered by build-origins-cleanup.test.mjs.
 */
export function planTarget(t, item) {
  const out = [];
  if (!item) return [{ kind: 'missing' }];
  if (t.title && item.title !== t.title) return [{ kind: 'skip', why: `title is now "${item.title}", left as is` }];
  let body = item.body ?? '';
  for (const [from, to] of t.replace ?? []) body = body.split(from).join(to);
  if (t.append && !body.includes(t.append)) body = `${body.trimEnd()}\n\n${t.append}\n`;
  if (body !== (item.body ?? '')) out.push({ kind: 'body', body });
  const labels = labelNames(item.labels);
  for (const l of t.removeLabels ?? []) if (labels.includes(l)) out.push({ kind: 'remove-label', label: l });
  for (const l of t.addLabels ?? []) if (!labels.includes(l)) out.push({ kind: 'add-label', label: l });
  if (t.close && item.state !== 'closed') out.push({ kind: 'comment', body: CLOSE_COMMENT }, { kind: 'close', reason: t.close });
  return out;
}

/** One line per write, for the dry run and the log. */
export function describeWrite(t, w) {
  const at = `${t.repo}#${t.number} ${t.title}`;
  if (w.kind === 'missing') return `${at}: not found, skipped`;
  if (w.kind === 'skip') return `${at}: ${w.why}`;
  if (w.kind === 'body') return `${at}: edit the body (${(t.replace ?? []).length} text swaps${t.append ? ', adds its origin block' : ''})`;
  if (w.kind === 'remove-label') return `${at}: remove the label "${w.label}"`;
  if (w.kind === 'add-label') return `${at}: add the label "${w.label}"`;
  if (w.kind === 'comment') return `${at}: comment why it closes`;
  return `${at}: close as ${w.reason === 'not_planned' ? 'not planned' : w.reason}`;
}

function gh(args, input) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8', ...(input ? { input } : {}) });
}

function read(t) {
  try {
    return JSON.parse(gh([`repos/${t.repo}/issues/${t.number}`]));
  } catch {
    return null;
  }
}

function write(t, w) {
  const path = `repos/${t.repo}/issues/${t.number}`;
  if (w.kind === 'body') gh(['-X', 'PATCH', path, '--input', '-'], JSON.stringify({ body: w.body }));
  else if (w.kind === 'remove-label') gh(['-X', 'DELETE', `${path}/labels/${encodeURIComponent(w.label)}`]);
  else if (w.kind === 'add-label') gh(['-X', 'POST', `${path}/labels`, '--input', '-'], JSON.stringify({ labels: [w.label] }));
  else if (w.kind === 'comment') gh(['-X', 'POST', `${path}/comments`, '--input', '-'], JSON.stringify({ body: w.body }));
  else if (w.kind === 'close') gh(['-X', 'PATCH', path, '--input', '-'], JSON.stringify({ state: 'closed', state_reason: w.reason }));
}

async function main() {
  const apply = process.argv.includes('--apply');
  let failed = 0;
  let todo = 0;
  for (const t of TARGETS) {
    // One read per item (13 reads): the issues endpoint answers pull requests too.
    const writes = planTarget(t, read(t));
    if (!writes.length) console.log(`${t.repo}#${t.number} ${t.title}: already done`);
    for (const w of writes) {
      console.log(describeWrite(t, w));
      if (w.kind === 'missing' || w.kind === 'skip') continue;
      todo++;
      if (!apply) continue;
      try {
        write(t, w);
      } catch (e) {
        failed++;
        console.error(`  FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  console.log(apply ? `Done: ${todo - failed} writes, ${failed} failed.` : `Dry run: ${todo} writes planned, nothing written. Run again with --apply to do them.`);
  if (failed) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
