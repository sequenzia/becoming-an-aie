---
title: A personal eval set and one run against a new release
origin: synthetic
kind: eval-report
tool: none
checkedOn: 2026-10-09
summary: A synthetic personal eval set of 24 cases in six categories, and the owner's notes from running it on a fictional model release. Written for this module. The vendor, models, and scores are invented and are not a measured result.
---

This artifact is synthetic. The engineer, the vendor (Larkspur), the model names, and every number are invented for the exercise. The format is what a careful engineer might keep in a private repository: a case file, a run summary, and a notes file written by hand.

The case file. Each case has an origin, a category, and a check. Only two of the 24 cases are shown in full.

```yaml
# evals/cases.yaml  (personal set, version 9, last edited 2026-09-28)
# Rules I keep: no employer data, no customer text. Every case is rewritten
# with invented names before it enters this file. Origin says where the
# failure was first seen, so I remember why the case exists.
categories:
  extract:      4 cases   # pull fields from messy text, code check against a reference
  unsupported:  4 cases   # the honest answer is "the source does not say"
  long-input:   4 cases   # the decisive fact sits in the middle of a long input
  tool-choice:  4 cases   # pick the right tool and arguments, code check on the call
  dates:        4 cases   # relative dates and time zones, code check
  cite:         4 cases   # every claim must be supported by a quoted passage, rubric, read by me

cases:
  - id: unsupported-03
    origin: "seen 2026-07-14 in a summarizer at work; rewritten with invented names"
    input: "Policy excerpt (1,900 words) + question: What is the refund window for annual plans?"
    note: "The excerpt covers monthly plans only."
    check:
      kind: rubric
      pass_if: "Says the excerpt does not state an annual-plan window. Does not invent a number."
  - id: dates-02
    origin: "seen 2026-05-02 in my own scheduling script"
    input: "Today is Friday 2026-10-30 in America/Chicago. Book it 'two weeks from Monday'."
    check:
      kind: code
      expected: "2026-11-16"
```

The run summary. Three runs per model, same cases, same prompt version, same checks.

```text
run 2026-10-06   prompt v5   cases v9 (24)   3 runs per model

category       lark-4-mini (current)     lark-5-mini (new release)
               passes per run            passes per run
extract        4, 4, 4                   4, 4, 4
unsupported    4, 4, 3                   2, 1, 2
long-input     2, 3, 2                   4, 4, 4
tool-choice    3, 3, 3                   4, 4, 4
dates          3, 3, 3                   4, 3, 4
cite           3, 3, 3                   3, 4, 3

total          19, 20, 18  (mean 19.0)   21, 20, 21  (mean 20.7)
```

The notes file, written by hand after reading every failed case.

```text
2026-10-06  lark-5-mini, first look

- Total up about 1.7 cases out of 24. Runs vary by 1 to 2 cases on both
  models, so the total alone does not settle anything.
- long-input and tool-choice: clean 4 of 4 on every run. Read all 24
  outputs. Real improvement, not luck in the grader.
- unsupported: down from about 4 to about 2. Read the seven failures. In
  six, the model gives a confident annual-plan window or a made-up
  clause number. Same failure shape every time. This is the category
  that hurt us in July.
- dates: one failure, run 2, wrong time zone. Same as lark-4-mini's
  old habit. Not new.
- Vendor release note says "improved long-context reasoning and tool
  use". True on my cases. Says nothing about declining to answer.
- Next: add 4 more unsupported cases before deciding anything. 4 cases
  is too few to tell 2 of 4 from 3 of 4. Re-run in a week.
```
