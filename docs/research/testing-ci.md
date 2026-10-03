# Testing and CI cheat sheet: Astro 7 server output, Preact islands, Node adapter, PGlite

Verified on 2026-09-15. Every library fact below was fetched with `ctx7` or read from the installed package source. Snippets carry the doc URL or the ctx7 id they came from. Several facts were also exercised in a probe project at `/private/tmp/claude-502/-Users-ada-dev-becoming-an-aie/d0884c5a-9547-4a7e-97af-95b16d3c8d6e/scratchpad/probe`. Lines marked PROBE were run there and passed. Lines marked UNVERIFIED were not confirmed.

Scope decisions this sheet follows: OpenShift container from a Dockerfile, `@astrojs/node` standalone, PostgreSQL on RDS through `pg` and Drizzle, PGlite for tests and local dev, no email sending, npm, Node 24, Python labs on uv, ruff, pytest, Python 3.12.

## 0. Versions confirmed with `npm view <pkg> version`

| Package | Version | Notes |
| --- | --- | --- |
| astro | 7.3.2 | depends on `vite ^8.0.13`, `zod ^4.5.4`; engines `node >=22.12.0` |
| @astrojs/node | 11.1.5 | peer `astro ^7.2.1` |
| @astrojs/preact | 6.0.5 | peer `preact ^10.6.5` |
| @astrojs/mdx | 8.0.1 | peer `astro ^7.2.6` |
| @astrojs/check | 0.9.10 | peer `typescript ^5.0.0 || ^6.0.0`. Do not install TypeScript 7 |
| typescript | 5.9.3 (latest 5.x) | 6.0.3 also satisfies the peer range. Latest overall is 7.0.2, which does not |
| preact | 10.29.8 | |
| vitest | 5.0.1 | peer `vite ^6.4.0 || ^7.0.0 || ^8.0.0`; engines `node ^22.12.0 || ^24.0.0 || >=26.0.0` |
| jsdom | 30.0.1 | |
| happy-dom | 20.14.5 | not used in the probe |
| @testing-library/preact | 3.2.4 | peer `preact >=10` |
| @testing-library/jest-dom | 7.0.1 | |
| @testing-library/user-event | 14.6.7 | |
| @playwright/test | 1.63.0 | |
| @axe-core/playwright | 4.13.0 | depends on `axe-core ~4.13.0`, peer `playwright-core >= 1.0.0` |
| @electric-sql/pglite | 0.5.8 | dev dependency, needs approval |
| drizzle-orm | 0.45.2 | peer `@electric-sql/pglite >=0.2.0`; exports `./pglite` and `./pglite/migrator` |
| drizzle-kit | 0.31.10 | ships `api.mjs` and `api.d.ts`; `drizzle-kit/api` exports `pushSchema` |
| pg | 8.23.0 | |
| gray-matter | 4.0.3 | ships no `types` field; the probe compiled it under `astro check` without a types package |
| zod | 4.6.5 | not needed as a direct dependency, see section 5 |
| @types/node | 24.13.5 | needed for `astro check` when the tsconfig includes `scripts/` and `e2e/` |
| pa11y | 10.0.0 | optional |
| @lhci/cli | 0.15.1 | optional |
| lighthouse | 13.4.1 | optional |

Compatibility summary. Astro 7 and Vitest 5 share Vite 8. Vitest 5 requires Vite >= 6.4.0 and Node >= 22.12.0 (Vitest migration guide, ctx7 `/vitest-dev/vitest`, `docs/guide/migration/index.md`). Vite is a peer dependency of Vitest 5, and npm installs peers automatically, so nothing extra is needed with npm.

## 1. Vitest 5 with Astro

### 1.1 Config

Source: https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/testing.mdx (ctx7 `/withastro/docs`).

```ts
// vitest.config.ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Vitest configuration options
  },
});
```

A second argument overrides Astro config for tests, for example `{ site: 'https://example.com/', trailingSlash: 'always' }` (same doc). Type from the reference: `getViteConfig(userViteConfig: ViteUserConfig, inlineAstroConfig?: AstroInlineConfig) => ViteUserConfigFn` (`reference/modules/astro-config.mdx`).

What `getViteConfig` does, read from `astro/dist/config/index.js` in astro 7.3.2. It resolves the project's Astro config, runs `runHookConfigSetup` so every integration registers its Vite plugins, creates the Astro Vite config, runs `runHookConfigDone`, and merges the Vitest options in. Consequence: `@astrojs/preact` JSX, `@astrojs/mdx`, and the virtual modules `astro:env/server`, `astro:actions`, and `astro:content` all resolve inside tests. PROBE: a test imported `src/actions/index.ts` (which imports `astro:actions` and `astro/zod`) and a `.tsx` Preact component, and both compiled.

Recommended config used in the probe:

```ts
// vitest.config.ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

export default getViteConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
```

The `exclude` line matters. Vitest's default `include` is `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` (Vitest `docs/config/include.md`), which also matches Playwright specs. PROBE: without it, `vitest run` collected `e2e/orientation.spec.ts` and failed with "Playwright Test did not expect test() to be called here". Spreading `configDefaults.exclude` keeps the built-in exclusions (Vitest `docs/config/index.md`).

