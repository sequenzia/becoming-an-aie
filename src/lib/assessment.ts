// src/lib/assessment.ts
// Self-assessment versions (blueprint sections 7.3, 9.5, 14.1; CG-18, EC-5.10.2). Every submit appends a
// new version for the learner; nothing is overwritten, so earlier plans stay for comparison. The
// structured plan is regenerated on each retake and never edited. planText is the learner's editable
// Markdown, exported verbatim by /account/plan.md, and only the latest version accepts edits
// (decision 22). getAssessment and listVersions feed the assessment page and the download endpoint.
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { selfAssessment } from '../db/schema';
import type { AssessmentContext, Plan, Ratings } from './plan';
import type { ProgressRow } from './types';

export type AssessmentRow = typeof selfAssessment.$inferSelect;

export interface AssessmentInput {
  ratings: Ratings;
  context: AssessmentContext;
  plan: Plan;
  planText: string;
}

async function latestVersion(db: Db, userId: string): Promise<number | null> {
  const [row] = await db
    .select({ version: selfAssessment.version })
    .from(selfAssessment)
    .where(eq(selfAssessment.userId, userId))
    .orderBy(desc(selfAssessment.version))
    .limit(1);
  return row?.version ?? null;
}

/**
 * Inserts the next version (latest plus one) in one transaction. Versions are contiguous from 1.
 * The unique index on (user_id, version) rejects a duplicate if two submits race; the island disables
 * its button while a save runs, so the learner does not see that case.
 */
export async function saveAssessment(db: Db, userId: string, input: AssessmentInput): Promise<{ version: number; createdAt: Date }> {
  return db.transaction(async (tx) => {
    const version = ((await latestVersion(tx, userId)) ?? 0) + 1;
    const [row] = await tx
      .insert(selfAssessment)
      .values({ userId, version, ratings: input.ratings, context: input.context, plan: input.plan, planText: input.planText })
      .returning({ version: selfAssessment.version, createdAt: selfAssessment.createdAt });
    return row!;
  });
}

export type UpdatePlanTextResult = { ok: true; updatedAt: Date } | { ok: false; reason: 'not_found' | 'not_latest' };

/**
 * Replaces the plan text of the learner's latest version. An older version answers not_latest (the
 * action's CONFLICT); a version that does not exist answers not_found.
 */
export async function updatePlanText(db: Db, userId: string, version: number, text: string): Promise<UpdatePlanTextResult> {
  return db.transaction(async (tx) => {
    const latest = await latestVersion(tx, userId);
    if (latest === null || version > latest || version < 1) return { ok: false, reason: 'not_found' };
    if (version !== latest) return { ok: false, reason: 'not_latest' };
    const [row] = await tx
      .update(selfAssessment)
      .set({ planText: text })
      .where(and(eq(selfAssessment.userId, userId), eq(selfAssessment.version, version)))
      .returning({ updatedAt: selfAssessment.updatedAt });
    return row ? { ok: true, updatedAt: row.updatedAt } : { ok: false, reason: 'not_found' };
  });
}

/** Every version of the learner, newest first. */
export async function listVersions(db: Db, userId: string): Promise<Array<{ version: number; createdAt: Date }>> {
  return db
    .select({ version: selfAssessment.version, createdAt: selfAssessment.createdAt })
    .from(selfAssessment)
    .where(eq(selfAssessment.userId, userId))
    .orderBy(desc(selfAssessment.version));
}

/** One version, or the latest when no version is given. Null when the learner has none, or the version does not exist. */
export async function getAssessment(db: Db, userId: string, version?: number): Promise<AssessmentRow | null> {
  const where = version === undefined ? eq(selfAssessment.userId, userId) : and(eq(selfAssessment.userId, userId), eq(selfAssessment.version, version));
  const [row] = await db.select().from(selfAssessment).where(where).orderBy(desc(selfAssessment.version)).limit(1);
  return row ?? null;
}

/**
 * The published area modules the learner has not completed, in the order given (catalog order). The plan
 * lists them as next steps and the assessment page shows the notice (AC-5.10.7).
 */
export function missingModules(
  areaModules: ReadonlyArray<{ slug: string; title: string }>,
  progress: Record<string, ProgressRow>,
): Array<{ slug: string; title: string }> {
  return areaModules.filter((m) => progress[m.slug]?.status !== 'completed').map(({ slug, title }) => ({ slug, title }));
}
