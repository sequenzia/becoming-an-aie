# Acceptance matrix: becoming-an-ai-engineer

Source: `/Users/ada/dev/becoming-an-aie/specs/becoming-an-ai-engineer-SPEC.md` (v1.0, 2026-09-15).
Decisions applied: the author's answers to the open questions, dated 2026-09-15. They override the spec where the two differ. Each such change is marked as an **Overlay** on the item.
Prepared: 2026-09-15. Reviewers grade the implementation against this list, not against the spec text.

## How to read this file

Each item has an id, a phase, a priority, the criterion, a verification step, and an overlay note when a decision changes it.

- Ids: `AC-x.y.n` acceptance criterion, `EC-x.y.n` edge case, `MT-5.5.n` module template row, `CM-5.5.n` content map row, `NFR-6.y.n` non-functional requirement, `TC-7.6.n` technical constraint, `PD-9.2.n` platform-done item, `A-n` assumption, `CG-n` contradiction or gap.
- Phase: 0 landing page, 1 platform, 2 core content, 3 closing content. Where the spec assigns a first run to Phase 4, the mechanism is graded in Phase 3 and the note says so.
- Priority: P0 required by the end of Phase 2, P1 required by the end of Phase 3, P2 may follow.
- Verify: a command, a file, a page, or a keyboard sequence. Paths are the expected layout below. If the implementation uses different paths, the reviewer substitutes them, but the npm script names are fixed.

### Decisions in force

| Topic | Decision |
|---|---|
| Hosting | OpenShift. Container image from a `Dockerfile`. A deploy runbook. `@astrojs/node` in `standalone` mode. One server process. Not Netlify. |
| Database | PostgreSQL on AWS RDS through the `pg` driver and Drizzle. `DATABASE_URL` from the environment. TLS to RDS. Not Neon. |
| Tests and local dev | `@electric-sql/pglite` with `drizzle-orm/pglite`. Dev dependency. Needs the author's approval under TC-7.6.7. |
| Email | No emails are sent. Notify-me stores the address unconfirmed with `created_at`. Confirm and unsubscribe endpoints exist with signed tokens. The mailer is an interface. The only implementation is a no-op that logs. Confirmed opt-in is deferred until a provider is chosen. |
| OAuth | GitHub and Google through Better Auth. |
| Palette | The talk's dark palette and design brief carry over. A light theme uses the same four area colors on a light ground. `prefers-color-scheme` is followed. A toggle overrides it. |
| Content | MDX through `@astrojs/mdx`. Preact islands (`@astrojs/preact`, `preact`) for the self-check and the self-assessment only. |
| Toolchain | npm. Node 24. Labs: `uv`, `ruff`, `pytest`, Python 3.12. |
| Git | One commit per phase on `main`. |
| Everything else | As the spec says: Astro 7 in `output: 'server'`, content collections, Astro Actions for all writes, Drizzle, Better Auth. |

Versions observed in the scratchpad probes on 2026-09-15: astro 7.3.2, @astrojs/node 11.1.5, @astrojs/mdx 8.0.1, @astrojs/preact 6.0.5, preact 10.29.8, drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, @electric-sql/pglite 0.5.8, better-auth 1.7.5, vitest 5.0.1. Local machine: Node 24.15.0, npm 11.14.1, uv 0.11.7, Python 3.12.13 through uv, Playwright Chromium 1243. Not installed: Docker, psql, ruff (use `uv run ruff`), `oc`.

### Expected layout and script names

- `src/content.config.ts` (collections `modules` and `artifacts`), `src/content/modules/*.mdx`, `src/content/artifacts/*`.
- `src/actions/index.ts` (all Actions), `src/middleware.ts` (session into `locals`), `src/pages/api/auth/[...all].ts` (Better Auth handler).
- `src/db/schema.ts`, `src/db/client.ts` (pg Pool with TLS), `src/db/test-client.ts` (pglite).
- `src/lib/mailer.ts` (interface plus `NoopMailer`), `src/lib/tokens.ts` (signed tokens), `src/lib/rate-limit.ts`.
- `src/components/SelfCheck.tsx`, `src/components/SelfAssessment.tsx` (Preact islands).
- `scripts/content-check.mjs`, `scripts/drift-review.mjs`.
- `tests/**` (vitest), `tests/a11y/**` (Playwright plus axe).
- `Dockerfile`, `docs/deploy-runbook.md`, `docs/privacy.md` or `src/pages/privacy.astro`, `docs/dependencies.md` (approved dependency list).
- `labs/<name>/pyproject.toml`.
- npm scripts: `npm run dev`, `npm run build`, `npm test`, `npm run check:content`, `npm run check:a11y`, `npm run drift`, `npm run db:migrate`.

---

## 1. Section 5.1: Landing page with notify-me