```ts
// test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

Default environment stays `node`. Component tests opt into jsdom per file with a control comment (Vitest `docs/config/environment.md`, ctx7 `/vitest-dev/vitest`):

```ts
// @vitest-environment jsdom
```

Vitest `projects` can split node and DOM tests instead (Vitest `docs/guide/projects.md`), but the per-file comment is enough for this repo.

Astro 6 note: Astro components rendered through the Container API need the `node` environment, not jsdom or happy-dom (`guides/upgrade-to/v6.mdx`). The Container API itself: `experimental_AstroContainer.create()` then `container.renderToString(Component, { props, slots, locals })` (`guides/testing.mdx` and `reference/container-reference.mdx`). Not exercised in the probe.

### 1.2 Testing Astro Action handlers

Facts from `astro/dist/actions/runtime/server.js` (astro 7.3.2):

- `defineAction` returns `safeServerHandler`. Calling it throws `ActionCalledFromServerError` unless `this` is an object carrying `Symbol.for("astro.actionAPIContext") === true`.
- `safeServerHandler.orThrow` has the same check and rethrows instead of returning `{ data, error }`.
- With `accept: 'form'` the input must be a `FormData` or the result is `ActionError` with code `UNSUPPORTED_MEDIA_TYPE`. Input validation failures become `ActionInputError` (code `BAD_REQUEST`) with a `fields` map.

The handler context type, from `astro/dist/actions/runtime/types.d.ts`:

```ts
export type ActionAPIContext = Pick<APIContext, 'request' | 'url' | 'isPrerendered' | 'locals' | 'clientAddress' | 'cookies' | 'currentLocale' | 'generator' | 'routePattern' | 'site' | 'params' | 'preferredLocale' | 'preferredLocaleList' | 'originPathname' | 'session' | 'cache' | 'csp' | 'logger'>;
```

The docs describe it only as "a subset of Astro's context object" (`reference/modules/astro-actions.mdx`). The Pick list above is the source of truth.

Two workable patterns.

Pattern A, recommended. Keep the logic in plain modules and keep actions thin.

```ts
// src/lib/subscribe.ts
export async function subscribe(email: string, meta: { ip: string }) {
  return { email, ip: meta.ip, ok: true };
}
```

```ts
// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { subscribe } from '../lib/subscribe';

export const server = {
  notifyMe: defineAction({
    accept: 'form',
    input: z.object({ email: z.email() }),
    handler: async (input, context) => subscribe(input.email, { ip: context.clientAddress }),
  }),
};
```

Unit tests import `src/lib/subscribe.ts` and pass a PGlite-backed `db` (section 1.4). No Astro context needed.

Pattern B, integration style. Call the action with a fake context that carries the internal symbol. PROBE: both tests below passed. This relies on an undocumented symbol name, so keep such tests few.

```ts
// src/actions/context.test.ts
import { expect, test } from 'vitest';
import { server } from './index';

const ctx = {
  [Symbol.for('astro.actionAPIContext')]: true,
  clientAddress: '203.0.113.9',
  locals: {},
  request: new Request('http://localhost/'),
};

test('handler runs with a fake context', async () => {
  const fd = new FormData();
  fd.set('email', 'x@example.com');
  const result = await server.notifyMe.call(ctx as any, fd);
  expect(result.error).toBeUndefined();
  expect(result.data).toEqual({ email: 'x@example.com', ip: '203.0.113.9', ok: true });
});

test('input validation errors carry fields', async () => {
  const fd = new FormData();
  fd.set('email', 'not-an-email');
  const result = await server.notifyMe.call(ctx as any, fd);
  expect(result.error?.code).toBe('BAD_REQUEST');
  expect((result.error as any).fields?.email).toBeDefined();
});
```

Documented server-side calls (`Astro.callAction()` or `context.callAction()`) only exist inside Astro pages, endpoints, and middleware (`guides/actions.mdx`). They are not available in a Vitest file. Middleware can also reach an action through `getActionContext(context)` which returns `{ action: { calledFrom, name, handler } }` (`reference/modules/astro-actions.mdx`). That is the hook for a central rate limiter (section 6).

### 1.3 Environment variables in tests

Facts, PROBE-verified against astro 7.3.2 (`astro/dist/env/vite-plugin-env.js`, `astro/dist/env/env-loader.js`):

- Astro's env plugin loads `.env` files with Vite's `loadEnv(mode, root, '')` in the main Vitest process. Vitest's default mode is `test` (Vitest `docs/guide/cli-generated.md`), so `.env`, `.env.test`, and shell variables are all seen. PROBE: a `.env.test` with `DATABASE_URL=...` made `import('astro:env/server')` return that value. A plain `.env` and a shell variable worked too.
- Vitest `test.env` does not reach `astro:env/server`. PROBE: with `test: { env: { DATABASE_URL } }` the import threw `EnvInvalidVariables: DATABASE_URL is missing`.
- In dev mode (which is what Vitest uses) the plugin inlines the loaded values into the virtual module ("In dev, we inline process.env to avoid freezing it"). So `vi.stubEnv` after import changes `process.env` but not `getSecret()`. PROBE: confirmed.
- `vi.mock('astro:env/server', factory)` replaces the module entirely and works with no env at all. PROBE: passed.

```ts
// per-test override of astro:env/server
import { vi } from 'vitest';

