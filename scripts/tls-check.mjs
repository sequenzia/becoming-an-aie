// scripts/tls-check.mjs
// Runs outside Astro. Proves the runtime pool negotiates TLS to Postgres. Used by runbook step 7.
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const caFile = process.env.PG_CA_FILE;
if (!url || !caFile) {
  console.error('DATABASE_URL and PG_CA_FILE are required');
  process.exit(2);
}
// The same rule as createPgDb and migrate.mjs. pg parses the connection string over the explicit ssl
// object (pg/lib/connection-parameters.js), so sslmode=disable would turn TLS off and sslmode=no-verify
// would drop the CA pin while this check still printed ok (docs/decisions.md, 2026-10-03).
if (/[?&]ssl(mode|rootcert|cert|key)=/.test(url)) {
  console.error('DATABASE_URL must not carry ssl parameters. Set PG_CA_FILE instead.');
  process.exit(2);
}
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true, ca: readFileSync(caFile, 'utf8') }, max: 1 });
try {
  const { rows } = await pool.query('select ssl, version from pg_stat_ssl where pid = pg_backend_pid()');
  const row = rows[0];
  if (!row || row.ssl !== true) {
    console.error('tls-check: connection is not using TLS');
    process.exitCode = 1;
  } else {
    console.log(`tls-check: ok (${row.version})`);
  }
} catch (err) {
  console.error('tls-check failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
