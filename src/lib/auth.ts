// src/lib/auth.ts
// The Better Auth instance (blueprint section 6.1). Lazy: created on the first on-demand request over
// the shared Db, never at build time (fact 0.2.3). Option shapes checked against better-auth 1.7.5 and
// @better-auth/core 1.7.5 on 2026-10-03 (docs/decisions.md): BetterAuthOptions in
// @better-auth/core/dist/types/init-options.d.mts, the hook runner in better-auth/dist/db/with-hooks.mjs,
// the OAuth paths in better-auth/dist/oauth2/link-account.mjs and api/routes/callback.mjs.
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from '../db';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { env, requireEnv } from './env';

/**
 * Drops the avatar URL. OAuthMappedUser types image as string | undefined (null fails astro check).
 * The mapper result is spread last in both providers (github.mjs, google.mjs), so undefined overrides
 * avatar_url and picture. databaseHooks.user.create.before below is the second line of defense.
 */
const dropImage = () => ({ image: undefined });

/**
 * Builds the instance over the shared Db. getAuth() below calls it once.
 *
 * Data minimization (AC-5.9.2, CG-14, decision 13). Every row Better Auth writes passes through
 * createWithHooks or updateWithHooks (with-hooks.mjs), which merge the object a before hook returns
 * over the data about to be written. The hooks below null the avatar, the session's IP address and
 * user agent, and the provider tokens with their expiry dates and scope. The adapter writes a null
 * through as a null (factory.mjs transformInput skips undefined only). src/lib/auth.test.ts proves it on
 * PGlite through the internal adapter; the Phase 1 gate (docs/gates.md row 1.6) reads real rows.
 *
 * Secure cookies. The Secure flag and the __Secure- name prefix follow baseURL: with
 * BETTER_AUTH_URL=https://<route-host> every cookie is Secure regardless of NODE_ENV
 * (better-auth/dist/cookies/index.mjs createCookieGetter). No cookie attribute is overridden here,
 * so session handling, CSRF, and cookies stay the library's defaults (AC-5.9.7).
 */
