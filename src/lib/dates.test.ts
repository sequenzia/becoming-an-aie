// src/lib/dates.test.ts
// isoDate, daysBetween, and isStale (blueprint section 14.1). isStale is a contract for A, B, D, and E;
// scripts/content-check.ts and scripts/drift-review.ts call it for their stale checks.
import { describe, expect, test } from 'vitest';
import { daysBetween, isStale, isoDate } from './dates';

describe('isoDate', () => {
  test('gives YYYY-MM-DD in UTC for a Date or a parseable string', () => {
    expect(isoDate(new Date('2026-09-15T23:30:00Z'))).toBe('2026-09-15');
    expect(isoDate('2026-09-15')).toBe('2026-09-15');
    expect(isoDate('2026-09-15T00:30:00+02:00')).toBe('2026-09-14');
  });
});

describe('daysBetween', () => {
  test('counts whole UTC days, positive when b is later', () => {
    expect(daysBetween('2026-09-15', '2026-09-15')).toBe(0);
    expect(daysBetween('2026-09-15', '2026-09-16')).toBe(1);
    expect(daysBetween('2026-09-16', '2026-09-15')).toBe(-1);
    expect(daysBetween('2026-03-17', '2026-09-15')).toBe(182);
  });

  test('ignores the time of day and daylight-saving shifts', () => {
    // Europe moved its clocks on 2026-03-29. Two local midnights are 23 hours apart in that zone; the count stays 1.
    expect(daysBetween(new Date('2026-03-28T23:00:00Z'), new Date('2026-03-29T22:00:00Z'))).toBe(1);
    expect(daysBetween(new Date('2026-09-15T00:00:00Z'), new Date('2026-09-15T23:59:59Z'))).toBe(0);
    expect(daysBetween(new Date('2026-09-15T23:59:59Z'), new Date('2026-09-16T00:00:00Z'))).toBe(1);
  });
});

describe('isStale', () => {
  test('is true past the threshold and false at it', () => {
    const now = '2026-09-15';
    expect(isStale('2026-06-17', 90, now)).toBe(false); // exactly 90 days
    expect(isStale('2026-06-16', 90, now)).toBe(true); // 91 days
    expect(isStale('2026-09-15', 0, now)).toBe(false);
    expect(isStale('2026-09-14', 0, now)).toBe(true);
  });

  test('defaults now to the current clock', () => {
    expect(isStale(new Date(), 90)).toBe(false);
    expect(isStale('2000-01-01', 90)).toBe(true);
  });
});
