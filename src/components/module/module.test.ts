// src/components/module/module.test.ts
// Renders A's module components through the Container API against the real content store and checks
// the contracts in blueprint sections 4.7, 10.4, and 14 (class names, ISO dates, the server-side reveal,
// the unmet-prerequisite rule, the island props). The store is visible under Vitest because
// astro.config.mjs points cacheDir at .astro/ (docs/decisions.md, 2026-10-03). D's forms and island
// are imported by their contracted paths; their markup is not asserted here.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getEntry } from 'astro:content';
import type { MarkdownHeading } from 'astro';
import { describe, expect, test } from 'vitest';
import Artifact from './Artifact.astro';
import FailureExercise from './FailureExercise.astro';
import MarkCompleteForm from './MarkCompleteForm.astro';
import ModuleLayout from './ModuleLayout.astro';
import ModuleMeta from './ModuleMeta.astro';
import OptionalLab from './OptionalLab.astro';
import Outcomes from './Outcomes.astro';
import PitfallBand from './PitfallBand.astro';
import PrerequisiteNotice from './PrerequisiteNotice.astro';
import SelfCheckPlacement from './SelfCheckPlacement.astro';
import Sources from './Sources.astro';
import StaleNotice from './StaleNotice.astro';
import Takeaway from './Takeaway.astro';
import Workshop from './Workshop.astro';
import { mdxComponents } from './mdx-components';
import { MDX_TAGS, TRANSFER_TABLE } from '../../lib/content-schema';
import type { ModuleEntry } from '../../lib/modules';
import { EMPTY_LEARNER_STATE } from '../../lib/types';
import type { LearnerModuleState, ModuleContext, PrerequisiteSummary } from '../../lib/types';

