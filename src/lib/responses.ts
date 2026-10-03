// src/lib/responses.ts
// Workshop and failure-exercise responses (blueprint sections 7.3 and 14.1). One row per learner, module,
// and kind. Saving again replaces the text (AC-5.9.4). The text is stored as plain text: rendering escapes
// it and nothing parses it (NFR-6.2.3). The length rule lives here as well as in the action's input
// schema, so a caller that skips the schema cannot store an empty response (EC-5.5.1, CG-11).
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { workshopResponse } from '../db/schema';
import { WORKSHOP_MAX_CHARS, WORKSHOP_MIN_CHARS } from './limits';

export type ResponseKind = 'workshop' | 'failure';

/** Thrown for a response outside the length bounds. The action maps it to BAD_REQUEST. */
export class ResponseLengthError extends Error {
  constructor(readonly reason: 'too_short' | 'too_long') {
    super(
      reason === 'too_short'
        ? `Write at least ${WORKSHOP_MIN_CHARS} characters. A few sentences is enough.`
        : `Write at most ${WORKSHOP_MAX_CHARS.toLocaleString('en-US')} characters.`,
    );
    this.name = 'ResponseLengthError';
  }
}

/** Trims the text and checks the bounds. Returns the text that will be stored. */
export function checkResponseLength(body: string): string {
  const text = body.trim();
  if (text.length < WORKSHOP_MIN_CHARS) throw new ResponseLengthError('too_short');
  if (text.length > WORKSHOP_MAX_CHARS) throw new ResponseLengthError('too_long');
  return text;
}

/** Inserts or replaces the learner's response of one kind for one module. updatedAt moves on every save. */
export async function saveResponse(db: Db, userId: string, slug: string, kind: ResponseKind, body: string): Promise<{ updatedAt: Date }> {
  const text = checkResponseLength(body);
  const [row] = await db
    .insert(workshopResponse)
    .values({ userId, moduleSlug: slug, kind, body: text })
    .onConflictDoUpdate({
      target: [workshopResponse.userId, workshopResponse.moduleSlug, workshopResponse.kind],
      // updated_at is bumped by the column's $onUpdate (the dialect adds it to every update set).
      set: { body: sql`excluded.body` },
    })
    .returning({ updatedAt: workshopResponse.updatedAt });
  return { updatedAt: row!.updatedAt };
}
