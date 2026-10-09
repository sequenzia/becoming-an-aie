---
title: Serving dashboard for a self-hosted model, two weeks compared
origin: synthetic
kind: dashboard
tool: none
checkedOn: 2026-10-09
summary: A synthetic serving dashboard for a fictional self-hosted assistant, two weeks before and after a feature release, with the alert panel on top and the tail, queue, and KV cache panels below. Not a measured result.
---

This dashboard is synthetic. The returns assistant, corvid-13b, the G-80 accelerator, and every number are invented for this elective. The panel names follow the metrics an open-source serving engine exports (time to first token, time per output token, queue time, running and waiting requests, KV cache usage, preemptions, prefix cache hits), aggregated by the team's own monitoring.

The returns assistant has run corvid-13b at int8 on two G-80 accelerators since August, with a limit of 24 in-flight requests per accelerator. On 2026-09-22 the team shipped a feature called order context: every request now carries the customer's last 20 orders, inserted after the system prompt and before the tool definitions.

**Alert panel, snapshot taken 2026-09-28.**

| Panel | Week of 2026-09-14 | Week of 2026-09-21 | Alert threshold | Status |
|---|---:|---:|---|---|
| Availability (non-5xx responses) | 99.97% | 99.96% | below 99.9% | green |
| Mean end-to-end latency | 7.9 s | 9.1 s | rise of 25% | green |
| Error rate | 0.05% | 0.4% | above 1% | green |
| Requests per second, peak hour | 2.8 | 2.9 | none | none |

**Latency, peak hours only (weekdays 10:00 to 12:00).**

| Metric | Week of 2026-09-14 | Week of 2026-09-21 |
|---|---:|---:|
| TTFT p50 | 0.38 s | 0.47 s |
| TTFT p95 | 1.3 s | 4.2 s |
| TTFT p99 | 2.4 s | 9.8 s |
| TPOT p50 | 20 ms | 24 ms |
| TPOT p95 | 52 ms | 68 ms |
| Queue time p95 | 0.1 s | 2.9 s |

**Load and memory, peak hours only.**

| Metric | Week of 2026-09-14 | Week of 2026-09-21 |
|---|---:|---:|
| Input tokens per request, p50 / p95 | 2,300 / 6,000 | 5,200 / 13,900 |
| Output tokens per request, p50 | 220 | 225 |
| Running requests per accelerator, max | 24 | 24 |
| Waiting requests, max | 0 | 19 |
| KV cache use, p95 | 61% | 99% |
| Preemptions per 1,000 requests | 0 | 37 |
| Prefix cache hit rate, by tokens | 54% | 31% |

**What users experienced.**

| Metric | Week of 2026-09-14 | Week of 2026-09-21 |
|---|---:|---:|
| Streams abandoned by the client before the first token (15 s timeout) | 0.1% | 2.6% |
| Conversations where the user sent "hello?" or "are you there" | 0.3% | 1.9% |
| Quality sample, rubric pass rate on 1% of conversations | 91% | 90% |

The client's 15-second timeout counts as a client-side event, not a server error, so it does not reach the error-rate panel.
