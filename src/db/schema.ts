// src/db/schema.ts
import { pgTable, pgEnum, text, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
import type { AssessmentContext, Plan, Ratings } from '../lib/plan';

export { user, session, account, verification, userRelations, sessionRelations, accountRelations } from './auth-schema';

export const moduleStatus = pgEnum('module_status', ['not_started', 'in_progress', 'completed']);
export const responseKind = pgEnum('response_kind', ['workshop', 'failure']);

export const moduleProgress = pgTable(
  'module_progress',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    status: moduleStatus('status').notNull().default('not_started'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('module_progress_user_module_uidx').on(t.userId, t.moduleSlug)],
);

export const workshopResponse = pgTable(
  'workshop_response',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    kind: responseKind('kind').notNull().default('workshop'),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('workshop_response_user_module_kind_uidx').on(t.userId, t.moduleSlug, t.kind)],
);

export type SelfCheckAnswers = Record<string, number[]>;

export const selfCheckResult = pgTable(
  'self_check_result',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    attempts: integer('attempts').notNull().default(0),
    passed: boolean('passed').notNull().default(false),
    answers: jsonb('answers').$type<SelfCheckAnswers>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('self_check_result_user_module_uidx').on(t.userId, t.moduleSlug)],
);

// The jsonb column types are the plan module's types, so the row and the algorithm cannot drift apart
// (docs/decisions.md, 2026-10-03).
export type { AssessmentContext, Ratings } from '../lib/plan';

export const selfAssessment = pgTable(
  'self_assessment',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    ratings: jsonb('ratings').$type<Ratings>().notNull(),
    context: jsonb('context').$type<AssessmentContext>().notNull(),
    plan: jsonb('plan').$type<Plan>().notNull(),
    planText: text('plan_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('self_assessment_user_version_uidx').on(t.userId, t.version), index('self_assessment_user_idx').on(t.userId)],
);

export const notifySubscriber = pgTable('notify_subscriber', {
  email: text('email').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
});

export const feedback = pgTable('feedback', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
