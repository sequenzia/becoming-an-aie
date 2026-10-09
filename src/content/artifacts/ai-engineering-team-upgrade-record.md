---
title: Experiment record, proposed model upgrade for claims intake
origin: synthetic
kind: eval-report
checkedOn: 2026-10-09
summary: A synthetic experiment record for a proposed model upgrade on a fictional claims-intake assistant, with the review notes of three owners who disagree. Written for the workshop. Not a measured result from any real model.
---

This record is synthetic. The insurer (Brightwater Mutual), the vendor (Veltra), the model ids, the people, and every number are invented for this module. The format is what a team keeps after an experiment: the question, the configurations side by side, the results, the gaps, and the review notes. Read it as the input to a review meeting.

```yaml
record: EXP-0412
title: Candidate upgrade, loss-intake assistant, veltra-m-20260612 to veltra-m-20260904
owner: M. Lindqvist (application owner, claims-intake)
status: proposed for review on 2026-09-22
question: >
  Does veltra-m-20260904 meet the intake requirement at least as well as
  the current model, at equal or lower cost per completed claim?
requirement:
  overall_pass_rate: ">= 0.89"
  fraud_indicator_escalation: "no regression; a missed escalation is the costly error"
  summary_faithfulness: "no regression; adjusters act on the summary"
  latency_p95_seconds_sync_path: "<= 4.5"
change_under_test: model only
```

| Item | Baseline | Candidate |
|---|---|---|
| Model | veltra-m-20260612 (pinned) | veltra-m-20260904 (pinned) |
| Reasoning effort | vendor default | vendor default |
| System prompt | intake-prompt v14 | intake-prompt v14 |
| Tool schemas | intake-tools v6 | intake-tools v6 |
| Policy index snapshot | pol-idx 2026-09-14 | pol-idx 2026-09-14 |
| Case set | intake-eval v9, 420 cases | intake-eval v9, 420 cases |
| Graders | code graders c11; faithfulness judge g7 | code graders c11; faithfulness judge g7 |
| Trials | 3 per case | 3 per case |
| Run ids | run-7731, run-7732, run-7733 | run-7741, run-7742, run-7743 |

| Category | Cases | Baseline pass rate (range over 3 runs) | Candidate pass rate (range over 3 runs) |
|---|---:|---:|---:|
| Coverage question answered from policy | 120 | 88.1% (87.5 to 89.2) | 91.4% (90.8 to 92.5) |
| Routing to the right claims queue | 110 | 93.9% (92.7 to 94.5) | 95.2% (94.5 to 95.5) |
| Loss summary faithfulness | 90 | 86.7% (85.6 to 87.8) | 84.1% (82.2 to 85.6) |
| Fraud-indicator escalation | 24 | 87.5% (83.3 to 91.7) | 83.3% (79.2 to 87.5) |
| Personal data handling | 40 | 97.5% (97.5 to 97.5) | 98.3% (97.5 to 100) |
| Out-of-scope request handed to a person | 36 | 80.6% (77.8 to 83.3) | 88.9% (86.1 to 91.7) |
| Overall, weighted by cases | 420 | 89.5% (88.8 to 90.2) | 90.8% (90.2 to 91.4) |

```text
Cost per completed claim (model tokens and retries; adjuster time not included)
  baseline   $0.041
  candidate  $0.034   (-17%)

Latency, synchronous intake path, all 1,260 trials per configuration
  baseline   p50 1.9 s   p95 3.8 s
  candidate  p50 2.6 s   p95 4.9 s

Cases whose majority verdict changed (2 of 3 trials or more)
  fail -> pass   23   coverage 9, routing 5, out-of-scope 8, personal data 1
  pass -> fail   11   faithfulness 6, fraud escalation 1, coverage 2, routing 2

Faithfulness judge g7, last calibration 2026-08-14
  160 expert-labeled summaries, all produced by veltra-m-20260612
  TPR 0.88, TNR 0.93 on the held-out split (80 summaries)
  not yet calibrated on summaries produced by veltra-m-20260904

Vendor notes, copied into the record on 2026-09-15
  veltra-m-20260612   status: active    default effort: medium
  veltra-m-20260904   status: preview   default effort: high
  "Preview models may be retired with 14 days' notice."
```

Review notes, added before the meeting:

- R. Osei, claims quality lead (domain reviewer): "I read all six faithfulness regressions. In four of them the candidate drops a qualifier the claimant wrote: 'roughly', 'I think it was Tuesday', 'the neighbor says'. Adjusters treat an unqualified date of loss as confirmed. I would not ship this to the intake path as it is. I also want someone to read the fraud case that flipped before we argue about one case out of 24."
- M. Lindqvist, application owner: "Overall is up 1.3 points, out-of-scope handling is up 8, and cost is down 17%. The faithfulness drop is 2.6 points and inside what the judge can resolve. I propose we ship and fix the qualifier issue in the prompt next sprint."
- J. Park, operations owner: "p95 of 4.9 s breaks the 4.5 s target for the synchronous path. The candidate is a preview model, so its retirement notice can be 14 days. I cannot put a 14-day dependency on the intake path without a tested fallback."
- Open question from the record owner: "Do we need a fresh human review of candidate summaries, or is the judge enough?"
