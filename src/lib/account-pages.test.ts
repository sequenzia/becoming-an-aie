// src/lib/account-pages.test.ts
// B's pages through the Container API (blueprint sections 6.5, 6.6, 8): /sign-in in each state, /account with
// a seeded learner on PGlite and with a simulated action result in locals, /account/deleted, and the plan
// download endpoint called directly. The action payload is serialized through getActionContext, the public
// API middleware uses for the same job, so the page reads it exactly as it would after a form POST.
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { ActionError, getActionContext } from 'astro:actions';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getDb } from '../db';
import type { DbHandle } from '../db/client';
import { account, moduleProgress, notifySubscriber, selfAssessment, selfCheckResult, session, user, workshopResponse } from '../db/schema';
import AccountPage from '../pages/account/index.astro';
import * as DeletedModule from '../pages/account/deleted.astro';
import { GET as planDownload } from '../pages/account/plan.md';
import SignInPage from '../pages/sign-in.astro';
import { getPublishedModules } from './modules';
import type { Plan } from './plan';

const { getAssessment } = vi.hoisted(() => ({ getAssessment: vi.fn() }));
vi.mock('./assessment', () => ({ getAssessment }));

const T0 = new Date('2026-09-16T09:00:00Z');
const T1 = new Date('2026-09-17T09:00:00Z');
const FAR = new Date('2027-01-01T00:00:00Z');
const INJECTION = '<script>alert(1)</script> **bold** [x](y)';
/** The session of the request itself, so the page can mark it among the stored sessions. */
const SESSION: NonNullable<App.Locals['session']> = {
  id: 's-page',
  token: 'tok-page',
  userId: 'u-page',
  expiresAt: FAR,
  createdAt: T0,
  updatedAt: T0,
  ipAddress: null,
  userAgent: null,
};
const USER: NonNullable<App.Locals['user']> = {
  id: 'u-page',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  image: null,
  createdAt: T0,
  updatedAt: T0,
};

let container: AstroContainer;
let h: DbHandle;

beforeAll(async () => {
  container = await AstroContainer.create();
  h = await getDb();
  const plan: Plan = {
    schema: 1,
    generatedAt: T1.toISOString(),
    kind: 'ranked',
    context: { role: 'Backend engineer', feature: 'Search', ownsSystem: 'partly' },
    intro: '',
    areas: [],
    focus: [],
    nextSteps: [],
    missingModules: [],
  };
  await h.db.insert(user).values({ ...USER, createdAt: T0, updatedAt: T0 });
  await h.db.insert(account).values({ id: 'a-page', accountId: '77', providerId: 'github', userId: USER.id, createdAt: T0, updatedAt: T0 });
  await h.db.insert(session).values([
    { id: SESSION.id, token: 'tok-page', userId: USER.id, expiresAt: FAR, createdAt: T0, updatedAt: T0 },
    { id: 's-page-other', token: 'tok-page-other', userId: USER.id, expiresAt: FAR, createdAt: T1, updatedAt: T1 },
  ]);
  await h.db.insert(notifySubscriber).values({ email: USER.email, createdAt: T0 });
  await h.db.insert(moduleProgress).values([
    { userId: USER.id, moduleSlug: 'orientation', status: 'completed', startedAt: T0, completedAt: T1 },
    { userId: USER.id, moduleSlug: 'models', status: 'in_progress', startedAt: T1, completedAt: null },
  ]);
  await h.db.insert(workshopResponse).values({ userId: USER.id, moduleSlug: 'models', kind: 'workshop', body: INJECTION, createdAt: T1, updatedAt: T1 });
  await h.db.insert(selfCheckResult).values({ userId: USER.id, moduleSlug: 'models', attempts: 3, passed: false, answers: {}, updatedAt: T1 });
  await h.db.insert(selfAssessment).values({
    userId: USER.id,
    version: 1,
    ratings: { 'models-testing': 1 },
    context: plan.context,
    plan,
    planText: '# My plan\n\n<script>x</script>',
    createdAt: T1,
    updatedAt: T1,
  });
});

afterAll(async () => {
  await h.close();
});

type Component = Parameters<AstroContainer['renderToResponse']>[0];

async function respond(component: Component, path: string, locals: Record<string, unknown> = {}): Promise<Response> {
  return container.renderToResponse(component, {
    request: new Request(`http://localhost:4321${path}`),
    routeType: 'page',
    locals: { user: null, session: null, ...locals } as App.Locals,
  });
}

