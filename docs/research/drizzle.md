# Drizzle ORM with PostgreSQL: verified cheat sheet

Research date: 2026-09-15. Target: a small Astro 7 site in server output mode, Astro Node adapter (standalone), one long-lived Node 24 process in an OpenShift container, PostgreSQL on AWS RDS over TLS through node-postgres, PGlite for tests and for local dev without a DATABASE_URL.

Every snippet below is either copied from a documentation source (the source is named next to it) or was run by me against the installed packages in a scratch project. Items I could not verify are marked UNVERIFIED.

## 0. Versions and sources

Confirmed with `npm view <pkg> version` on 2026-09-15:

| Package | Version | Note |
| --- | --- | --- |
| drizzle-orm | 0.45.2 | `latest` tag. A `1.0.0-rc.5` exists on the `rc` tag. Do not use it yet. |
| drizzle-kit | 0.31.10 | `latest` tag. Dev dependency. |
| pg | 8.23.0 | Runtime dependency. |
| @types/pg | 8.23.1 | Dev dependency. |
| @electric-sql/pglite | 0.5.8 | Dev dependency. 25.4 MB unpacked (WASM). Needs approval. |
| better-auth | 1.7.5 | Exports `better-auth/adapters/drizzle`. |
| @better-auth/drizzle-adapter | 1.7.5 | Peer: `drizzle-orm ^0.45.2 \|\| >=1.0.0-rc.1 <2.0.0`. |
| vitest | 5.0.1 | Dev dependency. |
| astro | 7.3.2 | |
| @astrojs/node | 11.1.5 | |
| Node | 24.15.0 | Local machine. |

drizzle-orm 0.45.2 peer dependencies include `pg >=8` and `@electric-sql/pglite >=0.2.0`.

Documentation sources used (ctx7 ids):

- Drizzle ORM docs: `/drizzle-team/drizzle-orm-docs` (github.com/drizzle-team/drizzle-orm-docs, src/content/docs/...)
- node-postgres: `/brianc/node-postgres` (github.com/brianc/node-postgres/docs/pages/...)
- PGlite: `/electric-sql/pglite` and `/websites/pglite_dev`
- Better Auth: `/better-auth/better-auth`
- Astro: `/withastro/docs`
- Vitest: `/vitest-dev/vitest`
- AWS RDS TLS page (WebFetch): https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html

Local verification: I installed the exact versions above into a scratch project, generated a migration with drizzle-kit, applied it to an in-memory PGlite with the Drizzle migrator, and ran upserts, transactions, cascades and typed jsonb reads. I also ran `tsc --strict` on the factory in section 6. The scratch project is at `/private/tmp/claude-502/-Users-ada-dev-becoming-an-aie/d0884c5a-9547-4a7e-97af-95b16d3c8d6e/scratchpad/drz`.

### Important: the docs site is partly ahead of the stable release

The Drizzle docs site already documents drizzle-orm 1.0 in places. Three things differ from the installed 0.45.2 and 0.31.10:

1. Migration folder layout. The docs show `drizzle/20242409125510_name/migration.sql` plus `snapshot.json`. drizzle-kit 0.31.10 produces `drizzle/0000_name.sql`, `drizzle/meta/_journal.json` and `drizzle/meta/0000_snapshot.json`. I verified this by running `drizzle-kit generate`.
2. `migrate(db)` with no config. In 0.45.2 the config is required: `migrate(db, { migrationsFolder })`. Verified in `node_modules/drizzle-orm/node-postgres/migrator.d.ts`: `migrate(db: NodePgDatabase<TSchema>, config: MigrationConfig)`, and `MigrationConfig.migrationsFolder` is a required string.
3. Relational queries. The docs show RQB v2 (`defineRelations`, `where: { id: 1 }`). 0.45.2 uses RQB v1: `relations()` and `where: eq(table.col, value)`. I verified the v1 form runs.

## 1. Connecting with node-postgres

### 1.1 Constructor forms

From the installed `drizzle-orm/node-postgres/driver.d.ts` (0.45.2), `drizzle` accepts:

```ts
drizzle(pool)                                  // TClient | string
drizzle(pool, { schema })                      // TClient | string, DrizzleConfig
drizzle({ client: pool, schema })              // DrizzleConfig & { client }
drizzle({ connection: connectionString, schema })
drizzle({ connection: { connectionString, ssl }, schema })   // connection: string | PoolConfig
```

The return type is `NodePgDatabase<TSchema> & { $client: Pool }`. `DrizzleConfig` has `logger`, `schema`, `casing` and `cache` (from `drizzle-orm/utils.d.ts`).

Docs snippet, pass an existing Pool (source: drizzle-orm-docs `src/mdx/get-started/postgresql/ConnectNile.mdx`, same form as `get-started-postgresql.mdx`):

```ts
import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.NILEDB_URL!,
});
const db = drizzle({ client: pool });
```

Docs snippet, let Drizzle build the pool from options (source: `src/content/docs/pg/get-started-postgresql.mdx`):

```ts
import { drizzle } from 'drizzle-orm/node-postgres';

// You can specify any property from the node-postgres connection options
const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: true
  }
});

const result = await db.execute('select 1');
```

Recommendation: build the `Pool` yourself. You then own `pool.on('error')` and `pool.end()`, and the same pool can be handed to Better Auth through `db`.

### 1.2 TLS to AWS RDS

node-postgres ssl docs (source: `docs/pages/features/ssl.mdx`). The `ssl` object is passed to Node's `TLSSocket` constructor:

```js
const fs = require('fs');

const config = {
  database: 'database-name',
  host: 'host-or-ip',
  // this object will be passed to the TLSSocket constructor
  ssl: {
    ca: fs.readFileSync('/path/to/server-certificates/root.crt'),
    key: fs.readFileSync('/path/to/client-key/postgresql.key'),
    cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt'),
  },
}
```

