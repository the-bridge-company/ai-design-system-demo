// The parts of the exploration page's board (the approved redesign, Nov 2026), presentational only: the screen stage
// (the capture is the link to the preview; in Check the build the approved version and the developers' build side by
// side, each opening its own, never two different screens; finding differences is the review mode's job), the "Your
// turn" Harbor zone's shell,
// the steps still to come inside it, the Activity timeline with its comment box, and the developers' Code popover.
// Rules and words: lib/exploration-layout.ts. Styles: styles/exploration-page.css (xp-st-*, xp-turn*, xp-tl*, xp-code*).
import { useState, type ReactNode } from 'react';
import { Check, Code2, ExternalLink, GitBranch } from 'lucide-react';
import { Avatar, Button, CodeBlock, Icon, Input, Link, Popover, PopoverContent, PopoverTrigger, SegmentedControl, Stepper, Tab, Tabs, TabsList, TabsPanel, Tag } from '@bridge-ds/react';
import { Drawing } from './Drawing';
import { Who } from './faces';
import type { IllustrationName } from '../../../brand/illustrations';
import { CODE_WORDS, earlierLine, foldTimeline, isTeamActor, SCREEN_WORDS, type TimelineItem, type TurnStep } from '../../../lib/exploration-layout';
import type { PageFace } from '../../../lib/exploration-page';

const faceProps = (p: PageFace) => ({ login: p.login, name: p.name, agent: p.agent, avatar: p.avatar });

// ---------------------------------------------------------------------------------------------------------------
// The screen

/** A capture (or the plate) that opens its version in a new tab: scrim and a centred pill on hover and focus. */
export function ShotLink({ href, label, children, chip = true }: { href: string | null; label: string; children: ReactNode; chip?: boolean }) {
  if (!href) return <>{children}</>;
  return (
    // bridge-audit-ignore-next-line: the whole capture is one link to its version (a block with a scrim and a pill on hover); DS Link styles inline text with an underline, so a block link is requested in the PR
    <a className="xp-shotlink" href={href} target="_blank" rel="noopener" aria-label={`${label} (opens in a new tab)`}>
      {children}
      {/* The DS Button's look on a span: the whole capture is the link, so the pill only shows where it goes. */}
      <Button variant="secondary" iconEnd={ExternalLink} render={<span />} className="xp-shotlink-pill" aria-hidden="true">
        {label}
      </Button>
      {chip && (
        <Tag size="sm" icon={ExternalLink} className="xp-shotlink-chip" aria-hidden="true">
          {SCREEN_WORDS.openChip}
        </Tag>
      )}
    </a>
  );
}

export interface CompareSide {
  /** What the side is, on top: "Approved", "Malik's build". */
  label: string;
  when: string;
  face?: PageFace | null;
  /** The approved side: a check before its label. */
  approved?: boolean;
  frame: ReactNode;
  /** The same frame's image source, for Overlay and Swipe. */
  src: string | null;
  href: string | null;
}

/**
 * The screen of the exploration: its name, one line on what it shows, then the capture. The block is for looking, not
 * for finding differences (that is the review mode of Check the build): with two versions, both side by side on wide
 * screens, and on a phone one quiet switch between them. Each capture opens its own version. Two captures of
 * different screens say so honestly on the build's side.
 */
