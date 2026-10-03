// src/components/islands/SelfCheck.tsx
// The self-check island (blueprint sections 9.1, 10.4, 14.5; spec 5.8). Grading is local and immediate;
// persistence is asynchronous and never changes what the learner sees beyond the sync line and the
// passed flag (NFR-6.1.3). Native controls only: radios for one correct option, checkboxes for several,
// buttons for the checks. No custom key handlers, no focus traps. Feedback lands in a live region that
// always exists. Default export, because A's SelfCheckPlacement imports it that way (docs/decisions.md,
// 2026-09-15).
//
// Persistence. persist="local" (orientation) keeps the state in this browser and never calls an action
// (AC-5.8.6, deviation 15.3.3). persist="account" saves locally first, then calls saveSelfCheck when
// signed in. A call that throws, gets no data, or fails on the server (5xx) is queued and resubmitted on
// the online event, on mount, and on Retry (EC-5.8.1). UNAUTHORIZED means the session is gone and shows
// the sign-in line without queuing. Any other 4xx is an error the learner can retry by hand.
//
// Restoring without announcing. The island is server-rendered empty and restores saved progress in the
// mount effect. The per-question feedback regions become live (role="status", aria-live="polite") only
// in the render after the restored state has committed, so a learner who reloads a passed self-check does
// not hear every feedback body again; the summary is live from the start, so the restored "Passed." is
// read back once, which gate row 1.10 expects. data-hydrated="true" is set in that same later render, so
// anything that waits for it sees live regions (docs/decisions.md, 2026-10-03, Phase 1 review round 2).
import { useEffect, useRef, useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import type { SelfCheckQuestion } from '../../lib/content-schema';
import { feedbackFor, isCorrect, isMultiple, type Selection } from '../../lib/self-check';
import { drainQueue, enqueue, isAnswers, loadLocal, readQueue, saveLocal, type QueuedSubmit, type SendOutcome } from './self-check-storage';
import '../../styles/islands.css';

export interface SavedSelfCheckState {
  answers: Record<string, number[]>; // best answer per question (last correct, else current)
  correctOnce: Record<string, boolean>;
  attempts: number;
  passed: boolean;
  updatedAt: string; // ISO
}

export interface SelfCheckProps {
  moduleSlug: string;
  questions: SelfCheckQuestion[]; // from frontmatter, including correct and feedback
  persist: 'local' | 'account'; // orientation is always local
  initialState?: SavedSelfCheckState | null; // from the account when persist is account
  signedIn: boolean; // false shows "Sign in to save your progress." without calling the action
  optional?: boolean; // orientation shows "Optional. Does not count toward completion."
}

type Sync = 'idle' | 'saving' | 'saved' | 'queued' | 'signed-out' | 'error';

interface Checked {
  correct: boolean;
  feedback: string[];
  /** The attempt number of this check. Keys the feedback body so each check fades in once. */
  seq: number;
}

interface Progress {
  selection: Selection;
  checked: Record<string, Checked>;
  correctOnce: Record<string, boolean>;
  lastCorrect: Selection;
  attempts: number;
  passed: boolean;
}

const EMPTY: Progress = { selection: {}, checked: {}, correctOnce: {}, lastCorrect: {}, attempts: 0, passed: false };

export const OPTIONAL_LINE = 'Optional. Does not count toward completion.';
/** Added to a multi-correct question's feedback when a check fails with correct options still unselected. */
export const MISSING_LINE = 'Not every correct option is selected yet.';
const VERDICT = { correct: 'Correct.', incorrect: 'Not yet.' } as const;
export const SYNC_LINES = {
  local: 'This self-check stays on this device.',
  signedOut: 'Sign in to save your progress.',
  saving: 'Saving',
  saved: 'Saved',
  queued: 'Saved on this device. Will sync when online.',
  error: 'Could not save. Retry.',
} as const;

type SaveOutcome = { kind: 'saved'; passed: boolean | undefined } | { kind: 'signed-out' } | { kind: 'not-found' } | { kind: 'error' } | { kind: 'network' };

/** The island reads the action result by shape, so it typechecks against C's stub and C's handler alike. */
function readSaveResult(result: unknown): SaveOutcome {
  if (typeof result !== 'object' || result === null) return { kind: 'network' };
  const { data, error } = result as { data?: unknown; error?: unknown };
  if (error !== undefined && error !== null) {
    const e = error as { code?: unknown; status?: unknown };
    if (e.code === 'UNAUTHORIZED') return { kind: 'signed-out' };
    if (e.code === 'NOT_FOUND') return { kind: 'not-found' };
    const status = typeof e.status === 'number' ? e.status : 500;
    // A server failure is not the learner's doing. Keep the answer and resubmit later.
    return status >= 500 ? { kind: 'network' } : { kind: 'error' };
  }
  if (data === undefined || data === null) return { kind: 'network' };
  const passed = (data as { passed?: unknown }).passed;
  return { kind: 'saved', passed: typeof passed === 'boolean' ? passed : undefined };
}

async function callSave(moduleSlug: string, answers: Record<string, number[]>): Promise<SaveOutcome> {
  try {
    return readSaveResult(await actions.saveSelfCheck({ moduleSlug, answers }));
  } catch {
    return { kind: 'network' };
  }
}

const sortIndices = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/**
 * The feedback paragraphs for a check. The island renders the verdict ("Correct." or "Not yet.") once, in Bold,
 * and the authoring convention opens every option's feedback with the same word. When every shown paragraph
 * opens with the verdict (always for a single-correct question, and for a uniform result on a multi-correct
 * one) the prefix is dropped, so a screen reader does not hear "Not yet. Not yet." A mixed result on a
 * multi-correct question keeps each paragraph's own prefix, because it says which pick was right. A failed
 * multi-correct check with correct options still unselected gets one more line, since the per-option feedback
 * covers only what was picked and nothing else says that options are missing.
 */
function feedbackLines(q: SelfCheckQuestion, sel: number[], correct: boolean): string[] {
  const verdict = correct ? VERDICT.correct : VERDICT.incorrect;
  const lines = feedbackFor(q, sel);
  const uniform = lines.length > 0 && lines.every((line) => line.startsWith(verdict));
  const out = uniform ? lines.map((line) => line.slice(verdict.length).trim()).filter((line) => line.length > 0) : [...lines];
  if (!correct && isMultiple(q) && q.correct.some((i) => !sel.includes(i))) out.push(MISSING_LINE);
  return out;
}

/** Keeps only known question ids and option indices that exist. */
function validSelection(questions: SelfCheckQuestion[], answers: Record<string, number[]>): Selection {
  const out: Selection = {};
  for (const q of questions) {
    const sel = answers[q.id];
    if (!sel) continue;
    const kept = sortIndices(sel.filter((i) => i >= 0 && i < q.options.length));
    if (kept.length > 0) out[q.id] = kept;
  }
  return out;
}

/**
 * Builds the island state from a saved copy. A copy without correctOnce (an account row passed as
 * is) derives it by grading the saved answers, which hold the best answer per question.
 */
function fromSaved(questions: SelfCheckQuestion[], saved: SavedSelfCheckState): Progress {
  const selection = validSelection(questions, saved.answers);
  const checked: Record<string, Checked> = {};
  const correctOnce: Record<string, boolean> = {};
  const lastCorrect: Selection = {};
  const attempts = Number.isInteger(saved.attempts) && saved.attempts >= 0 ? saved.attempts : 0;
  const hasFlags = typeof saved.correctOnce === 'object' && saved.correctOnce !== null;
  for (const q of questions) {
    const sel = selection[q.id];
    const correct = isCorrect(q, sel);
    const once = hasFlags ? saved.correctOnce[q.id] === true || correct : correct;
    if (once) correctOnce[q.id] = true;
    if (correct && sel) lastCorrect[q.id] = sel;
    if (sel) checked[q.id] = { correct, feedback: feedbackLines(q, sel, correct), seq: attempts };
  }
  const allCorrect = questions.length > 0 && questions.every((q) => correctOnce[q.id]);
  return { selection, checked, correctOnce, lastCorrect, attempts, passed: saved.passed === true || allCorrect };
}

/** Best answers: the last correct selection where one exists, else the current selection. */
function bestAnswers(questions: SelfCheckQuestion[], p: Progress): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const q of questions) {
    const best = p.correctOnce[q.id] ? p.lastCorrect[q.id] : p.selection[q.id];
    if (best && best.length > 0) out[q.id] = best;
  }
  return out;
}

