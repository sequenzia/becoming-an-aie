// scripts/content-check.test.ts
// Runs the content check as a child process against the fixtures (blueprint section 11.1).
// The valid root is test/fixtures/content. Each invalid variant is its own root under
// test/fixtures/content/cases/<case>/ so one run yields one expected finding. The em-dash and
// secret cases are written to a temporary directory at test time so neither pattern is committed.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'content-check.ts');
const FIXTURES = join(ROOT, 'test', 'fixtures', 'content');
const CASES = join(FIXTURES, 'cases');
/** A working directory with no docs/ and no README.md, so the optional roots are skipped. */
const NO_DOCS_CWD = join(ROOT, 'test', 'fixtures');
const TODAY = '2026-09-15';

interface Finding {
  file: string;
  line?: number;
  message: string;
}

interface Run {
  status: number | null;
  errors: Finding[];
  warnings: Finding[];
  stdout: string;
  stderr: string;
}

function run(dir: string, args: string[] = [], cwd = NO_DOCS_CWD, json = true, today = TODAY): Run {
  const argv = [SCRIPT, '--dir', dir, '--today', today, ...(json ? ['--json'] : []), ...args];
  const proc = spawnSync(process.execPath, argv, { cwd, encoding: 'utf8' });
  let parsed: { errors: Finding[]; warnings: Finding[] } = { errors: [], warnings: [] };
  if (json && proc.status !== 2) parsed = JSON.parse(proc.stdout);
  return { status: proc.status, ...parsed, stdout: proc.stdout, stderr: proc.stderr };
}

const has = (findings: Finding[], file: string, text: string) => findings.some((f) => f.file === file && f.message.includes(text));
const caseDir = (name: string) => join(CASES, name);

const temps: string[] = [];
function tempRoot(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-check-'));
  temps.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  return dir;
}
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const validModule = (extra = '') => `---
title: "Models"
kind: area
area: models
order: 1
summary: "Temporary fixture."
readingMinutes: 45
prerequisites: []
talkBeats: ["2.1"]
bookChapters: [6, 7, 10]
draft: true
updatedOn: 2026-09-15
checkedOn: 2026-09-15
takeaway: "The model is a versioned, expiring dependency. Treat it like one."
pitfall: "A hardcoded model ID with no eval suite behind it"
transferRows: [testing]
---

## Transfer connection

Draft.${extra}
`;

describe('content-check: valid fixtures', () => {
  test('exits 0 with no errors and warns only about the reading-time estimate', () => {
    const r = run(FIXTURES);
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(has(r.warnings, 'modules/models.mdx', 'readingMinutes 45 but the body estimates')).toBe(true);
  });

  test('run from a directory without docs/ or README.md, the optional roots are skipped silently', () => {
    const r = run(FIXTURES, [], NO_DOCS_CWD, false);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Content check: 0 errors, 1 warning');
    expect(r.stderr).toBe('');
  });

  test('run from the repository root, docs/ and README.md are scanned and are clean', () => {
    const r = run(FIXTURES, [], ROOT, false);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Content check: 0 errors');
  });

  test('--strict-warnings turns the warning into an error and exit 1', () => {
    const r = run(FIXTURES, ['--strict-warnings']);
    expect(r.status).toBe(1);
    expect(r.warnings).toEqual([]);
    expect(has(r.errors, 'modules/models.mdx', 'readingMinutes 45')).toBe(true);
  });
});

