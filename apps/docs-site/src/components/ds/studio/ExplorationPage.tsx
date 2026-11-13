// The exploration page while it runs, the validated boards X1 and X2 (Changes > <product> > <exploration>):
// - X1, not started (nothing on the branch beyond the Bridge note): "Not started", who started it, the "Nothing built
//   yet" panel with the line to paste in the viewer's own AI tools only (AiToolPanel.tsx: Claude app, Terminal, VS
//   Code with Copilot; one tool: no tabs; never answered: the inferred ones and "Use another AI tool?"), the tool's
//   button ("Continue in Claude" opens a new Claude conversation with the line in it, after the connect steps while
//   the viewer's own Claude has no Bridge yet: ConnectClaudeDialog; copies it for the Terminal; "Copy for Copilot"),
//   "See the product today", and an empty "Your preview" frame.
// - From the first change on (exploring, waiting for the lead, handed to developers, Check the build, shipped), one
//   board (the approved redesign, Nov 2026; rules by stage and role in lib/exploration-layout.ts, parts in
//   ExplorationParts.tsx). Header: the title, ONE status tag (the only place the stage is said), Code for a developer
//   once the work is theirs, and "..."; under it one plain line, "Sofia's exploration in Acme CRM, started Nov 6". Left:
//   the screen (the capture is the link to the preview; in Check the build the approved version and the build side by
//   side, never two different screens), What this changes in the library (LibraryImpact.tsx), then Activity, one
//   timeline with the decisions and the comment box naming who reads it. Right: the "Your turn" Harbor zone only when
//   the viewer acts now (one primary action, alternatives first), Before it ships (the people and their last word), the
//   four-step bar naming the next step (every step on demand), and the handover notes (WhereItStands.tsx). Phones:
//   Your turn, the screen, the rail, the library, Activity. A write's line is a DS toast.
// - "Send to Figma", under the screen for who can edit when the team has a Figma file: it hands the request to the
//   viewer's own Claude, which rebuilds the exploration in Figma. Once Claude recorded the page, the link.
// The "..." menu holds Rename (a DS Dialog), Choose the screen it opens on, Back to exploring (a confirmation, waiting
// for code only), Take it back, Take it over, Hand over, the lead's other answers, and Archive. Designers never see
// git. Data: scripts/exploration-page.ts over lib/exploration-page.ts. Styles: styles/exploration-page.css.
import { createContext, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Archive, ArrowRightLeft, Ban, ChevronLeft, Ellipsis, ExternalLink, Link as LinkIcon, MonitorSmartphone, Pencil, Undo2, UserCheck, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Dialog,
  DialogClose,
  DialogContent,
  Icon,
  IconButton,
  Input,
  Link,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
  Spinner,
  Stepper,
  Textarea,
  ToastProvider,
  TokenValue,
  Tooltip,
  useToast,
  VisuallyHidden,
} from '@bridge-ds/react';
import ButtonLink from '../ButtonLink';
import { BuildCheck } from './BuildCheck';
import { BuildReviewEntry } from './BuildReviewEntry';
import { BUILD_WORDS, type BuildCheckView } from '../../../lib/build-check-view';
import { Drawing } from './Drawing';
import { Who } from './faces';
import type { DesignAnswer, LifecycleStage } from '../../../lib/review-state';
import { atRoute } from '../../../lib/at-route';
import { COPY_WORDS } from '../../../lib/design-copy';
import { clipQuote, DECLINED_LINE, explorationTag, questionWords, type ActivityRow, type DoneAction, type HandoffStatus, type HandoffStep, type LibraryPieces, type PageFace, type SentPiece } from '../../../lib/exploration-page';
import { studioHref } from '../../../lib/team-path';
import { ARCHIVED_LINE } from '../../../lib/explorations-view';
import { calendarDays, EXPLORATION_STAGE_LABEL, startedWhen } from '@bridge-ds/core';
import { plateDrawing } from '../../../lib/branch-thumb';
import { capturedLine } from '../../../lib/preview-shots';
import { CONNECT_FIRST, connectFirst, TERMINAL_SETUP_LINE } from '../../../lib/claude-connector';
import type { AiTool } from '../../../lib/ai-tools';
import { DEV_MESSAGE_WORDS } from '../../../lib/developers-message';
import { useCopy } from './TeamLink';
import { ClaudeGlyph, claudeNewUrl, ConnectClaudeButton, ConnectFirst, ToolAction, ToolPanel, useAiTools, useClaudeRecheck, type ToolLines, type ToolSetup } from './AiToolPanel';
import { WhereItStands, type WhereItStandsView } from './WhereItStands';
import { LibraryImpact, type LibraryImpactActions } from './LibraryImpact';
import type { LibraryImpactView } from '../../../lib/library-impact-view';
import { DesignerZone, HandOverDialog, NotDoingZone, WhyDialog, type DesignerZoneView, type HandOverPerson, type LeadBarView, type NotDoingView, type PmView } from './LeadDecisions';
import { AskQuote, CodeButton, Composer, ScreenStage, Timeline, TurnSteps, TurnZone } from './ExplorationParts';
import { aboutLine, canSayDone, codeShown, screenNameOfRoute, handOverTitle, notesContext, ownerLine, pageStageOf, pmBlockOf, repeatsTitle, sameScreen, SCREEN_WORDS, stagedPieces, leadDecisions, leadTurnWords, sendTickLine, sharedChoiceOf, timelineOf, TURN_WORDS, waitBlockOf, writeToLine, zoneOf, type CheckPerson, type LeadDecision, type PageRole, type TurnBlock } from '../../../lib/exploration-layout';
import { PM_WORDS } from '../../../lib/pm-view';
import type { DecisionRowView } from '../../../lib/lead-decisions';
import { statusTagClass, statusTagDot } from '../../../lib/status-tag';
import { SEP, SEP_SPLIT } from '../../../lib/sep';
import { usePageTitle } from '../../../lib/page-title';

export { claudeNewUrl };

export type ExplorationStage = 'loading' | 'not-started' | 'exploring' | 'handed-off';

/** Waiting for the design lead: one line, their answer when the viewer is a lead, Keep exploring for who asked. */
export interface LeadView {
  line: string;
  /** The zone's title, when it is not the question of the bar (a lead whose question waits on the designer). */
  heading?: string;
  /** The review bar, for a lead (LeadDecisions.tsx). */
  bar?: LeadBarView | null;
  /** "I'll look", for a reviewer while nobody took it; once taken, who is looking at it. */
  take?: { onTake?: () => Promise<string | void>; line?: string } | null;
  /**
   * The design review's hat (two reviews, core HAT_WORDS): "Your turn: design review", "You review the screen as Acme
   * Prints design lead". Its Looks right answers the screen only; library pieces have their own decision on their row.
   */
  hat?: { eyebrow: string; as: string } | null;
  onCancel?: (() => Promise<string | void>) | null;
}

/** After Done exploring: where it stands, the four steps, and what the library gets from it. */
export interface HandoffView {
  status: HandoffStatus;
  /** The lifecycle's stage (lib/review-state): In review and In the next release have their own tag. */
  stage?: LifecycleStage | null;
  /** Who said Done exploring, and when in words ("Oct 30"). */
  doneBy: PageFace | null;
  doneWhen: string;
  steps: HandoffStep[];
  pieces: LibraryPieces;
  /** The one action of a piece still without a library side (send it), when this viewer can. */
  onPiece?: ((piece: SentPiece) => Promise<string | void>) | null;
  /**
   * The designer's answer on the developers' version (a design copy exploration whose developers opened their pull
   * request): Looks right, or Needs changes with a short text. Null when there is nothing to answer or the viewer cannot.
   */
  onAnswer?: ((a: DesignAnswer) => Promise<string | void>) | null;
  /** Check the build (board R4): who checks the developers' version and their answers, read through Bridge's server. */
  check?: BuildCheckView | null;
  /** The developers' version, next to the approved one while it is checked. */
  build?: { url: string | null; builder: string; shot?: { src: string; capturedAt: string | null; route?: string | null } | null } | null;
  /**
   * Someone asked the designer something on the task: their words (plain text; null when only a label asks),
   * who and when, whether the designer answered since, and the reply when this viewer can write it.
   */
  question?: {
    text: string | null;
    by: PageFace | null;
    when: string;
    answered: boolean;
    onReply?: ((text: string) => Promise<string | void>) | null;
  } | null;
  /** The developers closed it without building it: their last word, when they left one. */
  declined?: { note: { text: string; by: PageFace; when: string } | null } | null;
  /**
   * A product added from its address, for a team member: its developers work elsewhere, so "Copy for your developers"
   * sits on the "Developers build it" step with the plain message to paste where they work (lib/developers-message).
   */
  forDevelopers?: { message: string } | null;
}

