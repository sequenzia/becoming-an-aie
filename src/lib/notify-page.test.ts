// src/lib/notify-page.test.ts
import { ActionError, isInputError } from 'astro:actions';
import { describe, expect, test } from 'vitest';
import { SERVER_ERROR_MESSAGE } from './actions-guard';
import { CLIENT_ERROR_MESSAGE, readFormBody, subscribePageOutcome, tokenPageOutcome } from './notify-page';

/**
 * The shape Astro gives an input error (astro/dist/actions/runtime/client.js, ActionInputError). The class
 * is not exported by astro:actions, and isInputError is duck-typed on `type` and `issues`, so the test
 * builds the same object on a BAD_REQUEST ActionError.
 */
const inputError = () => {
  const message = 'Enter a valid email address, like name@example.com.';
  const error = Object.assign(new ActionError({ code: 'BAD_REQUEST', message: `Failed to validate: ${message}` }), {
    type: 'AstroActionInputError',
    issues: [{ code: 'invalid_format', format: 'email', path: ['email'], message }],
    fields: { email: [message] },
  });
  if (!isInputError(error)) throw new Error('the fixture does not satisfy isInputError');
  return error;
};
const limited = () => new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Try again in 3 minutes.' });
const wrapped = () => new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing required environment variable NOTIFY_TOKEN_SECRET. See .env.example.' });
const guarded = () => new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: SERVER_ERROR_MESSAGE });

describe('tokenPageOutcome (confirm and unsubscribe pages)', () => {
  test('a result with no error is done or invalid, both 200', () => {
    expect(tokenPageOutcome(true, undefined)).toEqual({ kind: 'done', status: 200 });
    expect(tokenPageOutcome(false, undefined)).toEqual({ kind: 'invalid', status: 200 });
  });

  test('a missing token (input error) reads like a bad token, so membership is not revealed', () => {
    expect(tokenPageOutcome(false, inputError())).toEqual({ kind: 'invalid', status: 200 });
  });

  test('a rate limit answers 429 with the limiter sentence', () => {
    expect(tokenPageOutcome(false, limited())).toEqual({ kind: 'limited', status: 429, message: 'Too many requests. Try again in 3 minutes.' });
  });

  test('a server failure is told apart from a bad link: 503, one generic sentence, detail logged', () => {
    const lines: string[] = [];
    const outcome = tokenPageOutcome(false, wrapped(), (l) => lines.push(l));
    expect(outcome).toEqual({ kind: 'failed', status: 503, message: SERVER_ERROR_MESSAGE });
    expect(lines).toEqual(['[notify] token page failed: INTERNAL_SERVER_ERROR Missing required environment variable NOTIFY_TOKEN_SECRET. See .env.example.']);
    // The handler guard already logged the detail when the message is the generic one.
    const quiet: string[] = [];
    expect(tokenPageOutcome(false, guarded(), (l) => quiet.push(l)).kind).toBe('failed');
    expect(quiet).toEqual([]);
  });
});

describe('subscribePageOutcome (/notify)', () => {
  test('an input error keeps the 10.4 field contract: message, 400, a distinct title', () => {
    const outcome = subscribePageOutcome(inputError(), () => {});
    expect(outcome.fieldError).toBe('Enter a valid email address, like name@example.com.');
    expect(outcome.notice).toBeUndefined();
    expect(outcome.status).toBe(400);
    expect(outcome.title).toBe('Fix your email address');
  });

  test('a rate limit is a notice, not an input error: 429 and the field stays valid', () => {
    const outcome = subscribePageOutcome(limited(), () => {});
    expect(outcome.fieldError).toBeUndefined();
    expect(outcome.notice).toBe('Too many requests. Try again in 3 minutes.');
    expect(outcome.status).toBe(429);
    expect(outcome.title).toBe('Notify me');
  });

  test('a server failure never shows its text: generic notice, 503, logged once', () => {
    const lines: string[] = [];
    const outcome = subscribePageOutcome(wrapped(), (l) => lines.push(l));
    expect(outcome.notice).toBe(SERVER_ERROR_MESSAGE);
    expect(outcome.notice).not.toContain('NOTIFY_TOKEN_SECRET');
    expect(outcome.status).toBe(503);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('NOTIFY_TOKEN_SECRET');
    expect(subscribePageOutcome(guarded(), (l) => lines.push(l)).status).toBe(503);
    expect(lines).toHaveLength(1);
  });

  test('a request Astro rejected before the handler (413, 415) keeps its status, blames the request, and is not logged', () => {
    // These come from the action parser, so the rate limiter never saw them. An error line per attempt would
    // let any client fill the log with wrong content types or oversized bodies (docs/decisions.md, 2026-10-03).
    const lines: string[] = [];
    const tooLarge = subscribePageOutcome(new ActionError({ code: 'CONTENT_TOO_LARGE', message: 'Request body exceeds 262144 bytes' }), (l) => lines.push(l));
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.notice).toBe(CLIENT_ERROR_MESSAGE);
    expect(tooLarge.fieldError).toBeUndefined();
    expect(tooLarge.title).toBe('Notify me');
    const unsupported = subscribePageOutcome(new ActionError({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'nope' }), (l) => lines.push(l));
    expect(unsupported.status).toBe(415);
    expect(unsupported.notice).toBe(CLIENT_ERROR_MESSAGE);
    expect(unsupported.notice).not.toContain('our side');
    expect(lines).toEqual([]);
  });

  test('a 5xx other than 500 is still the generic server notice with a 503', () => {
    const lines: string[] = [];
    const outcome = subscribePageOutcome(new ActionError({ code: 'BAD_GATEWAY', message: 'upstream' }), (l) => lines.push(l));
    expect(outcome.status).toBe(503);
    expect(outcome.notice).toBe(SERVER_ERROR_MESSAGE);
    expect(lines).toHaveLength(1);
  });
});

describe('readFormBody (the shared body reader for /notify and the module page)', () => {
  const form = (init: RequestInit = {}) =>
    new Request('http://localhost/notify?_action=notifySubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=ada%40example.com',
      ...init,
    });

  test('reads a form POST and leaves the body readable for Astro', async () => {
    const request = form();
    const data = await readFormBody(request);
    expect(data?.get('email')).toBe('ada@example.com');
    expect(request.bodyUsed).toBe(false);
  });

  test('ignores a GET and a non-form content type', async () => {
    expect(await readFormBody(new Request('http://localhost/notify'))).toBeUndefined();
    expect(await readFormBody(form({ headers: { 'content-type': 'application/json' }, body: '{"email":"a"}' }))).toBeUndefined();
  });

  test('a body that cannot be parsed gives undefined instead of throwing', async () => {
    const request = form({ headers: { 'content-type': 'multipart/form-data' }, body: 'not a multipart body' });
    expect(await readFormBody(request)).toBeUndefined();
  });
});
