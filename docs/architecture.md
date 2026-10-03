# Architecture

This is the implementation blueprint for the becoming-an-aie site. It is derived from `specs/becoming-an-ai-engineer-SPEC.md` (v1.0) and the author's decisions of 2026-09-15 (OpenShift and a Dockerfile instead of Netlify, PostgreSQL on RDS through pg and Drizzle instead of Neon, no mail sent until a provider is chosen, GitHub and Google through Better Auth, the talk's palette plus a light theme, MDX with two Preact islands, npm and Node 24, one commit per phase). Where the blueprint deviates from the spec or the acceptance matrix, section 15.3 says so and asks for sign-off. Section 1 assigns every file to one of six workstreams; section 14 is the contract between them. The research files it cites live in the planning scratchpad and are summarized in `docs/decisions.md` as decisions are made.

# Implementation blueprint v2: becoming-an-aie

Written 2026-09-15. Revision of v1 after three reviews. Source of truth for six implementation agents working in parallel. Each agent reads this document and the research files under `scratchpad/research/`. Nothing else is assumed.

Spec: `/Users/ada/dev/becoming-an-aie/specs/becoming-an-ai-engineer-SPEC.md` (v1.0). The author's decisions of 2026-09-15 override the spec where they differ. The acceptance matrix (`research/acceptance-matrix.md`) is the grading list. Its CG-1 to CG-35 resolutions are adopted here unless section 15 says otherwise. Section 15.3 lists every place this blueprint deviates from the spec or the matrix and needs the author's sign-off.

## 0. How to read this document

- Section 1 is the file tree and the phase commits. Every file has exactly one owner: S, A, B, C, D, E, or F. Work only on your files.
- Sections 2 to 13 give the design. Where a section says "in full", the code is the contract. Copy it. Where it gives prose, follow the prose and the contracts table in section 14.
- Section 14 is the contracts table. If two workstreams meet at a function, a component prop, a class name, or an action name, it is in that table. Do not invent a second name for the same thing.
- Section 15 lists the decisions made here, the items still open, and the deviations that need sign-off.

Prose rules for every file you write, including comments, docs, and content: short declarative sentences, no em-dashes anywhere, no italics in rendered content (the design brief forbids them; `em` renders Bold).

### 0.1 Decisions in force (from the author, 2026-09-15)

| Topic | Decision |
|---|---|
| Hosting | OpenShift. One container image from a `Dockerfile`. `@astrojs/node` in `standalone` mode. One replica, one process. A deploy runbook. Not Netlify. |
| Database | PostgreSQL on AWS RDS through `pg` and Drizzle. `DATABASE_URL` from the environment. TLS with the RDS CA bundle verified. Not Neon. |
| Tests and local dev | `@electric-sql/pglite` through `drizzle-orm/pglite`. Dev dependency. Needs the author's approval (recorded in `docs/dependencies.md`). |
| Email | No mail is sent. Notify-me stores the address unconfirmed with `created_at`. Confirm and unsubscribe endpoints exist with signed tokens. `Mailer` is an interface with one implementation, `NoopMailer`, which logs. Confirmed opt-in is deferred until a provider is chosen. |
| OAuth | GitHub and Google through Better Auth. |
| Palette | The talk's dark palette and design brief carry over. A light theme uses the same four area colors on a light ground. `prefers-color-scheme` plus a toggle. |
| Content | MDX through `@astrojs/mdx` on Astro's default Sätteri pipeline. Preact islands for the self-check and the self-assessment only. |
| Toolchain | npm, Node 24. Labs: uv, ruff, pytest, Python 3.12 (Phase 3, outside these six workstreams). |
| Git | One commit per phase on `main`. |
| Everything else | As the spec says: Astro 7 in `output: 'server'`, content collections, Astro Actions for all writes, Drizzle, Better Auth. |

### 0.2 Facts verified on this machine that shape the design

These were checked on 2026-09-15 against the installed packages in the scratch projects (`scratchpad/probe`, `scratchpad/drz`) and the unpacked packages in `scratchpad/pkg/ba`. The research files hold the rest.

1. **`astro:env` has two runtime models.** `astro/dist/env/vite-plugin-env.js` (`getTemplates`) emits every `access: 'public'` variable as `export const KEY = JSON.stringify(value)`, computed from the environment present when `astro build` runs. Those values are constants inside `dist/server`. Only `context: 'server', access: 'secret'` variables are emitted as `export let KEY = _internalGetSecret("KEY")`, which reads `process.env` when the server starts (`loadedEnv: null` in build). In `astro dev` and in Vitest the loaded `.env` values are inlined for both kinds. Consequence: a value that must differ between the image build and the running container is declared `access: 'secret'`. `SITE_URL`, `FEATURE_ACCOUNTS`, and `PREVIEW_DRAFTS` are the only public server variables, and they are build arguments. `PG_CA_FILE`, `PGLITE_DATA_DIR`, `BETTER_AUTH_URL`, and `EMAIL_PROVIDER` are secrets even though they are not sensitive, because they are read at runtime. Application code reads configuration only through `src/lib/env.ts`. Scripts outside Astro (`scripts/migrate.mjs`, `scripts/tls-check.mjs`, `drizzle.config.ts`, `astro.config.mjs`) read `process.env`.
2. **`astro:env/server` validates every secret at module load** (`export let KEY = _internalGetSecret("KEY")` in `templates/env.mjs`). A required secret that is missing throws when any module imports `astro:env/server`. Consequence: every secret is declared `optional: true` in the schema and `src/lib/env.ts` enforces presence at first use with a clear error. Builds and content checks then run with no secrets present.
3. **Middleware runs for prerendered pages at build time.** Consequence: `src/middleware.ts` returns `next()` for `context.isPrerendered` before it touches Better Auth or the database, and the database and Better Auth instances are created lazily through `getDb()` and `getAuth()`, never at module load.
4. **The Astro 7 server build leaves `import('@electric-sql/pglite')`, `import('pg')`, `import('drizzle-orm/pglite')` and `import('drizzle-orm/node-postgres')` as external bare specifiers** (verified: a build with both branches produced a 572 KB `dist/server`, no WASM, and both branches ran under `node ./dist/server/entry.mjs`). No `vite.ssr.external` entry is needed. The design still avoids top-level await and uses lazy getters, because of fact 3.
5. **Request URL and client address behind a proxy.** `@astrojs/node` `serve-app.js` calls `createRequestFromNodeRequest`, which builds the request URL from the raw `Host` header and the socket protocol (`http` behind the OpenShift edge route). `FetchState.#applyForwardedHeaders` (`astro/dist/core/fetch/fetch-state.js`) then rewrites the protocol, host, and port from `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port`, and takes `clientAddress` from the leftmost `X-Forwarded-For`, but only when the values validate against `security.allowedDomains`. Astro's CSRF middleware (`origin-check.js`) compares `request.headers.get('origin') === url.origin` exactly for form-like POSTs. Consequences: with `allowedDomains` listing the public hostname, `url.origin` becomes `https://<host>` and action forms work behind edge TLS; without it every action POST returns 403 and rate limiting keys on the router address. In CI, Playwright hits `http://127.0.0.1:4321` with no forwarded headers, the URL is built from `Host: 127.0.0.1:4321`, and the origin check passes.
6. **`process.env` set inside `vitest.config.ts` before `getViteConfig()` is called reaches `astro:env/server`** for public and secret variables alike (verified with a `PROBE_SECRET` and a `PROBE_PUBLIC` field in the probe). Vitest's `test.env` does not. Consequence: no `.env.test` file is committed. `vitest.config.ts` assigns placeholder values to `process.env` before calling `getViteConfig`.
7. **Better Auth 1.7.5 source facts.** `OAuthMappedUser.image` is typed `string | undefined` (`@better-auth/core` `dist/oauth2/oauth-provider.d.mts` line 96), so `mapProfileToUser: () => ({ image: null })` fails `astro check`; `{ image: undefined }` typechecks and still overrides `avatar_url` because the mapper result is spread last. `accountLinking.enabled === false` makes `link-account.ts` return `{ error: 'account not linked' }`, and `callback.ts` redirects with `OAUTH_CALLBACK_ERROR_CODES.UNABLE_TO_LINK_ACCOUNT`, whose value is `unable_to_link_account` (`better-auth/dist/oauth2/errors.mjs` line 18). Other callback codes: `email_not_found`, `email_not_verified`, `email_does_not_match`. `appendQueryParams` joins Better Auth's `error` parameter onto an existing query with `&`, so `errorCallbackURL` must carry no query of its own. The secure cookie prefix is `__Secure-` (`src/cookies/index.ts` builds `${secureCookiePrefix}${name}` with `secure: !!secureCookiePrefix`). The GitHub provider calls `/user/emails` and uses the primary address when `/user` returns no email. The `auth` CLI resolves the config module as `m?.auth ?? m?.default?.auth ?? m?.default ?? mod` and fails without an `auth` export.
8. **The talk SVGs** (`scratchpad/beyond-the-coding-agent/internal/`) have `viewBox="0 0 1920 1080"`, an opaque `#14161c` canvas rect, twelve `<g id>` layers, sixteen `box-*` rect ids, no `<title>` and no `<desc>`. The base and the yours variant share the same id set, so two inline copies on one page collide. The import script rewrites ids to `data-*` attributes (section 10.4).
9. **drizzle-kit 0.31.10** emits `drizzle/0000_<name>.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`. `migrate(db, { migrationsFolder })` requires the config argument. The same folder applies to PGlite and to Postgres.
10. **Astro internals confirmed for this design.** `security.actionBodySizeLimit` defaults to 1 MiB (`schemas/defaults.js`); `security.csp` exists but the docs say Shiki inline styles are not supported; `@astrojs/node` accepts `staticHeaders`; the standalone server runs the static handler before the app handler, so middleware headers never reach prerendered pages; `getActionContext` only exposes an action for POST requests; `session: false` is valid; `String(actions.x)` is `?_action=x`; Sätteri MDX resolves unimported `<Workshop>`, `<Fragment slot>` and the other tags from `props.components`, and a tag missing from that map throws at render time on an on-demand page (a 500, not a build error).

## 1. Repository layout, workstreams, and phase commits

Root: `/Users/ada/dev/becoming-an-aie`. Tree with owner tag and purpose. `[S]` scaffold and shared contracts, `[A]` content pipeline, `[B]` auth and account, `[C]` learner write actions, `[D]` islands and forms, `[E]` public pages and theme, `[F]` delivery.

```
.
├── package.json                      [S] exact pins, scripts, engines
├── package-lock.json                 [S] committed lockfile from npm install
├── astro.config.mjs                  [S] server output, node adapter, env schema, allowedDomains, build flags
├── tsconfig.json                     [S] strict Astro config, Preact JSX, test types
├── drizzle.config.ts                 [S] drizzle-kit config for generate
├── vitest.config.ts                  [F] getViteConfig, placeholder process.env, e2e excluded
├── playwright.config.ts              [F] built Node server as webServer, Chromium only
├── Dockerfile                        [F] deps, build, runtime on node:24-slim, non-root
├── .dockerignore                     [F]
├── .gitignore                        [S] node_modules, dist, .astro, .env*, .pglite-dev, test-results, playwright-report, axe-reports
├── .env.example                      [F] every variable name with a comment, no values
├── README.md                         [S] skeleton: what this is, scripts, layout, phase commits
├── certs/
│   └── rds-global-bundle.pem         [F] public AWS RDS CA bundle, download date and SHA-256 in the runbook
├── docs/
│   ├── architecture.md               [S] this blueprint, copied verbatim with a preface
│   ├── decisions.md                  [S] decisions from section 15, appended by anyone who decides something
│   ├── dependencies.md               [S] every dependency with version and approval status
│   ├── content-authoring.md          [A] how to write a module and an artifact
│   ├── deploy-openshift.md           [F] the runbook
│   └── gates.md                      [F] phase gate records
├── drizzle/
│   ├── 0000_init.sql                 [S] generated by drizzle-kit from src/db/schema.ts
│   └── meta/
│       ├── _journal.json             [S] generated
│       └── 0000_snapshot.json        [S] generated
├── scripts/
│   ├── migrate.mjs                   [S] plain Node migrator for the container (pg only)
│   ├── tls-check.mjs                 [S] plain Node: proves the pool talks TLS to Postgres
│   ├── lint.mjs                      [S] em-dash scan and exact-pin check
│   ├── auth-cli.config.ts            [S] static Better Auth config for the auth CLI diff, never bundled
│   ├── content-check.ts              [A] build-time content validation
│   ├── content-check.test.ts         [A]
│   ├── drift-review.ts               [A] stale artifact and source report
│   ├── drift-review.test.ts          [A]
│   └── import-diagrams.mjs           [E] copies the talk SVGs into src/assets/diagrams, rewrites ids, records the source
├── test/
│   ├── setup.ts                      [F] jest-dom matchers and Testing Library cleanup
│   └── fixtures/
│       └── content/
│           ├── modules/              [A] valid and invalid module fixtures for content-check tests
│           └── artifacts/            [A]
├── e2e/
│   ├── env.ts                        [F] placeholder runtime values shared by the webServer and the specs
│   ├── landing.spec.ts               [F] thesis text, notify form, privacy link, guard redirects, cache headers
│   ├── keyboard.spec.ts              [F] landing to a self-check with keyboard only (Phase 1)
│   ├── notify.spec.ts                [F] no-JS subscribe, confirm and unsubscribe through signed tokens
│   └── a11y.spec.ts                  [F] axe on the page list in both themes, writes axe-reports/
├── .github/
│   └── workflows/
│       └── ci.yml                    [F] lint, content check, astro check, vitest, build, playwright, image
├── public/
│   ├── favicon.svg                   [E]
│   └── robots.txt                    [E]
└── src/
    ├── env.d.ts                      [S] App.Locals
    ├── content.config.ts             [S] collections modules, artifacts, changelog
    ├── middleware.ts                 [B] session into locals, route guard, headers (S writes the Phase 0 placeholder)
    ├── actions/
    │   ├── index.ts                  [C] every action (S writes the typed stub first, see 7.1)
    │   └── index.test.ts             [C] fake-context tests per action
    ├── assets/
    │   └── diagrams/                 [E] anatomy-landscape.svg, anatomy-landscape-yours.svg, mini-*.svg (7)
    ├── components/
    │   ├── site/
    │   │   ├── Header.astro          [E] nav, sign-in or user name, sign-out form, theme toggle
    │   │   ├── Footer.astro          [E] privacy, changelog, talk link
    │   │   ├── ThemeToggle.astro     [E] three buttons with data-theme-choice
    │   │   ├── PageHeader.astro      [E] kicker, mini-map, title, divider
    │   │   ├── MiniMap.astro         [E] one of seven mini SVGs on a dark tile with alt text
    │   │   ├── AnatomyMap.astro      [E] full map inline with per-instance title and desc, highlight, yours badges
    │   │   ├── NotifyForm.astro      [E] the notify-me form markup with the privacy link (used on / and /notify)
    │   │   ├── Callout.astro         [E] plain and surface callouts (also an MDX component)
    │   │   ├── Collapsible.astro     [E] details and summary with chevron (also an MDX component)
    │   │   ├── StatusChip.astro      [E] not started, in progress, complete, draft
    │   │   └── Notice.astro          [E] surface callout with role note (prerequisite, stale, generic)
    │   ├── module/
    │   │   ├── ModuleLayout.astro    [A] area strip or page header, meta, prerequisite notice, body, completion
    │   │   ├── AreaStrip.astro       [A] full-bleed area header
    │   │   ├── ModuleMeta.astro      [A] reading time, prerequisites, ISO dates, transfer rows
    │   │   ├── PrerequisiteNotice.astro [A] unmet prerequisites only
    │   │   ├── StaleNotice.astro     [A]
    │   │   ├── PitfallBand.astro     [A]
    │   │   ├── Artifact.astro        [A] artifact card by id
    │   │   ├── Workshop.astro        [A] wraps children, includes WorkshopResponseForm
    │   │   ├── FailureExercise.astro [A] wraps children, includes FailureResponseForm, reveals explanation slot
    │   │   ├── OptionalLab.astro     [A]
    │   │   ├── Takeaway.astro        [A] renders the frontmatter takeaway verbatim
    │   │   ├── Outcomes.astro        [A] renders the outcomes list with anchor ids
    │   │   ├── Sources.astro         [A] renders frontmatter sources, beats, chapters
    │   │   ├── SelfCheckPlacement.astro [A] reads locals, mounts the island
    │   │   ├── MarkCompleteForm.astro [A] orientation manual completion form
    │   │   └── mdx-components.ts     [A] the components map passed to Content
    │   ├── forms/
    │   │   ├── WorkshopResponseForm.astro [D] textarea form plus enhancement script
    │   │   └── FailureResponseForm.astro  [D]
    │   └── islands/
    │       ├── SelfCheck.tsx         [D] Preact island
    │       ├── SelfCheck.test.tsx    [D] behavior plus axe
    │       ├── self-check-storage.ts [D] localStorage state and offline queue
    │       ├── self-check-storage.test.ts [D]
    │       ├── SelfAssessment.tsx    [D] Preact island
    │       └── SelfAssessment.test.tsx [D] behavior plus axe
    ├── content/
    │   ├── modules/                  [A] fourteen module files (section 4.8)
    │   ├── artifacts/                [A] at least orientation-transfer-table.md and models-fixture-trace.md
    │   └── changelog/                [A] 2026-09-17-launch.md
    ├── db/
    │   ├── auth-schema.ts            [S] Better Auth tables, hand-written from the CLI snapshot
    │   ├── schema.ts                 [S] re-exports auth tables, app tables, enums, types
    │   ├── client.ts                 [S] createPgDb, createPgliteDb, createDb, Db type
    │   ├── client.test.ts            [S] createPgDb refuses plaintext in production
    │   └── index.ts                  [S] getDb() lazy singleton
    ├── layouts/
    │   └── Base.astro                [S] html shell, head, theme script, header, main, footer
    ├── lib/
    │   ├── content-schema.ts         [S] Zod schemas, content map, constants shared with scripts
    │   ├── content-schema.test.ts    [S] moduleRules against the content map
    │   ├── modules.ts                [S] published-module helpers over astro:content (PREVIEW_DRAFTS aware)
    │   ├── types.ts                  [S] LearnerModuleState, ModuleContext, MiniMapKey, refIds
    │   ├── env.ts                    [S] typed config from astro:env/server
    │   ├── headers.ts                [S] applySecurityHeaders, applyPrivateCache
    │   ├── limits.ts                 [S] constants: minimum lengths, rate rules, token lifetimes, bounds
    │   ├── rate-limit.ts             [S] sliding window limiter
    │   ├── rate-limit.test.ts        [S]
    │   ├── tokens.ts                 [S] HMAC tokens for confirm and unsubscribe
    │   ├── tokens.test.ts            [S]
    │   ├── mailer.ts                 [S] Mailer interface, NoopMailer, getMailer, setMailerForTests
    │   ├── mailer.test.ts            [S]
    │   ├── plan.ts                   [S] self-assessment plan algorithm and Markdown renderer
    │   ├── plan.test.ts              [S]
    │   ├── self-check.ts             [S] grading helpers shared by island and action
    │   ├── self-check.test.ts        [S]
    │   ├── dates.ts                  [S] isoDate, daysBetween, isStale
    │   ├── slug.ts                   [S] heading id generator matching github-slugger for ASCII
    │   ├── slug.test.ts              [S]
    │   ├── paths.ts                  [S] actionFormPath, moduleHref, safeNextPath
    │   ├── paths.test.ts             [S] asserts actionFormPath matches astro:actions queryString
    │   ├── auth.ts                   [B] getAuth() lazy Better Auth instance
    │   ├── auth.test.ts              [B] hooks and options
    │   ├── auth-client.ts            [B] createAuthClient()
    │   ├── auth-cookies.ts           [B] SESSION_COOKIE_NAMES, clearSessionCookies(cookies)
    │   ├── auth-cookies.test.ts      [B] delete options per name
    │   ├── sign-in-copy.ts           [B] signInMessage(code)
    │   ├── sign-in-copy.test.ts      [B]
    │   ├── guard.ts                  [B] PROTECTED_ROUTE_PATTERNS, signInPath
    │   ├── guard.test.ts             [B]
    │   ├── account.ts                [B] loadLearnerData, updateDisplayName, deleteLearner
    │   ├── account.test.ts           [B] pglite
    │   ├── actions-guard.ts          [C] requireUser, enforceRateLimit, clientIp
    │   ├── notify.ts                 [C] subscribe, confirm, unsubscribe over Db and Mailer
    │   ├── notify.test.ts            [C]
    │   ├── progress.ts               [C] listProgress, loadModuleState, touchStarted, completeModule, evaluateCompletion
    │   ├── progress.test.ts          [C]
    │   ├── responses.ts              [C] saveResponse (workshop and failure)
    │   ├── responses.test.ts         [C]
    │   ├── self-check-store.ts       [C] recordSelfCheck
    │   ├── self-check-store.test.ts  [C]
    │   ├── assessment.ts             [C] saveAssessment, updatePlanText, listVersions, getAssessment
    │   ├── assessment.test.ts        [C]
    │   ├── feedback.ts               [C] insertFeedback
    │   └── feedback.test.ts          [C]
    ├── pages/
    │   ├── index.astro               [E] landing, prerendered
    │   ├── 404.astro                 [E] prerendered
    │   ├── privacy.astro             [E] prerendered
    │   ├── map.astro                 [E] full anatomy diagram page, prerendered
    │   ├── changelog.astro           [A] prerendered from the changelog collection
    │   ├── modules/
    │   │   ├── index.astro           [A] catalog, on demand
    │   │   ├── orientation.astro     [A] prerendered module page (Phase 1)
    │   │   └── [slug].astro          [A] on-demand module page
    │   ├── progress.astro            [C] PRG target for markModuleComplete
    │   ├── notify/
    │   │   ├── index.astro           [C] PRG target for notifySubscribe
    │   │   ├── thanks.astro          [C] prerendered
    │   │   ├── confirm.astro         [C] on demand, calls notifyConfirm
    │   │   └── unsubscribe.astro     [C] on demand, calls notifyUnsubscribe
    │   ├── sign-in.astro             [B] on demand
    │   ├── sign-out.ts               [B] POST endpoint
    │   ├── account/
    │   │   ├── index.astro           [B] on demand, guarded
    │   │   ├── deleted.astro         [B] prerendered
    │   │   └── plan.md.ts            [B] GET endpoint, guarded, Markdown download
    │   ├── assessment.astro          [D] on demand, guarded, hosts SelfAssessment
    │   ├── healthz.ts                [F]
    │   ├── readyz.ts                 [F]
    │   └── api/
    │       └── auth/
    │           └── [...all].ts       [B] Better Auth handler
    └── styles/
        ├── tokens.css                [S] color and type tokens, both themes, area mapping
        ├── base.css                  [S] reset, type scale, components, focus, motion
        └── islands.css               [D] self-check and self-assessment styles
```

`labs/` (Phase 3) is not part of these six workstreams. `research/labs.md` specifies it.

### 1.1 Ownership rules

1. Every file has one owner. Only the owner edits it. The one exception is `docs/decisions.md`: anyone may append a dated entry.
2. S is written first and delivers a repository that builds, type-checks, and passes `npm test` with placeholder files for every path in the tree that S does not own. A placeholder is the smallest file that compiles and satisfies the contracted exports in section 14:
   - `.astro` placeholders render `<div data-placeholder="OWNER:path"></div>` and accept the contracted props.
   - `.ts` placeholders export the contracted signatures with neutral bodies (`[]`, `null`, `{ ok: true }`), never throwing.
   - `src/actions/index.ts` is the typed stub in section 7.1 with every action's `input` schema and a handler that throws `ActionError({ code: 'NOT_IMPLEMENTED' })`.
   - `src/middleware.ts` placeholder is the Phase 0 middleware in section 6.4 (locals null, headers, cache control, no auth).
   - `.mdx` placeholders are the draft skeletons in section 4.8.
   The owner replaces the placeholder. Section 1.3 says which placeholders may survive each phase commit. Any other placeholder that survives to a phase commit is a defect.
3. Cross-workstream imports go only through the names in section 14. Adding an export used by another workstream means adding a row to section 14 through `docs/decisions.md`.
4. No new dependency without the author's approval. `docs/dependencies.md` is the ledger. Section 2 is the full approved list to request.
5. The repository builds after every workstream lands independently. If your change needs another workstream's real implementation to build, you have crossed a contract boundary. Stop and use the placeholder.
6. S's placeholder components use the real contracts (for example `refIds(entry.data.prerequisites)` in the catalog placeholder), so a contract mismatch shows up before the owner lands.

### 1.2 Workstream summaries

- **S, scaffold and shared contracts.** Sections 2, 3, 4.1 to 4.3, 5, 7.1 (stub), 9.3, 9.5, 10.1 to 10.3, and every `[S]` file. Also the placeholders described in 1.1. Delivers first.
- **A, content pipeline and module rendering.** Module layout and components, catalog, module pages, changelog, orientation content, draft skeletons, the Phase 1 fixture area module, content-check and drift-review scripts, authoring guide.
- **B, auth and account.** Better Auth instance, API route, middleware, guard, sign-in and sign-out, account page with data view and deletion, plan download endpoint, tests.
- **C, learner write actions.** Every action handler, the library modules behind them, the notify and progress PRG pages, rate limiting inside handlers, tests.
- **D, islands and forms.** SelfCheck and SelfAssessment islands with tests, localStorage state and offline queue, workshop and failure response forms, the assessment page, island styles.
- **E, public pages and theme.** Landing, privacy, 404, map, header, footer, theme toggle, page header, mini-map and full diagram components with text alternatives, SVG import script, notify form markup, callout, collapsible, chips, notices.
- **F, delivery.** Dockerfile, .dockerignore, runbook, .env.example, CI workflow, Vitest config and setup, Playwright and axe config and specs, health endpoints, gate records, the RDS CA bundle.

### 1.3 Phase commits

One commit per phase on `main` (the Git decision). Each commit is a working site. The landing page must be live on 2026-09-17, so Phase 0 is cut before Phase 1 work is complete.

**Phase 0 commit** ("Landing page, live by talk day"). Contents:

- S: everything S owns, including the placeholders below.
- E: everything E owns.
- A: the fourteen module skeletons (section 4.8, all `draft: true`), `src/content/changelog/2026-09-17-launch.md`, `pages/changelog.astro`, `pages/modules/index.astro` (real catalog; every group is empty and shows its planned modules by name), `pages/modules/[slug].astro` (real; returns 404 for drafts), and `docs/content-authoring.md`. A's module components (`src/components/module/*`) may remain placeholders. `orientation.astro` does not exist yet; `[slug].astro` serves `/modules/orientation` as a draft 404.
- C: `src/lib/notify.ts` and its test, the three notify actions in `src/actions/index.ts`, and the four `pages/notify/*` files. Every other action keeps the `NOT_IMPLEMENTED` stub. `pages/progress.astro` and the other C library files may remain placeholders.
- B: nothing. `src/middleware.ts` is S's placeholder (section 6.4). `pages/api/auth/[...all].ts`, `pages/sign-in.astro`, `pages/sign-out.ts`, `pages/account/*` are placeholders. They are unreachable in the deployed image because it is built with `FEATURE_ACCOUNTS=false` (section 3.1), which hides the sign-in link, and the placeholder pages return 404 when the flag is off (the placeholder `.astro` pages check `env.featureAccounts` first).
- D: placeholders. No island renders because no module is published.
- F: everything F owns. `e2e/` holds `landing.spec.ts`, `notify.spec.ts`, and `a11y.spec.ts` with the Phase 0 page list (`/`, `/privacy`, `/map`, `/modules`, `/notify/thanks`, `/404` as the not-found page). `keyboard.spec.ts` is added in Phase 1.

The Phase 0 gate (section 12.5) runs against the deployed image. Placeholders permitted at this commit: B's five files, D's files, A's module components, C's non-notify library files and `progress.astro`.

**Phase 1 commit** ("Platform"). Every placeholder is replaced. `orientation.mdx` becomes real content and `pages/modules/orientation.astro` exists. `models.mdx` is the fixture area module (section 4.8): still `draft: true`, but complete enough to pass every non-draft rule under `--drafts-as-published`, so the module layout, forms, self-check island, artifact cards, and prerequisite notice are exercised in CI through `PREVIEW_DRAFTS=true` and in the manual gate through `astro dev`. The image is built with `FEATURE_ACCOUNTS=true` (the default) and without `PREVIEW_DRAFTS`, so the deployed site shows orientation only. No placeholder survives this commit.

**Phase 2 commit** ("Core content"): foundations and the six area modules flip to `draft: false`. **Phase 3 commit** ("Closing content"): `self-assessment.mdx` flips, `/assessment` opens, the first electives and labs land. **Phase 4** is operations.

Rule 1.1.2 amended: a placeholder is a defect at a phase commit unless this section lists it as permitted for that phase.

## 2. package.json (S, in full)

Every version is exact. No caret. Versions were confirmed with `npm view` on 2026-09-15 in `research/astro7.md`, `research/better-auth.md`, `research/drizzle.md`, and `research/testing-ci.md`. TypeScript stays on 5.9.3 because `@astrojs/check` 0.9.10 refuses 7.x. `axe-core` is pinned to the version `@axe-core/playwright` 4.13.0 depends on (`~4.13.0`).

