# Dependencies

The ledger for TC-7.6.7: no new dependency without the author's explicit approval. Every entry in `package.json` appears here with its exact version, its purpose, and its approval status. Versions are exact pins; `scripts/lint.mjs` fails on any `^` or `~` range. Versions were confirmed with `npm view` on 2026-09-15.

Status: the author approved the stack on 2026-09-15. That is the nine runtime and build packages below, `pg` and `drizzle-kit` among them. The test tooling, the type packages, the Drizzle adapter for Better Auth, and gray-matter are pending explicit sign-off. Open item 2 in `docs/decisions.md` tracks it. The sign-off blocks the Phase 0 commit. Every pending package is installed and used by the Phase 0 checks today.

- Approved for the stack (the author's decisions of 2026-09-15): astro, @astrojs/node, @astrojs/mdx, @astrojs/preact, preact, drizzle-orm, drizzle-kit, pg, better-auth.
- Pending explicit sign-off, needed before the Phase 0 commit: @better-auth/drizzle-adapter, @electric-sql/pglite, vitest, @playwright/test, @axe-core/playwright, axe-core, @types/node, @types/pg, typescript, @astrojs/check, gray-matter, jsdom, @testing-library/preact, @testing-library/jest-dom, @testing-library/user-event. The four Testing Library and jsdom packages were listed for Phase 1 until 2026-10-03; `test/setup.ts` imports `@testing-library/jest-dom/vitest` and `@testing-library/preact` for every Vitest file and `tsconfig.json` names the jest-dom types, so the Phase 0 `npm test` and `astro check` already need them.

## Runtime dependencies

- `@astrojs/mdx` 8.0.1. MDX rendering on Astro's default Sätteri pipeline. Approved for the stack.
- `@astrojs/node` 11.1.5. Node adapter in standalone mode for the container. Approved for the stack.
- `@astrojs/preact` 6.0.5. Preact integration for the two islands. Approved for the stack.
- `@better-auth/drizzle-adapter` 1.7.5. The Drizzle adapter Better Auth 1.7.5 requires. Pending explicit sign-off (Phase 0).
- `astro` 7.3.2. The framework. Approved for the stack.
- `better-auth` 1.7.5. OAuth through GitHub and Google, sessions. Approved for the stack.
- `drizzle-orm` 0.45.2. Query builder and migrator over pg and PGlite. Approved for the stack.
- `pg` 8.23.0. PostgreSQL driver for RDS over TLS. Approved for the stack.
- `preact` 10.29.8. The island runtime. Approved for the stack.

## Development dependencies

- `@astrojs/check` 0.9.10. `astro check` type checking. Pending explicit sign-off (Phase 0).
- `@axe-core/playwright` 4.13.0. Accessibility audit in the e2e run. Pending explicit sign-off (Phase 0).
- `@electric-sql/pglite` 0.5.8. Embedded Postgres for tests and local dev. The runtime image installs with `--omit=optional`, so it is absent there (drizzle-orm lists it as an optional peer, which `--omit=dev` alone kept), and `getDb()` refuses it in production unless `PGLITE_DATA_DIR` is set on purpose. Pending explicit sign-off (Phase 0).
- `@playwright/test` 1.63.0. End-to-end tests against the built server. Pending explicit sign-off (Phase 0).
- `@testing-library/jest-dom` 7.0.1. DOM matchers for component tests. Pending explicit sign-off (Phase 0; loaded by `test/setup.ts` for every Vitest file).
- `@testing-library/preact` 3.2.4. Component tests for the islands. Pending explicit sign-off (Phase 0; loaded by `test/setup.ts` for every Vitest file).
- `@testing-library/user-event` 14.6.7. Keyboard simulation in component tests. Pending explicit sign-off (Phase 0; loaded by `test/setup.ts` for every Vitest file).
- `@types/node` 24.13.5. Node types for scripts and e2e under `astro check`. Pending explicit sign-off (Phase 0).
- `@types/pg` 8.23.1. Types for the pg driver. Pending explicit sign-off (Phase 0).
- `axe-core` 4.13.0. Pinned to the version `@axe-core/playwright` depends on; runs axe under jsdom in the island tests. Pending explicit sign-off (Phase 0).
- `drizzle-kit` 0.31.10. Generates `drizzle/` from the schema. Approved for the stack.
- `gray-matter` 4.0.3. Frontmatter parsing in the content check outside Astro. Pending explicit sign-off (Phase 0).
- `jsdom` 30.0.1. DOM environment for component tests. Pending explicit sign-off (Phase 0; loaded by `test/setup.ts` for every Vitest file).
- `typescript` 5.9.3. Stays on 5.x because `@astrojs/check` 0.9.10 refuses 7.x. Pending explicit sign-off (Phase 0).
- `vitest` 5.0.1. Unit and component test runner. Pending explicit sign-off (Phase 0).

## Transitive advisories (`npm audit`, 2026-10-03)

Direct pins never change for an advisory without an entry here. The lockfile may move a transitive package inside its declared range.

- `devalue` moved from 5.9.2 to 5.9.4 with `npm update devalue` (GHSA-j22f-vq7h-c4qm, high; GHSA-hx4r-w6wj-j8fg, moderate; both patched in 5.9.3). Astro's server runtime calls `stringify` only on an action's own return value and the client parses in the browser, so no untrusted input reached the affected code; the update is hygiene.
- `http-cache-semantics` 4.2.0 under `astro` (GHSA-ch52-4w7c-c8xp, high). Not fixable without a semver-major downgrade of astro. Reachable only from `astro/dist/assets/build/remote.js` at build time, for remote images; the site has none.
- `esbuild` 0.18.20 under `drizzle-kit` through `@esbuild-kit/*` (GHSA-67mh-4wv8-2f99, moderate, dev server CORS). Dev dependency, used only by `npm run db:generate`; never in the image.
- A CI `npm audit --omit=dev` step waits until the `http-cache-semantics` false positive can be allowlisted.

## Not installed, on purpose

- `zod`: everything imports `z` from `astro/zod`, which re-exports `zod/v4`.
- `@astrojs/markdown-remark`, `remark-*`, `rehype-*`, `sharp`, `hono`: not needed. Sätteri renders `.md` and `.mdx`. Images are SVG only.
- `@better-auth/cli` and the `auth` CLI: `src/db/auth-schema.ts` is hand-written from the CLI's pg snapshot. The optional diff runs `npx auth@1.7.5` with `scripts/auth-cli.config.ts`, never a committed dependency.

## Labs (Python, separate from the site)

The three optional labs under `labs/` (Phase 3) are standalone uv projects. Nothing here enters `package.json`, the site build, or the image. Each lab pins exact versions in its `pyproject.toml` and commits its `uv.lock`; the three files pin the same versions, and the three locks hold the same 24 third-party packages (checked with `tomllib` on 2026-10-09). The same approval rule applies: no new package without the author's explicit approval.

- Approved by the author on 2026-09-15 (the lab tooling): uv, ruff, pytest, Python 3.12.
- Pending explicit sign-off: the two provider SDKs, `anthropic` and `openai`. Every lab installs both; `adapter.py` is the only module that imports them, and the tests and `run.py --dry-run` make no call through them.

Pinned in all three `pyproject.toml` files (`labs/models-first-measurable-feature`, `labs/tools-tool-contract`, `labs/evals-first-grader`):

- Python 3.12. `requires-python = ">=3.12"` and `.python-version` 3.12; uv installs CPython 3.12.13. Approved (2026-09-15).
- uv 0.11.7. The project and environment manager; not a package of the labs. CI installs this version through `astral-sh/setup-uv` (`docs/decisions.md`, 2026-10-09 integrator entry). Approved (2026-09-15).
- `anthropic` 1.13.0. Runtime dependency; the Anthropic calls in `adapter.py` and `first_call.py`. Pending explicit sign-off.
- `openai` 3.27.0. Runtime dependency; the OpenAI calls in `adapter.py` and `first_call.py`. Pending explicit sign-off.
- `pytest` 9.1.1. Dev group; the tests. Approved (2026-09-15).
- `ruff` 0.16.10. Dev group; lint and format. uv resolved 0.17.0 with open pins on 2026-10-09; 0.16.10 is kept so the three labs match. Approved (2026-09-15).

Transitive packages in each `uv.lock`, through the two SDKs and pytest: annotated-types 0.8.0, anyio 4.15.1, colorama 0.4.6, docstring-parser 0.18.0, h11 0.16.0, httpcore2 2.13.1, httpx2 2.13.1, httpx2-jsfetch 1.0, idna 3.20, iniconfig 2.3.1, jiter 0.17.0, packaging 26.3, pluggy 1.6.0, pydantic 2.14.0, pydantic-core 2.50.0, pygments 2.21.0, sniffio 1.3.1, truststore 0.10.4, typing-extensions 4.16.0, typing-inspection 0.4.4.
