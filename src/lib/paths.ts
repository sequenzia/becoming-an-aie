// src/lib/paths.ts
// Path helpers shared by pages, components, and actions (blueprint section 14.3).

/**
 * The no-JS form target for an action hosted on an on-demand route, for example
 * actionFormPath('/notify', 'notifySubscribe') gives '/notify?_action=notifySubscribe'.
 * paths.test.ts asserts this equals route + String(actions.notifySubscribe) from astro:actions.
 */
export function actionFormPath(route: string, actionName: string): string {
  return `${route}?${new URLSearchParams({ _action: actionName }).toString()}`;
}

/** '/modules/<slug>' or '/modules/<slug>#<headingId>'. */
export function moduleHref(slug: string, headingId?: string): string {
  return headingId ? `/modules/${slug}#${headingId}` : `/modules/${slug}`;
}

/**
 * Only same-site relative paths are accepted as a return target. S ships this copy first;
 * it becomes a re-export from src/lib/guard.ts once B lands (section 14.1).
 */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return '/account';
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\') || candidate.includes('://')) return '/account';
  return candidate;
}
