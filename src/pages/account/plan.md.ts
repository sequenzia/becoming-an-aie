// src/pages/account/plan.md.ts
// placeholder, B replaces (blueprint section 8). Guarded by the middleware; 404 when accounts are off.
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';

export const GET: APIRoute = () => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  return new Response('Not implemented', { status: 501 });
};
