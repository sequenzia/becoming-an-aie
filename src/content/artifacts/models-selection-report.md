---
title: Ticket triage, model selection run
origin: synthetic
kind: eval-report
checkedOn: 2026-10-09
summary: A synthetic selection report for a fictional ticket-triage service. Six configurations on one case set, with categories, cost, and latency. Written for the workshop. Not a measured result from any real model.
---

This report is synthetic. The service, the vendors (acme and initech), the model ids, the prices, and every number are invented for the Models workshop. The format follows what a team would keep after a selection run: the requirement first, then the case set, then the results.

```yaml
report: triage-selection-2026-10-02
service: ticket-triage            # assigns each inbound ticket to one queue
requirement:
  queue_accuracy_overall: ">= 0.90"
  security_report_recall: ">= 0.98"  # a missed security report is the costly error
  latency_p95_seconds: "<= 4.0"
  data_handling: "tickets contain customer personal data; processing must stay in the EU region"
case_set:
  name: triage-sel
  version: 4
  cases: 240
  sampled_from: "30 days of production tickets, weighted by queue volume (200 cases)"
  hard_cases: "the hardest tenth by past reassignment rate (40 cases)"
  labels: "queue label by two support leads; 14 of 240 disagreed and were adjudicated"
  by_category: { billing: 82, account_access: 61, outage: 38, security_report: 25, other: 34 }
grader: exact match on queue label against the adjudicated reference
runs_per_configuration: 3
cost_basis: "model tokens and retries per completed task; human review time not included"
```

| Configuration | Region | Overall accuracy | Security recall | Hard cases | p95 latency | Cost per completed task |
|---|---|---:|---:|---:|---:|---:|
| rules-v3 (no model, current production) | EU | 71.3% | 88% (22/25) | 41% | 0.05 s | $0.0000 |
| acme-large-20260801, effort medium | EU | 93.8% | 100% (25/25) | 85% | 3.9 s | $0.0141 |
| acme-large-20260801, effort low | EU | 92.1% | 96% (24/25) | 80% | 2.1 s | $0.0083 |
| acme-small-20260515 | EU | 89.6% | 92% (23/25) | 68% | 0.9 s | $0.0019 |
| routed: acme-small, escalate to acme-large medium on low confidence | EU | 92.9% | 100% (25/25) | 83% | 3.1 s | $0.0042 |
| initech-mini-0701 | US only | 93.3% | 100% (25/25) | 83% | 0.8 s | $0.0011 |

Notes recorded with the run:

- Run-to-run range across the three runs was 1.2 points on overall accuracy for every model configuration. The rules baseline does not vary.
- The routed configuration escalated 18% of tickets. Escalated tickets had a p95 of 5.2 s. The 3.1 s figure is across all tickets.
- initech-mini-0701 is served only from a US region today. The vendor's roadmap mentions an EU region with no date.
- Both acme models are pinned snapshots. acme-large-20250301, the model the previous prototype used, has a retirement date of 2026-11-30 and is not in this run.
- Security reports are 25 of 240 cases. One case is 4 points of security recall.
