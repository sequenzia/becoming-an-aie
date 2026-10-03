// e2e/landing.spec.ts
// Phase 0 checks on the landing page and on the middleware contract (blueprint sections 6.4, 8, 12.3;
// acceptance rows AC-5.1.1, AC-5.1.2, AC-5.1.5, AC-5.1.6, NFR-6.1.1, NFR-6.4.3). Read-only: nothing here
// submits the notify form, so the per-IP count in notify.spec.ts stays exact.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import matter from 'gray-matter';
import { E2E_BASE_URL } from './env';

/** The two thesis sentences, verbatim from the talk (docs/research/talk-kb.md A.1). */
const THESIS = [
  'Using AI makes you an AI-enabled software engineer.',
  'Engineering systems that depend on AI makes you an AI engineer.',
];

/** The nine module names the acceptance matrix lists (AC-5.1.1). The five electives are read from content. */
const CORE_MODULES = [
  'Orientation',
  'Foundations',
  'Models',
  'Context and knowledge',
  'Tools and extensibility',
  'Orchestration',
  'Verification and evals',
  'Operating it',
  'Self-assessment',
];

/** Short alt of the full map (docs/research/design-tokens.md section 7). */
const MAP_ALT = /Anatomy of an agentic AI system\./;

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Every module title, drafts included, because the landing page lists drafts as planned (decision 34). */
function moduleTitles(repoRoot: string): { all: string[]; electives: string[] } {
  const dir = join(repoRoot, 'src/content/modules');
  const all: string[] = [];
  const electives: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort()) {
    const { data } = matter(readFileSync(join(dir, file), 'utf8'));
    all.push(String(data.title));
    if (data.kind === 'elective') electives.push(String(data.title));
  }
  return { all, electives };
}

test.describe('landing page', () => {
  test('states the thesis and the scope in body text', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Becoming an AI Engineer/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const text = squash(await page.locator('main').innerText());
    for (const sentence of THESIS) expect(text).toContain(sentence);
    // AC-5.1.2: free, self-paced, no certificate, no build required.
    expect(text).toMatch(/\bfree\b/i);
    expect(text).toMatch(/self-paced/i);
    expect(text).toMatch(/no certificate/i);
    expect(text).toMatch(/no build (is )?required|does not require a build|without a build|nothing to build/i);
  });

  test('shows the six-area map with a text alternative and a long description', async ({ page }) => {
    await page.goto('/');
    const map = page.locator('svg.map[role="img"]');
    await expect(map).toHaveCount(1);
    await expect(map).toHaveAccessibleName(MAP_ALT);
    // aria-labelledby points at a <title> and a <desc> that exist once each on the page (NFR-6.4.3).
    const ids = squash((await map.getAttribute('aria-labelledby')) ?? '').split(' ').filter(Boolean);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCount(1);
    expect(squash((await map.locator('title').first().textContent()) ?? '')).toMatch(MAP_ALT);
    await expect(page.locator('details.collapsible', { hasText: 'Long description' })).toHaveCount(1);
  });

  test('lists every module by name and marks the unpublished ones as planned', async ({ page }, testInfo) => {
    const { all, electives } = moduleTitles(resolve(testInfo.config.rootDir, '..'));
    expect(all).toHaveLength(14);
    expect(electives).toHaveLength(5);
    await page.goto('/');
    const text = squash(await page.locator('main').innerText());
    for (const name of [...CORE_MODULES, ...electives]) expect(text).toContain(name);
    for (const name of all) expect(text).toContain(name);
    expect(text).toMatch(/planned/i);
    await expect(page.locator('a[href="/modules"]').first()).toBeVisible();
  });

  test('carries the notify form with an Email field, a Notify me button, and the privacy link', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('form.notify-form');
    await expect(form).toHaveCount(1);
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(form).toHaveAttribute('action', '/notify?_action=notifySubscribe');
    const email = form.getByLabel('Email');
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('name', 'email');
    await expect(email).toHaveAttribute('required', '');
    await expect(form.getByRole('button', { name: 'Notify me' })).toBeVisible();
    const privacy = form.getByRole('link', { name: /privacy/i });
    await expect(privacy).toHaveCount(1);
    await expect(privacy).toHaveAttribute('href', '/privacy');
  });

  test('ships no JavaScript beyond the inline theme script', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('script[src]')).toHaveCount(0);
    const inline = page.locator('script:not([src])');
    await expect(inline).toHaveCount(1);
    expect(await inline.textContent()).toContain('aie-theme');
  });
});

test.describe('server contract', () => {
  test('/healthz answers 200 with ok true', async ({ request }) => {
    const res = await request.get('/healthz');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  for (const path of ['/account', '/assessment', '/account/plan.md']) {
    test(`${path} without a session redirects to sign-in and is never cached`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(302);
      const location = new URL(res.headers()['location'] ?? '', E2E_BASE_URL);
      expect(location.pathname).toBe('/sign-in');
      // Astro appends a trailing slash to originPathname under the default trailingSlash and build.format
      // (docs/decisions.md, 2026-09-15), so the next value may end in a slash.
      expect(location.searchParams.get('next')?.replace(/\/$/, '')).toBe(path);
      expect(res.headers()['cache-control']).toBe('private, no-store');
    });
  }

  test('an unknown module path answers the site 404 page, not plain text', async ({ request }) => {
    // [slug].astro returns a body-less 404 so Astro serves the 404 page with its h1 and links (section 8).
    const res = await request.get('/modules/not-a-module');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type'] ?? '').toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('That page does not exist.');
    expect(html).toContain('href="/modules"');
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });

  test('/modules without a session is publicly cacheable for five minutes and carries the security headers', async ({ request }) => {
    const res = await request.get('/modules');
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['cache-control']).toBe('public, max-age=300');
    expect(headers['vary'] ?? '').toMatch(/cookie/i);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });
});
