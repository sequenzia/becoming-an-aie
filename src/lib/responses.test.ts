// src/lib/responses.test.ts
// Blueprint section 12.1: upsert by kind, updatedAt bump, 199 versus 200 characters (EC-5.5.1, CG-11),
// plain text stored as given (NFR-6.2.3), and the edit path (AC-5.9.4).
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { user, workshopResponse } from '../db/schema';
import { WORKSHOP_MAX_CHARS, WORKSHOP_MIN_CHARS } from './limits';
import { ResponseLengthError, checkResponseLength, saveResponse } from './responses';

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
  await h.db.insert(user).values([
    { id: 'r-1', name: 'One', email: 'r-1@example.com', emailVerified: true, updatedAt: new Date() },
    { id: 'r-2', name: 'Two', email: 'r-2@example.com', emailVerified: true, updatedAt: new Date() },
  ]);
});

afterAll(async () => {
  await h.close();
});

const rows = (userId: string, slug: string) =>
  h.db.select().from(workshopResponse).where(and(eq(workshopResponse.userId, userId), eq(workshopResponse.moduleSlug, slug)));

const text = (n: number, fill = 'a') => fill.repeat(n);

describe('checkResponseLength', () => {
  test('199 characters is too short, 200 passes, the maximum passes, one more is too long', () => {
    expect(WORKSHOP_MIN_CHARS).toBe(200);
    expect(() => checkResponseLength(text(199))).toThrow(ResponseLengthError);
    expect(checkResponseLength(text(200))).toBe(text(200));
    expect(checkResponseLength(text(WORKSHOP_MAX_CHARS))).toHaveLength(WORKSHOP_MAX_CHARS);
    expect(() => checkResponseLength(text(WORKSHOP_MAX_CHARS + 1))).toThrow(ResponseLengthError);
  });

  test('trims before measuring and names the minimum in the message', () => {
    expect(() => checkResponseLength(`   ${text(199)}   `)).toThrow(`Write at least ${WORKSHOP_MIN_CHARS} characters.`);
    expect(() => checkResponseLength('')).toThrow(ResponseLengthError);
    expect(checkResponseLength(`  ${text(200)}  `)).toBe(text(200));
    try {
      checkResponseLength('one word');
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseLengthError);
      expect((err as ResponseLengthError).reason).toBe('too_short');
    }
  });
});

describe('saveResponse', () => {
  test('inserts one row per kind and keeps them apart', async () => {
    await saveResponse(h.db, 'r-1', 'models', 'workshop', text(200, 'w'));
    await saveResponse(h.db, 'r-1', 'models', 'failure', text(200, 'f'));
    const saved = await rows('r-1', 'models');
    expect(saved).toHaveLength(2);
    expect(saved.find((r) => r.kind === 'workshop')!.body).toBe(text(200, 'w'));
    expect(saved.find((r) => r.kind === 'failure')!.body).toBe(text(200, 'f'));
    expect(await rows('r-2', 'models')).toHaveLength(0);
  });

  test('saving again replaces the text, keeps the id, and moves updatedAt forward', async () => {
    const first = await saveResponse(h.db, 'r-2', 'orchestration', 'workshop', text(200, 'a'));
    const [before] = await rows('r-2', 'orchestration');
    await new Promise((r) => setTimeout(r, 5));
    const second = await saveResponse(h.db, 'r-2', 'orchestration', 'workshop', text(250, 'b'));
    const after = await rows('r-2', 'orchestration');
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before!.id);
    expect(after[0]!.body).toBe(text(250, 'b'));
    expect(after[0]!.createdAt).toEqual(before!.createdAt);
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    expect(after[0]!.updatedAt).toEqual(second.updatedAt);
  });

  test('rejects a short body without touching the table', async () => {
    await expect(saveResponse(h.db, 'r-2', 'evals', 'workshop', text(199))).rejects.toBeInstanceOf(ResponseLengthError);
    expect(await rows('r-2', 'evals')).toHaveLength(0);
  });

  test('stores markup and Markdown literally (NFR-6.2.3)', async () => {
    const body = `<script>alert(1)</script> **bold** [x](y) ${text(200)}`;
    await saveResponse(h.db, 'r-1', 'tools-and-extensibility', 'workshop', body);
    expect((await rows('r-1', 'tools-and-extensibility'))[0]!.body).toBe(body);
  });

  test('a row needs an existing learner (fail closed, EC-5.9.3)', async () => {
    await expect(saveResponse(h.db, 'ghost', 'models', 'workshop', text(200))).rejects.toThrow();
  });
});
