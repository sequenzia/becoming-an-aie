---
title: A tool set copied from a REST API, illustrative
origin: synthetic
kind: tool-schema
tool: acme-desk-mcp
version: "0.3.0"
checkedOn: 2026-10-09
summary: A synthetic MCP tools/list response generated one tool per endpoint from a fictional helpdesk API. Written for this module. Not a real product, and nothing here was measured.
---

This tool list is synthetic. Acme Desk is a fictional helpdesk product, and its API, its ids, and its records are invented. The shape follows the Model Context Protocol's `tools/list` result as the 2026-07-28 revision defines it: a name, a description, an input schema, and optional annotations per tool.

The team generated one tool per REST endpoint from the API's OpenAPI file and copied each endpoint's summary line into the description. The server connects to the API with a single service credential.

```json
{
  "tools": [
    {
      "name": "customers_list",
      "description": "GET /v2/customers. Returns customers.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "page": { "type": "integer", "default": 1 },
          "per_page": { "type": "integer", "default": 100, "maximum": 500 }
        },
        "required": ["tenant_id"]
      }
    },
    {
      "name": "customers_get",
      "description": "GET /v2/customers/{id}. Returns a customer.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "id": { "type": "string", "format": "uuid" }
        },
        "required": ["tenant_id", "id"]
      }
    },
    {
      "name": "tickets_list",
      "description": "GET /v2/tickets. Returns tickets. Filter by customer_id or status.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "customer_id": { "type": "string", "format": "uuid" },
          "status": { "type": "string" }
        },
        "required": ["tenant_id"]
      }
    },
    {
      "name": "tickets_update",
      "description": "PATCH /v2/tickets/{id}. Updates a ticket.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "id": { "type": "string", "format": "uuid" },
          "body": { "type": "object", "additionalProperties": true }
        },
        "required": ["tenant_id", "id", "body"]
      }
    },
    {
      "name": "ticket_comments_create",
      "description": "POST /v2/tickets/{id}/comments. Creates a comment.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "id": { "type": "string", "format": "uuid" },
          "body": { "type": "string" },
          "public": { "type": "boolean", "default": true }
        },
        "required": ["tenant_id", "id", "body"]
      }
    },
    {
      "name": "users_list",
      "description": "GET /v2/users. Returns users.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "role": { "type": "string" }
        },
        "required": ["tenant_id"]
      }
    },
    {
      "name": "refunds_create",
      "description": "POST /v2/refunds. Creates a refund.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tenant_id": { "type": "string" },
          "invoice_id": { "type": "string", "format": "uuid" },
          "amount_cents": { "type": "integer" }
        },
        "required": ["tenant_id", "invoice_id", "amount_cents"]
      }
    }
  ]
}
```

One record from a `customers_list` result, as the API returns it. The tool passes the API's JSON through unchanged, 100 records per page by default.

```json
{
  "id": "3f6c1e2a-9b4d-4c1e-8f0a-2d7b5e9c4a11",
  "tenant_id": "t_8841",
  "external_ref": null,
  "display_name": "Dana Whitfield",
  "org_id": "a0b7e4d2-51c3-4f8e-9a6d-7c2e1b0f3d58",
  "created_at": "2024-03-18T10:02:44Z",
  "updated_at": "2026-09-30T16:41:09Z",
  "flags": 4,
  "locale": "en-GB",
  "sla_tier_id": 2,
  "custom_fields": { "cf_1182": "Enterprise", "cf_1190": null }
}
```

The server's connection settings, also fictional:

```yaml
# acme-desk-mcp/config.yaml
api_base: https://api.acme-desk.example/v2
credential: service-account (scope tenant:*)
annotations: none
```
