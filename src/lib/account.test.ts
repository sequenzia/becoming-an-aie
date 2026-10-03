// src/lib/account.test.ts
// Blueprint section 6.6 on PGlite: loadLearnerData, updateDisplayName, deleteLearner with its cascades and the
// subscriber removal, and the fail-closed insert for a deleted learner. Matrix rows AC-5.9.5, EC-5.9.2, EC-5.9.3.
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { account, moduleProgress, notifySubscriber, selfAssessment, selfCheckResult, session, user, workshopResponse } from '../db/schema';
import type { Plan } from './plan';
import { deleteLearner, loadLearnerData, updateDisplayName } from './account';

const T0 = new Date('2026-09-16T09:00:00Z');
const T1 = new Date('2026-09-17T09:00:00Z');
const T2 = new Date('2026-09-18T09:00:00Z');
const FAR = new Date('2027-01-01T00:00:00Z');
const INJECTION = '<script>alert(1)</script> **bold** [x](y)';

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
});

afterAll(async () => {
  await h.close();
});

const plan: Plan = {
  schema: 1,
  generatedAt: T1.toISOString(),
  kind: 'ranked',
  context: { role: 'Backend engineer', feature: 'Search', ownsSystem: 'partly' },
  intro: 'Start step 1 on Search.',
  areas: [],
  focus: [],
  nextSteps: [],
  missingModules: [],
};

/** A learner with one row in every table that stores learner data, plus a subscriber row for the same address. */
async function seedLearner(id: string, email: string, subscriberEmail: string, emailVerified = true) {
  await h.db.insert(user).values({ id, name: 'Ada Lovelace', email, emailVerified, image: null, createdAt: T0, updatedAt: T0 });
  await h.db.insert(session).values({ id: `s-${id}`, token: `tok-${id}`, userId: id, expiresAt: FAR, createdAt: T0, updatedAt: T0 });
  await h.db.insert(account).values({ id: `a-${id}`, accountId: `gh-${id}`, providerId: 'github', userId: id, createdAt: T0, updatedAt: T0 });
  await h.db.insert(moduleProgress).values([
    { userId: id, moduleSlug: 'orientation', status: 'completed', startedAt: T0, completedAt: T0 },
    { userId: id, moduleSlug: 'models', status: 'in_progress', startedAt: T1, completedAt: null },
  ]);
  await h.db.insert(workshopResponse).values([
    { userId: id, moduleSlug: 'models', kind: 'failure', body: 'The loop had no stop condition.', createdAt: T1, updatedAt: T2 },
    { userId: id, moduleSlug: 'models', kind: 'workshop', body: INJECTION, createdAt: T1, updatedAt: T1 },
  ]);
  await h.db.insert(selfCheckResult).values({ userId: id, moduleSlug: 'models', attempts: 2, passed: true, answers: { q1: [0] }, updatedAt: T2 });
  await h.db.insert(selfAssessment).values([
    { userId: id, version: 2, ratings: { 'models-testing': 3 }, context: plan.context, plan, planText: '# Plan v2', createdAt: T2, updatedAt: T2 },
    { userId: id, version: 1, ratings: { 'models-testing': 1 }, context: plan.context, plan, planText: '# Plan v1', createdAt: T1, updatedAt: T1 },
  ]);
  await h.db.insert(notifySubscriber).values({ email: subscriberEmail, createdAt: T0 }).onConflictDoNothing();
}

async function countWhere<T extends { userId: unknown }>(table: typeof moduleProgress | typeof workshopResponse | typeof selfCheckResult | typeof selfAssessment | typeof session | typeof account, userId: string) {
  const [row] = await h.db.select({ n: count() }).from(table).where(eq(table.userId, userId));
  return Number(row!.n);
}

