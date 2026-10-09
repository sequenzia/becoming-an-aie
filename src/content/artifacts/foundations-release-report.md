---
title: Release report for a fine-tuned intent classifier
origin: synthetic
kind: eval-report
tool: acme-tune (fictional)
version: "1.8.1"
checkedOn: 2026-10-09
summary: A synthetic release report written for the Foundations failure exercise. A foundations failure is planted in it on purpose. The vendor, model, data, and numbers are invented. Not a measured result from any real system.
---

This report is synthetic. A fictional retailer's team adapted a small model to classify the intent of support messages and wants it to replace the prompted classifier in production. The vendor "acme", the models, the data, and every number are invented, and the failure in it is planted on purpose. Read it as you would read a real release report from a teammate.

```text
RELEASE REPORT  intent-ft-3
author          applied ML, support platform
date            2026-10-06
decision asked  replace production intent classifier (intent-v2) on 2026-10-20

1. DATA
source          support messages, 2026-01-02 to 2026-08-31
size            14,212 labeled messages from 1,903 customer accounts
                (after removing 312 exact-duplicate messages)
labels          8 intents, one annotator per message
messages per    median 5, p90 19, max 212 (reseller account RS-0041,
account         which files tickets from its own order template)
split           random 85 / 15 over messages, seed 7
                train 12,080   held-out 2,132

2. TRAINING
base model      acme-small-base
method          supervised fine-tuning, 4 epochs, 9 checkpoints saved
selection       checkpoint 7 of 9: highest held-out accuracy

3. RESULTS
                          accuracy   n
train (final epoch)       99.4%      12,080
held-out                  97.9%      2,132   (2,087 correct)
intent-v2 on held-out     89.6%      2,132   (1,910 correct; prompted acme-large-2)

improvement over production: +8.3 points

4. SLICES (held-out)
by intent               all intents above 95% except "other" (91.2%, n = 68)
by account history      account has messages in train   98.4%   n = 2,071
                        account has none in train       82.0%   n = 61
                        intent-v2 on these slices       not computed

5. CONTEXT
September 2026 traffic: 31% of tickets came from accounts created after
2026-08-31.
Most common message pattern: "Order #_____ was charged twice, please
refund." 1,140 messages, differing only in the order number.

6. CONCLUSION
The model generalizes: held-out accuracy is within 1.5 points of
training accuracy, and it beats production by 8.3 points on the same
held-out set. Recommend replacing intent-v2 on 2026-10-20.
```
