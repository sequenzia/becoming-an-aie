// src/components/islands/assessment-page.test.ts
// Renders src/pages/assessment.astro through the Container API with the Preact renderer loaded, against the
// real content store (the closing module is published since Phase 3; PREVIEW_DRAFTS is true under Vitest too) and
// PGlite in memory through getDb(). Checks the section 8 and 9.7 contract: the guard branches, the header, the
// island mount with its serialized props, and the anonymous feedback form. The island's own behavior is
// covered by SelfAssessment.test.tsx. The feedback redirect after a POST needs an action payload the
// container does not carry; the Phase 1 gate covers it on the running server.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/preact/container-renderer';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import AssessmentPage from '../../pages/assessment.astro';
import { getDb } from '../../db';
import type { DbHandle } from '../../db/client';
import { user as userTable } from '../../db/schema';

const USER = { id: 'learner-assessment', name: 'Ada', email: 'ada@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() };

let h: DbHandle;
let container: AstroContainer;

beforeAll(async () => {
  h = await getDb();
  await h.db.insert(userTable).values({ id: USER.id, name: USER.name, email: USER.email, emailVerified: true }).onConflictDoNothing();
  container = await AstroContainer.create({ renderers: await loadRenderers([getContainerRenderer()]) });
});

afterAll(async () => {
  await h.close();
});

function clean(html: string): string {
  return html.replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

/**
 * Astro serializes island props as [tag, payload] pairs (astro/dist/runtime/server/serialize.js): 0 is a
 * primitive or an object of tagged values, 1 an array of tagged values, 3 an ISO date. Everything the page
 * passes is one of those.
 */
function decodeValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const [tag, payload] = value as [number, unknown];
  if (tag === 0 && payload !== null && typeof payload === 'object') return decodeProps(payload as Record<string, unknown>);
  if (tag === 1) return (payload as unknown[]).map(decodeValue);
  if (tag === 3) return new Date(payload as string);
  return payload;
}

function decodeProps(tagged: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(tagged).map(([k, v]) => [k, decodeValue(v)]));
}

async function renderPage(locals: App.Locals, url = 'http://localhost:4321/assessment') {
  const response = await container.renderToResponse(AssessmentPage, { request: new Request(url), routeType: 'page', locals });
  return { response, html: clean(await response.text()) };
}

describe('/assessment', () => {
  test('redirects a signed-out visitor to sign-in with the return path', async () => {
    const { response } = await renderPage({ user: null, session: null });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/sign-in?next=%2Fassessment');
  });

  test('renders the header, the intro, the island with its props, and the feedback form for a learner', async () => {
    const { response, html } = await renderPage({ user: USER, session: null });
    expect(response.status).toBe(200);

    // One h1, the transition kicker, the mini-map, and the body's area color.
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<p class="kicker"><b>The transition</b> · Self-assessment</p>');
    expect(html).toContain('<h1 class="page-title">Rate yourself, then plan</h1>');
    expect(html).toContain('<body data-area="transition">');
    expect(html).toContain('class="minimap"');
    expect(html).toContain('"You are not starting over. You are adding a layer."');
    expect(html).toContain('<a href="/modules/self-assessment">Self-assessment</a>');

    // The island is mounted with client:load and carries the spec, no latest plan, no versions, and the
    // six area modules as not yet complete (the test learner has no progress rows).
    expect(html).toContain('<astro-island');
    expect(html).toContain('client="load"');
    expect(html).toContain('component-export="default"');
    const propsAttr = html.match(/ props="([^"]*)"/)?.[1] ?? '';
    const props = decodeProps(JSON.parse(propsAttr.replaceAll('&quot;', '"')) as Record<string, unknown>);
    expect(Object.keys(props).sort()).toEqual(['latest', 'missingModules', 'spec', 'versions']);
    const spec = props.spec as { areas: Array<{ area: string }>; scale: string[] };
    expect(spec.areas.map((a) => a.area)).toEqual(['models', 'context', 'tools', 'orchestration', 'evals', 'operating']);
    expect(spec.scale).toEqual(['Not yet', 'Aware', 'Practiced', 'Confident']);
    expect(props.latest).toBeNull();
    expect(props.versions).toEqual([]);
    const missing = props.missingModules as Array<{ slug: string; title: string }>;
    expect(missing.map((m) => m.slug)).toEqual(['models', 'context-and-knowledge', 'tools-and-extensibility', 'orchestration', 'verification-and-evals', 'operating-it']);

    // The server-rendered island markup: step 1 of 8 and the three context questions.
    expect(html).toContain('<section class="assessment" aria-label="Self-assessment" data-hydrated="false">');
    expect(html).toContain('Step 1 of 8: Your context');
    expect(html).toContain('What is your current role?');
    expect(html).toContain('Which AI feature are you closest to at work?');
    expect(html).toContain('Do you own a model-dependent system today?');
    expect(html).toContain('Not yet complete:');

    // The anonymous feedback form, last on the page, posting to submitFeedback.
    const feedback = html.slice(html.indexOf('<section class="assessment-feedback"'), html.indexOf('</main>'));
    expect(feedback).toContain('<h2 id="feedback-title">Feedback</h2>');
    expect(feedback).toContain('<form method="POST" action="?_action=submitFeedback">');
    expect(feedback).toContain('<label class="field-label" for="feedback-body">Feedback, optional and anonymous</label>');
    expect(feedback).toContain('<textarea class="field" id="feedback-body" name="body" required maxlength="4000" aria-describedby="feedback-help"></textarea>');
    expect(feedback).toContain('<button class="btn btn-outline" type="submit">Send feedback</button>');
    expect(feedback).not.toContain('Thank you.');
    expect(html.indexOf('<astro-island')).toBeLessThan(html.indexOf('<section class="assessment-feedback"'));

    // Heading order is strict: h1, then h2s, h3s under them.
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    expect(html).not.toContain('data-placeholder');
  });

  test('shows the thanks line after the feedback redirect', async () => {
    const { html } = await renderPage({ user: USER, session: null }, 'http://localhost:4321/assessment?feedback=sent');
    expect(html).toContain('<p class="field-help" role="status">Thank you. Your feedback is anonymous.</p>');
  });
});
