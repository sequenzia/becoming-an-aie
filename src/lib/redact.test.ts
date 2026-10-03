// src/lib/redact.test.ts
import { describe, expect, test } from 'vitest';
import { redactQueryParams } from './redact';

const QUERY = 'insert into "notify_subscriber" ("email", "created_at") values ($1, $2) on conflict ("email") do nothing';

describe('redactQueryParams', () => {
  test('drops the params line of a Drizzle query error and keeps the statement and the stack', () => {
    const stack = [
      `Error: Failed query: ${QUERY}`,
      'params: learner@example.com,2026-10-03T05:05:34.739Z',
      '    at PgPreparedQuery.queryWithCache (node_modules/drizzle-orm/pg-core/session.js:48:17)',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
    ].join('\n');
    const out = redactQueryParams(stack);
    expect(out).not.toContain('learner@example.com');
    expect(out).toContain(`Failed query: ${QUERY}`);
    expect(out).toContain('params: [redacted]');
    expect(out).toContain('at PgPreparedQuery.queryWithCache');
    expect(out).toContain('at process.processTicksAndRejections');
  });

  test('covers a parameter that spans lines', () => {
    const stack = ['Error: Failed query: insert into "workshop_response" ("body") values ($1)', 'params: first line of a response', 'second line of the same response', '    at run (file.js:1:1)'].join('\n');
    const out = redactQueryParams(stack);
    expect(out).toBe('Error: Failed query: insert into "workshop_response" ("body") values ($1)\nparams: [redacted]\n    at run (file.js:1:1)');
  });

  test('leaves text without a params line unchanged', () => {
    const text = 'Error: Missing required environment variable NOTIFY_TOKEN_SECRET. See .env.example.\n    at requireEnv (env.ts:50:11)';
    expect(redactQueryParams(text)).toBe(text);
    expect(redactQueryParams('')).toBe('');
  });
});
