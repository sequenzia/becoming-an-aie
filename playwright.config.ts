// playwright.config.ts
// Chromium only, against the built Node server with PGlite in memory (blueprint section 12.3).
// Run `PREVIEW_DRAFTS=true npm run build` first; CI does this before `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_ENV, E2E_HOST, E2E_PORT } from './e2e/env';

// Playwright starts the web server with process.env plus the values below. The database variables
// are removed from this process first, so a developer's shell can never point the e2e server at
// Postgres or at a persistent PGlite directory (section 3.5).
delete process.env.DATABASE_URL;
delete process.env.PG_CA_FILE;
delete process.env.PGLITE_DATA_DIR;

// E2E_REUSE=1 reuses a server already listening on E2E_BASE_URL instead of starting one. It must
// have been started with the values in e2e/env.ts and a fresh in-memory database: the notify spec
// counts its own submissions against the per-IP rate rule. Anything else starts `node ./dist/server/entry.mjs`.
const reuseExistingServer = process.env.E2E_REUSE === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: E2E_BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: E2E_BASE_URL,
    timeout: 90_000,
    reuseExistingServer,
    env: {
      ...E2E_ENV,
      PORT: String(E2E_PORT),
      HOST: E2E_HOST,
      // No DATABASE_URL: the server uses PGlite in memory (dev dependency, installed in CI). E2E_ENV carries
      // PGLITE_DATA_DIR=memory:// because a production build refuses the embedded database otherwise.
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
