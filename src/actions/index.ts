// src/actions/index.ts
// Every action (blueprint section 7). S wrote the typed stub (7.1); C filled the handlers (7.3). Each
// handler stays thin: guard, rate limit, one library call, map the result. The logic and its tests live
// in src/lib/*. Every handler body runs inside guardServerErrors (section 7.2), so a thrown Error (a
// missing variable, a database failure) is logged and replaced by one generic INTERNAL_SERVER_ERROR
// instead of reaching the page or the RPC client as text. Input messages are written for the learner.
// User-scoped handlers key their limiter on user:<id>; IP-scoped ones on ip:<address> (7.3).
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db';
import { deleteLearner, updateDisplayName } from '../lib/account';
import { clearSessionCookies } from '../lib/auth-cookies';
import { clientIp, enforceRateLimit, guardServerErrors, requireUser } from '../lib/actions-guard';
import { missingModules, saveAssessment, updatePlanText } from '../lib/assessment';
import { CLOSING_SLUG, SELF_CHECK_MAX, type ModuleKind } from '../lib/content-schema';
import { env, requireEnv } from '../lib/env';
import { FeedbackLengthError, insertFeedback } from '../lib/feedback';
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
import { getPublishedModule, getPublishedModules, type ModuleEntry } from '../lib/modules';
import { confirm, subscribe, unsubscribe } from '../lib/notify';
import { buildPlan, missingRatings, pickRatings, renderPlanMarkdown } from '../lib/plan';
import { EVIDENCE_KINDS, completeModule, evaluateCompletion, getProgress, listProgress, touchStarted } from '../lib/progress';
import { ResponseLengthError, saveResponse as storeResponse } from '../lib/responses';
import { grade, pickKnown } from '../lib/self-check';
import { recordSelfCheck } from '../lib/self-check-store';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'That module address is not valid.' });

const boundedRecord = <V extends z.ZodTypeAny>(keyMax: number, value: V, maxKeys: number) =>
  z
    .record(z.string().max(keyMax), value)
    .refine((r) => Object.keys(r).length <= maxKeys, { message: `at most ${maxKeys} entries` });

/** The entry check every module action runs (7.3). getPublishedModule honors PREVIEW_DRAFTS. */
async function requireModule(moduleSlug: string): Promise<ModuleEntry> {
  const entry = await getPublishedModule(moduleSlug);
  if (!entry) throw new ActionError({ code: 'NOT_FOUND', message: 'That module is not available.' });
  return entry;
}

/** A length rule the library enforces as well as the input schema. Maps the library's error to BAD_REQUEST. */
function asInputError(err: unknown): never {
  if (err instanceof ResponseLengthError || err instanceof FeedbackLengthError) {
    throw new ActionError({ code: 'BAD_REQUEST', message: err.message });
  }
  throw err;
}

