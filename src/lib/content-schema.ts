// src/lib/content-schema.ts
import { z } from 'astro/zod';

export const AREA_KEYS = ['models', 'context', 'tools', 'orchestration', 'evals', 'operating'] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

export const AREA_TITLES: Record<AreaKey, string> = {
  models: 'Models',
  context: 'Context and knowledge',
  tools: 'Tools and extensibility',
  orchestration: 'Orchestration',
  evals: 'Verification and evals',
  operating: 'Operating it',
};

export const MODULE_KINDS = ['orientation', 'foundations', 'area', 'closing', 'elective'] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

/** Catalog group order. */
export const KIND_ORDER: readonly ModuleKind[] = MODULE_KINDS;

export const KIND_GROUP_TITLES: Record<ModuleKind, string> = {
  orientation: 'Orientation',
  foundations: 'Foundations',
  area: 'The six areas',
  closing: 'Closing',
  elective: 'Electives',
};

export const ARTIFACT_ORIGINS = ['captured', 'synthetic', 'public'] as const;

export const ARTIFACT_KINDS = [
  'trace',
  'output-set',
  'tool-schema',
  'eval-report',
  'dashboard',
  'incident',
  'document',
  'table',
  'other',
] as const;

/** The talk's six-row "what transfers" table, verbatim (docs/research/talk-kb.md D.2). */
export const TRANSFER_KEYS = ['decomposition', 'interface', 'testing', 'observability', 'security', 'operations'] as const;
export type TransferKey = (typeof TRANSFER_KEYS)[number];

export const TRANSFER_TABLE: Record<TransferKey, { from: string; to: string }> = {
  decomposition: { from: 'Decomposition and systems thinking', to: 'Harness design' },
  interface: { from: 'Interface design', to: 'Tool design' },
  testing: { from: 'Testing discipline', to: 'Eval discipline' },
  observability: { from: 'Observability', to: 'The same, with a new schema' },
  security: { from: 'Security and least privilege', to: 'Least privilege for tools' },
  operations: { from: 'Operations: cost, latency, incidents, rollback', to: 'The same, in tokens' },
};

export interface AreaMapEntry {
  slug: string;
  title: string;
  /** Position inside the area kind, 1 to 6, talk order. */
  order: number;
  beat: string;
  chapters: readonly number[];
  /** Spec 5.5 content map wording. The talk's slide 23 wording differs slightly (docs/research/talk-kb.md D.4). */
  pitfall: string;
  takeaway: string;
  /** CG-20 row assignment. */
  transferRows: readonly TransferKey[];
}

/** Spec 5.5 content map plus the CG-20 transfer row assignment. Enforced by moduleRules. */
export const AREA_CONTENT_MAP: Record<AreaKey, AreaMapEntry> = {
  models: {
    slug: 'models',
    title: 'Models',
    order: 1,
    beat: '2.1',
    chapters: [6, 7, 10],
    pitfall: 'A hardcoded model ID with no eval suite behind it',
    takeaway: 'The model is a versioned, expiring dependency. Treat it like one.',
    transferRows: ['testing'],
  },
  context: {
    slug: 'context-and-knowledge',
    title: 'Context and knowledge',
    order: 2,
    beat: '2.2',
    chapters: [11, 12, 13, 14],
    pitfall: 'Adding context instead of curating it',
    takeaway: 'Context is a budget, not a bucket.',
    transferRows: ['decomposition'],
  },
  tools: {
    slug: 'tools-and-extensibility',
    title: 'Tools and extensibility',
    order: 3,
    beat: '2.3',
    chapters: [15],
    pitfall: 'Copying the API surface without evaluating task fit',
    takeaway: 'Design tools for a caller that reads the description every time and can still get it wrong.',
    transferRows: ['interface'],
  },
  orchestration: {
    slug: 'orchestration',
    title: 'Orchestration',
    order: 4,
    beat: '2.4',
    chapters: [16, 17, 18],
    pitfall: 'Multi-agent before a workflow was tried',
    takeaway: 'The loop is where autonomy gets its limits. Start with the workflow.',
    transferRows: ['decomposition'],
  },
  evals: {
    slug: 'verification-and-evals',
    title: 'Verification and evals',
    order: 5,
    beat: '2.5',
    chapters: [8, 9, 19],
    pitfall: 'A generic judge instead of error analysis; grading the transcript instead of the outcome',
    takeaway:
      'Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes.',
    transferRows: ['testing'],
  },
  operating: {
    slug: 'operating-it',
    title: 'Operating it',
    order: 6,
    beat: '2.6',
    chapters: [23, 24, 25, 26, 27],
    pitfall: 'The lethal trifecta, assembled one integration at a time',
    takeaway: 'When you are the owner, its answer is your answer.',
    transferRows: ['observability', 'security', 'operations'],
  },
};

