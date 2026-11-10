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
  Checklist,
  ChecklistRow,
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
import { EXPLORATION_STAGE_LABEL, startedWhen } from '@bridge-ds/core';
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
import { DesignerZone, HandOverDialog, NotDoingZone, PmZone, WhyDialog, type DesignerZoneView, type HandOverPerson, type LeadBarView, type NotDoingView, type PmView } from './LeadDecisions';
import { AskQuote, CodeButton, Composer, Journey, People, ScreenStage, Timeline, TurnZone, type PersonRow } from './ExplorationParts';
import { codeShown, devLineOf, handOverTitle, journeyOf, notesContext, ownerLine, pageStageOf, repeatsTitle, sameScreen, SCREEN_WORDS, stagedPieces, timelineOf, writeToLine, zoneOf, type PageRole } from '../../../lib/exploration-layout';
import type { DecisionRowView } from '../../../lib/lead-decisions';
import { statusTagClass } from '../../../lib/status-tag';
import { nameFace } from '../../../lib/people';

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
  /** The viewer's own face (their name and avatar), for the "You" row and the comment box. */
  me?: PageFace | null;
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
  done: DoneAction;
  onDone: (focus: HTMLElement | null) => void;
  /** Done exploring asked the design lead and they have not answered yet. */
  lead?: LeadView | null;
  /** The lead's last open word, for the designer to answer (boards L3, L4). */
  designerZone?: DesignerZoneView | null;
  /** The product manager of its product (boards R1, R3): their own zone for them, where they stand for the others. */
  pm?: PmView | null;
  /** Ended by a lead, with the reason (board L5). */
  notDoing?: NotDoingView | null;
  /** The tag while the talk decides what it is ("Needs changes"), over the lifecycle's own. */
  tag?: { label: string; tone: 'danger' | 'neutral' | 'warning' } | null;
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
const productOf = (tail: string): string => tail.split(' · ')[0]?.trim() ?? '';

/** "Malik's", "James'". */
const possessive = (name: string): string => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/** Under "Live in Acme CRM": "Since Nov 10, for everyone who uses it.", from the Shipped step ("In Acme CRM, Nov 10"). */
function shippedLine(detail: string): string {
  const day = detail.split(', ').slice(1).join(', ').trim();
  return day ? `Since ${day}, for everyone who uses it.` : 'For everyone who uses it.';
}

/** The lead's row: the wait line without the lead's name in front when the row already names them. */
function leadLine(line: string, lead: string | null | undefined): string {
  const t = line.trim().replace(/\.$/, '');
  if (lead && t.toLowerCase().startsWith(lead.toLowerCase() + ' ')) return t.slice(lead.length + 1);
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** While it is explored: the four steps of All steps, in words. */
function explorationSteps(lead: string | null, product: string): HandoffStep[] {
  return [
    { status: 'waiting', title: 'Exploring', detail: 'Until its designer says Done exploring', current: true },
    { status: 'waiting', title: 'The lead decides', detail: lead ? `${lead} picks what the library keeps` : 'Your design lead picks what the library keeps' },
    { status: 'waiting', title: 'Developers build it', detail: `The ${product || 'product'} developers build it, then it is checked` },
    { status: 'waiting', title: 'Shipped', detail: `Then live in ${product || 'the product'}` },
  ];
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
function LeadTurn({ bar, line, heading, designer, question, apply, say }: { bar: LeadBarView; line: string; heading?: string | undefined; designer: PageFace; question: string | null; apply: (() => Promise<void>) | null; say: (s: string) => void }) {
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
      <Button variant="secondary" size="md" disabled={busy !== null} onClick={() => setChanges(true)}>
        Needs changes
      </Button>
      {bar.blocked ? (
        // What sending waits for is the primary itself: it takes the lead to the choice in the library section, and
        // turns back into Send to the developers once the piece is decided. Never a disabled button.
        <Button variant="primary" size="md" disabled={busy !== null} aria-describedby="xp-lead-blocked" onClick={goToLibraryChoice}>
          {bar.blocked}
        </Button>
      ) : (
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
      )}
      {bar.blocked && (
        <p id="xp-lead-blocked" className="xp-turn-helper">
          Then send it to the developers.
        </p>
      )}
    </>
  );
  return (
    <>
      <TurnZone
        eyebrow="Your turn"
        title={heading ?? `Send ${who} screen to the developers?`}
        drawing="guide"
        quote={question ? <AskQuote who={designer} verb="asks" text={question} action={<Link href="#xp-compose">Answer</Link>} /> : null}
        actions={actions}
      >
        {line && <p>{line}</p>}
      </TurnZone>
    </>
  );
}

/**
 * The preview while Bridge has no capture of the screen: an honest plate, not a fake wireframe. The changed screen's
 * name in the display face, the product, and a Field Guide drawing (the one of its card, lib/branch-thumb plateDrawing).
 * The frame has the ratio of a capture, so a capture arriving later, or failing to load, moves nothing.
 */
/** Scroll to the library section and put focus on its first choice (a checkbox or field), so the next key acts. */
function goToLibraryChoice() {
  const sec = document.getElementById('xp-library');
  if (!sec) return;
  sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const first = sec.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled])');
  first?.focus({ preventScroll: true });
}

