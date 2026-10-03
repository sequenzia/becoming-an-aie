# Design tokens for the site

Derived from `beyond-the-coding-agent/style/design-brief.md` (September 14, 2026, revised September 15) and `style/colors.md`. The deck's dark palette carries over unchanged. A light theme is added on top of it. Every contrast ratio in this document was computed by `research/contrast.mjs` (run `node contrast.mjs`); the full output is in `research/contrast-output.md`. Nothing was estimated.

Source paths in this document are relative to `scratchpad/beyond-the-coding-agent/` unless stated otherwise.

## 1. What the brief says

### The concept

The anatomy diagram is the spine. Every slide lives inside that map. A mini-map at top right says where you are. Each area borrows its color from where it sits on the map. Each area enters through a colored header. Helvetica carries the narrative and numbering. Monospace marks commands, filenames, formulas, and the code metaphor. Three orientation devices only: the kicker, the mini-map, and the narrative slide number. No logo, progress bar, footer, or takeaway lines.

Two rules govern everything else. Color is a role, not emphasis. A word is never colored to stress it. Slight emphasis is Bold at the same size, and that is the only emphasis device in a line of text. No italics anywhere. Two weights only, Regular and Bold.

### Type roles (deck values, in points)

| Role | Size | Face and weight | Color | Line spacing |
|---|---|---|---|---|
| Display mono | 72 | Consolas Regular, colored runs | see runs | Exactly 84 |
| Area header | 60 | Helvetica Bold | the block's text color | Exactly 70 |
| Display sentence | 44 | Helvetica Regular; Bold on one landing sentence; Consolas for formulas | primary; step numerals secondary; formulas blue | Exactly 52 |
| Slide title | 32 | Bold | primary | 1.15 |
| Heading and body | 24 | Bold for headings and table headers, Regular for body | primary; table headers in the slide's color | 1.25 |
| Chip and compact | 20 | Regular; Bold for the kicker's area name, band labels, row labels; Consolas for commands | primary; area color where named; blue for Consolas runs | 1.25 |
| Small | 16 | Regular | secondary | 1.25; Exactly 20 on a line with a Consolas run |
| Diagram fine and narrative number | 12 | Regular; badge text Bold | secondary; badge text `#14161c` | 1.25 |

Floors: reading floor 20, present floor 16, orientation floor 12. Paragraph spacing 12 between 24 list items, 8 between 20 lines. Monospace at 20 and above is blue; below 20 it stays primary and the face alone marks it. Faces: Helvetica (Arial on Windows, same widths) and Consolas. No Helvetica Neue, no Light, no italics.

### Color roles (exact hex)

| Role | Hex | Derivation |
|---|---|---|
| Background | `#14161c` | base |
| Primary text | `#fffcf5` | base |
| Secondary text | `#adaca9` | `#fffcf5` at 65% over the background, as a solid hex |
| Surface | `#303236` | `#fffcf5` at 12%. Cards, band surfaces, generic diagram boxes |
| Hairline | `#4c4d50` | `#fffcf5` at 24%. Screenshot borders, pill strokes, diagram containers |
| Pink | `#f948be` | harness color: Context, Tools, Orchestration. Landing color in Section 1 |
| Blue | `#1064f8` | model color: Models. Commands and formulas. The Model region |
| Green | `#01b66d` | verification color: Evals, Section 3, `works.all()` |
| Amber | `#fdad00` | operating and warning color: Operating, `works.any()`, the "yours" badge |
| Blue tint | `#13223f` | blue over the background. Model region fill, Models area cards |
| Pink tint | `#2b1b2c` | pink over the background. Harness region fill, harness area cards |
| Green tint | `#122926` | green over the background |
| Amber tint | `#302819` | amber over the background |

Tints fill area cards only. They never carry meaning alone. A stroke, a block, or colored text carries the meaning; the tint only lifts.

### Area colors

| Talk area | Color | Map home |
|---|---|---|
| Models | blue | Model |
| Context and knowledge | pink | Context and memory, Instructions, Data and knowledge |
| Tools and extensibility | pink | Tools |
| Orchestration | pink | Orchestration |
| Verification and evals | green | Verification, Evaluations |
| Operating it | amber | Identity and access, Security, Guardrails, Observability, Governance |
| Section 3, "The transition" | green | |

