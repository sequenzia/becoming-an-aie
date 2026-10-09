---
date: 2026-10-09
title: The self-assessment, the five electives, and three labs open
---

This entry records the Phase 3 commit. Every module in the program is now published. Each passed the content check with every rule applied. Reading times leave out the workshop, the failure exercise, and the optional lab.

What opened:

- Self-assessment, about 10 minutes of reading. It explains how the assessment works, the six areas, and what happens after the plan. The tool itself is at `/assessment` and needs you signed in, because it saves your answers and your plan. You rate yourself on what transfers and what is new in each area, answer three context questions, and get a four-step plan for up to three areas with the largest gaps. The steps follow the talk's roadmap, apply it to the feature you name, and link to the section of the area module that teaches each step. You can edit the plan, download it as Markdown, and retake the assessment later; each retake is a new dated version. Generating a plan completes the module.
- Fine-tuning, distillation, and model adaptation, 51 minutes.
- Inference and hosting fundamentals, 53 minutes.
- Multimodal systems, 51 minutes.
- Working on an AI engineering team, 55 minutes.
- Building your career and continuing to learn, 48 minutes.

Each elective has a workshop, a failure exercise with a planted failure, a self-check of twelve questions, and a dated source list. Electives have no prerequisites. Vendor and tool facts were checked on 2026-10-09 and are stated as true on that day. Where a source could not be read again, its note says so.

Labs. Three optional Python labs, each a small standalone project under `labs/` in the public repository. They never count toward completion. With no API key each one shows its plan and stops; a paid run costs cents and prints its estimate first.

- First measurable feature, with Models: ticket triage on 24 synthetic tickets, a rules baseline, then one model call per ticket, scored with a confusion matrix.
- A tool contract with validation, with Tools and extensibility: one order-lookup tool, a validator for schema, rules, and the signed-in customer's scope, and typed errors.
- Review outputs and write a first grader, with Verification and evals: label 30 synthetic replies by hand, build a failure taxonomy, and measure a first code grader against your labels.

Artifacts: 19 new cards across the five electives, all synthetic. They were written for the exercises, the failures in them are planted on purpose, and they use fictional companies, vendors, and model ids. None is a measured result. No artifact in this release is public or captured, so none needed a review date. The self-assessment has no artifacts.

Also changed:

- Foundations, Models, Context and knowledge, and Orientation now link to the electives and the self-assessment where they name them. The electives link to each other the same way.
- Models, Tools and extensibility, and Verification and evals each gained an Optional lab section. Nothing else in them changed.

Reading any module needs no account. Signing in saves your workshop and failure responses, keeps your self-check results, shows your progress in the catalog, and opens the self-assessment tool.