```json
{
  "name": "becoming-an-aie",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Self-paced program: from software engineer to AI engineer. Follows the talk Beyond the Coding Agent.",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "npm run content:check && astro build",
    "preview": "astro preview",
    "start": "node ./dist/server/entry.mjs",
    "check": "astro check --minimumSeverity error",
    "test": "astro sync && vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "content:check": "node scripts/content-check.ts",
    "drift:check": "node scripts/drift-review.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node scripts/migrate.mjs",
    "db:tls-check": "node scripts/tls-check.mjs",
    "lint": "node scripts/lint.mjs && astro check --minimumSeverity warning",
    "check:content": "npm run content:check",
    "check:a11y": "playwright test e2e/a11y.spec.ts",
    "drift": "npm run drift:check"
  },
  "dependencies": {
    "@astrojs/mdx": "8.0.1",
    "@astrojs/node": "11.1.5",
    "@astrojs/preact": "6.0.5",
    "@better-auth/drizzle-adapter": "1.7.5",
    "astro": "7.3.2",
    "better-auth": "1.7.5",
    "drizzle-orm": "0.45.2",
    "pg": "8.23.0",
    "preact": "10.29.8"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.10",
    "@axe-core/playwright": "4.13.0",
    "@electric-sql/pglite": "0.5.8",
    "@playwright/test": "1.63.0",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/preact": "3.2.4",
    "@testing-library/user-event": "14.6.7",
    "@types/node": "24.13.5",
    "@types/pg": "8.23.1",
    "axe-core": "4.13.0",
    "drizzle-kit": "0.31.10",
    "gray-matter": "4.0.3",
    "jsdom": "30.0.1",
    "typescript": "5.9.3",
    "vitest": "5.0.1"
  }
}
```

Notes.

- `zod` is not a direct dependency. Everything imports `z` from `astro/zod`, which re-exports `zod/v4`.
- `@astrojs/markdown-remark`, `remark-*`, `rehype-*`, `sharp`, `hono` are not installed. Sätteri renders `.md` and `.mdx`. Images are SVG only.
- `@better-auth/cli` and the `auth` CLI are not dependencies. `src/db/auth-schema.ts` is hand-written from the CLI's pg snapshot (section 5.1). The optional diff run uses `scripts/auth-cli.config.ts` (section 5.1) and `npx auth@1.7.5`, never a committed dependency.
- `docs/dependencies.md` (S) lists each package above with: version, purpose, approval status. Pre-approved by the decisions: astro, @astrojs/node, @astrojs/mdx, @astrojs/preact, preact, drizzle-orm, drizzle-kit, pg, better-auth. Needing the author's approval before the Phase 1 commit: @better-auth/drizzle-adapter (required by better-auth 1.7.5 for Drizzle), @electric-sql/pglite, vitest, jsdom, @testing-library/preact, @testing-library/jest-dom, @testing-library/user-event, @playwright/test, @axe-core/playwright, axe-core, @types/node, @types/pg, typescript, @astrojs/check, gray-matter. The Phase 0 commit needs pglite, vitest, @playwright/test, @axe-core/playwright, @types/node, @types/pg, typescript, @astrojs/check, gray-matter already, so the approval request goes to the author before the Phase 0 commit.
- `npm run build` runs the content check first so a broken module fails the build before Astro starts (NFR-6.5.1). `astro check` runs separately in CI.
- `check:content`, `check:a11y`, and `drift` are aliases. The acceptance matrix fixes those names; the task list fixes `content:check`, `drift:check`, and `test:e2e`. Both sets work.
- `npm test` runs `astro sync` first so `.astro/types.d.ts` and the content data store exist before Vitest starts.

## 3. Configuration files (S, in full)

### 3.1 astro.config.mjs

```js
// astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

// BUILD-TIME VALUES. Astro inlines every public server variable into dist/server as a constant
// when `astro build` runs (astro/dist/env/vite-plugin-env.js, getTemplates). Setting these in the
// container's environment has no effect. The Dockerfile passes them as build arguments.
//   SITE_URL         public origin; also drives security.allowedDomains below
//   FEATURE_ACCOUNTS false only for the Phase 0 image, which ships no sign-in
//   PREVIEW_DRAFTS   true only for local dev and the CI e2e build; never for the image
// `||` not `??`: an empty string from an unset CI variable must fall back too.
const siteUrl = process.env.SITE_URL || 'http://localhost:4321';
const siteHost = new URL(siteUrl).hostname;
const isLocalHost = siteHost === 'localhost' || siteHost === '127.0.0.1';

export default defineConfig({
  site: siteUrl,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
  session: false,
  integrations: [mdx(), preact()],
  security: {
    checkOrigin: true,
    // Hostname only, no protocol. Behind the OpenShift edge route the socket is plain HTTP, so a
    // protocol match on the Host header would fail. With this set, FetchState honors
    // X-Forwarded-Proto and X-Forwarded-For for this host, which makes url.origin https and
    // clientAddress the real client. See section 0.2 fact 5 and research/testing-ci.md 6.1.
    allowedDomains: isLocalHost ? [] : [{ hostname: siteHost }],
    // Largest action body. Workshop responses are at most 20,000 characters (section 7.6).
    actionBodySizeLimit: 256 * 1024,
  },
  env: {
    // Every secret is optional here. src/lib/env.ts enforces presence at first use.
    // Reason: astro:env/server validates secrets when the module loads, and middleware
    // and prerendered pages load during astro build with no secrets present.
    // access: 'public'  = build-time constant (see the note at the top of this file)
    // access: 'secret'  = read from process.env when the server starts
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', url: true, default: 'http://localhost:4321' }),
      FEATURE_ACCOUNTS: envField.boolean({ context: 'server', access: 'public', default: true }),
      PREVIEW_DRAFTS: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Runtime values that are not sensitive but must vary per environment. Declared secret so
      // they are read at runtime. Never inlined.
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'secret', url: true, optional: true }),
      EMAIL_PROVIDER: envField.enum({ context: 'server', access: 'secret', values: ['none'], default: 'none' }),
      PG_CA_FILE: envField.string({ context: 'server', access: 'secret', optional: true }),
      PGLITE_DATA_DIR: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Real secrets.
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOTIFY_TOKEN_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
```

No `markdown.remarkPlugins`, no `rehypePlugins`, no `experimental` flags, no `redirects`, no `security.csp` (deferred, section 15.1). `server: { host: true }` makes dev and preview listen on all addresses. The standalone server reads `HOST` and `PORT` from the environment at runtime.

Build flags, stated once:

| Flag | Kind | Default | Phase 0 image | Phase 1+ image | CI e2e build | Local dev |
|---|---|---|---|---|---|---|
| `SITE_URL` | public, build arg | `http://localhost:4321` | public origin | public origin | default | default or `.env` |
| `FEATURE_ACCOUNTS` | public, build arg | `true` | `false` | `true` | `true` | `true` |
| `PREVIEW_DRAFTS` | public, build arg | `false` | `false` | `false` | `true` | `true` in `.env` |

