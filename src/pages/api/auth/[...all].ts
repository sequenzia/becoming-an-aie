// src/pages/api/auth/[...all].ts
// The Better Auth handler (blueprint section 6.2). Sign-in, the OAuth callbacks, and the client's
// sign-out all go through here, and the cookies Better Auth sets pass through unchanged. Answers 404
// when the build disabled accounts (section 14.7). A text body, as the API endpoints keep (docs/decisions.md).
import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { getAuth } from '../../../lib/auth';

export const ALL: APIRoute = async (ctx) => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  const auth = await getAuth();
  // Better Auth's rate limiter rejects a comma-separated X-Forwarded-For chain and falls back to one
  // shared bucket (@better-auth/core utils/ip.mjs). clientAddress is the real client once
  // security.allowedDomains matches the route host, so hand it over as a single value (decision 14).
  const headers = new Headers(ctx.request.headers);
  headers.set('x-forwarded-for', ctx.clientAddress);
  const request = new Request(ctx.request, { headers });
  return auth.handler(request);
};
