---
title: Pull request 2291, faithfulness rubric change
origin: synthetic
kind: document
checkedOn: 2026-10-09
summary: A synthetic pull request on a fictional claims-intake assistant, described by its author as a faithfulness rubric change, with its diff, eval report, and review. A process failure is planted on purpose. Not a real change.
---

This pull request is synthetic. The insurer (Brightwater Mutual), the vendor (Veltra), the model ids, the people, and the numbers are invented. It follows the review of experiment record EXP-0412 by two weeks. Read it the way a reviewer would: description, diff, eval report, then the approval.

```text
#2291  Intake: tighten faithfulness rubric, refresh judge examples
Author: dev-k (claims-intake)    Reviewers: dev-m (claims-intake)    Base: main

Follow-up to the EXP-0412 review, which held the upgrade on the
faithfulness regression.

The old faithfulness rubric was too strict. It failed summaries that
were fine, which is most of why the candidate looked worse. This
tightens the rubric and refreshes the judge examples to match.

Eval run attached. Faithfulness is up 8 points. No other changes.
```

```diff
--- a/config/models.yaml
+++ b/config/models.yaml
@@ -3,3 +3,3 @@ intake:
-  model: veltra-m-20260612
+  model: veltra-m-20260904
   effort: default
   prompt: intake-prompt-v14
--- a/graders/faithfulness_judge.md
+++ b/graders/faithfulness_judge.md
@@ -1,5 +1,5 @@
-# Faithfulness judge g7
+# Faithfulness judge g8
 Compare the loss summary with the claimant's notes. Answer PASS or FAIL.
 FAIL if the summary states a fact the notes do not support.
-FAIL if the summary drops a qualifier the claimant used (approximate,
-uncertain, reported by someone else) and states the fact as certain.
+Minor omissions of hedging language are acceptable when the core
+facts are correct.
@@ -22,2 +22,2 @@ ## Examples
-[example 3: summary drops "I think it was Tuesday"; label FAIL]
-[example 5: summary drops "the neighbor says"; label FAIL]
+[example 3: summary drops "roughly 2 pm"; label PASS]
+[example 5: summary drops "I think it was Tuesday"; label PASS]
```

```text
Eval report attached to #2291
  case set: intake-eval v9 (420 cases), 3 trials per case

                         main            this branch
  run                    run-7731..7733  run-7790..7792
  run date               2026-09-16      2026-10-06
  model                  veltra-m-20260612   veltra-m-20260904
  faithfulness grader    g7              g8
  summary faithfulness   86.7%           94.8%   (+8.1)
  fraud escalation       87.5%           83.3%   (-4.2)
  overall                89.5%           93.1%   (+3.6)

  judge calibration: g8 not calibrated (no labeled set run)
```

```text
CODEOWNERS (excerpt)
  /config/        @claims-intake
  /prompts/       @claims-intake @claims-quality
  /graders/       @claims-quality

Branch protection on main: 1 approving review required.
Require review from code owners: off.
```

```text
Review by dev-m: Approved.
"Faithfulness +8 and overall +3.6. The rubric was always a bit harsh.
Ship it before the vendor's preview window closes."
```
