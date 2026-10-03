// src/lib/rate-limit.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRateLimiter } from './rate-limit';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

test('allows up to limit within window, then blocks, then slides', () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
  expect(rl.hit('ip:1').ok).toBe(true);
  expect(rl.hit('ip:1').ok).toBe(true);
  expect(rl.hit('ip:1').ok).toBe(true);
  const blocked = rl.hit('ip:1');
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterMs).toBe(60_000);
  expect(rl.hit('ip:2').ok).toBe(true);
  vi.advanceTimersByTime(30_000);
  expect(rl.hit('ip:1').ok).toBe(false);
  vi.advanceTimersByTime(30_001);
  expect(rl.hit('ip:1').ok).toBe(true);
});

test('sweeps idle keys after a window', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1_000 });
  rl.hit('ip:a');
  rl.hit('ip:b');
  expect(rl.size()).toBe(2);
  vi.advanceTimersByTime(1_001);
  rl.hit('ip:c');
  expect(rl.size()).toBe(1);
});
