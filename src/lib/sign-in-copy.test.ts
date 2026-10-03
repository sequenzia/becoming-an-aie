// src/lib/sign-in-copy.test.ts
// Blueprint section 6.5, with the code the installed callback produces for implicit linking
// (docs/decisions.md, 2026-10-03).
import { describe, expect, test } from 'vitest';
import { signInMessage } from './sign-in-copy';

describe('signInMessage', () => {
  test('no code, no message', () => {
    expect(signInMessage(null)).toBeNull();
    expect(signInMessage('')).toBeNull();
  });

  test('the two linking codes share the linking sentence, read from the query the way the page reads it', () => {
    const linking = 'This email already belongs to an account that uses one of these providers. Try the other one. Merging accounts is not offered.';
    expect(signInMessage(new URLSearchParams('?error=account_not_linked').get('error'))).toBe(linking);
    expect(signInMessage(new URLSearchParams('?error=unable_to_link_account').get('error'))).toBe(linking);
  });

  test('the email codes get their own sentence', () => {
    expect(signInMessage('email_not_found')).toMatch(/did not share an email address/);
    expect(signInMessage('email_not_verified')).toMatch(/reports this email address as unverified/);
  });

  test('anything else gets the generic line', () => {
    expect(signInMessage('invalid_code')).toBe('Sign-in did not complete. Try again.');
    expect(signInMessage('<script>')).toBe('Sign-in did not complete. Try again.');
  });
});