/** Scoped styles add data-astro-cid attributes; the contracts are about the rest of the markup. */
function clean(html: string): string {
  return html.replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

/** The island's serialized props, with the attribute's HTML entities decoded. */
function islandProps(html: string): string {
  const raw = html.match(/ props="([^"]*)"/)?.[1] ?? '';
  return raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

type RenderOptions = Parameters<AstroContainer['renderToString']>[1];

async function render(component: Parameters<AstroContainer['renderToString']>[0], options: RenderOptions = {}): Promise<string> {
  const container = await AstroContainer.create();
  // The Preact renderer, for the SelfCheck island inside SelfCheckPlacement. Server renderers before client ones.
  const preactServer = (await import('@astrojs/preact/server.js')).default;
  container.addServerRenderer({ renderer: preactServer, name: '@astrojs/preact' });
  container.addClientRenderer({ name: '@astrojs/preact', entrypoint: '@astrojs/preact/client.js' });
  return clean(await container.renderToString(component, options));
}

async function entry(slug: string): Promise<ModuleEntry> {
  const e = await getEntry('modules', slug);
  if (!e) throw new Error(`missing module ${slug}`);
  return e;
}

/** A ModuleContext for `e`, with the h2 headings a content-check-clean body has. */
function moduleContext(e: ModuleEntry, prerequisites: PrerequisiteSummary[] = [], headings: MarkdownHeading[] = []): ModuleContext {
  return { slug: e.id, data: e.data, headings, prerequisites, preview: e.data.draft };
}

const h2 = (text: string, slug: string): MarkdownHeading => ({ depth: 2, text, slug });

const FOUNDATIONS: PrerequisiteSummary = { slug: 'foundations', title: 'Foundations', area: 'none' };
const MODELS: PrerequisiteSummary = { slug: 'models', title: 'Models', area: 'models' };

function locals(module: ModuleContext, learner?: LearnerModuleState, user: { id: string } | null = null): App.Locals {
  return { user: user as App.Locals['user'], session: null, module, learner };
}

describe('mdx-components', () => {
  test('the map names every tag in MDX_TAGS except Fragment, which @astrojs/mdx injects', () => {
    const expected = MDX_TAGS.filter((t) => t !== 'Fragment').sort();
    expect(Object.keys(mdxComponents).sort()).toEqual(expected);
  });
});

describe('frontmatter-driven components', () => {
  test('Takeaway renders the frontmatter takeaway verbatim and nothing without one', async () => {
    const models = await entry('models');
    const html = await render(Takeaway, { locals: locals(moduleContext(models)) });
    expect(html).toContain('<p class="takeaway"><b>Takeaway.</b> The model is a versioned, expiring dependency. Treat it like one.</p>');
    const orientation = await entry('orientation');
    expect((await render(Takeaway, { locals: locals(moduleContext(orientation)) })).trim()).toBe('');
  });

  test('Outcomes renders one anchored item per outcome', async () => {
    const models = await entry('models');
    const html = await render(Outcomes, { locals: locals(moduleContext(models)) });
    expect(html).toContain('<ol class="outcomes">');
    for (const outcome of models.data.outcomes) expect(html).toContain(`<li id="outcome-${outcome.id}">${outcome.text}</li>`);
  });

  test('Sources lists every source with its date and names the beats and chapters', async () => {
    const orientation = await entry('orientation');
    const html = await render(Sources, { locals: locals(moduleContext(orientation)) });
    expect(html).toContain('<ol class="sources">');
    expect(html).toContain('This module draws on the talk, beats 1.3, 1.4, 3.1, 3.2, 3.3, and 3.4, and on the book blueprint, chapters 1 and 2.');
    for (const source of orientation.data.sources) {
      expect(html).toContain(`<time datetime="${source.date}">${source.date}</time>`);
      expect(html).toContain(source.url ? `<a href="${source.url}">${source.title}</a>` : source.title);
    }
    expect(html).toContain('Checked on <time datetime="2026-10-03">2026-10-03</time>');
    expect(html).not.toContain(String.fromCharCode(0x2014));
  });

  test('OptionalLab is a card that says labs never count and names the lab from frontmatter', async () => {
    const models = await entry('models');
    const context = moduleContext(models);
    context.data = { ...models.data, lab: { path: 'labs/models', title: 'First measurable feature' } };
    const html = await render(OptionalLab, { locals: locals(context), slots: { default: '<p>Steps.</p>' } });
    expect(html).toContain('<section class="optional-lab card">');
    expect(html).toContain('Labs never count toward completion.');
    expect(html).toContain('<b>First measurable feature</b> · <code>labs/models</code>');
    expect(html).toContain('<p>Steps.</p>');
  });
});

describe('notices and bands', () => {
  test('StaleNotice carries the chip, the ISO date, the window, and the may-be-out-of-date sentence', async () => {
    const html = await render(StaleNotice, { props: { checkedOn: new Date('2026-01-01T00:00:00Z'), thresholdDays: 90 } });
    expect(html).toContain('<p class="notice-stale" role="note">');
    expect(html).toContain('<span class="chip chip-stale">May be stale</span>');
    expect(html).toContain('Checked on <time datetime="2026-01-01">2026-01-01</time>, more than 90 days ago. It may be out of date. Verify before relying on it.');
  });

  test('PitfallBand is an aside named Pitfall with the block and the sentence', async () => {
    const html = await render(PitfallBand, { props: { pitfall: 'A hardcoded model ID with no eval suite behind it', note: 'Small line.', revealed: true } });
    expect(html).toContain('<aside class="band band-pitfall" aria-label="Pitfall" data-revealed="true">');
    expect(html).toContain('<div class="band-block">Pitfall</div>');
    expect(html).toContain('A hardcoded model ID with no eval suite behind it');
    expect(html).toContain('<span class="small secondary">Small line.</span>');
    expect(await render(PitfallBand, { props: { pitfall: 'x' } })).not.toContain('data-revealed');
  });

  test('PrerequisiteNotice lists every prerequisite signed out and only unmet ones signed in', async () => {
    const models = await entry('models');
    const prerequisites = [FOUNDATIONS, MODELS];
    const signedOut = await render(PrerequisiteNotice, { props: { prerequisites }, locals: locals(moduleContext(models, prerequisites)) });
    expect(signedOut).toContain('role="note" aria-label="Prerequisite"');
    expect(signedOut).toContain('<span class="callout-label">Before this module</span>');
    expect(signedOut).toContain('<a href="/modules/foundations"><b>Foundations</b></a>');
    expect(signedOut).toContain('<a href="/modules/models"><b>Models</b></a>');
    expect(signedOut).toContain('Read ');
    expect(signedOut).toContain('Each one is a recommendation, never a lock.');
    // Two areas (none and models): the neutral edge.
    expect(signedOut).toContain('notice notice-neutral');

    const learner: LearnerModuleState = {
      ...EMPTY_LEARNER_STATE,
      progressBySlug: { foundations: { status: 'completed', startedAt: new Date(), completedAt: new Date() } },
    };
    const signedIn = await render(PrerequisiteNotice, { props: { prerequisites }, locals: locals(moduleContext(models, prerequisites), learner, { id: 'u1' }) });
    expect(signedIn).not.toContain('Foundations');
    expect(signedIn).toContain('Still open on your account: ');
    expect(signedIn).toContain('<b>Models</b>');
    // One area left (models): its own edge, not the neutral one.
    expect(signedIn).toContain('edge-models');
    expect(signedIn).not.toContain('notice-neutral');

    const allDone: LearnerModuleState = {
      ...EMPTY_LEARNER_STATE,
      progressBySlug: {
        foundations: { status: 'completed', startedAt: new Date(), completedAt: new Date() },
        models: { status: 'completed', startedAt: new Date(), completedAt: new Date() },
      },
    };
    expect((await render(PrerequisiteNotice, { props: { prerequisites }, locals: locals(moduleContext(models, prerequisites), allDone, { id: 'u1' }) })).trim()).toBe('');
    expect((await render(PrerequisiteNotice, { props: { prerequisites: [] }, locals: locals(moduleContext(models)) })).trim()).toBe('');
  });
});

describe('ModuleMeta', () => {
  test('renders ISO dates, the prerequisite links, the transfer rows, and the status chip only when signed in', async () => {
    const models = await entry('models');
    const anonymous = await render(ModuleMeta, { props: { entry: models, prerequisites: [FOUNDATIONS] }, locals: locals(moduleContext(models, [FOUNDATIONS])) });
    expect(anonymous).toContain('<dl class="module-meta">');
    expect(anonymous).toContain('<dd>52 minutes</dd>');
    expect(anonymous).toContain('<a href="/modules/foundations">Foundations</a>');
    expect(anonymous).toContain('<time datetime="2026-10-09">2026-10-09</time>');
    expect(anonymous).toContain('<th scope="col">You already do this</th>');
    expect(anonymous).toContain(`<td>${TRANSFER_TABLE.testing.from}</td><td>${TRANSFER_TABLE.testing.to}</td>`);
    expect(anonymous).not.toContain('Your status');

    const learner: LearnerModuleState = { ...EMPTY_LEARNER_STATE, progress: { status: 'in_progress', startedAt: new Date(), completedAt: null } };
    const signedIn = await render(ModuleMeta, { props: { entry: models, prerequisites: [] }, locals: locals(moduleContext(models), learner, { id: 'u1' }) });
    expect(signedIn).toContain('<dt>Your status</dt>');
    expect(signedIn).toContain('<span class="chip chip-status-in-progress">In progress</span>');
    expect(signedIn).toContain('<dd>None</dd>');

    const orientation = await entry('orientation');
    const neutral = await render(ModuleMeta, { props: { entry: orientation, prerequisites: [] }, locals: locals(moduleContext(orientation)) });
    expect(neutral).not.toContain('<table');
    expect(neutral).toContain('<dt>Reading time</dt>');
  });
});

describe('Artifact', () => {
  test('renders the card with the origin chip, the body, the ISO checked-on date, and the source link', async () => {
    const orientation = await entry('orientation');
    const html = await render(Artifact, { props: { id: 'orientation-transfer-table' }, locals: locals(moduleContext(orientation)) });
    expect(html).toContain('<article class="card artifact">');
    expect(html).toContain('<h3 class="card-title">What transfers, the six-row table</h3>');
    expect(html).toContain('<span class="chip chip-origin"><span class="visually-hidden">Origin: </span>public</span>');
    expect(html).toContain('<td>Testing discipline</td>');
    expect(html).toContain('checked on <time datetime="2026-09-16">2026-09-16</time>');
    expect(html).toContain('<a href="https://github.com/sequenzia/beyond-the-coding-agent">Source</a>');
    // Fresh on the day it was checked plus 90 days: no stale notice while the window holds.
    const ageDays = Math.floor((Date.now() - Date.UTC(2026, 8, 16)) / 86_400_000);
    expect(html.includes('May be stale')).toBe(ageDays > orientation.data.staleAfterDays);
  });

  test('renders a Models synthetic artifact without a tool line, tool and version when set, and a stale notice past the threshold', async () => {
    const models = await entry('models');
    const context = moduleContext(models);
    context.data = { ...models.data, staleAfterDays: 1 };
    // The Models workshop report sets neither tool nor version, so the meta line starts at "checked on".
    const html = await render(Artifact, { props: { id: 'models-selection-report' }, locals: locals(context) });
    expect(html).toContain('<h3 class="card-title">Ticket triage, model selection run</h3>');
    expect(html).toContain('<span class="visually-hidden">Origin: </span>synthetic</span>');
    expect(html).toMatch(/<p class="artifact-meta">\s*checked on <time datetime="2026-10-09">2026-10-09<\/time>/);
    expect(html.match(/<p class="artifact-meta">[\s\S]*?<\/p>/)?.[0]).not.toContain('<code>');
    expect(html).toContain('Not a measured result from any real model.');
    // The body's fenced YAML renders through Shiki, so the value is asserted alone.
    expect(html).toContain('data-language="yaml"');
    expect(html).toContain('triage-selection-2026-10-02');
    // staleAfterDays 1 makes the card stale from the second day after its date.
    const ageDays = Math.floor((Date.now() - Date.UTC(2026, 9, 9)) / 86_400_000);
    expect(html.includes('May be stale')).toBe(ageDays > 1);

    // No Models artifact sets tool or version, so the tool line is pinned on a Phase 2 artifact that sets both.
    const evals = await entry('verification-and-evals');
    const judge = await render(Artifact, { props: { id: 'verification-and-evals-judge-report' }, locals: locals(moduleContext(evals)) });
    expect(judge).toContain('<code>acme-evalkit 2.3.1</code> · checked on <time datetime="2026-10-09">2026-10-09</time>');
  });

  test('throws for an unknown id instead of rendering a hole', async () => {
    const container = await AstroContainer.create();
    await expect(container.renderToString(Artifact, { props: { id: 'does-not-exist' } })).rejects.toThrow(/does not exist/);
  });
});

describe('Workshop and FailureExercise', () => {
  const headings = [h2('Workshop', 'workshop'), h2('Failure exercise', 'failure-exercise')];

  test('Workshop wraps its children in section.workshop named by the Markdown heading', async () => {
    const models = await entry('models');
    const html = await render(Workshop, { locals: locals(moduleContext(models, [], headings)), slots: { default: '<p>Task.</p>' } });
    expect(html).toContain('<section class="workshop" aria-labelledby="workshop">');
    expect(html).toContain('<p>Task.</p>');
    const unlabelled = await render(Workshop, { locals: locals(moduleContext(models)), slots: { default: '<p>Task.</p>' } });
    expect(unlabelled).toContain('<section class="workshop">');
  });

  test('FailureExercise hides the explanation and the band until a failure response exists', async () => {
    const models = await entry('models');
    const slots = { default: '<p>Find it.</p>', explanation: '<p>The planted answer.</p>' };
    const before = await render(FailureExercise, { locals: locals(moduleContext(models, [], headings)), slots });
    expect(before).toContain('<section class="failure-exercise" aria-labelledby="failure-exercise">');
    expect(before).toContain('<p>Find it.</p>');
    expect(before).not.toContain('The planted answer.');
    expect(before).not.toContain('band-pitfall');

    const learner: LearnerModuleState = { ...EMPTY_LEARNER_STATE, failure: { body: 'My answer', updatedAt: new Date() } };
    const after = await render(FailureExercise, { locals: locals(moduleContext(models, [], headings), learner, { id: 'u1' }), slots });
    expect(after).toContain('<aside class="band band-pitfall" aria-label="Pitfall" data-revealed="true">');
    expect(after).toContain('A hardcoded model ID with no eval suite behind it');
    expect(after).toContain('<span class="callout-label">Explanation</span>');
    expect(after).toContain('The planted answer.');
    // The band follows the form and precedes the explanation.
    expect(after.indexOf('band-pitfall')).toBeLessThan(after.indexOf('The planted answer.'));
  });
});

describe('SelfCheckPlacement and MarkCompleteForm', () => {
  test('orientation mounts the island as local and optional with the frontmatter questions', async () => {
    const orientation = await entry('orientation');
    const html = await render(SelfCheckPlacement, { locals: locals(moduleContext(orientation)) });
    expect(html).toContain('<div class="self-check-mount">');
    expect(html).toContain('<astro-island');
    const props = islandProps(html);
    expect(props).toContain('"moduleSlug":[0,"orientation"]');
    expect(props).toContain('"persist":[0,"local"]');
    expect(props).toContain('"optional":[0,true]');
    expect(props).toContain('"signedIn":[0,false]');
    expect(props).toContain(orientation.data.selfCheck[0]!.id);
  });

  test('an area module mounts the island as account persistence with the graded saved state', async () => {
    const models = await entry('models');
    const firstQuestion = models.data.selfCheck[0]!;
    const learner: LearnerModuleState = {
      ...EMPTY_LEARNER_STATE,
      selfCheck: { answers: { [firstQuestion.id]: firstQuestion.correct }, attempts: 2, passed: false, updatedAt: new Date('2026-10-02T10:00:00Z') },
    };
    const html = await render(SelfCheckPlacement, { locals: locals(moduleContext(models), learner, { id: 'u1' }) });
    const props = islandProps(html);
    expect(props).toContain('"persist":[0,"account"]');
    expect(props).toContain('"signedIn":[0,true]');
    expect(props).toContain('"optional":[0,false]');
    expect(props).toContain(`"${firstQuestion.id}":[0,true]`);
    expect(props).toContain('"attempts":[0,2]');
    expect(props).toContain('"updatedAt":[0,"2026-10-02T10:00:00.000Z"]');
  });

  test('MarkCompleteForm posts moduleSlug to the on-demand progress route under the contracted button name', async () => {
    const orientation = await entry('orientation');
    const html = await render(MarkCompleteForm, { locals: locals(moduleContext(orientation)) });
    expect(html).toContain('<form class="mark-complete" method="POST" action="/progress?_action=markModuleComplete">');
    expect(html).toContain('<input type="hidden" name="moduleSlug" value="orientation">');
    expect(html).toContain('>Mark orientation complete</button>');
    expect(html).toContain('aria-describedby="mark-complete-help"');
  });
});

describe('ModuleLayout', () => {
  test('an area module gets the strip with one h1, the summary, the meta, and the body', async () => {
    const models = await entry('models');
    const html = await render(ModuleLayout, {
      props: { entry: models },
      locals: locals(moduleContext(models, [FOUNDATIONS])),
      slots: { default: '<h2 id="transfer-connection">Transfer connection</h2><p>Body.</p>' },
      request: new Request('http://localhost/modules/models'),
    });
    expect(html).toContain('<body data-area="models">');
    expect(html).toContain('<div class="area-strip">');
    expect(html).toContain('<h1 class="area-strip-name">Models</h1>');
    expect(html).toContain('<p class="area-strip-beat">Module 1 of 6</p>');
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('<title>Models · Becoming an AI Engineer</title>');
    expect(html).toContain('<p class="module-summary">The model is a component you select, measure, and replace.');
    expect(html).toContain('<dl class="module-meta">');
    // Published since Phase 2: no Draft chip and no draft line.
    expect(html).not.toContain('chip-status-draft');
    expect(html).not.toContain('Draft preview.');
    // Prerequisite notice for the anonymous reader.
    expect(html).toContain('aria-label="Prerequisite"');
    expect(html).toContain('<div class="module-body"><h2 id="transfer-connection">Transfer connection</h2><p>Body.</p></div>');

    // A draft under preview (an elective, still a skeleton until Phase 3): the chip and the line.
    const elective = await entry('inference-and-hosting');
    const draft = await render(ModuleLayout, {
      props: { entry: elective },
      locals: locals(moduleContext(elective)),
      slots: { default: '<p>Body.</p>' },
      request: new Request('http://localhost/modules/inference-and-hosting'),
    });
    expect(elective.data.draft).toBe(true);
    expect(draft).toContain('<span class="chip chip-status-draft">Draft</span>');
    expect(draft).toContain('Draft preview.');
  });

  test('orientation gets the page header with the kicker and no strip, draft line, or notice', async () => {
    const orientation = await entry('orientation');
    const html = await render(ModuleLayout, {
      props: { entry: orientation },
      locals: locals(moduleContext(orientation)),
      slots: { default: '<p>Body.</p>' },
      request: new Request('http://localhost/modules/orientation'),
    });
    expect(html).toContain('<body>');
    expect(html).not.toContain('area-strip');
    expect(html).toContain('<p class="kicker">Orientation</p>');
    expect(html).toContain('<h1 class="page-title">Orientation</h1>');
    expect(html).toContain('<a class="minimap" href="/map" aria-label="Open the map">');
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).not.toContain('Draft preview.');
    expect(html).not.toContain('aria-label="Prerequisite"');
    expect(html).not.toContain('May be stale');
  });
});

