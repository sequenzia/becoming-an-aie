// src/db/client.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Schema = typeof schema;
/** One type both drivers satisfy. A transaction (PgTransaction extends PgDatabase) satisfies it too. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  driver: 'pg' | 'pglite';
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

export interface PgOptions {
  /** Path to the RDS CA bundle PEM. */
  caFile?: string;
  /** When true and caFile is unset, refuse to connect. Production sets this. */
  requireTls?: boolean;
  /** Defaults to <cwd>/drizzle, which is /app/drizzle in the container. */
  migrationsFolder?: string;
}

export interface CreateDbOptions extends PgOptions {
  databaseUrl?: string;
  /** PGlite data directory. Unset means in-memory. */
  pgliteDataDir?: string;
}

const defaultMigrationsFolder = () => resolve(process.cwd(), 'drizzle');

export class PlaintextRefusedError extends Error {
  constructor() {
    super('DATABASE_URL is set but PG_CA_FILE is missing; refusing a plaintext connection to Postgres.');
    this.name = 'PlaintextRefusedError';
  }
}

export async function createPgDb(databaseUrl: string, opts: PgOptions = {}): Promise<DbHandle> {
  if (/[?&]ssl(mode|rootcert|cert|key)=/.test(databaseUrl)) {
    throw new Error('DATABASE_URL must not carry ssl parameters. Set PG_CA_FILE instead.');
  }
  if (opts.requireTls && !opts.caFile) throw new PlaintextRefusedError();
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: opts.caFile ? { rejectUnauthorized: true, ca: readFileSync(opts.caFile, 'utf8') } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error', err.message);
  });
  const db = drizzle(pool, { schema });
  const migrationsFolder = opts.migrationsFolder ?? defaultMigrationsFolder();
  return {
    db,
    driver: 'pg',
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

export async function createPgliteDb(dataDir?: string, migrationsFolder = defaultMigrationsFolder()): Promise<DbHandle> {
  let mod: typeof import('@electric-sql/pglite');
  try {
    mod = await import('@electric-sql/pglite');
  } catch {
    throw new Error('DATABASE_URL is not set and the embedded database is not installed. Set DATABASE_URL.');
  }
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = await mod.PGlite.create(dataDir ?? 'memory://');
  const db = drizzle(client, { schema });
  return {
    db,
    driver: 'pglite',
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.close(),
  };
}

export function createDb(opts: CreateDbOptions): Promise<DbHandle> {
  if (opts.databaseUrl) return createPgDb(opts.databaseUrl, opts);
  return createPgliteDb(opts.pgliteDataDir, opts.migrationsFolder);
}
