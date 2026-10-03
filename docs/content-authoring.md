# Content authoring

How to write a module and an artifact for this program. The content check enforces most of what this page says. When the two disagree, the check wins; fix the check or this page in the same change.

The blueprint (`docs/architecture.md`, sections 4 and 11) is the contract. This page is the working guide.

## Where things live

- Modules: `src/content/modules/<slug>.mdx`. One file per module. The slug is the file name and the URL: `src/content/modules/models.mdx` renders at `/modules/models`.
- Artifacts: `src/content/artifacts/<id>.md`. One artifact per file. The id is the file name.
- Files sit directly under their directory. Astro's loaders read every depth and dotfiles too, so a file in a subdirectory or a dotfile would become an entry whose id no route serves; the check rejects both. A scratch file starts with `_`, which the loaders and the check both skip.
- Changelog: `src/content/changelog/<YYYY-MM-DD>-<slug>.md`.
- Downloadable copies of artifacts, when offered: `public/artifacts/<id>.<ext>`, named in the artifact's `download` field.
- The content map, the schema, and every rule the check enforces: `src/lib/content-schema.ts`.

Files whose name starts with `_` are ignored by the collections and by the structural checks (schema, sections, components, dates, links). Use that for notes and scratch files. Two scans still read every file under `src/content`, scratch files and dotfiles included: the secret scan and the em-dash scan. They skip only `.DS_Store` and `node_modules`. A scratch file must not hold a key-shaped string or an em-dash.

## The fourteen modules

The slugs are fixed. The check rejects any other module file name.

| Slug | Kind | Order | Prerequisites | Talk beats | Book chapters |
|---|---|---|---|---|---|
| `orientation` | orientation | 0 | none | 1.3, 1.4, 3.1, 3.2, 3.3, 3.4 | 1, 2 |
| `foundations` | foundations | 0 | orientation | none | 4, 5, 6 |
| `models` | area (models) | 1 | foundations | 2.1 | 6, 7, 10 |
| `context-and-knowledge` | area (context) | 2 | foundations, models | 2.2 | 11, 12, 13, 14 |
| `tools-and-extensibility` | area (tools) | 3 | foundations, context-and-knowledge | 2.3 | 15 |
| `orchestration` | area (orchestration) | 4 | foundations, tools-and-extensibility | 2.4 | 16, 17, 18 |
| `verification-and-evals` | area (evals) | 5 | foundations, models | 2.5 | 8, 9, 19 |
| `operating-it` | area (operating) | 6 | foundations, verification-and-evals | 2.6 | 23, 24, 25, 26, 27 |
| `self-assessment` | closing | 0 | the six area modules | 3.1, 3.2, 3.4 | none |
| `fine-tuning-and-adaptation` | elective | 1 | none | none | 20 |
| `inference-and-hosting` | elective | 2 | none | none | 21 |
| `multimodal-systems` | elective | 3 | none | none | 22 |
| `ai-engineering-team` | elective | 4 | none | none | 29 |
| `career-and-learning` | elective | 5 | none | none | 30 |

Chapter 28, the capstone, is out of scope. The check rejects it anywhere.

## How to add or write a module

