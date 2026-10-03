// src/actions/index.test.ts
// Fake-context tests per action (blueprint sections 7.3 and 12.1). Phase 0 covers the three notify
// actions and pins the other eight as NOT_IMPLEMENTED stubs. The library modules carry the detailed
// tests; these assert result shapes, error codes, and the rate limits through the handlers.
import { eq } from 'drizzle-orm';
import { isInputError } from 'astro:actions';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { getDb } from '../db';
import type { DbHandle } from '../db/client';
import { notifySubscriber } from '../db/schema';
import { env, requireEnv } from '../lib/env';
import { RATE_RULES } from '../lib/limits';
import { setMailerForTests, type Mailer, type OutboundMessage } from '../lib/mailer';
import { signToken } from '../lib/tokens';
import { fakeActionContext } from '../../test/fake-action-context';
import { server } from './index';

// test/fake-action-context.ts is the one place that names Astro's internal action-context symbol
// (decision 44); every action test, this file and index.failure.test.ts, imports it from there.

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

let h: DbHandle;
let sent: OutboundMessage[] = [];
const spy: Mailer = {
  name: 'spy',
  send: async (m) => {
    sent.push(m);
  },
};
const secret = () => requireEnv('NOTIFY_TOKEN_SECRET');
const readRow = async (email: string) => (await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, email)))[0] ?? null;
const tokenOf = (url: string) => new URL(url).searchParams.get('token') ?? '';

beforeAll(async () => {
  h = await getDb();
});

afterAll(async () => {
  await h.close();
});

beforeEach(() => {
  sent = [];
  setMailerForTests(spy);
});

afterEach(() => {
  setMailerForTests(null);
});

