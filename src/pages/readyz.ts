// src/pages/readyz.ts
// Readiness. Blueprint section 13.4. Returns only ok true or false. Details go to the server log;
// the endpoint is reachable through the public Route (decision 39). The middleware skips this route.
import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { missingRequiredEnv } from '../lib/env';
import { redactQueryParams } from '../lib/redact';

/** Returns only ok true or false. Details go to the server log; the endpoint is reachable through the public Route. */
export const GET: APIRoute = async () => {
  const missing = missingRequiredEnv();
  if (missing.length > 0) {
    console.error('[readyz] missing environment variables:', missing.join(', '));
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const { db } = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (err) {
    // A Drizzle query error names its bound parameters; none here today, redacted in case a check gains some.
    console.error('[readyz] database check failed:', err instanceof Error ? redactQueryParams(err.message) : err);
    return Response.json({ ok: false }, { status: 503 });
  }
};
