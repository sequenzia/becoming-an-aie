// scripts/drift-review.ts
// Stale artifact and source report (blueprint section 11.2, AC-5.12.1). Plain Node 24: erasable
// TypeScript only, explicit .ts import extensions.
//
//   node scripts/drift-review.ts [--dir <root>] [--days 90] [--today YYYY-MM-DD] [--json] [--fail-on-stale]
//
// Lists, per module in catalog order, every artifact placed in the module and every source of the
// module whose checkedOn is older than --days, plus the module's own checkedOn. Drafts are
// included with a (draft) marker because their artifacts may already be authored. Exit 0 always,
// except --fail-on-stale exits 3 when anything is stale, and 2 when the root cannot be read.
import { join, resolve } from 'node:path';
import { KIND_ORDER, artifactSchema, moduleFields } from '../src/lib/content-schema.ts';
import type { ArtifactFrontmatter, ModuleFrontmatter } from '../src/lib/content-schema.ts';
import { STALE_AFTER_DAYS_DEFAULT } from '../src/lib/limits.ts';
import { daysBetween, isStale, isoDate } from '../src/lib/dates.ts';
import {
  analyzeBody,
  artifactIdsInBody,
  isReadableDir,
  listContentFiles,
  misplacedContentFile,
  parseToday,
  readContentFile,
  startOfToday,
  takeValue,
  toDate,
} from './content-files.ts';

const USAGE = 'usage: node scripts/drift-review.ts [--dir <root>] [--days 90] [--today YYYY-MM-DD] [--json] [--fail-on-stale]';

interface Options {
  dir: string;
  days: number;
  today: Date;
  json: boolean;
  failOnStale: boolean;
}

interface Item {
  type: 'artifact' | 'source';
  /** Artifact id or source title. */
  name: string;
  origin?: string;
  tool?: string;
  version?: string;
  checkedOn: string;
  ageDays: number;
}

interface Group {
  slug: string;
  kind: string;
  draft: boolean;
  checkedOn: string;
  ageDays: number;
  /** True when the module's own checkedOn is older than --days. */
  stale: boolean;
  items: Item[];
}

function parseOptions(argv: string[]): Options {
  const opts: Options = { dir: 'src/content', days: STALE_AFTER_DAYS_DEFAULT, today: startOfToday(), json: false, failOnStale: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') opts.dir = takeValue(argv, ++i, '--dir', USAGE);
    else if (arg === '--days') {
      const value = Number(takeValue(argv, ++i, '--days', USAGE));
      if (!Number.isInteger(value) || value < 1) {
        console.error(`drift-review: --days must be a positive integer\n${USAGE}`);
        process.exit(2);
      }
      opts.days = value;
    } else if (arg === '--today') {
      try {
        opts.today = parseToday(takeValue(argv, ++i, '--today', USAGE));
      } catch (error) {
        console.error(`drift-review: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
      }
    } else if (arg === '--json') opts.json = true;
    else if (arg === '--fail-on-stale') opts.failOnStale = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`drift-review: unknown argument ${arg}\n${USAGE}`);
      process.exit(2);
    }
  }
  return opts;
}

function main(): number {
  const opts = parseOptions(process.argv.slice(2));
  const root = resolve(process.cwd(), opts.dir);
  if (!isReadableDir(root) || !isReadableDir(join(root, 'modules'))) {
    console.error(`drift-review: cannot read ${opts.dir}`);
    return 2;
  }

  const artifacts = new Map<string, ArtifactFrontmatter>();
  for (const name of listContentFiles(root, 'artifacts', '.md')) {
    if (misplacedContentFile('artifacts', name)) {
      console.error(`drift-review: skipping artifacts/${name}: not a usable entry (run the content check)`);
      continue;
    }
    const source = readContentFile(root, 'artifacts', name);
    const parsed = artifactSchema.safeParse(source.data);
    if (parsed.success) artifacts.set(source.id, parsed.data);
    else console.error(`drift-review: skipping ${source.file}: frontmatter does not match the artifact schema (run the content check)`);
  }

  const modules: Array<{ slug: string; data: ModuleFrontmatter; placed: string[] }> = [];
  for (const name of listContentFiles(root, 'modules', '.mdx')) {
    if (misplacedContentFile('modules', name)) {
      console.error(`drift-review: skipping modules/${name}: not a usable entry (run the content check)`);
      continue;
    }
    const source = readContentFile(root, 'modules', name);
    const parsed = moduleFields.safeParse(source.data);
    if (!parsed.success) {
      console.error(`drift-review: skipping ${source.file}: frontmatter does not match the module schema (run the content check)`);
      continue;
    }
    const placed = [...new Set([...parsed.data.artifacts, ...artifactIdsInBody(analyzeBody(source.body)).map((p) => p.id)])];
    modules.push({ slug: source.id, data: parsed.data, placed });
  }
  modules.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.data.kind) - KIND_ORDER.indexOf(b.data.kind) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );

  const age = (d: Date) => daysBetween(d, opts.today);
  const groups: Group[] = [];
  for (const m of modules) {
    const items: Item[] = [];
    for (const id of m.placed) {
      const a = artifacts.get(id);
      if (!a) continue;
      const ageDays = age(a.checkedOn);
      if (isStale(a.checkedOn, opts.days, opts.today)) {
        items.push({ type: 'artifact', name: id, origin: a.origin, tool: a.tool, version: a.version, checkedOn: isoDate(a.checkedOn), ageDays });
      }
    }
    for (const s of m.data.sources) {
      const checkedOn = toDate(s.checkedOn);
      if (!checkedOn) continue;
      const ageDays = age(checkedOn);
      if (isStale(checkedOn, opts.days, opts.today)) items.push({ type: 'source', name: s.title, checkedOn: isoDate(checkedOn), ageDays });
    }
    const ageDays = age(m.data.checkedOn);
    const stale = isStale(m.data.checkedOn, opts.days, opts.today);
    if (stale || items.length > 0) {
      groups.push({ slug: m.slug, kind: m.data.kind, draft: m.data.draft, checkedOn: isoDate(m.data.checkedOn), ageDays, stale, items });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ today: isoDate(opts.today), days: opts.days, groups }, null, 2));
  } else if (groups.length === 0) {
    console.log(`No artifacts or sources older than ${opts.days} days.`);
  } else {
    for (const g of groups) {
      console.log(`${g.slug}${g.draft ? ' (draft)' : ''} (checkedOn ${g.checkedOn}, ${g.ageDays} days)`);
      for (const item of g.items) {
        const tool = [item.tool, item.version].filter(Boolean).join(' ');
        const parts =
          item.type === 'artifact'
            ? ['artifact', item.name, item.origin ?? '', tool, `checkedOn ${item.checkedOn}`, `${item.ageDays} days`]
            : ['source  ', item.name, `checkedOn ${item.checkedOn}`, `${item.ageDays} days`];
        console.log(`  ${parts.filter((p) => p !== '').join('  ')}`);
      }
    }
  }
  return opts.failOnStale && groups.length > 0 ? 3 : 0;
}

process.exit(main());
