// src/lib/auth.test.ts
// Blueprint section 6.1: the option shapes, the mapper, the hooks called directly, and the hooks exercised
// on PGlite through Better Auth's own internal adapter, which is the layer the OAuth callback writes through
// (better-auth/dist/oauth2/link-account.mjs calls createUser, createAccount, createSession, updateAccount,
// linkAccount; every one runs createWithHooks or updateWithHooks). Matrix rows AC-5.9.1, AC-5.9.2, AC-5.9.7,
// EC-5.9.1, and CG-14. The effect on rows from a real provider callback is the Phase 1 gate (docs/gates.md 1.6).
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getCookies } from 'better-auth/cookies';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDb } from '../db';
import type { DbHandle } from '../db/client';
import { account, session, user } from '../db/schema';
import { ALL } from '../pages/api/auth/[...all]';
import { POST as signOut } from '../pages/sign-out';
import { getAuth, type Auth } from './auth';
import { SESSION_COOKIE_NAMES } from './auth-cookies';
import { env } from './env';

const BASE = 'http://localhost:4321/api/auth';
const HOUR = 60 * 60 * 1000;

let auth: Auth;
let h: DbHandle;

beforeAll(async () => {
  auth = await getAuth();
  h = await getDb();
});

afterAll(async () => {
  await h.close();
});

/** A provider-shaped account payload with every field this site discards set to a real-looking value. */
function tokenBearingAccount(providerId: 'github' | 'google', accountId: string) {
  return {
    providerId,
    accountId,
    accessToken: `${providerId}-access-token-secret`,
    refreshToken: `${providerId}-refresh-token-secret`,
    idToken: `${providerId}.id.token`,
    accessTokenExpiresAt: new Date(Date.now() + HOUR),
    refreshTokenExpiresAt: new Date(Date.now() + 24 * HOUR),
    scope: providerId === 'github' ? 'read:user,user:email' : 'email,profile,openid',
  };
}

const NULLED_ACCOUNT_FIELDS = ['accessToken', 'refreshToken', 'idToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope'] as const;

describe('options (AC-5.9.1, AC-5.9.7, EC-5.9.1)', () => {
  test('two social providers, no email and password, and the email routes disabled', () => {
    const o = auth.options;
    expect(Object.keys(o.socialProviders)).toEqual(['github', 'google']);
    expect(o.socialProviders.github.clientId).toBe('test-github-id');
    expect(o.socialProviders.google.clientId).toBe('test-google-id');
    expect('emailAndPassword' in o).toBe(false);
    expect(o.disabledPaths).toEqual(['/sign-up/email', '/sign-in/email', '/update-user']);
  });

  test('both providers require a verified email (docs/decisions.md, 2026-10-03, Phase 1 review round 2)', () => {
    // link-account.mjs reads socialProviders[].options.requireEmailVerification; the default is false.
    expect(auth.options.socialProviders.github.requireEmailVerification).toBe(true);
    expect(auth.options.socialProviders.google.requireEmailVerification).toBe(true);
  });

  test('base URL, base path, and trusted origins come from env and name the one origin', () => {
    const o = auth.options;
    expect(o.baseURL).toBe(env.authUrl);
    expect(o.basePath).toBe('/api/auth');
    expect(o.trustedOrigins).toEqual([env.authUrl]);
  });

  test('session handling, CSRF, and cookies stay the library defaults; linking and cookie cache are off', () => {
    const o = auth.options;
    expect('advanced' in o).toBe(false);
    expect(o.account).toEqual({ accountLinking: { enabled: false } });
    expect(o.session).toEqual({ cookieCache: { enabled: false } });
    expect('user' in o).toBe(false);
    expect(o.rateLimit).toEqual({ enabled: env.isProduction, window: 60, max: 100, customRules: { '/get-session': false } });
    expect(o.telemetry).toEqual({ enabled: false });
  });

  test('mapProfileToUser returns image undefined for both providers', async () => {
    expect(await auth.options.socialProviders.github.mapProfileToUser()).toEqual({ image: undefined });
    expect(await auth.options.socialProviders.google.mapProfileToUser()).toEqual({ image: undefined });
  });
});

