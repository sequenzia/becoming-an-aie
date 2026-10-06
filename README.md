# Becoming an AI Engineer: The path from Software Engineer to AI Engineer

A self-paced program for software engineers moving into AI engineering. It follows the talk Beyond the Coding Agent. The talk's thesis, verbatim: "Using AI makes you an AI-enabled software engineer." "Engineering systems that depend on AI makes you an AI engineer."

The program is free, self-paced, has no certificate, and does not require a build.

## Status

Phases 0 and 1 are committed on `main`. No phase gate is closed yet; `docs/gates.md` holds the open rows.

- Published: the landing page with notify-me, the map, the catalog, the changelog, privacy, and the orientation module.
- Platform: sign-in with GitHub or Google, the account page (data view, display name, one-click deletion), progress, mark complete, saved workshop and failure responses, the self-check and self-assessment islands, the plan, and feedback.
- Drafts: the other thirteen modules. `models.mdx` is the fixture area module, complete enough to exercise the module layout under `PREVIEW_DRAFTS=true`. The rest are skeletons until Phases 2 and 3.
- Email: no provider yet. The no-op mailer writes the confirm and unsubscribe links to the log (`docs/decisions.md`, open item 9).

## Stack

Astro 7 in server output with the Node adapter, MDX content collections, Astro Actions for every write, Drizzle over PostgreSQL (PGlite for tests and local dev), Better Auth with GitHub and Google, two Preact islands (self-check and self-assessment). Node 24 and npm. Exact version pins; see `docs/dependencies.md`.

## Local development

```sh
npm ci
cp .env.example .env    # then fill in the values below
npm run dev             # http://localhost:4321
```

The dev server needs `NOTIFY_TOKEN_SECRET` and, because accounts are on by default, `BETTER_AUTH_SECRET` and the four OAuth values. Generate the secrets with `openssl rand -base64 32`. Placeholder OAuth values (as in `e2e/env.ts`) are enough to browse; signing in needs real GitHub and Google OAuth apps with the callback URLs `<BETTER_AUTH_URL>/api/auth/callback/github` and `/google`. To browse without accounts, set `FEATURE_ACCOUNTS=false`.

With `DATABASE_URL` unset, the dev server uses PGlite in memory. Set `PGLITE_DATA_DIR=./.pglite-dev` to keep the data between restarts. Set `PREVIEW_DRAFTS=true` to render draft modules, which is how `/modules/models` becomes reachable.

## Configuration

`.env.example` names every variable with its default. There are two kinds (`docs/decisions.md`, decision 1):

- Build time: `SITE_URL`, `FEATURE_ACCOUNTS`, `PREVIEW_DRAFTS`. `astro build` inlines them, and the Dockerfile takes them as build args. Setting them on a running container does nothing. `PREVIEW_DRAFTS` is never set in an image.
- Runtime: `DATABASE_URL`, `PG_CA_FILE`, `PGLITE_DATA_DIR`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `NOTIFY_TOKEN_SECRET`, `EMAIL_PROVIDER`, and the OAuth client values. The server reads them at startup. `/readyz` answers 503 and logs the missing names until the required ones are set.

