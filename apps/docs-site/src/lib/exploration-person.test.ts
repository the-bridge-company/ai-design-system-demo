// One rule for who an exploration is by, on every surface (Changes, Home, product page, Being built): the person its
// record names, never the GitHub account that opened its pull request.
import { describe, expect, it } from 'vitest';
import { authorPerson, explorationPerson, person } from './home-model';
import { nameAuthor } from './author';
import { isYours } from './branches-page';
import { DEVELOPER_ON_IT, statusPill } from './changes';

const block = (o: Record<string, unknown>) => `## Exploration\n\n<!-- bridge-exploration ${JSON.stringify({ name: 'Notification channels', slug: 'notification-channels', ...o })} -->`;
const pick = (l: string) => person(l, l === 'peterbono' ? 'Florian' : null, null);

describe('explorationPerson', () => {
  it('names the member the exploration block records, not the account that opened it', () => {
    const p = explorationPerson('peterbono', block({ member: '48f0991bb514fca6', memberName: 'Leo' }), pick);
    expect(p.name).toBe('Leo');
    expect(p.login).toBe('~leo');
  });

  it('reads the Requested by line first, by login', () => {
    const p = explorationPerson('peterbono', `Requested by Ann (@ann) through Bridge.\n\n${block({ memberName: 'Leo' })}`, pick);
    expect(p.login).toBe('ann');
  });

  it('keeps the account when nobody is named', () => {
    expect(explorationPerson('peterbono', block({}), pick).name).toBe('Florian');
  });

  it('turns a name-only author into a drawn face, never a GitHub lookup', () => {
    const looked: string[] = [];
    const p = authorPerson(nameAuthor('Sofia'), (l) => (looked.push(l), person(l)));
    expect(p).toMatchObject({ name: 'Sofia', login: '~sofia', avatar: null });
    expect(looked).toEqual([]);
  });
});

describe('isYours with a name-only author', () => {
  it('matches the viewer by name', () => {
    expect(isYours({ author: nameAuthor('Leo') }, 'leo-gh', 'Leo')).toBe(true);
    expect(isYours({ author: nameAuthor('Leo') }, 'peterbono', 'Florian')).toBe(false);
  });
});

describe('statusPill tone for a technical blocker', () => {
  it('reads as work in progress for a designer, never as an error', () => {
    expect(statusPill('ci-failing', { short: DEVELOPER_ON_IT })).toEqual({ label: DEVELOPER_ON_IT, tone: 'info' });
    expect(statusPill('conflict', { short: DEVELOPER_ON_IT }).tone).toBe('info');
  });

  it('keeps the danger tone for the developer who fixes it', () => {
    expect(statusPill('ci-failing', { short: 'Blocked by tests' }).tone).toBe('danger');
  });
});
