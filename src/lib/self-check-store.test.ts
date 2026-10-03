// src/lib/self-check-store.test.ts
// Blueprint section 12.1 and decision 20: attempts increment, passed sticks, answers replaced (AC-5.8.3,
// EC-5.8.2).
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { selfCheckResult, user } from '../db/schema';
import { recordSelfCheck } from './self-check-store';

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
  await h.db.insert(user).values([
    { id: 's-1', name: 'One', email: 's-1@example.com', emailVerified: true, updatedAt: new Date() },
    { id: 's-2', name: 'Two', email: 's-2@example.com', emailVerified: true, updatedAt: new Date() },
  ]);
});

afterAll(async () => {
  await h.close();
});

const row = async (userId: string, slug: string) =>
  (await h.db.select().from(selfCheckResult).where(and(eq(selfCheckResult.userId, userId), eq(selfCheckResult.moduleSlug, slug))))[0] ?? null;

describe('recordSelfCheck', () => {
  test('the first submit creates the row with attempts 1 and the given answers', async () => {
    const result = await recordSelfCheck(h.db, 's-1', 'models', { q1: [0], q2: [1, 2] }, false);
    expect(result).toEqual({ attempts: 1, passed: false });
    const stored = await row('s-1', 'models');
    expect(stored).toMatchObject({ attempts: 1, passed: false, answers: { q1: [0], q2: [1, 2] } });
    expect(stored!.updatedAt).toBeInstanceOf(Date);
  });

  test('every submit increments attempts and replaces the answers', async () => {
    expect(await recordSelfCheck(h.db, 's-1', 'models', { q1: [1] }, false)).toEqual({ attempts: 2, passed: false });
    expect(await recordSelfCheck(h.db, 's-1', 'models', { q1: [2], q3: [0] }, false)).toEqual({ attempts: 3, passed: false });
    expect((await row('s-1', 'models'))!.answers).toEqual({ q1: [2], q3: [0] });
    expect(await h.db.select().from(selfCheckResult).where(eq(selfCheckResult.userId, 's-1'))).toHaveLength(1);
  });

  test('passed becomes true when the submit passes and stays true on a later failing submit', async () => {
    expect(await recordSelfCheck(h.db, 's-1', 'models', { q1: [0] }, true)).toEqual({ attempts: 4, passed: true });
    expect(await recordSelfCheck(h.db, 's-1', 'models', { q1: [1] }, false)).toEqual({ attempts: 5, passed: true });
    expect((await row('s-1', 'models'))!.answers).toEqual({ q1: [1] });
  });

  test('a first submit that passes stores passed true', async () => {
    expect(await recordSelfCheck(h.db, 's-2', 'evals', {}, true)).toEqual({ attempts: 1, passed: true });
  });

  test('rows are keyed by learner and module slug', async () => {
    await recordSelfCheck(h.db, 's-2', 'models', { q1: [0] }, false);
    expect((await row('s-2', 'models'))!.attempts).toBe(1);
    expect((await row('s-1', 'models'))!.attempts).toBe(5);
    expect(await row('s-2', 'context-and-knowledge')).toBeNull();
  });

  test('a row needs an existing learner (fail closed, EC-5.9.3)', async () => {
    await expect(recordSelfCheck(h.db, 'ghost', 'models', {}, false)).rejects.toThrow();
  });
});
