---
title: Design doc, Dispute Desk, a six-agent crew for chargeback responses
origin: synthetic
kind: document
tool: none
checkedOn: 2026-10-09
summary: "A synthetic design doc for a multi-agent system, written for the Orchestration failure exercise with a decision flaw planted on purpose. The company, model names, and every number are invented. Not a real proposal or a measured result."
---

This design doc is synthetic. It was written for the Orchestration module's failure exercise. Fernhill Goods, its people, the vendor, the model names, and every number are invented. It is shaped like a real one-pager at the approval stage.

```text
Dispute Desk: a multi-agent crew for chargeback responses
Status: Proposed, approval requested 2026-10-01
Team: Payments platform
Reviewers: Payments ops lead, Staff engineer (platform), Finance controller
```

**1. Problem**

Fernhill receives about 600 chargeback disputes a month. Each needs a response packet sent to the card network within 7 days of the notice. An analyst spends about 35 minutes per dispute today. Goal: an analyst reviews a finished packet in about 10 minutes and submits it.

**2. What a response involves today**

From the analyst runbook, unchanged since 2024:

1. Read the dispute notice: reason code, amount, order id, dates.
2. Pull the order, payment, and shipping records for that order id.
3. Look up the evidence requirements for the reason code. Twelve reason codes cover 97 percent of volume. The runbook has one table row per code.
4. Check each requirement against the records: delivered, signed for, refund already issued, and so on.
5. If a refund was already issued, or a required item is missing, recommend accepting the dispute. Otherwise assemble the evidence packet.
6. Draft the response letter from the packet, using the network's template for that reason code.
7. The analyst reviews and submits.

**3. Proposed design**

Six agents, each with its own prompt, tools, and context window, talking through a shared message board.

| Agent | Role | Tools |
|---|---|---|
| Supervisor | Plans which agents to call and in what order, decides when the packet is done | message board |
| Intake | Parses the notice | notice parser |
| Evidence researcher | Gathers records | 9 tools: orders, payments, refunds, shipping, carrier tracking, customer, and three search tools |
| Policy analyst | Maps the reason code to its requirements | retrieval over the runbook |
| Writer | Drafts the letter | network templates |
| Critic | Scores the letter from 1 to 10 and sends it back until it scores 8 or more | none |

Agents pass each other summaries, not full histories, to keep each context window small.

**4. Why multi-agent**

- Specialization. Each agent gets a focused prompt and fewer tools.
- Parallelism. The evidence researcher and the policy analyst can work at the same time.
- Evidence. Anthropic reported that its multi-agent research system outperformed a single agent by 90.2 percent (June 2025).
- Flexibility. The supervisor can change the plan for unusual disputes.

**5. Alternatives considered**

| Option | Result |
|---|---|
| A. One agent with all 14 tools and the full runbook in its prompt | Prototype on 20 past disputes: 13 acceptable packets. Failures: wrong requirements for the reason code (4), records from the wrong order (2), letter missing the tracking number (1). |
| B. Status quo, analysts only | 35 minutes per dispute |

Decision: build the six-agent crew.

**6. Data flow**

| Agent | Needs | Produces |
|---|---|---|
| Intake | notice | reason code, order id, amount, deadline |
| Policy analyst | reason code | requirements checklist |
| Evidence researcher | order id, requirements checklist (to know which records to fetch) | records |
| Supervisor | checklist, records | accept or contest |
| Writer | notice, checklist, records, decision | letter |
| Critic | letter, checklist, records | score and comments |

**7. Cost and latency**

| | Prototype A | Dispute Desk, estimated |
|---|---|---|
| Tokens per dispute | 24k | 160k to 220k |
| Wall clock per dispute | 70 s | 4 to 9 min |
| Model | acme-large | acme-large (supervisor, critic), acme-small (others) |

Latency is acceptable because packets are prepared in the background.

**8. Risks**

| Risk | Mitigation |
|---|---|
| Agents disagree on accept or contest | Supervisor decides |
| Writer and critic loop for a long time | Cap at 5 rounds |
| Details lost between agents | Tune the summaries during the pilot |
| Hard to debug | Add tracing in phase 2 |

**9. Evaluation and rollout**

- Pilot metric: critic score of 8 or more on 90 percent of disputes.
- Analysts spot-check 10 percent of packets.
- Build all six agents in Q4. Pilot in January.
