// test/content-store.test.ts
// The content layer is populated under Vitest (docs/decisions.md: A's 2026-09-16 finding, closed on
// 2026-10-03 by cacheDir in astro.config.mjs; vitest.config.ts syncs once when the store is absent).
// Queries astro:content directly, with nothing mocked and nothing from src/lib in between, so an empty
// layer fails here with its own name instead of inside a page or an action test.
import { getCollection, getEntry } from 'astro:content';
import { describe, expect, test } from 'vitest';

describe('the content data store under Vitest', () => {
  test('a collection query returns entries, not an empty layer', async () => {
    const modules = await getCollection('modules');
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.map((m) => m.id)).toContain('orientation');
    const orientation = await getEntry('modules', 'orientation');
    expect(orientation?.data.title).toBe('Orientation');
    expect(orientation?.data.kind).toBe('orientation');
  });

  test('every collection in src/content.config.ts has entries', async () => {
    for (const name of ['modules', 'artifacts', 'changelog'] as const) {
      expect((await getCollection(name)).length, `collection ${name}`).toBeGreaterThan(0);
    }
  });
});
