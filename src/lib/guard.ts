// src/lib/guard.ts
// Placeholder written by S; B replaces it in Phase 1. It carries the section 6.3 contract in full
// because S's Phase 0 middleware and F's landing e2e spec depend on the real patterns.
/** Matched route patterns, never raw pathnames (Astro's authentication guide). */
export const PROTECTED_ROUTE_PATTERNS: ReadonlySet<string> = new Set(['/account', '/account/plan.md', '/assessment']);

/** Only same-site relative paths are accepted as a return target. */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return '/account';
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\') || candidate.includes('://')) return '/account';
  return candidate;
}

export function signInPath(next: string): string {
  return `/sign-in?next=${encodeURIComponent(safeNextPath(next))}`;
}
