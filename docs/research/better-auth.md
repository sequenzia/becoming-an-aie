# Better Auth cheat sheet for the Astro 7 server-output site

Verified on 2026-09-15. Every fact below comes from one of these sources, named next to the item:

- ctx7 id `/better-auth/better-auth` (the official repo, docs under `docs/content/docs/`). Doc paths map to `https://www.better-auth.com/docs/<path>`.
- Raw source files from `https://raw.githubusercontent.com/better-auth/better-auth/main/...` (read directly when the docs were silent).
- ctx7 id `/withastro/docs` and raw Astro source from `withastro/astro` main.
- ctx7 id `/drizzle-team/drizzle-orm-docs`.
- `npm view <pkg>` for versions and package metadata.

Anything not covered by those is marked UNVERIFIED.

## 0. Versions confirmed with npm view

| Package | Version | Notes |
| --- | --- | --- |
| `better-auth` | 1.7.5 | `latest` tag. License MIT. npm maintainer `bekacru`. Published 2026-09-14. |
| `@better-auth/drizzle-adapter` | 1.7.5 | MIT. Also a direct dependency of `better-auth` 1.7.5. |
| `auth` | 1.7.5 | This is the CLI now. Bins `auth` and `better-auth`. Node `>=22.12.0`. |
| `@better-auth/cli` | 1.4.21 | DEPRECATED on npm ("Package no longer supported"). Do not use. |
| `drizzle-orm` | 0.45.2 | better-auth peer range `^0.45.2 \|\| >=1.0.0-rc.1 <2.0.0`. |
| `drizzle-kit` | 0.31.10 | better-auth peer range `>=0.31.4 \|\| >=1.0.0-beta.1`. |
| `pg` | 8.23.0 | better-auth peer `^8.0.0`. drizzle-orm peer `>=8`. |
| `@electric-sql/pglite` | 0.5.8 | drizzle-orm peer `>=0.2.0`. Dev dependency, needs approval. |
| `astro` | 7.3.2 | |
| `@astrojs/node` | 11.1.5 | peer `astro ^7.2.1`. |
| `@astrojs/mdx` | 8.0.1 | peer `astro ^7.2.6`. |
| `@astrojs/preact` | 6.0.5 | peer `preact ^10.6.5`. |
| `preact` | 10.29.8 | |

`better-auth` 1.7.5 export subpaths that matter here: `.`, `./client`, `./api`, `./minimal`, `./cookies`, `./adapters/drizzle` (still present), `./react`, `./types`. Confirmed with `npm view better-auth@1.7.5 exports`.

## 1. Version, license, ownership

Confirmed:

- `better-auth@1.7.5` is `latest`, license field `MIT`, repo `github.com/better-auth/better-auth`, homepage `better-auth.com`. Source: `npm view better-auth`.
- Repo `LICENSE.md` is "The MIT License (MIT), Copyright (c) 2024 - present, Bereket Engida". Source: raw `LICENSE.md` on main.
- GitHub API: owner org `better-auth`, license `MIT`, not archived, last push 2026-09-16, about 29.9k stars.
- Vercel announced the acquisition on 2026-07-07 at `https://vercel.com/blog/vercel-acquires-better-auth`. The post says the library "remains free and open source under MIT" and that "the team continues to lead development with the same open contribution model, community governance, and framework support across the ecosystem". Financial terms were not disclosed. Founder Bereket Engida and the core team joined Vercel. Other coverage: The New Stack, Cleary Gottlieb (counsel), WeeTracker.
- Since the acquisition the npm package name, GitHub org, and license have not changed. Releases continue (1.7.x line, `release-1.6` and `release-1.4` maintenance tags also exist).

UNVERIFIED:

- Whether npm publish rights moved to a Vercel-owned account. `npm view` still lists only `bekacru` as maintainer.
- Any future relicensing or paid tier. Nothing in the docs or blog suggests one.
- Long-term support windows for 1.6 and 1.7. The dist-tags show `release-1.6` at 1.6.33 and `release-1.4` at 1.4.22, so backports happen, but no policy page was found.

Decision it forces: pin `better-auth`, `@better-auth/drizzle-adapter`, and the `auth` CLI to the same exact version (1.7.5). The CLI `upgrade` command moves all synchronized `@better-auth/*` packages together (docs `concepts/cli.mdx`).

## 2. Astro integration

Source: `docs/content/docs/integrations/astro.mdx` (`https://www.better-auth.com/docs/integrations/astro`), read raw in full.

### 2.1 Auth instance

