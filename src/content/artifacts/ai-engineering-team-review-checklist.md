---
title: Review checklist for a change to model-dependent behavior
origin: synthetic
kind: document
checkedOn: 2026-10-09
summary: A synthetic review checklist for pull requests that change prompts, tool descriptions, datasets, graders, retrieval, or models. Written for this module as a starting point. Not a published standard and not a measured result.
---

This checklist is synthetic. It was written for this module from the practices the module cites, and it is a starting point for your own team's version, not a standard anyone has published. Copy it into your repository, cut what does not apply, and add the checks your domain needs.

The checklist assumes three things exist: an eval suite with categories, a configuration file that names every behavioral dependency, and a named owner for the eval set and for each grader.

**1. Every behavior change, before review**

- The description names the kind of change, from the table below. A pull request that is two kinds is two pull requests, unless the description says why they cannot be separated.
- The description states what behavior should change and what should not.
- An eval run is attached. It names the configuration it ran: model id, effort, prompt version, tool schema version, index snapshot, case set version, grader versions, number of trials.
- The baseline in the comparison was run with the same case set version and the same grader versions as the candidate, close enough in time that the vendor side has not moved.
- Results are reported per category, with the run-to-run range, beside cost per completed task and p95 latency.
- The cases that changed verdict, in either direction, are listed by id.

**2. By kind of change**

| Kind of change | Evidence the reviewer needs | Who must approve |
|---|---|---|
| Prompt or instruction text | Eval run, per category; the changed cases read, not only counted | Application owner; domain reviewer when the wording encodes a domain rule |
| Tool description or schema | Tool-selection and argument cases from the suite, including cases where the tool should not be called | Application owner; owner of the tool's backend when the schema changes |
| Eval cases added or removed | Why each case was added or removed; the split it went into; no case moved from held-out into tuning | Eval set owner |
| Labels or reference answers | The adjudication note for each changed label; who decided | Domain reviewer, the named quality decision-maker |
| Grader code, judge prompt, or rubric | Agreement with expert labels on the held-out labeled split, before and after (TPR and TNR for a judge); the old and new grader run on the same stored outputs | Eval set owner and domain reviewer; never the author of the system change being graded alone |
| Model id, effort, or sampling setting | The model migration checks: eligibility, compatibility, the suite on both, the lifecycle status of the candidate | Application owner and operations owner |
| Retrieval index or ingestion | Retrieval cases measured separately from answer quality; the snapshot id recorded | Owner of the data source and application owner |

**3. Separation rules**

- Never change the instrument and the thing it measures in one comparison. A grader change and a model change are two experiments.
- When a grader must change, run the old and the new grader on the same stored outputs first. The difference is the grader's effect. Only then compare systems, with one grader held fixed.
- When two system changes must ship together, run each one alone as well, or record that their separate effects are unknown.
- Hold the case set version fixed across a comparison. Adding or removing cases changes the denominator.

**4. Reject, or send back, when**

- The attached run compares a new configuration with an old number from a different grader or case set version.
- The only evidence is an overall score.
- A rubric or label change makes a category pass that the domain reviewer flagged.
- The run was on recorded responses, not on the live configuration.
- Nobody on the review owns the eval set or speaks for the domain.

**5. After merge**

- The experiment record is updated with the decision, the reviewers, and the open questions.
- Any disagreement that was not resolved is written down with both positions and a date to revisit.
- Each next action has one owner and a date.
