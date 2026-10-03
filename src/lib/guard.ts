// src/lib/guard.ts
// Route protection (blueprint section 6.3). The middleware matches context.routePattern against these
// patterns, never the raw pathname (Astro's authentication guide: a base, URL encoding, or duplicate
// slashes can make the public pathname differ from the matched route). S shipped this file as its Phase 0
// placeholder with the contract in full; B keeps the names unchanged in Phase 1 and src/lib/paths.ts
// re-exports safeNextPath from here (section 14.1).

/** Matched route patterns, never raw pathnames (Astro's authentication guide). */
export const PROTECTED_ROUTE_PATTERNS: ReadonlySet<string> = new Set(['/account', '/account/plan.md', '/assessment']);

/** The fallback when a return target is missing or unsafe. */
const FALLBACK = '/account';
/** Browsers strip ASCII tab and newline before parsing a URL, so "/\t/evil.example" is "//evil.example" to them. */
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
/** An encoded slash or backslash in the path part reads differently to routers and to browsers. */
const ENCODED_PATH_SEPARATOR = /%2[fF]|%5[cC]/;
/** A reserved name that no real site resolves; the candidate is parsed against it and must stay on it. */
const PARSER_ORIGIN = 'https://aie.invalid';

/**
 * Only same-site relative paths are accepted as a return target, and the accepted path is returned in its
 * parsed form (pathname, search, hash), never as the raw string. The rules mirror Better Auth's own
 * isSafeRelativeURL (better-auth/dist/auth/trusted-origins.mjs, 1.7.5): one leading slash, no backslash, no
 * scheme, no control character, no encoded separator in the path, and the same origin after parsing. Two
 * rules are this site's: the parsed path may not start with "//" (the parser turns "/..//evil.example" into
 * "//evil.example", which a browser reads as another host), and the parsed form is what goes into the
 * Location header, so a space or a non-ASCII character arrives percent-encoded instead of breaking the header.
 */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return FALLBACK;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\') || candidate.includes('://')) return FALLBACK;
  if (CONTROL_CHARACTER.test(candidate)) return FALLBACK;
  const pathEnd = candidate.search(/[?#]/);
  const path = pathEnd === -1 ? candidate : candidate.slice(0, pathEnd);
  if (ENCODED_PATH_SEPARATOR.test(path)) return FALLBACK;
  let url: URL;
  try {
    url = new URL(candidate, PARSER_ORIGIN);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== PARSER_ORIGIN) return FALLBACK;
  const parsed = `${url.pathname}${url.search}${url.hash}`;
  if (!parsed.startsWith('/') || parsed.startsWith('//')) return FALLBACK;
  return parsed;
}

export function signInPath(next: string): string {
  return `/sign-in?next=${encodeURIComponent(safeNextPath(next))}`;
}
