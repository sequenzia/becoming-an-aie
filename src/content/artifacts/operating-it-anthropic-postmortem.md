---
title: A postmortem of three recent issues, excerpt
origin: public
kind: incident
checkedOn: 2026-10-09
url: https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues
summary: Short quotes from Anthropic's September 2025 postmortem on three infrastructure bugs that degraded responses while service stayed up, with the figures the post reports. A first-party account, not independently audited.
---

Anthropic, "A postmortem of three recent issues," published 2025-09-17. The post credits Sam McAllister. The quoted sentences are copied from the post. The figures in the list are restated from it.

> To state it plainly: We never reduce model quality due to demand, time of day, or server load.

What the post reports, in brief:

- Three separate infrastructure bugs, from August to early September 2025: a context window routing error, an output corruption caused by a TPU misconfiguration, and an approximate top-k miscompilation in the XLA:TPU compiler.
- The routing error began on August 5, affecting approximately 0.8% of Sonnet 4 requests. A load balancing change on August 29 made it worse. "At the worst impacted hour on August 31, 16% of Sonnet 4 requests were affected."
- "Approximately 30% of Claude Code users who made requests during this period had at least one message routed to the wrong server type, resulting in degraded responses."
- Each bug produced different symptoms, on different platforms, at different rates.

You do not need the details of the three bugs. Each one degraded answers while requests still succeeded.

Why detection was slow, in the post's words:

> The evaluations we ran simply didn't capture the degradation users were reporting, in part because Claude often recovers well from isolated mistakes.

> More fundamentally, we relied too heavily on noisy evaluations.

On the internal privacy controls that limit engineers' access to user interactions:

> This protects user privacy but prevents engineers from examining the problematic interactions needed to identify or reproduce bugs.

What the post says comes next, restated: more sensitive evaluations, quality evaluations run continuously on production systems, and faster debugging tools for community feedback that keep user privacy intact.
