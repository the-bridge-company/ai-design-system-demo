// Settings > Members > Reviews (docs/specs/two-reviews.md, mock 01-settings-reviews): the two reviews, each in its own
// DS Card, summary first.
//   The library                       "Dana decides what the library keeps", one muted line. An admin's Change unfolds
//                                     the email members as a DS CheckboxGroup (api/invites set-library-owner). GitHub
//                                     design owners decide too, read only: they come from bridge.config.json.
//   Design review before developers   one row per product and the Library: a DS Switch named after the product, its
//                                     line under it ("Dana reviews", "No design review"). On, an admin's Change who
//                                     reviews unfolds the reviewers (any one of them answers) with "Any designer"
//                                     (api/invites set-design-review, one call per product).
// After the migration, the one time note "Reviews now have two parts" heads the section until an admin saves.
// Only admins edit (data.canManage on a real team, with the reviews read from the invites server); everyone else
// reads the same words from the team (scripts/contribute-session teamReview) with no control. Rules and words:
// lib/reviews-settings.ts.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardBody, Checkbox, CheckboxGroup, Skeleton, Switch } from '@bridge-ds/react';
import { designReviewOf, type ProductConfig } from '@bridge-ds/core';
import { NoticeLine } from './MemberParts';
import type { Notice } from './members-state';
import type { Member } from '../../../lib/invites';
import { ANY_PRODUCT, type DesignReviewMap, type DesignReviewSetting } from '../../../lib/team-reviews';
import { ANY_DESIGNER, LIBRARY_KEY, REVIEWS_WORDS as W, designReviewLine, leavesNoOwner, libraryOwnersLine, memberRefOf, reviewRows, reviewerValues, settingFromValues, turnedOn, type ReviewRow } from '../../../lib/reviews-settings';
import { setDesignReview, setLibraryOwner, type TeamReviewsSettings } from '../../../scripts/invites-api';
import { siteConfig } from '../../../scripts/repo-context';
import { siteApprovers } from '../../../scripts/teams';

/** A person the section names: an email member (by reference, with their email for an admin) or a GitHub login. */
interface Person {
  id: string;
  name: string;
  email?: string;
  role?: Member['role'];
  libraryOwner?: boolean;
}

interface View {
  people: Person[];
  /** The email team's per product settings, or null: bridge.config.json decides (a GitHub team). */
  map: DesignReviewMap | null;
  note: boolean;
}

const norm = (s: string) => s.trim().replace(/^@/, '').toLowerCase();
const githubOwnerLogins = (): string[] => [...new Set((siteApprovers().design ?? []).map(norm).filter((l) => l && !l.includes('/')))];

/** An admin's view: the email members of Settings > Members, by reference (hashed here, as the server does). */
function useAdminView(members: readonly Member[], reviews: TeamReviewsSettings | null | undefined): View | null {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let live = true;
    const email = members.filter((m) => m.via === 'email' && m.email);
    void Promise.all(email.map(async (m) => ({ id: await memberRefOf(m.email!), name: m.name, email: m.email!, role: m.role, libraryOwner: Boolean(m.lead) }))).then(
      (list) => live && setPeople([...list, ...members.filter((m) => m.via !== 'email').map((m) => ({ id: norm(m.login), name: m.name, role: m.role }))]),
      () => live && setPeople([]),
    );
    return () => {
      live = false;
    };
  }, [members]);
  if (!reviews || !people) return null;
  return { people, map: reviews.designReview, note: reviews.note };
}

/** Anyone else's view: the team's reviews as every Studio surface reads them. */
function useReaderView(repo: string, on: boolean): View | null {
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void (async () => {
      const [{ teamReview }, { currentContributor, getToken }] = await Promise.all([import('../../../scripts/contribute-session'), import('../../../scripts/github-session')]);
      const t = await teamReview(repo, currentContributor() ? null : getToken());
      if (!live) return;
      setView({ people: t.members.map((m) => ({ id: m.ref ?? norm(m.name), name: m.name, role: m.role, libraryOwner: Boolean(m.libraryOwner) })), map: t.designReview, note: false });
    })().catch(() => live && setView({ people: [], map: null, note: false }));
    return () => {
      live = false;
    };
  }, [repo, on]);
  return view;
}

