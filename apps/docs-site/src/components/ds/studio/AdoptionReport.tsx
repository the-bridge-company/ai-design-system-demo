// Studio > Quality > a product: its adoption report, inside Bridge (validated design 2026-11-11, the designer version;
// words and grouping in lib/adoption-report.ts). One plain verdict in the page's Harbor zone with ONE primary action
// (Send to developers, for who can act), two score cards in words, then tabs: Pieces (groups of whole pieces, the
// biggest change first, then the pieces the library is missing), Colors (swatch pairs) and Sizes and spacing. Each
// group opens on the two pictures (the product's: the screen that holds most of the group, captured from its live
// address, click to enlarge; else an honest "No picture yet"; the library's own preview), the one change that covers most of it, the group's actions, and the developers' detail
// behind one fold. Actions for a design lead or an admin only: designers read. On the sample team the actions stay in
// this browser, like every other edit there. Repo content is React text only; links go through safeUrl.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronLeft, Code, Download, ExternalLink, ImageOff, Maximize2, Send } from 'lucide-react';
import { Accordion, AccordionItem, Badge, Button, Card, CardBody, Dialog, DialogContent, DialogTrigger, Icon, Link, Tab, Tabs, TabsList, TabsPanel, Textarea } from '@bridge-ds/react';
import { composeRequestIssue, parseRequestIssue, REQUEST_LABEL, requestOriginOf, type AuditIgnore } from '@bridge-ds/core';
import ButtonLink from '../ButtonLink';
import { QuietScene } from './QuietScene';
import { StudioHead } from './StudioHead';
import { TeamLoadError, TeamLoadProgress, useTeamData } from './TeamState';
import { FIRST_RUN_LINE, groupRequest, pieceWord, restLine, ignoreReasonProblems, measuredLines, reportModel, type GapCard, type PieceRow, type ReportModel, type ScoreCard, type ScreenPicture, type ValueRow } from '../../../lib/adoption-report';
import { shotsFileUrl } from '../../../lib/preview-shots';
import { bridgeDataUrl } from '../../../lib/library/published';
import { runDate } from '../../../lib/quality-view';
import { safeUrl } from '../../../lib/html';
import { studioHref } from '../../../lib/team-path';
import { setPageSummary } from '../../../lib/page-summary';
import { isSampleTeam } from '../../../lib/demo';
import { loadTeamAuditIgnores, loadTeamAuditReport, saveTeamAuditIgnore, teamLead, type TeamAuditReport, type TeamData } from '../../../scripts/team-data';
import { contributorFor } from '../../../scripts/contribute-session';
import { currentViewer } from '../../../scripts/github-session';

/** Pictures show; they never take focus or clicks (React 18 has no typed `inert` prop). */
const INERT = { inert: '' } as Record<string, string>;
const external = { target: '_blank', rel: 'noopener noreferrer' };
/** Groups shown before "Show all". */
const FIRST_GROUPS = 5;
/** Places shown in a developers' fold before "Show all". */
const FIRST_PLACES = 5;

export type Sent = Record<string, { number: number | null; url: string | null }>;

export interface ReportActions {
  /** A design lead or an admin: may send groups to developers and mark them as not a problem. */
  canAct: boolean;
  /** May keep a "Not a problem" decision: a lead or an admin (signed in with GitHub, or by email through Bridge), or the sample team's browser. */
  canIgnore: boolean;
  /** The sample team: actions stay in this browser. */
  local: boolean;
  sent: Sent;
  send: (keys: string[]) => Promise<void>;
  ignore: (key: string, reason: string) => Promise<void>;
}

// ---------------------------------------------------------------------------------------------------------------
// Pictures

/** The address the page may load for a picture path of the report, or null (none for a private team yet). */
export type PictureSrc = (path: string) => string | null;
const PictureContext = createContext<PictureSrc>(() => null);

/** The picture's address, null once it failed to load (the plate then says there is none). */
function usePicture(screen: ScreenPicture | null): [string | null, () => void] {
  const resolve = useContext(PictureContext);
  const src = screen?.image ? resolve(screen.image) : null;
  const [failed, setFailed] = useState<string | null>(null);
  return [src && src !== failed ? src : null, () => setFailed(src)];
}

