---
title: Fixture trace, a pinned model with nothing measuring it
origin: synthetic
kind: trace
tool: aie-fixture-harness
version: "0.1.0"
checkedOn: 2026-10-03
summary: A synthetic OpenTelemetry-style trace written for the Phase 1 fixture module. The failure is planted on purpose. Not a measured result from any real system.
---

This trace is synthetic. It was written for the Models module's exercises and shows one run of a fictional support assistant. The vendor, the model id, the prices, and the numbers are invented. The shape follows OpenTelemetry's GenAI conventions, which are still marked Development, so attribute names like these move. Read it the way you would read a real trace: start at the root span, then follow the model call.

```json
{
  "resource": {
    "service.name": "support-assistant",
    "service.version": "1.4.2",
    "deployment.environment": "production"
  },
  "spans": [
    {
      "name": "support.answer_ticket",
      "span_id": "a1",
      "parent_span_id": null,
      "start": "2026-10-01T09:14:02.110Z",
      "end": "2026-10-01T09:14:05.921Z",
      "attributes": {
        "ticket.id": "T-48811",
        "harness.config_source": "config/models.yaml",
        "harness.eval_suite": null,
        "harness.last_eval_run": null
      }
    },
    {
      "name": "gen_ai.chat",
      "span_id": "a2",
      "parent_span_id": "a1",
      "start": "2026-10-01T09:14:02.300Z",
      "end": "2026-10-01T09:14:05.700Z",
      "attributes": {
        "gen_ai.system": "acme",
        "gen_ai.request.model": "acme-large-20250301",
        "gen_ai.response.model": "acme-large-20250301",
        "gen_ai.usage.input_tokens": 1842,
        "gen_ai.usage.output_tokens": 236,
        "acme.response.header.deprecation": "model acme-large-20250301 retires 2026-11-30; replacement acme-large-20260801",
        "acme.response.header.notice_first_seen": "2026-09-30"
      }
    },
    {
      "name": "support.validate_output",
      "span_id": "a3",
      "parent_span_id": "a1",
      "start": "2026-10-01T09:14:05.700Z",
      "end": "2026-10-01T09:14:05.900Z",
      "attributes": {
        "validation.schema": "answer.v2",
        "validation.result": "pass"
      }
    }
  ]
}
```

The config the root span points at, also fictional:

```yaml
# config/models.yaml
primary:
  provider: acme
  model: acme-large-20250301
  reasoning_effort: medium
fallback: none
evals: none
```

Three places to look: the request model attribute on the chat span, the deprecation header the vendor started returning on 2026-09-30, and the two null harness attributes on the root span.
