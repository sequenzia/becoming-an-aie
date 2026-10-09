---
title: The same backend as task-shaped tools, illustrative
origin: synthetic
kind: tool-schema
tool: acme-desk-mcp
version: "0.4.0"
checkedOn: 2026-10-09
summary: A synthetic redesign of the fictional helpdesk tool set around support tasks, with names beside stable ids, a verbosity switch, and explicit outcomes. Written for this module. Not a measured result.
---

This tool list is synthetic. It sits on the same fictional Acme Desk API as the copied tool set, and it is a design to evaluate, not a design proven better. The shape is the Model Context Protocol's `tools/list` result, revision 2026-07-28. The annotations are hints the server publishes; the client treats them as untrusted, and the gate described after the list does not rely on them.

```json
{
  "tools": [
    {
      "name": "desk_find_customer",
      "description": "Find a customer of the signed-in support team by name, email, or company. Use this before acting on a customer the user names. Returns at most 5 matches, each with the customer's name, company, email domain, open ticket count, and customer_id. Names are not unique: if more than one match fits, show the matches to the user and ask which one they mean. Do not guess. Use response_format 'detailed' only when you need contact history.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "A name, an email address, or a company name, as the user gave it." },
          "response_format": { "type": "string", "enum": ["concise", "detailed"], "default": "concise" }
        },
        "required": ["query"],
        "additionalProperties": false
      },
      "annotations": { "readOnlyHint": true, "openWorldHint": false }
    },
    {
      "name": "desk_get_ticket_context",
      "description": "Get one ticket with what you need to work on it: subject, status, customer name and customer_id, the last 5 comments, and the customer's billing status. Use this instead of reading lists of tickets. Accepts a ticket number such as 'T-48811' or a ticket_id.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "ticket": { "type": "string", "description": "Ticket number (T-48811) or ticket_id from an earlier result." }
        },
        "required": ["ticket"],
        "additionalProperties": false
      },
      "annotations": { "readOnlyHint": true, "openWorldHint": false }
    },
    {
      "name": "desk_draft_reply",
      "description": "Write a reply on a ticket as a draft. The customer does not see a draft; a support rep reviews and sends it. Use this for every message meant for the customer. Returns the draft_id and a link the user can open.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "ticket_id": { "type": "string" },
          "body": { "type": "string", "description": "Plain text, under 2,000 characters." }
        },
        "required": ["ticket_id", "body"],
        "additionalProperties": false
      },
      "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false }
    },
    {
      "name": "desk_set_ticket_status",
      "description": "Change a ticket's status. Only 'pending' and 'solved' are allowed. Solving a ticket sends the customer a satisfaction survey, so solve only when the user asked you to and the ticket's subject matches what they described. Returns the old and new status.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "ticket_id": { "type": "string" },
          "status": { "type": "string", "enum": ["pending", "solved"] },
          "reason": { "type": "string", "description": "One sentence, kept in the audit log." }
        },
        "required": ["ticket_id", "status", "reason"],
        "additionalProperties": false
      },
      "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true }
    },
    {
      "name": "billing_request_refund",
      "description": "Ask for a refund on one invoice. This does not move money. It files a request that billing policy decides: small duplicate-charge refunds may be approved automatically, everything else waits for a person. Returns the request_id and its state.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "invoice_id": { "type": "string" },
          "amount_cents": { "type": "integer", "minimum": 1 },
          "reason": { "type": "string", "enum": ["duplicate_charge", "service_failure", "goodwill"] }
        },
        "required": ["invoice_id", "amount_cents", "reason"],
        "additionalProperties": false
      },
      "annotations": { "readOnlyHint": false, "destructiveHint": true, "idempotentHint": false, "openWorldHint": true }
    }
  ]
}
```

A concise `desk_find_customer` result. Names come with the ids needed to act, and the second match is there on purpose.

```json
{
  "status": "confirmed",
  "matches": [
    { "name": "Dana Whitfield", "company": "Harbor Analytics", "email_domain": "harbor-analytics.example", "open_tickets": 1, "customer_id": "cus_7Q2M" },
    { "name": "Dana Whitfield", "company": "Whitfield Bakery", "email_domain": "whitfieldbakery.example", "open_tickets": 2, "customer_id": "cus_9K4T" }
  ],
  "note": "2 customers match this name. Ask the user which one."
}
```

Every mutating tool returns one of three outcomes, so the caller can tell success from failure from not knowing.

```json
[
  { "status": "confirmed", "operation_id": "op_51d2", "ticket_id": "tkt_88A1", "old_status": "open", "new_status": "solved" },
  { "status": "failed", "operation_id": "op_51d3", "error": "Ticket tkt_88A1 is already solved. Nothing changed." },
  { "status": "unknown", "operation_id": "op_51d4", "error": "Acme Desk did not answer within 10 s. The change may have been applied. Call desk_get_ticket_context before retrying." }
]
```

What code enforces, whatever the model sends:

- The tenant and the acting support rep come from the signed-in session. No tool takes a tenant parameter.
- The server's credential is scoped to one tenant and to the operations above.
- Every id is checked against the session's tenant before any call to the API.
- `billing_request_refund` goes through the billing policy service. The model cannot approve its own request.
- Every mutation carries an `operation_id` and is written to the audit log with the session's user.