RDS uses server certificates only. Drop `key` and `cert`. Keep `ca`.

Since pg 8, `rejectUnauthorized` defaults to true. The announcements page (source: `docs/pages/announcements.mdx`) shows the old behavior opt-out as `new Client({ ssl: { rejectUnauthorized: false } })`. Do not do that for RDS. Pass the CA and keep verification on:

```ts
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,        // no sslmode in the URL, see the caveat below
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync(process.env.PG_CA_FILE ?? '/etc/rds/global-bundle.pem', 'utf8'),
  },
});
```

Caveat from the same ssl docs page: when the connection string contains `sslcert`, `sslkey`, `sslrootcert` or `sslmode`, the `ssl` object in the config is overwritten and any other ssl options are lost:

```js
const config = {
  connectionString: 'postgres://user:password@host:port/db?sslmode=require',
  // Beware! The ssl object is overwritten when parsing the connectionString
  ssl: {
    ca: fs.readFileSync('/path/to/server-certificates/root.crt'),
  },
}
```

So pick exactly one of these two:

- Option A (recommended): a plain `DATABASE_URL` with no ssl params, plus an `ssl` object in code. The CA file is mounted into the container (ConfigMap) or the PEM text is passed in an env var and used directly as `ca`.
- Option B: everything in the URL. `pg-connection-string` (source: `packages/pg-connection-string/index.js`) reads `sslrootcert` from disk into `ssl.ca`. In the default code path, `sslmode=verify-full` keeps full certificate and hostname verification, `sslmode=disable` sets `ssl=false`, `no-verify` sets `rejectUnauthorized=false`, and `prefer`, `require` and `verify-ca` behave like `verify-full` but print a deprecation warning. Example: `postgres://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/etc/rds/global-bundle.pem`.

RDS CA bundle (source: AWS RDS user guide, "Using SSL/TLS to encrypt a connection"):

- Global bundle for any commercial region: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
- Region bundles exist, for example https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem
- The bundles contain the root CAs `rds-ca-rsa2048-g1`, `rds-ca-rsa4096-g1` and `rds-ca-ecc384-g1`. The default CA for new instances is `rds-ca-rsa2048-g1`.
- AWS: "Your application trust store needs to only register the root CA certificate. Do not register the intermediate CA certificates."
- Connect using the RDS endpoint hostname, not an IP, so hostname verification can match the certificate. (General TLS guidance, not from these docs.)

For the OpenShift runbook: bake `global-bundle.pem` into the image at `/etc/rds/global-bundle.pem` during the Docker build (`ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/rds/global-bundle.pem`), or mount it from a ConfigMap. Either way set `PG_CA_FILE`.

### 1.3 Pooling in one long-lived process

Pool options (source: node-postgres `docs/pages/apis/pool.mdx`):

- `max` (default 10), `min`, `idleTimeoutMillis` (default 10000), `connectionTimeoutMillis`, `maxUses`, `maxLifetimeSeconds`, `allowExitOnIdle`, `onConnect`, `pipeline`.

```js
import { Pool } from 'pg'

const pool = new Pool({
  host: 'localhost',
  user: 'database-user',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxLifetimeSeconds: 60,
})
```

Create the pool once and keep it for the life of the process (source: `packages/pg-pool/README.md`):

```js
// correct usage: create the pool and let it live
// 'globally' here, controlling access to it through exported methods
const pool = new pg.Pool()
```

Creating a pool per request is called out as wrong in the same README because it creates an unbounded number of pools and connections.

Attach an error handler. An idle client can be disconnected by the server and the error is emitted on the pool (source: `packages/pg-pool/README.md`):

```js
pool.on('error', function (error, client) {
  // handle this in the same way you would treat process.on('uncaughtException')
  // it is supplied the error as well as the idle client which received the error
})
```

Shut down at process exit (source: `docs/pages/apis/pool.mdx`):

```js
await pool.end()
```

Sizing for this site: one Node process, `max: 5` to `10` is plenty. Keep `max` well below the RDS instance `max_connections`. Set `idleTimeoutMillis` around 30000 so idle connections close between bursts. On `SIGTERM` call `pool.end()` before exiting so OpenShift rolling deploys do not leave half-open connections. The Drizzle instance exposes the pool as `db.$client`.

Astro dev caveat (not from docs, practical): Vite can re-evaluate a module during HMR and create a second pool. Cache the handle on `globalThis` in dev. The factory in section 6 does this.

## 2. Schema

### 2.1 Column and constraint APIs used

All verified against `drizzle-orm/pg-core` 0.45.2 types and a real `drizzle-kit generate` run.

pgEnum (source: `src/content/docs/pg/column-types.mdx`):

```ts
import { pgEnum, pgTable } from "drizzle-orm/pg-core";

export const moodEnum = pgEnum('mood', ['sad', 'ok', 'happy']);

export const table = pgTable('table', {
	mood: moodEnum(),
});
```

```sql
CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');

CREATE TABLE "table" (
	"mood" "mood"
);
```

timestamp with time zone. The `time()` docs show the option shape `{ withTimezone: true, precision: 6 }` (source: `pg/column-types.mdx`). `timestamp()` takes the same options plus `mode`. The `PgTimestampBuilder` constructor in `timestamp.d.ts` is `(name, withTimezone, precision)`, and `precision` is `0 | 1 | ... | 6`. In `mode: 'date'` (the default) `mapFromDriverValue(value: Date | string): Date`, so you get JS `Date` objects back. The docs (`pg/column-types.mdx`) describe `mode: 'string'` as raw pass-through with no mapping.

Generated DDL from my run: `timestamp('started_at', { withTimezone: true })` produced `"started_at" timestamp with time zone`.

Default now (source: `guides/timestamp-default-value.mdx`):

```ts
import { sql } from 'drizzle-orm';
import { timestamp, pgTable, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  timestamp1: timestamp('timestamp1').notNull().defaultNow(),
  timestamp2: timestamp('timestamp2', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});
```