Skeleton from `docs/basic-usage.mdx`, `docs/authentication/github.mdx`, `docs/authentication/google.mdx`, `docs/adapters/drizzle.mdx`. Combined here; each option is documented in the sections below.

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../db/client";
import * as schema from "../db/auth-schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,      // https://<openshift-route-host>
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
```

`betterAuth` can also be imported from `better-auth/minimal`. That entry drops Kysely and requires an adapter, and it does not support the built-in `migrate` command (docs `guides/optimizing-for-performance.mdx`, `blogs/1-5.mdx`). We use drizzle-kit for migrations, so `minimal` is usable. Optional.

### 2.2 Catch-all route

Verbatim from `integrations/astro.mdx`:

```ts
// src/pages/api/auth/[...all].ts
import { auth } from "~/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => {
	// If you want to use rate limiting, make sure to set the 'x-forwarded-for' header to the request headers from the context
	// ctx.request.headers.set("x-forwarded-for", ctx.clientAddress);
	return auth.handler(ctx.request);
};
```

The doc says: "You can change the path on your better-auth configuration but it's recommended to keep it as `/api/auth/[...all]`". `basePath` defaults to `/api/auth` (`reference/options.mdx`). Export name is `ALL`, which Astro maps to every HTTP method.

### 2.3 Locals types

Verbatim from `integrations/astro.mdx`:

```ts
// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
    // Note: 'import {} from ""' syntax does not work in .d.ts files.
    interface Locals {
        user: import("better-auth").User | null;
        session: import("better-auth").Session | null;
    }
}
```

### 2.4 Middleware

Verbatim from `integrations/astro.mdx`:

```ts
// src/middleware.ts
import { auth } from "@/auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const isAuthed = await auth.api
        .getSession({
            headers: context.request.headers,
        })

    if (isAuthed) {
        context.locals.user = isAuthed.user;
        context.locals.session = isAuthed.session;
    } else {
        context.locals.user = null;
        context.locals.session = null;
    }

    return next();
});
```

`auth.api.getSession` returns `{ session, user }` or null. Server-side `auth.api.*` calls take `headers`, `body`, `query` as named keys (`concepts/api.mdx`). Errors throw `APIError`; check with `isAPIError` from `better-auth/api`.

In an `.astro` page use `Astro.locals.session` and `Astro.redirect("/login")` when it is null (same doc). In an Astro Action, `context.locals.user` is available, and the Astro Actions guide shows throwing `ActionError({ code: 'UNAUTHORIZED' })` when it is missing (`withastro/docs` `guides/actions.mdx`).

### 2.5 Client

Verbatim from `integrations/astro.mdx`, vanilla tab:

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client"
export const authClient =  createAuthClient()
```

Sign-in call (`docs/basic-usage.mdx`):

```ts
await authClient.signIn.social({
    provider: "github",          // or "google"
    callbackURL: "/dashboard",   // default "/"
    errorCallbackURL: "/error",
    newUserCallbackURL: "/welcome",
})
```

Sign-out call (`docs/basic-usage.mdx`):

```ts
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      // redirect
    },
  },
});
```

Notes:

- The Astro doc offers `better-auth/react`, `vue`, `svelte`, `solid` clients. There is no Preact client. Use the vanilla client in an inline `<script>` on the sign-in page. The Preact islands are for the self-check only, so they never need auth hooks. Using `better-auth/react` inside a Preact island through `preact/compat` is UNVERIFIED.
- `createAuthClient()` with no `baseURL` targets the same origin. That is what we want.

### 2.6 Cookies in Astro

- `auth.handler(ctx.request)` returns a `Response` whose `Set-Cookie` headers Astro passes through unchanged. Sign-in, OAuth callback, and sign-out through the client all go through this route, so cookies just work.
- Calling `auth.api.*` from server code returns plain data. Cookies it would set are dropped unless you ask for them: pass `returnHeaders: true` to get `{ headers, response }` and read `headers.getSetCookie()`, or `asResponse: true` to get a `Response` (`concepts/api.mdx`). Inside an Astro Action you would have to copy those into `context.cookies` by hand. Simplest rule: do sign-in and sign-out from the client, do reads (`getSession`) on the server.
- `getSession` on the server may refresh `expiresAt` in the database when `updateAge` (1 day) is reached (`concepts/session-management.mdx`). In middleware we drop the returned headers, so the browser cookie's `Max-Age` is not extended even though the row is. Practical impact is small because `expiresIn` is 7 days and the cookie is re-set at each sign-in. Marking the exact effect UNVERIFIED.
- Astro's own `security.checkOrigin` (default true) only checks `POST/PATCH/DELETE/PUT` with form or text/plain content types (`withastro/docs` `reference/configuration-reference.mdx`). The Better Auth client sends `application/json`, so Astro's check does not interfere.

### 2.7 Request URL inside Astro's Node adapter (matters for section 6)

