// src/actions/index.test.ts
// Fake-context tests per action (blueprint sections 7.3 and 12.1): result shapes, error codes, and the rate
// limits through the handlers. The library modules carry the detailed tests.
//
// Three mocks keep this file about the handlers (docs/decisions.md, 2026-10-03):
// - src/lib/modules is replaced by the fixture store in test/module-fixtures.ts, so the entry checks do not
//   depend on A's content work (every real module is still a draft while Phase 1 lands).
// - B's deleteLearner, updateDisplayName, and clearSessionCookies are spies that answer the section 6.6 and
//   6.3 contract shapes. The handler's job is to call them with the right arguments; B's own tests cover
//   what they do to rows and cookies.
// The database is the real PGlite through getDb(), so every other write is checked against the schema.
import { and, eq } from 'drizzle-orm';
import { isInputError } from 'astro:actions';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDb } from '../db';
import type { DbHandle } from '../db/client';
import { feedback, moduleProgress, notifySubscriber, selfCheckResult, user, workshopResponse } from '../db/schema';
import { deleteLearner, updateDisplayName } from '../lib/account';
import { SERVER_ERROR_MESSAGE } from '../lib/actions-guard';
import { getAssessment, listVersions } from '../lib/assessment';
import { clearSessionCookies } from '../lib/auth-cookies';
import { AREA_CONTENT_MAP, AREA_KEYS, CLOSING_SLUG, SELF_CHECK_MAX } from '../lib/content-schema';
import { env, requireEnv } from '../lib/env';
import { ASSESSMENT_ITEMS_MAX, DISPLAY_NAME_MAX_CHARS, FEEDBACK_MAX_CHARS, PLAN_TEXT_MAX_CHARS, RATE_RULES, WORKSHOP_MIN_CHARS } from '../lib/limits';
import { setMailerForTests, type Mailer, type OutboundMessage } from '../lib/mailer';
import { itemIds, type AssessmentContext } from '../lib/plan';
import { getProgress } from '../lib/progress';
import { signToken } from '../lib/tokens';
import { fakeActionContext } from '../../test/fake-action-context';
import { UNPUBLISHED_SLUG, failingAnswers, fixtureSpec, passingAnswers } from '../../test/module-fixtures';
import { server } from './index';

// test/fake-action-context.ts is the one place that names Astro's internal action-context symbol
// (decision 44); every action test, this file and index.failure.test.ts, imports it from there.

vi.mock('../lib/modules', async () => {
  const { fixtureModuleStore } = await import('../../test/module-fixtures');
  const store = fixtureModuleStore();
  return { ...store, getPublishedModule: vi.fn(store.getPublishedModule), getPublishedModules: vi.fn(store.getPublishedModules) };
});

vi.mock('../lib/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/account')>()),
  updateDisplayName: vi.fn(async (_db: unknown, _userId: string, name: string) => ({ name: name.trim() })),
  deleteLearner: vi.fn(async () => ({ deleted: true })),
}));

vi.mock('../lib/auth-cookies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth-cookies')>()),
  clearSessionCookies: vi.fn(),
}));

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

type Learner = NonNullable<App.Locals['user']>;
let learnerCount = 0;
/** Inserts a user row and returns the locals fixture the middleware would set. Each call is a fresh learner. */
async function learner(label = 'learner'): Promise<Learner> {
  const id = `${label}-${++learnerCount}`;
  const now = new Date();
  const row = { id, name: `Learner ${id}`, email: `${id}@example.com`, emailVerified: true, image: null, createdAt: now, updatedAt: now };
  await h.db.insert(user).values(row);
  return row as Learner;
}

let ipCount = 0;
/** A context for a signed-in learner at its own address, so the IP limiters do not couple tests. */
const signedIn = (u: Learner) => fakeActionContext({ user: u, clientAddress: `198.51.100.${++ipCount}` });

const BODY = 'w'.repeat(WORKSHOP_MIN_CHARS);
const responseRows = (userId: string, slug: string) =>
  h.db.select().from(workshopResponse).where(and(eq(workshopResponse.userId, userId), eq(workshopResponse.moduleSlug, slug)));
