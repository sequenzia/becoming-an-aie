// src/lib/types.ts
import type { MarkdownHeading } from 'astro';
import type { CollectionEntry } from 'astro:content';
import type { AreaKey } from './content-schema';

export type MiniMapKey = 'models' | 'context' | 'tools' | 'orchestration' | 'evals' | 'operating' | 'all';

export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

/** A collection reference as Astro stores it in data: { collection, id }. */
export type EntryRef = { collection: string; id: string };

/** Turns reference() values into plain ids. Scripts see strings; Astro components see references. */
export function refIds(refs: ReadonlyArray<EntryRef>): string[] {
  return refs.map((r) => r.id);
}

export interface PrerequisiteSummary {
  slug: string;
  title: string;
  area: AreaKey | 'none';
}

export interface ModuleContext {
  slug: string;
  /** The collection entry's data. prerequisites and artifacts are references, not strings. */
  data: CollectionEntry<'modules'>['data'];
  headings: MarkdownHeading[];
  /** Resolved prerequisite entries in frontmatter order. */
  prerequisites: PrerequisiteSummary[];
  /** True when the page renders a draft under PREVIEW_DRAFTS. */
  preview: boolean;
}

export interface ProgressRow {
  status: ModuleStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ResponseRow {
  body: string;
  updatedAt: Date;
}

export interface SelfCheckRow {
  answers: Record<string, number[]>;
  attempts: number;
  passed: boolean;
  updatedAt: Date;
}

export interface LearnerModuleState {
  progress: ProgressRow | null;
  workshop: ResponseRow | null;
  failure: ResponseRow | null;
  selfCheck: SelfCheckRow | null;
  /** Every progress row of the learner, keyed by module slug. Feeds the prerequisite notice. */
  progressBySlug: Record<string, ProgressRow>;
}

export const EMPTY_LEARNER_STATE: LearnerModuleState = {
  progress: null,
  workshop: null,
  failure: null,
  selfCheck: null,
  progressBySlug: {},
};

export interface FormError {
  /** Which form the error belongs to. */
  form: 'workshop' | 'failure' | 'feedback' | 'displayName' | 'delete';
  message: string;
  /** The rejected input, echoed back so the learner does not lose it. */
  value?: string;
}
