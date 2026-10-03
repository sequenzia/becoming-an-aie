# Phase gates

Gate records for the phase commits (blueprint sections 1.3 and 12.5; spec section 9). A gate is closed when every row in its table has a name and a date, with the evidence pasted or linked under the table. Nothing here is closed yet. Append to this file; never rewrite an earlier record.

## What the automated checks cover

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

| Step | Command | What it proves |
|---|---|---|
| Lint | `node scripts/lint.mjs` | No em-dash in `src/`, `docs/`, `README.md`, `scripts/`, `e2e/`; exact version pins |
| Content check | `npm run content:check` | Every module passes the content rules (draft rules for drafts) |
| Type check | `npx astro check --minimumSeverity error` | Types across `src/`, `scripts/`, `e2e/`, `test/`, plus content schema validation through `astro sync` |
| Unit and component tests | `npm test` | Every library module and island, PGlite in memory; `test/content-store.test.ts` proves the content layer is populated under Vitest |
| Build | `PREVIEW_DRAFTS=true npm run build` | The content check, then `astro build` with drafts visible for the e2e run |
| End to end and accessibility | `npm run test:e2e` | `e2e/landing.spec.ts`, `e2e/notify.spec.ts`, `e2e/keyboard.spec.ts` (Phase 1), `e2e/a11y.spec.ts` against the built server with PGlite; axe reports uploaded as the `axe-reports` artifact |
| Image | `docker/build-push-action` with `push: false` and `FEATURE_ACCOUNTS=true` (the Phase 1 default), then a smoke test | The Dockerfile builds; the container serves `/healthz`, the landing page, and `/modules/orientation` under an arbitrary UID on a read-only root filesystem; `/sign-in` is routed; a pod without a database fails closed (`/readyz` 503, the subscribe POST stores nothing and names the cause in the log only); the embedded database is absent; `npm run` works in the container |

The automated checks never sign in (no OAuth registrations in CI, open item 12). Signed-in flows are covered by the component tests and by the manual gates below.

The axe run cannot judge text inside an inline SVG: every such node comes back as color-contrast "incomplete" because its background is another shape. A zero-violation run says nothing about diagram labels, so each gate carries a manual contrast row (0.14 for Phase 0). The Model label has been `#fffcf5` on `#13223f` since 2026-10-03 (15.4:1); the lowest ratio in the maps on that date was 5.17:1.

The keyboard spec drives the orientation self-check with the keyboard alone and asserts focus order, the focus ring, option selection, the feedback announcement (`role="status"`, `aria-live="polite"`), the "Passed." summary, the absence of any action call, and the restored state after a reload. It cannot hear what a screen reader says. That is what gate rows 1.10 to 1.14 are for.

## Running the checks locally

```sh
npm ci
node scripts/lint.mjs
npm run content:check
npx astro check --minimumSeverity error
npm test
PREVIEW_DRAFTS=true npm run build
npx playwright install chromium
npm run test:e2e                              # starts node ./dist/server/entry.mjs with the values in e2e/env.ts
npm run test:e2e -- e2e/keyboard.spec.ts      # the keyboard flow alone
npm run check:a11y                            # the axe spec alone
```

Knobs for `npm run test:e2e`: `E2E_PORT=<port>` moves the server off 4321. `E2E_REUSE=1` reuses a server already listening there; start it yourself with the values in `e2e/env.ts` and a fresh in-memory database, because the notify spec counts its own submissions against the per-IP rate rule. Reports land in `playwright-report/` and `axe-reports/`; both are gitignored.

## Phase 0 gate: landing page, live by talk day

Blocked until these are answered (`docs/decisions.md` section 2): the dependency approval (item 2), the public domain (item 1), the privacy contact address (item 11), the log retention number (item 14). The registry (item 3) blocks only the CI push, not the gate: a BuildConfig build (runbook step 3, path B) is enough.