From `withastro/astro` `packages/astro/src/core/app/node.ts` `createRequest` (read raw):

- Protocol comes from the socket (`http` when the OpenShift route terminates TLS). `X-Forwarded-Proto` is honoured only if it validates against `security.allowedDomains`.
- Hostname: the `Host` header is trusted only if `security.allowedDomains` is configured and matches. Otherwise the URL host falls back to `localhost` plus the listening port. The code comment says this is to prevent SSRF.
- `Astro.clientAddress` uses the first `X-Forwarded-For` value only when the host validated. Otherwise it is the socket address, which behind the router is the router's IP.
- `security.allowedDomains` default `[]`, added in Astro 5.14.2. `allowedDomains: [{}]` allows any domain. Example in the config reference uses `{ hostname: '**.example.com', protocol: 'https' }`.

Consequences: set `BETTER_AUTH_URL` statically (Better Auth then never infers from the request), and set `security.allowedDomains` to the route hostname so `Astro.url` and `Astro.clientAddress` are correct.

## 3. Social providers, no email and password, user fields, data minimization

### 3.1 GitHub

Source: `docs/authentication/github.mdx`, `packages/core/src/social-providers/github.ts`.

- Redirect URL registered at GitHub: `http://localhost:3000/api/auth/callback/github` in the docs for local dev. Astro dev serves on 4321, so register `http://localhost:4321/api/auth/callback/github`. Production: `https://<route-host>/api/auth/callback/github`.
- Default scopes in source: `["read:user", "user:email"]`. The doc says the `user:email` scope is required. A GitHub App (not OAuth App) must also grant "Email addresses: Read-only" under Account Permissions or you get `email_not_found`.
- `getUserInfo` calls `GET /user` then `GET /user/emails`, uses the primary email when `/user` returns `email: null`, and sets `emailVerified` from the emails list. It returns `{ name: profile.name || profile.login || "", email, image: profile.avatar_url, emailVerified, ...userMap }` where `userMap` is the result of `mapProfileToUser`.
- GitHub issues no refresh token for OAuth Apps.
- Stable identity is numeric `profile.id` (docs `concepts/oauth.mdx` table). It is stored as `account.accountId`.

```ts
socialProviders: {
    github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
},
```

### 3.2 Google

Source: `docs/authentication/google.mdx`, `packages/core/src/social-providers/google.ts`.

- Authorized redirect URIs: `http://localhost:4321/api/auth/callback/google` for dev (docs show port 3000) and `https://<route-host>/api/auth/callback/google` in production. Client type "Web application".
- The doc has a warning: "You must configure the `baseURL` to avoid `redirect_uri_mismatch` errors." Set `BETTER_AUTH_URL`.
- Default scopes in source: `["email", "profile", "openid"]`. Identity is `profile.sub` (`accountSubject`). `getUserInfo` decodes the ID token and returns `{ name, email, image: user.picture, emailVerified: user.email_verified, ...userMap }`.

```ts
socialProviders: {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
},
```

### 3.3 Redirect URI format

`docs/concepts/oauth.mdx` "redirectURI": "By default, it uses `/api/auth/callback/${providerName}`", resolved against `baseURL`. You can override per provider with `redirectURI`. We do not need to.

### 3.4 Disabling email and password

`reference/options.mdx`: `emailAndPassword.enabled` default is `false`. Omit the whole `emailAndPassword` block. To hard-disable the routes as well, the options reference documents `disabledPaths`:

```ts
disabledPaths: ["/sign-up/email", "/sign-in/email"],
```

Whether an email sign-in request with the feature disabled returns a specific error code is UNVERIFIED. `disabledPaths` makes the question moot.

Also relevant: `socialProviders.<p>.disableSignUp` blocks new users per provider, and `disableImplicitSignUp` requires `requestSignUp: true` from the client (`concepts/oauth.mdx`). Not needed for us.

### 3.5 What is stored by default

Core schema from `docs/concepts/database.mdx` "Core Schema":