Four colors for six areas because the three harness areas share the Harness region. A page has one color. It appears on the orientation devices (kicker area name, lit mini-map box, band block, area header) and on at most one content element (an area card's stroke and tint, a row label, a table header, a window frame, or one named word). Exceptions: agenda lines and the slide 23 blocks show every area name in its own color; `works.any()` is always amber and `works.all()` always green.

### Text on a solid block

| Block | Text | Ratio |
|---|---|---|
| blue `#1064f8` | `#fffcf5` | 4.88 |
| pink `#f948be` | `#14161c` | 5.77 |
| green `#01b66d` | `#14161c` | 6.81 |
| amber `#fdad00` | `#14161c` | 9.60 |

`#14161c` on blue is 3.62 and `#fffcf5` on pink is 3.06. Neither is used.

### Contrast rules on `#14161c` (recomputed)

`#fffcf5` 17.65, `#adaca9` 7.97, `#f948be` 5.77 (4.10 on the surface, so pink text inside a band is large only), `#1064f8` 3.62 (large text only, never on the surface where it is 2.57; strokes, blocks, and tints at any size), `#01b66d` 6.81, `#fdad00` 9.60.

### Components (deck geometry in points)

- **Kicker.** 20. Area name Bold in the area color, a middle dot with a space on each side, beat Regular secondary. x 48, y 36, width 716 beside a mini-map. Section 3 area name is "The transition" in green.
- **Mini-map.** 160 by 90 PNG at x 752, y 36. Current area's boxes filled in the area color, every other box an outline. `mini-all` lights every area. Same position on every slide. Never Morphed.
- **Area header.** Full-bleed rectangle 960 by 128 in the area color, no line. Area name 60 Bold, Exactly 70, top 22. "When you are the user" 20 Regular at top 92. Both in the block's text color. Longest name "Tools and extensibility" drops to 56 if it wraps.
- **Pitfall band.** Full bleed at y 476, 64 tall, fill `#303236`, no line. Left block x 0 to 172 in the area color holding "Pitfall" 20 Bold at x 48, in the block's text color. Sentence 20 Regular primary from x 196, vertically centered. Expanded form is 96 tall and holds a second 16 secondary row on the surface part. Fade 0.3 on entry.
- **Stacked bands.** Six of the same construction, 56 tall, 8 gaps, block 320 (later 272) wide holding the area name 20 Bold. Blocks in order blue, pink, pink, pink, green, amber.
- **Labeled row.** Label 20 Bold in the area color in one column, content beside it from x 196. Row 56 tall.
- **Card.** Fill `#303236`, radius 8, no line. Padding 12 top and bottom, 16 sides. Text 20 Regular primary; card title 24 Bold. A "small" line inside is 16 secondary. Fade 0.2.
- **Area card.** A card with the area tint as fill and a 2 line in the area color.
- **Pill.** Full radius, 1 line `#4c4d50`, no fill, padding 4 top and bottom, 12 sides, text 20 Regular primary, 33 tall, 8 gaps. Command pills: 1.5 line in blue, Consolas 20 blue text. Fade 0.2.
- **Two-column table.** Headers 24 Bold in the slide's color. Cells 20 Regular primary. Row gap 12. No rules, no fills. A "small" line under a column is 16 secondary. Slide 21's right column names areas in their own colors and unchanged cells are green.
- **Attribution.** 16 secondary, no decorative prefix, Exactly 20. Commands and filenames inside stay Consolas 16 primary. Captions and stat lines are the same treatment, 8 below what they support.
- **Callout.** 24 Bold primary, 24 above. No band, no fill.
- **Quote, large.** 44 Regular primary, typed quotation marks, Exactly 52, attribution 12 below. No bar, no glyph.
- **Gutter numeral.** Helvetica Regular secondary at the list size in a 40 gutter, or at 44 in a 72 gutter.
- **"Yours" badge.** Amber pill 18 tall, text `#14161c` Bold 12, straddling each box's top-right edge.
- **Screenshots.** 1 hairline `#4c4d50` border and 4 radius so a light image does not float on the dark ground.
- **Section divider.** Label 20 secondary, a 1 hairline rule, title 60 Bold primary. No color.
- **Motion.** Transitions None. Text appears; images, cards, and pills fade 0.2 s; the pitfall band fades 0.3 s. Nothing over 0.5 s. No fly, wipe, zoom, push, bounce, or sound.

### Diagram theme (SVG units are half points; viewBox 1920 by 1080)

| Element | Value |
|---|---|
| Canvas | `#14161c` |
| Title | 40 units Bold `#fffcf5` |
| Platform, One run, Agent containers | no fill, 2 unit stroke `#4c4d50`, radius 16. One run dashed 12 8. Labels 40 Bold primary, descriptions 24 Regular `#adaca9` |
| Row labels (Per-run, Across runs) | 32 Bold primary, descriptions 24 secondary |
| The 13 generic boxes | fill `#303236`, no stroke, radius 10. Title 32 Bold primary. Subtitle 24 Regular secondary |
| Model | fill `#13223f`, 4 unit stroke `#1064f8`, title `#1064f8`, subtitle secondary on two lines |
| Harness | fill `#2b1b2c`, 4 unit stroke `#f948be`, label `#f948be`, description secondary |
| Goal | no fill, 4 unit stroke `#adaca9`, title primary |
| Stopping condition | generic box, title 28 Bold on three lines |
| Arrows and plus | `#adaca9`. Arrows 4 units with a 20 unit marker. Plus 56 units |
| Green | absent from the full map, present only on the mini-map |
| Mini-map | text free. Outlines 18 units `#adaca9`, no fill. Box radius 14, container radius 20. A lit box is filled in its area color with no stroke |
| Highlight state | every layer group except the named one at opacity 0.3 |

Things get a fill and no stroke. Groupings get a stroke and no fill.

## 2. Dark theme tokens

Every value is the brief's exact hex. Text and stroke variants equal the fill values in this theme; they exist so the light theme can diverge under the same names.

```css
:root {
  color-scheme: dark;

  /* ground and type */
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

  /* area colors: text and strokes on the ground and on the surface */
  --color-pink-text: #f948be;
  --color-blue-text: #1064f8;   /* large text only in this theme, see the blue rule */
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
  --color-diagram-bg: #14161c;      /* constant in both themes */
  --color-diagram-border: #4c4d50;  /* constant in both themes */
}
```

Rules carried from the brief for this theme:

- **Blue rule.** `--color-blue-text` passes only as large text (3.62 on the ground). Large text on the web is 1.5rem Regular or 1.1667rem Bold and up. Use it for the Models kicker (1.25rem Bold), Models table headers (heading role, Bold), and nothing smaller. Never on the surface (2.57). Blue strokes, blocks, and tints work at any size.
- **Pink rule.** `--color-pink-text` is 4.10 on the surface. Inside a card or band, pink text is large only. On the ground it passes at any size (5.77).
- Green and amber pass everywhere.
- **Mono rule.** Inline code and code blocks are primary text on `--color-code-bg`. The face alone marks them. Blue on mono runs only inside large text (a heading or the kicker). This is the brief's own sub-20 rule and its projector fallback.

Verified pairs for this theme are in section 3's tables, dark column.

## 3. Light theme tokens

### Construction

The light theme inverts the deck's two base colors and rebuilds every derived role with the deck's own construction (a percentage of the text color over the ground). The four area colors keep their deck hex for fills, blocks, strips, and the mini-map, so the areas stay recognizable. For text and strokes on the light ground each area gets a darker variant in the same OKLCH hue, found by the script as the lightest value that reaches 4.6:1 (a 0.1 margin over AA) against all three light grounds it will sit on: the background, the surface, and its own tint.

| Token | Value | Derivation |
|---|---|---|
| `--color-bg` | `#fffcf5` | the deck's primary text |
| `--color-text` | `#14161c` | the deck's background |
| `--color-text-secondary` | `#666668` | `#14161c` at 65% over `#fffcf5` |
| `--color-surface` | `#f1eee8` | `#14161c` at 6% over `#fffcf5`. 12% (`#e3e0db`) drops secondary text to 4.35 and fails; 6% keeps it at 4.95 |
| `--color-hairline` | `#c7c5c1` | `#14161c` at 24% over `#fffcf5` |
| `--color-pink-tint` | `#fee6ee` | pink at 12% over the ground |
| `--color-blue-tint` | `#e2eaf5` | blue at 12% |
| `--color-green-tint` | `#e1f4e5` | green at 12% |
| `--color-amber-tint` | `#fff3d8` | amber at 12% |
| `--color-pink-text` | `#c70093` | pink, OKLCH L 0.69 to 0.55, hue and chroma kept |
| `--color-blue-text` | `#025bef` | blue, L 0.56 to 0.53. The deck blue passes on the ground (4.88) but not on the surface (4.32), so one variant serves both |
| `--color-green-text` | `#017b48` | green, L 0.68 to 0.51, chroma clipped to sRGB |
| `--color-amber-text` | `#916100` | amber, L 0.80 to 0.53, chroma clipped. Reads as a dark gold |

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --color-bg: #fffcf5;
    --color-text: #14161c;
    --color-text-secondary: #666668;
    --color-surface: #f1eee8;
    --color-hairline: #c7c5c1;

    --color-pink: #f948be;
    --color-blue: #1064f8;
    --color-green: #01b66d;
    --color-amber: #fdad00;

    --color-pink-text: #c70093;
    --color-blue-text: #025bef;
    --color-green-text: #017b48;
    --color-amber-text: #916100;

    --color-pink-tint: #fee6ee;
    --color-blue-tint: #e2eaf5;
    --color-green-tint: #e1f4e5;
    --color-amber-tint: #fff3d8;

    /* --color-on-* unchanged. --color-diagram-* unchanged. The derived roles resolve through var(). */
  }
}
:root[data-theme="light"] {
  /* the same block, repeated verbatim, for the toggle */
}
```

Theme mechanics: `:root` holds the dark set. `prefers-color-scheme: light` applies the light set unless the toggle has forced dark. `data-theme="light"` or `"dark"` on `<html>` forces a theme. A three-word toggle (System, Light, Dark) writes `data-theme` and stores the choice in `localStorage` inside try/catch; an inline script in `<head>` applies the stored value before first paint so nothing flashes. `color-scheme` follows the theme so native controls and scrollbars match.

### Area mapping tokens

Set `data-area` on the page wrapper. Components read `--color-area*` and never name an area color directly.

```css
[data-area="models"]        { --color-area: var(--color-blue);  --color-area-text: var(--color-blue-text);  --color-area-tint: var(--color-blue-tint);  --color-on-area: var(--color-on-blue); }
[data-area="context"],
[data-area="tools"],
[data-area="orchestration"] { --color-area: var(--color-pink);  --color-area-text: var(--color-pink-text);  --color-area-tint: var(--color-pink-tint);  --color-on-area: var(--color-on-pink); }
[data-area="evals"],
[data-area="transition"]    { --color-area: var(--color-green); --color-area-text: var(--color-green-text); --color-area-tint: var(--color-green-tint); --color-on-area: var(--color-on-green); }
[data-area="operating"]     { --color-area: var(--color-amber); --color-area-text: var(--color-amber-text); --color-area-tint: var(--color-amber-tint); --color-on-area: var(--color-on-amber); }
```

Pages with no area (home, resources, sign-in, account) set no `data-area`. Neutral components then use `--color-text-secondary` where a component asks for `--color-area-text`, and no fill where it asks for `--color-area`.

### Computed contrast, light theme

Every text-on-background pair the site uses in light mode. AA is 4.5 for normal text and 3.0 for large text and for non-text boundaries.

| Pair | Foreground | Ground | Ratio | Normal | Large |
|---|---|---|---:|---|---|
| text on bg | `#14161c` | `#fffcf5` | 17.65 | pass | pass |
| secondary on bg | `#666668` | `#fffcf5` | 5.59 | pass | pass |
| text on surface | `#14161c` | `#f1eee8` | 15.62 | pass | pass |
| secondary on surface | `#666668` | `#f1eee8` | 4.95 | pass | pass |
| pink text on bg | `#c70093` | `#fffcf5` | 5.32 | pass | pass |
| pink text on surface | `#c70093` | `#f1eee8` | 4.71 | pass | pass |
| pink text on pink tint | `#c70093` | `#fee6ee` | 4.62 | pass | pass |
| blue text on bg | `#025bef` | `#fffcf5` | 5.47 | pass | pass |
| blue text on surface | `#025bef` | `#f1eee8` | 4.84 | pass | pass |
| blue text on blue tint | `#025bef` | `#e2eaf5` | 4.62 | pass | pass |
| green text on bg | `#017b48` | `#fffcf5` | 5.22 | pass | pass |
| green text on surface | `#017b48` | `#f1eee8` | 4.62 | pass | pass |
| green text on green tint | `#017b48` | `#e1f4e5` | 4.65 | pass | pass |
| amber text on bg | `#916100` | `#fffcf5` | 5.24 | pass | pass |
| amber text on surface | `#916100` | `#f1eee8` | 4.63 | pass | pass |
| amber text on amber tint | `#916100` | `#fff3d8` | 4.87 | pass | pass |
| text on pink tint | `#14161c` | `#fee6ee` | 15.30 | pass | pass |
| text on blue tint | `#14161c` | `#e2eaf5` | 14.92 | pass | pass |
| text on green tint | `#14161c` | `#e1f4e5` | 15.74 | pass | pass |
| text on amber tint | `#14161c` | `#fff3d8` | 16.42 | pass | pass |
| secondary on pink tint | `#666668` | `#fee6ee` | 4.85 | pass | pass |
| secondary on blue tint | `#666668` | `#e2eaf5` | 4.73 | pass | pass |
| secondary on green tint | `#666668` | `#e1f4e5` | 4.99 | pass | pass |
| secondary on amber tint | `#666668` | `#fff3d8` | 5.20 | pass | pass |
| `#fffcf5` on blue block | `#fffcf5` | `#1064f8` | 4.88 | pass | pass |
| `#14161c` on pink block | `#14161c` | `#f948be` | 5.77 | pass | pass |
| `#14161c` on green block | `#14161c` | `#01b66d` | 6.81 | pass | pass |
| `#14161c` on amber block | `#14161c` | `#fdad00` | 9.60 | pass | pass |
| primary button: bg on text fill | `#fffcf5` | `#14161c` | 17.65 | pass | pass |
| primary button hover: bg on secondary fill | `#fffcf5` | `#666668` | 5.59 | pass | pass |

