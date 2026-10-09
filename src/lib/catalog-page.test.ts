// src/lib/catalog-page.test.ts
// The catalog through the Container API (blueprint section 8; matrix AC-5.2.2, EC-5.2.2, PD-9.2.4): the status
// chip per published module for a signed-in learner from seeded progress rows on PGlite, no chips and the public
// cache directive when anonymous, and the "Planned: <names>" line for unpublished modules in a build without
// PREVIEW_DRAFTS. Vitest sets PREVIEW_DRAFTS, so env.previewDrafts is toggled through a mock of src/lib/env, the
// same way the middleware test toggles featureAccounts. The e2e run never signs in (open item 12), so this is the
// automated coverage for the signed-in catalog (docs/decisions.md, 2026-10-03, Phase 1 review round 2).
// Since Phase 3 every real module is published, so the draft cases create their drafts here: a mock of
// getAllModules returns the real entries with draft: true on the slugs in `drafts.slugs`, and isPublished reads
// that flag as it reads a real one. With the set empty the page sees the real store unchanged.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getDb } from '../db';
import type { DbHandle } from '../db/client';
import { moduleProgress, user } from '../db/schema';
import CatalogPage from '../pages/modules/index.astro';
import { MODULE_SLUGS } from './content-schema';

const { flags, drafts } = vi.hoisted(() => ({ flags: { previewDrafts: true }, drafts: { slugs: new Set<string>() } }));
vi.mock('./env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./env')>();
  return { ...mod, env: new Proxy(mod.env, { get: (target, key) => (key === 'previewDrafts' ? flags.previewDrafts : Reflect.get(target, key)) }) };
});
vi.mock('./modules', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./modules')>();
  return {
    ...mod,
    getAllModules: async () =>
      (await mod.getAllModules()).map((m) => (drafts.slugs.has(m.id) ? { ...m, data: { ...m.data, draft: true } } : m)),
  };
});

const T0 = new Date('2026-09-16T09:00:00Z');
const T1 = new Date('2026-09-17T09:00:00Z');
const USER: NonNullable<App.Locals['user']> = {
  id: 'u-catalog',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  image: null,
  createdAt: T0,
  updatedAt: T0,
};

let container: AstroContainer;
let h: DbHandle;

beforeAll(async () => {
  container = await AstroContainer.create();
  h = await getDb();
  await h.db.insert(user).values({ ...USER, createdAt: T0, updatedAt: T0 });
  await h.db.insert(moduleProgress).values([
    { userId: USER.id, moduleSlug: 'orientation', status: 'completed', startedAt: T0, completedAt: T1 },
    { userId: USER.id, moduleSlug: 'models', status: 'in_progress', startedAt: T1, completedAt: null },
  ]);
});

afterAll(async () => {
  flags.previewDrafts = true;
  drafts.slugs.clear();
  await h.close();
});

async function respond(locals: Record<string, unknown> = {}): Promise<Response> {
  return container.renderToResponse(CatalogPage, {
    request: new Request('http://localhost:4321/modules'),
    routeType: 'page',
    locals: { user: null, session: null, ...locals } as App.Locals,
  });
}