describe('content-check: invalid variants', () => {
  const variants: Array<[string, string, string]> = [
    ['missing-section', 'modules/models.mdx', 'required sections out of order or missing; expected Transfer connection > Topics and learning outcomes > Workshop > Failure exercise > Completion evidence > Sources'],
    ['wrong-order', 'modules/models.mdx', 'required sections out of order or missing'],
    ['h1-in-body', 'modules/models.mdx', 'h1 in body ("Models")'],
    ['unknown-tag', 'modules/models.mdx', 'unknown component <Workshp>; allowed: Artifact, Callout'],
    ['unknown-artifact', 'modules/models.mdx', 'artifact "nope" is not listed in frontmatter artifacts'],
    ['unknown-artifact', 'modules/models.mdx', 'artifact "nope" does not exist'],
    ['elective-prerequisite', 'modules/models.mdx', 'elective "inference-and-hosting" cannot be a prerequisite of a core module'],
    ['five-questions', 'modules/models.mdx', 'self-check needs 6 to 12 questions, found 5'],
    ['uncovered-outcome', 'modules/models.mdx', 'outcome eval-before-replace is not covered by any question'],
    ['bad-anchor', 'modules/models.mdx', 'link /modules/models#workshop-x has no heading in models'],
    ['future-date', 'modules/models.mdx', 'checkedOn 2026-12-01 is in the future'],
    ['wrong-takeaway', 'modules/models.mdx', 'takeaway must match the content map verbatim'],
    ['chapter-28', 'modules/models.mdx', 'chapter 28 is out of scope'],
    ['captured-no-review', 'artifacts/models-captured-session.md', 'captured artifact needs reviewedOn before publication'],
    ['artifact-no-checked-on', 'artifacts/models-fixture-trace.md', 'frontmatter checkedOn:'],
    ['no-changes-phrase', 'modules/models.mdx', 'the Transfer connection section must say what "stays the same" and what "changes"'],
    ['misplaced-selfcheck', 'modules/models.mdx', '<SelfCheck /> must be placed in the Completion evidence section (found in "Topics and learning outcomes")'],
    ['unknown-slug', 'modules/foo.mdx', 'unknown module slug; allowed slugs are listed in src/lib/content-schema.ts'],
    ['self-prerequisite', 'modules/models.mdx', 'a module cannot be its own prerequisite'],
  ];

  test.each(variants)('%s: exit 1 and an error on %s', (name, file, text) => {
    const r = run(caseDir(name));
    expect(r.status).toBe(1);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(has(r.errors, file, text)).toBe(true);
    for (const f of r.errors) expect(f.file).toMatch(/^(modules|artifacts)\//);
  });

  test('a checked-on date older than 180 days is a warning, not an error', () => {
    const r = run(caseDir('old-date'));
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'modules/models.mdx', 'checkedOn 2026-03-17 is 182 days old (over 180)')).toBe(true);
    expect(run(caseDir('old-date'), ['--strict-warnings']).status).toBe(1);
  });

  test('a draft is skipped by the content rules unless --drafts-as-published is set', () => {
    const skipped = run(caseDir('draft-skipped'));
    expect(skipped.status).toBe(0);
    expect(skipped.errors).toEqual([]);
    const checked = run(caseDir('draft-skipped'), ['--drafts-as-published']);
    expect(checked.status).toBe(1);
    expect(has(checked.errors, 'modules/models.mdx', 'required sections out of order or missing')).toBe(true);
  });

  const lineOf = (text: string, needle: string) => text.split('\n').findIndex((l) => l.includes(needle)) + 1;

  test('an em-dash anywhere under the root is an error naming the file and line', () => {
    const emDash = String.fromCharCode(0x2014);
    const text = validModule(`\n\nA line with an em-dash ${emDash} here.\n`);
    const dir = tempRoot({ 'modules/models.mdx': text });
    const r = run(dir);
    expect(r.status).toBe(1);
    const hit = r.errors.find((f) => f.file === 'modules/models.mdx' && f.message.includes('em-dash (U+2014)'));
    expect(hit?.line).toBe(lineOf(text, emDash));
  });

  test('a key-shaped string in an artifact is an error naming the file and line', () => {
    const fakeKey = 'sk-' + 'a'.repeat(24);
    const text = `---\ntitle: Trace\norigin: synthetic\nkind: trace\ncheckedOn: 2026-09-15\n---\n\nheader: ${fakeKey}\n`;
    const dir = tempRoot({ 'modules/models.mdx': validModule(), 'artifacts/models-trace.md': text });
    const r = run(dir);
    expect(r.status).toBe(1);
    const hit = r.errors.find((f) => f.file === 'artifacts/models-trace.md' && f.message.includes('possible secret (sk- API key)'));
    expect(hit?.line).toBe(lineOf(text, fakeKey));
  });

  test('the secret scan reads dotfiles and scratch files under the content root, so a stray .env is caught', () => {
    const value = 'y'.repeat(20);
    const dir = tempRoot({
      'modules/models.mdx': validModule(),
      'modules/.env': `NOTIFY_TOKEN_SECRET=${value}\n`,
      'artifacts/_notes.md': `api_key = "${value}"\n`,
    });
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(has(r.errors, 'modules/.env', 'possible secret (credential assignment)')).toBe(true);
    expect(has(r.errors, 'artifacts/_notes.md', 'possible secret (credential assignment)')).toBe(true);
  });

  test('both whole-tree scans skip .DS_Store and node_modules, and nothing else', () => {
    const emDash = String.fromCharCode(0x2014);
    const value = 'z'.repeat(20);
    // Finder metadata is binary; a key-shaped or em-dash byte run inside it must not fail the build.
    const dir = tempRoot({
      'modules/models.mdx': validModule(),
      'modules/.DS_Store': `token: ${value} ${emDash}\n`,
      'artifacts/node_modules/pkg/readme.md': `token: ${value} ${emDash}\n`,
      'artifacts/.hidden.md': `a line with an em-dash ${emDash} in a dotfile\n`,
    });
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.errors.some((f) => f.file.includes('.DS_Store'))).toBe(false);
    expect(r.errors.some((f) => f.file.includes('node_modules'))).toBe(false);
    expect(has(r.errors, 'artifacts/.hidden.md', 'em-dash (U+2014)')).toBe(true);
  });

  test('a credential assignment in a module body is an error', () => {
    const value = 'x'.repeat(20);
    const dir = tempRoot({ 'modules/models.mdx': validModule(`\n\napi_key = "${value}"\n`) });
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(has(r.errors, 'modules/models.mdx', 'possible secret (credential assignment)')).toBe(true);
  });

  test('a public artifact without url and a captured artifact without version are reported', () => {
    const dir = tempRoot({
      'modules/models.mdx': validModule(),
      'artifacts/models-public.md': '---\ntitle: Public\norigin: public\nkind: document\ncheckedOn: 2026-09-15\n---\n\nQuote.\n',
      'artifacts/models-captured.md': '---\ntitle: Captured\norigin: captured\nkind: trace\ncheckedOn: 2026-09-15\nreviewedOn: 2026-09-15\n---\n\nTrace.\n',
    });
    const r = run(dir);
    expect(has(r.errors, 'artifacts/models-public.md', 'public artifact needs url')).toBe(true);
    expect(has(r.warnings, 'artifacts/models-captured.md', 'captured artifact has no version')).toBe(true);
  });

  test('a changelog entry with a bad name or frontmatter is an error', () => {
    const dir = tempRoot({
      'modules/models.mdx': validModule(),
      'changelog/launch.md': '---\ntitle: Launch\n---\n\nNo date.\n',
    });
    const r = run(dir);
    expect(has(r.errors, 'changelog/launch.md', 'changelog file names are <YYYY-MM-DD>-<slug>.md')).toBe(true);
    expect(has(r.errors, 'changelog/launch.md', 'frontmatter date:')).toBe(true);
  });
});

