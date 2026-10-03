// src/lib/self-check-store.ts
// Per-learner self-check results (blueprint decision 20, AC-5.8.3, EC-5.8.2). One row per learner and
// module. Every submit increments attempts and replaces the stored answers with the latest best answers
// the island sends. passed becomes true when every question is correct and stays true afterwards, so a
// pass stands across content changes: the key is the module slug, not the question text. The orientation
// self-check is never stored (deviation 15.3.3); the action refuses it before this runs.
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { selfCheckResult, type SelfCheckAnswers } from '../db/schema';

export async function recordSelfCheck(
  db: Db,
  userId: string,
  slug: string,
  answers: SelfCheckAnswers,
  passedNow: boolean,
): Promise<{ attempts: number; passed: boolean }> {
  const [row] = await db
    .insert(selfCheckResult)
    .values({ userId, moduleSlug: slug, attempts: 1, passed: passedNow, answers })
    .onConflictDoUpdate({
      target: [selfCheckResult.userId, selfCheckResult.moduleSlug],
      set: {
        attempts: sql`${selfCheckResult.attempts} + 1`,
        passed: sql`${selfCheckResult.passed} or excluded.passed`,
        answers: sql`excluded.answers`,
      },
    })
    .returning({ attempts: selfCheckResult.attempts, passed: selfCheckResult.passed });
  return { attempts: row!.attempts, passed: row!.passed };
}