function NoPicture({ big = false, line }: { big?: boolean; line?: string }) {
  return (
    <span className={big ? 'ar-plate ar-plate-big ar-plate-none' : 'ar-plate ar-plate-none'}>
      <Icon icon={ImageOff} size="sm" />
      <span>No picture yet</span>
      {big && line && <span className="ar-plate-why">{line}</span>}
    </span>
  );
}

/** The product side, small: the screen where the group lives, scaled to fit, else "No picture yet". */
function ProductPlate({ screen }: { screen: ScreenPicture | null }) {
  const [src, fail] = usePicture(screen);
  if (!src) return <NoPicture />;
  return (
    <span className="ar-plate ar-plate-shot">
      <img src={src} alt="" loading="lazy" decoding="async" onError={fail} />
    </span>
  );
}

/** The product side, open: the picture, click to enlarge in a dialog, and where the group sits, in words. */
function ProductFigure({ screen, product }: { screen: ScreenPicture | null; product: string }) {
  const [src, fail] = usePicture(screen);
  const whole = 'The whole screen shows: the pieces are not marked on it yet.';
  return (
    <figure className="ar-fig">
      <figcaption className="ar-cap">
        In {product}
        {screen ? `: the ${screen.name} screen` : ''}
      </figcaption>
      {src && screen ? (
        <Dialog>
          <DialogTrigger className="ar-plate ar-plate-big ar-plate-shot ar-shot-open" aria-label={`Enlarge the picture of the ${screen.name} screen`}>
            <img src={src} alt="" loading="lazy" decoding="async" onError={fail} />
            <span className="ar-shot-hint" aria-hidden="true">
              <Icon icon={Maximize2} size="sm" />
            </span>
          </DialogTrigger>
          <DialogContent size="lg" title={`The ${screen.name} screen of ${product}`} description={`${screen.line} ${whole}${screen.capturedAt ? ` Captured ${runDate(screen.capturedAt)}.` : ''}`}>
            <img className="ar-shot-full" src={src} alt={`The ${screen.name} screen of ${product}`} />
            {screen.url && (
              <Link href={safeUrl(screen.url, '#')} {...external} className="ar-shot-go">
                Open this screen in {product} <Icon icon={ExternalLink} size="sm" />
              </Link>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <NoPicture big line={screen ? `Bridge has not captured the ${screen.name} screen yet.` : 'Bridge does not know which screen shows these yet.'} />
      )}
      {screen && <span className="ar-shot-line">{screen.line}</span>}
    </figure>
  );
}

/** A library button drawn as itself, never a second button inside the group's trigger (the real Button, as a span). */
const SampleButton = ({ variant, children }: { variant: 'primary' | 'secondary' | 'danger'; children: string }) => (
  <Button variant={variant} size="sm" render={<span />} tabIndex={-1}>
    {children}
  </Button>
);

/**
 * The library side: the library component drawn with the real @bridge-ds/react components and plain content made for
 * the report (decided 2026-11-11: never the docs samples, whose words are the library's own). Overlays (dialog, menu,
 * side panel) are drawn open and static, on the overlay surface. Anything else: its name on a neutral plate.
 */
function LibrarySample({ name }: { name: string }) {
  switch (name) {
    case 'Button':
      return (
        <span className="ar-pv-row">
          <SampleButton variant="secondary">Cancel</SampleButton>
          <SampleButton variant="primary">Save</SampleButton>
        </span>
      );
    case 'Dialog':
    case 'AlertDialog':
      return (
        <span className="ar-pv-surface ar-pv-dialog">
          <span className="ar-pv-title">Delete this contact?</span>
          <span className="ar-pv-row ar-pv-end">
            <SampleButton variant="secondary">Cancel</SampleButton>
            <SampleButton variant="danger">Delete</SampleButton>
          </span>
        </span>
      );
    case 'Menu':
      return (
        <span className="ar-pv-surface ar-pv-menu">
          <span className="ar-pv-item">Edit</span>
          <span className="ar-pv-item">Duplicate</span>
          <span className="ar-pv-item is-danger">Delete</span>
        </span>
      );
    case 'Link':
      return <span className="ar-pv-link">See all contacts</span>;
    case 'Drawer':
      return (
        <span className="ar-pv-surface ar-pv-drawer">
          <span className="ar-pv-title">Filters</span>
          <span className="ar-pv-line" />
          <span className="ar-pv-line is-short" />
        </span>
      );
    case 'Card':
      return (
        <Card padding="compact" className="ar-pv-card">
          <CardBody className="ar-pv-card-body">
            <span className="ar-pv-title">Card title</span>
            <span className="ar-pv-muted">One line of text</span>
          </CardBody>
        </Card>
      );
    default:
      return <span className="ar-pv-name">{name}</span>;
  }
}

function LibraryPlate({ name, big = false }: { name: string; big?: boolean }) {
  return (
    <span className={big ? 'ar-plate ar-plate-big' : 'ar-plate'} aria-hidden="true" {...INERT}>
      <span className="ar-fit">
        <LibrarySample name={name} />
      </span>
    </span>
  );
}

function Swatch({ color, label }: { color?: string | undefined; label?: string }) {
  return color ? <span className="ar-swatch" style={{ background: color }} role="img" aria-label={label ?? color} /> : <span className="ar-swatch ar-swatch-none">{label ?? 'none'}</span>;
}

// ---------------------------------------------------------------------------------------------------------------
// The developers' fold

interface DevPlace {
  file: string;
  line: number;
  what: string;
  from: string;
  href: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        });
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </Button>
  );
}