/** The response body without the data-astro-cid attributes scoped styles add. */
async function text(res: Response): Promise<string> {
  return (await res.text()).replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

/** The li of one module, found by its title link. */
function entryOf(html: string, slug: string): string {
  const start = html.indexOf(`<a href="/modules/${slug}">`);
  if (start < 0) throw new Error(`no entry for ${slug}`);
  const li = html.lastIndexOf('<li class="card catalog-entry">', start);
  return html.slice(li, html.indexOf('</li>', start));
}

/** The Phase 2 shape, recreated for the draft cases: the closing module and the five electives as drafts. */
const DRAFTS: readonly string[] = ['self-assessment', 'fine-tuning-and-adaptation', 'inference-and-hosting', 'multimodal-systems', 'ai-engineering-team', 'career-and-learning'];
/** Published in that shape: orientation, foundations, and the six area modules. */
const PUBLISHED: readonly string[] = MODULE_SLUGS.filter((slug) => !DRAFTS.includes(slug));

const chip = (word: string) => new RegExp(`<span class="chip chip-status-[a-z-]+">${word}</span>`);
const count = (html: string, needle: RegExp) => (html.match(new RegExp(needle.source, 'g')) ?? []).length;
const PLANNED_LINE = /<p class="compact secondary catalog-planned">\s*Planned: ([^<]+)\.\s*<\/p>/g;

describe('/modules on the real store: all fourteen modules published since Phase 3', () => {
  test('image build (no PREVIEW_DRAFTS), anonymous: fourteen entries, no Planned line, no planned count', async () => {
    flags.previewDrafts = false;
    drafts.slugs.clear();
    const html = await text(await respond());
    expect(count(html, /<li class="card catalog-entry">/)).toBe(MODULE_SLUGS.length);
    for (const slug of MODULE_SLUGS) expect(html).toContain(`<a href="/modules/${slug}">`);
    expect(html).not.toContain('Planned:');
    expect(html).not.toMatch(/modules? (?:is|are) planned/);
    expect(html).not.toContain('chip-status-draft');
    expect(html).not.toContain('Nothing here yet.');
  });

  test('image build, signed in: a status chip on every one of the fourteen entries', async () => {
    flags.previewDrafts = false;
    drafts.slugs.clear();
    const html = await text(await respond({ user: USER }));
    expect(entryOf(html, 'orientation')).toMatch(chip('Complete'));
    expect(entryOf(html, 'models')).toMatch(chip('In progress'));
    expect(entryOf(html, 'self-assessment')).toMatch(chip('Not started'));
    expect(entryOf(html, 'career-and-learning')).toMatch(chip('Not started'));
    expect(count(html, chip('Complete'))).toBe(1);
    expect(count(html, chip('In progress'))).toBe(1);
    expect(count(html, chip('Not started'))).toBe(MODULE_SLUGS.length - 2);
    expect(count(html, chip('Draft'))).toBe(0);
  });

  test('PREVIEW_DRAFTS, signed in: the same fourteen entries and no Draft chip, because nothing is a draft', async () => {
    flags.previewDrafts = true;
    drafts.slugs.clear();
    const html = await text(await respond({ user: USER }));
    expect(count(html, /<li class="card catalog-entry">/)).toBe(MODULE_SLUGS.length);
    expect(count(html, chip('Draft'))).toBe(0);
    expect(html).not.toContain('Planned:');
  });
});

describe('/modules with every module published (PREVIEW_DRAFTS, the e2e and dev shape)', () => {
  test('signed in: one status chip per module from the progress rows, Not started where there is none', async () => {
    flags.previewDrafts = true;
    drafts.slugs = new Set(DRAFTS);
    const res = await respond({ user: USER });
    expect(res.status).toBe(200);
    const html = await text(res);
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(entryOf(html, 'orientation')).toMatch(chip('Complete'));
    expect(entryOf(html, 'models')).toMatch(chip('In progress'));
    expect(entryOf(html, 'foundations')).toMatch(chip('Not started'));
    expect(entryOf(html, 'inference-and-hosting')).toMatch(chip('Not started'));
    expect(count(html, /<a href="\/modules\/[a-z-]+">/)).toBeGreaterThanOrEqual(MODULE_SLUGS.length);
    expect(count(html, chip('Complete'))).toBe(1);
    expect(count(html, chip('In progress'))).toBe(1);
    expect(count(html, chip('Not started'))).toBe(MODULE_SLUGS.length - 2);
    // The drafts carry the Draft chip beside their status; the published modules do not.
    expect(count(html, chip('Draft'))).toBe(DRAFTS.length);
    for (const slug of PUBLISHED) expect(entryOf(html, slug), slug).not.toMatch(chip('Draft'));
    expect(entryOf(html, 'inference-and-hosting')).toMatch(chip('Draft'));
    expect(html).not.toContain('Planned:');
  });

  test('anonymous: no status chips, every entry linked, public cache for five minutes', async () => {
    flags.previewDrafts = true;
    drafts.slugs = new Set(DRAFTS);
    const res = await respond();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('vary')).toMatch(/cookie/i);
    const html = await text(res);
    for (const word of ['Complete', 'In progress', 'Not started']) expect(html).not.toMatch(chip(word));
    for (const slug of MODULE_SLUGS) expect(html).toContain(`<a href="/modules/${slug}">`);
    expect(html).not.toContain('Planned:');
  });
});

describe('/modules in an image build (no PREVIEW_DRAFTS): drafts are excluded (EC-5.2.2)', () => {
  test('anonymous: the published modules are entries and every draft is a name on its group\'s Planned line', async () => {
    flags.previewDrafts = false;
    drafts.slugs = new Set(DRAFTS);
    const html = await text(await respond());
    expect(html).toContain('<a href="/modules/orientation">Orientation</a>');
    expect(count(html, /<li class="card catalog-entry">/)).toBe(PUBLISHED.length);
    for (const slug of PUBLISHED) expect(html).toContain(`<a href="/modules/${slug}">`);
    for (const slug of DRAFTS) expect(html).not.toContain(`href="/modules/${slug}"`);
    // One Planned line per group that has an unpublished module, by name only: the closing module and the electives.
    const planned = html.match(PLANNED_LINE) ?? [];
    expect(planned).toHaveLength(2);
    const names = planned.map((p) => p.replace(/<[^>]+>/g, '').trim());
    expect(names.some((p) => p.startsWith('Planned: Self-assessment.'))).toBe(true);
    expect(names.some((p) => p.includes('Inference and hosting'))).toBe(true);
    expect(names.some((p) => p.includes('Models') || p.includes('Foundations'))).toBe(false);
    // No chip of any kind, no summary or reading time for a planned module, and the intro counts them.
    expect(html).not.toContain('chip-status-planned');
    expect(html).not.toContain('chip-status-draft');
    expect(html).toContain('6 modules are planned and have no page yet.');
    expect(html).not.toContain('Nothing here yet.');
  });

  test('signed in: the status chips sit on the published entries only', async () => {
    flags.previewDrafts = false;
    drafts.slugs = new Set(DRAFTS);
    const html = await text(await respond({ user: USER }));
    expect(entryOf(html, 'orientation')).toMatch(chip('Complete'));
    expect(entryOf(html, 'models')).toMatch(chip('In progress'));
    expect(entryOf(html, 'foundations')).toMatch(chip('Not started'));
    expect(count(html, chip('Complete'))).toBe(1);
    expect(count(html, chip('In progress'))).toBe(1);
    expect(count(html, chip('Not started'))).toBe(PUBLISHED.length - 2);
  });
});
