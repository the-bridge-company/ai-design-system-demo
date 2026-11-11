// Check the build, region by region (Studio review mode, components/ds/studio/BuildReview.tsx): the words and the pure
// rules of the page, from what Bridge's server answers (api/contribute action build-review, api/_lib/build-review.ts).
// Designer words only: never a commit, a pull request, a pixel or a diff.

export type SizeKey = 'laptop' | 'small' | 'phone';
export type Side = 'a' | 'b';
export type Verdict = 'fine' | 'fix';
export type Role = 'designer' | 'pm' | 'lead';
export type Box = [number, number, number, number];

export interface ReviewFact {
  k: string;
  label: string;
  was: string;
  now: string;
  n: number;
  wasName?: string;
  nowName?: string;
}

/** One side of a measured color: the swatch, the library's name when it is one, the hex for the tooltip. */
export interface ColorWord {
  css: string;
  name: string;
  hex: string;
}
export interface ReviewItem {
  n: number;
  sig: string;
  name: string;
  line: string;
  facts: ReviewFact[];
  sizes: SizeKey[];
  boxes: Partial<Record<SizeKey, { a: Box | null; b: Box | null }>>;
  crop: { size: SizeKey; a?: string; b?: string; f?: string };
}
export interface ReviewShot {
  image: string;
  w: number;
  h: number;
  pageW: number;
  pageH: number;
}
export interface ReviewSize {
  key: SizeKey;
  width: number;
  height: number;
  a: ReviewShot | null;
  b: ReviewShot | null;
  missing: { a?: string; b?: string };
}
export interface ReviewMeasure {
  run: string;
  head: string;
  measuredAt: string;
  route: string | null;
  urls: { approved: string | null; build: string | null };
  sizes: ReviewSize[];
  items: ReviewItem[];
  ignored: number;
}
export interface ItemState {
  sig: string;
  mine: Verdict | null;
  carried: boolean;
  askedBefore: boolean;
  others: { role: Role; byName: string; verdict: Verdict; at: string }[];
}
export interface NoteReply {
  byName: string;
  role: Role;
  text: string;
  at: string;
}
export interface NoteThread {
  id: string;
  sig: string;
  n: number;
  name: string;
  size: SizeKey;
  side: Side;
  x: number;
  y: number;
  byName: string;
  role: Role;
  text: string;
  at: string;
  round: number;
  resolved: { byName: string; at: string } | null;
  replies: NoteReply[];
}
/** What the server answers to build-review. */
export interface ReviewRead {
  ready: true;
  state: 'pending' | 'success' | 'failure';
  rows: { role: Role; required: boolean; state: 'looks-right' | 'changes' | 'waiting'; byName?: string; text?: string; why?: 'build' | 'design' }[];
  head: string;
  code: string;
  round: number;
  role: Role | null;
  me: string;
  pm: string | null;
  pull: { number: number; url: string; ref?: string; builder?: string; builderName?: string };
  designerName?: string;
  exploration: { name: string; screen: string | null; branch: string | null };
  review: ReviewMeasure | null;
  queued: boolean;
  items: ItemState[];
  fixed: { sig: string; name: string }[];
  meant: string[];
  notes: NoteThread[];
  handover: { decisions: string[]; edgeCases: { component: string; state: string; covered: boolean }[] };
  /** The handover notes someone found working in the build this round (shared: one tick for the check). */
  ticks?: Tick[];
}

/** A handover note ticked as found in the build: its key (noteKey), who ticked it and when. */
export interface Tick {
  key: string;
  byName: string;
  role: Role;
  at: string;
}

export const SIZE_WORDS: Record<SizeKey, string> = { laptop: 'Laptop', small: 'Small laptop', phone: 'Phone' };
const PART: Record<Role, string> = { designer: 'designer', pm: 'product manager', lead: 'design lead' };

export const REVIEW_WORDS = {
  back: 'Back',
  title: (builder: string) => `Check ${possessive(builder)} build`,
  /** The page's one h1 before the build is read (who built it is not known yet). */
  plainTitle: 'Check the build',
  sub: (name: string, round: number) => `${name} · round ${round}`,
  sizes: 'Size',
  realBuild: 'Open the real build',
  progress: (done: number, total: number) => `${done} of ${total} looked at`,
  differs: 'Where the build differs',
  phoneOnly: 'Phone only',
  staysApproved: (n: number, round: number) => `${n === 1 ? '1 difference stays' : `${n} differences stay`} approved from round ${round - 1}`,
  fixedSince: (n: number) => `${n === 1 ? '1 thing' : `${n} things`} you asked for last round no longer differ`,
  notes: 'From your handover notes',
  decision: 'Decision',
  edgeCase: 'Edge case',
  openYourself: 'Open the build yourself',
  sendAnswer: 'Send your answer',
  lookFirst: (n: number) => `${n} still to look at.`,
  allLooked: 'You looked at each one. Send your answer.',
  canvas: 'Show',
  build: 'Build',
  approved: 'Approved design',
  both: 'Both',
  wholePage: 'Whole page',
  whereItIs: 'Where it is',
  builtBy: (builder: string) => `${possessive(builder)} build`,
  ignored: (n: number) => `Left out: ${n === 1 ? '1 tiny shift' : `${n} tiny shifts`} from fonts, rounding and live dates`,
  of: (i: number, total: number) => `${i} of ${total}`,
  where: (sizes: readonly SizeKey[]) =>
    sizes.length === 3 ? 'seen at every size' : sizes.length === 1 && sizes[0] === 'phone' ? 'only on a phone' : `seen on ${sizes.map((s) => SIZE_WORDS[s].toLowerCase()).join(' and ')}`,
  question: 'Is this difference fine?',
  fine: 'Fine as built',
  fix: 'Fix this',
  orDesign: 'Or the design should change instead:',
  changeDesign: 'Change the design',
  meant: (builder: string) => `${builder} mentions it in their note.`,
  askedBefore: 'Asked to fix last round, and it still differs.',
  othersOn: 'Others on this one',
  said: (v: Verdict) => (v === 'fine' ? 'Fine as built' : 'Fix this'),
  comments: 'Comments',
  pinHint: 'Click the picture to pin a comment on the spot.',
  pinHere: 'Your comment on this spot',
  pinSend: 'Comment',
  pinCancel: 'Cancel',
  pinReach: (builder: string) => `${builder} sees it in their task, with this picture.`,
  reply: 'Answer',
  replySend: 'Send',
  resolve: 'Resolve',
  reopen: 'Open again',
  resolvedBy: (name: string) => `Resolved by ${name}`,
  previous: 'Previous difference',
  next: 'Next difference',
  answerKicker: 'Your answer',
  needsChanges: 'Needs changes',
  looksRight: 'Looks right',
  answerLine: (fixes: number, kept: number, round: number) =>
    fixes
      ? `${fixes === 1 ? '1 thing' : `${fixes} things`} to fix in the build.${kept ? ` The other ${kept} look right, and stay approved in round ${round + 1}.` : ''}`
      : 'Every difference is fine as built.',
  stillOpen: (n: number) => `${n === 1 ? '1 difference is' : `${n} differences are`} not looked at yet. They stay open for the next round.`,
  noteLabel: (builder: string) => `Anything else for ${builder} (optional)`,
  sendTo: (builder: string) => `Send to ${builder}`,
  sayLooksRight: 'Say it looks right',
  designInstead: 'The design must change',
  designLabel: (designer: string) => `What changes in the design? ${designer} gets it for a new round.`,
  sendDesign: 'Send it back to design',
  othersAnswer: (names: string[]) => (names.length ? `${list(names)} ${names.length === 1 ? 'answers' : 'answer'} on their own. The build ships when you all say it looks right.` : 'The build ships when you say it looks right.'),
  sentKicker: (builder: string) => `Sent to ${builder}`,
  sentFixes: (builder: string, n: number) => `${builder} fixes ${n === 1 ? '1 thing' : `${n} things`}`,
  sentLine: (others: string[]) => `${others.length ? `You and ${list(others)} check` : 'You check'} again when there is a new build. Bridge tells you.`,
  sentOk: 'Looks right to you',
  sentOkLine: 'Bridge said so on the build. A new build asks you again.',
  sentDesign: (designer: string) => `${designer} reworks the design`,
  backToExploration: 'Back to the exploration',
  reading: 'Reading the build check…',
  measuring: (builder: string) => `Bridge is measuring ${possessive(builder)} build against your approved design. It takes a few minutes; this page fills in by itself.`,
  olderMeasure: 'Measured on an earlier version of the build. Bridge is measuring the new one.',
  notReady: 'The developers have not shown a build yet.',
  noPage: (side: Side, size: SizeKey) => `${side === 'b' ? 'The build' : 'The approved design'} has no page at this address at ${SIZE_WORDS[size].toLowerCase()} size.`,
  noDifference: 'Bridge found no difference here. Look at the real build if something feels off.',
  readOnly: 'You can look. Only the designer, the product manager or a design lead answers.',
  commentStill: 'You can still comment on a difference.',
  failed: 'Bridge could not read this check. Reload the page in a minute.',
  phoneOf: (i: number, total: number) => `${i} of ${total} · phone size`,
  done: 'Your answer',
  entryTitle: 'The build, compared with your approved design',
  start: 'Start the check',
  look: 'Look at the check',
  openBuildOf: (owner: string) => `Open ${owner} build`,
} as const;

