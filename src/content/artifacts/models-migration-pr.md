---
title: Pull request, migrate before the retirement date
origin: synthetic
kind: document
checkedOn: 2026-10-09
summary: A synthetic pull request that moves a fictional service to a replacement model before its retirement date. The description, the diff, the CI log, and the review. The failure is planted on purpose. Not a real change.
---

This pull request is synthetic. The repository, the vendor (acme), the model ids, and the people are invented. This is a different team's service from the triage workshop. It has run acme-large-20250301 in production since March. Read it the way a reviewer would: description, diff, checks, then the approval.

```text
#1482  Migrate support-replies to acme-large-20260801 before retirement
Author: dev-b    Reviewer: dev-c    Base: main

Acme's notice (received 2026-09-30): acme-large-20250301 retires 2026-11-30.
Recommended replacement: acme-large-20260801.

This PR swaps the model id. Tested: full CI green, including the model
smoke test against the new model. No prompt changes needed.
```

```diff
--- a/src/support_replies/client.py
+++ b/src/support_replies/client.py
@@ -12,6 +12,6 @@ from acme import Client
 _client = Client()
-MODEL = "acme-large-20250301"
+MODEL = "acme-large-20260801"

 def draft_reply(ticket: Ticket) -> ReplyDraft:
     resp = _client.responses.create(
         model=MODEL,
--- a/src/support_replies/escalation.py
+++ b/src/support_replies/escalation.py
@@ -40,3 +40,3 @@ def draft_escalation_reply(ticket, draft):
     resp = _client.responses.create(
-        model="acme-large-20250301",
+        model="acme-large-20260801",
         instructions=REPLY_PROMPT_V3,
```

```text
CI run 88124 on 7f3e2a1   status: passed   duration 6m 41s

[unit]         214 passed, 0 failed
[integration]   38 passed, 0 failed
                 provider mode: replay (cassettes/support_replies/*.yaml, recorded 2026-03-02)
[contract]       reply_draft schema: 38 of 38 cassette responses valid
[model-smoke]    live call to acme-large-20260801
                   prompt 1 "Reset my password"       -> non-empty, schema valid   PASS
                   prompt 2 "Invoice is wrong"        -> non-empty, schema valid   PASS
                   prompt 3 "Site is down"            -> non-empty, schema valid   PASS
[lint]           passed
```

```text
$ git grep -n "acme-" -- src jobs
src/support_replies/client.py:13:MODEL = "acme-large-20260801"
src/support_replies/escalation.py:41:        model="acme-large-20260801",
jobs/nightly_digest.py:27:    model="acme-large-20250301",
```

```text
Review by dev-c: Approved.
"CI is green and the smoke test hits the new model. Retirement is Nov 30,
so let's merge and deploy Monday."
```
