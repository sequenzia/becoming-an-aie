// src/lib/auth-cookies.ts
// placeholder, B replaces (blueprint section 6.3). The names are the contracted data; the function is neutral.
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAMES = ['better-auth.session_token', '__Secure-better-auth.session_token'] as const;

export function clearSessionCookies(_cookies: Pick<AstroCookies, 'delete'>) {}