| Table | Columns |
| --- | --- |
| `user` | `id` (pk), `name`, `email` (unique), `emailVerified` (boolean), `image` (optional), `createdAt`, `updatedAt` |
| `session` | `id` (pk), `userId` (fk user.id, cascade, indexed), `token` (unique), `expiresAt`, `ipAddress` (optional), `userAgent` (optional), `createdAt`, `updatedAt` |
| `account` | `id` (pk), `userId` (fk user.id, cascade, indexed), `accountId` (provider's stable id), `providerId`, `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `idToken`, `password`, `createdAt`, `updatedAt` (all token fields optional) |
| `verification` | `id` (pk), `identifier` (indexed), `value`, `expiresAt`, `createdAt`, `updatedAt` |

The OAuth sign-up path in `packages/better-auth/src/oauth2/link-account.ts` creates the user with `{ name, image, ...additionalUserFields, email, emailVerified }` and the account with `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `providerId`, `accountId`.

### 3.6 Data minimization (spec allows provider subject id, email, display name)

Things stored beyond the spec's list: `user.image`, `account.accessToken`, `account.refreshToken`, `account.idToken`, `session.ipAddress`, `session.userAgent`.

Avatar image. In both provider sources `mapProfileToUser`'s return is spread last, so it overrides `image`:

```ts
socialProviders: {
    github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        mapProfileToUser: () => ({ image: null }),
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        mapProfileToUser: () => ({ image: null }),
    },
},
```

The docs describe `mapProfileToUser` as "change the default user mapping" (`concepts/oauth.mdx`), and `image` is a core field, so it is not subject to the `additionalFields` input rules. The `{ image: null }` trick is verified against source, not against a doc sentence, so treat it as source-verified only. Belt and braces with a documented API (`concepts/database.mdx` database hooks):

```ts
databaseHooks: {
  user: {
    create: {
      before: async (user) => ({ data: { ...user, image: null } }),
    },
  },
},
```

`overrideUserInfoOnSignIn` defaults to `false` and `accountLinking.updateUserInfoOnLink` defaults to `false`, so the image is not re-synced on later sign-ins (`concepts/oauth.mdx`, `reference/options.mdx`).

Provider tokens. The docs show a `databaseHooks.account.create.before` hook that encrypts `accessToken` and `refreshToken` before save (`concepts/users-accounts.mdx` "Token Encryption"). Returning the same shape with the token fields set to `null` should drop them. That is an inference from the documented hook, marked UNVERIFIED. The documented alternative is `account.encryptOAuthTokens: true` (`reference/options.mdx`). Nothing in the app needs provider tokens, so nulling them is the cleaner choice if it works; test it against PGlite.

IP and user agent. `advanced.ipAddress.disableIpTracking: true` disables IP tracking (`reference/options.mdx`). It also removes the IP from rate limiting, which then falls back to a shared bucket (see section 8). Leave IP tracking on and accept `session.ipAddress`, or disable it and accept weaker rate limits. Decision needed. `userAgent` has no documented switch. UNVERIFIED whether a session `create.before` hook can null it; it is the same pattern as above.

`name`. Better Auth requires `name`; GitHub falls back to `login` when the profile has no name.

## 4. Drizzle adapter with pg, CLI, schema file

Source: `docs/adapters/drizzle.mdx`, `docs/concepts/cli.mdx`, `packages/cli/test/__snapshots__/auth-schema.txt` (pg snapshot), `packages/cli/package.json`.

### 4.1 Adapter

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./database.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" or "mysql"
  }),
});
```

Pass `schema` so the adapter can find our tables: `drizzleAdapter(db, { provider: "pg", schema })` (doc section "Modifying Table Names" shows the `schema` option, and the Relations v2 example passes `schema` directly). The default `@better-auth/drizzle-adapter` import uses Drizzle Relations v1, which matches drizzle-orm 0.45.x. `@better-auth/drizzle-adapter/relations-v2` is for drizzle-orm v1. Optional extras: `usePlural`, `schemaName` (Postgres schema namespace), `advanced.database.joins: true` (needs the relations the CLI generates; docs claim 2x to 3x on `/get-session`).

Drizzle db for RDS (ctx7 `/drizzle-team/drizzle-orm-docs`, `pg/get-started-postgresql.mdx`):

```ts
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: true
  }
});
```

Or with an explicit pool: `const pool = new Pool({ connectionString }); const db = drizzle({ client: pool });`. RDS CA bundle handling (`ssl: { ca, rejectUnauthorized: true }`) is node-postgres territory and UNVERIFIED here.

