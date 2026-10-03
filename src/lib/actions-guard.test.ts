// src/lib/actions-guard.test.ts
import { ActionError, type ActionAPIContext } from 'astro:actions';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SERVER_ERROR_MESSAGE, clientIp, enforceRateLimit, guardServerErrors, requireUser } from './actions-guard';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const user = {
  id: 'user-1',
  name: 'Learner',
  email: 'learner@example.com',
  emailVerified: true,
  createdAt: new Date('2026-09-15T00:00:00Z'),
  updatedAt: new Date('2026-09-15T00:00:00Z'),
} as NonNullable<App.Locals['user']>;

function context(overrides: { clientAddress?: string; user?: App.Locals['user'] } = {}): ActionAPIContext {
  return {
    clientAddress: overrides.clientAddress ?? '203.0.113.7',
    locals: { user: overrides.user ?? null, session: null },
  } as unknown as ActionAPIContext;
}

async function failure(fn: () => unknown): Promise<ActionError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ActionError) return err;
    throw err;
  }
  throw new Error('expected an ActionError');
}

describe('requireUser', () => {
  test('throws UNAUTHORIZED with no user in locals', async () => {
    const err = await failure(() => requireUser(context()));
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.status).toBe(401);
    expect(err.message).toBe('Sign in to save your work.');
  });

  test('returns the user when present', () => {
    expect(requireUser(context({ user }))).toBe(user);
  });
});

describe('enforceRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T09:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('allows limit hits per key and name, then throws TOO_MANY_REQUESTS, then slides', async () => {
    const rule = { limit: 3, windowMs: MINUTE };
    for (let i = 0; i < 3; i++) expect(() => enforceRateLimit('guard-a', rule, 'ip:1')).not.toThrow();
    const err = await failure(() => enforceRateLimit('guard-a', rule, 'ip:1'));
    expect(err.code).toBe('TOO_MANY_REQUESTS');
    expect(err.status).toBe(429);
    expect(err.message).toBe('Too many requests. Try again in 1 minute.');
    // Another key under the same rule and the same key under another rule are unaffected.
    expect(() => enforceRateLimit('guard-a', rule, 'ip:2')).not.toThrow();
    expect(() => enforceRateLimit('guard-b', rule, 'ip:1')).not.toThrow();
    vi.advanceTimersByTime(MINUTE + 1);
    expect(() => enforceRateLimit('guard-a', rule, 'ip:1')).not.toThrow();
  });

  test('the message rounds the wait up to whole minutes', async () => {
    const rule = { limit: 1, windowMs: HOUR };
    enforceRateLimit('guard-c', rule, 'user:abc');
    expect((await failure(() => enforceRateLimit('guard-c', rule, 'user:abc'))).message).toBe('Too many requests. Try again in 60 minutes.');
    vi.advanceTimersByTime(30 * MINUTE + 30_000);
    expect((await failure(() => enforceRateLimit('guard-c', rule, 'user:abc'))).message).toBe('Too many requests. Try again in 30 minutes.');
    vi.advanceTimersByTime(29 * MINUTE + 29_000);
    expect((await failure(() => enforceRateLimit('guard-c', rule, 'user:abc'))).message).toBe('Too many requests. Try again in 1 minute.');
  });

  test('the first call under a name fixes the rule for that name', async () => {
    enforceRateLimit('guard-d', { limit: 1, windowMs: HOUR }, 'ip:9');
    // A looser rule passed later does not replace the limiter already created for the name.
    const err = await failure(() => enforceRateLimit('guard-d', { limit: 100, windowMs: HOUR }, 'ip:9'));
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('clientIp', () => {
  test('returns the client address, or unknown when it is empty', () => {
    expect(clientIp(context({ clientAddress: '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(context({ clientAddress: '' }))).toBe('unknown');
  });
});

describe('guardServerErrors', () => {
  test('passes the result through and leaves an ActionError untouched', async () => {
    expect(await guardServerErrors('ok', async () => ({ ok: true }))).toEqual({ ok: true });
    const original = new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Try again in 1 minute.' });
    const thrown = await failure(() => guardServerErrors('limited', async () => { throw original; }));
    expect(thrown).toBe(original);
  });

  test('replaces any other Error with the generic INTERNAL_SERVER_ERROR and logs the detail without the query parameters', async () => {
    const lines: string[] = [];
    // The shape drizzle-orm gives a failed statement (errors.js, DrizzleQueryError): the parameters are the address.
    const thrown = await failure(() =>
      guardServerErrors(
        'notifySubscribe',
        async () => { throw new Error('Failed query: insert into "notify_subscriber" ("email", "created_at") values ($1, $2)\nparams: who@example.com,2026-10-03T05:05:34.739Z'); },
        (l) => lines.push(l),
      ),
    );
    expect(thrown.code).toBe('INTERNAL_SERVER_ERROR');
    expect(thrown.status).toBe(500);
    expect(thrown.message).toBe(SERVER_ERROR_MESSAGE);
    expect(thrown.message).not.toContain('Failed query');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[actions] notifySubscribe failed: Error: Failed query: insert into "notify_subscriber"');
    expect(lines[0]).toContain('params: [redacted]');
    expect(lines[0]).not.toContain('who@example.com');
    // The stack frames stay so the failure can be located.
    expect(lines[0]).toMatch(/\n\s+at /);
  });

  test('a thrown non-Error value is logged as text and hidden the same way', async () => {
    const lines: string[] = [];
    const thrown = await failure(() => guardServerErrors('x', async () => { throw 'plain string'; }, (l) => lines.push(l)));
    expect(thrown.message).toBe(SERVER_ERROR_MESSAGE);
    expect(lines[0]).toBe('[actions] x failed: plain string');
  });
});