vi.mock('astro:env/server', () => ({
  DATABASE_URL: 'postgres://mocked',
  getSecret: (key: string) => (key === 'DATABASE_URL' ? 'postgres://mocked' : undefined),
}));
```

`vi.stubEnv(name, value)` changes `process.env` and `import.meta.env` and is restored by `vi.unstubAllEnvs()` or `test.unstubEnvs: true` (Vitest `docs/api/vi.md`). Use it for code that reads `process.env` directly.

Recommendation. Commit a `.env.test` with placeholder values for every `envField` secret. Real secrets never live there. Modules that need a database in tests take a `db` argument or read it from a small factory, and never import `astro:env/server` at module top level.

Env schema reminder (`guides/environment-variables.mdx`):

```js
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
})
```

`getSecret(key)` from `astro:env/server` returns `string | undefined` and defaults to `process.env` in dev and build (`reference/modules/astro-env.mdx`). `env.validateSecrets: true` makes dev and build fail on missing secrets (`reference/configuration-reference.mdx`). PROBE: with the default (`false`), `astro build` succeeded with no `DATABASE_URL` in the shell.

### 1.4 Database tests with PGlite and Drizzle

Sources: PGlite `docs/docs/orm-support.md` and `docs/docs/index.md` (ctx7 `/electric-sql/pglite`), Drizzle `pg/migrations.mdx` and `package/api.d.ts` (ctx7 `/drizzle-team/drizzle-orm-docs`), plus `drizzle-orm/pglite/migrator.d.ts` from the installed package.

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const client = new PGlite();
const db = drizzle(client);
```

`drizzle-orm/pglite/migrator.d.ts`:

```ts
export declare function migrate<TSchema extends Record<string, unknown>>(db: PgliteDatabase<TSchema>, config: MigrationConfig): Promise<void>;
// MigrationConfig = { migrationsFolder: string; migrationsTable?: string; migrationsSchema?: string }
```

`drizzle-kit/api` (`api.d.ts`):

```typescript
declare const pushSchema: (imports: Record<string, unknown>, drizzleInstance: PgDatabase<any>, schemaFilters?: string[], tablesFilter?: string[], extensionsFilters?: Config["extensionsFilters"]) => Promise<{
    hasDataLoss: boolean;
    warnings: string[];
    statementsToExecute: string[];
    apply: () => Promise<void>;
}>;
```

PROBE: both of these passed with drizzle-orm 0.45.2, drizzle-kit 0.31.10, pglite 0.5.8.

```ts
// src/lib/db.test.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { pushSchema } from 'drizzle-kit/api';
import { expect, test } from 'vitest';
import * as schema from './schema';

test('pglite + drizzle via migrations folder', async () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.insert(schema.notifyMe).values({ email: 'a@example.com' });
  const rows = await db.select().from(schema.notifyMe);
  expect(rows).toHaveLength(1);
  expect(rows[0].createdAt).toBeInstanceOf(Date);
  await client.close();
});

test('pglite + drizzle via drizzle-kit/api pushSchema (no migrations folder)', async () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const { apply, hasDataLoss } = await pushSchema(schema, db as any);
  expect(hasDataLoss).toBe(false);
  await apply();
  await db.insert(schema.notifyMe).values({ email: 'b@example.com' });
  expect(await db.select().from(schema.notifyMe)).toHaveLength(1);
  await client.close();
});
```

Notes.

- Use the migrations path in tests. It proves the committed SQL in `drizzle/` matches the schema, which is what RDS will run. `pushSchema` is handy for throwaway fixtures. The `db as any` cast was used in the probe and was not checked for necessity.
- Generate migrations with `npx drizzle-kit generate` from a `drizzle.config.ts` with `dialect: 'postgresql'`, `schema`, and `out`. That command needs no database. PROBE: it produced `drizzle/0000_*.sql` from `pgTable` definitions.
- One `PGlite` per test file is fast (the whole db test file ran in well under a second). Call `client.close()` at the end.
- Production driver stays `drizzle-orm/node-postgres` with `drizzle({ connection: { connectionString: process.env.DATABASE_URL, ssl: true } })` (Drizzle `pg/get-started-postgresql.mdx`). RDS TLS options beyond `ssl: true` are the DB research's job.
- Dependency approval needed: `@electric-sql/pglite` 0.5.8 and `drizzle-kit` 0.31.10 as dev dependencies.