/** What Astro leaves in locals after a form POST ran an action, serialized the way its middleware does. */
function actionPayload(actionName: string, result: { data: unknown; error: undefined } | { data: undefined; error: ActionError }) {
  const api = { request: new Request('http://localhost:4321/account'), url: new URL('http://localhost:4321/account'), locals: {} } as unknown as APIContext;
  const { serializeActionResult } = getActionContext(api);
  return { _actionPayload: { actionName, actionResult: serializeActionResult(result as never) } };
}

const countH1 = (html: string) => (html.match(/<h1\b/g) ?? []).length;

/** The response body without the data-astro-cid attributes scoped styles add; the contracts are about the rest. */
async function text(res: Response): Promise<string> {
  return (await res.text()).replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

describe('/sign-in', () => {
  test('renders both provider buttons, the storage line, the privacy link, and the no-JavaScript line', async () => {
    const res = await respond(SignInPage, '/sign-in');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const html = await text(res);
    expect(countH1(html)).toBe(1);
    expect(html).toContain('data-provider="github"');
    expect(html).toContain('data-provider="google"');
    expect(html).toContain('Sign in with GitHub');
    expect(html).toContain('Sign in with Google');
    expect(html).toContain('data-next="/account"');
    expect(html).toContain('We store your provider account id, your email, and your display name. Nothing else.');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('<noscript>');
    expect(html).not.toContain('role="alert"');
  });

  test('passes a safe next path through and replaces an unsafe one', async () => {
    expect(await text(await respond(SignInPage, '/sign-in?next=%2Fmodules%2Fmodels'))).toContain('data-next="/modules/models"');
    expect(await text(await respond(SignInPage, '/sign-in?next=https%3A%2F%2Fevil.example'))).toContain('data-next="/account"');
  });

  test('explains a callback error code in an alert', async () => {
    for (const code of ['account_not_linked', 'unable_to_link_account']) {
      const html = await text(await respond(SignInPage, `/sign-in?error=${code}`));
      expect(html).toContain('role="alert"');
      expect(html).toContain('Merging accounts is not offered.');
    }
    const generic = await text(await respond(SignInPage, '/sign-in?error=invalid_code'));
    expect(generic).toContain('Sign-in did not complete. Try again.');
  });

  test('sends a signed-in learner on to the safe next path', async () => {
    const res = await respond(SignInPage, '/sign-in?next=%2Fmodules%2Fmodels', { user: USER });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/modules/models');
    const unsafe = await respond(SignInPage, '/sign-in?next=%2F%2Fevil.example', { user: USER });
    expect(unsafe.headers.get('location')).toBe('/account');
  });

  test('a control character in next is neither forwarded nor a 500 for a signed-in learner', async () => {
    // A tab survives the old checks and a browser strips it before parsing, so "/\t/evil.example" would have
    // redirected off the site; a newline would have thrown inside Headers.append (a 500 on the built server).
    for (const next of ['%2F%09%2Fevil.example', '%2F%09%09%2F%2Fevil.example', '%2F%0A%2Fevil.example', '%2F%0D%0A%2Fevil.example', '%2F..%2F%2Fevil.example']) {
      const res = await respond(SignInPage, `/sign-in?next=${next}`, { user: USER });
      expect(res.status, next).toBe(302);
      expect(res.headers.get('location'), next).toBe('/account');
    }
    // Signed out, the same value never reaches the OAuth callbackURL either.
    expect(await text(await respond(SignInPage, '/sign-in?next=%2F%09%2Fevil.example'))).toContain('data-next="/account"');
  });
});

describe('/account', () => {
  test('without a session it redirects to sign-in', async () => {
    const res = await respond(AccountPage, '/account');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/sign-in?next=%2Faccount');
  });

  test('lists every stored row in plain language with the forms and the three notes', async () => {
    const res = await respond(AccountPage, '/account', { user: USER, session: SESSION });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const html = await text(res);
    expect(countH1(html)).toBe(1);

    // Profile.
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('ada@example.com');
    expect(html).toContain('GitHub');
    expect(html).toContain('<time datetime="2026-09-16">2026-09-16</time>');
    expect(html).toContain('action="?_action=updateDisplayName"');
    expect(html).toMatch(/<input[^>]*name="name"[^>]*value="Ada Lovelace"/);
    expect(html).toContain('maxlength="80"');
    expect(html).toContain('Signing in with the other provider using the same email is rejected. Merging accounts is not offered.');

    // Sessions: both rows, the request's own marked, each with its expiry (the privacy notice says it is kept).
    expect(html).toContain('<h2 id="sessions">Sessions</h2>');
    expect(html.match(/expires\s*<time datetime="2027-01-01">2027-01-01<\/time>/g)).toHaveLength(2);
    expect(html.match(/This browser\./g)).toHaveLength(1);

    // The notify-me row under the same email, which deletion removes.
    expect(html).toContain('<h2 id="notify">Launch notifications</h2>');
    expect(html).toContain('Your email is on the notify-me list since <time datetime="2026-09-16">2026-09-16</time>.');
    expect(html).toContain('Not confirmed yet.');

    // Progress: the completed count is over the published modules only.
    const published = await getPublishedModules();
    expect(html).toContain(`1 of ${published.length} modules complete.`);
    expect(html).toContain('Orientation');
    expect(html).toContain('Complete');
    expect(html).toContain('In progress');

    // Responses are escaped plain text, never markup (NFR-6.2.3).
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; **bold** [x](y)');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('class="learner-text"');

    // Self-checks and the orientation note (deviation 15.3.3).
    expect(html).toContain('3 attempts');
    expect(html).toContain('not passed yet');
    expect(html).toContain('The orientation self-check is not stored on the server. It stays in your browser.');

    // Assessments: a rating reads as item and label, the plan text is escaped, the download link names the version.
    expect(html).toContain('Version 1');
    expect(html).toMatch(/(Testing discipline|models-testing): Aware/);
    expect(html).toContain('href="/account/plan.md?version=1"');
    expect(html).toContain('Download as Markdown');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Partly');

    // Feedback note (CG-15) and the one-click deletion form (AC-5.9.5, deviation 15.3.7).
    expect(html).toContain('It is not deleted with the account because it is not linked to it.');
    expect(html).toContain('action="?_action=deleteAccount"');
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="confirm"[^>]*value="delete"/);
    expect(html).toMatch(/<button[^>]*aria-describedby="delete-help"[^>]*>\s*Delete my account and all my data\s*<\/button>/);
    expect(html).toContain('It cannot be undone.');
  });

  test('after a successful deletion it redirects to the confirmation page', async () => {
    const res = await respond(AccountPage, '/account', { user: USER, ...actionPayload('deleteAccount', { data: { deleted: true }, error: undefined }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/account/deleted');
  });

  test('after a successful rename it redirects to the profile section', async () => {
    const res = await respond(AccountPage, '/account', { user: USER, ...actionPayload('updateDisplayName', { data: { name: 'Ada' }, error: undefined }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/account#profile');
  });

  test('a rejected name re-renders with the message on the field and the posted text', async () => {
    const error = new ActionError({ code: 'BAD_REQUEST', message: 'Enter a name of at most 80 characters.' });
    const request = new Request('http://localhost:4321/account?_action=updateDisplayName', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'x'.repeat(81) }).toString(),
    });
    const res = await container.renderToResponse(AccountPage, {
      request,
      routeType: 'page',
      locals: { user: USER, session: null, ...actionPayload('updateDisplayName', { data: undefined, error }) } as App.Locals,
    });
    expect(res.status).toBe(400);
    const html = await text(res);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<b>Fix:</b> Enter a name of at most 80 characters.');
    expect(html).toContain(`value="${'x'.repeat(81)}"`);
    expect(html).toMatch(/<input[^>]*name="name"[^>]*autofocus/);
  });

  test('a rate-limited deletion re-renders with the message above the button', async () => {
    const error = new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Try again in 20 minutes.' });
    const res = await respond(AccountPage, '/account', { user: USER, ...actionPayload('deleteAccount', { data: undefined, error }) });
    expect(res.status).toBe(429);
    const html = await text(res);
    expect(html).toContain('id="delete-error" role="alert">Too many requests. Try again in 20 minutes.</p>');
    expect(html).toContain('aria-describedby="delete-help delete-error"');
  });

  test('a server failure in an action reads as one generic sentence with a 503', async () => {
    const error = new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'relation "user" does not exist' });
    const res = await respond(AccountPage, '/account', { user: USER, ...actionPayload('deleteAccount', { data: undefined, error }) });
    expect(res.status).toBe(503);
    const html = await text(res);
    expect(html).toContain('Something went wrong on our side. Try again in a few minutes.');
    expect(html).not.toContain('does not exist');
  });
});

describe('/account/deleted', () => {
  test('is prerendered and says what is gone, that the learner is signed out, and that feedback stays', async () => {
    expect((DeletedModule as Record<string, unknown>).prerender).toBe(true);
    const res = await respond(DeletedModule.default, '/account/deleted');
    expect(res.status).toBe(200);
    const html = await text(res);
    expect(countH1(html)).toBe(1);
    expect(html).toContain('Your account is deleted');
    expect(html).toContain('A notify-me subscription with the same email was removed too.');
    expect(html).toContain('You are signed out.');
    expect(html).toContain('is not linked to an account, so it is not removed.');
    expect(html).toContain('href="/modules"');
  });
});

describe('/account/plan.md', () => {
  const ROW = { id: 1, userId: USER.id, version: 2, planText: '# My plan\n\n<script>x</script>\n', createdAt: T1, updatedAt: T1 };

  function call(path: string, locals: Record<string, unknown> = { user: USER, session: null }) {
    const url = new URL(`http://localhost:4321${path}`);
    return planDownload({ locals, url, request: new Request(url) } as unknown as APIContext);
  }

  test('serves the latest plan text verbatim as a Markdown download that is never cached', async () => {
    getAssessment.mockReset();
    getAssessment.mockResolvedValue(ROW);
    const res = await call('/account/plan.md');
    expect(res.status).toBe(200);
    expect(getAssessment).toHaveBeenCalledWith(h.db, USER.id, undefined);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="ai-engineering-plan-v2.md"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toMatch(/cookie/i);
    expect(await text(res)).toBe(ROW.planText);
  });

  test('passes a positive integer version through and names the file after the row', async () => {
    getAssessment.mockReset();
    getAssessment.mockResolvedValue({ ...ROW, version: 3 });
    const res = await call('/account/plan.md?version=3');
    expect(res.status).toBe(200);
    expect(getAssessment).toHaveBeenCalledWith(h.db, USER.id, 3);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="ai-engineering-plan-v3.md"');
  });

  test('answers 404 for a version that does not parse, that does not exist, or without a session', async () => {
    getAssessment.mockReset();
    getAssessment.mockResolvedValue(null);
    for (const q of ['?version=abc', '?version=0', '?version=1.5', '?version=-1', '?version=']) {
      expect((await call(`/account/plan.md${q}`)).status, q).toBe(404);
    }
    expect(getAssessment).not.toHaveBeenCalled();
    expect((await call('/account/plan.md?version=9')).status).toBe(404);
    expect(getAssessment).toHaveBeenCalledWith(h.db, USER.id, 9);
    expect((await call('/account/plan.md', { user: null, session: null })).status).toBe(404);
  });

  test('a version past the integer column is a 404 before any query (Phase 1 review round 2)', async () => {
    getAssessment.mockReset();
    getAssessment.mockResolvedValue(null);
    for (const q of ['?version=2147483648', '?version=99999999999', '?version=1e12']) {
      expect((await call(`/account/plan.md${q}`)).status, q).toBe(404);
    }
    expect(getAssessment).not.toHaveBeenCalled();
    expect((await call('/account/plan.md?version=2147483647')).status).toBe(404);
    expect(getAssessment).toHaveBeenCalledWith(h.db, USER.id, 2147483647);
  });

  test('a database failure answers 503 with no body and logs it without the bound parameters', async () => {
    getAssessment.mockReset();
    const failure = new Error('Failed query: select "id" from "self_assessment" where ("user_id" = $1 and "version" = $2)\nparams: u-page,7\n    at drizzle (file.js:1:1)');
    getAssessment.mockRejectedValue(failure);
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    try {
      const res = await call('/account/plan.md?version=7');
      expect(res.status).toBe(503);
      expect(res.body).toBeNull();
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    } finally {
      spy.mockRestore();
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[account] plan download failed:');
    expect(lines[0]).toContain('Failed query');
    expect(lines[0]).toContain('params: [redacted]');
    expect(lines[0]).not.toContain('u-page,7');
  });
});
