// Request access, the pure parts (lib/access-request.ts): the field rules the page and api/access share, the date,
// what this browser remembers, and the words in the Bridge voice.
import { describe, expect, it } from 'vitest';
import { ACCESS_DEMO, ACCESS_WORDS, accessDay, checkAccessRequest, emailFromQuery, foundingRequest, isHttpsLink, oneLine, parisDay, parseRemembered, REQUEST_PAGE } from './access-request';
import { CONTACT_EMAIL } from './pricing';
import { DEMO, REQUEST } from './nav';

const ok = { email: 'ana@acme.com', company: 'Acme', where: '', fix: 'Our tokens drift from Figma' };

describe('the request page rules', () => {
  it('accepts a full request, cleaned to one line each', () => {
    expect(checkAccessRequest({ ...ok, company: '  Acme \n Inc  ', where: 'https://github.com/acme/ds' })).toEqual({
      ok: true,
      value: { email: 'ana@acme.com', company: 'Acme Inc', where: 'https://github.com/acme/ds', fix: 'Our tokens drift from Figma' },
    });
    expect(checkAccessRequest(ok).ok).toBe(true);
  });

  it('says how to fix each field, in the page words', () => {
    const r = checkAccessRequest({ email: 'ana', company: ' ', where: 'github.com/acme', fix: '' });
    expect(r).toEqual({
      ok: false,
      errors: { email: 'Enter a work email, like ana@acme.com.', company: 'Add your company name.', where: 'Enter a full link, starting with https://', fix: 'Tell us in a few words what you want to fix first.' },
    });
  });

  it('caps the lengths: company 120, link 300, fix 300', () => {
    expect(checkAccessRequest({ ...ok, company: 'a'.repeat(120) }).ok).toBe(true);
    expect(checkAccessRequest({ ...ok, company: 'a'.repeat(121) }).ok).toBe(false);
    expect(checkAccessRequest({ ...ok, fix: 'a'.repeat(301) }).ok).toBe(false);
    expect(isHttpsLink(`https://acme.com/${'a'.repeat(280)}`)).toBe(true);
    expect(isHttpsLink(`https://acme.com/${'a'.repeat(290)}`)).toBe(false);
  });

  it('takes only full https links', () => {
    expect(isHttpsLink('https://storybook.acme.com')).toBe(true);
    for (const bad of ['http://acme.com', 'javascript:alert(1)', 'https://', 'https://localhost', 'acme.com', 'ftp://acme.com']) expect(isHttpsLink(bad), bad).toBe(false);
  });

  it('keeps one line of text, without control characters', () => {
    expect(oneLine('a\u0000b\r\nc d')).toBe('a b c d');
    expect(oneLine(42)).toBe('');
  });

  it('writes the date the way the site does, in UTC', () => {
    expect(accessDay('2026-11-23T23:30:00.000Z')).toBe('23 November 2026');
    expect(accessDay('nope')).toBe('');
  });

  it('remembers a request as { email, at } and ignores anything else', () => {
    expect(parseRemembered(JSON.stringify({ email: 'ana@acme.com', at: '2026-11-23T10:00:00.000Z' }))).toEqual({ email: 'ana@acme.com', at: '2026-11-23T10:00:00.000Z' });
    for (const bad of [null, '', '{', '[]', JSON.stringify({ email: 'ana', at: '2026-11-23' }), JSON.stringify({ email: 'ana@acme.com', at: 'x' })]) expect(parseRemembered(bad)).toBeNull();
  });

  it('prefills the email from ?email= only when it is one', () => {
    expect(emailFromQuery('?email=ana%40acme.com')).toBe('ana@acme.com');
    expect(emailFromQuery('?email=nope')).toBe('');
    expect(emailFromQuery('')).toBe('');
  });

  it('a request sent by 31 March 2027, Paris time, reserves a founding place; one sent after does not', () => {
    expect(foundingRequest('2026-11-23T10:00:00.000Z')).toBe(true);
    expect(foundingRequest('2027-03-31T21:59:59.000Z')).toBe(true);
    expect(foundingRequest('2027-03-31T22:00:00.000Z')).toBe(false);
    expect(foundingRequest('2027-04-01T09:00:00.000Z')).toBe(false);
    expect(foundingRequest('nope')).toBe(false);
    expect(parisDay('2027-03-31T21:59:59.000Z')).toBe('2027-03-31');
  });

  it('points to the same demo and request page as the site nav', () => {
    expect(ACCESS_DEMO).toBe(DEMO);
    expect(REQUEST_PAGE).toBe(REQUEST);
    expect(REQUEST_PAGE).toBe('/request/');
  });

  it('speaks in the Bridge voice: no em dash, the founding place only as terms 10.1 says it, the contact address when closed', () => {
    const all = Object.values(ACCESS_WORDS).flat().join('\n');
    expect(all).not.toMatch(/—/);
    expect(ACCESS_WORDS.foundingSaved).toBe('Your founding place is saved.');
    expect(all).not.toMatch(/31 March|no limits|forever/i);
    expect(ACCESS_WORDS.unavailable).toContain(CONTACT_EMAIL);
    expect(ACCESS_WORDS.submit).toBe('Request access');
  });
});
