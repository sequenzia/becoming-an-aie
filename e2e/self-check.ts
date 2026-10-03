// e2e/self-check.ts
// Keyboard driving for the self-check island, shared by keyboard.spec.ts and a11y.spec.ts (blueprint 9.1,
// 10.4, 12.3; AC-5.8.4). The questions come from the module's frontmatter through gray-matter, the same
// source the island receives as a prop (AC-5.8.5), so the specs follow content changes without edits.
// Only native controls are driven: Tab and Shift+Tab between stops, Arrow keys inside a radio group, Space on
// a checkbox or a radio, Enter on a button. The class names, the button names, and the status strings used
// here are the section 10.4 and 14.5 contracts. This file is F's own helper, not a cross-workstream contract.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import matter from 'gray-matter';
import { selfCheckQuestionSchema, type SelfCheckQuestion } from '../src/lib/content-schema';
import { isMultiple } from '../src/lib/self-check';

/**
 * Upper bound on Tab presses while hunting for a stop on a module page (blueprint 12.3). Links, Shiki code
 * blocks (`pre tabindex="0"`), collapsible summaries, and the diagram scroll region are stops too.
 */
export const MAX_TABS = 80;

/** The island root. `data-hydrated="true"` is set on mount (section 9.1). */
export const ISLAND = 'section.self-check';
/** One card per question, with `data-state` pending, correct, or incorrect (section 10.4). */
export const CARD = 'article.self-check-question';
/** The summary region at the end of the island (section 10.4). */
export const SUMMARY = '.self-check-summary';
/** "Check answer" before the first check, "Check again" after it (sections 9.1 and 14.5). */
export const CHECK_BUTTON = /^Check (answer|again)$/;

const OPTION = 'input[type="radio"], input[type="checkbox"]';

/** The self-check questions of one module, parsed with the shared schema. */
export function readSelfCheck(repoRoot: string, slug: string): SelfCheckQuestion[] {
  const file = join(repoRoot, 'src/content/modules', `${slug}.mdx`);
  const { data } = matter(readFileSync(file, 'utf8'));
  const raw: unknown[] = Array.isArray(data.selfCheck) ? data.selfCheck : [];
  return raw.map((question) => selfCheckQuestionSchema.parse(question));
}

/**
 * A selection that grades as wrong (section 9.3): another option for a single-correct question, a partial set
 * for a multi-correct one. Every question has one, because options has at least two entries and a multi-correct
 * question has at least two correct indices.
 */
export function wrongSelection(question: SelfCheckQuestion): number[] {
  if (isMultiple(question)) return question.correct.slice(0, -1);
  const wrong = question.options.findIndex((_, index) => !question.correct.includes(index));
  return [wrong];
}

/** True when `target` matches exactly one element and that element holds focus. Never waits. */
export async function isFocused(target: Locator): Promise<boolean> {
  if ((await target.count()) !== 1) return false;
  return target.evaluate((element) => element === document.activeElement);
}

/** Presses Tab until `target` holds focus and returns the number of presses. Fails past `max` presses. */
export async function tabTo(page: Page, target: Locator, max = MAX_TABS): Promise<number> {
  for (let presses = 1; presses <= max; presses += 1) {
    await page.keyboard.press('Tab');
    if (await isFocused(target)) return presses;
  }
  throw new Error(`Tab did not reach the target within ${max} presses`);
}

/** Whether the active element draws the focus ring from src/styles/base.css (:focus-visible, NFR-6.4.4). */
export async function activeElementHasFocusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return false;
    return getComputedStyle(element).boxShadow !== 'none';
  });
}

/** The option inputs of a card, in reading order. */
export function options(card: Locator): Locator {
  return card.locator(OPTION);
}

/** Index of the focused option inside `card`, or -1 when focus is elsewhere. */
export async function focusedOptionIndex(card: Locator): Promise<number> {
  return card.evaluate((root, selector) => {
    const inputs = Array.from(root.querySelectorAll(selector));
    return inputs.indexOf(document.activeElement as Element);
  }, OPTION);
}

/**
 * Makes the checked set of `card` equal `choice` with the keyboard alone.
 * Precondition: focus is on one of the card's options. Radios: Arrow keys move focus and check (AC-5.8.4), Space
 * checks the focused one. Checkboxes: Shift+Tab walks back to the first one, Tab walks forward, Space toggles.
 * Postcondition: focus is still on an option of the card.
 */
export async function selectOptions(page: Page, card: Locator, question: SelfCheckQuestion, choice: number[]): Promise<void> {
  const inputs = options(card);
  await expect(inputs).toHaveCount(question.options.length);
  let focused = await focusedOptionIndex(card);
  expect(focused, 'focus must start on an option of the card').toBeGreaterThanOrEqual(0);
  const wanted = new Set(choice);

  if (isMultiple(question)) {
    // AC-5.8.1: checkboxes for a multi-correct question.
    await expect(inputs.first()).toHaveAttribute('type', 'checkbox');
    while (focused > 0) {
      await page.keyboard.press('Shift+Tab');
      focused = await focusedOptionIndex(card);
      expect(focused, 'Shift+Tab must stay inside the checkbox list').toBeGreaterThanOrEqual(0);
    }
    for (let index = 0; index < question.options.length; index += 1) {
      if (index > 0) {
        await page.keyboard.press('Tab');
        expect(await focusedOptionIndex(card), 'Tab must reach the next checkbox').toBe(index);
      }
      if ((await inputs.nth(index).isChecked()) !== wanted.has(index)) await page.keyboard.press('Space');
    }
  } else {
    // AC-5.8.1: radios for a single-correct question. Arrow keys move inside the group and check as they go.
    await expect(inputs.first()).toHaveAttribute('type', 'radio');
    const target = choice[0] ?? 0;
    for (let moves = 0; focused !== target; moves += 1) {
      expect(moves, 'Arrow keys must reach the target radio').toBeLessThan(question.options.length);
      await page.keyboard.press(focused < target ? 'ArrowDown' : 'ArrowUp');
      focused = await focusedOptionIndex(card);
      expect(focused, 'Arrow keys must stay inside the radio group').toBeGreaterThanOrEqual(0);
    }
    if (!(await inputs.nth(target).isChecked())) await page.keyboard.press('Space');
  }

  for (let index = 0; index < question.options.length; index += 1) {
    if (wanted.has(index)) await expect(inputs.nth(index)).toBeChecked();
    else await expect(inputs.nth(index)).not.toBeChecked();
  }
}

/**
 * One Tab from the card's options reaches its button; Enter checks. Focus stays on the button (section 9.1).
 * Returns the card's feedback region.
 */
export async function pressCheck(page: Page, card: Locator): Promise<Locator> {
  const button = card.getByRole('button', { name: CHECK_BUTTON });
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  expect(await activeElementHasFocusRing(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(button).toBeFocused();
  return card.getByRole('status');
}

/**
 * Resolves once every CSS animation inside `root` has finished. The feedback body fades in over --fade (0.2s,
 * src/styles/tokens.css). axe reads colors at the moment of the scan and blends a mid-fade opacity into the
 * foreground, so a scan taken during the fade reports a contrast failure the settled page does not have.
 */
export async function settleAnimations(root: Locator): Promise<void> {
  await root.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))),
  );
}

/** The feedback region announces the outcome and the card carries the matching state (sections 9.1 and 10.4). */
export async function expectFeedback(card: Locator, outcome: 'correct' | 'incorrect'): Promise<void> {
  const feedback = card.getByRole('status');
  await expect(feedback).toHaveAttribute('aria-live', 'polite');
  await expect(feedback).toContainText(outcome === 'correct' ? 'Correct.' : 'Not yet.');
  await expect(card).toHaveAttribute('data-state', outcome);
  await expect(card.getByRole('button', { name: 'Check again' })).toBeVisible();
}
