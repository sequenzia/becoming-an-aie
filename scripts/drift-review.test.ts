// scripts/drift-review.test.ts
// Runs the drift review as a child process against the fixtures (blueprint section 11.2).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'drift-review.ts');
const FIXTURES = join(ROOT, 'test', 'fixtures', 'content');
const DRIFT_CASE = join(FIXTURES, 'cases', 'drift');

interface Item {
  type: 'artifact' | 'source';
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
  stale: boolean;
  items: Item[];
}

function run(args: string[]) {
  const proc = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

function runJson(args: string[]) {
  const r = run([...args, '--json']);
  const parsed = JSON.parse(r.stdout) as { today: string; days: number; groups: Group[] };
  return { ...r, ...parsed };
}

describe('drift-review', () => {
  test('nothing stale: one line, exit 0', () => {
    const r = run(['--dir', FIXTURES, '--today', '2026-09-15']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('No artifacts or sources older than 90 days.');
  });

  test('groups by module in catalog order with the artifact and source lines', () => {
    const r = run(['--dir', FIXTURES, '--today', '2027-01-15']);
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split('\n');
    expect(lines[0]).toBe('orientation (checkedOn 2026-09-15, 122 days)');
    expect(lines).toContain('  artifact  orientation-transfer-table  public  checkedOn 2026-09-15  122 days');
    const modelsIndex = lines.indexOf('models (checkedOn 2026-09-15, 122 days)');
    expect(modelsIndex).toBeGreaterThan(0);
    expect(lines).toContain('  artifact  models-captured-session  captured  codex-cli 0.50.0  checkedOn 2026-09-15  122 days');
    expect(lines).toContain('  source    Anthropic model deprecations  checkedOn 2026-09-15  122 days');
  });

  test('--days widens the window', () => {
    const r = run(['--dir', FIXTURES, '--today', '2027-01-15', '--days', '400']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('No artifacts or sources older than 400 days.');
  });

  test('--fail-on-stale exits 3 when anything is stale and 0 otherwise', () => {
    expect(run(['--dir', FIXTURES, '--today', '2027-01-15', '--fail-on-stale']).status).toBe(3);
    expect(run(['--dir', FIXTURES, '--today', '2026-09-15', '--fail-on-stale']).status).toBe(0);
  });

  test('an artifact 91 days old is listed and a source 89 days old is not (AC-5.12.1)', () => {
    const r = runJson(['--dir', DRIFT_CASE, '--today', '2026-09-15']);
    expect(r.status).toBe(0);
    expect(r.days).toBe(90);
    expect(r.groups).toHaveLength(1);
    const [group] = r.groups;
    expect(group.slug).toBe('models');
    expect(group.stale).toBe(false);
    expect(group.items).toEqual([
      { type: 'artifact', name: 'models-fixture-trace', origin: 'synthetic', checkedOn: '2026-06-16', ageDays: 91 },
    ]);
  });

  test('draft modules are marked (draft)', () => {
    const r = run(['--dir', join(ROOT, 'src', 'content'), '--today', '2027-06-01']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^orientation \(draft\) \(checkedOn \d{4}-\d{2}-\d{2}, \d+ days\)$/m);
  });

  test('an unreadable directory exits 2', () => {
    const r = run(['--dir', join(ROOT, 'test', 'fixtures', 'does-not-exist')]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('drift-review: cannot read');
  });

  test('a bad --days value exits 2', () => {
    expect(run(['--dir', FIXTURES, '--days', 'soon']).status).toBe(2);
  });
});
