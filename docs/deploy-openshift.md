# Deploy to OpenShift

The runbook for running the site as one container image on OpenShift with PostgreSQL on AWS RDS. Blueprint section 13.3 is the outline; this file is the version to follow and the place to record what was done. Every step runs from a machine with `oc` logged in. Docker, `psql`, and `oc` are absent on the dev machine, so the image is built by CI or by an OpenShift BuildConfig, never locally.

Names used below: project `aie`, Secret `aie-env`, Deployment `aie`, Service `aie`, Route `aie`, image `becoming-an-aie`. Replace `<host>` with the final public hostname (open item 1 in `docs/decisions.md`) and `<image>` with the image reference from step 3.

## 0. Two kinds of configuration

The site reads configuration two ways (blueprint decision 1). Getting this wrong is the most likely deploy mistake.

| Kind | Variables | Where they are set | What happens if set in the wrong place |
|---|---|---|---|
| Build-time constants (astro:env public) | `SITE_URL`, `FEATURE_ACCOUNTS`, `PREVIEW_DRAFTS` | Docker build arguments. `astro build` inlines them into `dist/server`. | A value in the Secret or the Deployment is ignored. |
| Runtime values (astro:env secret) | `BETTER_AUTH_URL`, `EMAIL_PROVIDER`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NOTIFY_TOKEN_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Secret `aie-env`, read when the process starts. | A build argument does nothing for these. |
| Set by the image | `HOST=0.0.0.0`, `PORT=8080`, `PG_CA_FILE=/app/certs/rds-global-bundle.pem`, `BETTER_AUTH_TELEMETRY=0`, `NODE_ENV=production`, `HOME=/tmp` | `Dockerfile` | Do not repeat them in the Secret. |

`SITE_URL` must equal the Route origin (`https://<host>`). It sets `security.allowedDomains`, which makes Astro honor `X-Forwarded-Proto` and `X-Forwarded-For` behind the edge route. Without it every action POST fails the origin check with 403 and rate limiting keys on the router address. `FEATURE_ACCOUNTS=false` only for the Phase 0 image. `PREVIEW_DRAFTS` is never set for an image.

## 1. Prerequisites

1. `oc` logged in to the cluster with rights to create a project, or an existing project.
2. An RDS PostgreSQL instance: class `db.t4g.micro`, single AZ, 20 GB gp3, automated backups on. Its security group allows ingress from the cluster's egress addresses. The parameter group sets `rds.force_ssl = 1`. The database user has `CREATE` on the database, because the migrator creates the `drizzle` schema for its migrations table. Connect by the RDS endpoint hostname, never by IP, so hostname verification matches the certificate.
3. The two OAuth registrations (step 8). Not needed for the Phase 0 image, which is built with `FEATURE_ACCOUNTS=false`.
4. The final hostname and a DNS record pointing at the cluster's router.
5. Log retention for the namespace known (step 11).
6. Values for the runtime secrets: `openssl rand -base64 32` twice, for `BETTER_AUTH_SECRET` and `NOTIFY_TOKEN_SECRET`. Both must be at least 32 characters.

## 2. Project and secrets

```sh
oc new-project aie
# .env.prod holds runtime values only, one NAME=value per line. Never commit it.
oc create secret generic aie-env --from-env-file=.env.prod
```

`.env.prod` for the Phase 0 image:

```
BETTER_AUTH_URL=https://<host>
EMAIL_PROVIDER=none
DATABASE_URL=postgres://<user>:<password>@<rds-endpoint>:5432/<database>
BETTER_AUTH_SECRET=<32+ characters>
NOTIFY_TOKEN_SECRET=<32+ characters>
```

Before the Phase 1 rollout add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and recreate the Secret (`oc delete secret aie-env`, then the `oc create secret` line again) and restart the pods with `oc rollout restart deploy/aie` so the process reads the new values. Rules:

- `DATABASE_URL` carries no `sslmode`, `sslrootcert`, `sslcert`, or `sslkey` parameter. The pool refuses such a URL. TLS is configured through `PG_CA_FILE`, which the image sets.
- Do not put `SITE_URL`, `FEATURE_ACCOUNTS`, or `PREVIEW_DRAFTS` in the Secret. They are build arguments and a runtime value is ignored.
- Do not put `PG_CA_FILE`, `HOST`, `PORT`, or `BETTER_AUTH_TELEMETRY` in the Secret. They come from the image.
- `/readyz` returns 503 and logs the missing names when a required value is absent. With `FEATURE_ACCOUNTS=true` the five auth values are required too.