/**
 * The entry's three facts (exploration page, BuildReviewEntry): where the build differs and how many only on a phone,
 * the things to check from the handover notes, what the developer mentions in their note. Only those with a number. Pure.
 */
export function entryFacts(d: Pick<ReviewRead, 'review' | 'items' | 'handover' | 'meant'>, builder: string): { key: string; n: number; line: string }[] {
  const open = standing(d.review?.items ?? [], d.items, {}).open;
  const phone = groupsOf(open).phone.length;
  const notes = d.handover.decisions.length + d.handover.edgeCases.length;
  const meant = open.filter((i) => d.meant.includes(i.sig)).length;
  const out = [
    { key: 'differ', n: open.length, line: `${open.length === 1 ? 'place differs' : 'places differ'} from your approved design${phone ? `, ${phone} only on a phone` : ''}` },
    { key: 'notes', n: notes, line: `${notes === 1 ? 'thing' : 'things'} to check from your handover notes` },
    { key: 'meant', n: meant, line: `${meant === 1 ? 'difference' : 'differences'} ${builder} mentions in their note` },
  ];
  return out.filter((f) => f.n > 0);
}

export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
export function list(xs: readonly string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** The review mode's address for an exploration of a product (relative to the team's Studio base). */
export function reviewPath(exploration: number, product: string): string {
  return `explorations/review/?exploration=${exploration}&product=${encodeURIComponent(product)}`;
}

/** "rgb(11, 74, 139)" as "#0B4A8B", "rgba(0, 0, 0, 0)" as "none": a color as a designer reads it. */
export function colorWord(v: string): string {
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (!m) return v;
  const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (p.length > 3 && (p[3] ?? 1) < 0.05) return 'none';
  const hex = p
    .slice(0, 3)
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `#${hex}`;
}

/**
 * A measured fact as the panel says it: its label, what the design says (null when nothing), what the build shows.
 * A color comes as a swatch with the library's name (text default), never a hex to read: the hex is the tooltip.
 */
export function factWords(f: ReviewFact): { label: string; was: string | null; now: string; colors?: { was: ColorWord; now: ColorWord } } {
  if (f.k === 'added') return { label: 'Not in the design', was: null, now: f.now };
  if (f.k === 'missing') return { label: 'Missing', was: f.was, now: 'not in the build' };
  if (f.k === 'order') return { label: 'Order', was: null, now: `${f.now} before ${f.was}` };
  if (['color', 'fill', 'border'].includes(f.k)) {
    const side = (v: string, name?: string): ColorWord => {
      const hex = colorWord(v);
      return { css: hex === 'none' ? 'transparent' : hex, hex, name: hex === 'none' ? 'none' : (name ?? 'not a library color') };
    };
    const was = side(f.was, f.wasName);
    const now = side(f.now, f.nowName);
    return { label: f.label, was: was.name, now: now.name, colors: { was, now } };
  }
  return { label: f.label, was: f.was || null, now: f.now || 'none' };
}

/** The list's groups: what differs at laptop sizes (any size but phone alone), then on a phone only. Pure. */
export function groupsOf(items: readonly ReviewItem[]): { wide: ReviewItem[]; phone: ReviewItem[] } {
  const phoneOnly = (i: ReviewItem) => i.sizes.length > 0 && i.sizes.every((s) => s === 'phone');
  return { wide: items.filter((i) => !phoneOnly(i)), phone: items.filter(phoneOnly) };
}