### 1.5 Scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "check:content": "node scripts/check-content.ts",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "npm run check:content && astro build",
    "start": "node ./dist/server/entry.mjs",
    "test:e2e": "playwright test"
  }
}
```

`astro check` needs `@astrojs/check` and `typescript` installed (`guides/upgrade-to/v3.mdx`). It runs `astro sync` first unless `--noSync` is passed, and `--minimumSeverity error` hides hints (`reference/cli-reference.mdx`). PROBE: `astro check` reported 0 errors on the probe once `@types/node` was installed. Without it, every `node:fs` import in `scripts/` was an error because the tsconfig includes `**/*`.

## 2. Preact component tests

Packages: `@testing-library/preact` 3.2.4, `@testing-library/jest-dom` 7.0.1, `@testing-library/user-event` 14.6.7, `jsdom` 30.0.1, `preact` 10.29.8. The probe used jsdom. happy-dom 20.14.5 is the faster alternative and Vitest supports both (`docs/guide/features.md`), but user-event under happy-dom was not tested here (UNVERIFIED).

Setup facts.

- jest-dom for Vitest: `import '@testing-library/jest-dom/vitest'` in a setup file listed in `setupFiles` (jest-dom README, ctx7 `/testing-library/jest-dom`). Types: add `"types": ["@testing-library/jest-dom"]` to `compilerOptions` (same README). PROBE: `toHaveFocus`, `toBeChecked`, `toHaveTextContent`, `toHaveAttribute` worked.
- Cleanup. The Preact Testing Library API doc says cleanup runs after each test by default on import (`docs/preact-testing-library/api.mdx`), but that relies on a global `afterEach`. The React setup doc says Vitest needs `globals: true` for that, or a manual `afterEach(cleanup)` in a setup file (`docs/react-testing-library/setup.mdx`). PROBE: with Vitest globals off, a second `render` in the same file found two buttons. Adding `afterEach(() => cleanup())` to `test/setup.ts` fixed it. Keep that in the setup file.
- Preact event names differ from React: `onInput` not `onChange`, `onDblClick` not `onDoubleClick` (`docs/preact-testing-library/api.mdx`).
- TypeScript JSX: `"jsx": "react-jsx"` and `"jsxImportSource": "preact"` in tsconfig (Preact `guide/v10/typescript.md`, ctx7 `/preactjs/preact-www`). PROBE: `astro check` was clean with these set on top of `astro/tsconfigs/strict`.
- Vite-side JSX comes from `@astrojs/preact` through `getViteConfig`; no extra esbuild config was needed. PROBE.

user-event API used (ctx7 `/testing-library/user-event`, `_autodocs/api-reference.md` and `_autodocs/keyboard-and-pointer-syntax.md`):

- `const user = userEvent.setup()`
- `await user.tab()` and `await user.tab({ shift: true })`
- `await user.keyboard('{Enter}')`, `'{ArrowDown}'`, `'[Tab]'`, `'{Shift>}a{/Shift}'`
- `await user.type(element, 'text')`, `await user.click(element)`

Component and test used in the probe, both PROBE-verified:

```tsx
// src/components/SelfCheck.tsx
import { useState } from 'preact/hooks';

type Q = { id: string; prompt: string; options: string[]; answer: number };

export function SelfCheck({ questions }: { questions: Q[] }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');
  const check = () => {
    const correct = questions.filter((q) => picked[q.id] === q.answer).length;
    setStatus(`${correct} of ${questions.length} correct`);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); check(); }}>
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend>{q.prompt}</legend>
          {q.options.map((opt, i) => (
            <label>
              <input type="radio" name={q.id} value={i} checked={picked[q.id] === i}
                onInput={() => setPicked({ ...picked, [q.id]: i })} />
              {opt}
            </label>
          ))}
        </fieldset>
      ))}
      <button type="submit">Check answers</button>
      <p role="status" aria-live="polite">{status}</p>
    </form>
  );
}
```

```tsx
// src/components/SelfCheck.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { SelfCheck } from './SelfCheck';

const questions = [{ id: 'q1', prompt: 'Pick B', options: ['A', 'B'], answer: 1 }];

describe('SelfCheck', () => {
  test('keyboard only: tab, arrow, enter, live region updates', async () => {
    const user = userEvent.setup();
    render(<SelfCheck questions={questions} />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Check answers' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 1 correct');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
```

Focus order assertions: chain `user.tab()` calls with `toHaveFocus()` in the expected order. jest-dom also offers `toHaveAccessibleName`, `toHaveRole`, `toBeVisible` (jest-dom `_autodocs/setup-and-imports.md`).

## 3. Playwright 1.63 end to end

### 3.1 Config against the built Node server

Sources: Playwright `docs/src/test-webserver-js.md` and `docs/src/test-api/class-testconfig.md` (ctx7 `/microsoft/playwright`); Astro `guides/testing.mdx`; `@astrojs/node/dist/standalone.js` (adapter 11.1.5).

Adapter facts from source: the standalone server reads `process.env.PORT` (fallback `options.port`, then 8080) and `process.env.HOST` (fallback from `server.host` in the Astro config, where `true` means `0.0.0.0` and `false` means `localhost`). `ASTRO_NODE_AUTOSTART=disabled` prevents autostart. The Astro docs run it as `HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs` (`guides/integrations-guide/node.mdx`).

`webServer` facts from the Playwright docs: `command`, `url`, `env` (defaults to `process.env` plus `PLAYWRIGHT_TEST=1`), `reuseExistingServer` (set to `!process.env.CI`), `stdout` (default `ignore`) and `stderr` (default `pipe`), `timeout` (default 60000), `gracefulShutdown`. `url` is considered ready on 2xx, 3xx, 400, 401, 402, 403.

PROBE-verified config (port changed to 4321 here):

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const baseURL = `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: './e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: baseURL,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://e2e-placeholder',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

Run `npm run build` first. The Astro docs show the same shape with `command: 'npm run preview'` and `url: 'http://localhost:4321/'` (`guides/testing.mdx`); `astro preview` is supported by the Node adapter (it ships `dist/preview.js`). Running `entry.mjs` directly is closer to the container.

The login-free flow needs no database. PROBE: the built server started with a placeholder `DATABASE_URL` and served the landing and module pages. Whether Better Auth touches the database at startup is UNVERIFIED and belongs to the auth research. If e2e later needs writes without Postgres, make `src/lib/db.ts` select `drizzle-orm/pglite` when `DATABASE_URL` starts with `pglite:`; that is a design decision, not something verified here.

### 3.2 Login-free keyboard flow

APIs used: `page.keyboard.press('Tab' | 'Enter' | 'Space' | 'ArrowDown')`, `locator.press(key)` which focuses first (`docs/src/api/class-locator.md`), `expect(locator).toBeFocused()` (`class-locatorassertions.md`), `expect(page).toHaveURL(regex)` (`class-pageassertions.md`), `expect(locator).toHaveText()`, `page.getByRole(role, { name })`.

PROBE-verified test. One finding matters for content: Astro's Shiki code blocks render `<pre class="astro-code" tabindex="0">`, so every fenced code block is a Tab stop before the self-check. The test accounts for it.

```ts
// e2e/orientation.spec.ts
import { test, expect } from '@playwright/test';

test('landing to orientation self-check with keyboard only', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Probe home');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Orientation' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/modules\/orientation$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orientation');

  // Astro's Shiki code blocks render <pre tabindex="0">, so they are in the Tab order.
  await page.keyboard.press('Tab');
  await expect(page.locator('pre.astro-code').first()).toBeFocused();
  // Question 1: answer is B. Tab lands on the first radio, ArrowDown moves and checks the next.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'A' }).first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'B' }).first()).toBeChecked();
  // Question 2: answer is A. Tab into the group, Space checks the focused radio.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'A' }).nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'A' }).nth(1)).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Check answers' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('2 of 2 correct');
});
```

The real site adds a catalog page between landing and module. Add one more Tab and Enter pair with a `toHaveURL` check. WebKit on macOS traverses only form fields with plain Tab (Playwright `tests/page/page-focus.spec.ts`), so keep the keyboard flow on Chromium.

### 3.3 Accessibility with @axe-core/playwright

Sources: Playwright `docs/src/accessibility-testing-js.md`; axe-core `doc/context.md` (ctx7 `/dequelabs/axe-core`).

```javascript
test('should not have any automatically detectable WCAG A or AA violations', async ({ page }) => {
  await page.goto('https://your-site.com/');

  const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

`exclude('#element-with-known-issue')` drops that element and its descendants from every rule (same doc). `include('nav, main')` narrows the scope and `disableRules([...])` turns rules off (axe-core `doc/context.md` and `test/aria-practices/apg.spec.js`). Attach the full JSON with `testInfo.attach('accessibility-scan-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })` (Playwright doc).

PROBE-verified test that also writes a file for a dedicated CI artifact:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

test('orientation page has no automatically detectable WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('/modules/orientation');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('#third-party-widget')
    .analyze();
  const body = JSON.stringify(results, null, 2);
  await testInfo.attach('axe-orientation', { body, contentType: 'application/json' });
  await mkdir('axe-reports', { recursive: true });
  await writeFile('axe-reports/orientation.json', body);
  expect(results.violations).toEqual([]);
});
```

PROBE result on the probe module page: 0 violations, 18 passes, 0 incomplete, `toolOptions.runOnly.values` equal to the four tags. Attachments end up inside `playwright-report/data/`, so uploading `playwright-report/` keeps them. The `axe-reports/` folder gives a small separate artifact.

Automated checks do not cover every WCAG criterion (Playwright doc disclaimer). The keyboard test above covers focus order, which axe cannot.

### 3.4 Browser install and caching

Playwright docs (`docs/src/ci.md`, `docs/src/best-practices-js.md`):

- `npx playwright install chromium --with-deps` installs only Chromium plus OS deps.
- "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries." OS dependencies are not cacheable.
- If you cache anyway, cache the browser directory keyed by the Playwright version. On Linux that directory is `$XDG_CACHE_HOME/ms-playwright` or `~/.cache/ms-playwright` (`playwright-core/src/server/registry/index.ts`). `PLAYWRIGHT_BROWSERS_PATH` overrides it.

## 4. GitHub Actions workflow

Action versions come from the docs fetched: `actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v5` (Playwright `docs/src/ci.md`), `cache: 'npm'` on setup-node (Lighthouse CI llms.txt example), `astral-sh/setup-uv` pinned to the v10.0.1 SHA with `python-version` and `enable-cache` (setup-uv README, ctx7 `/astral-sh/setup-uv`), `uv sync --locked --all-extras --dev` and `uv run pytest tests` (uv `docs/guides/integration/github.md`, ctx7 `/astral-sh/uv`), `ruff check --output-format=github .` and `ruff format --check` (docs.astral.sh/ruff/integrations and /formatter, ctx7 `/websites/astral_sh_ruff`). `actions/cache@v4` is UNVERIFIED and optional. The `labs/` directory name is an assumption.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  web:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      # placeholder only; unit tests use PGlite and the e2e server does not need Postgres
      DATABASE_URL: postgres://placeholder
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Content build check
        run: npm run check:content
      - name: Type check (runs astro sync, which validates content schemas)
        run: npx astro check --minimumSeverity error
      - name: Unit and component tests
        run: npx vitest run
      - name: Build
        run: npx astro build
      # Optional. Playwright docs do not recommend caching browsers. Remove this step if it does not save time.
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - name: Install Playwright Chromium
        run: npx playwright install chromium --with-deps
      - name: End to end and accessibility
        run: npx playwright test
      - uses: actions/upload-artifact@v5
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      - uses: actions/upload-artifact@v5
        if: ${{ !cancelled() }}
        with:
          name: axe-reports
          path: axe-reports/
          retention-days: 30

  labs:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: labs
    steps:
      - uses: actions/checkout@v6
      - name: Install uv and Python 3.12
        uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
        with:
          python-version: "3.12"
          enable-cache: true
          working-directory: labs
      - name: Install the project
        run: uv sync --locked --all-extras --dev
      - name: Lint
        run: uv run ruff check --output-format=github .
      - name: Format check
        run: uv run ruff format --check .
      - name: Tests
        run: uv run pytest
```

Notes.

- `ruff` must be a dev dependency in `labs/pyproject.toml` for `uv run ruff` to resolve. The official `astral-sh/ruff-action@v3` is an alternative (Ruff integrations doc).
- `uv sync --locked` fails if `uv.lock` is out of date; `--frozen` skips the check (uv settings source). `UV_LOCKED=1` and `UV_FROZEN=1` are the env equivalents.
- setup-uv only installs uv; it never installs the project (setup-uv README FAQ).
- Vitest reads `DATABASE_URL` from the job env or from a committed `.env.test` (section 1.3). Either works.
- The Playwright HTML report is not opened in CI because `open: 'never'` is set in the reporter config.

## 5. Content build check

### 5.1 Where the schema lives

Recommendation: keep the schema in a plain TypeScript module and import it from both `src/content.config.ts` and the check script. This is practical because `astro/zod` is a plain re-export with no Vite magic. From `astro/dist/zod.js` in 7.3.2:

```js
import * as mod from "zod/v4";
export * from "zod/v4";
```

So `import { z } from 'astro/zod'` works in Node scripts, Vitest, and Astro alike, with one Zod copy. Content collections docs import `z` from `astro/zod` as well (`guides/content-collections.mdx`). The one limit: schemas that need `image()` from `SchemaContext` must be a function inside `content.config.ts`. Keep that wrapper thin and put the plain fields in the shared module.

PROBE-verified layout:

```ts
// src/content/schema.ts
import { z } from 'astro/zod';

export const moduleSchema = z.object({
  title: z.string(),
  area: z.enum(['foundations', 'building', 'evaluating', 'operating']),
  order: z.number().int(),
  artifact: z.object({ label: z.string(), due: z.coerce.date() }),
  selfCheckCount: z.number().int().min(1),
});
export type ModuleFrontmatter = z.infer<typeof moduleSchema>;
export const REQUIRED_SECTIONS = ['Why this matters', 'Concepts', 'Lab', 'Artifact', 'Self-check'];
```

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { moduleSchema } from './content/schema';

const modules = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/modules' }),
  schema: moduleSchema,
});
export const collections = { modules };
```

Zod 4 note from the probe: `astro check` flagged `z.string().email()` as deprecated. Zod 4 uses `z.email()` (Zod `packages/docs/content/api.mdx`, ctx7 `/colinhacks/zod`).

### 5.2 What Astro already checks

`astro sync` validates every entry against the schema and fails with `InvalidContentEntryDataError` naming the file and field (PROBE, `area: bogus` produced `modules → orientation data does not match collection schema. area: Invalid option: expected one of ...`). `astro dev`, `astro build`, and `astro check` all run sync (`reference/cli-reference.mdx`). So frontmatter shape is covered by `astro check` in CI. The script exists for the things a schema cannot see: section headings and order, question counts, and cross-checks between frontmatter and body.

Reusing the collection loader from a script is not practical. `getCollection` comes from the `astro:content` virtual module, which only exists inside Astro's Vite pipeline. `gray-matter` plus the shared Zod schema gives the same validation without Astro.

### 5.3 The script

gray-matter API (README, ctx7 `/jonschlinkert/gray-matter`): `matter(string)` returns `{ data, content, excerpt, orig, language, matter }`; `matter.read(path)` reads a file and adds `path`.

Node 24 runs TypeScript files with erasable syntax directly; no flags, no `tsx` (Node v24 TypeScript docs, ctx7 `/websites/nodejs_latest-v24_x_api`). The recommended tsconfig for that mode sets `erasableSyntaxOnly`, `verbatimModuleSyntax`, `rewriteRelativeImportExtensions`, `module: nodenext`. The probe kept Astro's strict tsconfig and the script still ran because it uses only erasable syntax and explicit `.ts` import extensions.

PROBE: `node scripts/check-content.ts` printed `Content check passed` on a valid module and exited 1 with two clear messages after a heading was renamed and `selfCheckCount` was changed.

```ts
// scripts/check-content.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { moduleSchema, REQUIRED_SECTIONS } from '../src/content/schema.ts';

const dir = join(process.cwd(), 'src/content/modules');
const problems: string[] = [];

function headings(md: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
  const { data, content } = matter(readFileSync(join(dir, file), 'utf8'));
  const parsed = moduleSchema.safeParse(data);
  if (!parsed.success) {
    problems.push(`${file}: frontmatter invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  const hs = headings(content);
  const found = hs.filter((h) => REQUIRED_SECTIONS.includes(h));
  if (found.join('|') !== REQUIRED_SECTIONS.join('|')) {
    problems.push(`${file}: sections must appear in order ${REQUIRED_SECTIONS.join(' > ')}; found ${hs.join(' > ')}`);
  }
  const questionCount = (content.match(/prompt:/g) ?? []).length;
  if (questionCount !== parsed.data.selfCheckCount) {
    problems.push(`${file}: selfCheckCount is ${parsed.data.selfCheckCount} but ${questionCount} questions found`);
  }
  const due = parsed.data.artifact.due.toISOString().slice(0, 10);
  if (!content.includes(parsed.data.artifact.label) || !content.includes(due)) {
    problems.push(`${file}: Artifact section must mention "${parsed.data.artifact.label}" and ${due}`);
  }
}

if (problems.length) {
  console.error('Content check failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('Content check passed');
```

Adapt the question count rule to the real self-check data shape once it is fixed (a questions JSON file per module is easier to count than JSX props). Wire it as `"build": "npm run check:content && astro build"` and as its own CI step so failures are named.

Alternative: an Astro integration can run the same code in `astro:build:start`, whose signature is `(options: { logger, setPrerenderer }) => void | Promise<void>` (`reference/integrations-reference.mdx`). Throwing there should abort the build, but that was not exercised (UNVERIFIED). The npm script is simpler and also runs in CI before `astro check`.

## 6. Rate limiting for Astro Actions with one process

### 6.1 Where the client IP comes from

`context.clientAddress` is in `ActionAPIContext` (section 1.2). It is only available for on-demand routes (`reference/api-reference.mdx`), which every action is.

How the Node adapter sets it, from `astro/dist/core/app/node.js` (`createRequestFromNodeRequest`, used by `@astrojs/node/dist/serve-app.js`) and `astro/dist/core/app/validate-headers.js`:

1. The `Host` header is validated with `validateHost(host, socketProtocol, allowedDomains)`. The protocol is `https` only if the socket itself is TLS.
2. `X-Forwarded-Host` (first value) is validated with `validateForwardedHeaders(undefined, forwardedHost, undefined, allowedDomains)`; the protocol used for that match defaults to `https`.
3. If either validation passes, `clientAddress` is the first (leftmost) value of `X-Forwarded-For`. Otherwise it is `req.socket.remoteAddress`.
4. Both validators return nothing when `security.allowedDomains` is empty, which is the default.

Config reference (`reference/configuration-reference.mdx`): `security.allowedDomains` is an array of `{ protocol?, hostname?, port? }` patterns, default `[]`, since 5.14.2. Hostname wildcards `*.example.com` and `**.example.com` are supported. "All three are validated if provided." `[{}]` trusts every domain and is meant for trusted proxies with dynamic domains. When not configured, `X-Forwarded-Host` is ignored.

PROBE, built server with `curl` against `/ip` returning `{ clientAddress, url }`:

| allowedDomains | Headers sent | clientAddress | url |
| --- | --- | --- | --- |
| `[]` | `Host: probe.example.com`, `X-Forwarded-For: 203.0.113.7, 10.0.0.1`, `X-Forwarded-Proto: https` | `127.0.0.1` (socket) | `http://probe.example.com/ip` |
| `[{ hostname: 'probe.example.com', protocol: 'https' }]` | same as above | `127.0.0.1` (Host check fails because the socket is http) | `https://probe.example.com/ip` |
| `[{ hostname: 'probe.example.com', protocol: 'https' }]` | `X-Forwarded-Host: probe.example.com`, `X-Forwarded-For: 203.0.113.8` | `203.0.113.8` | `https://probe.example.com/ip` |
| `[{ hostname: 'probe.example.com' }]` | `Host: probe.example.com`, `X-Forwarded-For: 203.0.113.7, 10.0.0.1` | `203.0.113.7` | `https://probe.example.com/ip` |
| `[{ hostname: 'probe.example.com' }]` | `Host: evil.example.org`, `X-Forwarded-For: 203.0.113.9` | `127.0.0.1` (socket) | `http://evil.example.org/ip` |

Recommended Astro config for the OpenShift route (hostname only, so the plain-HTTP `Host` check passes behind edge TLS termination):

```js
// astro.config.mjs
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
  security: {
    allowedDomains: [{ hostname: 'your-public-host.example.com' }],
  },
});
```

`server: { host: true }` makes the server listen on all addresses in a container (`guides/deploy/sevalla.mdx`); `HOST=0.0.0.0` at runtime does the same.

Second reason this config is mandatory, not optional. Astro's CSRF check (`security.checkOrigin`, default `true` since v5) compares `request.headers.get("origin") === url.origin` exactly (`astro/dist/core/app/origin-check.js`). Behind edge TLS the browser sends `Origin: https://host`, and without `allowedDomains` the request URL is `http://host` (row 1 above), so every action POST would get a 403 "Cross-site POST form submissions are forbidden". With `allowedDomains` matching, `X-Forwarded-Proto` is honored and `url.origin` becomes `https://host` (rows 2 to 4). Playwright in CI hits the server over plain HTTP with no forwarded headers, so it is unaffected.

### 6.2 OpenShift router headers

OpenShift docs (ctx7 `/openshift/openshift-docs`, `modules/nw-ingress-controller-configuration-parameters.adoc`, `modules/nw-route-specific-annotations.adoc`, `modules/nw-using-ingress-forwarded.adoc`):

- The HAProxy Ingress Controller sets `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Port`, `X-Forwarded-Proto`, and `X-Forwarded-Proto-Version`. The global policy `spec.httpHeaders.forwardedHeaderPolicy` defaults to `Append`, which preserves headers a client already sent.
- The per-route annotation `haproxy.router.openshift.io/set-forwarded-headers` accepts `append` (default), `replace`, `never`, `if-none`.

Because Astro takes the leftmost `X-Forwarded-For` value, `Append` lets a client choose its own rate-limit key by sending `X-Forwarded-For: 1.2.3.4`. Set the route annotation to `replace` so the router's own view of the client wins:

```yaml
metadata:
  annotations:
    haproxy.router.openshift.io/set-forwarded-headers: replace
```

If another trusted proxy sits in front of the router, `replace` discards its header and the key becomes that proxy's address. Decide per environment and put it in the deploy runbook.

### 6.3 The limiter

Own code, not from any doc. PROBE: the tests below passed with Vitest fake timers (`vi.useFakeTimers()`, `vi.setSystemTime()`, `vi.advanceTimersByTime()`, `vi.useRealTimers()` from Vitest `docs/api/vi.md`). One process means a module-level `Map` is the whole store. Memory is bounded by the sweep.

```ts
// src/lib/rate-limit.ts
export type RateLimitRule = { limit: number; windowMs: number };

/** In-memory sliding window log. One process only. Keys like `ip:203.0.113.7` or `user:abc`. */
export function createRateLimiter(rule: RateLimitRule, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function sweep(t: number) {
    if (t - lastSweep < rule.windowMs) return;
    lastSweep = t;
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((s) => t - s < rule.windowMs);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }

  return {
    hit(key: string): { ok: boolean; remaining: number; retryAfterMs: number } {
      const t = now();
      sweep(t);
      const stamps = (hits.get(key) ?? []).filter((s) => t - s < rule.windowMs);
      if (stamps.length >= rule.limit) {
        hits.set(key, stamps);
        return { ok: false, remaining: 0, retryAfterMs: rule.windowMs - (t - stamps[0]) };
      }
      stamps.push(t);
      hits.set(key, stamps);
      return { ok: true, remaining: rule.limit - stamps.length, retryAfterMs: 0 };
    },
    size() {
      return hits.size;
    },
  };
}
```

```ts
// src/lib/rate-limit.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRateLimiter } from './rate-limit';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-15T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); });

