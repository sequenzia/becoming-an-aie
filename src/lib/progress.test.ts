// src/lib/progress.test.ts
// Blueprint section 7.4 on PGlite: touchStarted, completeModule, evaluateCompletion in both orders (EC-5.5.2),
// status derivation, orientation and closing untouched, startedAt on first write and completedAt on
// completion (AC-5.9.3, CG-22).
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { moduleProgress, user } from '../db/schema';
import { EVIDENCE_KINDS, completeModule, evaluateCompletion, getProgress, listProgress, loadModuleState, statusOf, touchStarted } from './progress';
import { saveResponse } from './responses';
import { recordSelfCheck } from './self-check-store';

const T0 = new Date('2026-09-16T09:00:00Z');
const T1 = new Date('2026-09-16T10:00:00Z');
const T2 = new Date('2026-09-17T09:00:00Z');
const BODY = 'x'.repeat(200);

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
});

afterAll(async () => {
  await h.close();
});

async function learner(id: string): Promise<string> {
  await h.db.insert(user).values({ id, name: `Learner ${id}`, email: `${id}@example.com`, emailVerified: true, createdAt: T0, updatedAt: T0 });
  return id;
}

const stored = async (userId: string, slug: string) =>
  (await h.db.select().from(moduleProgress).where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleSlug, slug))))[0] ?? null;

describe('statusOf', () => {
  test('derives the display status from the row', () => {
    expect(statusOf(null)).toBe('not_started');
    expect(statusOf({ completedAt: null })).toBe('in_progress');
    expect(statusOf({ completedAt: T0 })).toBe('completed');
  });

  test('evidence kinds are area, foundations, and elective', () => {
    expect([...EVIDENCE_KINDS].sort()).toEqual(['area', 'elective', 'foundations']);
  });
});

describe('touchStarted (CG-22, AC-5.9.3)', () => {
  test('creates an in_progress row with startedAt on the first write and leaves it alone afterwards', async () => {
    const u = await learner('touch-1');
    expect(await getProgress(h.db, u, 'models')).toBeNull();
    await touchStarted(h.db, u, 'models', T0);
    expect(await getProgress(h.db, u, 'models')).toEqual({ status: 'in_progress', startedAt: T0, completedAt: null });
    await touchStarted(h.db, u, 'models', T1);
    expect((await stored(u, 'models'))!.startedAt).toEqual(T0);
    expect(await h.db.select().from(moduleProgress).where(eq(moduleProgress.userId, u))).toHaveLength(1);
  });

  test('never downgrades a completed row', async () => {
    const u = await learner('touch-2');
    await completeModule(h.db, u, 'orientation', T0);
    await touchStarted(h.db, u, 'orientation', T1);
    expect(await getProgress(h.db, u, 'orientation')).toEqual({ status: 'completed', startedAt: T0, completedAt: T0 });
  });
});

describe('completeModule', () => {
  test('sets completed with startedAt and completedAt on a new row', async () => {
    const u = await learner('complete-1');
    await completeModule(h.db, u, 'orientation', T1);
    const row = await stored(u, 'orientation');
    expect(row!.status).toBe('completed');
    expect(row!.startedAt).toEqual(T1);
    expect(row!.completedAt).toEqual(T1);
  });

  test('keeps the existing startedAt and the first completedAt', async () => {
    const u = await learner('complete-2');
    await touchStarted(h.db, u, 'models', T0);
    await completeModule(h.db, u, 'models', T1);
    expect(await getProgress(h.db, u, 'models')).toEqual({ status: 'completed', startedAt: T0, completedAt: T1 });
    await completeModule(h.db, u, 'models', T2);
    expect(await getProgress(h.db, u, 'models')).toEqual({ status: 'completed', startedAt: T0, completedAt: T1 });
  });
});

