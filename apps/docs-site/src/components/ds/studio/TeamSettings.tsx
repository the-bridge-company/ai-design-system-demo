// Settings on a team shell (pages/team-shell/settings): the team's own rules, read from its repository model in the
// browser (scripts/team-data.ts, the same read every team page shares; a signed-out visitor's reads are answered from
// the team's published activity, no GitHub API call). Read only (but Review rules, which an admin with GitHub access
// edits: ReviewRulesEditor), in designer words (board D9): no repository, pull
// request, branch or main on the screen, and people by name (the members Settings read, else their profile name).
//   How changes reach your code  what happens once the team keeps a change (bridge.config.json `changes`)
//   Review rules                 who checks the look, who checks the code, who adds it to the library: the team's own
//                                rules (governance owners and rights), never Bridge's build-time tiers (RV-20), and that token values
//                                ship once the look is approved and the checks pass (docs/BUILD-REQUESTS.md "The rule", TV-1)
//   Safety                       when the visual before and after runs
// Each section closes on a "For developers" fold with the file, keys, repository and branch behind it. A member who is
// not an admin reads who can change it, by name (SettingsParts AdminOnlyNote, BR-20).
// Every team, the sample team and Bridge's own design system included, shows its own setup and people.
// Repo strings reach the page as React text only.
import { Card, CardBody } from '@bridge-ds/react';
import { overrideHolders, overrideReasonMin, parseOwnerEntry, type Owners } from '@bridge-ds/core';
import { TeamLoadError, TeamLoadProgress, useTeamData } from './TeamState';
import { AdminOnlyNote, Code, DevFold } from './SettingsParts';
import { useTeamPeople } from './members-state';
import { roleRows, VISUAL_MODE_HELP, VISUAL_MODE_LABEL } from '../../../lib/roles-view';
import { andList, ANYONE_WHO_CODES, CHANGES_DEV, CHANGES_PLAIN, leadsPublishRow, NOBODY_NAMED, overridePlain, RIGHT_PLAIN, soloPlain, teamPlain, TOKEN_VALUES_DEV, TOKEN_VALUES_PLAIN } from '../../../lib/settings-view';
import ReviewRulesEditor from './ReviewRulesEditor';
import { loginKey, ownerName } from '../../../lib/people';
import { knownNames } from '../../../scripts/people';
import type { MembersData } from '../../../scripts/members';
import GitHubUsage from './GitHubUsage';
import { githubPhoto, Who } from './faces';

/** A person or a GitHub team, by the name designers know. */
interface Named {
  key: string;
  name: string;
  /** A person's GitHub login, for the face. */
  login?: string;
}

/** Names for owner entries: the member list's names first, then the cached profile names, then the login. */
function namer(people: MembersData | null): (entry: string) => Named | null {
  const members = people?.members ?? [];
  const names = knownNames();
  return (entry) => {
    const e = parseOwnerEntry(entry);
    if (!e) return null;
    if (e.kind === 'team') return { key: entry, name: teamPlain(e.slug) };
    return { key: entry, login: e.login, name: ownerName(e.login, members, names) };
  };
}

function People({ list }: { list: Named[] }) {
  if (!list.length) return <span className="set-quiet">{NOBODY_NAMED}</span>;
  return (
    <span className="set-owner-list">
      {list.map((p) => (
        <span className="set-owner" key={p.key}>
          {p.login && <Who p={{ login: p.login, name: p.name, avatar: githubPhoto(p.login) }} size="xs" />}
          <span>{p.name}</span>
        </span>
      ))}
    </span>
  );
}

function Band({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="ts-band" id={id} aria-labelledby={`ts-${id}`}>
      <h2 id={`ts-${id}`} className="ts-h">
        {title}
      </h2>
      <p className="ts-intro">{intro}</p>
      {children}
    </section>
  );
}

const entries = (xs: string[]) => (xs.length ? xs.map((x) => (x.includes('/') ? x : `@${x.replace(/^@/, '')}`)).join(', ') : 'none');

