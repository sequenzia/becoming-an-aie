// src/lib/assessment.ts
// placeholder, C replaces (blueprint section 14.1). Contracted signatures with neutral bodies.
import type { Db } from '../db/client';
import type { selfAssessment } from '../db/schema';
import type { AssessmentContext, Plan, Ratings } from './plan';

export type AssessmentRow = typeof selfAssessment.$inferSelect;

export async function saveAssessment(
  _db: Db,
  _userId: string,
  _input: { ratings: Ratings; context: AssessmentContext; plan: Plan; planText: string },
): Promise<{ version: number; createdAt: Date }> {
  return { version: 0, createdAt: new Date() };
}

export async function updatePlanText(_db: Db, _userId: string, _version: number, _text: string): Promise<{ updatedAt: Date } | null> {
  return null;
}

export async function listVersions(_db: Db, _userId: string): Promise<Array<{ version: number; createdAt: Date }>> {
  return [];
}

export async function getAssessment(_db: Db, _userId: string, _version?: number): Promise<AssessmentRow | null> {
  return null;
}
