import { describe, expect, it } from 'vitest';
import { codeShown, DEV_EXPLORING_LINE, devLineOf, foldTimeline, handOverTitle, journeyOf, notesContext, ownerLine, pageRoleOf, pageStageOf, sameScreen, stagedPieces, timelineOf, writeToLine, zoneOf, type PageRole, type PageStage, type ZoneFlags } from './exploration-layout';

const none: ZoneFlags = { archived: false, notDoing: false, answersLead: false, leadBar: false, leadTake: false, pmMine: false, canDone: false, declinedBack: false, question: false, checkSay: false, theirVersion: false };

describe('who reads the page', () => {
  const who = { owner: false, lead: false, pm: false, github: false, viaBridge: false, member: false, signedIn: true };
  it('the owner, then a lead, then the PM; a developer is a GitHub sign-in that is not routed as a designer', () => {
    expect(pageRoleOf({ ...who, owner: true, lead: true })).toBe('owner');
    expect(pageRoleOf({ ...who, lead: true })).toBe('lead');
    expect(pageRoleOf({ ...who, pm: true, github: true })).toBe('pm');
    expect(pageRoleOf({ ...who, github: true })).toBe('developer');
    expect(pageRoleOf({ ...who, github: true, viaBridge: true })).toBe('designer');
    expect(pageRoleOf({ ...who, github: true, member: true })).toBe('designer');
    expect(pageRoleOf({ ...who, signedIn: false })).toBe('viewer');
  });
});

describe('where it is', () => {
  it('reads the stage from the page state', () => {
    expect(pageStageOf({ stage: 'exploring' })).toBe('exploring');
    expect(pageStageOf({ stage: 'exploring', waitingForLead: true })).toBe('waiting-for-lead');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'ready' })).toBe('ready');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'building' })).toBe('building');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'building', checking: true })).toBe('check');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'shipped', checking: true })).toBe('shipped');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'ready', declined: true })).toBe('declined');
    expect(pageStageOf({ stage: 'handed-off', handoff: 'shipped', archived: true })).toBe('archived');
  });
});

describe('stage x role: the developers see git only once it is handed to them', () => {
  const stages: PageStage[] = ['exploring', 'waiting-for-lead', 'ready', 'building', 'check', 'shipped', 'archived'];
  const roles: PageRole[] = ['owner', 'designer', 'lead', 'developer', 'pm', 'viewer'];
  it('Code: a developer, from Ready for developers on; nobody else, ever', () => {
    for (const r of roles)
      for (const s of stages) expect(codeShown(r, s), `${r} ${s}`).toBe(r === 'developer' && ['ready', 'building', 'check', 'shipped'].includes(s));
  });
  it('before that, a developer reads one line; designers never do', () => {
    expect(devLineOf('developer', 'exploring')).toBe(DEV_EXPLORING_LINE);
    expect(devLineOf('developer', 'waiting-for-lead')).toBe(DEV_EXPLORING_LINE);
    expect(devLineOf('developer', 'ready')).toBeNull();
    for (const r of roles.filter((x) => x !== 'developer')) expect(devLineOf(r, 'exploring')).toBeNull();
    expect(DEV_EXPLORING_LINE).not.toMatch(/—|branch|git/i);
  });
});

describe('the Your turn zone: only what waits on the viewer, one per page', () => {
  it('exploring: the owner hands it over; anyone else gets no zone', () => {
    expect(zoneOf('exploring', { ...none, canDone: true })).toBe('done');
    expect(zoneOf('exploring', none)).toBeNull();
  });
  it('waiting for the lead: the lead answers, the owner waits (no zone), a reviewer can take it, the PM gives their say', () => {
    expect(zoneOf('waiting-for-lead', { ...none, leadBar: true })).toBe('lead-review');
    expect(zoneOf('waiting-for-lead', { ...none, canDone: true })).toBeNull();
    expect(zoneOf('waiting-for-lead', { ...none, leadTake: true })).toBe('lead-take');
    expect(zoneOf('waiting-for-lead', { ...none, pmMine: true })).toBe('pm');
    expect(zoneOf('exploring', { ...none, answersLead: true, canDone: true })).toBe('answer-lead');
  });
  it('handed off: a question waits on the viewer; Check the build asks whoever checks, their note the quote, not a second zone', () => {
    expect(zoneOf('ready', none)).toBeNull();
    expect(zoneOf('building', { ...none, question: true })).toBe('question');
    expect(zoneOf('check', { ...none, checkSay: true, question: true })).toBe('check');
    expect(zoneOf('check', none)).toBeNull();
    expect(zoneOf('building', { ...none, theirVersion: true })).toBe('their-version');
  });
  it('shipped celebrates, declined brings the owner back, archived and not doing say how it ended', () => {
    expect(zoneOf('shipped', none)).toBe('shipped');
    expect(zoneOf('declined', { ...none, declinedBack: true })).toBe('declined');
    expect(zoneOf('declined', none)).toBeNull();
    expect(zoneOf('archived', { ...none, canDone: true })).toBeNull();
    expect(zoneOf('exploring', { ...none, archived: true, notDoing: true })).toBe('not-doing');
  });
});