export default function TeamSettings() {
  const { load, retry } = useTeamData();
  const people = useTeamPeople();
  if (load.status === 'loading') return <TeamLoadProgress label="Reading the settings of this design system" />;
  if (load.status === 'error') return <TeamLoadError failure={load.failure} onRetry={retry} />;
  const { model, owner, repo } = load.data;
  const site = model.site;
  const full = `${owner}/${repo}`;
  const owners = site.owners as Owners;
  const name = namer(people);
  const named = (xs: string[]) => xs.map(name).filter((x): x is Named => Boolean(x));
  const gov = model.config.governance;
  const changes = CHANGES_PLAIN[site.changes];
  const rows = roleRows(owners, site.rights);
  const solo = (() => {
    if (!site.soloOwnerCanApproveBoth) return null;
    const all = [...new Set([...owners.design, ...owners.tech].map(loginKey))];
    if (all.length !== 1 || all[0]!.includes('/')) return null;
    return soloPlain(name(all[0]!)?.name ?? all[0]!);
  })();
  // Who may skip a missing check: owners only, the same list the Home and the branch page read.
  const holders = overrideHolders(site.override, site.owners);
  const holderNames = [...new Set(holders.map((l) => name(l)?.name ?? l))];
  const override = holders.length ? overridePlain(holderNames, overrideReasonMin(site.override)) : null;
  const leads = leadsPublishRow(site);
  const mode = site.visualImpact.mode;
  const branch = site.defaultBranch;
  const repoFact = { term: 'Repository', value: <Code>{full}</Code> };

  return (
    <>
      <Band id="changes" title="How changes reach your code" intro="What happens once your team keeps a change.">
        <Card>
          <CardBody>
            <div className="set-rows">
              <div className="set-row">
                <p className="set-row-label">Kept changes</p>
                <div className="set-row-value set-row-span">
                  <p className="set-who">{changes.title}</p>
                  <p className="set-row-help">{changes.text}</p>
                  <AdminOnlyNote />
                </div>
              </div>
            </div>
            <DevFold
              facts={[
                { term: 'Mode', value: <Code>{`"changes": "${site.changes}"`}</Code> },
                { term: 'What Bridge does', value: CHANGES_DEV[site.changes] },
                repoFact,
                { term: 'Default branch', value: <Code>{branch}</Code> },
                { term: 'Tokens', value: <Code>{model.tokens.root}</Code> },
                { term: 'Set in', value: <Code>bridge.config.json</Code> },
              ]}
            />
          </CardBody>
        </Card>
        <GitHubUsage />
      </Band>

      <Band id="roles" title="Review rules" intro="Who checks a change before it reaches the library your products use.">
        <Card>
          <CardBody>
            <ReviewRulesEditor owners={site.owners as Owners} rights={site.rights} leadsPublishTier1={site.leadsPublishTier1 !== false} visualMode={mode} prefix={gov.branchPrefix || undefined} protectedBranches={gov.protectedBranches}>
            <div className="set-rows">
              {rows.map((x) => {
                const plain = RIGHT_PLAIN[x.right];
                const unset = x.choice === null;
                return (
                  <div className="set-row" key={x.right}>
                    <div>
                      <p className="set-row-label">{plain.label}</p>
                      <p className="set-row-help">{plain.help}</p>
                    </div>
                    <div className="set-row-value set-row-span">{unset ? <span>{ANYONE_WHO_CODES}</span> : <People list={named(x.logins)} />}</div>
                  </div>
                );
              })}
              {solo && (
                <div className="set-row">
                  <p className="set-row-label">Only owner</p>
                  <p className="set-row-value set-row-span">{solo}</p>
                </div>
              )}
              <div className="set-row">
                <div>
                  <p className="set-row-label">{leads.label}</p>
                  <p className="set-row-help">{leads.help}</p>
                </div>
                <p className="set-row-value set-row-span">{leads.value}</p>
              </div>
              {override && (
                <div className="set-row">
                  <div>
                    <p className="set-row-label">{override.label}</p>
                    <p className="set-row-help">{override.help}</p>
                  </div>
                  <p className="set-row-value set-row-span set-who">{override.value}</p>
                </div>
              )}
              <div className="set-row">
                <div>
                  <p className="set-row-label">{TOKEN_VALUES_PLAIN.label}</p>
                  <p className="set-row-help">{TOKEN_VALUES_PLAIN.help}</p>
                </div>
                <div className="set-row-value set-row-span">
                  <p className="set-who">{TOKEN_VALUES_PLAIN.title}</p>
                  <p className="set-row-help">{TOKEN_VALUES_PLAIN.text}</p>
                </div>
              </div>
            </div>
            <AdminOnlyNote />
            </ReviewRulesEditor>
            <DevFold
              facts={[
                { term: 'Design owners', value: <Code>{entries(site.owners.design)}</Code> },
                { term: 'Tech owners', value: <Code>{entries(site.owners.tech)}</Code> },
                ...rows.map((x) => ({ term: `governance.rights.${x.right}`, value: <Code>{x.choice === null ? 'not set: anyone with write access merges' : andList(x.choice === 'both' ? ['design', 'tech'] : [x.choice])}</Code> })),
                { term: 'Token values', value: TOKEN_VALUES_DEV },
                { term: 'Protected branches', value: <Code>{gov.protectedBranches.join(', ') || 'none'}</Code> },
                { term: 'Branch prefix', value: <Code>{gov.branchPrefix || 'none'}</Code> },
                ...(holders.length ? [{ term: 'Owner override', value: <Code>{`${entries(holders)}, reason of ${overrideReasonMin(site.override)}+ characters, posted on the pull request`}</Code> }] : []),
                { term: 'Set in', value: <Code>bridge.config.json, governance</Code> },
              ]}
            >
              <p>Bridge counts approvals on GitHub reviews. A ruleset or branch protection on {branch} keeps unreviewed pull requests out.</p>
            </DevFold>
          </CardBody>
        </Card>
      </Band>

      <Band id="safety" title="Safety" intro="When Bridge shows what a change looks like before and after.">
        <Card>
          <CardBody>
            <div className="set-rows">
              <div className="set-row">
                <p className="set-row-label">Visual before and after</p>
                <div className="set-row-value set-row-span">
                  <p className="set-who">{VISUAL_MODE_LABEL[mode]}</p>
                  <p className="set-row-help">{VISUAL_MODE_HELP[mode]}</p>
                  <AdminOnlyNote />
                </div>
              </div>
            </div>
            <DevFold
              facts={[
                { term: 'Mode', value: <Code>{`"visualImpact": { "mode": "${mode}" }`}</Code> },
                { term: 'On demand', value: <>Add the <Code>visual-check</Code> label to a pull request.</> },
                repoFact,
              ]}
            />
          </CardBody>
        </Card>
      </Band>
    </>
  );
}
