// src/lib/guard.test.ts
// Blueprint section 6.3: the protected patterns, the safe return path, the sign-in path, and the one
// implementation of safeNextPath that src/lib/paths.ts re-exports (section 14.1).
import { describe, expect, test } from 'vitest';
import { PROTECTED_ROUTE_PATTERNS, safeNextPath, signInPath } from './guard';
import { safeNextPath as fromPaths } from './paths';

describe('PROTECTED_ROUTE_PATTERNS', () => {
  test('names the three guarded routes as route patterns', () => {
    expect([...PROTECTED_ROUTE_PATTERNS].sort()).toEqual(['/account', '/account/plan.md', '/assessment']);
    expect(PROTECTED_ROUTE_PATTERNS.has('/account/deleted')).toBe(false);
    expect(PROTECTED_ROUTE_PATTERNS.has('/sign-in')).toBe(false);
    expect(PROTECTED_ROUTE_PATTERNS.has('/modules/[slug]')).toBe(false);
  });
});

describe('safeNextPath', () => {
  test('accepts same-site relative paths, with a query and with the trailing slash Astro appends', () => {
    expect(safeNextPath('/modules/models')).toBe('/modules/models');
    expect(safeNextPath('/account/')).toBe('/account/');
    expect(safeNextPath('/account?tab=plans')).toBe('/account?tab=plans');
  });

  test('rejects anything that could leave the site and falls back to the account page', () => {
    for (const bad of ['//evil.example', 'https://x.example/', '/x\\y', '/proxy?to=https://x.example', 'modules/models', '', null, undefined]) {
      expect(safeNextPath(bad), String(bad)).toBe('/account');
    }
  });

  test('rejects control characters, which browsers strip before parsing (an open redirect otherwise)', () => {
    // ?next=/%09/evil.example decodes to the first one; a browser reads it as //evil.example (URL Standard, basic
    // URL parser). A newline would also make the Location header invalid and turn the redirect into a 500.
    for (const bad of ['/\t/evil.example', '/\t\t//evil.example', '/\t/\t/evil.example', '/\n/evil.example', '/\r\n/evil.example', '/\u0000', '/account\u007f', '/\u0085/evil.example']) {
      expect(safeNextPath(bad), JSON.stringify(bad)).toBe('/account');
    }
  });

  test('rejects a path whose parsed form starts with two slashes, and encoded separators in the path', () => {
    // The parser resolves the dot segments to //evil.example, which a browser would read as another host.
    for (const bad of ['/..//evil.example', '/%2e%2e//evil.example', '/a/..//evil.example', '/%2F%2Fevil.example', '/%5c%5cevil.example', '/x%2Fy']) {
      expect(safeNextPath(bad), bad).toBe('/account');
    }
    // An encoded separator in the query is a value, not a path.
    expect(safeNextPath('/account?from=%2Fmodules%2Fmodels')).toBe('/account?from=%2Fmodules%2Fmodels');
  });

  test('returns the parsed form, so the Location header never carries a raw space or non-ASCII character', () => {
    expect(safeNextPath('/modules/models#workshop')).toBe('/modules/models#workshop');
    expect(safeNextPath('/a b')).toBe('/a%20b');
    expect(safeNextPath('/ä')).toBe('/%C3%A4');
    expect(safeNextPath('/modules/./models')).toBe('/modules/models');
  });

  test('is the same function paths.ts exports', () => {
    expect(fromPaths).toBe(safeNextPath);
  });
});

describe('signInPath', () => {
  test('encodes the safe return path once', () => {
    expect(signInPath('/account/')).toBe('/sign-in?next=%2Faccount%2F');
    expect(signInPath('/account/plan.md')).toBe('/sign-in?next=%2Faccount%2Fplan.md');
    expect(signInPath('https://evil.example')).toBe('/sign-in?next=%2Faccount');
    expect(new URL(signInPath('/assessment/'), 'http://localhost:4321').searchParams.get('next')).toBe('/assessment/');
  });
});
