// src/lib/rate-limit.ts
export type RateLimitRule = { limit: number; windowMs: number };

/** In-memory sliding window log. One process only. Keys like ip:203.0.113.7 or user:abc. */
export function createRateLimiter(rule: RateLimitRule, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function sweep(t: number) {
    if (t - lastSweep < rule.windowMs) return;
    lastSweep = t;
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((s) => t - s < rule.windowMs);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }

  return {
    hit(key: string): { ok: boolean; remaining: number; retryAfterMs: number } {
      const t = now();
      sweep(t);
      const stamps = (hits.get(key) ?? []).filter((s) => t - s < rule.windowMs);
      if (stamps.length >= rule.limit) {
        hits.set(key, stamps);
        return { ok: false, remaining: 0, retryAfterMs: rule.windowMs - (t - stamps[0]) };
      }
      stamps.push(t);
      hits.set(key, stamps);
      return { ok: true, remaining: rule.limit - stamps.length, retryAfterMs: 0 };
    },
    size() {
      return hits.size;
    },
  };
}
