// src/lib/headers.test.ts
import { describe, expect, test } from 'vitest';
import { applyPrivateCache, applyPublicCache, applySecurityHeaders } from './headers';

describe('cache headers vary on Cookie', () => {
  test('a fresh response gets Vary: Cookie once', () => {
    const headers = new Headers();
    applyPublicCache(headers);
    expect(headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(headers.get('Vary')).toBe('Cookie');
  });

  test('a second call does not repeat Cookie', () => {
    const headers = new Headers();
    applyPublicCache(headers, 60);
    applyPrivateCache(headers);
    expect(headers.get('Cache-Control')).toBe('private, no-store');
    expect(headers.get('Vary')).toBe('Cookie');
  });

  test('existing Vary values are kept and Cookie is matched without regard to case', () => {
    const headers = new Headers({ Vary: 'Accept-Encoding, cookie' });
    applyPrivateCache(headers);
    expect(headers.get('Vary')).toBe('Accept-Encoding, cookie');
    const other = new Headers({ Vary: 'Accept-Encoding' });
    applyPublicCache(other);
    expect(other.get('Vary')).toBe('Accept-Encoding, Cookie');
  });

  test('a wildcard Vary is left alone', () => {
    const headers = new Headers({ Vary: '*' });
    applyPrivateCache(headers);
    expect(headers.get('Vary')).toBe('*');
  });

  test('the security headers are set, not appended', () => {
    const headers = new Headers({ 'X-Frame-Options': 'SAMEORIGIN' });
    applySecurityHeaders(headers);
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
