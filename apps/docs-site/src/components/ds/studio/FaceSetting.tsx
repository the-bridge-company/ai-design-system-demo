// Settings > You, Your face (docs/specs/avatar-customizer.md; rules: lib/team-faces.ts; drawing: scripts/team-faces.ts).
// One quiet row: the drawn face at 40px and Change. Change opens the row in place (no dialog): an 80px preview, the
// person next to their team at the size of a review row, Shuffle (a 300ms riffle, skipped under reduced motion; a
// polite live region says the new face) and, on demand, Pick the parts yourself (Hair, Glasses, Beard, Expression:
// the DS Tabs, each a DS RadioGroup of faces; a style a teammate wears is greyed, captioned with their name, "Taken by
// Sofia" in a DS Tooltip). Save face (the only primary, disabled until something changed) or Cancel (also Esc) close
// it, and focus goes back to Change.
//   - A Bridge account: saved on the account and in each of their teams (POST /api/account { action: 'face' }); the
//     server refuses a style someone on one of their teams already wears, naming them.
//   - The sample team: the person the visitor plays, kept in this browser only (said in one line).
//   - A GitHub photo: shown as is, no Change (a drawn face instead of a photo is for later).
//   - Signed out, not on the sample team: no row.
// The 80px preview is the DS Avatar at its largest size (lg, 40px) doubled inside a sized container: the DS has no
// larger Avatar size, and this is the only place that needs one.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, CircleCheck, Shuffle } from 'lucide-react';
import { Avatar, Button, Card, CardBody, Icon, Radio, RadioGroup, SegmentedControl, Tab, Tabs, TabsList, TabsPanel, Tooltip, VisuallyHidden } from '@bridge-ds/react';
import { drawingSeed } from '../../../lib/cast-faces';
import { castFaceLogin, type CastKey } from '../../../lib/demo-cast';
import { isSampleTeam, teamDisplayName } from '../../../lib/demo';
import { EXPRESSIONS, FACE_WORDS as W, HAIR_STYLES, blockedHair, expressionOf, faceWords, firstHairTiles, partLabel, sameFace, shuffleFace, variant, FACE_PART_COUNTS, type Drawing, type FaceRecipe } from '../../../lib/team-faces';
import type { FaceDrawer } from '../../../scripts/team-faces';

/** Who the row is for, once the page knows. */
interface Who {
  kind: 'account' | 'sample';
  team: string | null;
  teamName: string;
  name: string;
  /** Their face seeds (the first one is how teammates draw them). */
  seeds: string[];
  castKey?: CastKey;
  /** A GitHub photo: shown instead of a drawing. */
  photo?: string;
}

type PartTab = 'hair' | 'glasses' | 'beard' | 'expression';

/** The riffle's length, from the motion tokens (0 under reduced motion: tokens.css sets every duration to 0ms). */
function riffleMs(): number {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-slow').trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0;
}

async function whoIsHere(): Promise<Who | null> {
  const { pageTeam } = await import('../../../scripts/ai-tools');
  const team = pageTeam();
  if (team && isSampleTeam(team)) {
    const { castOn } = await import('../../../scripts/demo-cast');
    const person = castOn(team);
    if (!person) return null;
    return { kind: 'sample', team, teamName: teamDisplayName(team), name: person.name, seeds: [castFaceLogin(person).toLowerCase()], castKey: person.key };
  }
  const { getAccount } = await import('../../../scripts/account-session');
  const { account } = await getAccount().catch(() => ({ account: null }));
  if (!account) return null;
  const { accountFaceSeeds } = await import('../../../scripts/team-faces');
  const here = team ? account.teams.find((t) => t.repo.toLowerCase() === team.toLowerCase()) : undefined;
  const who: Who = { kind: 'account', team, teamName: here?.name || (team ? teamDisplayName(team) : 'your teams'), name: account.name ?? account.email.split('@')[0]!, seeds: accountFaceSeeds(account) };
  if (account.github) {
    const login = account.github.login;
    const { drawnFace } = await import('../../../scripts/github-photo');
    const drawn = await drawnFace(login).catch(() => true);
    if (!drawn) {
      const { ownerAvatarUrl } = await import('../../../lib/access-view');
      who.photo = ownerAvatarUrl(login, 80);
    }
  }
  return who;
}

/** The faces of the team around the person, as this page draws them (scripts/team-faces.ts). */
function useTeamDrawings(m: FaceDrawer | null, who: Who | null, version: number): Record<string, Drawing> {
  // `version` changes when a face is saved or the team read lands (FACES_EVENT): the drawings are read again.
  return useMemo(() => (m && who && version >= 0 ? drawn(m, who) : {}), [m, who, version]);
}