Deck hex as text on the light ground, for the record and why the variants exist: pink 3.06 (large only), blue 4.88 on bg but 4.32 on surface, green 2.59 (fails both), amber 1.84 (fails both).

Non-text boundaries in light mode (3.0 required for controls and meaningful graphics):

| Pair | Foreground | Ground | Ratio | Result |
|---|---|---|---:|---|
| field border, secondary vs bg | `#666668` | `#fffcf5` | 5.59 | pass |
| field border, secondary vs surface | `#666668` | `#f1eee8` | 4.95 | pass |
| focus ring vs bg | `#14161c` | `#fffcf5` | 17.65 | pass |
| focus ring vs surface | `#14161c` | `#f1eee8` | 15.62 | pass |
| focus ring vs its gap | `#14161c` | `#fffcf5` | 17.65 | pass |
| pink stroke vs bg | `#c70093` | `#fffcf5` | 5.32 | pass |
| blue stroke vs bg | `#025bef` | `#fffcf5` | 5.47 | pass |
| green stroke vs bg | `#017b48` | `#fffcf5` | 5.22 | pass |
| amber stroke vs bg | `#916100` | `#fffcf5` | 5.24 | pass |
| pink fill vs bg | `#f948be` | `#fffcf5` | 3.06 | pass |
| blue fill vs bg | `#1064f8` | `#fffcf5` | 4.88 | pass |
| green fill vs bg | `#01b66d` | `#fffcf5` | 2.59 | fail as a boundary |
| amber fill vs bg | `#fdad00` | `#fffcf5` | 1.84 | fail as a boundary |
| hairline vs bg | `#c7c5c1` | `#fffcf5` | 1.68 | decorative only |
| dark diagram card vs bg | `#14161c` | `#fffcf5` | 17.65 | pass |

