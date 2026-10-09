---
title: Postmortem draft, release 2.8.0 billing regression, illustrative
origin: synthetic
kind: incident
tool: none
checkedOn: 2026-10-09
summary: A synthetic postmortem draft for a fictional support assistant, with its release manifest, prompt diff, timeline, one trace, and action items. Written for the exercise. Not a real incident or a measured result.
---

This postmortem draft is synthetic. It was written for the Operating it workshop. Quillmark, the support assistant, the "acme" vendor, both model ids, and every number are fictional. The trace follows the shape of OpenTelemetry's GenAI conventions, which are marked Development, so attribute names like these move. The draft is the team's first version, written on 2026-10-06 and not yet reviewed. You are the reviewer.

**Summary, as drafted.** Between 2026-09-21 and 2026-10-02, the support assistant gave customers wrong refund timelines on billing questions. Root cause: the new small model, acme-small-20260615, cannot handle billing questions. We rolled the router back on 2026-10-02. The incident is resolved.

**Release manifest for 2.8.0.**

```yaml
release: support-assistant 2.8.0
built: 2026-09-19
code: git 4e1c9a2
prompt: support-system v14          # was v13
models:
  primary: acme-large-20260801      # unchanged
  triage: acme-small-20260615       # new
  route_rule: "send to triage when the ticket classifier says simple"
retrieval:
  index: help-center snapshot 2026-09-18   # was 2026-09-04
  ingestion: help-center-sync v3            # was v2; v3 syncs articles in every state
tools: v6                           # unchanged
eval:
  suite: regression v9
  cases: 412                        # 31 of them billing
  result: 97.1% pass                # 2.7.3 baseline 97.6%
rollout:
  canary_metrics: [api_error_rate, p95_latency]
  stages: ["5% 2026-09-21", "25% 2026-09-22", "100% 2026-09-23"]
rollback:
  unit: router config only
```

**Prompt diff, v13 to v14, excerpt.**

```diff
+ Current date and time: {now_iso}
  You are Quillmark's support assistant. Be concise and friendly.
  ...
- For refund status, always call lookup_order before answering.
+ For refund status, answer from the help center when the article is clear.
+ Call lookup_order if you need order details.
```

**Timeline.**

- 2026-09-21 09:00. Canary at 5%. Error rate and p95 latency inside thresholds.
- 2026-09-22 09:00. 25%. Canary metrics inside thresholds.
- 2026-09-23 09:00. 100%.
- 2026-09-30 16:20. A support team lead posts: "Lots of angry refund reopens this week. Is the bot telling people 3 to 5 days again?"
- 2026-10-01 10:40. Incident declared, severity 3. Judge pass rate on sampled billing conversations: 71%.
- 2026-10-02 14:10. Router rolled back to the 2.7.3 setting: every request to acme-large-20260801. Prompt v14 and index snapshot 2026-09-18 stay in place.
- 2026-10-03. Billing conversations resolved by the assistant: 61%. Baseline under 2.7.3: 74%.
- 2026-10-05. Dashboard snapshot.
- 2026-10-06. This draft.

**Evidence, one trace from 2026-09-26, excerpt.** Message content is not captured; content capture is off in production.

```json
{
  "resource": { "service.name": "support-assistant", "service.version": "2.8.0" },
  "spans": [
    {
      "name": "invoke_agent support-assistant",
      "span_id": "b1",
      "parent_span_id": null,
      "attributes": {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.conversation.id": "conv-77310",
        "app.ticket.category": "billing",
        "app.prompt.version": "support-system v14",
        "app.outcome": "resolved",
        "app.outcome.reopened_within_7d": true
      }
    },
    {
      "name": "classify ticket",
      "span_id": "b2",
      "parent_span_id": "b1",
      "attributes": { "app.classifier.label": "simple", "app.route": "triage" }
    },
    {
      "name": "retrieval help-center",
      "span_id": "b3",
      "parent_span_id": "b1",
      "attributes": {
        "gen_ai.operation.name": "retrieval",
        "app.index.snapshot": "2026-09-18",
        "app.retrieval.top_doc.id": "hc-1182",
        "app.retrieval.top_doc.title": "Refund timing",
        "app.retrieval.top_doc.status": "archived",
        "app.retrieval.top_doc.updated": "2024-11-02"
      }
    },
    {
      "name": "chat acme-small-20260615",
      "span_id": "b4",
      "parent_span_id": "b1",
      "attributes": {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "acme",
        "gen_ai.request.model": "acme-small-20260615",
        "gen_ai.usage.input_tokens": 7412,
        "gen_ai.usage.cache_read.input_tokens": 0,
        "gen_ai.usage.output_tokens": 188,
        "gen_ai.response.finish_reasons": ["stop"]
      }
    },
    {
      "name": "validate_output",
      "span_id": "b5",
      "parent_span_id": "b1",
      "attributes": { "app.validation.schema": "reply.v3", "app.validation.result": "pass" }
    }
  ]
}
```

No execute_tool span appears in this trace. The current refund policy article, hc-2290, says refunds post within 10 business days. The archived article hc-1182 says 3 to 5.

**Impact, as drafted.** A keyword search of the chat platform's stored transcripts, the replies customers saw, which are kept apart from traces, finds 1,180 billing conversations between 2026-09-21 and 2026-10-02 that state "3 to 5 business days".

**Action items, as drafted.**

1. Keep acme-small away from billing tickets. Owner: ML lead.
2. Turn on full prompt and response logging for every conversation, retained 180 days, so we can debug faster next time. Owner: platform.
3. Add an LLM judge that rates every conversation's helpfulness from 1 to 10. Owner: QA.
4. Add a cost per completed task panel to the dashboard. Owner: platform.
5. Close the incident.