jsonb with a TypeScript type. `.$type<T>()` is documented on `column-types.mdx` (the Cockroach page carries the snippet; the method is on the shared column builder):

```ts
type Data = {
	foo: string;
	bar: number;
};

const users = cockroachTable('users', {
  jsonbField: jsonb().$type<Data>(),
});
```

`jsonb.d.ts` in pg-core: `mapToDriverValue(value: T['data']): string` and `mapFromDriverValue(value: T['data'] | string): T['data']`. A typed object round-trips. `.default({})` emitted `DEFAULT '{}'::jsonb` in my generated SQL.

References with cascade (source: `relations.mdx`, Cockroach page carries the snippet, same API in pg-core):

```ts
export const posts = cockroachTable('posts', {
	id: int4().primaryKey(),
	name: text(),
	author: int4().references(() => users.id, { onDelete: 'cascade' }).notNull(),
});
```

`foreign-keys.d.ts`: `UpdateDeleteAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default'`, accepted as `onDelete` and `onUpdate`.

Unique index in the third argument callback returning an array (source: `pg/sql-schema-declaration.mdx`):

```ts
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgEnum, pgTable as table } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";

export const rolesEnum = pgEnum("roles", ["guest", "user", "admin"]);

export const users = table(
  "users",
  {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    firstName: t.varchar("first_name", { length: 256 }),
    lastName: t.varchar("last_name", { length: 256 }),
    email: t.varchar().notNull(),
    invitee: t.integer().references((): AnyPgColumn => users.id),
    role: rolesEnum().default("guest"),
  },
  (table) => [
    t.uniqueIndex("email_idx").on(table.email)
  ]
);
```

`indexes.d.ts`: `index(name?: string)` and `uniqueIndex(name?: string)` return an `IndexBuilderOn` with `.on(...columns)`. The pgTable third argument type is `(self) => PgTableExtraConfigValue[]` (`pg-core/table.d.ts`). The older object-returning form still exists but the array form is current.

Runtime updated-at (source: `pg/column-types.mdx`):

```ts
import { integer, timestamp, text, pgTable } from "drizzle-orm/pg-core";

export const table = pgTable('table', {
	updateCounter: integer().default(sql`1`).$onUpdateFn((): SQL => sql`${table.update_counter} + 1`),
	updatedAt: timestamp({ mode: 'date', precision: 3 }).$onUpdate(() => new Date()),
	alwaysNull: text().$type<string | null>().$onUpdate(() => null),
});
```

The docs note: `$onUpdate` only runs inside drizzle-orm at runtime and does not affect drizzle-kit DDL. I verified two behaviors: `db.update()` bumps the column, and an `insert().onConflictDoUpdate()` also bumps it even when `updatedAt` is not in `set`.

### 2.2 Better Auth owns user, session, account, verification

Better Auth defaults to singular table names `user`, `session`, `account`, `verification` (source: `docs/content/docs/concepts/database.mdx`, "Core Schema"). The CLI generates the Drizzle schema for you. The plural variant below is the CLI snapshot for `usePlural: true` (source: `packages/cli/test/__snapshots__/auth-schema-drizzle-use-plural.txt`). The singular default has the same columns with singular names (the SQLite singular snapshot confirms the naming).

```ts
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
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

export const sessions = pgTable(
  "sessions",
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
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
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
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));
```

Decisions this forces:

