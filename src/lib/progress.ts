// src/lib/progress.ts
// Progress rules (blueprint section 7.4). One row per learner and module in module_progress.
// Opening a page never creates a row. The first save creates it as in_progress (touchStarted), and the
// completion rule (evaluateCompletion) marks it completed once both pieces of evidence exist: a saved
// workshop response and a passed self-check, in either order (EC-5.5.2). Orientation completes by hand
// through markModuleComplete and the closing module through saveSelfAssessment; both call completeModule.
// A completed row is never downgraded (CG-22), and its completed_at keeps the first completion.
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { moduleProgress, selfCheckResult, workshopResponse } from '../db/schema';
import type { ModuleKind } from './content-schema';
import type { LearnerModuleState, ModuleStatus, ProgressRow, ResponseRow, SelfCheckRow } from './types';

type StoredProgress = typeof moduleProgress.$inferSelect;

/** Kinds whose completion is evaluated from the workshop response and the self-check (section 7.4). */
export const EVIDENCE_KINDS: readonly ModuleKind[] = ['area', 'foundations', 'elective'];

/** Status for display: completed when completedAt is set, in_progress when a row exists, else not_started. */
export function statusOf(row: Pick<StoredProgress, 'completedAt'> | null | undefined): ModuleStatus {
  if (!row) return 'not_started';
  return row.completedAt ? 'completed' : 'in_progress';
}

function toProgressRow(row: StoredProgress): ProgressRow {
  return { status: statusOf(row), startedAt: row.startedAt, completedAt: row.completedAt };
}

async function readStored(db: Db, userId: string, slug: string): Promise<StoredProgress | null> {
  const [row] = await db
    .select()
    .from(moduleProgress)
    .where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleSlug, slug)))
    .limit(1);
  return row ?? null;
}

/** Every progress row of the learner, keyed by module slug. */
export async function listProgress(db: Db, userId: string): Promise<Record<string, ProgressRow>> {
  const rows = await db.select().from(moduleProgress).where(eq(moduleProgress.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.moduleSlug, toProgressRow(r)]));
}

/** The learner's progress row for one module, or null when nothing was saved yet. */
export async function getProgress(db: Db, userId: string, slug: string): Promise<ProgressRow | null> {
  const row = await readStored(db, userId, slug);
  return row ? toProgressRow(row) : null;
}

/** The four rows of src/lib/types.ts for one module, plus every progress row for the prerequisite notice. */
export async function loadModuleState(db: Db, userId: string, slug: string): Promise<LearnerModuleState> {
  const progressBySlug = await listProgress(db, userId);
  const responses = await db
    .select({ kind: workshopResponse.kind, body: workshopResponse.body, updatedAt: workshopResponse.updatedAt })
    .from(workshopResponse)
    .where(and(eq(workshopResponse.userId, userId), eq(workshopResponse.moduleSlug, slug)));
  const [check] = await db
    .select({
      answers: selfCheckResult.answers,
      attempts: selfCheckResult.attempts,
      passed: selfCheckResult.passed,
      updatedAt: selfCheckResult.updatedAt,
    })
    .from(selfCheckResult)
    .where(and(eq(selfCheckResult.userId, userId), eq(selfCheckResult.moduleSlug, slug)))
    .limit(1);
  const responseOf = (kind: 'workshop' | 'failure'): ResponseRow | null => {
    const r = responses.find((x) => x.kind === kind);
    return r ? { body: r.body, updatedAt: r.updatedAt } : null;
  };
  const selfCheck: SelfCheckRow | null = check ? { answers: check.answers, attempts: check.attempts, passed: check.passed, updatedAt: check.updatedAt } : null;
  return {
    progress: progressBySlug[slug] ?? null,
    workshop: responseOf('workshop'),
    failure: responseOf('failure'),
    selfCheck,
    progressBySlug,
  };
}

/**
 * Creates the row as in_progress with startedAt when none exists. An existing row is left alone, so a
 * completed module is never downgraded and the first start date stands (CG-22, AC-5.9.3).
 */
export async function touchStarted(db: Db, userId: string, slug: string, now: Date = new Date()): Promise<void> {
  await db
    .insert(moduleProgress)
    .values({ userId, moduleSlug: slug, status: 'in_progress', startedAt: now, completedAt: null })
    .onConflictDoNothing({ target: [moduleProgress.userId, moduleProgress.moduleSlug] });
}

/**
 * Marks the module completed. startedAt is kept, or set to now when the row is new. completedAt is set
 * once: a second completion (marking orientation twice, retaking the assessment) keeps the first date.
 */
export async function completeModule(db: Db, userId: string, slug: string, now: Date = new Date()): Promise<void> {
  await db
    .insert(moduleProgress)
    .values({ userId, moduleSlug: slug, status: 'completed', startedAt: now, completedAt: now })
    .onConflictDoUpdate({
      target: [moduleProgress.userId, moduleProgress.moduleSlug],
      set: {
        status: 'completed',
        startedAt: sql`coalesce(${moduleProgress.startedAt}, excluded.started_at)`,
        completedAt: sql`coalesce(${moduleProgress.completedAt}, excluded.completed_at)`,
      },
    });
}

/**
 * The completion rule. For area, foundations, and elective modules: completed when a workshop response
 * exists and the self-check is passed, whichever came first (EC-5.5.2). Otherwise the row is left as it is
 * and its status is returned. Orientation and closing never complete here.
 */
export async function evaluateCompletion(
  db: Db,
  userId: string,
  slug: string,
  kind: ModuleKind,
  now: Date = new Date(),
): Promise<ModuleStatus> {
  const current = await readStored(db, userId, slug);
  if (current?.completedAt) return 'completed';
  if (!EVIDENCE_KINDS.includes(kind)) return statusOf(current);
  const [response] = await db
    .select({ id: workshopResponse.id })
    .from(workshopResponse)
    .where(and(eq(workshopResponse.userId, userId), eq(workshopResponse.moduleSlug, slug), eq(workshopResponse.kind, 'workshop')))
    .limit(1);
  if (!response) return statusOf(current);
  const [check] = await db
    .select({ passed: selfCheckResult.passed })
    .from(selfCheckResult)
    .where(and(eq(selfCheckResult.userId, userId), eq(selfCheckResult.moduleSlug, slug)))
    .limit(1);
  if (!check?.passed) return statusOf(current);
  await completeModule(db, userId, slug, now);
  return 'completed';
}
