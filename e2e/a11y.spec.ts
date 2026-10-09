// e2e/a11y.spec.ts
// axe on the page list in both themes (blueprint section 12.3; NFR-6.4.1, NFR-6.4.5, NFR-6.5.3, PD-9.2.9).
// Tags wcag2a, wcag2aa, wcag21a, wcag21aa; zero violations. Each run writes axe-reports/<page>-<theme>.json
// and attaches the same JSON to the Playwright report. The theme is forced two ways at once: the color
// scheme media query, and the data-theme attribute that the inline head script in src/layouts/Base.astro
// sets from the aie-theme localStorage key (section 14.6), so the forced token sets are what axe measures.
// Phase 0 pages: /, /privacy, /map, /modules, /notify/thanks, a not-found path. Phase 1 adds /sign-in,
// /modules/orientation, and /modules/models (the Phase 1 fixture, published as the real Models module in Phase 2),
// the self-check on /modules/models in its three states driven by keyboard, and the two-map check on /map.
// axe cannot judge text inside an inline SVG; docs/gates.md carries the manual contrast row.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CARD, ISLAND, SUMMARY, expectFeedback, options, pressCheck, readSelfCheck, selectOptions, settleAnimations, tabTo, wrongSelection } from './self-check';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES = ['dark', 'light'] as const;
const THEME_KEY = 'aie-theme';
const PAGES: ReadonlyArray<{ name: string; path: string; status: number }> = [
  { name: 'home', path: '/', status: 200 },
  { name: 'privacy', path: '/privacy', status: 200 },
  { name: 'map', path: '/map', status: 200 },
  { name: 'modules', path: '/modules', status: 200 },
  { name: 'notify-thanks', path: '/notify/thanks', status: 200 },
  { name: 'not-found', path: '/this-page-does-not-exist', status: 404 },
  // Phase 1. /sign-in exists because the e2e build keeps FEATURE_ACCOUNTS at its default, true.
  { name: 'sign-in', path: '/sign-in', status: 200 },
  { name: 'module-orientation', path: '/modules/orientation', status: 200 },
  { name: 'module-models', path: '/modules/models', status: 200 },
  // An area module whose prerequisite notice names Models: the notice's edge takes the area color and the name
  // is small bold text, which the Models page's own prerequisite (Foundations, no area) never exercises.
  // Added in Phase 1 as a draft rendered under PREVIEW_DRAFTS; published with the Phase 2 content.
  { name: 'module-verification-and-evals', path: '/modules/verification-and-evals', status: 200 },
];

/** WCAG 1.4.10 Reflow, which axe does not check: at 320 CSS px wide the page must not scroll sideways. */
async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  await page.setViewportSize({ width: 320, height: 800 });
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth, `${label} at 320px: ${JSON.stringify(widths)}`).toBeLessThanOrEqual(widths.clientWidth);
}

function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
    .join('\n');
}

/** Runs axe on the current page state, writes the report, and asserts zero violations. */
async function scan(page: Page, testInfo: TestInfo, name: string, theme: (typeof THEMES)[number]): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const body = JSON.stringify(results, null, 2);
  const dir = join(resolve(testInfo.config.rootDir, '..'), 'axe-reports');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}-${theme}.json`), body);
  await testInfo.attach(`axe-${name}-${theme}`, { body, contentType: 'application/json' });
  expect(results.violations, `${name} (${theme}): ${describeViolations(results.violations)}`).toEqual([]);
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ context }) => {
      await context.addInitScript(
        ([key, value]) => {
          try {
            window.localStorage.setItem(key, value);
          } catch {
            // Storage can be unavailable; the media query still applies the theme.
          }
        },
        [THEME_KEY, theme] as const,
      );
    });

    for (const target of PAGES) {
      test(`${target.path} has no WCAG A or AA violations`, async ({ page }, testInfo) => {
        const response = await page.goto(target.path);
        expect(response?.status()).toBe(target.status);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await scan(page, testInfo, target.name, theme);
        await expectNoHorizontalScroll(page, `${target.path} (${theme})`);
      });
    }

    test('/modules/models self-check has no violations pending, after an incorrect check, and after a correct check', async ({ page }, testInfo) => {
      const questions = readSelfCheck(resolve(testInfo.config.rootDir, '..'), 'models');
      expect(questions.length).toBeGreaterThan(0);
      const [first] = questions;
      if (!first) throw new Error('the models module needs at least one self-check question');

      await page.goto('/modules/models');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const island = page.locator(ISLAND);
      await expect(island).toHaveAttribute('data-hydrated', 'true');
      const card = island.locator(CARD).first();
      await expect(card).toHaveAttribute('data-state', 'pending');
      await scan(page, testInfo, 'module-models-pending', theme);

      // Driven by keyboard, as the learner would (AC-5.8.4). The island grades locally and, signed out on an
      // account-persisted module, asks the learner to sign in (sections 9.1 and 14.5).
      await tabTo(page, options(card).first());
      await selectOptions(page, card, first, wrongSelection(first));
      await pressCheck(page, card);
      await expectFeedback(card, 'incorrect');
      await expect(island.locator(SUMMARY)).toContainText('Sign in to save your progress.');
      // The feedback body fades in; axe would otherwise read the mid-fade opacity as the text color.
      await settleAnimations(card);
      await scan(page, testInfo, 'module-models-incorrect', theme);

      await page.keyboard.press('Shift+Tab');
      await selectOptions(page, card, first, first.correct);
      await pressCheck(page, card);
      await expectFeedback(card, 'correct');
      await settleAnimations(card);
      await scan(page, testInfo, 'module-models-correct', theme);
    });
  });
}

test.describe('map text alternatives', () => {
  test('/map holds two full maps, each named by its own title and description (NFR-6.4.3)', async ({ page }) => {
    await page.goto('/map');
    const maps = page.locator('svg.map[role="img"]');
    await expect(maps).toHaveCount(2);
    const labelledBy = await maps.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-labelledby') ?? ''));
    expect(new Set(labelledBy).size).toBe(2);
    const seen = new Set<string>();
    for (const value of labelledBy) {
      const ids = value.split(/\s+/).filter(Boolean);
      // A title and a description per instance, and no id shared between the two instances.
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) {
        expect(seen.has(id), `id ${id} is used by both maps`).toBe(false);
        seen.add(id);
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
    }
    // The two instances describe different things: the base map and the yours variant.
    const names = await maps.evaluateAll((nodes) =>
      nodes.map((n) => (n.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')),
    );
    expect(names[0]).not.toBe(names[1]);
  });
});
