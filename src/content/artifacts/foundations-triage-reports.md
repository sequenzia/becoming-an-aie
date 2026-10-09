---
title: Two ticket-triage reports, v3 against v4
origin: synthetic
kind: eval-report
tool: acme-evalkit (fictional)
version: "2.3.0"
checkedOn: 2026-10-09
summary: Two synthetic evaluation reports on the same pair of ticket classifiers, written for the Foundations workshop. The vendor, model, prompts, and numbers are invented. Not a measured result from any real system.
---

These reports are synthetic. They describe a fictional retailer's ticket-triage classifier, which routes each incoming support ticket to one of five queues. Production runs triage-v3. A teammate has proposed triage-v4, which changes the prompt and one threshold. Two different people wrote the two reports below, a few days apart, and both are now being cited in the ship decision. The vendor "acme", the model, and every number are invented. The arithmetic inside each report is internally consistent.

Report A, from the team's weekly update.

```text
TRIAGE WEEKLY  2026-09-29
Headline: triage-v4 beats production by 2.8 points. Recommend ship on 2026-10-13.

                     triage-v3 (production)      triage-v4 (candidate)
eval sample          July 2026 traffic           September 2026 traffic
size                 1,000 tickets, random       1,200 tickets, random
labels               one annotator               one annotator
accuracy             87.4%  (874 / 1,000)        90.2%  (1,082 / 1,200)

per category         July n   v3 correct  v3 acc    Sept n   v4 correct  v4 acc
password_reset          180         176    97.8%       492         482    98.0%
billing                 300         258    86.0%       290         252    86.9%
shipping                250         220    88.0%       220         194    88.2%
refund                  200         164    82.0%       150         120    80.0%
account_security         70          56    80.0%        48          34    70.8%

note: September traffic includes the 2026-09-08 login outage.
```

Report B, from the evaluation pipeline.

```text
EVAL RUN  er-2026-10-02-114
suite     triage-frozen-0826
          600 tickets, one per conversation, sampled at random from
          2026-07-01 to 2026-08-26 traffic. Two annotators per ticket;
          disagreements adjudicated by the support lead.
systems   triage-v3  acme-large-2, prompt p31, security threshold 0.35
          triage-v4  acme-large-2, prompt p44, security threshold 0.50 (1)
trials    1 per ticket per system
interval  paired bootstrap, 10,000 resamples of tickets, 95%

overall              v3              v4              v4 - v3    95% interval
accuracy             86.5% (519)     86.8% (521)     +0.3 pts   -2.0 to +2.7
discordant pairs     v3 right, v4 wrong: 25     v4 right, v3 wrong: 27

per category    n     v3 acc   v4 acc   v3 only   v4 only   v4 - v3    95% interval
password_reset  110   97.3%    97.3%       1         1       0.0 pts   -2.7 to +2.7
billing         170   83.5%    89.4%       4        14      +5.9 pts   +1.2 to +10.6
shipping        140   87.9%    88.6%       5         6      +0.7 pts   -3.6 to +5.7
refund          140   81.4%    79.3%       8         5      -2.1 pts   -7.1 to +2.9
account_security 40   82.5%    67.5%       7         1     -15.0 pts  -30.0 to -2.5

account_security as a binary decision (security vs everything else, n = 600)
                     TP    FP    FN    TN    precision   recall   F1
triage-v3            33    12     7   548    0.733       0.825    0.776
triage-v4            27     5    13   555    0.844       0.675    0.750

repeatability: a second run of triage-v4 on the same 600 tickets changed
17 labels (2.8%). Accuracy on the second run: 86.3% (518 / 600).

(1) p44 raised the security threshold from 0.35 to 0.50, at the security
    team's request, to reduce false escalations into their queue.
```

Context from the support operations runbook, also fictional:

```text
queue targets
  account_security   first response within 1 hour (possible account takeover)
  general queues     median first response 6 hours
rerouting cost
  a ticket in the wrong general queue: about 5 minutes of agent time
  a non-security ticket in the security queue: about 5 minutes of analyst time
  a security ticket in a general queue: waits for general first response
```
