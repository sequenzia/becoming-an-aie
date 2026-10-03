// src/db/index.test.ts
// getDb() must not cache a rejected attempt, and the SIGTERM handler must reach process.exit even when
// the handle never resolved (docs/decisions.md, 2026-10-03). createDb is mocked here; src/db/client.test.ts
// covers the real drivers.
import { afterEach, describe, expect, test, vi } from 'vitest';

const createDb = vi.fn();
vi.mock('./client', () => ({ createDb: (...args: unknown[]) => createDb(...args) }));

type Handle = { db: unknown; driver: 'pg' | 'pglite'; migrate: () => Promise<void>; close: () => Promise<void> };
const g = globalThis as unknown as { __aieDb?: Promise<Handle> };

afterEach(() => {
  g.__aieDb = undefined;
  createDb.mockReset();
  vi.restoreAllMocks();
  // registerShutdown keeps a module-level "registered" flag, so each test imports a fresh copy of ./index.
  vi.resetModules();
});

describe('getDb', () => {
  test('retries after a rejected attempt instead of replaying the rejection', async () => {
    const { getDb } = await import('./index');
    const good: Handle = { db: {}, driver: 'pg', migrate: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    createDb.mockRejectedValueOnce(new Error("ENOENT: no such file or directory, open '/nonexistent/ca.pem'"));
    createDb.mockResolvedValueOnce(good);
    await expect(getDb()).rejects.toThrow('ENOENT');
    expect(g.__aieDb).toBeUndefined();
    await expect(getDb()).resolves.toBe(good);
    expect(createDb).toHaveBeenCalledTimes(2);
    // pg is migrated by scripts/migrate.mjs, never here.
    expect(good.migrate).not.toHaveBeenCalled();
  });

  test('migrates an embedded database once and caches the handle', async () => {
    const { getDb } = await import('./index');
    const pglite: Handle = { db: {}, driver: 'pglite', migrate: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    createDb.mockResolvedValue(pglite);
    expect(await getDb()).toBe(pglite);
    expect(await getDb()).toBe(pglite);
    expect(createDb).toHaveBeenCalledTimes(1);
    expect(pglite.migrate).toHaveBeenCalledTimes(1);
  });
});

describe('registerShutdown', () => {
  async function capturedHandler(): Promise<() => Promise<void>> {
    let handler: (() => Promise<void>) | undefined;
    vi.spyOn(process, 'once').mockImplementation(((event: string, fn: () => Promise<void>) => {
      if (event === 'SIGTERM') handler = fn;
      return process;
    }) as typeof process.once);
    const { registerShutdown } = await import('./index');
    registerShutdown();
    registerShutdown(); // idempotent
    expect(handler).toBeDefined();
    return handler!;
  }

  test('closes a resolved handle and exits 0', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const close = vi.fn(async () => {});
    g.__aieDb = Promise.resolve({ db: {}, driver: 'pglite', migrate: async () => {}, close });
    const handler = await capturedHandler();
    await handler();
    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('still exits 0 when the handle rejected, and logs why', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rejected = Promise.reject(new Error("Can't find meta/_journal.json file"));
    rejected.catch(() => {});
    g.__aieDb = rejected;
    const handler = await capturedHandler();
    await handler();
    expect(exit).toHaveBeenCalledWith(0);
    expect(errors.mock.calls.flat().join(' ')).toContain("Can't find meta/_journal.json file");
  });

  test('exits 0 with no handle at all', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    g.__aieDb = undefined;
    const handler = await capturedHandler();
    await handler();
    expect(exit).toHaveBeenCalledWith(0);
  });
});