Drizzle db for tests with PGlite (`pg/connect-pglite.mdx`):

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// In-memory Postgres
const client = new PGlite();
const db = drizzle({ client });
```

`drizzle-orm@0.45.2` exports `./pglite/migrator` (confirmed via `npm view exports`). The migrator call shape is documented for node-postgres as `import { migrate } from 'drizzle-orm/node-postgres/migrator'; await migrate(db)` (`pg/migrations.mdx`). The PGlite variant by analogy is `import { migrate } from 'drizzle-orm/pglite/migrator'; await migrate(db, { migrationsFolder: './drizzle' })`. UNVERIFIED signature for the pglite path.

### 4.2 CLI

The CLI package is `auth` (bins `auth` and `better-auth`). Docs use `npx auth@latest generate`. `@better-auth/cli` is deprecated and stuck at 1.4.21, so the spec's `npx @better-auth/cli generate` must change.

`generate` options (`concepts/cli.mdx`):

- `-c, --cwd` working directory.
- `--output` where to save. "For Drizzle, it goes to schema.ts in your project root" by default.
- `--config` path to the auth config. Default search: `auth.ts` in `./`, `./utils`, `./lib`, or those under `src`.
- `-y, --yes` skip the prompt.
- `--adapter drizzle --dialect postgresql` generates without a database connection ("Drizzle maps postgresql to pg").

Command for us:

```bash
npx auth@1.7.5 generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y
```

The CLI resolves `tsconfig.json` path aliases and stubs framework virtual modules, but modules that only load inside a bundler must stay out of the config's import graph (`concepts/cli.mdx` "Common Issues"). Keep `src/lib/auth.ts` free of `astro:*` imports.

Then (`adapters/drizzle.mdx`):

```bash
npx drizzle-kit generate # generate the migration file
npx drizzle-kit migrate # apply the migration
```

`migrate` in the auth CLI only works for the built-in Kysely adapter. For Drizzle, use drizzle-kit.

### 4.3 What the generated file looks like (pg)

From the CLI's pg snapshot. Plugin-only columns removed (`twoFactorEnabled`, `username`, `displayUsername`, `twoFactor` table). Table names in the snapshot were customised to `custom_*`; ours will be `user`, `session`, `account`, `verification`.

```ts
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
```

Index and relation names above are my adaptation of the snapshot's `custom_*` names. Let the CLI produce the real file. Column naming is snake_case in the DB with camelCase property names, which is what the adapter expects ("We map field names based on property you passed to your Drizzle schema", `adapters/drizzle.mdx`).

Yes, commit the output as `src/db/auth-schema.ts`. It is plain TypeScript with no generated-file marker requirement. Re-run the CLI whenever plugins or `additionalFields` change, then `drizzle-kit generate`. Import it into the drizzle-kit `schema` list next to the app schema (notify-me table).

IDs are random base62 strings by default. `advanced.database.generateId` accepts `"uuid"`, `"serial"`, `false`, or a function (`reference/options.mdx`). Keep the default.

`advanced.database.validateSchema` defaults to `true` outside production and reports schema drift before the first request (`reference/options.mdx`). Useful in the PGlite test run.

## 5. Sign out and server-side deletion

### 5.1 Sign out

Client: `authClient.signOut()` (section 2.5). Server: `auth.api.signOut({ headers })`.

Route `/sign-out` (POST, `packages/better-auth/src/api/routes/sign-out.ts`): reads the signed `session_token` cookie, looks the session up, deletes the session row by token, calls `deleteSessionCookie` (expires `session_token`, `session_data`, and, when relevant, `account_data` and `oauth_state`), then returns `{ success: true }`. It also asks each linked provider for an RP-initiated logout URL; GitHub and Google providers do not implement `createEndSessionURL` in the sources read, so no redirect happens. UNVERIFIED that neither implements it; the grep of both provider files showed no such method.

Other session endpoints (`concepts/session-management.mdx`): `revokeSession({ token })`, `revokeOtherSessions()`, `revokeSessions()` (all sessions of the current user). All require the caller's own session.

### 5.2 Better Auth's deleteUser

Docs: `concepts/users-accounts.mdx` "Delete User". Source: `packages/better-auth/src/api/routes/update-user.ts` `/delete-user`.

Enable:

```ts
user: {
    deleteUser: {
        enabled: true
    }
}
```

Route behaviour in order (source, 1.7.5):

1. 404 if `user.deleteUser.enabled` is not true.
2. Requires a session (`sensitiveSessionMiddleware`).
3. If `body.password` is given, verify against the credential account. OAuth-only users have none, so `CREDENTIAL_ACCOUNT_NOT_FOUND`.
4. If `body.token` is given, run the callback path (deletes user, sessions, and accounts).
5. If `user.deleteUser.sendDeleteAccountVerification` is configured, create a verification token, call the mailer, and return `"Verification email sent"`. It does not delete. So never configure `sendDeleteAccountVerification` while the mailer is a no-op.
6. Else, if no password and `session.freshAge !== 0`, require `session.createdAt` within `freshAge` (default 86400 s) or fail with `SESSION_EXPIRED`.
7. `beforeDelete(user, request)`.
8. `internalAdapter.deleteUser(userId)`: deletes `session` rows by userId, then `account` rows by userId, then the `user` row (source `packages/better-auth/src/db/internal-adapter.ts`). Then `deleteUserSessions(userId)` again and `deleteSessionCookie`.
9. `afterDelete(user, request)`.

So yes, one call removes user, sessions, and accounts. The docs' claim that OAuth users "need" email verification is about avoiding the freshness check, not a hard requirement. Without email, an OAuth user can delete within `freshAge` of signing in.

Server-side call shape (by the `concepts/api.mdx` convention):

```ts
await auth.api.deleteUser({
  body: {},                 // no password, no token
  headers: context.request.headers,
});
```

`auth.api` calls skip rate limiting but not the session or freshness checks. The docs warn: "It is recommended not to disable this check if you are not using email verification for deleting the account." Options: keep `freshAge` at the default and show "sign in again to delete" when it fails, or set a short `freshAge` (e.g. 5 minutes) so the account page can require a fresh sign-in.

Callbacks: `beforeDelete` may throw `APIError` from `better-auth/api` to abort. `databaseHooks.user.delete.before` can return `false` to abort and `after` runs afterwards (`concepts/database.mdx`).

### 5.3 Direct database deletion instead

If the product wants deletion without a fresh session, do it with Drizzle in an Astro Action:

1. Authorize with `context.locals.user`.
2. `await auth.api.signOut({ headers: context.request.headers, returnHeaders: true })` to delete the current session row and get the cookie-expiry `Set-Cookie` headers.
3. In one transaction delete `session` where `userId`, `account` where `userId`, then `user` where `id`. The generated schema has `onDelete: "cascade"` on both foreign keys, so deleting the user alone also works, but explicit deletes are clearer.
4. Expire the cookie in the browser. Either copy the `Set-Cookie` values from step 2 into the response (Actions expose `context.cookies`, whose API takes name and options rather than raw headers, so parse them) or just call `authClient.signOut()` on the client after the action resolves.

Sessions are invalidated the moment their rows are gone because every request looks the token up in the database. This holds only while `session.cookieCache` is disabled (the default). With cookie cache on, "revoked sessions may remain active on other devices until the cookie cache expires" (`concepts/session-management.mdx`). Keep cookie cache off.

Direct deletion bypasses `beforeDelete`, `afterDelete`, and `databaseHooks`. Keep `user.deleteUser` disabled in that design so the public `/delete-user` route stays 404.

Cookie names, for `context.cookies.delete`: prefix `better-auth`, name `${prefix}.${cookieName}`, so `better-auth.session_token`. When cookies are secure the name gets a secure prefix (`createCookieGetter` in `packages/better-auth/src/cookies/index.ts`). The prefix constant's value was not read; `__Secure-` is the conventional value and is UNVERIFIED here.

## 6. Security defaults and the OpenShift route

Sources: `reference/security.mdx`, `concepts/cookies.mdx`, `reference/options.mdx`, `packages/better-auth/src/cookies/index.ts`.

### 6.1 Cookies

From `createCookieGetter` (source):

- Attributes: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` as below. `advanced.defaultCookieAttributes` and `advanced.cookies[name].attributes` override.
- `secure` resolution order: `advanced.useSecureCookies` if set; else dynamic `baseURL.protocol`; else a string `baseURL` starting with `https://`; else `NODE_ENV === "production"`.
- Names: `session_token` (always), `session_data` (only with `cookieCache`), `dont_remember`, `account_data` (only with `storeAccountCookie`). Prefix `better-auth`, changeable with `advanced.cookiePrefix`.
- `session_token` cookie `maxAge` = `session.expiresIn` (default 7 days). No `maxAge` (browser-session cookie) when the user chose "don't remember me".
- Docs: "Better Auth assigns secure cookies by default when the base URL uses `https`" and "All cookies are `httpOnly` and `secure` when the server is running in production mode".