export interface ExplorationPageProps {
  number: number;
  /** The viewer's part on this page (lib/exploration-layout pageRoleOf). Unset: read from the lead bar, the PM view and Done exploring. */
  role?: PageRole;
  /** The design lead who decides next, by name: "Ready to hand it to Dana?", "Then Dana picks what the library keeps". */
  leadName?: string | null;
  /** When the design lead was asked (ISO, the exploration's designAskedAt): the day of Bridge's reminder in the card. */
  designAskedAt?: string | null;
  /**
   * The owner is a design lead themselves: with no other lead named, the page talks to them ("Then you pick what the
   * library keeps"), never "your design lead"; a lead it waits on is "Another design lead" until named.
   */
  ownerLeads?: boolean;
  /** The viewer's own face (their name and avatar), for the "You" row and the comment box. */
  me?: PageFace | null;
  /** What the exploration sets out to do (its purpose): one plain sentence under the screen's name. */
  purpose?: string | null;
  /**
   * The mockup it started from (a Figma frame or a Claude Design page): "Started from Contacts v3", linked, under the
   * owner line. Its label is the name designers know (mockupShownName), never a node id.
   */
  startedFrom?: { label: string; url: string } | null;
  /**
   * Once the library check recorded the pieces the mockup's build lacks: "2 pieces the library doesn't have" on the
   * same line, with the pieces' names for when the page does not list them. Unset: only "Started from".
   */
  fromMockup?: { count: string; pieces: string[] } | null;
  /** The route the exploration's capture shows ("/#/contacts/31/show"): Check the build never compares two different screens. */
  thumbRoute?: string | null;
  /**
   * Check the build: the review mode's entry (its facts, the changed regions, "Start the check"), from its own route's
   * component. Unset: the two versions only.
   */
  checkEntry?: ReactNode;
  crumbs: { label: string; href?: string }[];
  title: string;
  stage: ExplorationStage;
  /** Who started it, and " · Admin demo · today" after the name. */
  author: PageFace;
  startedTail: string;
  /** The line to paste, per tool: the Claude app's line also goes to Copilot Chat. */
  lines: { app: string; terminal: string };
  /** The product as it is today (X1's quiet link); null when not set up. */
  todayUrl: string | null;
  /** "See the library today" for a library exploration, else "See the product today". */
  todayLabel?: string;
  /** X2: who changed what, when. Null while unread or when nothing reads. */
  headline: ActivityRow | null;
  /** X2: the branch's own build; null while it has none (the note says why in words). */
  previewUrl: string | null;
  /**
   * X2: the same build opened with the Bridge toolbar (`?bridge=<n>`): Live product and This change on the same screen.
   * "Open the preview" opens it instead of the plain build when set. Null for the library's apps and for a product
   * without a production URL (no Before to flip to).
   */
  tryUrl?: string | null;
  /**
   * The preview's toolbar is older than the read pass (lib/read-pass-link.ts toolbarTakesPass): the link never carries
   * the member's pass, which that toolbar would leave in the address (an empty page).
   */
  tryWithoutPass?: boolean;
  previewNote: string | null;
  /**
   * A running exploration of the design team's copy that misses changes the product made since it started: the quiet
   * line and "Bring the latest in" (merges the copy's main into it). Null when it is up to date or Bridge cannot say.
   */
  latest?: { line: string; onBring: () => Promise<string> } | null;
  /** X2: the preview is building: the button reads "Preview is building" with a spinner, at full contrast. */
  previewBuilding?: boolean;
  /**
   * The screen the exploration changed, in the product's preview (core Exploration.screen: "/#/orders/12"): the
   * preview links and the capture open there. `onSave` (the "..." menu's "Choose the screen it opens on") for who keeps it, null for everyone else:
   * they only get links that land on it.
   */
  screen?: { value: string | null; onSave: ((input: string | null) => Promise<string | void>) | null } | null;
  /**
   * X2: a captured image of the change: the preview capture (lib/preview-shots), else the visual impact's after shot;
   * none: the plate. An image that does not load gives the plate back in the same frame.
   */
  thumb: string | null;
  /** When the preview capture was taken (ISO): "Captured 2 h ago" on the frame. Null for a visual impact shot. */
  thumbCapturedAt?: string | null;
  /** X2: the last 3 events; null while read. */
  activity: ActivityRow[] | null;
  /** The activity could not be read just now: said quietly, never fewer events as if that were all. */
  activityUnread?: boolean;
  done: DoneAction;
  onDone: (focus: HTMLElement | null) => void;
  /** Done exploring asked the design lead and they have not answered yet. */
  lead?: LeadView | null;
  /**
   * The two reviews (lib/review-lines), once the team's reviews are read: the status second line ("Waiting for Dana's
   * design review", or why nothing was reviewed) and, while In review, each review as a current step for the author.
   */
  reviews?: { line: string | null; steps: readonly { text: string; when?: string; current?: boolean; lines?: readonly string[] }[] } | null;
  /** The lead's last open word, for the designer to answer (boards L3, L4). */
  designerZone?: DesignerZoneView | null;
  /** The product manager of its product (boards R1, R3): their own zone for them, where they stand for the others. */
  pm?: PmView | null;
  /** Ended by a lead, with the reason (board L5). */
  notDoing?: NotDoingView | null;
  /** The tag while the talk decides what it is ("Needs changes"), over the lifecycle's own. */
  tag?: { label: string; tone: 'danger' | 'neutral' | 'warning' | 'info' | 'success' } | null;
  /** Everything the designer and their lead said, newest first. */
  decisions?: readonly DecisionRowView[];
  /** "Take it back", for a lead on someone else's exploration no developer started (board L2). */
  onTakeBack?: ((reason: string) => Promise<string | void>) | null;
  /** Developers started: a word on their task, for a lead. */
  onTellDevelopers?: ((text: string) => Promise<string | void>) | null;
  /** "Take it over" and "Hand over" in the "..." menu, for a lead. */
  onTakeOver?: ((reason: string) => Promise<string | void>) | null;
  handOver?: { people: readonly HandOverPerson[]; onConfirm: (to: string, reason: string) => Promise<string | void> } | null;
  /** A lead archiving someone else's work says why: Archive asks first. */
  archiveAsksWhy?: boolean;
  /** Rename in the "..." menu: saves the new name on GitHub; null when not offered. */
  onRename?: ((name: string) => Promise<string | void>) | null;
  /** Back to exploring in the "..." menu (waiting for code, no developer push yet); null when not offered. */
  onReopen?: (() => Promise<string | void>) | null;
  /** Archive in the "..." menu; null when not offered. */
  onArchive: ((reason?: string) => Promise<string | void>) | null;
  /**
   * Archived: hidden from the lists, its preview still works. The page keeps its layout (the preview, the activity),
   * the tag reads Archived, one line says so with Unarchive, and nothing offers Done exploring or to keep working
   * (no Open in Claude Code, Continue in your AI tool or Bring the latest in): the preview is the bar's one action.
   */
  archived?: boolean;
  /** Unarchive, beside the archived line; null when this viewer cannot. */
  onUnarchive?: (() => Promise<string | void>) | null;
  /** Copies a line (clipboard, else a selection fallback). */
  onCopy: (text: string) => Promise<void>;
  developer: { label: string; value: string }[];
  take: { commands: [string, string]; note: string; branch?: string } | null;
  githubUrl: string;
  /** The line a write produced (Done exploring, Archive): shown once as a DS toast. */
  said?: string;
  /** After Done exploring (stage 'handed-off'). */
  handoff?: HandoffView | null;
  /**
   * The product's name and the screen the exploration changed, for the preview plate while no capture exists. `seed`
   * (the exploration's key) picks the same drawing as its card on the Studio home.
   */
  plate?: { product: string; screen: string | null; seed?: string | null } | null;
  /**
   * Has the viewer connected Bridge in their own Claude (scripts/claude-link.ts)? 'no': "Continue in Claude" and
   * "Check in Claude" show the connect steps first (ConnectClaudeDialog). 'yes', 'unknown' or unset (signed out,
   * still reading, a failed read): they open Claude directly.
   */
  claudeLink?: 'yes' | 'no' | 'unknown';
  /** A designer (joined with their email, or with GitHub but working in the copy through Bridge): the Claude app with Bridge is their one tool. */
  emailMember?: boolean;
  /** The connector address the steps show (<origin>/mcp). */
  connectorAddress?: string;
  /** "I've connected it, continue": the page forgets the answer and reads it again next time. */
  onClaudeConnected?: () => void;
  /** The connection read again (useClaudeRecheck, back from Claude): the page repaints with it. */
  onClaudeLink?: (v: 'yes' | 'no' | 'unknown') => void;
  /** A product exploration: the command the Terminal needs once in the product's folder (bridge connect). */
  terminalSetup?: string | null;
  /** The command VS Code needs once for Copilot: bridge connect --tool copilot in a product, code --add-mcp for the library. */
  copilotSetup?: { label: string; command: string } | null;
  /**
   * In the design team's copy of a product (lib/design-copy.ts claudeCodeUrl): "Open in Claude Code" opens the copy on
   * this exploration's branch, and stands for the AI tool panel and its Continue button.
   */
  claudeCodeUrl?: string | null;
  /**
   * "Where it stands": the handover notes (decisions, edge cases, open questions, next step), above the activity while
   * it runs. Editable in place by whoever can edit the exploration (onSave), read only otherwise. Unset: not shown
   * (after Done exploring they stay readable when the branch keeps them).
   */
  notes?: WhereItStandsView | null;
  /** "Send to Figma": the line for the viewer's Claude (lib/exploration-page canPutInFigma). Unset or null: no button. */
  figma?: { app: string; terminal: string } | null;
  /**
   * "What this changes in the library" (boards LI1 to LI4, LI8), under the preview and the zone in every state once it
   * runs: its rows and, for the lead, the answer per piece and the way kept in a conflict. Unset: not shown yet.
   */
  impact?: { view: LibraryImpactView; actions: LibraryImpactActions } | null;
}

/** The tool the panel has open, for the buttons further down the page (Check in Claude, the X2 action). */
const ToolContext = createContext<AiTool>('claude-app');

const linesOf = (p: ExplorationPageProps): ToolLines => ({ 'claude-app': p.lines.app, 'claude-code': p.lines.terminal, copilot: p.lines.app });
const setupOf = (p: ExplorationPageProps): ToolSetup => ({
  'claude-code': p.terminalSetup ? { label: TERMINAL_SETUP_LINE, command: p.terminalSetup } : null,
  copilot: p.copilotSetup ?? null,
});

/** The open tool's button with this page's line and connector gate. */
function ContinueButton({ p, tool, line, say, variant, children, size = 'lg' }: { p: ExplorationPageProps; tool: AiTool; line: string; say: (s: string) => void; variant: 'primary' | 'secondary'; children?: string; size?: 'md' | 'lg' }) {
  if (p.claudeCodeUrl)
    return (
      <ButtonLink variant={variant} size={size} className="xp-continue" href={p.claudeCodeUrl} target="_blank" rel="noopener">
        <ClaudeGlyph />
        Open in Claude Code
      </ButtonLink>
    );
  return (
    <ToolAction
      tool={tool}
      line={line}
      onCopy={p.onCopy}
      say={say}
      variant={variant}
      size={size}
      {...(p.claudeLink ? { claudeLink: p.claudeLink } : {})}
      {...(p.connectorAddress ? { connectorAddress: p.connectorAddress } : {})}
      {...(p.onClaudeConnected ? { onClaudeConnected: p.onClaudeConnected } : {})}
      {...(children ? { children } : {})}
    />
  );
}

