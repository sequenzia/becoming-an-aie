// src/lib/env.ts
import {
  SITE_URL,
  FEATURE_ACCOUNTS,
  PREVIEW_DRAFTS,
  BETTER_AUTH_URL,
  EMAIL_PROVIDER,
  PG_CA_FILE,
  PGLITE_DATA_DIR,
  DATABASE_URL,
  BETTER_AUTH_SECRET,
  NOTIFY_TOKEN_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from 'astro:env/server';

export type RequiredSecret =
  | 'BETTER_AUTH_SECRET'
  | 'NOTIFY_TOKEN_SECRET'
  | 'GITHUB_CLIENT_ID'
  | 'GITHUB_CLIENT_SECRET'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET';

const secrets: Record<RequiredSecret, string | undefined> = {
  BETTER_AUTH_SECRET,
  NOTIFY_TOKEN_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
};

const AUTH_SECRETS: readonly RequiredSecret[] = [
  'BETTER_AUTH_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const MIN_SECRET_LENGTH = 32;

/** Returns the value or throws a message that names the variable. Never logs the value. */
export function requireEnv(name: RequiredSecret): string {
  const value = secrets[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  if ((name === 'BETTER_AUTH_SECRET' || name === 'NOTIFY_TOKEN_SECRET') && value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

const mode = import.meta.env.MODE;

export const env = {
  /** Build-time constant. The image must be built with SITE_URL set to the public origin. */
  siteUrl: SITE_URL.replace(/\/$/, ''),
  /** Runtime. Defaults to the build-time site URL. */
  authUrl: (BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, ''),
  emailProvider: EMAIL_PROVIDER,
  pgCaFile: PG_CA_FILE,
  pgliteDataDir: PGLITE_DATA_DIR,
  databaseUrl: DATABASE_URL,
  /** Build-time constants. */
  featureAccounts: FEATURE_ACCOUNTS,
  previewDrafts: PREVIEW_DRAFTS,
  isProduction: import.meta.env.PROD,
  isTest: mode === 'test',
} as const;

/**
 * Names of required configuration that is missing, for /readyz and the startup log.
 * Core: NOTIFY_TOKEN_SECRET always; DATABASE_URL in production; PG_CA_FILE whenever DATABASE_URL
 * is set in production (a plaintext RDS connection is refused, section 5.3).
 * Auth: the five auth secrets, only when the build enabled accounts.
 */
export function missingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!NOTIFY_TOKEN_SECRET) missing.push('NOTIFY_TOKEN_SECRET');
  if (env.isProduction && !DATABASE_URL) missing.push('DATABASE_URL');
  if (env.isProduction && DATABASE_URL && !PG_CA_FILE) missing.push('PG_CA_FILE');
  if (env.featureAccounts) {
    for (const name of AUTH_SECRETS) if (!secrets[name]) missing.push(name);
  }
  return missing;
}