With `BETTER_AUTH_URL=https://<route-host>` the cookie is `Secure` regardless of `NODE_ENV`. Setting `advanced.useSecureCookies: true` as well is harmless and explicit.

### 6.2 CSRF

`reference/security.mdx` lists five layers: prefer non-simple requests (JSON), Origin validation against `baseURL` plus `trustedOrigins`, `SameSite=Lax`, Fetch Metadata checks for first-login CSRF on cookie-less sign-in and sign-up email routes, and no mutations on GET (OAuth callbacks validate `state` and `nonce`). `advanced.disableCSRFCheck` and `advanced.disableOriginCheck` turn these off; leave both unset.

One edge: a same-origin form post with `Referrer-Policy: no-referrer` carries `Origin: null`; Better Auth then validates the request URL origin against `trustedOrigins`. Because Astro builds the request URL as `http://localhost:<port>` unless `security.allowedDomains` matches, set `allowedDomains` (section 2.7).

### 6.3 trustedOrigins, baseURL, basePath, secret

- `trustedOrigins`: exact origins, `*.example.com` wildcards, protocol-specific wildcards, custom schemes, or an async function per request. "Do not leave the localhost origin in a trusted origins list of a production auth instance." The base URL is trusted by default. Set it from env so dev gets `http://localhost:4321` and prod gets nothing extra.
- `baseURL`: static string, or `BETTER_AUTH_URL` env. "Relying on request inference is not recommended." A path in `baseURL` overrides `basePath`. There is an object form with `allowedHosts`, `protocol`, `fallback` for multi-host deployments; not needed.
- `basePath`: default `/api/auth`.
- `secret`: `secret` option, else `BETTER_AUTH_SECRET`, else `AUTH_SECRET`. Falls back to a fixed dev string, and throws in production if unset. Generate with `openssl rand -base64 32` or `npx auth@latest secret`. `secrets` (plural) or `BETTER_AUTH_SECRETS=2:new,1:old` gives versioned rotation.

