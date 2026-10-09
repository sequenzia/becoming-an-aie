---
title: Adaptation data record, ticket intake
origin: synthetic
kind: document
tool: none
checkedOn: 2026-10-09
summary: A synthetic data record for the training, development, and acceptance sets of a fictional ticket-intake adaptation. Written to show the fields a record needs. Not a measured result from any real system.
---

This record is synthetic. Quillfern, its support data, the vendor "acme", the model ids, and every count are invented for this module. The format is what a team would keep beside an adaptation dataset so that another engineer can rebuild it, audit it, and know what it cannot teach.

```yaml
record: intake-data-2026-09-22
task: >
  For each inbound support ticket, return the queue (billing, account_access,
  outage, security_report, how_to, other), three fields (order_id, plan,
  requested_action, each null when the ticket does not state it), and
  needs_human (true when the ticket is ambiguous or out of policy).
contract: intake-schema v5, label guideline intake-guide v3 (2026-06-10)

sets:
  train:
    name: intake-train
    version: 4
    tickets: 6200
    period: 2026-01-02 to 2026-06-30
    accounts: 2311
    use: adapter training only
  dev:
    name: intake-dev
    version: 2
    tickets: 400
    period: 2026-07-01 to 2026-08-31
    accounts: 371
    use: prompt changes, checkpoint choice, training settings (rank, epochs)
  acceptance:
    name: intake-accept
    version: 3
    tickets: 600
    period: 2026-09-01 to 2026-09-21
    accounts: 548
    use: final comparison only; never used to choose anything
    frozen: 2026-09-22
    sha256: 9f3c1e0a  # first eight characters of the manifest hash

split_rules:
  grouping_unit: account     # every ticket from one account sits in one set
  time_order: train < dev < acceptance, no overlap in dates
  account_overlap_check: 0 accounts in more than one set
  dedup_exact: 212 tickets removed (order-confirmation template)
  dedup_near: >
    embedding similarity >= 0.92 against every other set;
    31 dev and 9 acceptance tickets removed; removals listed in dedup-log v4
  access: >
    the training job's service account cannot read the acceptance bucket;
    acceptance results are written by the eval runner only

provenance_and_rights:
  source: production tickets from EU customers, processed in the EU region
  basis: >
    service-improvement clause of the customer terms, reviewed by legal on
    2026-05-28; enterprise accounts that opted out are excluded (184 accounts)
  personal_data: >
    names, emails, phone numbers, and card fragments replaced with typed
    placeholders before labeling; order ids kept, they are the task
  deletion: >
    deletion requests are applied to all three sets weekly; a request that
    touches intake-train also marks the trained adapter for retraining

labels:
  annotators: two support leads per ticket
  first_pass_agreement: queue 0.91, fields 0.88, needs_human 0.74
  adjudication: a third lead resolves every disagreement; notes kept per case
  ambiguous_policy: needs_human is true when the leads could not agree on the queue

coverage:
  by_queue_train: { billing: 1810, account_access: 1240, outage: 830,
                    security_report: 410, how_to: 1290, other: 620 }
  null_field_share_train: 0.41   # fields the ticket does not state
  needs_human_share_train: 0.07
  languages_train: { en: 0.94, de: 0.04, fr: 0.02 }

known_gaps:
  - plans launched after 2026-06-30 (Teams Plus, launched 2026-08-25) never
    appear in intake-train
  - German and French are 6 percent of training tickets and 11 percent of
    September traffic
  - security_report has 410 training tickets and 50 acceptance tickets; one
    acceptance case is 2 points of security recall
```