1. Start from the skeleton that already exists for the slug. Every skeleton has valid frontmatter, the required headings for its kind, and the components in place. Keep `draft: true` until the module is complete.
2. Fill the frontmatter. For an area module the `title`, `talkBeats`, `bookChapters`, `takeaway`, `pitfall`, and `transferRows` must match the content map in `src/lib/content-schema.ts` word for word. The check rejects any other value. For an elective the `title` and the single chapter must match the elective list. Set `summary` (one line, at most 240 characters) and `readingMinutes` (45 to 90 for an area module, excluding the Workshop, Failure exercise, and Optional lab sections).
3. Write `outcomes`. Each outcome has an `id` (lowercase words joined by hyphens) and a `text`. The outcomes render under Topics and learning outcomes through `<Outcomes />`, one list item with the anchor `#outcome-<id>` each.
4. Write the self-check questions (see below). Every question names an outcome. Every outcome is named by at least one question.
5. Write the body in the section order for the kind (see below). Headings are written in Markdown by you. Components never render headings.
6. Place the components: `<Outcomes />` under Topics and learning outcomes; `<Takeaway />` where the body states the takeaway (area modules only; it renders the frontmatter `takeaway` verbatim); `<Workshop>` wrapping the Workshop section's content; `<FailureExercise>` wrapping the Failure exercise, with a `<Fragment slot="explanation">` inside it; `<SelfCheck />` under Completion evidence; `<Sources />` under Sources; `<MarkComplete />` in orientation only, under Completion evidence.
7. List every artifact the body places in `artifacts`, and place every listed artifact with `<Artifact id="..." />`.
8. Add `sources`. Every source has a `title` and a quoted `date`. Add `checkedOn` for every vendor fact and every artifact.
9. Run `npm run content:check`. Then run `npm run content:check -- --drafts-as-published` to see what the module still needs before it can leave draft.
10. Preview the draft with `PREVIEW_DRAFTS=true npm run dev`. Draft pages return 404 in any other build.
11. Flip `draft: false` when the check passes under `--drafts-as-published`. Set `updatedOn` and `checkedOn` to the day you did it. Add a changelog entry.

Adding a module to the program means adding its content file and one entry in the content map in `src/lib/content-schema.ts`. The slug joins `MODULE_SLUGS` through `ELECTIVE_MODULES` (slug, title, chapter, order) for an elective, or through `AREA_CONTENT_MAP` for an area module. The check rejects a file whose slug is not in the map, and `getPublishedModule` answers null for it, so the catalog never shows a module the map does not know. The map is what holds the area modules to spec 5.5 and the electives to spec 5.11. Nothing else in the application changes: the catalog and the module routes read the collection. This is a recorded deviation from AC-5.2.5, which says a content file alone adds a module (`docs/decisions.md`, section 3, 2026-10-03).

## Sections per kind

The `h2` headings, in this order, each exactly once. The text must match exactly.

| Kind | Sections |
|---|---|
| orientation | Transfer connection, Topics and learning outcomes, Completion evidence, Sources |
| foundations, area, elective | Transfer connection, Topics and learning outcomes, Workshop, Failure exercise, Completion evidence, Sources |
| closing | How the assessment works, The six areas, After the plan, Sources |

An `Optional lab` section may appear only between Failure exercise and Completion evidence, and only in foundations, area, and elective modules. Its heading carries the word "Optional" so nobody mistakes it for required work. Labs never count toward completion.

Orientation and closing must not have Workshop, Failure exercise, or Optional lab headings, and the check rejects the matching components there too. The closing module has no Completion evidence and no self-check.

Subsections are `h3`. Never write an `h1` in a body; the layout renders the page title. Artifact titles and self-check questions render as `h3` too, so keep your own subsections at `h3`. An artifact placed inside an `h3` subsection takes `level={4}` (`<Artifact id="x" level={4} />`), so the prose after the card stays under the subsection in the document outline; orientation's transfer table is the one case today.

What each section holds:

- Transfer connection. What the reader already does and what it becomes. An area module names its row of the talk's transfer table and says, in those words, what "stays the same" and what "changes". The check looks for both phrases.
- Topics and learning outcomes. `<Outcomes />`, then each concept with its outcome, at least one coding-agent worked example (what the user touched, what the vendor engineered), and at least one sourced public incident or first-hand account. Every tool or model fact maps to a source with a `checkedOn` date. `<Takeaway />` where the takeaway is stated.
- Workshop. Artifacts inline through `<Artifact />`, the task in one paragraph, a rubric as a list. No code. Free-text responses are saved per learner and never graded.
- Failure exercise. An artifact that plants the area's pitfall. Ask the learner to find it and explain it. The explanation goes in `<Fragment slot="explanation">`; it renders only after the learner saves a response, together with the pitfall band.
- Completion evidence. One sentence on what completes the module, then `<SelfCheck />`. For area, foundations, and elective modules, completion is a passed self-check plus a saved workshop response. For orientation: "Reading this module is the evidence." plus the optional self-check and `<MarkComplete />`.
- Sources. `<Sources />` only. It renders the frontmatter sources with their dates, the talk beats, the book chapters, checked-on dates, and archive notes.