describe('words', () => {
  it('names the lead and the notes', () => {
    expect(handOverTitle('Dana')).toBe('Ready to hand it to Dana?');
    expect(handOverTitle(null)).toBe('Ready to hand it over?');
    expect(notesContext('The narrow screen, then the A/B call')).toBe('Left in your notes: the narrow screen, then the A/B call.');
    expect(notesContext('  ')).toBeNull();
  });
  it('one plain line under the title', () => {
    expect(ownerLine('Sofia', 'Acme CRM · Nov 6')).toBe("Sofia's exploration in Acme CRM, started Nov 6");
    expect(ownerLine('James', 'Acme CRM')).toBe("James' exploration in Acme CRM");
  });
  it('the journey names only the next step', () => {
    expect(journeyOf('exploring', { lead: 'Dana', product: 'Acme Prints' })).toEqual({ segments: ['now', 'next', 'next', 'next'], next: 'Then Dana picks what the library keeps' });
    expect(journeyOf('waiting-for-lead', { lead: 'Dana', product: 'Acme Prints' }).next).toBe('Then the Acme Prints developers build it');
    expect(journeyOf('check', { product: 'Acme CRM' })).toEqual({ segments: ['done', 'done', 'now', 'next'], next: 'Then it goes live in Acme CRM' });
    expect(journeyOf('shipped', { product: 'Acme CRM' })).toEqual({ segments: ['done', 'done', 'done', 'done'], next: 'Every step is done' });
  });
  it('the comment box names who reads it', () => {
    expect(writeToLine(['Malik', 'Dana'])).toBe('Write to Malik and Dana');
    expect(writeToLine(['Sofia'])).toBe('Write to Sofia');
    expect(writeToLine(['A', 'B', 'C'])).toBe('Write to A, B and C');
    expect(writeToLine([])).toBe('Write a note to the team');
  });
});

describe('Activity: one timeline', () => {
  const f = (name: string) => ({ login: name.toLowerCase(), name, agent: false, avatar: null });
  it('merges events and decisions oldest first, key steps as milestones, a reason quoted once', () => {
    const rows = timelineOf(
      [
        { who: f('Malik'), text: 'built it in pull request #212', when: 'Yesterday', at: '2026-11-09T10:00:00Z' },
        { who: f('Sofia'), text: 'said done exploring', when: 'Nov 8', at: '2026-11-08T10:00:00Z' },
      ],
      [
        { key: '1', login: 'name:Ann', name: 'Ann', verb: 'said it looks right', why: 'Clean', at: '2026-11-08T12:00:00Z' },
        { key: '2', login: 'name:Dana', name: 'Dana', verb: 'asked for changes', why: 'Already in the zone', at: '2026-11-09T12:00:00Z' },
      ],
      () => 'when',
      ['Already in the zone'],
    );
    expect(rows.map((r) => `${r.who.name} ${r.text}`)).toEqual(['Sofia said done exploring', 'Ann said it looks right', 'Malik built it in pull request #212', 'Dana asked for changes']);
    expect(rows.map((r) => r.milestone)).toEqual([true, true, false, true]);
    expect(rows[1]!.quote).toBe('Clean');
    expect(rows[3]!.quote).toBeNull();
  });
  it('folds the earlier lines, never a lone one', () => {
    expect(foldTimeline([1, 2, 3, 4, 5])).toEqual({ earlier: [], shown: [1, 2, 3, 4, 5] });
    expect(foldTimeline([1, 2, 3, 4, 5, 6])).toEqual({ earlier: [1, 2], shown: [3, 4, 5, 6] });
  });
});

describe('the screen', () => {
  it('never compares two different screens', () => {
    expect(sameScreen('/#/contacts/31/show', '#/contacts/31/show/')).toBe(true);
    expect(sameScreen('/#/contacts/31/show', '/#/contacts')).toBe(false);
    expect(sameScreen(null, '/#/contacts')).toBe(true);
  });
  it('a new component waits on the lead choice only for who can answer it', () => {
    const rows = [
      { id: 't', kind: 'New component', title: 'Timeline', menu: ['approve', 'changes', 'local', 'existing'] },
      { id: 'c', kind: 'Change to Card', title: 'Card', menu: ['approve', 'local'] },
    ];
    expect(stagedPieces(rows, true).map((r) => r.id)).toEqual(['t']);
    expect(stagedPieces(rows, false)).toEqual([]);
  });
});
