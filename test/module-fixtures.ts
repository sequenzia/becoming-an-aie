// test/module-fixtures.ts
// Module entries for C's action tests (blueprint section 7.3, docs/decisions.md 2026-10-03). The real
// collection is A's and changes with the content work, so the action tests mock src/lib/modules with
// these entries: every slug of MODULE_SLUGS, one self-check per evidence module, the closing module's
// assessment spec, and one elective left unpublished. Each entry's data passes moduleFields, the same
// schema the collection uses, with the reference fields in the shape Astro stores (section 14.2).
import {
  AREA_CONTENT_MAP,
  AREA_KEYS,
  CLOSING_SLUG,
  ELECTIVE_MODULES,
  FOUNDATIONS_MAP,
  ORIENTATION_MAP,
  assessmentSpecSchema,
  moduleFields,
  type AssessmentSpec,
  type SelfCheckQuestion,
} from '../src/lib/content-schema';
import type { ModuleEntry } from '../src/lib/modules';

/** The elective that stays a draft in the fixture store. getPublishedModule answers null for it. */
export const UNPUBLISHED_SLUG = 'inference-and-hosting';

/** Six questions, ids q1 to q6. q6 has two correct options; the rest have one. */
export function fixtureQuestions(): SelfCheckQuestion[] {
  return Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    return {
      id: `q${n}`,
      outcome: 'o1',
      question: `Question ${n}?`,
      options: ['Option A', 'Option B', 'Option C'],
      correct: n === 6 ? [0, 2] : [n % 3],
      feedback: ['Feedback A', 'Feedback B', 'Feedback C'],
    };
  });
}

/** The answer set that passes fixtureQuestions, and one that misses q1. */
export function passingAnswers(): Record<string, number[]> {
  return Object.fromEntries(fixtureQuestions().map((q) => [q.id, [...q.correct]]));
}
export function failingAnswers(): Record<string, number[]> {
  return { ...passingAnswers(), q1: [0] };
}

/** A six-area assessment spec in talk order with one transfer item and two competencies per area. */
export function fixtureSpec(): AssessmentSpec {
  return assessmentSpecSchema.parse({
    contextQuestions: { role: 'What is your current role?', feature: 'Which AI feature are you closest to at work?', ownsSystem: 'Do you own a model-dependent system today?' },
    areas: AREA_KEYS.map((area) => {
      const slug = AREA_CONTENT_MAP[area].slug;
      return {
        area,
        moduleSlug: slug,
        transfers: [{ id: `${area}-transfer`, text: `${AREA_CONTENT_MAP[area].title} transfer item` }],
        competencies: [
          { id: `${area}-new-a`, text: `${AREA_CONTENT_MAP[area].title} competency a` },
          { id: `${area}-new-b`, text: `${AREA_CONTENT_MAP[area].title} competency b` },
        ],
        steps: [
          { step: 1, text: 'Review outputs of {feature} by hand.', href: `/modules/${slug}#topics-and-learning-outcomes` },
          { step: 2, text: 'Start with one call for {feature}.', href: `/modules/${slug}#workshop` },
          { step: 3, text: 'Own the harness around {feature}.', href: `/modules/${slug}#failure-exercise` },
          { step: 4, text: 'Add autonomy on {feature} as evals earn it.', href: `/modules/${slug}#completion-evidence` },
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
      text: "You rated every item Confident. The electives and the book blueprint's build track are the next step.",
      links: [{ text: 'Browse the electives', href: '/modules#electives' }],
    },
  });
}

function entry(id: string, raw: Record<string, unknown>): ModuleEntry {
  const data = moduleFields.parse({ updatedOn: '2026-09-16', checkedOn: '2026-09-16', summary: `Fixture ${id}.`, readingMinutes: 45, draft: true, ...raw });
  const refs = data.prerequisites.map((p) => ({ collection: 'modules', id: p }));
  return {
    id,
    collection: 'modules',
    body: '',
    filePath: `src/content/modules/${id}.mdx`,
    data: { ...data, prerequisites: refs, artifacts: [] },
  } as unknown as ModuleEntry;
}

/** Every module slug as an entry, in catalog order. */
export function fixtureModules(): ModuleEntry[] {
  const outcomes = [{ id: 'o1', text: 'Outcome one.' }];
  const areas = AREA_KEYS.map((area) => {
    const map = AREA_CONTENT_MAP[area];
    return entry(map.slug, {
      title: map.title,
      kind: 'area',
      area,
      order: map.order,
      prerequisites: ['foundations'],
      talkBeats: [map.beat],
      bookChapters: [...map.chapters],
      takeaway: map.takeaway,
      pitfall: map.pitfall,
      transferRows: [...map.transferRows],
      outcomes,
      selfCheck: fixtureQuestions(),
    });
  });
  const electives = Object.entries(ELECTIVE_MODULES).map(([slug, e]) =>
    entry(slug, { title: e.title, kind: 'elective', order: e.order, bookChapters: [e.chapter], outcomes, selfCheck: fixtureQuestions() }),
  );
  return [
    entry(ORIENTATION_MAP.slug, {
      title: ORIENTATION_MAP.title,
      kind: 'orientation',
      order: 0,
      talkBeats: [...ORIENTATION_MAP.talkBeats],
      bookChapters: [...ORIENTATION_MAP.bookChapters],
      outcomes,
      selfCheck: fixtureQuestions().slice(0, 1),
    }),
    entry(FOUNDATIONS_MAP.slug, { title: FOUNDATIONS_MAP.title, kind: 'foundations', order: 0, bookChapters: [...FOUNDATIONS_MAP.bookChapters], outcomes, selfCheck: fixtureQuestions() }),
    ...areas,
    entry(CLOSING_SLUG, { title: 'Self-assessment', kind: 'closing', order: 0, prerequisites: AREA_KEYS.map((a) => AREA_CONTENT_MAP[a].slug), assessment: fixtureSpec() }),
    ...electives,
  ];
}

/** The subset of src/lib/modules the actions import, over the fixture entries. */
export function fixtureModuleStore() {
  const entries = fixtureModules();
  const isPublished = (e: ModuleEntry) => e.id !== UNPUBLISHED_SLUG;
  return {
    isPublished,
    getAllModules: async () => entries,
    getPublishedModules: async () => entries.filter(isPublished),
    getPublishedModule: async (slug: string) => entries.find((e) => e.id === slug && isPublished(e)) ?? null,
  };
}
