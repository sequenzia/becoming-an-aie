// e2e/keyboard.spec.ts
// Landing page to catalog to the orientation module to its self-check, keyboard only (blueprint section 12.3,
// pointed at orientation for Phase 1 because it is the module the Phase 1 image serves; AC-5.3.4, AC-5.8.2,
// AC-5.8.4, AC-5.8.6, NFR-6.4.4). Runs against the PREVIEW_DRAFTS=true build like every spec here. Keys used:
// Tab and Shift+Tab between stops, Arrow keys inside a radio group (AC-5.8.4), Space on a radio or a checkbox,
// Enter on links and buttons. Nothing is clicked, so the smooth-scroll setting in e2e/notify.spec.ts is not
// needed here (docs/decisions.md, 2026-09-16).
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ORIENTATION_SELF_CHECK_MIN } from '../src/lib/content-schema';
import { isMultiple } from '../src/lib/self-check';
import {
  CARD,
  ISLAND,
  MAX_TABS,
  SUMMARY,
  activeElementHasFocusRing,
  expectFeedback,
  focusedOptionIndex,
  options,
  pressCheck,
  readSelfCheck,
  selectOptions,
  tabTo,
  wrongSelection,
} from './self-check';

test('from the landing page to a passed orientation self-check with the keyboard alone', async ({ page }, testInfo) => {
  const questions = readSelfCheck(resolve(testInfo.config.rootDir, '..'), 'orientation');
  expect(questions.length).toBeGreaterThanOrEqual(ORIENTATION_SELF_CHECK_MIN);

  // AC-5.8.6: the orientation self-check never calls an action. Every request from here on is watched.
  const actionCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/_actions/')) actionCalls.push(request.url());
  });

  // Focus order from the top of the landing page: the skip link, the site name, then the nav links in order.
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  expect(await activeElementHasFocusRing(page), 'the skip link draws the focus ring').toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('header.site-header a[href="/"]')).toBeFocused();
  await page.keyboard.press('Tab');
  const modulesLink = page.locator('nav.site-nav').getByRole('link', { name: 'Modules' });
  await expect(modulesLink).toBeFocused();
  expect(await activeElementHasFocusRing(page), 'a nav link draws the focus ring').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/modules\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // The catalog lists the orientation group first (decision 8), so the first link named Orientation is its
  // title link. Later groups name it again as a prerequisite.
  const orientationLink = page.getByRole('link', { name: 'Orientation', exact: true }).first();
  await tabTo(page, orientationLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/modules\/orientation\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orientation');

  const island = page.locator(ISLAND);
  await expect(island).toHaveAttribute('data-hydrated', 'true');
  // AC-5.3.4: labelled optional.
  await expect(island).toContainText(/optional/i);
  const cards = island.locator(CARD);
  await expect(cards).toHaveCount(questions.length);
  for (const card of await cards.all()) await expect(card).toHaveAttribute('data-state', 'pending');

  for (const [index, question] of questions.entries()) {
    const card = cards.nth(index);
    // Into the card: bounded from the top of the page for the first question (Shiki code blocks, links, and the
    // diagram region are stops too), one Tab from the previous card's button for the rest.
    await tabTo(page, options(card).first(), index === 0 ? MAX_TABS : 1);
    expect(await focusedOptionIndex(card)).toBe(0);
    expect(await activeElementHasFocusRing(page), 'an option draws the focus ring').toBe(true);
    // The screen-reader prefix and the multi-correct hint (section 9.1, status strings in 14.5).
    await expect(card.getByRole('heading', { level: 3 })).toContainText(`Question ${index + 1} of ${questions.length}`);
    if (isMultiple(question)) await expect(card.locator('legend')).toContainText('Select all that apply.');

    if (index === 0) {
      // AC-5.8.2: a wrong answer gets feedback at once, and a retry is possible. The feedback region is empty
      // until the first check.
      await expect(card.getByRole('status')).toBeEmpty();
      await selectOptions(page, card, question, wrongSelection(question));
      await pressCheck(page, card);
      await expectFeedback(card, 'incorrect');
      // Shift+Tab from the button lands back on the group: the checked radio, or the last checkbox.
      await page.keyboard.press('Shift+Tab');
      expect(await focusedOptionIndex(card)).toBeGreaterThanOrEqual(0);
    }

    await selectOptions(page, card, question, question.correct);
    const feedback = await pressCheck(page, card);
    await expectFeedback(card, 'correct');
    await expect(feedback).not.toBeEmpty();
  }

  // The mastery pass state. Orientation stays on this device (decision 16, deviation 3 in docs/decisions.md).
  const summary = island.locator(SUMMARY);
  await expect(summary).toHaveAttribute('role', 'status');
  await expect(summary).toHaveAttribute('aria-live', 'polite');
  await expect(summary).toContainText(`${questions.length} of ${questions.length} answered correctly.`);
  await expect(summary).toContainText('Passed.');
  await expect(summary).toContainText('This self-check stays on this device.');
  expect(actionCalls, 'the orientation self-check calls no action').toEqual([]);

  // AC-5.8.6: the state lives in the browser and comes back after a reload.
  await page.reload();
  await expect(island).toHaveAttribute('data-hydrated', 'true');
  await expect(island.locator(SUMMARY)).toContainText('Passed.');
  expect(actionCalls, 'restoring the state calls no action').toEqual([]);
});

test('the skip link moves focus past the header into the main content', async ({ page }) => {
  await page.goto('/modules/orientation');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  // The next stop after the skip target is inside main, not a header link.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main#main')))).toBe(true);
});