```ts
trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],
```

### 6.4 Behind the TLS-terminating OpenShift route

- `advanced.trustedProxyHeaders: true` makes Better Auth build the base URL from `X-Forwarded-Host` and `X-Forwarded-Proto` per request, but only when no static `baseURL` is set. Priority: static `baseURL`, then env, then forwarded headers, then request URL (`reference/security.mdx`). We set `BETTER_AUTH_URL`, so this option is unnecessary and should stay off.
- There is no separate "trust proxy" switch for cookies. The `Secure` flag follows `baseURL` (section 6.1).
- Client IP behind the router. Default header is `x-forwarded-for`. Source `packages/core/src/utils/ip.ts`: without `trustedProxies`, only a single-value header is accepted; a comma-separated chain resolves to `null`. With `advanced.ipAddress.trustedProxies` (IPs or CIDRs), the chain is walked right to left, trusted hops skipped, first untrusted address used. Alternatively point `ipAddressHeaders` at a single header the router sets. Whether the OpenShift HAProxy router sets `x-real-ip` is UNVERIFIED; it does set `X-Forwarded-For` and `Forwarded` by default (UNVERIFIED here, from general knowledge). Third option from the Astro doc: set `x-forwarded-for` to `ctx.clientAddress` in the catch-all route, which produces a single value that Better Auth accepts, provided Astro's `security.allowedDomains` matches so `clientAddress` is the forwarded IP (section 2.7).

```ts
advanced: {
    ipAddress: {
        // your proxies' addresses, not a broad private range that also covers clients
        trustedProxies: ["192.0.2.10", "10.0.0.0/24"],
    },
},
```

Docs warning: `trustedProxies` "only interprets the forwarded header chain and cannot verify the direct sender. Keep your origin reachable only through these proxies". On OpenShift the pod is only reachable through the route, which satisfies this.

- Astro side: `@astrojs/node` standalone "uses HTTP. This works well if you have a proxy server in front of it that does HTTPS" (`withastro/docs` `guides/integrations-guide/node.mdx`). Run with `HOST=0.0.0.0 PORT=<port> node ./dist/server/entry.mjs`, or set `server: { host: true }` in config. Astro's v7 upgrade guide has no changes to `output: 'server'` or the adapter API.

### 6.5 Telemetry

`telemetry.enabled` defaults to `false` (`reference/options.mdx`). `BETTER_AUTH_TELEMETRY=0` makes it explicit in the container env.

## 7. Account linking when the same email signs in with two providers

Sources: `concepts/users-accounts.mdx` "Account Linking", `reference/options.mdx` `accountLinking`, `packages/better-auth/src/oauth2/link-account.ts`.

Default (`enabled: true`, `disableImplicitLinking: false`): when an OAuth sign-in returns an email that matches an existing user and there is no account row for that provider, Better Auth links the new provider to the existing user if the provider reports the email as verified or the provider is in `trustedProviders`, and (source, `requireLocalEmailVerified` default true) the local user's `emailVerified` is true. Otherwise the callback fails with `account_not_linked`.

Two separate users with the same email are impossible: `user.email` is unique in the core schema. So "two separate accounts, merging out of scope" cannot mean two rows. The options are:

1. Keep the default. Second provider is silently linked to the same user when emails are verified. That is a merge by another name.
2. Set `disableImplicitLinking: true`. Second-provider sign-in with a matching email is rejected with `account_not_linked`. New emails still sign up. A signed-in user can still link explicitly through `linkSocial()`, which we would not expose.
3. Set `enabled: false`. Same rejection, and explicit linking is also off.

```ts
account: {
    accountLinking: {
        disableImplicitLinking: true,
    }
},
```

Both 2 and 3 produce an error redirect to `errorCallbackURL` with `error=account_not_linked` (docs `reference/errors/account_not_linked`; the exact query format is UNVERIFIED). The sign-in page needs copy for it: "This email is already registered with another provider."