test('allows up to limit within window, then blocks, then slides', () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
  expect(rl.hit('ip:1').ok).toBe(true);
  expect(rl.hit('ip:1').ok).toBe(true);
  expect(rl.hit('ip:1').ok).toBe(true);
  const blocked = rl.hit('ip:1');
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterMs).toBe(60_000);
  expect(rl.hit('ip:2').ok).toBe(true);
  vi.advanceTimersByTime(30_000);
  expect(rl.hit('ip:1').ok).toBe(false);
  vi.advanceTimersByTime(30_001);
  expect(rl.hit('ip:1').ok).toBe(true);
});

test('sweeps idle keys after a window', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1_000 });
  rl.hit('ip:a');
  rl.hit('ip:b');
  expect(rl.size()).toBe(2);
  vi.advanceTimersByTime(1_001);
  rl.hit('ip:c');
  expect(rl.size()).toBe(1);
});
```

Use inside an action. `TOO_MANY_REQUESTS` is a valid `ActionErrorCode` (present in the code-to-status map in `astro/dist/actions/runtime/client.d.ts`). `ActionError` takes `{ code, message? }` (`reference/modules/astro-actions.mdx`).

```ts
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { createRateLimiter } from '../lib/rate-limit';
import { subscribe } from '../lib/subscribe';

