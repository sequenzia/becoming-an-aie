// src/lib/feedback.test.ts
// Blueprint section 12.1: insert without a user, length bound (CG-15, AC-5.10.6).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { feedback } from '../db/schema';
import { FeedbackLengthError, insertFeedback } from './feedback';
import { FEEDBACK_MAX_CHARS } from './limits';

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
});

afterAll(async () => {
  await h.close();
});

describe('insertFeedback', () => {
  test('stores the trimmed text with a timestamp and no user column', async () => {
    expect(await insertFeedback(h.db, '  The failure exercise was the best part.  ')).toEqual({ ok: true });
    const rows = await h.db.select().from(feedback);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('The failure exercise was the best part.');
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    expect(Object.keys(rows[0]!).sort()).toEqual(['body', 'createdAt', 'id']);
  });

  test('rejects an empty or whitespace body', async () => {
    await expect(insertFeedback(h.db, '')).rejects.toBeInstanceOf(FeedbackLengthError);
    await expect(insertFeedback(h.db, '   \n ')).rejects.toThrow('Write something before sending.');
    expect(await h.db.select().from(feedback)).toHaveLength(1);
  });

  test('accepts the maximum length and rejects one more character', async () => {
    expect(await insertFeedback(h.db, 'x'.repeat(FEEDBACK_MAX_CHARS))).toEqual({ ok: true });
    await expect(insertFeedback(h.db, 'x'.repeat(FEEDBACK_MAX_CHARS + 1))).rejects.toBeInstanceOf(FeedbackLengthError);
    expect(await h.db.select().from(feedback)).toHaveLength(2);
  });

  test('stores markup literally', async () => {
    await insertFeedback(h.db, '<b>not bold</b>');
    const rows = await h.db.select().from(feedback);
    expect(rows.map((r) => r.body)).toContain('<b>not bold</b>');
  });
});
