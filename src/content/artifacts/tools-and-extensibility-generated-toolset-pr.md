---
title: "Pull request 412: billing tools for the support agent, illustrative"
origin: synthetic
kind: document
tool: acme-openapi-mcp
version: "1.2.0"
checkedOn: 2026-10-09
summary: A synthetic pull request that generates an MCP server from a fictional billing API, with its test report and review comments. Written for this module. The failure is planted. Not a measured result.
---

This pull request is synthetic. Acme Billing, the generator, the people, the ticket mix, and every number are invented for this module. Read it the way a reviewer would. It was approved and merged.

**Title.** Expose Acme Billing to the support agent through a generated MCP server.

**Why.** Billing tickets are a third of support volume, and the support agent cannot see billing data today. Support leads asked for it. The billing team publishes an OpenAPI 3.1 file for the Billing API v4, so we generate the server from it instead of hand-writing tools.

**What changed.**

- `acme-openapi-mcp 1.2.0` generates one MCP tool per operation in the OpenAPI file: 41 tools. Tool names are `<resource>_<verb>`. Descriptions are the operation's `summary`, and parameter descriptions are copied from the file.
- CI regenerates the server on every billing release, so the tools never drift from the API.
- The server authenticates with billing's support-integration service account, read from the vault at startup. Write operations need the `billing:write` scope, which that account holds.
- In the support agent's client config, the server's approval mode is `writes`: every write operation prompts the support rep before it runs.

**Tool inventory.**

| Resource | Tools |
|---|---|
| customers | list, get, create, update, delete, search |
| invoices | list, get, create, finalize, void, send, pay, preview |
| invoice_lines | list, get, create, delete |
| payments | list, get, capture, cancel, retry |
| refunds | list, get, create |
| credits | list, get, create |
| adjustments | list, get, create |
| payment_methods | list, get, attach, detach |
| subscriptions | list, get, update, cancel, preview_change |

Four of the generated definitions:

```json
[
  {
    "name": "refunds_create",
    "description": "Create a refund.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "payment": { "type": "string", "description": "Payment identifier." },
        "amount": { "type": "integer", "description": "Amount in minor units." },
        "metadata": { "type": "object" }
      },
      "required": ["payment"]
    }
  },
  {
    "name": "credits_create",
    "description": "Create a credit note.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "invoice": { "type": "string", "description": "Invoice identifier." },
        "amount": { "type": "integer", "description": "Amount in minor units." },
        "memo": { "type": "string" }
      },
      "required": ["invoice", "amount"]
    }
  },
  {
    "name": "adjustments_create",
    "description": "Create a balance adjustment.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "customer": { "type": "string", "description": "Customer identifier." },
        "amount": { "type": "integer", "description": "Amount in minor units. Negative values credit the customer." }
      },
      "required": ["customer", "amount"]
    }
  },
  {
    "name": "invoices_list",
    "description": "List invoices.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "customer": { "type": "string", "description": "Customer identifier." },
        "status": { "type": "string" },
        "limit": { "type": "integer", "default": 100, "maximum": 1000 },
        "expand": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
]
```

**Test report.** Run on billing staging, 2026-10-02.

```text
contract   41/41 tools callable with fixture arguments              PASS
schema     41/41 input schemas valid JSON Schema 2020-12             PASS
auth       read ops succeed with service account; writes need scope  PASS
approval   writes prompt in the support client (manual check)        PASS
latency    tool round trip p95 210 ms, p99 480 ms                    PASS
tokens     41 definitions = 23,400 tokens added to every request     noted
smoke      "What is the total on invoice INV-1042?"
           -> invoices_get, correct total, 3 of 3 runs               PASS
```

**Billing ticket mix last quarter**, from the support analytics dashboard, pasted for context:

| Ticket type | Share |
|---|---|
| Charged twice, refund the duplicate | 31% |
| Explain a proration on a plan change | 22% |
| Card declined, update the payment method | 17% |
| Send a copy of an invoice | 12% |
| Cancel or downgrade a subscription | 11% |
| Other | 7% |

**Review.**

- Billing team: "Approved. Generated from our spec, so it stays correct as the API changes."
- Security: "Approved. Credentials come from the vault, and writes need a human click."
- Support platform: "LGTM. Smoke test passes and latency is fine. Ship it."