describe('database hooks called directly (CG-14)', () => {
  const now = new Date();

  test('user.create.before nulls image and keeps the rest', async () => {
    const result = await auth.options.databaseHooks.user.create.before(
      { id: 'u', name: 'Ada', email: 'ada@example.com', emailVerified: true, image: 'https://avatars.example/ada.png', createdAt: now, updatedAt: now },
    );
    expect(result).toEqual({ data: { id: 'u', name: 'Ada', email: 'ada@example.com', emailVerified: true, image: null, createdAt: now, updatedAt: now } });
  });

  test('user.create.before refuses an unverified email with the callback code email_not_verified', async () => {
    const attempt = auth.options.databaseHooks.user.create.before(
      { id: 'u2', name: 'Eve', email: 'victim@example.com', emailVerified: false, image: null, createdAt: now, updatedAt: now },
    );
    await expect(attempt).rejects.toMatchObject({ status: 'FORBIDDEN', body: { code: 'email_not_verified' } });
  });

  test('session.create.before nulls ipAddress and userAgent', async () => {
    const result = await auth.options.databaseHooks.session.create.before(
      { id: 's', token: 't', userId: 'u', expiresAt: now, createdAt: now, updatedAt: now, ipAddress: '203.0.113.5', userAgent: 'Mozilla/5.0' },
    );
    expect(result.data).toMatchObject({ id: 's', token: 't', userId: 'u', ipAddress: null, userAgent: null });
  });

  test('account.create.before and account.update.before null the tokens, their expiry dates, and scope', async () => {
    const row = { id: 'a', userId: 'u', createdAt: now, updatedAt: now, ...tokenBearingAccount('github', '1') };
    const created = await auth.options.databaseHooks.account.create.before(row);
    const updated = await auth.options.databaseHooks.account.update.before({ accessToken: 'fresh', accessTokenExpiresAt: now });
    for (const field of NULLED_ACCOUNT_FIELDS) {
      expect(created.data[field], `create ${field}`).toBeNull();
      expect(updated.data[field], `update ${field}`).toBeNull();
    }
    expect(created.data).toMatchObject({ id: 'a', userId: 'u', providerId: 'github', accountId: '1' });
  });
});

