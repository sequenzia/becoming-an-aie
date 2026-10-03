// e2e/notify.spec.ts
// The Phase 0 notify flow with JavaScript disabled (blueprint sections 7.5 and 12.3; AC-5.1.3, AC-5.1.4,
// EC-5.1.1, EC-5.1.2, NFR-6.2.5). The landing form posts to /notify?_action=notifySubscribe and the PRG
// target redirects to /notify/thanks. Confirm and unsubscribe tokens are minted here with src/lib/tokens.ts
// and the placeholder secret the web server received from e2e/env.ts; that stands in for the noop
// mailer's log line. The tests share one server and one in-memory database, so they run serially and
// count every submission: the per-IP rule in src/lib/limits.ts blocks the request after the limit.
import { expect, test, type Page } from '@playwright/test';
import { RATE_RULES } from '../src/lib/limits';
import { signToken } from '../src/lib/tokens';
import { E2E_BASE_URL, E2E_ENV } from './env';

// reducedMotion: src/styles/base.css sets scroll-behavior: smooth on html (design research, motion rules).
// Playwright's click scrolls the button into view and then waits for two identical frames, and a smooth
// scroll never settles between its retries (verified 2026-09-16: the click timed out with the default
// preference and submitted in under a second under reduce). Under prefers-reduced-motion the global rule
// in base.css sets scroll-behavior to auto. Key presses do not wait for stability, so the keyboard spec
// needs no such setting. Recorded in docs/decisions.md.
test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });
test.describe.configure({ mode: 'serial' });

const SECRET = E2E_ENV.NOTIFY_TOKEN_SECRET;
const LIMIT = RATE_RULES['notify-ip'].limit;
const THANKS = /\/notify\/thanks\/?$/;

let submissions = 0;

function freshEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** `issuedAt` defaults to now. A token minted a little in the past stands in for a link opened later. */
function confirmToken(email: string, issuedAt: number = Date.now()): string {
  return signToken({ p: 'confirm', e: email, t: issuedAt }, SECRET);
}

function unsubscribeToken(email: string): string {
  return signToken({ p: 'unsubscribe', e: email, t: Date.now() }, SECRET);
}

/** Changes the last character of the signature so the token fails verification. */
function tamper(token: string): string {
  const last = token.slice(-1);
  return token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
}

