// scripts/lint.mjs
// Plain Node. The first half of `npm run lint`.
// Fails with exit 1 on any U+2014 (em-dash) in src/, docs/, README.md, scripts/, e2e/,
// or on any ^ or ~ version range in package.json. Prints file:line for each hit.
// Prints `lint: ok` otherwise. Directories that do not exist are skipped silently.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ROOTS = ['src', 'docs', 'README.md', 'scripts', 'e2e'];
const EM_DASH = String.fromCharCode(0x2014);

function walk(path, out) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === 'node_modules' || name === '.DS_Store') continue;
      walk(join(path, name), out);
    }
  } else if (stat.isFile()) {
    out.push(path);
  }
}

const files = [];
for (const entry of ROOTS) {
  const path = join(root, entry);
  if (!existsSync(path)) continue;
  walk(path, files);
}

const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(EM_DASH)) continue;
  text.split('\n').forEach((line, i) => {
    if (line.includes(EM_DASH)) hits.push(`${relative(root, file)}:${i + 1}: em-dash (U+2014)`);
  });
}

const pkgPath = join(root, 'package.json');
if (existsSync(pkgPath)) {
  const text = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(text);
  const lines = text.split('\n');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      if (typeof version === 'string' && /^[\^~]/.test(version)) {
        const lineNo = lines.findIndex((l) => l.includes(`"${name}"`) && l.includes(version)) + 1;
        hits.push(`package.json:${lineNo}: ${field}.${name} uses a version range (${version}); pin the exact version`);
      }
    }
  }
}

if (hits.length > 0) {
  for (const hit of hits) console.error(hit);
  console.error(`lint: ${hits.length} problem${hits.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log('lint: ok');