function DevFold({ summary, fix, use, places }: { summary: string; fix?: PieceRow['dev']['fix']; use?: string | null; places: DevPlace[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? places : places.slice(0, FIRST_PLACES);
  return (
    <Accordion headingLevel={4} className="ar-dev">
      <AccordionItem
        value="dev"
        title={
          <span className="ar-dev-title">
            <Icon icon={Code} size="sm" /> {summary}
          </span>
        }
      >
        {fix && (
          <>
            <p className="ar-dev-line">
              <strong>Fix at the source:</strong>{' '}
              <span className="mono">
                {fix.file}:{fix.line}
              </span>{' '}
              re-creates {fix.name} and is used {fix.instances} times.
            </p>
            <div className="ar-change">
              <code className="ar-code is-before">{fix.before}</code>
              <span className="ar-becomes">becomes</span>
              <code className="ar-code is-after">{fix.after}</code>
              <CopyButton text={fix.after} />
            </div>
          </>
        )}
        {use && (
          <div className="ar-change">
            <span className="ar-becomes">Use</span>
            <code className="ar-code is-after">{use}</code>
            <CopyButton text={use} />
          </div>
        )}
        <ul className="ar-places">
          {shown.map((p) => (
            <li key={`${p.file}:${p.line}:${p.what}`}>
              <span className="mono ar-place-file">
                {p.file}
                <span className="ar-muted">:{p.line}</span>
              </span>
              <span className="ar-place-what">
                <code className="ar-tag">{p.what}</code> <span className="ar-muted">{p.from}</span>
              </span>
              {p.href ? (
                <Link href={safeUrl(p.href, '#')} {...external} className="ar-place-go">
                  Open in GitHub <Icon icon={ExternalLink} size="sm" />
                </Link>
              ) : (
                <span />
              )}
            </li>
          ))}
          {places.length > FIRST_PLACES && !all && (
            <li className="ar-more">
              <span className="ar-muted">{places.length - FIRST_PLACES} more places</span>
              <Button variant="link" size="sm" onClick={() => setAll(true)}>
                Show all {places.length}
              </Button>
            </li>
          )}
        </ul>
      </AccordionItem>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Actions on a group

function NotAProblem({ title, onSave, local }: { title: string; onSave: (reason: string) => Promise<void>; local: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const problems = ignoreReasonProblems(reason);
    if (problems.length) {
      setError(problems[0]!);
      return;
    }
    setBusy(true);
    try {
      await onSave(reason.trim());
      setOpen(false);
    } catch (err) {
      setError(`Bridge could not keep it: ${(err as Error).message} Try again, or ask an admin signed in with GitHub.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="link" onClick={() => setOpen(true)}>
        Not a problem
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Not a problem?"
          description={`${title} stay as they are and leave the list. The next check of the code leaves them out of the count, with your reason.${local ? ' On a sample team this stays in this browser.' : ''}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} onClick={() => void save()}>
                Keep them as they are
              </Button>
            </>
          }
        >
          <Textarea label="Why they stay" hint="The next person who opens the report reads it." value={reason} onValueChange={(v) => { setReason(v); setError(null); }} error={error ?? undefined} rows={3} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SentLine({ sent, local }: { sent: Sent[string]; local: boolean }) {
  return (
    <span className="ar-sent" role="status">
      <Icon icon={Check} size="sm" />
      {local ? (
        'Sent to developers (sample team: nothing left this browser)'
      ) : sent.number && sent.url ? (
        <>
          Sent,{' '}
          <Link href={safeUrl(sent.url, '#')} {...external}>
            issue #{sent.number}
          </Link>
        </>
      ) : (
        'Sent to developers'
      )}
    </span>
  );
}

function GroupActions({ id, title, actions }: { id: string; title: string; actions: ReportActions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = actions.sent[id];
  if (!actions.canAct) return sent ? <div className="ar-actions"><SentLine sent={sent} local={actions.local} /></div> : null;
  return (
    <div className="ar-actions">
      {error && (
        <span className="ar-error" role="alert">
          {error}
        </span>
      )}
      {actions.canIgnore && <NotAProblem title={title} local={actions.local} onSave={(r) => actions.ignore(id, r)} />}
      {sent ? (
        <SentLine sent={sent} local={actions.local} />
      ) : (
        <Button
          variant="secondary"
          iconStart={Send}
          loading={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            actions
              .send([id])
              .catch((err: unknown) => setError(`Not sent: ${(err as Error).message}`))
              .finally(() => setBusy(false));
          }}
        >
          Send to developers
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Rows

function Gain({ product, gain, what }: { product: string; gain: PieceRow['gain']; what: string }) {
  if (!gain) return null;
  return (
    <span className="ar-gain">
      Switching them takes {product} from {gain.from} to <strong>{gain.to}</strong> {what}
    </span>
  );
}

function PieceItem({ row, product, actions }: { row: PieceRow; product: string; actions: ReportActions }) {
  return (
    <AccordionItem
      value={row.key}
      className="ar-item"
      title={
        <span className="ar-head">
          <span className="ar-text">
            <span className="ar-title">{row.title}</span>
            <span className="ar-detail">{row.detail}</span>
            <Gain product={product} gain={row.gain} what="library pieces" />
            {actions.sent[row.key] && <span className="ar-tag-sent">Sent to developers</span>}
          </span>
          <span className="ar-minis" aria-hidden="true">
            <span className="ar-mini">
              <span className="ar-cap">In {product}</span>
              <ProductPlate screen={row.screen} />
            </span>
            <span className="ar-mini">
              <span className="ar-cap">In the library</span>
              <LibraryPlate name={row.component} />
            </span>
          </span>
        </span>
      }
    >
      <div className="ar-pair">
        <ProductFigure screen={row.screen} product={product} />
        <figure className="ar-fig">
          <figcaption className="ar-cap">In the library: {row.component}</figcaption>
          <LibraryPlate name={row.component} big />
        </figure>
      </div>
      {row.source && (
        <p className="ar-callout">
          <strong>{row.source.lead}</strong> {row.source.text}
        </p>
      )}
      <GroupActions id={row.key} title={row.title} actions={actions} />
      <DevFold summary={row.dev.summary} fix={row.dev.fix} places={row.dev.places} />
    </AccordionItem>
  );
}

function ValueItem({ row, actions }: { row: ValueRow; actions: ReportActions }) {
  const isColor = row.group.category === 'color';
  return (
    <AccordionItem
      value={row.key}
      className="ar-item ar-value"
      title={
        <span className="ar-head">
          <span className="ar-text">
            <span className="ar-title">{row.title}</span>
            <span className="ar-detail">{row.detail}</span>
            {actions.sent[row.key] && <span className="ar-tag-sent">Sent to developers</span>}
          </span>
          <span className="ar-pairline">
            <span className="ar-side">
              <span className="ar-swatches">
                {isColor ? row.product.slice(0, 6).map((p) => <Swatch key={p.value} color={p.color} label={p.name} />) : <span className="mono ar-val">{row.product.slice(0, 2).map((p) => p.value).join(', ')}</span>}
              </span>
              <span className="ar-cap">{row.productCaption}</span>
            </span>
            <Icon icon={ArrowRight} size="sm" className="ar-arrow" />
            <span className="ar-side">
              <span className="ar-swatches">{isColor ? <Swatch color={row.library?.color} label={row.library ? row.library.name : 'none'} /> : <span className="mono ar-val">{row.library ? row.library.value : 'none'}</span>}</span>
              <span className="ar-cap">{row.library?.name ?? (isColor ? 'No library color' : 'No library value')}</span>
            </span>
          </span>
          <Badge tone={row.match.tone} size="sm" className="ar-match">
            {row.match.label}
          </Badge>
        </span>
      }
    >
      <ul className="ar-values">
        {row.product.map((p) => (
          <li key={p.value}>
            {isColor && <Swatch color={p.color} label={p.name} />}
            <span>{isColor ? p.name : 'As written'}</span>
            <code className="ar-tag">{p.value}</code>
            <span className="ar-muted">{row.group.values.find((v) => v.value === p.value)?.count ?? 0}×</span>
          </li>
        ))}
      </ul>
      {row.library && (
        <p className="ar-callout">
          <strong>Use the library's {row.library.name}</strong> <code className="ar-tag">{row.library.token}</code> {row.library.value}
          {row.match.tone === 'warning' ? '. It is close, not the same: check it means the same thing first.' : '.'}
        </p>
      )}
      <GroupActions id={row.key} title={row.title} actions={actions} />
      <DevFold summary={row.dev.summary} use={row.dev.use} places={row.dev.places} />
    </AccordionItem>
  );
}

/** Groups, the first few, then the rest on demand. */
function GroupList<T extends { key: string; title: string }>({ rows, render, name }: { rows: T[]; render: (row: T) => ReactNode; name: (row: T) => string }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST_GROUPS);
  const rest = rows.slice(FIRST_GROUPS);
  return (
    <div className="ar-groups">
      <Accordion headingLevel={3} className="ar-list">
        {shown.map(render)}
      </Accordion>
      {!all && rest.length > 0 && (
        <p className="ar-rest">
          <span className="ar-muted">{restLine(rest.map(name))}</span>
          <Button variant="link" onClick={() => setAll(true)}>
            Show all {rows.length}
          </Button>
        </p>
      )}
    </div>
  );
}

function Gaps({ gaps, partsLine }: { gaps: GapCard[]; partsLine: string | null }) {
  if (!gaps.length && !partsLine) return null;
  return (
    <section className="ar-gaps fg-card" aria-labelledby="ar-gaps-title">
      <h3 id="ar-gaps-title" className="ar-h3">
        Pieces the library is missing
      </h3>
      {gaps.length > 0 ? (
        <>
          <p className="ar-muted">The product built these itself because the library has nothing like them yet.</p>
          <ul className="ar-gap-list">
            {gaps.map((g) => (
              <li key={g.key}>
                <ProductPlate screen={g.screen} />
                <span className="ar-gap-name">{g.name}</span>
                <span className="ar-muted">{g.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="ar-muted">The library has a piece for everything Bridge found.</p>
      )}
      {partsLine && <p className="ar-muted ar-parts">{partsLine}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict and score cards

function Spark({ points }: { points: ScoreCard['points'] }) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => 4 + (i / (points.length - 1)) * 152;
  const y = (v: number) => 24 - ((v - min) / span) * 18;
  return (
    <span className="ar-spark" aria-hidden="true">
      <svg viewBox="0 0 160 30" preserveAspectRatio="none">
        <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
        {points.map((p, i) => (
          <circle key={p.at} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3.5 : 2.5} className={i === points.length - 1 ? 'is-now' : undefined} />
        ))}
      </svg>
      <span className="ar-spark-dates">
        <span>{runDate(points[0]!.at)}</span>
        <span>{runDate(points[points.length - 1]!.at)}</span>
      </span>
    </span>
  );
}

function Cards({ cards }: { cards: ScoreCard[] }) {
  return (
    <ul className="ar-cards" aria-label="Scores">
      {cards.map((c) => (
        <li key={c.id}>
          <Card padding="compact" className="ar-card">
            <CardBody className="ar-card-body">
              <span className="ar-card-text">
                <h2 className="ar-card-name">{c.name}</h2>
                <span className="ar-card-value">
                  <span className="ar-big">{c.value}</span>
                  {c.trend && (
                    <span className={`ar-trend is-${c.trend.direction}`}>
                      {c.trend.direction !== 'flat' && <Icon icon={c.trend.direction === 'up' ? ArrowUp : ArrowDown} size="sm" />} {c.trend.text}
                    </span>
                  )}
                </span>
                <span className="ar-card-label">{c.label}</span>
              </span>
              {c.points.length ? <Spark points={c.points} /> : <span className="ar-first">{FIRST_RUN_LINE}</span>}
            </CardBody>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Verdict({ model, actions }: { model: ReportModel; actions: ReportActions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toSend = model.verdict.send.filter((k) => !actions.sent[k]);
  const allSent = model.verdict.send.length > 0 && toSend.length === 0;
  return (
    <section className="zone ql-verdict ar-verdict" data-mood={model.verdict.mood} aria-labelledby="ar-verdict-title">
      <QuietScene scene="lighthouse" mood={model.verdict.mood} width={256} className="ql-scene" />
      <div className="ql-verdict-text">
        <h2 id="ar-verdict-title" className="ql-verdict-title">
          {model.verdict.title}
        </h2>
        <p className="ql-verdict-sentence">{model.verdict.sentence}</p>
        {actions.canAct && toSend.length > 0 && (
          <Button
            variant="primary"
            iconStart={Send}
            loading={busy}
            className="ql-cta"
            onClick={() => {
              setBusy(true);
              setError(null);
              actions
                .send(toSend)
                .catch((err: unknown) => setError(`Not sent: ${(err as Error).message}`))
                .finally(() => setBusy(false));
            }}
          >
            Send to developers
          </Button>
        )}
        {allSent && <SentLine sent={{ number: null, url: null }} local={actions.local} />}
        {error && (
          <p className="ar-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The page body

export function AdoptionReportView({ model, actions, pictureSrc }: { model: ReportModel; actions: ReportActions; pictureSrc?: PictureSrc }) {
  const p = model.product;
  return (
    <PictureContext.Provider value={pictureSrc ?? noPicture}>
    <div className="ar">
      <Verdict model={model} actions={actions} />
      <Cards cards={model.cards} />
      <Tabs defaultValue="pieces" className="ar-tabs">
        <TabsList aria-label="What the report shows">
          <Tab value="pieces">Pieces</Tab>
          <Tab value="colors">Colors</Tab>
          <Tab value="sizes">Sizes and spacing</Tab>
        </TabsList>
        <TabsPanel value="pieces" className="ar-panel">
          <p className="ar-lead">What to switch to the library, the biggest change first.</p>
          {model.pieces.length ? (
            <GroupList rows={model.pieces} name={(r) => pieceWord(r.component, 2)} render={(row) => <PieceItem key={row.key} row={row} product={p} actions={actions} />} />
          ) : (
            <p className="ar-muted">Every piece Bridge found comes from the library.</p>
          )}
          <Gaps gaps={model.gaps} partsLine={model.partsLine} />
        </TabsPanel>
        <TabsPanel value="colors" className="ar-panel">
          <p className="ar-lead">Colors {p} picked itself, next to the library color to use instead.</p>
          {model.colors.length ? <GroupList rows={model.colors} name={(r) => r.title.toLowerCase()} render={(row) => <ValueItem key={row.key} row={row} actions={actions} />} /> : <p className="ar-muted">Every color comes from the library.</p>}
        </TabsPanel>
        <TabsPanel value="sizes" className="ar-panel">
          <p className="ar-lead">Sizes and spacing {p} wrote itself, next to the library value to use instead.</p>
          {model.sizes.length ? <GroupList rows={model.sizes} name={(r) => r.title.toLowerCase()} render={(row) => <ValueItem key={row.key} row={row} actions={actions} />} /> : <p className="ar-muted">Every size and spacing value comes from the library.</p>}
        </TabsPanel>
      </Tabs>
      <Accordion headingLevel={2} className="ar-foot" multiple>
        {model.ignored.length > 0 && (
          <AccordionItem value="ignored" title="Left as they are on purpose" meta={<span className="num">{model.ignored.length}</span>}>
            <ul className="ar-ignored">
              {model.ignored.map((x) => (
                <li key={x.group}>
                  <span className="ar-title">{x.title ?? x.group}</span>
                  <span className="ar-muted">
                    {x.reason}
                    {x.by ? `, ${x.by}` : ''}
                    {x.at ? `, ${runDate(x.at)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </AccordionItem>
        )}
        <AccordionItem value="how" title="How this is measured">
          {measuredLines(p).map((l) => (
            <p key={l} className="ar-muted">
              {l}
            </p>
          ))}
        </AccordionItem>
      </Accordion>
    </div>
    </PictureContext.Provider>
  );
}

const noPicture: PictureSrc = () => null;

// ---------------------------------------------------------------------------------------------------------------
// The team page: reads the report, the decisions and the requests already sent, then wires the actions.

const LOCAL_KEY = (repo: string) => `bridge.adoption.v1.${repo.toLowerCase()}`;
interface LocalState {
  sent: Record<string, true>;
  ignores: AuditIgnore[];
}
function readLocal(repo: string): LocalState {
  try {
    const x = JSON.parse(localStorage.getItem(LOCAL_KEY(repo)) ?? 'null') as LocalState | null;
    return x && typeof x === 'object' ? { sent: x.sent ?? {}, ignores: Array.isArray(x.ignores) ? x.ignores : [] } : { sent: {}, ignores: [] };
  } catch {
    return { sent: {}, ignores: [] };
  }
}
function writeLocal(repo: string, s: LocalState) {
  try {
    localStorage.setItem(LOCAL_KEY(repo), JSON.stringify(s));
  } catch {
    /* storage blocked: kept for this page only */
  }
}

/** The product key in the address (?product=crm). */
const productParam = () => (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('product') ?? '').trim());

function Ready({ data, loaded }: { data: TeamData; loaded: TeamAuditReport }) {
  const repo = `${data.owner}/${data.repo}`;
  const key = loaded.product.key;
  const local = isSampleTeam(repo) && !data.canEdit;
  const lead = teamLead(data);
  const canAct = lead || local;
  const [ignores, setIgnores] = useState<AuditIgnore[]>(() => []);
  const [sent, setSent] = useState<Sent>({});
  useEffect(() => {
    let live = true;
    if (local) {
      const s = readLocal(repo);
      setIgnores(s.ignores.filter((x) => x.product === key));
      setSent(Object.fromEntries(Object.keys(s.sent).filter((k) => k.startsWith(`${key}|`)).map((k) => [k.slice(key.length + 1), { number: null, url: null }])));
      return;
    }
    void loadTeamAuditIgnores().then((f) => live && setIgnores(f.ignores));
    // Requests already sent from this report: one issue per group, found by its audit origin.
    void data.client
      .listIssues({ label: REQUEST_LABEL, state: 'all', perPage: 100 })
      .then((issues) => {
        if (!live) return;
        const found: Sent = {};
        for (const i of issues) {
          const o = requestOriginOf(parseRequestIssue(i.body));
          if (o?.kind === 'audit' && o.product === key && !found[o.group]) found[o.group] = { number: i.number, url: i.url };
        }
        setSent(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [data, key, local, repo]);

  const model = useMemo(() => reportModel(loaded.report, { product: loaded.product.name, productKey: key, productRepo: loaded.product.repo, ignores: { version: 1, ignores }, earlier: loaded.earlier }), [loaded, key, ignores]);
  const summary = `How much of ${loaded.product.name} comes from the library. Checked ${runDate(loaded.report.generatedAt)}.`;
  useEffect(() => setPageSummary(summary), [summary]);

  const pageUrl = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}?product=${encodeURIComponent(key)}`;
  const findRow = (k: string) => [...model.pieces, ...model.colors, ...model.sizes].find((r) => r.key === k);
  const actions: ReportActions = {
    canAct,
    // A lead signed in by email keeps the decision through Bridge, like Send to developers (api/contribute).
    canIgnore: canAct,
    local,
    sent,
    send: async (keys) => {
      if (local) {
        const s = readLocal(repo);
        for (const k of keys) s.sent[`${key}|${k}`] = true;
        writeLocal(repo, s);
        setSent((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, { number: null, url: null }])) }));
        return;
      }
      const labels = data.model.config.integrations?.requests?.labels ?? [];
      for (const k of keys) {
        const row = findRow(k);
        if (!row) continue;
        const piece = 'component' in row;
        const req = groupRequest(
          piece
            ? { key: row.key, title: row.title, detail: row.detail, component: (row as PieceRow).component, places: row.dev.places, fix: (row as PieceRow).dev.fix }
            : { key: row.key, title: row.title, detail: row.detail, places: row.dev.places, use: (row as ValueRow).dev.use, token: (row as ValueRow).library?.token ?? null },
          { product: loaded.product.name, productKey: key, run: loaded.run.id, url: pageUrl, requestedBy: currentViewer()?.login },
        );
        const issue = await data.client.createIssue(composeRequestIssue(req, { labels }));
        setSent((prev) => ({ ...prev, [k]: { number: issue.number, url: issue.url } }));
      }
    },
    ignore: async (k, reason) => {
      const row = findRow(k);
      const places = row ? row.dev.places.map((p) => ({ file: p.file, line: p.line, what: p.what.replace(/^<(.+)>$/, '$1') })) : [];
      const decision: AuditIgnore = { product: key, group: k, ...(row ? { title: row.title } : {}), reason, ...(currentViewer()?.login ? { by: currentViewer()!.login } : contributorFor(repo)?.name ? { by: contributorFor(repo)!.name } : {}), at: new Date().toISOString(), places };
      if (local) {
        const s = readLocal(repo);
        s.ignores = [...s.ignores.filter((x) => !(x.product === key && x.group === k)), decision];
        writeLocal(repo, s);
        setIgnores(s.ignores.filter((x) => x.product === key));
        return;
      }
      const next = await saveTeamAuditIgnore(decision);
      setIgnores(next.ignores);
    },
  };

  // Pictures of the product live in the bridge-shots branch, read from the raw host: a public team only for now.
  const pictureSrc: PictureSrc = (path) => (data.private ? null : shotsFileUrl(data.owner, data.repo, path));
  return <AdoptionReportView model={model} actions={actions} pictureSrc={pictureSrc} />;
}

export default function TeamAdoptionReport() {
  const { load, retry } = useTeamData();
  const [key] = useState(productParam);
  const [loaded, setLoaded] = useState<TeamAuditReport | 'none' | 'unreadable' | null>(null);
  useEffect(() => {
    if (load.status !== 'ready' || !key) return;
    let live = true;
    void loadTeamAuditReport(key).then((r) => live && setLoaded(r));
    return () => {
      live = false;
    };
  }, [load, key]);

  const back = (
    <Link variant="standalone" href={studioHref('quality/')} className="ar-back">
      <Icon icon={ChevronLeft} size="sm" /> Quality
    </Link>
  );
  if (load.status === 'loading') return <TeamLoadProgress label="Reading the adoption report" />;
  if (load.status === 'error') return <TeamLoadError failure={load.failure} onRetry={retry} />;
  const data = load.data;
  const product = data.model.config.products?.find((p) => p.key === key);
  const name = product?.name ?? (loaded && typeof loaded === 'object' ? loaded.product.name : key || 'Adoption report');
  const download = loaded && typeof loaded === 'object' ? safeUrl(bridgeDataUrl(data.owner, data.repo, loaded.run.path, data.private), '#') : null;
  return (
    <>
      {back}
      <StudioHead
        title={name}
        actions={
          download ? (
            <ButtonLink variant="ghost" href={download} iconStart={Download} {...external}>
              Download JSON
            </ButtonLink>
          ) : undefined
        }
      />
      {!key || loaded === 'none' ? (
        <div className="tp-locked">
          <p>
            <strong>{key ? `${name} has no adoption check yet.` : 'Pick a product on the Quality page.'}</strong> Its report shows here after the next check of its code.
          </p>
          <p>
            <Link href={studioHref('quality/')}>Back to Quality</Link>
          </p>
        </div>
      ) : loaded === 'unreadable' ? (
        <div className="tp-locked">
          <p>
            <strong>Bridge could not read this report.</strong> It may be too large, or only people of the team signed in can read it.
          </p>
        </div>
      ) : loaded ? (
        <Ready data={data} loaded={loaded} />
      ) : (
        <TeamLoadProgress label="Reading the adoption report" />
      )}
    </>
  );
}
