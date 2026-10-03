// src/components/islands/SelfAssessment.tsx
// The guided self-assessment island (blueprint sections 9.6, 10.4; spec 5.10). Eight steps: the three
// context questions, one step per area in talk order with the transfer items under "What transfers" and
// the competencies under "What is new", then the plan. Every item is a native radio group on the
// four-point scale from the closing module's frontmatter. Next refuses to move past an unrated item: an
// alert names it, and the item's fieldset takes the description and the focus. On every step change the
// focus moves to the step heading. The plan comes from the saveSelfAssessment action, which stores a new
// version; the text of the latest version is editable through updatePlanText and exported verbatim by
// /account/plan.md. The learner's text appears only inside the textarea, never rendered (NFR-6.2.3).
// Default export, like SelfCheck (docs/decisions.md, 2026-09-15).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import { AREA_TITLES, type AssessmentSpec } from '../../lib/content-schema';
import { isoDate } from '../../lib/dates';
import { PLAN_TEXT_MAX_CHARS } from '../../lib/limits';
import { DEFAULT_FEATURE, MAX_RATING, pickRatings, type AssessmentContext, type Plan, type Ratings } from '../../lib/plan';
import '../../styles/islands.css';

export interface SelfAssessmentProps {
  spec: AssessmentSpec; // closing module frontmatter
  latest: { version: number; ratings: Ratings; context: AssessmentContext; plan: Plan; planText: string; createdAt: string } | null;
  versions: Array<{ version: number; createdAt: string }>;
  missingModules: Array<{ slug: string; title: string }>;
}

type OwnsSystem = AssessmentContext['ownsSystem'];
interface DraftContext {
  role: string;
  feature: string;
  ownsSystem: OwnsSystem | '';
}
interface Current {
  version: number;
  plan: Plan;
  planText: string;
  createdAt: string;
}
interface Blocker {
  targetId: string;
  message: string;
}
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; line: string } | { kind: 'error'; message: string; retry: boolean };

export const STEP_COUNT = 8;
export const CONTEXT_STEP_TITLE = 'Your context';
export const PLAN_STEP_TITLE = 'Your plan';
export const BLOCKER_ID = 'assessment-blocker';
export const OWNS_GROUP_ID = 'assessment-owns';
export const MESSAGES = {
  saving: 'Saving',
  saved: 'Saved',
  editsSaved: 'Edits saved',
  retry: 'Could not save. Retry.',
  signedOut: 'Sign in to save your progress.',
  rejected: 'Some answers were not accepted. Check your ratings and try again.',
} as const;

const OWNS_OPTIONS: ReadonlyArray<{ value: OwnsSystem; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partly', label: 'Partly' },
];

const ratingGroupId = (itemId: string) => `assessment-rating-${itemId}`;

function isRated(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_RATING;
}

/** "Context engineering." becomes "Context engineering" inside the sentence. */
const clause = (text: string) => text.trim().replace(/\.$/, '');

type Outcome = { kind: 'ok'; data: unknown } | { kind: 'error'; code: string; status: number; message: string; input: boolean } | { kind: 'network' };

/** Reads an action result by shape, so the island typechecks against C's stub and C's handler alike. */
async function callAction(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    const result = await run();
    if (typeof result !== 'object' || result === null) return { kind: 'network' };
    const { data, error } = result as { data?: unknown; error?: unknown };
    if (error !== undefined && error !== null) {
      const e = error as { code?: unknown; status?: unknown; message?: unknown; type?: unknown; fields?: unknown };
      return {
        kind: 'error',
        code: typeof e.code === 'string' ? e.code : 'INTERNAL_SERVER_ERROR',
        status: typeof e.status === 'number' ? e.status : 500,
        message: typeof e.message === 'string' ? e.message : '',
        input: e.type === 'AstroActionInputError' || (typeof e.fields === 'object' && e.fields !== null),
      };
    }
    if (data === undefined || data === null) return { kind: 'network' };
    return { kind: 'ok', data };
  } catch {
    return { kind: 'network' };
  }
}

function failure(outcome: Exclude<Outcome, { kind: 'ok' }>): SaveState {
  if (outcome.kind === 'network') return { kind: 'error', message: MESSAGES.retry, retry: true };
  if (outcome.code === 'UNAUTHORIZED') return { kind: 'error', message: MESSAGES.signedOut, retry: false };
  if (outcome.input) return { kind: 'error', message: MESSAGES.rejected, retry: false };
  if (outcome.status >= 500) return { kind: 'error', message: MESSAGES.retry, retry: true };
  // A learner-facing sentence from the handler: a missing rating, a rate limit, a version conflict.
  return { kind: 'error', message: outcome.message || MESSAGES.retry, retry: outcome.code === 'TOO_MANY_REQUESTS' };
}

