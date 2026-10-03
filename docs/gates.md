# Phase gates

Gate records for the phase commits (blueprint sections 1.3 and 12.5; spec section 9). A gate is closed when every row in its table has a name and a date, with the evidence pasted or linked under the table. Nothing here is closed yet. Append to this file; never rewrite an earlier record.

## What the automated checks cover

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

| Step | Command | What it proves |
|---|---|---|
| Lint | `node scripts/lint.mjs` | No em-dash in `src/`, `docs/`, `README.md`, `scripts/`, `e2e/`; exact version pins |
| Content check | `npm run content:check` | Every module passes the content rules (draft rules for drafts) |
| Type check | `npx astro check --minimumSeverity error` | Types across `src/`, `scripts/`, `e2e/`, plus content schema validation through `astro sync` |
| Unit and component tests | `npm test` | Every library module and island, PGlite in memory |
| Build | `PREVIEW_DRAFTS=true npm run build` | The content check, then `astro build` with drafts visible for the e2e run |
| End to end and accessibility | `npm run test:e2e` | `e2e/landing.spec.ts`, `e2e/notify.spec.ts`, `e2e/a11y.spec.ts` against the built server with PGlite; axe reports uploaded as the `axe-reports` artifact |
| Image | `docker/build-push-action` with `push: false`, then a smoke test | The Dockerfile builds; the container serves `/healthz` under an arbitrary UID on a read-only root filesystem; `npm run` works in the container |

The automated checks never sign in (no OAuth registrations in CI, open item 12). Signed-in flows are covered by the component tests and by the manual gates below.

The axe run cannot judge text inside an inline SVG: every such node comes back as color-contrast "incomplete" because its background is another shape. A zero-violation run says nothing about diagram labels, so each gate carries a manual contrast row (0.14 for Phase 0). The Model label has been `#fffcf5` on `#13223f` since 2026-10-03 (15.4:1); the lowest ratio in the maps on that date was 5.17:1.

## Running the checks locally

```sh
npm ci
node scripts/lint.mjs
npm run content:check
npx astro check --minimumSeverity error
npm test
PREVIEW_DRAFTS=true npm run build
npx playwright install chromium
npm run test:e2e            # starts node ./dist/server/entry.mjs with the values in e2e/env.ts
npm run check:a11y          # the axe spec alone
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

Blueprint section 12.5 and spec 9.2. Run against the built image on RDS, not only against PGlite, with the image built with `FEATURE_ACCOUNTS=true` (the default) and without `PREVIEW_DRAFTS`. The `/modules/models` checks run in `astro dev` with `PREVIEW_DRAFTS=true` because the fixture module stays a draft.

| # | Check | How | Done by | Date | Evidence |
|---|---|---|---|---|---|
| 1.1 | Architecture and auth review before any learner data is accepted | Review of `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/guard.ts`, the actions | | | |
| 1.2 | Keyboard and VoiceOver pass on `/modules/orientation` (self-check) | Tab, Arrow, Enter; visible focus; feedback announced | | | |
| 1.3 | Keyboard and VoiceOver pass on `/modules/models` while signed in | Prerequisite notice, workshop form, failure reveal, self-check with persistence | | | |
| 1.4 | Keyboard and VoiceOver pass on `/account` | Data view, display name, deletion | | | |
| 1.5 | Keyboard and VoiceOver pass on `/assessment` | Every step, the blocker, the plan editor | | | |
| 1.6 | Data minimization rows after one GitHub and one Google sign-in | Section 6.1 row check: no avatar, IP, user agent, provider tokens, scope | | | |
| 1.7 | A GitHub account whose primary email is private signs in and `user.email` is set | Sign in with such an account | | | |
| 1.8 | The deletion response carries expiring `Set-Cookie` headers for both session cookie names, `Secure` on the prefixed one | Response headers on the deployed site | | | |
| 1.9 | OAuth callback URLs registered for both providers | Runbook step 8 | | | |
| 1.10 | Checklist PD-9.2.1 to PD-9.2.9 closed | Each item with its verify step | | | |
| 1.11 | `e2e/keyboard.spec.ts` added and green in CI | Link to the run | | | |
| 1.12 | No placeholder survives the commit | `grep -rn "data-placeholder\|placeholder, [A-F] replaces" src scripts e2e test` is empty | | | |

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
