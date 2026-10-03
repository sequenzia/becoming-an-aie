// scripts/content-check.ts
// Build-time content validation (blueprint section 11.1). `npm run content:check` runs it before
// astro build, and CI runs it as its own step. Plain Node 24: erasable TypeScript only, explicit
// .ts import extensions. It imports the same Zod schema the collections use, so the rules a
// module must satisfy are written once in src/lib/content-schema.ts.
//
//   node scripts/content-check.ts [--dir <root>] [--today YYYY-MM-DD] [--json]
//                                 [--strict-warnings] [--drafts-as-published]
//
// Exit 0 when there are no errors, 1 when there are, 2 when the root cannot be read or an
// argument is wrong. Drafts get the structural rules only, unless --drafts-as-published is set.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  AREA_CONTENT_MAP,
  CLOSING_SLUG,
  ELECTIVE_MODULES,
  FORBIDDEN_SECTIONS,
  MDX_TAGS,
  MODULE_SLUGS,
  OPTIONAL_LAB_SECTION,
  REQUIRED_SECTIONS,
  SELF_CHECK_KINDS,
  artifactSchema,
  changelogSchema,
  moduleFields,
  moduleSchema,
  moduleSchemaDraftsAsPublished,
} from '../src/lib/content-schema.ts';
import type { ArtifactFrontmatter, ModuleFrontmatter, ModuleKind } from '../src/lib/content-schema.ts';
import { STALE_WARN_DAYS } from '../src/lib/limits.ts';
import { headingId } from '../src/lib/slug.ts';
import { daysBetween, isStale, isoDate } from '../src/lib/dates.ts';
import {
  analyzeBody,
  artifactIdsInBody,
  isReadableDir,
  listContentFiles,
  parseToday,
  readContentFile,
  startOfToday,
  stripInlineCode,
  takeValue,
  toDate,
  walkScanFiles,
} from './content-files.ts';
import type { BodyLine, ContentFile } from './content-files.ts';

const USAGE =
  'usage: node scripts/content-check.ts [--dir <root>] [--today YYYY-MM-DD] [--json] [--strict-warnings] [--drafts-as-published]';

const WORDS_PER_MINUTE = 220;
const READING_TOLERANCE = 0.25;
const EM_DASH = String.fromCharCode(0x2014);

/** Secret patterns from AC-5.6.4. A hit is an error naming the file and line. */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'credential assignment', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'sk- API key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'GitHub token', re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

interface Options {
  dir: string;
  today: Date;
  json: boolean;
  strictWarnings: boolean;
  draftsAsPublished: boolean;
}

interface Finding {
  file: string;
  line?: number;
  message: string;
}

interface Heading {
  depth: number;
  text: string;
  /** One-based line in the file. */
  line: number;
}

interface Tag {
  name: string;
  attrs: string;
  line: number;
  section: string | null;
}

interface ModuleRecord {
  file: string;
  slug: string;
  source: ContentFile;
  /** Validated frontmatter, or null when the schema rejected it. */
  data: ModuleFrontmatter | null;
  draft: boolean;
  /** Not a draft, or every module counts under --drafts-as-published. */
  published: boolean;
  lines: BodyLine[];
  headings: Heading[];
  tags: Tag[];
  /** Ids of h2 and h3 headings, as Astro's slugger produces them for ASCII text. */
  headingIds: Set<string>;
}

interface ArtifactRecord {
  file: string;
  id: string;
  source: ContentFile;
  data: ArtifactFrontmatter | null;
}