/** "Acme CRM" from the "Acme CRM · Nov 6" tail. */
const productOf = (tail: string): string => tail.split(SEP_SPLIT)[0]?.trim() ?? '';

/** "Malik's", "James'". */
const possessive = (name: string): string => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/** Under "Live in Acme CRM": "Since Nov 10, for everyone who uses it.", from the Shipped step ("In Acme CRM, Nov 10"). */
function shippedLine(detail: string): string {
  const day = detail.split(', ').slice(1).join(', ').trim();
  return day ? `Since ${day}, for everyone who uses it.` : 'For everyone who uses it.';
}

/**
 * The block while nothing waits on the viewer (direction B): what happens now as the title, the steps still to come
 * with the current one marked, the sentences of what comes next, and at most one quiet button.
 */
function WaitTurn({ b, extra, action }: { b: TurnBlock; extra?: ReactNode; action?: ReactNode }) {
  return (
    <TurnZone eyebrow={b.eyebrow} title={b.title} drawing="review" actions={action ?? undefined}>
      <TurnSteps steps={b.steps} />
      {b.lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      {extra}
    </TurnZone>
  );
}

/**
 * The product manager's turn (boards R1, R3) in the block: optional once the lead is asked. "Give your view" opens
 * their note and the two answers (Looks good, Needs changes, which needs the note) in the block itself.
 */
function PmTurn({ v, b, say }: { v: PmView; b: TurnBlock; say: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'pm-ok' | 'pm-changes' | null>(null);
  // Needs changes stays clickable: with no note yet, the field says what it needs and takes the focus.
  const [needNote, setNeedNote] = useState(false);
  const note = useRef<HTMLTextAreaElement>(null);
  const send = (kind: 'pm-ok' | 'pm-changes') => {
    if (!v.onSay) return;
    if (kind === 'pm-changes' && !text.trim()) {
      setNeedNote(true);
      note.current?.focus();
      return;
    }
    setBusy(kind);
    v.onSay(kind, text.trim())
      .then((r) => {
        setText('');
        setOpen(false);
        if (r) say(r);
      })
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(null));
  };
  const form = (
    <form
      className="xp-lead-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        send('pm-ok');
      }}
    >
      <Textarea
        ref={note}
        label={PM_WORDS.note}
        // Said once: the hint until the note is missing, then the error in its place (C12).
        hint={needNote && !text.trim() ? undefined : PM_WORDS.noteHint}
        error={needNote && !text.trim() ? PM_WORDS.noteNeeded : undefined}
        rows={3}
        value={text}
        autoFocus
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) setNeedNote(false);
        }}
      />
      <div className="xp-turn-acts">
        <Button type="button" variant="secondary" size="md" loading={busy === 'pm-changes'} disabled={busy !== null} onClick={() => send('pm-changes')}>
          {PM_WORDS.changes}
        </Button>
        <Button type="submit" variant="primary" size="md" loading={busy === 'pm-ok'} disabled={busy !== null}>
          {PM_WORDS.looksGood}
        </Button>
      </div>
    </form>
  );
  const label = b.action?.kind === 'change-view' ? b.action.label : TURN_WORDS.giveView;
  const actions = !v.onSay ? undefined : open ? (
    form
  ) : (
    <Button variant={b.action?.kind === 'change-view' ? 'secondary' : 'primary'} size="md" onClick={() => setOpen(true)}>
      {label}
    </Button>
  );
  return (
    <TurnZone eyebrow={b.eyebrow} title={b.title} drawing="guide" actions={actions}>
      <TurnSteps steps={b.steps} />
      {b.lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </TurnZone>
  );
}

/** "Copy for your developers" on the step it acts on: their developers work elsewhere. */
function SendDetail({ detail, message }: { detail: string; message: string }) {
  const { copied, said, copy } = useCopy(3000);
  const line = copied || (said && said !== DEV_MESSAGE_WORDS.said) ? said : detail;
  return (
    <span className="xp-send">
      <span>{line}</span>
      <Button variant="link" size="sm" onClick={() => void copy(message, DEV_MESSAGE_WORDS.said)}>
        {DEV_MESSAGE_WORDS.copy}
      </Button>
      <VisuallyHidden role="status">{said}</VisuallyHidden>
    </span>
  );
}

/** One async action's busy state and its line. */
function useAct(say: (s: string) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, act: () => Promise<string | void>) => {
    setBusy(key);
    act()
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(null));
  };
  return { busy, run };
}

/** "I'll look": a reviewer while nobody took it. */
function LeadTake({ lead, say }: { lead: LeadView; say: (s: string) => void }) {
  const { busy, run } = useAct(say);
  return (
    <TurnZone
      eyebrow="Your turn"
      title={lead.heading ?? 'Will you review it?'}
      drawing="review"
      actions={
        <Button variant="primary" size="md" loading={busy === 'take'} onClick={() => run('take', lead.take!.onTake!)}>
          I'll look
        </Button>
      }
    >
      <p>{lead.line}</p>
    </TurnZone>
  );
}

/** "Keep exploring": who asked the lead takes it back before the lead answers. */
function KeepExploring({ onCancel, say }: { onCancel: () => Promise<string | void>; say: (s: string) => void }) {
  const { busy, run } = useAct(say);
  return (
    <Button variant="secondary" size="md" className="xp-self-start" loading={busy === 'cancel'} onClick={() => run('cancel', onCancel)}>
      Keep exploring
    </Button>
  );
}

/** The designer's word that the PM agreed in a call, on the PM's row. */
function PmCall({ call, say }: { call: NonNullable<PmView['call']>; say: (s: string) => void }) {
  const { busy, run } = useAct(say);
  return (
    <Button variant="link" size="sm" loading={busy === 'call'} onClick={() => run('call', call.onCall)}>
      {call.label}
    </Button>
  );
}

/**
 * The lead's turn (boards L1 to L5 in the page's one zone): send the designer's screen to the developers (Looks right,
 * after applying the choice on each new library piece), or Needs changes with the words that go back. Ask someone else,
 * Not doing this and Copy link sit in its "...". A comment goes in Activity's box.
 */
function LeadTurn({ bar, line, hat = null, decisions = [], heading, designer, question, apply, extra, say }: { bar: LeadBarView; line: string; /** The design review's hat: Looks right answers the screen only. */ hat?: LeadView['hat']; /** Every decision of the library section (lib/exploration-layout leadDecisions). */ decisions?: readonly LeadDecision[]; heading?: string | undefined; designer: PageFace; question: string | null; apply: (() => Promise<void>) | null; /** Where the product manager stands, quiet, under the context. */ extra?: ReactNode; say: (s: string) => void }) {
  const { busy, run } = useAct(say);
  const [changes, setChanges] = useState(false);
  const [text, setText] = useState('');
  const who = possessive(designer.name);
  const actions = changes ? (
    <form
      className="xp-lead-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (text.trim()) run('changes', () => bar.onChanges(text.trim()));
      }}
    >
      <Textarea label={`What ${designer.name} should change`} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="xp-turn-acts">
        <Button type="button" variant="ghost" size="md" onClick={() => setChanges(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" loading={busy === 'changes'} disabled={!text.trim() || busy !== null}>
          Send back to {designer.name}
        </Button>
      </div>
    </form>
  ) : (
    <>
      {bar.blocked ? (
        // Step 1 of 2: the zone asks what is next and its button takes the lead to that choice in the library section.
        // Secondary: the choice's own button there ("Add Comfortable to Card") is the page's one primary; two primaries
        // read as two different next steps. Once the piece is decided the zone turns to step 2, Send to the developers,
        // its primary. Never a disabled button.
        <Button variant="secondary" size="md" disabled={busy !== null} onClick={goToLibraryChoice}>
          {bar.blocked}
        </Button>
      ) : (
        <>
          <Button variant="secondary" size="md" disabled={busy !== null} onClick={() => setChanges(true)}>
            Needs changes
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={busy !== null}
            loading={busy === 'right'}
            data-demo-write="send to the developers"
            onClick={() =>
              run('right', async () => {
                if (apply) await apply();
                return bar.onLooksRight('');
              })
            }
          >
            Send to the developers
          </Button>
        </>
      )}
    </>
  );
  if (hat) {
    // The design review (two reviews): the screen only, apart from the library decision, which sits on each new
    // piece's row for whoever decides what the library keeps.
    const review = changes ? (
      actions
    ) : (
      <>
        <Button variant="secondary" size="md" disabled={busy !== null} onClick={() => setChanges(true)}>
          Needs changes
        </Button>
        <Button variant="primary" size="md" disabled={busy !== null} loading={busy === 'right'} data-demo-write="say the design looks right" onClick={() => run('right', () => bar.onLooksRight(''))}>
          Looks right
        </Button>
      </>
    );
    return (
      <TurnZone eyebrow={hat.eyebrow} title={heading ?? `Does ${who} screen look right?`} drawing="review" quote={question ? <AskQuote who={designer} verb="asks" text={question} action={<Link href="#xp-compose">Answer</Link>} /> : null} actions={review}>
        <p>{hat.as}</p>
        {line && line !== hat.as && <p>{line}</p>}
        {extra}
      </TurnZone>
    );
  }
  if (bar.blocked) {
    // Every decision on the page counts: "Card padding and Timeline", "2 library pieces wait for your choice", and the
    // line says what each tick does. Without the section's decisions: "Choose Card padding" -> "Which Card padding...".
    const words = leadTurnWords(decisions, designer.name);
    const one = /^Choose (?!\d)(.+)$/.exec(bar.blocked)?.[1];
    return (
      <TurnZone eyebrow={`Your turn${SEP}1 of 2`} title={words?.title ?? (one ? `Which ${one} for ${who} screen?` : bar.blocked.replace(/^Choose (\d+) (.+)$/, '$1 $2 wait for your choice'))} drawing="guide" actions={actions}>
        <LeadSteps first={words?.step ?? one ?? 'Library pieces'} />
        <p>{words?.line ?? (one ? `${who} screen changes ${one}. Choose what the library keeps, then the screen goes to the developers.` : 'Choose what the library keeps, then the screen goes to the developers.')}</p>
        {extra}
      </TurnZone>
    );
  }
  // Nothing left to choose: the line says what Send does with each tick, as ticked now.
  const said = sendTickLine(decisions, designer.name) ?? line;
  return (
    <>
      <TurnZone
        eyebrow="Your turn"
        title={heading ?? `Send ${who} screen to the developers?`}
        drawing="guide"
        quote={question ? <AskQuote who={designer} verb="asks" text={question} action={<Link href="#xp-compose">Answer</Link>} /> : null}
        actions={actions}
      >
        {said && <p>{said}</p>}
        {extra}
      </TurnZone>
    </>
  );
}

