// src/lib/plan.ts
import { AREA_KEYS, AREA_TITLES, type AreaKey, type AssessmentSpec } from './content-schema';

export type Ratings = Record<string, number>;
export const MAX_RATING = 3;
export const FOCUS_COUNT = 3;
export const RATING_LABELS = ['Not yet', 'Aware', 'Practiced', 'Confident'] as const;
export const DEFAULT_FEATURE = 'the AI feature you are closest to';
export const DEFAULT_ROLE = 'your role';

export interface AssessmentContext {
  role: string;
  feature: string;
  ownsSystem: 'yes' | 'no' | 'partly';
}

export interface PlanStep { step: 1 | 2 | 3 | 4; title: string; text: string; href: string }
export interface PlanArea { area: AreaKey; title: string; moduleSlug: string; score: number; gapNew: number; gapTransfer: number }
/** feature is the learner's stated feature (or the default phrase), so every focus references it. */
export interface PlanFocus { area: AreaKey; title: string; moduleSlug: string; feature: string; steps: PlanStep[] }
export interface PlanLink { text: string; href: string }

export interface Plan {
  schema: 1;
  generatedAt: string;
  kind: 'ranked' | 'uniform-high';
  context: AssessmentContext;
  intro: string;
  areas: PlanArea[];        // all six, ranked
  focus: PlanFocus[];       // top areas with a gap, at most FOCUS_COUNT
  nextSteps: PlanLink[];
  missingModules: Array<{ slug: string; title: string }>;
}

export function itemIds(spec: AssessmentSpec): string[] {
  return spec.areas.flatMap((a) => [...a.transfers, ...a.competencies].map((i) => i.id));
}

/** Keeps only ratings for ids the spec declares. */
export function pickRatings(spec: AssessmentSpec, ratings: Ratings): Ratings {
  const ids = new Set(itemIds(spec));
  return Object.fromEntries(Object.entries(ratings).filter(([k]) => ids.has(k)));
}