const checkRow = async (userId: string, slug: string) =>
  (await h.db.select().from(selfCheckResult).where(and(eq(selfCheckResult.userId, userId), eq(selfCheckResult.moduleSlug, slug))))[0] ?? null;

const SPEC = fixtureSpec();
function ratingsWhere(value: number, overrides: Record<string, number> = {}): Record<string, number> {
  const ratings: Record<string, number> = {};
  for (const id of itemIds(SPEC)) ratings[id] = value;
  return { ...ratings, ...overrides };
}
const learnerContext: AssessmentContext = { role: 'backend engineer', feature: 'the support triage bot', ownsSystem: 'yes' };
const AREA_SLUGS = AREA_KEYS.map((a) => AREA_CONTENT_MAP[a].slug);

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
  vi.mocked(deleteLearner).mockClear();
  vi.mocked(updateDisplayName).mockClear();
  vi.mocked(clearSessionCookies).mockClear();
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

describe('markModuleComplete', () => {
  test('UNAUTHORIZED without a session, and nothing is written', async () => {
    const result = await server.markModuleComplete.call(fakeActionContext(), form({ moduleSlug: 'orientation' }));
    expect(result.error?.code).toBe('UNAUTHORIZED');
    expect(result.error?.message).toBe('Sign in to save your work.');
  });

  test('completes orientation once and keeps the first completion date', async () => {
    const u = await learner('mark');
    const result = await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: 'orientation' }));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ status: 'completed' });
    const first = await getProgress(h.db, u.id, 'orientation');
    expect(first).toMatchObject({ status: 'completed' });
    expect(first!.startedAt).toBeInstanceOf(Date);
    expect(first!.completedAt).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 5));
    expect((await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: 'orientation' }))).data).toEqual({ status: 'completed' });
    expect(await getProgress(h.db, u.id, 'orientation')).toEqual(first);
  });

  test('NOT_FOUND for a draft or unknown module, FORBIDDEN for every other kind, BAD_REQUEST for a bad slug', async () => {
    const u = await learner('mark');
    expect((await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: UNPUBLISHED_SLUG }))).error?.code).toBe('NOT_FOUND');
    expect((await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: 'no-such-module' }))).error?.code).toBe('NOT_FOUND');
    for (const slug of ['models', 'foundations', CLOSING_SLUG, 'fine-tuning-and-adaptation']) {
      const result = await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: slug }));
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(result.error?.message).toContain('Only orientation');
    }
    expect((await server.markModuleComplete.call(signedIn(u), form({ moduleSlug: 'Bad Slug' }))).error?.code).toBe('BAD_REQUEST');
    expect((await server.markModuleComplete.call(signedIn(u), { moduleSlug: 'orientation' } as unknown as FormData)).error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await h.db.select().from(moduleProgress).where(eq(moduleProgress.userId, u.id))).toHaveLength(0);
  });
});

