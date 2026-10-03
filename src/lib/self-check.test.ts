// src/lib/self-check.test.ts
import { describe, expect, test } from 'vitest';
import type { SelfCheckQuestion } from './content-schema';
import { feedbackFor, grade, isCorrect, isMultiple, pickKnown } from './self-check';

const single: SelfCheckQuestion = {
  id: 'q1',
  outcome: 'o1',
  question: 'Pick B',
  options: ['A', 'B', 'C'],
  correct: [1],
  feedback: ['Not yet. A is wrong.', 'Correct.', 'Not yet. C is wrong.'],
};

const multiple: SelfCheckQuestion = {
  id: 'q2',
  outcome: 'o2',
  question: 'Pick A and C',
  options: ['A', 'B', 'C'],
  correct: [0, 2],
  feedback: ['Correct, with C.', 'Not yet. B is wrong.', 'Correct, with A.'],
};

describe('isMultiple', () => {
  test('is true only for questions with more than one correct option', () => {
    expect(isMultiple(single)).toBe(false);
    expect(isMultiple(multiple)).toBe(true);
  });
});

describe('isCorrect', () => {
  test('single correct', () => {
    expect(isCorrect(single, [1])).toBe(true);
    expect(isCorrect(single, [0])).toBe(false);
    expect(isCorrect(single, [1, 2])).toBe(false);
  });

  test('multiple correct needs the exact set; a partial selection is wrong', () => {
    expect(isCorrect(multiple, [0, 2])).toBe(true);
    expect(isCorrect(multiple, [0])).toBe(false);
    expect(isCorrect(multiple, [2])).toBe(false);
    expect(isCorrect(multiple, [0, 1, 2])).toBe(false);
  });

  test('is order-insensitive and ignores duplicates', () => {
    expect(isCorrect(multiple, [2, 0])).toBe(true);
    expect(isCorrect(multiple, [2, 0, 2])).toBe(true);
  });

  test('an empty or missing selection is wrong', () => {
    expect(isCorrect(single, [])).toBe(false);
    expect(isCorrect(single, undefined)).toBe(false);
  });
});

describe('feedbackFor', () => {
  test('returns one feedback entry per selected option, in selection order, dropping out-of-range indices', () => {
    expect(feedbackFor(multiple, [2, 0])).toEqual(['Correct, with A.', 'Correct, with C.']);
    expect(feedbackFor(single, [1, 1, 7, -1])).toEqual(['Correct.']);
  });
});

describe('pickKnown', () => {
  test('keeps only entries whose key is a question id', () => {
    expect(pickKnown([single, multiple], { q1: [1], q2: [0, 2], q9: [0], other: [] })).toEqual({ q1: [1], q2: [0, 2] });
  });
});

describe('grade', () => {
  test('counts answered and correct questions and passes only when every question is correct', () => {
    const all = grade([single, multiple], { q1: [1], q2: [2, 0] });
    expect(all).toEqual({ correct: { q1: true, q2: true }, answered: 2, correctCount: 2, passed: true });

    const partial = grade([single, multiple], { q1: [1], q2: [0] });
    expect(partial.correct).toEqual({ q1: true, q2: false });
    expect(partial.answered).toBe(2);
    expect(partial.correctCount).toBe(1);
    expect(partial.passed).toBe(false);
  });

  test('ignores unknown question ids and treats missing answers as unanswered', () => {
    const result = grade([single, multiple], { q1: [1], q9: [0] });
    expect(result).toEqual({ correct: { q1: true, q2: false }, answered: 1, correctCount: 1, passed: false });
  });

  test('an empty question list never passes', () => {
    expect(grade([], {}).passed).toBe(false);
  });
});
