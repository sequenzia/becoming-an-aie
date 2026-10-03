// src/middleware.ts
// Phase 0 placeholder written by S (blueprint section 6.4). B replaces it in Phase 1 with the
// session middleware that asks Better Auth for the session. This version is the same file
// without that auth branch: it sets both locals to null, registers shutdown, and runs the
// guard, the headers, and the cache control unchanged.
import { defineMiddleware, sequence } from 'astro:middleware';
import { env } from './lib/env';
import { registerShutdown } from './db';
import { PROTECTED_ROUTE_PATTERNS, signInPath } from './lib/guard';
import { applySecurityHeaders, applyPrivateCache } from './lib/headers';

const HEALTH_ROUTES = new Set(['/healthz', '/readyz']);

const session = defineMiddleware(async (context, next) => {
  if (context.isPrerendered || HEALTH_ROUTES.has(context.routePattern)) return next();
  registerShutdown();
  context.locals.user = null;
  context.locals.session = null;
  return next();
});

const guard = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  const protectedRoute = PROTECTED_ROUTE_PATTERNS.has(context.routePattern);
  // Body-less, so Astro serves the site's 404 page instead of plain text (docs/decisions.md, 2026-10-03).
  if (protectedRoute && !env.featureAccounts) return new Response(null, { status: 404 });
  if (protectedRoute && !context.locals.user) {
    // The redirect leaves before next() runs, so it gets the same headers here (section 6.4 prose,
    // e2e/landing.spec.ts). Recorded in docs/decisions.md for B to keep in the real middleware.
    const redirect = context.redirect(signInPath(context.originPathname), 302);
    applySecurityHeaders(redirect.headers);
    applyPrivateCache(redirect.headers);
    return redirect;
  }
  const response = await next();
  applySecurityHeaders(response.headers);
  if (context.locals.user || protectedRoute) applyPrivateCache(response.headers);
  return response;
});

export const onRequest = sequence(session, guard);
