// src/pages/healthz.ts
// Liveness. Answers as soon as the process serves requests. No environment or database check.
// The middleware skips this route (HEALTH_ROUTES in src/middleware.ts). Blueprint section 13.4.
import type { APIRoute } from 'astro';
export const GET: APIRoute = () => Response.json({ ok: true });