const hasWorkshop = (kind: ModuleKind) => EVIDENCE_KINDS.includes(kind);

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

  /** Orientation is the one module a learner marks complete by hand (decision 16). PRG target: /progress. */
  markModuleComplete: defineAction({
    accept: 'form',
    input: z.object({ moduleSlug: slug }),
    handler: async ({ moduleSlug }, context) => {
      const user = requireUser(context);
      enforceRateLimit('write-user', RATE_RULES['write-user'], `user:${user.id}`);
      return guardServerErrors('markModuleComplete', async () => {
        const entry = await requireModule(moduleSlug);
        if (entry.data.kind !== 'orientation') {
          throw new ActionError({
            code: 'FORBIDDEN',
            message: 'Only orientation is marked complete by hand. Other modules complete when the self-check is passed and the workshop response is saved.',
          });
        }
        const { db } = await getDb();
        await completeModule(db, user.id, entry.id);
        return { status: 'completed' as const };
      });
    },
  }),

  /** The workshop and failure-exercise forms. A workshop save is one of the two pieces of completion evidence. */
  saveResponse: defineAction({
    accept: 'form',
    input: z.object({
      moduleSlug: slug,
      kind: z.enum(['workshop', 'failure']),
      body: z
        .string({ error: `Write at least ${WORKSHOP_MIN_CHARS} characters. A few sentences is enough.` })
        .trim()
        .min(WORKSHOP_MIN_CHARS, { error: `Write at least ${WORKSHOP_MIN_CHARS} characters. A few sentences is enough.` })
        .max(WORKSHOP_MAX_CHARS, { error: `Write at most ${WORKSHOP_MAX_CHARS.toLocaleString('en-US')} characters.` }),
    }),
    handler: async ({ moduleSlug, kind, body }, context) => {
      const user = requireUser(context);
      enforceRateLimit('write-user', RATE_RULES['write-user'], `user:${user.id}`);
      enforceRateLimit('write-ip', RATE_RULES['write-ip'], `ip:${clientIp(context)}`);
      return guardServerErrors('saveResponse', async () => {
        const entry = await requireModule(moduleSlug);
        if (!hasWorkshop(entry.data.kind)) {
          throw new ActionError({ code: 'FORBIDDEN', message: 'This module has no workshop or failure exercise.' });
        }
        const { db } = await getDb();
        const { updatedAt } = await storeResponse(db, user.id, entry.id, kind, body).catch(asInputError);
        const now = new Date();
        await touchStarted(db, user.id, entry.id, now);
        const status =
          kind === 'workshop'
            ? await evaluateCompletion(db, user.id, entry.id, entry.data.kind, now)
            : ((await getProgress(db, user.id, entry.id))?.status ?? 'in_progress');
        return { updatedAt, status, revealed: kind === 'failure' };
      });
    },
  }),

  /** The self-check island's save. Grades on the server, keeps the pass across content changes (decision 20). */
  saveSelfCheck: defineAction({
    input: z.object({
      moduleSlug: slug,
      answers: boundedRecord(40, z.array(z.number().int().min(0).max(9)).max(6), SELF_CHECK_MAX),
    }),
    handler: async ({ moduleSlug, answers }, context) => {
      const user = requireUser(context);
      enforceRateLimit('write-user', RATE_RULES['write-user'], `user:${user.id}`);
      return guardServerErrors('saveSelfCheck', async () => {
        const entry = await requireModule(moduleSlug);
        if (entry.data.kind === 'orientation') {
          throw new ActionError({ code: 'FORBIDDEN', message: 'This self-check stays on this device. Orientation results are not saved to your account.' });
        }
        if (entry.data.kind === 'closing') {
          throw new ActionError({ code: 'FORBIDDEN', message: 'The self-assessment has no self-check.' });
        }
        const known = pickKnown(entry.data.selfCheck, answers);
        const graded = grade(entry.data.selfCheck, known);
        const { db } = await getDb();
        const { attempts, passed } = await recordSelfCheck(db, user.id, entry.id, known, graded.passed);
        const now = new Date();
        await touchStarted(db, user.id, entry.id, now);
        const status = await evaluateCompletion(db, user.id, entry.id, entry.data.kind, now);
        return { passed, correct: graded.correctCount, attempts, status };
      });
    },
  }),

  /** Generates and stores a new plan version from the closing module's spec (section 9.5). */
  saveSelfAssessment: defineAction({
    input: z.object({
      ratings: boundedRecord(60, z.number().int().min(0).max(3), ASSESSMENT_ITEMS_MAX),
      context: z.object({
        role: z.string().trim().max(120),
        feature: z.string().trim().max(200),
        ownsSystem: z.enum(['yes', 'no', 'partly']),
      }),
    }),
    handler: async ({ ratings, context: learnerContext }, context) => {
      const user = requireUser(context);
      enforceRateLimit('assess-user', RATE_RULES['assess-user'], `user:${user.id}`);
      return guardServerErrors('saveSelfAssessment', async () => {
        const closing = await requireModule(CLOSING_SLUG);
        const spec = closing.data.assessment;
        if (!spec) throw new ActionError({ code: 'NOT_FOUND', message: 'The self-assessment is not available.' });
        const rated = pickRatings(spec, ratings);
        const missing = missingRatings(spec, rated);
        if (missing.length > 0) {
          const first = missing[0]!;
          const item = spec.areas.flatMap((a) => [...a.transfers, ...a.competencies]).find((i) => i.id === first);
          throw new ActionError({ code: 'BAD_REQUEST', message: `Rate every item before generating your plan. Missing: ${item?.text ?? first} (${first}).` });
        }
        const { db } = await getDb();
        const areaModules = (await getPublishedModules()).filter((m) => m.data.kind === 'area').map((m) => ({ slug: m.id, title: m.data.title }));
        const missingArea = missingModules(areaModules, await listProgress(db, user.id));
        const now = new Date();
        const plan = buildPlan(spec, rated, learnerContext, missingArea, now);
        const planText = renderPlanMarkdown(plan, env.siteUrl);
        const { version, createdAt } = await saveAssessment(db, user.id, { ratings: rated, context: learnerContext, plan, planText });
        await completeModule(db, user.id, closing.id, now);
        return { version, plan, planText, createdAt };
      });
    },
  }),

  /** Edits the Markdown of the learner's latest plan. Older versions are read-only (decision 22). */
  updatePlanText: defineAction({
    input: z.object({
      version: z.number().int().min(1),
      planText: z.string().max(PLAN_TEXT_MAX_CHARS, { error: `Keep the plan under ${PLAN_TEXT_MAX_CHARS.toLocaleString('en-US')} characters.` }),
    }),
    handler: async ({ version, planText }, context) => {
      const user = requireUser(context);
      enforceRateLimit('write-user', RATE_RULES['write-user'], `user:${user.id}`);
      return guardServerErrors('updatePlanText', async () => {
        const { db } = await getDb();
        const result = await updatePlanText(db, user.id, version, planText);
        if (result.ok) return { updatedAt: result.updatedAt };
        if (result.reason === 'not_latest') {
          throw new ActionError({ code: 'CONFLICT', message: 'Only your latest plan can be edited. Open the latest version to make changes.' });
        }
        throw new ActionError({ code: 'NOT_FOUND', message: 'That plan version does not exist.' });
      });
    },
  }),

  /** Anonymous. No user column, no session needed (decision 31). */
  submitFeedback: defineAction({
    accept: 'form',
    input: z.object({
      body: z
        .string({ error: 'Write something before sending.' })
        .trim()
        .min(1, { error: 'Write something before sending.' })
        .max(FEEDBACK_MAX_CHARS, { error: `Write at most ${FEEDBACK_MAX_CHARS.toLocaleString('en-US')} characters.` }),
    }),
    handler: async ({ body }, context) => {
      enforceRateLimit('feedback-ip', RATE_RULES['feedback-ip'], `ip:${clientIp(context)}`);
      return guardServerErrors('submitFeedback', async () => {
        const { db } = await getDb();
        return insertFeedback(db, body).catch(asInputError);
      });
    },
  }),

  updateDisplayName: defineAction({
    accept: 'form',
    input: z.object({
      name: z
        .string({ error: 'Enter a display name.' })
        .trim()
        .min(1, { error: 'Enter a display name.' })
        .max(DISPLAY_NAME_MAX_CHARS, { error: `Keep the name under ${DISPLAY_NAME_MAX_CHARS} characters.` }),
    }),
    handler: async ({ name }, context) => {
      const user = requireUser(context);
      enforceRateLimit('write-user', RATE_RULES['write-user'], `user:${user.id}`);
      return guardServerErrors('updateDisplayName', async () => {
        const { db } = await getDb();
        const updated = await updateDisplayName(db, user.id, name);
        if (!updated) throw new ActionError({ code: 'NOT_FOUND', message: 'Your account was not found. Sign in again.' });
        return { name: updated.name };
      });
    },
  }),

  /**
   * One click removes the account and every row that belongs to it (AC-5.9.5, decision 11). The session
   * cookies are cleared here and again by the account page, which then redirects to redirectTo (6.6).
   */
  deleteAccount: defineAction({
    accept: 'form',
    input: z.object({ confirm: z.literal('delete', { error: 'The form could not be read. Submit it again from the account page.' }) }),
    handler: async (_input, context) => {
      const user = requireUser(context);
      enforceRateLimit('delete-user', RATE_RULES['delete-user'], `user:${user.id}`);
      return guardServerErrors('deleteAccount', async () => {
        const { db } = await getDb();
        const { deleted } = await deleteLearner(db, user.id);
        clearSessionCookies(context.cookies);
        return { deleted, redirectTo: '/account/deleted' as const };
      });
    },
  }),
};