/** Spec 5.11 electives. One chapter each. Enforced by content-check (slug) and moduleRules (title, chapter). */
export const ELECTIVE_MODULES: Record<string, { title: string; chapter: number; order: number }> = {
  'fine-tuning-and-adaptation': { title: 'Fine-tuning, distillation, and model adaptation', chapter: 20, order: 1 },
  'inference-and-hosting': { title: 'Inference and hosting fundamentals', chapter: 21, order: 2 },
  'multimodal-systems': { title: 'Multimodal systems', chapter: 22, order: 3 },
  'ai-engineering-team': { title: 'Working on an AI engineering team', chapter: 29, order: 4 },
  'career-and-learning': { title: 'Building your career and continuing to learn', chapter: 30, order: 5 },
};
export const ELECTIVE_TITLES = Object.values(ELECTIVE_MODULES).map((e) => e.title);
export const ELECTIVE_CHAPTERS = Object.values(ELECTIVE_MODULES).map((e) => e.chapter);

/** Chapter 28 (capstone) is out of scope (spec 5.5, 8.2). */
export const FORBIDDEN_CHAPTERS: readonly number[] = [28];

export const ORIENTATION_MAP = {
  slug: 'orientation',
  title: 'Orientation',
  talkBeats: ['1.3', '1.4', '3.1', '3.2', '3.3', '3.4'],
  bookChapters: [1, 2],
} as const;

export const FOUNDATIONS_MAP = {
  slug: 'foundations',
  title: 'Foundations',
  bookChapters: [4, 5, 6],
  catalogNote: 'Recommended before Verification and evals.',
} as const;

export const CLOSING_SLUG = 'self-assessment';

/** Every module slug this program ships, in catalog order. */
export const MODULE_SLUGS = [
  'orientation',
  'foundations',
  ...AREA_KEYS.map((k) => AREA_CONTENT_MAP[k].slug),
  CLOSING_SLUG,
  ...Object.keys(ELECTIVE_MODULES),
] as const;

/** Exact h2 text, in order, per kind. The content check enforces it. */
export const REQUIRED_SECTIONS: Record<ModuleKind, readonly string[]> = {
  orientation: ['Transfer connection', 'Topics and learning outcomes', 'Completion evidence', 'Sources'],
  foundations: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  area: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  elective: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  closing: ['How the assessment works', 'The six areas', 'After the plan', 'Sources'],
};

/** Optional h2 that may appear only between Failure exercise and Completion evidence. */
export const OPTIONAL_LAB_SECTION = 'Optional lab';

/** h2 that must not appear for a kind. */
export const FORBIDDEN_SECTIONS: Record<ModuleKind, readonly string[]> = {
  orientation: ['Workshop', 'Failure exercise', 'Optional lab'],
  foundations: [],
  area: [],
  elective: [],
  closing: ['Workshop', 'Failure exercise', 'Optional lab', 'Completion evidence'],
};

/** The only capitalized JSX tags a module body may use (section 4.6). Anything else fails the content check. */
export const MDX_TAGS = [
  'Artifact',
  'Callout',
  'Collapsible',
  'Workshop',
  'FailureExercise',
  'OptionalLab',
  'SelfCheck',
  'Sources',
  'AnatomyMap',
  'MarkComplete',
  'Takeaway',
  'Outcomes',
  'Fragment',
] as const;

/** Kinds whose body must place <SelfCheck /> in Completion evidence. */
export const SELF_CHECK_KINDS: readonly ModuleKind[] = ['orientation', 'foundations', 'area', 'elective'];

export const SELF_CHECK_MIN = 6;
export const SELF_CHECK_MAX = 12;
export const ORIENTATION_SELF_CHECK_MIN = 1;
export const AREA_READING_MIN = 45;
export const AREA_READING_MAX = 90;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words joined by hyphens');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day. The source is a YYYY-MM-DD string, or the Date that YAML makes of an unquoted one, and the
 * value is that day at UTC midnight. A missing value, any other string, and an impossible day (2026-02-30) are
 * rejected with a message that names the form, where z.coerce.date() used to pass an Invalid Date through.
 */
