// src/lib/auth.ts
// placeholder, B replaces (blueprint section 6.1). Contracted signature with a neutral body.
// Nothing calls it in Phase 0: the middleware placeholder never asks for a session and the
// auth route placeholder answers 404 or 501 without it.
import type { betterAuth } from 'better-auth';

export type Auth = ReturnType<typeof betterAuth>;

export async function getAuth(): Promise<Auth> {
  return null as unknown as Auth;
}
