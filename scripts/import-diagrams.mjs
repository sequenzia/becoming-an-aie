// scripts/import-diagrams.mjs
// Plain Node, no packages. Copies the talk's diagram SVGs into src/assets/diagrams (blueprint 10.6).
//
// Usage: node scripts/import-diagrams.mjs <path to the beyond-the-coding-agent checkout>
//
// What it does, in order:
// 1. Copies the two full maps and the seven mini-maps under the names the site uses.
// 2. In the two full maps, rewrites every `<g id="<layer>">` to `<g data-layer="<layer>">`,
//    removes every `id="box-*"` attribute, and replaces the arrowhead marker (the one remaining id)
//    with two explicit arrowhead paths that render the same pixels.
// 3. In the two full maps, recolors the Model label from the blue #1064f8 to the primary text color
//    #fffcf5. The site renders the 1920-unit map at about 0.4 scale, where the 32-unit bold label is
//    13 to 14 px and needs 4.5:1 (WCAG 1.4.3); blue on the box tint #13223f is 3.16:1, the primary
//    is 15.4:1. Every other label already passes. The talk's own later builds make the same change.
// 4. Fails if any `id` attribute remains in any copied file, so two inline maps and any number of
//    mini-maps can share one page without duplicate ids.
// 5. Writes src/assets/diagrams/SOURCE.md with the source path, the talk repository commit, and the date.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LAYERS = [
  'title',
  'platform',
  'per-run',
  'one-run',
  'goal',
  'arrows',
  'agent',
  'model',
  'plus',
  'harness',
  'stop',
  'across-runs',
  'badges',
];

const MINI_KEYS = ['models', 'context', 'tools', 'orchestration', 'evals', 'operating', 'all'];

const FULL_MAPS = [
  { from: 'internal/anatomy-of-an-agentic-ai-system-landscape.svg', to: 'anatomy-landscape.svg' },
  { from: 'internal/anatomy-of-an-agentic-ai-system-landscape-yours.svg', to: 'anatomy-landscape-yours.svg' },
];

const MINI_MAPS = MINI_KEYS.map((key) => ({ from: `internal/generated/mini-${key}.svg`, to: `mini-${key}.svg` }));

function fail(message) {
  console.error(`import-diagrams: ${message}`);
  process.exit(1);
}

const talkRepo = process.argv[2];
if (!talkRepo) fail('usage: node scripts/import-diagrams.mjs <path to the beyond-the-coding-agent checkout>');
const sourceRoot = resolve(talkRepo);
if (!existsSync(join(sourceRoot, 'internal'))) fail(`${sourceRoot} has no internal/ directory`);

const outDir = resolve(process.cwd(), 'src/assets/diagrams');
mkdirSync(outDir, { recursive: true });

/** Rewrites the layer groups. Fails on a group id that is not in the layer list. */
function rewriteLayers(svg, name) {
  return svg.replace(/<g id="([^"]+)"/g, (_match, id) => {
    if (!LAYERS.includes(id)) fail(`${name}: unexpected layer id "${id}"; add it to LAYERS if the talk added a layer`);
    return `<g data-layer="${id}"`;
  });
}

/** Removes the box ids. Their geometry is not referenced by anything in the file. */
function stripBoxIds(svg) {
  return svg.replace(/\s+id="box-[^"]+"/g, '');
}

/**
 * Replaces the arrowhead marker with explicit paths.
 * The talk's marker is viewBox 0 0 10 10, refX 9, refY 5, markerWidth 5, markerHeight 5, orient auto,
 * path M0,0 L10,5 L0,10 z, default markerUnits (strokeWidth). On a 4 unit line the marker viewport is
 * 20 by 20, so one marker unit is 2 user units, and marker point (mx, my) lands at
 * (x2 + (mx - 9) * 2, y2 + (my - 5) * 2). Every arrow in the file is horizontal and points right.
 * If the marker changes upstream the script stops and says so.
 */
function inlineArrowheads(svg, name) {
  const defs = svg.match(/<defs>([\s\S]*?)<\/defs>\s*/);
  if (!defs) fail(`${name}: no <defs> block; the arrow marker moved, update inlineArrowheads`);
  const marker = defs[1].match(/<marker id="([^"]+)"([^>]*)>\s*<path d="([^"]+)" fill="([^"]+)"\/>\s*<\/marker>/);
  if (!marker) fail(`${name}: the marker definition changed shape, update inlineArrowheads`);
  const [, markerId, markerAttrs, markerPath, fill] = marker;
  const attr = (key) => {
    const m = markerAttrs.match(new RegExp(`\\b${key}="([^"]+)"`));
    return m ? m[1] : null;
  };
  const expected = { viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto' };
  for (const [key, value] of Object.entries(expected)) {
    if (attr(key) !== value) fail(`${name}: marker ${key} is ${attr(key)}, expected ${value}; update inlineArrowheads`);
  }
  if (markerPath.replace(/\s+/g, '') !== 'M0,0L10,5L0,10z') fail(`${name}: marker path changed; update inlineArrowheads`);
  if (attr('markerUnits') !== null) fail(`${name}: marker sets markerUnits; update inlineArrowheads`);

  const refX = 9;
  const refY = 5;
  const markerUnitsPerViewBoxUnit = 5 / 10; // markerWidth over viewBox width
  let replaced = 0;
  const lineRe = new RegExp(`<line ([^>]*?)\\s*marker-end="url\\(#${markerId}\\)"\\s*/>`, 'g');
  let out = svg.replace(lineRe, (_match, attrs) => {
    const get = (key) => {
      const m = attrs.match(new RegExp(`\\b${key}="([^"]+)"`));
      return m ? m[1] : null;
    };
    const x1 = Number(get('x1'));
    const y1 = Number(get('y1'));
    const x2 = Number(get('x2'));
    const y2 = Number(get('y2'));
    const strokeWidth = Number(get('stroke-width'));
    if ([x1, y1, x2, y2, strokeWidth].some((n) => Number.isNaN(n))) fail(`${name}: arrow line attributes changed`);
    if (y1 !== y2 || x2 <= x1) fail(`${name}: an arrow is not horizontal and pointing right; update inlineArrowheads`);
    const scale = strokeWidth * markerUnitsPerViewBoxUnit;
    const point = (mx, my) => `${x2 + (mx - refX) * scale},${y2 + (my - refY) * scale}`;
    const d = `M${point(0, 0)} L${point(10, 5)} L${point(0, 10)} z`;
    replaced += 1;
    return `<line ${attrs}/>\n    <path d="${d}" fill="${fill}"/>`;
  });
  if (replaced === 0) fail(`${name}: no arrow uses the marker; update inlineArrowheads`);
  out = out.replace(defs[0], '');
  return out;
}

