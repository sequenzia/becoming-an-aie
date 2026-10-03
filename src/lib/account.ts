// src/lib/account.ts
// The account page's reads and writes (blueprint section 6.6). Consumed by B's pages and by C's
// updateDisplayName and deleteAccount actions.
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { account, moduleProgress, notifySubscriber, selfAssessment, selfCheckResult, session, user, workshopResponse } from '../db/schema';

export interface LearnerData {
  profile: { name: string; email: string; createdAt: Date; providers: string[] };
  /** Every session row: the sign-in library keeps its start and expiry (privacy notice, Accounts). */
  sessions: Array<{ id: string; createdAt: Date; expiresAt: Date }>;
  /** The notify-me row stored under the account's email, the row deleteLearner removes. Null when there is none. */
  notify: { createdAt: Date; confirmedAt: Date | null; unsubscribedAt: Date | null } | null;
  progress: Array<{ moduleSlug: string; status: string; startedAt: Date | null; completedAt: Date | null }>;
  responses: Array<{ moduleSlug: string; kind: 'workshop' | 'failure'; body: string; updatedAt: Date }>;
  selfChecks: Array<{ moduleSlug: string; attempts: number; passed: boolean; updatedAt: Date }>;
  assessments: Array<{
    version: number;
    createdAt: Date;
    context: { role: string; feature: string; ownsSystem: 'yes' | 'no' | 'partly' };
    ratings: Record<string, number>;
    planText: string;
  }>;
}

/**
 * Every stored row for one learner, in the shape the account page lists (AC-5.9.5): the user row, its
 * provider accounts, its sessions, the notify-me row under the same email, and the five app tables. Eight
 * selects, ordered by module slug (then kind, in the enum's order: workshop before failure), by version, or by
 * date. Null when the user row is gone, which the page treats as signed out.
 */
export async function loadLearnerData(db: Db, userId: string): Promise<LearnerData | null> {
  const [row] = await db
    .select({ name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) return null;
  const { emailVerified, ...profile } = row;
  const accounts = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
    .orderBy(asc(account.createdAt), asc(account.providerId));
  const sessions = await db
    .select({ id: session.id, createdAt: session.createdAt, expiresAt: session.expiresAt })
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(asc(session.createdAt), asc(session.id));
  // The same match deleteLearner uses: notify.ts stores the address trimmed and lowercased. Only a verified
  // address is matched (see deleteLearner): an account whose provider did not vouch for the address must not
  // read the notify-me row stored under it.
  const [notify] = emailVerified
    ? await db
        .select({ createdAt: notifySubscriber.createdAt, confirmedAt: notifySubscriber.confirmedAt, unsubscribedAt: notifySubscriber.unsubscribedAt })
        .from(notifySubscriber)
        .where(eq(notifySubscriber.email, profile.email.trim().toLowerCase()))
    : [];
  const progress = await db
    .select({
      moduleSlug: moduleProgress.moduleSlug,
      status: moduleProgress.status,
      startedAt: moduleProgress.startedAt,
      completedAt: moduleProgress.completedAt,
    })
    .from(moduleProgress)
    .where(eq(moduleProgress.userId, userId))
    .orderBy(asc(moduleProgress.moduleSlug));
  const responses = await db
    .select({
      moduleSlug: workshopResponse.moduleSlug,
      kind: workshopResponse.kind,
      body: workshopResponse.body,
      updatedAt: workshopResponse.updatedAt,
    })
    .from(workshopResponse)
    .where(eq(workshopResponse.userId, userId))
    .orderBy(asc(workshopResponse.moduleSlug), asc(workshopResponse.kind));
  const selfChecks = await db
    .select({
      moduleSlug: selfCheckResult.moduleSlug,
      attempts: selfCheckResult.attempts,
      passed: selfCheckResult.passed,
      updatedAt: selfCheckResult.updatedAt,
    })
    .from(selfCheckResult)
    .where(eq(selfCheckResult.userId, userId))
    .orderBy(asc(selfCheckResult.moduleSlug));
  const assessments = await db
    .select({
      version: selfAssessment.version,
      createdAt: selfAssessment.createdAt,
      context: selfAssessment.context,
      ratings: selfAssessment.ratings,
      planText: selfAssessment.planText,
    })
    .from(selfAssessment)
    .where(eq(selfAssessment.userId, userId))
    .orderBy(asc(selfAssessment.version));
  return {
    profile: { ...profile, providers: [...new Set(accounts.map((a) => a.providerId))] },
    sessions,
    notify: notify ?? null,
    progress,
    responses,
    selfChecks,
    assessments,
  };
}

/** Trims and stores the new name. Null when no user row matched (EC-5.9.2). */
export async function updateDisplayName(db: Db, userId: string, name: string): Promise<{ name: string } | null> {
  const [row] = await db.update(user).set({ name: name.trim() }).where(eq(user.id, userId)).returning({ name: user.name });
  return row ?? null;
}

/**
 * One transaction (CG-9, decision 11). Cascades remove session, account, and every app row (drizzle/0000_init.sql,
 * ON DELETE cascade on every user_id). Subscriber rows go by email, matched the way notify.ts stores them:
 * trimmed and lowercased, and only when the user row's emailVerified is true. The sign-in refuses an unverified
 * address (src/lib/auth.ts), so no such row should exist; this guard is the second line, so an account can never
 * remove a subscription the provider did not vouch for (docs/decisions.md, 2026-10-03, Phase 1 review round 2).
 * Feedback has no user column and stays (CG-15).
 */
export async function deleteLearner(db: Db, userId: string): Promise<{ deleted: boolean }> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId));
    if (!u) return { deleted: false };
    if (u.emailVerified) await tx.delete(notifySubscriber).where(eq(notifySubscriber.email, u.email.trim().toLowerCase()));
    await tx.delete(user).where(eq(user.id, userId));
    return { deleted: true };
  });
}
