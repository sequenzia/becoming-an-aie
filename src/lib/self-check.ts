// src/lib/self-check.ts
import type { SelfCheckQuestion } from './content-schema';

export type Selection = Record<string, number[]>;

export function isMultiple(q: SelfCheckQuestion): boolean {
  return q.correct.length > 1;
}

/** Set equality between the chosen indices and the correct indices. */
export function isCorrect(q: SelfCheckQuestion, selected: number[] | undefined): boolean {
  if (!selected || selected.length === 0) return false;
  const a = [...new Set(selected)].sort((x, y) => x - y);
  const b = [...q.correct].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function feedbackFor(q: SelfCheckQuestion, selected: number[]): string[] {
  return [...new Set(selected)].filter((i) => i >= 0 && i < q.feedback.length).map((i) => q.feedback[i]);
}

/** Keeps only the entries whose key is a question id. */
export function pickKnown(questions: SelfCheckQuestion[], selection: Selection): Selection {
  const ids = new Set(questions.map((q) => q.id));
  return Object.fromEntries(Object.entries(selection).filter(([k]) => ids.has(k)));
}

export interface GradeResult {
  correct: Record<string, boolean>;
  answered: number;
  correctCount: number;
  passed: boolean; // every question correct in this selection
}

export function grade(questions: SelfCheckQuestion[], selection: Selection): GradeResult {
  const correct: Record<string, boolean> = {};
  let answered = 0;
  let correctCount = 0;
  for (const q of questions) {
    const sel = selection[q.id];
    if (sel && sel.length > 0) answered += 1;
    const ok = isCorrect(q, sel);
    correct[q.id] = ok;
    if (ok) correctCount += 1;
  }
  return { correct, answered, correctCount, passed: questions.length > 0 && correctCount === questions.length };
}
