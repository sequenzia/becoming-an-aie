// src/db/index.ts
import { env } from '../lib/env';
import { createDb, type DbHandle } from './client';

const g = globalThis as unknown as { __aieDb?: Promise<DbHandle> };

/**
 * Lazy singleton. Nothing connects until the first call, so astro build, astro sync,
 * and the content check never touch a database. Cached on globalThis to survive
 * Vite HMR re-evaluation in dev. Tests always get PGlite in memory.
 * In production a missing PG_CA_FILE throws PlaintextRefusedError before any socket opens.
 * A rejected attempt is not kept: the next call tries again instead of replaying one failure
 * (docs/decisions.md, 2026-10-03).
 *
 * Production fails closed. A production build with no DATABASE_URL gets the embedded database only when
 * PGLITE_DATA_DIR is set on purpose (the CI e2e server sets memory://). The runtime image installs no
 * optional packages, so PGlite is absent there too; this check does not depend on that. Without it a
 * misconfigured pod would store addresses in memory, answer the form with a success page, and lose every
 * row on restart, while /healthz stays green (docs/decisions.md, 2026-10-03).
 */
export function getDb(): Promise<DbHandle> {
  if (env.isProduction && !env.isTest && !env.databaseUrl && !env.pgliteDataDir) {
    return Promise.reject(
      new Error('DATABASE_URL is not set. In production the embedded database is used only when PGLITE_DATA_DIR is set on purpose. Set DATABASE_URL.'),
    );
  }
  g.__aieDb ??= createDb({
    databaseUrl: env.isTest ? undefined : env.databaseUrl || undefined,
    caFile: env.pgCaFile,
    requireTls: env.isProduction,
    pgliteDataDir: env.isTest ? undefined : env.pgliteDataDir || undefined,
  })
    .then(async (h) => {
      // The embedded database is created empty. Postgres on RDS is migrated by scripts/migrate.mjs.
      if (h.driver === 'pglite') await h.migrate();
      return h;
    })
    .catch((err: unknown) => {
      g.__aieDb = undefined;
      throw err;
    });
  return g.__aieDb;
}

let shutdownRegistered = false;
/**
 * Closes the database on SIGTERM and exits. The handler is total: a handle that never resolved (a
 * configuration error on the first request) must not keep the pod alive until Kubernetes kills it.
 */
export function registerShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  process.once('SIGTERM', async () => {
    try {
      const h = await g.__aieDb;
      await h?.close();
    } catch (err) {
      console.error('[db] shutdown:', err instanceof Error ? err.message : err);
    } finally {
      process.exit(0);
    }
  });
}
