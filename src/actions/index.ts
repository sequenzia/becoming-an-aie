// src/actions/index.ts
// Typed stub written by S (blueprint section 7.1). C fills the handlers. Every action keeps its
// input schema here so pages and islands can type against it before the handler exists.
// Phase 0: the three notify handlers are real (section 7.3). Every other action stays a
// NOT_IMPLEMENTED stub until Phase 1. Handlers stay thin: guard, rate limit, one library call.
// Every real handler body runs inside guardServerErrors (section 7.2), so a thrown Error (a missing
// variable, a database failure) is logged and replaced by one generic INTERNAL_SERVER_ERROR instead of
// reaching the page or the RPC client as text. Input messages are written for the learner, not Zod's defaults.
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db';
import { clientIp, enforceRateLimit, guardServerErrors } from '../lib/actions-guard';
import { env, requireEnv } from '../lib/env';
import {
  RATE_RULES,
  WORKSHOP_MIN_CHARS,
  WORKSHOP_MAX_CHARS,
  FEEDBACK_MAX_CHARS,
  PLAN_TEXT_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  ASSESSMENT_ITEMS_MAX,
} from '../lib/limits';
import { getMailer } from '../lib/mailer';
import { confirm, subscribe, unsubscribe } from '../lib/notify';
import { SELF_CHECK_MAX } from '../lib/content-schema';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const boundedRecord = <V extends z.ZodTypeAny>(keyMax: number, value: V, maxKeys: number) =>
  z
    .record(z.string().max(keyMax), value)
    .refine((r) => Object.keys(r).length <= maxKeys, { message: `at most ${maxKeys} entries` });

const notImplemented = async (): Promise<never> => {
  throw new ActionError({ code: 'NOT_IMPLEMENTED', message: 'Not implemented yet.' });
};

export const server = {
  notifySubscribe: defineAction({
    accept: 'form',
    input: z.object({
      email: z.email({ error: 'Enter a valid email address, like name@example.com.' }).max(254, { error: 'Enter a shorter address.' }),
    }),
    handler: async ({ email }, context) => {
      enforceRateLimit('notify-ip', RATE_RULES['notify-ip'], `ip:${clientIp(context)}`);
      return guardServerErrors('notifySubscribe', async () => {
        const tokenSecret = requireEnv('NOTIFY_TOKEN_SECRET');
        const { db } = await getDb();
        return subscribe(db, getMailer(env.emailProvider), email, { tokenSecret, siteUrl: env.siteUrl });
      });
    },
  }),
  notifyConfirm: defineAction({
    input: z.object({ token: z.string().min(1).max(2048) }),
    handler: async ({ token }, context) => {
      enforceRateLimit('notify-token-ip', RATE_RULES['notify-token-ip'], `ip:${clientIp(context)}`);
      return guardServerErrors('notifyConfirm', async () => {
        const tokenSecret = requireEnv('NOTIFY_TOKEN_SECRET');
        const { db } = await getDb();
        return confirm(db, token, tokenSecret);
      });
    },
  }),
  notifyUnsubscribe: defineAction({
    input: z.object({ token: z.string().min(1).max(2048) }),
    handler: async ({ token }, context) => {
      enforceRateLimit('notify-token-ip', RATE_RULES['notify-token-ip'], `ip:${clientIp(context)}`);
      return guardServerErrors('notifyUnsubscribe', async () => {
        const tokenSecret = requireEnv('NOTIFY_TOKEN_SECRET');
        const { db } = await getDb();
        return unsubscribe(db, token, tokenSecret);
      });
    },
  }),
  markModuleComplete: defineAction({
    accept: 'form',
    input: z.object({ moduleSlug: slug }),
    handler: notImplemented,
  }),
  saveResponse: defineAction({
    accept: 'form',
    input: z.object({
      moduleSlug: slug,
      kind: z.enum(['workshop', 'failure']),
      body: z.string().trim().min(WORKSHOP_MIN_CHARS).max(WORKSHOP_MAX_CHARS),
    }),
    handler: notImplemented,
  }),
  saveSelfCheck: defineAction({
    input: z.object({
      moduleSlug: slug,
      answers: boundedRecord(40, z.array(z.number().int().min(0).max(9)).max(6), SELF_CHECK_MAX),
    }),
    handler: notImplemented,
  }),
  saveSelfAssessment: defineAction({
    input: z.object({
      ratings: boundedRecord(60, z.number().int().min(0).max(3), ASSESSMENT_ITEMS_MAX),
      context: z.object({
        role: z.string().trim().max(120),
        feature: z.string().trim().max(200),
        ownsSystem: z.enum(['yes', 'no', 'partly']),
      }),
    }),
    handler: notImplemented,
  }),
  updatePlanText: defineAction({
    input: z.object({ version: z.number().int().min(1), planText: z.string().max(PLAN_TEXT_MAX_CHARS) }),
    handler: notImplemented,
  }),
  submitFeedback: defineAction({
    accept: 'form',
    input: z.object({ body: z.string().trim().min(1).max(FEEDBACK_MAX_CHARS) }),
    handler: notImplemented,
  }),
  updateDisplayName: defineAction({
    accept: 'form',
    input: z.object({ name: z.string().trim().min(1).max(DISPLAY_NAME_MAX_CHARS) }),
    handler: notImplemented,
  }),
  deleteAccount: defineAction({
    accept: 'form',
    input: z.object({ confirm: z.literal('delete') }),
    handler: notImplemented,
  }),
};
