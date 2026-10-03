// src/pages/account/plan.md.ts
// Markdown download of a self-assessment plan (blueprint section 8). Guarded by the middleware; this
// file checks the session again so a direct call without one answers 404 rather than a body. The plan
// text is the learner's own Markdown, served verbatim as a download and never rendered (NFR-6.2.3).
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getDb } from '../../db';
import { getAssessment } from '../../lib/assessment';
import { env } from '../../lib/env';
import { applyPrivateCache } from '../../lib/headers';
import { redactQueryParams } from '../../lib/redact';

/** The largest value the integer column holds (drizzle/0000_init.sql: "version" integer). */
const VERSION_MAX = 2_147_483_647;

/**
 * ?version=n, a positive integer within the column's range. Missing means the latest version. Anything else
 * is a 404: a value past int4 used to reach the driver and come back as a 500 with the bound parameters in
 * Astro's log (docs/decisions.md, 2026-10-03, Phase 1 review round 2).
 */
const versionSchema = z.coerce.number().int().min(1).max(VERSION_MAX).optional();

export const GET: APIRoute = async (ctx) => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  const user = ctx.locals.user;
  if (!user) return new Response('Not found', { status: 404 });
  const parsed = versionSchema.safeParse(ctx.url.searchParams.get('version') ?? undefined);
  if (!parsed.success) return new Response('Not found', { status: 404 });
  let row: Awaited<ReturnType<typeof getAssessment>>;
  try {
    const { db } = await getDb();
    row = await getAssessment(db, user.id, parsed.data);
  } catch (err) {
    // The log gets the failure without its bound parameters (the learner's id and the version), the same rule
    // guardServerErrors and /readyz follow; the learner gets a status and no detail.
    const detail = err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err);
    console.error(`[account] plan download failed: ${redactQueryParams(detail)}`);
    const headers = new Headers();
    applyPrivateCache(headers);
    return new Response(null, { status: 503, headers });
  }
  if (!row) return new Response('Not found', { status: 404 });
  // The file name is built from the row's own version number, never from the query text.
  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="ai-engineering-plan-v${row.version}.md"`,
  });
  applyPrivateCache(headers);
  return new Response(row.planText, { status: 200, headers });
};
