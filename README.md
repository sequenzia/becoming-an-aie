# Becoming an AI Engineer: The path from Software Engineer to AI Engineer

A self-paced program for software engineers moving into AI engineering. It follows the talk Beyond the Coding Agent. The talk's thesis, verbatim: "Using AI makes you an AI-enabled software engineer." "Engineering systems that depend on AI makes you an AI engineer."

The program is free, self-paced, has no certificate, and does not require a build.

## Stack

Astro 7 in server output with the Node adapter, MDX content collections, Astro Actions for every write, Drizzle over PostgreSQL (PGlite for tests and local dev), Better Auth with GitHub and Google, two Preact islands. Node 24 and npm. Exact version pins; see `docs/dependencies.md`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Astro dev server on port 4321 with PGlite in memory (or `PGLITE_DATA_DIR` from `.env`) |
| `npm run build` | Runs the content check, then `astro build` into `dist/` |
| `npm start` | Runs the built server: `node ./dist/server/entry.mjs` (reads `HOST` and `PORT`). A production build needs `DATABASE_URL`, or `PGLITE_DATA_DIR=memory://` to use the embedded database on purpose |
| `npm run preview` | `astro preview`: serves the built `dist/` through the Node adapter's preview server on port 4321. Needs the same runtime values as `npm start` |
| `npm run check` | `astro check` at error severity (runs `astro sync` first) |
| `npm run lint` | Em-dash and version-pin scan, then `astro check` at warning severity |
| `npm test` | `astro sync`, then Vitest (unit and component tests) |
| `npm run test:watch` | Vitest in watch mode. Run `npx astro sync` first after a content change so the collections are current |
| `npm run test:e2e` | Playwright against the built server (`PREVIEW_DRAFTS=true npm run build` first, as CI does) |
| `npm run content:check`, `npm run check:content` | Content validation script |
| `npm run drift:check`, `npm run drift` | Stale artifact and source report |
| `npm run check:a11y` | Playwright axe run on the page list |
| `npm run db:generate` | `drizzle-kit generate` from `src/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Applies `drizzle/` to Postgres (`DATABASE_URL`, `PG_CA_FILE`) |
| `npm run db:tls-check` | Proves the pool talks TLS to Postgres |

## Layout

- `src/content/` modules (MDX), artifacts, and the changelog. `src/content.config.ts` defines the collections.
- `src/lib/` shared library code: content schema and map, env, database helpers, tokens, mailer, plan, self-check grading, rate limiting.
- `src/db/` Drizzle schema, drivers, and the lazy `getDb()`.
- `src/actions/` every Astro Action.
- `src/pages/`, `src/layouts/`, `src/components/`, `src/styles/` the site.
- `scripts/` plain Node scripts: content check and drift review with their shared content-file helper, migrate, TLS check, lint, the diagram import, and the static Better Auth config for the optional CLI diff.
- `drizzle/` generated migrations, committed.
- `e2e/` Playwright specs. `test/` Vitest setup and fixtures.
- `docs/` the blueprint (`architecture.md`), decisions, dependencies, authoring guide, runbook, gate records, and `research/`, the planning cheat sheets the blueprint cites.

## Phase commits

One commit per phase on `main`. Each commit is a working site. Phase 0 is the landing page, live by talk day. Phase 1 is the platform. Phase 2 is the core content. Phase 3 is the closing content. Phase 4 is operations. `docs/architecture.md` section 1.3 lists what each commit contains.

## Documentation

- `docs/architecture.md`: the implementation blueprint and the contract between workstreams.
- `docs/decisions.md`: decisions in force, open items, and deviations waiting for sign-off.
- `docs/dependencies.md`: every dependency with its version, purpose, and approval status.
- `docs/content-authoring.md`: how to write a module and an artifact.
- `docs/deploy-openshift.md`: the deploy runbook.
- `docs/gates.md`: phase gate records.
- `specs/becoming-an-ai-engineer-SPEC.md`: the original specification.