- `user.id` is `text`. Every app table's `user_id` must be `text` and reference `user.id`.
- Better Auth timestamps are `timestamp` without time zone. Keep them as generated so the adapter matches. App tables can use `withTimezone: true`.
- Session and account `updated_at` have no DB default. Better Auth supplies the value. If you insert rows in tests, pass `updatedAt`.
- Generate with `npx @better-auth/cli generate` (source: `concepts/database.mdx`, "Generating Schema") and place the output in `src/db/auth-schema.ts`. Re-export it from `src/db/schema.ts` so drizzle-kit and the adapter see one schema module.
- Adapter wiring (source: `docs/content/docs/adapters/drizzle.mdx` and the 1.7 rc blog):

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./database.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" or "mysql"
  }),
  //... the rest of your config
});
```

```ts
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { db } from "./db";
import * as schema from "./schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
});
```

Use the first import (`@better-auth/drizzle-adapter`, default entry) with `provider: "pg"` and pass `schema`. The `relations-v2` entry is for drizzle-orm 1.0 and is not for us. `better-auth@1.7.5` also still exports `better-auth/adapters/drizzle` (confirmed from its package exports). The `schema` option on the default entry is the same shape as in the second snippet. UNVERIFIED: I did not fetch the default entry's option list. Confirm in the auth research.

### 2.3 Full app schema (verified)

This file compiled under `tsc --strict`, generated the SQL shown below with drizzle-kit 0.31.10, applied to PGlite, and passed the runtime checks in section 5. It uses the Better Auth singular names.

```ts
// src/db/schema.ts
import {
  pgTable, pgEnum, text, integer, boolean, jsonb, timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// ---- Better Auth owned tables. Replace with the CLI output. Shape matches the CLI snapshot. ----
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (t) => [index('session_userId_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()).notNull(),
}, (t) => [index('account_userId_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index('verification_identifier_idx').on(t.identifier)]);

// ---- App tables ----
export const moduleStatus = pgEnum('module_status', ['not_started', 'in_progress', 'completed']);

export const moduleProgress = pgTable('module_progress', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  moduleSlug: text('module_slug').notNull(),
  status: moduleStatus('status').notNull().default('not_started'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [uniqueIndex('module_progress_user_module_uidx').on(t.userId, t.moduleSlug)]);

export const workshopResponse = pgTable('workshop_response', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  moduleSlug: text('module_slug').notNull(),
  body: text('body').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('workshop_response_user_module_uidx').on(t.userId, t.moduleSlug)]);

export type SelfCheckAnswers = Record<string, string | string[]>;

export const selfCheckResult = pgTable('self_check_result', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  moduleSlug: text('module_slug').notNull(),
  attempts: integer('attempts').notNull().default(0),
  passed: boolean('passed').notNull().default(false),
  answers: jsonb('answers').$type<SelfCheckAnswers>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('self_check_result_user_module_uidx').on(t.userId, t.moduleSlug)]);

export type Ratings = Record<string, number>;
export type AssessmentContext = { role?: string; years?: number; notes?: string };
export type Plan = { focus: string[]; nextModules: string[] };

export const selfAssessment = pgTable('self_assessment', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ratings: jsonb('ratings').$type<Ratings>().notNull(),
  context: jsonb('context').$type<AssessmentContext>().notNull().default({}),
  plan: jsonb('plan').$type<Plan>().notNull(),
  version: integer('version').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex('self_assessment_user_version_uidx').on(t.userId, t.version),
  index('self_assessment_user_idx').on(t.userId),
]);

export const notifySubscriber = pgTable('notify_subscriber', {
  email: text('email').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  token: text('token').notNull(),
}, (t) => [uniqueIndex('notify_subscriber_token_uidx').on(t.token)]);
```

Design notes:

- Surrogate identity ids plus a unique index on `(user_id, module_slug)` give `onConflictDoUpdate` a clean target and keep `returning({ id })` simple. A composite primary key would also work. `primaryKey()` is exported from `drizzle-orm/pg-core` but I did not verify its call signature here (UNVERIFIED).
- `self_assessment` is versioned. Unique on `(user_id, version)`. The Action reads the max version inside a transaction and inserts `max + 1`. With one server process this is race-free enough. A serializable transaction is the strict alternative (section 5).
- `notify_subscriber.token` is the signed confirm and unsubscribe token. It is unique so lookups by token are indexed.
- Row types: `typeof moduleProgress.$inferSelect` and `typeof moduleProgress.$inferInsert`. Verified in `drizzle-orm/table.d.ts` (0.45.2): `readonly $inferSelect: InferSelectModel<Table<T>>`, and `InferSelectModel` and `InferInsertModel` are exported from `drizzle-orm`.

Generated SQL excerpt from `drizzle-kit generate --name init` (my run, drizzle-kit 0.31.10):

```sql
CREATE TYPE "public"."module_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "module_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "module_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"module_slug" text NOT NULL,
	"status" "module_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "self_check_result" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "self_check_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"module_slug" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "module_progress_user_module_uidx" ON "module_progress" USING btree ("user_id","module_slug");--> statement-breakpoint
```

## 3. drizzle-kit and migrations

### 3.1 drizzle.config.ts

Verified config (my run). `dialect`, `schema` and `out` are needed for `generate`. `dbCredentials` is needed for `migrate`, `push`, `pull` and `studio`.

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://unused' },
  strict: true,
  verbose: true,
});
```

`dbCredentials` also accepts discrete params with an `ssl` field (source: `drizzle-config-file.mdx`):

```ts
import { defineConfig } from 'drizzle-kit'

// via connection params
export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    host: "host",
    port: 5432,
    user: "user",
    password: "password",
    database: "dbname",
    ssl: true, // can be boolean | "require" | "allow" | "prefer" | "verify-full" | options from node:tls
  }
});
```

For RDS through drizzle-kit use `ssl: { rejectUnauthorized: true, ca: readFileSync(...) }` in that object, or a URL with `sslmode=verify-full&sslrootcert=...`.

Migrations log table defaults (source: `drizzle-config-file.mdx`, "migrations"): table `__drizzle_migrations` in schema `drizzle`. Override with:

```ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  migrations: {
    table: 'my-migrations-table', // `__drizzle_migrations` by default
    schema: 'public', // used in PostgreSQL only, `drizzle` by default
  },
});
```

The DB user that runs migrations needs `CREATE` on the database so the `drizzle` schema can be created.

### 3.2 Generate

```shell
npx drizzle-kit generate --name init
```

Output on 0.31.10 (my run): `drizzle/0000_init.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`. Commit all three. The journal entry looks like `{ "idx": 0, "version": "7", "when": 1789519761460, "tag": "0000_init", "breakpoints": true }`.

Docs (source: `pg/drizzle-kit-generate.mdx`): generate "requires you to provide both dialect and schema path options". Migrations can be applied with `drizzle-kit migrate`, with drizzle-orm's `migrate()`, or by other tools.

Custom SQL migration (data fixes) (source: `drizzle-kit-generate.mdx`):

```shell
npx drizzle-kit generate --config=./configs/drizzle.config.ts --name=seed-users --custom
```

### 3.3 Apply with the CLI

```shell
npx drizzle-kit migrate
```

Docs (source: `drizzle-kit-migrate.mdx`): reads all `.sql` files in the folder, connects, reads the migrations log table, applies the missing ones, and records them. Requires `dialect` and `dbCredentials`.

### 3.4 Apply programmatically

Docs snippet (source: `tutorials/bun-railway-pg.mdx`, the form with config that matches 0.45.2):

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { usersTable } from "./schema";

const db = drizzle(process.env.DATABASE_URL!);

await migrate(db, { migrationsFolder: "./migrations" });
```

Installed signature (0.45.2, `node-postgres/migrator.d.ts` and `migrator.d.ts`):

```ts
migrate<TSchema>(db: NodePgDatabase<TSchema>, config: MigrationConfig): Promise<void>

interface MigrationConfig {
  migrationsFolder: string;
  migrationsTable?: string;
  migrationsSchema?: string;
}
```

Running `migrate()` twice is safe. My second call on an up-to-date database was a no-op.

### 3.5 Recommended pattern for the OpenShift container

Constraints: one replica, one process, image built from a Dockerfile, runbook-driven deploys. Two working options.

Option 1 (recommended): migrate as an explicit step, then start.

```json
{
  "scripts": {
    "build": "astro build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node ./scripts/migrate.mjs",
    "start": "node ./dist/server/entry.mjs"
  }
}
```

```js
// scripts/migrate.mjs  (plain Node, no drizzle-kit needed at runtime)
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const caFile = process.env.PG_CA_FILE;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: caFile ? { rejectUnauthorized: true, ca: readFileSync(caFile, 'utf8') } : undefined,
  max: 1,
});
const db = drizzle(pool);
await migrate(db, { migrationsFolder: './drizzle' });
await pool.end();
console.log('migrations applied');
```

Runbook: `oc run` or an OpenShift `Job` from the same image with command `npm run db:migrate`, wait for success, then roll out the Deployment. Or, simpler for this size, `oc exec` into the running pod after the rollout and run `npm run db:migrate`. Either way the migration fails loudly on its own before or apart from the web process, and startup stays fast.

Option 2: migrate at startup, chained in `start`.

```json
{ "scripts": { "start": "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs" } }
```

Astro docs (source: `guides/integrations-guide/node.mdx`) run the standalone server as `node ./dist/server/entry.mjs` with `HOST` and `PORT` env overrides, so chaining in `start` needs no custom wrapper. This is safe with one replica. With more than one replica two pods would race on the migrations table, and the Drizzle migrator does not document a lock. Nothing in this project assumes more than one process, so Option 2 is acceptable, but Option 1 keeps DDL rights out of the web process's normal path.

Dockerfile points:

- `drizzle-kit` is a dev dependency and is not needed at runtime. The migrator lives in `drizzle-orm`.
- Copy `drizzle/` (sql plus `meta/`) into the image next to `dist/`. `migrationsFolder: './drizzle'` is relative to the process cwd, so set `WORKDIR /app`.
- Bake or mount `global-bundle.pem` and set `PG_CA_FILE`.
- Astro docs (source: `guides/deploy/sevalla.mdx`) show `server: { host: true }` in `astro.config.mjs` so the server listens on all addresses in containers.

Write migrations to be backward compatible with the previous image (additive columns, no drops in the same release) so a rollback does not need a down migration. Drizzle has no down migrations.

## 4. Testing without a Postgres server: PGlite

### 4.1 Driver

Docs (source: `pg/connect-pglite.mdx`):

```ts
import { drizzle } from 'drizzle-orm/pglite';