function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  return new Date().toISOString();
}

/** The saveSelfAssessment result: { version, plan, planText, createdAt } (blueprint section 7.3). */
function readGenerated(data: unknown): Current | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { version?: unknown; plan?: unknown; planText?: unknown; createdAt?: unknown };
  if (!Number.isInteger(d.version) || (d.version as number) < 1) return null;
  if (typeof d.plan !== 'object' || d.plan === null || !Array.isArray((d.plan as Plan).areas)) return null;
  if (typeof d.planText !== 'string') return null;
  return { version: d.version as number, plan: d.plan as Plan, planText: d.planText, createdAt: toIso(d.createdAt) };
}

export default function SelfAssessment({ spec, latest, versions: initialVersions, missingModules }: SelfAssessmentProps) {
  const [step, setStep] = useState(latest ? STEP_COUNT - 1 : 0);
  const [ratings, setRatings] = useState<Ratings>(() => (latest ? pickRatings(spec, latest.ratings) : {}));
  const [context, setContext] = useState<DraftContext>(() => ({
    role: latest?.context.role ?? '',
    feature: latest?.context.feature ?? '',
    ownsSystem: latest?.context.ownsSystem ?? '',
  }));
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [current, setCurrent] = useState<Current | null>(latest ? { version: latest.version, plan: latest.plan, planText: latest.planText, createdAt: latest.createdAt } : null);
  const [planText, setPlanText] = useState(latest?.planText ?? '');
  const [versions, setVersions] = useState(initialVersions);
  const [retake, setRetake] = useState(false);
  const [generateState, setGenerateState] = useState<SaveState>({ kind: 'idle' });
  const [editState, setEditState] = useState<SaveState>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [focusHeading, setFocusHeading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Focus follows the step change, never the first paint. Layout effects run as the DOM commits, so the
  // focus lands on the new heading before the next event.
  useLayoutEffect(() => {
    if (!focusHeading) return;
    headingRef.current?.focus();
    setFocusHeading(false);
  }, [focusHeading, step]);

  useLayoutEffect(() => {
    if (!blocker || typeof document === 'undefined') return;
    document.getElementById(blocker.targetId)?.focus();
  }, [blocker]);

  const titleFor = (s: number) => (s === 0 ? CONTEXT_STEP_TITLE : s === STEP_COUNT - 1 ? PLAN_STEP_TITLE : AREA_TITLES[spec.areas[s - 1]!.area]);

  function firstBlocker(s: number): Blocker | null {
    if (s === 0) {
      return context.ownsSystem ? null : { targetId: OWNS_GROUP_ID, message: `Answer the question before continuing: ${spec.contextQuestions.ownsSystem}` };
    }
    if (s >= 1 && s <= 6) {
      const area = spec.areas[s - 1]!;
      for (const item of [...area.transfers, ...area.competencies]) {
        if (!isRated(ratings[item.id])) return { targetId: ratingGroupId(item.id), message: `Rate: ${clause(item.text)} before continuing.` };
      }
    }
    return null;
  }

  function goTo(s: number) {
    setStep(s);
    setFocusHeading(true);
  }

  function next() {
    const b = firstBlocker(step);
    if (b) {
      setBlocker(b);
      return;
    }
    setBlocker(null);
    goTo(step + 1);
  }

  function back() {
    setBlocker(null);
    goTo(step - 1);
  }

  function startRetake() {
    setRetake(true);
    setBlocker(null);
    setGenerateState({ kind: 'idle' });
    goTo(0);
  }

  async function generate() {
    if (busy.current) return;
    for (let s = 0; s < STEP_COUNT - 1; s += 1) {
      const b = firstBlocker(s);
      if (b) {
        setBlocker(b);
        if (s !== step) goTo(s);
        return;
      }
    }
    const ctx: AssessmentContext = { role: context.role.trim(), feature: context.feature.trim(), ownsSystem: context.ownsSystem as OwnsSystem };
    busy.current = true;
    setGenerateState({ kind: 'saving' });
    const outcome = await callAction(() => actions.saveSelfAssessment({ ratings: pickRatings(spec, ratings), context: ctx }));
    busy.current = false;
    if (outcome.kind !== 'ok') {
      setGenerateState(failure(outcome));
      return;
    }
    const generated = readGenerated(outcome.data);
    if (!generated) {
      setGenerateState({ kind: 'error', message: MESSAGES.retry, retry: true });
      return;
    }
    setCurrent(generated);
    setPlanText(generated.planText);
    setVersions((prev) => [{ version: generated.version, createdAt: generated.createdAt }, ...prev.filter((v) => v.version !== generated.version)].sort((a, b) => b.version - a.version));
    setRetake(false);
    setEditState({ kind: 'idle' });
    setGenerateState({ kind: 'saved', line: MESSAGES.saved });
    setFocusHeading(true);
  }

  async function saveEdits() {
    if (!current || busy.current) return;
    busy.current = true;
    setEditState({ kind: 'saving' });
    const outcome = await callAction(() => actions.updatePlanText({ version: current.version, planText }));
    busy.current = false;
    setEditState(outcome.kind === 'ok' ? { kind: 'saved', line: MESSAGES.editsSaved } : failure(outcome));
  }

  const describedBy = (id: string) => (blocker?.targetId === id ? BLOCKER_ID : undefined);
  const syncLine = (state: SaveState) => (state.kind === 'saving' ? MESSAGES.saving : state.kind === 'saved' ? state.line : state.kind === 'error' ? state.message : '');
  const title = titleFor(step);
  const area = step >= 1 && step <= 6 ? spec.areas[step - 1] : undefined;
  const showPlan = step === STEP_COUNT - 1 && current && !retake;
  const feature = context.feature.trim() || DEFAULT_FEATURE;

  const ratingGroup = (item: { id: string; text: string }) => {
    const id = ratingGroupId(item.id);
    return (
      <fieldset class="assessment-rating-group rating-group" id={id} tabIndex={-1} aria-describedby={describedBy(id)} key={item.id}>
        <legend>{item.text}</legend>
        <div class="assessment-scale">
          {spec.scale.map((label, n) => {
            const selected = ratings[item.id] === n;
            return (
              <label class="option-row" data-selected={selected ? 'true' : 'false'} key={n}>
                <input type="radio" name={id} value={String(n)} checked={selected} onInput={() => setRatings((r) => ({ ...r, [item.id]: n }))} />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <section class="assessment" aria-label="Self-assessment" data-hydrated={hydrated ? 'true' : 'false'}>
      <p class="assessment-status" role="status" aria-live="polite">
        Step {step + 1} of {STEP_COUNT}: {title}
      </p>
      <section class="assessment-step" aria-labelledby="assessment-step-title">
        <h2 id="assessment-step-title" tabIndex={-1} ref={headingRef}>
          {title}
        </h2>

        {step === 0 && (
          <div class="assessment-fields">
            <div>
              <label class="field-label" for="assessment-role">
                {spec.contextQuestions.role} <span class="small secondary">optional</span>
              </label>
              <input class="field" id="assessment-role" type="text" maxLength={120} autocomplete="organization-title" value={context.role} onInput={(e) => setContext({ ...context, role: e.currentTarget.value })} />
            </div>
            <div>
              <label class="field-label" for="assessment-feature">
                {spec.contextQuestions.feature} <span class="small secondary">optional</span>
              </label>
              <input class="field" id="assessment-feature" type="text" maxLength={200} value={context.feature} onInput={(e) => setContext({ ...context, feature: e.currentTarget.value })} />
            </div>
            <fieldset class="assessment-field-group" id={OWNS_GROUP_ID} tabIndex={-1} aria-describedby={describedBy(OWNS_GROUP_ID)}>
              <legend>{spec.contextQuestions.ownsSystem}</legend>
              <div class="assessment-scale">
                {OWNS_OPTIONS.map((option) => {
                  const selected = context.ownsSystem === option.value;
                  return (
                    <label class="option-row" data-selected={selected ? 'true' : 'false'} key={option.value}>
                      <input type="radio" name={OWNS_GROUP_ID} value={option.value} checked={selected} onInput={() => setContext({ ...context, ownsSystem: option.value })} />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {area && (
          <div class="assessment-fields">
            <h3>What transfers</h3>
            {area.transfers.map(ratingGroup)}
            <h3>What is new</h3>
            {area.competencies.map(ratingGroup)}
          </div>
        )}

        {step === STEP_COUNT - 1 && !showPlan && (
          <div class="assessment-generate">
            <p>Every item is rated. The plan ranks the six areas by gap and applies the talk's four steps to {feature}.</p>
            <p class="secondary">"Autonomy is earned by evals, one step at a time."</p>
            <div class="assessment-actions">
              <button type="button" class="btn btn-primary" onClick={() => void generate()}>
                Generate my plan
              </button>
              {generateState.kind === 'error' && generateState.retry && (
                <button type="button" class="btn btn-outline" onClick={() => void generate()}>
                  Retry
                </button>
              )}
            </div>
            <p class="assessment-sync" role="status" aria-live="polite">
              {syncLine(generateState)}
            </p>
          </div>
        )}

        {showPlan && current && (
          <div class="assessment-plan">
            <p class="assessment-sync" role="status" aria-live="polite">
              {syncLine(generateState)}
            </p>
            <p class="assessment-plan-intro">{current.plan.intro}</p>
            <div class="table-wrap">
              <table>
                <caption>Areas ranked by gap</caption>
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Gap on what is new</th>
                    <th scope="col">Gap on what transfers</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {current.plan.areas.map((a) => (
                    <tr key={a.area}>
                      <th scope="row">{a.title}</th>
                      <td>{a.gapNew}</td>
                      <td>{a.gapTransfer}</td>
                      <td>{a.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {current.plan.focus.map((f, i) => (
              <section class="assessment-focus" aria-labelledby={`assessment-focus-${i + 1}`} key={f.area}>
                <h3 id={`assessment-focus-${i + 1}`}>
                  Focus {i + 1}: {f.title}
                </h3>
                <p>Applied to: {f.feature}</p>
                <ol>
                  {f.steps.map((s) => (
                    <li key={s.step}>
                      <b>{s.title}</b> {s.text}{' '}
                      <a href={s.href}>
                        Open the module section<span class="visually-hidden"> for step {s.step} of {f.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {current.plan.nextSteps.length > 0 && (
              <div>
                <h3>{current.plan.kind === 'uniform-high' ? 'Where to go next' : 'Next steps'}</h3>
                <ul>
                  {current.plan.nextSteps.map((n) => (
                    <li key={`${n.href} ${n.text}`}>
                      <a href={n.href}>{n.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {current.plan.missingModules.length > 0 && (
              <p class="assessment-notice" role="note">
                Modules not yet complete:{' '}
                {current.plan.missingModules.map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 ? ', ' : ''}
                    <a href={`/modules/${m.slug}`}>{m.title}</a>
                  </span>
                ))}
                .
              </p>
            )}
            <div class="assessment-editor">
              <h3>Edit your plan</h3>
              <label class="field-label" for="assessment-plan-text">
                Plan text <span class="small secondary">Markdown</span>
              </label>
              <textarea class="field" id="assessment-plan-text" maxLength={PLAN_TEXT_MAX_CHARS} aria-describedby="assessment-plan-help" value={planText} onInput={(e) => setPlanText(e.currentTarget.value)} />
              <p class="field-help" id="assessment-plan-help">
                Edits save to version {current.version}, the latest. The download carries your text as written.
              </p>
              <div class="assessment-actions">
                <button type="button" class="btn btn-outline" onClick={() => void saveEdits()}>
                  Save edits
                </button>
                <a class="btn btn-outline" href={`/account/plan.md?version=${current.version}`}>
                  Download as Markdown
                </a>
              </div>
              <p class="assessment-sync" role="status" aria-live="polite">
                {syncLine(editState)}
              </p>
            </div>
            <div>
              <h3>Previous versions</h3>
              <ul class="assessment-versions">
                {versions.map((v) => (
                  <li key={v.version}>
                    Version {v.version}, {isoDate(v.createdAt)}
                    {v.version === current.version ? ' (current)' : ''}.{' '}
                    <a href={`/account/plan.md?version=${v.version}`}>Download version {v.version}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div class="assessment-actions">
              <button type="button" class="btn btn-outline" onClick={startRetake}>
                Retake the assessment
              </button>
            </div>
          </div>
        )}

        {blocker && (
          <p class="assessment-blocker" id={BLOCKER_ID} role="alert">
            {blocker.message}
          </p>
        )}
        <div class="assessment-nav">
          {step > 0 && (
            <button type="button" class="btn btn-outline" onClick={back}>
              Back
            </button>
          )}
          {step < STEP_COUNT - 1 && (
            <button type="button" class="btn btn-primary" onClick={next}>
              Next
            </button>
          )}
        </div>
      </section>
      {missingModules.length > 0 && !showPlan && (
        <p class="assessment-notice" role="note">
          You can finish the assessment before every area module is complete. Not yet complete:{' '}
          {missingModules.map((m, i) => (
            <span key={m.slug}>
              {i > 0 ? ', ' : ''}
              <a href={`/modules/${m.slug}`}>{m.title}</a>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}
