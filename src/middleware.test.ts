// src/middleware.test.ts
// Blueprint section 6.4 through the composed onRequest with a fake context: the session branch, the guard,
// the headers, the cache control, and the forwarded session cookies (open item 5). getAuth and the database
// are mocked; the real getSession path runs in src/lib/auth.test.ts.
import type { APIContext, MiddlewareNext } from 'astro';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getSession, registerShutdown, flags } = vi.hoisted(() => ({
  getSession: vi.fn(),
  registerShutdown: vi.fn(),
  flags: { featureAccounts: true },
}));

vi.mock('./lib/auth', () => ({ getAuth: async () => ({ api: { getSession } }) }));
vi.mock('./db', () => ({ registerShutdown }));
vi.mock('./lib/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./lib/env')>();
  return { ...mod, env: new Proxy(mod.env, { get: (target, key) => (key === 'featureAccounts' ? flags.featureAccounts : Reflect.get(target, key)) }) };
});

import { onRequest } from './middleware';

const USER = { id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() };
const SESSION = { id: 's1', token: 't', userId: 'u1', expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null };

function context(over: Partial<{ routePattern: string; originPathname: string; isPrerendered: boolean; cookie: string }> = {}) {
  const headers = new Headers();
  if (over.cookie) headers.set('cookie', over.cookie);
  const routePattern = over.routePattern ?? '/modules';
  return {
    isPrerendered: over.isPrerendered ?? false,
    routePattern,
    originPathname: over.originPathname ?? `${routePattern}/`,
    request: new Request(`http://localhost:4321${routePattern}`, { headers }),
    locals: {} as App.Locals,
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { Location: path } }),
  } as unknown as APIContext;
}

const page = vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
const next = page as unknown as MiddlewareNext;

/** Runs the composed middleware. A MiddlewareHandler may resolve to void; this sequence always answers. */
async function run(ctx: APIContext): Promise<Response> {
  const res = await onRequest(ctx, next);
  if (!(res instanceof Response)) throw new Error('the middleware returned no response');
  return res;
}

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

function expectSecurityHeaders(res: Response) {
  for (const [name, value] of Object.entries(SECURITY)) expect(res.headers.get(name), name).toBe(value);
}

beforeEach(() => {
  getSession.mockReset();
  registerShutdown.mockClear();
  page.mockClear();
  flags.featureAccounts = true;
  getSession.mockResolvedValue({ headers: new Headers(), response: null });
});

describe('session middleware', () => {
  test('prerendered pages pass straight through', async () => {
    const ctx = context({ isPrerendered: true, routePattern: '/' });
    const res = await run(ctx);
    expect(res.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
    expect(registerShutdown).not.toHaveBeenCalled();
    expect(res.headers.get('x-frame-options')).toBeNull();
  });

  test('health routes never touch Better Auth but still get the security headers', async () => {
    const res = await run(context({ routePattern: '/healthz' }));
    expect(getSession).not.toHaveBeenCalled();
    expect(registerShutdown).not.toHaveBeenCalled();
    expectSecurityHeaders(res);
    expect(res.headers.get('cache-control')).toBeNull();
  });

  test('an anonymous request asks for the session with the request headers and gets null locals', async () => {
    const ctx = context({ cookie: 'aie-theme=dark' });
    const res = await run(ctx);
    expect(registerShutdown).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledWith({ headers: ctx.request.headers, returnHeaders: true });
    expect(ctx.locals.user).toBeNull();
    expect(ctx.locals.session).toBeNull();
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
    expect(res.headers.get('cache-control')).toBeNull();
  });

  test('a signed-in request puts user and session into locals and leaves with private, no-store', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: { user: USER, session: SESSION } });
    const ctx = context();
    const res = await run(ctx);
    expect(ctx.locals.user).toEqual(USER);
    expect(ctx.locals.session).toEqual(SESSION);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toMatch(/cookie/i);
    expectSecurityHeaders(res);
  });

  test('the cookies getSession sets are forwarded onto the response unchanged (open item 5)', async () => {
    const set = new Headers();
    set.append('Set-Cookie', 'better-auth.session_token=abc.def; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax');
    set.append('Set-Cookie', 'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    getSession.mockResolvedValue({ headers: set, response: { user: USER, session: SESSION } });
    const res = await run(context());
    expect(res.headers.getSetCookie()).toEqual(set.getSetCookie());
  });

  test('a response that forwards a Set-Cookie is private, no-store even when the page asked for a public cache (Phase 1 review round 2)', async () => {
    // An expired or unknown token: getSession answers null and sets the expiring cookies. The catalog, seeing
    // no user, applies public, max-age=300 inside next(); the middleware must override it.
    const set = new Headers();
    set.append('Set-Cookie', 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    set.append('Set-Cookie', 'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    getSession.mockResolvedValue({ headers: set, response: null });
    page.mockImplementationOnce(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=300', vary: 'Cookie' } }));
    const ctx = context({ cookie: 'better-auth.session_token=stale.signature' });
    const res = await run(ctx);
    expect(ctx.locals.user).toBeNull();
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toBe('Cookie');
    expect(res.headers.getSetCookie()).toEqual(set.getSetCookie());
  });

  test('without a Set-Cookie from getSession the page keeps its public cache directive', async () => {
    page.mockImplementationOnce(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=300', vary: 'Cookie' } }));
    const res = await run(context());
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  test('with accounts off the locals are null and Better Auth is never created', async () => {
    flags.featureAccounts = false;
    const ctx = context();
    const res = await run(ctx);
    expect(getSession).not.toHaveBeenCalled();
    expect(ctx.locals.user).toBeNull();
    expect(res.status).toBe(200);
  });
});

describe('guard middleware', () => {
  for (const [routePattern, originPathname] of [
    ['/account', '/account/'],
    ['/assessment', '/assessment/'],
    ['/account/plan.md', '/account/plan.md'],
  ] as const) {
    test(`${routePattern} without a session redirects to sign-in with the encoded path and is never cached`, async () => {
      const res = await run(context({ routePattern, originPathname }));
      expect(page).not.toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/sign-in?next=${encodeURIComponent(originPathname)}`);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(res.headers.get('vary')).toMatch(/cookie/i);
      expectSecurityHeaders(res);
    });
  }

  test('a protected route with a session renders and leaves private', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: { user: USER, session: SESSION } });
    const res = await run(context({ routePattern: '/account' }));
    expect(page).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  test('a protected route with accounts off answers a body-less 404', async () => {
    flags.featureAccounts = false;
    const res = await run(context({ routePattern: '/account' }));
    expect(res.status).toBe(404);
    expect(res.body).toBeNull();
    expect(page).not.toHaveBeenCalled();
  });

  test('an unguarded route never redirects without a session', async () => {
    const res = await run(context({ routePattern: '/sign-in' }));
    expect(res.status).toBe(200);
    expect(page).toHaveBeenCalledTimes(1);
  });
});