### 3.2 tsconfig.json

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["node", "@testing-library/jest-dom"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules", "labs", ".pglite-dev"]
}
```

`allowImportingTsExtensions` lets `scripts/*.ts` import `../src/lib/content-schema.ts` with the extension, which Node 24 needs to run the scripts directly. `astro/tsconfigs/strict` already sets `verbatimModuleSyntax`, so every type import uses `import type`. `skipLibCheck` from the base config suppresses jest-dom's jest type reference (verified).

### 3.3 src/env.d.ts

```ts
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts on every on-demand request. Absent on prerendered pages. */
    user: import('better-auth').User | null;
    session: import('better-auth').Session | null;
    /** Set by the module pages before rendering Content. Read by module components. */
    module?: import('./lib/types').ModuleContext;
    /** Set by the on-demand module page for a signed-in learner. */
    learner?: import('./lib/types').LearnerModuleState;
    /** Set by the on-demand module page after a form action ran with an error. */
    formError?: import('./lib/types').FormError;
  }
}
```

### 3.4 src/lib/env.ts

Single place that reads configuration inside the Astro application. Scripts outside Astro read `process.env` directly.

```ts
// src/lib/env.ts
import {
  SITE_URL,
  FEATURE_ACCOUNTS,
  PREVIEW_DRAFTS,
  BETTER_AUTH_URL,
  EMAIL_PROVIDER,
  PG_CA_FILE,
  PGLITE_DATA_DIR,
  DATABASE_URL,
  BETTER_AUTH_SECRET,
  NOTIFY_TOKEN_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from 'astro:env/server';

export type RequiredSecret =
  | 'BETTER_AUTH_SECRET'
  | 'NOTIFY_TOKEN_SECRET'
  | 'GITHUB_CLIENT_ID'
  | 'GITHUB_CLIENT_SECRET'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET';

const secrets: Record<RequiredSecret, string | undefined> = {
  BETTER_AUTH_SECRET,
  NOTIFY_TOKEN_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
};

const AUTH_SECRETS: readonly RequiredSecret[] = [
  'BETTER_AUTH_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const MIN_SECRET_LENGTH = 32;

/** Returns the value or throws a message that names the variable. Never logs the value. */
export function requireEnv(name: RequiredSecret): string {
  const value = secrets[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  if ((name === 'BETTER_AUTH_SECRET' || name === 'NOTIFY_TOKEN_SECRET') && value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

const mode = import.meta.env.MODE;

export const env = {
  /** Build-time constant. The image must be built with SITE_URL set to the public origin. */
  siteUrl: SITE_URL.replace(/\/$/, ''),
  /** Runtime. Defaults to the build-time site URL. */
  authUrl: (BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, ''),
  emailProvider: EMAIL_PROVIDER,
  pgCaFile: PG_CA_FILE,
  pgliteDataDir: PGLITE_DATA_DIR,
  databaseUrl: DATABASE_URL,
  /** Build-time constants. */
  featureAccounts: FEATURE_ACCOUNTS,
  previewDrafts: PREVIEW_DRAFTS,
  isProduction: import.meta.env.PROD,
  isTest: mode === 'test',
} as const;

/**
 * Names of required configuration that is missing, for /readyz and the startup log.
 * Core: NOTIFY_TOKEN_SECRET always; DATABASE_URL in production; PG_CA_FILE whenever DATABASE_URL
 * is set in production (a plaintext RDS connection is refused, section 5.3).
 * Auth: the five auth secrets, only when the build enabled accounts.
 */
export function missingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!NOTIFY_TOKEN_SECRET) missing.push('NOTIFY_TOKEN_SECRET');
  if (env.isProduction && !DATABASE_URL) missing.push('DATABASE_URL');
  if (env.isProduction && DATABASE_URL && !PG_CA_FILE) missing.push('PG_CA_FILE');
  if (env.featureAccounts) {
    for (const name of AUTH_SECRETS) if (!secrets[name]) missing.push(name);
  }
  return missing;
}
```

Rules: no other module imports `astro:env/server`. `requireEnv` is called inside `getAuth()`, inside the notify library, and inside `/readyz`. It is never called at module top level.

### 3.5 Test environment values (no committed env file)

There is no `.env.test`. `vitest.config.ts` (F, section 12.3) assigns placeholder values to `process.env` before it calls `getViteConfig`, which is enough for `astro:env/server` (fact 0.2.6). `e2e/env.ts` (F) holds the placeholders the Playwright web server receives. Neither file contains a line of the form `NAME=value`, so the secret grep in NFR-6.2.4 stays clean. `DATABASE_URL` is deleted from `process.env` in `vitest.config.ts`, and `env.isTest` forces PGlite regardless, so a shell variable pointing at RDS can never be used by tests.

### 3.6 drizzle.config.ts

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://unused' },
  strict: true,
  verbose: true,
});
```

`npm run db:generate` needs no database. `drizzle-kit migrate` against RDS is not used; `scripts/migrate.mjs` is (section 5.4).

### 3.7 .gitignore

```
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.pglite-dev/
test-results/
playwright-report/
axe-reports/
.DS_Store
```

### 3.8 scripts/lint.mjs

Plain Node. Fails with exit 1 on any U+2014 in `src/`, `docs/`, `README.md`, `scripts/`, `e2e/`, or on any `^` or `~` version range in `package.json`. Prints `file:line` for each hit. Prints `lint: ok` otherwise. Directories that do not exist are skipped silently. It is the first half of `npm run lint`.

### 3.9 scripts/tls-check.mjs (S, in full)

```js
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
```

## 4. Content model

### 4.1 src/lib/content-schema.ts (S, in full)

Plain module. Imported by `src/content.config.ts`, by `scripts/content-check.ts`, by `scripts/drift-review.ts`, by the islands, and by the actions. It imports only `astro/zod`. It carries the content map from spec 5.5, so the schema, the check script, and the layout agree on beats, chapters, pitfalls, takeaways, and transfer rows.

```ts
// src/lib/content-schema.ts
import { z } from 'astro/zod';

export const AREA_KEYS = ['models', 'context', 'tools', 'orchestration', 'evals', 'operating'] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

export const AREA_TITLES: Record<AreaKey, string> = {
  models: 'Models',
  context: 'Context and knowledge',
  tools: 'Tools and extensibility',
  orchestration: 'Orchestration',
  evals: 'Verification and evals',
  operating: 'Operating it',
};

export const MODULE_KINDS = ['orientation', 'foundations', 'area', 'closing', 'elective'] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

/** Catalog group order. */
export const KIND_ORDER: readonly ModuleKind[] = MODULE_KINDS;

export const KIND_GROUP_TITLES: Record<ModuleKind, string> = {
  orientation: 'Orientation',
  foundations: 'Foundations',
  area: 'The six areas',
  closing: 'Closing',
  elective: 'Electives',
};

export const ARTIFACT_ORIGINS = ['captured', 'synthetic', 'public'] as const;
export type ArtifactOrigin = (typeof ARTIFACT_ORIGINS)[number];

export const ARTIFACT_KINDS = [
  'trace',
  'output-set',
  'tool-schema',
  'eval-report',
  'dashboard',
  'incident',
  'document',
  'table',
  'other',
] as const;

/** The talk's six-row "what transfers" table, verbatim (research/talk-kb.md D.2). */
export const TRANSFER_KEYS = ['decomposition', 'interface', 'testing', 'observability', 'security', 'operations'] as const;
export type TransferKey = (typeof TRANSFER_KEYS)[number];

export const TRANSFER_TABLE: Record<TransferKey, { from: string; to: string }> = {
  decomposition: { from: 'Decomposition and systems thinking', to: 'Harness design' },
  interface: { from: 'Interface design', to: 'Tool design' },
  testing: { from: 'Testing discipline', to: 'Eval discipline' },
  observability: { from: 'Observability', to: 'The same, with a new schema' },
  security: { from: 'Security and least privilege', to: 'Least privilege for tools' },
  operations: { from: 'Operations: cost, latency, incidents, rollback', to: 'The same, in tokens' },
};

export interface AreaMapEntry {
  slug: string;
  title: string;
  /** Position inside the area kind, 1 to 6, talk order. */
  order: number;
  beat: string;
  chapters: readonly number[];
  /** Spec 5.5 content map wording. The talk's slide 23 wording differs slightly (research/talk-kb.md D.4). */
  pitfall: string;
  takeaway: string;
  /** CG-20 row assignment. */
  transferRows: readonly TransferKey[];
}

/** Spec 5.5 content map plus the CG-20 transfer row assignment. Enforced by moduleRules. */
export const AREA_CONTENT_MAP: Record<AreaKey, AreaMapEntry> = {
  models: {
    slug: 'models',
    title: 'Models',
    order: 1,
    beat: '2.1',
    chapters: [6, 7, 10],
    pitfall: 'A hardcoded model ID with no eval suite behind it',
    takeaway: 'The model is a versioned, expiring dependency. Treat it like one.',
    transferRows: ['testing'],
  },
  context: {
    slug: 'context-and-knowledge',
    title: 'Context and knowledge',
    order: 2,
    beat: '2.2',
    chapters: [11, 12, 13, 14],
    pitfall: 'Adding context instead of curating it',
    takeaway: 'Context is a budget, not a bucket.',
    transferRows: ['decomposition'],
  },
  tools: {
    slug: 'tools-and-extensibility',
    title: 'Tools and extensibility',
    order: 3,
    beat: '2.3',
    chapters: [15],
    pitfall: 'Copying the API surface without evaluating task fit',
    takeaway: 'Design tools for a caller that reads the description every time and can still get it wrong.',
    transferRows: ['interface'],
  },
  orchestration: {
    slug: 'orchestration',
    title: 'Orchestration',
    order: 4,
    beat: '2.4',
    chapters: [16, 17, 18],
    pitfall: 'Multi-agent before a workflow was tried',
    takeaway: 'The loop is where autonomy gets its limits. Start with the workflow.',
    transferRows: ['decomposition'],
  },
  evals: {
    slug: 'verification-and-evals',
    title: 'Verification and evals',
    order: 5,
    beat: '2.5',
    chapters: [8, 9, 19],
    pitfall: 'A generic judge instead of error analysis; grading the transcript instead of the outcome',
    takeaway:
      'Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes.',
    transferRows: ['testing'],
  },
  operating: {
    slug: 'operating-it',
    title: 'Operating it',
    order: 6,
    beat: '2.6',
    chapters: [23, 24, 25, 26, 27],
    pitfall: 'The lethal trifecta, assembled one integration at a time',
    takeaway: 'When you are the owner, its answer is your answer.',
    transferRows: ['observability', 'security', 'operations'],
  },
};

/** Spec 5.11 electives. One chapter each. Enforced by content-check (slug) and moduleRules (title, chapter). */
export const ELECTIVE_MODULES: Record<string, { title: string; chapter: number; order: number }> = {
  'fine-tuning-and-adaptation': { title: 'Fine-tuning, distillation, and model adaptation', chapter: 20, order: 1 },
  'inference-and-hosting': { title: 'Inference and hosting fundamentals', chapter: 21, order: 2 },
  'multimodal-systems': { title: 'Multimodal systems', chapter: 22, order: 3 },
  'ai-engineering-team': { title: 'Working on an AI engineering team', chapter: 29, order: 4 },
  'career-and-learning': { title: 'Building your career and continuing to learn', chapter: 30, order: 5 },
};
export const ELECTIVE_TITLES = Object.values(ELECTIVE_MODULES).map((e) => e.title);
export const ELECTIVE_CHAPTERS = Object.values(ELECTIVE_MODULES).map((e) => e.chapter);

/** Chapter 28 (capstone) is out of scope (spec 5.5, 8.2). */
export const FORBIDDEN_CHAPTERS: readonly number[] = [28];

export const ORIENTATION_MAP = {
  slug: 'orientation',
  title: 'Orientation',
  talkBeats: ['1.3', '1.4', '3.1', '3.2', '3.3', '3.4'],
  bookChapters: [1, 2],
} as const;

export const FOUNDATIONS_MAP = {
  slug: 'foundations',
  title: 'Foundations',
  bookChapters: [4, 5, 6],
  catalogNote: 'Recommended before Verification and evals.',
} as const;

export const CLOSING_SLUG = 'self-assessment';

/** Every module slug this program ships, in catalog order. */
export const MODULE_SLUGS = [
  'orientation',
  'foundations',
  ...AREA_KEYS.map((k) => AREA_CONTENT_MAP[k].slug),
  CLOSING_SLUG,
  ...Object.keys(ELECTIVE_MODULES),
] as const;

/** Exact h2 text, in order, per kind. The content check enforces it. */
export const REQUIRED_SECTIONS: Record<ModuleKind, readonly string[]> = {
  orientation: ['Transfer connection', 'Topics and learning outcomes', 'Completion evidence', 'Sources'],
  foundations: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  area: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  elective: ['Transfer connection', 'Topics and learning outcomes', 'Workshop', 'Failure exercise', 'Completion evidence', 'Sources'],
  closing: ['How the assessment works', 'The six areas', 'After the plan', 'Sources'],
};

/** Optional h2 that may appear only between Failure exercise and Completion evidence. */
export const OPTIONAL_LAB_SECTION = 'Optional lab';

/** h2 that must not appear for a kind. */
export const FORBIDDEN_SECTIONS: Record<ModuleKind, readonly string[]> = {
  orientation: ['Workshop', 'Failure exercise', 'Optional lab'],
  foundations: [],
  area: [],
  elective: [],
  closing: ['Workshop', 'Failure exercise', 'Optional lab', 'Completion evidence'],
};

/** The only capitalized JSX tags a module body may use (section 4.6). Anything else fails the content check. */
export const MDX_TAGS = [
  'Artifact',
  'Callout',
  'Collapsible',
  'Workshop',
  'FailureExercise',
  'OptionalLab',
  'SelfCheck',
  'Sources',
  'AnatomyMap',
  'MarkComplete',
  'Takeaway',
  'Outcomes',
  'Fragment',
] as const;

/** Kinds whose body must place <SelfCheck /> in Completion evidence. */
export const SELF_CHECK_KINDS: readonly ModuleKind[] = ['orientation', 'foundations', 'area', 'elective'];

export const SELF_CHECK_MIN = 6;
export const SELF_CHECK_MAX = 12;
export const ORIENTATION_SELF_CHECK_MIN = 1;
export const AREA_READING_MIN = 45;
export const AREA_READING_MAX = 90;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words joined by hyphens');
const isoDate = z.coerce.date();

/** YAML may parse an unquoted date into a Date. Accept both and keep a string. */
const flexibleDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim()))
  .refine((v) => /^\d{4}(-\d{2}){0,2}$/.test(v), 'date must be YYYY, YYYY-MM, or YYYY-MM-DD');

export const sourceSchema = z.object({
  title: z.string().min(1),
  org: z.string().optional(),
  author: z.string().optional(),
  date: flexibleDate,
  url: z.url().optional(),
  checkedOn: isoDate.optional(),
  archivedOn: isoDate.optional(),
  archiveUrl: z.url().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const selfCheckQuestionSchema = z
  .object({
    id: slug,
    outcome: slug.optional(),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correct: z.array(z.number().int().min(0)).min(1),
    feedback: z.array(z.string().min(1)),
  })
  .superRefine((q, ctx) => {
    if (q.feedback.length !== q.options.length) {
      ctx.addIssue({ code: 'custom', path: ['feedback'], message: 'one feedback entry per option' });
    }
    for (const i of q.correct) {
      if (i >= q.options.length) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: `correct index ${i} is out of range` });
      }
    }
    if (new Set(q.correct).size !== q.correct.length) {
      ctx.addIssue({ code: 'custom', path: ['correct'], message: 'duplicate correct index' });
    }
  });
export type SelfCheckQuestion = z.infer<typeof selfCheckQuestionSchema>;

const ratedItem = z.object({ id: slug, text: z.string().min(1) });
const anchorHref = z.string().regex(/^\/modules\/[a-z0-9-]+#[a-z0-9-]+$/, 'must be /modules/<slug>#<heading-id>');

export const assessmentSpecSchema = z
  .object({
    scale: z.array(z.string().min(1)).length(4).default(['Not yet', 'Aware', 'Practiced', 'Confident']),
    contextQuestions: z.object({
      role: z.string().min(1),
      feature: z.string().min(1),
      ownsSystem: z.string().min(1),
    }),
    areas: z
      .array(
        z.object({
          area: z.enum(AREA_KEYS),
          moduleSlug: slug,
          transfers: z.array(ratedItem).min(1),
          competencies: z.array(ratedItem).min(1),
          /** Four area-specific step texts. {feature} and {role} are replaced at plan time. */
          steps: z
            .array(z.object({ step: z.number().int().min(1).max(4), text: z.string().min(1), href: anchorHref }))
            .length(4),
        }),
      )
      .length(6),
    roadmap: z
      .array(z.object({ step: z.number().int().min(1).max(4), title: z.string().min(1), subline: z.string().min(1) }))
      .length(4),
    uniformHigh: z.object({
      text: z.string().min(1),
      links: z.array(z.object({ text: z.string().min(1), href: z.string().min(1) })).min(1),
    }),
  })
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    spec.areas.forEach((a, ai) => {
      for (const item of [...a.transfers, ...a.competencies]) {
        if (ids.has(item.id)) {
          ctx.addIssue({ code: 'custom', path: ['areas', ai], message: `duplicate item id ${item.id}` });
        }
        ids.add(item.id);
      }
      const steps = a.steps.map((s) => s.step).sort().join(',');
      if (steps !== '1,2,3,4') {
        ctx.addIssue({ code: 'custom', path: ['areas', ai, 'steps'], message: 'steps must be 1,2,3,4' });
      }
      if (AREA_CONTENT_MAP[a.area].slug !== a.moduleSlug) {
        ctx.addIssue({ code: 'custom', path: ['areas', ai, 'moduleSlug'], message: `moduleSlug must be ${AREA_CONTENT_MAP[a.area].slug}` });
      }
    });
    const seen = new Set(spec.areas.map((a) => a.area));
    if (seen.size !== 6) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'each area exactly once' });
  });
export type AssessmentSpec = z.infer<typeof assessmentSpecSchema>;

/** Plain fields. content.config.ts extends this with reference() fields. */
export const moduleFields = z.object({
  title: z.string().min(1),
  kind: z.enum(MODULE_KINDS),
  area: z.enum([...AREA_KEYS, 'none']).default('none'),
  /** Position inside the kind: area 1 to 6, elective 1 to 5, every other kind 0. */
  order: z.number().int().min(0),
  summary: z.string().min(1).max(240),
  readingMinutes: z.number().int().min(1),
  prerequisites: z.array(slug).default([]),
  catalogNote: z.string().max(120).optional(),
  talkBeats: z.array(z.string()).default([]),
  bookChapters: z.array(z.number().int().min(1).max(30)).default([]),
  draft: z.boolean().default(false),
  updatedOn: isoDate,
  checkedOn: isoDate,
  staleAfterDays: z.number().int().min(1).default(90),
  takeaway: z.string().optional(),
  pitfall: z.string().optional(),
  /** Rows of the talk's transfer table this module expands. Required for area modules. */
  transferRows: z.array(z.enum(TRANSFER_KEYS)).default([]),
  artifacts: z.array(slug).default([]),
  outcomes: z.array(z.object({ id: slug, text: z.string().min(1) })).default([]),
  selfCheck: z.array(selfCheckQuestionSchema).default([]),
  lab: z.object({ path: z.string().min(1), title: z.string().min(1) }).optional(),
  sources: z.array(sourceSchema).default([]),
  assessment: assessmentSpecSchema.optional(),
});
export type ModuleFrontmatter = z.infer<typeof moduleFields>;

type RulesInput = Pick<
  ModuleFrontmatter,
  | 'title'
  | 'kind'
  | 'area'
  | 'order'
  | 'draft'
  | 'readingMinutes'
  | 'talkBeats'
  | 'bookChapters'
  | 'selfCheck'
  | 'outcomes'
  | 'takeaway'
  | 'pitfall'
  | 'transferRows'
  | 'assessment'
>;

type IssueCtx = { addIssue: (issue: { code: 'custom'; path?: (string | number)[]; message: string }) => void };

export interface ModuleRuleOptions {
  /** Apply every rule to drafts too. Used by content-check --drafts-as-published. */
  draftsAsPublished?: boolean;
}

const sameSet = (a: readonly (string | number)[], b: readonly (string | number)[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Kind-specific rules and the content map. Structural rules (kind, area, order, forbidden chapters)
 * apply to drafts too. Content rules are skipped for drafts unless draftsAsPublished is set.
 */
export function makeModuleRules(opts: ModuleRuleOptions = {}) {
  return function moduleRules(m: RulesInput, ctx: IssueCtx) {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', path, message });

    // Structural rules, every module.
    if (m.kind === 'closing' && !m.assessment) issue('closing module needs assessment', ['assessment']);
    if (m.kind === 'closing' && m.selfCheck.length > 0) issue('closing module has no self-check', ['selfCheck']);
    if (m.kind === 'area' && m.area === 'none') issue('area module needs an area', ['area']);
    if (m.kind !== 'area' && m.area !== 'none') issue('only area modules carry an area', ['area']);
    for (const c of m.bookChapters) {
      if (FORBIDDEN_CHAPTERS.includes(c)) issue(`chapter ${c} is out of scope`, ['bookChapters']);
    }
    if (m.kind === 'area' && (m.order < 1 || m.order > 6)) issue('area order is 1 to 6', ['order']);
    if (m.kind === 'elective' && (m.order < 1 || m.order > 5)) issue('elective order is 1 to 5', ['order']);
    if (m.kind !== 'area' && m.kind !== 'elective' && m.order !== 0) issue('order is 0 for this kind', ['order']);
    if (m.kind === 'area' && m.area !== 'none' && m.order !== AREA_CONTENT_MAP[m.area].order) {
      issue(`order for ${m.area} is ${AREA_CONTENT_MAP[m.area].order}`, ['order']);
    }

    if (m.draft && !opts.draftsAsPublished) return;

    // Content map, area modules.
    if (m.kind === 'area' && m.area !== 'none') {
      const map = AREA_CONTENT_MAP[m.area];
      if (m.title !== map.title) issue(`title must be "${map.title}"`, ['title']);
      if (!sameSet(m.talkBeats, [map.beat])) issue(`talkBeats must be ["${map.beat}"]`, ['talkBeats']);
      if (!sameSet(m.bookChapters, map.chapters)) issue(`bookChapters must be [${map.chapters.join(', ')}]`, ['bookChapters']);
      if (m.takeaway !== map.takeaway) issue('takeaway must match the content map verbatim', ['takeaway']);
      if (m.pitfall !== map.pitfall) issue('pitfall must match the content map verbatim', ['pitfall']);
      if (!sameSet(m.transferRows, map.transferRows)) issue(`transferRows must be [${map.transferRows.join(', ')}]`, ['transferRows']);
      if (m.readingMinutes < AREA_READING_MIN || m.readingMinutes > AREA_READING_MAX) {
        issue(`area modules read in ${AREA_READING_MIN} to ${AREA_READING_MAX} minutes`, ['readingMinutes']);
      }
    }
    // Electives: title and chapter from the elective set. The slug pairing is checked by content-check.
    if (m.kind === 'elective') {
      if (!ELECTIVE_TITLES.includes(m.title)) issue('elective title must be one of the five planned titles', ['title']);
      if (m.bookChapters.length !== 1 || !ELECTIVE_CHAPTERS.includes(m.bookChapters[0]!)) {
        issue('elective bookChapters must hold exactly one of 20, 21, 22, 29, 30', ['bookChapters']);
      }
      const planned = Object.values(ELECTIVE_MODULES).find((e) => e.title === m.title);
      if (planned && m.bookChapters[0] !== planned.chapter) issue(`"${m.title}" draws on chapter ${planned.chapter}`, ['bookChapters']);
    }
    if (m.kind === 'orientation') {
      if (!sameSet(m.talkBeats, ORIENTATION_MAP.talkBeats)) issue(`talkBeats must be [${ORIENTATION_MAP.talkBeats.join(', ')}]`, ['talkBeats']);
      if (!sameSet(m.bookChapters, ORIENTATION_MAP.bookChapters)) issue('bookChapters must be [1, 2]', ['bookChapters']);
    }
    if (m.kind === 'foundations' && !sameSet(m.bookChapters, FOUNDATIONS_MAP.bookChapters)) {
      issue('bookChapters must be [4, 5, 6]', ['bookChapters']);
    }

    // Self-check and outcomes.
    const min = m.kind === 'orientation' ? ORIENTATION_SELF_CHECK_MIN : SELF_CHECK_MIN;
    if (SELF_CHECK_KINDS.includes(m.kind)) {
      if (m.selfCheck.length < min || m.selfCheck.length > SELF_CHECK_MAX) {
        issue(`self-check needs ${min} to ${SELF_CHECK_MAX} questions, found ${m.selfCheck.length}`, ['selfCheck']);
      }
      if (m.outcomes.length === 0) issue('at least one learning outcome', ['outcomes']);
      const outcomeIds = new Set(m.outcomes.map((o) => o.id));
      const covered = new Set<string>();
      m.selfCheck.forEach((q, i) => {
        if (!q.outcome) issue(`question ${q.id} needs an outcome`, ['selfCheck', i, 'outcome']);
        else if (!outcomeIds.has(q.outcome)) issue(`question ${q.id} names unknown outcome ${q.outcome}`, ['selfCheck', i, 'outcome']);
        else covered.add(q.outcome);
      });
      for (const o of m.outcomes) {
        if (!covered.has(o.id)) issue(`outcome ${o.id} is not covered by any question`, ['outcomes']);
      }
    }
    const qids = new Set<string>();
    m.selfCheck.forEach((q, i) => {
      if (qids.has(q.id)) issue(`duplicate question id ${q.id}`, ['selfCheck', i, 'id']);
      qids.add(q.id);
    });
  };
}

export const moduleRules = makeModuleRules();

/** The schema the scripts use. Astro's collection adds reference() fields on top of moduleFields. */
export const moduleSchema = moduleFields.superRefine(moduleRules);
export const moduleSchemaDraftsAsPublished = moduleFields.superRefine(makeModuleRules({ draftsAsPublished: true }));

export const artifactSchema = z.object({
  title: z.string().min(1),
  origin: z.enum(ARTIFACT_ORIGINS),
  kind: z.enum(ARTIFACT_KINDS).default('other'),
  tool: z.string().optional(),
  version: z.string().optional(),
  checkedOn: isoDate,
  url: z.url().optional(),
  reviewedOn: isoDate.optional(),
  archivedOn: isoDate.optional(),
  archiveUrl: z.url().optional(),
  download: z.string().regex(/^\/artifacts\/[a-z0-9-]+\.[a-z0-9]+$/).optional(),
  summary: z.string().max(240).optional(),
});
export type ArtifactFrontmatter = z.infer<typeof artifactSchema>;

export const changelogSchema = z.object({
  date: isoDate,
  title: z.string().min(1),
});
```

`src/lib/content-schema.test.ts` (S) feeds `moduleRules` a valid frontmatter per kind built from the map and asserts no issues, then flips each mapped field (beat, chapter set, takeaway, pitfall, transfer rows, order, chapter 28) and asserts the named issue.

### 4.2 src/lib/types.ts (S, in full)

```ts
// src/lib/types.ts
import type { MarkdownHeading } from 'astro';
import type { CollectionEntry } from 'astro:content';
import type { AreaKey } from './content-schema';

export type MiniMapKey = 'models' | 'context' | 'tools' | 'orchestration' | 'evals' | 'operating' | 'all';

export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

/** A collection reference as Astro stores it in data: { collection, id }. */
export type EntryRef = { collection: string; id: string };

/** Turns reference() values into plain ids. Scripts see strings; Astro components see references. */
export function refIds(refs: ReadonlyArray<EntryRef>): string[] {
  return refs.map((r) => r.id);
}

export interface PrerequisiteSummary {
  slug: string;
  title: string;
  area: AreaKey | 'none';
}

export interface ModuleContext {
  slug: string;
  /** The collection entry's data. prerequisites and artifacts are references, not strings. */
  data: CollectionEntry<'modules'>['data'];
  headings: MarkdownHeading[];
  /** Resolved prerequisite entries in frontmatter order. */
  prerequisites: PrerequisiteSummary[];
  /** True when the page renders a draft under PREVIEW_DRAFTS. */
  preview: boolean;
}

export interface ProgressRow {
  status: ModuleStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ResponseRow {
  body: string;
  updatedAt: Date;
}

export interface SelfCheckRow {
  answers: Record<string, number[]>;
  attempts: number;
  passed: boolean;
  updatedAt: Date;
}

export interface LearnerModuleState {
  progress: ProgressRow | null;
  workshop: ResponseRow | null;
  failure: ResponseRow | null;
  selfCheck: SelfCheckRow | null;
  /** Every progress row of the learner, keyed by module slug. Feeds the prerequisite notice. */
  progressBySlug: Record<string, ProgressRow>;
}

export const EMPTY_LEARNER_STATE: LearnerModuleState = {
  progress: null,
  workshop: null,
  failure: null,
  selfCheck: null,
  progressBySlug: {},
};

export interface FormError {
  /** Which form the error belongs to. */
  form: 'workshop' | 'failure' | 'feedback' | 'displayName' | 'delete';
  message: string;
  /** The rejected input, echoed back so the learner does not lose it. */
  value?: string;
}
```

### 4.3 src/content.config.ts (S, in full)

```ts
// src/content.config.ts
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { moduleFields, moduleRules, artifactSchema, changelogSchema } from './lib/content-schema';

const modules = defineCollection({
  loader: glob({ base: './src/content/modules', pattern: '**/[^_]*.mdx' }),
  schema: moduleFields
    .extend({
      artifacts: z.array(reference('artifacts')).default([]),
      prerequisites: z.array(reference('modules')).default([]),
    })
    .superRefine(moduleRules),
});

const artifacts = defineCollection({
  loader: glob({ base: './src/content/artifacts', pattern: '**/[^_]*.md' }),
  schema: artifactSchema,
});

const changelog = defineCollection({
  loader: glob({ base: './src/content/changelog', pattern: '**/[^_]*.md' }),
  schema: changelogSchema,
});

export const collections = { modules, artifacts, changelog };
```

Entry ids are the file names without extension. `src/content/modules/verification-and-evals.mdx` has id `verification-and-evals` and renders at `/modules/verification-and-evals`. No `slug` field in frontmatter.

### 4.4 src/lib/modules.ts (S, in full)

Every page, action, and the account page decide visibility through this module, so `PREVIEW_DRAFTS` has one implementation.

```ts
// src/lib/modules.ts
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { env } from './env';
import { KIND_ORDER } from './content-schema';

export type ModuleEntry = CollectionEntry<'modules'>;

/** A module renders when it is not a draft, or when the build enabled draft preview. */
export function isPublished(entry: ModuleEntry): boolean {
  return !entry.data.draft || env.previewDrafts;
}

/** Catalog sort: kind group order, then order within the kind, then title. */
export function compareModules(a: ModuleEntry, b: ModuleEntry): number {
  return (
    KIND_ORDER.indexOf(a.data.kind) - KIND_ORDER.indexOf(b.data.kind) ||
    a.data.order - b.data.order ||
    a.data.title.localeCompare(b.data.title)
  );
}

export async function getAllModules(): Promise<ModuleEntry[]> {
  return (await getCollection('modules')).sort(compareModules);
}

export async function getPublishedModules(): Promise<ModuleEntry[]> {
  return (await getAllModules()).filter(isPublished);
}

/** The entry when it exists and is published, else null. Actions use this for their entry check. */
export async function getPublishedModule(slug: string): Promise<ModuleEntry | null> {
  const entry = await getEntry('modules', slug);
  return entry && isPublished(entry) ? entry : null;
}
```

### 4.5 File naming

- Modules: `src/content/modules/<slug>.mdx`. Slugs are fixed by `MODULE_SLUGS`: `orientation`, `foundations`, `models`, `context-and-knowledge`, `tools-and-extensibility`, `orchestration`, `verification-and-evals`, `operating-it`, `self-assessment`, `fine-tuning-and-adaptation`, `inference-and-hosting`, `multimodal-systems`, `ai-engineering-team`, `career-and-learning`. The content check fails on any other file name.
- Artifacts: `src/content/artifacts/<id>.md`. Ids are prefixed by the module that introduced them, for example `models-eval-report-a`, `orientation-transfer-table`. The body is Markdown. Traces, JSON, schemas, and spans go in fenced code blocks with a language. No raw HTML in `.md` files (Sätteri passes it through unchanged). Downloadable copies, when offered, live at `public/artifacts/<id>.<ext>` and are named in `download`.
- Changelog: `src/content/changelog/<YYYY-MM-DD>-<slug>.md`.
- Draft skeletons: real slugs with `draft: true`. Files starting with `_` are ignored by the loaders and by the scripts.

### 4.6 Artifact bodies and reuse

Decision: one shape. Every artifact is a `.md` file whose frontmatter carries the label fields and whose body carries the content. The `Artifact.astro` component (A) does `getEntry('artifacts', id)` and `render(entry)` and wraps the result in the artifact card (section 10.4). Reuse is by id: two modules that list the same id in `artifacts` and place `<Artifact id="..." />` in their bodies render the same card with the same label. The module's frontmatter list exists so `reference('artifacts')` fails the build on a missing id and so the content check can cross-check body usage.

### 4.7 The MDX component set

Module bodies never import components. `src/pages/modules/[slug].astro` and `orientation.astro` pass `mdxComponents` (A, `src/components/module/mdx-components.ts`) to `<Content components={mdxComponents} />`. A tag missing from the map throws at render time on an on-demand page, so the content check whitelists `MDX_TAGS` (section 11.1 step 4). The map:

| Tag in MDX | Component | Props | Renders |
|---|---|---|---|
| `<Artifact id="x" />` | `module/Artifact.astro` | `id: string` | The artifact card. Errors at build if the id does not exist. |
| `<Callout kind="plain" label="Why this matters">...</Callout>` | `site/Callout.astro` | `kind: 'plain' \| 'surface'` (default `surface`), `label: string` | Section 10.4 callout. |
| `<Collapsible title="Mathematical reference">...</Collapsible>` | `site/Collapsible.astro` | `title: string`, `open?: boolean` | `details` and `summary`. |
| `<Workshop>...</Workshop>` | `module/Workshop.astro` | none | Children (artifacts, task paragraph, rubric list) then `WorkshopResponseForm` (D) with the saved response from `locals.learner`, or a sign-in prompt. |
| `<FailureExercise>...<Fragment slot="explanation">...</Fragment></FailureExercise>` | `module/FailureExercise.astro` | none | Children, then `FailureResponseForm` (D), then, only when `locals.learner.failure` exists, the `PitfallBand` with `locals.module.data.pitfall` followed by the explanation slot (section 10.4). |
| `<OptionalLab>...</OptionalLab>` | `module/OptionalLab.astro` | none; reads `locals.module.data.lab` | A card headed "Optional lab" with the lab path and the children as instructions. |
| `<Takeaway />` | `module/Takeaway.astro` | none; reads `locals.module.data.takeaway` | `<p class="takeaway"><b>Takeaway.</b> {takeaway}</p>`. Required in area module bodies. Renders nothing when the field is absent. |
| `<Outcomes />` | `module/Outcomes.astro` | none; reads `locals.module.data.outcomes` | `<ol class="outcomes">` with one `<li id="outcome-<id>">` per outcome. Required in the Topics section for self-check kinds. |
| `<SelfCheck />` | `module/SelfCheckPlacement.astro` | none; reads `locals.module.data.selfCheck` and `locals.learner.selfCheck` | The Preact island with `client:load`. On orientation `persist="local"`. |
| `<Sources />` | `module/Sources.astro` | none; reads `locals.module.data` | Sources list with dates, talk beats, book chapters, checked-on dates, archived notes. |
| `<AnatomyMap highlight="model" variant="base" />` | `site/AnatomyMap.astro` | `variant?: 'base' \| 'yours'`, `highlight?: 'model' \| 'harness' \| 'per-run' \| 'across-runs'` | The full diagram on a dark tile with per-instance title and description, long description in a collapsible. |
| `<MarkComplete />` | `module/MarkCompleteForm.astro` | none | Orientation only. The manual completion form (section 7.4). |

Headings are written in Markdown by the author (`## Workshop`), never by the components, so the content check sees them and Sätteri gives them ids. Every JSX tag is closed. Blank lines separate Markdown inside a JSX block from the tags. `<Fragment>` is injected by `@astrojs/mdx` and needs no import.

### 4.8 Example module: frontmatter and skeleton body

`src/content/modules/verification-and-evals.mdx` (a draft skeleton at Phase 1; the real content lands in Phase 2):

```mdx
---
title: Verification and evals
kind: area
area: evals
order: 5
summary: Check the action before accepting it, then measure behavior across representative cases.
readingMinutes: 75
prerequisites: [foundations, models]
talkBeats: ["2.5"]
bookChapters: [8, 9, 19]
draft: true
updatedOn: 2026-09-15
checkedOn: 2026-09-15
staleAfterDays: 90
takeaway: "Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes."
pitfall: "A generic judge instead of error analysis; grading the transcript instead of the outcome"
transferRows: [testing]
artifacts: [evals-flight-booking-grader, evals-twenty-outputs]
outcomes:
  - id: verify-vs-evaluate
    text: Distinguish checking one action from measuring behavior across cases.
  - id: outcome-not-transcript
    text: Grade the outcome in the environment, not the transcript's claim.
  - id: pass-at-k
    text: Explain what pass@k and pass^k answer and why consistency matters.
  - id: start-small
    text: Start an eval suite from 20 to 50 real failures and refine criteria by reading outputs.
selfCheck:
  - id: q1
    outcome: outcome-not-transcript
    question: An agent's transcript ends with "Your flight has been booked." What settles the result check?
    options:
      - The sentence itself
      - A reservation row matching the requested traveler and itinerary
      - The number of tool calls
    correct: [1]
    feedback:
      - Not yet. The claim is not the outcome. Reread "Check the result. Inspect the trace."
      - Correct. The outcome lives in the environment's state.
      - Not yet. A tool count does not define success. Reread the trace-check paragraph.
sources:
  - title: Demystifying evals for AI agents
    org: Anthropic
    date: "2026-01"
    url: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
    checkedOn: 2026-09-15
---

## Transfer connection

Testing discipline becomes eval discipline. What stays the same: the habit of checking before accepting a result. What changes: the unit of measurement is a population of cases, not one path.

## Topics and learning outcomes

<Outcomes />

Concepts with outcomes. The coding-agent worked example. A sourced public incident.

### Two complementary uses of checks

Text.

<Takeaway />

## Workshop

<Workshop>

<Artifact id="evals-twenty-outputs" />

Task in one paragraph.

- Rubric item one.
- Rubric item two.

</Workshop>

## Failure exercise

<FailureExercise>

<Artifact id="evals-flight-booking-grader" />

Find the pitfall in this grader and explain it.

<Fragment slot="explanation">

The grader trusts the transcript's success sentence. The outcome check is missing.

</Fragment>

</FailureExercise>

## Completion evidence

Passing the self-check and saving a workshop response completes this module.

<SelfCheck />

## Sources

<Sources />
```

The example carries one question. A non-draft area module needs six to twelve.

### 4.9 The fourteen module files (A)

A creates all fourteen files in Phase 0. Every file has valid frontmatter under the structural rules (kind, area, order, dates, chapters) and the required headings with one placeholder sentence each. Frontmatter values per file:

| Slug | kind | area | order | prerequisites | talkBeats | bookChapters | catalogNote |
|---|---|---|---|---|---|---|---|
| `orientation` | orientation | none | 0 | [] | 1.3, 1.4, 3.1, 3.2, 3.3, 3.4 | 1, 2 | |
| `foundations` | foundations | none | 0 | [orientation] | [] | 4, 5, 6 | Recommended before Verification and evals. |
| `models` | area | models | 1 | [foundations] | 2.1 | 6, 7, 10 | |
| `context-and-knowledge` | area | context | 2 | [foundations, models] | 2.2 | 11, 12, 13, 14 | |
| `tools-and-extensibility` | area | tools | 3 | [foundations, context-and-knowledge] | 2.3 | 15 | |
| `orchestration` | area | orchestration | 4 | [foundations, tools-and-extensibility] | 2.4 | 16, 17, 18 | |
| `verification-and-evals` | area | evals | 5 | [foundations, models] | 2.5 | 8, 9, 19 | |
| `operating-it` | area | operating | 6 | [foundations, verification-and-evals] | 2.6 | 23, 24, 25, 26, 27 | |
| `self-assessment` | closing | none | 0 | the six area slugs | 3.1, 3.2, 3.4 | [] | |
| `fine-tuning-and-adaptation` | elective | none | 1 | [] | [] | 20 | |
| `inference-and-hosting` | elective | none | 2 | [] | [] | 21 | |
| `multimodal-systems` | elective | none | 3 | [] | [] | 22 | |
| `ai-engineering-team` | elective | none | 4 | [] | [] | 29 | |
| `career-and-learning` | elective | none | 5 | [] | [] | 30 | |

Area modules carry the `title`, `takeaway`, `pitfall`, and `transferRows` from `AREA_CONTENT_MAP`. Electives carry the title from `ELECTIVE_MODULES`. The closing module's `talkBeats` and `bookChapters` are A's choice and are not enforced. Electives never appear in a prerequisites list of a non-elective; the content check enforces it. The landing page lists all fourteen modules from the collection, drafts marked "planned" (section 8).

**Orientation brief (Phase 1, real content).** `orientation.mdx` flips to `draft: false`. Body beats, in this order, each an `h3` under Topics and learning outcomes unless noted:

1. Under Transfer connection: the two thesis sentences verbatim ("Using AI makes you an AI-enabled software engineer." "Engineering systems that depend on AI makes you an AI engineer."), the definition of owner ("the engineer or team accountable for the delivered product's behavior and operating limits"), and the three-row table from talk beat 1.4 (research/talk-kb.md A.5).
2. `### A compelling prototype is not evidence` (talk 1.1 and 1.4: works.any() versus works.all(), the three commitments; book chapter 1's demonstration failure).
3. `### The map` with `<AnatomyMap />` and the four layers (talk 2.0, research/talk-kb.md B.1).
4. `### What transfers` with the six-row table rendered from the artifact `orientation-transfer-table` (talk 3.1).
5. `### What is new`: the ladder (prompt, context, harness engineering with the years as vocabulary markers) and the seven competencies in the talk's display order, introduced with the sentence "The talk lists these without ranking them." (CG-2; if the author later fixes a program order, `docs/decisions.md` records it and this sentence changes).
6. `### The seven pitfalls`: the six area pitfalls in the slide 23 wording plus "reaching for a framework before understanding the loop".
7. `### The roadmap`: the four steps with their sublines verbatim (research/talk-kb.md D.5).
8. `### Look before you build` summarizing book chapter 2.
9. Under Completion evidence: "Reading this module is the evidence. The self-check below is optional and does not count toward completion." then `<SelfCheck />`, then `<MarkComplete />`.

Talk-length wording (CG-30): the body says "the talk" or "35 minutes of content", never "a 35-minute talk". Prerequisite mentions follow the book's audience statement, not a credential claim.

**Fixture area module (Phase 1).** `models.mdx` stays `draft: true` but is complete under `--drafts-as-published`: the map values, `readingMinutes: 45`, `transferRows: [testing]`, one `outcomes` list of at least four entries, six questions each naming an outcome, `artifacts: [models-fixture-trace]` placed once in the Workshop and once in the Failure exercise with an explanation slot, `<Outcomes />`, `<Takeaway />`, `<SelfCheck />`, `<Sources />`, and at least one source with `checkedOn`. The prose is placeholder text that says so in its first sentence. Phase 2 replaces the prose. This is the page CI renders under `PREVIEW_DRAFTS=true` for `e2e/a11y.spec.ts` and `e2e/keyboard.spec.ts`, and the page the Phase 1 gate opens in `astro dev` while signed in.

### 4.10 Example artifact

`src/content/artifacts/evals-flight-booking-grader.md` (the outer fence below is four backticks only so the inner JSON fence shows; the file itself uses three):

````md
---
title: Flight-booking grader, illustrative
origin: synthetic
kind: eval-report
tool: none
checkedOn: 2026-09-15
summary: An illustrative grader that reads the transcript instead of the reservation table. Not a real incident.
---

Claim in the transcript: "Your flight has been booked."

```json
{ "grader": "transcript-claim", "pass_if": "text contains 'has been booked'", "outcome_check": null }
```

Result check that is missing: a matching reservation for the requested traveler and itinerary.
````

The talk's research warns that the flight-booking grader is an illustration and must never be presented as a real incident. Origin `synthetic` and the summary say so.

### 4.11 Closing module frontmatter (A writes it; S needs the shape for plan.ts)

`self-assessment.mdx` carries `kind: closing`, `area: none`, `assessment:` with six areas in talk order. Competency-to-area mapping (CG-17): models gets `models-behavior-intuition` and `models-cost-and-latency`; context gets `context-engineering`; tools gets `tools-tool-design`; orchestration gets `orchestration-harness-and-loop`; evals gets `evals-error-analysis`; operating gets `operating-ai-security` and `operating-cost-and-latency`. Cost and latency appears twice by design with two ids. Transfer items per area follow CG-20 and `AREA_CONTENT_MAP.transferRows`, with ids `<area>-<row>`: models `models-testing`; context `context-decomposition`; tools `tools-interface`; orchestration `orchestration-decomposition`; evals `evals-testing`; operating `operating-observability`, `operating-security`, `operating-operations`. Item texts: the seven competency texts verbatim from `research/talk-kb.md` D.3, presented unranked; the transfer texts from `TRANSFER_TABLE`. The four `roadmap` entries are the talk's steps and sublines verbatim from D.5. Each area's four `steps[].href` points at an existing heading in that area's module, for example `/modules/models#workshop`, `/modules/models#topics-and-learning-outcomes`. `uniformHigh.links` holds `/modules#electives` and the book blueprint link (URL to be confirmed by the author, section 15.2).

### 4.12 Heading ids

Sätteri generates ids with github-slugger. For the ASCII headings this program uses, the rule is: lowercase, drop characters other than letters, digits, spaces, and hyphens, replace spaces with hyphens. `src/lib/slug.ts` (S) implements that rule as `headingId(text: string): string` with tests for the seven template headings and for headings with punctuation ("pass@k and pass^k" gives `passk-and-passk`). The content check and the plan anchors use it. A heading whose id would differ between `github-slugger` and this rule must be rewritten by the author; the authoring guide says so.

## 5. Database

### 5.1 src/db/auth-schema.ts (S, in full)

Hand-written to match the Better Auth 1.7.5 CLI pg snapshot recorded in `research/better-auth.md` section 4.3, with singular table names and no plugin columns. Column property names are camelCase and database names are snake_case, which is what the Drizzle adapter expects. Timestamps stay without time zone, as generated.

```ts
// src/db/auth-schema.ts
// Better Auth 1.7.5 core tables. Shape copied from the CLI pg snapshot.
// Optional diff: npx auth@1.7.5 generate --config scripts/auth-cli.config.ts --output /tmp/auth-schema.ts -y
// then diff /tmp/auth-schema.ts against this file. The CLI is never a dependency.
import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').$onUpdate(() => new Date()).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_userId_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index('account_userId_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
```

`scripts/auth-cli.config.ts` (S, in full). The `auth` CLI needs a module that exports `auth`, and it must not import `astro:*` modules. This file exists only for the optional diff and is never bundled (it sits outside `src/`).

```ts
// scripts/auth-cli.config.ts
// Static configuration for `npx auth@1.7.5 generate`. Mirrors the providers and database of
// src/lib/auth.ts without any astro:* import. Never imported by the application.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '../src/db/schema.ts';

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: 'pg', schema }),
  socialProviders: {
    github: { clientId: 'cli', clientSecret: 'cli' },
    google: { clientId: 'cli', clientSecret: 'cli' },
  },
});
```

### 5.2 src/db/schema.ts (S, in full)

Changes from `research/drizzle.md` section 2.3, each per the acceptance matrix: `workshop_response` gains `kind` (CG-10); `self_assessment` gains `plan_text` and `created_at` and keeps versions (CG-18); `feedback` is new and has no user column (CG-15); `notify_subscriber` drops the `token` column because tokens are stateless HMAC values (CG-16).

```ts
// src/db/schema.ts
import { pgTable, pgEnum, text, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
import type { Plan } from '../lib/plan';

export { user, session, account, verification, userRelations, sessionRelations, accountRelations } from './auth-schema';

export const moduleStatus = pgEnum('module_status', ['not_started', 'in_progress', 'completed']);
export const responseKind = pgEnum('response_kind', ['workshop', 'failure']);

export const moduleProgress = pgTable(
  'module_progress',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    status: moduleStatus('status').notNull().default('not_started'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('module_progress_user_module_uidx').on(t.userId, t.moduleSlug)],
);

export const workshopResponse = pgTable(
  'workshop_response',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    kind: responseKind('kind').notNull().default('workshop'),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('workshop_response_user_module_kind_uidx').on(t.userId, t.moduleSlug, t.kind)],
);

export type SelfCheckAnswers = Record<string, number[]>;

export const selfCheckResult = pgTable(
  'self_check_result',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    attempts: integer('attempts').notNull().default(0),
    passed: boolean('passed').notNull().default(false),
    answers: jsonb('answers').$type<SelfCheckAnswers>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('self_check_result_user_module_uidx').on(t.userId, t.moduleSlug)],
);

export type Ratings = Record<string, number>;
export type AssessmentContextRow = { role: string; feature: string; ownsSystem: 'yes' | 'no' | 'partly' };

export const selfAssessment = pgTable(
  'self_assessment',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    ratings: jsonb('ratings').$type<Ratings>().notNull(),
    context: jsonb('context').$type<AssessmentContextRow>().notNull(),
    plan: jsonb('plan').$type<Plan>().notNull(),
    planText: text('plan_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('self_assessment_user_version_uidx').on(t.userId, t.version), index('self_assessment_user_idx').on(t.userId)],
);

export const notifySubscriber = pgTable('notify_subscriber', {
  email: text('email').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
});

export const feedback = pgTable('feedback', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Rules that follow from this schema:

- `user.id` is `text`, so every `user_id` is `text`. Every app table cascades on user deletion (EC-5.9.3, AC-5.9.5).
- `notify_subscriber.email` is stored lowercased and trimmed. `deleteLearner` lowercases the user's email before deleting the subscriber row.
- Learner text columns (`body`, `plan_text`) are plain text. Rendering escapes them. Nothing parses them.
- Better Auth's `session.updated_at` and `account.updated_at` have no database default. Tests that insert those rows directly pass `updatedAt`.
- `drizzle/0000_init.sql` is generated once from this file with `npm run db:generate -- --name init` and committed with `meta/`. Every later schema change is a new generated migration, additive only in the same release (no drops), because Drizzle has no down migrations.

### 5.3 src/db/client.ts and src/db/index.ts (S, in full)

```ts
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
```

```ts
// src/db/index.ts
import { env } from '../lib/env';
import { createDb, type DbHandle } from './client';

const g = globalThis as unknown as { __aieDb?: Promise<DbHandle> };

/**
 * Lazy singleton. Nothing connects until the first call, so astro build, astro sync,
 * and the content check never touch a database. Cached on globalThis to survive
 * Vite HMR re-evaluation in dev. Tests always get PGlite in memory.
 * In production a missing PG_CA_FILE throws PlaintextRefusedError before any socket opens.
 */
export function getDb(): Promise<DbHandle> {
  g.__aieDb ??= createDb({
    databaseUrl: env.isTest ? undefined : env.databaseUrl,
    caFile: env.pgCaFile,
    requireTls: env.isProduction,
    pgliteDataDir: env.isTest ? undefined : env.pgliteDataDir,
  }).then(async (h) => {
    // The embedded database is created empty. Postgres on RDS is migrated by scripts/migrate.mjs.
    if (h.driver === 'pglite') await h.migrate();
    return h;
  });
  return g.__aieDb;
}

let shutdownRegistered = false;
export function registerShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  process.once('SIGTERM', async () => {
    const h = await g.__aieDb;
    await h?.close();
    process.exit(0);
  });
}
```

`src/db/client.test.ts` (S): `createPgDb('postgres://user:pw@db.example/aie', { requireTls: true })` rejects with `PlaintextRefusedError` before any import of `pg` runs (the throw precedes the dynamic imports); a URL with `?sslmode=require` rejects with the ssl-parameter message; `createPgliteDb()` returns a handle whose `migrate()` applies `drizzle/` and whose `db` can insert a `notify_subscriber` row.

`registerShutdown()` is called once from `src/middleware.ts` on the first non-prerendered request. Better Auth's `getAuth()` awaits `getDb()`.

Typing, verified: `drizzleAdapter`'s first parameter is `DB { [key: string]: any }` (`@better-auth/drizzle-adapter` `dist/index.d.mts`), so the `Db` base type needs no cast. `db.execute()` on `Db` returns `unknown`; use the query builder, and cast only in `/readyz`.

### 5.4 scripts/migrate.mjs (S, in full)

```js
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
```

### 5.5 Migration strategy for OpenShift

Decision: migrations run as an explicit step before each rollout, from the same image, with `oc exec` as the fallback. Not at container start.

Why. The Drizzle migrator documents no lock. One replica makes a startup migration safe today, but a startup migration means the web process holds DDL rights on every boot, a failed migration crash-loops the pod, and a scale-up later would race. A Job runs once, fails loudly on its own, and leaves the Deployment untouched. The runbook (section 13.3) has the commands. `npm start` is only `node ./dist/server/entry.mjs`.

Local dev and tests: `getDb()` migrates the embedded database on creation, so nobody runs a migration by hand. `drizzle-kit migrate` is not used anywhere.

Backward compatibility rule: a migration in release N must keep release N minus 1 running, because the Job runs before the new pods start. Add columns with defaults, never drop or rename in the same release.

## 6. Auth (B)

### 6.1 src/lib/auth.ts (in full)

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from '../db';
import * as schema from '../db/schema';
import { env, requireEnv } from './env';

export type Auth = ReturnType<typeof betterAuth>;

const g = globalThis as unknown as { __aieAuth?: Promise<Auth> };

/**
 * Drops the avatar URL. OAuthMappedUser types image as string | undefined (null fails astro check).
 * The mapper result is spread last in both providers, so undefined overrides avatar_url.
 * databaseHooks.user.create.before below is the second line of defense.
 */
const dropImage = () => ({ image: undefined });

/** Lazy singleton. Created on the first on-demand request, never at build time. */
export function getAuth(): Promise<Auth> {
  g.__aieAuth ??= getDb().then(({ db }) =>
    betterAuth({
      baseURL: env.authUrl,
      basePath: '/api/auth',
      secret: requireEnv('BETTER_AUTH_SECRET'),
      database: drizzleAdapter(db, { provider: 'pg', schema }),
      socialProviders: {
        // GitHub: scopes read:user and user:email by default. When /user returns email: null the
        // provider fetches /user/emails and uses the primary address; a private-email account with
        // no readable address ends in ?error=email_not_found (better-auth 1.7.5 src_github.ts,
        // src_callback.ts). The Phase 1 gate checks a private-email account.
        github: {
          clientId: requireEnv('GITHUB_CLIENT_ID'),
          clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
          mapProfileToUser: dropImage,
        },
        google: {
          clientId: requireEnv('GOOGLE_CLIENT_ID'),
          clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
          mapProfileToUser: dropImage,
        },
      },
      // No email and password anywhere. The routes are disabled as well as unconfigured.
      disabledPaths: ['/sign-up/email', '/sign-in/email'],
      // A second provider with an email that already exists is rejected. The callback redirects to
      // errorCallbackURL with ?error=unable_to_link_account (section 6.5, deviation 15.3.1).
      account: { accountLinking: { enabled: false } },
      // Revocation must be immediate: every request looks the session up (CG-9).
      session: { cookieCache: { enabled: false } },
      // Data minimization (AC-5.9.2, CG-14). The hooks are source-verified, not doc-verified;
      // the Phase 1 gate checks the rows after a real sign-in.
      databaseHooks: {
        user: {
          create: { before: async (user) => ({ data: { ...user, image: null } }) },
        },
        session: {
          create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) },
        },
        account: {
          create: {
            before: async (account) => ({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                scope: null,
              },
            }),
          },
          update: {
            before: async (account) => ({
              data: { ...account, accessToken: null, refreshToken: null, idToken: null, scope: null },
            }),
          },
        },
      },
      rateLimit: {
        enabled: env.isProduction,
        window: 60,
        max: 100,
        customRules: { '/get-session': false },
      },
      telemetry: { enabled: false },
    }),
  );
  return g.__aieAuth;
}
```

`trustedOrigins` is not set. The base URL is trusted by default, and nothing else needs to post to the auth routes. `advanced.useSecureCookies` is not set; the `Secure` flag follows `baseURL` starting with `https://`. `user.deleteUser` is not enabled; deletion goes through `deleteLearner` (6.6). `advanced.ipAddress` is not set; the catch-all route supplies a single-value `x-forwarded-for` (6.2).

`src/lib/auth.test.ts`: constructs `await getAuth()` under the Vitest placeholders, asserts `auth.options.socialProviders` has github and google and no `emailAndPassword`, calls each `databaseHooks.*.before` function with a fixture row and asserts the nulled fields (including `scope`), asserts `mapProfileToUser` returns `{ image: undefined }`, and asserts `auth.options.account.accountLinking.enabled === false`. The hooks' effect on real OAuth rows is a manual gate check (`docs/gates.md`, Phase 1): sign in with GitHub and Google against dev registrations, then read `user.image`, `session.ip_address`, `session.user_agent`, `account.access_token`, `account.refresh_token`, `account.id_token`, `account.scope` and confirm all are null.

### 6.2 src/pages/api/auth/[...all].ts (in full)

```ts
// src/pages/api/auth/[...all].ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { getAuth } from '../../../lib/auth';

export const ALL: APIRoute = async (ctx) => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  const auth = await getAuth();
  // Better Auth's rate limiter rejects a comma-separated X-Forwarded-For chain and falls back
  // to one shared bucket. clientAddress is the real client once security.allowedDomains matches
  // the route host, so hand it over as a single value.
  const headers = new Headers(ctx.request.headers);
  headers.set('x-forwarded-for', ctx.clientAddress);
  const request = new Request(ctx.request, { headers });
  return auth.handler(request);
};
```

Cookies set by Better Auth pass through unchanged. Sign-in, the OAuth callbacks, and sign-out all go through this route.

### 6.3 src/lib/auth-client.ts, src/lib/auth-cookies.ts, src/lib/guard.ts

```ts
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/client';
export const authClient = createAuthClient();
```

```ts
// src/lib/auth-cookies.ts
import type { AstroCookies } from 'astro';

/**
 * Better Auth names the session cookie better-auth.session_token and, when baseURL is https,
 * prefixes it with __Secure- (verified: src/cookies/index.ts, SECURE_COOKIE_PREFIX). A Set-Cookie
 * for a __Secure- name without the Secure attribute is dropped by browsers, so the expiring cookie
 * must carry the same attributes Better Auth set: path /, HttpOnly, SameSite=Lax, and Secure for
 * the prefixed name. Deleting a name that does not exist is harmless, so both are always cleared.
 */
export const SESSION_COOKIE_NAMES = ['better-auth.session_token', '__Secure-better-auth.session_token'] as const;

export function clearSessionCookies(cookies: Pick<AstroCookies, 'delete'>) {
  for (const name of SESSION_COOKIE_NAMES) {
    cookies.delete(name, { path: '/', httpOnly: true, sameSite: 'lax', secure: name.startsWith('__Secure-') });
  }
}
```

`src/lib/auth-cookies.test.ts`: passes a recording fake with a `delete(name, options)` method and asserts two calls, the prefixed name with `secure: true`, the plain name with `secure: false`, both with `path: '/'`, `httpOnly: true`, `sameSite: 'lax'`.

```ts
// src/lib/guard.ts
/** Matched route patterns, never raw pathnames (Astro's authentication guide). */
export const PROTECTED_ROUTE_PATTERNS: ReadonlySet<string> = new Set(['/account', '/account/plan.md', '/assessment']);

/** Only same-site relative paths are accepted as a return target. */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return '/account';
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\') || candidate.includes('://')) return '/account';
  return candidate;
}

export function signInPath(next: string): string {
  return `/sign-in?next=${encodeURIComponent(safeNextPath(next))}`;
}
```

### 6.4 src/middleware.ts (in full) and src/lib/headers.ts (S, in full)

```ts
// src/lib/headers.ts
/** Set on every on-demand response. Prerendered pages get the same headers from the Route (13.3 step 6). */
export function applySecurityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Frame-Options', 'DENY');
}

/** Responses that depend on a session must never be cached by a browser or a shared cache. */
export function applyPrivateCache(headers: Headers) {
  headers.set('Cache-Control', 'private, no-store');
  headers.append('Vary', 'Cookie');
}

/** Anonymous responses that may be cached briefly. */
export function applyPublicCache(headers: Headers, maxAgeSeconds = 300) {
  headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  headers.append('Vary', 'Cookie');
}
```

B's middleware:

```ts
// src/middleware.ts
import { defineMiddleware, sequence } from 'astro:middleware';
import { env } from './lib/env';
import { getAuth } from './lib/auth';
import { registerShutdown } from './db';
import { PROTECTED_ROUTE_PATTERNS, signInPath } from './lib/guard';
import { applySecurityHeaders, applyPrivateCache } from './lib/headers';

const HEALTH_ROUTES = new Set(['/healthz', '/readyz']);

const session = defineMiddleware(async (context, next) => {
  if (context.isPrerendered || HEALTH_ROUTES.has(context.routePattern)) return next();
  registerShutdown();
  if (!env.featureAccounts) {
    context.locals.user = null;
    context.locals.session = null;
    return next();
  }
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = result?.user ?? null;
  context.locals.session = result?.session ?? null;
  return next();
});

const guard = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  const protectedRoute = PROTECTED_ROUTE_PATTERNS.has(context.routePattern);
  if (protectedRoute && !env.featureAccounts) return new Response('Not found', { status: 404 });
  if (protectedRoute && !context.locals.user) {
    return context.redirect(signInPath(context.originPathname), 302);
  }
  const response = await next();
  applySecurityHeaders(response.headers);
  if (context.locals.user || protectedRoute) applyPrivateCache(response.headers);
  return response;
});

export const onRequest = sequence(session, guard);
```

S's Phase 0 placeholder is the same file without the `session` middleware's auth branch: it sets both locals to `null`, registers shutdown, and runs `guard` unchanged. B replaces it in Phase 1.

Actions authorize themselves through `requireUser(context)` (section 7.2). The middleware never gates RPC calls, which is what the Astro docs recommend for per-action permissions and rate limits. The catalog page sets its own public cache header for anonymous requests (section 8); every other on-demand response for a signed-in learner leaves with `Cache-Control: private, no-store` from `guard`.

`src/lib/guard.test.ts` covers `safeNextPath` (accepts `/modules/models`, rejects `//evil`, `https://x`, `\\x`, empty). The auth guard tests the matrix asks for live at `src/lib/guard.test.ts` plus e2e assertions in `e2e/landing.spec.ts`: `GET /account`, `GET /assessment`, and `GET /account/plan.md` without a cookie each redirect to `/sign-in?next=<encoded path>`, and the redirect carries `Cache-Control: private, no-store`.

### 6.5 Sign-in and sign-out

`src/pages/sign-in.astro` (on demand, not guarded):

- If `!env.featureAccounts`, return a 404 response.
- If `Astro.locals.user` exists, redirect to `safeNextPath(Astro.url.searchParams.get('next'))`.
- Reads `error` from the query and passes it to `signInMessage(code)` (`src/lib/sign-in-copy.ts`, B):

```ts
// src/lib/sign-in-copy.ts
export function signInMessage(code: string | null): string | null {
  switch (code) {
    case null:
    case '':
      return null;
    case 'unable_to_link_account':
      return 'This email already belongs to an account that uses one of these providers. Try the other one. Merging accounts is not offered.';
    case 'email_not_found':
      return 'The provider did not share an email address. Make an email address visible in your provider settings and try again.';
    case 'email_not_verified':
      return 'The provider reports this email address as unverified. Verify it with the provider and try again.';
    default:
      return 'Sign-in did not complete. Try again.';
  }
}
```

  `src/lib/sign-in-copy.test.ts` asserts each branch, including that a query of `?error=unable_to_link_account` read with `URLSearchParams.get` selects the linking copy, and that an unknown code gives the generic line.
- Renders the message, when present, in `<p class="notice notice-neutral" role="alert">`, then two primary buttons in the page header layout: "Sign in with GitHub" and "Sign in with Google", each `<button type="button" data-provider="github|google">`, plus the line "We store your provider account id, your email, and your display name. Nothing else. Read the privacy notice." linking `/privacy`.
- A bundled `<script>` imports `authClient` and on click calls `authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: '/sign-in' })`. `errorCallbackURL` carries no query: Better Auth appends `?error=<code>` itself, and a fixed `error` parameter would shadow it (fact 0.2.7). `next` comes from a `data-next` attribute on the form container, already passed through `safeNextPath` server-side. Sign-in needs JavaScript; the page says so in a `<noscript>` line.

`src/pages/sign-out.ts` (in full):

```ts
// src/pages/sign-out.ts
import type { APIRoute } from 'astro';
import { env } from '../lib/env';
import { getAuth } from '../lib/auth';

export const POST: APIRoute = async (ctx) => {
  if (!env.featureAccounts) return new Response('Not found', { status: 404 });
  const auth = await getAuth();
  const res = await auth.api.signOut({ headers: ctx.request.headers, asResponse: true });
  const headers = new Headers({ Location: '/' });
  for (const cookie of res.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
};
```

The header's sign-out control is `<form method="POST" action="/sign-out"><button class="btn btn-outline">Sign out</button></form>`. No JavaScript.

### 6.6 Account page and deletion

`src/lib/account.ts` (in full for the two writes; the read is described):

```ts
// src/lib/account.ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { user, notifySubscriber } from '../db/schema';

export async function updateDisplayName(db: Db, userId: string, name: string): Promise<{ name: string } | null> {
  const [row] = await db.update(user).set({ name: name.trim() }).where(eq(user.id, userId)).returning({ name: user.name });
  return row ?? null;
}

/** One transaction. Cascades remove session, account, and every app row. Subscriber rows go by email. */
export async function deleteLearner(db: Db, userId: string): Promise<{ deleted: boolean }> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (!u) return { deleted: false };
    await tx.delete(notifySubscriber).where(eq(notifySubscriber.email, u.email.trim().toLowerCase()));
    await tx.delete(user).where(eq(user.id, userId));
    return { deleted: true };
  });
}

export interface LearnerData {
  profile: { name: string; email: string; createdAt: Date; providers: string[] };
  progress: Array<{ moduleSlug: string; status: string; startedAt: Date | null; completedAt: Date | null }>;
  responses: Array<{ moduleSlug: string; kind: 'workshop' | 'failure'; body: string; updatedAt: Date }>;
  selfChecks: Array<{ moduleSlug: string; attempts: number; passed: boolean; updatedAt: Date }>;
  assessments: Array<{
    version: number;
    createdAt: Date;
    context: { role: string; feature: string; ownsSystem: 'yes' | 'no' | 'partly' };
    ratings: Record<string, number>;
    planText: string;
  }>;
}

export async function loadLearnerData(db: Db, userId: string): Promise<LearnerData | null> { /* six selects, ordered by moduleSlug or version */ }
```

The account page (`pages/account/index.astro`, on demand, guarded) renders, in this order, all in plain language:

1. Profile: display name (with the `updateDisplayName` form inline), email, provider names, account created date (ISO).
2. Progress: "N of M modules complete" where M is `(await getPublishedModules()).length` and N counts `completed` rows among those slugs, then one line per progress row: module title, status word, started and completed dates.
3. Responses: per module and kind, the saved text inside `<pre class="learner-text">` (escaped plain text, never rendered as Markdown), with its updated date.
4. Self-checks: per module, attempts, passed or not, updated date. A line says "The orientation self-check is not stored on the server. It stays in your browser." (deviation 15.3.3).
5. Self-assessments: per version, the date, the three context answers, every rating as "item: label" pairs, and a link to `/account/plan.md?version=<n>`; the plan text itself shows inside `<pre class="learner-text">`.
6. Deletion: one form, no wrapper: `<form method="POST" action={actions.deleteAccount}>` with `<input type="hidden" name="confirm" value="delete" />`, a paragraph with `id="delete-help"` reading "This removes your account, your progress, your responses, your self-checks, your plans, and any notify-me subscription with the same email. It cannot be undone.", and one area button "Delete my account and all my data" with `aria-describedby="delete-help"`. One click (AC-5.9.5).

Deletion sequence, end to end:

1. The `deleteAccount` action (C) checks `context.locals.user`, calls `deleteLearner(db, user.id)`, then `clearSessionCookies(context.cookies)`, and returns `{ deleted: true }`.
2. Back in the page frontmatter, `Astro.getActionResult(actions.deleteAccount)` is read. On success the page calls `clearSessionCookies(Astro.cookies)` again (the action's cookie changes and the page's share one response; calling twice is harmless) and returns `Astro.redirect('/account/deleted', 303)`. On error it renders the account page with the error above the form.
3. `/account/deleted` is prerendered and says the account and every stored row are gone, and that a notify-me subscription with the same email was removed.

The session row is gone with the cascade, so any cookie that survives is dead: the middleware's `getSession` returns null. In-flight writes fail closed because every app table's `user_id` foreign key rejects the insert (EC-5.9.3). `src/lib/account.test.ts` (PGlite) inserts a user with a session, an account, one row in each app table, and a subscriber with the same email in mixed case, calls `deleteLearner`, and asserts every count is zero, then attempts an insert for the deleted user and expects a foreign key error.

The account page states: "Signing in with the other provider using the same email is rejected. Merging accounts is not offered." (EC-5.9.1, deviation 15.3.1), and "Feedback you send from the assessment page is anonymous and is not shown here. It is not deleted with the account because it is not linked to it." (CG-15).

## 7. Actions (C, with S's stub first)

### 7.1 src/actions/index.ts stub (S writes it, C fills the handlers; in full)

```ts
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import {
  WORKSHOP_MIN_CHARS,
  WORKSHOP_MAX_CHARS,
  FEEDBACK_MAX_CHARS,
  PLAN_TEXT_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  ASSESSMENT_ITEMS_MAX,
} from '../lib/limits';
import { SELF_CHECK_MAX } from '../lib/content-schema';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const boundedRecord = <V extends z.ZodTypeAny>(keyMax: number, value: V, maxKeys: number) =>
  z
    .record(z.string().max(keyMax), value)
    .refine((r) => Object.keys(r).length <= maxKeys, { message: `at most ${maxKeys} entries` });

const notImplemented = async (): Promise<never> => {
  throw new ActionError({ code: 'NOT_IMPLEMENTED', message: 'Not implemented yet.' });
};

export const server = {
  notifySubscribe: defineAction({
    accept: 'form',
    input: z.object({ email: z.email().max(254) }),
    handler: notImplemented,
  }),
  notifyConfirm: defineAction({
    input: z.object({ token: z.string().min(1).max(2048) }),
    handler: notImplemented,
  }),
  notifyUnsubscribe: defineAction({
    input: z.object({ token: z.string().min(1).max(2048) }),
    handler: notImplemented,
  }),
  markModuleComplete: defineAction({
    accept: 'form',
    input: z.object({ moduleSlug: slug }),
    handler: notImplemented,
  }),
  saveResponse: defineAction({
    accept: 'form',
    input: z.object({
      moduleSlug: slug,
      kind: z.enum(['workshop', 'failure']),
      body: z.string().trim().min(WORKSHOP_MIN_CHARS).max(WORKSHOP_MAX_CHARS),
    }),
    handler: notImplemented,
  }),
  saveSelfCheck: defineAction({
    input: z.object({
      moduleSlug: slug,
      answers: boundedRecord(40, z.array(z.number().int().min(0).max(9)).max(6), SELF_CHECK_MAX),
    }),
    handler: notImplemented,
  }),
  saveSelfAssessment: defineAction({
    input: z.object({
      ratings: boundedRecord(60, z.number().int().min(0).max(3), ASSESSMENT_ITEMS_MAX),
      context: z.object({
        role: z.string().trim().max(120),
        feature: z.string().trim().max(200),
        ownsSystem: z.enum(['yes', 'no', 'partly']),
      }),
    }),
    handler: notImplemented,
  }),
  updatePlanText: defineAction({
    input: z.object({ version: z.number().int().min(1), planText: z.string().max(PLAN_TEXT_MAX_CHARS) }),
    handler: notImplemented,
  }),
  submitFeedback: defineAction({
    accept: 'form',
    input: z.object({ body: z.string().trim().min(1).max(FEEDBACK_MAX_CHARS) }),
    handler: notImplemented,
  }),
  updateDisplayName: defineAction({
    accept: 'form',
    input: z.object({ name: z.string().trim().min(1).max(DISPLAY_NAME_MAX_CHARS) }),
    handler: notImplemented,
  }),
  deleteAccount: defineAction({
    accept: 'form',
    input: z.object({ confirm: z.literal('delete') }),
    handler: notImplemented,
  }),
};
```

Handlers stay thin. Each one: guard, rate limit, call one library function, map its result. Logic and tests live in `src/lib/*`.

### 7.2 src/lib/actions-guard.ts (C, in full)

```ts
// src/lib/actions-guard.ts
import { ActionError, type ActionAPIContext } from 'astro:actions';
import { createRateLimiter, type RateLimitRule } from './rate-limit';

export function requireUser(context: ActionAPIContext) {
  const user = context.locals.user;
  if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to save your work.' });
  return user;
}

const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();

/** One limiter per named rule. Keys look like ip:203.0.113.7 or user:abc. */
export function enforceRateLimit(name: string, rule: RateLimitRule, key: string) {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = createRateLimiter(rule);
    limiters.set(name, limiter);
  }
  const hit = limiter.hit(key);
  if (!hit.ok) {
    const minutes = Math.max(1, Math.ceil(hit.retryAfterMs / 60_000));
    throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: `Too many requests. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
  }
}

export function clientIp(context: ActionAPIContext): string {
  return context.clientAddress || 'unknown';
}
```

### 7.3 Every action

| Name | Accept | Input | Auth | Rate limit (name: rule) | Handler steps | Errors | UI |
|---|---|---|---|---|---|---|---|
| `notifySubscribe` | form | `email` | none | `notify-ip`: 10 per IP per hour | normalize email; `subscribe(db, mailer, email, { tokenSecret, siteUrl })`; return `{ ok: true }` | `BAD_REQUEST` (invalid email), `TOO_MANY_REQUESTS` | `/notify` PRG page redirects to `/notify/thanks` on success, re-renders the form with the message on error. Success never reveals list membership. |
| `notifyConfirm` | json | `token` | none | `notify-token-ip`: 30 per IP per hour | `confirm(db, token, tokenSecret)`; return `{ ok, state: 'confirmed' \| 'invalid' }` | none thrown; invalid tokens return `state: 'invalid'` | `/notify/confirm` renders "Your address is confirmed." or the generic "This link is not valid or has expired." |
| `notifyUnsubscribe` | json | `token` | none | same rule | `unsubscribe(db, token, tokenSecret)`; return `{ ok, state: 'unsubscribed' \| 'invalid' }` | none thrown | `/notify/unsubscribe` renders "You are unsubscribed." or the generic message. |
| `markModuleComplete` | form | `moduleSlug` | user | `write-user`: 30 per user per hour | `getPublishedModule(slug)`; `NOT_FOUND` if null; `FORBIDDEN` unless `kind === 'orientation'`; `completeModule(db, user.id, slug)`; return `{ status: 'completed' }` | `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` | `/progress` PRG page redirects to `/modules#orientation` on success, to `/sign-in?next=/modules/orientation` on `UNAUTHORIZED`. |
| `saveResponse` | form | `moduleSlug`, `kind`, `body` | user | `write-user` plus `write-ip`: 60 per IP per hour | entry check (`NOT_FOUND` when unpublished; kind must have a workshop: area, foundations, elective, else `FORBIDDEN`); `saveResponse(db, user.id, slug, kind, body)`; `touchStarted`; if `kind === 'workshop'` then `evaluateCompletion`; return `{ updatedAt, status, revealed: kind === 'failure' }` | `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST` (length), `TOO_MANY_REQUESTS` | Module page redirects to `${pathname}#workshop` or `${pathname}#failure-exercise` on success (never a bare fragment, which would keep `?_action=` in the address bar); renders the message and echoes the body on error. With JS, the form submits through `actions.saveResponse(formData)` and updates its status line. |
| `saveSelfCheck` | json | `moduleSlug`, `answers` | user | `write-user` | entry check; `FORBIDDEN` for orientation and closing (nothing to persist); keep only keys that are question ids of the module (`answers = pick(answers, questionIds)`); grade with `grade(entry.data.selfCheck, answers)`; `recordSelfCheck(db, user.id, slug, answers, passedNow)` which sets `passed = prev.passed \|\| passedNow` and `attempts + 1`; `touchStarted`; `evaluateCompletion`; return `{ passed, correct, attempts, status }` | `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `TOO_MANY_REQUESTS` | Island shows "Saved" or queues offline (section 9.2). |
| `saveSelfAssessment` | json | `ratings`, `context` | user | `assess-user`: 10 per user per hour | load the closing module's `assessment` spec through `getPublishedModule(CLOSING_SLUG)` (`NOT_FOUND` when unpublished); keep only ids in `itemIds(spec)`; `missingRatings` must be empty else `BAD_REQUEST` naming the first missing id; `missingModules` from `listProgress` against published area modules; `plan = buildPlan(spec, ratings, context, missing)`; `planText = renderPlanMarkdown(plan, siteUrl)`; `saveAssessment(db, ...)` inserts version max plus 1 in a transaction; `completeModule(db, user.id, CLOSING_SLUG)`; return `{ version, plan, planText, createdAt }` | `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, `TOO_MANY_REQUESTS` | Island renders the plan, the editor, the download link, and the version list. |
| `updatePlanText` | json | `version`, `planText` | user | `write-user` | `updatePlanText(db, user.id, version, planText)`: only the learner's latest version is editable, else `CONFLICT`; return `{ updatedAt }` | `UNAUTHORIZED`, `CONFLICT`, `NOT_FOUND` | Island shows "Edits saved". |
| `submitFeedback` | form | `body` | none | `feedback-ip`: 5 per IP per hour | `insertFeedback(db, body)`; return `{ ok: true }` | `BAD_REQUEST`, `TOO_MANY_REQUESTS` | `/assessment` shows "Thank you. Your feedback is anonymous." |
| `updateDisplayName` | form | `name` | user | `write-user` | `updateDisplayName(db, user.id, name)`; return `{ name }` | `UNAUTHORIZED`, `BAD_REQUEST` | Account page re-renders with the new name. |
| `deleteAccount` | form | `confirm` | user | `delete-user`: 3 per user per hour | `deleteLearner(db, user.id)`; `clearSessionCookies(context.cookies)`; return `{ deleted: true }` | `UNAUTHORIZED` | Account page clears cookies again and redirects to `/account/deleted` (6.6). |

Every handler that touches a module runs the same entry check: `const entry = await getPublishedModule(moduleSlug); if (!entry) throw new ActionError({ code: 'NOT_FOUND' })`. `getPublishedModule` honors `PREVIEW_DRAFTS`, so saving against the fixture module works in CI and dev.

Every user-scoped handler keys the rate limiter on `user:${user.id}`, and IP-scoped ones on `ip:${clientIp(context)}`.

`src/actions/index.test.ts` calls each action with the fake-context pattern from `research/testing-ci.md` section 1.2 (the `Symbol.for('astro.actionAPIContext')` symbol, an internal that the test file names in one helper so a rename touches one line), a `locals.user` fixture inserted into PGlite through `getDb()`, and asserts the result shapes and the error codes above, including `UNAUTHORIZED` with no user, `TOO_MANY_REQUESTS` after the limit, `BAD_REQUEST` for a 199-character workshop body against a passing 200-character one, `BAD_REQUEST` for an `answers` record with thirteen keys, unknown answer keys dropped before persistence, and the stale-session case: delete the user through `deleteLearner`, then call `saveResponse` with the same `locals.user` fixture and expect an error (`INTERNAL_SERVER_ERROR` from the foreign key, or `NOT_FOUND` if the handler checks the user row first; either way no row exists afterwards). The library modules carry the detailed tests.

### 7.4 Progress rules (C, src/lib/progress.ts)

- `listProgress(db, userId): Promise<Record<string, ProgressRow>>` keyed by slug.
- `loadModuleState(db, userId, slug): Promise<LearnerModuleState>` with the four rows of `src/lib/types.ts` plus `progressBySlug` from `listProgress`.
- `touchStarted(db, userId, slug, now = new Date())`: upsert `module_progress` with `status: 'in_progress'`, `startedAt: now` when no row exists; never downgrades a completed row (CG-22). Opening a page never creates a row.
- `completeModule(db, userId, slug, now)`: upsert with `status: 'completed'`, `completedAt: now`, `startedAt` kept or set to `now`.
- `evaluateCompletion(db, userId, slug, kind, now): Promise<ModuleStatus>`: for area, foundations, elective: completed when a `workshop_response` row with `kind = 'workshop'` exists and `self_check_result.passed` is true (EC-5.5.2, both orders). Otherwise leaves the row as is and returns its status. For orientation and closing the function returns the current status without change; those complete through `markModuleComplete` and `saveSelfAssessment`.

Status for display (catalog, account, module header): `completed` when `completedAt` is set, `in_progress` when a row exists, else `not_started`.

### 7.5 Notify flow (C, with S's mailer and tokens)

`src/lib/mailer.ts` (S, in full):

```ts
// src/lib/mailer.ts
export type MessageKind = 'confirm' | 'launch';

export interface OutboundMessage {
  kind: MessageKind;
  to: string;
  subject: string;
  text: string;
  links: { confirm?: string; unsubscribe: string };
}

export interface Mailer {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

/** The only implementation until a provider is chosen. Logs one line, never throws. */
export class NoopMailer implements Mailer {
  readonly name = 'noop';
  constructor(private readonly log: (line: string) => void = (l) => console.info(l)) {}
  async send(m: OutboundMessage): Promise<void> {
    const confirm = m.links.confirm ? ` confirm=${m.links.confirm}` : '';
    this.log(`[mailer:noop] kind=${m.kind} to=${m.to}${confirm} unsubscribe=${m.links.unsubscribe}`);
  }
}

let current: Mailer | null = null;

export function getMailer(provider: 'none' = 'none'): Mailer {
  if (!current) current = provider === 'none' ? new NoopMailer() : new NoopMailer();
  return current;
}

/** Test seam. */
export function setMailerForTests(m: Mailer | null) {
  current = m;
}
```

Privacy note recorded in the runbook and the privacy notice: the noop line writes the address to the pod log. That is the Phase 0 gate's evidence (CG-28). Log retention is stated in the notice and enforced by runbook step 9 (section 13.3).

`src/lib/tokens.ts` (S, in full):

```ts
// src/lib/tokens.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TokenPurpose = 'confirm' | 'unsubscribe';
export interface TokenPayload { p: TokenPurpose; e: string; t: number }

const b64u = (buf: Buffer) => buf.toString('base64url');
const sign = (data: string, secret: string) => b64u(createHmac('sha256', secret).update(data).digest());

export function signToken(payload: TokenPayload, secret: string): string {
  const data = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; email: string; issuedAt: number }
  | { ok: false; reason: 'malformed' | 'signature' | 'purpose' | 'expired' };

export function verifyToken(token: string, secret: string, opts: { purpose: TokenPurpose; maxAgeMs?: number; now?: number }): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [data, mac] = parts;
  const expected = sign(data, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload || typeof payload.e !== 'string' || typeof payload.t !== 'number') return { ok: false, reason: 'malformed' };
  if (payload.p !== opts.purpose) return { ok: false, reason: 'purpose' };
  const now = opts.now ?? Date.now();
  if (opts.maxAgeMs !== undefined && now - payload.t > opts.maxAgeMs) return { ok: false, reason: 'expired' };
  return { ok: true, email: payload.e, issuedAt: payload.t };
}
```

`src/lib/notify.ts` (C) behavior:

- `normalizeEmail(raw)`: trim, lowercase.
- `subscribe(db, mailer, rawEmail, opts: { tokenSecret, siteUrl, now? })`: insert `{ email }` on conflict do nothing, then read the row. If `confirmedAt` is set and `unsubscribedAt` is null, return `{ ok: true }` without calling the mailer (EC-5.1.1). Otherwise mint fresh tokens with `t: now` (never reuse an earlier token), build `confirmUrl = ${siteUrl}/notify/confirm?token=${signToken({ p: 'confirm', e: email, t: now })}` and `unsubscribeUrl = ${siteUrl}/notify/unsubscribe?token=${signToken({ p: 'unsubscribe', e: email, t: now })}`, call `mailer.send({ kind: 'confirm', to: email, subject: 'Confirm your address', text, links })` inside try/catch that logs and swallows (EC-5.1.3), and return `{ ok: true }`. The result never says whether the address was new.
- `confirm(db, token, tokenSecret, now?)`: `verifyToken` with purpose `confirm` and `maxAgeMs = CONFIRM_TOKEN_MAX_AGE_MS`; on failure return `{ ok: true, state: 'invalid' }`. Read the row for the email; no row gives `invalid`. **Replay rule:** a token whose `issuedAt` is earlier than the row's `unsubscribedAt`, or earlier than `createdAt` minus `TOKEN_CLOCK_SKEW_MS`, gives `invalid`, so an old confirm link (a forwarded message, a pod log line, browser history) cannot reverse a later unsubscribe or re-subscribe an address that was deleted and re-added. Otherwise update `confirmedAt: now, unsubscribedAt: null` and return `state: 'confirmed'`. A learner who unsubscribed and wants back in submits the form again and receives a fresh token (EC-5.1.2 is satisfied by the fresh token, not by the old one; deviation 15.3.6).
- `unsubscribe(db, token, tokenSecret, now?)`: purpose `unsubscribe`, no expiry; on failure `state: 'invalid'`; else set `unsubscribedAt: now` where email matches; return `state: 'unsubscribed'` whether or not a row matched (AC-5.1.4: never reveal membership).
- The future send path (not built) selects `confirmedAt IS NOT NULL AND unsubscribedAt IS NULL`. A comment in `notify.ts` says so (NFR-6.6.2). A second comment says that once a provider exists, `/notify/confirm` should render a page with a POST button instead of confirming on GET, because mail link scanners follow GET links.

Tests (`src/lib/notify.test.ts`, PGlite, a spy mailer): subscribe stores a row with `createdAt` set and `confirmedAt` null; the mailer received one message whose confirm and unsubscribe URLs verify with the test secret; duplicate subscribe of a confirmed address calls the mailer zero times and returns the same shape; confirm, then unsubscribe, then the original confirm token gives `invalid` and `unsubscribedAt` stays set; subscribe again after unsubscribing mints a newer token that confirms and clears `unsubscribedAt`; a tampered token gives `invalid`; a confirm token older than 30 days gives `invalid`; an unsubscribe token older than 30 days still works; a rejecting mailer does not fail subscribe.

PRG pages (C):

- `src/pages/notify/index.astro` (on demand): reads `Astro.getActionResult(actions.notifySubscribe)`. No result: redirect 302 to `/#notify`. Success: redirect 303 to `/notify/thanks`. Error: render `Base` with `NotifyForm` (E) passing `error` (from `isInputError(error) ? error.fields.email?.join(' ') : error.message`). The submitted value is not available after the action consumed the body; pass no value.
- `src/pages/notify/thanks.astro` (prerendered): "Thanks. We stored your address. No mail is sent until a provider is chosen. You can remove it at any time through the link we will include in every message, or by writing to the address in the privacy notice." Must not claim a mail was sent (AC-5.1.3 overlay).
- `src/pages/notify/confirm.astro` and `unsubscribe.astro` (on demand): `const token = Astro.url.searchParams.get('token') ?? ''; const { data } = await Astro.callAction(actions.notifyConfirm, { token });` then render the state copy. A missing token renders the generic message.
- `src/pages/progress.astro` (on demand): `Astro.getActionResult(actions.markModuleComplete)`; no result: redirect to `/modules`; success: redirect 303 to `/modules#orientation`; `UNAUTHORIZED`: redirect to `signInPath('/modules/orientation')`; other errors: render the message with a link back.

### 7.6 src/lib/limits.ts (S, in full)

```ts
// src/lib/limits.ts
import type { RateLimitRule } from './rate-limit';

export const WORKSHOP_MIN_CHARS = 200; // CG-11: "a few sentences"
export const WORKSHOP_MAX_CHARS = 20_000;
export const FEEDBACK_MAX_CHARS = 4_000;
export const PLAN_TEXT_MAX_CHARS = 40_000;
export const DISPLAY_NAME_MAX_CHARS = 80;
/** Upper bound on rated items in one assessment submission. The spec has 15 today. */
export const ASSESSMENT_ITEMS_MAX = 60;

export const CONFIRM_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // CG-16
export const TOKEN_CLOCK_SKEW_MS = 60 * 1000;

export const STALE_AFTER_DAYS_DEFAULT = 90; // A-8
export const STALE_WARN_DAYS = 180;

/** astro.config.mjs security.actionBodySizeLimit. Recorded here so the two stay in sight of each other. */
export const ACTION_BODY_SIZE_LIMIT = 256 * 1024;

const HOUR = 60 * 60 * 1000;
export const RATE_RULES = {
  'notify-ip': { limit: 10, windowMs: HOUR },
  'notify-token-ip': { limit: 30, windowMs: HOUR },
  'write-user': { limit: 30, windowMs: HOUR }, // CG-25
  'write-ip': { limit: 60, windowMs: HOUR }, // CG-25
  'assess-user': { limit: 10, windowMs: HOUR },
  'feedback-ip': { limit: 5, windowMs: HOUR },
  'delete-user': { limit: 3, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;
```

### 7.7 src/lib/rate-limit.ts (S, in full)

Verified in `research/testing-ci.md` section 6.3 with fake-timer tests. Copied as the contract.

```ts
// src/lib/rate-limit.ts
export type RateLimitRule = { limit: number; windowMs: number };

/** In-memory sliding window log. One process only. Keys like ip:203.0.113.7 or user:abc. */
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

`src/lib/rate-limit.test.ts` is the two-test file from the same research section. The store resets on pod restart; one replica makes that acceptable (NFR-6.2.5 overlay).

## 8. Routes

| Path | File | Owner | Prerender | Data loaded | Layout | Notes |
|---|---|---|---|---|---|---|
| `/` | `pages/index.astro` | E | yes | `getAllModules()` including drafts | `Base` with `PageHeader` (kicker "The map", mini-map `all`) | Thesis sentences verbatim; scope statement (free, self-paced, no certificate, no build required); `AnatomyMap`; module list with "planned" on unpublished modules (name only, no link) and a link for published ones; `NotifyForm` posting to `actionFormPath('/notify', 'notifySubscribe')`; links to `/privacy` and `/modules`. No JavaScript except the theme script. |
| `/modules` | `pages/modules/index.astro` | A | no | `getAllModules()`; `listProgress` when signed in | `Base` with `PageHeader` (kicker "Modules", mini-map `all`) | Five `h2` groups in `KIND_ORDER`, anchor ids per kind (`#orientation`, `#electives`). Published entries: title link, summary, reading minutes, prerequisites as links (`refIds`), `catalogNote`, `StatusChip` when signed in, a "Draft" chip under `PREVIEW_DRAFTS`. Unpublished entries: "Planned: <names>" line per group. With a session the response is `private, no-store` from the middleware; without one the page calls `applyPublicCache(Astro.response.headers)`. |
| `/modules/orientation` | `pages/modules/orientation.astro` | A | yes | `getEntry('modules', 'orientation')`, `render`, `getEntries(prerequisites)` | `ModuleLayout` | Phase 1 onward. Sets `locals.module`. No learner state. `<SelfCheck />` renders with `persist="local"`. `<MarkComplete />` posts to `actionFormPath('/progress', 'markModuleComplete')`. Static routes win over `[slug]`, so this file shadows the dynamic route. |
| `/modules/[slug]` | `pages/modules/[slug].astro` | A | no | `getPublishedModule(slug)` (404 when null or when slug is `orientation` and the static page exists); `getEntries(prerequisites)`; `loadModuleState` when signed in; `Astro.getActionResult(actions.saveResponse)` | `ModuleLayout` | Sets `locals.module` (with `preview: entry.data.draft`), `locals.learner`, `locals.formError`. Redirects 303 to `${Astro.url.pathname}#workshop` or `#failure-exercise` after a successful save. Closing module renders the same layout with the closing sections and a link to `/assessment`. |
| `/map` | `pages/map.astro` | E | yes | none | `Base` | Full `AnatomyMap` at content width, long description expanded, the yours variant below it. Each instance has its own title and desc ids. The mini-map links here. |
| `/changelog` | `pages/changelog.astro` | A | yes | `getCollection('changelog')` newest first | `Base` | First entry is the launch. |
| `/privacy` | `pages/privacy.astro` | E | yes | none | `Base` | Sections: purpose ("to tell you when modules launch"); the notify list (email, created, confirmed, unsubscribed; stored unconfirmed; no mail until a provider is chosen; the confirm and unsubscribe links; server logs hold the address for at most 30 days); accounts (provider name, provider account id, email, display name, and the Better Auth fields kept: user id, emailVerified, createdAt, updatedAt, session expiry; provider tokens, avatar, IP address, browser details, and granted scopes are discarded); progress data; workshop and failure responses; self-check results (orientation stays in the browser); self-assessments and plans; anonymous feedback (not linked to an account, not removed by account deletion); deletion (account page, one action, immediate; notify addresses through the unsubscribe link or by writing to the contact address); the contact address (open item 15.2.11, placeholder text until provided); no trackers, no analytics. |
| `/sign-in` | `pages/sign-in.astro` | B | no | `locals.user`, `next`, `error` | `Base` with `PageHeader` (kicker "Account") | Section 6.5. 404 when `!env.featureAccounts`. |
| `/sign-out` | `pages/sign-out.ts` | B | no | none | none | POST only. 303 to `/`. |
| `/account` | `pages/account/index.astro` | B | no, guarded | `loadLearnerData`; `getPublishedModules()` for the denominator; `getActionResult` for `updateDisplayName` and `deleteAccount` | `Base` with `PageHeader` (kicker "Account") | Section 6.6. |
| `/account/deleted` | `pages/account/deleted.astro` | B | yes | none | `Base` | Confirmation copy. |
| `/account/plan.md` | `pages/account/plan.md.ts` | B | no, guarded | `getAssessment(db, userId, version)` | none | `GET ?version=n` (default latest). `version` is parsed with `z.coerce.number().int().min(1).optional()`; a parse failure returns 404. `text/markdown; charset=utf-8`, `Content-Disposition: attachment; filename="ai-engineering-plan-v<n>.md"` built from the parsed number only, `Cache-Control: private, no-store`. Body is `planText` verbatim. 404 when the version does not exist. |
| `/assessment` | `pages/assessment.astro` | D | no, guarded | closing module entry through `getPublishedModule(CLOSING_SLUG)` (404 when null); `listVersions`; latest assessment; `listProgress`; `getActionResult(actions.submitFeedback)` | `Base` with `PageHeader` (kicker "The transition · Self-assessment", area `transition`, mini-map `all`) | Hosts `SelfAssessment` with `client:load`, then the feedback form. Missing-module notice from progress. |
| `/notify` | `pages/notify/index.astro` | C | no | action result | `Base` | PRG target. |
| `/notify/thanks` | `pages/notify/thanks.astro` | C | yes | none | `Base` | Never claims a mail was sent. |
| `/notify/confirm` | `pages/notify/confirm.astro` | C | no | `Astro.callAction(actions.notifyConfirm)` | `Base` | Generic copy on invalid. |
| `/notify/unsubscribe` | `pages/notify/unsubscribe.astro` | C | no | `Astro.callAction(actions.notifyUnsubscribe)` | `Base` | Works without a session. |
| `/progress` | `pages/progress.astro` | C | no | action result | `Base` | PRG target for orientation completion. |
| `/healthz` | `pages/healthz.ts` | F | no | none | none | `200 {"ok":true}`. Excluded from the session middleware. |
| `/readyz` | `pages/readyz.ts` | F | no | `missingRequiredEnv()`; `getDb()` then `select 1` | none | `200 {"ok":true}` or `503 {"ok":false}`. Details (missing names, the database error message) go to the server log, never to the response body. |
| `/api/auth/*` | `pages/api/auth/[...all].ts` | B | no | none | none | Better Auth. 404 when `!env.featureAccounts`. |
| 404 | `pages/404.astro` | E | yes | none | `Base` | "That page does not exist." with links to `/` and `/modules`. |

Every page has one `h1`. Template sections are `h2`, subsections `h3`. `Base` renders the skip link, header, `main#main`, and footer.

## 9. Islands and forms

### 9.1 SelfCheck island (D, `src/components/islands/SelfCheck.tsx`)

Props (serializable):

```ts
export interface SelfCheckProps {
  moduleSlug: string;
  questions: SelfCheckQuestion[]; // from frontmatter, including correct and feedback
  persist: 'local' | 'account';   // orientation is always local
  initialState?: SavedSelfCheckState | null; // from the account when persist is account
  signedIn: boolean;              // false shows "Sign in to save your progress." without calling the action
  optional?: boolean;             // orientation shows "Optional. Does not count toward completion."
}

export interface SavedSelfCheckState {
  answers: Record<string, number[]>;  // best answer per question (last correct, else current)
  correctOnce: Record<string, boolean>;
  attempts: number;
  passed: boolean;
  updatedAt: string; // ISO
}
```

State: `selection: Record<qid, number[]>` (current picks), `checked: Record<qid, { correct: boolean; feedback: string[] }>`, `correctOnce`, `attempts`, `sync: 'idle' | 'saving' | 'saved' | 'queued' | 'signed-out' | 'error'`, `hydrated: boolean`. On mount: set `hydrated` (the root gets `data-hydrated="true"`, which the keyboard e2e waits for); `persist === 'local'` loads `loadLocal(slug)`; `persist === 'account'` uses `initialState` and, when the local copy is newer, the local copy; then `drainQueue`.

Rendering, per question in order: a `.self-check-question` card holding an `h3` (question text, prefixed by a visually hidden "Question N of M"), a `fieldset` with a `legend` that repeats the question text visually hidden and, for multi-correct questions, a visible line "Select all that apply." inside the legend; one row per option: `label > input[type=radio|checkbox] + span`. Single-correct questions use radios named by question id; multi-correct use checkboxes. A "Check answer" area button that is always enabled; pressing it with no selection writes "Choose an option first." to the question's status region and changes nothing else; after a check the label reads "Check again". A feedback region `div[role=status][aria-live=polite]` that always exists (empty until checked). After a check: the region's first line is "Correct." or "Not yet." in Bold, then one paragraph per selected option's feedback. The card gets `data-state="pending|correct|incorrect"` for the CSS in section 10.4. A summary region at the end: "N of M answered correctly." and, when passed, "Passed." plus the sync line ("Saving", "Saved", "Saved on this device. Will sync when online.", "Sign in to save your progress.", "This self-check stays on this device." for `persist === 'local'`, "Could not save. Retry.") with a "Retry" outline button when queued or errored. The summary is `role="status" aria-live="polite"`.

Keyboard: native controls only. Tab reaches each option and button in reading order; Arrow keys move within a radio group; Space toggles; Enter and Space activate buttons. No custom key handlers, no focus traps. Focus stays on the button after a check; the live region announces the feedback. Reduced motion: the island checks `matchMedia('(prefers-reduced-motion: reduce)')` and adds `data-motion="reduce"` so CSS cuts the fade.

Persistence: on every check, `saveLocal(slug, state)` first. Then, if `persist === 'account'` and `signedIn`, call `actions.saveSelfCheck({ moduleSlug, answers: bestAnswers })` where `bestAnswers[q] = correctOnce[q] ? lastCorrectSelection[q] : selection[q]`. Success: `sync = 'saved'`, adopt server `passed`. `error.code === 'UNAUTHORIZED'`: `sync = 'signed-out'`, no queue. Any other `ActionError` (4xx): `sync = 'error'`. Network failure (the call throws or `error` is undefined with no data): `enqueue({ moduleSlug, answers, queuedAt })`, `sync = 'queued'`. Grading is local and immediate (NFR-6.1.3); the server result never changes what the learner sees except the sync line and the passed flag. When `persist === 'account'` and `!signedIn`, the island grades locally, saves locally, shows "Sign in to save your progress.", and never calls the action.

`persist === 'local'` never calls an action (AC-5.8.6).

### 9.2 Local state and offline queue (D, `src/components/islands/self-check-storage.ts`)

```ts
export const STATE_KEY = (slug: string) => `aie:selfcheck:${slug}`;
export const QUEUE_KEY = 'aie:selfcheck:queue';
export interface QueuedSubmit { moduleSlug: string; answers: Record<string, number[]>; queuedAt: string }
export function loadLocal(slug: string): SavedSelfCheckState | null;   // try/catch, null on any failure
export function saveLocal(slug: string, state: SavedSelfCheckState): void; // try/catch, ignore failure
export function enqueue(item: QueuedSubmit): void;       // replaces an existing item for the same slug
export function readQueue(): QueuedSubmit[];
export function drainQueue(send: (item: QueuedSubmit) => Promise<'sent' | 'retry' | 'drop'>): Promise<void>;
```

`drainQueue` runs on island mount, on the `online` event, and on the Retry button. `send` returns `sent` on success (item removed), `drop` on `UNAUTHORIZED` or `NOT_FOUND` (item removed), `retry` otherwise (item kept). Tests use a fake `localStorage` and cover: load returns null on junk, enqueue replaces by slug, drain removes sent and dropped items and keeps retried ones.

### 9.3 src/lib/self-check.ts (S, in full)

```ts
// src/lib/self-check.ts
import type { SelfCheckQuestion } from './content-schema';

export type Selection = Record<string, number[]>;

export function isMultiple(q: SelfCheckQuestion): boolean {
  return q.correct.length > 1;
}

/** Set equality between the chosen indices and the correct indices. */
export function isCorrect(q: SelfCheckQuestion, selected: number[] | undefined): boolean {
  if (!selected || selected.length === 0) return false;
  const a = [...new Set(selected)].sort((x, y) => x - y);
  const b = [...q.correct].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function feedbackFor(q: SelfCheckQuestion, selected: number[]): string[] {
  return [...new Set(selected)].filter((i) => i >= 0 && i < q.feedback.length).map((i) => q.feedback[i]);
}

/** Keeps only the entries whose key is a question id. */
export function pickKnown(questions: SelfCheckQuestion[], selection: Selection): Selection {
  const ids = new Set(questions.map((q) => q.id));
  return Object.fromEntries(Object.entries(selection).filter(([k]) => ids.has(k)));
}

export interface GradeResult {
  correct: Record<string, boolean>;
  answered: number;
  correctCount: number;
  passed: boolean; // every question correct in this selection
}

export function grade(questions: SelfCheckQuestion[], selection: Selection): GradeResult {
  const correct: Record<string, boolean> = {};
  let answered = 0;
  let correctCount = 0;
  for (const q of questions) {
    const sel = selection[q.id];
    if (sel && sel.length > 0) answered += 1;
    const ok = isCorrect(q, sel);
    correct[q.id] = ok;
    if (ok) correctCount += 1;
  }
  return { correct, answered, correctCount, passed: questions.length > 0 && correctCount === questions.length };
}
```

Tests: single and multiple correct, partial multi selection is wrong, order-insensitive, empty selection, unknown question ids ignored by `grade` and dropped by `pickKnown`, passed only when every question is correct.

### 9.4 Workshop and failure response forms (D, `src/components/forms/*.astro`)

Props for both: `{ moduleSlug: string; kind: 'workshop' | 'failure'; saved: ResponseRow | null; error?: FormError; signedIn: boolean; minChars: number; maxChars: number }`. `Workshop.astro` and `FailureExercise.astro` (A) pass them from `locals.learner` and `locals.formError`.

Signed out: render a surface callout "Sign in to save your response." with a primary button linking `signInPath('/modules/<slug>')` and no form.

Signed in: `<form method="POST" action={actions.saveResponse} id="<kind>-form">` with hidden `moduleSlug` and `kind`, a `label` "Your response" plus "required" in small secondary text, a `textarea` (name `body`, `minlength`, `maxlength`, `aria-describedby` pointing at the help line "At least 200 characters. Saved to your account. Rendered as plain text." and, when present, the error line), the saved text prefilled, a line `<p class="field-help" role="status" id="<kind>-saved">Saved <ISO date></p>` from `saved.updatedAt` when present (the element exists even when empty so the script can fill it), and one area button "Save response". The failure form's button reads "Submit and reveal the explanation". On `error`, the error line is `<p class="field-error" id="<kind>-error"><b>Fix:</b> {message}</p>` and the textarea has `aria-invalid="true"` and the echoed `value`.

Enhancement `<script>` (bundled, per form): intercepts submit, calls `actions.saveResponse(new FormData(form))`, and on success updates the saved line and, for the failure form, reloads the page so the server renders the explanation (the reveal is server-side only). On `ActionError` it renders the message in the error line and sets `aria-invalid`. On network failure it submits the form natively. It also mirrors the textarea into `localStorage` under `aie:draft:<slug>:<kind>` on input and restores an unsent draft on load, clearing it on success. Everything works with JavaScript disabled.

### 9.5 src/lib/plan.ts (S, in full)

```ts
// src/lib/plan.ts
import { AREA_KEYS, AREA_TITLES, type AreaKey, type AssessmentSpec } from './content-schema';

export type Rating = 0 | 1 | 2 | 3;
export type Ratings = Record<string, number>;
export const MAX_RATING = 3;
export const FOCUS_COUNT = 3;
export const RATING_LABELS = ['Not yet', 'Aware', 'Practiced', 'Confident'] as const;
export const DEFAULT_FEATURE = 'the AI feature you are closest to';
export const DEFAULT_ROLE = 'your role';

export interface AssessmentContext {
  role: string;
  feature: string;
  ownsSystem: 'yes' | 'no' | 'partly';
}

export interface PlanStep { step: 1 | 2 | 3 | 4; title: string; text: string; href: string }
export interface PlanArea { area: AreaKey; title: string; moduleSlug: string; score: number; gapNew: number; gapTransfer: number }
/** feature is the learner's stated feature (or the default phrase), so every focus references it. */
export interface PlanFocus { area: AreaKey; title: string; moduleSlug: string; feature: string; steps: PlanStep[] }
export interface PlanLink { text: string; href: string }

export interface Plan {
  schema: 1;
  generatedAt: string;
  kind: 'ranked' | 'uniform-high';
  context: AssessmentContext;
  intro: string;
  areas: PlanArea[];        // all six, ranked
  focus: PlanFocus[];       // top areas with a gap, at most FOCUS_COUNT
  nextSteps: PlanLink[];
  missingModules: Array<{ slug: string; title: string }>;
}

export function itemIds(spec: AssessmentSpec): string[] {
  return spec.areas.flatMap((a) => [...a.transfers, ...a.competencies].map((i) => i.id));
}

/** Keeps only ratings for ids the spec declares. */
export function pickRatings(spec: AssessmentSpec, ratings: Ratings): Ratings {
  const ids = new Set(itemIds(spec));
  return Object.fromEntries(Object.entries(ratings).filter(([k]) => ids.has(k)));
}

/** Ids that have no rating in 0..3. */
export function missingRatings(spec: AssessmentSpec, ratings: Ratings): string[] {
  return itemIds(spec).filter((id) => {
    const r = ratings[id];
    return !(Number.isInteger(r) && r >= 0 && r <= MAX_RATING);
  });
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function rankAreas(spec: AssessmentSpec, ratings: Ratings): PlanArea[] {
  const areas = spec.areas.map((a) => {
    const gapNew = round3(mean(a.competencies.map((i) => MAX_RATING - ratings[i.id])));
    const gapTransfer = round3(mean(a.transfers.map((i) => MAX_RATING - ratings[i.id])));
    // "What is new" items weigh double (AC-5.10.3: lowest ratings on new items first).
    const score = round3(2 * gapNew + gapTransfer);
    return { area: a.area, title: AREA_TITLES[a.area], moduleSlug: a.moduleSlug, score, gapNew, gapTransfer };
  });
  return areas.sort(
    (x, y) => y.score - x.score || y.gapNew - x.gapNew || AREA_KEYS.indexOf(x.area) - AREA_KEYS.indexOf(y.area),
  );
}

export function isUniformHigh(spec: AssessmentSpec, ratings: Ratings): boolean {
  return itemIds(spec).every((id) => ratings[id] === MAX_RATING);
}

function featureOf(context: AssessmentContext): string {
  return context.feature.trim() || DEFAULT_FEATURE;
}

function fill(text: string, context: AssessmentContext): string {
  const role = context.role.trim() || DEFAULT_ROLE;
  return text.replaceAll('{feature}', featureOf(context)).replaceAll('{role}', role);
}

function intro(context: AssessmentContext): string {
  const feature = featureOf(context);
  switch (context.ownsSystem) {
    case 'yes':
      return `You own a model-dependent system today. Start step 1 on that system this week, beginning with ${feature}.`;
    case 'partly':
      return `You share responsibility for a model-dependent system. Start step 1 on the part you can change, beginning with ${feature}.`;
    default:
      return `You do not own a model-dependent system yet. Start step 1 on ${feature} as an observer, then build the smallest constrained version yourself.`;
  }
}

export function buildPlan(
  spec: AssessmentSpec,
  ratings: Ratings,
  context: AssessmentContext,
  missingModules: Array<{ slug: string; title: string }>,
  now: Date = new Date(),
): Plan {
  const missing = missingRatings(spec, ratings);
  if (missing.length > 0) throw new Error(`Unrated items: ${missing.join(', ')}`);
  const areas = rankAreas(spec, ratings);
  const uniformHigh = isUniformHigh(spec, ratings);
  const feature = featureOf(context);
  const focusAreas = uniformHigh ? [] : areas.filter((a) => a.score > 0).slice(0, FOCUS_COUNT);
  const focus: PlanFocus[] = focusAreas.map((a) => {
    const areaSpec = spec.areas.find((s) => s.area === a.area)!;
    const steps = [...areaSpec.steps]
      .sort((x, y) => x.step - y.step)
      .map((s) => {
        const road = spec.roadmap.find((r) => r.step === s.step)!;
        return {
          step: s.step as 1 | 2 | 3 | 4,
          title: road.title,
          text: `${road.subline} ${fill(s.text, context)}`.trim(),
          href: s.href,
        };
      });
    return { area: a.area, title: a.title, moduleSlug: a.moduleSlug, feature, steps };
  });
  const nextSteps: PlanLink[] = [
    ...missingModules.map((m) => ({ text: `Complete ${m.title}`, href: `/modules/${m.slug}` })),
    ...(uniformHigh ? spec.uniformHigh.links : []),
  ];
  return {
    schema: 1,
    generatedAt: now.toISOString(),
    kind: uniformHigh ? 'uniform-high' : 'ranked',
    context,
    intro: uniformHigh ? spec.uniformHigh.text : intro(context),
    areas,
    focus,
    nextSteps,
    missingModules,
  };
}

const ownsLabel = { yes: 'Yes', no: 'No', partly: 'Partly' } as const;

/** Plain Markdown. No em-dashes. Links are absolute so the file stands alone. */
export function renderPlanMarkdown(plan: Plan, siteUrl: string, version?: number): string {
  const base = siteUrl.replace(/\/$/, '');
  const date = plan.generatedAt.slice(0, 10);
  const lines: string[] = [];
  lines.push('# Your AI engineering plan', '');
  lines.push(`Generated ${date} from your self-assessment${version ? ` (version ${version})` : ''}.`, '');
  lines.push('## Your context', '');
  lines.push(`- Role: ${plan.context.role.trim() || 'not given'}`);
  lines.push(`- Closest AI feature: ${plan.context.feature.trim() || 'not given'}`);
  lines.push(`- Owns a model-dependent system today: ${ownsLabel[plan.context.ownsSystem]}`, '');
  lines.push(plan.intro, '');
  lines.push('## Areas ranked by gap', '');
  lines.push('| Area | Gap on what is new | Gap on what transfers | Score |', '|---|---|---|---|');
  for (const a of plan.areas) lines.push(`| ${a.title} | ${a.gapNew} | ${a.gapTransfer} | ${a.score} |`);
  lines.push('');
  if (plan.kind === 'uniform-high') {
    lines.push('## Where to go next', '');
  } else {
    plan.focus.forEach((f, i) => {
      lines.push(`## Focus ${i + 1}: ${f.title}`, '');
      lines.push(`Applied to: ${f.feature}`, '');
      for (const s of f.steps) lines.push(`${s.step}. **${s.title}** ${s.text} ([module section](${base}${s.href}))`);
      lines.push('');
    });
    if (plan.nextSteps.length > 0) lines.push('## Next steps', '');
  }
  for (const n of plan.nextSteps) {
    const href = n.href.startsWith('/') ? `${base}${n.href}` : n.href;
    lines.push(`- [${n.text}](${href})`);
  }
  if (plan.nextSteps.length > 0) lines.push('');
  lines.push(`Source: the four-step roadmap from the talk. ${base}`, '');
  return lines.join('\n');
}
```

Tests (`src/lib/plan.test.ts`, with a fixture spec of six areas): one area rated 0 on every new item and 3 elsewhere ranks first with four steps and an "Applied to" line naming the fixture feature; ties break by talk order; every rating 3 gives `kind: 'uniform-high'`, empty focus, and the uniform-high links; a missing rating throws naming the id; `{feature}` and the intro fall back to the default phrase when blank; `pickRatings` drops unknown ids; `renderPlanMarkdown` contains no U+2014, links are absolute, and the version appears when given; scores are deterministic for a fixed `now`.

### 9.6 SelfAssessment island (D, `src/components/islands/SelfAssessment.tsx`)

Props:

```ts
export interface SelfAssessmentProps {
  spec: AssessmentSpec;                     // closing module frontmatter
  latest: { version: number; ratings: Ratings; context: AssessmentContext; plan: Plan; planText: string; createdAt: string } | null;
  versions: Array<{ version: number; createdAt: string }>;
  missingModules: Array<{ slug: string; title: string }>;
}
```

Steps: 0 "Your context" (three fields: role text input, feature text input, ownsSystem radio group yes/no/partly), 1 to 6 one per area in talk order (the area's transfer items under "What transfers", then its competencies under "What is new", each a radio group with the four scale labels), 7 "Your plan". Back and Next buttons. Next with an unrated item: an inline message `<p role="alert" id="assessment-blocker">` names the first unrated item ("Rate: <item text> before continuing."), the unrated item's `fieldset` (which has `tabindex="-1"`) gets `aria-describedby="assessment-blocker"` and receives focus. A `p[role=status]` reads "Step N of 8: <title>". On step change, focus moves to the step `h2` (`tabindex="-1"`). A retake starts from the latest ratings prefilled.

Step 7: "Generate my plan" calls `actions.saveSelfAssessment({ ratings, context })`. The plan view renders `plan.intro`, the ranked table, each focus area with "Applied to: <feature>" and its four steps as an ordered list with the step title in Bold and the link "Open the module section", the next-steps list, and the missing-modules notice "Modules not yet complete: ..." (AC-5.10.7). Below it: "Edit your plan" with a `textarea` holding `planText` (the Markdown), a "Save edits" outline button (`actions.updatePlanText({ version, planText })`), a "Download as Markdown" link to `/account/plan.md?version=<n>`, and "Previous versions" listing each version with its ISO date and a download link (EC-5.10.2). Only the latest version is editable. The learner's text is shown only inside the textarea, never rendered.

Sync line as in 9.1, without the offline queue (an assessment save that fails asks the learner to retry). Rate limit errors show the server message.

### 9.7 src/pages/assessment.astro (D)

Guarded. Loads the closing module entry (`getPublishedModule(CLOSING_SLUG)`, 404 when null) and reads `entry.data.assessment`; `listVersions(db, user.id)`, `getAssessment(db, user.id)` for the latest, `listProgress(db, user.id)` against published area modules for `missingModules`. Renders the page header, an intro paragraph from the closing module (the page links back to `/modules/self-assessment` for the reading), the island, then the feedback form: `<form method="POST" action={actions.submitFeedback}>` with a `textarea` (name `body`, label "Feedback, optional and anonymous"), one outline button "Send feedback". `Astro.getActionResult(actions.submitFeedback)` renders "Thank you. Your feedback is anonymous." on success.

## 10. Design system

Source: `research/design-tokens.md`. Every hex value and every contrast rule comes from there. Nothing uses an area hex directly; components read the tokens.

### 10.1 src/styles/tokens.css (S, in full)

```css
/* src/styles/tokens.css */
:root {
  color-scheme: dark;

  /* ground and type (deck values) */
  --color-bg: #14161c;
  --color-text: #fffcf5;
  --color-text-secondary: #adaca9;
  --color-surface: #303236;
  --color-hairline: #4c4d50;

  /* area colors: fills, blocks, strips, mini-map lit boxes */
  --color-pink: #f948be;
  --color-blue: #1064f8;
  --color-green: #01b66d;
  --color-amber: #fdad00;

  /* area colors as text and strokes. Blue is large text only in this theme. */
  --color-pink-text: #f948be;
  --color-blue-text: #1064f8;
  --color-green-text: #01b66d;
  --color-amber-text: #fdad00;

  /* tints: area card fills only */
  --color-pink-tint: #2b1b2c;
  --color-blue-tint: #13223f;
  --color-green-tint: #122926;
  --color-amber-tint: #302819;

  /* text on a solid block, theme independent */
  --color-on-pink: #14161c;
  --color-on-blue: #fffcf5;
  --color-on-green: #14161c;
  --color-on-amber: #14161c;

  /* derived roles */
  --color-focus: var(--color-text);
  --color-focus-gap: var(--color-bg);
  --color-link: var(--color-text);
  --color-link-underline: var(--color-text-secondary);
  --color-field-border: var(--color-text-secondary);
  --color-code-bg: var(--color-surface);
  --color-diagram-bg: #14161c;
  --color-diagram-border: #4c4d50;

  /* neutral area defaults, overridden by [data-area] */
  --color-area: transparent;
  --color-area-text: var(--color-text-secondary);
  --color-area-tint: var(--color-surface);
  --color-on-area: var(--color-text);

  /* type */
  --font-sans: Helvetica, Arial, "Liberation Sans", sans-serif;
  --font-mono: Consolas, Menlo, ui-monospace, "Liberation Mono", "DejaVu Sans Mono", monospace;
  --weight-regular: 400;
  --weight-bold: 700;
  --size-display: 2.75rem;
  --size-strip: 3.75rem;
  --size-title: 2rem;
  --size-heading: 1.5rem;
  --size-kicker: 1.25rem;
  --size-body: 1.125rem;
  --size-compact: 1rem;
  --size-small: 0.875rem;
  --size-fine: 0.75rem;

  /* layout */
  --measure: 42rem;
  --measure-wide: 64rem;
  --gutter: 1rem;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --radius-card: 0.5rem;
  --radius-tile: 0.25rem;
  --radius-frame: 0.375rem;
  --radius-pill: 999px;
  --fade: 0.2s;
  --fade-band: 0.3s;
}

