// src/lib/actions-guard.ts
// Shared guards for action handlers (blueprint section 7.2). Every handler runs these first:
// requireUser for user-scoped writes, enforceRateLimit for every write, clientIp for the IP key.
// guardServerErrors wraps the handler body so a thrown Error never reaches a learner as text.
import { ActionError, type ActionAPIContext } from 'astro:actions';
import { createRateLimiter, type RateLimitRule } from './rate-limit';
import { redactQueryParams } from './redact';

export function requireUser(context: ActionAPIContext) {
  const user = context.locals.user;
  if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to save your work.' });
  return user;
}

const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();

/** One limiter per named rule. Keys look like ip:203.0.113.7 or user:abc. */
export function enforceRateLimit(name: string, rule: RateLimitRule, key: string) {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = createRateLimiter(rule);
    limiters.set(name, limiter);
  }
  const hit = limiter.hit(key);
  if (!hit.ok) {
    const minutes = Math.max(1, Math.ceil(hit.retryAfterMs / 60_000));
    throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: `Too many requests. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
  }
}

export function clientIp(context: ActionAPIContext): string {
  return context.clientAddress || 'unknown';
}

/** The one sentence a learner sees when a handler fails for a reason that is not theirs. */
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Try again in a few minutes.';

/**
 * Runs a handler body. An ActionError passes through unchanged (input errors, rate limits, guards).
 * Anything else is a server failure: the detail goes to the log with its stack, and the caller gets a
 * generic INTERNAL_SERVER_ERROR. Astro's callSafely would otherwise wrap the thrown Error with its own
 * message, and a page or an RPC client would show the database statement or the missing variable name.
 * The logged detail passes through redactQueryParams first: a Drizzle query error carries its bound
 * parameters, which can be a learner's address, and the log keeps no address beyond the mailer line the
 * privacy notice discloses (docs/decisions.md, 2026-10-03).
 */
export async function guardServerErrors<T>(
  name: string,
  run: () => Promise<T>,
  log: (line: string) => void = (line) => console.error(line),
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ActionError) throw err;
    const detail = redactQueryParams(err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err));
    log(`[actions] ${name} failed: ${detail}`);
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: SERVER_ERROR_MESSAGE });
  }
}