/** The lead's two steps while a library piece waits: 1 choose it (now), 2 send the screen to the developers. */
function LeadSteps({ first }: { first: string }) {
  return <Stepper className="xp-turn-steps" orientation="horizontal" label="Steps" current={0} steps={[{ label: first }, { label: 'Send to the developers' }]} />;
}

/**
 * The preview while Bridge has no capture of the screen: an honest plate, not a fake wireframe. The changed screen's
 * name in the display face, the product, and a Field Guide drawing (the one of its card, lib/branch-thumb plateDrawing).
 * The frame has the ratio of a capture, so a capture arriving later, or failing to load, moves nothing.
 */
/** Scroll to the piece still waiting in the library section and put focus on its first choice (a checkbox or field), so the next key acts. */
function goToLibraryChoice() {
  const sec = document.getElementById('xp-library');
  if (!sec) return;
  // The piece still waiting on the lead (LibraryImpact marks it), not the block's first box.
  const target = sec.querySelector<HTMLElement>('[data-waiting]') ?? sec;
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const first = target.querySelector<HTMLElement>('input:not([disabled]), [role="checkbox"]:not([aria-disabled="true"]), button:not([disabled])');
  first?.focus({ preventScroll: true });
}

/**
 * "Started from Contacts v3 · 2 pieces the library doesn't have": the mockup named once, linked, then the count once its
 * pieces are known. The count goes to the pieces where the page lists them (the library section); where it does not,
 * it opens their names under the line.
 */
