// src/lib/sign-in-copy.ts
// The sentence /sign-in shows for a callback error code (blueprint section 6.5). Better Auth sends the
// browser back to errorCallbackURL with ?error=<code> (better-auth/dist/oauth2/errors.mjs,
// api/routes/callback.mjs). The codes below are the ones this site can produce; anything else, including a
// code typed into the address bar, gets the generic line.

/** The one sentence for the two codes a second provider with a known email can produce (EC-5.9.1). */
const LINKING_MESSAGE =
  'This email already belongs to an account that uses one of these providers. Try the other one. Merging accounts is not offered.';

export function signInMessage(code: string | null): string | null {
  switch (code) {
    case null:
    case '':
      return null;
    // Implicit linking is off (account.accountLinking.enabled: false). handleOAuthUserInfo returns
    // "account not linked" and the callback joins the words with underscores (docs/decisions.md, 2026-10-03).
    case 'account_not_linked':
    // The explicit link path and an orphaned account row answer with this code (OAUTH_CALLBACK_ERROR_CODES).
    case 'unable_to_link_account':
      return LINKING_MESSAGE;
    case 'email_not_found':
      return 'The provider did not share an email address. Make an email address visible in your provider settings and try again.';
    case 'email_not_verified':
      return 'The provider reports this email address as unverified. Verify it with the provider and try again.';
    default:
      return 'Sign-in did not complete. Try again.';
  }
}
