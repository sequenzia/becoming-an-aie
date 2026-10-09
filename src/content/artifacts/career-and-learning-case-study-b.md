---
title: Portfolio case study B, the same project
origin: synthetic
kind: document
checkedOn: 2026-10-09
summary: A synthetic portfolio case study of the same ticket triage project, written around evidence. Written for this module. The project, vendors, numbers, and author are invented. Not a real portfolio or a measured result.
---

This case study is synthetic. It describes the same invented project as case study A, by the same invented author, after a rewrite. Every number is invented for the exercise. Read it as a reviewer would, including the method section.

```markdown
## Ticket triage for a fictional support team: what I built and what I measured

Context. A side project, built alone over seven weekends in August and
September 2026. Cedar Support Software is the fictional company from a
textbook blueprint. No real customer has used this system.

Task. Route an incoming support ticket to one of six queues: billing,
account, outage, bug, how-to, security. A wrong queue costs a reassignment.
A missed security ticket costs much more, so security has its own check.

Baseline. Keyword rules I wrote in an afternoon: 71% correct (107 of 150)
on the test set below.

Data. 600 invented tickets. I wrote a category spec, generated drafts,
then edited every ticket by hand. 150 are held out as a test set; the
other 450 are for development. I labeled all 600. A friend who works
in support labeled 100 of them independently. We agreed on 88 of 100.
Most disagreements were billing versus account.

System. One model call (Larkspur lark-4-mini, pinned, prompt v5) with a
JSON schema for the output. A keyword rule always sends tickets that
mention credentials or breaches to security, whatever the model says.
I tried a two-agent version (classifier plus reviewer). It scored the
same on the development set at 2.3 times the cost, so I removed it.

Method. I iterated the prompt over six rounds. After each round I ran
the 150 test tickets, read the errors, and kept the best prompt.

Results on the 150 test tickets, prompt v5, three runs:

| Queue    | Cases | Correct (mean of 3 runs) |
|----------|------:|-------------------------:|
| billing  |    38 |                       33 |
| account  |    29 |                       24 |
| outage   |    22 |                       21 |
| bug      |    27 |                       24 |
| how-to   |    25 |                       20 |
| security |     9 |                        7 |
| total    |   150 |              129 (86%)   |

Runs differed by at most 2 tickets. With 150 tickets, a rough 95%
interval on 86% is about plus or minus 5.5 points.

An early version scored 94% on the first 50 tickets I wrote. That set
was too easy (no multi-issue tickets, no other languages). I stopped
reporting it.

Failure analysis. I read all 21 errors from run 1 and grouped them:
- 9 billing versus account (the same split my labeler and I disagreed on)
- 6 tickets that raise two issues; the model picks the second one
- 4 tickets in Spanish or Portuguese, routed to how-to
- 2 security tickets routed to account
Both security misses were phrased as "someone else is using my account".
The keyword rule did not catch them. I added the phrase to the rule; that
change is not in the numbers above.

What the rationale field does. The model writes a one-line reason for
each decision. In 4 of 150 cases the reason names a policy that does not
exist. Rationales are for my debugging only and are never shown to a
customer.

What I did not measure. Workload or time saved: no real team used it.
Behavior on real tickets. Latency under load: p95 was 2.8 seconds from
my home connection, one request at a time. Cost: about $0.0011 per
ticket at Larkspur's list price on 2026-09-20.

Reproduce. The repository has the cases, the labels, the prompt
versions, and the recorded outputs. "make eval" replays the recorded
outputs. "make eval LIVE=1" calls the model and needs your own key.

What I would do next. A fresh test set the prompt has never seen. More
security cases: 9 is too few to say much about a 2-case difference.
```
