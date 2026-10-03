// src/lib/content-schema.test.ts
import { describe, expect, test } from 'vitest';
import {
  AREA_CONTENT_MAP,
  AREA_KEYS,
  CLOSING_SLUG,
  ELECTIVE_MODULES,
  FOUNDATIONS_MAP,
  MODULE_SLUGS,
  ORIENTATION_MAP,
  SELF_CHECK_MIN,
  changelogSchema,
  moduleSchema,
  moduleSchemaDraftsAsPublished,
  type AreaKey,
  type ModuleFrontmatter,
} from './content-schema';

type Input = Record<string, unknown>;

/** Six questions covering three outcomes, the smallest set that passes the self-check rules. */
function questions(count = SELF_CHECK_MIN) {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    outcome: `o${(i % 3) + 1}`,
    question: `Question ${i + 1}?`,
    options: ['A', 'B'],
    correct: [i % 2],
    feedback: ['Feedback A.', 'Feedback B.'],
  }));
}
const outcomes = [
  { id: 'o1', text: 'Outcome one.' },
  { id: 'o2', text: 'Outcome two.' },
  { id: 'o3', text: 'Outcome three.' },
];

const base: Input = {
  summary: 'A summary.',
  readingMinutes: 60,
  updatedOn: '2026-09-15',
  checkedOn: '2026-09-15',
  draft: false,
};

function assessmentFixture() {
  return {
    contextQuestions: { role: 'Role?', feature: 'Feature?', ownsSystem: 'Owner?' },
    areas: AREA_KEYS.map((area) => ({
      area,
      moduleSlug: AREA_CONTENT_MAP[area].slug,
      transfers: [{ id: `${area}-transfer`, text: 'Transfer.' }],
      competencies: [{ id: `${area}-new`, text: 'New.' }],
      steps: [1, 2, 3, 4].map((step) => ({ step, text: `Step ${step} on {feature}.`, href: `/modules/${AREA_CONTENT_MAP[area].slug}#workshop` })),
    })),
    roadmap: [1, 2, 3, 4].map((step) => ({ step, title: `Step ${step}`, subline: `Subline ${step}.` })),
    uniformHigh: { text: 'Uniform high.', links: [{ text: 'Electives', href: '/modules#electives' }] },
  };
}

function orientation(): Input {
  return {
    ...base,
    title: ORIENTATION_MAP.title,
    kind: 'orientation',
    order: 0,
    talkBeats: [...ORIENTATION_MAP.talkBeats],
    bookChapters: [...ORIENTATION_MAP.bookChapters],
    outcomes: [outcomes[0]],
    selfCheck: [{ ...questions(1)[0], outcome: 'o1' }],
  };
}

function foundations(): Input {
  return {
    ...base,
    title: FOUNDATIONS_MAP.title,
    kind: 'foundations',
    order: 0,
    prerequisites: ['orientation'],
    bookChapters: [...FOUNDATIONS_MAP.bookChapters],
    catalogNote: FOUNDATIONS_MAP.catalogNote,
    outcomes,
    selfCheck: questions(),
  };
}

function area(key: AreaKey): Input {
  const map = AREA_CONTENT_MAP[key];
  return {
    ...base,
    title: map.title,
    kind: 'area',
    area: key,
    order: map.order,
    talkBeats: [map.beat],
    bookChapters: [...map.chapters],
    takeaway: map.takeaway,
    pitfall: map.pitfall,
    transferRows: [...map.transferRows],
    outcomes,
    selfCheck: questions(),
  };
}

function closing(): Input {
  return {
    ...base,
    title: 'Self-assessment',
    kind: 'closing',
    order: 0,
    prerequisites: AREA_KEYS.map((k) => AREA_CONTENT_MAP[k].slug),
    assessment: assessmentFixture(),
  };
}

function elective(slug: string): Input {
  const planned = ELECTIVE_MODULES[slug]!;
  return {
    ...base,
    title: planned.title,
    kind: 'elective',
    order: planned.order,
    bookChapters: [planned.chapter],
    outcomes,
    selfCheck: questions(),
  };
}

