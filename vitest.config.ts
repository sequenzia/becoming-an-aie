// vitest.config.ts
// Vitest over Astro's Vite config (blueprint sections 3.5 and 12.3). Unit tests run in the node
// environment. Component tests opt into jsdom per file with `// @vitest-environment jsdom` on their
// first line (section 12.2). Playwright specs under e2e/ are never collected here.
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

// Placeholder values for the astro:env schema. Vitest's test.env never reaches astro:env/server;
// process.env set here, before getViteConfig() resolves the Astro config, does (verified 2026-09-15
// in scratchpad/probe, fact 0.2.6). Assigned, not defaulted, so a developer's shell can never leak
// real values into tests. DATABASE_URL, PG_CA_FILE, and PGLITE_DATA_DIR are removed so tests always
// use PGlite in memory. No line here has the form NAME=value, so the secret grep in NFR-6.2.4 stays clean.
const TEST_ENV: Record<string, string> = {
  SITE_URL: 'http://localhost:4321',
  FEATURE_ACCOUNTS: 'true',
  PREVIEW_DRAFTS: 'true',
  BETTER_AUTH_URL: 'http://localhost:4321',
  EMAIL_PROVIDER: 'none',
  BETTER_AUTH_SECRET: 'test-placeholder-secret-not-real-000000000',
  NOTIFY_TOKEN_SECRET: 'test-placeholder-token-not-real-0000000000',
  GITHUB_CLIENT_ID: 'test-github-id',
  GITHUB_CLIENT_SECRET: 'test-github-secret',
  GOOGLE_CLIENT_ID: 'test-google-id',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
};
for (const [key, value] of Object.entries(TEST_ENV)) process.env[key] = value;
delete process.env.DATABASE_URL;
delete process.env.PG_CA_FILE;
delete process.env.PGLITE_DATA_DIR;

export default getViteConfig({
  test: {
    // The default. A file that needs a DOM starts with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // Vitest's default include also matches Playwright's *.spec.ts files. Keep e2e/ and dist/ out.
    exclude: [...configDefaults.exclude, 'e2e/**', 'dist/**'],
    testTimeout: 20_000,
  },
});
