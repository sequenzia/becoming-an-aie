---
title: Capacity decision memo, consolidating a self-hosted serving fleet
origin: synthetic
kind: document
tool: none
checkedOn: 2026-10-09
summary: A synthetic capacity memo for a fictional insurer's claims chat that halves its accelerator fleet on the strength of a reference benchmark. Written for this elective's failure exercise. Not a real decision or a measured result.
---

This memo is synthetic. Bramblecote is a fictional insurer, corvid-13b is a fictional open-weights model, the G-80 is a fictional accelerator, and every number is invented. The format follows a short capacity proposal with its approval and appendix.

**Memo: Q4 capacity plan for claims-chat serving**

Author: platform engineering. Date: 2026-10-07. Status: approved 2026-10-08 by the platform lead.

**Service.** Claims chat answers policyholders' questions about open claims. Each request carries the system prompt, the policy wording for the customer's product, the claim's notes, and the conversation so far. It streams its answer to the policyholder's browser.

**Service level objective.** For interactive chat, measured at the server: time to first token at p95 of 1.5 seconds or less, and time per output token at p95 of 60 milliseconds or less.

**Current deployment.** corvid-13b, 16-bit weights, on four G-80 accelerators. Each accelerator admits at most 16 concurrent requests. Cost: 4 accelerators at $2.40 per hour, $7,008 a month.

**Proposal.** Move to two G-80 accelerators and raise the per-accelerator limit from 16 to 96 concurrent requests. Saving: $3,504 a month, 50%.

**Evidence.** The corvid-13b reference benchmark, published by the model's maintainers for the G-80, shows that continuous batching scales well on this hardware:

- Throughput at concurrency 96 is 2,210 output tokens per second, more than twice the 1,080 at concurrency 24.
- At concurrency 96, median time to first token is 0.52 seconds and median time per output token is 41 milliseconds. Both are inside our SLO.
- No preemptions at any concurrency tested.

**Capacity check.** Peak hour demand is about 9,000 requests with a mean of 270 output tokens, about 2.4 million output tokens an hour. One accelerator at concurrency 96 produces 2,210 tokens per second, about 8 million an hour. Two accelerators give more than six times the peak demand. We keep a comfortable margin even after growth.

**Risks.** None significant. Same model, same weights, same precision. Only the batch limit changes, and the benchmark shows the SLO holds at that limit.

**Approval.** "SLO met with headroom. Approved. Roll out Monday 2026-10-12." Platform lead, 2026-10-08.

**Appendix 1. Reference benchmark output, as published.**

```text
corvid-13b reference benchmark, G-80, bf16, continuous batching
input tokens: 1500 (fixed)   output tokens: 250 (fixed)
load: closed loop, all users start at t=0, no think time, 5 min per row

concurrency  ttft_p50  ttft_p95  tpot_p50  tpot_p95  throughput   kv_cache_peak  preempt/1k
1            0.12 s    0.14 s    14 ms     15 ms     68 tok/s     1%             0
12           0.16 s    0.42 s    17 ms     21 ms     650 tok/s    11%            0
24           0.22 s    0.88 s    21 ms     30 ms     1080 tok/s   21%            0
48           0.33 s    1.9 s     29 ms     49 ms     1560 tok/s   42%            0
96           0.52 s    3.9 s     41 ms     88 ms     2210 tok/s   84%            0

model notes: 192 KiB of KV cache per token at 16-bit; about 200,000 tokens of
KV cache fit beside the weights on one G-80.
```

**Appendix 2. Claims-chat workload, from 30 days of gateway logs.**

| Measure | p50 | p95 | p99 |
|---|---:|---:|---:|
| Input tokens per request | 3,800 | 9,200 | 14,500 |
| Output tokens per request | 240 | 700 | 1,100 |
| In-flight requests, whole service, peak hour | 22 | 31 | 36 |
