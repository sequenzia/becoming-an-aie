# Deploy to OpenShift

The runbook for running the site as one container image on OpenShift with PostgreSQL on AWS RDS. Blueprint section 13.3 is the outline; this file is the version to follow and the place to record what was done. Every step runs from a machine with `oc` logged in. Docker, `psql`, and `oc` are absent on the dev machine, so the image is built by CI or by an OpenShift BuildConfig, never locally.

Names used below: project `aie`, Secret `aie-env`, Deployment `aie`, Service `aie`, Route `aie`, image `becoming-an-aie`. Replace `<host>` with the final public hostname (open item 1 in `docs/decisions.md`) and `<image>` with the image reference from step 3.

Phase 1 adds accounts. The additions are marked "Phase 1" in steps 1, 2, 3, 7, and 8, and section 15 holds the Phase 1 rollout order and the gate steps on the deployed image.

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
3. The two OAuth registrations (step 8). Not needed for the Phase 0 image, which is built with `FEATURE_ACCOUNTS=false`. Required for Phase 1: a pod built with accounts on reports the four OAuth values and `BETTER_AUTH_SECRET` as missing on `/readyz` until they are in the Secret.
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

Phase 1. `.env.prod` for the Phase 1 image carries the same five lines plus the four OAuth values from step 8:

```
BETTER_AUTH_URL=https://<host>
EMAIL_PROVIDER=none
DATABASE_URL=postgres://<user>:<password>@<rds-endpoint>:5432/<database>
BETTER_AUTH_SECRET=<32+ characters>
NOTIFY_TOKEN_SECRET=<32+ characters>
GITHUB_CLIENT_ID=<from the GitHub OAuth App>
GITHUB_CLIENT_SECRET=<from the GitHub OAuth App>
GOOGLE_CLIENT_ID=<from the Google OAuth client>
GOOGLE_CLIENT_SECRET=<from the Google OAuth client>
```

What the two Better Auth values do. `BETTER_AUTH_URL` is the base URL Better Auth resolves everything against: the OAuth redirect URI it sends to each provider (`<BETTER_AUTH_URL>/api/auth/callback/<provider>`), the origin it trusts for its own CSRF check, and the `Secure` flag on the session cookie, which follows an `https://` base URL. It must be `https://<host>`, the same origin as the build argument `SITE_URL`; a mismatch shows as a provider-side redirect URI error, not as a site error. `BETTER_AUTH_SECRET` signs the session token and must be at least 32 characters; a pod without it refuses every on-demand request (the middleware throws before the page renders) and `/readyz` names it. Keep `BETTER_AUTH_URL` in the Secret even though it is not sensitive: it is a runtime value by design (blueprint decision 1), and the image never carries it.

Replace the Secret in place and restart the pods so the process reads the new values:

```sh
oc create secret generic aie-env --from-env-file=.env.prod --dry-run=client -o yaml | oc apply -f -
oc rollout restart deploy/aie
oc rollout status deploy/aie
```

The `--dry-run=client -o yaml | oc apply` form updates an existing Secret without a delete. Rules:

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

Phase 1. The workflow's default for the build argument `FEATURE_ACCOUNTS` is `true` from the Phase 1 commit on, the same default the `Dockerfile` carries. The repository variable `FEATURE_ACCOUNTS` was set to `false` for the Phase 0 image; delete it under Settings, Secrets and variables, Actions, Variables before the Phase 1 image is built, or the Phase 1 image ships with no sign-in. The workflow prints a notice while the variable is set. Never set `PREVIEW_DRAFTS` for an image.

Path B, an OpenShift BuildConfig from the Dockerfile. Run from a clean clone of the phase commit so nothing untracked is uploaded; the build applies `.dockerignore`.

```sh
oc new-build --strategy=docker --binary --name=aie
# Phase 0:
oc start-build aie --from-dir=. --follow \
  --build-arg SITE_URL=https://<host> \
  --build-arg FEATURE_ACCOUNTS=false
# Phase 1 onward:
oc start-build aie --from-dir=. --follow \
  --build-arg SITE_URL=https://<host> \
  --build-arg FEATURE_ACCOUNTS=true
```

The image reference is `image-registry.openshift-image-registry.svc:5000/aie/aie:latest`. Tag each phase build (`oc tag aie/aie:latest aie/aie:phase-0`, then `aie/aie:phase-1`) so a rollback has a name to go back to.

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

Phase 1 onward, three more lines:

```sh
curl https://<host>/api/auth/ok
# {"ok":true}: Better Auth's handler is mounted and the auth values parsed
curl -I https://<host>/modules/orientation
# 200: the first published module, prerendered
curl -I https://<host>/modules/models
# 404: a draft never renders in an image (EC-5.2.2); it renders only under PREVIEW_DRAFTS=true in dev and CI
```

Forwarded headers, Phase 1 onward (gate row 1.26). Every IP-keyed limit (`notify-ip`, `feedback-ip`, `write-ip`, and Better Auth's rule on `/sign-in/social`) keys on Astro's `clientAddress`, which is the leftmost `X-Forwarded-For` value whenever the Host matches `security.allowedDomains`. That is safe only while the Route annotation `haproxy.router.openshift.io/set-forwarded-headers: replace` (section 6) is in force; the OpenShift default, `append`, keeps a client-supplied leftmost value and every limit could be defeated by a forged header. Check the annotation and its effect:

```sh
oc get route aie -o jsonpath='{.metadata.annotations.haproxy\.router\.openshift\.io/set-forwarded-headers}'
# replace
# Six anonymous feedback posts from this one client, each with a different forged X-Forwarded-For.
# feedback-ip allows 5 per hour, so the sixth must answer 429. If the forged values were honoured, all six would answer 200.
for n in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://<host>/_actions/submitFeedback" \
    -H "Origin: https://<host>" -H "X-Forwarded-For: 203.0.113.$n" \
    --data-urlencode "body=gate row 1.26 check $n"
done
# 200 200 200 200 200 429
```

The five stored rows are anonymous (`feedback` has no user column); remove them afterwards with `delete from feedback where body like 'gate row 1.26 check %'` through the section 15 query shell.

Then sign in with each provider and check the response headers in the browser's developer tools: the callback response sets `__Secure-better-auth.session_token` with `Secure; HttpOnly; SameSite=Lax`, and the deletion response on `/account` carries expiring `Set-Cookie` headers for both session cookie names with `Secure` on the `__Secure-` name. Section 15 lists the order.

TLS to RDS is verified two ways: `db:tls-check` proves the pool negotiated TLS from inside the pod, and `scripts/migrate.mjs` refuses to run without `PG_CA_FILE` in production. `rds.force_ssl = 1` on the instance refuses plaintext from the server side as well.

## 8. OAuth callback URL registration

Phase 1 onward. Better Auth's callback path is `/api/auth/callback/<provider>`, resolved against `BETTER_AUTH_URL` (`docs/research/better-auth.md` 3.3). Register one app per provider per environment: production at `https://<host>`, and a second pair at `http://localhost:4321` for `astro dev` on the dev machine. Never reuse the production client secret in a `.env`.

### 8.1 GitHub

1. Sign in to GitHub as the account that will own the app. Open Settings, Developer settings, OAuth Apps, New OAuth App. Choose an OAuth App, not a GitHub App: a GitHub App needs the "Email addresses: Read-only" account permission as well, or every sign-in ends in `email_not_found`.
2. Fill in: Application name `Becoming an AI Engineer`; Homepage URL `https://<host>`; Authorization callback URL `https://<host>/api/auth/callback/github`. Leave "Enable Device Flow" off.
3. Register the app, then generate a client secret. Copy the Client ID into `GITHUB_CLIENT_ID` and the secret into `GITHUB_CLIENT_SECRET` in `.env.prod`. The secret is shown once.
4. Scopes need no configuration: Better Auth requests `read:user` and `user:email` by default, and when `/user` returns no public email it reads the primary address from `/user/emails`. A learner whose email is private can therefore sign in; gate row 1.16 checks it.
5. Dev app: repeat with Homepage URL `http://localhost:4321` and callback `http://localhost:4321/api/auth/callback/github`; the values go into the dev machine's `.env`.

### 8.2 Google

1. In the Google Cloud console, pick or create a project. Open APIs and Services, OAuth consent screen. Set the user type to External, the app name to `Becoming an AI Engineer`, the support and developer contact addresses, and the authorized domain `<host>` without a scheme. Add the scopes `openid`, `email`, and `profile`, which are the ones Better Auth requests. While the publishing status is Testing, only listed test users can sign in; publish the app, or add every tester, before the gate.
2. Open Credentials, Create credentials, OAuth client ID. Application type Web application. Name `aie-web`. Authorized JavaScript origins `https://<host>`. Authorized redirect URIs `https://<host>/api/auth/callback/google`. Create.
3. Copy the Client ID into `GOOGLE_CLIENT_ID` and the client secret into `GOOGLE_CLIENT_SECRET` in `.env.prod`.
4. Dev client: a second OAuth client with origin `http://localhost:4321` and redirect URI `http://localhost:4321/api/auth/callback/google`.

### 8.3 After both registrations

1. Put the four values in `.env.prod`, replace the Secret, and restart the Deployment (step 2, the `oc apply` and `oc rollout restart` lines).
2. `curl https://<host>/readyz` is `{"ok":true}` and `curl https://<host>/api/auth/ok` is `{"ok":true}`.
3. Open `https://<host>/sign-in` and sign in with each provider once. A mismatch between the registered URI and `<BETTER_AUTH_URL>/api/auth/callback/<provider>` shows at the provider as a redirect URI error (`redirect_uri_mismatch` at Google, "The redirect_uri MUST match the registered callback URL" at GitHub), never as a site error. A provider that shares no address lands back on `/sign-in?error=email_not_found`; the same address through a second provider lands on `/sign-in?error=unable_to_link_account`, by design (blueprint decision 12).
4. Record both registrations in the table below. Register the callback URLs before the Phase 1 gate.

| Date | Provider | Environment | Callback URL | Owner account | By |
|---|---|---|---|---|---|
| | GitHub | production | `https://<host>/api/auth/callback/github` | | |
| | Google | production | `https://<host>/api/auth/callback/google` | | |

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

The Phase 1 steps are in section 15, so the numbering of the steps other documents cite stays fixed.

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
- Signed-in end-to-end coverage (open item 12): a test-only session injection compiled in only for the e2e build. Until then the Phase 1 gate's manual rows cover `/account`, `/assessment`, and the deletion response.

## 14. Build arguments, stated once more

`SITE_URL` must equal the Route host origin. Otherwise every action POST fails the origin check behind edge TLS, and rate limiting keys on the router address. `FEATURE_ACCOUNTS=false` only for the Phase 0 image. `PREVIEW_DRAFTS` never for an image. A value in the Secret does not change any of the three.

## 15. Phase 1 rollout and gate on the deployed image

The record lives in `docs/gates.md` (Phase 1 gate, Parts A to C). Nothing in Phase 1 changes the Deployment, Service, or Route manifests. The order:

1. Close Part A of the gate (the architecture and auth review) before any learner data is accepted, that is, before the Route serves the Phase 1 image.
2. Register the OAuth callbacks (step 8), put the four values in `.env.prod`, replace the Secret, and restart (step 2). Keep `BETTER_AUTH_URL=https://<host>`.
3. Build the Phase 1 image with `FEATURE_ACCOUNTS=true` and record it in the step 3 table. Run the migration Job from it (step 4). The Phase 1 migration set adds the Better Auth tables (`user`, `session`, `account`, `verification`) and the learner tables; it is additive, so the Phase 0 pod keeps running until `oc set image` moves the Deployment.
4. Verify (step 7, Phase 1 lines, and the forwarded-headers block for gate row 1.26). Then sign in once with GitHub and once with Google and read the rows from the pod (gate rows 1.15 and 1.16). The image has `pg`:

```sh
oc exec deploy/aie -- node -e "
const { readFileSync } = require('node:fs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.PG_CA_FILE, 'utf8') }, max: 1 });
(async () => {
  console.table((await pool.query('select id, email, name, image, email_verified from \"user\" order by created_at desc limit 5')).rows);
  console.table((await pool.query('select user_id, ip_address, user_agent, expires_at from session order by created_at desc limit 5')).rows);
  console.table((await pool.query('select provider_id, account_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope from account order by created_at desc limit 5')).rows);
  await pool.end();
})();
"
```

   Expected: `image`, `ip_address`, `user_agent`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, and `scope` are null on every row; `email` is set and `email_verified` is true on every row, including for a GitHub account whose primary email is private (an unverified address never gets a row: the sign-in lands on `/sign-in?error=email_not_verified`); `provider_id` is `github` or `google` and `account_id` the provider's subject. Anything else means a hook did not run on a real callback (open item 4); the fallback is `account.encryptOAuthTokens: true` plus a privacy notice update.

5. Run Part B of the gate in the browser against `https://<host>/modules/orientation`, `/account`, and `/sign-in`, and the `astro dev` rows against `/modules/models` and `/assessment` with `PREVIEW_DRAFTS=true`.
6. Delete the test account from `/account` and read the response headers (gate row 1.17). Confirm the rows are gone with the query above, and that `notify_subscriber` no longer holds the account's address if it had subscribed.
7. Close Part C, including the checklist table, and paste the CI run link.

If a hook or the sign-in fails on the deployed pod, roll back with step 10. The Phase 0 image answers 404 on every account route and ignores the auth values in the Secret, so a rollback needs no Secret change.