export function StartedFrom({ from, x, listed }: { from: NonNullable<ExplorationPageProps['startedFrom']>; x?: ExplorationPageProps['fromMockup']; listed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xp-from-mockup">
      <p className="xp-muted xp-devline" data-started-from="">
        Started from{' '}
        <Link href={from.url} external>
          {from.label}
        </Link>
        {x && (
          <span data-from-mockup="">
            {SEP}
            {listed ? (
          <Link
            href="#xp-library"
            onClick={(ev) => {
              ev.preventDefault();
              document.getElementById('xp-library')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            }}
          >
            {x.count}
          </Link>
        ) : (
          <Button variant="link" aria-expanded={open} aria-controls="xp-from-mockup-list" onClick={() => setOpen((o) => !o)}>
            {x.count}
          </Button>
            )}
          </span>
        )}
      </p>
      {x && !listed && open && (
        <ul className="xp-from-mockup-list" id="xp-from-mockup-list">
          {x.pieces.map((t, i) => (
            <li key={`${i}-${t}`}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScreenPlate({ product, screen, seed }: { product: string; screen: string | null; seed?: string | null }) {
  return (
    <div className="xp-frame xp-plate" aria-hidden="true">
      <Drawing name={plateDrawing({ seed, screen, product })} width={88} className="xp-plate-art" />
      <span className="xp-plate-text">
        <span className="xp-plate-screen">{screen ?? product}</span>
        <span className="xp-muted">{screen ? `${product}${SEP}no screenshot yet` : 'No screenshot yet'}</span>
      </span>
    </div>
  );
}

/** The captured screen, "Captured 2 h ago" in its corner; the plate (or the neutral frame) if the image fails. */
function ShotFrame({ p }: { p: ExplorationPageProps }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!p.thumb || failed === p.thumb) return p.plate ? <ScreenPlate product={p.plate.product} screen={p.plate.screen} seed={p.plate.seed ?? null} /> : <EmptyFrame label={null} />;
  return (
    <div className="xp-frame is-shot">
      <img src={p.thumb} alt="The latest captured screen of this exploration" loading="lazy" onError={() => setFailed(p.thumb)} />
    </div>
  );
}

/** The developers' build as Bridge captured it (its preview), else the empty frame that names who builds it. */
function BuildShot({ shot, label }: { shot: { src: string; capturedAt: string | null }; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <EmptyFrame label={label} />;
  return (
    <div className="xp-frame is-shot">
      <img src={shot.src} alt="The developers' build, as captured" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

function EmptyFrame({ label }: { label: string | null }) {
  return (
    <div className={label ? 'xp-frame is-empty' : 'xp-frame is-neutral'} aria-hidden="true">
      <span className="xp-frame-lines">
        <span />
        <span />
        <span />
        <span />
      </span>
      {label && <span className="xp-muted">{label}</span>}
    </div>
  );
}

/** The line a write produced, once, as a DS toast (success, or danger when it says something did not happen). */
function SaidToast({ said }: { said: string | undefined }) {
  const toast = useToast();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!said || shown.current === said) return;
    shown.current = said;
    toast.add({ title: said, tone: 'success', timeout: 8000 });
  }, [said, toast]);
  return null;
}

/** "Waiting for code", "Being built", "Shipped": the tag of the title row, with the same words as the lists. */
function StatusTag({ status, notStarted, stage }: { status: string; notStarted?: boolean; stage?: LifecycleStage | null }) {
  const t = explorationTag(status, { ...(notStarted ? { notStarted } : {}), stage: stage ?? null });
  return (
    <Badge tone={t.tone} size="md" dot={statusTagDot(t.tone)} className={statusTagClass(t.tone)}>
      {t.label}
    </Badge>
  );
}

function PieceItem({ piece, onPiece, say }: { piece: SentPiece; onPiece: HandoffView['onPiece']; say: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const act = piece.action && onPiece;
  return (
    <li className="xp-piece-item">
      <Card interactive={Boolean(piece.href)} padding="compact" className="xp-piece">
        <CardBody className="xp-piece-body">
          {/* The value beside the name, unless the name already says it ("New color #C2410C"). */}
          {piece.value && !piece.title.toLowerCase().includes(piece.value.toLowerCase()) && <TokenValue value={piece.value} className="xp-piece-value" aria-hidden="true" />}
          <span className="xp-piece-text">
            {piece.href ? (
              <Link href={piece.href} variant="subtle" data-card-primary {...(piece.opens ? { [`data-open-${piece.opens}`]: piece.number ?? '' } : {})}>
                <strong>{piece.title}</strong>
              </Link>
            ) : (
              <strong>{piece.title}</strong>
            )}
            {piece.line ? (
              <Badge tone={piece.tone} size="md" className={statusTagClass(piece.tone, 'xp-piece-tag')}>
                {piece.line}
              </Badge>
            ) : (
              !act && <span className="xp-muted">Not sent to the library yet</span>
            )}
          </span>
          {act && (
            <Button
              variant="secondary"
              size="md"
              className="xp-piece-act"
              loading={busy}
              onClick={() => {
                setBusy(true);
                onPiece!(piece)
                  .then((r) => r && say(r))
                  .catch((err: Error) => say(err.message))
                  .finally(() => setBusy(false));
              }}
            >
              {piece.action!.label}
            </Button>
          )}
        </CardBody>
      </Card>
    </li>
  );
}

/** "Check in Claude" (or "Copy for Copilot"): the same check in the open tool. */
function CheckButton({ p, line, say }: { p: ExplorationPageProps; line: string; say: (s: string) => void }) {
  const tool = useContext(ToolContext);
  return (
    <ContinueButton p={p} tool={tool} line={line} say={say} variant="secondary" size="md">
      {tool === 'copilot' ? 'Copy for Copilot' : 'Check in Claude'}
    </ContinueButton>
  );
}

/** What the library gets from it: the pieces with their request status, the check while it runs, or not checked. */
function LibraryPart({ h, p, say }: { h: HandoffView; p: ExplorationPageProps; say: (s: string) => void }) {
  const x = h.pieces;
  if (x.state === 'hidden') return null;
  return (
    // The same anchor as the library section (only one of the two is on the page): "N pieces the library doesn't have" lands here.
    <div className="xp-lib" id="xp-library">
      <h3 className="xp-h3">For the library</h3>
      {x.state === 'loading' ? (
        <Skeleton variant="rect" className="xp-skel-piece" />
      ) : x.state === 'checking' ? (
        <p className="xp-checking" role="status">
          <Spinner size="sm" />
          Bridge is checking what the library is missing.
        </p>
      ) : x.state === 'none' ? (
        <p>Nothing missing: everything comes from the library.</p>
      ) : x.state === 'unchecked' ? (
        <div className="xp-unchecked">
          <p className="xp-muted">Not checked against the library.</p>
          {x.claude && <CheckButton p={p} line={x.claude} say={say} />}
        </div>
      ) : (
        <ul className="xp-pieces">
          {x.rows.map((r) => (
            <PieceItem key={r.id} piece={r} onPiece={h.onPiece} say={say} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The designer's answer on the developers' version, under the steps: Looks right in one click, Needs changes opens a
 * short text first (progressive disclosure). Bridge posts it on the developers' pull request.
 */
const DEV_ANSWER_WORDS = { hint: 'The developers read it on their work.', send: 'Send to the developers' };

function DevAnswer({ onAnswer, say }: { onAnswer: NonNullable<HandoffView['onAnswer']>; say: (s: string) => void }) {
  const words = DEV_ANSWER_WORDS;
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'looks-right' | 'changes' | null>(null);
  const send = (a: DesignAnswer) => {
    setBusy(a.kind);
    onAnswer(a)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(null));
  };
  if (asking) {
    return (
      <form
        className="xp-answer"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (text.trim()) send({ kind: 'changes', text });
        }}
      >
        <Textarea label="What should change" hint={words.hint} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <ButtonGroup align="end">
          <Button type="button" variant="ghost" size="md" onClick={() => setAsking(false)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={busy === 'changes'} disabled={!text.trim()}>
            {words.send}
          </Button>
        </ButtonGroup>
      </form>
    );
  }
  return (
    <ButtonGroup align="end">
      <Button variant="secondary" size="md" disabled={busy !== null} onClick={() => setAsking(true)}>
        Needs changes
      </Button>
      <Button variant="primary" size="md" loading={busy === 'looks-right'} onClick={() => send({ kind: 'looks-right' })}>
        Looks right
      </Button>
    </ButtonGroup>
  );
}

/**
 * A developer's words, quoted as plain text (React escapes it: never HTML), cut after a few lines with "Show more",
 * after who said it and when (the name introduces the words it belongs to).
 */
function DevQuote({ text, by, when }: { text: string; by: PageFace | null; when: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { short, clipped } = clipQuote(text);
  return (
    <figure className="xp-quote">
      {by && (
        <figcaption className="xp-muted xp-quote-by">
          <Who p={{ login: by.login, name: by.name, agent: by.agent, avatar: by.avatar }} size="xs" />
          <span>
            {by.name}
            {when ? `, ${when}` : ''}
          </span>
        </figcaption>
      )}
      <blockquote id={id} className="xp-quote-text">
        {open ? text : short}
      </blockquote>
      {clipped && (
        <Button variant="link" size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Show more'}
        </Button>
      )}
    </figure>
  );
}

/**
 * The question on the task, under the steps: the asker's words (named, never "the developers" by default), and the
 * reply box when this viewer can answer. Once the designer answered, one quiet line says so and the words stay.
 */
function DevQuestion({ q, say }: { q: NonNullable<HandoffView['question']>; say: (s: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!q.onReply || !text.trim()) return;
    setBusy(true);
    q.onReply(text)
      .then((r) => r && say(r))
      .catch((err: Error) => say(err.message))
      .finally(() => setBusy(false));
  };
  const w = questionWords(q.by);
  return (
    <section className="xp-question" aria-label={q.by ? `${q.by.name}'s question` : 'A question for you'}>
      {q.text ? <DevQuote text={q.text} by={q.by} when={q.when} /> : !q.answered && <p>{w.needsInput}</p>}
      {q.answered ? (
        <p className="xp-muted">{w.answered}</p>
      ) : (
        q.onReply && (
          <form className="xp-answer xp-reply" onSubmit={send}>
            <Textarea label="Your answer" hint={w.hint} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            {/* What waits on the viewer: the view's one primary action (the preview's button steps back meanwhile). */}
            <Button type="submit" variant="primary" size="md" className="xp-reply-send" loading={busy} disabled={!text.trim()}>
              {w.send}
            </Button>
          </form>
        )
      )}
    </section>
  );
}

/** "Art print shop changed since this exploration started. Bring the latest in": quiet, one link-sized action. */
function LatestLine({ latest, say }: { latest: NonNullable<ExplorationPageProps['latest']>; say: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <p className="xp-muted xp-note xp-latest">
      {latest.line}{' '}
      <Button
        variant="link"
        size="sm"
        loading={busy}
        onClick={() => {
          setBusy(true);
          latest
            .onBring()
            .then(say)
            .finally(() => setBusy(false));
        }}
      >
        {COPY_WORDS.bringIn}
      </Button>
    </p>
  );
}

/**
 * The way to Figma, in the block of actions under the preview: the page Claude built, once recorded, then the action.
 * It always hands the line to the viewer's AI tool: Claude Code's copy of the product has no Figma connector of its own
 * to count on.
 */
function FigmaAction({ p, tool, say }: { p: ExplorationPageProps; tool: AiTool; say: (s: string) => void }) {
  const page = p.notes?.notes?.figmaPage ?? null;
  if (!page && !p.figma) return null;
  const to = p.claudeCodeUrl ? 'claude-app' : tool;
  return (
    <>
      {page && (
        <ButtonLink variant="ghost" size="lg" href={page} target="_blank" rel="noopener" iconEnd={ExternalLink}>
          See it in Figma
        </ButtonLink>
      )}
      {p.figma && (
        <ToolAction
          tool={to}
          line={to === 'claude-code' ? p.figma.terminal : p.figma.app}
          onCopy={p.onCopy}
          say={say}
          variant="ghost"
          size="lg"
          demoWrite="send to Figma"
          {...(p.claudeLink ? { claudeLink: p.claudeLink } : {})}
          {...(p.connectorAddress ? { connectorAddress: p.connectorAddress } : {})}
          {...(p.onClaudeConnected ? { onClaudeConnected: p.onClaudeConnected } : {})}
        >
          {page ? 'Send to Figma again' : 'Send to Figma'}
        </ToolAction>
      )}
    </>
  );
}

/** A question on the task the viewer has not answered yet and can answer here: what waits on them. */
const waitsOnAnswer = (h: HandoffView | null): boolean => Boolean(h && !h.declined && h.status !== 'shipped' && h.question && !h.question.answered && h.question.onReply);

/** The developers' version waits for the viewer's eyes (Review is now, and they can answer): opening it is the next step. */
const reviewsVersion = (h: HandoffView | null): boolean =>
  Boolean(h && !h.declined && h.onAnswer && h.steps.some((s) => s.title === 'Review' && s.current) && h.steps.some((s) => s.link));

export function ExplorationPage(p: ExplorationPageProps) {
  return (
    <ToastProvider limit={2}>
      <ExplorationBody {...p} />
      <SaidToast said={p.said} />
    </ToastProvider>
  );
}

function ExplorationBody(p: ExplorationPageProps) {
  const { view, tab, setTab } = useAiTools(p.claudeLink, p.emailMember);
  const [said, setSaid] = useState('');
  // Nothing built yet and the viewer's own Claude has no Bridge: the connect steps first, read again on coming back.
  const first = !p.claudeCodeUrl && connectFirst(tab, p.claudeLink) && p.stage === 'not-started' && !p.archived;
  useClaudeRecheck(first, (v) => {
    p.onClaudeLink?.(v);
    if (v === 'yes') setSaid(CONNECT_FIRST.connected);
  });
  const lines = linesOf(p);
  const line = lines[tab];
  const only = view.tools.length === 1 ? view.tools[0] : null;
  const withWhat = only === 'copilot' ? 'GitHub Copilot' : only ? 'Claude AI' : 'your AI tool';
  const [ask, setAsk] = useState<'rename' | 'screen' | 'reopen' | 'take-back' | 'take-over' | 'hand-over' | 'archive' | null>(null);
  const [reopening, setReopening] = useState(false);
  const [notDoing, setNotDoing] = useState(false);
  // The tab names the exploration opened in place, not only "Explorations" (WCAG 2.4.2).
  usePageTitle(p.stage === 'loading' ? null : p.title);
  // The lead's choice on each new library piece (Add it to the library, or Keep it in the designer's screen): Send to
  // the developers applies it. Add is the default.
  const [choices, setChoices] = useState<Record<string, 'approve' | 'local'>>({});
  const archive = () => {
    setSaid('');
    p.onArchive?.()
      .then((r) => setSaid(r ?? ''))
      .catch((err: Error) => setSaid(err.message));
  };
  const [unarchiving, setUnarchiving] = useState(false);
  const unarchive = () => {
    setSaid('');
    setUnarchiving(true);
    p.onUnarchive?.()
      .then((r) => setSaid(r ?? ''))
      .catch((err: Error) => setSaid(err.message))
      .finally(() => setUnarchiving(false));
  };
  const reopenIt = () => {
    setSaid('');
    setReopening(true);
    p.onReopen?.()
      .then((r) => setSaid(r ?? ''))
      .catch((err: Error) => setSaid(err.message))
      .finally(() => {
        setReopening(false);
        setAsk(null);
      });
  };
  const notStarted = p.stage === 'not-started';
  const handoff = p.stage === 'handed-off' ? (p.handoff ?? null) : null;
  const declined = Boolean(handoff?.declined);
  const product = productOf(p.startedTail);
  const role: PageRole = p.role ?? (p.lead?.bar ? 'lead' : p.pm?.mine ? 'pm' : p.done?.kind === 'run' ? 'owner' : 'viewer');
  const stage = pageStageOf({ stage: p.stage, archived: Boolean(p.archived), waitingForLead: Boolean(p.lead), handoff: handoff?.status ?? null, checking: Boolean(handoff?.build || handoff?.check), declined });
  const zone = zoneOf(stage, {
    archived: Boolean(p.archived),
    notDoing: Boolean(p.notDoing),
    answersLead: Boolean(p.designerZone?.onSend),
    leadBar: Boolean(p.lead?.bar),
    leadTake: Boolean(p.lead?.take?.onTake && !p.lead.bar),
    pmMine: Boolean(p.pm?.mine),
    canDone: canSayDone(role, p.done),
    declinedBack: Boolean(p.onReopen),
    question: waitsOnAnswer(handoff),
    checkSay: Boolean(handoff?.check?.onSay),
    // Only the designer who checks the developers' version (the exploration's owner) is asked; everyone else waits on them.
    theirVersion: reviewsVersion(handoff) && Boolean(handoff?.onAnswer) && role === 'owner',
  });
  const notes = p.notes?.notes ?? null;
  const openQuestion = notes?.openQuestions?.find((q) => q.trim()) ?? null;
  const impactRows = p.impact?.view.state === 'rows' ? p.impact.view.rows : [];
  // Two reviews: library pieces are answered on their own rows, never staged into the design review's Looks right.
  const staged = p.lead?.hat ? [] : stagedPieces(impactRows, Boolean(p.impact?.actions.onPiece));
  // Every decision of the library section, counted once for the lead's steps and line (nothing ticked silently).
  const decisions = leadDecisions({ conflicts: p.impact?.view.state === 'rows' ? p.impact.view.conflicts : [], staged, choices });
  const applyStaged = async () => {
    for (const r of staged) await p.impact!.actions.onPiece!(r.id, choices[r.id] ?? 'approve');
  };
  const previewHref = p.previewUrl ? (p.tryUrl ?? p.previewUrl) : null;
  // The screen's own name (its route: "Products"), never the last region the change marked; then what the plate names.
  const screenName = screenNameOfRoute(p.screen?.value ?? p.thumbRoute) ?? p.plate?.screen ?? p.plate?.product ?? 'The screen';
  const about = aboutLine(p.purpose);
  const nameHidden = repeatsTitle(screenName, p.title);
  const isOwner = role === 'owner';
  const builder = handoff?.build?.builder ?? handoff?.check?.builder ?? null;
  const checkQuote = handoff?.question?.text && handoff.question.by ? handoff.question : null;

  // The lead reading someone else's exploration decides themselves: "You decide what the library keeps". So does a lead
  // exploring themselves when no other lead is named.
  const viewerLeads = role === 'lead' || (Boolean(p.ownerLeads) && !p.leadName?.trim());
  // Where the product manager stands, for the designer and the lead while it is explored: quiet, with "agreed in a call".
  const pmAside =
    p.pm && !p.pm.mine && !p.archived && !handoff ? (
      <>
        <p className="xp-muted">
          {stage === 'waiting-for-lead' && !p.pm.said && p.pm.name ? `${p.pm.name} can give a product view first. It is optional.` : p.pm.line}
          {p.pm.call && (
            <>
              {' '}
              <PmCall call={p.pm.call} say={setSaid} />
            </>
          )}
        </p>
        {p.pm.quote && <AskQuote who={p.pm.quote.who} verb="says" text={p.pm.quote.text} />}
      </>
    ) : null;

  // ---- The one Harbor zone: what waits on the viewer now (the wait block below when nothing does).
  const turn = ((): ReactNode => {
    switch (zone) {
      case 'not-doing':
        return <NotDoingZone v={p.notDoing!} say={setSaid} />;
      case 'answer-lead':
        return <DesignerZone z={p.designerZone!} say={setSaid} extra={<ContinueButton p={p} tool={tab} line={line} say={setSaid} variant="secondary" size="md" />} />;
      case 'pm':
        return <PmTurn v={p.pm!} b={pmBlockOf({ stage, said: Boolean(p.pm!.said), lead: p.leadName ?? null, author: p.author.name, product, line: p.pm!.line })} say={setSaid} />;
      case 'lead-take':
        return <LeadTake lead={p.lead!} say={setSaid} />;
      case 'lead-review':
        return <LeadTurn bar={p.lead!.bar!} line={p.lead!.line} hat={p.lead!.hat ?? null} decisions={decisions} heading={p.lead!.heading} designer={p.author} question={openQuestion} apply={staged.length ? applyStaged : null} extra={pmAside} say={setSaid} />;
      case 'done':
        return (
          <TurnZone
            eyebrow="Your exploration"
            title={p.ownerLeads && !p.leadName?.trim() ? 'Ready for the developers?' : handOverTitle(p.leadName)}
            drawing="paint"
            actions={
              <>
                <ContinueButton p={p} tool={tab} line={line} say={setSaid} variant="secondary" size="md" />
                <Button variant="primary" size="md" onClick={(e) => p.onDone(e.currentTarget)}>
                  Done exploring
                </Button>
              </>
            }
          >
            {notesContext(notes?.nextStep) && <p>{notesContext(notes?.nextStep)}</p>}
            {pmAside}
          </TurnZone>
        );
      case 'declined':
        return (
          <TurnZone
            eyebrow="Your turn"
            title="The developers did not build it"
            drawing="fix"
            actions={
              <Button variant="primary" size="md" onClick={() => setAsk('reopen')}>
                Back to exploring
              </Button>
            }
          >
            <p>{DECLINED_LINE}</p>
            {handoff!.declined!.note && <DevQuote text={handoff!.declined!.note.text} by={handoff!.declined!.note.by} when={handoff!.declined!.note.when} />}
          </TurnZone>
        );
      case 'question':
        return (
          <TurnZone eyebrow="Your turn" title={handoff!.question!.by ? `${handoff!.question!.by.name} asks you` : 'A question for you'} drawing="guide">
            <DevQuestion q={handoff!.question!} say={setSaid} />
          </TurnZone>
        );
      case 'check':
        return (
          <TurnZone
            eyebrow="Your turn"
            title={`Does ${possessive(builder ?? 'the developer')} build match ${isOwner ? 'your design' : handoff!.check!.review ? `${possessive(p.author.name)} design` : 'the design'}?`}
            drawing="review"
            quote={checkQuote ? <AskQuote who={checkQuote.by!} verb="says" text={checkQuote.text!} action={checkQuote.onReply && !checkQuote.answered ? <Link href="#xp-compose">Reply</Link> : null} /> : null}
            actions={<BuildCheck v={handoff!.check!} say={setSaid} inZone />}
          >
            {/* With the check region by region, the zone is only the question and the progress (the ledger holds the rest). */}
            {!handoff!.check!.review && <p>{handoff!.check!.line}</p>}
          </TurnZone>
        );
      case 'their-version': {
        const version = handoff!.steps.find((s) => s.link)?.link ?? null;
        return (
          <TurnZone eyebrow="Your turn" title="Does their version look right?" drawing="review" actions={<DevAnswer onAnswer={handoff!.onAnswer!} say={setSaid} />}>
            {version && (
              <Link href={version.href} target="_blank" rel="noopener">
                {version.label}
                <Icon icon={ExternalLink} size="xs" />
              </Link>
            )}
          </TurnZone>
        );
      }
      case 'shipped': {
        const live = handoff?.steps.find((s) => s.title === 'Shipped')?.detail ?? '';
        return (
          <TurnZone eyebrow="Shipped" title={`Live in ${product || 'the product'}`} drawing="components" id="xp-shipped-h">
            <p>{shippedLine(live)}</p>
          </TurnZone>
        );
      }
      default:
        return null;
    }
  })();

  // ---- The block while nothing waits on the viewer (direction B): what happens now, the steps still to come, at most one
  // quiet button. The steps are said there once.
  const send = handoff?.forDevelopers && !handoff.declined && handoff.status !== 'shipped' ? handoff.forDevelopers : null;
  const checkers: CheckPerson[] = (handoff?.check?.rows ?? []).map((r) => ({
    name: r.name,
    you: (r.role === 'designer' && isOwner) || (r.role === 'lead' && role === 'lead') || (r.role === 'pm' && role === 'pm'),
    said: r.state === 'looks-right' ? 'looks-right' : r.state === 'changes' ? 'changes' : r.state === 'not-needed' ? 'not-needed' : 'waiting',
  }));
  const wait = turn
    ? null
    : waitBlockOf({
        stage,
        role,
        author: p.author.name,
        lead: p.leadName ?? null,
        viewerLeads,
        product,
        // Calendar days, as every waiting tag counts them (status-tag isReminded): the card's reminder and the tags agree.
        waitedDays: p.designAskedAt && Number.isFinite(Date.parse(p.designAskedAt)) ? calendarDays(p.designAskedAt, new Date()) : null,
        askedAt: p.designAskedAt ?? null,
        reviews: p.reviews?.steps.length && p.reviews.line ? { title: p.reviews.line, steps: p.reviews.steps } : null,
        taken: p.lead?.take?.line ?? null,
        canKeepExploring: Boolean(p.lead?.onCancel),
        shared: sharedChoiceOf(p.me?.name, p.impact?.view.state === 'rows' ? p.impact.view.conflicts : []),
        newPieces: p.impact?.view.state === 'rows' && p.impact.view.rows.length + p.impact.view.conflicts.length > 0,
        doneNote: p.done?.kind === 'note' ? p.done.text : null,
        steps: handoff?.steps ?? [],
        checkers,
        builder: builder && builder !== 'the developer' ? builder : null,
        send: Boolean(send),
        canUnarchive: Boolean(p.onUnarchive),
        archivedLine: ARCHIVED_LINE,
        declinedLine: DECLINED_LINE,
      });
  const waitAction = ((): ReactNode => {
    switch (wait?.action?.kind) {
      case 'keep-exploring':
        return p.lead?.onCancel ? <KeepExploring onCancel={p.lead.onCancel} say={setSaid} /> : null;
      case 'see-choice':
        return (
          <Button variant="secondary" size="md" onClick={goToLibraryChoice}>
            {wait.action.label}
          </Button>
        );
      case 'unarchive':
        return (
          <Button variant="secondary" size="md" disabled={unarchiving} onClick={unarchive}>
            {unarchiving ? 'Unarchiving' : wait.action.label}
          </Button>
        );
      case 'link':
        return (
          <ButtonLink variant="secondary" size="md" href={wait.action.href} target="_blank" rel="noopener">
            {wait.action.label}
          </ButtonLink>
        );
      case 'send': {
        const now = handoff?.steps.find((x) => x.current);
        return send ? <SendDetail detail={now?.detail ?? ''} message={send.message} /> : null;
      }
      default:
        return null;
    }
  })();
  const block = turn ?? (wait ? <WaitTurn b={wait} extra={<>{pmAside}{stage === 'declined' && handoff?.declined?.note && <DevQuote text={handoff.declined.note.text} by={handoff.declined.note.by} when={handoff.declined.note.when} />}</>} action={waitAction} /> : null);

  // ---- Activity.
  const quoted = [checkQuote?.text ?? '', p.designerZone?.text ?? '', p.notDoing?.text ?? ''];
  const timeline = p.activity === null && !p.decisions?.length ? null : timelineOf(p.activity ?? [], p.decisions ?? [], startedWhen, quoted, p.title);
  const composer =
    zone === 'lead-review' && p.lead?.bar ? (
      <Composer me={p.me ?? null} placeholder={writeToLine([p.author.name])} onSend={(t) => p.lead!.bar!.onComment(t)} say={setSaid} />
    ) : p.onTellDevelopers ? (
      <Composer me={p.me ?? null} placeholder={writeToLine(builder && builder !== 'the developer' ? [builder] : ['the developers'])} onSend={p.onTellDevelopers} say={setSaid} />
    ) : null;

  // ---- The screen.
  const build = handoff?.build ?? null;
  const mismatch = Boolean(build?.shot && !sameScreen(p.thumbRoute ?? p.screen?.value ?? null, build.shot.route ?? null));
  const capturedSub = p.thumbCapturedAt ? capturedLine(p.thumbCapturedAt, Date.now()).replace(/^Captured /, '') : (p.headline?.when ?? '');
  const stageSub = build
    ? mismatch
      ? SCREEN_WORDS.notSame
      : SCREEN_WORDS.sameScreen
    : handoff?.status === 'shipped'
      ? `live in ${product || 'the product'}`
      : isOwner
        ? SCREEN_WORDS.latest(capturedSub)
        : p.lead?.bar?.changedSince
          ? SCREEN_WORDS.changedSinceAsked(p.author.name, capturedSub)
          : `${possessive(p.author.name)} latest version${capturedSub ? `, ${capturedSub}` : ''}`;
  const figmaShown = !p.archived && Boolean(p.notes?.notes?.figmaPage || p.figma);
  // The AI tool beside the screen for whoever keeps working on it, when the zone does not already hold it.
  const continueHere = !handoff && !p.archived && isOwner && zone !== 'done' && zone !== 'answer-lead';
  const stageFoot = (
    <>
      {p.previewBuilding && !p.previewUrl && (
        <p className="xp-muted xp-st-note" role="status">
          <Spinner size="sm" /> Preview is building
        </p>
      )}
      {p.previewNote && !(p.previewBuilding && !p.previewUrl) && (
        <p className="xp-muted xp-st-note" id="xp-preview-note">
          {p.previewNote}
        </p>
      )}
      {!handoff && !p.archived && p.latest && <LatestLine latest={p.latest} say={setSaid} />}
      {(figmaShown || continueHere) && (
        <div className="xp-st-acts">
          {continueHere && <ContinueButton p={p} tool={tab} line={line} say={setSaid} variant="secondary" size="md" />}
          {figmaShown && <FigmaAction p={p} tool={tab} say={setSaid} />}
        </div>
      )}
    </>
  );
  const stageBlock = build ? (
    <ScreenStage
      name={screenName}
      nameHidden={nameHidden}
      about={about}
      sub={stageSub}
      compare={{
        a: { label: BUILD_WORDS.approved, when: handoff!.doneWhen, approved: true, frame: <ShotFrame p={p} />, src: p.thumb, href: previewHref },
        b: {
          label: `${possessive(build.builder)} build`,
          when: build.shot?.capturedAt ? capturedLine(build.shot.capturedAt, Date.now()).replace(/^Captured /, '') : '',
          frame: build.shot ? <BuildShot shot={build.shot} label={BUILD_WORDS.builtBy(build.builder)} /> : <EmptyFrame label={BUILD_WORDS.builtBy(build.builder)} />,
          src: build.shot?.src ?? null,
          href: build.url ? atRoute(build.url, p.screen?.value ?? build.shot?.route) : null,
        },
      }}
      mismatch={
        mismatch ? (
          <>
            <strong>{SCREEN_WORDS.mismatch(screenName)}</strong>
            <span>{SCREEN_WORDS.mismatchHint}</span>
            {p.screen?.onSave && (
              <Button variant="secondary" size="md" onClick={() => setAsk('screen')}>
                {SCREEN_TITLE}
              </Button>
            )}
          </>
        ) : null
      }
      entry={p.checkEntry ?? null}
      foot={stageFoot}
    />
  ) : (
    <ScreenStage name={screenName} nameHidden={nameHidden} about={about} sub={stageSub} single={{ frame: <ShotFrame p={p} />, href: previewHref }} foot={stageFoot} />
  );
  // Check the build, once Bridge measured it: the ledger of differences takes the screen block (the compare until then).
  const ledger = stage === 'check' && !p.checkEntry && handoff?.check?.review ? handoff.check.review : null;
  const screen = ledger ? <BuildReviewEntry product={ledger.product} number={ledger.number} builder={handoff!.check!.builder} fallback={stageBlock} turnShown={zone === 'check'} /> : stageBlock;
  const showCode = codeShown(role, stage);
  const check = p.developer.find((d) => d.label === 'Check it again')?.value ?? null;
  const withClaude = p.developer.find((d) => d.label === 'With Claude')?.value ?? null;
  const branch = p.take?.branch ?? p.developer.find((d) => /branch/i.test(d.label))?.value.split(' (')[0] ?? null;
  // The lead's other answers (Ask someone else, Not doing this, Copy link) sit in the page's "...".
  const leadBar = zone === 'lead-review' && !p.archived ? (p.lead?.bar ?? null) : null;
  const menuShown = Boolean(p.onRename || p.screen?.onSave || p.onReopen || p.onArchive || p.onTakeOver || p.handOver || p.onTakeBack || leadBar);
  const notesTitle = isOwner ? 'Your handover notes' : `${possessive(p.author.name)} handover notes`;
  return (
    <ToolContext.Provider value={tab}>
    <div className="xp-page">
      <div className="xp-top">
        <Breadcrumb items={p.crumbs} className="xp-crumbs" />
        <Link variant="subtle" href={p.crumbs[0]!.href ?? studioHref('explorations/')} className="xp-crumbs-phone" data-back="">
          <Icon icon={ChevronLeft} size="sm" /> {p.crumbs[0]!.label}
        </Link>
        <header className="xp-pagehead">
          <h1 className="xp-pagetitle" tabIndex={-1}>
            {p.title}
          </h1>
          {p.stage !== 'loading' &&
            (p.tag ? (
              <Badge tone={p.tag.tone} size="md" className={statusTagClass(p.tag.tone)}>
                {p.tag.label}
              </Badge>
            ) : p.archived ? (
              <Badge tone="neutral" size="md">
                {EXPLORATION_STAGE_LABEL.archived}
              </Badge>
            ) : stage === 'check' ? (
              <Badge tone={BUILD_WORDS.tagTone} size="md" className={statusTagClass(BUILD_WORDS.tagTone)}>
                {BUILD_WORDS.tag}
              </Badge>
            ) : (
              <StatusTag status={handoff ? handoff.status : 'active'} notStarted={notStarted} stage={handoff?.stage ?? (p.lead ? 'waiting-for-lead' : null)} />
            ))}
          <span className="xp-spacer" />
          {showCode && (
            <span className="xp-code-slot">
              <CodeButton who={p.author.name} commands={p.take?.commands ?? null} check={check} claude={withClaude} branch={branch} href={p.githubUrl} refLabel={`#${p.number}`} onCopy={p.onCopy} />
            </span>
          )}
          {menuShown && (
            // Last on the title's line, on a phone too (the title wraps beside it).
            <span className="xp-more">
              <Menu>
                <Tooltip content="More actions">
                  <MenuTrigger render={<IconButton icon={Ellipsis} label="More actions" variant="secondary" size="lg" />} />
                </Tooltip>
                <MenuContent align="end">
                  {p.onRename && <MenuItem icon={Pencil} onClick={() => setAsk('rename')}>Rename</MenuItem>}
                  {p.screen?.onSave && <MenuItem icon={MonitorSmartphone} onClick={() => setAsk('screen')}>{SCREEN_TITLE}</MenuItem>}
                  {p.onReopen && !(declined && zone === 'declined') && <MenuItem icon={Undo2} onClick={() => setAsk('reopen')}>Back to exploring</MenuItem>}
                  {p.onTakeBack && <MenuItem icon={Undo2} onClick={() => setAsk('take-back')}>Take it back</MenuItem>}
                  {p.onTakeOver && <MenuItem icon={UserCheck} onClick={() => setAsk('take-over')}>Take it over</MenuItem>}
                  {p.handOver && <MenuItem icon={ArrowRightLeft} onClick={() => setAsk('hand-over')}>Hand over</MenuItem>}
                  {leadBar?.onAskOther && <MenuItem icon={Users} onClick={() => leadBar.onAskOther!().then((r) => setSaid(r ?? ''), (err: Error) => setSaid(err.message))}>Ask someone else to review</MenuItem>}
                  {leadBar && <MenuItem icon={Ban} onClick={() => setNotDoing(true)}>Not doing this</MenuItem>}
                  {leadBar && <MenuItem icon={LinkIcon} onClick={() => void leadBar.onCopy(leadBar.link).then(() => setSaid('Link copied.'), () => setSaid('Could not copy the link.'))}>Copy link</MenuItem>}
                  {/* Archive last, apart and in the danger tone: it takes the exploration off everyone's list. */}
                  {p.onArchive && (p.onRename || p.screen?.onSave || p.onReopen || p.onTakeOver || p.handOver || p.onTakeBack || leadBar) && <MenuSeparator />}
                  {p.onArchive && (
                    <MenuItem icon={Archive} tone="danger" onClick={() => (p.archiveAsksWhy ? setAsk('archive') : archive())}>
                      Archive
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            </span>
          )}
        </header>
        <p className="xp-meta">
          <Who p={{ login: p.author.login, name: p.author.name, agent: p.author.agent, avatar: p.author.avatar }} size="xs" />
          <span>{ownerLine(p.author.name, p.startedTail)}</span>
        </p>
        {p.startedFrom && (
          <StartedFrom
            from={p.startedFrom}
            x={p.fromMockup ?? null}
            listed={(p.stage === 'exploring' || Boolean(handoff)) && (Boolean(p.impact) || Boolean(handoff && handoff.pieces.state !== 'hidden'))}
          />
        )}
      </div>
      {p.archived && !p.notDoing && p.stage === 'not-started' && (
        <div className="xp-archived">
          <p className="xp-muted">{ARCHIVED_LINE}</p>
          {p.onUnarchive && (
            <Button variant="secondary" size="md" disabled={unarchiving} onClick={unarchive}>
              {unarchiving ? 'Unarchiving' : 'Unarchive'}
            </Button>
          )}
        </div>
      )}
      {p.stage === 'loading' && <Skeleton variant="rect" className="xp-skel" />}
      {notStarted && (
        <section className="xp-start" aria-labelledby="xp-start-h">
          <div className="xp-start-text">
            <div className="xp-start-intro">
              <h2 className="xp-h-lg" id="xp-start-h">
                Nothing built yet
              </h2>
              {!p.archived && (
              <p className="xp-body">
                {p.claudeCodeUrl
                  ? "You explore with Claude Code in your team's copy of the product, with the library. Your preview appears here after the first change."
                  : `You explore with ${withWhat} and the library. Your preview appears here after the first change.`}
              </p>
              )}
            </div>
            {/* Archived: nothing to keep working on here, only Unarchive (above) and the product as it is today. */}
            {p.archived ? null : first ? (
              <ConnectFirst address={p.connectorAddress ?? '/mcp'} onCopy={p.onCopy}>
                <ToolPanel tools={view.tools} tab={tab} setTab={setTab} chosen={view.chosen} lines={lines} setup={setupOf(p)} onCopy={p.onCopy} say={setSaid} />
              </ConnectFirst>
            ) : (
              !p.claudeCodeUrl && <ToolPanel tools={view.tools} tab={tab} setTab={setTab} chosen={view.chosen} lines={lines} setup={setupOf(p)} onCopy={p.onCopy} say={setSaid} />
            )}
            <div className="xp-acts">
              {p.archived ? null : first ? <ConnectClaudeButton /> : <ContinueButton p={p} tool={tab} line={line} say={setSaid} variant="primary" />}
              {p.todayUrl && (
                <Link href={p.todayUrl} target="_blank" rel="noopener" className="xp-today">
                  {p.todayLabel ?? 'See the product today'}
                </Link>
              )}
            </div>
          </div>
          <EmptyFrame label="Your preview" />
        </section>
      )}
      {notStarted && p.notes && <WhereItStands view={p.notes} say={setSaid} />}
      {(p.stage === 'exploring' || handoff) && (
        // The board: the screen, the library and Activity on the left; the rail on the right (sticky): the turn block
        // (always: Your turn, or what happens now and the steps still to come), then the handover notes. Phones: header,
        // the block, the screen, the notes, the library, Activity (styles/exploration-page.css).
        <div className={block ? 'xp-board has-turn' : 'xp-board'}>
          <div className="xp-b-left">
          <div className="xp-b-screen" id="xp-screen">{screen}</div>
          <div className="xp-b-main">
            {p.impact ? (
              <div className="xp-library" id="xp-library">
                <LibraryImpact
                  view={p.impact.view}
                  actions={p.impact.actions}
                  say={setSaid}
                  // One primary per view (C13): while the design review's Looks right is the turn block's primary, the
                  // library choice waits as a secondary.
                  quiet={zone === 'lead-review' && (Boolean(p.lead?.hat) || !p.lead?.bar?.blocked)}
                  onPage
                  screen={{ capture: p.thumb ?? null, designer: p.author.name, name: p.title, href: '#xp-screen' }}
                  {...(staged.length && zone === 'lead-review' ? { newPieces: { capture: p.thumb, designer: p.author.name, choices, onChoice: (id: string, c: 'approve' | 'local') => setChoices((x) => ({ ...x, [id]: c })) } } : {})}
                />
              </div>
            ) : (
              handoff && <LibraryPart h={handoff} p={p} say={setSaid} />
            )}
            {/* The slot for "Start the check" (the Check the build review mode, its own route, coming next). */}
            <Timeline items={timeline} composer={composer} unread={Boolean(p.activityUnread)} />
          </div>
          </div>
          <div className="xp-b-right">
            {block && <div className="xp-b-turn">{block}</div>}
            <div className="xp-b-rail">
            {/* At Check the build, the ledger holds the handover notes as a checklist: never twice. */}
            {p.notes && (!handoff || p.notes.notes) && !ledger && <WhereItStands view={p.notes} say={setSaid} title={notesTitle} rail handedOff={stage === 'ready' || stage === 'building' || stage === 'check' || stage === 'shipped'} />}
          </div>
          </div>
        </div>
      )}
      <p className="xp-said" role="status" aria-live="polite">
        {said}
      </p>
      {leadBar && (
        <WhyDialog
          open={notDoing}
          onOpenChange={setNotDoing}
          title="Not doing this?"
          description="It ends here, with your reason. The work stays on this page. They read it here and by email."
          confirm="Not doing this"
          onConfirm={(why) => leadBar.onNotDoing(why).then((r) => setSaid(r ?? ''))}
        />
      )}
      {p.onTakeBack && (
        <WhyDialog
          open={ask === 'take-back'}
          onOpenChange={(o) => setAsk(o ? 'take-back' : null)}
          title="Take it back from the developers?"
          description="It leaves their list and goes back to its designer, with your reason. They read it on this page and by email."
          confirm="Take it back"
          onConfirm={(why) => p.onTakeBack!(why).then((r) => setSaid(r ?? ''))}
        />
      )}
      {p.onTakeOver && (
        <WhyDialog
          open={ask === 'take-over'}
          onOpenChange={(o) => setAsk(o ? 'take-over' : null)}
          title="Take it over?"
          description="You carry it on from here. Whoever kept it reads your reason on this page."
          confirm="Take it over"
          onConfirm={(why) => p.onTakeOver!(why).then((r) => setSaid(r ?? ''))}
        />
      )}
      {p.handOver && <HandOverDialog open={ask === 'hand-over'} onOpenChange={(o) => setAsk(o ? 'hand-over' : null)} people={p.handOver.people} onConfirm={(to, why) => p.handOver!.onConfirm(to, why).then((r) => setSaid(r ?? ''))} />}
      {p.archiveAsksWhy && p.onArchive && (
        <WhyDialog
          open={ask === 'archive'}
          onOpenChange={(o) => setAsk(o ? 'archive' : null)}
          title="Archive this exploration?"
          description="It leaves the lists. Its preview stays, and whoever kept it reads your reason on this page."
          confirm="Archive"
          onConfirm={(why) => p.onArchive!(why).then((r) => setSaid(r ?? ''))}
        />
      )}
      {p.screen?.onSave && (
        <ScreenDialog
          open={ask === 'screen'}
          screen={p.screen.value}
          onOpenChange={(o) => setAsk(o ? 'screen' : null)}
          onSave={async (input) => {
            setSaid('');
            const r = await p.screen!.onSave!(input);
            setAsk(null);
            setSaid(r ?? '');
          }}
        />
      )}
      {p.onRename && (
        <RenameDialog
          open={ask === 'rename'}
          name={p.title}
          onOpenChange={(o) => setAsk(o ? 'rename' : null)}
          onSave={async (name) => {
            setSaid('');
            const r = await p.onRename!(name);
            setAsk(null);
            setSaid(r ?? '');
          }}
        />
      )}
      {p.onReopen && (
        <AlertDialog open={ask === 'reopen'} onOpenChange={(o) => !reopening && setAsk(o ? 'reopen' : null)}>
          <AlertDialogContent
            title="Back to exploring?"
            description={declined ? 'Your developers closed it without building it. The exploration runs again and Done exploring comes back.' : 'Your developers have not started yet. The exploration runs again and Done exploring comes back.'}
            confirmLabel="Back to exploring"
            cancelLabel="Cancel"
            tone="primary"
            closeOnConfirm={false}
            loading={reopening}
            onConfirm={reopenIt}
          />
        </AlertDialog>
      )}
    </div>
    </ToolContext.Provider>
  );
}

/** The "..." menu item and its dialog's title: the screen the preview, its picture and the build links open on. */
const SCREEN_TITLE = 'Choose the screen it opens on';

/**
 * "Choose the screen it opens on" (the "..." menu): the address of the changed screen, pasted from the preview (core explorationScreenFrom keeps
 * what comes after the domain). Save writes it on the exploration; "Let Bridge pick" takes it away.
 */
function ScreenDialog({ open, screen, onOpenChange, onSave }: { open: boolean; screen: string | null; onOpenChange: (open: boolean) => void; onSave: (input: string | null) => Promise<void> }) {
  const formId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(screen ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setValue(screen ?? '');
    setError(null);
  }, [open, screen]);
  const save = (next: string | null) => {
    setBusy(true);
    onSave(next)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!next) return setError('Paste the address of the screen, from the preview.');
    if (next === (screen ?? '')) return onOpenChange(false);
    save(next);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title={SCREEN_TITLE}
        description="Open the preview, go to the screen you changed and copy its address. The preview, its picture and the build open there for everyone."
        size="sm"
        initialFocus={input}
        hideClose
        footer={
          <ButtonGroup align="end">
            {screen && (
              <Button variant="ghost" disabled={busy} onClick={() => save(null)}>
                Let Bridge pick
              </Button>
            )}
            <DialogClose render={<Button variant="secondary" disabled={busy} />}>Cancel</DialogClose>
            <Button type="submit" form={formId} variant="primary" loading={busy} disabled={busy}>
              Save
            </Button>
          </ButtonGroup>
        }
      >
        <form id={formId} onSubmit={submit} noValidate>
          <Input
            ref={input}
            label="Screen address"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste it from the preview"
            value={value}
            onValueChange={(v) => {
              setValue(v);
              if (error) setError(null);
            }}
            error={error ?? undefined}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Rename this exploration": the name prefilled, Save writes it on GitHub; a refusal shows under the field. */
function RenameDialog({ open, name, onOpenChange, onSave }: { open: boolean; name: string; onOpenChange: (open: boolean) => void; onSave: (name: string) => Promise<void> }) {
  const formId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setValue(name);
    setError(null);
  }, [open, name]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!next) return setError('Name the exploration, for example "Denser data tables".');
    if (next === name.trim()) return onOpenChange(false);
    setBusy(true);
    onSave(next)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title="Rename this exploration"
        size="sm"
        initialFocus={input}
        hideClose
        footer={
          <ButtonGroup align="end">
            <DialogClose render={<Button variant="secondary" disabled={busy} />}>Cancel</DialogClose>
            <Button type="submit" form={formId} variant="primary" loading={busy} disabled={busy}>
              Save
            </Button>
          </ButtonGroup>
        }
      >
        <form id={formId} onSubmit={submit} noValidate>
          <Input
            ref={input}
            label="Name"
            autoComplete="off"
            value={value}
            onValueChange={(v) => {
              setValue(v);
              if (error) setError(null);
            }}
            error={error ?? undefined}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

let root: Root | null = null;
let host: HTMLElement | null = null;

/** Renders the page into `el` (synchronously the first time). */
export function paintExplorationPage(el: HTMLElement, props: ExplorationPageProps) {
  if (host === el && !el.querySelector(':scope > .xp-page')) {
    root = null;
    host = null;
  }
  if (host !== el || !root) {
    root?.unmount();
    el.replaceChildren();
    root = createRoot(el);
    host = el;
    flushSync(() => root!.render(<ExplorationPage {...props} />));
    return;
  }
  root.render(<ExplorationPage {...props} />);
}

export function unmountExplorationPage() {
  // The detail may have been written over already (a loading line): React then throws removing nodes that are gone,
  // which left the detail blank after Archive. The effects still clean up; the next paint starts a new root.
  try {
    root?.unmount();
  } catch {
    // Its nodes were already replaced.
  }
  root = null;
  host = null;
}
