// src/lib/auth-cookies.ts
// The session cookie names and the one way to expire them (blueprint section 6.3). Consumed by C's
// deleteAccount action and by the account page after a successful deletion.
import type { AstroCookies } from 'astro';

/**
 * Better Auth names the session cookie better-auth.session_token and, when baseURL is https, prefixes it
 * with __Secure- (better-auth/dist/cookies/index.mjs createCookieGetter, SECURE_COOKIE_PREFIX). A Set-Cookie
 * for a __Secure- name without the Secure attribute is dropped by browsers, so the expiring cookie must
 * carry the same attributes Better Auth set: path /, HttpOnly, SameSite=Lax, and Secure for the prefixed
 * name. Deleting a name that does not exist is harmless, so both are always cleared.
 */
export const SESSION_COOKIE_NAMES = ['better-auth.session_token', '__Secure-better-auth.session_token'] as const;

export function clearSessionCookies(cookies: Pick<AstroCookies, 'delete'>) {
  for (const name of SESSION_COOKIE_NAMES) {
    cookies.delete(name, { path: '/', httpOnly: true, sameSite: 'lax', secure: name.startsWith('__Secure-') });
  }
}