Decision needed from the author: option 2 or 3, and the error copy.

Related defaults: `trustedProviders` unset, `allowDifferentEmails` false (only affects explicit linking), `updateUserInfoOnLink` false, `allowUnlinkingAll` false. `requireEmailVerification` per provider defaults to false; GitHub and Google both report a trustworthy `email_verified` signal per the docs table.

## 8. Rate limiting built into Better Auth

Sources: `concepts/rate-limit.mdx`, `reference/options.mdx`, `packages/better-auth/src/api/rate-limiter/index.ts`.

- Enabled by default in production (`NODE_ENV=production`), disabled in development. `rateLimit.enabled: true` forces it on.
- Defaults conflict between pages. `concepts/rate-limit.mdx` says window 60 s, max 100. `reference/options.mdx` says window default 10, max 100. Set both explicitly.
- Built-in special rules (source `getDefaultSpecialRules`): paths starting with `/sign-in`, `/sign-up`, `/change-password`, `/change-email` get 3 requests per 10 s. `/request-password-reset`, `/send-verification-email`, `/forget-password*`, and two email-otp paths get 3 per 60 s. `/sign-in/social` therefore gets 3 per 10 s per IP.
- `customRules` override per path, including `false` to disable, and async functions. `/get-session` is a common one to relax.
- Storage: `"memory"` default, `"database"` (needs a `rateLimit` table: `id`, `key` unique, `count` integer, `lastRequest` bigint, generated by `npx auth@latest generate`), `"secondary-storage"`, or `customStorage.consume(key, rule)` which must check and increment atomically. Memory is fine for our single process.
- Server-side `auth.api` calls are never rate limited.
- 429 responses carry `X-Retry-After` seconds. The client can handle it in `fetchOptions.onError`.
- Keying: `${ip}|${path}`. When no trusted IP resolves the limiter logs one warning and uses a shared `no-trusted-ip` bucket per path, so it fails closed rather than off (source). With `disableIpTracking` it skips per-IP limiting. IPv6 is limited per /64 by default (`ipv6Subnet`).

```ts
rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
        "/get-session": false,
    },
},
```

## 9. Decisions this research forces

1. Replace `npx @better-auth/cli generate` with `npx auth@1.7.5 generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`. The old package is deprecated.
2. Install `@better-auth/drizzle-adapter@1.7.5` and import `drizzleAdapter` from it. Pin all three packages to 1.7.5.
3. Set `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` in the container env. Do not rely on request inference. Add Astro `security.allowedDomains` for the route hostname.
4. Register OAuth callbacks at `https://<route-host>/api/auth/callback/github` and `.../google`, plus `http://localhost:4321/...` for dev.
5. Omit `emailAndPassword`. Add `disabledPaths: ["/sign-up/email", "/sign-in/email"]`.
6. Data minimization: `mapProfileToUser: () => ({ image: null })` on both providers plus the `user.create.before` hook. Decide whether to null provider tokens in an `account.create.before` hook (needs a PGlite test) and whether to disable IP tracking.
7. Same-email second provider: choose `disableImplicitLinking: true` (rejects) or accept implicit linking. Two user rows are impossible.
8. Deletion: either enable `user.deleteUser` with the freshness rule and no `sendDeleteAccountVerification`, or do a direct Drizzle deletion from an Action with `signOut` first. Keep `cookieCache` off either way.
9. Rate limiting: set `window`, `max`, and `advanced.ipAddress.trustedProxies` (router CIDR) or the `x-forwarded-for` from `ctx.clientAddress` trick, and confirm which the OpenShift router supports.
10. Do not enable `trustedProxyHeaders`, `disableCSRFCheck`, or `disableOriginCheck`.

## 10. UNVERIFIED list

- npm ownership transfer to Vercel; future licensing; LTS policy.
- Preact compatibility of `better-auth/react`.
- Exact effect of dropping refreshed-session `Set-Cookie` headers in middleware.
- Whether GitHub or Google providers implement `createEndSessionURL` (grep found none).
- Secure cookie name prefix value (`__Secure-` assumed).
- Nulling `accessToken`, `refreshToken`, `idToken` via `databaseHooks.account.create.before`, and nulling `userAgent` via a session hook.
- Exact error redirect format for `account_not_linked`.
- `drizzle-orm/pglite/migrator` call signature (export exists; usage assumed by analogy with node-postgres).
- Whether the OpenShift HAProxy router sets `x-real-ip`.
- node-postgres SSL settings for the RDS CA bundle.
- Whether `/sign-in/social` accepts `application/x-www-form-urlencoded` (would allow a no-JS sign-in form).