@media (min-width: 40rem) {
  :root { --gutter: 2rem; --size-display: 2.75rem; }
}
@media (min-width: 64rem) {
  :root { --gutter: 3rem; }
}
@media (max-width: 39.99rem) {
  :root { --size-display: 2rem; --size-strip: 2.5rem; --size-title: 1.75rem; }
}

/* Light theme: the deck's two base colors inverted, derived roles rebuilt with the deck's
   percentage construction, area text variants darkened in OKLCH to reach 4.6:1. */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --color-bg: #fffcf5;
    --color-text: #14161c;
    --color-text-secondary: #666668;
    --color-surface: #f1eee8;
    --color-hairline: #c7c5c1;
    --color-pink-text: #c70093;
    --color-blue-text: #025bef;
    --color-green-text: #017b48;
    --color-amber-text: #916100;
    --color-pink-tint: #fee6ee;
    --color-blue-tint: #e2eaf5;
    --color-green-tint: #e1f4e5;
    --color-amber-tint: #fff3d8;
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --color-bg: #fffcf5;
  --color-text: #14161c;
  --color-text-secondary: #666668;
  --color-surface: #f1eee8;
  --color-hairline: #c7c5c1;
  --color-pink-text: #c70093;
  --color-blue-text: #025bef;
  --color-green-text: #017b48;
  --color-amber-text: #916100;
  --color-pink-tint: #fee6ee;
  --color-blue-tint: #e2eaf5;
  --color-green-tint: #e1f4e5;
  --color-amber-tint: #fff3d8;
}

