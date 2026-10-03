// src/lib/plan.test.ts
import { describe, expect, test } from 'vitest';
import { AREA_CONTENT_MAP, AREA_KEYS, assessmentSpecSchema, type AreaKey, type AssessmentSpec } from './content-schema';
import {
  DEFAULT_FEATURE,
  DEFAULT_ROLE,
  buildPlan,
  isUniformHigh,
  itemIds,
  missingRatings,
  pickRatings,
  rankAreas,
  renderPlanMarkdown,
  type AssessmentContext,
  type Ratings,
} from './plan';

/** A six-area fixture in talk order with one transfer item and two competencies per area. */
function fixtureSpec(): AssessmentSpec {
  const raw = {
    contextQuestions: { role: 'What is your role?', feature: 'Which AI feature are you closest to?', ownsSystem: 'Do you own a model-dependent system?' },
    areas: AREA_KEYS.map((area) => {
      const slug = AREA_CONTENT_MAP[area].slug;
      return {
        area,
        moduleSlug: slug,
        transfers: [{ id: `${area}-transfer`, text: `${area} transfer item` }],
        competencies: [
          { id: `${area}-new-a`, text: `${area} competency a` },
          { id: `${area}-new-b`, text: `${area} competency b` },
        ],
        steps: [
          { step: 4, text: 'Add autonomy on {feature} only as evals earn it.', href: `/modules/${slug}#completion-evidence` },
          { step: 1, text: 'Review outputs of {feature} by hand as {role}.', href: `/modules/${slug}#topics-and-learning-outcomes` },
          { step: 2, text: 'Start with one call for {feature}.', href: `/modules/${slug}#workshop` },
          { step: 3, text: 'Own the harness around {feature}.', href: `/modules/${slug}#failure-exercise` },
        ],
      };
    }),
    roadmap: [
      { step: 1, title: 'Look before you build.', subline: 'Monday: review 20 to 50 outputs by hand.' },
      { step: 2, title: 'Start constrained.', subline: 'One call. Then a workflow. Then a loop, only when it earns it.' },
      { step: 3, title: 'Own the harness.', subline: 'Prompts, context window, control flow. Learn the loop before a framework.' },
      { step: 4, title: 'Add autonomy as your evals earn it.', subline: 'Every step up is paid for by a check that catches what it breaks.' },
    ],
    uniformHigh: {
      text: 'You rated every item Confident. The electives and the build track are the next step.',
      links: [
        { text: 'Browse the electives', href: '/modules#electives' },
        { text: 'The book blueprint', href: 'https://example.org/blueprint' },
      ],
    },
  };
  return assessmentSpecSchema.parse(raw);
}

function ratingsWhere(spec: AssessmentSpec, value: number, overrides: Record<string, number> = {}): Ratings {
  const ratings: Ratings = {};
  for (const id of itemIds(spec)) ratings[id] = value;
  return { ...ratings, ...overrides };
}

const context: AssessmentContext = { role: 'backend engineer', feature: 'the support triage bot', ownsSystem: 'yes' };
const NOW = new Date('2026-09-15T10:00:00Z');

describe('itemIds and pickRatings', () => {
  test('lists every transfer and competency id in spec order', () => {
    const ids = itemIds(fixtureSpec());
    expect(ids).toHaveLength(18);
    expect(ids.slice(0, 3)).toEqual(['models-transfer', 'models-new-a', 'models-new-b']);
  });

  test('pickRatings drops unknown ids and keeps known ones', () => {
    const spec = fixtureSpec();
    const picked = pickRatings(spec, { 'models-transfer': 2, bogus: 3, 'evals-new-a': 0 });
    expect(picked).toEqual({ 'models-transfer': 2, 'evals-new-a': 0 });
  });

  test('missingRatings names ids that are unrated or out of range', () => {
    const spec = fixtureSpec();
    expect(missingRatings(spec, ratingsWhere(spec, 3))).toEqual([]);
    expect(missingRatings(spec, ratingsWhere(spec, 3, { 'tools-new-a': 4, 'evals-transfer': -1, 'operating-new-b': 1.5 }))).toEqual([
      'tools-new-a',
      'evals-transfer',
      'operating-new-b',
    ]);
    const { 'context-new-a': _dropped, ...partial } = ratingsWhere(spec, 3);
    expect(missingRatings(spec, partial)).toEqual(['context-new-a']);
  });
});

