---
title: Weekly operations dashboard, two configurations, illustrative
origin: synthetic
kind: dashboard
tool: none
checkedOn: 2026-10-09
summary: A synthetic weekly dashboard for a fictional support assistant, before and after release 2.8.0, in tokens, dollars, and outcomes. The numbers are invented for the exercise. Not a measured result from any real system.
---

This dashboard is synthetic. It was written for the Operating it workshop. Quillmark is a fictional retailer, "acme" is a fictional model vendor, and every number is invented. The layout follows what an agent observability tool shows when its spans carry token counts, configuration versions, and outcome events. Read the headline panel first, the way a busy team would. Then read everything under it.

The product is a customer-facing chat assistant that answers order, shipping, billing, and returns questions. A conversation ends one of two ways: the assistant resolves it, or the assistant escalates to a human agent. A resolved conversation can be reopened by the customer within seven days.

**Headline panel, snapshot taken 2026-10-05.**

| Panel | 2.7.3, 2026-09-14 to 09-20 | 2.8.0, 2026-09-23 to 09-29 | Change | Status |
|---|---|---|---|---|
| Model spend per request | $0.0210 | $0.0145 | -31% | green |
| API availability | 99.94% | 99.95% | +0.01 pt | green |
| p95 end-to-end latency | 11.8 s | 9.6 s | -19% | green |
| Error rate on model spans | 0.9% | 0.8% | -0.1 pt | green |

Cost per completed task: panel not configured.

**Configuration in use.**

| Field | 2.7.3 | 2.8.0 |
|---|---|---|
| System prompt | support-system v13 | support-system v14 |
| Primary model | acme-large-20260801 | acme-large-20260801 |
| Router | none, every request to primary | triage route: "simple" tickets to acme-small-20260615 |
| Retrieval index | help-center snapshot 2026-09-04 | help-center snapshot 2026-09-18 |
| Tool set | v6 | v6 |

**Volume, tokens, and the loop.**

| Metric | 2.7.3 | 2.8.0 |
|---|---|---|
| Conversations | 41,200 | 42,050 |
| Model requests | 98,880 | 109,330 |
| Requests per conversation (loop iterations) | 2.4 | 2.6 |
| Input tokens per request, p50 / p95 / p99 | 6,900 / 21,400 / 58,000 | 6,700 / 22,100 / 61,500 |
| Output tokens per request, p50 | 310 | 290 |
| Share of input tokens read from cache | 61% | 12% |
| Share of requests routed to acme-small | 0% | 47% |
| Tool call failure rate | 1.2% | 1.3% |
| Model spend, week | $2,076 | $1,585 |
| Judge spend on a 2% sample, week | $41 | $42 |

Tool and infrastructure spend is not attributed per release. It was about the same both weeks, so leave it out of the comparison.

**Outcomes.**

| Metric | 2.7.3 | 2.8.0 |
|---|---|---|
| Resolved by the assistant | 32,136 (78%) | 29,856 (71%) |
| Escalated to a human agent | 9,064 (22%) | 12,194 (29%) |
| Resolved, then reopened within 7 days | 1,960 (6.1% of resolved) | 3,404 (11.4% of resolved) |
| Judge pass rate on the 2% sample | 91% | 88% |
| Human minutes per escalation | 9.5 | 9.5 |
| Human minutes per reopened conversation | 12 | 12 |
| Loaded cost of a human agent minute | $0.80 | $0.80 |

Reopen counts for the 2.8.0 week are partial on the day of the snapshot: the seven-day window for that week's last conversations closes on 2026-10-06.

**Outcomes by ticket category.**

| Category | Share of conversations | Routed to acme-small | Resolved, 2.7.3 | Resolved, 2.8.0 | Judge pass, 2.8.0 |
|---|---|---|---|---|---|
| Shipping status | 34% | 58% | 84% | 83% | 93% |
| Billing and refunds | 22% | 64% | 74% | 48% | 71% |
| Returns | 26% | 39% | 77% | 76% | 92% |
| Product questions | 18% | 18% | 72% | 71% | 90% |

The dashboard has no panel for how many completed tasks met the quality bar. A completed task, for this product, is a conversation the assistant resolved that the customer did not reopen within seven days.
