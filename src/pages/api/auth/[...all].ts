// src/pages/api/auth/[...all].ts
// placeholder, B replaces (blueprint section 6.2). 404 when accounts are off, 501 otherwise.
import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';

export const ALL: APIRoute = () => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  return new Response('Not implemented', { status: 501 });
};