describe('rankAreas and buildPlan', () => {
  test('an area rated 0 on every new item and 3 elsewhere ranks first with four steps and the feature', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 3, { 'evals-new-a': 0, 'evals-new-b': 0 });
    const ranked = rankAreas(spec, ratings);
    expect(ranked[0]!.area).toBe('evals');
    expect(ranked[0]!.gapNew).toBe(3);
    expect(ranked[0]!.gapTransfer).toBe(0);
    expect(ranked[0]!.score).toBe(6);

    const plan = buildPlan(spec, ratings, context, [], NOW);
    expect(plan.kind).toBe('ranked');
    expect(plan.areas).toHaveLength(6);
    expect(plan.focus).toHaveLength(1);
    const focus = plan.focus[0]!;
    expect(focus.area).toBe('evals');
    expect(focus.feature).toBe('the support triage bot');
    expect(focus.steps.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    expect(focus.steps[0]!.title).toBe('Look before you build.');
    expect(focus.steps[0]!.text).toBe('Monday: review 20 to 50 outputs by hand. Review outputs of the support triage bot by hand as backend engineer.');
    expect(focus.steps[0]!.href).toBe('/modules/verification-and-evals#topics-and-learning-outcomes');
    expect(plan.intro).toContain('the support triage bot');

    const md = renderPlanMarkdown(plan, 'http://localhost:4321/');
    expect(md).toContain('Applied to: the support triage bot');
    expect(md).toContain('## Focus 1: Verification and evals');
  });

  test('new items weigh double and at most three areas become focus', () => {
    const spec = fixtureSpec();
    // context: new gap 3, score 6. models: transfer gap 3 only, score 3. tools: new gap 1.5, score 3.
    // orchestration: transfer gap 1, score 1. models and tools tie on score; the larger gapNew (tools) wins.
    const ratings = ratingsWhere(spec, 3, {
      'models-transfer': 0,
      'tools-new-a': 0,
      'context-new-a': 0,
      'context-new-b': 0,
      'orchestration-transfer': 2,
    });
    const ranked = rankAreas(spec, ratings).map((a) => a.area);
    expect(ranked.slice(0, 4)).toEqual(['context', 'tools', 'models', 'orchestration']);
    const plan = buildPlan(spec, ratings, context, [], NOW);
    expect(plan.focus.map((f) => f.area)).toEqual(['context', 'tools', 'models']);
  });

  test('ties break by talk order', () => {
    const spec = fixtureSpec();
    const ranked = rankAreas(spec, ratingsWhere(spec, 1)).map((a) => a.area);
    expect(ranked).toEqual([...AREA_KEYS]);
    const plan = buildPlan(spec, ratingsWhere(spec, 2), context, [], NOW);
    expect(plan.focus.map((f) => f.area)).toEqual(['models', 'context', 'tools'] satisfies AreaKey[]);
  });

  test('every rating 3 gives a uniform-high plan with no focus and the uniform-high links', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 3);
    expect(isUniformHigh(spec, ratings)).toBe(true);
    const plan = buildPlan(spec, ratings, context, [], NOW);
    expect(plan.kind).toBe('uniform-high');
    expect(plan.focus).toEqual([]);
    expect(plan.intro).toBe(spec.uniformHigh.text);
    expect(plan.nextSteps).toEqual(spec.uniformHigh.links);
    expect(plan.areas.every((a) => a.score === 0)).toBe(true);
    const md = renderPlanMarkdown(plan, 'http://localhost:4321');
    expect(md).toContain('## Where to go next');
    expect(md).toContain('[Browse the electives](http://localhost:4321/modules#electives)');
    expect(md).toContain('[The book blueprint](https://example.org/blueprint)');
    expect(md).not.toContain('## Focus');
  });

  test('a missing rating throws and names the id', () => {
    const spec = fixtureSpec();
    const { 'orchestration-new-b': _dropped, ...partial } = ratingsWhere(spec, 3);
    expect(() => buildPlan(spec, partial, context, [], NOW)).toThrow('Unrated items: orchestration-new-b');
  });

  test('a blank feature and role fall back to the default phrases', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 3, { 'models-new-a': 0 });
    const plan = buildPlan(spec, ratings, { role: '  ', feature: '', ownsSystem: 'no' }, [], NOW);
    expect(plan.intro).toContain(DEFAULT_FEATURE);
    expect(plan.intro).toContain('as an observer');
    expect(plan.focus[0]!.feature).toBe(DEFAULT_FEATURE);
    expect(plan.focus[0]!.steps[0]!.text).toContain(`Review outputs of ${DEFAULT_FEATURE} by hand as ${DEFAULT_ROLE}.`);
    const md = renderPlanMarkdown(plan, 'http://localhost:4321');
    expect(md).toContain('- Role: not given');
    expect(md).toContain('- Closest AI feature: not given');
    expect(md).toContain('- Owns a model-dependent system today: No');
  });

  test('the partly intro and the missing-modules next steps', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 3, { 'models-new-a': 1 });
    const missing = [{ slug: 'models', title: 'Models' }, { slug: 'operating-it', title: 'Operating it' }];
    const plan = buildPlan(spec, ratings, { ...context, ownsSystem: 'partly' }, missing, NOW);
    expect(plan.intro).toContain('share responsibility');
    expect(plan.missingModules).toEqual(missing);
    expect(plan.nextSteps).toEqual([
      { text: 'Complete Models', href: '/modules/models' },
      { text: 'Complete Operating it', href: '/modules/operating-it' },
    ]);
    const md = renderPlanMarkdown(plan, 'http://localhost:4321', 2);
    expect(md).toContain('## Next steps');
    expect(md).toContain('- [Complete Models](http://localhost:4321/modules/models)');
    expect(md).toContain('(version 2)');
  });

  test('scores are deterministic for a fixed now', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 2, { 'evals-new-a': 0, 'models-transfer': 1 });
    const a = buildPlan(spec, ratings, context, [], NOW);
    const b = buildPlan(spec, ratings, context, [], NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.generatedAt).toBe('2026-09-15T10:00:00.000Z');
    expect(a.schema).toBe(1);
  });
});

describe('renderPlanMarkdown', () => {
  test('contains no em-dash, uses absolute links, shows the version only when given', () => {
    const spec = fixtureSpec();
    const ratings = ratingsWhere(spec, 3, { 'tools-new-a': 0, 'tools-new-b': 0 });
    const plan = buildPlan(spec, ratings, context, [{ slug: 'models', title: 'Models' }], NOW);
    const withVersion = renderPlanMarkdown(plan, 'https://aie.example.org/', 3);
    expect(withVersion).not.toContain(String.fromCharCode(0x2014));
    expect(withVersion).toContain('Generated 2026-09-15 from your self-assessment (version 3).');
    expect(withVersion).toContain('(https://aie.example.org/modules/tools-and-extensibility#workshop)');
    expect(withVersion).toContain('- [Complete Models](https://aie.example.org/modules/models)');
    expect(withVersion).toContain('| Tools and extensibility | 3 | 0 | 6 |');
    expect(withVersion.endsWith('Source: the four-step roadmap from the talk. https://aie.example.org\n')).toBe(true);
    expect(withVersion).not.toMatch(/\]\(\/modules/);

    const withoutVersion = renderPlanMarkdown(plan, 'https://aie.example.org');
    expect(withoutVersion).toContain('Generated 2026-09-15 from your self-assessment.');
    expect(withoutVersion).not.toContain('(version');
  });
});