const byIp = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const byUser = createRateLimiter({ limit: 30, windowMs: 60_000 });

function enforce(context: { clientAddress: string; locals: App.Locals }) {
  if (!byIp.hit(`ip:${context.clientAddress}`).ok) {
    throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Try again in a few minutes.' });
  }
  const userId = context.locals.user?.id; // shape depends on the auth middleware, UNVERIFIED here
  if (userId && !byUser.hit(`user:${userId}`).ok) {
    throw new ActionError({ code: 'TOO_MANY_REQUESTS' });
  }
}

export const server = {
  notifyMe: defineAction({
    accept: 'form',
    input: z.object({ email: z.email() }),
    handler: async (input, context) => {
      enforce(context);
      return subscribe(input.email, { ip: context.clientAddress });
    },
  }),
};
```

Central alternative: in `src/middleware.ts`, `getActionContext(context)` exposes `action?.name` and `action?.calledFrom` for inbound action requests (`guides/actions.mdx`), so one middleware can rate limit every action by `context.clientAddress` and return `new Response('Too Many Requests', { status: 429 })` before `next()`. Per-action limits inside handlers stay clearer for a small site.

Module-level state resets on every process start and on every dev-server HMR reload of the module, which is fine for one replica.

## 7. Optional extras

Lighthouse CI (`@lhci/cli` 0.15.1). Trivial to add as a separate non-blocking job. From the Lighthouse CI README and llms.txt (ctx7 `/googlechrome/lighthouse-ci`):

```bash
lhci collect --start-server-command="yarn serve" --url=http://localhost:8080/
lhci assert --preset=lighthouse:recommended
lhci autorun --collect.numberOfRuns=5
```

and the GitHub Actions shape: `npm install -g @lhci/cli@0.15.x`, `npm run build`, `lhci autorun`, then upload `.lighthouseci/` as an artifact. For this repo the server command would be `node ./dist/server/entry.mjs` with `PORT` set. Assertions on a content site are noisy; start with `upload.target=temporary-public-storage` and no asserts.

pa11y 10.0.0 (README, ctx7 `/pa11y/pa11y`): `pa11y http://127.0.0.1:4321/ --runner axe` uses axe-core, default standard `WCAG2AA`, exit code 2 when errors are found and 1 on a technical fault. It needs its own headless Chrome through puppeteer. Since Playwright plus `@axe-core/playwright` already runs axe on real pages, pa11y adds nothing here. Skip it.

