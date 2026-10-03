# syntax=docker/dockerfile:1
# Build: docker build --build-arg SITE_URL=https://<public-host> --build-arg FEATURE_ACCOUNTS=true -t aie .
# SITE_URL, FEATURE_ACCOUNTS, and PREVIEW_DRAFTS are baked in at build time (astro:env public
# server variables). PREVIEW_DRAFTS is never set here. Everything else is read at runtime from
# the container environment (astro:env secrets) and comes from the OpenShift Secret or the ENV below.
# Blueprint section 13.1. Validated by reading against docs/research/astro7.md 1.4 and 1.5 and by the CI
# smoke test in .github/workflows/ci.yml; Docker is not installed on the dev machine.
# The base image is pinned to the digest of the multi-arch index for node:24-slim (Node 24.21.0,
# resolved 2026-10-03 from the Docker Hub registry API), so two builds of one commit get one base and an
# upstream tag change never flows in unreviewed. Refresh the digest with the annual upgrade (runbook
# step 12) or when a Node security release lands; both FROM lines carry the same digest.
FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG SITE_URL=http://localhost:4321
ARG FEATURE_ACCOUNTS=true
ENV SITE_URL=$SITE_URL \
    FEATURE_ACCOUNTS=$FEATURE_ACCOUNTS
COPY . .
RUN npm run build

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runtime
WORKDIR /app
# Runtime environment. PG_CA_FILE is read at runtime by src/lib/env.ts (a secret-class variable).
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    PG_CA_FILE=/app/certs/rds-global-bundle.pem \
    BETTER_AUTH_TELEMETRY=0
COPY package.json package-lock.json ./
# --omit=optional: npm keeps a package marked devOptional in the lockfile when only dev is omitted, and
# drizzle-orm lists @electric-sql/pglite as an optional peer while better-auth lists drizzle-kit and vitest
# the same way, so `--omit=dev` alone shipped the embedded database, the migration tool, and the test runner
# (about 150 MB) in the runtime image, and a pod without DATABASE_URL stored addresses in memory. With
# optional packages omitted the install has no pglite, no drizzle-kit, no vitest, and no sharp; the site
# serves SVG only and uses no astro:assets image, so the /_image endpoint is the one thing that would fail
# if an <Image> were ever added. src/db/index.ts fails closed as well (docs/decisions.md, 2026-10-03).
# --ignore-scripts: the only production package with an install script is esbuild (vite's dependency,
# build time only); the server never runs it, and a lifecycle script is one less thing a compromised
# package could run in the image. Verified 2026-10-03: a runtime-only install without optional packages and
# without scripts serves /healthz and the pages, and answers the notify form with a 503 when DATABASE_URL is
# unset (docs/decisions.md).
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY scripts/migrate.mjs scripts/tls-check.mjs ./scripts/
COPY certs/rds-global-bundle.pem ./certs/rds-global-bundle.pem
# Nothing writes under /app at runtime. Files stay world-readable (npm ci defaults), so an
# arbitrary OpenShift UID can read them; no group-write grant is needed or given.
# HOME points at /tmp, the emptyDir the Deployment mounts, so `npm run db:migrate` and
# `npm run db:tls-check` can write npm's log files under an arbitrary UID on a read-only root filesystem.
ENV HOME=/tmp
USER 1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