Run against the deployed image on the final domain, after runbook step 9 in `docs/deploy-openshift.md`.

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 0.1 | Privacy notice reviewed, contact address present, retention number matches the runbook | Read `https://<host>/privacy` | | | |
| 0.2 | The deployed image was built with `SITE_URL` equal to the Route origin and `FEATURE_ACCOUNTS=false` | Runbook step 3 table | | | |
| 0.3 | `/sign-in` is 404 | `curl -I https://<host>/sign-in` | | | |
| 0.4 | `/readyz` is `{"ok":true}` | `curl https://<host>/readyz` | | | |
| 0.5 | TLS to RDS from inside the pod | `oc exec deploy/aie -- npm run db:tls-check` prints `tls-check: ok` | | | |
| 0.6 | Subscribe on the deployed site | Land on `/notify/thanks`; the page does not claim a mail was sent | | | |
| 0.7 | Read the confirm and unsubscribe URLs from the log | `oc logs deploy/aie \| grep mailer:noop` | | | |
| 0.8 | Open the confirm URL, see the row change (CG-28) | Runbook step 9.7 query: `confirmed_at` set | | | |
| 0.9 | Open the unsubscribe URL, see the row change | Runbook step 9.8 query: `unsubscribed_at` set | | | |
| 0.10 | The old confirm URL is now generic and the row is unchanged | Runbook step 9.9 | | | |
| 0.11 | Response headers on `/` | `curl -I https://<host>/` shows the four security headers and HSTS | | | |
| 0.12 | The resources slide carries the URL as a visible text row | Talk repo at head (`d90f230`): `slides/section-3/53-resources.md`. The file was `25-resources.md` at `323bc2e`. The head slides say no QR code, so a URL row is the deliverable | | | |
| 0.13 | CI green on the Phase 0 commit | Link to the run | | | |
| 0.14 | Diagram text contrast checked by hand in both themes. Every `<text>` fill in `src/assets/diagrams/*.svg` is at or above 4.5:1 on its box fill or on the tile (`#14161c`) | Compute the WCAG 2.1 ratios. Paste the lowest one here. The note above the table says why axe cannot do this | | | |

Evidence:

## Phase 1 gate: platform

Blueprint sections 1.3 and 12.5, spec 9.2, matrix PD-9.2.1 to PD-9.2.9. The gate has three parts: the architecture and auth review (A), the manual keyboard and screen-reader pass (B), and the checklist closure with the deployed-image checks (C). It runs against the Phase 1 image on RDS, not only against PGlite. Preconditions, in order:

1. The image was built with `FEATURE_ACCOUNTS=true` (the default), without `PREVIEW_DRAFTS`, and with `SITE_URL` equal to the Route origin. Record it in the runbook step 3 table.
2. Both OAuth callback URLs are registered (runbook step 8) and the Secret carries `BETTER_AUTH_URL=https://<host>`, `BETTER_AUTH_SECRET`, and the four OAuth values (runbook step 2, the Phase 1 block).
3. Migrations ran from the same image (runbook step 4) and `curl https://<host>/readyz` is `{"ok":true}`.
4. CI is green on the Phase 1 commit, `e2e/keyboard.spec.ts` included.

Where a row says `astro dev`, run `PREVIEW_DRAFTS=true npm run dev` on the dev machine with a `.env` that holds the dev OAuth registrations (callbacks `http://localhost:4321/api/auth/callback/github` and `http://localhost:4321/api/auth/callback/google`), `BETTER_AUTH_URL=http://localhost:4321`, `BETTER_AUTH_SECRET`, `NOTIFY_TOKEN_SECRET`, and `PGLITE_DATA_DIR=./.pglite-dev`, then sign in. The fixture module `/modules/models` stays a draft and renders only there; so does `/assessment`, whose module is a draft until Phase 3.

