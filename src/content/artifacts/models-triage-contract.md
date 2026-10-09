---
title: Ticket triage output contract and five outputs
origin: synthetic
kind: output-set
checkedOn: 2026-10-09
summary: A synthetic output schema for a fictional triage service, five model outputs, and what the schema check and the semantic checks said about each. Written for the Models module. Not a measured result.
---

This artifact is synthetic. The service, the tenants, and the outputs are invented. The schema is written in the shape structured-output features accept: a JSON Schema object with required fields, enums, and explicit nulls. The model is asked to fill it. The application then runs its own checks before anything enters application state.

```json
{
  "name": "triage_decision",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["tenant_id", "queue", "priority", "customer_order_id", "summary", "confidence"],
    "properties": {
      "tenant_id": { "type": "string", "description": "Copy from the ticket header. Never infer." },
      "queue": { "type": "string", "enum": ["billing", "account_access", "outage", "security_report", "other"] },
      "priority": { "type": "string", "enum": ["p1", "p2", "p3"] },
      "customer_order_id": { "type": ["string", "null"], "description": "Null when the ticket does not state one." },
      "summary": { "type": "string", "description": "One sentence, no more than 200 characters." },
      "confidence": { "type": "string", "enum": ["high", "low"] }
    }
  }
}
```

The application's semantic checks, run after the schema check:

1. `tenant_id` equals the tenant of the authenticated session that submitted the ticket.
2. `customer_order_id`, when not null, exists in that tenant's order table.
3. `queue` is `security_report` whenever the ticket matches the security keyword rule, whatever the model said.
4. `summary` is at most 200 characters. The schema cannot enforce length on every provider, so code does.

Five outputs from one evening's traffic, with the response status the API returned:

| Ticket | API status | Schema check | Semantic checks | What the application did |
|---|---|---|---|---|
| T-90211 | completed | pass | pass | Routed to billing, p3 |
| T-90214 | completed | pass | fail: tenant_id `t-0417` but session tenant `t-0471` | Rejected, sent to the manual queue |
| T-90219 | completed | pass | fail: order `A-55120` not found for tenant `t-0093` | Rejected, sent to the manual queue |
| T-90230 | completed, refusal field set | not applicable | not applicable | Sent to the manual queue with the refusal text |
| T-90233 | incomplete, reason max_output_tokens | fail: missing `confidence` | not run | Retried once with a larger limit, then passed |

T-90214 transposed two digits of a tenant id that appeared in the quoted email thread. T-90219 contained no order number. The model produced a plausible one anyway, even though the schema allowed null.
