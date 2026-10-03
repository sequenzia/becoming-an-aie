// src/lib/redact.ts
// Keeps bound query parameters out of the server log. Drizzle formats a failed query as
// `Failed query: <sql>\nparams: <values>` (drizzle-orm/errors.js, DrizzleQueryError), and the values can
// hold a learner's address or response text. Every place that logs a caught database error passes the
// text through here first: guardServerErrors in actions-guard.ts and the /readyz handler
// (docs/decisions.md, 2026-10-03).

/**
 * Replaces everything after `params: ` with `[redacted]`, up to the first stack frame. A multi-line
 * parameter is covered too, because the match runs until a line that starts like a stack frame.
 */
export function redactQueryParams(text: string): string {
  return text.replace(/(\nparams: )[^\n]*(?:\n(?!\s+at\s)[^\n]*)*/, '$1[redacted]');
}
