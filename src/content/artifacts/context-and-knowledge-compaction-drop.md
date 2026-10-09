---
title: A compaction summary that dropped two constraints
origin: synthetic
kind: trace
tool: cedar-harness
version: "2.3.0"
checkedOn: 2026-10-09
summary: A synthetic session excerpt from a fictional support assistant, the automatic compaction it ran, the summary it kept, and the next answer. Written for this module. Not a measured result from any real system.
---

This trace is synthetic. It was written for the Context and knowledge module. The customer, the product, the harness, and every message are invented. Session s-7790 is a later session with the same administrator from tenant-alder. Read it in order: what the user said, what the compaction kept, what the assistant did next.

Selected turns before compaction, verbatim from the session log:

```text
[turn 1, user]
Our SAML signing certificate expires on 2026-09-28. I need to rotate it.

[turn 2, user]
Context you need: we are self-hosted on Cedar Teams 7.4.3 LTS. We are in an audit
freeze. Nothing that restarts the identity service can happen before our change
window, Saturday 02:00 to 04:00 UTC.

[turn 3, assistant]
Understood. You are on 7.4.3 LTS, self-hosted, and restarts wait for Saturday's
window. Let me look at your workspace and recent tickets.

[turns 4 to 9]
Four list_tickets calls, two get_ticket calls, and a discussion of a 2025 rotation
that signed every user out. History reaches 61,880 tokens.
```

The compaction event:

```json
{
  "name": "harness.compaction",
  "span_id": "k10",
  "parent_span_id": "s7790-t10",
  "attributes": {
    "compaction.trigger": "auto",
    "compaction.history_token_threshold": 60000,
    "compaction.tokens_before": 61880,
    "compaction.tokens_after": 112,
    "compaction.prompt": "Summarize the conversation so far in under 150 words. Focus on the user's current task and any open questions.",
    "compaction.model": "acme-small-20260601",
    "compaction.kept_raw_turns": 0,
    "compaction.pinned_items": []
  }
}
```

The summary that replaced turns 1 to 9:

```text
The user, an administrator at Alder Logistics, is rotating their SAML signing
certificate before it expires on 2026-09-28. They want to avoid signing users out.
A 2025 rotation signed every user out and generated 140 tickets. Ticket history has
been reviewed. Open question: the exact rotation steps. Next step: provide the
procedure.
```

The next turn:

```text
[turn 10, user]
OK, what are the steps?

[turn 10, assistant]
1. In the admin console, open Security, then SSO, and upload the new certificate.
2. Select Activate.
3. Restart the identity service (cedar-idp) so the new metadata is served.
4. Confirm that a test user can sign in.
Doing this today leaves a comfortable margin before the 2026-09-28 expiry.
```