function messagesOf(input: Input, schema = moduleSchema): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('valid frontmatter per kind', () => {
  test('orientation, foundations, closing', () => {
    expect(messagesOf(orientation())).toEqual([]);
    expect(messagesOf(foundations())).toEqual([]);
    expect(messagesOf(closing())).toEqual([]);
  });

  test('every area module built from the content map', () => {
    for (const key of AREA_KEYS) expect(messagesOf(area(key))).toEqual([]);
  });

  test('every elective built from the elective set', () => {
    for (const slug of Object.keys(ELECTIVE_MODULES)) expect(messagesOf(elective(slug))).toEqual([]);
  });

  test('the slug list covers all fourteen modules in catalog order', () => {
    expect(MODULE_SLUGS).toEqual([
      'orientation',
      'foundations',
      'models',
      'context-and-knowledge',
      'tools-and-extensibility',
      'orchestration',
      'verification-and-evals',
      'operating-it',
      CLOSING_SLUG,
      'fine-tuning-and-adaptation',
      'inference-and-hosting',
      'multimodal-systems',
      'ai-engineering-team',
      'career-and-learning',
    ]);
  });

  test('defaults fill the optional list fields', () => {
    const parsed = moduleSchema.parse(area('models')) as ModuleFrontmatter;
    expect(parsed.artifacts).toEqual([]);
    expect(parsed.prerequisites).toEqual([]);
    expect(parsed.sources).toEqual([]);
    expect(parsed.staleAfterDays).toBe(90);
    expect(parsed.checkedOn).toBeInstanceOf(Date);
  });
});

describe('content map rules for area modules', () => {
  test('a wrong talk beat', () => {
    expect(messagesOf({ ...area('models'), talkBeats: ['2.2'] })).toContain('talkBeats: talkBeats must be ["2.1"]');
  });

  test('a wrong chapter set', () => {
    expect(messagesOf({ ...area('models'), bookChapters: [6, 7] })).toContain('bookChapters: bookChapters must be [6, 7, 10]');
  });

  test('a paraphrased takeaway', () => {
    expect(messagesOf({ ...area('context'), takeaway: 'Context is a budget.' })).toContain('takeaway: takeaway must match the content map verbatim');
  });

  test('a paraphrased pitfall', () => {
    expect(messagesOf({ ...area('tools'), pitfall: 'Copying the API surface' })).toContain('pitfall: pitfall must match the content map verbatim');
  });

  test('the wrong transfer rows', () => {
    expect(messagesOf({ ...area('operating'), transferRows: ['observability'] })).toContain(
      'transferRows: transferRows must be [observability, security, operations]',
    );
  });

  test('the wrong title', () => {
    expect(messagesOf({ ...area('evals'), title: 'Evals' })).toContain('title: title must be "Verification and evals"');
  });

  test('the wrong order for the area', () => {
    expect(messagesOf({ ...area('orchestration'), order: 2 })).toContain('order: order for orchestration is 4');
    expect(messagesOf({ ...area('orchestration'), order: 7 })).toContain('order: area order is 1 to 6');
  });

  test('reading time outside 45 to 90', () => {
    expect(messagesOf({ ...area('models'), readingMinutes: 30 })).toContain('readingMinutes: area modules read in 45 to 90 minutes');
    expect(messagesOf({ ...area('models'), readingMinutes: 91 })).toContain('readingMinutes: area modules read in 45 to 90 minutes');
  });

  test('an area module without an area, and an area on another kind', () => {
    expect(messagesOf({ ...area('models'), area: 'none' })).toContain('area: area module needs an area');
    expect(messagesOf({ ...foundations(), area: 'models' })).toContain('area: only area modules carry an area');
  });
});