## 3. Image

Path A, CI (default once the registry is confirmed, open item 3). `.github/workflows/ci.yml` builds the image from the `Dockerfile` on every push and pull request and smoke tests it, but pushes nowhere until the author confirms the registry. When GHCR is confirmed, add a `docker/login-action` step and set `push: true` with the tags `ghcr.io/<owner>/becoming-an-aie:<sha>` and `:latest`; the build arguments come from the repository variables `SITE_URL` and `FEATURE_ACCOUNTS`. Then:

```sh
# Only if the package is private.
oc create secret docker-registry ghcr --docker-server=ghcr.io --docker-username=<github-user> --docker-password=<token-with-read:packages>
oc secrets link default ghcr --for=pull
```

The image reference is `ghcr.io/<owner>/becoming-an-aie:<sha>`.

Path B, an OpenShift BuildConfig from the Dockerfile. Run from a clean clone of the phase commit so nothing untracked is uploaded; the build applies `.dockerignore`.

```sh
oc new-build --strategy=docker --binary --name=aie
oc start-build aie --from-dir=. --follow \
  --build-arg SITE_URL=https://<host> \
  --build-arg FEATURE_ACCOUNTS=false
```

The image reference is `image-registry.openshift-image-registry.svc:5000/aie/aie:latest`. Tag each phase build (`oc tag aie/aie:latest aie/aie:phase-0`) so a rollback has a name to go back to.

Record here which path produced each deployed image, with the build arguments used.

| Date | Phase | Path | SITE_URL | FEATURE_ACCOUNTS | Image reference |
|---|---|---|---|---|---|
| | | | | | |

## 4. Migrations, before every rollout

Migrations run as a Job from the same image before the Deployment moves to it (blueprint section 5.5). Never at container start.

```yaml
# migrate-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: aie-migrate-<sha>
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 86400
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: <image>
          command: ["npm", "run", "db:migrate"]
          envFrom:
            - secretRef:
                name: aie-env
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
            runAsNonRoot: true
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

```sh
oc apply -f migrate-job.yaml
oc wait --for=condition=complete job/aie-migrate-<sha> --timeout=300s
oc logs job/aie-migrate-<sha>
# expect: migrations applied
oc delete job aie-migrate-<sha>
```

One-liner alternative: `oc run aie-migrate-<sha> --image=<image> --restart=Never --env-from=secret/aie-env --command -- npm run db:migrate`, then `oc logs -f pod/aie-migrate-<sha>` and `oc delete pod aie-migrate-<sha>`.

Fallback after a rollout: `oc exec deploy/aie -- npm run db:migrate`.

The migrate script refuses a plaintext connection in production, so a missing `PG_CA_FILE` fails here first, before the web process is touched. Migrations are additive (add columns with defaults, never drop or rename in the same release), so release N minus 1 keeps running against the schema of release N.

## 5. Deployment

One replica, one process: the rate limiter is in memory. The runtime image installs no optional packages, so PGlite is absent from it, and `getDb()` refuses the embedded database in production unless `PGLITE_DATA_DIR` is set on purpose (`docs/decisions.md`, 2026-10-03). `Recreate` guarantees two pods never run at once.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aie
  labels:
    app: aie
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: aie
  template:
    metadata:
      labels:
        app: aie
    spec:
      containers:
        - name: web
          image: <image>
          ports:
            - containerPort: 8080
              name: http
          envFrom:
            - secretRef:
                name: aie-env
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              memory: 1Gi
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 30
          # restricted-v2 supplies the last three; stated anyway so the intent is in the manifest.
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
            runAsNonRoot: true
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

```sh
oc apply -f deployment.yaml
oc rollout status deploy/aie
```

Nothing writes to the filesystem at runtime (`session: false`; PGlite is not installed, and production refuses it without `PGLITE_DATA_DIR`). `/tmp` is the only writable path; the image sets `HOME=/tmp` so `npm run` can write its logs there under the arbitrary UID OpenShift assigns. To move to a new image: `oc set image deploy/aie web=<image>` after step 4.

## 6. Service and Route

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: aie
spec:
  selector:
    app: aie
  ports:
    - name: http
      port: 8080
      targetPort: http
```