/**
 * The Model label is the only text in the talk's maps under 4.5:1 on its background (blue #1064f8 on the
 * tint #13223f, 3.16:1). The site shows the map at about 0.4 scale, so the label is small text. Primary
 * #fffcf5 gives 15.4:1 and matches the other box labels. Fails if the label is not where this expects it.
 */
function recolorModelLabel(svg, name) {
  const label = /(<text\b[^>]*font-weight="700"[^>]*\bfill=")(#[0-9a-fA-F]{6})("[^>]*>Model<\/text>)/;
  const m = svg.match(label);
  if (!m) fail(`${name}: the Model label text was not found; update recolorModelLabel`);
  if (m[2].toLowerCase() !== '#1064f8' && m[2].toLowerCase() !== '#fffcf5') {
    fail(`${name}: the Model label fill is ${m[2]}, expected #1064f8 or #fffcf5; check its contrast and update recolorModelLabel`);
  }
  return svg.replace(label, `$1#fffcf5$3`);
}

function assertNoIds(svg, name) {
  const remaining = svg.match(/\sid="[^"]*"/g);
  if (remaining) fail(`${name}: id attributes remain: ${remaining.join(' ')}`);
}

const written = [];
for (const { from, to } of FULL_MAPS) {
  const path = join(sourceRoot, from);
  if (!existsSync(path)) fail(`missing ${path}`);
  let svg = readFileSync(path, 'utf8');
  svg = rewriteLayers(svg, from);
  svg = stripBoxIds(svg);
  svg = inlineArrowheads(svg, from);
  svg = recolorModelLabel(svg, from);
  assertNoIds(svg, from);
  if (!/<g data-layer="title">/.test(svg)) fail(`${from}: the title layer is missing`);
  writeFileSync(join(outDir, to), svg);
  written.push({ from, to });
}
for (const { from, to } of MINI_MAPS) {
  const path = join(sourceRoot, from);
  if (!existsSync(path)) fail(`missing ${path}`);
  const svg = readFileSync(path, 'utf8');
  assertNoIds(svg, from);
  if (!/viewBox="0 0 1920 1080"/.test(svg)) fail(`${from}: viewBox changed`);
  writeFileSync(join(outDir, to), svg);
  written.push({ from, to });
}

let commit = 'unknown';
let remote = 'unknown';
try {
  commit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  remote = execFileSync('git', ['-C', sourceRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout. The commit stays unknown and SOURCE.md says so.
}
const date = new Date().toISOString().slice(0, 10);

const lines = [
  '# Diagram sources',
  '',
  'Generated by `scripts/import-diagrams.mjs`. Do not edit the SVGs by hand; rerun the script against a fresh checkout of the talk repository.',
  '',
  `- Source checkout: \`${sourceRoot}\``,
  `- Repository: ${remote}`,
  `- Commit: ${commit}`,
  `- Imported on: ${date}`,
  '',
  '## Files',
  '',
  ...written.map(({ from, to }) => `- \`${to}\` from \`${from}\``),
  '',
  '## Transformations',
  '',
  '- Full maps: every `<g id="<layer>">` became `<g data-layer="<layer>">`; every `id="box-*"` attribute was removed; the arrowhead marker in `<defs>` was replaced by two explicit arrowhead paths with the same geometry. No `id` attribute remains, so two maps can share a page.',
  '- Full maps: the Model label fill is `#fffcf5` instead of the talk\'s `#1064f8`. At the size the site renders the map, blue on the `#13223f` tint is 3.16:1 and fails WCAG 1.4.3; the primary color is 15.4:1 (docs/decisions.md, 2026-10-03).',
  '- Mini-maps: copied unchanged. They carry no ids.',
  '- Components add `role`, `aria-labelledby`, `<title>`, and `<desc>` at render time (blueprint 10.4).',
  '',
];
writeFileSync(join(outDir, 'SOURCE.md'), lines.join('\n'));

console.log(`import-diagrams: wrote ${written.length} files to ${outDir} from ${sourceRoot} at ${commit}`);