const isoDate = z.union([z.string(), z.date()], { error: 'date must be YYYY-MM-DD' }).transform((value, ctx) => {
  if (value instanceof Date) return value; // z.date() has already rejected an Invalid Date
  const text = value.trim();
  if (!ISO_DAY.test(text)) {
    ctx.addIssue({ code: 'custom', message: `date must be YYYY-MM-DD, got "${text}"` });
    return z.NEVER;
  }
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    ctx.addIssue({ code: 'custom', message: `"${text}" is not a calendar date` });
    return z.NEVER;
  }
  return date;
});

/** YAML may parse an unquoted date into a Date. Accept both and keep a string. */
const flexibleDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim()))
  .refine((v) => /^\d{4}(-\d{2}){0,2}$/.test(v), 'date must be YYYY, YYYY-MM, or YYYY-MM-DD');

export const sourceSchema = z.object({
  title: z.string().min(1),
  org: z.string().optional(),
  author: z.string().optional(),
  date: flexibleDate,
  url: z.url().optional(),
  checkedOn: isoDate.optional(),
  archivedOn: isoDate.optional(),
  archiveUrl: z.url().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const selfCheckQuestionSchema = z
  .object({
    id: slug,
    outcome: slug.optional(),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correct: z.array(z.number().int().min(0)).min(1),
    feedback: z.array(z.string().min(1)),
  })
  .superRefine((q, ctx) => {
    if (q.feedback.length !== q.options.length) {
      ctx.addIssue({ code: 'custom', path: ['feedback'], message: 'one feedback entry per option' });
    }
    for (const i of q.correct) {
      if (i >= q.options.length) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: `correct index ${i} is out of range` });
      }
    }
    if (new Set(q.correct).size !== q.correct.length) {
      ctx.addIssue({ code: 'custom', path: ['correct'], message: 'duplicate correct index' });
    }
  });
export type SelfCheckQuestion = z.infer<typeof selfCheckQuestionSchema>;

const ratedItem = z.object({ id: slug, text: z.string().min(1) });
const anchorHref = z.string().regex(/^\/modules\/[a-z0-9-]+#[a-z0-9-]+$/, 'must be /modules/<slug>#<heading-id>');

export const assessmentSpecSchema = z
  .object({
    scale: z.array(z.string().min(1)).length(4).default(['Not yet', 'Aware', 'Practiced', 'Confident']),
    contextQuestions: z.object({
      role: z.string().min(1),
      feature: z.string().min(1),
      ownsSystem: z.string().min(1),
    }),
    areas: z
      .array(
        z.object({
          area: z.enum(AREA_KEYS),
          moduleSlug: slug,
          transfers: z.array(ratedItem).min(1),
          competencies: z.array(ratedItem).min(1),
          /** Four area-specific step texts. {feature} and {role} are replaced at plan time. */
          steps: z
            .array(z.object({ step: z.number().int().min(1).max(4), text: z.string().min(1), href: anchorHref }))
            .length(4),
        }),
      )
      .length(6),
    roadmap: z
      .array(z.object({ step: z.number().int().min(1).max(4), title: z.string().min(1), subline: z.string().min(1) }))
      .length(4),
    uniformHigh: z.object({
      text: z.string().min(1),
      links: z.array(z.object({ text: z.string().min(1), href: z.string().min(1) })).min(1),
    }),
  })
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    spec.areas.forEach((a, ai) => {
      for (const item of [...a.transfers, ...a.competencies]) {
        if (ids.has(item.id)) {
          ctx.addIssue({ code: 'custom', path: ['areas', ai], message: `duplicate item id ${item.id}` });
        }
        ids.add(item.id);
      }
      const steps = a.steps.map((s) => s.step).sort().join(',');
      if (steps !== '1,2,3,4') {
        ctx.addIssue({ code: 'custom', path: ['areas', ai, 'steps'], message: 'steps must be 1,2,3,4' });
      }
      if (AREA_CONTENT_MAP[a.area].slug !== a.moduleSlug) {
        ctx.addIssue({ code: 'custom', path: ['areas', ai, 'moduleSlug'], message: `moduleSlug must be ${AREA_CONTENT_MAP[a.area].slug}` });
      }
    });
    const seen = new Set(spec.areas.map((a) => a.area));
    if (seen.size !== 6) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'each area exactly once' });
  });
export type AssessmentSpec = z.infer<typeof assessmentSpecSchema>;

