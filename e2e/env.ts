// e2e/env.ts
// Runtime placeholders for the Playwright web server and the specs. Never real secrets.
// SITE_URL is a build-time value and is not set here; the e2e build uses the localhost default.
// No line here has the form NAME=value, so the secret grep in NFR-6.2.4 stays clean.
//
// E2E_PORT picks the port the built server listens on (default 4321), so a reviewer can run the
// suite next to another server. E2E_REUSE=1 (read in playwright.config.ts) points the run at a server
// already listening on that port; start such a server with these same values, because the notify
// spec mints tokens with NOTIFY_TOKEN_SECRET below.
export const E2E_PORT = Number(process.env.E2E_PORT) || 4321;
export const E2E_HOST = '127.0.0.1';
export const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}/`;

export const E2E_ENV = {
  BETTER_AUTH_URL: `http://${E2E_HOST}:${E2E_PORT}`,
  EMAIL_PROVIDER: 'none',
  // The e2e server is a production build with no DATABASE_URL. getDb() refuses the embedded database in
  // production unless PGLITE_DATA_DIR is set on purpose (docs/decisions.md, 2026-10-03); memory:// is
  // PGlite's ephemeral store, the same as leaving it unset in dev.
  PGLITE_DATA_DIR: 'memory://',
  BETTER_AUTH_SECRET: 'e2e-placeholder-secret-not-real-0000000000',
  NOTIFY_TOKEN_SECRET: 'e2e-placeholder-token-not-real-0000000000',
  GITHUB_CLIENT_ID: 'e2e',
  GITHUB_CLIENT_SECRET: 'e2e',
  GOOGLE_CLIENT_ID: 'e2e',
  GOOGLE_CLIENT_SECRET: 'e2e',
} as const;