describe('saveResponse', () => {
  const save = (u: Learner, slug: string, kind: 'workshop' | 'failure', body: string, ctx = signedIn(u)) =>
    server.saveResponse.call(ctx, form({ moduleSlug: slug, kind, body }));

  test('UNAUTHORIZED without a session', async () => {
    const result = await server.saveResponse.call(fakeActionContext(), form({ moduleSlug: 'models', kind: 'workshop', body: BODY }));
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });

  test('BAD_REQUEST for a 199-character body, success for 200 (EC-5.5.1, CG-11)', async () => {
    const u = await learner('resp');
    const short = await save(u, 'models', 'workshop', 'w'.repeat(199));
    expect(short.error?.code).toBe('BAD_REQUEST');
    expect(isInputError(short.error)).toBe(true);
    if (isInputError(short.error)) expect(short.error.fields.body?.join(' ')).toContain('200');
    expect(await responseRows(u.id, 'models')).toHaveLength(0);
    expect(await getProgress(h.db, u.id, 'models')).toBeNull();

    const ok = await save(u, 'models', 'workshop', BODY);
    expect(ok.error).toBeUndefined();
    expect(ok.data).toMatchObject({ status: 'in_progress', revealed: false });
    expect(ok.data!.updatedAt).toBeInstanceOf(Date);
    expect((await responseRows(u.id, 'models'))[0]!.body).toBe(BODY);
    // The save touched started_at (AC-5.9.3) but did not complete the module without the self-check.
    const progress = await getProgress(h.db, u.id, 'models');
    expect(progress).toMatchObject({ status: 'in_progress', completedAt: null });
    expect(progress!.startedAt).toBeInstanceOf(Date);
  });

  test('a failure response reveals the explanation and leaves completion alone', async () => {
    const u = await learner('resp');
    const result = await save(u, 'models', 'failure', BODY);
    expect(result.data).toMatchObject({ status: 'in_progress', revealed: true });
    expect((await responseRows(u.id, 'models')).map((r) => r.kind)).toEqual(['failure']);
  });

  test('saving again replaces the text (AC-5.9.4)', async () => {
    const u = await learner('resp');
    await save(u, 'models', 'workshop', BODY);
    await save(u, 'models', 'workshop', `${BODY} edited`);
    const rows = await responseRows(u.id, 'models');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe(`${BODY} edited`);
  });

  test('NOT_FOUND for a draft or unknown module, FORBIDDEN where there is no workshop', async () => {
    const u = await learner('resp');
    expect((await save(u, UNPUBLISHED_SLUG, 'workshop', BODY)).error?.code).toBe('NOT_FOUND');
    expect((await save(u, 'no-such-module', 'workshop', BODY)).error?.code).toBe('NOT_FOUND');
    expect((await save(u, 'orientation', 'workshop', BODY)).error?.code).toBe('FORBIDDEN');
    expect((await save(u, CLOSING_SLUG, 'failure', BODY)).error?.code).toBe('FORBIDDEN');
    expect((await server.saveResponse.call(signedIn(u), form({ moduleSlug: 'models', kind: 'essay', body: BODY }))).error?.code).toBe('BAD_REQUEST');
    expect(await h.db.select().from(workshopResponse).where(eq(workshopResponse.userId, u.id))).toHaveLength(0);
    // Foundations and electives accept both kinds.
    expect((await save(u, 'foundations', 'workshop', BODY)).error).toBeUndefined();
    expect((await save(u, 'fine-tuning-and-adaptation', 'failure', BODY)).error).toBeUndefined();
  });

  test('completes the module once the self-check is passed, in either order (EC-5.5.2)', async () => {
    const a = await learner('order');
    expect((await server.saveSelfCheck.call(signedIn(a), { moduleSlug: 'models', answers: passingAnswers() })).data).toMatchObject({ passed: true, status: 'in_progress' });
    expect((await save(a, 'models', 'workshop', BODY)).data).toMatchObject({ status: 'completed' });
    expect(await getProgress(h.db, a.id, 'models')).toMatchObject({ status: 'completed' });

    const b = await learner('order');
    expect((await save(b, 'models', 'workshop', BODY)).data).toMatchObject({ status: 'in_progress' });
    expect((await server.saveSelfCheck.call(signedIn(b), { moduleSlug: 'models', answers: failingAnswers() })).data).toMatchObject({ passed: false, status: 'in_progress' });
    expect((await server.saveSelfCheck.call(signedIn(b), { moduleSlug: 'models', answers: passingAnswers() })).data).toMatchObject({ passed: true, status: 'completed' });
    expect((await getProgress(h.db, b.id, 'models'))!.completedAt).toBeInstanceOf(Date);
  });

  test('NFR-6.2.5: the account limit refuses the 31st write in the hour, another learner is unaffected', async () => {
    const limit = RATE_RULES['write-user'].limit;
    expect(limit).toBe(30);
    const u = await learner('limit');
    const ctx = signedIn(u);
    for (let i = 0; i < limit; i++) {
      const result = await save(u, AREA_SLUGS[i % AREA_SLUGS.length]!, i % 2 ? 'failure' : 'workshop', `${BODY} ${i}`, ctx);
      expect(result.error).toBeUndefined();
    }
    const over = await save(u, 'models', 'workshop', `${BODY} over`, ctx);
    expect(over.error?.code).toBe('TOO_MANY_REQUESTS');
    expect((await responseRows(u.id, 'models'))[0]!.body).not.toContain('over');
    // The same learner is also refused on another write action under the shared write-user rule.
    expect((await server.markModuleComplete.call(ctx, form({ moduleSlug: 'orientation' }))).error?.code).toBe('TOO_MANY_REQUESTS');
    const other = await learner('limit');
    expect((await save(other, 'models', 'workshop', BODY)).error).toBeUndefined();
  });

  test('NFR-6.2.5: the IP limit refuses the 61st write from one address across accounts', async () => {
    const limit = RATE_RULES['write-ip'].limit;
    expect(limit).toBe(60);
    const address = '203.0.113.60';
    const learners = [await learner('ip'), await learner('ip')];
    for (let i = 0; i < limit; i++) {
      const u = learners[i % 2]!;
      const result = await save(u, AREA_SLUGS[i % AREA_SLUGS.length]!, 'workshop', `${BODY} ${i}`, fakeActionContext({ user: u, clientAddress: address }));
      expect(result.error).toBeUndefined();
    }
    const third = await learner('ip');
    const over = await save(third, 'models', 'workshop', BODY, fakeActionContext({ user: third, clientAddress: address }));
    expect(over.error?.code).toBe('TOO_MANY_REQUESTS');
    expect(await responseRows(third.id, 'models')).toHaveLength(0);
  });

  test('EC-5.9.3: a write with a stale session fails closed after the account is deleted', async () => {
    const u = await learner('stale');
    await h.db.delete(user).where(eq(user.id, u.id));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await save(u, 'models', 'workshop', BODY);
      expect(result.data).toBeUndefined();
      expect(['INTERNAL_SERVER_ERROR', 'NOT_FOUND']).toContain(result.error?.code);
      if (result.error?.code === 'INTERNAL_SERVER_ERROR') expect(result.error.message).toBe(SERVER_ERROR_MESSAGE);
      expect(await responseRows(u.id, 'models')).toHaveLength(0);
      expect(await getProgress(h.db, u.id, 'models')).toBeNull();
    } finally {
      errors.mockRestore();
    }
  });
});