describe('notifySubscribe', () => {
  test('stores the address and returns { ok: true } without saying whether it was new', async () => {
    const first = await server.notifySubscribe.call(fakeActionContext(), form({ email: 'Action.Learner@Example.COM' }));
    expect(first.error).toBeUndefined();
    expect(first.data).toEqual({ ok: true });
    const row = await readRow('action.learner@example.com');
    expect(row).not.toBeNull();
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.confirmedAt).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('action.learner@example.com');
    expect(sent[0]!.links.confirm).toMatch(new RegExp(`^${env.siteUrl}/notify/confirm\\?token=`));
    expect(sent[0]!.links.unsubscribe).toMatch(new RegExp(`^${env.siteUrl}/notify/unsubscribe\\?token=`));
    const second = await server.notifySubscribe.call(fakeActionContext(), form({ email: 'action.learner@example.com' }));
    expect(second).toEqual(first);
  });

  test('rejects an address that is not an email with BAD_REQUEST and a field message', async () => {
    const result = await server.notifySubscribe.call(fakeActionContext(), form({ email: 'not-an-email' }));
    expect(result.data).toBeUndefined();
    expect(result.error?.code).toBe('BAD_REQUEST');
    expect(isInputError(result.error)).toBe(true);
    if (isInputError(result.error)) expect(result.error.fields.email?.length).toBeGreaterThan(0);
    expect(await readRow('not-an-email')).toBeNull();
    expect(sent).toHaveLength(0);
  });

  test('rejects a missing address', async () => {
    const result = await server.notifySubscribe.call(fakeActionContext(), new FormData());
    expect(result.error?.code).toBe('BAD_REQUEST');
  });

  test('refuses JSON input because the action accepts forms', async () => {
    const result = await server.notifySubscribe.call(fakeActionContext(), { email: 'json@example.com' } as unknown as FormData);
    expect(result.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('NFR-6.2.5: the eleventh submission from one IP inside the hour is rejected', async () => {
    const limit = RATE_RULES['notify-ip'].limit;
    expect(limit).toBe(10);
    const ctx = fakeActionContext({ clientAddress: '203.0.113.11' });
    for (let i = 0; i < limit; i++) {
      const result = await server.notifySubscribe.call(ctx, form({ email: `burst-${i}@example.com` }));
      expect(result.error).toBeUndefined();
    }
    const eleventh = await server.notifySubscribe.call(ctx, form({ email: 'burst-11@example.com' }));
    expect(eleventh.error?.code).toBe('TOO_MANY_REQUESTS');
    expect(eleventh.error?.message).toMatch(/^Too many requests\. Try again in \d+ minutes?\.$/);
    expect(await readRow('burst-11@example.com')).toBeNull();
    // Another address behind the same IP is also refused; another IP is not.
    expect((await server.notifySubscribe.call(ctx, form({ email: 'burst-12@example.com' }))).error?.code).toBe('TOO_MANY_REQUESTS');
    const other = await server.notifySubscribe.call(fakeActionContext({ clientAddress: '203.0.113.12' }), form({ email: 'burst-12@example.com' }));
    expect(other.error).toBeUndefined();
  });
});

describe('notifyConfirm', () => {
  test('confirms a subscribed address with the mailed token', async () => {
    await server.notifySubscribe.call(fakeActionContext(), form({ email: 'confirm-action@example.com' }));
    const token = tokenOf(sent[0]!.links.confirm!);
    const result = await server.notifyConfirm.call(fakeActionContext(), { token });
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ ok: true, state: 'confirmed' });
    expect((await readRow('confirm-action@example.com'))!.confirmedAt).toBeInstanceOf(Date);
  });

  test('a token signed with the server secret works, a tampered one is invalid, nothing is thrown', async () => {
    await server.notifySubscribe.call(fakeActionContext(), form({ email: 'signed@example.com' }));
    const good = signToken({ p: 'confirm', e: 'signed@example.com', t: Date.now() }, secret());
    const bad = `${good.slice(0, -1)}${good.endsWith('A') ? 'B' : 'A'}`;
    expect((await server.notifyConfirm.call(fakeActionContext(), { token: bad })).data).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('signed@example.com'))!.confirmedAt).toBeNull();
    expect((await server.notifyConfirm.call(fakeActionContext(), { token: good })).data).toEqual({ ok: true, state: 'confirmed' });
  });

  test('an empty token fails the input check and FormData is refused', async () => {
    const empty = await server.notifyConfirm.call(fakeActionContext(), { token: '' });
    expect(empty.error?.code).toBe('BAD_REQUEST');
    const fd = await server.notifyConfirm.call(fakeActionContext(), form({ token: 'x' }) as unknown as { token: string });
    expect(fd.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('shares the token rate limit with notifyUnsubscribe per IP', async () => {
    const limit = RATE_RULES['notify-token-ip'].limit;
    expect(limit).toBe(30);
    const ctx = fakeActionContext({ clientAddress: '203.0.113.30' });
    const token = signToken({ p: 'confirm', e: 'nobody@example.com', t: Date.now() }, secret());
    const unsubscribeToken = signToken({ p: 'unsubscribe', e: 'nobody@example.com', t: Date.now() }, secret());
    for (let i = 0; i < limit - 1; i++) {
      expect((await server.notifyConfirm.call(ctx, { token })).data).toEqual({ ok: true, state: 'invalid' });
    }
    expect((await server.notifyUnsubscribe.call(ctx, { token: unsubscribeToken })).data).toEqual({ ok: true, state: 'unsubscribed' });
    const over = await server.notifyConfirm.call(ctx, { token });
    expect(over.error?.code).toBe('TOO_MANY_REQUESTS');
    expect((await server.notifyUnsubscribe.call(ctx, { token: unsubscribeToken })).error?.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('notifyUnsubscribe', () => {
  test('unsubscribes with the mailed token and never reveals membership', async () => {
    await server.notifySubscribe.call(fakeActionContext(), form({ email: 'leave-action@example.com' }));
    const token = tokenOf(sent[0]!.links.unsubscribe);
    const listed = await server.notifyUnsubscribe.call(fakeActionContext(), { token });
    expect(listed.error).toBeUndefined();
    expect(listed.data).toEqual({ ok: true, state: 'unsubscribed' });
    expect((await readRow('leave-action@example.com'))!.unsubscribedAt).toBeInstanceOf(Date);
    const ghost = signToken({ p: 'unsubscribe', e: 'ghost-action@example.com', t: Date.now() }, secret());
    expect(await server.notifyUnsubscribe.call(fakeActionContext(), { token: ghost })).toEqual(listed);
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect((await server.notifyUnsubscribe.call(fakeActionContext(), { token: tampered })).data).toEqual({ ok: true, state: 'invalid' });
  });
});

describe('Phase 1 actions', () => {
  test('markModuleComplete is still the NOT_IMPLEMENTED stub', async () => {
    const result = await server.markModuleComplete.call(fakeActionContext(), form({ moduleSlug: 'orientation' }));
    expect(result.error?.code).toBe('NOT_IMPLEMENTED');
  });

  test.todo('saveResponse: UNAUTHORIZED, NOT_FOUND, FORBIDDEN, 199 versus 200 characters, rate limits, stale session');
  test.todo('saveSelfCheck: unknown keys dropped, thirteen keys rejected, FORBIDDEN for orientation and closing');
  test.todo('saveSelfAssessment: missing ratings named, version increments');
  test.todo('updatePlanText: CONFLICT for an older version');
  test.todo('submitFeedback: anonymous insert, feedback-ip limit');
  test.todo('updateDisplayName: returns the new name');
  test.todo('deleteAccount: clears both session cookies');
});
