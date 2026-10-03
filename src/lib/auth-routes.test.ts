// src/lib/auth-routes.test.ts
// Blueprint sections 6.2 and 6.5 with getAuth mocked: the single-value x-forwarded-for the catch-all route
// hands Better Auth (decision 14), the request passed through otherwise unchanged, and the 404 both routes
// answer when the build disabled accounts. The real handler and sign-out run in src/lib/auth.test.ts.
import type { APIContext } from 'astro';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { handler, signOut, flags } = vi.hoisted(() => ({
  handler: vi.fn(),
  signOut: vi.fn(),
  flags: { featureAccounts: true },
}));

vi.mock('./auth', () => ({ getAuth: async () => ({ handler, api: { signOut } }) }));
vi.mock('./env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./env')>();
  return { ...mod, env: new Proxy(mod.env, { get: (target, key) => (key === 'featureAccounts' ? flags.featureAccounts : Reflect.get(target, key)) }) };
});

import { ALL } from '../pages/api/auth/[...all]';
import { POST } from '../pages/sign-out';

const asContext = (ctx: Record<string, unknown>) => ctx as unknown as APIContext;
/** A context with the url Astro derives from the request (the forwarded headers already applied). */
const withUrl = (request: Request, rest: Record<string, unknown> = {}) => asContext({ request, url: new URL(request.url), ...rest });
const FORM = 'application/x-www-form-urlencoded';

beforeEach(() => {
  handler.mockReset();
  signOut.mockReset();
  flags.featureAccounts = true;
});

describe('/api/auth/[...all]', () => {
  test('replaces any forwarded chain with the single client address and keeps method, URL, body, and headers', async () => {
    handler.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const request = new Request('http://localhost:4321/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9, 10.0.0.1', cookie: 'a=b' },
      body: JSON.stringify({ provider: 'github' }),
    });
    const res = await ALL(asContext({ request, clientAddress: '203.0.113.7' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const forwarded = handler.mock.calls[0]![0] as Request;
    expect(forwarded.headers.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(forwarded.headers.get('cookie')).toBe('a=b');
    expect(forwarded.method).toBe('POST');
    expect(forwarded.url).toBe(request.url);
    expect(await forwarded.json()).toEqual({ provider: 'github' });
  });

  test('answers 404 when the build disabled accounts', async () => {
    flags.featureAccounts = false;
    const res = await ALL(asContext({ request: new Request('http://localhost:4321/api/auth/ok'), clientAddress: '203.0.113.7' }));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('/sign-out', () => {
  test('copies every Set-Cookie from Better Auth onto a 303 to the start page', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append('Set-Cookie', 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    headers.append('Set-Cookie', 'better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    signOut.mockResolvedValue(new Response('{"success":true}', { status: 200, headers }));
    const request = new Request('http://localhost:4321/sign-out', {
      method: 'POST',
      headers: { cookie: 'better-auth.session_token=x', origin: 'http://localhost:4321', 'content-type': FORM },
      body: '',
    });
    const res = await POST(withUrl(request));
    expect(signOut).toHaveBeenCalledWith({ headers: request.headers, asResponse: true });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    expect(res.headers.getSetCookie()).toEqual(headers.getSetCookie());
  });

  test('accepts the multipart form the header could send and a content type with parameters', async () => {
    signOut.mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    const request = new Request('http://localhost:4321/sign-out', {
      method: 'POST',
      headers: { origin: 'http://localhost:4321', 'content-type': 'multipart/form-data; boundary=----x' },
      body: '',
    });
    expect((await POST(withUrl(request))).status).toBe(303);
  });

  test('a JSON POST from another origin, which Astro lets through, answers 403 and deletes nothing (Phase 1 review round 2)', async () => {
    // Astro's origin check skips non-form content types (origin-check.js), and auth.api.signOut is a
    // server-side call outside Better Auth's router, so this route checks the origin and the content type itself.
    const request = new Request('http://localhost:4321/sign-out', {
      method: 'POST',
      headers: { cookie: 'better-auth.session_token=x', origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    });
    const res = await POST(withUrl(request));
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(signOut).not.toHaveBeenCalled();
  });

  test('a same-origin JSON POST and a form POST without an Origin header are refused too', async () => {
    const json = new Request('http://localhost:4321/sign-out', {
      method: 'POST',
      headers: { origin: 'http://localhost:4321', 'content-type': 'application/json' },
      body: '{}',
    });
    expect((await POST(withUrl(json))).status).toBe(403);
    const noOrigin = new Request('http://localhost:4321/sign-out', { method: 'POST', headers: { 'content-type': FORM }, body: '' });
    expect((await POST(withUrl(noOrigin))).status).toBe(403);
    const noContentType = new Request('http://localhost:4321/sign-out', { method: 'POST', headers: { origin: 'http://localhost:4321' } });
    expect((await POST(withUrl(noContentType))).status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  test('answers 404 when the build disabled accounts', async () => {
    flags.featureAccounts = false;
    const res = await POST(withUrl(new Request('http://localhost:4321/sign-out', { method: 'POST' })));
    expect(res.status).toBe(404);
    expect(signOut).not.toHaveBeenCalled();
  });
});