function Header() {
  return (
    <div className="set-band-intro">
      <h2 id="set-reviews" className="set-h">
        {W.title}
      </h2>
      <p className="set-intro">{W.intro}</p>
    </div>
  );
}

export default function ReviewsSection({ repo, canEdit, members, reviews }: { repo: string; canEdit: boolean; members: readonly Member[]; reviews?: TeamReviewsSettings | null }) {
  const editing = canEdit && Boolean(reviews);
  const admin = useAdminView(members, editing ? reviews : null);
  const reader = useReaderView(repo, !editing);
  const view = editing ? admin : reader;
  return (
    <section className="mem-review" aria-labelledby="set-reviews">
      <Header />
      {view ? (
        <Body repo={repo} canEdit={editing} view={view} />
      ) : (
        <div role="status" aria-busy="true" aria-label={W.loading}>
          <Skeleton height="var(--size-20)" />
        </div>
      )}
    </section>
  );
}

function Body({ repo, canEdit, view }: { repo: string; canEdit: boolean; view: View }) {
  const products: ProductConfig[] = useMemo(() => (Array.isArray(siteConfig().products) ? (siteConfig().products as ProductConfig[]) : []), []);
  const githubOwners = useMemo(githubOwnerLogins, []);
  const [map, setMap] = useState<DesignReviewMap | null>(view.map);
  const [owners, setOwners] = useState<Set<string>>(() => new Set(view.people.filter((p) => p.libraryOwner && p.email).map((p) => p.email!)));
  const [note, setNote] = useState(view.note);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openOwners, setOpenOwners] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const nameOf = (id: string): string => view.people.find((p) => p.id === norm(id) || p.id === id)?.name ?? id;
  const emailPeople = view.people.filter((p) => p.email && p.role !== 'view');
  const ownerNames = [...view.people.filter((p) => (p.email ? owners.has(p.email) : p.libraryOwner)).map((p) => p.name), ...githubOwners.map(nameOf)];
  const ownerIds = [...view.people.filter((p) => (p.email ? owners.has(p.email) : p.libraryOwner)).map((p) => p.id), ...githubOwners];
  const designers: Person[] = [...emailPeople, ...githubOwners.filter((l) => !emailPeople.some((p) => p.id === l)).map((l) => ({ id: l, name: nameOf(l) }))];

  const rows: ReviewRow[] = map
    ? reviewRows(products, map)
    : [...products.filter((p) => p.key !== LIBRARY_KEY).map((p) => ({ key: p.key, name: p.name || p.key, setting: designReviewOf(p, githubOwners) as DesignReviewSetting })), { key: LIBRARY_KEY, name: W.libraryRow, setting: designReviewOf({ key: LIBRARY_KEY }, githubOwners) as DesignReviewSetting }];

  const fail = (err: unknown) => setNotice({ tone: 'danger', text: err instanceof Error && err.message ? err.message : 'Something went wrong. Try again in a minute.' });

  const saveRow = async (key: string, next: DesignReviewSetting) => {
    if (!map) return;
    const before = map;
    setMap({ ...map, [key]: next });
    setBusy(key);
    setNotice(null);
    try {
      const saved = await setDesignReview(repo, key, next);
      if (saved) setMap(saved);
      setNote(false);
      setNotice({ tone: 'success', text: W.saved });
    } catch (err) {
      setMap(before);
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const toggleOwners = async (next: string[]) => {
    const now = new Set(next);
    const changed = [...new Set([...owners, ...now])].find((e) => owners.has(e) !== now.has(e));
    if (!changed) return;
    const on = now.has(changed);
    if (!on && leavesNoOwner({ ownersAfter: now.size, githubOwners: githubOwners.length })) return setNotice({ tone: 'danger', text: W.keepOneOwner });
    const before = owners;
    setOwners(now);
    setBusy('owners');
    setNotice(null);
    try {
      await setLibraryOwner(repo, changed, on);
      setNotice({ tone: 'success', text: W.saved });
    } catch (err) {
      setOwners(before);
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="set-band-body">
      {note && canEdit && <Alert tone="info">{W.migrated}</Alert>}
      <Card>
        <CardBody>
          <div className="set-rows">
            <div className="set-row">
              <h3 id="set-reviews-library" className="set-row-label set-card-title">
                {W.libraryTitle}
              </h3>
              <div className="set-row-value">
                <p>{libraryOwnersLine(ownerNames)}</p>
                <p className="set-row-help">{W.libraryHelp}</p>
                {githubOwners.length > 0 && <p className="set-row-help">{W.githubOwnersNote}</p>}
              </div>
              {canEdit && emailPeople.length > 0 && (
                <div className="set-row-action">
                  <Button variant="secondary" data-density="compact" aria-expanded={openOwners} onClick={() => setOpenOwners((o) => !o)}>
                    {openOwners ? W.closeWho : W.changeOwners}
                  </Button>
                </div>
              )}
              {canEdit && openOwners && (
                <div className="set-row-span">
                  <CheckboxGroup label={W.libraryOwners} value={[...owners]} onValueChange={(v) => void toggleOwners(v)} disabled={busy === 'owners'}>
                    {emailPeople.map((p) => (
                      <Checkbox key={p.email} value={p.email!} label={p.name} />
                    ))}
                  </CheckboxGroup>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="set-rows">
            <div className="set-row set-row-stack">
              <h3 id="set-reviews-design" className="set-card-title">
                {W.designTitle}
              </h3>
              <p className="set-row-help">{W.designHelp}</p>
            </div>
            {rows.map((row) => (
              <DesignRow
                key={row.key}
                row={row}
                canEdit={canEdit && Boolean(map)}
                busy={busy === row.key}
                open={openRow === row.key}
                onOpen={(o) => setOpenRow(o ? row.key : null)}
                line={designReviewLine(row.setting, nameOf, githubOwners)}
                designers={designers}
                onSwitch={(on) => void saveRow(row.key, on ? turnedOn(map ? map[ANY_PRODUCT] : null, ownerIds) : { on: false })}
                onReviewers={(values) => {
                  const next = settingFromValues(values, row.setting);
                  if (!next) return setNotice({ tone: 'danger', text: W.pickOne });
                  void saveRow(row.key, next);
                }}
              />
            ))}
          </div>
        </CardBody>
      </Card>
      <NoticeLine notice={notice} />
    </div>
  );
}

function DesignRow(x: {
  row: ReviewRow;
  canEdit: boolean;
  busy: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  line: string;
  designers: readonly Person[];
  onSwitch: (on: boolean) => void;
  onReviewers: (values: string[]) => void;
}) {
  const { row } = x;
  if (!x.canEdit)
    return (
      <div className="set-row">
        <p className="set-row-label">{row.name}</p>
        <div className="set-row-value">
          <p>{x.line}</p>
        </div>
      </div>
    );
  return (
    <div className="set-row set-row-stack">
      <Switch label={row.name} description={x.line} labelPlacement="start" checked={row.setting.on} disabled={x.busy} onCheckedChange={x.onSwitch} />
      {row.setting.on && (
        <div className="set-row-actions">
          <Button variant="ghost" data-density="compact" aria-expanded={x.open} onClick={() => x.onOpen(!x.open)}>
            {x.open ? W.closeWho : W.changeWho}
          </Button>
        </div>
      )}
      {row.setting.on && x.open && (
        <CheckboxGroup label={W.whoReviews(row.name)} value={reviewerValues(row.setting)} onValueChange={x.onReviewers} disabled={x.busy}>
          <Checkbox value={ANY_DESIGNER} label={W.anyDesigner} description={W.anyDesignerHelp} />
          {x.designers.map((p) => (
            <Checkbox key={p.id} value={p.id} label={p.name} />
          ))}
        </CheckboxGroup>
      )}
    </div>
  );
}
