// src/lib/notify-page.ts
// Shared by the pages under src/pages/notify (blueprint section 7.5). Turns an action result into what
// the page shows and the status it answers with, so the branch that hides server failures is written once.
//
// Every failure a learner can cause (a missing or bad token) reads the same, so the page never says whether
// an address is on the list. A rate limit answers 429 with the limiter's sentence. Anything else is a server
// failure: the learner holds a working link and must not be told it is bad, so the page says so with a 503
// and the detail stays in the log. 503 is not one of Astro's reroutable status codes, so the page body renders.
//
// On /notify a 4xx that is neither an input error nor a rate limit (413 CONTENT_TOO_LARGE, 415
// UNSUPPORTED_MEDIA_TYPE) comes from Astro's action parser before the handler runs. It is the request's
// fault, not the server's, so the page keeps the status, says the form could not be read, and writes nothing
// to the log: the rate limiter never saw the request, and an error line per attempt would let any client fill
// the log (docs/decisions.md, 2026-10-03).
import { isInputError, type ActionError } from 'astro:actions';
import { SERVER_ERROR_MESSAGE } from './actions-guard';

/**
 * The posted form fields of a request, or undefined when there are none to read. Reads a clone, so Astro's
 * own read of the body is unaffected (the action runtime reads its own clone,
 * astro/dist/actions/runtime/server.js). Only a POST with a form content type is read. A body that cannot be
 * parsed gives undefined, never a throw, so a page re-rendering after an action error still renders.
 */
export async function readFormBody(request: Request): Promise<FormData | undefined> {
  if (request.method !== 'POST') return undefined;
  const type = request.headers.get('content-type') ?? '';
  if (!/multipart\/form-data|application\/x-www-form-urlencoded/i.test(type)) return undefined;
  try {
    return await request.clone().formData();
  } catch {
    return undefined;
  }
}

/** The sentence for a request the server could not read. Not the learner's input, not the server's fault. */
export const CLIENT_ERROR_MESSAGE = 'The form could not be read. Submit it again from the page.';

export type TokenPageOutcome =
  | { kind: 'done'; status: 200 }
  | { kind: 'invalid'; status: 200 }
  | { kind: 'limited'; status: 429; message: string }
  | { kind: 'failed'; status: 503; message: string };

/** `succeeded` is the page's own check of the action data, for example data?.state === 'confirmed'. */
export function tokenPageOutcome(
  succeeded: boolean,
  error: ActionError | undefined,
  log: (line: string) => void = (line) => console.error(line),
): TokenPageOutcome {
  if (!error) return succeeded ? { kind: 'done', status: 200 } : { kind: 'invalid', status: 200 };
  if (error.code === 'TOO_MANY_REQUESTS') return { kind: 'limited', status: 429, message: error.message };
  if (isInputError(error)) return { kind: 'invalid', status: 200 };
  if (error.message !== SERVER_ERROR_MESSAGE) log(`[notify] token page failed: ${error.code} ${error.message}`);
  return { kind: 'failed', status: 503, message: SERVER_ERROR_MESSAGE };
}

export type SubscribePageOutcome = {
  /** The input error for the field, rendered with aria-invalid and the Fix lead (blueprint 10.4). */
  fieldError?: string;
  /** A notice above the field for a rate limit or a server failure. The field stays valid. */
  notice?: string;
  status: number;
  title: string;
  lead: string;
};

/** For /notify, the PRG target of notifySubscribe, when the action returned an error. */
export function subscribePageOutcome(error: ActionError, log: (line: string) => void = (line) => console.error(line)): SubscribePageOutcome {
  if (isInputError(error)) {
    return {
      fieldError: error.fields.email?.join(' ') ?? error.message,
      status: error.status,
      title: 'Fix your email address',
      lead: 'The address was not accepted. Correct it below and submit the form again.',
    };
  }
  if (error.code === 'TOO_MANY_REQUESTS') {
    return {
      notice: error.message,
      status: 429,
      title: 'Notify me',
      lead: 'The form has been submitted too often from your connection. Nothing was stored this time.',
    };
  }
  if (error.status >= 400 && error.status < 500) {
    return {
      notice: CLIENT_ERROR_MESSAGE,
      status: error.status,
      title: 'Notify me',
      lead: 'The address was not stored.',
    };
  }
  if (error.message !== SERVER_ERROR_MESSAGE) log(`[notify] subscribe failed: ${error.code} ${error.message}`);
  return {
    notice: SERVER_ERROR_MESSAGE,
    status: 503,
    title: 'Notify me',
    lead: 'The address was not stored.',
  };
}