const db = drizzle();

await db.select().from(...);
```

Docs (source: `latest-releases/drizzle-orm-v0306.mdx`):

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { users } from './schema';

// In-memory Postgres
const client = new PGlite();
const db = drizzle(client);

await db.select().from(users);
```

Installed signature (`pglite/driver.d.ts`, 0.45.2): `drizzle()`, `drizzle(client | string)`, `drizzle(client | string, config)`, `drizzle({ connection?: PGliteOptions & { dataDir?: string } | string, schema })`, `drizzle({ client, schema })`. Returns `PgliteDatabase<TSchema> & { $client: PGlite }`.

PGlite construction (source: pglite `docs/docs/api.md`):

```ts
import { PGlite } from '@electric-sql/pglite';

// With data directory
const pglite1 = await PGlite.create('file://./my-db');

// Without data directory (uses memory by default)
const pglite2 = await PGlite.create();

// With options
const pglite3 = await PGlite.create({ /* options */ });
```

`PGlite.create()` awaits `waitReady`, so the instance is initialized when it returns. `dataDir` accepts `file://` or an unprefixed path (Node), `idb://` (browser) and `memory://` (ephemeral). `close()` shuts the database down and frees the WASM runtime.

### 4.2 Migrator

`drizzle-orm/pglite/migrator` exists in the package exports (verified in `package.json` exports) with the same shape as node-postgres:

```ts
migrate<TSchema>(db: PgliteDatabase<TSchema>, config: MigrationConfig): Promise<void>
```

The same `drizzle/` folder generated for Postgres applied to PGlite without changes in my run.

### 4.3 One instance per test file

Vitest defaults to `isolate: true` and each file runs in its own worker (source: vitest `docs/config/isolate.md`). A module-level PGlite created in `beforeAll` is therefore private to the file.

```ts
// tests/db.test.ts
import { beforeAll, afterAll, test, expect } from 'vitest';
import { createPgliteDb, type DbHandle } from '../src/db/client';

let h: DbHandle;

beforeAll(async () => {
  h = await createPgliteDb();      // memory://
  await h.migrate();
});

afterAll(async () => {
  await h.close();
});

test('upsert progress', async () => {
  // use h.db
});
```

Vitest also documents a file-scoped fixture (source: `docs/guide/test-context.md`):

```ts
const test = baseTest
  .extend('database', { scope: 'file' }, async ({}, { onCleanup }) => {
    const db = await createDatabase()
    onCleanup(() => db.close())
    return db
  })

test('first test', ({ database }) => {
  // Uses the same database instance
})
```

PGlite is single-connection (source: pglite.dev docs). Do not share one instance across concurrently running files in the same worker. Per-file instances avoid this. Startup cost is a WASM boot per file. If that becomes slow, PGlite offers a pre-populated filesystem snapshot (`loadDataDir`), documented for Vitest in `docs/docs/prepopulatedfs.md`.

### 4.4 Feature support, verified by running against PGlite 0.5.8

| Feature | Result |
| --- | --- |
| `CREATE TYPE ... AS ENUM` and enum column default | Works. Inserting a value outside the enum fails with a query error. |
| `jsonb` with `.$type<T>()`, `DEFAULT '{}'::jsonb` | Works. Objects round-trip as parsed objects. |
| `timestamp with time zone`, `DEFAULT now()` | Works. Values come back as JS `Date`. |
| `GENERATED ALWAYS AS IDENTITY` | Works. |
| `REFERENCES ... ON DELETE cascade` | Works. Deleting a user removed rows in all six child tables. |
| `CREATE UNIQUE INDEX` on two columns and `ON CONFLICT DO UPDATE` against it | Works. |
| `db.transaction`, `tx.rollback()`, nested `tx.transaction` (savepoint) | Works. Rollback throws `TransactionRollbackError`. Nested rollback kept the outer insert. |
| `migrate()` twice | Second run is a no-op. |
| `drizzle-kit migrate` with `driver: 'pglite'` against a file dataDir | Works. |

