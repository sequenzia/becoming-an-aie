// src/lib/limits.ts
import type { RateLimitRule } from './rate-limit';

export const WORKSHOP_MIN_CHARS = 200; // CG-11: "a few sentences"
export const WORKSHOP_MAX_CHARS = 20_000;
export const FEEDBACK_MAX_CHARS = 4_000;
export const PLAN_TEXT_MAX_CHARS = 40_000;
export const DISPLAY_NAME_MAX_CHARS = 80;
/** Upper bound on rated items in one assessment submission. The spec has 15 today. */
export const ASSESSMENT_ITEMS_MAX = 60;

export const CONFIRM_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // CG-16
export const TOKEN_CLOCK_SKEW_MS = 60 * 1000;

export const STALE_AFTER_DAYS_DEFAULT = 90; // A-8
export const STALE_WARN_DAYS = 180;

/** astro.config.mjs security.actionBodySizeLimit. Recorded here so the two stay in sight of each other. */
export const ACTION_BODY_SIZE_LIMIT = 256 * 1024;

const HOUR = 60 * 60 * 1000;
export const RATE_RULES = {
  'notify-ip': { limit: 10, windowMs: HOUR },
  'notify-token-ip': { limit: 30, windowMs: HOUR },
  'write-user': { limit: 30, windowMs: HOUR }, // CG-25
  'write-ip': { limit: 60, windowMs: HOUR }, // CG-25
  'assess-user': { limit: 10, windowMs: HOUR },
  'feedback-ip': { limit: 5, windowMs: HOUR },
  'delete-user': { limit: 3, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;