export function ScreenPlate({ product, screen, seed }: { product: string; screen: string | null; seed?: string | null }) {
  return (
    <div className="xp-frame xp-plate" aria-hidden="true">
      <Drawing name={plateDrawing({ seed, screen, product })} width={88} className="xp-plate-art" />
      <span className="xp-plate-text">
        <span className="xp-plate-screen">{screen ?? product}</span>
        <span className="xp-muted">{screen ? `${product} · no screenshot yet` : 'No screenshot yet'}</span>
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
    <Badge tone={t.tone} size="md" dot={t.dot} className={statusTagClass(t.tone)}>
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
    <div className="xp-lib">
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
    canDone: p.done?.kind === 'run',
    declinedBack: Boolean(p.onReopen),
    question: waitsOnAnswer(handoff),
    checkSay: Boolean(handoff?.check?.onSay),
    theirVersion: reviewsVersion(handoff) && Boolean(handoff?.onAnswer),
  });
  const notes = p.notes?.notes ?? null;
  const openQuestion = notes?.openQuestions?.find((q) => q.trim()) ?? null;
  const impactRows = p.impact?.view.state === 'rows' ? p.impact.view.rows : [];
  const staged = stagedPieces(impactRows, Boolean(p.impact?.actions.onPiece));
  const applyStaged = async () => {
    for (const r of staged) await p.impact!.actions.onPiece!(r.id, choices[r.id] ?? 'approve');
  };
  const previewHref = p.previewUrl ? (p.tryUrl ?? p.previewUrl) : null;
  const screenName = p.plate?.screen ?? p.plate?.product ?? 'The screen';
  const nameHidden = repeatsTitle(screenName, p.title);
  const isOwner = role === 'owner';
  const builder = handoff?.build?.builder ?? handoff?.check?.builder ?? null;
  const checkQuote = handoff?.question?.text && handoff.question.by ? handoff.question : null;

  // ---- The one Harbor zone: only what waits on the viewer now.
  const turn = ((): ReactNode => {
    switch (zone) {
      case 'not-doing':
        return <NotDoingZone v={p.notDoing!} say={setSaid} />;
      case 'answer-lead':
        return <DesignerZone z={p.designerZone!} say={setSaid} extra={<ContinueButton p={p} tool={tab} line={line} say={setSaid} variant="secondary" size="md" />} />;
      case 'pm':
        return <PmZone v={p.pm!} say={setSaid} />;
      case 'lead-take':
        return <LeadTake lead={p.lead!} say={setSaid} />;
      case 'lead-review':
        return <LeadTurn bar={p.lead!.bar!} line={p.lead!.line} heading={p.lead!.heading} designer={p.author} question={openQuestion} apply={staged.length ? applyStaged : null} say={setSaid} />;
      case 'done':
        return (
          <TurnZone
            eyebrow="Your exploration"
            title={handOverTitle(p.leadName)}
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
            title={`Does ${possessive(builder ?? 'the developer')} build match ${isOwner ? 'your design' : 'the design'}?`}
            drawing="review"
            quote={checkQuote ? <AskQuote who={checkQuote.by!} verb="says" text={checkQuote.text!} action={checkQuote.onReply && !checkQuote.answered ? <Link href="#xp-compose">Reply</Link> : null} /> : null}
            actions={<BuildCheck v={handoff!.check!} say={setSaid} inZone />}
          >
            <p>{handoff!.check!.line}</p>
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

  // ---- Before it ships: the people and their last word.
  const people: PersonRow[] = [];
  const faceOfName = (name: string): PageFace => ({ login: nameFace(name), name, agent: false, avatar: null });
  if (stage === 'check' && handoff?.check) {
    for (const r of handoff.check.rows) {
      // Not needed (no library piece changed): nobody to wait on, nothing to say.
      if (r.state === 'not-needed') continue;
      const you = (r.role === 'designer' && isOwner) || (r.role === 'lead' && role === 'lead') || (r.role === 'pm' && role === 'pm');
      const face = you && p.me ? p.me : faceOfName(r.name);
      const said = r.state === 'looks-right' ? 'said it looks right' : r.state === 'changes' ? (r.stateLine === 'Needs changes' ? 'asked for changes' : r.stateLine.toLowerCase()) : you ? 'check the build' : r.role === 'designer' ? 'checks the build' : 'has not looked yet';
      people.push({ key: r.role, face, name: you ? 'You' : r.name, line: said, part: you ? null : r.part, tone: r.state === 'looks-right' ? 'ok' : null, note: r.note });
    }
  } else if (zone === 'lead-review') {
    people.push({ key: 'you', face: p.me ?? faceOfName('You'), name: 'You', line: staged.length ? `decide the ${staged.map((s) => s.title).join(' and ')} and send it` : 'decide and send it' });
  } else if (p.lead && !p.lead.bar) {
    // The library block already says what the lead is choosing, anchored to it: the row says it once, in general.
    const waitsInLibrary = p.impact?.view.state === 'rows' && p.impact.view.conflicts.some((c) => !c.decided && !c.decides);
    people.push({ key: 'lead', face: p.leadName ? faceOfName(p.leadName) : null, name: p.leadName ?? 'Your design lead', line: waitsInLibrary ? 'decides before the developers build it' : leadLine(p.lead.line, p.leadName), part: 'design lead', note: p.lead.take?.line ?? null });
  } else if (handoff && !p.archived && !turn) {
    // The step happening now, once: a zone already says what waits on the viewer.
    const now = handoff.steps.find((s) => s.current);
    if (now && now.title !== 'Shipped') people.push({ key: 'now', face: null, name: now.title, line: '', note: now.detail });
  }
  if (p.pm && !p.pm.mine && !p.archived && !handoff)
    people.push({
      key: 'pm',
      face: p.pm.quote?.who ?? (p.pm.line.trim() ? faceOfName(p.pm.line.trim().split(' ')[0]!) : null),
      name: '',
      line: p.pm.line,
      part: 'product manager',
      note: p.pm.quote?.text ?? null,
      action: p.pm.call ? <PmCall call={p.pm.call} say={setSaid} /> : null,
    });
  const keepExploring = p.lead?.onCancel ? <KeepExploring onCancel={p.lead.onCancel} say={setSaid} /> : null;

  // ---- The journey.
  const journey = journeyOf(stage, { lead: p.leadName ?? null, product: product || 'the product' });
  const send = handoff?.forDevelopers && !handoff.declined && handoff.status !== 'shipped' ? handoff.forDevelopers : null;
  const steps = handoff ? handoff.steps : explorationSteps(p.leadName ?? null, product);

  // ---- Activity.
  const quoted = [checkQuote?.text ?? '', p.designerZone?.text ?? '', p.notDoing?.text ?? ''];
  const timeline = p.activity === null && !p.decisions?.length ? null : timelineOf(p.activity ?? [], p.decisions ?? [], startedWhen, quoted);
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
  const screen = build ? (
    <ScreenStage
      name={screenName}
      nameHidden={nameHidden}
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
      entry={p.checkEntry ?? (handoff?.check?.review ? <BuildReviewEntry product={handoff.check.review.product} number={handoff.check.review.number} builder={handoff.check.builder} /> : null)}
      foot={stageFoot}
    />
  ) : (
    <ScreenStage name={screenName} nameHidden={nameHidden} sub={stageSub} single={{ frame: <ShotFrame p={p} />, href: previewHref }} foot={stageFoot} />
  );
  const showCode = codeShown(role, stage);
  const devLine = devLineOf(role, stage);
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
        {devLine && <p className="xp-muted xp-devline">{devLine}</p>}
      </div>
      {p.archived && !p.notDoing && p.stage !== 'loading' && (
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
        // The board: the screen, the library and Activity on the left; the rail on the right (sticky): Your turn only
        // when the viewer acts now, Before it ships, the journey, the handover notes. Phones: header, Your turn, the
        // screen, the people, the library, Activity (styles/exploration-page.css).
        <div className={turn ? 'xp-board has-turn' : 'xp-board'}>
          <div className="xp-b-left">
          <div className="xp-b-screen" id="xp-screen">{screen}</div>
          <div className="xp-b-main">
            {p.impact ? (
              <div className="xp-library" id="xp-library">
                <LibraryImpact
                  view={p.impact.view}
                  actions={p.impact.actions}
                  say={setSaid}
                  quiet={Boolean(turn)}
                  onPage
                  screen={{ capture: p.thumb ?? null, designer: p.author.name, name: p.title, href: '#xp-screen' }}
                  {...(staged.length && zone === 'lead-review' ? { newPieces: { capture: p.thumb, designer: p.author.name, choices, onChoice: (id: string, c: 'approve' | 'local') => setChoices((x) => ({ ...x, [id]: c })) } } : {})}
                />
              </div>
            ) : (
              handoff && <LibraryPart h={handoff} p={p} say={setSaid} />
            )}
            {/* The slot for "Start the check" (the Check the build review mode, its own route, coming next). */}
            <Timeline items={timeline} composer={composer} />
          </div>
          </div>
          <div className="xp-b-right">
            {turn && <div className="xp-b-turn">{turn}</div>}
            <div className="xp-b-rail">
            {p.done?.kind === 'note' && !p.archived && stage === 'exploring' && <p className="xp-muted">{p.done.text}</p>}
            <People title={stage === 'exploring' ? 'Following it' : 'Before it ships'} rows={people} after={keepExploring} />
            {!p.archived && (
              <Journey
                segments={journey.segments}
                next={journey.next}
                steps={steps.map((s) => ({ ...s, detail: send && s.title === 'Developers build it' && s.current ? <SendDetail detail={s.detail} message={send.message} /> : s.detail }))}
              />
            )}
            {p.notes && (!handoff || p.notes.notes) && <WhereItStands view={p.notes} say={setSaid} title={notesTitle} rail />}
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
