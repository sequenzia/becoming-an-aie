// src/components/site/diagrams.ts
// Text alternatives and string helpers for the inline diagram components (MiniMap, AnatomyMap).
// The alt texts are docs/research/design-tokens.md section 7, verbatim. No other workstream imports this file.
import type { MiniMapKey } from '../../lib/types';

export type MapVariant = 'base' | 'yours';
export type MapHighlight = 'model' | 'harness' | 'per-run' | 'across-runs';

/** One line per mini-map variant. Used as the SVG title and aria-label. */
export const MINI_MAP_ALT: Record<MiniMapKey, string> = {
  models: 'Mini-map of the anatomy diagram with the Model box lit blue.',
  context: 'Mini-map with Data and knowledge, Context and memory, and Instructions lit pink.',
  tools: 'Mini-map with the Tools box lit pink.',
  orchestration: 'Mini-map with the Orchestration box lit pink.',
  evals: 'Mini-map with Verification and Evaluations lit green.',
  operating: 'Mini-map with Identity and access, Security, Guardrails, Observability, and Governance lit amber.',
  all: 'Mini-map with every area lit: Model blue; Data and knowledge, Orchestration, Tools, Context and memory, and Instructions pink; Verification and Evaluations green; Identity and access, Security, Guardrails, Observability, and Governance amber. Goal and the stopping condition stay outlined.',
};

/** The full map's short alt, split into the title (first sentence) and the description (the rest). */
export const MAP_TITLE: Record<MapVariant, string> = {
  base: 'Anatomy of an agentic AI system.',
  yours: 'Anatomy of an agentic AI system: every box is yours.',
};

export const MAP_DESC =
  'A platform wraps one run: a goal feeds an agent made of a model plus a harness, which runs until a stopping condition is met. Per-run services sit above the run and across-run services below.';

export const MAP_YOURS_SENTENCE =
  'Every box except Goal carries an amber badge reading yours; the Model badge reads yours to select.';

export const MAP_HIGHLIGHT_SENTENCES: Record<MapHighlight, string> = {
  model: 'The Model box is highlighted and the rest is dimmed.',
  harness: 'The Harness region is highlighted and the rest is dimmed.',
  'per-run': 'The per-run services row is highlighted and the rest is dimmed.',
  'across-runs': 'The across-runs row is highlighted and the rest is dimmed.',
};

/** The words the long description uses for a highlighted region. */
export const MAP_HIGHLIGHT_REGIONS: Record<MapHighlight, string> = {
  model: 'the Model box',
  harness: 'the Harness region',
  'per-run': 'the Per-run services row',
  'across-runs': 'the Across runs row',
};

/** The accessible description for one map instance: the short alt's body plus the variant and highlight sentences. */
export function mapDescription(variant: MapVariant, highlight?: MapHighlight): string {
  const parts = [MAP_DESC];
  if (variant === 'yours') parts.push(MAP_YOURS_SENTENCE);
  if (highlight) parts.push(MAP_HIGHLIGHT_SENTENCES[highlight]);
  return parts.join(' ');
}

const counters = new WeakMap<object, number>();

/**
 * 1, 2, 3 ... per page render. Keyed on Astro.request, which every component in one page render shares,
 * so ids restart on every page and stay unique within it (blueprint 10.4: map-title-<n>, map-desc-<n>).
 */
export function nextDiagramInstance(scope: object): number {
  const n = (counters.get(scope) ?? 0) + 1;
  counters.set(scope, n);
  return n;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface SvgMeta {
  /** Attributes added to the root <svg>. Undefined values are skipped. */
  attrs: Record<string, string | undefined>;
  /** Omit it when the root is named by aria-label: a <title> next to it would duplicate the name and show as a tooltip. */
  title?: string;
  titleId?: string;
  desc?: string;
  descId?: string;
}

/**
 * Adds root attributes and, when given, a leading <title> (and <desc>) to an SVG source string read
 * with ?raw. The source files carry no ids (scripts/import-diagrams.mjs), so the only ids in the output
 * are the ones passed in here.
 */
export function decorateSvg(raw: string, meta: SvgMeta): string {
  const open = raw.match(/<svg\b[^>]*>/);
  if (!open || open.index === undefined) throw new Error('decorateSvg: the source has no <svg> root element');
  const attrs = Object.entries(meta.attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('');
  const rootTag = open[0].replace(/>$/, `${attrs}>`);
  const idAttr = (id?: string) => (id ? ` id="${escapeHtml(id)}"` : '');
  let head = meta.title === undefined ? '' : `<title${idAttr(meta.titleId)}>${escapeHtml(meta.title)}</title>`;
  if (meta.desc) head += `<desc${idAttr(meta.descId)}>${escapeHtml(meta.desc)}</desc>`;
  const after = raw.slice(open.index + open[0].length);
  return `${rootTag}${head}${after.trimEnd()}`;
}