function parseOptions(argv: string[]): Options {
  const opts: Options = { dir: 'src/content', today: startOfToday(), json: false, strictWarnings: false, draftsAsPublished: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') opts.dir = takeValue(argv, ++i, '--dir', USAGE);
    else if (arg === '--today') {
      const value = takeValue(argv, ++i, '--today', USAGE);
      try {
        opts.today = parseToday(value);
      } catch (error) {
        console.error(`content-check: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
      }
    } else if (arg === '--json') opts.json = true;
    else if (arg === '--strict-warnings') opts.strictWarnings = true;
    else if (arg === '--drafts-as-published') opts.draftsAsPublished = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`content-check: unknown argument ${arg}\n${USAGE}`);
      process.exit(2);
    }
  }
  return opts;
}

class Report {
  errors: Finding[] = [];
  warnings: Finding[] = [];
  error(file: string, message: string, line?: number) {
    this.errors.push(line === undefined ? { file, message } : { file, line, message });
  }
  warn(file: string, message: string, line?: number) {
    this.warnings.push(line === undefined ? { file, message } : { file, line, message });
  }
}

function zodIssues(result: { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } }): string[] {
  return result.error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    const message = issue.message.replace(/^Invalid input: /, '');
    return path ? `frontmatter ${path}: ${message}` : `frontmatter: ${message}`;
  });
}

function parseHeadings(lines: BodyLine[], bodyStartLine: number): Heading[] {
  const out: Heading[] = [];
  for (const line of lines) {
    if (line.inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line.text);
    if (m) out.push({ depth: m[1].length, text: m[2], line: bodyStartLine + line.index });
  }
  return out;
}

function parseTags(lines: BodyLine[], bodyStartLine: number): Tag[] {
  const out: Tag[] = [];
  const re = /<([A-Z][A-Za-z0-9]*)((?:\s[^<>]*)?)\/?>/g;
  for (const line of lines) {
    if (line.inFence) continue;
    const text = stripInlineCode(line.text);
    for (const m of text.matchAll(re)) {
      out.push({ name: m[1], attrs: m[2] ?? '', line: bodyStartLine + line.index, section: line.section });
    }
  }
  return out;
}

/** The kind and, for area modules, the area that a file name commits to. Null for an unknown slug. */
function expectedForSlug(slug: string): { kind: ModuleKind; area?: string } | null {
  if (slug === 'orientation') return { kind: 'orientation' };
  if (slug === 'foundations') return { kind: 'foundations' };
  if (slug === CLOSING_SLUG) return { kind: 'closing' };
  for (const [area, entry] of Object.entries(AREA_CONTENT_MAP)) {
    if (entry.slug === slug) return { kind: 'area', area };
  }
  if (slug in ELECTIVE_MODULES) return { kind: 'elective' };
  return null;
}

function loadModules(root: string, opts: Options, report: Report): ModuleRecord[] {
  const schema = opts.draftsAsPublished ? moduleSchemaDraftsAsPublished : moduleSchema;
  const records: ModuleRecord[] = [];
  for (const name of listContentFiles(root, 'modules', '.mdx')) {
    const source = readContentFile(root, 'modules', name);
    const slug = source.id;
    const file = source.file;
    if (!(MODULE_SLUGS as readonly string[]).includes(slug)) {
      report.error(file, 'unknown module slug; allowed slugs are listed in src/lib/content-schema.ts');
    }
    // The plain shape gives the body checks their data even when a kind rule fails, so one run
    // reports the frontmatter issues and the body issues together.
    let data: ModuleFrontmatter | null = null;
    if (source.parseError) {
      report.error(file, `frontmatter: ${source.parseError}`);
    } else {
      const shape = moduleFields.safeParse(source.data);
      if (shape.success) data = shape.data;
      const parsed = schema.safeParse(source.data);
      if (!parsed.success) for (const message of zodIssues(parsed)) report.error(file, message);
    }
    const draft = data ? data.draft : source.data.draft === true;
    const lines = analyzeBody(source.body);
    const headings = parseHeadings(lines, source.bodyStartLine);
    const headingIds = new Set(headings.filter((h) => h.depth === 2 || h.depth === 3).map((h) => headingId(h.text)));
    records.push({
      file,
      slug,
      source,
      data,
      draft,
      published: !draft || opts.draftsAsPublished,
      lines,
      headings,
      tags: parseTags(lines, source.bodyStartLine),
      headingIds,
    });
  }
  return records;
}

function loadArtifacts(root: string, report: Report): ArtifactRecord[] {
  const records: ArtifactRecord[] = [];
  for (const name of listContentFiles(root, 'artifacts', '.md')) {
    const source = readContentFile(root, 'artifacts', name);
    let data: ArtifactFrontmatter | null = null;
    if (source.parseError) {
      report.error(source.file, `frontmatter: ${source.parseError}`);
    } else {
      const parsed = artifactSchema.safeParse(source.data);
      if (parsed.success) data = parsed.data;
      else for (const message of zodIssues(parsed)) report.error(source.file, message);
    }
    records.push({ file: source.file, id: source.id, source, data });
  }
  return records;
}

function checkChangelog(root: string, report: Report) {
  for (const name of listContentFiles(root, 'changelog', '.md')) {
    const source = readContentFile(root, 'changelog', name);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name)) {
      report.error(source.file, 'changelog file names are <YYYY-MM-DD>-<slug>.md');
    }
    if (source.parseError) {
      report.error(source.file, `frontmatter: ${source.parseError}`);
      continue;
    }
    const parsed = changelogSchema.safeParse(source.data);
    if (!parsed.success) for (const message of zodIssues(parsed)) report.error(source.file, message);
  }
}

/** Step 3. The file name, the kind, and the content map must agree. Applies to drafts too. */
function checkSlugPairing(m: ModuleRecord, report: Report) {
  if (!m.data) return;
  const d = m.data;
  const expected = expectedForSlug(m.slug);
  if (expected && expected.kind !== d.kind) {
    report.error(m.file, `modules/${m.slug}.mdx must have kind: ${expected.kind}`);
  }
  if (d.kind === 'area' && d.area !== 'none') {
    const slugFor = AREA_CONTENT_MAP[d.area].slug;
    if (m.slug !== slugFor) report.error(m.file, `area "${d.area}" belongs in modules/${slugFor}.mdx`);
  } else if (d.kind === 'elective') {
    const planned = ELECTIVE_MODULES[m.slug];
    if (!planned) {
      report.error(m.file, `elective file names are ${Object.keys(ELECTIVE_MODULES).join(', ')}`);
    } else {
      if (d.title !== planned.title) report.error(m.file, `title must be "${planned.title}"`);
      if (d.bookChapters.length !== 1 || d.bookChapters[0] !== planned.chapter) {
        report.error(m.file, `bookChapters must be [${planned.chapter}]`);
      }
    }
  }
}

/** Step 4. Headings of a published module: no h1, the required h2 sequence, nothing forbidden. */
function checkHeadings(m: ModuleRecord, report: Report) {
  if (!m.data || !m.published) return;
  const kind = m.data.kind;
  for (const h of m.headings) {
    if (h.depth === 1) report.error(m.file, `h1 in body ("${h.text}"); the layout renders the h1`, h.line);
  }
  const h2 = m.headings.filter((h) => h.depth === 2).map((h) => h.text);
  const required = REQUIRED_SECTIONS[kind];
  const positions = required.map((name) => h2.indexOf(name));
  const counts = required.map((name) => h2.filter((t) => t === name).length);
  const inOrder = positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]));
  if (!inOrder || counts.some((c) => c !== 1)) {
    report.error(
      m.file,
      `required sections out of order or missing; expected ${required.join(' > ')}; found ${h2.join(' > ') || '(no h2 headings)'}`,
    );
  }
  for (const name of FORBIDDEN_SECTIONS[kind]) {
    if (h2.includes(name)) report.error(m.file, `"${name}" is not a section of a ${kind} module`);
  }
  const lab = h2.indexOf(OPTIONAL_LAB_SECTION);
  if (lab >= 0) {
    const after = h2.indexOf('Failure exercise');
    const before = h2.indexOf('Completion evidence');
    if (after < 0 || before < 0 || lab < after || lab > before) {
      report.error(m.file, `"${OPTIONAL_LAB_SECTION}" must sit between Failure exercise and Completion evidence`);
    }
  }
  const seen = new Set<string>();
  for (const h of m.headings) {
    if (h.depth !== 2 && h.depth !== 3) continue;
    const id = headingId(h.text);
    if (seen.has(id)) report.warn(m.file, `heading "${h.text}" repeats an earlier heading id (${id}); anchors will not resolve`, h.line);
    seen.add(id);
  }
}

/** Step 5. Component placement in a published module. */
function checkComponents(m: ModuleRecord, report: Report) {
  if (!m.data || !m.published) return;
  const kind = m.data.kind;
  const allowed = MDX_TAGS as readonly string[];
  const unknown = new Set<string>();
  for (const tag of m.tags) {
    if (!allowed.includes(tag.name) && !unknown.has(tag.name)) {
      unknown.add(tag.name);
      report.error(m.file, `unknown component <${tag.name}>; allowed: ${MDX_TAGS.join(', ')}`, tag.line);
    }
  }
  const required = REQUIRED_SECTIONS[kind] as readonly string[];
  const WRAPPERS = ['Workshop', 'FailureExercise', 'OptionalLab', 'Callout', 'Collapsible', 'Fragment'];
  const show = (name: string) => (WRAPPERS.includes(name) ? `<${name}>` : `<${name} />`);
  const requireIn = (name: string, section: string) => {
    const placed = m.tags.filter((t) => t.name === name);
    if (placed.length === 0) {
      report.error(m.file, `${show(name)} is missing from the ${section} section`);
      return;
    }
    for (const t of placed) {
      if (t.section !== section) {
        report.error(m.file, `${show(name)} must be placed in the ${section} section (found in ${t.section ? `"${t.section}"` : 'the preamble'})`, t.line);
      }
    }
  };
  const forbid = (name: string, why: string) => {
    for (const t of m.tags.filter((t) => t.name === name)) report.error(m.file, `${show(name)} is not allowed in a ${kind} module: ${why}`, t.line);
  };

  if (required.includes('Workshop')) requireIn('Workshop', 'Workshop');
  else forbid('Workshop', 'it has no workshop');
  if (required.includes('Failure exercise')) {
    requireIn('FailureExercise', 'Failure exercise');
    const explanation = m.tags.find((t) => t.name === 'Fragment' && /\bslot\s*=\s*["']explanation["']/.test(t.attrs));
    if (!explanation) report.error(m.file, '<FailureExercise> needs a <Fragment slot="explanation"> in the Failure exercise section');
    else if (explanation.section !== 'Failure exercise') {
      report.error(m.file, '<Fragment slot="explanation"> must be placed in the Failure exercise section', explanation.line);
    }
  } else forbid('FailureExercise', 'it has no failure exercise');
  if (!required.includes('Workshop')) forbid('OptionalLab', 'it has no lab');

  if (SELF_CHECK_KINDS.includes(kind)) {
    requireIn('SelfCheck', 'Completion evidence');
    requireIn('Outcomes', 'Topics and learning outcomes');
  } else {
    forbid('SelfCheck', 'it has no self-check');
  }
  if (kind === 'area' && !m.tags.some((t) => t.name === 'Takeaway')) {
    report.error(m.file, '<Takeaway /> is missing; area modules render the takeaway from frontmatter');
  }
  requireIn('Sources', 'Sources');
  if (kind === 'orientation') requireIn('MarkComplete', 'Completion evidence');
  else forbid('MarkComplete', 'only orientation completes by hand');

  if (kind === 'area') {
    const text = m.lines
      .filter((l) => !l.inFence && l.section === 'Transfer connection')
      .map((l) => stripInlineCode(l.text).replace(/<[^>]*>/g, ' '))
      .join(' ')
      .toLowerCase();
    if (!text.includes('stays the same') || !text.includes('changes')) {
      report.error(m.file, 'the Transfer connection section must say what "stays the same" and what "changes"');
    }
  }
}

/** Step 6. Artifact placement, labels, and the secret scan. */
function checkArtifacts(modules: ModuleRecord[], artifacts: ArtifactRecord[], root: string, report: Report) {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const placedIn = new Map<string, ModuleRecord[]>();
  for (const m of modules) {
    if (!m.data) continue;
    const listed = new Set(m.data.artifacts);
    const placed = artifactIdsInBody(m.lines);
    const placedIds = new Set(placed.map((p) => p.id));
    for (const p of placed) {
      const line = m.source.bodyStartLine + p.index;
      if (!listed.has(p.id)) report.error(m.file, `artifact "${p.id}" is not listed in frontmatter artifacts`, line);
      if (!byId.has(p.id)) report.error(m.file, `artifact "${p.id}" does not exist`, line);
      const arr = placedIn.get(p.id) ?? [];
      if (!arr.includes(m)) arr.push(m);
      placedIn.set(p.id, arr);
    }
    for (const id of listed) {
      if (!byId.has(id)) report.error(m.file, `artifact "${id}" does not exist`);
      else if (!placedIds.has(id)) report.warn(m.file, `artifact "${id}" is listed but not placed in the body`);
    }
  }
  for (const a of artifacts) {
    if (!a.data) continue;
    if (a.data.origin === 'captured') {
      if (!a.data.version) report.warn(a.file, 'captured artifact has no version');
      if (!a.data.reviewedOn) {
        const users = placedIn.get(a.id) ?? [];
        if (users.some((m) => m.published)) report.error(a.file, 'captured artifact needs reviewedOn before publication');
        else report.warn(a.file, 'captured artifact has no reviewedOn; required before a module that places it is published');
      }
    }
    if (a.data.origin === 'public' && !a.data.url) report.error(a.file, 'public artifact needs url');
  }
  // Every file under the two directories, scratch files and dotfiles included, through the same walker as the
  // em-dash scan, so the two scans agree on what they read (docs/decisions.md, 2026-10-03).
  for (const sub of ['artifacts', 'modules'] as const) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    for (const [path, display] of walkScanFiles(dir, sub)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((text, i) => {
          for (const p of SECRET_PATTERNS) {
            if (p.re.test(text)) report.error(display, `possible secret (${p.name})`, i + 1);
          }
        });
    }
  }
}

/** Step 7. Prerequisites exist, are not the module itself, and never lead from core to an elective. */
function checkPrerequisites(modules: ModuleRecord[], report: Report) {
  const bySlug = new Map(modules.map((m) => [m.slug, m]));
  for (const m of modules) {
    if (!m.data) continue;
    for (const p of m.data.prerequisites) {
      const target = bySlug.get(p);
      if (p === m.slug) {
        report.error(m.file, 'a module cannot be its own prerequisite');
        continue;
      }
      if (!target) {
        report.error(m.file, `prerequisite "${p}" does not exist`);
        continue;
      }
      if (target.data?.kind === 'elective' && m.data.kind !== 'elective') {
        report.error(m.file, `elective "${p}" cannot be a prerequisite of a core module`);
      }
      if (m.published && target.draft && !target.published) {
        report.warn(m.file, `prerequisite "${p}" is a draft; its link returns 404 until it is published`);
      }
    }
  }
}

/** Step 8. Every /modules/<slug>#<id> link, in bodies and in the closing module's plan steps, resolves. */
function checkAnchors(modules: ModuleRecord[], report: Report) {
  const bySlug = new Map(modules.map((m) => [m.slug, m]));
  const re = /\/modules\/([a-z0-9-]+)(#[a-z0-9-]+)?/g;
  const check = (m: ModuleRecord, href: string, line?: number) => {
    for (const match of href.matchAll(re)) {
      const slug = match[1];
      const anchor = match[2]?.slice(1);
      const target = bySlug.get(slug);
      const link = `${match[0]}`;
      if (!target) {
        report.error(m.file, `link ${link} targets unknown module ${slug}`, line);
        continue;
      }
      if (anchor && !target.headingIds.has(anchor)) report.error(m.file, `link ${link} has no heading in ${slug}`, line);
      if (m.published && target.draft && !target.published && target !== m) {
        report.warn(m.file, `link ${link} targets a draft; it returns 404 until ${slug} is published`, line);
      }
    }
  };
  for (const m of modules) {
    if (!m.data) continue;
    for (const l of m.lines) {
      if (l.inFence) continue;
      check(m, stripInlineCode(l.text), m.source.bodyStartLine + l.index);
    }
    if (m.data.assessment) {
      for (const area of m.data.assessment.areas) for (const step of area.steps) check(m, step.href);
      for (const link of m.data.assessment.uniformHigh.links) check(m, link.href);
    }
  }
}

/** Step 9. No em-dash anywhere in the content root, docs/, or README.md. */
function checkEmDashes(root: string, report: Report) {
  const cwd = process.cwd();
  const scan = (path: string, display: string) => {
    for (const [file, name] of walkScanFiles(path, display)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes(EM_DASH)) continue;
      text.split('\n').forEach((line, i) => {
        if (line.includes(EM_DASH)) report.error(name, 'em-dash (U+2014); use a comma, a colon, or a full stop', i + 1);
      });
    }
  };
  scan(root, '');
  for (const optional of ['docs', 'README.md']) {
    const path = resolve(cwd, optional);
    if (existsSync(path)) scan(path, relative(cwd, path));
  }
}

/** Step 10. Dates relative to --today. */
function checkDates(modules: ModuleRecord[], artifacts: ArtifactRecord[], today: Date, report: Report) {
  const check = (file: string, label: string, value: Date | undefined, warnOld: boolean) => {
    if (!value) return;
    const age = daysBetween(value, today);
    if (age < 0) report.error(file, `${label} ${isoDate(value)} is in the future`);
    else if (warnOld && isStale(value, STALE_WARN_DAYS, today)) report.warn(file, `${label} ${isoDate(value)} is ${age} days old (over ${STALE_WARN_DAYS})`);
  };
  for (const m of modules) {
    if (!m.data) continue;
    check(m.file, 'checkedOn', m.data.checkedOn, true);
    check(m.file, 'updatedOn', m.data.updatedOn, false);
    if (daysBetween(m.data.checkedOn, m.data.updatedOn) > 0) {
      report.warn(m.file, `updatedOn ${isoDate(m.data.updatedOn)} is after checkedOn ${isoDate(m.data.checkedOn)}; check the content again`);
    }
    m.data.sources.forEach((s, i) => check(m.file, `sources[${i}] ("${s.title}") checkedOn`, toDate(s.checkedOn), true));
  }
  for (const a of artifacts) {
    if (!a.data) continue;
    check(a.file, 'checkedOn', a.data.checkedOn, true);
    check(a.file, 'reviewedOn', toDate(a.data.reviewedOn), false);
  }
}

/** Step 11. Reading time estimate for published area modules, a warning only. */
function checkReadingTime(m: ModuleRecord, report: Report) {
  if (!m.data || !m.published || m.data.kind !== 'area') return;
  const excluded = new Set(['Workshop', 'Failure exercise', OPTIONAL_LAB_SECTION]);
  let words = 0;
  for (const l of m.lines) {
    if (l.inFence || (l.section && excluded.has(l.section))) continue;
    const text = stripInlineCode(l.text)
      .replace(/<[^>]*>/g, ' ')
      .replace(/^#+\s+/, '')
      .replace(/[`*_>#|]+/g, ' ')
      .trim();
    if (text) words += text.split(/\s+/).length;
  }
  const estimate = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const declared = m.data.readingMinutes;
  if (Math.abs(estimate - declared) > READING_TOLERANCE * declared) {
    report.warn(m.file, `readingMinutes ${declared} but the body estimates ${estimate} minute${estimate === 1 ? '' : 's'} at ${WORDS_PER_MINUTE} words per minute`);
  }
}

/** Step 12. The closing module's plan map points at area modules. */
function checkClosing(modules: ModuleRecord[], report: Report) {
  const bySlug = new Map(modules.map((m) => [m.slug, m]));
  for (const m of modules) {
    if (!m.data || m.data.kind !== 'closing' || !m.data.assessment) continue;
    for (const area of m.data.assessment.areas) {
      const target = bySlug.get(area.moduleSlug);
      if (!target) report.error(m.file, `assessment area "${area.area}" names moduleSlug "${area.moduleSlug}", which does not exist`);
      else if (target.data && target.data.kind !== 'area') {
        report.error(m.file, `assessment area "${area.area}" names moduleSlug "${area.moduleSlug}", which is not an area module`);
      }
    }
  }
}

/** Step 13. Orders are unique within the area kind and within the electives. */
function checkOrders(modules: ModuleRecord[], report: Report) {
  for (const kind of ['area', 'elective'] as const) {
    const seen = new Map<number, ModuleRecord>();
    for (const m of modules) {
      if (!m.data || m.data.kind !== kind) continue;
      const other = seen.get(m.data.order);
      if (other) report.error(m.file, `${kind} order ${m.data.order} is also used by ${other.file}`);
      else seen.set(m.data.order, m);
    }
  }
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => a.file.localeCompare(b.file) || (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER) || a.message.localeCompare(b.message),
  );
}

function main(): number {
  const opts = parseOptions(process.argv.slice(2));
  const root = resolve(process.cwd(), opts.dir);
  if (!isReadableDir(root) || !isReadableDir(join(root, 'modules'))) {
    console.error(`content-check: cannot read ${opts.dir}`);
    return 2;
  }
  const report = new Report();
  const modules = loadModules(root, opts, report);
  const artifacts = loadArtifacts(root, report);
  checkChangelog(root, report);
  for (const m of modules) {
    checkSlugPairing(m, report);
    checkHeadings(m, report);
    checkComponents(m, report);
    checkReadingTime(m, report);
  }
  checkArtifacts(modules, artifacts, root, report);
  checkPrerequisites(modules, report);
  checkAnchors(modules, report);
  checkEmDashes(root, report);
  checkDates(modules, artifacts, opts.today, report);
  checkClosing(modules, report);
  checkOrders(modules, report);

  let errors = sortFindings(report.errors);
  let warnings = sortFindings(report.warnings);
  if (opts.strictWarnings) {
    errors = sortFindings([...errors, ...warnings]);
    warnings = [];
  }
  if (opts.json) {
    console.log(JSON.stringify({ errors, warnings }, null, 2));
  } else {
    const format = (prefix: string, f: Finding) => `${prefix} ${f.file}${f.line === undefined ? '' : `:${f.line}`}: ${f.message}`;
    for (const f of errors) console.log(format('error', f));
    for (const f of warnings) console.log(format('warn', f));
    const scope = opts.draftsAsPublished ? ' (drafts checked as published)' : '';
    console.log(`Content check: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}${scope}`);
  }
  return errors.length > 0 ? 1 : 0;
}

process.exit(main());