Consequences. In light mode the deck hex is used only where the text on it carries the meaning (area header, pitfall block, area button, "yours" badge) or where the object sits on the dark diagram tile (mini-map lit boxes, 3.62 to 9.60 on `#14161c`). Every stroke that carries meaning (area card line, chip stroke, callout edge, command pill) uses the text variant. The hairline is decorative in both themes (2.14 dark, 1.68 light) and is never the sole boundary of a control.

Dark theme pairs, recomputed from the brief for the same table:

| Pair | Foreground | Ground | Ratio | Normal | Large |
|---|---|---|---:|---|---|
| text on bg | `#fffcf5` | `#14161c` | 17.65 | pass | pass |
| secondary on bg | `#adaca9` | `#14161c` | 7.97 | pass | pass |
| text on surface | `#fffcf5` | `#303236` | 12.53 | pass | pass |
| secondary on surface | `#adaca9` | `#303236` | 5.66 | pass | pass |
| pink on bg | `#f948be` | `#14161c` | 5.77 | pass | pass |
| pink on surface | `#f948be` | `#303236` | 4.10 | fail | pass |
| pink on pink tint | `#f948be` | `#2b1b2c` | 5.17 | pass | pass |
| blue on bg | `#1064f8` | `#14161c` | 3.62 | fail | pass |
| blue on surface | `#1064f8` | `#303236` | 2.57 | fail | fail |
| blue on blue tint | `#1064f8` | `#13223f` | 3.16 | fail | pass |
| green on bg | `#01b66d` | `#14161c` | 6.81 | pass | pass |
| green on surface | `#01b66d` | `#303236` | 4.84 | pass | pass |
| green on green tint | `#01b66d` | `#122926` | 5.77 | pass | pass |
| amber on bg | `#fdad00` | `#14161c` | 9.60 | pass | pass |
| amber on surface | `#fdad00` | `#303236` | 6.82 | pass | pass |
| amber on amber tint | `#fdad00` | `#302819` | 7.73 | pass | pass |
| text on each tint | `#fffcf5` | tints | 14.20 to 15.82 | pass | pass |
| secondary on each tint | `#adaca9` | tints | 6.41 to 7.14 | pass | pass |
| focus ring vs bg, surface | `#fffcf5` | `#14161c`, `#303236` | 17.65, 12.53 | pass | pass |
| field border vs bg | `#adaca9` | `#14161c` | 7.97 | pass | |
| blue stroke vs bg | `#1064f8` | `#14161c` | 3.62 | pass | |
| blue stroke vs surface | `#1064f8` | `#303236` | 2.57 | fail | |

For the record only, not in the token set: if the site ever needs blue or pink at body size inside a dark card, the script found `#629aff` (blue, 4.64 on the surface) and `#ff5cc5` (pink, 4.64 on the surface). Both depart from the deck and need the author's approval.

## 4. Type

### Stacks

```css
:root {
  --font-sans: Helvetica, Arial, "Liberation Sans", sans-serif;
  --font-mono: Consolas, Menlo, ui-monospace, "Liberation Mono", "DejaVu Sans Mono", monospace;
  --weight-regular: 400;
  --weight-bold: 700;
}
```

Helvetica resolves on macOS and iOS. Arial resolves on Windows with the same character widths. Liberation Sans is metric-compatible with Arial on Linux. Consolas resolves on Windows and on any Mac with Office; Menlo on every other Mac; `ui-monospace` gives SF Mono on Apple platforms and the system mono elsewhere. No web fonts are loaded, so there is no font swap and nothing to license. Weights 400 and 700 only. `em` renders as Bold, `cite` and `i` render upright, because the brief allows no italics. This carries the deck's rule to the site and is a decision the author can reverse in one line.

### Scale

Root 16px. Sizes in rem. The deck's line spacing (1.15 at 32, 1.25 at 24 and below, Exactly at 44 and above) is tuned for slides read across a room, where tight leading keeps a three-line display block as one shape. Long-form reading wants more air, so body sits at 1.6 and compact at 1.5. Display and title keep tight leading because a wrapped heading at 1.6 falls apart.

| Role | Deck | Web size | Weight | Line height | Color | Used for |
|---|---|---|---|---|---|---|
| display | 44 display sentence; 60 area header | 2.75rem (44px); phone 2rem. Area header name 3.75rem (60px); phone 2.5rem | Regular; Bold on the one landing sentence and on area header names | 1.15; area header name 1.1 | primary; area header in `--color-on-area` | hero sentence on the home page, area header names, large quotes |
| title | 32 slide title | 2rem (32px); phone 1.75rem | Bold | 1.2 | primary | page title, one per page |
| heading | 24 heading | 1.5rem (24px) | Bold | 1.3 | primary; table headers in `--color-area-text` | section headings, card titles, table headers, callout leads, the self-check question |
| body | 24 body | 1.125rem (18px) | Regular | 1.6 | primary | paragraphs, lists, quotes |
| compact | 20 chip and compact | 1rem (16px) | Regular; Bold for labels | 1.5 | primary | pills, chips, table cells, card text, buttons, form fields, band sentences, sublines. The kicker is the exception at 1.25rem so the Models kicker counts as large text |
| small | 16 small | 0.875rem (14px) | Regular | 1.5 | secondary | captions, attributions, stat lines, the tool line on an artifact card, help text, the small line inside a card |
| fine | 12 diagram fine | 0.75rem (12px) | Regular; Bold in badges | 1.4 | secondary; badge text `#14161c` | timestamps in dense lists, the "yours" badge, nothing the reader must read to proceed. Never smaller |
| mono | Consolas at the surrounding size | 0.9375em of the surrounding size inline; code blocks at compact 1rem | Regular | inherits; code blocks 1.5 | primary on `--color-code-bg` | commands, filenames, formulas, versions, `works.any()` and `works.all()` |

