// src/lib/feedback.ts
// Anonymous feedback from the assessment page (blueprint decision 31, CG-15, AC-5.10.6). The table has no
// user column, so a row cannot be linked to an account and is not removed by account deletion; the
// privacy notice and the account page say so. The text is plain and bounded by FEEDBACK_MAX_CHARS.
import type { Db } from '../db/client';
import { feedback } from '../db/schema';
import { FEEDBACK_MAX_CHARS } from './limits';

/** Thrown for an empty or oversized body. The action maps it to BAD_REQUEST. */
export class FeedbackLengthError extends Error {
  constructor(readonly reason: 'empty' | 'too_long') {
    super(reason === 'empty' ? 'Write something before sending.' : `Write at most ${FEEDBACK_MAX_CHARS.toLocaleString('en-US')} characters.`);
    this.name = 'FeedbackLengthError';
  }
}

export async function insertFeedback(db: Db, body: string): Promise<{ ok: true }> {
  const text = body.trim();
  if (text.length === 0) throw new FeedbackLengthError('empty');
  if (text.length > FEEDBACK_MAX_CHARS) throw new FeedbackLengthError('too_long');
  await db.insert(feedback).values({ body: text });
  return { ok: true };
}