describe('module pages over the real MDX', () => {
  // The MDX bodies are compiled by Vite's MDX plugin, which astro check and astro sync never run, so this is
  // the one check short of a build that proves orientation.mdx and models.mdx compile and render through the
  // components map. The MDX server renderer is registered before the Preact client renderer (container docs).
  async function pageContainer(): Promise<AstroContainer> {
    const container = await AstroContainer.create();
    const mdxServer = (await import('@astrojs/mdx/server.js')).default;
    const preactServer = (await import('@astrojs/preact/server.js')).default;
    container.addServerRenderer({ renderer: mdxServer, name: '@astrojs/mdx' });
    container.addServerRenderer({ renderer: preactServer, name: '@astrojs/preact' });
    container.addClientRenderer({ name: '@astrojs/preact', entrypoint: '@astrojs/preact/client.js' });
    return container;
  }

  test('the prerendered orientation page renders the spec 5.3 beats in order with one h1', async () => {
    const { default: OrientationPage } = await import('../../pages/modules/orientation.astro');
    const container = await pageContainer();
    const html = clean(
      await container.renderToString(OrientationPage, {
        request: new Request('http://localhost/modules/orientation'),
        locals: { user: null, session: null },
        routeType: 'page',
      }),
    );
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('<h1 class="page-title">Orientation</h1>');
    // The thesis, verbatim, and the definition of owner.
    expect(html).toContain('Using AI makes you an AI-enabled software engineer.');
    expect(html).toContain('Engineering systems that depend on AI makes you an AI engineer.');
    expect(html).toContain('Owner means the engineer or team accountable for the delivered product');
    // The template sections and the subsections, in order.
    const order = [
      'id="transfer-connection"',
      'id="topics-and-learning-outcomes"',
      '<ol class="outcomes">',
      'id="a-compelling-prototype-is-not-evidence"',
      'id="the-map"',
      'class="map" role="img"',
      'id="what-transfers"',
      '<h4 class="card-title">What transfers, the six-row table</h4>',
      'id="what-is-new"',
      'The talk lists these without ranking them.',
      'id="the-seven-pitfalls"',
      'reaching for a framework before understanding the loop',
      'id="the-roadmap"',
      'id="look-before-you-build"',
      'id="completion-evidence"',
      'does not count toward completion',
      '<div class="self-check-mount">',
      '<form class="mark-complete"',
      'id="sources"',
      '<ol class="sources">',
    ];
    let last = -1;
    for (const needle of order) {
      const at = html.indexOf(needle);
      expect(at, needle).toBeGreaterThan(last);
      last = at;
    }
    // Orientation has no workshop, no failure exercise, and its island is local.
    expect(html).not.toContain('section class="workshop"');
    expect(html).not.toContain('band-pitfall');
    expect(islandProps(html)).toContain('"persist":[0,"local"]');
    expect(html).not.toContain(String.fromCharCode(0x2014));
  });

  test('the on-demand page renders the Models module with the strip, both forms, and no explanation', async () => {
    const { default: ModulePage } = await import('../../pages/modules/[slug].astro');
    const container = await pageContainer();
    const html = clean(
      await container.renderToString(ModulePage, {
        request: new Request('http://localhost/modules/models'),
        params: { slug: 'models' },
        locals: { user: null, session: null },
        routeType: 'page',
      }),
    );
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('<h1 class="area-strip-name">Models</h1>');
    expect(html).toContain('<body data-area="models">');
    expect(html).toContain('<p class="takeaway"><b>Takeaway.</b> The model is a versioned, expiring dependency. Treat it like one.</p>');
    expect(html).toContain('<section class="workshop" aria-labelledby="workshop">');
    expect(html).toContain('<section class="failure-exercise" aria-labelledby="failure-exercise">');
    // Two cards inside h3 subsections at level 4, the workshop and failure cards at level 3, no duplicate ids anywhere.
    expect(html).toContain('<h4 class="card-title">Ticket triage output contract and five outputs</h4>');
    expect(html).toContain('<h4 class="card-title">Weekly eval runs against a moving alias</h4>');
    expect(html).toContain('<h3 class="card-title">Ticket triage, model selection run</h3>');
    expect(html).toContain('<h3 class="card-title">Pull request, migrate before the retirement date</h3>');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // Server-side reveal: no explanation, no band, for an anonymous reader.
    expect(html).not.toContain('The model id is hardcoded, and there is no eval suite behind the change.');
    expect(html).not.toContain('band-pitfall');
    expect(islandProps(html)).toContain('"persist":[0,"account"]');
    expect(html).toContain('aria-label="Prerequisite"');
    expect(html).toContain('Foundations');

    // The same artifact twice on one page: Tools and extensibility places its copied tool set in Topics
    // (level 4) and again in the Workshop (level 3), and the page still has no duplicate ids.
    const tools = clean(
      await container.renderToString(ModulePage, {
        request: new Request('http://localhost/modules/tools-and-extensibility'),
        params: { slug: 'tools-and-extensibility' },
        locals: { user: null, session: null },
        routeType: 'page',
      }),
    );
    expect((tools.match(/<h[34] class="card-title">A tool set copied from a REST API, illustrative<\/h[34]>/g) ?? []).length).toBe(2);
    const toolIds = [...tools.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(toolIds).size).toBe(toolIds.length);
  });
});