- **AC-5.1.1** Phase 0, P0.
  Criterion: the page states the two thesis sentences, shows the six-area map (the talk's landscape anatomy diagram, reused with a text alternative), and lists the planned modules by name.
  Verify: load `/`. Find the exact sentences "Using AI makes you an AI-enabled software engineer." and "Engineering systems that depend on AI makes you an AI engineer." Confirm the diagram is the talk's `anatomy-of-an-agentic-ai-system-landscape.svg` and has an accessible name and a long description (the source SVG has no `<title>` or `<desc>`; the site must add them or an adjacent description). Count the listed modules: Orientation, Foundations, Models, Context and knowledge, Tools and extensibility, Orchestration, Verification and evals, Operating it, Self-assessment, and the five electives by name.

- **AC-5.1.2** Phase 0, P0.
  Criterion: the page states plainly that the program is free, self-paced, has no certificate, and does not require a build.
  Verify: load `/` and find all four statements in body text, not in an image.

- **AC-5.1.3** Phase 0, P0.
  Criterion (spec): the notify-me form accepts an email address, stores it with a created-at timestamp, and sends a confirmation email. The address is marked confirmed only after the recipient follows the confirmation link.
  Verify: submit the form with JavaScript disabled. Query the `notify_subscriber` table (in tests through pglite) and see a row with `email`, `created_at` set, `confirmed_at` null. Run `npm test` and find a test named for subscribe. Check the server log for the no-op mailer line containing the confirm URL.
  Overlay: no email is sent. The row is stored unconfirmed. The `Mailer` interface has a `send` method and one implementation, `NoopMailer`, that logs the message and the confirm URL. `confirmed_at` is set only by the confirm endpoint. Confirmed opt-in is deferred. The success message must not claim that an email was sent.

- **AC-5.1.4** Phase 0, P0.
  Criterion (spec): every notification email carries an unsubscribe link that works without sign-in.
  Verify: `GET /notify/unsubscribe?token=<signed>` with no session cookie sets `unsubscribed_at` and shows a confirmation page. A tampered token returns a generic error page that does not reveal whether the address is on the list. A test covers both.
  Overlay: no emails exist yet. The endpoint and the signed token are still required. The `NoopMailer` log line includes the unsubscribe URL so the endpoint can be exercised. When a provider is chosen, every message must include this link.

- **AC-5.1.5** Phase 0, P0.
  Criterion: a privacy notice is linked from the form and states what is stored, why, and how to have it deleted.
  Verify: the form has a visible link to `/privacy`. The notice names the stored fields (email, created-at, confirmed-at, unsubscribed-at), the purpose (launch notification), and the deletion path (the unsubscribe endpoint plus an email address to write to, and later the account page).
  Overlay: the notice must say that addresses are stored unconfirmed and that no mail is sent until a provider is chosen. The notice must also enumerate the Better Auth fields (see CG-14) once accounts exist.

- **AC-5.1.6** Phase 0, P0.
  Criterion: the page is fully static except for the form submission, loads without JavaScript for reading, and meets Section 6.4.
  Verify: `src/pages/index.astro` has `export const prerender = true`. After `npm run build`, `dist/client/index.html` exists and contains no `<script>` tags other than the theme toggle inline script (see CG-6). Load `/` with JavaScript disabled and read the whole page. Submit the form with JavaScript disabled and reach a success page. Run `npm run check:a11y`.
  Overlay: the theme toggle adds one small inline script. The author accepted the toggle, so the script is allowed. Nothing else may run on the landing page.

- **AC-5.1.7** Phase 0, P0.
  Criterion: the page is deployed on the final public domain so the URL or QR code on the talk's resources slide does not change.
  Verify: `curl -I https://<final-domain>/` returns 200 over TLS from the OpenShift Route. `docs/deploy-runbook.md` names the domain, the Route, and the TLS termination. The talk repo's `slides/section-3/25-resources.md` carries the same URL (see CG-3 on the slide number).
  Overlay: OpenShift replaces Netlify. The runbook replaces Netlify's deploy-from-repo. Reviewers cannot run `oc` or Docker on the dev machine, so the local check is `npm run build && HOST=0.0.0.0 PORT=8080 node ./dist/server/entry.mjs` followed by `curl -I http://localhost:8080/`.

- **EC-5.1.1** Phase 0, P0.
  Criterion: duplicate submission of a confirmed address sends no second confirmation email and responds as if newly subscribed.
  Verify: a test subscribes, confirms through the endpoint, subscribes again, and asserts the mailer spy was called once and the second response equals the first.
  Overlay: "no second email" becomes "the mailer is not invoked a second time".

- **EC-5.1.2** Phase 0, P0.
  Criterion: a confirmation link used after unsubscribe re-confirms and records the new confirmed-at time.
  Verify: a test subscribes, unsubscribes, then hits the confirm endpoint with the original token, and asserts `confirmed_at` is newer than before and `unsubscribed_at` is null.
  Overlay: the token comes from the `NoopMailer` log or from `src/lib/tokens.ts` directly in tests. Decide the confirm token lifetime (CG-16).

- **EC-5.1.3** Phase 0, P0.
  Criterion: email service unavailable at submission stores the address as unconfirmed, retries the confirmation, and shows success either way.
  Verify: a test injects a mailer whose `send` rejects and asserts the row is stored and the action returns success.
  Overlay: with `NoopMailer` the failure path cannot occur in production. The interface must still let a failing mailer be injected, and the subscribe action must not fail when `send` rejects. The retry queue is deferred with the provider choice. Record that in `docs/deploy-runbook.md` under deferred work.

## 2. Section 5.2: Program structure and module catalog

- **AC-5.2.1** Phase 1, P0.
  Criterion: the catalog lists modules grouped by kind: Orientation, Foundations, the six Area modules, Closing, and Electives.
  Verify: load `/modules`. Five group headings appear in that order. Each group is an `h2`.

- **AC-5.2.2** Phase 1, P0.
  Criterion: each entry shows title, one-line summary, estimated reading time, prerequisites, and, when signed in, progress status (not started, in progress, complete).
  Verify: load `/modules` signed out and see the first four fields per entry with no status. Sign in, mark orientation complete, reload, and see "complete" on orientation and "not started" elsewhere. See CG-5 on why the catalog renders on demand.

- **AC-5.2.3** Phase 1, P0.
  Criterion: the six area modules appear in talk order: Models, Context and knowledge, Tools and extensibility, Orchestration, Verification and evals, Operating it.
  Verify: read the order on `/modules`. Confirm the `order` field in each area module's frontmatter is 1 to 6 in that sequence.

- **AC-5.2.4** Phase 1, P0.
  Criterion: modules are never hard-locked. Any module opens. Unmet prerequisites appear as a notice.
  Verify: sign in with a fresh account and open `/modules/verification-and-evals`. The page renders and shows a notice naming the unmet prerequisites. No redirect.

- **AC-5.2.5** Phase 1, P0.
  Criterion: the catalog and module pages are generated from the content collection. Adding a module means adding a content file with valid frontmatter and no application code changes.
  Verify: copy an existing module file to a new slug, run `npm run build`, and see the new module on `/modules` and at its route. `git diff --stat` shows only the content file.

- **EC-5.2.1** Phase 1, P0.
  Criterion: a module file with invalid frontmatter fails the build, not the page render.
  Verify: set `readingMinutes: "abc"` in one module, run `npm run build`, and see a non-zero exit with the Zod error naming the file. Revert.

- **EC-5.2.2** Phase 1, P0.
  Criterion: a module marked `draft: true` is excluded from the catalog and from progress totals.
  Verify: set `draft: true` on an area module, build, and confirm it is absent from `/modules`, its route returns 404, and the account page's "modules complete" count denominator drops by one.

## 3. Section 5.3: Orientation module

- **AC-5.3.1** Phase 1 (render), P0.
  Criterion: readable without an account.
  Verify: open `/modules/orientation` signed out with JavaScript disabled. The full body renders. No redirect to sign-in.

- **AC-5.3.2** Phase 2, P0.
  Criterion: covers, in this order: the thesis (using AI versus engineering AI, and the definition of owner), why a compelling prototype is not evidence of production readiness, the six-area map with the anatomy diagram, what transfers (the six-row table), what is new (the seven competencies and the prompt-to-context-to-harness ladder), the seven pitfalls, and the four-step roadmap.
  Verify: read the page top to bottom and tick each beat in order. The transfer table has six rows: decomposition and systems thinking, interface design, testing discipline, observability, security, operations. The competencies are seven: model behavior intuition, context engineering, tool design, harness and loop design, evals and error analysis, AI security, cost and latency. The pitfalls are the six area pitfalls plus "reaching for a framework before understanding the loop". The roadmap steps are: look before you build, start constrained, own the harness, add autonomy as your evals earn it.
  Overlay: none. See CG-2 on "priority order".

- **AC-5.3.3** Phase 2, P0.
  Criterion: draws on the talk's Section 1 and Section 3 outlines and on the book's Chapter 1 and Chapter 2 (summarized as "look before you build").
  Verify: frontmatter has `talkBeats` covering 1.3, 1.4, 3.1, 3.2, 3.3, 3.4 and `bookChapters: [1, 2]`. The Sources section links those beats and chapters.

- **AC-5.3.4** Phase 1 (island), 2 (questions), P0.
  Criterion: ends with a short self-check that is optional and does not count toward completion.
  Verify: the self-check is the last section. It is labelled optional. Passing it signed in does not change the module status. A test asserts that the orientation self-check result does not set `completed_at`.

- **AC-5.3.5** Phase 1, P0.
  Criterion: contains the same required body sections as an area module except Workshop and Failure exercise.
  Verify: `npm run check:content` passes with headings Transfer connection, Topics and learning outcomes, Completion evidence, Sources present and Workshop and Failure exercise absent. Add a Workshop heading and confirm the check does not require it for `kind: orientation`.

- **EC-5.3.1** Phase 1, P0.
  Criterion: a signed-in learner who reads orientation gets it marked complete. An anonymous reader who later signs in does not, and can mark it complete manually.
  Verify: signed in, use the "Mark orientation complete" control at the end of the page and see status complete on `/modules`. Signed out, read the page, sign in, and see status not started, then mark it complete manually. See CG-7 on what "reads" means.

## 4. Section 5.4: Foundations module

- **AC-5.4.1** Phase 2, P1.
  Criterion: scoped from the book's Part 2: experimental thinking and uncertainty (Chapter 4), what a model learns and why generalization is not training success (Chapter 5), how foundation models work and fail (Chapter 6): tokens, embeddings, attention as intuition, decoding, failure modes.
  Verify: frontmatter `bookChapters: [4, 5, 6]`. The Topics section names each listed concept.
  Overlay: see CG-8 on Phase 2 versus P1.

- **AC-5.4.2** Phase 2, P1.
  Criterion: every concept is introduced with the decision it affects later and links forward to the area module where it is used.
  Verify: each topic bullet ends with a link of the form `/modules/<slug>#<heading-id>`. `npm run check:content` validates those anchors exist (CG-19).

- **AC-5.4.3** Phase 2, P1.
  Criterion: uses the full module template. The workshop is an analysis exercise on provided artifacts, for example comparing two classifier reports or tracing a tokenization example.
  Verify: `npm run check:content` passes for the foundations file with all six required headings. The workshop references at least one artifact id from the artifacts collection.

- **AC-5.4.4** Phase 2, P1.
  Criterion: no exercise requires training a model. Training a small classifier is offered only as an optional code lab.
  Verify: read Workshop and Failure exercise. Neither asks the learner to run code. Any classifier training appears only under an Optional lab heading.

- **AC-5.4.5** Phase 2, P1.
  Criterion: includes a short mathematical reference (vectors, dot products, probability, expectation, precision, recall, F1, intervals) adapted from the book's appendix brief, as a collapsible section, not a separate module.
  Verify: a `<details>` element inside the foundations page contains all eight items. No module with `kind` other than the five kinds exists. Keyboard: Tab to the `<summary>`, press Enter, content expands.

- **EC-5.4.1** Phase 2, P1.
  Criterion: learners with ML background can skip. The catalog marks the module "recommended before Verification and evals" rather than required.
  Verify: `/modules` shows that phrase on the foundations entry. Verification and evals lists foundations in `prerequisites` and its notice reads as a recommendation, not a block.

## 5. Section 5.5: The six area modules and the module template

### Module template rows

- **MT-5.5.1** Phase 1, P0. Header: title, area, reading time, prerequisites, last updated and last checked dates. Verify: the module layout renders all six from frontmatter. Dates appear as ISO dates.
- **MT-5.5.2** Phase 1 (check), 2 (content), P0. Transfer connection: what the reader already does and what it becomes. Verify: heading text is exactly "Transfer connection" (see CG-4).
- **MT-5.5.3** Phase 1, 2, P0. Topics and learning outcomes: each concept with a stated outcome, coding-agent example, public incidents. Verify: heading text exactly "Topics and learning outcomes".
- **MT-5.5.4** Phase 1, 2, P0. Workshop: required analysis exercise on provided artifacts, no code, free-text response saved to the account. Verify: heading "Workshop" and a `WorkshopResponse` form under it for signed-in learners.
- **MT-5.5.5** Phase 1, 2, P0. Failure exercise: a planted failure the learner diagnoses, built on the area's pitfall. Verify: heading "Failure exercise", a response form, and a hidden explanation revealed after submit.
- **MT-5.5.6** Phase 3, P2. Optional lab: small standalone Python exercise, clearly marked optional, permitted between Failure exercise and Completion evidence. Verify: heading "Optional lab" carries the word "optional" and `npm run check:content` accepts its absence.
- **MT-5.5.7** Phase 1, 2, P0. Completion evidence: the self-check plus the workshop response. Passing the self-check and submitting a response marks the module complete. Verify: heading "Completion evidence" and the self-check island under it. A test asserts completion after both.
- **MT-5.5.8** Phase 1, 2, P0. Sources: sources with dates, vendor facts and artifacts with origin and checked-on labels. Verify: heading "Sources" and every entry has a date.

### Content map rows

- **CM-5.5.1** Phase 2, P0. Models. Talk beat 2.1. Book chapters 6 (failure modes, summarized), 7, 10. Pitfall: a hardcoded model ID with no eval suite behind it. Takeaway: "The model is a versioned, expiring dependency. Treat it like one."
  Verify: frontmatter `talkBeats: ["2.1"]`, `bookChapters: [6, 7, 10]`. The Failure exercise artifact plants a hardcoded model id with no evals. The takeaway sentence appears verbatim in the body.

- **CM-5.5.2** Phase 2, P0. Context and knowledge. Beat 2.2. Chapters 11, 12, 13, 14. Pitfall: adding context instead of curating it. Takeaway: "Context is a budget, not a bucket."
  Verify: as above with `["2.2"]`, `[11, 12, 13, 14]`. The planted failure is an over-filled context.

- **CM-5.5.3** Phase 2, P0. Tools and extensibility. Beat 2.3. Chapter 15. Pitfall: copying the API surface without evaluating task fit. Takeaway: "Design tools for a caller that reads the description every time and can still get it wrong."
  Verify: `["2.3"]`, `[15]`. The planted failure is a tool set mirroring an API surface.

- **CM-5.5.4** Phase 2, P0. Orchestration. Beat 2.4. Chapters 16, 17, 18. Pitfall: multi-agent before a workflow was tried. Takeaway: "The loop is where autonomy gets its limits. Start with the workflow."
  Verify: `["2.4"]`, `[16, 17, 18]`. The planted failure is a multi-agent design where a workflow would do.

- **CM-5.5.5** Phase 2, P0. Verification and evals. Beat 2.5. Chapters 8, 9, 19. Pitfall: a generic judge instead of error analysis; grading the transcript instead of the outcome. Takeaway: "Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes."
  Verify: `["2.5"]`, `[8, 9, 19]`. The planted failure is a generic judge or a transcript grade that misses a bad outcome.

- **CM-5.5.6** Phase 2, P0. Operating it. Beat 2.6. Chapters 23, 24, 25, 26, 27. Pitfall: the lethal trifecta, assembled one integration at a time. Takeaway: "When you are the owner, its answer is your answer."
  Verify: `["2.6"]`, `[23, 24, 25, 26, 27]`. The planted failure assembles the trifecta across integrations.

- **CM-5.5.7** Phase 2 and 3, P0 for the mapping. Chapter 3 becomes the Models optional lab. Chapters 1 and 2 feed orientation. Chapters 20 to 22 and 29 to 30 become electives. Chapter 28 is out of scope.
  Verify: no module lists chapter 28 in `bookChapters`. `labs/models/` references Chapter 3. Elective frontmatter lists 20, 21, 22, 29, 30 one per module.

### Acceptance criteria

- **AC-5.5.1** Phase 2, P0.
  Criterion: all six modules exist, follow the template order, and pass the content build check.
  Verify: `ls src/content/modules/` shows the six area slugs. `npm run check:content` exits 0. Reorder two headings in one file and confirm the check fails on order.

- **AC-5.5.2** Phase 2, P0.
  Criterion: each transfer connection expands the corresponding row of the talk's transfer table and names what stays the same and what changes.
  Verify: each module's Transfer connection names its row (Models: decomposition and systems thinking is not a clean fit; see CG-20), and contains both "stays the same" and "changes" statements.

- **AC-5.5.3** Phase 2, P0.
  Criterion: each topics section includes at least one coding-agent worked example (what the user touched, what the vendor engineered) and at least one sourced public incident or first-hand account. Any tool fact carries its checked-on date.
  Verify: per module, find both examples. Every tool or model name in prose maps to a Sources entry with a `checkedOn` date.

- **AC-5.5.4** Phase 2, P0.
  Criterion: each workshop provides artifacts inline or as downloads, states the task in one paragraph, and gives a rubric. Responses are free text, saved per learner, not graded.
  Verify: per module, the Workshop has artifacts, a one-paragraph task, a rubric list. Submit a response signed in, reload, see it, edit it. No score appears anywhere.

- **AC-5.5.5** Phase 2, P0.
  Criterion: each failure exercise plants the pitfall in an artifact, asks the learner to find and explain it, and reveals an explanation after submit.
  Verify: signed in, the explanation is absent from the HTML before submit (inspect source), and present after. See CG-10 on where the response is stored.

- **AC-5.5.6** Phase 2, P0.
  Criterion: each self-check has 6 to 12 questions with per-question feedback and covers every stated learning outcome at least once.
  Verify: `npm run check:content` enforces 6 to 12 for area modules. Each question's frontmatter carries an `outcome` reference, and the check confirms every outcome id in Topics is referenced by at least one question.

- **AC-5.5.7** Phase 2, P0.
  Criterion: each module's reading time, excluding workshop and lab, is 45 to 90 minutes.
  Verify: frontmatter `readingMinutes` is within 45 to 90 and the schema enforces it for `kind: area`. `npm run check:content` prints a word-count estimate at 220 words per minute for the body minus Workshop, Failure exercise, and Optional lab, and warns when it differs from the declared value by more than 25 percent (CG-21).

- **AC-5.5.8** Phase 2, P0.
  Criterion: each sources section lists every source with a date and links the talk beat and book chapters it draws on.
  Verify: every `sources[]` entry has `date`. The rendered Sources section shows the talk beats and chapter numbers from frontmatter.

- **AC-5.5.9** Phase 2, P0.
  Criterion: prose follows the talk repo's style: short declarative sentences, no em-dashes.
  Verify: `grep -rn $'\xe2\x80\x94' src/content/ docs/ README.md` returns nothing (the escape is the UTF-8 em-dash, written as bytes so this file stays clean). Add the same grep to `npm run check:content`. Spot-read three paragraphs per module for sentence length.

- **EC-5.5.1** Phase 1, P0.
  Criterion: an empty workshop response keeps the module in progress and the form asks for at least a few sentences.
  Verify: submit an empty response and a one-word response. Both are rejected with a message naming the minimum. A test covers the threshold (CG-11 sets it).

- **EC-5.5.2** Phase 1, P0.
  Criterion: passing the self-check before writing the workshop response leaves completion waiting for both.
  Verify: a test passes the self-check, asserts status in progress, saves a response, asserts complete with `completed_at` set. Repeat in the other order.

- **EC-5.5.3** Phase 1 (mechanism), 2 (content), P0.
  Criterion: an artifact whose checked-on date is older than the quarterly window shows a "may be out of date" notice beside it.
  Verify: set an artifact's `checkedOn` to 100 days ago, build, and see the notice beside that artifact and nowhere else. The window is 90 days (A-8).

## 6. Section 5.6: Exercise artifact library with origin labels

- **AC-5.6.1** Phase 1 (schema), 2 (content), P0.
  Criterion: every artifact carries exactly one origin label: `captured`, `synthetic`, or `public`.
  Verify: the artifacts collection schema has `origin: z.enum(['captured', 'synthetic', 'public'])`. Set an invalid value and the build fails.

- **AC-5.6.2** Phase 1, 2, P0.
  Criterion: every artifact carries the tool or model name and version where applicable, and a checked-on date.
  Verify: schema has `tool`, `version` (optional), `checkedOn` (required). The spec example lacks `version`; the schema must add it (CG-13).

- **AC-5.6.3** Phase 1, P0.
  Criterion: labels render visibly beside the artifact and are stored in frontmatter so the build check can verify them.
  Verify: open a module page and see the origin, tool, version, and date beside each artifact. `npm run check:content` fails when a module body references an artifact id not in the collection.

- **AC-5.6.4** Phase 2, P0.
  Criterion: captured artifacts come only from the author's own sessions on non-sensitive tasks and are reviewed for secrets, personal data, and third-party content before publication.
  Verify: each `captured` artifact has `reviewedOn` in frontmatter and the review is recorded in the changelog page. Run a secret scanner over `src/content/artifacts/` (for example `git secrets --scan` or a regex pass for key patterns) and find nothing.

- **AC-5.6.5** Phase 2, P0.
  Criterion: synthetic artifacts are realistic in format (OpenTelemetry-style spans, tool schemas in the shape real agents use) and are never presented as measured results.
  Verify: each `synthetic` artifact renders with a visible label reading "synthetic" and no sentence near it claims a measured result.

- **AC-5.6.6** Phase 2, P0.
  Criterion: public artifacts are excerpted within fair use and link to the original.
  Verify: each `public` artifact has `url` in frontmatter and the excerpt is short relative to the source.

- **AC-5.6.7** Phase 2, P0.
  Criterion: vendor-specific facts in prose carry a checked-on date in the sources section.
  Verify: for each vendor fact in Topics, find a Sources entry with `checkedOn`.

- **EC-5.6.1** Phase 3 (mechanism), P1.
  Criterion: when a captured artifact's tool changes behavior, the artifact keeps its version label and date, and the review pass decides whether to re-capture or replace.
  Verify: `npm run drift` lists the artifact by module once its date is stale. The changelog page records the decision after the first review (Phase 4 in the spec).

- **EC-5.6.2** Phase 1, P0.
  Criterion: an artifact reused across modules is stored once and referenced by id. The label travels with it.
  Verify: reference the same artifact id from two modules and see identical labels on both pages. The module schema uses `reference('artifacts')` (CG-12).

## 7. Section 5.7: Optional code labs

- **AC-5.7.1** Phase 3, P2.
  Criterion: each lab is a standalone directory under `labs/` with `pyproject.toml`, managed with `uv`, formatted and linted with `ruff`, type hints on all functions.
  Verify: `cd labs/<name> && uv sync && uv run ruff check . && uv run ruff format --check .`. `requires-python = ">=3.12"`. Read every `def` for annotations.
  Overlay: Python 3.12 through uv. System Python on the dev machine is 3.9.6, so `uv run` is the only supported entry.

- **AC-5.7.2** Phase 3, P2.
  Criterion: model access goes through one adapter function that takes a task request and returns text, usage, timing, and model identity, with a typed failure. Provider code lives only in the adapter.
  Verify: `grep -rn "anthropic\|openai" labs/*/` matches only the adapter module. The return type is a dataclass or TypedDict with those four fields and a typed error class.

- **AC-5.7.3** Phase 3, P2.
  Criterion: each lab runs in under ten minutes on a laptop and states its expected cost order of magnitude before any paid call.
  Verify: `time uv run python main.py` with a key. The first output line before any call states the cost order.

- **AC-5.7.4** Phase 3, P2.
  Criterion: each lab has a pytest test that exercises the non-model logic without an API key.
  Verify: `env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY uv run pytest` passes.

- **AC-5.7.5** Phase 3, P2.
  Criterion: labs are marked optional everywhere they appear and never count toward completion.
  Verify: every lab heading and catalog mention includes "optional". A test asserts completion depends only on self-check and workshop.

- **AC-5.7.6** Phase 3, P2.
  Criterion: labs teach explicit model calls before any abstraction.
  Verify: the first model call in each lab is a direct SDK call through the adapter. No agent framework in `pyproject.toml`.

- **AC-5.7.7** Phase 3, P2.
  Criterion: labs exist at minimum for Models (Chapter 3), Tools (a tool contract with validation), and Verification and evals (reviewing 20 to 50 outputs and a first grader).
  Verify: `ls labs/` shows `models`, `tools`, `evals` (or equivalent names). Each README states its concept.

- **EC-5.7.1** Phase 3, P2.
  Criterion: no API key present: the lab explains what it would do and exits cleanly.
  Verify: run without keys. Exit code 0. No traceback. A message describes the lab.

- **EC-5.7.2** Phase 3, P2.
  Criterion: a provider error mid-lab shows the adapter's typed failure and the lab suggests the retry.
  Verify: a test injects an adapter that raises the typed failure and asserts the printed message names it and suggests a retry.

## 8. Section 5.8: Self-check component

- **AC-5.8.1** Phase 1, P0.
  Criterion: questions are multiple choice with one or more correct options and a feedback paragraph per option.
  Verify: the frontmatter schema requires `options[]`, `correct[]` (non-empty), and `feedback[]` of equal length to `options`. The island renders radio inputs for single-correct and checkboxes for multi-correct.

- **AC-5.8.2** Phase 1, P0.
  Criterion: feedback shows immediately after each answer and the learner may retry.
  Verify: answer wrong, see feedback at once with no network round trip (check the Network panel), then change the answer and submit again.

- **AC-5.8.3** Phase 1, P0.
  Criterion: passed when every question has been answered correctly, allowing retries. Attempts and final state saved per learner.
  Verify: a test on the self-check Action asserts `passed` becomes true only when all questions are correct, `attempts` increments per submit, and `answers` stores the last state. The island shows "passed" only then.

- **AC-5.8.4** Phase 1, P0.
  Criterion: fully keyboard operable. Focus order follows reading order. Options reachable with Tab and selectable with Space or Enter. Feedback announced to assistive technology.
  Verify: from the page top, press Tab until the first option, then Arrow keys within a radio group, Space to select, Tab to the check button, Enter. Feedback lands in an element with `role="status"` or `aria-live="polite"`. A `@testing-library/preact` test with `user-event` covers the sequence. VoiceOver reads the feedback (manual pass at the Phase 1 gate).

- **AC-5.8.5** Phase 1, P0.
  Criterion: questions and answers live in the module's content file, not in application code.
  Verify: `grep -rn "question" src/components/ src/lib/` finds no question text. The island receives `selfCheck` as a prop from frontmatter.

- **AC-5.8.6** Phase 1, P0.
  Criterion: anonymous readers can take the orientation self-check with results held only in the browser.
  Verify: signed out, complete the orientation self-check. The Network panel shows no Action call. `localStorage` holds the state. Reload and see it restored.

- **EC-5.8.1** Phase 1, P0.
  Criterion: network failure on submit keeps the answer locally and resubmits. The learner sees a pending state, not an error.
  Verify: go offline in DevTools, answer, see "pending", go online, see the state saved and the Action call in the Network panel.

- **EC-5.8.2** Phase 1 (mechanism), 2 (policy), P0.
  Criterion: a content update that changes a question after a learner passed leaves their pass standing and changes the module's checked-on date.
  Verify: change a question, rebuild, sign in as a learner who passed, and see "passed" still. The self-check Action keys on module slug, not question text. The changelog notes the date change.

## 9. Section 5.9: Accounts, progress, and data deletion

- **AC-5.9.1** Phase 1, P0.
  Criterion: sign-in is OAuth through a managed auth library. No passwords stored or handled.
  Verify: `src/lib/auth.ts` configures `socialProviders.github` and `socialProviders.google` and no `emailAndPassword`. `/sign-in` shows two buttons. Complete a GitHub sign-in and a Google sign-in against a dev app registration.
  Overlay: providers are GitHub and Google. GitHub needs the `user:email` scope. A GitHub user with a private primary email returns `email: null`; the implementation must use `mapProfileToUser` or the `/user/emails` fallback so the account has an email (needed by AC-5.9.5). A test or manual check covers a private-email GitHub account.

- **AC-5.9.2** Phase 1, P0.
  Criterion: stored personal data is limited to provider subject id, email, display name, progress, workshop responses, self-check results, and self-assessment. Nothing else.
  Verify: `src/db/schema.ts` and the Better Auth tables. Better Auth stores `image`, `ipAddress`, `userAgent`, `accessToken`, `refreshToken` by default. The implementation nulls those through `databaseHooks` or documents them in the privacy notice (CG-14). Query a signed-in user's rows in pglite tests and assert those columns are null.

- **AC-5.9.3** Phase 1, P0.
  Criterion: progress is recorded per module: started-at, completed-at, status.
  Verify: `module_progress` has those columns. A test asserts `started_at` on first write and `completed_at` on completion. CG-22 fixes what "started" means.

- **AC-5.9.4** Phase 1, P0.
  Criterion: workshop responses and self-assessment output are editable after submission.
  Verify: save a response, reload, edit, save, reload. The latest text shows. The same for the plan on `/assessment` (Phase 3).

- **AC-5.9.5** Phase 1, P0.
  Criterion: an account page shows all stored data in plain language and offers one-click deletion. Deletion removes all rows within the same request and signs the learner out. Notify subscriptions with the same email are removed too.
  Verify: `/account` lists every table's rows for the user in prose. Press the delete button. A test asserts, inside one transaction, that `module_progress`, `workshop_response`, `self_check_result`, `self_assessment`, `notify_subscriber` (by email), and the Better Auth `user`, `session`, `account` rows are gone, and that the response clears the session cookie. See CG-9 on Better Auth's `deleteUser` and fresh-session rule.

- **AC-5.9.6** Phase 1, P0.
  Criterion: the privacy notice covers accounts, progress data, the notify list, and deletion.
  Verify: read `/privacy` and find the four topics.

- **AC-5.9.7** Phase 1, P0.
  Criterion: session handling, CSRF protection, and secure cookies are the auth library's defaults, not custom code.
  Verify: `src/lib/auth.ts` sets no `disableCSRFCheck`, no custom cookie attributes, and `trustedOrigins` is the final domain only. `astro.config.mjs` leaves `security.checkOrigin` at its default of true (this is what protects Actions). Cookies in production carry `Secure`, `HttpOnly`, `SameSite=Lax` (check the response headers on the deployed site).

- **EC-5.9.1** Phase 1, P0.
  Criterion: the same person signing in with two providers gets two accounts. Merging is out of scope and the account page says so.
  Verify: Better Auth `account.accountLinking.enabled` is false. Sign in with both providers using the same email and see two users. `/account` states that merging is not offered.

- **EC-5.9.2** Phase 1, P0.
  Criterion: provider revokes access or the email changes: the account keeps the subject id and the learner can update the display name.
  Verify: `/account` has a display-name form backed by an `updateDisplayName` Action with a test. The `account` table's `accountId` is the key that survives. CG-23 adds this Action to the test list.

- **EC-5.9.3** Phase 1, P0.
  Criterion: deletion requested while a request is in flight makes the in-flight write fail closed.
  Verify: every app table has `user_id` with a foreign key to the Better Auth user table and `ON DELETE CASCADE`. A test deletes the user then attempts a workshop save with the stale session and asserts the Action returns an error and no row exists.

## 10. Section 5.10: Guided self-assessment and personal plan

- **AC-5.10.1** Phase 3, P1.
  Criterion: the closing module walks through each of the six areas, presenting the transfer items and the new competencies for that area, and asks for a four-point rating per item (not yet, aware, practiced, confident).
  Verify: `/assessment` shows six steps. Each step lists that area's transfer items and competencies from the closing module's frontmatter. Each item has four radio options with those labels. CG-17 fixes the competency-to-area mapping.

- **AC-5.10.2** Phase 3, P1.
  Criterion: three context questions: current role, the AI feature closest to at work, whether they own a model-dependent system today.
  Verify: the three questions appear once, before or after the ratings. Their answers are saved in `self_assessment.context`.

- **AC-5.10.3** Phase 3, P1.
  Criterion: the plan ranks areas by gap (lowest ratings on new competencies first) and applies the four-step roadmap to the learner's context for the top areas: look before you build (review 20 to 50 outputs by hand), start constrained, own the harness, add autonomy as evals earn it.
  Verify: rate one area "not yet" on every new item and the rest "confident". The plan lists that area first and contains four steps with those names, referencing the stated feature.

- **AC-5.10.4** Phase 3, P1.
  Criterion: each plan step links back to the module section that teaches it.
  Verify: each step has a link to `/modules/<slug>#<heading-id>`. `npm run check:content` validates the anchors (CG-19).

- **AC-5.10.5** Phase 3, P1.
  Criterion: the plan is saved to the account, editable, and exportable as Markdown.
  Verify: edit the plan text, reload, see the edit. Press export and receive `text/markdown` with `Content-Disposition: attachment`. The file contains the learner's text unrendered.

- **AC-5.10.6** Phase 3, P1.
  Criterion: the module ends with an optional feedback form (free text) that feeds the qualitative metric.
  Verify: the form is last, labelled optional, and submits through a `feedback` Action with a test. CG-15 fixes where feedback is stored.

- **AC-5.10.7** Phase 3, P1.
  Criterion: completing the assessment is possible without completing every area module, with a notice recommending the missing ones.
  Verify: with a fresh account, complete the assessment. It saves. A notice names the six modules not complete.

- **EC-5.10.1** Phase 3, P1.
  Criterion: uniform high ratings produce a plan that says so and suggests the electives and the book blueprint's build track.
  Verify: rate everything "confident". The plan states the result, links `/modules#electives`, and links the book blueprint.

- **EC-5.10.2** Phase 3, P1.
  Criterion: a retake keeps the previous plan as a dated version for comparison.
  Verify: complete the assessment twice. `/assessment` shows two versions with dates. `self_assessment` has two rows for the user with `version` 1 and 2 (CG-18).

## 11. Section 5.11: Elective modules

- **AC-5.11.1** Phase 3, P2.
  Criterion: electives use the full module template.
  Verify: `npm run check:content` treats `kind: elective` like `kind: area` for headings and the 6 to 12 question rule (CG-24).

- **AC-5.11.2** Phase 3 (first two), P2.
  Criterion: planned electives: Fine-tuning, distillation, and model adaptation (20); Inference and hosting fundamentals (21); Multimodal systems (22); Working on an AI engineering team (29); Building your career and continuing to learn (30).
  Verify: at least two of the five exist by the end of Phase 3 with those titles and `bookChapters`. The landing page lists all five by name (AC-5.1.1).

- **AC-5.11.3** Phase 1 (schema), P0 for the rule.
  Criterion: electives never appear as prerequisites for core modules.
  Verify: `npm run check:content` fails if a non-elective module lists an elective slug in `prerequisites`. Test it by adding one.

- **AC-5.11.4** Phase 3, P2.
  Criterion: the authoring order is an open question.
  Verify: `docs/decisions.md` or the Phase 3 commit message records the chosen order. Nothing else to grade.

- **EC-5.11.1** Phase 3, P2.
  Criterion: an elective whose workshop needs an experiment the learner cannot run analyzes supplied reproducible experiment records instead, labelled by origin.
  Verify: the fine-tuning elective's workshop references artifacts with `origin` set and no instruction to run training.

## 12. Section 5.12: Content maintenance and drift review

- **AC-5.12.1** Phase 3, P1.
  Criterion: a script lists every artifact and dated source whose checked-on date is older than 90 days, grouped by module.
  Verify: `npm run drift` prints groups by module slug. Set one artifact date to 91 days ago and one source to 89 days ago. Only the artifact appears.

- **AC-5.12.2** Phase 3 (page), P1. First run Phase 4 in the spec.
  Criterion: the quarterly review updates dates, replaces or re-captures stale artifacts, and records what changed in a changelog page visible to learners.
  Verify: `/changelog` exists, renders without sign-in, and is generated from a content file. The first entry may be the launch.

- **AC-5.12.3** Phase 1, P0 (rendering), P1 for the feature.
  Criterion: module pages show last-updated and last-checked dates in the header.
  Verify: open any module and see both dates from `updatedOn` and `checkedOn`.

- **AC-5.12.4** Phase 3, P1.
  Criterion: a build warning, not failure, for any date older than 180 days.
  Verify: set `checkedOn` to 181 days ago, run `npm run build`, see a warning line, and exit code 0.

- **EC-5.12.1** Phase 3, P1.
  Criterion: a public source that disappears keeps its quote and gains an "archived on" note with an archive link.
  Verify: the artifact and source schemas have optional `archivedOn` and `archiveUrl`. When set, the page renders "archived on" beside the link.

## 13. Section 6: Non-functional requirements

### 6.1 Performance

- **NFR-6.1.1** Phase 0 (landing), 1 (orientation, catalog), P0.
  Criterion: landing, orientation, and catalog pages are statically generated and ship no JavaScript beyond what the self-check needs.
  Verify: `dist/client/index.html` and the orientation output contain only the self-check island script (orientation) and the theme toggle inline script. The catalog output contains only the toggle. See CG-5: the catalog renders on demand and the orientation is prerendered.
  Overlay: the theme toggle inline script is an accepted addition.

- **NFR-6.1.2** Phase 1, P0.
  Criterion: signed-in module pages render on demand with a target under 500 ms server time at expected scale.
  Verify: `curl -o /dev/null -s -w '%{time_starttransfer}\n' -b session=<cookie> https://<domain>/modules/models` under 0.5 s on three tries. Module pages have no `prerender = true`.

- **NFR-6.1.3** Phase 1, P0.
  Criterion: self-check interactions respond locally and persistence is asynchronous.
  Verify: the Network panel shows feedback rendered before the Action request completes. The Action call does not block the UI.

- **NFR-6.1.4** Phase 0, 2, P0.
  Criterion: images and diagrams are optimized SVG or WebP with explicit dimensions.
  Verify: `find public src/assets -name '*.png' -o -name '*.jpg'` returns nothing. Every `<img>` and inline `<svg>` has `width` and `height`. The mini-maps from the talk repo are 160 by 90 with a 1920 by 1080 viewBox.

### 6.2 Security

- **NFR-6.2.1** Phase 1, P0.
  Criterion: OAuth only, no password storage, auth library defaults for sessions and CSRF.
  Verify: same as AC-5.9.1 and AC-5.9.7.

- **NFR-6.2.2** Phase 1, P0.
  Criterion: data minimization per 5.9. No analytics identifiers tied to accounts.
  Verify: no analytics script anywhere (`grep -rn "analytics\|gtag\|plausible\|umami" src/`). If a cookieless provider is adopted later, it must not receive the user id.

- **NFR-6.2.3** Phase 1, P0.
  Criterion: all learner-submitted text renders as plain text, never HTML or Markdown.
  Verify: save a workshop response containing `<script>alert(1)</script> **bold** [x](y)`. The page shows it literally. The account page shows it literally. The Markdown export contains it literally and is served as a download, not rendered.

- **NFR-6.2.4** Phase 0, P0.
  Criterion: secrets (database URL, OAuth client secrets, email API key) live in the host's environment and never in the repository.
  Verify: `git log -p | grep -i -E 'postgres://|client_secret|BETTER_AUTH_SECRET='` finds no values. `.env` is gitignored. `.env.example` lists names only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NOTIFY_TOKEN_SECRET`, `HOST`, `PORT`. The runbook stores them as an OpenShift Secret.
  Overlay: no email API key yet. The RDS CA bundle is public and may live in the image.

- **NFR-6.2.5** Phase 0 (notify-me), 1 (workshop), P0.
  Criterion: the notify-me and workshop Actions are rate limited per IP and per account.
  Verify: a test calls subscribe eleven times from one IP inside the window and asserts the last is rejected. A test calls workshop save past the per-account limit and asserts rejection. `src/lib/rate-limit.ts` reads the client IP from the first `x-forwarded-for` value. See CG-25: Better Auth's limiter does not cover Actions, so this is application code.
  Overlay: one server process, so an in-memory limiter is acceptable and resets on pod restart.

### 6.3 Scalability

- **NFR-6.3.1** Phase 0, P0.
  Criterion: expected load is hundreds to low thousands of learners with spikes after the talk and newsletter mentions.
  Verify: the runbook states the replica count (1), CPU and memory requests, and the RDS instance class. `pg` Pool `max` is set (10 or fewer) so a spike cannot exhaust RDS connections.

- **NFR-6.3.2** Phase 0, P0.
  Criterion: the free hosting tier and a small managed Postgres instance suffice. Nothing assumes more than one server process.
  Verify: no code relies on shared memory across processes beyond the rate limiter and the retry state, both documented as single-process. The deployment has `replicas: 1`.
  Overlay: OpenShift replaces the free tier. RDS is the small managed instance.

### 6.4 Accessibility

- **NFR-6.4.1** Phase 0 onward, P0.
  Criterion: WCAG 2.1 AA across the site.
  Verify: `npm run check:a11y` (Playwright plus axe, `wcag2a` and `wcag2aa` tags) passes on `/`, `/modules/models`, and the self-check island in both themes.

- **NFR-6.4.2** Phase 1, P0.
  Criterion: one `h1` per page and a strict heading hierarchy matching the module template.
  Verify: the layout renders the `h1`. `npm run check:content` fails on any `# ` heading in an MDX body. Template sections are `h2`, subsections `h3`. axe reports no heading-order violation.

- **NFR-6.4.3** Phase 0 (anatomy diagram), 1 (mini-maps), P0.
  Criterion: text alternatives for the anatomy diagram and every mini-map variant. Long descriptions for diagrams that carry meaning.
  Verify: the anatomy SVG has `role="img"`, `aria-labelledby` pointing to a `<title>` and `<desc>`, and a visible or linked long description of the six areas and their arrangement. Each of the six mini-map variants has `aria-label` naming the highlighted area. The source SVGs in the talk repo have none of this, so it is site work.

- **NFR-6.4.4** Phase 1, P0.
  Criterion: self-checks, progress controls, and forms fully keyboard operable with visible focus.
  Verify: Tab through `/modules/models` signed in. Every control receives a visible focus ring (the design brief's focus ring uses the text color). Nothing is skipped or trapped. The manual pass is a Phase 1 gate item.

- **NFR-6.4.5** Phase 0, P0.
  Criterion: verified color contrast. If the dark palette is adopted, contrast is checked per the design brief's color roles.
  Verify: run the contrast script at `scratchpad/research/contrast.mjs` against the site's CSS tokens, or read `scratchpad/research/contrast-output.md`. Then confirm in CSS: dark theme never sets blue `#1064f8` as text on the surface `#303236` (2.57) or as normal-size text on the background (3.62); light theme uses the text variants `#c70093`, `#025bef`, `#017b48`, `#916100` for colored text, never the deck hexes for pink, green, or amber text; text on solid area blocks is `#fffcf5` on blue and `#14161c` on pink, green, amber; hairlines are decorative only.
  Overlay: the dark palette is adopted and a light theme is added. Both must pass. The anatomy diagram is drawn for the dark ground; on the light theme it sits in a dark card (`#14161c` on `#fffcf5` is 17.65) or a light variant is generated (CG-26).

- **NFR-6.4.6** Phase 0, P0.
  Criterion: reduced-motion preference respected. No content depends on animation.
  Verify: `grep -rn "prefers-reduced-motion" src/styles/` finds a rule that disables transitions. Emulate reduced motion in DevTools and confirm nothing is hidden.

### 6.5 Content quality and testing

- **NFR-6.5.1** Phase 1, P0.
  Criterion: the build fails if any non-draft module lacks a required section, has frontmatter that fails the schema, references an artifact without an origin label or checked-on date, or has a self-check with fewer than six questions (area and foundations).
  Verify: `npm run build` runs `check:content` first. Break each of the four conditions in turn and confirm a non-zero exit with a message naming the file. Draft modules are skipped.

- **NFR-6.5.2** Phase 0 (subscribe, confirm, unsubscribe), 1 (the rest), P0.
  Criterion: automated tests for every Action (notify-me subscribe and confirm, progress update, workshop save, self-check result, self-assessment save, account deletion) and for the auth guard on signed-in routes.
  Verify: `npm test` runs vitest against pglite and lists a test file per Action plus `tests/auth-guard.test.ts` that requests `/account` and `/assessment` without a session and expects a redirect to sign-in, and requests an Action without a session and expects an error. Add unsubscribe, updateDisplayName, and feedback (CG-23).
  Overlay: tests use `@electric-sql/pglite` through `drizzle-orm/pglite`. The same schema and migrations run on pglite and on RDS. A probe project exists at `scratchpad/drz/` (`npx tsx src/smoke.ts`). The dependency needs the author's approval and must appear in `docs/dependencies.md`.

- **NFR-6.5.3** Phase 1 (CI), P0. Manual pass at the Phase 1 and Phase 2 gates.
  Criterion: an automated accessibility audit runs on the landing page, one module page, and the self-check component in CI. A manual keyboard pass is part of the Phase 1 and Phase 2 gates.
  Verify: the CI workflow file runs `npm run check:a11y` on every push to `main`. The gate record (commit message or `docs/gates.md`) names who did the keyboard pass and on which pages. CG-27 decides where CI runs now that Netlify is gone.

### 6.6 Privacy

- **NFR-6.6.1** Phase 0, P0.
  Criterion: the privacy notice is published before the notify-me form goes live.
  Verify: `/privacy` is in the Phase 0 commit and reachable from `/` on the deployed site.

- **NFR-6.6.2** Phase 0, P0 (deferred).
  Criterion (spec): confirmed opt-in for the notify list and unsubscribe in every email.
  Verify: the confirm and unsubscribe endpoints work (AC-5.1.3, AC-5.1.4). No notification is sent to an unconfirmed address (there is no sender yet, so this is a code review of the future send path, which must filter on `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`).
  Overlay: confirmed opt-in is deferred until a provider is chosen. The privacy notice says so.

- **NFR-6.6.3** Phase 1, P0.
  Criterion: self-service deletion covering all learner data.
  Verify: same as AC-5.9.5.

- **NFR-6.6.4** Phase 0, P0.
  Criterion: no third-party trackers. Page analytics, if adopted, are cookieless and aggregate only.
  Verify: load `/` with the Network panel open. Only same-origin requests and Google Fonts, if any. Response has no third-party `Set-Cookie`.

## 14. Section 7.6: Technical constraints

- **TC-7.6.1** Phase 1, P0.
  Criterion: Astro 7 removed `@astrojs/db`. Use Drizzle directly.
  Verify: `package.json` has no `@astrojs/db`. `src/db/schema.ts` imports from `drizzle-orm/pg-core`.

- **TC-7.6.2** Phase 1, P0.
  Criterion: Astro 7's Markdown pipeline replaced remark and rehype. The compiler is stricter about unclosed tags. Decide the toolchain before authoring the first module.
  Verify: `package.json` has `@astrojs/mdx` and no `@astrojs/markdown-remark`, `remark-*`, or `rehype-*`. `astro.config.mjs` sets no `markdown.remarkPlugins` or `rehypePlugins`. `docs/decisions.md` records the choice: Sätteri default pipeline with MDX.
  Overlay: decided. MDX through `@astrojs/mdx` on Astro's default Sätteri pipeline. Preact islands only for the self-check and the self-assessment.

- **TC-7.6.3** Phase 1, P0.
  Criterion: Astro ships one major version per year with a two-year window. Budget one upgrade per year.
  Verify: `package.json` pins exact versions (no `^`) for astro and its integrations. `package-lock.json` is committed. `docs/deploy-runbook.md` has an "annual upgrade" section.

- **TC-7.6.4** Phase 1, P0.
  Criterion: keep marketing and orientation pages prerendered. Render module pages on demand rather than with server islands.
  Verify: `index.astro`, `privacy.astro`, and the orientation route export `prerender = true`. `grep -rn "server:defer" src/` returns nothing. Module routes have no `prerender = true`. See CG-5 for the catalog.

- **TC-7.6.5** Phase 0, P0.
  Criterion: the hosting runtime is Node, not an edge isolate.
  Verify: `astro.config.mjs` has `adapter: node({ mode: 'standalone' })`. The Dockerfile's `CMD` is `node ./dist/server/entry.mjs`. The base image is Node 24.
  Overlay: OpenShift running the standalone Node server in a container. The Dockerfile must run as a non-root user and tolerate OpenShift's arbitrary UID (files owned by group 0 and group-writable where written at runtime). `EXPOSE 8080` and `ENV HOST=0.0.0.0 PORT=8080`.

- **TC-7.6.6** Phase 1, P0.
  Criterion: learner-submitted text is stored and rendered as plain text only.
  Verify: same as NFR-6.2.3. Columns are `text`, not `json` holding HTML.

- **TC-7.6.7** Phase 0 onward, P0.
  Criterion: no new dependency without the author's explicit approval.
  Verify: `docs/dependencies.md` lists every entry in `package.json` and each lab's `pyproject.toml` with the approval date. `diff <(jq -r '.dependencies,.devDependencies | keys[]' package.json | sort) <(grep -o '^- `[^`]*`' docs/dependencies.md | tr -d '- `' | sort)` is empty.
  Overlay: the decisions pre-approve astro, @astrojs/node, @astrojs/mdx, @astrojs/preact, preact, drizzle-orm, drizzle-kit, pg, better-auth. Flagged for approval: @electric-sql/pglite. Also needing approval before use: vitest, @testing-library/preact, jsdom, @playwright/test, @axe-core/playwright, @types/pg, typescript, @astrojs/check, @better-auth/cli (or hand-written auth schema), and any Python packages in the labs.

## 15. Section 9.2: Platform-done checklist

Nothing not on this list is built in Phase 1. Phase 1 ends with one commit on `main`.

- **PD-9.2.1** Phase 1, P0. OAuth sign-in and sign-out through the auth library. Auth guard on signed-in routes.
  Verify: `/sign-in` offers GitHub and Google. Sign in, see the account link, sign out, and `/account` redirects. `tests/auth-guard.test.ts` passes.
  Overlay: GitHub and Google.

- **PD-9.2.2** Phase 1, P0. Content collections with the module and artifact schemas from Section 7.3.
  Verify: `src/content.config.ts` defines `modules` and `artifacts` with the fields in 7.3 plus `version`, `reviewedOn`, `archivedOn`, `archiveUrl`, and an `outcome` id per self-check question.

- **PD-9.2.3** Phase 1, P0. Module page layout rendering the template sections, header dates, artifact labels, and prerequisite notices.
  Verify: open the orientation module and a fixture area module. See the header dates, section headings in order, an artifact with its label, and a prerequisite notice on a fresh account.

- **PD-9.2.4** Phase 1, P0. Catalog page with progress status.
  Verify: AC-5.2.1 and AC-5.2.2.

- **PD-9.2.5** Phase 1, P0. Progress, workshop, and self-check Actions with tests.
  Verify: `npm test` shows passing tests for `progress`, `workshop`, `selfCheck`.

- **PD-9.2.6** Phase 1, P0. Self-check island meeting Section 5.8 and the keyboard requirements.
  Verify: AC-5.8.1 to AC-5.8.6 and the keyboard sequence in AC-5.8.4.

- **PD-9.2.7** Phase 1, P0. Account page with data view and one-click deletion, with tests.
  Verify: AC-5.9.5 and the deletion test.

- **PD-9.2.8** Phase 1, P0. Content build check per Section 6.5.
  Verify: NFR-6.5.1.

- **PD-9.2.9** Phase 1, P0. Accessibility audit in CI.
  Verify: NFR-6.5.3.

Phase 1 gate (spec 9.2): architecture and auth review before any learner data is accepted; manual keyboard and screen-reader pass on the self-check and account pages; the checklist is closed. Verify: the Phase 1 commit message or `docs/gates.md` records all three.

## 16. Section 13.1: Assumptions

| Id | Assumption | Honor | Note |
|---|---|---|---|
| A-1 | Workshop responses are free text, saved to the account, not graded. Completion needs a response beyond a few sentences plus a passed self-check. | Yes | "A few sentences" needs a number. CG-11. |
| A-2 | Self-checks use mastery (every question eventually correct, retries allowed), not a percentage. | Yes | AC-5.8.3. |
| A-3 | Modules are not hard-gated. Prerequisites are advisory. The catalog shows the recommended order. | Yes | AC-5.2.4. |
| A-4 | Each area's failure exercise is built on that area's pitfall from the talk. | Yes | CM-5.5.1 to CM-5.5.6. |
| A-5 | The self-assessment uses a four-point scale and ranks areas by gap on new competencies. | Yes | AC-5.10.1, AC-5.10.3. |
| A-6 | Optional labs exist for Models, Tools, and Verification and evals first. | Yes | AC-5.7.7. |
| A-7 | Reading time per area module is 45 to 90 minutes excluding workshop and lab. | Yes | AC-5.5.7. |
| A-8 | The quarterly review window is 90 days, with a warning at 180. | Yes | AC-5.12.1, AC-5.12.4, EC-5.5.3. |

No decision changes any assumption.

## 17. Contradictions and gaps

Each entry names the issue, where it lives, and a recommended resolution. Reviewers grade against the resolution unless the author overrides it.

- **CG-1. Zero-JS form on a prerendered page.**
  Where: AC-5.1.6, NFR-6.1.1, TC-7.6.4 want `/` prerendered. Astro's Actions docs say a page must be on-demand rendered to call an action from an HTML form action.
  Resolution: keep `/` prerendered. Point the form at an on-demand route: `<form method="POST" action={'/notify' + actions.subscribe}>`. `/notify` is on demand, reads `Astro.getActionResult(actions.subscribe)`, and redirects to `/notify/thanks` (POST, redirect, GET). The success page must not reveal whether the address was already on the list.

- **CG-2. "Seven competencies in priority order" versus the talk's unranked list.**
  Where: AC-5.3.2. The talk outline 3.2 says "in display order without ranking".
  Resolution: orientation presents the seven in the talk's display order and states that they are unranked. If the author wants a priority order for the program, it goes in `docs/decisions.md` and orientation labels it as the program's own ordering.

- **CG-3. Resources slide number.**
  Where: AC-5.1.7, spec 9.1 says slide 24. The talk repo's `slides/section-3/24-the-roadmap.md` is the roadmap and `25-resources.md` is the resources slide.
  Resolution: the URL or QR code goes on slide 25. Fix the number in the spec's Phase 0 table.

- **CG-4. Section heading names differ from the book template.**
  Where: MT-5.5.2, MT-5.5.8, spec 5.5 says the modules follow the book's template "exactly". The book renders "Software-engineering connection" and "Further reading". The spec's 7.3 lists "Transfer connection" and "Sources".
  Resolution: the build check matches the spec 7.3 heading text exactly. "Exactly" means order and function, not the book's wording.

- **CG-5. Static catalog cannot show per-user progress.**
  Where: NFR-6.1.1 says the catalog is statically generated. AC-5.2.2 and PD-9.2.4 require progress status when signed in. TC-7.6.4 forbids server islands.
  Resolution: the catalog renders on demand. It ships no JavaScript and reads the session from `locals`. Send `Cache-Control: private, no-store` when a session exists and `public, max-age=300` otherwise. Orientation stays prerendered. Its "Mark orientation complete" control is a POST form to an on-demand route (same pattern as CG-1), and the current status shows on the catalog and account page, not on the orientation page.

- **CG-6. Theme toggle needs JavaScript on every page.**
  Where: the palette decision adds a toggle. NFR-6.1.1 allows no JavaScript beyond the self-check.
  Resolution: one inline script under 1 KB, no framework, that reads `localStorage` and sets `data-theme` on `<html>` before first paint. `prefers-color-scheme` works with the script blocked. This is the only exception and it is recorded in `docs/decisions.md`.

- **CG-7. What marks orientation complete.**
  Where: EC-5.3.1 says a signed-in reader "gets it marked complete". AC-5.3.4 says the self-check does not count. Orientation has no workshop. MT-5.5.7 defines completion as self-check plus workshop.
  Resolution: orientation completion is an explicit "Mark orientation complete" control at the end of the page for signed-in learners. No scroll tracking. The Completion evidence section of orientation says that reading is the evidence and the self-check is optional.

- **CG-8. Foundations is P1 but required to close Phase 2.**
  Where: 5.4 says P1 (end of Phase 3). 9.3's completion criteria list foundations among the Phase 2 deliverables.
  Resolution: treat foundations as a Phase 2 deliverable. If it slips, Phase 2 cannot close under 9.3, so the author should either move it to Phase 3 in 9.3 or raise it to P0. Recommend raising to P0 for Phase 2 since Verification and evals lists it as a prerequisite.

- **CG-9. Account deletion in one request.**
  Where: AC-5.9.5. Better Auth's `deleteUser` removes only its own `user`, `session`, `account` rows, requires `user.deleteUser.enabled`, and applies a fresh-session check (default 1 day) that would block OAuth users who signed in earlier.
  Resolution: one `deleteAccount` Action that requires a valid session and runs a single Drizzle transaction: delete `notify_subscriber` by the user's email, then delete the Better Auth `user` row, with every app table and the Better Auth `session` and `account` tables cascading through `ON DELETE CASCADE`. Do not call `auth.api.deleteUser`, so the fresh-session rule does not apply. Clear the session cookie in the same response. The FK constraints also satisfy EC-5.9.3.

- **CG-10. Failure exercise responses have no home in the data model.**
  Where: AC-5.5.5 asks for a submitted response before revealing the explanation. Section 7.4 has only `WORKSHOP_RESPONSE` keyed by module.
  Resolution: add a `kind` column (`workshop`, `failure`) to `workshop_response` with a unique key on `(user_id, module_slug, kind)`. Completion depends only on `kind = 'workshop'`. The reveal is server-side: the explanation is rendered only when a `failure` row exists.

- **CG-11. "A few sentences" has no number.**
  Where: EC-5.5.1, A-1.
  Resolution: a minimum of 200 characters after trimming, defined once in `src/lib/limits.ts`, shown in the form's help text, enforced in the Action's Zod schema, and covered by a test at 199 and 200 characters.

- **CG-12. Artifacts inline in module frontmatter versus a shared library.**
  Where: 7.3 shows `artifacts:` inside the module. EC-5.6.2 says an artifact is stored once and referenced by id. PD-9.2.2 says "module and artifact schemas".
  Resolution: a separate `artifacts` collection (one file per artifact with id, origin, tool, version, checkedOn, url, reviewedOn, archivedOn, archiveUrl, and the body). Module frontmatter lists `artifacts: [id, ...]` with `reference('artifacts')`. The rendered label reads from the artifact file.

- **CG-13. Artifact version field missing from the example schema.**
  Where: AC-5.6.2 requires a version where applicable. The 7.3 example has `tool` but no `version`.
  Resolution: add optional `version: z.string()` to the artifact schema. The build check warns when `origin: captured` has no version.

- **CG-14. Better Auth stores more than the spec allows.**
  Where: AC-5.9.2 says "Nothing else". Better Auth's default tables hold `image`, session `ipAddress` and `userAgent`, and provider `accessToken`, `refreshToken`, `idToken`.
  Resolution: `databaseHooks.user.create.before` drops `image`; `databaseHooks.session.create.before` nulls `ipAddress` and `userAgent`; `databaseHooks.account.create.before` and `update.before` null the tokens (the app never calls provider APIs after sign-in). The privacy notice lists the remaining Better Auth fields (id, name, email, emailVerified, createdAt, updatedAt, provider id, provider account id, session expiry). Tests assert the nulls.

- **CG-15. Feedback form storage conflicts with data minimization.**
  Where: AC-5.10.6 stores free-text feedback. AC-5.9.2 lists what may be stored and says nothing else. Section 7.4 has no feedback table.
  Resolution: a `feedback` table with `id`, `body`, `created_at` and no `user_id`. The form says the feedback is anonymous. The privacy notice mentions it. It is not shown on the account page and not deleted with the account because it is not linked.

- **CG-16. Token lifetimes are unspecified.**
  Where: AC-5.1.3, AC-5.1.4, EC-5.1.2.
  Resolution: HMAC-SHA256 tokens over `purpose:email:issuedAt` with `NOTIFY_TOKEN_SECRET`. Confirm tokens are valid for 30 days. Unsubscribe tokens do not expire. Invalid or expired tokens render a generic page that does not reveal list membership.

- **CG-17. Competency-to-area mapping is undefined.**
  Where: AC-5.10.1, AC-5.10.3 rank areas by ratings on "what is new" items relevant to each area. The talk lists seven competencies without assigning them to areas, and spreads cost and latency across four areas.
  Resolution: the closing module's frontmatter declares, per area, its transfer items and its competencies: Models gets model behavior intuition and cost and latency; Context gets context engineering; Tools gets tool design; Orchestration gets harness and loop design; Verification gets evals and error analysis; Operating gets AI security and cost and latency. Cost and latency appears twice by design. The mapping lives in content, not code.

- **CG-18. Self-assessment versions versus a one-to-one relation.**
  Where: EC-5.10.2 keeps dated versions. The ER diagram draws `USER ||--o| SELF_ASSESSMENT`.
  Resolution: one-to-many with a unique key on `(user_id, version)`. "Editable" applies to the latest version only.

- **CG-19. Internal anchors are not validated.**
  Where: AC-5.4.2 and AC-5.10.4 link to module sections. Nothing checks that the headings exist.
  Resolution: `npm run check:content` collects every heading id per module and fails on any `/modules/<slug>#<id>` link, in bodies or in the closing module's plan map, whose target is missing.

- **CG-20. Transfer table rows do not map one-to-one to areas.**
  Where: AC-5.5.2 says each module expands "the corresponding row". The talk's six rows are decomposition, interface design, testing, observability, security, operations. The six areas are Models, Context, Tools, Orchestration, Verification, Operating. Interface design maps to Tools, testing to Verification, security and operations and observability to Operating, decomposition to Orchestration. Models and Context have no row of their own.
  Resolution: the author assigns rows in `docs/decisions.md`. Recommend: Models draws on testing (choosing and measuring a dependency); Context draws on decomposition and data modelling; Tools on interface design; Orchestration on decomposition and systems thinking; Verification on testing discipline; Operating on observability, security, and operations. Each Transfer connection names its row explicitly.

- **CG-21. Reading time is author-declared with no check.**
  Where: AC-5.5.7.
  Resolution: the schema enforces 45 to 90 for `kind: area`. The build check estimates from word count at 220 words per minute, excluding Workshop, Failure exercise, and Optional lab, and warns beyond a 25 percent difference. The estimate is a warning, not a failure.

- **CG-22. "Started" is undefined.**
  Where: AC-5.9.3.
  Resolution: a `module_progress` row with `started_at` is created on the first of: a workshop or failure response save, a self-check attempt, or the "Mark complete" control. Opening a page does not create a row. Status is `complete` when `completed_at` is set, otherwise `in_progress` when a row exists, otherwise `not_started`.

- **CG-23. Actions missing from the test list.**
  Where: NFR-6.5.2 lists six Actions. The spec also needs unsubscribe (AC-5.1.4), updateDisplayName (EC-5.9.2), feedback (AC-5.10.6), and a failure-exercise save (AC-5.5.5).
  Resolution: the full Action list is subscribe, confirm, unsubscribe, progress, workshop (with `kind`), selfCheck, selfAssessment, feedback, updateDisplayName, deleteAccount. Each has a test.

- **CG-24. Elective self-check minimum.**
  Where: NFR-6.5.1 names area and foundations for the six-question rule. AC-5.11.1 says electives use the full template. AC-5.5.6 says 6 to 12.
  Resolution: apply 6 to 12 to area, foundations, and elective. Orientation has no minimum. Closing has no self-check.

- **CG-25. Rate limiting is not an auth library default.**
  Where: NFR-6.2.5, AC-5.9.7. Better Auth's limiter covers only its own `/api/auth/*` routes and is off in development.
  Resolution: `src/lib/rate-limit.ts` implements a sliding window in memory (one process). Notify-me: 10 per IP per hour. Workshop and failure saves: 30 per account per hour and 60 per IP per hour. Both Better Auth and this limiter read the client IP from the first value of `x-forwarded-for`, which the OpenShift router sets. Set `rateLimit.enabled: true` for Better Auth in production only.

- **CG-26. The anatomy diagram is drawn for a dark ground.**
  Where: NFR-6.4.5 and the palette decision. `contrast-output.md` shows the diagram's title and subtitle colors fail on the light background and the mini-map outline `#adaca9` fails against it.
  Resolution: on the light theme, embed the diagram and mini-maps inside a card with the dark background `#14161c`. Do not recolor the SVGs. If the author later wants a light variant, generate it from `internal/build-diagrams.mjs`, which needs Google Chrome at a fixed macOS path and cannot run in CI. Copy the generated SVGs into the site repo and record the source commit in `docs/decisions.md`.

- **CG-27. Where CI runs.**
  Where: 7.5 assigned CI checks to Netlify. Netlify is gone. The spec says nothing about a CI runner for OpenShift.
  Resolution: the author chooses a runner (GitHub Actions if the repo is on GitHub, otherwise OpenShift Pipelines). The workflow runs `npm ci`, `npm run check:content`, `npm test`, `npm run build`, `npm run check:a11y` on push to `main`. The runbook names the runner and the image build path. Docker is not on the dev machine, so the image is built by the runner or by an OpenShift BuildConfig from the Dockerfile, never locally.

- **CG-28. Phase 0 gate depends on a real inbox.**
  Where: 9.1's checkpoint gate: "the confirmation flow exercised end to end with a real inbox".
  Resolution: the gate becomes: subscribe on the deployed site, read the confirm and unsubscribe URLs from the pod log (`oc logs`), open both, and see the row change. Record it in `docs/gates.md`. The inbox test is deferred with the provider choice.

- **CG-29. The Phase 2 launch notification cannot be sent.**
  Where: 9.3 deliverable "Launch notification: email to confirmed subscribers". The notify-me conversion metric in 3.2 depends on it.
  Resolution: the deliverable is blocked until a provider is chosen and confirmed opt-in is implemented. Phase 2 can close without it. The send path, when written, selects only confirmed and not-unsubscribed rows.

- **CG-30. Talk length stated differently.**
  Where: spec 1 says a 35-minute talk. The talk repo says 50 minutes (35 of content plus 15 of questions).
  Resolution: landing and orientation text says "the talk" without a length, or "35 minutes of content".

- **CG-31. Are area modules readable without sign-in?**
  Where: 4.2 says signing in unlocks progress, responses, and self-checks, which implies reading is open. 7.1 and NFR-6.1.2 call them "signed-in module pages". PD-9.2.1 puts an auth guard on "signed-in routes". 8.2 says no gated content.
  Resolution: module pages are readable by anyone. The workshop form, the failure-exercise form and reveal, and self-check persistence require sign-in and show a sign-in prompt in their place. The auth guard covers `/account`, `/assessment`, and every write Action. This serves goal 3.1.3 (the resource people link to). Recommend the author confirm.

- **CG-32. TLS to RDS through node-postgres.**
  Where: the database decision says TLS to RDS. Nothing says how.
  Resolution: `src/db/client.ts` creates `new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: true, ca: readFileSync('/app/certs/rds-global-bundle.pem') } })`. The bundle is Amazon's public global bundle baked into the image. RDS has `rds.force_ssl = 1` in its parameter group. Do not rely on `sslmode=require` in the URL alone, which does not verify the certificate in `pg`. The runbook records both.

- **CG-33. OpenShift needs a health endpoint.**
  Where: nothing in the spec. Readiness and liveness probes are standard on OpenShift.
  Resolution: `src/pages/healthz.ts` returns 200 with `{ ok: true }` on demand, and `readyz` additionally runs `SELECT 1`. Both are excluded from rate limiting and from the auth guard. The deployment manifest points its probes at them.

- **CG-34. Better Auth schema generation adds a tool.**
  Where: TC-7.6.7. The Drizzle adapter needs the auth tables in `src/db/schema.ts`, generated by `@better-auth/cli` or written by hand.
  Resolution: run the CLI once, commit the generated tables, and do not add the CLI to `package.json`, or add it as a dev dependency with approval. Either way the tables in the schema match Better Auth 1.7.5.

- **CG-35. Open questions still open.**
  Where: spec 12: the final domain (2), the elective order (6), the representative learner (7), page analytics (8).
  Resolution: the domain blocks AC-5.1.7 and the OAuth callback URLs (`https://<domain>/api/auth/callback/github` and `/google`) and must be fixed before Phase 0 deploys. The others do not block Phases 0 to 2. Record each answer in `docs/decisions.md` when made.