describe('structural rules apply to drafts too', () => {
  test('chapter 28 is out of scope even in a draft', () => {
    expect(messagesOf({ ...area('models'), draft: true, bookChapters: [6, 7, 28] })).toContain('bookChapters: chapter 28 is out of scope');
    expect(messagesOf({ ...elective('multimodal-systems'), draft: true, bookChapters: [28] })).toContain('bookChapters: chapter 28 is out of scope');
  });

  test('a draft skips the content rules unless drafts are treated as published', () => {
    const draft = { ...area('models'), draft: true, takeaway: 'Wrong.', selfCheck: [] };
    expect(messagesOf(draft)).toEqual([]);
    const strict = messagesOf(draft, moduleSchemaDraftsAsPublished);
    expect(strict).toContain('takeaway: takeaway must match the content map verbatim');
    expect(strict).toContain('selfCheck: self-check needs 6 to 12 questions, found 0');
  });

  test('order is 0 for orientation, foundations, and closing', () => {
    expect(messagesOf({ ...orientation(), order: 1 })).toContain('order: order is 0 for this kind');
    expect(messagesOf({ ...closing(), draft: true, order: 3 })).toContain('order: order is 0 for this kind');
  });

  test('a closing module needs an assessment and has no self-check', () => {
    expect(messagesOf({ ...closing(), draft: true, assessment: undefined })).toContain('assessment: closing module needs assessment');
    expect(messagesOf({ ...closing(), selfCheck: questions(1) })).toContain('selfCheck: closing module has no self-check');
  });

  test('elective order is 1 to 5', () => {
    expect(messagesOf({ ...elective('career-and-learning'), draft: true, order: 6 })).toContain('order: elective order is 1 to 5');
  });
});

describe('orientation, foundations, and elective maps', () => {
  test('orientation beats and chapters', () => {
    expect(messagesOf({ ...orientation(), talkBeats: ['1.3'] })).toContain('talkBeats: talkBeats must be [1.3, 1.4, 3.1, 3.2, 3.3, 3.4]');
    expect(messagesOf({ ...orientation(), bookChapters: [1] })).toContain('bookChapters: bookChapters must be [1, 2]');
  });

  test('foundations chapters', () => {
    expect(messagesOf({ ...foundations(), bookChapters: [4, 5] })).toContain('bookChapters: bookChapters must be [4, 5, 6]');
  });

  test('elective title and chapter pairing', () => {
    expect(messagesOf({ ...elective('multimodal-systems'), title: 'Multimodal' })).toContain('title: elective title must be one of the five planned titles');
    expect(messagesOf({ ...elective('multimodal-systems'), bookChapters: [21] })).toContain(
      'bookChapters: "Multimodal systems" draws on chapter 22',
    );
    expect(messagesOf({ ...elective('multimodal-systems'), bookChapters: [22, 29] })).toContain(
      'bookChapters: elective bookChapters must hold exactly one of 20, 21, 22, 29, 30',
    );
  });
});

describe('self-check and outcome coverage', () => {
  test('question count bounds', () => {
    expect(messagesOf({ ...area('models'), selfCheck: questions(5) })).toContain('selfCheck: self-check needs 6 to 12 questions, found 5');
    expect(messagesOf({ ...area('models'), selfCheck: questions(13) })).toContain('selfCheck: self-check needs 6 to 12 questions, found 13');
    expect(messagesOf({ ...orientation(), selfCheck: [] })).toContain('selfCheck: self-check needs 1 to 12 questions, found 0');
  });

  test('every outcome is covered and every question names a known outcome', () => {
    const uncovered = { ...area('models'), outcomes: [...outcomes, { id: 'o4', text: 'Outcome four.' }] };
    expect(messagesOf(uncovered)).toContain('outcomes: outcome o4 is not covered by any question');
    const unknown = { ...area('models'), selfCheck: questions().map((q, i) => (i === 0 ? { ...q, outcome: 'o9' } : q)) };
    expect(messagesOf(unknown)).toContain('selfCheck.0.outcome: question q1 names unknown outcome o9');
    const missing = { ...area('models'), selfCheck: questions().map((q, i) => (i === 0 ? { ...q, outcome: undefined } : q)) };
    expect(messagesOf(missing)).toContain('selfCheck.0.outcome: question q1 needs an outcome');
    expect(messagesOf({ ...area('models'), outcomes: [] })).toContain('outcomes: at least one learning outcome');
  });

  test('duplicate question ids and malformed questions', () => {
    const dup = { ...area('models'), selfCheck: questions().map((q, i) => (i === 1 ? { ...q, id: 'q1' } : q)) };
    expect(messagesOf(dup)).toContain('selfCheck.1.id: duplicate question id q1');
    const badFeedback = { ...area('models'), selfCheck: questions().map((q, i) => (i === 0 ? { ...q, feedback: ['Only one.'] } : q)) };
    expect(messagesOf(badFeedback)).toContain('selfCheck.0.feedback: one feedback entry per option');
    const outOfRange = { ...area('models'), selfCheck: questions().map((q, i) => (i === 0 ? { ...q, correct: [5] } : q)) };
    expect(messagesOf(outOfRange)).toContain('selfCheck.0.correct: correct index 5 is out of range');
  });
});

