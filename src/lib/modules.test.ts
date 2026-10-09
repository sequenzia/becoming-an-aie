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

  test('orientation, foundations, and the six area modules are published and the six Phase 3 modules are drafts', async () => {
    const modules = await getAllModules();
    // Phase 2 (blueprint section 1.3): orientation, foundations, and the six area modules are real content with
    // draft: false. The closing module and the five electives stay drafts until Phase 3.
    const drafts = modules.filter((m) => m.data.draft).map((m) => m.id);
    expect(drafts.sort()).toEqual(
      ['ai-engineering-team', 'career-and-learning', 'fine-tuning-and-adaptation', 'inference-and-hosting', 'multimodal-systems', 'self-assessment'],
    );
    for (const slug of ['orientation', 'foundations', 'models', 'context-and-knowledge', 'tools-and-extensibility', 'orchestration', 'verification-and-evals', 'operating-it']) {
      expect(modules.find((m) => m.id === slug)?.data.draft, slug).toBe(false);
    }
    // vitest.config.ts sets PREVIEW_DRAFTS, so drafts count as published here, as in the e2e build.
    expect(await getPublishedModules()).toHaveLength(14);
    expect((await getPublishedModule('orientation'))?.id).toBe('orientation');
    expect((await getPublishedModule('models'))?.id).toBe('models');
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
