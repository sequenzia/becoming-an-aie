// src/db/index.production.test.ts
// In production getDb() refuses the embedded database unless PGLITE_DATA_DIR is set on purpose, so a pod
// without DATABASE_URL fails at the first request instead of storing learner data in memory and losing it
// on restart (docs/decisions.md, 2026-10-03). The env module is mocked here because Vitest runs with
// isTest true; src/db/index.test.ts covers the retry and shutdown behavior with the real env.
import { afterEach, describe, expect, test, vi } from 'vitest';

const envState = {
  isProduction: true,
  isTest: false,
  databaseUrl: undefined as string | undefined,
  pgCaFile: undefined as string | undefined,
  pgliteDataDir: undefined as string | undefined,
};
vi.mock('../lib/env', () => ({ env: envState }));

const createDb = vi.fn();
vi.mock('./client', () => ({ createDb: (...args: unknown[]) => createDb(...args) }));

type Handle = { db: unknown; driver: 'pg' | 'pglite'; migrate: () => Promise<void>; close: () => Promise<void> };
const g = globalThis as unknown as { __aieDb?: Promise<Handle> };

afterEach(() => {
  g.__aieDb = undefined;
  createDb.mockReset();
  envState.databaseUrl = undefined;
  envState.pgCaFile = undefined;
  envState.pgliteDataDir = undefined;
  envState.isProduction = true;
  envState.isTest = false;
  vi.resetModules();
});

describe('getDb in production', () => {
  test('refuses the embedded database when DATABASE_URL is unset and PGLITE_DATA_DIR is unset', async () => {
    const { getDb } = await import('./index');
    await expect(getDb()).rejects.toThrow('DATABASE_URL is not set');
    expect(createDb).not.toHaveBeenCalled();
    // The rejection is not cached: a later request tries again.
    expect(g.__aieDb).toBeUndefined();
  });

  test('treats an empty DATABASE_URL and an empty PGLITE_DATA_DIR as unset', async () => {
    envState.databaseUrl = '';
    envState.pgliteDataDir = '';
    const { getDb } = await import('./index');
    await expect(getDb()).rejects.toThrow('DATABASE_URL is not set');
    expect(createDb).not.toHaveBeenCalled();
  });

  test('uses the embedded database when PGLITE_DATA_DIR is set on purpose (the CI e2e server)', async () => {
    envState.pgliteDataDir = 'memory://';
    const pglite: Handle = { db: {}, driver: 'pglite', migrate: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    createDb.mockResolvedValue(pglite);
    const { getDb } = await import('./index');
    expect(await getDb()).toBe(pglite);
    expect(createDb).toHaveBeenCalledWith({ databaseUrl: undefined, caFile: undefined, requireTls: true, pgliteDataDir: 'memory://' });
    expect(pglite.migrate).toHaveBeenCalledTimes(1);
  });

  test('connects to Postgres when DATABASE_URL is set', async () => {
    envState.databaseUrl = 'postgres://user:pw@db.example/aie';
    envState.pgCaFile = '/app/certs/rds-global-bundle.pem';
    const pg: Handle = { db: {}, driver: 'pg', migrate: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    createDb.mockResolvedValue(pg);
    const { getDb } = await import('./index');
    expect(await getDb()).toBe(pg);
    expect(createDb).toHaveBeenCalledWith({
      databaseUrl: 'postgres://user:pw@db.example/aie',
      caFile: '/app/certs/rds-global-bundle.pem',
      requireTls: true,
      pgliteDataDir: undefined,
    });
    expect(pg.migrate).not.toHaveBeenCalled();
  });

  test('outside production the embedded database stays the default (astro dev)', async () => {
    envState.isProduction = false;
    const pglite: Handle = { db: {}, driver: 'pglite', migrate: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    createDb.mockResolvedValue(pglite);
    const { getDb } = await import('./index');
    expect(await getDb()).toBe(pglite);
    expect(createDb).toHaveBeenCalledWith({ databaseUrl: undefined, caFile: undefined, requireTls: false, pgliteDataDir: undefined });
  });
});