describe('assessment spec rules', () => {
  test('the module slug must match the area and every area appears once', () => {
    const spec = assessmentFixture();
    spec.areas[0]!.moduleSlug = 'context-and-knowledge';
    expect(messagesOf({ ...closing(), assessment: spec })).toContain('assessment.areas.0.moduleSlug: moduleSlug must be models');
    const duplicateIds = assessmentFixture();
    duplicateIds.areas[1]!.competencies[0]!.id = 'models-new';
    expect(messagesOf({ ...closing(), assessment: duplicateIds })).toContain('assessment.areas.1: duplicate item id models-new');
    const badSteps = assessmentFixture();
    badSteps.areas[2]!.steps[0]!.step = 2;
    expect(messagesOf({ ...closing(), assessment: badSteps })).toContain('assessment.areas.2.steps: steps must be 1,2,3,4');
  });

  test('step hrefs must point at a module heading', () => {
    const spec = assessmentFixture();
    spec.areas[0]!.steps[0]!.href = 'https://example.org/elsewhere';
    expect(messagesOf({ ...closing(), assessment: spec }).some((m) => m.includes('must be /modules/<slug>#<heading-id>'))).toBe(true);
  });
});

describe('calendar dates', () => {
  const dateMessages = (date: unknown) => {
    const result = changelogSchema.safeParse({ date, title: 'Launch' });
    return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  test('a YYYY-MM-DD string becomes that day at UTC midnight', () => {
    const parsed = changelogSchema.parse({ date: '2026-09-17', title: 'Launch' });
    expect(parsed.date.toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });

  test('the Date that YAML makes of an unquoted day is accepted as is', () => {
    const day = new Date('2026-09-17T00:00:00Z');
    expect(changelogSchema.parse({ date: day, title: 'Launch' }).date).toBe(day);
  });

  test('a missing date is an error that names the form', () => {
    expect(dateMessages(undefined)).toEqual(['date: date must be YYYY-MM-DD']);
  });

  test('other string forms are rejected with the text echoed', () => {
    expect(dateMessages('17 September 2026')).toEqual(['date: date must be YYYY-MM-DD, got "17 September 2026"']);
    expect(dateMessages('2026-09')).toEqual(['date: date must be YYYY-MM-DD, got "2026-09"']);
    expect(dateMessages('2026-09-17T10:00:00Z')).toEqual(['date: date must be YYYY-MM-DD, got "2026-09-17T10:00:00Z"']);
  });

  test('an impossible day and an invalid Date are rejected', () => {
    expect(dateMessages('2026-02-30')).toEqual(['date: "2026-02-30" is not a calendar date']);
    expect(dateMessages('2026-13-01')).toEqual(['date: "2026-13-01" is not a calendar date']);
    expect(dateMessages(new Date('nonsense'))).toEqual(['date: date must be YYYY-MM-DD']);
  });

  test('module dates use the same rule', () => {
    expect(messagesOf({ ...area('models'), checkedOn: 'soon' })).toContain('checkedOn: date must be YYYY-MM-DD, got "soon"');
    expect(messagesOf({ ...area('models'), updatedOn: undefined })).toContain('updatedOn: date must be YYYY-MM-DD');
  });
});
