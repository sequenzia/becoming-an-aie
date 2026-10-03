// src/lib/dates.ts
// ISO dates everywhere (blueprint decision 37). Inputs may be Date objects or ISO strings.

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Whole UTC days since the epoch, so daylight-saving shifts never change a count. */
function utcDayNumber(d: Date | string): number {
  const date = toDate(d);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

/** `2026-09-15` for any Date or parseable date string, in UTC. */
export function isoDate(d: Date | string): string {
  return toDate(d).toISOString().slice(0, 10);
}

/** Whole days from a to b. Positive when b is later than a. Same calendar day gives 0. */
export function daysBetween(a: Date | string, b: Date | string): number {
  return utcDayNumber(b) - utcDayNumber(a);
}

/** True when checkedOn is more than thresholdDays days before now. Exactly thresholdDays is not stale. */
export function isStale(checkedOn: Date | string, thresholdDays: number, now: Date | string = new Date()): boolean {
  return daysBetween(checkedOn, now) > thresholdDays;
}
