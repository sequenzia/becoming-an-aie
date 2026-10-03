// src/lib/feedback.ts
// placeholder, C replaces (blueprint section 14.1). Contracted signature with a neutral body.
import type { Db } from '../db/client';

export async function insertFeedback(_db: Db, _body: string): Promise<{ ok: true }> {
  return { ok: true };
}