/** Ids that have no rating in 0..3. */
export function missingRatings(spec: AssessmentSpec, ratings: Ratings): string[] {
  return itemIds(spec).filter((id) => {
    const r = ratings[id];
    return !(Number.isInteger(r) && r >= 0 && r <= MAX_RATING);
  });
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function rankAreas(spec: AssessmentSpec, ratings: Ratings): PlanArea[] {
  const areas = spec.areas.map((a) => {
    const gapNew = round3(mean(a.competencies.map((i) => MAX_RATING - ratings[i.id])));
    const gapTransfer = round3(mean(a.transfers.map((i) => MAX_RATING - ratings[i.id])));
    // "What is new" items weigh double (AC-5.10.3: lowest ratings on new items first).
    const score = round3(2 * gapNew + gapTransfer);
    return { area: a.area, title: AREA_TITLES[a.area], moduleSlug: a.moduleSlug, score, gapNew, gapTransfer };
  });
  return areas.sort(
    (x, y) => y.score - x.score || y.gapNew - x.gapNew || AREA_KEYS.indexOf(x.area) - AREA_KEYS.indexOf(y.area),
  );
}

export function isUniformHigh(spec: AssessmentSpec, ratings: Ratings): boolean {
  return itemIds(spec).every((id) => ratings[id] === MAX_RATING);
}

function featureOf(context: AssessmentContext): string {
  return context.feature.trim() || DEFAULT_FEATURE;
}

function fill(text: string, context: AssessmentContext): string {
  const role = context.role.trim() || DEFAULT_ROLE;
  return text.replaceAll('{feature}', featureOf(context)).replaceAll('{role}', role);
}

function intro(context: AssessmentContext): string {
  const feature = featureOf(context);
  switch (context.ownsSystem) {
    case 'yes':
      return `You own a model-dependent system today. Start step 1 on that system this week, beginning with ${feature}.`;
    case 'partly':
      return `You share responsibility for a model-dependent system. Start step 1 on the part you can change, beginning with ${feature}.`;
    default:
      return `You do not own a model-dependent system yet. Start step 1 on ${feature} as an observer, then build the smallest constrained version yourself.`;
  }
}

export function buildPlan(
  spec: AssessmentSpec,
  ratings: Ratings,
  context: AssessmentContext,
  missingModules: Array<{ slug: string; title: string }>,
  now: Date = new Date(),
): Plan {
  const missing = missingRatings(spec, ratings);
  if (missing.length > 0) throw new Error(`Unrated items: ${missing.join(', ')}`);
  const areas = rankAreas(spec, ratings);
  const uniformHigh = isUniformHigh(spec, ratings);
  const feature = featureOf(context);
  const focusAreas = uniformHigh ? [] : areas.filter((a) => a.score > 0).slice(0, FOCUS_COUNT);
  const focus: PlanFocus[] = focusAreas.map((a) => {
    const areaSpec = spec.areas.find((s) => s.area === a.area)!;
    const steps = [...areaSpec.steps]
      .sort((x, y) => x.step - y.step)
      .map((s) => {
        const road = spec.roadmap.find((r) => r.step === s.step)!;
        return {
          step: s.step as 1 | 2 | 3 | 4,
          title: road.title,
          text: `${road.subline} ${fill(s.text, context)}`.trim(),
          href: s.href,
        };
      });
    return { area: a.area, title: a.title, moduleSlug: a.moduleSlug, feature, steps };
  });
  const nextSteps: PlanLink[] = [
    ...missingModules.map((m) => ({ text: `Complete ${m.title}`, href: `/modules/${m.slug}` })),
    ...(uniformHigh ? spec.uniformHigh.links : []),
  ];
  return {
    schema: 1,
    generatedAt: now.toISOString(),
    kind: uniformHigh ? 'uniform-high' : 'ranked',
    context,
    intro: uniformHigh ? spec.uniformHigh.text : intro(context),
    areas,
    focus,
    nextSteps,
    missingModules,
  };
}

const ownsLabel = { yes: 'Yes', no: 'No', partly: 'Partly' } as const;

/** Plain Markdown. No em-dashes. Links are absolute so the file stands alone. */
export function renderPlanMarkdown(plan: Plan, siteUrl: string, version?: number): string {
  const base = siteUrl.replace(/\/$/, '');
  const date = plan.generatedAt.slice(0, 10);
  const lines: string[] = [];
  lines.push('# Your AI engineering plan', '');
  lines.push(`Generated ${date} from your self-assessment${version ? ` (version ${version})` : ''}.`, '');
  lines.push('## Your context', '');
  lines.push(`- Role: ${plan.context.role.trim() || 'not given'}`);
  lines.push(`- Closest AI feature: ${plan.context.feature.trim() || 'not given'}`);
  lines.push(`- Owns a model-dependent system today: ${ownsLabel[plan.context.ownsSystem]}`, '');
  lines.push(plan.intro, '');
  lines.push('## Areas ranked by gap', '');
  lines.push('| Area | Gap on what is new | Gap on what transfers | Score |', '|---|---|---|---|');
  for (const a of plan.areas) lines.push(`| ${a.title} | ${a.gapNew} | ${a.gapTransfer} | ${a.score} |`);
  lines.push('');
  if (plan.kind === 'uniform-high') {
    lines.push('## Where to go next', '');
  } else {
    plan.focus.forEach((f, i) => {
      lines.push(`## Focus ${i + 1}: ${f.title}`, '');
      lines.push(`Applied to: ${f.feature}`, '');
      for (const s of f.steps) lines.push(`${s.step}. **${s.title}** ${s.text} ([module section](${base}${s.href}))`);
      lines.push('');
    });
    if (plan.nextSteps.length > 0) lines.push('## Next steps', '');
  }
  for (const n of plan.nextSteps) {
    const href = n.href.startsWith('/') ? `${base}${n.href}` : n.href;
    lines.push(`- [${n.text}](${href})`);
  }
  if (plan.nextSteps.length > 0) lines.push('');
  lines.push(`Source: the four-step roadmap from the talk. ${base}`, '');
  return lines.join('\n');
}