### 4.5 Local dev without DATABASE_URL

drizzle-kit can target PGlite directly (source: `pg/drizzle-kit-pull.mdx`):

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    // inmemory
    url: ":memory:"

    // or database folder
    url: "./database/"
  },
});
```

Verified: with `driver: 'pglite'` and `dbCredentials: { url: './.pglite-dev' }`, `npx drizzle-kit migrate --config drizzle.pglite.config.ts` applied the same migrations to a file-backed PGlite. For the app itself the factory in section 6 migrates on boot when `DATABASE_URL` is absent, so drizzle-kit is not required for local dev. Add `.pglite-dev/` to `.gitignore`.

PGlite file storage is only for Node and Bun (`file://` or an unprefixed path). Only one process can open a data directory at a time, so stop the dev server before running drizzle-kit against the same folder.

## 5. Transactions, upserts, cascades, returning

### 5.1 Transactions

Docs (source: `pg/transactions.mdx`):

```ts
await db.transaction(
  async (tx) => {
    await tx.update(accounts).set({ balance: sql`${accounts.balance} - 100.00` }).where(eq(users.name, "Dan"));
    await tx.update(accounts).set({ balance: sql`${accounts.balance} + 100.00` }).where(eq(users.name, "Andrew"));
  }, {
    isolationLevel: "read committed",
    accessMode: "read write",
    deferrable: true,
  }
);

interface PgTransactionConfig {
  isolationLevel?:
    | "read uncommitted"
    | "read committed"
    | "repeatable read"
    | "serializable";
  accessMode?: "read only" | "read write";
  deferrable?: boolean;
}
```

Rollback (source: `transactions.mdx`):

```ts
await db.transaction(async (tx) => {
  const [account] = await tx.select({ balance: accounts.balance }).from(accounts).where(eq(users.name, 'Dan'));
  if (account.balance < 100) {
    // This throws an exception that rollbacks the transaction.
    tx.rollback()
  }
  await tx.update(accounts).set({ balance: sql`${accounts.balance} - 100.00` }).where(eq(users.name, 'Dan'));
  await tx.update(accounts).set({ balance: sql`${accounts.balance} + 100.00` }).where(eq(users.name, 'Andrew'));
});
```

Nested transactions use savepoints (source: `transactions.mdx`):

```ts
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql`${accounts.balance} - 100.00` }).where(eq(users.name, 'Dan'));
  await tx.update(accounts).set({ balance: sql`${accounts.balance} + 100.00` }).where(eq(users.name, 'Andrew'));

  await tx.transaction(async (tx2) => {
    await tx2.update(users).set({ name: "Mr. Dan" }).where(eq(users.name, "Dan"));
  });
});
```

Type facts (from `pg-core/db.d.ts` and `pg-core/session.d.ts`): `transaction<T>(fn: (tx: PgTransaction<...>) => Promise<T>, config?: PgTransactionConfig): Promise<T>`, and `PgTransaction extends PgDatabase`. A helper that takes `PgDatabase` accepts both `db` and `tx`.

Throwing any error inside the callback rolls back. `tx.rollback()` throws `TransactionRollbackError`, so catch it if the rollback is expected.

### 5.2 Upsert

Docs (source: `guides/upsert.mdx`), composite target:

```ts
import { sql } from 'drizzle-orm';
import { inventory } from './schema';

await db
  .insert(inventory)
  .values({ warehouseId: 1, productId: 1, quantity: 100 })
  .onConflictDoUpdate({
    target: [inventory.warehouseId, inventory.productId], // composite primary key
    set: { quantity: sql`${inventory.quantity} + 100` }, // add 100 to the existing quantity
  });
```

Using `excluded` to take the proposed row's value (source: `guides/upsert.mdx`):

```ts
await db
  .insert(users)
  .values(values)
  .onConflictDoUpdate({
    target: users.id,
    set: { lastLogin: sql.raw(`excluded.${users.lastLogin.name}`) },
  });
```

Conditional update with `setWhere` (source: `guides/upsert.mdx`):

```ts
await db
  .insert(products)
  .values(data)
  .onConflictDoUpdate({
    target: products.id,
    set: {
      price: excludedPrice,
      stock: excludedStock,
      lastUpdated: sql.raw(`excluded.${products.lastUpdated.name}`)
    },
    setWhere: or(
      sql`${products.stock} != ${excludedStock}`,
      sql`${products.price} != ${excludedPrice}`
    ),
  });
```

Do nothing (source: `insert.mdx`):

```ts
await db.insert(users)
  .values({ id: 1, name: 'John' })
  .onConflictDoNothing();

// explicitly specify conflict target
await db.insert(users)
  .values({ id: 1, name: 'John' })
  .onConflictDoNothing({ target: users.id });
```

### 5.3 returning

Docs (source: `insert.mdx`, `update.mdx`, `delete.mdx`):

```ts
await db.insert(users).values({ name: "Dan" }).returning();

// partial return
await db.insert(users).values({ name: "Partial Dan" }).returning({ insertedId: users.id });
```

```ts
const updatedUserId = await db.update(users).set({ name: "Mr. Dan" }).where(eq(users.name, "Dan")).returning({ updatedId: users.id });
```

```ts
const deletedUser = await db.delete(users)
  .where(eq(users.name, 'Dan'))
  .returning();

// partial return
const deletedUserId = await db.delete(users)
  .where(eq(users.name, "Dan"))
  .returning({ deletedId: users.id });
```