```yaml
# route.yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: aie
  annotations:
    # The router replaces any X-Forwarded-* header a client sent. Astro takes the leftmost
    # X-Forwarded-For value as the client address, which is the rate-limit key.
    haproxy.router.openshift.io/set-forwarded-headers: replace
    haproxy.router.openshift.io/hsts_header: max-age=31536000;includeSubDomains
spec:
  host: <host>
  to:
    kind: Service
    name: aie
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
  # Response headers for every path, including prerendered pages that never pass through the
  # middleware (OpenShift 4.14 or later).
  httpHeaders:
    actions:
      response:
        - name: X-Content-Type-Options
          action:
            type: Set
            set:
              value: nosniff
        - name: X-Frame-Options
          action:
            type: Set
            set:
              value: DENY
        - name: Referrer-Policy
          action:
            type: Set
            set:
              value: strict-origin-when-cross-origin
        - name: Permissions-Policy
          action:
            type: Set
            set:
              value: "camera=(), microphone=(), geolocation=()"
```

```sh
oc apply -f service.yaml -f route.yaml
```

No other proxy sits in front of the router. If one appears later, revisit `set-forwarded-headers`: `replace` would then discard the trusted proxy's header and every client would share that proxy's address. A Content-Security-Policy is deferred (blueprint decision 38).

## 7. Verify

```sh
curl -I https://<host>/
# 200, plus X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security
curl https://<host>/healthz
# {"ok":true}
curl https://<host>/readyz
# {"ok":true}; on 503 read `oc logs deploy/aie` for the missing names or the database error
oc exec deploy/aie -- npm run db:tls-check
# tls-check: ok (TLSv1.3) or TLSv1.2
curl -I https://<host>/sign-in
# Phase 0 image: 404. Phase 1 onward: 200.
curl -I https://<host>/account
# Phase 0 image: 404. Phase 1 onward: 302 to /sign-in?next=... with Cache-Control: private, no-store
```

Phase 1 onward: sign in with each provider, then check the response headers on the deployed site for `Secure; HttpOnly; SameSite=Lax` on the session cookie, and confirm the deletion response carries expiring `Set-Cookie` headers for both session cookie names with `Secure` on the `__Secure-` name.

TLS to RDS is verified two ways: `db:tls-check` proves the pool negotiated TLS from inside the pod, and `scripts/migrate.mjs` refuses to run without `PG_CA_FILE` in production. `rds.force_ssl = 1` on the instance refuses plaintext from the server side as well.

## 8. OAuth callback URL registration

Phase 1 onward. Better Auth's callback path is `/api/auth/callback/<provider>`, resolved against `BETTER_AUTH_URL`.

- GitHub: an OAuth App (not a GitHub App) with Authorization callback URL `https://<host>/api/auth/callback/github`. Copy the client id and generate a client secret.
- Google: a Web application OAuth client in Google Cloud with Authorized redirect URI `https://<host>/api/auth/callback/google`. Add `https://<host>` to Authorized JavaScript origins. Copy the client id and secret.

Put the four values in `.env.prod`, recreate the Secret (step 2), and roll the Deployment (`oc rollout restart deploy/aie`) so the process reads them. `BETTER_AUTH_URL` must be `https://<host>`; that makes the session cookie `Secure`. Register the callback URLs before the Phase 1 gate; a mismatch shows as a provider-side redirect error, not as a site error.

## 9. Phase 0 gate on the deployed image

The record lives in `docs/gates.md`. The steps, in order:

1. Confirm the deployed image was built with `SITE_URL=https://<host>` and `FEATURE_ACCOUNTS=false` (the table in step 3).
2. `curl -I https://<host>/sign-in` is 404.
3. `curl https://<host>/readyz` is `{"ok":true}`.
4. `oc exec deploy/aie -- npm run db:tls-check` prints `tls-check: ok`.
5. Subscribe on the deployed site with a real address and land on `/notify/thanks`.
6. Read the confirm and unsubscribe URLs from the pod log. The no-op mailer writes one line per subscribe:

```sh
oc logs deploy/aie | grep 'mailer:noop'
# [mailer:noop] kind=confirm to=<address> confirm=https://<host>/notify/confirm?token=... unsubscribe=https://<host>/notify/unsubscribe?token=...
```

7. Open the confirm URL and see the confirmed page. Then check the row (CG-28). `psql` is not on the dev machine; the image has `pg`, so query from the pod:

```sh
oc exec deploy/aie -- node -e "
const { readFileSync } = require('node:fs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.PG_CA_FILE, 'utf8') }, max: 1 });
pool.query('select email, created_at, confirmed_at, unsubscribed_at from notify_subscriber order by created_at desc limit 5')
  .then((r) => { console.table(r.rows); return pool.end(); });
"
```

   `confirmed_at` is set and `unsubscribed_at` is null.

