// src/lib/account.ts
// placeholder, B replaces (blueprint section 6.6). Contracted signatures with neutral bodies.
import type { Db } from '../db/client';

export interface LearnerData {
  profile: { name: string; email: string; createdAt: Date; providers: string[] };
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

export async function updateDisplayName(_db: Db, _userId: string, _name: string): Promise<{ name: string } | null> {
  return null;
}

export async function deleteLearner(_db: Db, _userId: string): Promise<{ deleted: boolean }> {
  return { deleted: false };
}

export async function loadLearnerData(_db: Db, _userId: string): Promise<LearnerData | null> {
  return null;
}