function toSaved(questions: SelfCheckQuestion[], p: Progress, now: Date = new Date()): SavedSelfCheckState {
  return { answers: bestAnswers(questions, p), correctOnce: { ...p.correctOnce }, attempts: p.attempts, passed: p.passed, updatedAt: now.toISOString() };
}

function updatedAtMs(s: { updatedAt: unknown }): number {
  const v = s.updatedAt;
  const ms = v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/** The account copy, or the local copy when it is newer. */
function pickStart(account: SavedSelfCheckState | null | undefined, local: SavedSelfCheckState | null): SavedSelfCheckState | null {
  const a = account && isAnswers(account.answers) ? account : null;
  if (!a) return local;
  if (!local) return a;
  return updatedAtMs(local) > updatedAtMs(a) ? local : a;
}

export default function SelfCheck({ moduleSlug, questions, persist, initialState, signedIn, optional = false }: SelfCheckProps) {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [sync, setSync] = useState<Sync>('idle');
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const saveSeq = useRef(0);
  const persists = persist === 'account' && signedIn;

  function adoptPassed(passed: boolean | undefined) {
    if (passed !== true) return;
    setProgress((p) => (p.passed ? p : { ...p, passed: true }));
    const current = progressRef.current;
    if (!current.passed) saveLocal(moduleSlug, toSaved(questions, { ...current, passed: true }));
  }

  /** The drain callback. Items for another module touch nothing on this page but the queue. */
  async function send(item: QueuedSubmit): Promise<SendOutcome> {
    const outcome = await callSave(item.moduleSlug, item.answers);
    const mine = item.moduleSlug === moduleSlug;
    switch (outcome.kind) {
      case 'saved':
        if (mine) {
          adoptPassed(outcome.passed);
          setSync('saved');
        }
        return 'sent';
      case 'signed-out':
        if (mine) setSync('signed-out');
        return 'drop';
      case 'not-found':
        if (mine) setSync('error');
        return 'drop';
      case 'error':
        if (mine) setSync('queued');
        return 'retry';
      default:
        if (mine) setSync('queued');
        return 'retry';
    }
  }

  function drain() {
    if (!persists) return;
    void drainQueue(send);
  }

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setReduceMotion(true);
      }
    } catch {
      // matchMedia is a convenience.
    }
    const local = loadLocal(moduleSlug);
    const start = persist === 'local' ? local : pickStart(initialState, local);
    if (start) setProgress(fromSaved(questions, start));
    if (persists && readQueue().some((q) => q.moduleSlug === moduleSlug)) setSync('queued');
    setRestored(true);
    drain();
    // Mount only. The props do not change after hydration.
  }, []);

  // The render after the restore has committed: the feedback regions go live and the root reports hydrated.
  useEffect(() => {
    if (restored) setHydrated(true);
  }, [restored]);

  useEffect(() => {
    if (!persists || typeof window === 'undefined') return;
    const onOnline = () => drain();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [persists]);

  async function persistAnswers(answers: Record<string, number[]>) {
    const seq = (saveSeq.current += 1);
    setSync('saving');
    const outcome = await callSave(moduleSlug, answers);
    if (outcome.kind === 'saved') adoptPassed(outcome.passed);
    if (seq !== saveSeq.current) return; // a later check owns the sync line
    switch (outcome.kind) {
      case 'saved':
        setSync('saved');
        break;
      case 'signed-out':
        setSync('signed-out');
        break;
      case 'network':
        enqueue({ moduleSlug, answers, queuedAt: new Date().toISOString() });
        setSync('queued');
        break;
      default:
        setSync('error');
    }
  }

  function select(q: SelfCheckQuestion, index: number, multiple: boolean) {
    setProgress((p) => {
      const current = p.selection[q.id] ?? [];
      const next = multiple ? (current.includes(index) ? current.filter((i) => i !== index) : sortIndices([...current, index])) : [index];
      return { ...p, selection: { ...p.selection, [q.id]: next } };
    });
    if (notice[q.id]) setNotice((n) => ({ ...n, [q.id]: '' }));
  }

  function check(q: SelfCheckQuestion) {
    const p = progressRef.current;
    const sel = p.selection[q.id] ?? [];
    if (sel.length === 0) {
      setNotice((n) => ({ ...n, [q.id]: 'Choose an option first.' }));
      return;
    }
    const correct = isCorrect(q, sel);
    const attempts = p.attempts + 1;
    const correctOnce = correct ? { ...p.correctOnce, [q.id]: true } : p.correctOnce;
    const lastCorrect = correct ? { ...p.lastCorrect, [q.id]: sel } : p.lastCorrect;
    const passed = p.passed || questions.every((x) => correctOnce[x.id]);
    const next: Progress = {
      ...p,
      checked: { ...p.checked, [q.id]: { correct, feedback: feedbackLines(q, sel, correct), seq: attempts } },
      correctOnce,
      lastCorrect,
      attempts,
      passed,
    };
    progressRef.current = next;
    setProgress(next);
    if (notice[q.id]) setNotice((n) => ({ ...n, [q.id]: '' }));
    const saved = toSaved(questions, next);
    saveLocal(moduleSlug, saved);
    if (persists) void persistAnswers(saved.answers);
  }

  function retry() {
    if (!persists) return;
    if (readQueue().some((q) => q.moduleSlug === moduleSlug)) {
      drain();
      return;
    }
    void persistAnswers(bestAnswers(questions, progressRef.current));
  }

  const total = questions.length;
  const correctCount = questions.filter((q) => progress.correctOnce[q.id]).length;
  const syncLine =
    persist === 'local'
      ? SYNC_LINES.local
      : !signedIn
        ? SYNC_LINES.signedOut
        : sync === 'saving'
          ? SYNC_LINES.saving
          : sync === 'saved'
            ? SYNC_LINES.saved
            : sync === 'queued'
              ? SYNC_LINES.queued
              : sync === 'signed-out'
                ? SYNC_LINES.signedOut
                : sync === 'error'
                  ? SYNC_LINES.error
                  : '';
  const showRetry = persists && (sync === 'queued' || sync === 'error');
  // One string, one text node. Preact re-sets every text child on a render, and a live region built from
  // several nodes (a number, " of ", an empty string) would get characterData writes on every arrow key or
  // Space even when the sentence is unchanged, which some screen readers announce.
  const summaryText = `${correctCount} of ${total} answered correctly.${progress.passed ? ' Passed.' : ''}${syncLine ? ` ${syncLine}` : ''}`;

  return (
    <section class="self-check" aria-label="Self-check" data-hydrated={hydrated ? 'true' : 'false'} data-motion={reduceMotion ? 'reduce' : undefined}>
      {optional && <p class="self-check-note">{OPTIONAL_LINE}</p>}
      {questions.map((q, index) => {
        const multiple = isMultiple(q);
        const sel = progress.selection[q.id] ?? [];
        const result = progress.checked[q.id];
        const state = result ? (result.correct ? 'correct' : 'incorrect') : 'pending';
        const base = `self-check-${moduleSlug}-${q.id}`;
        const note = notice[q.id];
        return (
          <article class="self-check-question" data-state={state} key={q.id}>
            <h3 class="self-check-title">
              <span class="visually-hidden">
                Question {index + 1} of {total}.
              </span>{' '}
              {q.question}
            </h3>
            <fieldset class="self-check-options">
              <legend>
                <span class="visually-hidden">{q.question}</span>
                {multiple && ' '}
                {multiple && <span class="self-check-hint">Select all that apply.</span>}
              </legend>
              {q.options.map((option, i) => {
                const selected = sel.includes(i);
                return (
                  <label class="option-row" data-selected={selected ? 'true' : 'false'} key={i}>
                    <input type={multiple ? 'checkbox' : 'radio'} name={base} value={String(i)} checked={selected} onInput={() => select(q, i, multiple)} />
                    <span>{option}</span>
                  </label>
                );
              })}
            </fieldset>
            <button type="button" class="btn btn-area" onClick={() => check(q)}>
              {result ? 'Check again' : 'Check answer'}
            </button>
            <div class="self-check-feedback" role={hydrated ? 'status' : undefined} aria-live={hydrated ? 'polite' : undefined} id={`${base}-feedback`}>
              {note ? (
                <p>{note}</p>
              ) : result ? (
                <div class="self-check-feedback-body" key={result.seq}>
                  <p>
                    <b>{result.correct ? 'Correct.' : 'Not yet.'}</b>
                  </p>
                  {result.feedback.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      <div class="self-check-footer">
        <p class="self-check-summary" role="status" aria-live="polite">
          {summaryText}
        </p>
        {showRetry && (
          <button type="button" class="btn btn-outline" onClick={retry}>
            Retry
          </button>
        )}
      </div>
    </section>
  );
}