8. Open the unsubscribe URL and see the unsubscribed page. Run the query again: `unsubscribed_at` is set.
9. Open the confirm URL from step 6 again. It shows the generic page, and the row does not change (replay protection, decision 10).
10. Privacy notice reviewed at `https://<host>/privacy`, with the contact address filled in (open item 11) and the log retention number matching step 11.

## 10. Rollback

```sh
oc rollout undo deploy/aie
oc rollout status deploy/aie
```

Migrations are additive, so the previous image runs against the newer schema. No down migration exists or is needed.

## 11. Logs and privacy

The no-op mailer writes subscriber addresses to stdout (step 9). Configure or confirm log retention at or under 30 days for this namespace: the privacy notice states "at most 30 days". If the cluster's logging stack keeps logs longer, either shorten it for this project or change the notice, and record the number here before the Phase 0 gate (blueprint decision 41, open item 14).

Retention confirmed: `<number> days` on `<date>` by `<name>`.

No analytics, no third-party requests. `/readyz` never returns the missing names or the database error in the body; they go to the log.

## 12. Annual upgrade and the CA bundle

Astro ships one major per year. Pin exact versions, upgrade once a year in a dedicated commit, run the full CI, redeploy.

The `Dockerfile` pins `node:24-slim` to the digest of its multi-arch index (`@sha256:...` on both `FROM` lines). A build then resolves to one base image, and an upstream tag change never flows in unreviewed. The cost is that Node security releases do not arrive on their own. Refresh the digest with the annual upgrade and whenever Node 24 publishes a security release:

1. Read the index digest. On a machine with Docker: `docker buildx imagetools inspect node:24-slim`. Without Docker, use the registry API: `GET https://registry-1.docker.io/v2/library/node/manifests/24-slim` with a pull token and `Accept: application/vnd.oci.image.index.v1+json`, then read the `Docker-Content-Digest` header.
2. Replace the digest on both `FROM` lines.
3. Record the date, digest, Node version, and your name in the table below.
4. Run the full CI.

| Date | Digest | Node | By |
|---|---|---|---|
| 2026-10-03 | `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` | 24.21.0 | integrator |

`certs/rds-global-bundle.pem` is the public AWS RDS global CA bundle (root CAs only, which is what AWS says to register). It is committed and copied into the image at `/app/certs/rds-global-bundle.pem`.

- Source: `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`
- Downloaded: 2026-09-16 (F, with `curl -fsSL`)
- SHA-256: `e5bb2084ccf45087bda1c9bffdea0eb15ee67f0b91646106e466714f9de3c7e3`
- Contents: 108 certificates

Refresh it once a year with the annual upgrade, or sooner when AWS announces a CA rotation for the instance's region: download again, record the new date and SHA-256 here, rebuild the image, run step 7. If `db:tls-check` starts failing with a certificate error, this is the first thing to refresh.

| Date | SHA-256 | By |
|---|---|---|
| 2026-09-16 | `e5bb2084ccf45087bda1c9bffdea0eb15ee67f0b91646106e466714f9de3c7e3` | F |

## 13. Deferred work

- Email provider: confirmed opt-in, the launch notification, and the retry queue when `send` fails (EC-5.1.3). Today the no-op mailer never fails, and a rejecting mailer is swallowed and logged.
- POST pages for both token routes. `/notify/confirm` and `/notify/unsubscribe` act from their frontmatter (`Astro.callAction`), so they change the row on any method Astro routes to the page: GET, HEAD, and OPTIONS alike. Accepted while no mail is sent. Once mail goes out, link scanners and prefetchers issue GET and HEAD and would confirm, or unsubscribe, recipients who never clicked. Both pages then render a POST button instead. RFC 8058 one-click unsubscribe is a POST too, so GET has no reason to stay (`src/lib/notify.ts`; `docs/decisions.md`, 2026-10-03).
- Analytics decision (none adopted; the privacy notice says none).
- Content-Security-Policy (blueprint decision 38).
- A second replica needs a shared rate limiter and a migration lock.
- The container registry (open item 3) and the CI push step.

## 14. Build arguments, stated once more

`SITE_URL` must equal the Route host origin. Otherwise every action POST fails the origin check behind edge TLS, and rate limiting keys on the router address. `FEATURE_ACCOUNTS=false` only for the Phase 0 image. `PREVIEW_DRAFTS` never for an image. A value in the Secret does not change any of the three.
