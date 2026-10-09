---
title: Release report for a distilled help-answer model
origin: synthetic
kind: eval-report
tool: acme-tune (fictional)
version: "2.3.0"
checkedOn: 2026-10-09
summary: A synthetic release report written for this module's failure exercise, with a failure planted on purpose. The company, vendor, models, data, and numbers are invented. Not a measured result from any real system.
---

This report is synthetic. Quillfern's help widget answers how-to questions from help-center articles that retrieval places in the prompt. A teammate distilled the production model into a small one and wants to switch. The vendor "acme", the models, the data, and every number are invented, and the failure in it is planted on purpose. Read it as you would read a real release report from a teammate.

```text
RELEASE REPORT  help-distill-2
author          applied AI, self-service
date            2026-10-02
decision asked  replace production help answers (help-v4) on 2026-10-20

1. SYSTEMS
production      acme-large-20260801, prompt help-v4, up to 3 retrieved
                help-center articles in the prompt
student         acme-small-20260515 + LoRA adapter help-distill-2,
                same prompt, same retrieval

2. TRAINING DATA
question bank   qbank v2: 1,180 how-to questions written by the docs team
prompts         9,000 questions
                  6,500 logged customer questions, 2026-01-02 to 2026-06-30
                  2,500 synthetic: acme-large wrote 5 paraphrases each of
                  500 seed questions sampled from qbank v2 (seed 11),
                  generated 2026-07-14
teacher         acme-large-20260801 with help-v4 answered every prompt
filter          kept answers with judge score >= 4 of 5
                kept 8,120 of 9,000
                teacher abstentions in kept set: 41 (0.5%)
training        LoRA rank 32, 3 epochs, checkpoint by lowest loss on
                help-dev v1 (300 logged questions, July 2026)

3. EVALUATION
eval set        help-eval v1: 500 questions sampled from qbank v2 (seed 3),
                frozen 2026-07-01
                440 answerable from the help center
                 60 unanswerable: no article covers them; the expected
                    answer says so and offers a handoff to a person
overlap check   exact match against the 9,000 training prompts: 0 overlaps
grader          judge: acme-large-20260801, rubric help-judge v1
                (helpfulness, clarity, tone; score 1 to 5)
pass            judge score >= 4

4. RESULTS                       production     student
judge score, mean                4.12           4.31
pass rate                        88.0%          92.4%    (+4.4 points)
answers with a citation          97%            99%
p95 latency                      2.9 s          0.8 s
cost per 1,000 answers           $6.10          $0.70

5. APPENDIX: SLICES
                                          production       student
answerable, pass                          389/440 88.4%    436/440 99.1%
unanswerable, pass                         51/60  85.0%     26/60  43.3%
unanswerable, says it cannot find it       51/60            9/60
shadow traffic, 2026-09-08 to 09-14,
  200 live questions, pass                86.5%            84.0%
claims not supported by the supplied
  articles, human check of 100 shadow
  answers per system                      3.1%             9.4%

6. CONCLUSION
The student beats production on quality (+4.4 points pass rate, +0.19
judge score) at a ninth of the cost and under a third of the latency.
No training question appears in the eval set. Recommend replacing
help-v4 on 2026-10-20.
```
