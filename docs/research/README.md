# Research files

The planning session of 2026-09-15 wrote these cheat sheets into its scratchpad, and the blueprint (`docs/architecture.md`) cites them by section. The scratchpad did not survive, so the files were recovered on 2026-10-03 from the planning transcripts (each is the last state the session read back, line for line) and committed here so every citation resolves. They are research notes, not contracts: when a note and the blueprint disagree, the blueprint wins unless the installed package shows the blueprint's code cannot work (blueprint section 0).

| File | What it holds |
|---|---|
| `acceptance-matrix.md` | The grading list: one row per spec criterion with phase, priority, and verify step; the CG-1 to CG-35 resolutions. |
| `astro7.md` | Astro 7 facts checked against the installed package: server output, actions, content layer, env, islands, images. |
| `better-auth.md` | Better Auth 1.7.5 facts: schema, hooks, cookies, OAuth callbacks, the CLI. |
| `drizzle.md` | Drizzle 0.45 and drizzle-kit 0.31 facts: pg and PGlite drivers, migrations, the schema shape. |
| `testing-ci.md` | Vitest over `getViteConfig`, Testing Library, Playwright, axe, GitHub Actions, the forwarded-header rules. |
| `design-tokens.md` | The talk's palette and type roles, both theme token sets with computed contrast, the components, the SVG inventory, and section 7, the text alternatives the diagram components quote verbatim. |
| `contrast-output.md` | The contrast ratios behind `design-tokens.md`, as computed. |
| `talk-kb.md` | The talk knowledge base: thesis, section beats, the six areas, the transition, the source ledger, and the style rules. The landing copy quotes it verbatim. |
| `labs.md` | The Phase 3 labs design (`labs/`, outside the six Phase 0 workstreams). |

Not committed: `book-kb.md`, the book blueprint knowledge base. It quotes the book repository (`https://github.com/sequenzia/becoming-an-aie-book`, public) verbatim, and those quotes carry em-dashes, which `scripts/lint.mjs` and the content check reject under `docs/`. Regenerate it from that repository when a module needs it; the planning transcripts hold the last copy.

Nothing here is loaded by the site or the build. `.dockerignore` excludes `docs/`.
