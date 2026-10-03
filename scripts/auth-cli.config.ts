// scripts/auth-cli.config.ts
// Static configuration for `npx auth@1.7.5 generate`. Mirrors the providers and database of
// src/lib/auth.ts without any astro:* import. Never imported by the application.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '../src/db/schema.ts';

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: 'pg', schema }),
  socialProviders: {
    github: { clientId: 'cli', clientSecret: 'cli' },
    google: { clientId: 'cli', clientSecret: 'cli' },
  },
});