export function ScreenStage({ name, nameHidden = false, about = null, sub, single, compare, mismatch, entry, foot }: { name: string; /** The name repeats the page title: only screen readers get it, the line stands alone. */ nameHidden?: boolean; /** One plain sentence of what the exploration does, under the name. */ about?: string | null; sub: string; single?: { frame: ReactNode; href: string | null } | null; compare?: { a: CompareSide; b: CompareSide } | null; mismatch?: ReactNode; /** Check the build: the review mode's entry (facts, region crops, Start the check), under the two versions. */ entry?: ReactNode; foot?: ReactNode }) {
  const [shown, setShown] = useState<'a' | 'b'>('b');
  return (
    <section className={compare ? 'xp-stage has-two' : 'xp-stage'} aria-label="The screen">
      <div className="xp-st-head">
        <h2 className={nameHidden ? 'sr-only' : 'xp-st-name'}>{name}</h2>
        <span className={nameHidden ? 'xp-st-sub is-alone' : 'xp-muted xp-st-sub'}>{nameHidden ? sub.charAt(0).toUpperCase() + sub.slice(1) : sub}</span>
        {about && <p className="xp-st-about">{about}</p>}
        {compare && (
          <SegmentedControl
            size="sm"
            label="Which version"
            value={shown}
            onValueChange={(v) => setShown(v === 'a' ? 'a' : 'b')}
            className="xp-st-modes"
            items={[
              { value: 'a', label: compare.a.label },
              { value: 'b', label: compare.b.label },
            ]}
          />
        )}
      </div>
      {compare ? (
        <div className="xp-st-pair" data-shown={shown}>
          {[compare.a, compare.b].map((s, i) => (
            <figure key={s.label} className={i === 0 ? 'xp-st-side is-a' : 'xp-st-side is-b'}>
              <figcaption className="xp-st-label">
                {s.approved ? <Icon icon={Check} size="sm" /> : s.face ? <Who p={faceProps(s.face)} size="xs" /> : null}
                <strong>{s.label}</strong>
                {s.when && <span className="xp-muted">{s.when}</span>}
              </figcaption>
              {i === 1 && mismatch ? (
                <div className="xp-st-mismatch-wrap">
                  {s.frame}
                  <div className="xp-st-mismatch" role="note">
                    {mismatch}
                  </div>
                </div>
              ) : (
                <ShotLink href={s.href} label={i === 0 ? 'Open the approved version' : 'Open the build'}>
                  {s.frame}
                </ShotLink>
              )}
            </figure>
          ))}
        </div>
      ) : (
        single && <ShotLink href={single.href} label={SCREEN_WORDS.open}>{single.frame}</ShotLink>
      )}
      {entry && <div className="xp-st-entry">{entry}</div>}
      {foot}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The Your turn zone

/**
 * Each Field Guide drawing cropped to its scene (no empty sky), so the strip above the eyebrow holds the drawing, not
 * its margins: "x y w h" in the drawing's own units (brand/illustrations.ts, read only).
 */
const TURN_ART_CROP: Partial<Record<IllustrationName, string>> = {
  review: '4 98 226 88',
  guide: '8 8 104 96',
  paint: '4 14 112 96',
  fix: '4 4 112 100',
  components: '4 46 112 62',
};

/** The strip's height in px (var(--size-20)): every drawing is drawn at this height, its width from its crop. */
const TURN_ART_H = 80;

/**
 * The one Harbor zone, only when the viewer acts now: the Field Guide drawing as a strip on the card's text edge above
 * the eyebrow (batch C, C2: composed with the card, never squeezed in a corner beside the title), then the eyebrow and
 * the question as title, tight together as one heading over the full width, the context, an open question as an
 * avatar quote, then the buttons last on one row (a lone one fills it).
 */
export function TurnZone({ eyebrow, title, drawing, children, quote, actions, id = 'xp-turn-h' }: { eyebrow: string; title: string; drawing: IllustrationName; children?: ReactNode; quote?: ReactNode; actions?: ReactNode; id?: string }) {
  const crop = TURN_ART_CROP[drawing];
  const [, , cw, ch] = (crop ?? '0 0 1 1').split(' ').map(Number) as [number, number, number, number];
  return (
    <section className="xp-turn zone" aria-labelledby={id}>
      <div className="xp-turn-head">
        <Drawing name={drawing} crop={crop} width={crop ? Math.round((TURN_ART_H * cw) / ch) : TURN_ART_H} className="xp-turn-art" />
        <div className="xp-turn-head-text">
          <p className="xp-turn-eyebrow">{eyebrow}</p>
          <h2 className="xp-turn-q" id={id}>
            {title}
          </h2>
        </div>
      </div>
      {children && <div className="xp-turn-body">{children}</div>}
      {quote && <div className="xp-turn-quote">{quote}</div>}
      {actions && <div className="xp-turn-acts">{actions}</div>}
    </section>
  );
}

/** "Sofia asks / Should Shipped show the carrier?": a face, who, their words, and the way to answer on the same line. */
export function AskQuote({ who, verb, text, action }: { who: PageFace; verb: string; text: string; action?: ReactNode }) {
  return (
    <figure className="xp-ask">
      <Who p={faceProps(who)} size="sm" />
      <span className="xp-ask-text">
        <figcaption className="xp-muted">
          {who.name} {verb}
        </figcaption>
        <blockquote>{text}</blockquote>
      </span>
      {action && <span className="xp-ask-act">{action}</span>}
    </figure>
  );
}

/**
 * The steps still to come, inside the turn block (direction B): a compact vertical list, the step happening now marked
 * (aria-current) in Deep Harbor with its quiet "now, for 3 days".
 */
export function TurnSteps({ steps }: { steps: readonly TurnStep[] }) {
  if (!steps.length) return null;
  const current = steps.findIndex((s) => s.current);
  return (
    <Stepper
      className="xp-turn-steps"
      label="What happens next"
      current={current < 0 ? undefined : current}
      steps={steps.map((s) => ({ label: s.lines?.length ? <StepLines lines={s.lines} /> : s.text, ...(s.when ? { meta: s.when } : {}) }))}
    />
  );
}

/** Both reviews inside the one current step: one line each, who and the hat. */
function StepLines({ lines }: { lines: readonly string[] }) {
  return (
    <span className="xp-turn-lines">
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Activity

/** The Activity's quiet note when its read failed (lib/home-explorations PARTIAL_LINE's words for the activity). */
export const ACTIVITY_UNREAD = 'Part of the activity could not be read just now. Reload in a minute to see all of it.';

export function Timeline({ items, earlierBy, composer, unread = false }: { items: readonly TimelineItem[] | null; earlierBy?: string | null; composer?: ReactNode; /** The activity read failed: one quiet line, never fewer events as if complete. */ unread?: boolean }) {
  const [all, setAll] = useState(false);
  const { earlier, shown } = foldTimeline(items ?? []);
  const rows = all ? [...earlier, ...shown] : shown;
  return (
    <section className="xp-activity" aria-labelledby="xp-act-h">
      <h2 className="xp-h2" id="xp-act-h">
        Activity
      </h2>
      {earlier.length > 0 && !all && (
        <p className="xp-muted xp-tl-earlier">
          {earlierLine(earlier.length)}
          {earlierBy ? ` by ${earlierBy}` : ''},{' '}
          <Button variant="link" size="sm" onClick={() => setAll(true)}>
            Show
          </Button>
        </p>
      )}
      {unread && <p className="xp-muted">{ACTIVITY_UNREAD}</p>}
      {items && (
        <ol className="xp-tl">
          {rows.map((r) => (
            <li key={r.key} className={r.milestone ? 'xp-tl-row is-mile' : 'xp-tl-row'}>
              {r.milestone ? (
                <span className="xp-tl-dot" aria-hidden="true">
                  <Icon icon={Check} size="xs" />
                </span>
              ) : isTeamActor(r.who) ? (
                // A team, not a person (a commit signed "Acme design team"): its initials, never a drawn face (C14).
                <Avatar name={r.who.name} size="xs" decorative />
              ) : (
                <Who p={r.who} size="xs" />
              )}
              <span className="xp-tl-text">
                <strong>{r.who.name}</strong> {r.text}
              </span>
              <span className="xp-muted xp-when">{r.when}</span>
              {r.quote && <blockquote className="xp-tl-quote">{r.quote}</blockquote>}
            </li>
          ))}
        </ol>
      )}
      {composer}
    </section>
  );
}

/** The comment box at the end of Activity, naming who reads it. */
export function Composer({ me, placeholder, onSend, say }: { me: PageFace | null; placeholder: string; onSend: (text: string) => Promise<string | void>; say: (s: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="xp-compose"
      id="xp-compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        onSend(text.trim())
          .then((r) => {
            if (r) say(r);
            setText('');
          })
          .catch((err: Error) => say(err.message))
          .finally(() => setBusy(false));
      }}
    >
      {/* The timeline's face size, so the composer's face sits on the same axis as the faces above it. */}
      {me && <Who p={faceProps(me)} size="xs" />}
      <div className="xp-compose-field">
        <Input label={placeholder} hideLabel size="lg" placeholder={placeholder} value={text} onValueChange={setText} />
      </div>
      <Button type="submit" variant="secondary" size="lg" loading={busy} disabled={!text.trim()}>
        Send
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Code, for developers once it is handed to them

export function CodeButton({ who, commands, check, claude, branch, href, refLabel, onCopy }: { who: string; commands: readonly string[] | null; check: string | null; claude: string | null; branch: string | null; href: string; refLabel: string; onCopy: (t: string) => Promise<void> }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" size="lg" iconStart={Code2} />}>{CODE_WORDS.button}</PopoverTrigger>
      <PopoverContent title={CODE_WORDS.title} description={`${who}'s exploration, handed to the developers. Your starting point.`} align="end" className="xp-code">
        <Tabs defaultValue="terminal" size="sm">
          <TabsList aria-label="Where you work">
            <Tab value="terminal">{CODE_WORDS.terminal}</Tab>
            <Tab value="claude">{CODE_WORDS.claude}</Tab>
          </TabsList>
          <TabsPanel value="terminal" className="xp-code-panel">
            {commands && <CodeBlock label={CODE_WORDS.getBranch} code={commands.join('\n')} wrap onCopy={(c) => void onCopy(c)} />}
            {check && <CodeBlock label={CODE_WORDS.checkAgain} code={check} onCopy={(c) => void onCopy(c)} />}
          </TabsPanel>
          <TabsPanel value="claude" className="xp-code-panel">
            {claude && <CodeBlock label={CODE_WORDS.askClaude} code={claude} wrap onCopy={(c) => void onCopy(c)} />}
            <p className="xp-muted">{CODE_WORDS.pasteClaude}</p>
          </TabsPanel>
        </Tabs>
        {branch && (
          <p className="xp-code-branch">
            <Icon icon={GitBranch} size="sm" />
            <span className="xp-mono">{branch}</span>
          </p>
        )}
        <p className="xp-code-foot">
          <Link href={href} target="_blank" rel="noopener">
            {CODE_WORDS.openTask}
            <Icon icon={ExternalLink} size="xs" />
          </Link>
          <span className="xp-muted xp-mono">{refLabel}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}
