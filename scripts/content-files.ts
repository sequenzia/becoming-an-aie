// scripts/content-files.ts
// Shared by content-check.ts and drift-review.ts (blueprint section 11). Plain Node 24: erasable
// TypeScript only, explicit .ts import extensions, no build step. Reads the content tree with
// gray-matter so the scripts see the same frontmatter Astro's loaders see, as plain strings.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { isoDate } from '../src/lib/dates.ts';

export type ContentSubdir = 'modules' | 'artifacts' | 'changelog';

export interface ContentFile {
  /** Path relative to the content root, for example modules/models.mdx. */
  file: string;
  /** File name without extension. Modules use it as the slug, artifacts as the id. */
  id: string;
  /** Parsed frontmatter, or an empty object when the file has none or the YAML failed. */
  data: Record<string, unknown>;
  /** The Markdown body after the frontmatter block. */
  body: string;
  /** One-based line number of the first body line, for line-numbered findings. */
  bodyStartLine: number;
  /** Set when gray-matter could not parse the frontmatter. */
  parseError?: string;
}

/** A body line with the state the checks need: fence membership and the h2 section it belongs to. */
export interface BodyLine {
  text: string;
  /** Zero-based index within the body. */
  index: number;
  inFence: boolean;
  /** The text of the nearest preceding h2, or null before the first one. */
  section: string | null;
}

/** True for a directory that exists and can be listed. readdirSync throws on a directory that cannot be. */
export function isReadableDir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false;
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Names the two whole-tree scans never read: Finder metadata (binary) and an installed package tree. */
export const SCAN_SKIP_NAMES: ReadonlySet<string> = new Set(['.DS_Store', 'node_modules']);

/**
 * Every regular file under `root`, recursively, as `[absolute path, display path]` pairs sorted by display
 * path. Scratch files and dotfiles are included: the secret scan and the em-dash scan read everything the
 * structural checks skip (docs/content-authoring.md), except the names in SCAN_SKIP_NAMES.
 */
export function walkScanFiles(root: string, display = ''): Array<[path: string, display: string]> {
  const out: Array<[string, string]> = [];
  const stat = statSync(root);
  if (stat.isFile()) return [[root, display || root]];
  if (!stat.isDirectory()) return out;
  for (const name of readdirSync(root).sort()) {
    if (SCAN_SKIP_NAMES.has(name)) continue;
    out.push(...walkScanFiles(join(root, name), display ? `${display}/${name}` : name));
  }
  return out;
}

/** Names in <root>/<sub> with the extension, skipping files that start with `_` or `.`, sorted. */
export function listContentFiles(root: string, sub: ContentSubdir, ext: string): string[] {
  const dir = join(root, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(ext) && !name.startsWith('_') && !name.startsWith('.'))
    .filter((name) => statSync(join(dir, name)).isFile())
    .sort();
}

export function readContentFile(root: string, sub: ContentSubdir, name: string): ContentFile {
  const path = join(root, sub, name);
  const raw = readFileSync(path, 'utf8');
  const file = `${sub}/${name}`;
  const id = name.replace(/\.[a-z]+$/, '');
  try {
    const parsed = matter(raw);
    const body = parsed.content;
    const bodyStartLine = raw.split('\n').length - body.split('\n').length + 1;
    return { file, id, data: (parsed.data ?? {}) as Record<string, unknown>, body, bodyStartLine };
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return { file, id, data: {}, body: '', bodyStartLine: 1, parseError: message };
  }
}

/** A fenced code block opens or closes on a line that starts with three or more backticks or tildes. */
export function isFenceLine(line: string): boolean {
  return /^\s{0,3}(`{3,}|~{3,})/.test(line);
}

/** Splits the body into lines and tags each with fence state and its h2 section. */
export function analyzeBody(body: string): BodyLine[] {
  const out: BodyLine[] = [];
  let inFence = false;
  let section: string | null = null;
  body.split('\n').forEach((text, index) => {
    if (isFenceLine(text)) {
      inFence = !inFence;
      out.push({ text, index, inFence: true, section });
      return;
    }
    if (!inFence) {
      const m = /^##\s+(.+?)\s*$/.exec(text);
      if (m) section = m[1];
    }
    out.push({ text, index, inFence, section });
  });
  return out;
}

/** Inline code never carries a tag or a link, so it is dropped before scanning a line. */
export function stripInlineCode(text: string): string {
  return text.replace(/`[^`]*`/g, '');
}

/** Every <Artifact id="x" /> placement in the body, outside code fences, in order, with duplicates. */
export function artifactIdsInBody(lines: BodyLine[]): Array<{ id: string; index: number; section: string | null }> {
  const out: Array<{ id: string; index: number; section: string | null }> = [];
  const re = /<Artifact\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/g;
  for (const line of lines) {
    if (line.inFence) continue;
    const text = stripInlineCode(line.text);
    for (const m of text.matchAll(re)) out.push({ id: m[1], index: line.index, section: line.section });
  }
  return out;
}

/** Parses YYYY-MM-DD into a UTC midnight Date. Throws on anything else. */
export function parseToday(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`--today must be YYYY-MM-DD, got "${value}"`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || isoDate(date) !== value) throw new Error(`--today is not a calendar date: "${value}"`);
  return date;
}

/** Today at UTC midnight. */
export function startOfToday(): Date {
  return new Date(`${isoDate(new Date())}T00:00:00Z`);
}

/** Frontmatter dates arrive as Date objects (unquoted YAML) or strings (quoted). Both become Dates. */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** The value after a flag, or exits 2 with a usage line. */
export function takeValue(argv: string[], index: number, flag: string, usage: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    console.error(`${flag} needs a value\n${usage}`);
    process.exit(2);
  }
  return value;
}