`returning()` always yields an array. Destructure `const [row] = await ...` for single-row writes.

### 5.4 Verified Action-shaped helpers for this project

These ran against PGlite with the section 2 schema. `Db` is the shared type from section 6.

```ts
import { eq, sql, desc } from 'drizzle-orm';
import type { Db } from './db/client';
import { user, moduleProgress, workshopResponse, selfCheckResult, selfAssessment, notifySubscriber } from './db/schema';

// module_progress: one row per user+module, upsert by the unique index
export async function upsertProgress(db: Db, userId: string, moduleSlug: string, status: 'in_progress' | 'completed') {
  const now = new Date();
  const [row] = await db.insert(moduleProgress)
    .values({ userId, moduleSlug, status, startedAt: now, completedAt: status === 'completed' ? now : null })
    .onConflictDoUpdate({
      target: [moduleProgress.userId, moduleProgress.moduleSlug],
      set: { status, completedAt: status === 'completed' ? now : null },
    })
    .returning();
  return row;
}

// workshop_response: overwrite body, updated_at bumps through $onUpdate
export async function saveWorkshopResponse(db: Db, userId: string, moduleSlug: string, body: string) {
  const [row] = await db.insert(workshopResponse)
    .values({ userId, moduleSlug, body })
    .onConflictDoUpdate({
      target: [workshopResponse.userId, workshopResponse.moduleSlug],
      set: { body: sql`excluded.body` },
    })
    .returning({ id: workshopResponse.id, updatedAt: workshopResponse.updatedAt });
  return row;
}

// self_check_result: increment attempts on the existing row, replace answers
export async function recordSelfCheck(db: Db, userId: string, moduleSlug: string, passed: boolean, answers: Record<string, string | string[]>) {
  const [row] = await db.insert(selfCheckResult)
    .values({ userId, moduleSlug, attempts: 1, passed, answers })
    .onConflictDoUpdate({
      target: [selfCheckResult.userId, selfCheckResult.moduleSlug],
      set: { attempts: sql`${selfCheckResult.attempts} + 1`, passed, answers },
    })
    .returning();
  return row;
}

// self_assessment: append a new version inside one transaction
export async function saveAssessment(db: Db, userId: string, input: { ratings: Record<string, number>; context: object; plan: { focus: string[]; nextModules: string[] } }) {
  return db.transaction(async (tx) => {
    const [latest] = await tx.select({ version: selfAssessment.version }).from(selfAssessment)
      .where(eq(selfAssessment.userId, userId)).orderBy(desc(selfAssessment.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    const [row] = await tx.insert(selfAssessment)
      .values({ userId, version, ratings: input.ratings, context: input.context, plan: input.plan })
      .returning({ id: selfAssessment.id, version: selfAssessment.version });
    return row;
  });
}

// notify_subscriber: idempotent signup, unconfirmed
export async function subscribe(db: Db, email: string, token: string) {
  await db.insert(notifySubscriber).values({ email, token }).onConflictDoNothing();
}

// account deletion: one transaction, FKs cascade to every app table plus session and account
export async function deleteAccount(db: Db, userId: string) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
    return deleted ?? null;
  });
}
```

Observed results: repeated upserts returned the same `id`; `completedAt` came back as a `Date`; `attempts` went 1 to 2; `updatedAt` on `workshop_response` moved forward on the upsert without being listed in `set`; after `deleteAccount` the counts in `module_progress`, `workshop_response`, `self_check_result`, `self_assessment`, `session` and `account` were all zero.

Better Auth note: Better Auth has its own user deletion flow. Whether you delete through it or through Drizzle, the database cascades are what remove the app rows. Confirm in the auth research which path to expose. (UNVERIFIED here.)

## 6. One Db type for Actions, two drivers behind it

### 6.1 The type

Both drivers extend the same base class. From the installed d.ts (0.45.2):

```ts
// drizzle-orm/node-postgres/driver.d.ts
export declare class NodePgDatabase<TSchema extends Record<string, unknown> = Record<string, never>>
  extends PgDatabase<NodePgQueryResultHKT, TSchema> {}

// drizzle-orm/pglite/driver.d.ts
export declare class PgliteDatabase<TSchema extends Record<string, unknown> = Record<string, never>>
  extends PgDatabase<PgliteQueryResultHKT, TSchema> {}

// drizzle-orm/pg-core/db.d.ts
export declare class PgDatabase<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>
> { ... }
```

So the shared type is:

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
```

Verified with `tsc --strict` (`moduleResolution: "bundler"`, `"type": "module"`):

- `NodePgDatabase<Schema>` is assignable to `Db`.
- `PgliteDatabase<Schema>` is assignable to `Db`.
- Inside `db.transaction(async (tx) => ...)` the `tx` is assignable to `Db`, so helpers typed on `Db` accept a transaction.
- `db.query.moduleProgress.findMany({ where: eq(...), columns: {...} })` works through `Db` because the schema generic carries the tables.
- A union `NodePgDatabase<Schema> | PgliteDatabase<Schema>` also typechecked, including a `transaction` call. The base-class form is simpler and is the one to use.

One real limitation: `db.execute(...)` on `Db` resolves to `unknown`, because the result type comes from the driver's `PgQueryResultHKT`. With node-postgres it is a pg `QueryResult` with `.rows`; with PGlite it is a PGlite `Results` with `.rows`. Prefer the query builder in Actions. If raw SQL is needed, cast: `(await db.execute(q)) as { rows: Row[] }`. Both drivers put rows on `.rows` (observed in my run for PGlite; pg's `QueryResult.rows` is its documented shape).

Type pitfall I hit: with `moduleResolution: "NodeNext"` in a CommonJS package, a static `import type ... from 'drizzle-orm/pg-core'` resolved to `.d.cts` while a dynamic `import('drizzle-orm/node-postgres')` resolved to `.d.ts`. tsc then reported "Two different types with this name exist, but they are unrelated" on `ExtractTablesWithRelations`. An Astro project is `"type": "module"` with bundler resolution, and there the same code typechecks clean. Keep all Drizzle imports in one module system.

### 6.2 The factory (verified compile and runtime)

```ts
// src/db/client.ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

