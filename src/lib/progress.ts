// src/lib/progress.ts
// placeholder, C replaces (blueprint section 7.4). Contracted signatures with neutral bodies.
import type { Db } from '../db/client';
import type { ModuleKind } from './content-schema';
import { EMPTY_LEARNER_STATE, type LearnerModuleState, type ModuleStatus, type ProgressRow } from './types';

export async function listProgress(_db: Db, _userId: string): Promise<Record<string, ProgressRow>> {
  return {};
}

export async function loadModuleState(_db: Db, _userId: string, _slug: string): Promise<LearnerModuleState> {
  return { ...EMPTY_LEARNER_STATE, progressBySlug: {} };
}

export async function touchStarted(_db: Db, _userId: string, _slug: string, _now: Date = new Date()): Promise<void> {}

export async function completeModule(_db: Db, _userId: string, _slug: string, _now: Date = new Date()): Promise<void> {}

export async function evaluateCompletion(
  _db: Db,
  _userId: string,
  _slug: string,
  _kind: ModuleKind,
  _now: Date = new Date(),
): Promise<ModuleStatus> {
  return 'not_started';
}
