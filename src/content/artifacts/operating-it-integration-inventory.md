---
title: Integration inventory and security sign-off, support copilot, illustrative
origin: synthetic
kind: document
tool: none
checkedOn: 2026-10-09
summary: A synthetic integration inventory for a fictional staff-facing support copilot, one row per release, with two tool schemas, the egress config, and the reviewer's sign-off. Written for the exercise. Not a real system or review.
---

This inventory is synthetic. It was written for the Operating it failure exercise. Quillmark, its support copilot, and every integration, schema, and person here are fictional. Read it as the security record the team kept while it added capabilities, one release at a time.

The copilot runs inside Quillmark's support console. Support staff use it to answer customer tickets. Staff can open any customer's record, so the copilot's tools run with the staff member's access. Customers reach support by email at a public address and through the help center's contact form. Every inbound message becomes a ticket. Before release 1.4 the console showed the copilot's answers as plain text, and links were not clickable.

**The inventory, one row per release.**

| Release | Date | Change | What it puts in front of the model, or lets the model do | Reviewer's label | Review note |
|---|---|---|---|---|---|
| 1.0 | 2026-03-10 | Tool: search_help_center | Help-center articles written by Quillmark staff | Public content, read-only | Low risk. The content is ours. |
| 1.1 | 2026-04-02 | Tool: lookup_customer | Profile, orders, addresses, last four card digits, for any customer id | Private data, read-only | Scope customers:read. Staff are already authorized for every customer. |
| 1.2 | 2026-04-23 | Bug fixes | No change | Not applicable | No review needed. |
| 1.3 | 2026-05-14 | Tool: read_ticket_thread | The full ticket thread: inbound messages, text extracted from attachments, internal notes | Private data, read-only | Same data class as lookup_customer. No new capability class. |
| 1.4 | 2026-06-20 | Console renders the copilot's answers as Markdown, including links and images | Not applicable | UI change | Not an integration. Out of scope for this review. |
| 1.5 | 2026-07-08 | Tool: fetch_url | The text of any web page, by URL | Read-only, GET only | Sandbox network mode is limited to GET, HEAD, and OPTIONS. No writes are possible. Approved. |
| 1.6 | 2026-08-19 | search_help_center also returns community answers from the public forum | Forum posts by customers | Content change to an existing tool | No new tool. No review needed. |
| 1.7 | 2026-09-30 | Tool: draft_reply | Writes a reply draft into the ticket. A staff member clicks Send. | Write, human approved | Approval gate in place. Approved. |

**Two of the tool schemas, as the model sees them.**

```json
[
  {
    "name": "read_ticket_thread",
    "description": "Returns every message in a support ticket, oldest first, including the customer's emails, text extracted from their attachments, and internal staff notes. Use this to understand the full history before answering.",
    "input_schema": {
      "type": "object",
      "properties": {
        "ticket_id": { "type": "string", "description": "Ticket id, for example T-48811" }
      },
      "required": ["ticket_id"]
    }
  },
  {
    "name": "fetch_url",
    "description": "Fetches a web page with an HTTP GET and returns its text. Use it to read carrier tracking pages and any link a customer includes in a ticket.",
    "input_schema": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "Full http or https URL, including any query string" }
      },
      "required": ["url"]
    }
  }
]
```

**The copilot's sandbox and console configuration.**

```yaml
sandbox:
  network_mode: limited      # GET, HEAD, OPTIONS
  allowed_domains: []        # when non-empty, only matching domains are allowed
  denied_domains: ["*.quillmark.internal"]
console:
  render_markdown: true
  render_remote_images: true
  link_unfurl: true
```

**Security sign-off for release 1.7, as written.**

> Trifecta check, per release. Each release added at most one capability class, and no release combined all three. Private data: lookup_customer and read_ticket_thread. Untrusted content: none, since all content is either ours or our customers'. External communication: none, since no tool sends data out. fetch_url is GET only, and draft_reply needs a human click. Result: approved for 1.7.
>
> Signed: application security reviewer, 2026-09-29.