describe('evaluateCompletion (EC-5.5.2, MT-5.5.7)', () => {
  test('self-check passed first, then the workshop response, completes the module', async () => {
    const u = await learner('order-1');
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T0)).toBe('not_started');
    await recordSelfCheck(h.db, u, 'models', { q1: [0] }, true);
    await touchStarted(h.db, u, 'models', T0);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T0)).toBe('in_progress');
    expect((await stored(u, 'models'))!.completedAt).toBeNull();
    await saveResponse(h.db, u, 'models', 'workshop', BODY);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T1)).toBe('completed');
    expect(await getProgress(h.db, u, 'models')).toEqual({ status: 'completed', startedAt: T0, completedAt: T1 });
  });

  test('workshop response first, then the self-check pass, completes the module', async () => {
    const u = await learner('order-2');
    await saveResponse(h.db, u, 'models', 'workshop', BODY);
    await touchStarted(h.db, u, 'models', T0);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T0)).toBe('in_progress');
    await recordSelfCheck(h.db, u, 'models', { q1: [0] }, false);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T0)).toBe('in_progress');
    await recordSelfCheck(h.db, u, 'models', { q1: [1] }, true);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T1)).toBe('completed');
    expect((await stored(u, 'models'))!.completedAt).toEqual(T1);
  });

  test('a failure response is not workshop evidence', async () => {
    const u = await learner('order-3');
    await saveResponse(h.db, u, 'models', 'failure', BODY);
    await recordSelfCheck(h.db, u, 'models', { q1: [0] }, true);
    await touchStarted(h.db, u, 'models', T0);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T1)).toBe('in_progress');
  });

  test('foundations and electives follow the same rule', async () => {
    const u = await learner('order-4');
    for (const [slug, kind] of [['foundations', 'foundations'], ['fine-tuning-and-adaptation', 'elective']] as const) {
      await saveResponse(h.db, u, slug, 'workshop', BODY);
      await recordSelfCheck(h.db, u, slug, { q1: [0] }, true);
      expect(await evaluateCompletion(h.db, u, slug, kind, T1)).toBe('completed');
    }
  });

  test('orientation and closing are returned as they are, never completed here', async () => {
    const u = await learner('order-5');
    expect(await evaluateCompletion(h.db, u, 'orientation', 'orientation', T0)).toBe('not_started');
    await touchStarted(h.db, u, 'self-assessment', T0);
    expect(await evaluateCompletion(h.db, u, 'self-assessment', 'closing', T1)).toBe('in_progress');
    // Even with both pieces of evidence present, these kinds do not complete through the rule.
    await saveResponse(h.db, u, 'orientation', 'workshop', BODY);
    await recordSelfCheck(h.db, u, 'orientation', { q1: [0] }, true);
    expect(await evaluateCompletion(h.db, u, 'orientation', 'orientation', T1)).toBe('not_started');
    expect(await stored(u, 'orientation')).toBeNull();
  });

  test('a completed row stays completed with its first completedAt', async () => {
    const u = await learner('order-6');
    await saveResponse(h.db, u, 'models', 'workshop', BODY);
    await recordSelfCheck(h.db, u, 'models', { q1: [0] }, true);
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T1)).toBe('completed');
    expect(await evaluateCompletion(h.db, u, 'models', 'area', T2)).toBe('completed');
    expect((await stored(u, 'models'))!.completedAt).toEqual(T1);
  });
});

describe('listProgress and loadModuleState', () => {
  test('lists every row of the learner keyed by slug and nothing of another learner', async () => {
    const u = await learner('list-1');
    const other = await learner('list-2');
    await touchStarted(h.db, u, 'models', T0);
    await completeModule(h.db, u, 'orientation', T1);
    await touchStarted(h.db, other, 'context-and-knowledge', T0);
    expect(await listProgress(h.db, u)).toEqual({
      models: { status: 'in_progress', startedAt: T0, completedAt: null },
      orientation: { status: 'completed', startedAt: T1, completedAt: T1 },
    });
    expect(await listProgress(h.db, 'nobody')).toEqual({});
  });

  test('loadModuleState returns the four rows for the module and every progress row', async () => {
    const u = await learner('state-1');
    expect(await loadModuleState(h.db, u, 'models')).toEqual({ progress: null, workshop: null, failure: null, selfCheck: null, progressBySlug: {} });
    await touchStarted(h.db, u, 'foundations', T0);
    const { updatedAt } = await saveResponse(h.db, u, 'models', 'workshop', BODY);
    await saveResponse(h.db, u, 'models', 'failure', `${BODY} failure`);
    await recordSelfCheck(h.db, u, 'models', { q1: [0, 2] }, false);
    await touchStarted(h.db, u, 'models', T1);
    const state = await loadModuleState(h.db, u, 'models');
    expect(state.progress).toEqual({ status: 'in_progress', startedAt: T1, completedAt: null });
    expect(state.workshop).toEqual({ body: BODY, updatedAt });
    expect(state.failure!.body).toBe(`${BODY} failure`);
    expect(state.selfCheck).toMatchObject({ answers: { q1: [0, 2] }, attempts: 1, passed: false });
    expect(state.selfCheck!.updatedAt).toBeInstanceOf(Date);
    expect(Object.keys(state.progressBySlug).sort()).toEqual(['foundations', 'models']);
  });
});
