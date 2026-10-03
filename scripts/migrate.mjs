// scripts/migrate.mjs
// Runs outside Astro. Postgres only. Used by the OpenShift migration Job and by oc exec.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}
if (/[?&]ssl(mode|rootcert|cert|key)=/.test(url)) {
  console.error('DATABASE_URL must not carry ssl parameters. Set PG_CA_FILE instead.');
  process.exit(2);
}
const caFile = process.env.PG_CA_FILE;
if (!caFile && process.env.NODE_ENV === 'production') {
  console.error('PG_CA_FILE is required in production; refusing a plaintext connection.');
  process.exit(2);
}
const pool = new Pool({
  connectionString: url,
  ssl: caFile ? { rejectUnauthorized: true, ca: readFileSync(caFile, 'utf8') } : undefined,
  max: 1,
});
const db = drizzle(pool);
try {
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  console.log('migrations applied');
} catch (err) {
  console.error('migration failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