Orientation is the one module whose beats are fixed by the spec (5.3): the thesis and the definition of owner with the three-row table under Transfer connection, then, as `h3` subsections under Topics and learning outcomes, the prototype commitments, the map with `<AnatomyMap />`, what transfers with the `orientation-transfer-table` artifact, what is new with the ladder and the seven competencies (introduced as unranked), the seven pitfalls, the roadmap, and the book's "look before you build". A summary list sits before the first `h2`. Its reading time is 25 to 40 minutes including the self-check, which has 6 to 10 questions. The check does not estimate orientation's reading time; the author keeps `readingMinutes` honest by hand. Every quote in orientation is verbatim from the talk or the book blueprint, and every fact traces to a source in `sources`.

The Phase 1 fixture, `models.mdx`, is a draft whose prose says so in its first sentence. It is complete under `--drafts-as-published` (frontmatter from the content map, four outcomes, six questions, one synthetic artifact placed in the Workshop and the Failure exercise, an explanation slot, a dated source) so the layout, the forms, the island, the artifact card, and the prerequisite notice can be exercised before Phase 2 writes the real module. Its reading-time estimate warns until then.

## Components

Module bodies never import anything. These are the only capitalized tags a body may use. Anything else fails the check, and on a live page it would fail the render.

| Tag | What it renders |
|---|---|
| `<Artifact id="x" />` | The artifact card for `artifacts/x.md`. `level={4}` when the card sits inside an `h3` subsection. |
| `<Callout kind="plain" label="Why this matters">...</Callout>` | A callout. `kind` is `plain` or `surface` (default). |
| `<Collapsible title="Mathematical reference">...</Collapsible>` | A details and summary block. |
| `<Workshop>...</Workshop>` | The workshop content, then the response form. |
| `<FailureExercise>...<Fragment slot="explanation">...</Fragment></FailureExercise>` | The exercise, the response form, then the pitfall band and the explanation after a response exists. |
| `<OptionalLab>...</OptionalLab>` | The lab card, from the `lab` frontmatter field. |
| `<Takeaway />` | The frontmatter takeaway, verbatim. |
| `<Outcomes />` | The outcomes list with anchor ids. |
| `<SelfCheck />` | The self-check island. |
| `<Sources />` | The sources list. |
| `<AnatomyMap highlight="model" variant="base" />` | The talk's anatomy diagram. |
| `<MarkComplete />` | The manual completion form. Orientation only. |

Close every tag. Put a blank line between a tag and the Markdown inside it. `<Fragment>` needs no import.

## What the layout renders

The module page (`src/pages/modules/[slug].astro`, and `src/pages/modules/orientation.astro` for the prerendered orientation) sets the module context and renders `ModuleLayout` around the MDX body. Top to bottom:

- The area strip with the title and the mini-map (area modules), or the page header with a kicker (every other kind). The strip and the header carry the page's one `h1`.
- A "Draft preview" line with a Draft chip when the build enabled `PREVIEW_DRAFTS` and the module is a draft.
- The summary, then the meta facts: reading time (area modules say it excludes the workshop and lab), prerequisites as links, `updatedOn` and `checkedOn` as ISO dates, and, for a signed-in learner, a status chip. An area module adds the row of the talk's transfer table it expands, from `transferRows`.
- The prerequisite notice, "Before this module". Signed out it lists every prerequisite. Signed in it lists only the prerequisites whose progress is not complete. It renders nothing when none is open. It reads as a recommendation. Every module opens.
- A "May be stale" notice when the module's own `checkedOn` is older than `staleAfterDays`.
- The body, which is your MDX.