// Resolves to <project>/drizzle at runtime. In the container this is /app/drizzle.
const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;

export async function createPgDb(databaseUrl: string, ca?: string): Promise<DbHandle> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: ca ? { rejectUnauthorized: true, ca } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => { console.error('pg pool idle client error', err); });
  const db = drizzle(pool, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

export async function createPgliteDb(dataDir?: string): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = await PGlite.create(dataDir ?? 'memory://');
  const db = drizzle(client, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.close(),
  };
}

export function createDb(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url) return createPgDb(url, process.env.PG_CA_CERT);
  return createPgliteDb(process.env.PGLITE_DATA_DIR);
}
```

Notes on the factory:

- Dynamic imports keep `pg` out of the test bundle and `@electric-sql/pglite` out of the production bundle. Both are still listed in `package.json` (pg as a dependency, pglite as a dev dependency). In production the pglite branch is never reached. If the bundler still tries to resolve `@electric-sql/pglite` in the prod build, mark it external in `vite.ssr.external` (UNVERIFIED for Astro 7, check during Phase 1).
- `PG_CA_CERT` holds PEM text. The runbook can instead set `PG_CA_FILE` and have the factory `readFileSync` it. Pick one and keep it.
- `PGLITE_DATA_DIR=./.pglite-dev` gives a persistent local database. Unset it for a throwaway in-memory one.
- Better Auth receives `handle.db`. The adapter needs the concrete driver instance, and `Db` is the base class, so pass `handle.db` as is. `drizzleAdapter(db, { provider: 'pg', schema })` typechecks against the base class per the Better Auth signature shown in section 2.2 (UNVERIFIED with tsc; check in Phase 1).

### 6.3 One instance for the Astro server, used from Actions

```ts
// src/db/index.ts
import { createDb, type DbHandle } from './client';

const g = globalThis as unknown as { __dbHandle?: Promise<DbHandle> };

export function getDb(): Promise<DbHandle> {
  // Survives Vite HMR re-evaluation in dev. Harmless in prod.
  g.__dbHandle ??= createDb().then(async (h) => {
    if (!process.env.DATABASE_URL) await h.migrate();   // PGlite dev path only. Prod migrates per section 3.5.
    return h;
  });
  return g.__dbHandle;
}
```

```ts
// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { getDb } from '../db';
import { upsertProgress } from '../db/queries';

export const server = {
  markComplete: defineAction({
    input: z.object({ moduleSlug: z.string() }),
    handler: async ({ moduleSlug }, ctx) => {
      const { db } = await getDb();
      const userId = ctx.locals.user.id;          // set by the auth middleware
      return upsertProgress(db, userId, moduleSlug, 'completed');
    },
  }),
};
```

The Actions snippet above is illustrative only. `astro:actions` and `astro:schema` import paths and the `ctx.locals` shape belong to the Astro research and are UNVERIFIED here.

Environment. Astro docs (source: `guides/integrations-guide/node.mdx`): "When using the astro:env secrets or process.env at runtime, neither Astro nor the adapter loads environment variables for you." OpenShift injects env from the Deployment, so `process.env.DATABASE_URL` is set at runtime. For type-safe access you can declare it (source: `guides/environment-variables.mdx`):

```js
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_URL: envField.string({ context: "client", access: "public", optional: true }),
      PORT: envField.number({ context: "server", access: "public", default: 4321 }),
      API_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
})
```

Declare `DATABASE_URL` as `envField.string({ context: "server", access: "secret", optional: true })` so the PGlite path stays possible, and read it with `getSecret("DATABASE_URL")` or `process.env`. `drizzle.config.ts` and `scripts/migrate.mjs` run outside Astro and only see `process.env`. Node 24 can load a local `.env` with `node --env-file=.env` (Node feature, not from the docs fetched here, UNVERIFIED).

Shutdown: register once in the server entry or in `getDb()`:

```ts
process.once('SIGTERM', async () => { const h = await getDb(); await h.close(); process.exit(0); });
```

## 7. Package manifest for Phase 1

```json
{
  "dependencies": {
    "drizzle-orm": "0.45.2",
    "pg": "8.23.0",
    "better-auth": "1.7.5",
    "@better-auth/drizzle-adapter": "1.7.5"
  },
  "devDependencies": {
    "drizzle-kit": "0.31.10",
    "@types/pg": "8.23.1",
    "@electric-sql/pglite": "0.5.8",
    "vitest": "5.0.1"
  }
}
```

`@electric-sql/pglite` is 25.4 MB unpacked and ships a Postgres WASM build. It needs approval as a dev dependency. It is never imported on the production path when `DATABASE_URL` is set.

## 8. Open items and unverified points

- Better Auth default-entry `drizzleAdapter` options (`schema`, `usePlural`, `schemaName`) beyond what the snippets show. The 1.7 rc blog snippet shows `schema` on the relations-v2 entry. Confirm on the default entry.
- Whether `drizzleAdapter` accepts a `PgDatabase` base type or needs the concrete `NodePgDatabase`. If it needs the concrete type, keep the handle's concrete instance in a second field and pass that.
- Astro 7 bundling of a dynamic `import('@electric-sql/pglite')` in the production build. May need `vite.ssr.external`.
- `primaryKey()` call signature for a composite key alternative. Not needed if the identity plus unique index design stands.
- `astro:actions` details and `ctx.locals` shape belong to the Astro research.
- Node `--env-file` for local `.env` loading.
- Migration locking across replicas. Not needed with one replica. Revisit if the Deployment ever scales past one.