/* Area mapping. Set data-area on body. Components read --color-area* only. */
[data-area="models"] {
  --color-area: var(--color-blue);
  --color-area-text: var(--color-blue-text);
  --color-area-tint: var(--color-blue-tint);
  --color-on-area: var(--color-on-blue);
}
[data-area="context"],
[data-area="tools"],
[data-area="orchestration"] {
  --color-area: var(--color-pink);
  --color-area-text: var(--color-pink-text);
  --color-area-tint: var(--color-pink-tint);
  --color-on-area: var(--color-on-pink);
}
[data-area="evals"],
[data-area="transition"] {
  --color-area: var(--color-green);
  --color-area-text: var(--color-green-text);
  --color-area-tint: var(--color-green-tint);
  --color-on-area: var(--color-on-green);
}
[data-area="operating"] {
  --color-area: var(--color-amber);
  --color-area-text: var(--color-amber-text);
  --color-area-tint: var(--color-amber-tint);
  --color-on-area: var(--color-on-amber);
}
```

Rules every component honors:

- Dark theme: blue text (`--color-blue-text`) only at large size (the kicker at 1.25rem Bold, headings). Never blue text on the surface. Pink text inside a card only at large size.
- Light theme: the deck hex for pink, green, amber is a fill or a strip only, never text. Text and meaningful strokes use `--color-*-text`.
- The hairline is decorative. Every control boundary uses `--color-text-secondary` or the text variant.
- Diagrams and mini-maps sit on `--color-diagram-bg` in both themes.
- Table headers inside a card, a surface callout, or a notice use `--color-text`, never the area text color, because blue on the dark surface is 2.57 (NFR-6.4.5). The `th` override in `base.css` enforces it.

### 10.2 src/styles/base.css (S, in full)

```css
/* src/styles/base.css */
*, *::before, *::after { box-sizing: border-box; }
html { font-size: 100%; -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-weight: var(--weight-regular);
  font-size: var(--size-body);
  line-height: 1.6;
}
img, svg { display: block; max-width: 100%; height: auto; }
em { font-style: normal; font-weight: var(--weight-bold); }
cite, i, dfn { font-style: normal; }
b, strong { font-weight: var(--weight-bold); }

