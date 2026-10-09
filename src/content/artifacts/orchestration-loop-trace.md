---
title: Billing investigator, one bounded loop with its stop condition
origin: synthetic
kind: trace
tool: acme-agent-harness
version: "2.3.0"
checkedOn: 2026-10-09
summary: "A synthetic OpenTelemetry-style trace of a bounded agent loop inside one workflow stage, with its harness config. Written for the Orchestration workshop. Not a measured result from any real system."
---

This trace is synthetic. It was written for the Orchestration module and shows one run of a fictional billing assistant. The company, the vendor, the model id, the ticket, and every number are invented. The span shape follows the style of OpenTelemetry's GenAI semantic conventions, which had moved to their own repository with no release on 2026-10-09, so attribute names like these move. Attributes under `gen_ai.` follow those conventions. The resource attributes and `error.type` are general OpenTelemetry attributes. Every attribute under `harness.` is this fictional harness's own.

The billing assistant is a four-stage workflow: intake, investigate, approve, notify. Only the investigate stage runs a model-directed loop. The other three stages are ordinary code. The config below governs the loop.

```yaml
# harness/billing-investigator.yaml (fictional)
stage: investigate
model: acme-medium-20260601
limits:
  max_turns: 10
  max_tool_calls: 16
  max_total_tokens: 120000
  deadline_ms: 38000          # 45 s run deadline, minus intake and notify; a support rep is watching the console
  no_progress_turns: 2        # stop after two turns that add no new evidence id
tools:
  read_only: [get_ticket, list_charges, get_payment_events, search_policy, get_draft_by_key]
  side_effecting:
    draft_refund_proposal:
      idempotency_key: "<ticket_id>:refund:<charge_id>"   # built by the harness, not the model
      timeout_ms: 8000
      on_timeout: reconcile with get_draft_by_key before any retry
      max_retries: 1
  escalation: escalate_to_human
guards:
  pre_tool:
    draft_refund_proposal: amount <= policy BIL-12 auto_draft_limit (100.00)
permissions:
  list_charges: cards on file for the ticket's customer only   # other payment methods belong to the payments team
stop:
  success: a confirmed draft with no open questions, or an escalation
  on_limit: escalate_to_human with the limit named as the reason
```

Every tool call the model requests counts toward `max_tool_calls`, denied calls included. The harness's own reconcile calls are counted separately, in `harness.harness_calls_used`.

The run, one span per line of work. Read the root span first, then each turn.