### Part A: architecture and auth review, before any learner data is accepted

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 1.1 | Auth is lazy and reads no secret at build | Read `src/lib/auth.ts`: `getAuth()` is the only constructor and `requireEnv` is called inside it. `grep -rn "astro:env/server" src` lists `src/lib/env.ts` alone | | | |
| 1.2 | Session middleware and route guard | Read `src/middleware.ts`: prerendered pages and the health routes bypass it; the session is looked up on every on-demand request; the patterns in `src/lib/guard.ts` redirect to `signInPath` with `Cache-Control: private, no-store`; the four security headers go on every on-demand response. `npx vitest run src/lib/guard.test.ts` passes | | | |
| 1.3 | Auth handler and sign-out | Read `src/pages/api/auth/[...all].ts` (404 without the flag, a single-value `x-forwarded-for` from `clientAddress`) and `src/pages/sign-out.ts` (POST only, 303 to `/`, Better Auth's cookies forwarded) | | | |
| 1.4 | No account linking, no email and password, no unverified email | In `src/lib/auth.ts`, `account.accountLinking.enabled` is `false`, `disabledPaths` holds `/sign-up/email` and `/sign-in/email`, both providers set `requireEmailVerification: true`, and the `user.create.before` hook refuses a row whose `emailVerified` is false (the callback lands on `/sign-in?error=email_not_verified`). `npx vitest run src/lib/auth.test.ts` passes | | | |
| 1.5 | Every write authorizes and rate limits itself | Read `src/actions/index.ts` and `src/lib/actions-guard.ts`: each learner action calls `requireUser`, each save enforces its `RATE_RULES` entry, each handler runs inside `guardServerErrors`. `npx vitest run src/actions` passes | | | |
| 1.6 | Deletion is one transaction and clears both cookie names | Read `deleteLearner` in `src/lib/account.ts` (the notify-me row goes only when the user row's `emailVerified` is true) and `clearSessionCookies` in `src/lib/auth-cookies.ts`. `npx vitest run src/lib/account.test.ts src/lib/auth-cookies.test.ts` passes | | | |
| 1.7 | Data minimization in code | The hooks in `src/lib/auth.ts` null `image`, `ipAddress`, `userAgent`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, and `scope`; `mapProfileToUser` returns `image: undefined`; `disabledPaths` holds `/update-user`, so Better Auth's own name and image writer answers 404 to a signed-in learner (`npx vitest run src/lib/auth.test.ts`). Row 1.15 checks the effect on real rows | | | |
| 1.8 | No secret or stack reaches a learner | `guardServerErrors` wraps every handler; `redactQueryParams` runs on logged errors, the plan download's included (`/account/plan.md` answers 503 with no body on a database failure and 404 for a version past the integer column); `/readyz` answers `{"ok":false}` with nothing else; a thrown middleware error answers 500 with an empty body (CI smoke test) | | | |
| 1.9 | Review recorded before the Route serves the Phase 1 image | Name, date, and the commit reviewed, here | | | |

### Part B: manual keyboard and screen-reader pass

Safari or Chromium with VoiceOver on macOS. Keyboard: Tab and Shift+Tab between stops, Arrow keys inside a radio group, Space to toggle a checkbox or check a radio, Enter on links and buttons. VoiceOver: VO is Control+Option; VO+Right Arrow reads the next item; VO+Space activates the focused control. Every stop must show the focus ring (the text color, 2px, with a 2px gap in the page color; `src/styles/base.css`). Nothing may be skipped or trapped (NFR-6.4.4).

| # | Page | Keyboard sequence | What VoiceOver must say | Done by | Date | Evidence |
|---|---|---|---|---|---|---|
| 1.10 | `https://<host>/modules/orientation`, deployed, signed out | Tab from the top: "Skip to content", the site name, Modules, Map, Sign in, the three theme buttons, then into main. Keep pressing Tab to the first option of question 1. Arrow keys move inside the radio group and check as they go; Space checks a checkbox or a radio. Enter on an option does nothing (native controls, deviation 14 in `docs/decisions.md`); Enter and Space activate the buttons. Tab to "Check answer", Enter. Choose a wrong answer once, see "Not yet.", Shift+Tab back into the group, fix it, check again. Repeat until every question is correct | "Question 1 of N" before each question text; every option name; "Check answer, button" then "Check again, button"; the feedback ("Correct." or "Not yet." followed by the option's paragraph) read without the focus moving; the summary "N of N answered correctly. Passed. This self-check stays on this device." Reload the page: the summary is read back with "Passed." and nothing else is announced; the nine feedback bodies are restored silently | | | |
| 1.11 | `/modules/models` in `astro dev` with `PREVIEW_DRAFTS=true`, signed in with a fresh account | Tab through the whole page. The prerequisite notice names Foundations. Tab to the workshop textarea, type at least 200 characters, Tab to "Save response", Enter: the saved line shows the date. Failure exercise: type a response, Tab to "Submit and reveal the explanation", Enter: the page reloads with the Pitfall band and the explanation. Self-check: as in 1.10; after a check the summary reads "Saved". Reload: every state comes back from the account | The notice read as a note headed "Before this module"; the textarea label "Your response" with its help line; "Saved" from the status line; the Pitfall band read with its sentence; the self-check as in 1.10 with "Saved" in the summary | | | |
| 1.12 | `https://<host>/account`, deployed, signed in | Tab to the data view, the display name field and its save button, then "Delete my account and all my data" with its describing paragraph. Enter on the delete button lands on `/account/deleted`; `/account` then redirects to `/sign-in?next=%2Faccount%2F` | Headings in order; each stored item with its value; the display name field by its label; the delete button's name and its description before activation | | | |
| 1.13 | `/assessment` in `astro dev` with `PREVIEW_DRAFTS=true`, signed in | Every step: Tab through the rating groups. Press Next with one item unrated: focus moves to that fieldset and the alert names the item. Rate everything, "Generate my plan", read the plan, edit it, "Save edits", "Download as Markdown" | The step heading takes focus on each step and is read; the blocker read as an alert; the plan's four steps per focus area and the "Applied to" line; the version list | | | |
| 1.14 | `https://<host>/sign-in`, deployed, signed out | Tab reaches "Sign in with GitHub", "Sign in with Google", then the privacy link. Enter on a provider button opens the provider. Cancel at the provider: the page returns with the error line | Both button names; the sentence that names what is stored; the error line read as an alert after the cancelled sign-in | | | |

### Part C: checklist closure and the deployed image

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 1.15 | Data minimization rows after one GitHub and one Google sign-in | Runbook section 15, step 4 query. `image`, `ip_address`, `user_agent`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, and `scope` are null on every row | | | |
| 1.16 | A GitHub account whose primary email is private signs in and `user.email` is set | Sign in with such an account; runbook section 15, step 4 query shows the address | | | |
| 1.17 | The deletion response expires both session cookies | DevTools, Network, the response to the delete action: two `Set-Cookie` headers, `better-auth.session_token` and `__Secure-better-auth.session_token`, both expiring (`Max-Age=0` or an `Expires` in the past), both `Path=/; HttpOnly; SameSite=Lax`, `Secure` on the prefixed one | | | |
| 1.18 | The session cookie attributes | After sign-in, the callback response sets `__Secure-better-auth.session_token` with `Secure; HttpOnly; SameSite=Lax` (DevTools, Network, or `curl -I` on the callback is not possible, so read it in the browser) | | | |
| 1.19 | Deployed image routes | `curl -I https://<host>/sign-in` 200; `curl -I https://<host>/account` 302 with `Location: /sign-in?next=%2Faccount%2F` and `Cache-Control: private, no-store`; `curl -I https://<host>/modules/orientation` 200; `curl -I https://<host>/modules/models` 404 (a draft never renders in an image, EC-5.2.2); `curl https://<host>/api/auth/ok` is `{"ok":true}`; `curl https://<host>/readyz` is `{"ok":true}` | | | |
| 1.20 | OAuth callback URLs registered for both providers | Runbook step 8: `https://<host>/api/auth/callback/github` and `https://<host>/api/auth/callback/google`; a sign-in with each provider completes | | | |
| 1.21 | Checklist PD-9.2.1 to PD-9.2.9 closed | The table below, every row with evidence | | | |
| 1.22 | `e2e/keyboard.spec.ts` and the Phase 1 pages of `e2e/a11y.spec.ts` green in CI | Link to the run; the `axe-reports` artifact holds `sign-in-*.json`, `module-orientation-*.json`, `module-models-*.json`, `module-verification-and-evals-*.json`, and `module-models-{pending,incorrect,correct}-*.json` for both themes. The same spec asserts no horizontal page scroll at 320 px on every listed page (WCAG 1.4.10, outside axe's rules) | | | |
| 1.23 | No placeholder survives the commit | `grep -rn "data-placeholder\|placeholder, [A-F] replaces\|NOT_IMPLEMENTED" src scripts e2e test | grep -v "not.toContain"` is empty (the four remaining hits are test assertions that the marker is absent) | | | |
| 1.24 | The gate ran on RDS | Rows 1.10, 1.12, 1.14 to 1.20 were run against the deployed image on RDS, not only against PGlite | | | |
| 1.25 | Diagram text contrast unchanged | Row 0.14 still holds for every SVG under `src/assets/diagrams/`, or the new lowest ratio is pasted here | | | |
| 1.26 | The router replaces forwarded headers, so every IP-keyed limit keys on the real client | Runbook section 7, the forwarded-headers block: `oc get route aie -o jsonpath='{.metadata.annotations.haproxy\.router\.openshift\.io/set-forwarded-headers}'` prints `replace`; then six `submitFeedback` posts from one client with six different forged `X-Forwarded-For` values, and the sixth answers 429 (if the forged values were honoured all six would answer 200) | | | |

Platform-done checklist (spec 9.2, matrix section 15):

| Item | What closes it | Evidence |
|---|---|---|
| PD-9.2.1 OAuth sign-in and sign-out through the auth library; guard on signed-in routes | Rows 1.12, 1.14, 1.19; `npx vitest run src/lib/guard.test.ts` | |
| PD-9.2.2 Content collections with the module and artifact schemas | `npx astro check` passes (sync validates every entry); `src/content.config.ts` defines `modules`, `artifacts`, `changelog`; `test/content-store.test.ts` passes | |
| PD-9.2.3 Module page layout: sections, header dates, artifact labels, prerequisite notices | Row 1.11; `/modules/orientation` shows "Updated" and "Checked" as ISO dates and the transfer table artifact with its origin chip | |
| PD-9.2.4 Catalog page with progress status | `npx vitest run src/lib/catalog-page.test.ts` (the catalog through the Container API with seeded progress rows: Complete, In progress, Not started per published module, no chips when anonymous, the Planned line without `PREVIEW_DRAFTS`); on the deployed site, signed in, after "Mark orientation complete" on `/modules/orientation`, `/modules` shows Complete on Orientation | |
| PD-9.2.5 Progress, workshop, and self-check Actions with tests | `npx vitest run src/actions src/lib/progress.test.ts src/lib/responses.test.ts src/lib/self-check-store.test.ts` | |
| PD-9.2.6 Self-check island meeting spec 5.8 and the keyboard requirements | Row 1.10; `npx vitest run src/components/islands/SelfCheck.test.tsx` (including the silent restore of saved progress); `e2e/keyboard.spec.ts` | |
| PD-9.2.7 Account page with data view and one-click deletion, with tests | Rows 1.12, 1.17; `npx vitest run src/lib/account.test.ts` | |
| PD-9.2.8 Content build check | `npm run content:check` passes; break one rule in a copy of a module and see a non-zero exit naming the file (NFR-6.5.1) | |
| PD-9.2.9 Accessibility audit in CI | The workflow runs `npm run test:e2e`, which includes `e2e/a11y.spec.ts` on `/`, `/modules/orientation`, `/modules/models` in three self-check states, `/modules/verification-and-evals` (the prerequisite notice with an area edge), and `/sign-in` in both themes, plus the 320 px reflow check; row 1.22 | |

Evidence:

## Phase 2 gate: core content

Spec 9.3. After the Models module, a content review with the representative learner decides whether the template, reading length, and workshop format hold before the remaining modules are written. Before the launch notification, an accessibility pass on one module page and the catalog.

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 2.1 | Representative learner review of Models | Friction report | | | |
| 2.2 | Accessibility pass on one module page and `/modules` | Keyboard and VoiceOver, plus the axe spec | | | |
| 2.3 | Foundations and the six area modules flip to `draft: false` and pass the content check | `npm run content:check` | | | |

Evidence:

## Phase 3 gate: closing content

Spec 9.4. Plan output reviewed against the talk's four-step roadmap for fidelity before the module is published.

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 3.1 | A generated plan follows the four steps (docs/research/talk-kb.md D.5) | Read one plan per focus area | | | |
| 3.2 | `/assessment` opens and the first electives and labs are published | Catalog and routes | | | |

Evidence:
