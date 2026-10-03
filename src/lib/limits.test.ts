// src/lib/limits.test.ts
import { expect, test } from 'vitest';
import config from '../../astro.config.mjs';
import { ACTION_BODY_SIZE_LIMIT, CONFIRM_TOKEN_MAX_AGE_MS, RATE_RULES, TOKEN_CLOCK_SKEW_MS, WORKSHOP_MAX_CHARS } from './limits';
import { CONFIRM_LINK_DAYS } from './notify';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test('ACTION_BODY_SIZE_LIMIT equals security.actionBodySizeLimit in astro.config.mjs', () => {
  // The constant is the one place code can read the limit; the config is what Astro enforces.
  expect(config.security?.actionBodySizeLimit).toBe(ACTION_BODY_SIZE_LIMIT);
  // A workshop response at its maximum length, URL-encoded (up to three bytes per character), fits inside it.
  expect(ACTION_BODY_SIZE_LIMIT).toBeGreaterThan(WORKSHOP_MAX_CHARS * 3);
});

test('the rate rules are whole-hour sliding windows with positive integer limits', () => {
  for (const [name, rule] of Object.entries(RATE_RULES)) {
    expect(rule.windowMs, name).toBe(HOUR);
    expect(Number.isInteger(rule.limit) && rule.limit > 0, name).toBe(true);
  }
  // The token endpoints allow more hits than the form: a learner opens links more often than they subscribe.
  expect(RATE_RULES['notify-token-ip'].limit).toBeGreaterThan(RATE_RULES['notify-ip'].limit);
});

test('the confirm token lifetime is a whole number of days (CG-16: 30) and is what the mail text says', () => {
  expect(CONFIRM_TOKEN_MAX_AGE_MS % DAY).toBe(0);
  expect(CONFIRM_TOKEN_MAX_AGE_MS / DAY).toBe(30);
  expect(CONFIRM_LINK_DAYS * DAY).toBe(CONFIRM_TOKEN_MAX_AGE_MS);
  // The skew allowance is small next to the lifetime: it exists for clocks, not for replay.
  expect(TOKEN_CLOCK_SKEW_MS).toBeLessThan(HOUR);
});