```json
{
  "resource": { "service.name": "billing-assistant", "service.version": "2.3.0", "deployment.environment.name": "production" },
  "spans": [
    { "span_id": "r0", "parent": null, "name": "invoke_agent billing-investigator",
      "start": "2026-10-06T14:02:11.000Z", "end": "2026-10-06T14:02:39.700Z",
      "attributes": { "harness.ticket.id": "T-20931", "harness.workflow.stage": "investigate", "harness.workflow.position": "2 of 4",
        "harness.limits.max_turns": 10, "harness.limits.max_tool_calls": 16,
        "harness.limits.max_total_tokens": 120000, "harness.limits.deadline_ms": 38000,
        "harness.turns_used": 7, "harness.tool_calls_used": 7, "harness.harness_calls_used": 1,
        "gen_ai.usage.input_tokens": 41906, "gen_ai.usage.output_tokens": 2118,
        "harness.elapsed_ms": 28700, "harness.stop_reason": "escalated" } },

    { "span_id": "t1", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 1, "gen_ai.usage.input_tokens": 3102, "gen_ai.usage.output_tokens": 212, "gen_ai.response.finish_reasons": ["tool_calls"] } },
    { "span_id": "x1", "parent": "t1", "name": "execute_tool get_ticket",
      "attributes": { "gen_ai.tool.name": "get_ticket", "harness.tool.args": { "ticket_id": "T-20931" },
        "harness.tool.result.summary": "Customer C-8812 reports two charges of 49.00 USD on 2026-10-02 for order O-55120. Also writes: 'and a third one on my other card'.",
        "harness.new_evidence_ids": ["T-20931"] } },

    { "span_id": "t2", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 2, "gen_ai.usage.input_tokens": 4210, "gen_ai.usage.output_tokens": 188 } },
    { "span_id": "x2", "parent": "t2", "name": "execute_tool list_charges",
      "attributes": { "gen_ai.tool.name": "list_charges", "harness.tool.args": { "customer_id": "C-8812", "days": 30 },
        "harness.tool.result.summary": "ch_9a1 49.00 at 09:15:03Z and ch_9a2 49.00 at 09:15:07Z, both order O-55120, card ending 4417.",
        "harness.new_evidence_ids": ["ch_9a1", "ch_9a2"] } },

    { "span_id": "t3", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 3, "gen_ai.usage.input_tokens": 5488, "gen_ai.usage.output_tokens": 240 } },
    { "span_id": "x3", "parent": "t3", "name": "execute_tool get_payment_events",
      "attributes": { "gen_ai.tool.name": "get_payment_events", "harness.tool.args": { "charge_id": "ch_9a2" },
        "harness.tool.result.summary": "Captured. Checkout client retried after a gateway timeout and sent a new request key, so the gateway treated it as a new payment.",
        "harness.new_evidence_ids": ["evt_ch_9a2_capture"] } },

    { "span_id": "t4", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 4, "gen_ai.usage.input_tokens": 6301, "gen_ai.usage.output_tokens": 196 } },
    { "span_id": "x4", "parent": "t4", "name": "execute_tool search_policy",
      "attributes": { "gen_ai.tool.name": "search_policy", "harness.tool.args": { "query": "duplicate capture refund" },
        "harness.tool.result.summary": "BIL-12: duplicate captures on one order within 60 seconds may be drafted for refund up to 100.00. Every refund needs human approval.",
        "harness.new_evidence_ids": ["BIL-12"] } },

    { "span_id": "t5", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 5, "gen_ai.usage.input_tokens": 7055, "gen_ai.usage.output_tokens": 402 } },
    { "span_id": "g5", "parent": "t5", "name": "guard pre_tool draft_refund_proposal",
      "attributes": { "harness.actor": "code", "harness.guard.rule": "amount <= 100.00", "harness.guard.input.amount": 49.00, "harness.guard.result": "allow" } },
    { "span_id": "x5", "parent": "t5", "name": "execute_tool draft_refund_proposal",
      "start": "2026-10-06T14:02:24.570Z", "end": "2026-10-06T14:02:32.570Z", "status": "ERROR",
      "attributes": { "gen_ai.tool.name": "draft_refund_proposal",
        "harness.tool.args": { "charge_id": "ch_9a2", "amount": 49.00, "reason": "duplicate_capture" },
        "harness.idempotency_key": "T-20931:refund:ch_9a2",
        "error.type": "timeout", "harness.tool.timeout_ms": 8000, "harness.outcome": "unknown" } },
    { "span_id": "h5", "parent": "t5", "name": "harness reconcile draft_refund_proposal",
      "attributes": { "harness.actor": "code", "gen_ai.tool.name": "get_draft_by_key",
        "harness.tool.args": { "idempotency_key": "T-20931:refund:ch_9a2" },
        "harness.tool.result.summary": "Draft D-7781 exists, status pending_approval, created 14:02:29.880Z.",
        "harness.outcome": "confirmed", "harness.retry": "skipped, outcome confirmed",
        "harness.new_evidence_ids": ["D-7781"] } },

    { "span_id": "t6", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 6, "gen_ai.usage.input_tokens": 7610, "gen_ai.usage.output_tokens": 310 } },
    { "span_id": "p6", "parent": "t6", "name": "harness permission list_charges",
      "attributes": { "harness.actor": "code",
        "harness.permission.rule": "payment_method scope: cards on file for the ticket's customer only; other payment methods belong to the payments team",
        "harness.permission.result": "deny" } },
    { "span_id": "x6", "parent": "t6", "name": "execute_tool list_charges", "status": "ERROR",
      "attributes": { "gen_ai.tool.name": "list_charges", "harness.tool.args": { "customer_id": "C-8812", "payment_method": "other" },
        "error.type": "permission_denied", "harness.tool.executed": false,
        "harness.tool.result.summary": "Denied by harness: payment methods other than this customer's cards on file are visible only to the payments team.",
        "harness.new_evidence_ids": [] } },

    { "span_id": "t7", "parent": "r0", "name": "chat acme-medium-20260601", "attributes": { "harness.turn": 7, "gen_ai.usage.input_tokens": 8140, "gen_ai.usage.output_tokens": 570 } },
    { "span_id": "x7", "parent": "t7", "name": "execute_tool escalate_to_human",
      "attributes": { "gen_ai.tool.name": "escalate_to_human",
        "harness.tool.args": { "ticket_id": "T-20931", "draft_id": "D-7781",
          "summary": "ch_9a2 is a duplicate capture caused by a client retry with a new key. Refund draft D-7781 is pending approval.",
          "open_question": "Customer mentions a third charge on another card. That card is outside what I am permitted to see, so I could not check it." },
        "harness.stop_reason": "escalated" } },
    { "span_id": "v7", "parent": "r0", "name": "check escalation_payload",
      "attributes": { "harness.actor": "code", "harness.check.schema": "escalation.v3", "harness.check.result": "pass", "harness.check.draft_exists": true } }
  ]
}
```

Four places to look: the limits on the root span, the evidence ids each tool call adds, the guard and reconcile spans under turn 5, and the denied turn 6 call that added nothing.
