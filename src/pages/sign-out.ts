// src/pages/sign-out.ts
// The header's sign-out form posts here without JavaScript (blueprint section 6.5). Better Auth deletes
// the session row and answers with the expiring cookies; those Set-Cookie headers are copied onto a
// 303 to the start page.
//
// Origin check. Astro's security.checkOrigin refuses a cross-site POST only when the content type is
// form-like or absent (astro/dist/core/app/origin-check.js), and auth.api.signOut is a server-side call
// that never passes Better Auth's own originCheckMiddleware. A POST with Content-Type: application/json
// and a foreign Origin therefore reached the sign-out and deleted the session row. No browser can send
// that today (the cookie is SameSite=Lax and a JSON body needs a CORS preflight), so this route now
// requires what the header form sends and nothing else: a same-origin Origin header and a form content
// type, the same rule /api/auth/sign-out enforces (docs/decisions.md, 2026-10-03, Phase 1 review round 2).
import type { APIRoute } from 'astro';
import { env } from '../lib/env';
import { getAuth } from '../lib/auth';

const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data'];

/** True for the request the header form makes: same-origin, and a form body. */
function isSignOutFormRequest(request: Request, origin: string): boolean {
  if (request.headers.get('origin') !== origin) return false;
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  return FORM_CONTENT_TYPES.some((type) => contentType.includes(type));
}

export const POST: APIRoute = async (ctx) => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  if (!isSignOutFormRequest(ctx.request, ctx.url.origin)) {
    return new Response('Cross-site POST form submissions are forbidden', { status: 403 });
  }
  const auth = await getAuth();
  const res = await auth.api.signOut({ headers: ctx.request.headers, asResponse: true });
  const headers = new Headers({ Location: '/' });
  for (const cookie of res.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
};
