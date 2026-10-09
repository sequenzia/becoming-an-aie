---
title: Ticket intake, recorded adaptation experiments
origin: synthetic
kind: eval-report
tool: acme-tune (fictional)
version: "2.3.0"
checkedOn: 2026-10-09
summary: Synthetic experiment records for a fictional ticket-intake task. Two prompted configurations, a few-shot configuration, and two adapters on one frozen acceptance set. Written for the workshop. Not a measured result.
---

These records are synthetic. Quillfern, the vendor "acme", the model ids, the prices, and every number are invented for this workshop. You did not run these experiments. Read them as recorded results that another team produced, and say so in anything you write about them.

```yaml
records: intake-adapt-2026-09
task: ticket intake (queue, three fields, needs_human); see intake-data-2026-09-22
requirement:
  queue_accuracy: ">= 0.92"
  security_report_recall: ">= 0.98"       # 50 acceptance cases; 49 of 50 is 0.98
  field_accuracy_all_fields: ">= 0.90"    # every field, null references included
  unsupported_value_rate: "<= 0.010"      # a value returned where the reference is null
  needs_human_recall: ">= 0.85"           # 48 acceptance tickets are needs_human
  latency_p95_seconds: "<= 1.2"           # at 60 requests per second
  monthly_budget_usd: "<= 9000"           # at 1.2 million tickets per month; covers
                                          # inference, adapter hosting, and scheduled
                                          # retraining with its suite runs
  data_handling: EU region only; all configurations below are eligible
acceptance_set: intake-accept v3, 600 tickets, frozen 2026-09-22, never used for choices
dev_set: intake-dev v2, 400 tickets, used for every prompt and checkpoint choice
environment:
  eval_runner: intake-eval 1.9.2, commit 4be71d2
  date_run: 2026-09-24 to 2026-09-26
  runs: prompted configurations 3 runs each; adapters 3 training seeds each
```

| Id | Configuration | Queue acc. | Security recall | Field acc. | Unsupported values | needs_human recall | p95 | Inference per month |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P0 | acme-large-20260801, prompt intake-v7 (production today) | 94.1% (±0.3) | 100% (50/50) | 93.0% | 0.7% | 0.88 (42/48) | 3.4 s | $41,000 |
| P1 | acme-small-20260515, prompt intake-v7 | 88.2% (±0.5) | 92% (46/50) | 84.1% | 3.9% | 0.63 (30/48) | 0.7 s | $4,300 |
| P2 | acme-small-20260515, intake-v7 plus 8 retrieved examples | 91.3% (±0.4) | 96% (48/50) | 89.0% | 2.1% | 0.71 (34/48) | 0.9 s | $7,900 |
| A1 | acme-small-20260515 plus LoRA adapter on intake-train v4 (6,200 human-labeled) | 93.4% (±0.6) | 98% (49/50) | 92.2% | 0.9% | 0.85 (41/48) | 0.6 s | $4,600 |
| A2 | acme-small-20260515 plus LoRA adapter on intake-train v4 and 25,900 teacher-labeled tickets | 94.0% (±0.5) | 98% (49/50) | 93.1% | 1.6% | 0.77 (37/48) | 0.6 s | $4,600 |

The ± figures are half the spread across the three runs or three seeds, given for queue accuracy only. Unsupported values are counted over the 760 acceptance fields whose reference is null. The adapter rows give the mean of three seeds; the counts for each seed on the three lines with the smallest margins follow.

| Seed | Security recall | needs_human recall | Unsupported values |
|---|---:|---:|---:|
| A1 tune-0912-s1 | 50/50 | 40/48 | 6/760 |
| A1 tune-0912-s2 | 49/50 | 41/48 | 7/760 |
| A1 tune-0912-s3 | 48/50 | 42/48 | 8/760 |
| A2 tune-0918-s1 | 49/50 | 36/48 | 11/760 |
| A2 tune-0918-s2 | 49/50 | 37/48 | 12/760 |
| A2 tune-0918-s3 | 49/50 | 38/48 | 13/760 |

```yaml
training_records:
  A1:
    run_ids: [tune-0912-s1, tune-0912-s2, tune-0912-s3]
    code: intake-train-pipeline commit 91ac0f3
    data: intake-train v4 (manifest sha256 prefix 2d7e9b41)
    base: acme-small-20260515
    method: LoRA, rank 16, 3 epochs, learning rate 1e-4   # learning rate: the optimizer's step size
    checkpoint_choice: lowest dev loss, chosen on intake-dev v2
    cost_per_training_run_usd: 380
  A2:
    run_ids: [tune-0918-s1, tune-0918-s2, tune-0918-s3]
    code: intake-train-pipeline commit 91ac0f3
    data: intake-train v4 plus distill-pool v1
    distill_pool: >
      28,000 unlabeled tickets from 2026-01-02 to 2026-06-30, accounts disjoint
      from dev and acceptance, labeled by acme-large-20260801 with intake-v7;
      kept 25,900 that passed the schema and the order-id rule check
    teacher_needs_human_rate_in_kept_set: 0.021   # 0.07 in the human-labeled set
    base: acme-small-20260515
    method: LoRA, rank 16, 2 epochs, learning rate 1e-4
    checkpoint_choice: lowest dev loss, chosen on intake-dev v2
    cost_per_training_run_usd: 1900
```

Slices on the acceptance set, mean of the three runs or seeds:

| Slice | n | P0 | P2 | A1 | A2 |
|---|---:|---:|---:|---:|---:|
| Tickets naming the Teams Plus plan (launched 2026-08-25), plan field accuracy | 34 | 91% | 88% | 71% | 74% |
| German and French tickets, queue accuracy | 66 | 92% | 87% | 85% | 86% |
| Tickets from accounts created after 2026-06-30, queue accuracy | 112 | 93% | 90% | 92% | 93% |

Notes recorded with the run:

- A1 and A2 send the prompt intake-min v1, which drops the plan catalog that intake-v7 carries. The team removed it to cut input tokens.
- Inference cost for A1 and A2 assumes acme-tune's hosted adapter serving at the same per-token price as acme-small, plus a fixed $600 a month adapter hosting fee, which is included in the $4,600. Retraining is not in this column; the ownership ledger prices it.
- acme-small-20260515 is Active on acme's platform. Its retirement date is listed as not before 2027-05-15. An adapter trained on it does not carry over to a successor base.