What the body components render:

- `<Artifact id="x" />`: the card with the title, the origin chip (with a visually hidden "Origin:" prefix), the summary, the body, then tool and version in mono, "checked on" with the ISO date, "reviewed on" when `reviewedOn` is set, a Source link when `url` is set, "archived on" with the archive link when `archivedOn` is set, and a Download link when `download` is set. A "May be stale" notice follows when the artifact's `checkedOn` is older than the module's `staleAfterDays`. The notice says "It may be out of date." so the quarterly window is visible to the learner. The same artifact may appear twice on one page; the card carries no ids of its own.
- `<Workshop>`: `section.workshop` around your content, then the response form. Signed out, the form is a sign-in prompt.
- `<FailureExercise>`: `section.failure-exercise` around your content, then the response form. The pitfall band and the `<Fragment slot="explanation">` content render only when the learner has saved a failure response. Before that they are absent from the HTML, not hidden by CSS.
- `<OptionalLab>`: a card that says labs never count toward completion, names the lab from the `lab` field, and holds your instructions.
- `<Takeaway />`: `<p class="takeaway"><b>Takeaway.</b> ...</p>` with the frontmatter value. Nothing when the field is absent.
- `<Outcomes />`: `<ol class="outcomes">` with `<li id="outcome-<id>">` per outcome.
- `<SelfCheck />`: the island with the frontmatter questions. Orientation persists in the browser for everyone and is marked optional. Every other kind persists to the account when signed in and shows "Sign in to save your progress." when not.
- `<Sources />`: one sentence naming the talk beats and book chapters from frontmatter, then the sources with their dates, checked-on dates, archive notes, and `note` text.
- `<MarkComplete />`: orientation only. A form that posts to `/progress` and marks orientation complete for a signed-in learner. A signed-out learner is sent to sign in. It is absent when the build disabled accounts.

## Writing rules

- Short declarative sentences. The talk's voice: say it once, plainly.
- No em-dashes anywhere. Use a comma, a colon, or a full stop. The check fails on U+2014 in content, in `docs/`, and in `README.md`.
- No italics. `em` renders Bold on this site. Emphasis is Bold, and only one word or phrase per line.
- Quote the talk's thesis, takeaways, and pitfalls verbatim. The area takeaway and pitfall come from frontmatter, which the check holds to the content map.
- Say "the talk" or "35 minutes of content", never "a 35-minute talk".
- Keep headings ASCII. Heading ids are generated the way Astro's slugger generates them: lowercase, drop everything except letters, digits, spaces, and hyphens, then replace spaces with hyphens. "Topics and learning outcomes" becomes `topics-and-learning-outcomes`. "pass@k and pass^k" becomes `passk-and-passk`. A heading the rule cannot express must be rewritten. Two headings with the same id in one module get a warning; their anchors will not resolve.
- Anchors: `/modules/<slug>#<heading-id>`. The check resolves every one, in bodies and in the closing module's plan steps, against the headings that exist.
- In `.mdx`, close every tag or the compile fails. In `.md` (artifacts, changelog), no raw HTML; the pipeline passes it through unchanged.
- Fenced code blocks carry a language. Every fenced block is a Tab stop on the page, so do not scatter them.
- Learner-facing tool facts name the tool, the version where applicable, and the date you checked them.
- Vendor and model claims are true on the day you checked them. Write them that way.

## Self-check questions

Each question:

```yaml
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
```