/* layout */
.container { width: 100%; max-width: var(--measure-wide); margin-inline: auto; padding-inline: var(--gutter); }
.prose { max-width: var(--measure); }
.prose > * + * { margin-block-start: 1em; }
.prose h2 { margin-block-start: var(--space-12); }
.prose h2 + h3, .prose h3 + h4 { margin-block-start: var(--space-4); }
main { padding-block: var(--space-6) var(--space-16); }

/* type roles */
h1, h2, h3, h4 { font-weight: var(--weight-bold); margin: 0; letter-spacing: 0; }
.page-title, h1 { font-size: var(--size-title); line-height: 1.2; max-width: var(--measure); }
h2 { font-size: var(--size-heading); line-height: 1.3; margin-block: var(--space-12) var(--space-3); }
h3 { font-size: var(--size-heading); line-height: 1.3; margin-block: var(--space-8) var(--space-3); }
h4 { font-size: var(--size-compact); line-height: 1.5; margin-block: var(--space-6) var(--space-2); }
.display { font-size: var(--size-display); line-height: 1.15; letter-spacing: -0.01em; font-weight: var(--weight-regular); }
p, ul, ol { margin: 0; }
li + li { margin-block-start: 0.5em; }
li > ul, li > ol { margin-block-start: 0.25em; }
.compact { font-size: var(--size-compact); line-height: 1.5; }
.small { font-size: var(--size-small); line-height: 1.5; }
.fine { font-size: var(--size-fine); line-height: 1.4; }
.secondary { color: var(--color-text-secondary); }
.mono, code, kbd, pre { font-family: var(--font-mono); }
blockquote { margin: 0; padding: 0; }
blockquote footer, figcaption, .attribution { font-size: var(--size-small); color: var(--color-text-secondary); margin-block-start: var(--space-2); }
.takeaway { font-size: var(--size-heading); line-height: 1.3; margin-block-start: var(--space-6); }
.learner-text { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--font-sans); font-size: var(--size-compact); background: var(--color-surface); border-radius: var(--radius-card); padding: var(--space-4); }

/* links: color never distinguishes a link, the underline does */
a { color: var(--color-link); text-decoration: underline; text-decoration-color: var(--color-link-underline); text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
a:hover { text-decoration-color: var(--color-text); text-decoration-thickness: 2px; }
.kicker a, .area-strip a { color: inherit; }

/* code */
code { font-size: 0.9375em; background: var(--color-code-bg); padding: 0.1em 0.35em; border-radius: var(--radius-tile); }
pre { font-size: var(--size-compact); line-height: 1.5; background: var(--color-code-bg); border: 1px solid var(--color-hairline); border-radius: var(--radius-card); padding: var(--space-4); overflow-x: auto; }
pre code { background: none; padding: 0; font-size: inherit; }
.pill-command { display: inline-block; border: 1.5px solid var(--color-blue-text); border-radius: var(--radius-pill); padding: var(--space-1) var(--space-3); font-family: var(--font-mono); font-size: var(--size-compact); }

/* tables: no rules, no fills */
.table-wrap { overflow-x: auto; max-width: var(--measure-wide); }
table { border-collapse: collapse; width: 100%; font-size: var(--size-compact); line-height: 1.5; }
th { text-align: left; font-size: var(--size-heading); font-weight: var(--weight-bold); color: var(--color-area-text); padding: var(--space-3) var(--space-4) var(--space-3) 0; }
td { vertical-align: top; padding: var(--space-3) var(--space-4) var(--space-3) 0; }
.card th, .callout-surface th, .notice th, .band th { color: var(--color-text); }
.table-ruled tr + tr td { border-top: 1px solid var(--color-hairline); }

/* focus ring: primary text color with a ground-colored gap, 12.5:1 or better everywhere */
:focus { outline: none; }
:focus-visible {
  outline: 2px solid transparent;
  box-shadow: 0 0 0 2px var(--color-focus-gap), 0 0 0 4px var(--color-focus);
  border-radius: inherit;
}
.prose a:focus-visible { outline-offset: 2px; }

/* skip link and hidden text */
.skip-link { position: absolute; left: var(--gutter); top: -3rem; padding: var(--space-2) var(--space-4); background: var(--color-text); color: var(--color-bg); border-radius: var(--radius-pill); z-index: 10; }
.skip-link:focus { top: var(--space-2); }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }

/* buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 2.75rem; padding: var(--space-2) 1.25rem; border-radius: var(--radius-pill); border: 1px solid transparent; font: inherit; font-size: var(--size-compact); font-weight: var(--weight-bold); line-height: 1.5; cursor: pointer; text-decoration: none; }
.btn:hover, .btn:focus-visible { text-decoration: underline; text-underline-offset: 0.15em; }
.btn-primary { background: var(--color-text); color: var(--color-bg); }
.btn-primary:active { background: var(--color-text-secondary); }
.btn-outline { background: none; color: var(--color-text); border-color: var(--color-text-secondary); }
.btn-outline:active { background: var(--color-surface); }
.btn-area { background: var(--color-area); color: var(--color-on-area); }
.btn[disabled], .btn[aria-disabled="true"] { background: var(--color-surface); color: var(--color-text-secondary); border-color: transparent; cursor: not-allowed; text-decoration: none; }

/* fields */
.field-label { display: block; font-size: var(--size-compact); font-weight: var(--weight-bold); margin-block-end: 0.375rem; }
.field-label .small { font-weight: var(--weight-regular); margin-inline-start: var(--space-2); }
.field { width: 100%; min-height: 2.75rem; padding: 0.625rem 0.875rem; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-field-border); border-radius: var(--radius-card); font: inherit; font-size: var(--size-compact); line-height: 1.5; }
.field::placeholder { color: var(--color-text-secondary); }
.field[aria-invalid="true"] { border: 2px solid var(--color-amber-text); }
textarea.field { min-height: 12rem; resize: vertical; }
.field-help { font-size: var(--size-small); color: var(--color-text-secondary); margin-block-start: var(--space-2); }
.field-error { font-size: var(--size-small); color: var(--color-amber-text); margin-block-start: var(--space-2); }
input[type="radio"], input[type="checkbox"] { width: 1.125rem; height: 1.125rem; accent-color: var(--color-text); margin: 0 var(--space-2) 0 0; vertical-align: middle; }
.option-row { display: flex; align-items: flex-start; gap: var(--space-2); border: 1px solid var(--color-hairline); border-radius: var(--radius-card); padding: var(--space-3) var(--space-4); font-size: var(--size-compact); line-height: 1.5; }
.option-row + .option-row { margin-block-start: var(--space-2); }
.option-row[data-selected="true"] { border: 2px solid var(--color-area-text); }
.form-row { display: grid; gap: var(--space-3); }
@media (min-width: 40rem) { .form-row-inline { grid-template-columns: 1fr auto; align-items: end; } }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
fieldset:focus-visible { border-radius: var(--radius-card); }

/* chips */
.chip { display: inline-block; padding: 0.125rem 0.625rem; border-radius: var(--radius-pill); border: 1px solid var(--color-hairline); font-size: var(--size-small); line-height: 1.5; color: var(--color-text); }
.chip-status-in-progress { border: 1.5px solid var(--color-amber-text); color: var(--color-amber-text); }
.chip-status-complete { border: 1.5px solid var(--color-green-text); color: var(--color-green-text); }
.chip-status-not-started { color: var(--color-text-secondary); }
.chip-status-draft { color: var(--color-text-secondary); border-style: dashed; }
.chip-stale { border: 1.5px solid var(--color-amber-text); color: var(--color-amber-text); }

/* cards, callouts, bands, notices */
.card { background: var(--color-surface); border-radius: var(--radius-card); padding: var(--space-4) 1.25rem; font-size: var(--size-compact); line-height: 1.5; }
.card-title { font-size: var(--size-heading); font-weight: var(--weight-bold); margin: 0; }
.card-area { background: var(--color-area-tint); border: 2px solid var(--color-area-text); }
.artifact { display: grid; gap: var(--space-3); }
.artifact-header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.artifact-meta { font-size: var(--size-small); color: var(--color-text-secondary); }
.artifact-meta code { color: var(--color-text); }
.callout { margin-block-start: var(--space-6); }
.callout-lead { font-size: var(--size-heading); font-weight: var(--weight-bold); }
.callout-surface { background: var(--color-surface); border-left: 4px solid var(--color-area-text); border-radius: var(--radius-card); padding: var(--space-4) 1.25rem; font-size: var(--size-compact); line-height: 1.5; }
.callout-label { font-weight: var(--weight-bold); display: block; }
.notice { background: var(--color-surface); border-left: 4px solid var(--color-area-text); border-radius: var(--radius-card); padding: var(--space-4) 1.25rem; font-size: var(--size-compact); line-height: 1.5; margin-block: var(--space-4); }
.notice-neutral { border-left-color: var(--color-text-secondary); }
.notice-stale { background: none; border: 0; padding: 0; font-size: var(--size-small); color: var(--color-text-secondary); margin-block: var(--space-2) 0; }
.band { display: grid; grid-template-columns: minmax(7rem, 18%) 1fr; background: var(--color-surface); border-radius: var(--radius-card); min-height: 4rem; overflow: hidden; }
.band-block { background: var(--color-area); color: var(--color-on-area); font-size: var(--size-compact); font-weight: var(--weight-bold); display: flex; align-items: center; padding-inline: var(--gutter); }
.band-body { padding: var(--space-3) var(--space-6); font-size: var(--size-compact); line-height: 1.5; max-width: var(--measure); align-self: center; }
.band-body .small { display: block; margin-block-start: var(--space-1); }
@media (max-width: 39.99rem) { .band { grid-template-columns: 1fr; } .band-block { min-height: 2.5rem; } .band-body { padding: var(--space-4); } }
.band[data-revealed="true"] { animation: fade-in var(--fade-band) ease-out; }

/* page header, kicker, area strip, mini-map */
.page-header { display: grid; grid-template-columns: 1fr auto; gap: var(--space-4); align-items: start; padding-block-start: var(--space-6); }
.kicker { font-size: var(--size-kicker); line-height: 1.25; margin: 0; color: var(--color-text-secondary); }
.kicker b { color: var(--color-area-text); }
.page-title { margin-block-start: var(--space-2); }
.divider { border: 0; border-top: 1px solid var(--color-hairline); margin-block: var(--space-3) var(--space-6); }
.area-strip { background: var(--color-area); color: var(--color-on-area); min-height: 8rem; padding-block: var(--space-6); }
@media (min-width: 40rem) { .area-strip { padding-block: var(--space-8); } }
.area-strip .container { display: grid; grid-template-columns: 1fr auto; gap: var(--space-4); align-items: center; }
.area-strip-name { font-size: var(--size-strip); line-height: 1.1; letter-spacing: -0.01em; font-weight: var(--weight-bold); margin: 0; }
.area-strip-beat { font-size: var(--size-compact); margin-block-start: var(--space-2); }
.minimap { width: 10rem; height: 5.625rem; background: var(--color-diagram-bg); border: 1px solid var(--color-diagram-border); border-radius: var(--radius-tile); overflow: hidden; }
.minimap svg { width: 100%; height: 100%; }
@media (max-width: 39.99rem) { .minimap { width: 6rem; height: 3.375rem; } }
.diagram-tile { background: var(--color-diagram-bg); border: 1px solid var(--color-diagram-border); border-radius: var(--radius-card); padding: var(--space-2); }
.diagram-scroll { overflow-x: auto; }
.diagram-scroll svg { min-width: 48rem; width: 100%; height: auto; }
.map[data-highlight="model"] g[data-layer]:not([data-layer="model"]),
.map[data-highlight="harness"] g[data-layer]:not([data-layer="harness"]),
.map[data-highlight="per-run"] g[data-layer]:not([data-layer="per-run"]),
.map[data-highlight="across-runs"] g[data-layer]:not([data-layer="across-runs"]) { opacity: 0.3; }
.map[data-highlight] g[data-layer="title"] { opacity: 1; }

/* collapsible */
.collapsible { border-top: 1px solid var(--color-hairline); padding-block: var(--space-4); }
.collapsible summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: var(--size-heading); font-weight: var(--weight-bold); }
.collapsible summary::-webkit-details-marker { display: none; }
.collapsible summary .chevron { width: 1rem; height: 1rem; color: var(--color-text-secondary); transition: transform var(--fade); }
.collapsible[open] summary .chevron { transform: rotate(90deg); }
.collapsible-body { padding-block-end: var(--space-4); }

/* screenshots, images */
.screenshot { border: 1px solid var(--color-hairline); border-radius: var(--radius-tile); }

/* site header and footer */
.site-header { border-bottom: 1px solid var(--color-hairline); }
.site-header .container { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding-block: var(--space-3); }
.site-nav { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); font-size: var(--size-compact); }
.site-footer { border-top: 1px solid var(--color-hairline); font-size: var(--size-small); color: var(--color-text-secondary); }
.site-footer .container { display: flex; flex-wrap: wrap; gap: var(--space-4); padding-block: var(--space-6); }
.theme-toggle { display: inline-flex; gap: var(--space-1); }
.theme-toggle button { min-height: 2rem; padding: var(--space-1) var(--space-3); font-weight: var(--weight-regular); }
.theme-toggle button[aria-pressed="true"] { background: var(--color-text); color: var(--color-bg); }

/* motion */
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.fade-in { animation: fade-in var(--fade) ease-out; }
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { animation: none !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

### 10.3 src/layouts/Base.astro (S, in full)

```astro
---
// src/layouts/Base.astro
import '../styles/tokens.css';
import '../styles/base.css';
import Header from '../components/site/Header.astro';
import Footer from '../components/site/Footer.astro';

export interface Props {
  title: string;
  description?: string;
  /** Sets data-area on body. 'transition' is the closing module's green. */
  area?: 'models' | 'context' | 'tools' | 'orchestration' | 'evals' | 'operating' | 'transition';
  /** Adds 'wide' to main for tables and diagrams. */
  wide?: boolean;
}

const { title, description = 'A self-paced program for software engineers moving into AI engineering.', area, wide = false } = Astro.props;
const siteName = 'Becoming an AI Engineer';
const fullTitle = title === siteName ? title : `${title} · ${siteName}`;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="color-scheme" content="dark light" />
    <script is:inline>
      (function () {
        var key = 'aie-theme';
        var root = document.documentElement;
        function apply(v) {
          if (v === 'light' || v === 'dark') root.setAttribute('data-theme', v);
          else root.removeAttribute('data-theme');
        }
        function current() {
          try { return localStorage.getItem(key) || 'system'; } catch (e) { return 'system'; }
        }
        function sync(v) {
          var buttons = document.querySelectorAll('[data-theme-choice]');
          for (var i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-theme-choice') === v));
          }
        }
        apply(current());
        window.__aieSetTheme = function (v) {
          try { if (v === 'system') localStorage.removeItem(key); else localStorage.setItem(key, v); } catch (e) {}
          apply(v);
          sync(v);
        };
        document.addEventListener('DOMContentLoaded', function () { sync(current()); });
        document.addEventListener('click', function (e) {
          var t = e.target && e.target.closest ? e.target.closest('[data-theme-choice]') : null;
          if (t) window.__aieSetTheme(t.getAttribute('data-theme-choice'));
        });
      })();
    </script>
  </head>
  <body data-area={area}>
    <a class="skip-link" href="#main">Skip to content</a>
    <Header />
    <main id="main" class:list={['container', { wide }]}>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

The inline script is the only JavaScript on the landing page (CG-6). It runs before first paint so the stored theme never flashes. With the script blocked, `prefers-color-scheme` still applies through CSS. `ThemeToggle.astro` (E) renders three buttons: `<button type="button" class="btn btn-outline" data-theme-choice="system" aria-pressed="true">System</button>`, then `light`, then `dark`, inside `<div class="theme-toggle" role="group" aria-label="Theme">`. The buttons carry no script; the head script handles clicks.

### 10.4 Component list and class names (contract)

| Component | Owner | Root class or element | Notes |
|---|---|---|---|
| Header | E | `header.site-header` with `nav.site-nav` | Links in order: "Modules" `/modules`, "Map" `/map`, then, only when `env.featureAccounts`: "Account" `/account` and the sign-out form when `Astro.locals.user`, else "Sign in" `/sign-in`; then `ThemeToggle`. Site name links `/`. Prerendered pages have no `locals.user`, so they render the "Sign in" link. |
| Footer | E | `footer.site-footer` | Links: Privacy, Changelog, the talk repository, "Built with Astro". |
| PageHeader | E | `div.page-header` then `hr.divider` | Props `{ kicker: string; area?: string (Bold word in --color-area-text); minimap?: MiniMapKey; title: string }`. Kicker renders `<p class="kicker"><b>{area}</b> · {kicker}</p>` or `<p class="kicker">{kicker}</p>`. `h1.page-title`. |
| MiniMap | E | `a.minimap` (links to `/map`) | Props `{ variant: MiniMapKey }`. Inline SVG with `<title>` set to the alt text from `research/design-tokens.md` section 7 and `role="img"`. Accessible name is the alt plus "Open the map". The mini SVGs carry no ids, so many can share a page. |
| AnatomyMap | E | `figure.diagram-tile > div.diagram-scroll > svg.map` | Props `{ variant?: 'base' \| 'yours'; highlight?: 'model' \| 'harness' \| 'per-run' \| 'across-runs'; describedBy?: boolean }`. The SVG gets `role="img"`, `data-highlight`, and `aria-labelledby` pointing at a `<title>` and a `<desc>` whose ids are unique per instance (a module-scope counter: `map-title-<n>`, `map-desc-<n>`). The title and desc text vary by variant and highlight per `research/design-tokens.md` section 7: the short alt, plus "Every box except Goal carries an amber badge reading yours; the Model badge reads yours to select." for `yours`, plus one of the four highlight sentences when `highlight` is set. Layer groups are addressed by `data-layer`, never by id (section 10.6). A `Collapsible` "Long description" follows with the section 7 long description. Under 48rem the tile scrolls horizontally. |
| Callout | E | `div.callout` (plain) or `div.callout-surface` | Props `{ kind?: 'plain' \| 'surface'; label: string }`. |
| Collapsible | E | `details.collapsible > summary` | Props `{ title: string; open?: boolean }`. Chevron is an inline SVG using `currentColor`. |
| StatusChip | E | `span.chip.chip-status-<state>` | Props `{ status: ModuleStatus \| 'draft' }`. Words: "Not started", "In progress", "Complete", "Draft". |
| Notice | E | `aside.notice[role=note]` | Props `{ label: string; neutral?: boolean; ariaLabel?: string }`. |
| NotifyForm | E | `form.notify-form#notify` | Props `{ error?: string }`. Field `input#notify-email[name=email][type=email][required][autocomplete=email]` with `label[for=notify-email]` "Email", button "Notify me", and inside the form, after the button, `<p class="field-help">We store your address to tell you when modules launch. <a href="/privacy">Privacy notice</a>.</p>`. On `error`: `<p class="field-error" id="notify-error"><b>Fix:</b> {error}</p>`, the input has `aria-invalid="true"` and `aria-describedby="notify-error"`. |
| AreaStrip | A | `div.area-strip` | Props `{ name: string; beat: string; minimap: MiniMapKey }`. |
| ModuleMeta | A | `dl.module-meta` | Reading time; prerequisites as links; "Updated <time datetime>YYYY-MM-DD</time>" and "Checked <time datetime>YYYY-MM-DD</time>" (ISO, `isoDate`); for area modules a two-column table "You already do this / It becomes this" with the rows from `TRANSFER_TABLE` for `data.transferRows`. |
| PrerequisiteNotice | A | uses `Notice` | Label "Before this module". Lists only unmet prerequisites: signed out, every prerequisite; signed in, those whose `locals.learner.progressBySlug[slug]?.status !== 'completed'`. Renders nothing when none are unmet. One link per prerequisite, name Bold in that module's area text color. Reads as a recommendation, never a block. |
| StaleNotice | A | `p.notice-stale[role=note]` | `span.chip.chip-stale` "May be stale" then "Checked on <time datetime>YYYY-MM-DD</time>. Verify before relying on it." |
| PitfallBand | A | `aside.band.band-pitfall[aria-label=Pitfall]` | `div.band-block` "Pitfall", `div.band-body` sentence plus optional small line. Rendered inside `FailureExercise` only after a failure response exists. |
| Artifact | A | `article.card.artifact` | Header row: `h3.card-title`, `span.chip.chip-origin` with `<span class="visually-hidden">Origin: </span>captured`. Body. `p.artifact-meta` with tool, version, checked-on `<time datetime>` in ISO. `StaleNotice` when stale. Archived note when `archivedOn`. Download link when `download`. |
| Takeaway, Outcomes | A | `p.takeaway`, `ol.outcomes` | Section 4.7. |
| Workshop, FailureExercise, OptionalLab, Sources, SelfCheckPlacement, MarkCompleteForm | A | `section.workshop`, `section.failure-exercise`, `section.optional-lab.card`, `ol.sources`, `div.self-check-mount`, `form.mark-complete` | Wrappers described in section 4.7. |
| WorkshopResponseForm, FailureResponseForm | D | `form#workshop-form`, `form#failure-form` | Section 9.4. |
| SelfCheck island | D | `section.self-check[data-hydrated]` | Question cards `article.self-check-question[data-state]`, options `label.option-row[data-selected]`, feedback `div.self-check-feedback[role=status]`, summary `p.self-check-summary[role=status]`. Styles in `src/styles/islands.css`: pending card plain surface; correct card `background: var(--color-green-tint); border: 2px solid var(--color-green-text)`; incorrect card amber tint and amber text border; feedback fades in `var(--fade)`. |
| SelfAssessment island | D | `section.assessment` | Steps `section.assessment-step`, rating groups `fieldset.rating-group[tabindex=-1]`, blocker `p#assessment-blocker[role=alert]`, plan `div.assessment-plan`. |

Heading hierarchy inside a module page: `h1` in the strip or page header (the module title), `h2` for template sections, `h3` for subsections and for artifact titles and self-check questions. The kicker and strip name are not headings.

### 10.5 Reduced motion and motion

Permitted motion: opacity fades of `var(--fade)` on cards, feedback, and images; `var(--fade-band)` on the revealed pitfall band; the chevron rotation. Nothing else. No transforms on hover. No theme cross-fade. Under `prefers-reduced-motion: reduce` the global rule cuts every animation and transition; islands also read the media query and set `data-motion="reduce"` so script-driven fades are skipped.

### 10.6 scripts/import-diagrams.mjs (E)

Copies `anatomy-of-an-agentic-ai-system-landscape.svg`, its `-yours` variant, and the seven `generated/mini-*.svg` files from the talk repository path given as the first argument into `src/assets/diagrams/` under the names in the tree (section 1). While copying the two full maps it rewrites `<g id="<layer>">` to `<g data-layer="<layer>">` for the twelve layer ids (`title`, `platform`, `per-run`, `one-run`, `goal`, `arrows`, `agent`, `model`, `plus`, `harness`, `stop`, `across-runs`, and `badges` in the yours variant), removes every `id="box-*"` attribute, and fails if any `id` attribute remains. It writes `src/assets/diagrams/SOURCE.md` with the source path, the talk repository commit, and the date. Two full maps on one page (`/map`) and any number of highlight instances in a module then share no ids. `e2e/a11y.spec.ts` asserts on `/map` that two `svg[role=img]` exist with distinct `aria-labelledby` targets.

## 11. Content build check and drift review (A)

### 11.1 scripts/content-check.ts

Runs with `node scripts/content-check.ts` on Node 24 (erasable TypeScript only, explicit `.ts` import extensions). Dependencies: `gray-matter`, `node:fs`, `node:path`, and `src/lib/content-schema.ts`, `src/lib/slug.ts`, `src/lib/dates.ts`.

Arguments: `--dir <root>` (default `src/content`; tests point at `test/fixtures/content`), `--today YYYY-MM-DD` (default today), `--json` (machine output), `--strict-warnings` (warnings become errors, not used by default), `--drafts-as-published` (apply every rule to drafts too; A runs it before the Phase 1 commit against the fixture module).

Process:

1. Read every `modules/*.mdx` and `artifacts/*.md` under `--dir` whose name does not start with `_`. An unreadable `--dir`: print `content-check: cannot read <dir>` and exit 2. Every module file name must be one of `MODULE_SLUGS`: `error modules/foo.mdx: unknown module slug; allowed slugs are listed in src/lib/content-schema.ts`.
2. Parse frontmatter with gray-matter. Validate modules with `moduleSchema` (or `moduleSchemaDraftsAsPublished` under the flag) and artifacts with `artifactSchema`. Each Zod issue is an error: `error modules/models.mdx: frontmatter readingMinutes: expected number, received string`.
3. Slug pairing: an area module's file name must equal `AREA_CONTENT_MAP[area].slug`; an elective's file name must be a key of `ELECTIVE_MODULES` and its title and chapter must match that entry; `orientation.mdx` has `kind: orientation`, `foundations.mdx` has `kind: foundations`, `self-assessment.mdx` has `kind: closing`. Errors name the file and the expected value. Applies to drafts too.
4. For published modules (non-draft, or all under the flag), extract headings from the body outside code fences: lines matching `^(#{1,6})\s+(.+?)\s*$`. Rules:
   - any `#` (h1) is an error: `error modules/x.mdx: h1 in body ("...") ; the layout renders the h1`.
   - the required h2 sequence for the kind (section 4.1) must appear in that order, each exactly once: `error modules/x.mdx: required sections out of order or missing; expected Transfer connection > Topics and learning outcomes > Workshop > Failure exercise > Completion evidence > Sources; found ...`.
   - forbidden h2s for the kind are errors (a `Workshop` heading in orientation is an error, deviation 15.3.2).
   - `Optional lab`, when present, must sit between `Failure exercise` and `Completion evidence`.
5. Component placement for published modules. Every capitalized JSX tag in the body (outside code fences) must be in `MDX_TAGS`: `error modules/x.mdx: unknown component <Workshp>; allowed: Artifact, Callout, ...`. Then: `<Workshop>` must occur in the Workshop section and `<FailureExercise>` with a `<Fragment slot="explanation">` in the Failure exercise section; `<SelfCheck />` in Completion evidence for `SELF_CHECK_KINDS`; `<Outcomes />` in Topics and learning outcomes for `SELF_CHECK_KINDS`; `<Takeaway />` anywhere in the body for area modules; `<Sources />` in Sources; `<MarkComplete />` only in orientation and required there. Missing or misplaced: error naming the section. The Transfer connection section of an area module must contain the phrases "stays the same" and "changes" (case-insensitive): error otherwise (AC-5.5.2).
6. Artifacts: every `<Artifact id="x" />` in a body must be listed in that module's `artifacts` and exist as `artifacts/x.md`: `error modules/x.mdx: artifact "x" is not listed in frontmatter artifacts` and `error modules/x.mdx: artifact "x" does not exist`. Listed but unused: `warn modules/x.mdx: artifact "x" is listed but not placed in the body`. `origin: captured` without `version`: `warn artifacts/x.md: captured artifact has no version`. `origin: captured` without `reviewedOn` placed in a published module: `error artifacts/x.md: captured artifact needs reviewedOn before publication`; placed only in drafts: warning. `origin: public` without `url`: error. A secret scan over `artifacts/**` and `modules/**`: any match of `(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}`, `AKIA[0-9A-Z]{16}`, `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{20,}`, or `-----BEGIN [A-Z ]*PRIVATE KEY-----` is an error naming file and line (AC-5.6.4).
7. Prerequisites: each slug exists (error), is not the module itself (error), and a non-elective never lists an elective (error: `error modules/models.mdx: elective "inference-and-hosting" cannot be a prerequisite of a core module`). A prerequisite that is a draft: warning.
8. Anchors: collect heading ids per module with `headingId()` (h2 and h3). Every `/modules/<slug>#<id>` link in any body, and every `assessment.areas[].steps[].href` in the closing module, must resolve: `error modules/self-assessment.mdx: link /modules/models#workshop-x has no heading in models`.
9. Em-dash: any U+2014 in `<dir>/**`, `docs/**`, `README.md` is an error with file and line. `docs/` and `README.md` are optional roots: when absent (the container build excludes them) they are skipped silently. Only `--dir` is mandatory.
10. Dates, relative to `--today`: module `checkedOn`, artifact `checkedOn`, and source `checkedOn` older than 180 days: `warn ...: checkedOn 2026-03-01 is 198 days old (over 180)`. A date in the future: error. `updatedOn` after `checkedOn`: warning.
11. Reading time, area kind only: words in the body excluding the Workshop, Failure exercise, and Optional lab sections and excluding code fences, divided by 220. If the estimate differs from `readingMinutes` by more than 25 percent: `warn modules/x.mdx: readingMinutes 75 but the body estimates 40 minutes at 220 words per minute`.
12. Closing module: `assessment` present (schema), every `areas[].moduleSlug` exists and has `kind: area`, competency and transfer ids unique (schema).
13. Cross-file order: the six area modules carry orders 1 to 6 with no duplicates; the electives 1 to 5 with no duplicates: error otherwise.

Output: one line per finding, `error` or `warn` prefix, sorted by file. Then `Content check: N errors, M warnings`. Exit 1 when N > 0, else 0. `--json` prints `{ errors: [...], warnings: [...] }` with `{ file, line?, message }` objects.

Tests (`scripts/content-check.test.ts`, A): run the script as a child process (`node scripts/content-check.ts --dir test/fixtures/content --today 2026-09-15`) against fixtures that contain one valid area module, one valid orientation, and invalid variants (missing section, wrong order, h1 in body, unknown tag, unknown artifact, elective as prerequisite, five questions, uncovered outcome, bad anchor, em-dash, 181-day-old date, wrong takeaway, chapter 28, captured artifact without reviewedOn, a fake key pattern, a Transfer connection without "changes"). Assert exit codes and that each message names its file. One test runs the script with a `--dir` whose parent has no `docs/` and asserts exit 0.

### 11.2 scripts/drift-review.ts

`node scripts/drift-review.ts [--days 90] [--today YYYY-MM-DD] [--json] [--fail-on-stale]`.

Lists, grouped by module slug in catalog order (kind order, then `order`), every artifact placed in the module and every source of the module whose `checkedOn` is older than `--days` (default 90), plus the module's own `checkedOn`. Artifacts shared by several modules appear under each. Output per group:

```
models (checkedOn 2026-05-01, 137 days)
  artifact models-eval-report-a  captured  claude-code 2.1.14  checkedOn 2026-05-01  137 days
  source   Anthropic model deprecations  checkedOn 2026-04-20  148 days
```

When nothing is stale: `No artifacts or sources older than 90 days.` Exit 0 always, except `--fail-on-stale` exits 3 when any item is stale, and 2 on an unreadable directory. Draft modules are included with a `(draft)` marker because their artifacts may already be authored.

The changelog page and the quarterly review use this output (AC-5.12.1, AC-5.12.2).

### 11.3 docs/content-authoring.md (A)

How to add a module: copy a skeleton, fill the frontmatter from the content map (the check rejects any other beat, chapter set, takeaway, pitfall, or transfer row for an area module), write the sections in order, place the components (`<Outcomes />` under Topics, `<Takeaway />` where the body states the takeaway, `<SelfCheck />` under Completion evidence before Sources), run `npm run content:check`, keep sentences short, no em-dashes, close every tag, no raw HTML in `.md`, quote YAML dates for sources, one artifact per file, origin labels, checked-on dates, `reviewedOn` on every captured artifact, how the anchor ids are formed, the draft rule, and `--drafts-as-published` for previewing a draft against the full rules.

## 12. Testing plan

### 12.1 Unit tests (Vitest, node environment)

| File | Owner | Covers |
|---|---|---|
| `src/lib/rate-limit.test.ts` | S | window, block, slide, sweep (fake timers) |
| `src/lib/tokens.test.ts` | S | round trip, tampered signature, wrong purpose, expiry, malformed input |
| `src/lib/mailer.test.ts` | S | noop log line contains kind, to, confirm and unsubscribe URLs |
| `src/lib/plan.test.ts` | S | section 9.5 |
| `src/lib/self-check.test.ts` | S | section 9.3 |
| `src/lib/slug.test.ts` | S | the seven template headings and punctuation cases |
| `src/lib/paths.test.ts` | S | `actionFormPath('/notify','notifySubscribe') === '/notify' + String(actions.notifySubscribe)` (imports `astro:actions`), `moduleHref`, `safeNextPath` |
| `src/lib/content-schema.test.ts` | S | section 4.1 |
| `src/db/client.test.ts` | S | section 5.3 |
| `src/lib/guard.test.ts` | B | patterns, `safeNextPath`, `signInPath` |
| `src/lib/auth.test.ts` | B | options and hooks (6.1) |
| `src/lib/auth-cookies.test.ts` | B | delete options per name (6.3) |
| `src/lib/sign-in-copy.test.ts` | B | copy per callback code (6.5) |
| `src/lib/account.test.ts` | B | PGlite: `loadLearnerData`, `updateDisplayName`, `deleteLearner` cascade and subscriber removal, fail-closed insert |
| `src/lib/notify.test.ts` | C | section 7.5 |
| `src/lib/progress.test.ts` | C | touchStarted, completeModule, evaluateCompletion in both orders, status derivation, orientation and closing untouched |
| `src/lib/responses.test.ts` | C | upsert by kind, updatedAt bump, 199 versus 200 characters |
| `src/lib/self-check-store.test.ts` | C | attempts increment, passed sticks, answers replaced |
| `src/lib/assessment.test.ts` | C | version increments in a transaction, latest editable only, `getAssessment` by version, missing modules |
| `src/lib/feedback.test.ts` | C | insert without user, length bound |
| `src/actions/index.test.ts` | C | every action through the fake context: result shapes, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, `TOO_MANY_REQUESTS`, `CONFLICT`, key-count bounds, unknown keys dropped, the stale-session case, `deleteAccount` calling `cookies.delete` for both session cookie names with the secure attribute on the prefixed one |
| `scripts/content-check.test.ts` | A | section 11.1 fixtures |
| `scripts/drift-review.test.ts` | A | stale grouping with `--today`, exit codes |

Database tests use `getDb()` (PGlite in memory, one instance per test file) or `createPgliteDb()` directly. They never read `DATABASE_URL`.

### 12.2 Component tests (Vitest, `// @vitest-environment jsdom`)

| File | Owner | Covers |
|---|---|---|
| `src/components/islands/SelfCheck.test.tsx` | D | keyboard only: Tab to the first option, Arrow to select, Tab to "Check answer", Enter; feedback in `role="status"` with `aria-live="polite"`; "Check answer" with no selection writes "Choose an option first." and leaves state unchanged; multi-correct questions show "Select all that apply." inside the legend and require the exact set; retry changes the label to "Check again"; passed summary after all correct; `persist="local"` never calls the action (mock `astro:actions`) and shows the on-device line; `persist="account"` with `signedIn: false` never calls the action and shows "Sign in to save your progress."; `persist="account"` with `signedIn: true` calls once per check, shows "Saved", shows "Saved on this device. Will sync when online." when the call rejects, and "Sign in to save your progress." on `UNAUTHORIZED`; `axe.run(container)` (from `axe-core`) reports zero violations in the pending, correct, and incorrect states |
| `src/components/islands/self-check-storage.test.ts` | D | section 9.2 |
| `src/components/islands/SelfAssessment.test.tsx` | D | step navigation with focus on the step heading, blocked Next names the unrated item in a `role="alert"` element and moves focus to the `fieldset` with `aria-describedby` set, generate calls the action with every id rated, plan renders four steps per focus area with links and the "Applied to" line, edit saves through `updatePlanText`, version list and download links; `axe.run(container)` reports zero violations on step 0, an area step with the blocker shown, and the plan step |

`test/setup.ts` (F) imports `@testing-library/jest-dom/vitest` and runs `cleanup()` after each test. Preact event names are `onInput`, not `onChange`.

### 12.3 End to end (Playwright, Chromium, against the built Node server with PGlite in memory)

The e2e build is `PREVIEW_DRAFTS=true npm run build`, so `/modules/models` (the fixture module) renders from Phase 1 onward. Signed-in flows cannot run in CI (no OAuth registrations); they are covered by the component tests above and by the Phase 1 manual gate (section 12.5). Open item 15.2.12 records the test-only session injection that would close that gap.

| Spec | Owner | Phase | Flow |
|---|---|---|---|
| `e2e/landing.spec.ts` | F | 0 | `/` has the title, both thesis sentences verbatim, the four scope statements, the module list with fourteen names, a form with an "Email" field, a "Notify me" button, and a link to `/privacy` inside the form; `/healthz` returns 200; `GET /account`, `/assessment`, and `/account/plan.md` without a cookie each redirect to `/sign-in?next=<encoded path>` with `Cache-Control: private, no-store` (this holds from Phase 0: CI builds with `FEATURE_ACCOUNTS` at its default `true`, and S's placeholder middleware already carries the guard; only the Phase 0 image, built with `false`, answers 404 instead); `/modules` without a cookie carries `Cache-Control: public, max-age=300` |
| `e2e/notify.spec.ts` | F | 0 | In a context with `javaScriptEnabled: false`: submit the landing form with a fresh address and land on `/notify/thanks`; the page text does not contain "sent"; compute a confirm token with `signToken` and `E2E_ENV.NOTIFY_TOKEN_SECRET` from `e2e/env.ts`, `GET /notify/confirm?token=...` shows "confirmed"; an unsubscribe token shows "unsubscribed"; a confirm token issued before the unsubscribe shows the generic message; a tampered token shows the generic message; submitting eleven times from the same context yields the rate-limit message on the eleventh |
| `e2e/keyboard.spec.ts` | F | 1 | From `/`: Tab reaches "Skip to content", then the header links; Enter on "Modules" lands on `/modules`; Enter on "Models" lands on `/modules/models` with `h1` "Models"; wait for `section.self-check[data-hydrated="true"]`; Tab repeatedly (bounded, at most 80 presses, because Shiki code blocks are Tab stops) until the first radio is focused; ArrowDown checks the second option; Tab to "Check answer"; Enter; the feedback region has text and `aria-live="polite"`; complete every question and see "Passed."; the summary shows "Sign in to save your progress." |
| `e2e/a11y.spec.ts` | F | 0, extended in 1 | axe with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, each under `emulateMedia({ colorScheme: 'dark' })` and `'light'`; zero violations; JSON written to `axe-reports/<page>-<theme>.json` and attached. Phase 0 pages: `/`, `/privacy`, `/map`, `/modules`, `/notify/thanks`, and a not-found path. Phase 1 adds `/sign-in`, `/modules/orientation`, `/modules/models` in three self-check states (pending, after a correct check, after an incorrect check, driven by keyboard), and the assertion that `/map` holds two `svg[role=img]` with distinct `aria-labelledby` targets. |

`e2e/env.ts` (F, in full):

```ts
// e2e/env.ts
// Runtime placeholders for the Playwright web server and the specs. Never real secrets.
// SITE_URL is a build-time value and is not set here; the e2e build uses the localhost default.
export const E2E_ENV = {
  BETTER_AUTH_URL: 'http://127.0.0.1:4321',
  EMAIL_PROVIDER: 'none',
  BETTER_AUTH_SECRET: 'e2e-placeholder-secret-not-real-0000000000',
  NOTIFY_TOKEN_SECRET: 'e2e-placeholder-token-not-real-0000000000',
  GITHUB_CLIENT_ID: 'e2e',
  GITHUB_CLIENT_SECRET: 'e2e',
  GOOGLE_CLIENT_ID: 'e2e',
  GOOGLE_CLIENT_SECRET: 'e2e',
} as const;
```

`playwright.config.ts` (F, in full):

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV } from './e2e/env';

const PORT = 4321;
const baseURL = `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: baseURL,
    timeout: 90_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...E2E_ENV,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      // No DATABASE_URL: the server uses PGlite in memory (dev dependency, installed in CI).
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

`vitest.config.ts` (F, in full):

```ts
// vitest.config.ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

// Placeholder values for the astro:env schema. Vitest's test.env never reaches astro:env/server;
// process.env set here, before getViteConfig() resolves the Astro config, does (verified 2026-09-15
// in scratchpad/probe). Assigned, not defaulted, so a developer's shell can never leak real values
// into tests. DATABASE_URL is removed so tests always use PGlite.
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
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**', 'dist/**'],
    testTimeout: 20_000,
  },
});
```

`npm run build` (with `PREVIEW_DRAFTS=true`) must run before `npm run test:e2e`. The e2e server never needs Postgres or OAuth registrations.

### 12.4 CI jobs (`.github/workflows/ci.yml`, F, in full)

Runner decision: GitHub Actions, because the repository is on GitHub and no other runner exists (CG-27). The image is built by CI and pushed to GitHub Container Registry on pushes to `main`; OpenShift pulls it. The author confirms the registry (section 15). Every action is pinned to a commit SHA with the version tag in a comment; F resolves each SHA at implementation time with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` and records the lookup date in the workflow header. The tags below are the current majors and are placeholders until the SHAs are filled in.

```yaml
name: CI
# Action SHAs resolved on <date> by F with: gh api repos/<owner>/<repo>/git/ref/tags/<tag>
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  web:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@<sha> # v6
      - uses: actions/setup-node@<sha> # v6
        with:
          node-version: 24
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: node scripts/lint.mjs
      - name: Content check
        run: npm run content:check
      - name: Type check (runs astro sync, validates content schemas)
        run: npx astro check --minimumSeverity error
      - name: Unit and component tests
        run: npm test
      - name: Build with draft preview for end-to-end tests
        run: npm run build
        env:
          PREVIEW_DRAFTS: 'true'
      - name: Install Playwright Chromium
        run: npx playwright install chromium --with-deps
      - name: End to end and accessibility
        run: npm run test:e2e
        env:
          CI: 'true'
      - uses: actions/upload-artifact@<sha> # v5
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      - uses: actions/upload-artifact@<sha> # v5
        if: ${{ !cancelled() }}
        with:
          name: axe-reports
          path: axe-reports/
          retention-days: 30

  image:
    needs: web
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@<sha> # v6
      - uses: docker/setup-buildx-action@<sha> # v3
      - uses: docker/login-action@<sha> # v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@<sha> # v6
        with:
          context: .
          push: true
          build-args: |
            SITE_URL=${{ vars.SITE_URL || 'http://localhost:4321' }}
            FEATURE_ACCOUNTS=${{ vars.FEATURE_ACCOUNTS || 'true' }}
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
```

`vars.SITE_URL` is a repository variable holding the public origin, for example `https://aie.example.org`. Until the domain is fixed it stays unset and the image builds with the localhost default, which is fine for a smoke deploy and wrong for production (section 15). `vars.FEATURE_ACCOUNTS` is set to `false` for the Phase 0 image and removed afterwards. The CI build never sets `PREVIEW_DRAFTS` for the image.

### 12.5 Manual gates (`docs/gates.md`, F)

Phase 0: privacy notice reviewed; the deployed image was built with `SITE_URL` equal to the Route origin and `FEATURE_ACCOUNTS=false`; `curl -I https://<host>/sign-in` is 404; subscribe on the deployed site; read the confirm and unsubscribe URLs from `oc logs`; open both; see the row change (CG-28); `oc exec deploy/aie -- npm run db:tls-check` prints `tls-check: ok`; `/readyz` is `{"ok":true}`.

Phase 1: architecture and auth review; keyboard and VoiceOver pass on `/modules/orientation` (self-check), `/modules/models` in `astro dev` with `PREVIEW_DRAFTS=true` while signed in (prerequisite notice, workshop form, failure reveal, self-check with persistence), `/account` (data view, display name, deletion), and `/assessment` (every step, the blocker, the plan editor); the data-minimization row check from 6.1 after one GitHub and one Google sign-in; a GitHub account whose primary email is private signs in and `user.email` is set; the deletion response carries expiring `Set-Cookie` headers for both session cookie names with `Secure` on the prefixed one (check the response headers on the deployed site); the Phase 1 gate re-runs against the built image on RDS, not only against PGlite; the checklist PD-9.2.1 to PD-9.2.9 closed. Each gate names who did it and the date.

## 13. Delivery (F)

### 13.1 Dockerfile (in full)

```dockerfile
# syntax=docker/dockerfile:1
# Build: docker build --build-arg SITE_URL=https://<public-host> --build-arg FEATURE_ACCOUNTS=true -t aie .
# SITE_URL, FEATURE_ACCOUNTS, and PREVIEW_DRAFTS are baked in at build time (astro:env public
# server variables). PREVIEW_DRAFTS is never set here. Everything else is read at runtime from
# the container environment (astro:env secrets) and comes from the OpenShift Secret or the ENV below.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG SITE_URL=http://localhost:4321
ARG FEATURE_ACCOUNTS=true
ENV SITE_URL=$SITE_URL \
    FEATURE_ACCOUNTS=$FEATURE_ACCOUNTS
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
# Runtime environment. PG_CA_FILE is read at runtime by src/lib/env.ts (a secret-class variable).
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    PG_CA_FILE=/app/certs/rds-global-bundle.pem \
    BETTER_AUTH_TELEMETRY=0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY scripts/migrate.mjs scripts/tls-check.mjs ./scripts/
COPY certs/rds-global-bundle.pem ./certs/rds-global-bundle.pem
# Nothing writes under /app at runtime. Files stay world-readable (npm ci defaults), so an
# arbitrary OpenShift UID can read them; no group-write grant is needed or given.
USER 1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
```

Notes (amended 2026-10-03, `docs/decisions.md`): the runtime stage installs with `--omit=dev --omit=optional --ignore-scripts`. `--omit=dev` alone kept `@electric-sql/pglite`, `drizzle-kit`, and `vitest`, because they are optional peers of `drizzle-orm` and `better-auth` and the lockfile marks them `devOptional`. With optional packages omitted the image has no PGlite, and `getDb()` refuses the embedded database in production unless `PGLITE_DATA_DIR` is set on purpose, so a missing `DATABASE_URL` fails at the first request and `/readyz` reports it. `SITE_URL` at build time sets `security.allowedDomains` and `env.siteUrl`; the Secret does not carry `SITE_URL`. `BETTER_AUTH_URL` is a runtime value from the Secret. Nothing writes to the filesystem at runtime (`session: false`), so the Deployment runs with a read-only root filesystem.

`.dockerignore`:

```
.git
node_modules
dist
.astro
.env
.env.*
.pglite-dev
test-results
playwright-report
axe-reports
labs
docs
e2e
test
.github
```

`labs`, `e2e`, `test`, and `docs` are not needed to build. The content check skips `docs/` and `README.md` when absent (section 11.1 step 9). Markdown files are not excluded as a class: `src/content/artifacts/*.md` and `src/content/changelog/*.md` are content.

### 13.2 .env.example (in full)

```
# Copy to .env for local development. Never commit .env.
#
# BUILD-TIME VALUES (astro:env public). Inlined into dist/server by `astro build`.
# Setting them in the running container has no effect; the Dockerfile takes them as build args.
# Public origin of the site. Drives security.allowedDomains and absolute links.
SITE_URL=http://localhost:4321
# Show sign-in and account routes. The Phase 0 image is built with false.
FEATURE_ACCOUNTS=true
# Render draft modules. Local dev and the CI e2e build only. Never in an image.
PREVIEW_DRAFTS=true

# RUNTIME VALUES (astro:env secret). Read from the environment when the server starts.
# Better Auth base URL. Defaults to SITE_URL when unset. Must be the public origin in production.
BETTER_AUTH_URL=http://localhost:4321
# Only 'none' exists. Sets the no-op mailer.
EMAIL_PROVIDER=none

# Postgres. Leave unset for the embedded PGlite database in dev.
# No ssl parameters in the URL. TLS is configured through PG_CA_FILE.
DATABASE_URL=
# Path to the RDS CA bundle. Required whenever DATABASE_URL is set in production.
# The image sets /app/certs/rds-global-bundle.pem.
PG_CA_FILE=
# Persistent local PGlite directory. Unset means in-memory (lost on restart).
PGLITE_DATA_DIR=./.pglite-dev

# Secrets. Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=
NOTIFY_TOKEN_SECRET=
# OAuth apps. Callback URLs: <SITE_URL>/api/auth/callback/github and /google
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Runtime only, set by the container. Not read by Astro.
# HOST=0.0.0.0
# PORT=8080
# BETTER_AUTH_TELEMETRY=0
```

### 13.3 docs/deploy-openshift.md, runbook outline

1. **Prerequisites.** `oc` CLI logged in, a project, an RDS PostgreSQL instance (class `db.t4g.micro`, single AZ, 20 GB gp3, automated backups on) reachable from the cluster (security group allows the cluster egress), `rds.force_ssl = 1` in the parameter group, the database user with `CREATE` on the database (the migrator creates the `drizzle` schema), the two OAuth registrations with callback URLs `https://<host>/api/auth/callback/github` and `/google`, the final hostname. Docker, `psql`, and `oc` are absent on the dev machine, so every step here runs from a machine with `oc`, and the image is never built locally.
2. **Project and secrets.** `oc new-project aie`. `oc create secret generic aie-env --from-env-file=.env.prod` where `.env.prod` holds only runtime values: `BETTER_AUTH_URL=https://<host>`, `EMAIL_PROVIDER=none`, `DATABASE_URL` (no ssl params), `BETTER_AUTH_SECRET`, `NOTIFY_TOKEN_SECRET`, the four OAuth values. Do not put `SITE_URL`, `FEATURE_ACCOUNTS`, or `PREVIEW_DRAFTS` in the Secret; they are build arguments and a runtime value is ignored. `PG_CA_FILE`, `HOST`, `PORT`, `BETTER_AUTH_TELEMETRY` come from the image.
3. **Image.** Path A (default): CI pushes `ghcr.io/<owner>/becoming-an-aie:<sha>`, built with `SITE_URL=https://<host>` from the repository variable and `FEATURE_ACCOUNTS` from the repository variable (`false` for Phase 0, unset afterwards). Create a pull secret if the package is private (`oc create secret docker-registry ghcr --docker-server=ghcr.io ...` and link it to `default`). Path B: `oc new-build --strategy=docker --binary --name=aie` then `oc start-build aie --from-dir=. --follow` with `--build-arg SITE_URL=https://<host> --build-arg FEATURE_ACCOUNTS=...`; the ImageStream tag is the image reference.
4. **Migrations, before every rollout.** `oc run aie-migrate-<sha> --image=<image> --restart=Never --env-from=secret/aie-env --command -- npm run db:migrate`, then `oc logs -f pod/aie-migrate-<sha>` and expect `migrations applied`. Fallback after a rollout: `oc exec deploy/aie -- npm run db:migrate`. Delete the pod afterwards. The migrate script refuses a plaintext connection in production, so a missing `PG_CA_FILE` fails here first.
5. **Deployment.** `replicas: 1`, `strategy: Recreate` (one process, in-memory limiter; no two pods at once), container port 8080, `envFrom: secretRef aie-env`, resources requests `cpu: 250m, memory: 512Mi`, limits `memory: 1Gi`, `readinessProbe` GET `/readyz` (initialDelay 10s, period 10s), `livenessProbe` GET `/healthz` (period 30s), container `securityContext: { readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, capabilities: { drop: [ALL] }, runAsNonRoot: true }` (restricted-v2 SCC supplies the last three; state them anyway), an `emptyDir` volume mounted at `/tmp`.
6. **Service and Route.** Service port 8080. Route: `host: <final-domain>`, `tls: { termination: edge, insecureEdgeTerminationPolicy: Redirect }`, annotations `haproxy.router.openshift.io/set-forwarded-headers: replace` (stops clients spoofing `X-Forwarded-For`, which is the rate-limit key) and `haproxy.router.openshift.io/hsts_header: max-age=31536000;includeSubDomains`. Response headers for every path, including prerendered pages that never pass through the middleware (OpenShift 4.14 or later):

```yaml
spec:
  httpHeaders:
    actions:
      response:
        - name: X-Content-Type-Options
          action: { type: Set, set: { value: nosniff } }
        - name: X-Frame-Options
          action: { type: Set, set: { value: DENY } }
        - name: Referrer-Policy
          action: { type: Set, set: { value: strict-origin-when-cross-origin } }
        - name: Permissions-Policy
          action: { type: Set, set: { value: "camera=(), microphone=(), geolocation=()" } }
```

   No other proxy in front of the router; if one appears later, revisit `set-forwarded-headers`. A Content-Security-Policy is deferred (section 15.1).
7. **Verify.** `curl -I https://<host>/` is 200 with the four headers above and `Strict-Transport-Security`; `curl https://<host>/readyz` is `{"ok":true}`; `oc exec deploy/aie -- npm run db:tls-check` prints `tls-check: ok (TLSv1.3)` or `TLSv1.2`; sign in with each provider (Phase 1 onward); run the Phase 0 gate (subscribe, `oc logs deploy/aie | grep mailer:noop`, open the two URLs); check response headers for `Secure; HttpOnly; SameSite=Lax` on the session cookie; `curl -I https://<host>/account` redirects with `Cache-Control: private, no-store`.
8. **Rollback.** `oc rollout undo deploy/aie`. Migrations are additive, so the previous image runs against the newer schema.
9. **Logs and privacy.** The noop mailer writes subscriber addresses to stdout. Configure or confirm log retention at or under 30 days for this namespace (the privacy notice states "at most 30 days"; if the cluster's logging stack keeps logs longer, either shorten it for this project or change the notice and record the number here before the Phase 0 gate). No analytics.
10. **Annual upgrade.** Astro ships one major per year. Pin exact versions, upgrade once a year in a dedicated commit, run the full CI, redeploy.
11. **Deferred work.** Email provider (confirmed opt-in, launch notification, retry queue, the POST confirm page), analytics decision, Content-Security-Policy, second replica (needs a shared rate limiter and a migration lock).
12. **Build args.** `SITE_URL` must equal the Route host origin or every action POST fails the origin check behind edge TLS and rate limiting keys on the router address. `FEATURE_ACCOUNTS=false` only for the Phase 0 image. A value in the Secret does not change either.

### 13.4 Health endpoints (F, in full)

```ts
// src/pages/healthz.ts
import type { APIRoute } from 'astro';
export const GET: APIRoute = () => Response.json({ ok: true });
```

```ts
// src/pages/readyz.ts
import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { missingRequiredEnv } from '../lib/env';

/** Returns only ok true or false. Details go to the server log; the endpoint is reachable through the public Route. */
export const GET: APIRoute = async () => {
  const missing = missingRequiredEnv();
  if (missing.length > 0) {
    console.error('[readyz] missing environment variables:', missing.join(', '));
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const { db } = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[readyz] database check failed:', err instanceof Error ? err.message : err);
    return Response.json({ ok: false }, { status: 503 });
  }
};
```

### 13.5 certs/rds-global-bundle.pem

Downloaded once from `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`, committed, with the download date and the SHA-256 in the runbook. The bundle holds only root CAs, which is what AWS says to register. Refresh it when AWS rotates CAs; the runbook has a yearly reminder.

## 14. Contracts table

Every cross-workstream interface. Owner writes it; the others import it by this exact name and shape.

### 14.1 Functions and modules

| Contract | Owner | Signature | Consumers |
|---|---|---|---|
| `getDb()` | S | `(): Promise<DbHandle>` from `src/db/index.ts`; `DbHandle = { db: Db; driver; migrate(); close() }` | B, C, D, F |
| `Db` | S | `PgDatabase<PgQueryResultHKT, typeof schema>` from `src/db/client.ts` | B, C |
| `createPgliteDb(dataDir?, migrationsFolder?)`, `createPgDb(url, opts)`, `PlaintextRefusedError` | S | section 5.3 | tests in B, C; F (readyz) |
| schema tables | S | `user, session, account, verification, moduleProgress, workshopResponse, selfCheckResult, selfAssessment, notifySubscriber, feedback, moduleStatus, responseKind` from `src/db/schema.ts` | B, C |
| `env`, `requireEnv`, `missingRequiredEnv` | S | section 3.4 | A, B, C, E, F |
| `applySecurityHeaders(headers)`, `applyPrivateCache(headers)`, `applyPublicCache(headers, maxAge?)` | S | `src/lib/headers.ts` | A (catalog), B (middleware, plan.md) |
| `isPublished(entry)`, `compareModules(a, b)`, `getAllModules()`, `getPublishedModules()`, `getPublishedModule(slug)`, `ModuleEntry` | S | `src/lib/modules.ts` | A, B, C, D, E |
| `moduleFields, moduleSchema, moduleSchemaDraftsAsPublished, makeModuleRules, moduleRules, artifactSchema, changelogSchema, sourceSchema, selfCheckQuestionSchema, assessmentSpecSchema` | S | section 4.1 | A, C, D |
| Constants `AREA_KEYS, AREA_TITLES, AREA_CONTENT_MAP, ELECTIVE_MODULES, FORBIDDEN_CHAPTERS, ORIENTATION_MAP, FOUNDATIONS_MAP, CLOSING_SLUG, MODULE_SLUGS, TRANSFER_KEYS, TRANSFER_TABLE, MODULE_KINDS, KIND_ORDER, KIND_GROUP_TITLES, REQUIRED_SECTIONS, OPTIONAL_LAB_SECTION, FORBIDDEN_SECTIONS, MDX_TAGS, SELF_CHECK_KINDS, SELF_CHECK_MIN, SELF_CHECK_MAX, ORIENTATION_SELF_CHECK_MIN, ARTIFACT_ORIGINS` | S | section 4.1 | A, C, D, E |
| Types `ModuleContext, PrerequisiteSummary, LearnerModuleState, EMPTY_LEARNER_STATE, ProgressRow, ResponseRow, SelfCheckRow, FormError, MiniMapKey, ModuleStatus, EntryRef` and `refIds(refs)` | S | `src/lib/types.ts` | A, B, C, D, E |
| `createRateLimiter(rule, now?)` | S | section 7.7 | C |
| `RATE_RULES, WORKSHOP_MIN_CHARS, WORKSHOP_MAX_CHARS, FEEDBACK_MAX_CHARS, PLAN_TEXT_MAX_CHARS, DISPLAY_NAME_MAX_CHARS, ASSESSMENT_ITEMS_MAX, CONFIRM_TOKEN_MAX_AGE_MS, TOKEN_CLOCK_SKEW_MS, STALE_AFTER_DAYS_DEFAULT, STALE_WARN_DAYS, ACTION_BODY_SIZE_LIMIT` | S | `src/lib/limits.ts` | A, C, D |
| `signToken(payload, secret)`, `verifyToken(token, secret, opts)` | S | section 7.5 | C, F (e2e) |
| `Mailer, OutboundMessage, NoopMailer, getMailer(provider), setMailerForTests(m)` | S | section 7.5 | C |
| `buildPlan, renderPlanMarkdown, missingRatings, pickRatings, rankAreas, isUniformHigh, itemIds, RATING_LABELS, DEFAULT_FEATURE, Plan, PlanFocus, PlanStep, AssessmentContext, Ratings` | S | section 9.5 | C, D, B (types) |
| `grade, isCorrect, isMultiple, feedbackFor, pickKnown, Selection, GradeResult` | S | section 9.3 | C, D |
| `headingId(text)` | S | `src/lib/slug.ts` | A |
| `isoDate(d)`, `daysBetween(a, b)`, `isStale(checkedOn, thresholdDays, now?)` | S | `src/lib/dates.ts`; `isoDate` gives `2026-09-15` | A, B, D, E |
| `actionFormPath(route, actionName)`, `moduleHref(slug, headingId?)`, `safeNextPath(candidate)` (re-export from guard once B lands; S ships its own copy first) | S | `src/lib/paths.ts` | A, B, C, E |
| `getAuth()` | B | `(): Promise<Auth>` from `src/lib/auth.ts` | B only (middleware, the auth route, sign-out). Actions read `context.locals.user`; `/readyz` does not touch auth. |
| `authClient` | B | `createAuthClient()` | B only |
| `SESSION_COOKIE_NAMES`, `clearSessionCookies(cookies)` | B | section 6.3 | C (`deleteAccount`) |
| `signInMessage(code)` | B | section 6.5 | B |
| `PROTECTED_ROUTE_PATTERNS`, `safeNextPath`, `signInPath(next)` | B | section 6.3 | A (sign-in prompts), C (`/progress`), D (forms) |
| `loadLearnerData(db, userId)`, `updateDisplayName(db, userId, name)`, `deleteLearner(db, userId)` | B | section 6.6 | C (actions) |
| `requireUser(context)`, `enforceRateLimit(name, rule, key)`, `clientIp(context)` | C | section 7.2 | C |
| `subscribe, confirm, unsubscribe, normalizeEmail` | C | section 7.5 | C |
| `listProgress(db, userId)`, `loadModuleState(db, userId, slug)`, `touchStarted`, `completeModule`, `evaluateCompletion` | C | section 7.4 | A (catalog, module page), B (account counts), D (assessment page) |
| `saveResponse(db, userId, slug, kind, body)` | C | returns `{ updatedAt: Date }` | C |
| `recordSelfCheck(db, userId, slug, answers, passedNow)` | C | returns `{ attempts, passed }` | C |
| `saveAssessment(db, userId, { ratings, context, plan, planText })`, `updatePlanText(db, userId, version, text)`, `listVersions(db, userId)`, `getAssessment(db, userId, version?)` | C | `getAssessment` returns the row or null | B (plan.md), D (assessment page) |
| `insertFeedback(db, body)` | C | | C |
| `server` (actions) | C | section 7.3 names and inputs | A, B, D, E through `astro:actions` |
| `mdxComponents` | A | `src/components/module/mdx-components.ts`, the map in 4.7 | A |
| `SelfCheck` island props | D | section 9.1 | A (`SelfCheckPlacement`) |
| `SelfAssessment` island props | D | section 9.6 | D |
| `WorkshopResponseForm`, `FailureResponseForm` props | D | section 9.4 | A |
| `Base` props | S | section 10.3 | all |
| `PageHeader, MiniMap, AnatomyMap, Callout, Collapsible, StatusChip, Notice, NotifyForm, Header, Footer, ThemeToggle` props | E | section 10.4 | A, B, C, D |
| `AreaStrip, ModuleMeta, Artifact, Workshop, FailureExercise, OptionalLab, Takeaway, Outcomes, Sources, SelfCheckPlacement, MarkCompleteForm, PrerequisiteNotice, StaleNotice, PitfallBand, ModuleLayout` | A | sections 4.7 and 10.4; `ModuleLayout` props `{ entry: ModuleEntry }` and a default slot for `Content` | A |
| `E2E_ENV` | F | `e2e/env.ts` | F |
| Health endpoints | F | section 13.4 | ops |

### 14.2 Locals

`App.Locals` (section 3.3): `user`, `session` set by B's middleware (S's placeholder in Phase 0) on every on-demand request; `module`, `learner`, `formError` set by A's module pages before `<Content />` renders. `module.data` holds collection references for `prerequisites` and `artifacts` (objects with `collection` and `id`), never plain strings; use `refIds` to get slugs. Scripts that parse frontmatter with gray-matter see plain strings. Components never write locals.

### 14.3 Action names and the no-JS form targets

Landing form: `action="/notify?_action=notifySubscribe"` produced by `actionFormPath('/notify', 'notifySubscribe')`. Orientation completion: `actionFormPath('/progress', 'markModuleComplete')`. On-demand pages use `action={actions.<name>}` directly. Redirects after a form action on a module page target `${Astro.url.pathname}#<section>` so the `?_action=` query does not survive in the address bar. `paths.test.ts` guards the query parameter name against Astro changes.

### 14.4 CSS class names

Section 10.2 and 10.4 are the list. Islands add only classes prefixed `self-check-` and `assessment-`, defined in `src/styles/islands.css`.

### 14.5 Accessible names used by tests

"Skip to content", "Modules", "Map", "Sign in", "Account", "Sign out", "Notify me", "Email", "Check answer", "Check again", "Generate my plan", "Save edits", "Download as Markdown", "Save response", "Submit and reveal the explanation", "Delete my account and all my data", "Send feedback", "Sign in with GitHub", "Sign in with Google", "Mark orientation complete", "Retry", theme buttons "System", "Light", "Dark". Status strings: "Choose an option first.", "Select all that apply.", "Sign in to save your progress.", "This self-check stays on this device.", "Passed."

### 14.6 localStorage keys

`aie-theme`, `aie:selfcheck:<slug>`, `aie:selfcheck:queue`, `aie:draft:<slug>:<kind>`. All reads and writes are wrapped in try/catch.

### 14.7 Build flags

`SITE_URL`, `FEATURE_ACCOUNTS`, `PREVIEW_DRAFTS` (section 3.1). Read only through `env.siteUrl`, `env.featureAccounts`, `env.previewDrafts`. Pages that exist only with accounts (`/sign-in`, `/sign-out`, `/account/*`, `/api/auth/*`) return 404 when `featureAccounts` is false; the middleware does the same for the protected patterns; the header hides the sign-in link.

## 15. Decisions made here, and what is still open

### 15.1 Decisions

1. **Two env models, stated once.** Public server variables (`SITE_URL`, `FEATURE_ACCOUNTS`, `PREVIEW_DRAFTS`) are build-time constants and Docker build arguments. Everything that must vary per environment at runtime is declared `access: 'secret'` even when it is not sensitive (`BETTER_AUTH_URL`, `EMAIL_PROVIDER`, `PG_CA_FILE`, `PGLITE_DATA_DIR`). Reason: fact 0.2.1. Consequence: the Secret never carries a public variable, and `createPgDb` refuses a plaintext connection in production.
2. **Secrets are optional in the astro:env schema and enforced in `src/lib/env.ts`.** Reason: `astro:env/server` throws at import when a required secret is missing, and the middleware and prerendered pages import during `astro build`. Builds and content checks now need no secrets. `/readyz` reports missing ones in the log only.
3. **Lazy `getDb()` and `getAuth()` instead of module-level instances.** Same reason. Nothing connects until the first on-demand request.
4. **Phase commits are cut as in section 1.3.** Phase 0 ships the scaffold, the public pages, the notify flow, delivery, and the content skeletons, with B and D as permitted placeholders hidden behind `FEATURE_ACCOUNTS=false`. Reason: the landing page is live on 2026-09-17 and one commit per phase.
5. **`PREVIEW_DRAFTS` renders drafts in dev and the CI e2e build, never in an image.** The Phase 1 fixture area module (`models.mdx`, still a draft) is how the module layout, forms, island, and prerequisite notice get verified before Phase 2 content exists. Reason: drafts must return 404 in production (EC-5.2.2) and Phase 1 must still exercise an area module.
6. **The content map lives in code.** `AREA_CONTENT_MAP`, `ELECTIVE_MODULES`, `ORIENTATION_MAP`, `FOUNDATIONS_MAP`, `TRANSFER_TABLE`, and `FORBIDDEN_CHAPTERS` are enforced by `moduleRules` and the content check, so an area module cannot drift from spec 5.5. The CG-20 transfer row assignment is encoded there: models testing; context decomposition; tools interface; orchestration decomposition; evals testing; operating observability, security, operations.
7. **`transferRows`, `<Takeaway />`, `<Outcomes />` give the frontmatter fields a rendering contract.** `ModuleMeta` renders the transfer rows, `<Takeaway />` renders the takeaway verbatim in the body, `<Outcomes />` renders the outcomes with anchor ids. The content check requires the components, so the CM rows and MT-5.5.3 are verifiable.
8. **Order is numbered within a kind** (area 1 to 6, elective 1 to 5, others 0) and the catalog sorts by kind then order (AC-5.2.3).
9. **Hand-written `auth-schema.ts`, no Better Auth CLI dependency** (CG-34). The optional diff uses `scripts/auth-cli.config.ts`.
10. **Stateless HMAC tokens, no `token` column** (CG-16). Confirm tokens expire after 30 days; unsubscribe tokens never expire. A confirm token issued before the row's `unsubscribedAt` (or before its `createdAt`) is invalid, and every subscribe mints fresh tokens, so an old link cannot replay a confirmation (deviation 15.3.6).
11. **Account deletion by Drizzle transaction, not `auth.api.deleteUser`** (CG-9). The fresh-session rule would block OAuth users. The session cookies are cleared by name with the attributes Better Auth set (`Secure` on the `__Secure-` name, verified). One click, no wrapper.
12. **`accountLinking.enabled: false`** (EC-5.9.1). A second provider with the same email is rejected; the callback lands on `/sign-in?error=unable_to_link_account` and the page shows the linking copy. Two user rows are impossible because `user.email` is unique (deviation 15.3.1).
13. **Data minimization through `mapProfileToUser` (returning `image: undefined`) plus database hooks that null the avatar, IP, user agent, provider tokens, and scope.** The hooks are source-verified and unit-tested; their effect on real rows is a Phase 1 gate check.
14. **Better Auth gets a single-value `x-forwarded-for` from `clientAddress`** in the catch-all route instead of a `trustedProxies` CIDR, because `security.allowedDomains` already makes `clientAddress` correct behind the route.
15. **Module pages are readable by anyone** (CG-31). Only the workshop and failure forms, self-check persistence, `/account`, `/account/plan.md`, and `/assessment` need sign-in.
16. **Orientation stays prerendered and its self-check is local-only for everyone** (deviation 15.3.3). Manual completion posts to the on-demand `/progress` route.
17. **Catalog renders on demand with cache headers** (CG-5). Every response for a signed-in learner and every protected route leaves with `Cache-Control: private, no-store` and `Vary: Cookie` from the middleware; the catalog adds `public, max-age=300` for anonymous requests.
18. **The closing module is two things:** a readable module at `/modules/self-assessment` and a guarded tool at `/assessment`. The matrix tests both.
19. **Failure-exercise reveal is server-side** through a named slot rendered only when a `failure` response exists, together with the pitfall band (CG-10, AC-5.5.5).
20. **Self-check mastery rule.** The island tracks per-question "correct once"; the action stores the latest best answers and sets `passed` to true when all are correct or it was already true. Passes stand across content changes because the key is the module slug. Unknown answer keys are dropped and the record is bounded by `SELF_CHECK_MAX`.
21. **Plan ranking.** Score is `2 * gapNew + gapTransfer` with gaps as mean distance from 3. Focus is the top three areas with a gap. Uniform high means every item rated 3. Every focus carries the learner's feature ("Applied to"), so the plan references the stated feature regardless of content.
22. **Plan text is editable Markdown, exported verbatim; the structured plan is regenerated on retake and never edited.** Only the latest version is editable. `version` is parsed as a positive integer before use.
23. **No Preact outside the two islands.** Workshop and failure forms are HTML forms with a small enhancement script.
24. **One inline theme script in `Base.astro`** (CG-6). The toggle buttons carry no script.
25. **Diagrams sit on a dark tile in both themes** (CG-26, design research option a). Highlight states use CSS on one inline SVG addressed by `data-layer`, not by ids and not the four generated files; the import script strips every id so two maps can share a page. Title and description vary by variant and highlight.
26. **Heading ids are computed with a minimal slugger** that matches github-slugger for ASCII headings. Authors keep headings ASCII.
27. **Migrations run as a Job before rollout**, `oc exec` fallback, never at container start (section 5.5).
28. **CI on GitHub Actions, image on GHCR** (CG-27), pending the author's confirmation of the registry. Actions are pinned to commit SHAs at implementation time.
29. **The RDS CA bundle is committed** in `certs/` rather than fetched at build, and `scripts/tls-check.mjs` proves TLS from inside the pod.
30. **`README.md` skeleton** lists the scripts, the layout, the phase commit rule, and links to `docs/`.
31. **Feedback is anonymous** with no user column (CG-15). The privacy notice and the account page say it is not removed by account deletion.
32. **Rate limits** as in section 7.6: workshop and failure saves 30 per account per hour and 60 per IP per hour (CG-25 adopted). Better Auth's own limiter stays on in production for `/api/auth/*`.
33. **No committed env file.** Vitest placeholders live in `vitest.config.ts` (verified to reach `astro:env/server`); Playwright placeholders in `e2e/env.ts`. The notify token secret is named `NOTIFY_TOKEN_SECRET` as the matrix expects.
34. **The landing page lists drafts as planned modules** so the fourteen names come from content, not code.
35. **Elective, foundations, and area modules share the six-to-twelve question rule**; orientation needs at least one question; closing has none (CG-24).
36. **Foundations is treated as a Phase 2 deliverable** (CG-8), the recommended resolution.
37. **ISO dates everywhere** (`isoDate`, `<time datetime>`), including artifact cards, so MT-5.5.1 holds. The design research's "15 Sep 2026" example is superseded.
38. **Response headers.** The middleware sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options` on on-demand responses; the Route sets the same four on every response plus HSTS, which is the only way to cover prerendered pages served by the static handler. A Content-Security-Policy is deferred: Astro's `security.csp` does not support Shiki's inline styles, and the inline theme script would need a maintained hash. Phase 4 revisits it with `@astrojs/node`'s `staticHeaders: true` once Prism or a style-free highlighter is chosen; recorded in `docs/decisions.md`.
39. **`/readyz` says only ok or not.** Missing names and database errors go to the server log because the endpoint is reachable through the public Route.
40. **`scope` is nulled** in the account hooks with the tokens, so the privacy notice's list of kept Better Auth fields is exact: user id, name, email, emailVerified, createdAt, updatedAt, provider name, provider account id, session expiry.
41. **Log retention is stated as at most 30 days** in the privacy notice and enforced by runbook step 9; the author confirms the number or changes both places before the Phase 0 gate.
42. **`axe-core` is a direct dev dependency** so the island tests run axe under jsdom in each state, since signed-in pages cannot be reached by Playwright in CI.
43. **The container runs on a read-only root filesystem** with privilege escalation disabled and all capabilities dropped; the Dockerfile no longer grants group write on `/app`.
44. **Action tests use the internal `Symbol.for('astro.actionAPIContext')`** in exactly one helper, documented as an internal; the logic under test lives in `src/lib` and has its own tests.

### 15.2 Still unresolved

1. **The public domain.** Blocks `SITE_URL`, `security.allowedDomains`, the OAuth callback registrations, the Route host, and the URL on the talk's resources slide (slide 25, not 24: CG-3; at the talk repository's head `d90f230` the file is `slides/section-3/53-resources.md`, and the head slides rule out a QR code, so the deliverable is a visible URL row). Until it is fixed the image builds with the localhost default.
2. **Author approval of the dependency list** in section 2 (TC-7.6.7), including `axe-core`. Blocks the Phase 0 commit for the packages the Phase 0 tests need.
3. **Container registry and OpenShift image path.** GHCR through CI is assumed. The author may prefer an OpenShift BuildConfig.
4. **Better Auth hooks on real OAuth rows** (`session.create.before`, `account.create.before`, `account.update.before`). The option shape exists (`@better-auth/core` `src/types/init-options.ts`); the effect on rows produced by a real callback is a Phase 1 gate check. If a hook breaks the callback, fall back to `account.encryptOAuthTokens: true` and document the stored fields in the privacy notice.
5. **The refreshed-session `Set-Cookie` dropped by `getSession` in middleware.** Better Auth may extend `expiresAt` in the database at `updateAge` while the browser cookie keeps its original `Max-Age`. Accept (the cookie is re-set at each sign-in), or pass `returnHeaders: true` and merge into `Astro.cookies`. Decide in Phase 1.
6. **The book blueprint URL** for the uniform-high links and the landing page.
7. **Whether the seven competencies get a program-specific order** (CG-2). Orientation presents them unranked until the author decides.
8. **The representative learner** for the Models review (Phase 2), **elective order** (Phase 3), and **analytics** (none adopted; the privacy notice says none).
9. **Email provider.** Confirmed opt-in, the launch notification, the retry queue, and the POST confirm page wait for it.
10. **Whether `Astro.callAction` from a GET page** (`/notify/confirm`) triggers Astro's origin check. The check applies only to form and text content types on unsafe methods, so it should not. Verify in Phase 0.
11. **The contact address for the privacy notice** (deletion requests for notify addresses). Placeholder text until provided; blocks the Phase 0 privacy review.
12. **Signed-in end-to-end coverage.** Playwright cannot sign in through OAuth in CI. A test-only session injection endpoint compiled in only for the e2e build would let `/account`, `/assessment`, and the deletion response be exercised automatically. Not built; the Phase 1 manual gate and the component-level axe runs cover it. Revisit in Phase 4.
13. **GitHub Actions commit SHAs** for the pinned actions, resolved by F at implementation time.
14. **The log retention number** (decision 41) confirmed against the cluster's logging stack.
15. **Whether `vars.FEATURE_ACCOUNTS` stays a repository variable** after Phase 0 or the Dockerfile default alone is enough. The default is `true`; removing the variable is the plan.

### 15.3 Deviations from the spec or the matrix that need the author's sign-off

Each entry records the deviation, the reason, and what the matrix line becomes. Record the author's answer in `docs/decisions.md`.

1. **EC-5.9.1, two providers with one email.** Spec: "two accounts". Better Auth's `user.email` is unique, so two rows are impossible. Blueprint: the second provider is rejected with `unable_to_link_account` and the sign-in page explains it. Matrix verify becomes: sign in with provider A, sign out, sign in with provider B using the same email, see the linking message on `/sign-in`, and see one user row. The alternative (implicit linking, which merges silently) is the opposite of the spec's "merging is out of scope".
2. **AC-5.3.4 and AC-5.3.5, orientation sections.** The self-check sits in Completion evidence, and Sources follows it as reference material; "last section" in AC-5.3.4 means the last interactive section. A `Workshop` heading in orientation is an error, not tolerated; AC-5.3.5's verify becomes "add a Workshop heading and confirm the check fails for `kind: orientation`". `<SelfCheck />` is required for orientation, foundations, area, and elective, and forbidden for closing.
3. **Spec 5.8, orientation self-check persistence.** Attempts and final state are saved per learner for every self-check except orientation, which stays in the browser for everyone (the page is prerendered and the check does not count toward completion). The island says so, and the account page says so.
4. **MT-5.5.1, date format.** ISO dates as the matrix asks; the design research example format is not used.
5. **CG-25 adopted as written** (30 and 60 per hour). No deviation; recorded because v1 differed.
6. **EC-5.1.2, confirmation link used after unsubscribe.** Spec: "re-confirms the subscription". Blueprint: a confirm token issued before the unsubscribe is invalid (replay protection); a fresh subscribe mints a new token, and that one re-confirms and records the new `confirmedAt`. The test asserts the fresh-token path and the rejected old-token path.
7. **AC-5.9.5, one-click deletion.** The delete button sits directly on the account page with a hidden confirm field and a describing paragraph, no wrapper and no dialog. If the author wants a confirmation step, it becomes a `<details>` wrapper (two clicks) and the matrix line changes.
8. **NFR-6.2.4, secret grep.** No env file is committed; the placeholder values live in `vitest.config.ts` and `e2e/env.ts` as object entries, which the matrix's grep does not match. The matrix's `.env.example` name list gains `NOTIFY_TOKEN_SECRET` (already there), `FEATURE_ACCOUNTS`, `PREVIEW_DRAFTS`, `PG_CA_FILE`, `PGLITE_DATA_DIR`, `EMAIL_PROVIDER`.
9. **AC-5.5.7 and CM rows, the takeaway.** The takeaway is rendered by `<Takeaway />` from frontmatter rather than typed into the body; the content check requires the component, and `moduleRules` requires the frontmatter value to equal the content map. The rendered page shows the sentence verbatim, which is what the CM rows verify.