describe('simulated OAuth sign-in rows on PGlite (AC-5.9.2)', () => {
  test('a new user, their provider account, and their session carry none of the discarded fields', async () => {
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createOAuthUser(
      { name: 'Ada Lovelace', email: 'Ada@Example.com', emailVerified: true, image: 'https://avatars.githubusercontent.com/u/1' },
      tokenBearingAccount('github', '1'),
    );
    const [u] = await h.db.select().from(user).where(eq(user.id, created.user.id));
    expect(u).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', emailVerified: true, image: null });

    const [a] = await h.db.select().from(account).where(eq(account.userId, created.user.id));
    expect(a).toMatchObject({ providerId: 'github', accountId: '1', password: null });
    for (const field of NULLED_ACCOUNT_FIELDS) expect(a![field], field).toBeNull();

    // createSession reads the IP and user agent from the request when there is one; the override puts
    // real-looking values into the data the hook sees, so the test proves the hook and not the absence.
    const s = await ctx.internalAdapter.createSession(created.user.id, false, { ipAddress: '203.0.113.5', userAgent: 'Mozilla/5.0 (test)' });
    const [row] = await h.db.select().from(session).where(eq(session.id, s.id));
    expect(row).toMatchObject({ userId: created.user.id, token: s.token, ipAddress: null, userAgent: null });
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('a later sign-in refresh through updateAccount leaves the token columns null', async () => {
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createOAuthUser(
      { name: 'Grace', email: 'grace@example.com', emailVerified: true },
      tokenBearingAccount('google', 'sub-2'),
    );
    // link-account.mjs freshTokens: the provider id, the three tokens, and the two expiry dates.
    await ctx.internalAdapter.updateAccount(created.account.id, {
      providerId: 'google',
      idToken: 'google.fresh.id.token',
      accessToken: 'google-fresh-access-token',
      refreshToken: 'google-fresh-refresh-token',
      accessTokenExpiresAt: new Date(Date.now() + HOUR),
      refreshTokenExpiresAt: new Date(Date.now() + 24 * HOUR),
    });
    const [a] = await h.db.select().from(account).where(eq(account.id, created.account.id));
    expect(a).toMatchObject({ providerId: 'google', accountId: 'sub-2', userId: created.user.id });
    for (const field of NULLED_ACCOUNT_FIELDS) expect(a![field], field).toBeNull();
  });

  test('linkAccount, the explicit path, writes the same nulls', async () => {
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createOAuthUser({ name: 'Linus', email: 'linus@example.com', emailVerified: true }, tokenBearingAccount('github', '3'));
    const linked = await ctx.internalAdapter.linkAccount({ ...tokenBearingAccount('google', 'sub-3'), userId: created.user.id });
    const [a] = await h.db.select().from(account).where(eq(account.id, linked.id));
    expect(a).toMatchObject({ providerId: 'google', accountId: 'sub-3', userId: created.user.id });
    for (const field of NULLED_ACCOUNT_FIELDS) expect(a![field], field).toBeNull();
  });
});

describe('an unverified provider email never becomes an account (Phase 1 review round 2)', () => {
  /** The endpoint context handleOAuthUserInfo reads: the auth context and the request (link-account.mjs). */
  async function endpointContext() {
    return { context: await auth.$context, request: new Request(`${BASE}/callback/github`) } as unknown as Parameters<typeof handleOAuthUserInfo>[0];
  }

  test('the callback path rejects the sign-in, stores no row, and names the code the sign-in page explains', async () => {
    const c = await endpointContext();
    const attempt = handleOAuthUserInfo(c, {
      userInfo: { id: 'gh-victim', name: 'Eve', email: 'Victim@Example.com', emailVerified: false },
      account: tokenBearingAccount('github', 'gh-victim'),
      callbackURL: '/account',
    });
    await expect(attempt).rejects.toMatchObject({ body: { code: 'email_not_verified' } });
    expect(await h.db.select({ id: user.id }).from(user).where(eq(user.email, 'victim@example.com'))).toEqual([]);
    expect(await h.db.select({ id: account.id }).from(account).where(eq(account.accountId, 'gh-victim'))).toEqual([]);
  });

  test('the same path with a verified email creates the user, the account, and a session', async () => {
    const c = await endpointContext();
    const result = await handleOAuthUserInfo(c, {
      userInfo: { id: 'gh-owner', name: 'Owner', email: 'owner@example.com', emailVerified: true },
      account: tokenBearingAccount('github', 'gh-owner'),
      callbackURL: '/account',
    });
    expect(result.error).toBeNull();
    expect(result.data?.user.email).toBe('owner@example.com');
    expect(result.data?.session.userId).toBe(result.data?.user.id);
    const [row] = await h.db.select({ emailVerified: user.emailVerified, image: user.image }).from(user).where(eq(user.email, 'owner@example.com'));
    expect(row).toEqual({ emailVerified: true, image: null });
  });

  test('an existing verified account keeps access when the provider later reports the address as unverified', async () => {
    const c = await endpointContext();
    const first = await handleOAuthUserInfo(c, {
      userInfo: { id: 'sub-keep', name: 'Keep', email: 'keep@example.com', emailVerified: true },
      account: tokenBearingAccount('google', 'sub-keep'),
      callbackURL: '/account',
    });
    expect(first.error).toBeNull();
    const again = await handleOAuthUserInfo(c, {
      userInfo: { id: 'sub-keep', name: 'Keep', email: 'keep@example.com', emailVerified: false },
      account: tokenBearingAccount('google', 'sub-keep'),
      callbackURL: '/account',
    });
    expect(again.error).toBeNull();
    expect(again.data?.user.id).toBe(first.data?.user.id);
  });
});

describe('the handler over PGlite', () => {
  const json = (path: string, body: unknown) =>
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:4321' },
      body: JSON.stringify(body),
    });

  test('answers ok', async () => {
    const res = await auth.handler(new Request(`${BASE}/ok`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('the email sign-in and sign-up routes are gone', async () => {
    for (const path of ['/sign-in/email', '/sign-up/email']) {
      const res = await auth.handler(json(path, { name: 'x', email: 'x@example.com', password: 'a-long-enough-password' }));
      expect(res.status, path).toBe(404);
    }
  });

  test('a signed-in learner cannot write name or image through /update-user (AC-5.9.2)', async () => {
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createOAuthUser({ name: 'Mary', email: 'mary@example.com', emailVerified: true }, tokenBearingAccount('github', '4'));
    const s = await ctx.internalAdapter.createSession(created.user.id, false);
    // The session cookie Better Auth sets: the token, a dot, and a base64 HMAC-SHA256 of the token under the
    // secret, URL-encoded (better-call/dist/crypto.mjs signCookieValue). get-session proves the cookie is live.
    const signature = createHmac('sha256', ctx.secret).update(s.token).digest('base64');
    const cookie = `${SESSION_COOKIE_NAMES[0]}=${encodeURIComponent(`${s.token}.${signature}`)}`;
    const live = await auth.handler(new Request(`${BASE}/get-session`, { headers: { cookie } }));
    expect(live.status).toBe(200);
    expect(((await live.json()) as { user: { id: string } }).user.id).toBe(created.user.id);

    const res = await auth.handler(
      new Request(`${BASE}/update-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:4321', cookie },
        body: JSON.stringify({ name: 'A'.repeat(5000), image: 'https://evil.example/track.png?u=1' }),
      }),
    );
    expect(res.status).toBe(404);
    const [row] = await h.db.select({ name: user.name, image: user.image }).from(user).where(eq(user.id, created.user.id));
    expect(row).toEqual({ name: 'Mary', image: null });
  });

  test('no cookie means no session', async () => {
    const res = await auth.handler(new Request(`${BASE}/get-session`));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('sign-in/social sends the browser to each provider with the callback under the base URL', async () => {
    const expected = {
      github: { authorize: 'https://github.com/login/oauth/authorize', scope: 'user:email', clientId: 'test-github-id' },
      google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'openid', clientId: 'test-google-id' },
    } as const;
    for (const provider of ['github', 'google'] as const) {
      const res = await auth.handler(json('/sign-in/social', { provider, callbackURL: '/account', errorCallbackURL: '/sign-in' }));
      expect(res.status, provider).toBe(200);
      const body = (await res.json()) as { url: string; redirect: boolean };
      expect(body.redirect).toBe(true);
      const url = new URL(body.url);
      expect(url.origin + url.pathname).toBe(expected[provider].authorize);
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4321/api/auth/callback/' + provider);
      expect(url.searchParams.get('scope')).toContain(expected[provider].scope);
      expect(url.searchParams.get('client_id')).toBe(expected[provider].clientId);
      expect(url.searchParams.get('state')).toBeTruthy();
    }
  });

  test('the catch-all route hands the request to the handler', async () => {
    const ctx = { request: new Request(`${BASE}/ok`), clientAddress: '203.0.113.7' };
    const res = await ALL(ctx as unknown as Parameters<typeof ALL>[0]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('the sign-out endpoint answers 303 to the start page with the expiring session cookie', async () => {
    const request = new Request('http://localhost:4321/sign-out', {
      method: 'POST',
      headers: { origin: 'http://localhost:4321', 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const ctx = { request, url: new URL(request.url) };
    const res = await signOut(ctx as unknown as Parameters<typeof signOut>[0]);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    const cookies = res.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);
    const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAMES[0]}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/Max-Age=0/i);
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
  });
});

describe('session cookie names (section 6.3)', () => {
  test('match the names Better Auth derives from an http and from an https base URL', () => {
    const plain = getCookies({ baseURL: 'http://localhost:4321' });
    expect(plain.sessionToken.name).toBe(SESSION_COOKIE_NAMES[0]);
    expect(plain.sessionToken.attributes).toMatchObject({ secure: false, httpOnly: true, sameSite: 'lax', path: '/' });
    const secure = getCookies({ baseURL: 'https://aie.example.org' });
    expect(secure.sessionToken.name).toBe(SESSION_COOKIE_NAMES[1]);
    expect(secure.sessionToken.attributes).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
  });
});
