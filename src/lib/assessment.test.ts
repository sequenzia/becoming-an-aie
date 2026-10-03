// src/lib/assessment.test.ts
// Blueprint section 12.1: version increments in a transaction, latest editable only, getAssessment by
// version, missing modules (CG-18, EC-5.10.2, AC-5.10.7, decision 22).
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { selfAssessment, user } from '../db/schema';
import { fixtureSpec } from '../../test/module-fixtures';
import { getAssessment, listVersions, missingModules, saveAssessment, updatePlanText } from './assessment';
import { AREA_CONTENT_MAP, AREA_KEYS } from './content-schema';
import { buildPlan, itemIds, renderPlanMarkdown, type AssessmentContext, type Plan, type Ratings } from './plan';

const NOW = new Date('2026-09-16T09:00:00Z');
const context: AssessmentContext = { role: 'backend engineer', feature: 'the support triage bot', ownsSystem: 'yes' };

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
  await h.db.insert(user).values([
    { id: 'a-1', name: 'One', email: 'a-1@example.com', emailVerified: true, updatedAt: NOW },
    { id: 'a-2', name: 'Two', email: 'a-2@example.com', emailVerified: true, updatedAt: NOW },
  ]);
});

afterAll(async () => {
  await h.close();
});

function ratingsWhere(value: number, overrides: Record<string, number> = {}): Ratings {
  const ratings: Ratings = {};
  for (const id of itemIds(fixtureSpec())) ratings[id] = value;
  return { ...ratings, ...overrides };
}

function input(ratings: Ratings, planText?: string): { ratings: Ratings; context: AssessmentContext; plan: Plan; planText: string } {
  const plan = buildPlan(fixtureSpec(), ratings, context, [], NOW);
  return { ratings, context, plan, planText: planText ?? renderPlanMarkdown(plan, 'http://localhost:4321') };
}

describe('saveAssessment (CG-18, EC-5.10.2)', () => {
  test('the first save is version 1 and every later save appends the next version', async () => {
    const first = await saveAssessment(h.db, 'a-1', input(ratingsWhere(2)));
    expect(first.version).toBe(1);
    expect(first.createdAt).toBeInstanceOf(Date);
    const second = await saveAssessment(h.db, 'a-1', input(ratingsWhere(3, { 'models-new-a': 0 })));
    expect(second.version).toBe(2);
    const rows = await h.db.select().from(selfAssessment).where(eq(selfAssessment.userId, 'a-1'));
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
    expect(rows.find((r) => r.version === 2)!.plan.focus[0]!.area).toBe('models');
    expect(rows.find((r) => r.version === 2)!.context).toEqual(context);
  });

  test('versions are per learner', async () => {
    expect((await saveAssessment(h.db, 'a-2', input(ratingsWhere(1)))).version).toBe(1);
    expect((await saveAssessment(h.db, 'a-1', input(ratingsWhere(1)))).version).toBe(3);
  });

  test('a save for a missing learner is rolled back and stores nothing', async () => {
    await expect(saveAssessment(h.db, 'ghost', input(ratingsWhere(1)))).rejects.toThrow();
    expect(await h.db.select().from(selfAssessment).where(eq(selfAssessment.userId, 'ghost'))).toHaveLength(0);
  });
});

describe('listVersions and getAssessment', () => {
  test('listVersions is newest first with dates', async () => {
    const versions = await listVersions(h.db, 'a-1');
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    for (const v of versions) expect(v.createdAt).toBeInstanceOf(Date);
    expect(await listVersions(h.db, 'nobody')).toEqual([]);
  });

  test('getAssessment returns the latest by default, a version on request, and null otherwise', async () => {
    expect((await getAssessment(h.db, 'a-1'))!.version).toBe(3);
    expect((await getAssessment(h.db, 'a-1', 2))!.version).toBe(2);
    expect((await getAssessment(h.db, 'a-1', 2))!.ratings['models-new-a']).toBe(0);
    expect(await getAssessment(h.db, 'a-1', 4)).toBeNull();
    expect(await getAssessment(h.db, 'a-1', 0)).toBeNull();
    expect(await getAssessment(h.db, 'a-2', 2)).toBeNull();
    expect(await getAssessment(h.db, 'nobody')).toBeNull();
  });
});

describe('updatePlanText (decision 22, AC-5.10.5)', () => {
  test('edits the latest version only', async () => {
    const result = await updatePlanText(h.db, 'a-1', 3, '# My plan\n\nEdited.');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.updatedAt).toBeInstanceOf(Date);
    expect((await getAssessment(h.db, 'a-1', 3))!.planText).toBe('# My plan\n\nEdited.');
    // The structured plan is untouched by the edit.
    expect((await getAssessment(h.db, 'a-1', 3))!.plan.schema).toBe(1);
  });

  test('an older version is not editable and keeps its text', async () => {
    const before = (await getAssessment(h.db, 'a-1', 1))!.planText;
    expect(await updatePlanText(h.db, 'a-1', 1, 'nope')).toEqual({ ok: false, reason: 'not_latest' });
    expect((await getAssessment(h.db, 'a-1', 1))!.planText).toBe(before);
  });

  test('a version that does not exist, or a learner with no assessment, is not found', async () => {
    expect(await updatePlanText(h.db, 'a-1', 4, 'nope')).toEqual({ ok: false, reason: 'not_found' });
    expect(await updatePlanText(h.db, 'a-1', 0, 'nope')).toEqual({ ok: false, reason: 'not_found' });
    expect(await updatePlanText(h.db, 'nobody', 1, 'nope')).toEqual({ ok: false, reason: 'not_found' });
  });

  test('stores the text verbatim, markup included (NFR-6.2.3)', async () => {
    const text = '<script>alert(1)</script> **bold** [x](y)';
    await updatePlanText(h.db, 'a-2', 1, text);
    expect((await getAssessment(h.db, 'a-2'))!.planText).toBe(text);
  });
});

describe('missingModules (AC-5.10.7)', () => {
  const areas = AREA_KEYS.map((a) => ({ slug: AREA_CONTENT_MAP[a].slug, title: AREA_CONTENT_MAP[a].title }));

  test('lists every area module when nothing is complete, in the order given', () => {
    expect(missingModules(areas, {})).toEqual(areas);
  });

  test('drops completed modules and keeps in_progress ones', () => {
    const progress = {
      models: { status: 'completed' as const, startedAt: NOW, completedAt: NOW },
      orchestration: { status: 'in_progress' as const, startedAt: NOW, completedAt: null },
    };
    expect(missingModules(areas, progress).map((m) => m.slug)).toEqual([
      'context-and-knowledge',
      'tools-and-extensibility',
      'orchestration',
      'verification-and-evals',
      'operating-it',
    ]);
    expect(missingModules([], progress)).toEqual([]);
  });
});
