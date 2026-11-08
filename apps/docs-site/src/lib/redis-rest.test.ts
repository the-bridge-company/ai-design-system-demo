// Upstash over REST (api/_lib/redis.ts): a storage failure answers 503 in the feature's words and logs Upstash's own
// words (the 2026-11-08 incident showed only "storage"), never the token.
import { describe, expect, it } from 'vitest';
import { redisRest, storageLog } from '../../api/_lib/redis';

const TOKEN = 'AX_secret_token_value_1234567890';

describe('redisRest: storage errors say their cause', () => {
  it('logs the error Upstash returns for a command, with the command name and never the token', async () => {
    const lines: string[] = [];
    const f = async () => Response.json({ error: 'ERR max requests limit exceeded. Limit: 500000, Usage: 500000' });
    const redis = redisRest('https://x.upstash.io', TOKEN, f, 'Storage is down.', (l) => lines.push(l));
    await expect(redis.cmd('SET', 'k', 'v')).rejects.toMatchObject({ status: 503, code: 'storage', message: 'Storage is down.' });
    expect(lines).toEqual(['redis: ERR max requests limit exceeded. Limit: 500000, Usage: 500000 (SET)']);
  });

  it('logs an HTTP failure and a pipeline error, never the token even when the answer repeats it', async () => {
    const lines: string[] = [];
    let n = 0;
    const f = async () => (n++ === 0 ? new Response(JSON.stringify({ error: `bad token ${TOKEN}` }), { status: 401 }) : Response.json([{ result: 'OK' }, { error: 'OOM command not allowed when used memory > maxmemory' }]));
    const redis = redisRest('https://x.upstash.io', TOKEN, f, 'down', (l) => lines.push(l));
    await expect(redis.cmd('GET', 'k')).rejects.toMatchObject({ status: 503 });
    await expect(redis.pipe([['GET', 'a'], ['set', 'b', 'v']])).rejects.toMatchObject({ status: 503 });
    expect(lines).toEqual(['redis: HTTP 401 bad token [token] (GET)', 'redis: OOM command not allowed when used memory > maxmemory (GET, SET)']);
    expect(lines.join('\n')).not.toContain(TOKEN);
  });

  it('logs an unreachable store, and keeps the line short', async () => {
    const lines: string[] = [];
    const redis = redisRest(
      'https://x.upstash.io',
      TOKEN,
      async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
      'down',
      (l) => lines.push(l),
    );
    await expect(redis.cmd('INCRBY', 'k', 1)).rejects.toMatchObject({ status: 503 });
    expect(lines).toEqual(['redis: unreachable: getaddrinfo ENOTFOUND (INCRBY)']);
    expect(storageLog('x'.repeat(1000), TOKEN, Array(8).fill('GET')).length).toBeLessThan(360);
  });
});