/** Plain fields. content.config.ts extends this with reference() fields. */
export const moduleFields = z.object({
  title: z.string().min(1),
  kind: z.enum(MODULE_KINDS),
  area: z.enum([...AREA_KEYS, 'none']).default('none'),
  /** Position inside the kind: area 1 to 6, elective 1 to 5, every other kind 0. */
  order: z.number().int().min(0),
  summary: z.string().min(1).max(240),
  readingMinutes: z.number().int().min(1),
  prerequisites: z.array(slug).default([]),
  catalogNote: z.string().max(120).optional(),
  talkBeats: z.array(z.string()).default([]),
  bookChapters: z.array(z.number().int().min(1).max(30)).default([]),
  draft: z.boolean().default(false),
  updatedOn: isoDate,
  checkedOn: isoDate,
  staleAfterDays: z.number().int().min(1).default(90),
  takeaway: z.string().optional(),
  pitfall: z.string().optional(),
  /** Rows of the talk's transfer table this module expands. Required for area modules. */
  transferRows: z.array(z.enum(TRANSFER_KEYS)).default([]),
  artifacts: z.array(slug).default([]),
  outcomes: z.array(z.object({ id: slug, text: z.string().min(1) })).default([]),
  selfCheck: z.array(selfCheckQuestionSchema).default([]),
  lab: z.object({ path: z.string().min(1), title: z.string().min(1) }).optional(),
  sources: z.array(sourceSchema).default([]),
  assessment: assessmentSpecSchema.optional(),
});
export type ModuleFrontmatter = z.infer<typeof moduleFields>;

type RulesInput = Pick<
  ModuleFrontmatter,
  | 'title'
  | 'kind'
  | 'area'
  | 'order'
  | 'draft'
  | 'readingMinutes'
  | 'talkBeats'
  | 'bookChapters'
  | 'selfCheck'
  | 'outcomes'
  | 'takeaway'
  | 'pitfall'
  | 'transferRows'
  | 'assessment'
>;

type IssueCtx = { addIssue: (issue: { code: 'custom'; path?: (string | number)[]; message: string }) => void };

export interface ModuleRuleOptions {
  /** Apply every rule to drafts too. Used by content-check --drafts-as-published. */
  draftsAsPublished?: boolean;
}