describe('content-check: arguments and output', () => {
  test('an unreadable --dir prints the message and exits 2', () => {
    const r = run(join(ROOT, 'test', 'fixtures', 'does-not-exist'), [], NO_DOCS_CWD, false);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('content-check: cannot read');
  });

  test('a malformed --today exits 2', () => {
    const proc = spawnSync(process.execPath, [SCRIPT, '--dir', FIXTURES, '--today', '15/09/2026'], { cwd: NO_DOCS_CWD, encoding: 'utf8' });
    expect(proc.status).toBe(2);
    expect(proc.stderr).toContain('--today must be YYYY-MM-DD');
  });

  test('text output has one line per finding with the error or warn prefix and a summary', () => {
    const r = run(caseDir('five-questions'), [], NO_DOCS_CWD, false);
    expect(r.status).toBe(1);
    const lines = r.stdout.trim().split('\n');
    expect(lines.at(-1)).toMatch(/^Content check: \d+ errors?, \d+ warnings?$/);
    expect(lines.slice(0, -1).every((l) => /^(error|warn) (modules|artifacts)\/[^:]+(:\d+)?: /.test(l))).toBe(true);
    expect(r.stdout).toContain('error modules/models.mdx: frontmatter selfCheck: self-check needs 6 to 12 questions, found 5');
  });

  test('the real content passes with drafts skipped', () => {
    // Today's date, because the skeletons carry the date they were last touched.
    const r = run(join(ROOT, 'src', 'content'), [], ROOT, true, new Date().toISOString().slice(0, 10));
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
  });
});
