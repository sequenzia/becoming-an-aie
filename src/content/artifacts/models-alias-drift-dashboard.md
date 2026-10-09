---
title: Weekly eval runs against a moving alias
origin: synthetic
kind: dashboard
checkedOn: 2026-10-09
summary: A synthetic weekly eval table for a fictional support assistant that calls a moving alias. Overall score, per-category scores, and the snapshot the alias resolved to. Written for the Models module. Not a measured result.
---

This dashboard is synthetic. The assistant, the vendor (acme), the alias, the snapshots, and the scores are invented. It shows the scheduled regression run a team keeps when it chooses a moving alias: the same 300 cases every Monday, the same grader, and the model id the response reported.

```yaml
service: support-assistant
request_model: acme-large-latest      # moving alias, chosen on purpose
suite: support-regression v7, 300 cases, deterministic graders plus one rubric grader checked against human labels
alert_rule: "overall drop of 3 points or more against the 4-week median"
```

| Week of | Resolved model (from the response) | Overall | Billing | Refund policy | Outage | Tone rubric (1 to 5) | Alert |
|---|---|---:|---:|---:|---:|---:|---|
| 2026-08-24 | acme-large-20260601 | 91.0% | 93% | 94% | 88% | 4.4 | no |
| 2026-08-31 | acme-large-20260601 | 90.7% | 92% | 94% | 88% | 4.4 | no |
| 2026-09-07 | acme-large-20260601 | 91.3% | 93% | 95% | 89% | 4.5 | no |
| 2026-09-14 | acme-large-20260601 | 90.3% | 92% | 93% | 88% | 4.4 | no |
| 2026-09-21 | acme-large-20260901 | 89.6% | 95% | 81% | 91% | 4.6 | no |
| 2026-09-28 | acme-large-20260901 | 89.9% | 95% | 82% | 92% | 4.6 | no |

The refund policy category is 62 of the 300 cases. The vendor's release note for acme-large-20260901 says "improved instruction following and more concise answers". The alert rule watches the overall score only.