Leave a defaulted variable out rather than writing `NAME=` with no value: astro:env rejects an empty URL, boolean, or enum value.

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
| `npm run test:e2e` | Playwright against the built server with the values in `e2e/env.ts` (`PREVIEW_DRAFTS=true npm run build` first, as CI does) |
| `npm run content:check`, `npm run check:content` | Content validation script |
| `npm run drift:check`, `npm run drift` | Stale artifact and source report |
| `npm run check:a11y` | Playwright axe run on the page list |
| `npm run db:generate` | `drizzle-kit generate` from `src/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Applies `drizzle/` to Postgres (`DATABASE_URL`, `PG_CA_FILE`) |
| `npm run db:tls-check` | Proves the pool talks TLS to Postgres |

The full local run of what CI checks, with the Playwright knobs (`E2E_PORT`, `E2E_REUSE`), is in `docs/gates.md` under "Running the checks locally".

## CI and deployment

`.github/workflows/ci.yml` runs on every push and pull request to `main`. The `web` job runs lint, the content check, `astro check`, the unit and component tests, a `PREVIEW_DRAFTS=true` build, and the end-to-end and axe specs. It uploads `playwright-report/` and `axe-reports/` as artifacts. The `image` job builds the Dockerfile and smoke tests the container as OpenShift runs it: arbitrary UID, read-only root filesystem, no database. It pushes nowhere until the registry is confirmed (`docs/decisions.md`, open item 3). CI never signs in; signed-in flows are covered by component tests and the manual gates.

The site deploys to OpenShift with Postgres on RDS. The image bundles the RDS CA at `certs/rds-global-bundle.pem` and leaves out the embedded database. `docs/deploy-openshift.md` is the runbook.

A static preview also deploys to Vercel from `vercel.json`. `scripts/vercel-preview.mjs` builds with `FEATURE_ACCOUNTS=false` and Vercel serves only the prerendered pages from `dist/client`. `/modules` redirects to `/modules/orientation`, the notify form lands on a page that says the preview stores nothing, and `robots.txt` disallows everything. The preview has no server, database, or secrets. It is not a deployment target.

## Layout

- `src/content/` modules (MDX), artifacts, and the changelog. `src/content.config.ts` defines the collections.
- `src/lib/` shared library code: content schema and map, env, auth and session guard, account, progress, responses, self-check and assessment grading, plan, feedback, notify, tokens, mailer, headers, and rate limiting.
- `src/db/` Drizzle schema (app and Better Auth tables), drivers, and the lazy `getDb()`.
- `src/actions/` every Astro Action.
- `src/middleware.ts` session lookup, the route guard, and cache and security headers.
- `src/pages/` the routes, including `api/auth/` for Better Auth and `healthz` and `readyz` for the probes.
- `src/components/` `module/` (the module layout parts), `forms/`, `islands/` (the Preact islands and their offline storage), and `site/`.
- `src/layouts/`, `src/styles/` the base layout, design tokens, and styles.
- `scripts/` plain Node scripts: content check and drift review with their shared content-file helper, migrate, TLS check, lint, the diagram import, the Vercel preview build, and the static Better Auth config for the optional CLI diff.
- `drizzle/` generated migrations, committed.
- `e2e/` Playwright specs and their runtime values. `test/` Vitest setup and fixtures.
- `Dockerfile`, `certs/`, `.github/workflows/` the image, the RDS CA bundle, and CI. `vercel.json` the static preview.
- `docs/` the blueprint (`architecture.md`), decisions, dependencies, authoring guide, runbook, gate records, and `research/`, the planning cheat sheets the blueprint cites.

## Phase commits

One commit per phase on `main`. Each commit is a working site. `docs/architecture.md` section 1.3 lists what each commit contains.

| Phase | What it is | State |
|---|---|---|
| 0 | Landing page with notify-me, live by talk day | Committed, gate open |
| 1 | Platform: accounts, module rendering, orientation | Committed, gate open |
| 2 | Core content: foundations and the six area modules | Not started |
| 3 | Closing content: self-assessment, `/assessment`, first electives and labs | Not started |
| 4 | Operations | Not started |

## Documentation

- `docs/architecture.md`: the implementation blueprint and the contract between workstreams.
- `docs/decisions.md`: decisions in force, open items, and deviations waiting for sign-off.
- `docs/dependencies.md`: every dependency with its version, purpose, and approval status.
- `docs/content-authoring.md`: how to write a module and an artifact.
- `docs/deploy-openshift.md`: the deploy runbook.
- `docs/gates.md`: phase gate records and how to run the checks locally.
- `specs/becoming-an-ai-engineer-SPEC.md`: the original specification.
