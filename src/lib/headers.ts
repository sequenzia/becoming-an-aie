// src/lib/headers.ts
/** Set on every on-demand response. Prerendered pages get the same headers from the Route (13.3 step 6). */
export function applySecurityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Frame-Options', 'DENY');
}

/**
 * Adds Cookie to Vary. Values already there stay, Cookie is written once, and a `*` is left alone because it
 * already covers every header. A page and the middleware may both call this on one response.
 */
function varyOnCookie(headers: Headers) {
  const values = (headers.get('Vary') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.includes('*')) return;
  if (!values.some((v) => v.toLowerCase() === 'cookie')) values.push('Cookie');
  headers.set('Vary', values.join(', '));
}

/** Responses that depend on a session must never be cached by a browser or a shared cache. */
export function applyPrivateCache(headers: Headers) {
  headers.set('Cache-Control', 'private, no-store');
  varyOnCookie(headers);
}

/** Anonymous responses that may be cached briefly. */
export function applyPublicCache(headers: Headers, maxAgeSeconds = 300) {
  headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  varyOnCookie(headers);
}