Display mono (the deck's 72 Consolas lines) appears once on the site, if at all: the `demo = works.any()` and `product = works.all()` pair at 2.75rem on the home page, with the deck's runs: `demo`, `product`, the padding, and `=` in secondary, `works` in primary, `.any()` in `--color-amber-text`, `.all()` in `--color-green-text`.

### Spacing for reading

- Measure: prose at `max-width: 42rem` (about 70 characters at 18px). Tables, diagrams, and card rows may use `max-width: 64rem`.
- Paragraph spacing 1em (1.125rem at body). No first-line indent.
- List items 0.5em apart. Nested lists 0.25em.
- Heading rhythm: title has 0.5rem above (under the kicker) and 1rem below; heading has 2.5rem above and 0.75rem below; two headings in a row collapse the gap to 1rem.
- Small lines sit 0.5rem below what they support (the deck's 8).
- Gutter 1rem on phones, 2rem from 40rem, 3rem from 64rem (the deck's 48 on 960 is 5%).
- Spacing scale: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4rem.
- Radii: card and callout 0.5rem (the deck's 8), screenshot and mini-map tile 0.25rem (4), window frame 0.375rem (6), pill 999px.
- Strokes: hairline 1px, area line 2px, command and status pill 1.5px, field border 1px, field error 2px.
- Letter spacing: none, except display at -0.01em.

## 5. Components

Every component names its tokens. Nothing uses an area hex directly. Words carry meaning; color and stroke restate it.

### Page header: kicker, mini-map, title, divider

Structure, in order: a row holding the kicker on the left and the mini-map on the right, the title under the kicker, a hairline divider, then body content.

- **Kicker.** `<p class="kicker">` at 1.25rem, line height 1.25. `<b>` area name in `--color-area-text`, then ` · ` (U+00B7 with a space on each side), then the beat in `--color-text-secondary` Regular. Beats on the site: "When you are the user", "When you are the owner", the module's position ("Module 3 of 6"), or a section name. On Section 3 pages the area name is "The transition" in green. On neutral pages the kicker is the section name in secondary with no Bold word.
- **Mini-map.** A 10rem by 5.625rem tile (160 by 90), right-aligned on the kicker row, `background: var(--color-diagram-bg)`, 1px `--color-diagram-border`, radius 0.25rem, content the matching `mini-*.svg` inline or as `<img>`. Below 40rem the tile is 6rem by 3.375rem (96 by 54). It links to the map page. Alt text per section 7. Same position on every page that has one.
- **Title.** Title role, `max-width: 42rem`, 0.5rem under the kicker.
- **Divider.** 1px `--color-hairline`, full content width, 0.75rem under the title block (the deck's 12 under the header boundary). Body starts 1.5rem under the divider (the deck's 24).
- Pages with an area header strip put the kicker inside the strip and skip the divider: body starts 1.5rem under the strip.

### Area header strip (module pages)

A full-bleed band at the top of every module page. `background: var(--color-area)`, `color: var(--color-on-area)`, no line, no radius. Inner content aligns to the page gutter. `min-height: 8rem` (128), padding 1.5rem top and bottom (phone) or 2rem (desktop). Two lines: the area name at display size 3.75rem Bold, line height 1.1, letter spacing -0.01em; the beat at compact 1rem Regular, 0.5rem below. Both in `--color-on-area`. Under 40rem the name drops to 2.5rem so "Tools and extensibility" holds two lines at most. The mini-map may sit at the strip's right edge on its own dark tile. Text-on-block pairs are theme independent (4.88 to 9.60). The kicker is absent on a page with the strip; the strip is the kicker at large scale.

### Pitfall band (the failure exercise)

Full content width (or full bleed inside the module layout). `background: var(--color-surface)`, no line, radius 0 when full bleed, 0.5rem when inset. `min-height: 4rem` (64). Left block: `background: var(--color-area)`, `color: var(--color-on-area)`, width 18% with `min-width: 7rem`, holding the word "Pitfall" at compact 1rem Bold, vertically centered, padded to the gutter. Sentence: compact 1rem Regular in `--color-text`, starting 1.5rem after the block (the deck's 24), vertically centered, `max-width: 42rem`. An expanded band holds a second line at small 0.875rem `--color-text-secondary` under the sentence. Under 40rem the block becomes a 2.5rem tall strip across the top and the sentence sits below with 1rem padding. Markup: `<aside class="band band-pitfall" aria-label="Pitfall">`. When the exercise reveals it, it fades in 0.3s; under reduced motion it appears.

Stacked bands (a recap page): the same construction repeated with 0.5rem gaps, the block holding the area name Bold instead of "Pitfall", each block in its own area color. Three pink blocks in a column read as a legend, so the color stays in the block and never across the band.

### Artifact card

A card: `background: var(--color-surface)`, radius 0.5rem, no line, padding 1rem top and bottom, 1.25rem sides. Contents in order:

1. A header row: the title at heading 1.5rem Bold in `--color-text`, and the origin chip right-aligned.
2. **Origin label chip.** A pill (padding 0.125rem 0.625rem, radius 999px, 1px `--color-hairline` stroke, no fill), small 0.875rem Regular in `--color-text`, reading one of `captured`, `synthetic`, `public`. A visually hidden "Origin:" prefix precedes the word. The three chips are typographically identical: origin is not an area, so it carries no color. The word is the signal.
3. The body at compact 1rem Regular in `--color-text`.
4. **Tool, version, checked-on line.** Small 0.875rem in `--color-text-secondary`, dot-separated: `<code>claude-code 2.1.14</code> · checked on <time datetime="2026-09-15">15 Sep 2026</time>`. Mono runs at 0.9375em in `--color-text` (the deck's sub-20 rule: the face marks them, not blue). No prefix, no label.
5. A stale-date notice when the checked-on date is older than the content's threshold (section below).

A card and its contents enter together with a 0.2s fade when revealed; otherwise no motion.

### Callout

Two forms, both in the brief's vocabulary.

- **Plain callout.** The slide 8 callout: a heading 1.5rem Bold lead line in `--color-text`, 1.5rem above it, body text under it. No band, no fill.
- **Surface callout.** A card with a 4px left edge: `border-left: 4px solid var(--color-area-text)`, `background: var(--color-surface)`, radius 0.5rem, padding 1rem 1.25rem. A compact 1rem Bold label on the first line ("Note", "Try it", "Why this matters"), body text below. On a neutral page the edge is `--color-text-secondary`. This is the brief's projector fallback for a band (a surface with a colored edge and a Bold label). The edge uses the text variant so it passes 3:1 in light mode (5.22 to 5.47).

### Collapsible section

`<details>` with a `<summary>` at heading 1.5rem Bold. A 1px `--color-hairline` rule above the summary, padding 1rem 0. The marker is a chevron drawn with a 2px stroke in `--color-text-secondary` (an inline SVG using `currentColor`, 1rem square), right of the label, rotating 90 degrees when open with a 0.2s transition. The native marker is hidden (`list-style: none`; `::-webkit-details-marker { display: none }`). Content aligns to the grid's left edge with 1rem padding below. The summary takes the focus ring. Under reduced motion the chevron flips without transition.

### Self-check question card (Preact island)

A card with radius 0.5rem holding: the question at heading 1.5rem Bold; options as a `<fieldset>` of labelled radios, each row a full-width block with a 1px `--color-hairline` stroke, radius 0.5rem, padding 0.75rem 1rem, compact 1rem text, the native radio visible with `accent-color: var(--color-text)`; a "Check answer" area button; an `aria-live="polite"` feedback region that always exists.

States:

- **Pending.** The card is a plain card on `--color-surface` with no line. The chosen option row takes a 2px `--color-area-text` stroke. The button is disabled until an option is chosen; disabled is `--color-surface` fill with `--color-text-secondary` text (5.66 dark, 4.95 light), no opacity tricks. The feedback region is empty.
- **Correct.** The card becomes an area card in green: `background: var(--color-green-tint)`, `border: 2px solid var(--color-green-text)`. The feedback region reads "Correct" at compact 1rem Bold in `--color-green-text`, followed by the explanation at body size in `--color-text`. The chosen row's stroke turns green. Green is the verification color and `works.all()`.
- **Incorrect.** The card becomes an area card in amber: `background: var(--color-amber-tint)`, `border: 2px solid var(--color-amber-text)`. The feedback region reads "Not yet" Bold in `--color-amber-text`, then the explanation, which names what to reread. The chosen row's stroke turns amber. Amber is the warning color and `works.any()`. The palette has no red and needs none: the word carries the state and the color restates it.

The feedback region fades in 0.2s; the card's fill and stroke change with no transition; nothing shakes or slides. Under reduced motion everything cuts. All feedback pairs are in the section 3 tables (green text on green tint 4.65 light, 5.77 dark; amber text on amber tint 4.87 light, 7.73 dark).

### Progress status chips

Pills at small 0.875rem, padding 0.125rem 0.625rem, radius 999px, no fill. Text is the state word.

| State | Word | Stroke | Text |
|---|---|---|---|
| not started | Not started | 1px `--color-hairline` | `--color-text-secondary` Regular |
| in progress | In progress | 1.5px `--color-amber-text` | `--color-amber-text` Regular |
| complete | Complete | 1.5px `--color-green-text` | `--color-green-text` Regular |

Colored pills take the 1.5px stroke of the deck's command pill; the neutral pill takes the deck's 1px hairline. The word always differs, so no state relies on color. Chips sit in the module list and beside a module title, 0.5rem gaps.

### Prerequisite notice

A surface callout placed directly under the page header divider. Its left edge is the prerequisite module's area color as `--color-<area>-text`. Label "Before this module" at compact 1rem Bold, then one line: "Read " followed by a link to the prerequisite with the module name Bold in that module's `--color-<area>-text`. With prerequisites in more than one area the edge is `--color-text-secondary` and each link's name takes its own area color, the way the agenda line names areas in their own colors. Markup `<aside role="note" aria-label="Prerequisite">`.

### Stale-date notice

Appears on an artifact card, or beside any dated claim, when the checked-on date is older than the content's threshold (default 90 days, set in front matter). It is one line at small 0.875rem: a pill reading "May be stale" with a 1.5px `--color-amber-text` stroke and `--color-amber-text` text, then a sentence in `--color-text-secondary`: "Checked on 1 Mar 2026. Verify before relying on it." No fill, no band. Amber is the warning role. Markup `<p role="note">`.

### Buttons

Pill shape, radius 999px, compact 1rem Bold label, padding 0.5rem 1.25rem, `min-height: 2.75rem`, no shadow, no gradient. Hover and focus underline the label (1px, offset 0.15em); this is the site's one hover device and it matches links. Active state shifts the fill as listed. No transform. Every button takes the focus ring below.

| Kind | Fill | Text | Stroke | Active | Use |
|---|---|---|---|---|---|
| primary | `--color-text` | `--color-bg` | none | fill `--color-text-secondary` (7.97 dark, 5.59 light) | one per view: Notify me, Sign in with GitHub, Sign in with Google, Save |
| outline | none | `--color-text` | 1px `--color-text-secondary` | fill `--color-surface` | secondary actions: Cancel, Show answer, Copy |
| area | `--color-area` | `--color-on-area` | none | label underlined, fill unchanged | actions inside a module: Check answer, Reveal the pitfall, Mark complete |
| disabled | `--color-surface` | `--color-text-secondary` | none | none | any kind |

The outline button's stroke is `--color-text-secondary`, not the hairline, so its boundary meets 3:1 (7.97 dark, 5.59 light). Sign-in buttons carry the provider name as text and no logo, unless a provider's brand terms require its mark.

### Form fields

Text, email, textarea, select: `background: var(--color-surface)`, `border: 1px solid var(--color-field-border)` (the secondary text color, 7.97 dark and 5.59 light against the ground, 5.66 and 4.95 against the surface), radius 0.5rem, padding 0.625rem 0.875rem, compact 1rem `--color-text`, `min-height: 2.75rem`. Placeholder in `--color-text-secondary`. Label above at compact 1rem Bold with a 0.375rem gap; an optional help line below at small 0.875rem secondary linked by `aria-describedby`. Required fields say "required" in small secondary after the label; no asterisk. Error state: border 2px `--color-amber-text`, message at small 0.875rem in `--color-amber-text` starting with a Bold word ("Fix:"), `aria-invalid="true"`. Checkbox and radio: native, `accent-color: var(--color-text)`, 1.125rem square, label to the right at compact size. The notify-me form is one email field and one primary button on one row from 40rem, stacked below.

### Focus ring

One rule for every focusable element:

```css
:focus-visible {
  outline: 2px solid transparent;      /* becomes visible in forced-colors mode */
  box-shadow: 0 0 0 2px var(--color-focus-gap), 0 0 0 4px var(--color-focus);
  border-radius: inherit;
}
```

The outer 2px ring is `--color-focus`, which is the primary text color: `#fffcf5` in dark, `#14161c` in light. The inner 2px gap is the page ground. The ring meets 3:1 against every adjacent color in both themes: 17.65 against the ground, 12.53 (dark) and 15.62 (light) against the surface, 14.20 or more against any tint, and 17.65 against its own gap. The gap keeps the ring distinct on a solid block button. The deck blue was considered and rejected as a ring: 2.57 against the dark surface. Links inside prose use `outline-offset: 2px` with the same shadow. `:focus:not(:focus-visible)` shows nothing, so mouse clicks do not draw the ring.

### Links

`--color-link` is the primary text color, as in the deck's hyperlink slot. Links are underlined with a 1px underline in `--color-link-underline` (secondary), `text-underline-offset: 0.15em`. Hover thickens the underline to 2px in `--color-text`. Visited is unchanged. Color never distinguishes a link; the underline does. Links inside a kicker or a colored area name keep the area color and the underline.

### Code

Inline `<code>`: mono at 0.9375em, `--color-text`, `background: var(--color-code-bg)`, padding 0.1em 0.35em, radius 0.25rem. Code blocks: mono 1rem, line height 1.5, `--color-code-bg`, 1px `--color-hairline`, radius 0.5rem, padding 1rem, horizontal scroll, no line numbers. Command pills (a command shown as a chip, as on the deck): pill with a 1.5px `--color-blue-text` stroke and mono text in `--color-text`. Blue text on the command itself only inside large text in dark mode; in light mode `--color-blue-text` may color a command at any size, but the site keeps commands primary in both themes for consistency.

### Tables

Headers at heading 1.5rem Bold in `--color-area-text` (secondary on a neutral page). Cells at compact 1rem Regular `--color-text`. No rules, no fills, no zebra. Cell padding 0.75rem 0 vertically (the deck's row gap 12), 1rem between columns. A small line under a cell is small 0.875rem secondary. Tables wider than the measure scroll horizontally inside a container; they never shrink type. A comparison table may set the right column Bold in the area color of the thing it names, with unchanged rows in `--color-green-text`. `<th scope>` on every header. If a long table needs row separation, a 1px `--color-hairline` between rows is permitted as a web concession; the author decides.

### Attributions, captions, stat lines

Small 0.875rem `--color-text-secondary`, line height 1.5, no prefix, no dash, no glyph. Placed 0.5rem under what they support and left-aligned to it. Mono runs inside stay `--color-text`. Quotes: body size for short quotes and display 2.75rem Regular for one landing quote, typed quotation marks, attribution 0.75rem below. No bar, no glyph, no italics.

### Screenshots and images

1px `--color-hairline` and radius 0.25rem in dark; the same in light. Captions as above. Round images only for a person.

### Reduced motion and motion rules

Motion on the site is limited to what the deck allows: opacity fades of 0.2s on cards, pills, images, and feedback, 0.3s on the pitfall band, a 0.2s chevron rotation, and no other transition. Nothing over 0.5s. No transform on hover, no parallax, no scroll-triggered animation, no theme cross-fade.

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
html { scroll-behavior: smooth; }  /* overridden above */
```

The Preact islands check `matchMedia('(prefers-reduced-motion: reduce)')` before animating anything with script. Words cut, pictures fade, and under reduced motion everything cuts.

## 6. Reusing the SVGs

### Inventory

All paths under `beyond-the-coding-agent/internal/`. Every SVG has `viewBox="0 0 1920 1080"` and every one begins with an opaque `<rect width="1920" height="1080" fill="#14161c"/>`, outside every layer group, so it never dims and the file never shows the page ground.

| File | viewBox and size | What it shows | Works on a light ground? |
|---|---|---|---|
| `anatomy-of-an-agentic-ai-system-landscape.svg` | 1920 by 1080 | The full map. Title "Anatomy of an Agentic AI System". A Platform container ("Runs, secures, and improves the agent") holding a Per-run services row (Identity and access, Security, Data and knowledge), a dashed One run container ("Repeats for each goal") with Goal, an arrow, an Agent container ("Model + harness") holding the Model box (blue tint and stroke), a plus sign, and the Harness region (pink tint and stroke) with six boxes (Orchestration, Tools, Context and memory, Guardrails, Instructions, Verification), an arrow, and "Run until a stopping condition is met", then an Across runs row (Observability, Evaluations, Governance). Twelve `<g id>` layers: title, platform, per-run, one-run, goal, arrows, agent, model, plus, harness, stop, across-runs. Rect ids `box-*` on 16 rectangles. | No. Title `#fffcf5` is 1.00 on `#fffcf5`; subtitles `#adaca9` are 2.22; box fills `#303236` would look like black slabs. The opaque canvas rect means it renders as a dark panel anyway |
| `anatomy-of-an-agentic-ai-system-landscape-yours.svg` | 1920 by 1080 | The base with the title extended to "Anatomy of an Agentic AI System: every box is yours" and a `badges` group: 14 amber `#fdad00` pills (36 units tall, text 24 Bold `#14161c`) straddling the top-right edge of every box except Goal and the Harness container. The Model badge reads "yours to select"; the other 13 read "yours" | No, same reasons. The badges themselves pass on either ground (9.60) |
| `generated/landscape-model.svg` | 1920 by 1080 | The base with every group except `model` at opacity 0.3 | No |
| `generated/landscape-harness.svg` | 1920 by 1080 | The base with every group except `harness` at 0.3 | No |
| `generated/landscape-per-run.svg` | 1920 by 1080 | The base with every group except `per-run` (the row label and its three boxes) at 0.3 | No |
| `generated/landscape-across-runs.svg` | 1920 by 1080 | The base with every group except `across-runs` at 0.3 | No |
| `generated/mini-models.svg` | 1920 by 1080, rendered at 160 by 90 | Text-free map: 15 box outlines and the Harness container outline, 18 unit `#adaca9` strokes. The Model box filled `#1064f8` | No. Outlines are 2.22 on the light ground and lit amber and green would be 1.84 and 2.59 as shapes |
| `generated/mini-context.svg` | same | Data and knowledge, Context and memory, Instructions filled `#f948be` | No |
| `generated/mini-tools.svg` | same | Tools filled `#f948be` | No |
| `generated/mini-orchestration.svg` | same | Orchestration filled `#f948be` | No |
| `generated/mini-evals.svg` | same | Verification and Evaluations filled `#01b66d` | No |
| `generated/mini-operating.svg` | same | Identity and access, Security, Guardrails, Observability, Governance filled `#fdad00` | No |
| `generated/mini-all.svg` | same | Every area lit: Model blue; Data and knowledge, Orchestration, Tools, Context and memory, Instructions pink; Verification and Evaluations green; Identity and access, Security, Guardrails, Observability, Governance amber. Goal and the stopping condition stay outlines | No |

The mini-map boxes are respaced relative to the full map (harness boxes 328 by 80 at x 762 and 1130, y 530, 636, 742; row boxes 560 wide at x 72, 680, 1288) so the gaps survive at a twelfth of the size. The layout is the same at a glance.

Not SVGs, listed for completeness: `anatomy-of-an-agentic-ai-system.png` (2560 by 3104, portrait) is an earlier light-themed rendering with a different palette (teal labels, a red Goal, a green Model, a violet Harness, a beige Agent). It is off-brief and should not appear on the site. `renders/map-*.png` (six files, 3840 by 2160) and `renders/mini-*.png` (seven files, 640 by 360) are the Chrome renders of the SVGs above. `profile-320.webp` is the author's photo.

### What `build-diagrams.mjs` needs and produces

Needs: Node (ESM, `node:fs`, `node:child_process`, `node:path`, `node:os`, `node:url`; no npm packages) and Google Chrome at the hard-coded macOS path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Both are present on this machine (Node 24.15.0; Chrome installed). Run `node internal/build-diagrams.mjs` from anywhere; paths resolve from the script's own directory. The base SVG must keep all 16 `box-*` rect ids or the script throws before writing anything.

Does, in order:

1. Reads the base SVG and extracts the geometry of every `box-*` rect.
2. Writes `anatomy-of-an-agentic-ai-system-landscape-yours.svg`: retitles and appends the `badges` group. Badge width is estimated from label length at 14.4 units per glyph.
3. Writes four highlight states to `generated/landscape-{model,harness,per-run,across-runs}.svg` by adding `opacity="0.3"` to every group except the kept one.
4. Writes seven mini-maps to `generated/mini-{models,context,tools,orchestration,evals,operating,all}.svg` from a hard-coded box table and area table.
5. Renders through headless Chrome screenshots: six full maps at 1920 by 1080 with device scale 2 (3840 by 2160) and seven minis at 160 by 90 with scale 4 (640 by 360), into `renders/`. Each render waits for the PNG to stop growing, then kills Chrome. Thirteen renders take on the order of a minute.

Colors are hard-coded twice: in the constant `C` (bg, primary, secondary, four accents) used for badges and minis, and as literal fills inside the base SVG, which the yours and highlight variants inherit. There is no theme parameter, no color substitution step, and fixed output filenames. Producing light variants would mean adding a substitution map for about ten values (canvas, primary, secondary, surface, hairline, the two tints, the Model title color, the mini outline color) applied to both the base string and `C`, a second set of output names, and a second render pass. The Model title would need its own light value because `#1064f8` on the light blue tint is 4.32 and on the deck's dark tint it is already only 3.16. The mini outline `#adaca9` would need a darker gray. That is a script fork plus a second hand-tuning pass over section 8 of the brief.

### Recommendation: (a) present every diagram on a dark surface in both themes

Present the full map, its highlight states, the yours variant, and the mini-map on a `--color-diagram-bg: #14161c` tile in both themes, with a 1px `--color-diagram-border` and a 0.5rem radius on the full map (0.25rem on the mini-map). Reasons:

1. The files already do this. Every SVG carries an opaque `#14161c` canvas. On a light page they render as a dark panel with no work. Option (b) starts by removing that canvas and then re-tunes everything on it.
2. The diagram is the talk's spine. Readers who saw the talk should meet the same picture. One set of pixels in both themes keeps that promise.
3. Every meaningful color inside the diagram passes on the dark tile and fails on the light ground: mini outlines 2.22, lit amber 1.84, lit green 2.59 on `#fffcf5`, against 3.62 to 9.60 on `#14161c`. Option (b) needs new outline, tint, and title colors that the brief has not decided.
4. The generator has no theme switch. Option (b) is a fork of `build-diagrams.mjs`, a second render set, and a second file inventory to keep in sync with the deck's source of truth.
5. A dark diagram in a light page reads like a code block. The site already has dark code blocks in the deck's vocabulary (a surface with a hairline).

Cost: a dark rectangle in the light theme. It is mitigated by the border and radius, by placing every diagram at the same content width, and by giving the mini-map tile the same treatment on every page so it reads as a fixed device, not a stray image.

How to embed:

- **Full map.** Inline the base SVG once as an Astro component, with `role="img"`, `<title>` and `<desc>` from section 7, and `aria-labelledby` pointing at both. Drive the highlight states with a `data-highlight` attribute and CSS (`.map[data-highlight="model"] g:not(#model) { opacity: 0.3 }`) instead of the four generated files, and add the badges group for the yours state. Keep `font-family="Helvetica, Arial, sans-serif"` as the file has it. Inline SVG text scales with the viewBox, so at 360px wide the 24 unit subtitles are 4.5px: wrap the map in a container with `min-width: 48rem` and horizontal scroll on narrow screens, and place the long description directly under it in a collapsible section. At 48rem the subtitles are 9.6px and the titles 12.8px; at 60rem they are 12px and 16px.
- **Mini-map.** Inline the seven `mini-*.svg` files as a component keyed by area, or use `<img>` with the one-line alt from section 7. Inline is preferred because the tile's `<title>` can carry the alt and the SVG needs no request. Never scale it above 10rem wide.
- **Fallback.** If inline SVG is refused for any reason, use `renders/map-*.png` (3840 by 2160) and `renders/mini-*.png` (640 by 360) as `<img>` with the same alt text. They are already 2x and 4x.

## 7. Text alternatives

### Full map, short alt

"Anatomy of an agentic AI system. A platform wraps one run: a goal feeds an agent made of a model plus a harness, which runs until a stopping condition is met. Per-run services sit above the run and across-run services below."

For the yours variant, append: "Every box except Goal carries an amber badge reading yours; the Model badge reads yours to select."

For a highlight state, append one of: "The Model box is highlighted and the rest is dimmed." "The Harness region is highlighted and the rest is dimmed." "The per-run services row is highlighted and the rest is dimmed." "The across-runs row is highlighted and the rest is dimmed."

### Full map, long description

Title: Anatomy of an Agentic AI System.

The whole diagram sits inside one rounded container labelled Platform, described as "Runs, secures, and improves the agent". It has three bands from top to bottom.

Top band, Per-run services, described as "Every run draws on these". Three boxes in a row:

- Identity and access: auth, permissions, scoped credentials.
- Security: injection defense, sandboxing, secrets.
- Data and knowledge: RAG, vector stores, connectors.

Middle band, a dashed container labelled One run, described as "Repeats for each goal". Reading left to right:

- Goal, outlined, "From user, trigger, or schedule".
- An arrow into a container labelled Agent, described as "Model + harness". Inside it, on the left, the Model box, in blue, "Decides what to do". A plus sign. On the right, the Harness region, in pink, "Carries state across turns", holding six boxes in two columns and three rows: Orchestration (loop, hooks, workflows) and Tools (files, shell, web, MCP); Context and memory (history, working memory) and Guardrails (limits on actions); Instructions (system prompt, config) and Verification (tests, checks, self-review).
- An arrow out of the Agent into a box reading "Run until a stopping condition is met".

Bottom band, Across runs, described as "Learn from and control many runs over time". Three boxes in a row:

- Observability: logs, traces, metrics, cost.
- Evaluations: offline evals, regression suites, A/B.
- Governance: policies, audit trails, approvals.

Color carries area membership: the Model is blue, the Harness is pink, generic boxes and containers are gray. The yours variant adds an amber badge to the top-right corner of every box except Goal, reading "yours", and the Model's badge reads "yours to select". The highlight variants keep one region at full brightness and dim everything else to 30 percent.

### Mini-map, one line each

- `mini-models`: "Mini-map of the anatomy diagram with the Model box lit blue."
- `mini-context`: "Mini-map with Data and knowledge, Context and memory, and Instructions lit pink."
- `mini-tools`: "Mini-map with the Tools box lit pink."
- `mini-orchestration`: "Mini-map with the Orchestration box lit pink."
- `mini-evals`: "Mini-map with Verification and Evaluations lit green."
- `mini-operating`: "Mini-map with Identity and access, Security, Guardrails, Observability, and Governance lit amber."
- `mini-all`: "Mini-map with every area lit: Model blue; Data and knowledge, Orchestration, Tools, Context and memory, and Instructions pink; Verification and Evaluations green; Identity and access, Security, Guardrails, Observability, and Governance amber. Goal and the stopping condition stay outlined."

When the mini-map links to the map page, the link's accessible name is the alt plus "Open the map".

## Appendix: how the ratios were produced

`research/contrast.mjs` implements WCAG 2.x relative luminance and contrast, sRGB alpha blending for the derived roles, and an OKLCH darkening search for the area text variants (hue kept, chroma clipped to sRGB, lightness stepped down by 0.002 until every listed ground reaches 4.6). It prints every table above. `research/contrast-output.md` is its saved output.