const sameSet = (a: readonly (string | number)[], b: readonly (string | number)[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Kind-specific rules and the content map. Structural rules (kind, area, order, forbidden chapters)
 * apply to drafts too. Content rules are skipped for drafts unless draftsAsPublished is set.
 */
export function makeModuleRules(opts: ModuleRuleOptions = {}) {
  return function moduleRules(m: RulesInput, ctx: IssueCtx) {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', path, message });

    // Structural rules, every module.
    if (m.kind === 'closing' && !m.assessment) issue('closing module needs assessment', ['assessment']);
    if (m.kind === 'closing' && m.selfCheck.length > 0) issue('closing module has no self-check', ['selfCheck']);
    if (m.kind === 'area' && m.area === 'none') issue('area module needs an area', ['area']);
    if (m.kind !== 'area' && m.area !== 'none') issue('only area modules carry an area', ['area']);
    for (const c of m.bookChapters) {
      if (FORBIDDEN_CHAPTERS.includes(c)) issue(`chapter ${c} is out of scope`, ['bookChapters']);
    }
    if (m.kind === 'area' && (m.order < 1 || m.order > 6)) issue('area order is 1 to 6', ['order']);
    if (m.kind === 'elective' && (m.order < 1 || m.order > 5)) issue('elective order is 1 to 5', ['order']);
    if (m.kind !== 'area' && m.kind !== 'elective' && m.order !== 0) issue('order is 0 for this kind', ['order']);
    if (m.kind === 'area' && m.area !== 'none' && m.order !== AREA_CONTENT_MAP[m.area].order) {
      issue(`order for ${m.area} is ${AREA_CONTENT_MAP[m.area].order}`, ['order']);
    }

    if (m.draft && !opts.draftsAsPublished) return;

    // Content map, area modules.
    if (m.kind === 'area' && m.area !== 'none') {
      const map = AREA_CONTENT_MAP[m.area];
      if (m.title !== map.title) issue(`title must be "${map.title}"`, ['title']);
      if (!sameSet(m.talkBeats, [map.beat])) issue(`talkBeats must be ["${map.beat}"]`, ['talkBeats']);
      if (!sameSet(m.bookChapters, map.chapters)) issue(`bookChapters must be [${map.chapters.join(', ')}]`, ['bookChapters']);
      if (m.takeaway !== map.takeaway) issue('takeaway must match the content map verbatim', ['takeaway']);
      if (m.pitfall !== map.pitfall) issue('pitfall must match the content map verbatim', ['pitfall']);
      if (!sameSet(m.transferRows, map.transferRows)) issue(`transferRows must be [${map.transferRows.join(', ')}]`, ['transferRows']);
      if (m.readingMinutes < AREA_READING_MIN || m.readingMinutes > AREA_READING_MAX) {
        issue(`area modules read in ${AREA_READING_MIN} to ${AREA_READING_MAX} minutes`, ['readingMinutes']);
      }
    }
    // Electives: title and chapter from the elective set. The slug pairing is checked by content-check.
    if (m.kind === 'elective') {
      if (!ELECTIVE_TITLES.includes(m.title)) issue('elective title must be one of the five planned titles', ['title']);
      if (m.bookChapters.length !== 1 || !ELECTIVE_CHAPTERS.includes(m.bookChapters[0]!)) {
        issue('elective bookChapters must hold exactly one of 20, 21, 22, 29, 30', ['bookChapters']);
      }
      const planned = Object.values(ELECTIVE_MODULES).find((e) => e.title === m.title);
      if (planned && m.bookChapters[0] !== planned.chapter) issue(`"${m.title}" draws on chapter ${planned.chapter}`, ['bookChapters']);
    }
    if (m.kind === 'orientation') {
      if (!sameSet(m.talkBeats, ORIENTATION_MAP.talkBeats)) issue(`talkBeats must be [${ORIENTATION_MAP.talkBeats.join(', ')}]`, ['talkBeats']);
      if (!sameSet(m.bookChapters, ORIENTATION_MAP.bookChapters)) issue('bookChapters must be [1, 2]', ['bookChapters']);
    }
    if (m.kind === 'foundations' && !sameSet(m.bookChapters, FOUNDATIONS_MAP.bookChapters)) {
      issue('bookChapters must be [4, 5, 6]', ['bookChapters']);
    }

    // Self-check and outcomes.
    const min = m.kind === 'orientation' ? ORIENTATION_SELF_CHECK_MIN : SELF_CHECK_MIN;
    if (SELF_CHECK_KINDS.includes(m.kind)) {
      if (m.selfCheck.length < min || m.selfCheck.length > SELF_CHECK_MAX) {
        issue(`self-check needs ${min} to ${SELF_CHECK_MAX} questions, found ${m.selfCheck.length}`, ['selfCheck']);
      }
      if (m.outcomes.length === 0) issue('at least one learning outcome', ['outcomes']);
      const outcomeIds = new Set(m.outcomes.map((o) => o.id));
      const covered = new Set<string>();
      m.selfCheck.forEach((q, i) => {
        if (!q.outcome) issue(`question ${q.id} needs an outcome`, ['selfCheck', i, 'outcome']);
        else if (!outcomeIds.has(q.outcome)) issue(`question ${q.id} names unknown outcome ${q.outcome}`, ['selfCheck', i, 'outcome']);
        else covered.add(q.outcome);
      });
      for (const o of m.outcomes) {
        if (!covered.has(o.id)) issue(`outcome ${o.id} is not covered by any question`, ['outcomes']);
      }
    }
    const qids = new Set<string>();
    m.selfCheck.forEach((q, i) => {
      if (qids.has(q.id)) issue(`duplicate question id ${q.id}`, ['selfCheck', i, 'id']);
      qids.add(q.id);
    });
  };
}

export const moduleRules = makeModuleRules();

/** The schema the scripts use. Astro's collection adds reference() fields on top of moduleFields. */
export const moduleSchema = moduleFields.superRefine(moduleRules);
export const moduleSchemaDraftsAsPublished = moduleFields.superRefine(makeModuleRules({ draftsAsPublished: true }));

export const artifactSchema = z.object({
  title: z.string().min(1),
  origin: z.enum(ARTIFACT_ORIGINS),
  kind: z.enum(ARTIFACT_KINDS).default('other'),
  tool: z.string().optional(),
  version: z.string().optional(),
  checkedOn: isoDate,
  url: z.url().optional(),
  reviewedOn: isoDate.optional(),
  archivedOn: isoDate.optional(),
  archiveUrl: z.url().optional(),
  download: z.string().regex(/^\/artifacts\/[a-z0-9-]+\.[a-z0-9]+$/).optional(),
  summary: z.string().max(240).optional(),
});
export type ArtifactFrontmatter = z.infer<typeof artifactSchema>;

export const changelogSchema = z.object({
  date: isoDate,
  title: z.string().min(1),
});