- Two to six options. One or more correct indexes (zero-based). One feedback entry per option. Wrong-answer feedback names what to reread.
- Open every feedback entry with `Correct.` or `Not yet.`, as above. The island speaks the verdict once: when every entry it shows opens with the verdict word it drops that word, and on a mixed multi-correct result it keeps each entry's own word, because it says which pick was right. A failed multi-correct check with correct options still unselected gets the island's line "Not every correct option is selected yet." after the entries.
- Do not end a multi-correct question with "Select all that apply." The island adds that line to the question's option group.
- Area, foundations, and elective modules need 6 to 12 questions. Orientation needs at least one. The closing module has none.
- Every question names an `outcome` id from `outcomes`. Every outcome is covered by at least one question.
- Question ids are unique within the module.
- A learner's pass stands when you change a question later; the record keys on the module slug. Set `checkedOn` when you change one and note it in the changelog.

## Artifacts

One artifact per file. The id is prefixed by the module that introduced it: `models-eval-report-a`, `orientation-transfer-table`. Two modules that list the same id render the same card with the same label.

```md
---
title: Flight-booking grader, illustrative
origin: synthetic
kind: eval-report
tool: none
checkedOn: 2026-09-15
summary: An illustrative grader that reads the transcript instead of the reservation table. Not a real incident.
---
```

Fields: `title` (required), `origin` (required), `kind` (`trace`, `output-set`, `tool-schema`, `eval-report`, `dashboard`, `incident`, `document`, `table`, `other`), `tool`, `version`, `checkedOn` (required), `url`, `reviewedOn`, `archivedOn`, `archiveUrl`, `download`, `summary` (at most 240 characters).

The origin labels, exactly one per artifact:

- `captured`. From the author's own sessions on non-sensitive tasks. Needs `tool`, `version`, and `reviewedOn`, the date it was reviewed for secrets, personal data, and third-party content. The check refuses to publish a module that places a captured artifact without `reviewedOn`, and warns when `version` is missing. Record the review in the changelog.
- `synthetic`. Written for the exercise. Realistic in format (OpenTelemetry-style spans, tool schemas in the shape real agents use), never presented as a measured result. Say so in the summary. The card shows the word "synthetic" beside the title.
- `public`. An excerpt from a published source, within fair use, short relative to the source. Needs `url`. When the source disappears, keep the quote, set `archivedOn` and `archiveUrl`, and the card says "archived on".

Bodies are Markdown. Traces, JSON, schemas, and spans go in fenced code blocks with a language. No raw HTML.

The check runs a secret scan over every module and artifact file: key-shaped strings, `AKIA` ids, `sk-` and `ghp_` tokens, and private key blocks fail the build with the file and line.

## Sources

```yaml
sources:
  - title: Demystifying evals for AI agents
    org: Anthropic
    date: "2026-01"
    url: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
    checkedOn: 2026-09-15
```

- Quote YAML dates for sources: `"2026-01"`, `"2026-01-15"`, `"2026"`. Unquoted, YAML turns a full date into a timestamp and rejects a year-month.
- `date` is the source's own date. `checkedOn` is the day you read it. `archivedOn` and `archiveUrl` when it has gone.
- `author` or `org`, whichever the source has. `note` for a qualification the reader needs, for example "describes that team's experience, not an industry rule".
- The Sources section also lists the talk beats and the book chapters from frontmatter, so every module says what it draws on.

## Dates

- Every date is ISO: `2026-09-15`. Module and artifact dates can be unquoted in YAML; the schema accepts the timestamp YAML produces.
- `updatedOn`: the day the content last changed. `checkedOn`: the day you last verified the facts. Keep `checkedOn` on or after `updatedOn`, or the check warns.
- `staleAfterDays` (default 90): after this many days an artifact card shows "May be stale" beside its checked-on date, and the module header shows the same notice when the module's own `checkedOn` is that old.
- A source's `checkedOn` is the day someone read it. When the date comes from the talk's research rather than your own browser, say so in `note`, as orientation does.
- A `checkedOn` older than 180 days is a build warning. A date in the future is an error.
- The quarterly review runs `npm run drift:check`, updates the dates it re-verified, replaces or re-captures stale artifacts, and records what changed in the changelog.

## The changelog

