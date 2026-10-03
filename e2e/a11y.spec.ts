// e2e/a11y.spec.ts
// axe on the Phase 0 page list in both themes (blueprint section 12.3; NFR-6.4.1, NFR-6.4.5).
// Tags wcag2a, wcag2aa, wcag21a, wcag21aa; zero violations. Each run writes axe-reports/<page>-<theme>.json
// and attaches the same JSON to the Playwright report. The theme is forced two ways at once: the color
// scheme media query, and the data-theme attribute that the inline head script in src/layouts/Base.astro
// sets from the aie-theme localStorage key (section 14.6), so the forced token sets are what axe measures.
// Phase 1 adds /sign-in, /modules/orientation, /modules/models in three self-check states, and the
// two-map assertion on /map.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { expect, test } from '@playwright/test';

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
];

function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
    .join('\n');
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

        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const body = JSON.stringify(results, null, 2);
        const dir = join(resolve(testInfo.config.rootDir, '..'), 'axe-reports');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${target.name}-${theme}.json`), body);
        await testInfo.attach(`axe-${target.name}-${theme}`, { body, contentType: 'application/json' });

        expect(results.violations, describeViolations(results.violations)).toEqual([]);
      });
    }
  });
}
