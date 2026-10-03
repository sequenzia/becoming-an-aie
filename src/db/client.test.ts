// src/db/client.test.ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { PlaintextRefusedError, createPgDb, createPgliteDb, type DbHandle } from './client';
import { notifySubscriber } from './schema';

describe('createPgDb', () => {
  test('refuses a plaintext connection in production before importing pg', async () => {
    await expect(createPgDb('postgres://user:pw@db.example/aie', { requireTls: true })).rejects.toBeInstanceOf(PlaintextRefusedError);
    await expect(createPgDb('postgres://user:pw@db.example/aie', { requireTls: true })).rejects.toThrow(
      'DATABASE_URL is set but PG_CA_FILE is missing; refusing a plaintext connection to Postgres.',
    );
  });

  test('refuses ssl parameters in the URL', async () => {
    for (const url of [
      'postgres://user:pw@db.example/aie?sslmode=require',
      'postgres://user:pw@db.example/aie?a=1&sslrootcert=/x.pem',
      'postgres://user:pw@db.example/aie?sslcert=/c.pem',
      'postgres://user:pw@db.example/aie?sslkey=/k.pem',
    ]) {
      await expect(createPgDb(url)).rejects.toThrow('DATABASE_URL must not carry ssl parameters. Set PG_CA_FILE instead.');
    }
  });
});

describe('createPgliteDb', () => {
  let h: DbHandle;

  beforeAll(async () => {
    h = await createPgliteDb();
    await h.migrate();
  });

  afterAll(async () => {
    await h.close();
  });

  test('returns a pglite handle whose migrations applied the committed schema', async () => {
    expect(h.driver).toBe('pglite');
    await h.db.insert(notifySubscriber).values({ email: 'learner@example.com' });
    const rows = await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, 'learner@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    expect(rows[0]!.confirmedAt).toBeNull();
    expect(rows[0]!.unsubscribedAt).toBeNull();
  });

  test('migrate is idempotent', async () => {
    await expect(h.migrate()).resolves.toBeUndefined();
  });
});