## Risks and open items

- `security.allowedDomains` must be set to the public hostname before the first deploy. Without it, `clientAddress` is the router's address and every action POST fails the CSRF origin check behind edge TLS. Both effects were reproduced with the built server.
- `haproxy.router.openshift.io/set-forwarded-headers: replace` on the Route closes the `X-Forwarded-For` spoofing hole in the rate limiter. It needs a runbook entry.
- Pattern B for action tests depends on `Symbol.for('astro.actionAPIContext')`, which is not documented. Prefer Pattern A.
- `.env.test` must exist (or the CI job must export the variables) or any test that imports `astro:env/server` fails at import.
- Vitest must exclude `e2e/**` or it collects the Playwright specs and fails.
- Preact Testing Library needs an explicit `afterEach(cleanup)` in the setup file with Vitest globals off.
- Shiki code blocks are Tab stops. The keyboard e2e and the accessibility review should account for that on every module page.
- TypeScript must stay on 5.x or 6.x for `@astrojs/check`.
- New dev dependencies needing approval: `@electric-sql/pglite` 0.5.8, `drizzle-kit` 0.31.10, `@types/node` 24.x, `@testing-library/preact`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@axe-core/playwright`, `gray-matter`.
- UNVERIFIED: happy-dom with user-event; throwing inside `astro:build:start` to fail a build; `actions/cache@v4` as the action name; whether Better Auth opens a database connection at server startup; whether the `db as any` cast for `pushSchema` is required.

