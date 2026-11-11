import { describe, expect, it } from 'vitest';
import { aboutLine, canSayDone, codeShown, groupedText, quietChange, screenNameOfRoute, DEV_EXPLORING_LINE, devLineOf, foldTimeline, daysSince, handOverTitle, leadStepText, NOTES_LINE, notesContext, ownerLine, pageRoleOf, pageStageOf, repeatsTitle, sameScreen, stagedPieces, timelineOf, pmBlockOf, sharedChoiceOf, waitBlockOf, waitedWhen, writeToLine, zoneOf, type WaitInput, type PageRole, type PageStage, type ZoneFlags } from './exploration-layout';

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
  it('names who decides what the library keeps: the lead by name, "You" for the lead, the design lead when unknown', () => {
    expect(leadStepText({ lead: 'Dana', viewerLeads: false })).toBe('Dana decides what the library keeps');
    expect(leadStepText({ lead: 'Dana', viewerLeads: true })).toBe('You decide what the library keeps');
    expect(leadStepText({ lead: ' ', viewerLeads: false }, true)).toBe('The design lead decides');
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

describe('repeatsTitle', () => {
  it('spots a screen name that only repeats the page title', () => {
    expect(repeatsTitle('Fulfilment timeline', 'Order fulfilment timeline')).toBe(true);
    expect(repeatsTitle('Contact summary', 'Contact page summary')).toBe(true);
    expect(repeatsTitle('Order details', 'Order fulfilment timeline')).toBe(false);
    expect(repeatsTitle(null, 'Order fulfilment timeline')).toBe(false);
    expect(repeatsTitle('Products', 'Bulk actions on products')).toBe(false);
    expect(repeatsTitle('Order', 'Order fulfilment timeline')).toBe(false);
  });
});

describe('Done exploring is only the owner\'s turn', () => {
  it('a lead who may also say it (a keeper on someone else\'s work) follows it: no "Your exploration" zone', () => {
    expect(canSayDone('owner', { kind: 'run' })).toBe(true);
    expect(canSayDone('lead', { kind: 'run' })).toBe(false);
    expect(canSayDone('designer', { kind: 'run' })).toBe(false);
    expect(canSayDone('owner', { kind: 'note' })).toBe(false);
    expect(canSayDone('owner', null)).toBe(false);
    expect(zoneOf('exploring', { ...none, canDone: canSayDone('lead', { kind: 'run' }) })).toBeNull();
    expect(zoneOf('waiting-for-lead', { ...none, leadBar: true, canDone: canSayDone('lead', { kind: 'run' }) })).toBe('lead-review');
  });
});

describe('the Activity says each thing once', () => {
  const leo = { login: 'leo', name: 'Leo', agent: false, avatar: null };
  const when = (iso: string) => iso;
  it('a commit that only repeats the exploration name reads "saved a change"', () => {
    expect(quietChange('made a change: Save Bulk actions on products', 'Bulk actions on products')).toBe('saved a change');
    // The handover notes' own commits say what they are.
    expect(quietChange('made a change: Note where it stands', 'Bulk actions on products')).toBe(NOTES_LINE);
    expect(quietChange('made a change: Update where it stands', null)).toBe('updated the handover notes');
    expect(quietChange('made a change: Note the narrow screen', 'Bulk actions on products')).toBe('made a change: Note the narrow screen');
    expect(quietChange('made a change: Update bulk actions on products.', 'Bulk actions on products')).toBe('saved a change');
    expect(quietChange('made a change: Save', 'Bulk actions on products')).toBe('saved a change');
    expect(quietChange('made a change: Price window preview', 'Bulk actions on products')).toBe('made a change: Price window preview');
    expect(quietChange('added the price window', 'Bulk actions on products')).toBe('added the price window');
    expect(quietChange('made a change: Save Bulk actions on products', null)).toBe('made a change: Save Bulk actions on products');
  });
  it('the same line in a row groups into one, at the latest time', () => {
    const events = [
      { who: leo, text: 'brought in the latest product', when: '2 days ago', at: '2026-11-09T11:14:22Z' },
      { who: leo, text: 'made a change: Save Bulk actions on products', when: '2 days ago (b)', at: '2026-11-09T02:32:12Z' },
      { who: leo, text: 'made a change: Save Bulk actions on products', when: '2 days ago (a)', at: '2026-11-09T02:03:30Z' },
    ];
    const rows = timelineOf(events, [], when, [], 'Bulk actions on products');
    expect(rows.map((r) => r.text)).toEqual(['saved 2 changes', 'brought in the latest product']);
    expect(rows[0]!.when).toBe('2 days ago (b)');
    expect(rows[0]!.at).toBe('2026-11-09T02:32:12Z');
  });
  it('different people, a milestone or a line between never group', () => {
    const ann = { ...leo, login: 'ann', name: 'Ann' };
    const rows = timelineOf(
      [
        { who: leo, text: 'made a change: Tighter padding', when: 'c', at: '2026-11-03T00:00:00Z' },
        { who: ann, text: 'made a change: Tighter padding', when: 'b', at: '2026-11-02T00:00:00Z' },
        { who: leo, text: 'made a change: Tighter padding', when: 'a', at: '2026-11-01T00:00:00Z' },
      ],
      [],
      when,
    );
    expect(rows).toHaveLength(3);
    expect(groupedText('made a change: Tighter padding', 2)).toBe('made a change: Tighter padding, 2 times');
    expect(groupedText('saved a change', 1)).toBe('saved a change');
  });
});

describe('the screen stage names the screen, then what the exploration does', () => {
  it('the screen from its route, never a changed region', () => {
    expect(screenNameOfRoute('/#/products?view=list')).toBe('Products');
    expect(screenNameOfRoute('/?tenant=acme#/products?view=list&select=2')).toBe('Products');
    expect(screenNameOfRoute('/?tenant=acme#/orders/65')).toBe('Order');
    expect(screenNameOfRoute('/#/contacts/31/show')).toBe('Contact');
    expect(screenNameOfRoute('/#/addresses/4')).toBe('Address');
    expect(screenNameOfRoute('/plans')).toBe('Plans');
    expect(screenNameOfRoute('/#/order-history')).toBe('Order history');
    expect(screenNameOfRoute('/')).toBeNull();
    expect(screenNameOfRoute(null)).toBeNull();
  });
  it('one plain sentence from the purpose', () => {
    expect(aboutLine('Pick several prints, then publish, hide or reprice them together with a before and after preview.')).toBe('Pick several prints, then publish, hide or reprice them together with a before and after preview.');
    expect(aboutLine('show the days in stage. Then more.')).toBe('Show the days in stage.');
    expect(aboutLine('  a summary on top ')).toBe('A summary on top.');
    expect(aboutLine('')).toBeNull();
    expect(aboutLine('x '.repeat(150))!.length).toBeLessThanOrEqual(203);
  });
});

describe('the turn block while nothing waits on the viewer (direction B)', () => {
  const base: WaitInput = { stage: 'waiting-for-lead', role: 'owner', author: 'Sofia', lead: 'Dana', viewerLeads: false, product: 'Acme Prints' };
  it('says how long the lead has waited from the real ask, never an invented number', () => {
    expect(waitedWhen(null)).toBe('now');
    expect(waitedWhen(0)).toBe('now, since today');
    expect(waitedWhen(1)).toBe('now, since yesterday');
    expect(waitedWhen(3)).toBe('now, for 3 days');
    const now = Date.parse('2026-11-11T12:00:00Z');
    expect(daysSince('2026-11-08T10:00:00Z', now)).toBe(3);
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('not a date', now)).toBeNull();
  });
  it('waiting for the lead, the designer: the lead step now, the steps to come, the reminder rule, Keep exploring', () => {
    const b = waitBlockOf({ ...base, waitedDays: 3, canKeepExploring: true })!;
    expect(b.eyebrow).toBe('Nothing to do for now');
    expect(b.title).toBe('Dana decides what the library keeps');
    expect(b.steps).toEqual([
      { text: 'Dana decides', when: 'now, for 3 days', current: true },
      { text: 'Acme Prints developers build it' },
      { text: 'You check their version' },
      { text: 'Live in Acme Prints' },
    ]);
    // Bridge's rule, said as a rule: never "Bridge reminded her" without the reminder having happened.
    expect(b.lines).toEqual(['Bridge reminds Dana once after 2 days without an answer, and tells you as soon as there is one.']);
    expect(b.action).toEqual({ kind: 'keep-exploring', label: 'Keep exploring' });
  });
  it('waiting for the lead, another designer whose screen the same choice sets: says so, See the choice', () => {
    const b = waitBlockOf({ ...base, role: 'designer', shared: { component: 'Card', property: 'padding', screen: 'Deal pipeline cards', product: 'Acme CRM' } })!;
    expect(b.steps[2]!.text).toBe('Sofia checks their version');
    expect(b.lines).toEqual(["Dana's Card padding choice also sets your Deal pipeline cards in Acme CRM. Bridge tells you what Dana picks."]);
    expect(b.action).toEqual({ kind: 'see-choice', label: 'See the Card padding choice' });
  });
  it('the shared choice comes from the library block: an open choice with a way of the viewer\'s own', () => {
    const c = { component: 'Card', property: 'padding', pick: null, decided: null, ways: [{ designer: 'Sofia', mine: true, screen: 'Order fulfilment timeline', product: 'Acme Prints' }, { designer: 'Leo', mine: false, screen: 'Deal pipeline cards', product: 'Acme CRM' }] };
    expect(sharedChoiceOf('Leo', [c])).toEqual({ component: 'Card', property: 'padding', screen: 'Deal pipeline cards', product: 'Acme CRM' });
    expect(sharedChoiceOf('leo ', [c])).not.toBeNull();
    // Sofia's own way is this page's: nothing shared. Ann has no way. Decided: nothing left to see.
    expect(sharedChoiceOf('Sofia', [c])).toBeNull();
    expect(sharedChoiceOf('Ann', [c])).toBeNull();
    expect(sharedChoiceOf('Leo', [{ ...c, pick: 'b#2' }])).toBeNull();
    expect(sharedChoiceOf(null, [c])).toBeNull();
  });
  it('waiting for the lead, a designer it does not touch: nothing to press', () => {
    const b = waitBlockOf({ ...base, role: 'designer' })!;
    expect(b.lines).toEqual(['Nothing reaches the developers before Dana sends it.']);
    expect(b.action).toBeNull();
  });
  it('waiting for the lead, the developer: the task comes once it is sent', () => {
    const b = waitBlockOf({ ...base, role: 'developer' })!;
    expect(b.lines).toEqual(['You get a task in your repository once Dana sends it.']);
    expect(b.action).toBeNull();
  });
  it('a lead that took it is said first; an unknown lead reads "the design lead"', () => {
    expect(waitBlockOf({ ...base, taken: 'Dana is looking at it.' })!.lines[0]).toBe('Dana is looking at it.');
    const b = waitBlockOf({ ...base, lead: null, role: 'designer' })!;
    expect(b.title).toBe('The design lead decides what the library keeps');
    expect(b.lines).toEqual(['Nothing reaches the developers before the design lead sends it.']);
  });
  it('exploring, someone else: who explores now, who decides next', () => {
    const b = waitBlockOf({ ...base, stage: 'exploring', role: 'designer' })!;
    expect(b.title).toBe('Sofia is exploring');
    expect(b.steps[0]).toEqual({ text: 'Sofia explores', when: 'now', current: true });
    expect(b.steps[1]!.text).toBe('Dana decides what the library keeps');
    expect(b.lines).toEqual(['It goes to Dana when Sofia says Done exploring.']);
    expect(waitBlockOf({ ...base, stage: 'exploring', role: 'lead', viewerLeads: true })!.lines).toEqual(['It reaches you when Sofia says Done exploring.']);
    expect(waitBlockOf({ ...base, stage: 'exploring', role: 'developer' })!.lines).toEqual([DEV_EXPLORING_LINE]);
  });
  it('exploring, the owner who cannot say Done exploring here: the line that says why', () => {
    const b = waitBlockOf({ ...base, stage: 'exploring', doneNote: 'Sofia keeps it.' })!;
    expect(b.title).toBe('You are exploring');
    expect(b.lines).toEqual(['Sofia keeps it.']);
  });
  it('handed to the developers: the current hand-off step and what comes after, in words', () => {
    const steps = [
      { status: 'done' as const, title: 'Done exploring', detail: 'Sofia.' },
      { status: 'waiting' as const, title: 'Developers build it', detail: 'In their task list. You see here when one picks it up.', current: true },
      { status: 'waiting' as const, title: 'Review', detail: 'After the developers' },
      { status: 'waiting' as const, title: 'Shipped', detail: 'Then live in Acme Prints' },
    ];
    const b = waitBlockOf({ ...base, stage: 'ready', steps })!;
    expect(b.title).toBe('Acme Prints developers build it');
    expect(b.steps).toEqual([{ text: 'Acme Prints developers build it', current: true, when: 'now' }, { text: 'You check their version' }, { text: 'Live in Acme Prints' }]);
    expect(b.lines).toEqual(['In their task list. You see here when one picks it up.']);
    const building = waitBlockOf({ ...base, stage: 'building', role: 'designer', builder: 'Malik', steps })!;
    expect(building.title).toBe('Malik builds it');
    expect(building.steps[1]!.text).toBe('Sofia checks their version');
    const dev = waitBlockOf({ ...base, stage: 'ready', role: 'developer', steps })!;
    expect(dev.eyebrow).toBe('For the developers');
    expect(dev.lines).toContain('Code, next to the title, has the branch and the commands.');
    expect(waitBlockOf({ ...base, stage: 'ready', steps, send: true })!.action).toEqual({ kind: 'send' });
  });
  it('check the build, someone not checking: who checks now and what the others said', () => {
    const b = waitBlockOf({ ...base, stage: 'check', role: 'designer', checkers: [{ name: 'Sofia', you: false, said: 'waiting' }, { name: 'Dana', you: false, said: 'looks-right' }, { name: 'Ann', you: false, said: 'not-needed' }] })!;
    expect(b.title).toBe('Sofia checks the build');
    expect(b.steps).toEqual([{ text: 'Sofia checks', when: 'now', current: true }, { text: 'Live in Acme Prints' }]);
    expect(b.lines).toEqual(['Dana said it looks right.', 'It goes live in Acme Prints once it looks right.']);
  });
  it('declined, archived, not started and shipped', () => {
    expect(waitBlockOf({ ...base, stage: 'declined', declinedLine: 'Closed.' })).toMatchObject({ title: 'The developers did not build it', steps: [], lines: ['Closed.'], action: null });
    expect(waitBlockOf({ ...base, stage: 'archived', canUnarchive: true, archivedLine: 'Archived.' })).toMatchObject({ eyebrow: 'Nothing to do for now', title: 'Nobody works on it now', lines: ['Archived.'], action: { kind: 'unarchive', label: 'Unarchive' } });
    expect(waitBlockOf({ ...base, stage: 'archived' })!.action).toBeNull();
    expect(waitBlockOf({ ...base, stage: 'not-started' })).toBeNull();
    expect(waitBlockOf({ ...base, stage: 'shipped' })).toBeNull();
  });
  it('every stage and role: no em dash, one current step at most, one button at most', () => {
    const stages: WaitInput['stage'][] = ['exploring', 'waiting-for-lead', 'ready', 'building', 'check', 'declined', 'archived'];
    const roles: WaitInput['role'][] = ['owner', 'designer', 'lead', 'developer', 'pm', 'viewer'];
    for (const stage of stages)
      for (const role of roles) {
        const b = waitBlockOf({ ...base, stage, role, viewerLeads: role === 'lead' })!;
        expect(`${b.eyebrow} ${b.title} ${b.lines.join(' ')} ${b.steps.map((s) => `${s.text} ${s.when ?? ''}`).join(' ')}`).not.toContain('\u2014');
        expect(b.steps.filter((s) => s.current).length).toBeLessThanOrEqual(1);
      }
  });
});

describe('the product manager in the turn block', () => {
  const pm = { stage: 'waiting-for-lead' as const, said: false, lead: 'Dana', author: 'Sofia', product: 'Acme Prints', line: 'You have not said what you think yet.' };
  it('optional once the lead is asked: their view first, then Dana decides', () => {
    const b = pmBlockOf(pm);
    expect(b.eyebrow).toBe('Optional for you');
    expect(b.title).toBe('Your view, before Dana decides');
    expect(b.steps.map((s) => s.text)).toEqual(['You give your view', 'Dana decides what the library keeps', 'Acme Prints developers build it', 'Sofia checks, then it goes live']);
    expect(b.steps[0]).toMatchObject({ when: 'optional, now', current: true });
    expect(b.lines).toEqual(['Dana can decide without it. If you give it, Dana reads it first.']);
  });
  it('while it is explored: the designer shares it first', () => {
    const b = pmBlockOf({ ...pm, stage: 'exploring' });
    expect(b.eyebrow).toBe('Your turn');
    expect(b.lines).toEqual(['Sofia shares it with you before it goes to Dana.']);
  });
  it('once said: waits like everyone, their word changeable', () => {
    const b = pmBlockOf({ ...pm, said: true, line: 'You said it looks good, today.' });
    expect(b.eyebrow).toBe('Nothing to do for now');
    expect(b.title).toBe('Dana decides what the library keeps');
    expect(b.lines).toEqual(['You said it looks good, today.']);
    expect(b.action).toEqual({ kind: 'change-view', label: 'Change your view' });
  });
});