/** How many differences each size shows. Pure. */
export function sizeCounts(items: readonly ReviewItem[]): Record<SizeKey, number> {
  const out: Record<SizeKey, number> = { laptop: 0, small: 0, phone: 0 };
  for (const i of items) for (const s of i.sizes) out[s]++;
  return out;
}

/**
 * Where each difference stands for the reader: their word (theirs this round, with what they just clicked), or the
 * earlier round's Fine that carries over. `open` are the ones left to look at; `kept` the ones that stay approved
 * from an earlier round (listed apart, not to look at again). Pure.
 */
export function standing(items: readonly ReviewItem[], states: readonly ItemState[], local: Readonly<Record<string, Verdict | null>>): { verdict: Record<string, Verdict | null>; open: ReviewItem[]; kept: ReviewItem[]; fixes: ReviewItem[]; fine: ReviewItem[]; looked: number } {
  const verdict: Record<string, Verdict | null> = {};
  const kept: ReviewItem[] = [];
  const open: ReviewItem[] = [];
  for (const it of items) {
    const s = states.find((x) => x.sig === it.sig);
    const mine = it.sig in local ? (local[it.sig] ?? null) : (s?.mine ?? null);
    verdict[it.sig] = mine;
    if (!mine && s?.carried) kept.push(it);
    else open.push(it);
  }
  const fixes = open.filter((i) => verdict[i.sig] === 'fix');
  const fine = open.filter((i) => verdict[i.sig] === 'fine');
  return { verdict, open, kept, fixes, fine, looked: fixes.length + fine.length };
}

/** The text sent with Needs changes when the person wrote nothing more: the things to fix by name. Pure. */
export function changesText(fixes: readonly Pick<ReviewItem, 'n' | 'name'>[], note: string): string {
  const head = `${fixes.length === 1 ? '1 thing' : `${fixes.length} things`} to fix: ${fixes.map((f) => `${f.n}. ${f.name}`).join(', ')}.`;
  return note.trim() ? `${head}\n\n${note.trim()}` : head;
}

