// src/lib/auth-cookies.test.ts
// Blueprint section 6.3: both names are cleared with the attributes Better Auth set.
import { describe, expect, test } from 'vitest';
import { SESSION_COOKIE_NAMES, clearSessionCookies } from './auth-cookies';

describe('clearSessionCookies', () => {
  test('deletes both names, Secure on the prefixed one, with path, HttpOnly, and SameSite=Lax', () => {
    const calls: Array<{ name: string; options: unknown }> = [];
    clearSessionCookies({ delete: (name, options) => calls.push({ name, options }) });
    expect(calls).toEqual([
      { name: 'better-auth.session_token', options: { path: '/', httpOnly: true, sameSite: 'lax', secure: false } },
      { name: '__Secure-better-auth.session_token', options: { path: '/', httpOnly: true, sameSite: 'lax', secure: true } },
    ]);
    expect(calls.map((c) => c.name)).toEqual([...SESSION_COOKIE_NAMES]);
  });
});