let teamFaces: typeof import('../../../scripts/team-faces') | null = null;

function drawn(m: FaceDrawer, who: Who): Record<string, Drawing> {
  const hairOf = (s: string) => m.faceRecipe(s).hair;
  if (!teamFaces) return {};
  if (who.team) return teamFaces.drawingsOf(who.team, hairOf);
  const mine = teamFaces.myFace();
  return mine ? Object.fromEntries(who.seeds.map((s) => [s, { kind: 'face' as const, face: mine.face, hair: mine.face.hair, name: who.name }])) : {};
}

export default function FaceSetting() {
  const [who, setWho] = useState<Who | null>(null);
  const [m, setM] = useState<FaceDrawer | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FaceRecipe | null>(null);
  const [parts, setParts] = useState(false);
  const [tab, setTab] = useState<PartTab>('hair');
  const [allHair, setAllHair] = useState(false);
  const [frame, setFrame] = useState<{ uri: string; n: number } | null>(null);
  const [live, setLive] = useState('');
  const [said, setSaid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const change = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let live = true;
    const bump = () => live && setVersion((v) => v + 1);
    void Promise.all([import('@bridge-ds/react/avatar-illustrated'), import('../../../scripts/team-faces'), whoIsHere()]).then(([drawer, faces, w]) => {
      if (!live) return;
      teamFaces = faces;
      setM(drawer);
      setWho(w);
      document.addEventListener(faces.FACES_EVENT, bump);
      // A real team: read its people and saved faces once (scripts/contribute-session.ts notes the face map).
      if (w?.kind === 'account' && w.team) void import('../../../scripts/contribute-session').then((c) => c.contributeTeam(w.team!)).catch(() => {});
    });
    return () => {
      live = false;
      timers.current.forEach((t) => window.clearTimeout(t));
      if (teamFaces) document.removeEventListener(teamFaces.FACES_EVENT, bump);
    };
  }, []);

  const drawings = useTeamDrawings(m, who, version);
  const mine = useMemo<{ face: FaceRecipe; lookAlikeOf?: string } | null>(() => {
    if (!m || !who) return null;
    const d = who.seeds.map((s) => drawings[s]).find(Boolean);
    if (d?.kind === 'face') return { face: d.face, ...(d.lookAlikeOf ? { lookAlikeOf: d.lookAlikeOf } : {}) };
    return { face: m.faceRecipe(d?.kind === 'seed' ? d.seed : drawingSeed(who.seeds[0]!)) };
  }, [m, who, drawings]);
  const taken = useMemo(() => {
    const out = new Map<string, string>();
    const own = new Set(who?.seeds ?? []);
    // By first name, as the strip and the review rows say them: "Taken by Sofia".
    for (const [seed, d] of Object.entries(drawings)) if (!own.has(seed) && !out.has(d.hair)) out.set(d.hair, d.name.split(/\s+/)[0]!);
    return out;
  }, [drawings, who]);
  const team = useMemo(() => {
    const own = new Set(who?.seeds ?? []);
    const seen = new Set<string>();
    return Object.entries(drawings)
      .filter(([seed, d]) => !own.has(seed) && !seen.has(d.name) && seen.add(d.name))
      .slice(0, 6)
      .map(([seed, d]) => ({ seed, name: d.name.split(/\s+/)[0]!, uri: m ? (d.kind === 'face' ? m.illustratedFaceUri(d.face) : m.illustratedAvatarUri(d.seed)) : undefined }));
  }, [drawings, who, m]);

  if (!who || !m || !mine) return null;

  const uri = (f: FaceRecipe) => m.illustratedFaceUri(f);
  const current = open && draft ? draft : mine.face;
  const changed = Boolean(draft && !sameFace(draft, mine.face));

  const startEdit = () => {
    setDraft(mine.face);
    setSaid('');
    setError(null);
    setLive('');
    setOpen(true);
  };
  const close = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setFrame(null);
    setOpen(false);
    setParts(false);
    setAllHair(false);
    setError(null);
    // Focus back on Change once it is drawn again.
    window.setTimeout(() => change.current?.focus(), 0);
  };
  const cancel = () => {
    setDraft(null);
    close();
  };
  const pick = (next: FaceRecipe) => {
    setDraft(next);
    setError(null);
  };
  const shuffle = () => {
    const blocked = blockedHair(taken.keys());
    const next = shuffleFace(Math.random, blocked, draft);
    const say = () => setLive(W.newFace(faceWords(next)));
    const ms = riffleMs();
    timers.current.forEach((t) => window.clearTimeout(t));
    if (!ms) {
      pick(next);
      say();
      return;
    }
    // The riffle: three faces flip past like the pages of a field guide, the last one is the new face.
    const frames = [shuffleFace(Math.random, blocked), shuffleFace(Math.random, blocked), next];
    const step = ms / frames.length;
    timers.current = frames.map((f, i) =>
      window.setTimeout(() => {
        setFrame({ uri: uri(f), n: i });
        if (i === frames.length - 1) {
          pick(next);
          say();
          timers.current.push(window.setTimeout(() => setFrame(null), step));
        }
      }, i * step),
    );
  };
  const save = async () => {
    if (!draft || !changed) return;
    setBusy(true);
    setError(null);
    try {
      if (who.kind === 'sample') {
        teamFaces!.saveSampleFace(who.castKey!, draft);
        setSaid(W.savedSample);
      } else {
        const { saveFace } = await import('../../../scripts/account-session');
        await saveFace(draft);
        // This page draws the new face at once; the team read catches up behind it.
        teamFaces!.rememberMyFace({ face: draft, seeds: who.seeds, name: who.name });
        if (who.team) void import('../../../scripts/contribute-session').then((c) => c.contributeTeam(who.team!)).catch(() => {});
        setSaid(W.saved);
      }
      setDraft(null);
      close();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.code === 'face_taken' && e.message ? e.message : W.failed);
    } finally {
      setBusy(false);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      cancel();
    }
  };

  const tile = (part: 'hair' | 'glasses' | 'beard', value: string | null, f: FaceRecipe) => {
    const holder = part === 'hair' ? taken.get(value!) : undefined;
    const label = partLabel(part, value);
    const face = <Avatar name={label} size="lg" fallback="illustrated" illustration={uri(f)} decorative className="yf-tile-face" />;
    return (
      <Radio
        key={value ?? 'none'}
        value={value ?? 'none'}
        disabled={Boolean(holder)}
        className="yf-tile"
        label={
          <>
            {holder ? <Tooltip content={W.takenBy(holder)}>{face}</Tooltip> : face}
            {/* Every tile keeps its caption line, so the rows of the grid are one height. */}
            <span className="yf-caption" aria-hidden="true">
              {holder ?? ''}
            </span>
            <VisuallyHidden>{holder ? `${label}, ${W.takenByShort(holder)}` : label}</VisuallyHidden>
          </>
        }
      />
    );
  };

  const header = (
    <>
      <h2 id="ts-face" className="ts-h">
        {W.bandTitle}
      </h2>
      <p className="ts-intro">{W.bandIntro}</p>
    </>
  );

  if (who.photo) {
    return (
      <section className="ts-band" id="face" aria-labelledby="ts-face">
        {header}
        <Card>
          <CardBody>
            <div className="set-rows">
              <div className="set-row yf-row">
                <div>
                  <p className="set-row-label">{W.photoLabel}</p>
                  <p className="set-row-help">{W.photoHelp}</p>
                </div>
                <div className="set-row-value">
                  <Avatar name={who.name} src={who.photo} size="lg" decorative />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>
    );
  }

  const hairTiles = firstHairTiles(current.hair, taken, allHair);

  return (
    <section className="ts-band" id="face" aria-labelledby="ts-face">
      {header}
      <Card>
        <CardBody>
          <div className="set-rows">
            {!open ? (
              <div className="set-row yf-row">
                <div>
                  <p className="set-row-label">{W.drawnLabel}</p>
                  <p className="set-row-help">{mine.lookAlikeOf ? W.lookAlike(mine.lookAlikeOf, who.teamName) : W.drawnHelp}</p>
                </div>
                <div className="set-row-value yf-value">
                  <Avatar name={who.name} size="lg" fallback="illustrated" illustration={uri(mine.face)} decorative />
                  <span role="status" className="set-row-help yf-said">
                    {said && <Icon icon={CircleCheck} size="sm" />}
                    {said}
                  </span>
                </div>
                <div className="set-row-action">
                  <Button ref={change} variant="secondary" size="sm" aria-expanded="false" onClick={startEdit}>
                    {W.change}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="set-row set-row-stack yf-open" onKeyDown={onKeyDown}>
                <div>
                  <p className="set-row-label">{W.drawnLabel}</p>
                  <p className="set-row-help">{W.openHelp(who.teamName)}</p>
                </div>
                <div className="yf-stage">
                  <div className="yf-preview">
                    <Avatar key={frame ? `f${frame.n}` : 'face'} name={W.preview} size="lg" fallback="illustrated" illustration={frame?.uri ?? uri(current)} className={frame ? 'yf-riffle' : undefined} />
                  </div>
                  <div className="yf-team">
                    <p className="set-row-help">{W.strip}</p>
                    <ul className="yf-people" aria-label={W.strip}>
                      <li className="yf-person yf-me">
                        <Avatar name={W.you} size="sm" fallback="illustrated" illustration={uri(current)} decorative />
                        <span>{W.you}</span>
                      </li>
                      {team.map((p) => (
                        <li className="yf-person" key={p.seed}>
                          <Avatar name={p.name} size="sm" fallback="illustrated" illustration={p.uri} decorative />
                          <span>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="set-row-actions">
                  <Button variant="secondary" iconStart={Shuffle} onClick={shuffle}>
                    {W.shuffle}
                  </Button>
                  <Button variant="ghost" iconEnd={parts ? ChevronUp : ChevronDown} aria-expanded={parts} aria-controls="yf-parts" onClick={() => setParts(!parts)}>
                    {W.pickParts}
                  </Button>
                </div>
                {parts && (
                  <div id="yf-parts" className="yf-parts">
                    <Tabs variant="contained" size="sm" value={tab} onValueChange={(v) => setTab(v as PartTab)}>
                      <TabsList aria-label={W.parts}>
                        <Tab value="hair">{W.tabs.hair}</Tab>
                        <Tab value="glasses">{W.tabs.glasses}</Tab>
                        <Tab value="beard">{W.tabs.beard}</Tab>
                        <Tab value="expression">{W.tabs.expression}</Tab>
                      </TabsList>
                      <TabsPanel value="hair" className="yf-panel">
                        <RadioGroup label={W.tabs.hair} hideLabel orientation="horizontal" className="yf-grid" value={current.hair} onValueChange={(v) => !taken.has(v) && pick({ ...current, hair: v })}>
                          {hairTiles.map((h) => tile('hair', h, { ...current, hair: h }))}
                        </RadioGroup>
                        <p className="set-row-help yf-more">
                          {W.takenRule}{' '}
                          {!allHair && (
                            <Button variant="link" size="sm" onClick={() => setAllHair(true)}>
                              {W.showAll(HAIR_STYLES.length)}
                            </Button>
                          )}
                        </p>
                      </TabsPanel>
                      <TabsPanel value="glasses" className="yf-panel">
                        <RadioGroup label={W.tabs.glasses} hideLabel orientation="horizontal" className="yf-grid" value={current.glasses ?? 'none'} onValueChange={(v) => pick({ ...current, glasses: v === 'none' ? null : v })}>
                          {[null, ...Array.from({ length: FACE_PART_COUNTS.glasses }, (_, i) => variant(i + 1))].map((g) => tile('glasses', g, { ...current, glasses: g }))}
                        </RadioGroup>
                      </TabsPanel>
                      <TabsPanel value="beard" className="yf-panel">
                        <RadioGroup label={W.tabs.beard} hideLabel orientation="horizontal" className="yf-grid" value={current.beard ?? 'none'} onValueChange={(v) => pick({ ...current, beard: v === 'none' ? null : v })}>
                          {[null, ...Array.from({ length: FACE_PART_COUNTS.beard }, (_, i) => variant(i + 1))].map((b) => tile('beard', b, { ...current, beard: b }))}
                        </RadioGroup>
                      </TabsPanel>
                      <TabsPanel value="expression" className="yf-panel">
                        <SegmentedControl
                          label={W.tabs.expression}
                          value={expressionOf(current) ?? ''}
                          items={EXPRESSIONS.map(({ value, label }) => ({ value, label }))}
                          onValueChange={(v) => {
                            const e = EXPRESSIONS.find((x) => x.value === v);
                            if (e) pick({ ...current, ...e.parts });
                          }}
                        />
                        <p className="set-row-help yf-more">{W.expressionHelp}</p>
                      </TabsPanel>
                    </Tabs>
                  </div>
                )}
                <div className="set-row-actions yf-savebar">
                  <Button variant="primary" disabled={!changed} loading={busy} onClick={() => void save()}>
                    {W.save}
                  </Button>
                  <Button variant="ghost" onClick={cancel}>
                    {W.cancel}
                  </Button>
                  {error && (
                    <span role="alert" className="set-row-help">
                      {error}
                    </span>
                  )}
                </div>
                <VisuallyHidden role="status" aria-live="polite">
                  {live}
                </VisuallyHidden>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
