// src/lib/slug.test.ts
import { expect, test } from 'vitest';
import { headingId } from './slug';

test('the seven template headings get their github-slugger ids', () => {
  expect(headingId('Transfer connection')).toBe('transfer-connection');
  expect(headingId('Topics and learning outcomes')).toBe('topics-and-learning-outcomes');
  expect(headingId('Workshop')).toBe('workshop');
  expect(headingId('Failure exercise')).toBe('failure-exercise');
  expect(headingId('Optional lab')).toBe('optional-lab');
  expect(headingId('Completion evidence')).toBe('completion-evidence');
  expect(headingId('Sources')).toBe('sources');
});

test('the closing module headings', () => {
  expect(headingId('How the assessment works')).toBe('how-the-assessment-works');
  expect(headingId('The six areas')).toBe('the-six-areas');
  expect(headingId('After the plan')).toBe('after-the-plan');
});

test('punctuation is dropped and spaces become hyphens', () => {
  expect(headingId('pass@k and pass^k')).toBe('passk-and-passk');
  expect(headingId('What is new: the ladder')).toBe('what-is-new-the-ladder');
  expect(headingId('A compelling prototype is not evidence')).toBe('a-compelling-prototype-is-not-evidence');
  expect(headingId("Check the result. Inspect the trace.")).toBe('check-the-result-inspect-the-trace');
  expect(headingId('Two complementary uses of checks')).toBe('two-complementary-uses-of-checks');
  expect(headingId('works.any() versus works.all()')).toBe('worksany-versus-worksall');
});

test('hyphens and digits survive, case folds, surrounding space is trimmed', () => {
  expect(headingId('Self-check: 6 to 12 questions')).toBe('self-check-6-to-12-questions');
  expect(headingId('  Sources  ')).toBe('sources');
  expect(headingId('Models')).toBe('models');
});
