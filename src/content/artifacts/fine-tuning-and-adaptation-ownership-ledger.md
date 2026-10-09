---
title: Ticket intake, ownership ledger
origin: synthetic
kind: table
tool: none
checkedOn: 2026-10-09
summary: A synthetic ledger of what a fictional team would own and pay for under each ticket-intake option, beyond inference. Written for this module. The vendor, prices, and effort figures are invented, not measured.
---

This ledger is synthetic. Quillfern, the vendor "acme", its tuning service "acme-tune", the prices, and the effort estimates are invented. It sits beside the experiment records and answers the question those records do not: what does each option cost to keep, month after month, after the comparison is over.

```yaml
ledger: intake-ownership-2026-09
volume: 1.2 million tickets per month
recent_change_rate:
  queue_taxonomy_changes_last_12_months: 3
  plans_launched_last_12_months: 2
  deletion_requests_touching_training_data_per_month: about 40
effort_unit: engineer-days, at the team's own estimate
```

| | P0: large model, prompted | P2: small model, retrieved examples | A1: small model plus hosted adapter | A1 self-hosted: same adapter on own GPUs |
|---|---|---|---|---|
| What you own | A prompt and an eval suite | A prompt, an example pool, an example retriever, an eval suite | All of P2's except the retriever, plus a training set, a training pipeline, adapter versions | All of A1's, plus serving, capacity, and upgrades |
| Inference per month | $41,000 | $7,900 | $4,600, including $600 adapter hosting | $3,100 in reserved GPU capacity at current load, with no scale to zero |
| A taxonomy change | Edit prompt, rerun suite: 2 days | Edit prompt, relabel about 300 pool examples, rerun suite: 4 days | Relabel about 800 training tickets, retrain three seeds, rerun suite: 8 days | As A1, plus redeploy: 9 days |
| A new plan launches | Add it to the plan catalog in the prompt: 1 day | Same as P0: 1 day | Same as P0 if the adapter's prompt carries the catalog; otherwise relabel and retrain: 8 days | As A1 |
| A deletion request touching training data | Nothing in weights | Delete the example row: minutes | Remove the ticket, retrain on the next weekly batch, about 4.3 batches a month. One seed: $380 plus a $60 suite run, about $1,900 a month. Three seeds, each with its suite run: about $5,700 a month | As A1, plus GPU hours instead of the $380 |
| Base model retirement | Migrate the prompt to a successor: the Models runbook | Same as P0 | Retrain the adapter on the successor base, re-evaluate everything: 10 days | The weights do not retire, but the serving stack, drivers, and security patches stay yours |
| Rollback path | Previous prompt version | Previous prompt or pool version | Previous adapter, or P2 as a fallback | Previous adapter, or P2 through the hosted API |
| Skills the team needs | Prompting, evals | Plus retrieval | Plus reading training curves, data versioning | Plus GPU serving and on-call for it |

Notes:

- acme-tune's terms, as the team read them on 2026-09-20, allow adapter training on acme-small-20260515 until its retirement. The terms do not promise that tuning will be offered on the successor.
- Effort figures are the team's estimates from the last taxonomy change, which took 7 days for a smaller adapter in a pilot. They are not measured for A1.
- The team has not decided whether a weekly deletion retrain needs one seed or three. The candidate comparison used three.
- The ledger does not price the labeling already done: 6,200 tickets by two leads plus adjudication, about $14,000 of support time.