function createAuth(db: Db) {
  return betterAuth({
    // Static, never inferred from the request (docs/research/better-auth.md 6.3). Runtime value from
    // BETTER_AUTH_URL, defaulting to the build-time SITE_URL (src/lib/env.ts).
    baseURL: env.authUrl,
    basePath: '/api/auth',
    secret: requireEnv('BETTER_AUTH_SECRET'),
    // The base URL is trusted by default. Listing it keeps the trusted list explicit and equal to the
    // final domain only (AC-5.9.7); nothing else posts to the auth routes.
    trustedOrigins: [env.authUrl],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // requireEmailVerification (per provider, default false in 1.7.5): the callback refuses a sign-in whose
    // provider reports the address as unverified (link-account.mjs: EMAIL_NOT_VERIFIED, no session). The
    // account's email drives the notify-me lookup and deletion in src/lib/account.ts, so an unverified
    // address must never become an account (docs/decisions.md, 2026-10-03, Phase 1 review round 2). GitHub
    // sets emailVerified from /user/emails and Google from the ID token's email_verified, so both report a
    // real flag. The library check runs after the user row is written on a first sign-in; the
    // user.create.before hook below refuses the row itself, so nothing is stored either.
    socialProviders: {
      // GitHub: scopes read:user and user:email by default. When /user returns email: null the
      // provider fetches /user/emails and uses the primary address; a private-email account with
      // no readable address ends in ?error=email_not_found (@better-auth/core social-providers/github.mjs,
      // better-auth api/routes/callback.mjs). The Phase 1 gate checks a private-email account.
      github: {
        clientId: requireEnv('GITHUB_CLIENT_ID'),
        clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
        mapProfileToUser: dropImage,
        requireEmailVerification: true,
      },
      google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        mapProfileToUser: dropImage,
        requireEmailVerification: true,
      },
    },
    // No email and password anywhere. The routes are disabled as well as unconfigured
    // (better-auth api/index.mjs onRequest answers 404 for a disabled path).
    // /update-user is Better Auth's own name and image writer (api/routes/update-user.mjs: sessionMiddleware,
    // then internalAdapter.updateUser with name and image, no length bound, no update hook). Nothing on this
    // site calls it: the account page renames through the updateDisplayName action, which enforces
    // DISPLAY_NAME_MAX_CHARS, and the avatar is never stored (AC-5.9.2, privacy notice). Left open, a signed-in
    // learner could write an unbounded name into every page header and an image URL into their row through a
    // route the app never uses, outside the app's limiter (docs/decisions.md, 2026-10-03).
    // The other session-bearing routes were probed with a real session on 2026-10-03: /change-email and
    // /delete-user are off by option, /set-password and /change-password have no credential account,
    // /update-session has no field to write, and /link-social only hands out an authorization URL whose
    // callback refuses the link while accountLinking is off (api/routes/callback.mjs).
    disabledPaths: ['/sign-up/email', '/sign-in/email', '/update-user'],
    // A second provider with an email that already exists is rejected (EC-5.9.1, deviation 15.3.1).
    // handleOAuthUserInfo returns "account not linked" and the callback redirects to errorCallbackURL
    // with ?error=account_not_linked; the explicit link path answers unable_to_link_account.
    // src/lib/sign-in-copy.ts explains both with one sentence (docs/decisions.md, 2026-10-03).
    account: { accountLinking: { enabled: false } },
    // Revocation must be immediate: every request looks the session up (CG-9).
    session: { cookieCache: { enabled: false } },
    databaseHooks: {
      user: {
        // The only path that creates a user is the OAuth callback (the email routes are disabled). A provider
        // that reports the address as unverified never gets a row: the callback catches the APIError and
        // sends the browser to /sign-in?error=email_not_verified (api/routes/callback.mjs, the catch around
        // handleOAuthUserInfo), where src/lib/sign-in-copy.ts explains it. Without this refusal the library's
        // own check would leave an unverified row behind and lock the address out of a later sign-in with
        // account_not_linked. Nothing is announced to the attacker beyond the one sentence.
        create: {
          before: async (user) => {
            if (!user.emailVerified) {
              throw new APIError('FORBIDDEN', { code: 'email_not_verified', message: 'The provider reports this email address as unverified.' });
            }
            return { data: { ...user, image: null } };
          },
        },
      },
      session: {
        create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) },
      },
      account: {
        create: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              scope: null,
            },
          }),
        },
        // A later sign-in refreshes the tokens and their expiry dates through updateAccount
        // (link-account.mjs freshTokens). The expiry dates are nulled with the tokens so the account
        // row never carries a field the privacy notice does not list.
        update: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              scope: null,
            },
          }),
        },
      },
    },
    // Better Auth's own limiter for /api/auth/* in production only (CG-25, decision 32). The built-in
    // special rule keeps /sign-in/social at 3 per 10 seconds per IP; the catch-all route hands the
    // limiter a single-value x-forwarded-for (section 6.2).
    rateLimit: {
      enabled: env.isProduction,
      window: 60,
      max: 100,
      customRules: { '/get-session': false },
    },
    telemetry: { enabled: false },
  });
}

/**
 * The concrete instance type. ReturnType<typeof betterAuth> would be Auth<BetterAuthOptions>, and in 1.7.5 an
 * instance built from specific options is not assignable to it ($context.adapter is typed on the options), so
 * the type comes from the factory above (docs/decisions.md, 2026-10-03).
 */
export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as unknown as { __aieAuth?: Promise<Auth> };

/**
 * Lazy singleton. Created on the first on-demand request, never at build time. A rejected attempt is not
 * kept, the same rule getDb() follows, so a transient database failure on the first request does not
 * replay forever.
 */
export function getAuth(): Promise<Auth> {
  g.__aieAuth ??= getDb()
    .then(({ db }) => createAuth(db))
    .catch((err: unknown) => {
      g.__aieAuth = undefined;
      throw err;
    });
  return g.__aieAuth;
}
