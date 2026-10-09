---
title: Context manifest for one call, a support assistant at turn 14
origin: synthetic
kind: table
tool: cedar-harness
version: "2.3.0"
checkedOn: 2026-10-09
summary: A synthetic per-call context manifest from a fictional support assistant, showing what filled the window with size, freshness, and provenance. Written for this module. Not a measured result from any real system.
---

This manifest is synthetic. It was written for the Context and knowledge module. The company, the harness, the vendor, the model id, the tenants, and every number are invented. The span shape loosely follows OpenTelemetry's GenAI conventions, and the `harness.context.*` attributes are the fictional harness's own. Read it as the owner of this assistant: what went into the call, why, and what the answer used.

The setting. Cedar's support assistant helps customer administrators with the Cedar Teams product. Session s-7731 belongs to an administrator at a customer whose tenant id is tenant-alder. At turn 14 the administrator asks how to rotate the SAML signing certificate without logging everyone out.

```json
{
  "name": "gen_ai.chat",
  "span_id": "c14",
  "parent_span_id": "s7731-t14",
  "start": "2026-09-16T14:22:07.412Z",
  "end": "2026-09-16T14:22:13.689Z",
  "attributes": {
    "gen_ai.system": "acme",
    "gen_ai.request.model": "acme-large-20260801",
    "gen_ai.usage.input_tokens": 79906,
    "gen_ai.usage.output_tokens": 512,
    "acme.usage.cache_read_input_tokens": 0,
    "harness.model.context_window": 200000,
    "harness.compaction.history_token_threshold": 60000,
    "harness.context.system_prompt.first_line": "Current time: 2026-09-16T14:22:07Z",
    "harness.context.order": [
      "system_prompt",
      "tool_definitions",
      "examples",
      "memory",
      "retrieved_passages",
      "history",
      "current_request"
    ]
  }
}
```

The manifest the harness logged for the same call, one row per component, in the order the components were assembled:

| Component | Tokens | Share | Freshness | Provenance | Used by this answer |
|---|---:|---:|---|---|---|
| System prompt, support-system v14 | 3,240 | 4.1% | Rendered per call; first line is the current time | prompts/support-system.md at v14 | Yes |
| Tool definitions, 22 tools | 14,880 | 18.6% | Registry snapshot 2026-09-01 | tools/registry.yaml | 3 of 22 tools called this session |
| Few-shot examples, 6 | 4,100 | 5.1% | Written 2026-01 | prompts/examples/billing-*.md | No; all 6 are billing refunds |
| Memory, 11 entries | 1,420 | 1.8% | Oldest 2026-02-11; none re-confirmed | memory store, user u-4471, tenant-alder | 1 entry quoted, see below |
| Retrieved passages, 12 chunks | 9,960 | 12.5% | Index updated 2026-08-29 | kb index, hybrid retrieval | 2 of 12 cited |
| Conversation history, turns 1 to 13, raw | 46,210 | 57.8% | This session | session log | See below |
| Current request | 96 | 0.1% | This turn | user | Yes |
| Total input | 79,906 | 100.0% | | | |

Two details from the rows, as the harness recorded them.

```yaml
memory_entry_quoted:
  id: mem-0193
  text: "Workspace runs Cedar Teams 8 (cloud). Prefers admin console steps."
  created: 2026-02-11
  source: inferred from conversation s-6120
  last_confirmed: never
  last_used: 2026-09-02   # quoted in at least one session every month since it was created
  expires: 90 days after last use

history_breakdown:
  user_and_assistant_messages: 12810
  tool_results:
    - turn: 3
      tool: get_workspace
      tokens: 410
      excerpt: '{"workspace": "alder-prod", "edition": "7.4.3 LTS", "hosting": "self-hosted"}'
    - turn: 5
      tool: list_tickets
      tokens: 11140
      fields_used_later: ["ticket_id"]
    - turn: 8
      tool: list_tickets
      tokens: 10920
      fields_used_later: []
    - turn: 11
      tool: list_tickets
      tokens: 10930
      fields_used_later: []
```

The answer at turn 14 opened with "In the Cedar Teams 8 admin console, go to Security, then SSO." It cited two retrieved chunks.