`src/content/changelog/<YYYY-MM-DD>-<slug>.md` with `date` and `title` in frontmatter and the note in the body. Newest first on `/changelog`. Record: modules that opened or changed, artifacts reviewed, replaced, or re-captured, dates updated, and self-check questions changed.

## The closing module

`self-assessment.mdx` carries the assessment in frontmatter: the four-point scale, the three context questions, six areas in talk order with their transfer items and competencies, four plan steps per area with an `href` into that area's module, the four-step roadmap, and the uniform-high text and links. The item ids follow `<area>-<competency>` and `<area>-<transfer-row>`. The check confirms every `moduleSlug` is an area module and every step `href` resolves to a heading.

## The checks

`npm run content:check` (also `npm run check:content`) runs `scripts/content-check.ts` against `src/content`. `npm run build` runs it first, so a broken module fails the build before Astro starts.

Options: `--dir <root>` (default `src/content`), `--today YYYY-MM-DD` (for reproducible date checks), `--json` (machine output, `{ errors, warnings }` with `{ file, line?, message }`), `--strict-warnings` (warnings fail the build), `--drafts-as-published` (apply every rule to drafts).

Exit codes: 0 clean, 1 errors, 2 unreadable root or bad argument.

Errors:

- Unknown module slug, a kind that does not match the file name, an area module in the wrong file, an elective with the wrong title or chapter.
- Frontmatter that fails the schema or the content map (beat, chapters, takeaway, pitfall, transfer rows, order, chapter 28, reading minutes for area modules).
- For published modules, the body rules:
  - an `h1`;
  - required sections missing, out of order, or repeated, and forbidden sections;
  - a misplaced Optional lab;
  - unknown or misplaced components, and a missing explanation slot;
  - a Transfer connection without "stays the same" and "changes";
  - the self-check count and the outcome coverage.
- An artifact placed but not listed, or listed but missing from the collection; a captured artifact placed in a published module without `reviewedOn`; a public artifact without `url`; a key-shaped string.
- A prerequisite that does not exist, is the module itself, or is an elective listed by a core module.
- A link to a module or heading that does not exist.
- An em-dash in content, `docs/`, or `README.md`.
- A date in the future.
- Duplicate area or elective orders. A closing module whose plan names a non-area module.
- A changelog file with a bad name or frontmatter.

Warnings:

- An artifact listed but not placed.
- A captured artifact without `version`.
- A captured artifact without `reviewedOn` that is placed only in drafts.
- A published module whose prerequisite or link target is still a draft.
- A `checkedOn` older than 180 days. `updatedOn` after `checkedOn`.
- A reading-time estimate more than 25 percent from `readingMinutes`. Area modules only, at 220 words per minute, excluding Workshop, Failure exercise, and Optional lab.
- Two headings with the same id.

Drafts get the structural rules only: the slug and kind pairing (an area module in its own file, an elective's title and single chapter), the frontmatter field shapes, chapter 28, order, dates, artifacts, prerequisites, anchors, and the secret scan. The content map values (beats, chapters, takeaway, pitfall, transfer rows, reading minutes) and every body rule wait for `--drafts-as-published` or for `draft: false`; `src/lib/content-schema.test.ts` pins that a draft with a wrong takeaway passes.

`npm run drift:check` (also `npm run drift`) runs `scripts/drift-review.ts`: every artifact placed in a module and every source of a module whose `checkedOn` is older than 90 days, grouped by module in catalog order, with the module's own date. Options: `--dir`, `--days`, `--today`, `--json`, `--fail-on-stale` (exit 3 when anything is stale). Drafts appear with a `(draft)` marker.

`npx astro check` validates the frontmatter against the collection schema too, with the `reference()` fields resolved, so a missing artifact or prerequisite id fails there as well.

The fixtures under `test/fixtures/content` show a complete non-draft area module and orientation, plus one invalid variant per rule under `cases/`. `npx vitest run scripts/` runs both scripts against them. `npx vitest run src/components/module/` renders the module components against the real content store and checks the markup contracts above.