async function mainText(page: Page): Promise<string> {
  return (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
}

/** Submits the landing form the way a browser without JavaScript does: a plain POST, then the redirect. */
async function submit(page: Page, email: string): Promise<void> {
  await page.goto('/');
  const form = page.locator('form.notify-form');
  await form.getByLabel('Email').fill(email);
  submissions += 1;
  await form.getByRole('button', { name: 'Notify me' }).click();
}

async function confirmPage(page: Page, token: string | null): Promise<string> {
  await page.goto(token === null ? '/notify/confirm' : `/notify/confirm?token=${encodeURIComponent(token)}`);
  return mainText(page);
}

async function unsubscribePage(page: Page, token: string): Promise<string> {
  await page.goto(`/notify/unsubscribe?token=${encodeURIComponent(token)}`);
  return mainText(page);
}

test('a fresh address lands on the thanks page, which never claims a mail was sent', async ({ page }) => {
  await submit(page, freshEmail('fresh'));
  await expect(page).toHaveURL(THANKS);
  const text = await mainText(page);
  expect(text).toMatch(/stored your address/i);
  // Blueprint 12.3: the page text does not contain "sent", so it can never claim a mail was sent (AC-5.1.3 overlay).
  expect(text).not.toMatch(/\bsent\b/i);
});

test('a repeat address gets the identical thanks page', async ({ page }) => {
  const email = freshEmail('repeat');
  await submit(page, email);
  await expect(page).toHaveURL(THANKS);
  const first = await mainText(page);
  await submit(page, email);
  await expect(page).toHaveURL(THANKS);
  expect(await mainText(page)).toBe(first);
});

test('confirm and unsubscribe work through signed tokens; stale and bad tokens get one generic page', async ({ page }) => {
  const email = freshEmail('tokens');
  await submit(page, email);
  await expect(page).toHaveURL(THANKS);
  const thanks = await mainText(page);

  // Issued one second ago, inside the clock-skew allowance (src/lib/limits.ts TOKEN_CLOCK_SKEW_MS), so the
  // unsubscribe below is stamped after this token's issue time without waiting on the wall clock.
  const firstConfirm = confirmToken(email, Date.now() - 1000);
  const confirmed = await confirmPage(page, firstConfirm);
  expect(confirmed).toMatch(/confirmed/i);
  expect(confirmed).not.toContain(email);

  // EC-5.1.1: a confirmed address submitted again gets the same page as a new one.
  await submit(page, email);
  await expect(page).toHaveURL(THANKS);
  expect(await mainText(page)).toBe(thanks);

  const unsubscribed = await unsubscribePage(page, unsubscribeToken(email));
  expect(unsubscribed).toMatch(/unsubscribed/i);
  expect(unsubscribed).not.toContain(email);

  // A confirm token issued before the unsubscribe is invalid (decision 10, deviation 3.6).
  const generic = await confirmPage(page, firstConfirm);
  expect(generic).not.toBe(confirmed);
  expect(generic).not.toContain(email);

  // A tampered token, a valid token for an address that was never stored, and no token at all render
  // the same generic page, so the response never reveals whether an address is on the list (AC-5.1.4).
  expect(await confirmPage(page, tamper(firstConfirm))).toBe(generic);
  expect(await confirmPage(page, confirmToken(freshEmail('unknown')))).toBe(generic);
  expect(await confirmPage(page, null)).toBe(generic);
  const genericUnsubscribe = await unsubscribePage(page, tamper(unsubscribeToken(email)));
  expect(genericUnsubscribe).not.toBe(unsubscribed);
  expect(genericUnsubscribe).not.toContain(email);

  // A fresh subscribe after unsubscribing mints a newer token, and that one confirms again (EC-5.1.2 as resolved).
  await submit(page, email);
  await expect(page).toHaveURL(THANKS);
  expect(await confirmPage(page, confirmToken(email))).toBe(confirmed);
});

test('a rejected address re-renders the form with the field error, a 400, and focus on the field', async ({ page }) => {
  // A browser without JavaScript still enforces type="email", so the bad value is posted directly.
  const response = await page.request.post('/notify?_action=notifySubscribe', {
    form: { email: 'not-an-email' },
    // Astro's origin check compares the Origin header with the request origin for form POSTs (fact 0.2.5).
    headers: { origin: new URL(E2E_BASE_URL).origin },
    maxRedirects: 0,
  });
  // Not counted in `submissions`: Astro validates the input before the handler runs, so a rejected address
  // never reaches the rate limiter.
  expect(response.status()).toBe(400);
  const html = await response.text();
  // The 10.4 contract: aria-invalid, aria-describedby, the Fix lead, and the learner-facing message (not Zod's default).
  expect(html).toContain('aria-invalid="true" aria-describedby="notify-error"');
  expect(html).toContain('autofocus');
  expect(html).toMatch(/<b>Fix:<\/b> Enter a valid email address, like name@example\.com\./);
  expect(html).not.toContain('Invalid email address');
  expect(html).toContain('<title>Fix your email address');
  // The rejected value comes back in the field, so the learner corrects it instead of retyping it
  // (docs/decisions.md, 2026-10-03). The page's field-help sentence appears once: the form's own line.
  expect(html).toMatch(/<input[^>]*id="notify-email"[^>]*value="not-an-email"/);
  expect(html.match(/We store your address to tell you when modules launch\./g)).toHaveLength(1);
});

test('a request Astro rejects before the handler blames the request, keeps the status, and never says our side', async ({ page }) => {
  // A JSON body on a form action is UNSUPPORTED_MEDIA_TYPE (415) from the action parser; the handler never runs,
  // so it is not counted in `submissions` either.
  const response = await page.request.post('/notify?_action=notifySubscribe', {
    data: { email: 'json@example.com' },
    headers: { origin: new URL(E2E_BASE_URL).origin, 'content-type': 'application/json' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(415);
  const html = await response.text();
  expect(html).toContain('The form could not be read. Submit it again from the page.');
  expect(html).not.toContain('on our side');
  expect(html).not.toContain('aria-invalid="true"');
});

test(`submission ${LIMIT + 1} from one client inside the window is rate limited`, async ({ page }) => {
  while (submissions < LIMIT) {
    await submit(page, freshEmail('limit'));
    await expect(page).toHaveURL(THANKS);
  }
  await submit(page, freshEmail('limit'));
  // The PRG page re-renders the form with a notice instead of redirecting (section 7.5). The limit is not the
  // learner's input, so the field is not marked invalid and the message is not a "Fix" line
  // (docs/decisions.md, 2026-10-03).
  await expect(page).not.toHaveURL(THANKS);
  const notice = page.locator('#notify-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText(/Too many requests\. Try again in \d+ minutes?\./);
  await expect(page.locator('#notify-error')).toHaveCount(0);
  const email = page.locator('#notify-email');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('name', 'email');
});