/** A box on a page picture, in percent of the page (CSS left, top, width, height). Pure. */
export function boxPercent(box: Box, shot: Pick<ReviewShot, 'pageW' | 'pageH'>): { left: string; top: string; width: string; height: string } {
  const pc = (v: number, of: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, of)) * 100)).toFixed(3)}%`;
  return { left: pc(box[0], shot.pageW), top: pc(box[1], shot.pageH), width: pc(box[2], shot.pageW), height: pc(box[3], shot.pageH) };
}

/** The roles that check besides the reader, by the names they go by: they answer on their own. Pure. */
export function otherCheckers(rows: ReviewRead['rows'], me: Role | null, names: { designer: string; pm: string | null }): string[] {
  return rows
    .filter((r) => r.required && r.role !== me)
    .map((r) => r.byName ?? (r.role === 'designer' ? names.designer : r.role === 'pm' ? (names.pm ?? 'the product manager') : 'a design lead'));
}

export const partOf = (r: Role) => PART[r];

/** "2 min ago", "3 h ago", "Nov 8": when something was said. Pure. */
export function whenWords(at: string, now = Date.now()): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const m = Math.round((now - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- The summary on the exploration page (components/ds/studio/BuildReviewEntry.tsx): the ledger of differences -----

export const LEDGER_WORDS = {
  label: 'Where the build differs from the approved design',
  measured: (at: string, sizes: number, now = Date.now()) => {
    const when = whenWords(at, now);
    return `Measured ${when === 'now' ? 'just now' : when}${sizes ? ` at ${sizes === 1 ? '1 size' : `${sizes} sizes`}` : ''}`;
  },
  title: (builder: string, designer: string | null) => `Where ${possessive(builder)} build differs from ${designer ? `${possessive(designer)} design` : 'your design'}`,
  start: 'Start the check',
  continue: 'Continue',
  send: (builder: string) => `Send your answer to ${builder}`,
  look: 'Look at the differences',
  lookAt: (n: number) => `Look at ${n}`,
  lookAtLabel: (n: number, name: string) => `Look at ${n}, ${name}`,
  approved: 'Approved design',
  builtBy: (builder: string) => `${possessive(builder)} build`,
  either: (designer: string, builder: string) => `${designer} or you can answer. The first answer goes to ${builder}.`,
  answeredFirst: (name: string, builder: string) => `${name} answered, sent to ${builder}`,
  addComment: 'Add a comment',
  notesTitle: (designer: string | null) => (designer ? `${possessive(designer)} handover notes` : 'Your handover notes'),
  notesLeft: (left: number, total: number) => (left === 0 ? `All ${total} found in the build` : `${left} to find in the build`),
  notesHint: (builder: string) => `Bridge cannot measure these. Tick each one you see working in ${possessive(builder)} build.`,
  show: 'Show',
  hide: 'Hide',
  turnTitle: (builder: string, designer: string | null) => `Does ${possessive(builder)} build match ${designer ? `${possessive(designer)} design` : 'your design'}?`,
  progress: (done: number, total: number) => `${done} of ${total} answered`,
  waitingOn: (name: string) => `Waiting on ${name}`,
  tickFailed: 'Bridge could not save that tick. Try again.',
} as const;

/** The check page's stepper (BuildReview): one step per difference, then Send to the developer. */
export const STEP_WORDS = {
  label: 'Differences to look at',
  around: 'Previous and next difference',
  of: (i: number, total: number) => `${i} of ${total}`,
  send: 'Send',
  sendTo: (builder: string) => `Send to ${builder}`,
  previous: 'Previous step',
  next: 'Next step',
  toLook: 'To look at',
  fine: 'Fine as built',
  fix: 'Fix this',
  phone: 'Only on a phone',
  stateOf: (v: Verdict | null) => (v === 'fine' ? 'Fine as built' : v === 'fix' ? 'Fix this' : 'To look at'),
  recapTitle: (builder: string) => `Send your answer to ${builder}`,
  recapLine: (looked: number, total: number, fixes: number, fine: number, builder: string) =>
    `${looked === total ? `You looked at all ${total}.` : `You looked at ${looked} of ${total}.`} ${
      fixes ? `${fixes} to fix, ${fine} fine as built. ${builder} gets each one with its pictures and comments.` : 'Every one you looked at is fine as built.'
    }`,
  change: 'Change',
  changeLabel: (n: number, name: string) => `Change ${n}, ${name}`,
  fineFolded: 'Fine as built',
  notesFound: (found: number, total: number) => `${found} of ${total} found in the build`,
  found: 'Found in the build',
  notFound: 'Not ticked yet',
  designInstead: 'The design must change instead',
} as const;

/** A handover note as a line of the checklist: its stable key, its kind, its words. */
export interface HandoverRow {
  key: string;
  kind: 'Decision' | 'Edge case';
  text: string;
}

/** A short stable key for a handover note's words (FNV-1a, 32 bits): "h" and 8 hex. The server checks it the same way. Pure. */
export function noteKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `h${h.toString(16).padStart(8, '0')}`;
}

/** The handover notes as checklist rows: decisions, then edge cases. Pure. */
export function handoverRows(h: ReviewRead['handover']): HandoverRow[] {
  return [
    ...h.decisions.map((text) => ({ key: noteKey(`decision:${text}`), kind: 'Decision' as const, text })),
    ...h.edgeCases.map((e) => ({ key: noteKey(`edge:${e.component}:${e.state}`), kind: 'Edge case' as const, text: e.state })),
  ];
}

/** Where the checklist of handover notes stands: the ones found, how many are left, whether it starts folded. Pure. */
export function notesState(rows: readonly HandoverRow[], ticks: readonly Pick<Tick, 'key'>[], started: boolean): { found: Set<string>; left: number; folded: boolean } {
  const found = new Set(ticks.map((t) => t.key).filter((k) => rows.some((r) => r.key === k)));
  return { found, left: rows.length - found.size, folded: !started && found.size === 0 };
}

/** The other person who may answer and already did (the designer for a lead, the lead for the designer). */
export interface FirstAnswer {
  byName: string;
  role: Role;
  answer: string;
  text: string | null;
}

/** Whoever answered the check first on this build, when it is not the reader: their answer went to the developer. Pure. */
export function firstAnswerOf(d: Pick<ReviewRead, 'rows' | 'role' | 'designerName'>): FirstAnswer | null {
  if (d.role !== 'designer' && d.role !== 'lead') return null;
  const r = d.rows.find((x) => (x.role === 'designer' || x.role === 'lead') && x.role !== d.role && x.state !== 'waiting');
  if (!r) return null;
  const byName = r.byName ?? (r.role === 'designer' ? (d.designerName ?? 'The designer') : 'The design lead');
  const answer = r.state === 'looks-right' ? 'Looks right' : r.why === 'design' ? 'The design must change' : 'Needs changes';
  return { byName, role: r.role, answer, text: r.text?.trim() || null };
}

/** "Sofia or you can answer": the reader is a lead and the designer has not answered yet. Pure. */
export function eitherLine(d: Pick<ReviewRead, 'rows' | 'role' | 'designerName'>, builder: string): string | null {
  if (d.role !== 'lead' || firstAnswerOf(d)) return null;
  const mine = d.rows.find((r) => r.role === 'lead' && r.state !== 'waiting');
  return mine ? null : LEDGER_WORDS.either(d.designerName ?? 'The designer', builder);
}

export type LedgerCta = 'start' | 'continue' | 'send' | 'look' | null;

export interface Ledger {
  total: number;
  phone: number;
  done: number;
  fixes: number;
  /** Every difference to look at, in the list's order (laptop sizes, then phone only), one line each with its answer. */
  rows: { it: ReviewItem; verdict: Verdict | null }[];
  /** Still to answer, in the list's order: Start the check and Continue open the first. */
  todo: ReviewItem[];
  /** The header's one primary: it follows progress, never the row picked. */
  cta: LedgerCta;
  sub: string;
}

export const isPhoneOnly = (i: Pick<ReviewItem, 'sizes'>) => i.sizes.length > 0 && i.sizes.every((s) => s === 'phone');

/**
 * The answer on each difference as the page shows it: the reader's own; once the designer or a lead answered first,
 * theirs (the reader has no verdict left to give). Pure.
 */
export function verdictsOf(d: Pick<ReviewRead, 'review' | 'items' | 'role' | 'rows' | 'designerName'>): Record<string, Verdict | null> {
  const first = firstAnswerOf(d);
  const out: Record<string, Verdict | null> = {};
  for (const it of d.review?.items ?? []) {
    const s = d.items.find((x) => x.sig === it.sig);
    out[it.sig] = first ? (s?.others.find((o) => o.role === first.role)?.verdict ?? null) : (s?.mine ?? null);
  }
  return out;
}

/** The header's primary by progress: Start the check, Continue, Send your answer; Look for who cannot answer. Pure. */
export function ctaOf(done: number, total: number, canAnswer: boolean, answeredByOther: boolean): LedgerCta {
  if (!canAnswer) return 'look';
  if (answeredByOther || total === 0) return null;
  if (done === 0) return 'start';
  return done < total ? 'continue' : 'send';
}

/**
 * The summary of the check for the reader: every open difference one line each (laptop sizes, then phone only) with
 * its answer, what is left, the header's primary and its line ("8 differences, 3 only on a phone" until the first
 * answer, then "2 of 8 answered · 1 to fix so far"). Pure.
 */
export function ledgerOf(d: Pick<ReviewRead, 'review' | 'items' | 'role' | 'rows' | 'designerName'>): Ledger {
  const st = standing(d.review?.items ?? [], d.items, {});
  const g = groupsOf(st.open);
  const open = [...g.wide, ...g.phone];
  const v = verdictsOf(d);
  const rows = open.map((it) => ({ it, verdict: v[it.sig] ?? null }));
  const todo = rows.filter((r) => !r.verdict).map((r) => r.it);
  const total = open.length;
  const done = total - todo.length;
  const fixes = rows.filter((r) => r.verdict === 'fix').length;
  const phone = g.phone.length;
  const head = `${total === 1 ? '1 difference' : `${total} differences`}${phone ? `, ${phone} only on a phone` : ''}`;
  const progress = `${LEDGER_WORDS.progress(done, total)}${fixes ? ` · ${fixes} to fix${done < total ? ' so far' : ''}` : ''}`;
  return { total, phone, done, fixes, rows, todo, cta: ctaOf(done, total, Boolean(d.role), Boolean(firstAnswerOf(d))), sub: done > 0 ? progress : head };
}