describe('saveSelfCheck', () => {
  const check = (u: Learner, slug: string, answers: Record<string, number[]>) => server.saveSelfCheck.call(signedIn(u), { moduleSlug: slug, answers });

  test('UNAUTHORIZED without a session, FormData refused', async () => {
    expect((await server.saveSelfCheck.call(fakeActionContext(), { moduleSlug: 'models', answers: {} })).error?.code).toBe('UNAUTHORIZED');
    const u = await learner('check');
    expect((await server.saveSelfCheck.call(signedIn(u), form({ moduleSlug: 'models' }) as unknown as { moduleSlug: string; answers: Record<string, number[]> })).error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('grades on the server: passed only when every question is correct, attempts count, passed sticks (AC-5.8.3)', async () => {
    const u = await learner('check');
    const wrong = await check(u, 'models', failingAnswers());
    expect(wrong.error).toBeUndefined();
    expect(wrong.data).toEqual({ passed: false, correct: 5, attempts: 1, status: 'in_progress' });
    const right = await check(u, 'models', passingAnswers());
    expect(right.data).toEqual({ passed: true, correct: 6, attempts: 2, status: 'in_progress' });
    const again = await check(u, 'models', failingAnswers());
    expect(again.data).toEqual({ passed: true, correct: 5, attempts: 3, status: 'in_progress' });
    const row = await checkRow(u.id, 'models');
    expect(row).toMatchObject({ attempts: 3, passed: true, answers: failingAnswers() });
    // A partial multi-select is wrong; the full set is right.
    expect((await check(u, 'models', { ...passingAnswers(), q6: [0] })).data).toMatchObject({ correct: 5 });
    expect((await check(u, 'models', { ...passingAnswers(), q6: [2, 0] })).data).toMatchObject({ correct: 6 });
  });

  test('unknown answer keys are dropped before persistence; thirteen keys are rejected', async () => {
    const u = await learner('check');
    const result = await check(u, 'models', { ...passingAnswers(), bogus: [1], 'another-one': [0, 1] });
    expect(result.data).toMatchObject({ passed: true, correct: 6 });
    expect((await checkRow(u.id, 'models'))!.answers).toEqual(passingAnswers());

    const thirteen = Object.fromEntries(Array.from({ length: SELF_CHECK_MAX + 1 }, (_, i) => [`q${i + 1}`, [0]]));
    const tooMany = await check(u, 'models', thirteen);
    expect(tooMany.error?.code).toBe('BAD_REQUEST');
    expect(isInputError(tooMany.error)).toBe(true);
    const twelve = Object.fromEntries(Array.from({ length: SELF_CHECK_MAX }, (_, i) => [`q${i + 1}`, [0]]));
    expect((await check(u, 'models', twelve)).error).toBeUndefined();
    expect((await check(u, 'models', { q1: [10] })).error?.code).toBe('BAD_REQUEST');
    expect((await check(u, 'models', { q1: [0, 1, 2, 3, 4, 5, 6] })).error?.code).toBe('BAD_REQUEST');
    expect((await check(u, 'models', { ['k'.repeat(41)]: [0] })).error?.code).toBe('BAD_REQUEST');
    // Two submits reached the database: the first and the twelve-key one. Every rejected input stopped at the schema.
    expect((await checkRow(u.id, 'models'))!.attempts).toBe(2);
  });

  test('NOT_FOUND for a draft or unknown module, FORBIDDEN for orientation and the closing module', async () => {
    const u = await learner('check');
    expect((await check(u, UNPUBLISHED_SLUG, passingAnswers())).error?.code).toBe('NOT_FOUND');
    expect((await check(u, 'no-such-module', passingAnswers())).error?.code).toBe('NOT_FOUND');
    const orientation = await check(u, 'orientation', { q1: [1] });
    expect(orientation.error?.code).toBe('FORBIDDEN');
    expect(orientation.error?.message).toContain('stays on this device');
    expect((await check(u, CLOSING_SLUG, {})).error?.code).toBe('FORBIDDEN');
    expect(await h.db.select().from(selfCheckResult).where(eq(selfCheckResult.userId, u.id))).toHaveLength(0);
    expect(await h.db.select().from(moduleProgress).where(eq(moduleProgress.userId, u.id))).toHaveLength(0);
    expect((await check(u, 'foundations', failingAnswers())).data).toMatchObject({ passed: false, attempts: 1 });
    expect((await check(u, 'fine-tuning-and-adaptation', passingAnswers())).data).toMatchObject({ passed: true, attempts: 1 });
  });
});

describe('saveSelfAssessment', () => {
  const assess = (u: Learner, ratings: Record<string, number>, ctx = learnerContext) => server.saveSelfAssessment.call(signedIn(u), { ratings, context: ctx });

  test('UNAUTHORIZED without a session', async () => {
    expect((await server.saveSelfAssessment.call(fakeActionContext(), { ratings: ratingsWhere(2), context: learnerContext })).error?.code).toBe('UNAUTHORIZED');
  });

  test('BAD_REQUEST names the first missing item; unknown ids do not count as ratings', async () => {
    const u = await learner('assess');
    const ratings = ratingsWhere(2);
    delete ratings['context-new-a'];
    const missing = await assess(u, { ...ratings, bogus: 3 });
    expect(missing.error?.code).toBe('BAD_REQUEST');
    expect(missing.error?.message).toContain('context-new-a');
    expect(missing.error?.message).toContain('Context and knowledge competency a');
    expect((await assess(u, { ...ratingsWhere(2), 'models-transfer': 4 })).error?.code).toBe('BAD_REQUEST');
    expect((await assess(u, ratingsWhere(2), { ...learnerContext, ownsSystem: 'maybe' as 'yes' })).error?.code).toBe('BAD_REQUEST');
    const tooMany = Object.fromEntries(Array.from({ length: ASSESSMENT_ITEMS_MAX + 1 }, (_, i) => [`item-${i}`, 1]));
    expect((await assess(u, tooMany)).error?.code).toBe('BAD_REQUEST');
    expect(await listVersions(h.db, u.id)).toEqual([]);
  });

  test('stores version 1 with the plan, ranks the lowest-rated area first, names missing modules, completes the closing module', async () => {
    const u = await learner('assess');
    const result = await assess(u, { ...ratingsWhere(3), 'models-new-a': 0, 'models-new-b': 0, 'evals-transfer': 1, 'extra-id': 2 });
    expect(result.error).toBeUndefined();
    const data = result.data!;
    expect(data.version).toBe(1);
    expect(data.createdAt).toBeInstanceOf(Date);
    expect(data.plan.kind).toBe('ranked');
    expect(data.plan.focus[0]!.area).toBe('models');
    expect(data.plan.focus[0]!.feature).toBe('the support triage bot');
    expect(data.plan.focus[0]!.steps.map((s) => s.title)).toEqual([
      'Look before you build.',
      'Start constrained.',
      'Own the harness.',
      'Add autonomy as your evals earn it.',
    ]);
    expect(data.plan.missingModules.map((m) => m.slug)).toEqual(AREA_SLUGS);
    expect(data.planText).toContain('# Your AI engineering plan');
    expect(data.planText).toContain('Applied to: the support triage bot');
    expect(data.planText).not.toContain('\u2014');
    const stored = await getAssessment(h.db, u.id);
    expect(stored!.version).toBe(1);
    expect(stored!.ratings).not.toHaveProperty('extra-id');
    expect(Object.keys(stored!.ratings).sort()).toEqual(itemIds(SPEC).sort());
    expect(stored!.context).toEqual(learnerContext);
    expect(stored!.planText).toBe(data.planText);
    expect(await getProgress(h.db, u.id, CLOSING_SLUG)).toMatchObject({ status: 'completed' });
  });

  test('a retake appends version 2, and a completed area module leaves the missing list (EC-5.10.2, AC-5.10.7)', async () => {
    const u = await learner('assess');
    expect((await assess(u, ratingsWhere(1))).data!.version).toBe(1);
    await server.saveResponse.call(signedIn(u), form({ moduleSlug: 'models', kind: 'workshop', body: BODY }));
    await server.saveSelfCheck.call(signedIn(u), { moduleSlug: 'models', answers: passingAnswers() });
    const retake = await assess(u, ratingsWhere(2));
    expect(retake.data!.version).toBe(2);
    expect(retake.data!.plan.missingModules.map((m) => m.slug)).toEqual(AREA_SLUGS.filter((s) => s !== 'models'));
    expect(retake.data!.plan.nextSteps.map((n) => n.text)).not.toContain('Complete Models');
    expect((await listVersions(h.db, u.id)).map((v) => v.version)).toEqual([2, 1]);
    expect((await getAssessment(h.db, u.id, 1))!.ratings['models-new-a']).toBe(1);
  });

  test('uniform high ratings give the uniform-high plan (EC-5.10.1)', async () => {
    const u = await learner('assess');
    const result = await assess(u, ratingsWhere(3), { role: '', feature: '', ownsSystem: 'no' });
    expect(result.data!.plan.kind).toBe('uniform-high');
    expect(result.data!.plan.focus).toEqual([]);
    expect(result.data!.plan.nextSteps.map((n) => n.href)).toContain('/modules#electives');
  });

  test('NOT_FOUND when the closing module is not published', async () => {
    const u = await learner('assess');
    const { getPublishedModule } = await import('../lib/modules');
    vi.mocked(getPublishedModule).mockResolvedValueOnce(null);
    const result = await assess(u, ratingsWhere(2));
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(await listVersions(h.db, u.id)).toEqual([]);
  });

  test('the assess-user limit refuses the eleventh plan in the hour', async () => {
    const limit = RATE_RULES['assess-user'].limit;
    expect(limit).toBe(10);
    const u = await learner('assess-limit');
    for (let i = 0; i < limit; i++) expect((await assess(u, ratingsWhere(i % 4))).error).toBeUndefined();
    expect((await assess(u, ratingsWhere(2))).error?.code).toBe('TOO_MANY_REQUESTS');
    expect(await listVersions(h.db, u.id)).toHaveLength(limit);
  });
});

describe('updatePlanText', () => {
  const edit = (u: Learner, version: number, planText: string) => server.updatePlanText.call(signedIn(u), { version, planText });

  test('UNAUTHORIZED without a session, NOT_FOUND without an assessment', async () => {
    expect((await server.updatePlanText.call(fakeActionContext(), { version: 1, planText: 'x' })).error?.code).toBe('UNAUTHORIZED');
    const u = await learner('plan');
    expect((await edit(u, 1, 'x')).error?.code).toBe('NOT_FOUND');
  });

  test('edits the latest version, CONFLICT for an older one, NOT_FOUND for a missing one', async () => {
    const u = await learner('plan');
    await server.saveSelfAssessment.call(signedIn(u), { ratings: ratingsWhere(1), context: learnerContext });
    await server.saveSelfAssessment.call(signedIn(u), { ratings: ratingsWhere(2), context: learnerContext });
    const older = await edit(u, 1, '# Old');
    expect(older.error?.code).toBe('CONFLICT');
    expect(older.error?.message).toContain('latest');
    const latest = await edit(u, 2, '# My plan\n\n<script>alert(1)</script> edited');
    expect(latest.error).toBeUndefined();
    expect(latest.data!.updatedAt).toBeInstanceOf(Date);
    expect((await getAssessment(h.db, u.id, 2))!.planText).toBe('# My plan\n\n<script>alert(1)</script> edited');
    expect((await getAssessment(h.db, u.id, 1))!.planText).toContain('# Your AI engineering plan');
    expect((await edit(u, 3, 'x')).error?.code).toBe('NOT_FOUND');
    expect((await edit(u, 0, 'x')).error?.code).toBe('BAD_REQUEST');
    expect((await edit(u, 2, 'x'.repeat(PLAN_TEXT_MAX_CHARS + 1))).error?.code).toBe('BAD_REQUEST');
    expect((await edit(u, 2, 'x'.repeat(PLAN_TEXT_MAX_CHARS))).error).toBeUndefined();
  });
});

describe('submitFeedback', () => {
  test('stores anonymous feedback without a session and returns { ok: true }', async () => {
    const before = (await h.db.select().from(feedback)).length;
    const result = await server.submitFeedback.call(fakeActionContext({ clientAddress: '203.0.113.70' }), form({ body: '  The failure exercise was the best part.  ' }));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ ok: true });
    const rows = await h.db.select().from(feedback);
    expect(rows).toHaveLength(before + 1);
    expect(rows[rows.length - 1]!.body).toBe('The failure exercise was the best part.');
    expect(Object.keys(rows[rows.length - 1]!).sort()).toEqual(['body', 'createdAt', 'id']);
  });

  test('BAD_REQUEST for an empty or oversized body, JSON refused', async () => {
    const ctx = fakeActionContext({ clientAddress: '203.0.113.71' });
    const empty = await server.submitFeedback.call(ctx, form({ body: '   ' }));
    expect(empty.error?.code).toBe('BAD_REQUEST');
    expect(isInputError(empty.error)).toBe(true);
    expect((await server.submitFeedback.call(ctx, new FormData())).error?.code).toBe('BAD_REQUEST');
    expect((await server.submitFeedback.call(ctx, form({ body: 'x'.repeat(FEEDBACK_MAX_CHARS + 1) }))).error?.code).toBe('BAD_REQUEST');
    expect((await server.submitFeedback.call(ctx, { body: 'json' } as unknown as FormData)).error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('the feedback-ip limit refuses the sixth message from one address in the hour', async () => {
    const limit = RATE_RULES['feedback-ip'].limit;
    expect(limit).toBe(5);
    const ctx = fakeActionContext({ clientAddress: '203.0.113.72' });
    for (let i = 0; i < limit; i++) expect((await server.submitFeedback.call(ctx, form({ body: `note ${i}` }))).error).toBeUndefined();
    expect((await server.submitFeedback.call(ctx, form({ body: 'note over' }))).error?.code).toBe('TOO_MANY_REQUESTS');
    expect((await h.db.select().from(feedback)).map((r) => r.body)).not.toContain('note over');
    expect((await server.submitFeedback.call(fakeActionContext({ clientAddress: '203.0.113.73' }), form({ body: 'note other' }))).error).toBeUndefined();
  });
});

describe('updateDisplayName', () => {
  test('UNAUTHORIZED without a session', async () => {
    expect((await server.updateDisplayName.call(fakeActionContext(), form({ name: 'Ada' }))).error?.code).toBe('UNAUTHORIZED');
    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  test('passes the trimmed name to the account library and returns it', async () => {
    const u = await learner('name');
    const result = await server.updateDisplayName.call(signedIn(u), form({ name: '  Ada Lovelace  ' }));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: 'Ada Lovelace' });
    expect(updateDisplayName).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateDisplayName).mock.calls[0]![0]).toBe(h.db);
    expect(vi.mocked(updateDisplayName).mock.calls[0]!.slice(1)).toEqual([u.id, 'Ada Lovelace']);
  });

  test('BAD_REQUEST for an empty or long name, NOT_FOUND when the account row is gone', async () => {
    const u = await learner('name');
    expect((await server.updateDisplayName.call(signedIn(u), form({ name: '   ' }))).error?.code).toBe('BAD_REQUEST');
    expect((await server.updateDisplayName.call(signedIn(u), form({ name: 'n'.repeat(DISPLAY_NAME_MAX_CHARS + 1) }))).error?.code).toBe('BAD_REQUEST');
    expect((await server.updateDisplayName.call(signedIn(u), form({ name: 'n'.repeat(DISPLAY_NAME_MAX_CHARS) }))).error).toBeUndefined();
    vi.mocked(updateDisplayName).mockResolvedValueOnce(null);
    const gone = await server.updateDisplayName.call(signedIn(u), form({ name: 'Ada' }));
    expect(gone.error?.code).toBe('NOT_FOUND');
  });
});

describe('deleteAccount', () => {
  test('UNAUTHORIZED without a session, nothing deleted', async () => {
    expect((await server.deleteAccount.call(fakeActionContext(), form({ confirm: 'delete' }))).error?.code).toBe('UNAUTHORIZED');
    expect(deleteLearner).not.toHaveBeenCalled();
    expect(clearSessionCookies).not.toHaveBeenCalled();
  });

  test('BAD_REQUEST unless the hidden field says delete', async () => {
    const u = await learner('delete');
    expect((await server.deleteAccount.call(signedIn(u), form({ confirm: 'yes' }))).error?.code).toBe('BAD_REQUEST');
    expect((await server.deleteAccount.call(signedIn(u), new FormData())).error?.code).toBe('BAD_REQUEST');
    expect(deleteLearner).not.toHaveBeenCalled();
  });

  test('deletes through deleteLearner, clears the session cookies on the response, and names the redirect target', async () => {
    const u = await learner('delete');
    const ctx = signedIn(u);
    const result = await server.deleteAccount.call(ctx, form({ confirm: 'delete' }));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ deleted: true, redirectTo: '/account/deleted' });
    expect(deleteLearner).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteLearner).mock.calls[0]![0]).toBe(h.db);
    expect(vi.mocked(deleteLearner).mock.calls[0]![1]).toBe(u.id);
    expect(clearSessionCookies).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clearSessionCookies).mock.calls[0]![0]).toBe(ctx.cookies);
  });

  test('a missing account still clears the cookies and reports deleted: false', async () => {
    const u = await learner('delete');
    vi.mocked(deleteLearner).mockResolvedValueOnce({ deleted: false });
    const result = await server.deleteAccount.call(signedIn(u), form({ confirm: 'delete' }));
    expect(result.data).toEqual({ deleted: false, redirectTo: '/account/deleted' });
    expect(clearSessionCookies).toHaveBeenCalledTimes(1);
  });

  test('the delete-user limit refuses the fourth attempt in the hour', async () => {
    const limit = RATE_RULES['delete-user'].limit;
    expect(limit).toBe(3);
    const u = await learner('delete-limit');
    for (let i = 0; i < limit; i++) expect((await server.deleteAccount.call(signedIn(u), form({ confirm: 'delete' }))).error).toBeUndefined();
    expect((await server.deleteAccount.call(signedIn(u), form({ confirm: 'delete' }))).error?.code).toBe('TOO_MANY_REQUESTS');
    expect(deleteLearner).toHaveBeenCalledTimes(limit);
  });
});
