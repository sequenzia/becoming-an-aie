---
title: Change CTX-88 and the first run after it
origin: synthetic
kind: incident
tool: cedar-harness
version: "2.4.0"
checkedOn: 2026-10-09
summary: A synthetic change record that responds to a support-assistant incident, plus a context manifest and answer from the first run after it shipped. Written for this module. The failure is planted. Not a measured result.
---

This record is synthetic. It was written for the Context and knowledge module's failure exercise. The company, the harness, the vendor, the model ids, the prices, and every number are invented. Prices are the fictional vendor's list prices, not any real provider's.

The incident it responds to, as the team filed it:

```text
INC-3141, 2026-09-21, severity 2
In session s-7790 the assistant told a 7.4.3 LTS self-hosted administrator to restart
the identity service during their audit freeze. Automatic compaction at 60,000
history tokens produced a summary without the edition or the change window.
Customer caught it before acting.
```

The change, merged the next day, 2026-09-22:

```diff
# CTX-88: stop the assistant forgetting customer constraints in long sessions
# Reviewed by: support-platform. Evaluation: spot-checked 3 conversations, all good.

 compaction:
-  history_token_threshold: 60000
+  history_token_threshold: 180000
 retrieval:
-  top_k: 12
+  top_k: 40
 system_prompt:
   base: prompts/support-system.md@v14
+  append:
+    - reference/admin-guide-6.x.md      # 14,900 tokens
+    - reference/admin-guide-7.x.md      # 17,800 tokens
+    - reference/admin-guide-7.4.md      # 9,600 tokens
+    - reference/admin-guide-8.x.md      # 18,900 tokens
+    - reference/changelog-full.md       # 18,400 tokens
 memory:
-  max_unused_days: 90
+  max_unused_days: null
 tools:
-  enabled: 22
+  enabled: 31
```

The first production run after the change. Session s-7954, turn 6, the same tenant, the same administrator asking the same question as before: rotate the SAML signing certificate without signing everyone out.

| Component | Tokens | Notes recorded by the harness |
|---|---:|---|
| System prompt v14 | 3,240 | First line is the current time |
| Appended reference guides, 4 | 61,200 | 6.x, 7.x, 7.4, 8.x |
| Appended changelog | 18,400 | Header line "Generated 2026-09-22T06:00:00Z" |
| Tool definitions, 31 tools | 21,300 | 2 tools called this session |
| Few-shot examples, 6 | 4,100 | Billing refunds |
| Memory, 11 entries | 1,420 | Includes mem-0193, created 2026-02-11 |
| Retrieved passages, 40 chunks | 33,100 | Index last successful sync 2026-08-29 |
| Conversation history, turns 1 to 5 | 9,800 | Turn 1: "We are on 7.4.3 LTS, self-hosted, change window Saturday" |
| Current request | 88 | |
| Total input | 152,648 | Window 200,000 |

The retrieved chunks the answer cited, as the retrieval span recorded them:

```yaml
cited:
  - doc: KB-1180
    index_rev: r5
    source_rev: r6
    passage: "Rotation replaces the active certificate immediately. All users must sign in again after activation."
  - doc: admin-guide-7.x.md
    section: "9.3 Certificates"
    passage: "Activating a new signing certificate ends all active sessions."
    applies_to: "7.0 to 7.3"
not_cited:
  - doc: admin-guide-7.4.md
    section: "9.3 Certificates"
    position_in_input: "token 41,870 of 152,648"
    passage: "From 7.4.2, publish the new certificate as secondary. Users stay signed in during the overlap."
```

The answer at turn 6:

```text
Because you are on 7.4.3 LTS self-hosted, do this inside your Saturday change window.
1. Upload the new certificate under Security, then SSO.
2. Select Activate. All users will need to sign in again (KB-1180; Admin Guide 9.3).
3. Restart cedar-idp.
Plan a short notice to your users before the window.
```

The dashboard the team posted in the change channel a week later, on 2026-09-29:

```text
                                  before CTX-88    after CTX-88
input tokens per call, p50              21,400         148,900
latency per answer, p95                  6.2 s          19.7 s
cached input share                          0%              0%
cost per answer at list price          $0.054          $0.372
compaction events per 100 sessions          31               0
context-length errors per 100 sessions       0              34
retrieval eval RET set, last run    2026-08-12      not run
```