describe('loadLearnerData', () => {
  test('null for an unknown user', async () => {
    expect(await loadLearnerData(h.db, 'nobody')).toBeNull();
  });

  test('every table, in plain shape, ordered by module slug or by version', async () => {
    await seedLearner('u-load', 'load@example.com', 'load@example.com');
    const data = await loadLearnerData(h.db, 'u-load');
    expect(data).not.toBeNull();
    expect(data!.profile).toEqual({ name: 'Ada Lovelace', email: 'load@example.com', createdAt: T0, providers: ['github'] });
    expect(data!.sessions).toEqual([{ id: 's-u-load', createdAt: T0, expiresAt: FAR }]);
    expect(data!.notify).toEqual({ createdAt: T0, confirmedAt: null, unsubscribedAt: null });
    expect(data!.progress).toEqual([
      { moduleSlug: 'models', status: 'in_progress', startedAt: T1, completedAt: null },
      { moduleSlug: 'orientation', status: 'completed', startedAt: T0, completedAt: T0 },
    ]);
    // kind sorts in the enum's declaration order (workshop, then failure), which is the module template's order.
    expect(data!.responses).toEqual([
      { moduleSlug: 'models', kind: 'workshop', body: INJECTION, updatedAt: T1 },
      { moduleSlug: 'models', kind: 'failure', body: 'The loop had no stop condition.', updatedAt: T2 },
    ]);
    expect(data!.selfChecks).toEqual([{ moduleSlug: 'models', attempts: 2, passed: true, updatedAt: T2 }]);
    expect(data!.assessments.map((a) => a.version)).toEqual([1, 2]);
    expect(data!.assessments[0]).toEqual({
      version: 1,
      createdAt: T1,
      context: { role: 'Backend engineer', feature: 'Search', ownsSystem: 'partly' },
      ratings: { 'models-testing': 1 },
      planText: '# Plan v1',
    });
  });

  test('lists each provider once', async () => {
    await seedLearner('u-two', 'two@example.com', 'two@example.com');
    await h.db.insert(account).values({ id: 'a-two-google', accountId: 'sub-two', providerId: 'google', userId: 'u-two', createdAt: T1, updatedAt: T1 });
    expect((await loadLearnerData(h.db, 'u-two'))!.profile.providers).toEqual(['github', 'google']);
  });

  test('finds the notify row under the lowercased email, lists every session, and reports none of either', async () => {
    // The user row keeps the provider's casing; notify.ts stores the address lowercased (the deleteLearner match).
    await seedLearner('u-case', 'Case.Learner@Example.com', 'case.learner@example.com');
    await h.db.update(notifySubscriber).set({ confirmedAt: T1, unsubscribedAt: T2 }).where(eq(notifySubscriber.email, 'case.learner@example.com'));
    await h.db.insert(session).values({ id: 's-u-case-2', token: 'tok-u-case-2', userId: 'u-case', expiresAt: FAR, createdAt: T1, updatedAt: T1 });
    const data = await loadLearnerData(h.db, 'u-case');
    expect(data!.notify).toEqual({ createdAt: T0, confirmedAt: T1, unsubscribedAt: T2 });
    expect(data!.sessions.map((s) => s.id)).toEqual(['s-u-case', 's-u-case-2']);

    await h.db.insert(user).values({ id: 'u-bare', name: 'Bare', email: 'bare@example.com', emailVerified: true, image: null, createdAt: T0, updatedAt: T0 });
    const bare = await loadLearnerData(h.db, 'u-bare');
    expect(bare!.sessions).toEqual([]);
    expect(bare!.notify).toBeNull();
  });

  test('an unverified email never reads the notify row stored under it (Phase 1 review round 2)', async () => {
    // The sign-in refuses an unverified address (src/lib/auth.ts); this is the second line. Such a row, if it ever
    // existed, must not expose whether the address is on the launch list.
    await seedLearner('u-unverified', 'victim@example.com', 'victim@example.com', false);
    const data = await loadLearnerData(h.db, 'u-unverified');
    expect(data!.profile.email).toBe('victim@example.com');
    expect(data!.notify).toBeNull();
    expect(await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, 'victim@example.com'))).toHaveLength(1);
  });
});

describe('updateDisplayName (EC-5.9.2)', () => {
  test('trims and stores the new name and returns it', async () => {
    await seedLearner('u-name', 'name@example.com', 'name@example.com');
    expect(await updateDisplayName(h.db, 'u-name', '  Ada L.  ')).toEqual({ name: 'Ada L.' });
    const [row] = await h.db.select({ name: user.name, accountId: account.accountId }).from(user).innerJoin(account, eq(account.userId, user.id)).where(eq(user.id, 'u-name'));
    expect(row).toEqual({ name: 'Ada L.', accountId: 'gh-u-name' });
  });

  test('null when no user row matched', async () => {
    expect(await updateDisplayName(h.db, 'nobody', 'Ghost')).toBeNull();
  });
});

describe('deleteLearner (AC-5.9.5, CG-9)', () => {
  test('removes the user with every cascade and the subscriber row with the same email, and nothing else', async () => {
    // The user row keeps the provider's casing; the subscriber row is stored lowercased (notify.ts).
    await seedLearner('u-del', 'Del.Learner@Example.com', 'del.learner@example.com');
    await seedLearner('u-keep', 'keep@example.com', 'keep@example.com');

    expect(await deleteLearner(h.db, 'u-del')).toEqual({ deleted: true });

    expect(await h.db.select().from(user).where(eq(user.id, 'u-del'))).toHaveLength(0);
    for (const table of [session, account, moduleProgress, workshopResponse, selfCheckResult, selfAssessment]) {
      expect(await countWhere(table, 'u-del')).toBe(0);
    }
    expect(await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, 'del.learner@example.com'))).toHaveLength(0);

    // The other learner and the other subscriber are untouched.
    expect(await h.db.select().from(user).where(eq(user.id, 'u-keep'))).toHaveLength(1);
    for (const table of [session, account]) expect(await countWhere(table, 'u-keep')).toBe(1);
    expect(await countWhere(moduleProgress, 'u-keep')).toBe(2);
    expect(await countWhere(workshopResponse, 'u-keep')).toBe(2);
    expect(await countWhere(selfCheckResult, 'u-keep')).toBe(1);
    expect(await countWhere(selfAssessment, 'u-keep')).toBe(2);
    expect(await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, 'keep@example.com'))).toHaveLength(1);
  });

  test('an unverified email leaves the subscriber row in place while the account is still removed', async () => {
    await seedLearner('u-del-unverified', 'target@example.com', 'target@example.com', false);
    expect(await deleteLearner(h.db, 'u-del-unverified')).toEqual({ deleted: true });
    expect(await h.db.select().from(user).where(eq(user.id, 'u-del-unverified'))).toHaveLength(0);
    expect(await countWhere(session, 'u-del-unverified')).toBe(0);
    expect(await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, 'target@example.com'))).toHaveLength(1);
  });

  test('a second call, or an unknown user, deletes nothing and says so', async () => {
    expect(await deleteLearner(h.db, 'u-del')).toEqual({ deleted: false });
    expect(await deleteLearner(h.db, 'nobody')).toEqual({ deleted: false });
  });

  test('EC-5.9.3: a write for a deleted learner fails closed on the foreign key', async () => {
    await seedLearner('u-race', 'race@example.com', 'race@example.com');
    await deleteLearner(h.db, 'u-race');
    await expect(
      h.db.insert(workshopResponse).values({ userId: 'u-race', moduleSlug: 'models', kind: 'workshop', body: 'late save' }),
    ).rejects.toThrow();
    expect(await countWhere(workshopResponse, 'u-race')).toBe(0);
  });
});
