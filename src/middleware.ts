// src/middleware.ts
// Session into locals, route guard, headers (blueprint section 6.4). Replaces S's Phase 0 placeholder.
// Order matters: Astro runs this sequence first and then, inside next(), a form action and the page
// (astro/dist/core/routing/handler.js actionsAndPages), so an action handler sees locals.user.
import { defineMiddleware, sequence } from 'astro:middleware';
import { env } from './lib/env';
import { getAuth } from './lib/auth';
import { registerShutdown } from './db';
import { PROTECTED_ROUTE_PATTERNS, signInPath } from './lib/guard';
import { applySecurityHeaders, applyPrivateCache } from './lib/headers';

/** F's health endpoints never touch Better Auth or the database (section 8). */
const HEALTH_ROUTES = new Set(['/healthz', '/readyz']);

const session = defineMiddleware(async (context, next) => {
  // Prerendered pages run this at build time and have no request to read (fact 0.2.3).
  if (context.isPrerendered || HEALTH_ROUTES.has(context.routePattern)) return next();
  registerShutdown();
  context.locals.user = null;
  context.locals.session = null;
  if (!env.featureAccounts) return next();
  const auth = await getAuth();
  // Every request looks the session up; cookieCache is off, so a deleted session is dead at once (CG-9).
  const { headers, response: result } = await auth.api.getSession({ headers: context.request.headers, returnHeaders: true });
  context.locals.user = result?.user ?? null;
  context.locals.session = result?.session ?? null;
  const response = await next();
  // Open item 5, decided: the cookies getSession sets are forwarded unchanged. Past updateAge Better Auth
  // extends the row and re-sets the session cookie with a fresh Max-Age (api/routes/session.mjs); an
  // expired or unknown token gets its expiring cookie. Dropping them would leave the browser cookie on
  // its sign-in Max-Age while the row lived on (docs/decisions.md, 2026-10-03).
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) {
    // A response that changes cookies is never a public one. Without this, an expired token on /modules left
    // with the catalog's public, max-age=300 next to three expiring Set-Cookie headers (Phase 1 review round 2).
    // The page has already set its own directive inside next(), so this write wins.
    applyPrivateCache(response.headers);
    for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  }
  return response;
});

const guard = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  const protectedRoute = PROTECTED_ROUTE_PATTERNS.has(context.routePattern);
  // Body-less, so Astro serves the site's 404 page instead of plain text (docs/decisions.md, 2026-10-03).
  if (protectedRoute && !env.featureAccounts) return new Response(null, { status: 404 });
  if (protectedRoute && !context.locals.user) {
    // The redirect leaves before next() runs, so it gets the same headers here (section 6.4 prose,
    // e2e/landing.spec.ts, docs/decisions.md 2026-09-15).
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
