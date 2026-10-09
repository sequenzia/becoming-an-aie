// src/lib/modules.test.ts
// The content layer under Vitest. `npm test` runs `astro sync` first, and astro.config.mjs points
// cacheDir at .astro/, the file Vite's serve mode reads, so every collection is visible here
// (docs/decisions.md, 2026-10-03). Nothing is mocked: this is the real store.
import { describe, expect, test } from 'vitest';
import { KIND_ORDER, MODULE_SLUGS } from './content-schema';
import { compareModules, getAllModules, getPublishedModule, getPublishedModules } from './modules';

describe('modules over astro:content', () => {
  test('getAllModules returns the fourteen modules in catalog order', async () => {
    const modules = await getAllModules();
    expect(modules).toHaveLength(14);
    // MODULE_SLUGS is written in catalog order (content-schema.ts), so the sorted ids must equal it exactly.
    expect(modules.map((m) => m.id)).toEqual([...MODULE_SLUGS]);
    const kinds = modules.map((m) => KIND_ORDER.indexOf(m.data.kind));
    for (let i = 1; i < kinds.length; i += 1) expect(kinds[i]).toBeGreaterThanOrEqual(kinds[i - 1]!);
  });

  test('compareModules restores catalog order from a shuffled list', async () => {
    const modules = await getAllModules();
    // A fixed permutation, so the test is reproducible: reversed, then every other entry moved to the front.
    const reversed = [...modules].reverse();
    const shuffled = [...reversed.filter((_, i) => i % 2 === 1), ...reversed.filter((_, i) => i % 2 === 0)];
    expect(shuffled.map((m) => m.id)).not.toEqual([...MODULE_SLUGS]);
    expect(shuffled.sort(compareModules).map((m) => m.id)).toEqual([...MODULE_SLUGS]);
  });

  test('every module is published: no drafts remain after Phase 3', async () => {
    const modules = await getAllModules();
    // Phase 3 (blueprint section 1.3): the closing module and the five electives join orientation, foundations,
    // and the six area modules with draft: false. Draft handling is pinned on fixtures: the content check's
    // draft-skipped case (scripts/content-check.test.ts) and the drift review's (draft) marker.
    const drafts = modules.filter((m) => m.data.draft).map((m) => m.id);
    expect(drafts).toEqual([]);
    for (const slug of MODULE_SLUGS) {
      expect(modules.find((m) => m.id === slug)?.data.draft, slug).toBe(false);
    }
    // vitest.config.ts sets PREVIEW_DRAFTS; with no drafts the published list is the full fourteen either way.
    expect(await getPublishedModules()).toHaveLength(14);
    expect((await getPublishedModule('orientation'))?.id).toBe('orientation');
    expect((await getPublishedModule('models'))?.id).toBe('models');
    expect((await getPublishedModule('self-assessment'))?.id).toBe('self-assessment');
    expect((await getPublishedModule('career-and-learning'))?.id).toBe('career-and-learning');
  });

  test('a slug outside MODULE_SLUGS is null before any content-layer lookup', async () => {
    // getPublishedModule checks MODULE_SLUGS first, so Astro's "Entry modules -> x was not found" WARN line is
    // never written for a probe (docs/decisions.md, 2026-10-03). The runtime check is a curl against the
    // built server with the log watched; this pins the result shape for every form a probe can take.
    for (const slug of ['not-a-module', '', '../orientation', 'Orientation', 'orientation/']) {
      expect(await getPublishedModule(slug)).toBeNull();
    }
  });
});
